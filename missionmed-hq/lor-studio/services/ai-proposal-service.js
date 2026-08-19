import { IntegrationDisabledError, ValidationError } from '../domain/errors.js';
import {
  VerbatimEntailmentVerifier,
  inspectProtectedText,
  validateAiProposal,
} from '../domain/claim-validator.js';
import { createAiProposalProvenance } from '../domain/provenance.js';
import { assertNonEmptyString, deepFreeze, sha256 } from '../domain/value-utils.js';
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
