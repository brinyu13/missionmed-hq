import {
  DomainInvariantError,
  IntegrationDisabledError,
  NotFoundError,
  ValidationError,
} from '../domain/errors.js';
import {
  VerbatimEntailmentVerifier,
  inspectProtectedText,
  validateAiProposal,
} from '../domain/claim-validator.js';
import { createAiProposalProvenance, createHumanDecisionRecord } from '../domain/provenance.js';
import {
  assertNonEmptyString,
  assertPlainObject,
  deepFreeze,
  hashValue,
  sha256,
  toIso,
} from '../domain/value-utils.js';
import { authorizeCaseAction } from '../security/authorization-policy.js';
import { assertPort } from './ports.js';

/**
 * @typedef {{
 *   caseId: string,
 *   provider: string,
 *   model: string,
 *   templateVersion: string,
 *   evidenceReferences: Array<{ id: string, contentHash: string }>,
 *   output: string,
 *   generatedAt?: Date | string | number,
 *   id?: string,
 *   idFactory?: () => string,
 * }} AiProposalProvenanceInput
 */

/**
 * @type {(input: AiProposalProvenanceInput) => ReturnType<typeof createAiProposalProvenance>}
 */
const buildAiProposalProvenance = createAiProposalProvenance;

export class AiProposalService {
  /**
   * @param {{
   *   provider: { generateProposal: Function },
   *   fallbackProvider?: { generateProposal: Function } | null,
   *   entailmentVerifier?: { verify: Function } | null,
   *   connectiveGuardRules?: Array<{ code: string, pattern: RegExp }>,
   *   clock?: () => Date,
   * }} options
   */
  constructor({
    provider,
    fallbackProvider = null,
    entailmentVerifier = null,
    connectiveGuardRules = [],
    clock = () => new Date(),
  }) {
    this.provider = assertPort(provider, ['generateProposal'], 'provider');
    this.fallbackProvider = fallbackProvider
      ? assertPort(fallbackProvider, ['generateProposal'], 'fallbackProvider')
      : null;
    // DR-119 clause 8: without a bound semantic verifier the product can still
    // ground verbatim reproduction of approved facts. Everything beyond that is
    // reported UNAVAILABLE by this default and fails closed in the validator.
    this.entailmentVerifier = entailmentVerifier
      ? assertPort(entailmentVerifier, ['verify'], 'entailmentVerifier')
      : new VerbatimEntailmentVerifier();
    if (!Array.isArray(connectiveGuardRules)) {
      throw new ValidationError('connectiveGuardRules must be an array');
    }
    this.connectiveGuardRules = connectiveGuardRules;
    this.clock = clock;
  }

  async generate({ caseId, evidenceReferences, facts, templateVersion }) {
    assertNonEmptyString(caseId, 'caseId');
    assertNonEmptyString(templateVersion, 'templateVersion');
    if (!Array.isArray(evidenceReferences) || !Array.isArray(facts) || facts.length === 0) {
      throw new ValidationError('AI proposal requests require evidence references and facts');
    }
    const evidenceById = new Map();
    for (const [index, reference] of evidenceReferences.entries()) {
      if (
        !reference ||
        typeof reference.id !== 'string' ||
        reference.caseId !== caseId ||
        !/^[a-f0-9]{64}$/u.test(reference.contentHash ?? '') ||
        evidenceById.has(reference.id)
      ) {
        throw new ValidationError('AI evidence references must be unique, hashed, and case-bound', { index });
      }
      evidenceById.set(reference.id, reference);
    }
    const factIds = new Set();
    const approvedFacts = [];
    for (const [index, fact] of facts.entries()) {
      const reference = evidenceById.get(fact?.id);
      if (
        !reference ||
        factIds.has(fact.id) ||
        typeof fact.text !== 'string' ||
        fact.text.trim() !== fact.text ||
        sha256(fact.text) !== reference.contentHash
      ) {
        throw new ValidationError('AI fact does not match its consented evidence hash', { index });
      }
      const findings = inspectProtectedText(fact.text);
      if (findings.length > 0) {
        throw new ValidationError('AI fact contains prohibited content', { index, findings });
      }
      factIds.add(fact.id);
      approvedFacts.push({ id: fact.id, text: fact.text, contentHash: reference.contentHash });
    }
    let response;
    let fallbackUsed = false;
    try {
      response = await this.provider.generateProposal({
        caseId,
        evidenceReferences,
        facts,
        templateVersion,
      });
    } catch (error) {
      const integrationUnavailable =
        error instanceof IntegrationDisabledError || error?.code === 'INTEGRATION_DISABLED';
      if (!integrationUnavailable || !this.fallbackProvider) throw error;
      fallbackUsed = true;
      response = await this.fallbackProvider.generateProposal({
        caseId,
        evidenceReferences,
        facts,
        templateVersion,
      });
    }
    if (!response || response.state !== 'proposal') {
      throw new ValidationError('AI providers may return proposals only');
    }
    // The grounding invariant, not textual identity: every material factual
    // assertion must be entailed by approved source material, and connective
    // prose must assert no fact.
    const grounding = await validateAiProposal({
      text: response.text,
      segments: response.segments,
      claims: response.claims,
      approvedFacts,
      evidenceReferences,
      entailmentVerifier: this.entailmentVerifier,
      additionalConnectiveRules: this.connectiveGuardRules,
      caseId,
    });
    const provenance = buildAiProposalProvenance({
      caseId,
      provider: response.provider,
      model: response.model,
      templateVersion,
      evidenceReferences,
      output: response.text,
      generatedAt: this.clock(),
    });
    return deepFreeze({
      id: provenance.id,
      state: 'proposal',
      text: response.text,
      segments: structuredClone(grounding.segments),
      claims: grounding.segments
        .filter((segment) => segment.kind === 'factual')
        .map((segment) => ({ text: segment.text, supportIds: [...segment.supportIds] })),
      grounding: {
        schemaVersion: grounding.schemaVersion,
        attestationHash: grounding.attestationHash,
        factualSegmentCount: grounding.factualSegmentCount,
        connectiveSegmentCount: grounding.connectiveSegmentCount,
        supportIds: [...grounding.supportIds],
        attestations: structuredClone(grounding.attestations),
      },
      provenance,
      fallbackUsed,
      humanDecisionRequired: true,
    });
  }
}

/* -------------------------------------------------------------------------- *
 * REACHABILITY: the AI drafting plane behind the application boundary.
 *
 * `AiProposalService` above is the grounding engine. It was, until now, unreachable: nothing
 * joined it to a case, an actor, or a store, so DR-119 clause 8 could only ever be exercised by
 * calling the class directly from a test. This section is that join, and it is deliberately the
 * ONLY place where a proposal is produced for a real case, so every rule about who may draft and
 * what may become wording is enforced in one auditable sequence:
 *
 *   repository.getById   -> the case, read server-side; never supplied by a caller
 *   authorizeCaseAction  -> `write_faculty_private`: recipient-bound, OTP-verified faculty only,
 *                           over a student whose entitlement is still live (canary included)
 *   resolveApprovedEvidence -> the approved source material, derived from the stored case
 *   AiProposalService.generate -> the grounding invariant (entailment, connective allowlist)
 *   proposalStore.putProposal  -> persisted as a PROPOSAL, with `acceptedContent: null`
 *
 * Four properties are worth stating plainly, because they are the ones a future change is most
 * likely to erode:
 *
 * 1. NO CALLER SUPPLIES GROUNDING. `facts` and `evidenceReferences` are computed here from
 *    `caseRecord.studentEvidence`, and every item must carry a content hash that matches its own
 *    text and a consent receipt that actually exists on the case. A request may NARROW that set
 *    by id (`factIds`) and may do nothing else to it. If a caller could post fact text, it could
 *    ground any sentence it liked and the entailment gate would attest a fabrication.
 *
 * 2. A PROPOSAL IS NOT CONTENT. `decision` and `acceptedContent` are null on every record this
 *    module writes through `putProposal`, and the only function that can make them non-null is
 *    `recordProposalDecision`. There is no request field on the generate path that names an
 *    action, a decision, or a resulting text.
 *
 * 3. THE DECISION RECORD BINDS TO WORDING, NOT TO A HANDLE. `createHumanDecisionRecord` reads
 *    `.state`, `.id` and `.outputHash` off whatever it is handed. The RESULT of
 *    `AiProposalService.generate` has `state: 'proposal'` and an `id`, so it passes that
 *    function's own guard - and then yields `proposalOutputHash: undefined`, a decision bound to
 *    no wording at all. The nested `provenance` is the only correct argument, and the minted
 *    record is re-checked below before anything is persisted.
 *
 * 4. THE PROVIDER IS NOT CHOSEN HERE. `proposalService` is injected. This module never
 *    constructs a provider, never reads a credential, and never decides that drafting is
 *    available; an unconfigured deployment reaches the fail-closed branch in the HTTP adapter.
 * -------------------------------------------------------------------------- */

/**
 * @typedef {{
 *   id?: string,
 *   caseId: string,
 *   proposal: Record<string, any>,
 *   facultyId: string,
 *   action: string,
 *   resultingText: string | null,
 *   decidedAt?: Date | string | number,
 *   idFactory?: () => string,
 * }} HumanDecisionRecordInput
 */

/**
 * @type {(input: HumanDecisionRecordInput) => ReturnType<typeof createHumanDecisionRecord>}
 */
const buildHumanDecisionRecord = createHumanDecisionRecord;

/** The prompt template is a server-side constant, never a request field. */
export const AI_DRAFT_TEMPLATE_VERSION = 'missionmed.lor.draft-template.v1';

export const AI_PROPOSAL_RECORD_SCHEMA = 'missionmed.lor.ai-proposal-record.v1';

/** The complete set of human decisions, matching domain/provenance.js. */
export const HUMAN_DECISION_ACTIONS = deepFreeze(['accepted', 'edited', 'rejected']);

/**
 * The proposal store port.
 *
 * `putProposal` and `attachDecision` are CONDITIONAL ATOMIC WRITES, exactly like
 * `commitWithEvent` on the case repository:
 *
 *   putProposal    - keyed by (caseId, idempotencyKey). A repeat with the same requestHash
 *                    replays the stored record; a repeat with a different one is an idempotency
 *                    conflict. It must refuse a record that already carries a decision.
 *   getProposal    - returns the stored record or null. Never throws for absence.
 *   attachDecision - replaces the stored proposal with `record` ONLY IF the stored proposal is
 *                    still undecided, under the same idempotency contract. "Undecided" is
 *                    checked inside the write, not before it: a check-then-write here would let
 *                    two concurrent decisions both pass the check.
 */
const AI_PROPOSAL_STORE_METHODS = deepFreeze(['putProposal', 'getProposal', 'attachDecision']);

/** Mirrors LIMITS.approvedFactsMax / proposalTextMax in domain/claim-validator.js. */
const APPROVED_EVIDENCE_MAX = 500;
const EDITED_TEXT_MAX = 40_000;

const CONTENT_HASH_PATTERN = /^[a-f0-9]{64}$/u;

const GENERATE_REQUEST_FIELDS = deepFreeze(['actor', 'caseId', 'idempotencyKey', 'factIds']);
const DECISION_REQUEST_FIELDS = deepFreeze([
  'actor',
  'caseId',
  'proposalId',
  'idempotencyKey',
  'action',
  'resultingText',
]);
const READ_REQUEST_FIELDS = deepFreeze(['actor', 'caseId', 'proposalId']);

/**
 * The approved source material for a case, derived entirely from the stored aggregate.
 *
 * An evidence item qualifies ONLY if it is self-consistent and consented: bound to this case,
 * carrying trimmed text whose sha256 equals its own recorded contentHash, and naming a consent
 * receipt that is actually present on the case. Anything else is skipped rather than repaired -
 * a half-formed evidence row is not approved source material, and inventing the missing half is
 * how an unconsented note would become a grounded sentence.
 *
 * Prohibited content is deliberately NOT filtered here. `AiProposalService.generate` inspects
 * every fact and refuses the whole request if one is contaminated; dropping the item instead
 * would let the draft proceed while the contaminated evidence stayed on the case unnoticed.
 *
 * @param {Record<string, any>} caseRecord
 */
function resolveApprovedEvidence(caseRecord) {
  const consentReceiptIds = new Set(
    (Array.isArray(caseRecord.consentReceipts) ? caseRecord.consentReceipts : [])
      .map((receipt) => receipt?.id)
      .filter((id) => typeof id === 'string' && id.length > 0),
  );
  const references = [];
  const facts = [];
  const seen = new Set();
  const items = Array.isArray(caseRecord.studentEvidence) ? caseRecord.studentEvidence : [];
  for (const item of items) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const { id, caseId, text, contentHash, consentReceiptId } = item;
    if (typeof id !== 'string' || id.trim().length === 0 || seen.has(id)) continue;
    if (caseId !== caseRecord.id) continue;
    if (typeof text !== 'string' || text.length === 0 || text.trim() !== text) continue;
    if (typeof contentHash !== 'string' || !CONTENT_HASH_PATTERN.test(contentHash)) continue;
    if (sha256(text) !== contentHash) continue;
    if (typeof consentReceiptId !== 'string' || !consentReceiptIds.has(consentReceiptId)) continue;
    seen.add(id);
    references.push({ id, caseId: caseRecord.id, contentHash });
    facts.push({ id, text });
    if (facts.length > APPROVED_EVIDENCE_MAX) {
      throw new ValidationError('The case carries more consented evidence than a draft may ground on', {
        maximum: APPROVED_EVIDENCE_MAX,
      });
    }
  }
  return { references, facts };
}

/**
 * Narrow the approved set to the ids a writer selected. Selection is not assertion: an id that
 * the server did not already approve is refused rather than admitted.
 *
 * @param {{ references: Array<{ id: string }>, facts: Array<{ id: string, text: string }> }} approved
 * @param {unknown} factIds
 */
function selectApprovedFacts(approved, factIds) {
  if (factIds === null || factIds === undefined) return approved;
  if (!Array.isArray(factIds) || factIds.length === 0) {
    throw new ValidationError('factIds must be a non-empty array of approved evidence identifiers');
  }
  const requested = new Set();
  for (const factId of factIds) {
    if (typeof factId !== 'string' || factId.trim().length === 0 || requested.has(factId)) {
      throw new ValidationError('factIds must be unique non-empty identifiers');
    }
    requested.add(factId);
  }
  const available = new Set(approved.facts.map((fact) => fact.id));
  const unknown = [...requested].filter((factId) => !available.has(factId));
  if (unknown.length > 0) {
    throw new ValidationError('factIds must name evidence the case already carries under consent', {
      unknown,
    });
  }
  return {
    references: approved.references.filter((reference) => requested.has(reference.id)),
    facts: approved.facts.filter((fact) => requested.has(fact.id)),
  };
}

/**
 * @param {{ proposal: Record<string, any>, caseRecord: Record<string, any>, actorId: string, at: Date }} input
 */
function buildProposalRecord({ proposal, caseRecord, actorId, at }) {
  if (proposal?.state !== 'proposal' || proposal.humanDecisionRequired !== true) {
    throw new ValidationError('The AI plane persists proposals only; nothing here finalizes wording');
  }
  const provenance = proposal.provenance;
  if (
    provenance?.state !== 'proposal' ||
    provenance.caseId !== caseRecord.id ||
    !CONTENT_HASH_PATTERN.test(String(provenance.outputHash ?? ''))
  ) {
    throw new ValidationError('An AI proposal must carry case-bound hashed provenance before it is persisted');
  }
  return deepFreeze({
    schemaVersion: AI_PROPOSAL_RECORD_SCHEMA,
    id: provenance.id,
    caseId: caseRecord.id,
    requestedBy: actorId,
    requestedAt: at.toISOString(),
    state: 'proposal',
    humanDecisionRequired: true,
    text: proposal.text,
    segments: structuredClone(proposal.segments),
    claims: structuredClone(proposal.claims),
    grounding: structuredClone(proposal.grounding),
    provenance: structuredClone(provenance),
    fallbackUsed: proposal.fallbackUsed === true,
    // A proposal is never content. Only recordProposalDecision writes these two.
    decision: null,
    acceptedContent: null,
  });
}

/**
 * @param {{ action: string, resultingText: unknown, record: Record<string, any> }} input
 * @returns {string | null}
 */
function resolveDecisionText({ action, resultingText, record }) {
  const supplied = resultingText !== null && resultingText !== undefined;
  if (action === 'rejected') {
    if (supplied) throw new ValidationError('A rejected proposal produces no resulting text');
    return null;
  }
  if (action === 'accepted') {
    // Accepting means accepting the wording that passed the grounding gate. If the body could
    // name the accepted text, "accept" would become a channel for text no verifier ever saw.
    if (supplied) throw new ValidationError('An accepted proposal is accepted exactly as proposed');
    return record.text;
  }
  if (typeof resultingText !== 'string' || resultingText.trim().length === 0) {
    throw new ValidationError('An edited proposal requires the human wording that replaces it');
  }
  if (resultingText.length > EDITED_TEXT_MAX) {
    throw new ValidationError('The edited wording exceeds the maximum letter length', {
      maximum: EDITED_TEXT_MAX,
    });
  }
  const findings = inspectProtectedText(resultingText);
  if (findings.length > 0) {
    throw new ValidationError('The edited wording contains prohibited content', { findings });
  }
  return resultingText;
}

/**
 * @typedef {object} AiDraftingServiceOptions
 * @property {{ generate: Function }} proposalService
 * @property {{ getById: (caseId: string) => Promise<Record<string, any>> }} repository
 * @property {{ getStudentEntitlement: (input: { studentId: string }) => Promise<any> }} entitlementPort
 * @property {{ putProposal: Function, getProposal: Function, attachDecision: Function }} proposalStore
 * @property {() => Date | string | number} [clock]
 * @property {boolean} [requireCanary]
 * @property {string} [templateVersion]
 */

/**
 * @param {AiDraftingServiceOptions} options
 */
export function createAiDraftingService({
  proposalService,
  repository,
  entitlementPort,
  proposalStore,
  clock = () => new Date(),
  // Defaults to the strictest setting, for the same reason the artifact service does: a drafting
  // service that evaluated entitlement with a weaker canary requirement than the case service
  // would be a quieter way of widening access than changing the policy.
  requireCanary = true,
  templateVersion = AI_DRAFT_TEMPLATE_VERSION,
} = /** @type {any} */ ({})) {
  assertPort(proposalService, ['generate'], 'proposalService');
  assertPort(repository, ['getById'], 'repository');
  assertPort(entitlementPort, ['getStudentEntitlement'], 'entitlementPort');
  assertPort(proposalStore, [...AI_PROPOSAL_STORE_METHODS], 'proposalStore');
  if (typeof clock !== 'function') throw new TypeError('clock must be a server-side function');
  if (typeof requireCanary !== 'boolean') throw new TypeError('requireCanary must be an explicit boolean');
  assertNonEmptyString(templateVersion, 'templateVersion', { maxLength: 200 });

  /**
   * @param {{ input: Record<string, any>, allowed: readonly string[], label: string }} spec
   */
  function assertRequestShape({ input, allowed, label }) {
    const request = assertPlainObject(input, label);
    const unexpected = Object.keys(request).filter((key) => !allowed.includes(key));
    if (unexpected.length > 0) {
      // Named explicitly because this is the forgery boundary: grounding, entitlement, grants,
      // provenance, and decision records are all resolved server-side, and a caller that
      // supplies one is refused rather than having it quietly ignored.
      throw new ValidationError('AI drafting accepts no caller-supplied grounding or authorization material');
    }
    return request;
  }

  /**
   * @param {{ actor: unknown, caseId: unknown, action: string, now: Date }} input
   */
  async function authorize({ actor, caseId, action, now }) {
    assertNonEmptyString(caseId, 'caseId', { maxLength: 200 });
    const caseRecord = await repository.getById(String(caseId));
    const entitlement = await entitlementPort.getStudentEntitlement({ studentId: caseRecord.studentId });
    // The single authorization decision. `write_faculty_private` is the FACULTY_ACTIONS entry
    // for authoring, so a student, a mentor, an operational role, a service principal, and a
    // faculty member who is not the recipient-bound verified writer are all refused here.
    authorizeCaseAction({ actor, action, caseRecord, entitlement, requireCanary, now });
    return caseRecord;
  }

  /**
   * Request a grounded AI proposal for a case. Returns a PROPOSAL; it is not wording anyone may
   * use until a human decides on it.
   *
   * @param {{ actor: { id: string, role: string }, caseId: string, idempotencyKey: string, factIds?: string[] | null }} input
   */
  async function requestProposal(input) {
    const request = assertRequestShape({
      input,
      allowed: GENERATE_REQUEST_FIELDS,
      label: 'AI proposal request',
    });
    const { actor, caseId, idempotencyKey, factIds = null } = request;
    assertNonEmptyString(idempotencyKey, 'idempotencyKey', { maxLength: 200 });
    const at = new Date(toIso(clock(), 'ai drafting clock'));
    const caseRecord = await authorize({ actor, caseId, action: 'write_faculty_private', now: at });

    const selected = selectApprovedFacts(resolveApprovedEvidence(caseRecord), factIds);
    if (selected.facts.length === 0) {
      throw new ValidationError('The case carries no consented, hash-bound evidence to ground a draft on');
    }

    const proposal = await proposalService.generate({
      caseId: caseRecord.id,
      evidenceReferences: selected.references,
      facts: selected.facts,
      templateVersion,
    });
    const record = buildProposalRecord({ proposal, caseRecord, actorId: actor.id, at });
    const requestHash = hashValue({
      operation: 'ai.proposal.generate',
      caseId: caseRecord.id,
      actorId: actor.id,
      templateVersion,
      factIds: selected.facts.map((fact) => fact.id),
    });
    const stored = await proposalStore.putProposal({
      caseId: caseRecord.id,
      idempotencyKey,
      requestHash,
      record,
    });
    return deepFreeze(stored?.record ?? stored);
  }

  /**
   * Record the MANDATORY human decision on a proposal. This is the only path by which proposed
   * wording acquires `acceptedContent`.
   *
   * @param {{
   *   actor: { id: string, role: string },
   *   caseId: string,
   *   proposalId: string,
   *   idempotencyKey: string,
   *   action: 'accepted' | 'edited' | 'rejected',
   *   resultingText?: string | null,
   * }} input
   */
  async function recordProposalDecision(input) {
    const request = assertRequestShape({
      input,
      allowed: DECISION_REQUEST_FIELDS,
      label: 'AI proposal decision',
    });
    const { actor, caseId, proposalId, idempotencyKey, action, resultingText = null } = request;
    assertNonEmptyString(idempotencyKey, 'idempotencyKey', { maxLength: 200 });
    assertNonEmptyString(proposalId, 'proposalId', { maxLength: 200 });
    if (typeof action !== 'string' || !HUMAN_DECISION_ACTIONS.includes(action)) {
      throw new ValidationError('A human decision must be accepted, edited, or rejected');
    }
    const at = new Date(toIso(clock(), 'ai drafting clock'));
    const caseRecord = await authorize({ actor, caseId, action: 'write_faculty_private', now: at });

    const record = await proposalStore.getProposal({ caseId: caseRecord.id, proposalId });
    if (!record || record.caseId !== caseRecord.id) {
      throw new NotFoundError('ai_proposal', proposalId);
    }
    if (record.schemaVersion !== AI_PROPOSAL_RECORD_SCHEMA) {
      throw new ValidationError('Unsupported AI proposal record schema');
    }

    const decisionText = resolveDecisionText({ action, resultingText, record });
    const decision = buildHumanDecisionRecord({
      caseId: caseRecord.id,
      // THE TRAP, stated where it bites: this argument must be the nested PROVENANCE, never the
      // AiProposalService result. The result also has `state: 'proposal'` and an `id`, so it
      // satisfies createHumanDecisionRecord's own guard - and then silently mints
      // `proposalOutputHash: undefined`, a signed human decision that binds to no wording.
      proposal: record.provenance,
      // Server-side. The deciding principal is the authorized actor, never a body field.
      facultyId: actor.id,
      action,
      resultingText: decisionText,
      decidedAt: at,
    });
    if (!CONTENT_HASH_PATTERN.test(String(decision.proposalOutputHash ?? ''))) {
      // Belt and braces for the trap above: a decision that names no wording is not a decision.
      throw new ValidationError('A human decision must bind to the exact proposal wording it decided');
    }
    if (decision.proposalOutputHash !== record.provenance.outputHash) {
      throw new ValidationError('The human decision does not bind to the stored proposal wording');
    }

    const acceptedContent = decisionText === null ? null : {
      origin: action === 'accepted' ? 'ai_proposal_accepted' : 'human_edited',
      text: decisionText,
      textHash: sha256(decisionText),
      // Provenance survives the decision: the accepted wording keeps the evidence it was built
      // from and the attestation hash that covers the grounding run.
      supportIds: [...record.grounding.supportIds],
      groundingAttestationHash: record.grounding.attestationHash,
      // TRUE only where the persisted wording IS the text the entailment gate attested. An edit
      // is human authorship - screened for prohibited content and carrying a decision record,
      // but attested by no verifier - and nothing downstream may read it as though it were.
      groundedAsAttested: action === 'accepted',
      proposalId: record.id,
      decisionId: decision.id,
      decidedAt: decision.decidedAt,
    };

    const nextRecord = deepFreeze({
      ...record,
      state: 'decided',
      humanDecisionRequired: false,
      decision: structuredClone(decision),
      acceptedContent,
    });
    const requestHash = hashValue({
      operation: 'ai.proposal.decide',
      caseId: caseRecord.id,
      proposalId: record.id,
      actorId: actor.id,
      action,
      resultingTextHash: decision.resultingTextHash,
    });
    // Conditional atomic write. The "still undecided" test lives inside the store, not here: a
    // read-then-write in this function would let two concurrent decisions both see `null`.
    const stored = await proposalStore.attachDecision({
      caseId: caseRecord.id,
      proposalId: record.id,
      idempotencyKey,
      requestHash,
      record: nextRecord,
    });
    return deepFreeze(stored?.record ?? stored);
  }

  /**
   * @param {{ actor: { id: string, role: string }, caseId: string, proposalId: string }} input
   */
  async function getProposal(input) {
    const request = assertRequestShape({
      input,
      allowed: READ_REQUEST_FIELDS,
      label: 'AI proposal read',
    });
    const { actor, caseId, proposalId } = request;
    assertNonEmptyString(proposalId, 'proposalId', { maxLength: 200 });
    const at = new Date(toIso(clock(), 'ai drafting clock'));
    const caseRecord = await authorize({ actor, caseId, action: 'read_faculty_projection', now: at });
    const record = await proposalStore.getProposal({ caseId: caseRecord.id, proposalId });
    if (!record || record.caseId !== caseRecord.id) {
      throw new NotFoundError('ai_proposal', proposalId);
    }
    return deepFreeze(record);
  }

  return Object.freeze({
    templateVersion,
    requestProposal,
    recordProposalDecision,
    getProposal,
  });
}

/**
 * The refusal a store must raise when a second human decision is attempted on a proposal that
 * already carries one. Exported so a durable implementation and the test store cannot drift on
 * the reason code an operator sees.
 *
 * @param {string} proposalId
 */
export function aiProposalAlreadyDecided(proposalId) {
  return new DomainInvariantError('An AI proposal carries exactly one human decision', {
    reasonCode: 'AI_PROPOSAL_ALREADY_DECIDED',
    proposalId,
  });
}
