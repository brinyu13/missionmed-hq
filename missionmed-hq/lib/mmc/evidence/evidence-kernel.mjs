import crypto from 'node:crypto';

import { PolicyRegistry } from '../policy/policy-registry.mjs';
import { MMC_CAPABILITIES, MmcHttpError, assertCapability } from '../trust/security.mjs';

const MAX_TRANSCRIPT_BYTES = 10 * 1024 * 1024;
// Risk/attention state is computed deterministically from canonical facts and
// reviewed commitments; it is never accepted as an AI-authored truth object.
const PROPOSAL_TYPES = new Set(['FACT', 'RECOMMENDATION', 'OPEN_LOOP', 'TASK_CANDIDATE']);

export class EvidenceKernel {
  #policies;
  #authorizeGrant;
  #authorizeAssignment;
  #clock;
  #idFactory;
  #transcripts = new Map();
  #spans = new Map();
  #proposals = new Map();
  #canonical = new Map();
  #reviews = [];
  #lineage = [];
  #transcriptLocks = new Map();
  #proposalCreateLocks = new Map();
  #proposalReviewLocks = new Map();
  #spanLocks = new Map();

  constructor(options = {}) {
    this.#policies = options.policyRegistry || new PolicyRegistry();
    this.#authorizeGrant = options.authorizeGrant || (() => false);
    this.#authorizeAssignment = options.authorizeAssignment || (() => false);
    this.#clock = options.clock || (() => new Date());
    this.#idFactory = options.idFactory || (() => crypto.randomUUID());
  }

  async registerTranscript(input, context = {}) {
    const worker = requirePrincipal(context.principal);
    assertCapability(worker, MMC_CAPABILITIES.WORKER_COMPLETE);
    assertExact(input, [
      'id', 'assetHandle', 'contentHash', 'transcript', 'segments', 'authorityGrantIds',
      'subjectId', 'assignmentId',
    ]);
    const id = opaque(input.id, 'transcript id');
    const assetHandle = opaque(input.assetHandle, 'asset handle');
    const subjectId = opaque(input.subjectId, 'subject id');
    const assignmentId = opaque(input.assignmentId, 'assignment id');
    const transcript = boundedText(input.transcript, 1, MAX_TRANSCRIPT_BYTES, 'transcript', true);
    const encoded = Buffer.from(transcript, 'utf8');
    const contentHash = sha256(encoded);
    if (contentHash !== requireHash(input.contentHash, 'content hash')) {
      invalid('TRANSCRIPT_HASH_MISMATCH', 'The transcript content hash does not match.');
    }
    if (!Array.isArray(input.authorityGrantIds) || input.authorityGrantIds.length < 1 || input.authorityGrantIds.length > 20) {
      invalid('TRANSCRIPT_AUTHORITY_REQUIRED', 'Transcript processing requires an authority grant.');
    }
    const grants = input.authorityGrantIds.map((grantId) => opaque(grantId, 'authority grant id'));
    const segments = validateSegments(input.segments, encoded);
    const record = deepFreeze({
      id, tenantId: worker.tenantId, environment: worker.environment, assetHandle,
      subjectId, assignmentId,
      contentHash, byteLength: encoded.length, transcript, segments, authorityGrantIds: grants,
      createdAt: this.#clock().toISOString(),
    });
    return this.#withTranscriptLock(worker, id, async () => {
      const key = scopedEntityKey(worker.tenantId, worker.environment, id);
      if (this.#transcripts.has(key)) conflict('TRANSCRIPT_EXISTS', 'The immutable transcript already exists.');
      const authorityActive = await this.#authorizeGrant({
        action: 'TRANSCRIPT_PROCESS', principal: worker, authorityGrantIds: grants,
        assetHandle, subjectId, assignmentId,
        tenantId: worker.tenantId, environment: worker.environment,
      });
      if (authorityActive !== true) {
        throw new MmcHttpError(403, 'TRANSCRIPT_AUTHORITY_DENIED', 'Transcript processing authority is not active.');
      }
      if (this.#transcripts.has(key)) conflict('TRANSCRIPT_EXISTS', 'The immutable transcript already exists.');
      this.#transcripts.set(key, record);
      return publicTranscript(record);
    });
  }

  async createTranscriptSpan(input, context = {}) {
    const worker = requirePrincipal(context.principal);
    assertCapability(worker, MMC_CAPABILITIES.WORKER_COMPLETE);
    assertExact(input, ['transcriptId', 'startByte', 'endByte', 'quote', 'speaker', 'startMs', 'endMs']);
    const transcript = this.#scopedTranscript(input.transcriptId, worker);
    if (await this.#authorizeGrant({
      action: 'EVIDENCE_SPAN_CREATE',
      principal: worker,
      authorityGrantIds: transcript.authorityGrantIds,
      assetHandle: transcript.assetHandle,
      subjectId: transcript.subjectId,
      assignmentId: transcript.assignmentId,
      tenantId: worker.tenantId,
      environment: worker.environment,
    }) !== true) {
      throw new MmcHttpError(403, 'TRANSCRIPT_AUTHORITY_DENIED', 'Transcript processing authority is not active.');
    }
    const startByte = boundedInteger(input.startByte, 0, transcript.byteLength - 1, 'start byte');
    const endByte = boundedInteger(input.endByte, startByte + 1, transcript.byteLength, 'end byte');
    const quote = boundedText(input.quote, 1, 32 * 1024, 'quote', true);
    const buffer = Buffer.from(transcript.transcript, 'utf8');
    const exactBytes = buffer.subarray(startByte, endByte);
    const exactQuote = exactBytes.toString('utf8');
    if (!Buffer.from(exactQuote, 'utf8').equals(exactBytes) || exactQuote !== quote) {
      invalid('EVIDENCE_SPAN_MISMATCH', 'The evidence quote is not an exact UTF-8 source span.');
    }
    const speaker = boundedText(input.speaker, 1, 160, 'speaker');
    const startMs = boundedInteger(input.startMs, 0, Number.MAX_SAFE_INTEGER, 'start time');
    const endMs = boundedInteger(input.endMs, startMs, Number.MAX_SAFE_INTEGER, 'end time');
    const segment = transcript.segments.find((candidate) => (
      startByte >= candidate.startByte && endByte <= candidate.endByte
      && startMs >= candidate.startMs && endMs <= candidate.endMs
    ));
    if (!segment || segment.speaker !== speaker) {
      invalid('EVIDENCE_SPEAKER_MISMATCH', 'The evidence speaker/time attribution is not supported by the source segment.');
    }
    const identity = sha256(JSON.stringify({ transcriptId: transcript.id, startByte, endByte, speaker, startMs, endMs }));
    const id = `span_${identity}`;
    const spanKey = scopedEntityKey(worker.tenantId, worker.environment, id);
    const existing = this.#spans.get(spanKey);
    if (existing) return publicSpan(existing);
    const span = deepFreeze({
      id, tenantId: worker.tenantId, environment: worker.environment,
      transcriptId: transcript.id, sourceHash: transcript.contentHash,
      subjectId: transcript.subjectId, assignmentId: transcript.assignmentId,
      startByte, endByte, quote, speaker, startMs, endMs,
      state: 'ACTIVE', createdAt: this.#clock().toISOString(),
    });
    this.#spans.set(spanKey, span);
    this.#lineage.push(deepFreeze({
      relation: 'SOURCE_TO_SPAN', sourceId: transcript.id, targetId: id,
      tenantId: transcript.tenantId, environment: transcript.environment,
      subjectId: transcript.subjectId, assignmentId: transcript.assignmentId,
    }));
    return publicSpan(span);
  }

  async createAiProposal(input, context = {}) {
    const worker = requirePrincipal(context.principal);
    assertCapability(worker, MMC_CAPABILITIES.WORKER_ANALYSIS);
    assertExact(input, [
      'id', 'subjectId', 'proposalType', 'assertion', 'evidenceSpanIds', 'confidenceMethod',
      'confidenceValue', 'analysisRunId', 'modelId', 'promptVersionId', 'policyVersionId',
    ]);
    const id = opaque(input.id, 'proposal id');
    const proposalKey = scopedEntityKey(worker.tenantId, worker.environment, id);
    const subjectId = opaque(input.subjectId, 'subject id');
    const proposalType = requireEnum(input.proposalType, PROPOSAL_TYPES, 'proposal type');
    const assertion = boundedText(input.assertion, 1, 8000, 'proposal assertion');
    if (!Array.isArray(input.evidenceSpanIds) || input.evidenceSpanIds.length < 1 || input.evidenceSpanIds.length > 100) {
      invalid('PROPOSAL_EVIDENCE_REQUIRED', 'AI proposals require bounded exact evidence spans.');
    }
    const observedSpans = input.evidenceSpanIds.map((spanId) => this.#scopedActiveSpan(spanId, worker));
    if (observedSpans.some((span) => span.subjectId !== subjectId)) {
      invalid('PROPOSAL_SUBJECT_EVIDENCE_MISMATCH', 'Proposal evidence is not bound to the target subject.');
    }
    const assignmentIds = [...new Set(observedSpans.map((span) => span.assignmentId))];
    if (assignmentIds.length !== 1) {
      invalid('PROPOSAL_ASSIGNMENT_EVIDENCE_MISMATCH', 'Proposal evidence must share one exact assignment binding.');
    }
    if (proposalType === 'FACT' && !observedSpans.some((span) => span.quote === assertion)) {
      invalid('PROPOSAL_FACT_UNSUPPORTED', 'A factual proposal must exactly match an active evidence span.');
    }
    const transcripts = [...new Set(observedSpans.map((span) => span.transcriptId))]
      .map((transcriptId) => this.#scopedTranscript(transcriptId, worker));
    const authorityGrantIds = [...new Set(transcripts.flatMap((transcript) => transcript.authorityGrantIds))];
    if (await this.#authorizeGrant({
      action: 'AI_PROPOSAL_CREATE',
      principal: worker,
      authorityGrantIds,
      subjectId,
      assignmentId: assignmentIds[0],
      tenantId: worker.tenantId,
      environment: worker.environment,
    }) !== true) {
      throw new MmcHttpError(403, 'PROPOSAL_AUTHORITY_DENIED', 'AI proposal authority is not active.');
    }
    return this.#withSpanLocks(worker, observedSpans.map((span) => span.id), async () => {
      const spans = input.evidenceSpanIds.map((spanId) => this.#scopedActiveSpan(spanId, worker));
      if (spans.some((span) => span.subjectId !== subjectId)
        || spans.some((span) => span.assignmentId !== assignmentIds[0])) {
        invalid('PROPOSAL_EVIDENCE_CHANGED', 'Proposal evidence changed while authority was being checked.');
      }
      if (proposalType === 'FACT' && !spans.some((span) => span.quote === assertion)) {
        invalid('PROPOSAL_FACT_UNSUPPORTED', 'A factual proposal must exactly match an active evidence span.');
      }
      const policyVersionId = opaque(input.policyVersionId, 'policy version id');
      this.#policies.requireActive({
        tenantId: worker.tenantId, environment: worker.environment, kind: 'EVIDENCE', policyId: policyVersionId,
      });
      const confidenceValue = input.confidenceValue;
      if (!Number.isFinite(confidenceValue) || confidenceValue < 0 || confidenceValue > 1) {
        invalid('PROPOSAL_CONFIDENCE_INVALID', 'Proposal confidence must be between zero and one.');
      }
      const proposal = deepFreeze({
        id, tenantId: worker.tenantId, environment: worker.environment, subjectId,
        assignmentId: assignmentIds[0],
        proposalType, assertion, evidenceSpanIds: spans.map((span) => span.id),
        confidenceMethod: opaque(input.confidenceMethod, 'confidence method'), confidenceValue,
        analysisRunId: opaque(input.analysisRunId, 'analysis run id'),
        modelId: opaque(input.modelId, 'model id'), promptVersionId: opaque(input.promptVersionId, 'prompt version id'),
        policyVersionId, origin: 'AI_PROPOSAL', reviewState: 'REVIEW_REQUIRED',
        operationalEligible: false, publicationEligible: false,
        createdAt: this.#clock().toISOString(),
      });
      return this.#withProposalCreateLock(worker, id, async () => {
        if (this.#proposals.has(proposalKey)) conflict('PROPOSAL_EXISTS', 'The immutable proposal already exists.');
        if (await this.#authorizeGrant({
          action: 'AI_PROPOSAL_CREATE',
          principal: worker,
          authorityGrantIds,
          subjectId,
          assignmentId: assignmentIds[0],
          tenantId: worker.tenantId,
          environment: worker.environment,
        }) !== true) {
          throw new MmcHttpError(403, 'PROPOSAL_AUTHORITY_DENIED',
            'AI proposal authority is not active at the commit boundary.');
        }
        this.#policies.requireActive({
          tenantId: worker.tenantId, environment: worker.environment, kind: 'EVIDENCE', policyId: policyVersionId,
        });
        const lineage = spans.map((span) => deepFreeze({
          relation: 'SPAN_TO_PROPOSAL', sourceId: span.id, targetId: id,
          tenantId: proposal.tenantId, environment: proposal.environment,
          subjectId: proposal.subjectId, assignmentId: proposal.assignmentId,
        }));
        this.#proposals.set(proposalKey, proposal);
        this.#lineage.push(...lineage);
        return structuredClone(proposal);
      });
    });
  }

  async reviewProposal(input, context = {}) {
    const reviewer = requirePrincipal(context.principal);
    assertCapability(reviewer, MMC_CAPABILITIES.REVIEW);
    assertExact(input, ['proposalId', 'decision', 'editedText', 'rationale', 'policyVersionId']);
    const observedProposal = this.#scopedProposal(input.proposalId, reviewer);
    if (await this.#authorizeAssignment({
      action: 'PROPOSAL_REVIEW',
      principal: reviewer,
      assignmentId: observedProposal.assignmentId,
      subjectId: observedProposal.subjectId,
      tenantId: reviewer.tenantId,
      environment: reviewer.environment,
    }) !== true) {
      throw new MmcHttpError(403, 'REVIEW_ASSIGNMENT_DENIED', 'The exact subject assignment is not active for review.');
    }

    return this.#withProposalReviewLock(observedProposal, async () => {
      const proposal = this.#scopedProposal(observedProposal.id, reviewer);
      if (proposal !== observedProposal) {
        if (proposal.reviewState !== 'REVIEW_REQUIRED' && proposal.reviewState !== 'IN_REVIEW') {
          conflict('PROPOSAL_ALREADY_DECIDED', 'The proposal has already been decided.');
        }
        conflict('PROPOSAL_REVIEW_CONFLICT', 'The proposal changed while the review was being authorized; retry the review.');
      }
      if (await this.#authorizeAssignment({
        action: 'PROPOSAL_REVIEW',
        principal: reviewer,
        assignmentId: proposal.assignmentId,
        subjectId: proposal.subjectId,
        tenantId: reviewer.tenantId,
        environment: reviewer.environment,
      }) !== true) {
        throw new MmcHttpError(403, 'REVIEW_ASSIGNMENT_DENIED',
          'The exact subject assignment is not active for review.');
      }
      return this.#commitProposalReview(input, reviewer, proposal);
    });
  }

  #commitProposalReview(input, reviewer, proposal) {
    if (proposal.reviewState !== 'REVIEW_REQUIRED' && proposal.reviewState !== 'IN_REVIEW') {
      conflict('PROPOSAL_ALREADY_DECIDED', 'The proposal has already been decided.');
    }
    const policyVersionId = opaque(input.policyVersionId, 'policy version id');
    if (policyVersionId !== proposal.policyVersionId) invalid('REVIEW_POLICY_MISMATCH', 'The review policy does not match the proposal.');
    this.#policies.requireActive({
      tenantId: reviewer.tenantId, environment: reviewer.environment, kind: 'EVIDENCE', policyId: policyVersionId,
    });
    const decision = requireEnum(input.decision, new Set(['ACCEPT', 'REJECT', 'DEFER', 'REQUEST_EVIDENCE']), 'review decision');
    const rationale = boundedText(input.rationale, 3, 2000, 'review rationale');
    const editedText = input.editedText == null || input.editedText === ''
      ? proposal.assertion : boundedText(input.editedText, 1, 8000, 'reviewed text');
    const spans = proposal.evidenceSpanIds.map((spanId) => this.#scopedActiveSpan(spanId, reviewer));
    if (proposal.proposalType === 'FACT' && !spans.some((span) => span.quote === editedText)) {
      invalid('UNSUPPORTED_FACTUAL_EDIT', 'A factual edit must remain exactly supported by an evidence span.');
    }
    const reviewState = { ACCEPT: 'APPROVED', REJECT: 'REJECTED', DEFER: 'IN_REVIEW', REQUEST_EVIDENCE: 'REVIEW_REQUIRED' }[decision];
    const reviewedAt = this.#clock().toISOString();
    const reviewRecord = deepFreeze({
      id: `review_${this.#idFactory()}`,
      tenantId: reviewer.tenantId,
      environment: reviewer.environment,
      proposalId: proposal.id,
      assignmentId: proposal.assignmentId,
      subjectId: proposal.subjectId,
      reviewerId: reviewer.id,
      decision,
      rationale,
      editedText,
      policyVersionId,
      reviewedAt,
    });
    const updated = deepFreeze({
      ...proposal, reviewState, reviewerId: reviewer.id, reviewDecision: decision,
      reviewRationale: rationale, reviewedAt,
    });
    const canonical = decision === 'ACCEPT' ? deepFreeze({
      id: `canonical_${this.#idFactory()}`,
      tenantId: reviewer.tenantId,
      environment: reviewer.environment,
      subjectId: proposal.subjectId,
      assignmentId: proposal.assignmentId,
      kind: proposal.proposalType,
      text: editedText,
      origin: 'AI_PROPOSAL',
      evidenceSpanIds: proposal.evidenceSpanIds,
      sourceProposalId: proposal.id,
      reviewerId: reviewer.id,
      policyVersionId,
      reviewState: 'APPROVED',
      operationalEligible: true,
      publicationEligible: false,
      state: 'ACTIVE',
      version: 1,
      createdAt: reviewedAt,
    }) : null;
    const lineage = canonical ? deepFreeze({
      relation: 'PROPOSAL_TO_CANONICAL', sourceId: proposal.id, targetId: canonical.id,
      tenantId: proposal.tenantId, environment: proposal.environment,
      subjectId: proposal.subjectId, assignmentId: proposal.assignmentId,
    }) : null;

    // All values are validated and frozen before the synchronous commit block.
    this.#reviews.push(reviewRecord);
    this.#proposals.set(scopedEntityKey(proposal.tenantId, proposal.environment, proposal.id), updated);
    if (canonical) {
      this.#canonical.set(scopedEntityKey(canonical.tenantId, canonical.environment, canonical.id), canonical);
      this.#lineage.push(lineage);
    }
    return structuredClone(canonical || updated);
  }

  async #withProposalReviewLock(proposal, operation) {
    const key = JSON.stringify([proposal.tenantId, proposal.environment, proposal.id]);
    const previous = this.#proposalReviewLocks.get(key) || Promise.resolve();
    let release;
    const turn = new Promise((resolve) => { release = resolve; });
    const tail = previous.then(() => turn);
    this.#proposalReviewLocks.set(key, tail);
    await previous;
    try {
      return await operation();
    } finally {
      release();
      if (this.#proposalReviewLocks.get(key) === tail) this.#proposalReviewLocks.delete(key);
    }
  }

  async #withProposalCreateLock(principal, proposalId, operation) {
    const key = scopedEntityKey(principal.tenantId, principal.environment, proposalId);
    const previous = this.#proposalCreateLocks.get(key) || Promise.resolve();
    let release;
    const turn = new Promise((resolve) => { release = resolve; });
    const tail = previous.then(() => turn);
    this.#proposalCreateLocks.set(key, tail);
    await previous;
    try {
      return await operation();
    } finally {
      release();
      if (this.#proposalCreateLocks.get(key) === tail) this.#proposalCreateLocks.delete(key);
    }
  }

  async #withTranscriptLock(principal, transcriptId, operation) {
    const key = scopedEntityKey(principal.tenantId, principal.environment, transcriptId);
    const previous = this.#transcriptLocks.get(key) || Promise.resolve();
    let release;
    const turn = new Promise((resolve) => { release = resolve; });
    const tail = previous.then(() => turn);
    this.#transcriptLocks.set(key, tail);
    await previous;
    try {
      return await operation();
    } finally {
      release();
      if (this.#transcriptLocks.get(key) === tail) this.#transcriptLocks.delete(key);
    }
  }

  async #withSpanLock(principal, spanId, operation) {
    const key = scopedEntityKey(principal.tenantId, principal.environment, spanId);
    const previous = this.#spanLocks.get(key) || Promise.resolve();
    let release;
    const turn = new Promise((resolve) => { release = resolve; });
    const tail = previous.then(() => turn);
    this.#spanLocks.set(key, tail);
    await previous;
    try {
      return await operation();
    } finally {
      release();
      if (this.#spanLocks.get(key) === tail) this.#spanLocks.delete(key);
    }
  }

  async #withSpanLocks(principal, spanIds, operation) {
    const ordered = [...new Set(spanIds)].sort();
    const acquire = (index) => (
      index >= ordered.length
        ? operation()
        : this.#withSpanLock(principal, ordered[index], () => acquire(index + 1))
    );
    return acquire(0);
  }

  async createHumanJudgment(input, context = {}) {
    const reviewer = requirePrincipal(context.principal);
    assertCapability(reviewer, MMC_CAPABILITIES.REVIEW);
    assertExact(input, [
      'id', 'subjectId', 'assignmentId', 'kind', 'text', 'rationale', 'uncertainty',
      'inputIds', 'policyVersionId',
    ]);
    const kind = requireEnum(input.kind, new Set(['RECOMMENDATION', 'PROFESSIONAL_JUDGMENT']), 'judgment kind');
    if (!Array.isArray(input.inputIds) || input.inputIds.length > 100) invalid('JUDGMENT_INPUTS_INVALID', 'Judgment inputs are invalid.');
    const policyVersionId = opaque(input.policyVersionId, 'policy version id');
    this.#policies.requireActive({
      tenantId: reviewer.tenantId, environment: reviewer.environment, kind: 'ADVISING', policyId: policyVersionId,
    });
    const subjectId = opaque(input.subjectId, 'subject id');
    const assignmentId = opaque(input.assignmentId, 'assignment id');
    if (await this.#authorizeAssignment({
      action: 'HUMAN_JUDGMENT_CREATE',
      principal: reviewer,
      assignmentId,
      subjectId,
      tenantId: reviewer.tenantId,
      environment: reviewer.environment,
    }) !== true) {
      throw new MmcHttpError(403, 'JUDGMENT_ASSIGNMENT_DENIED', 'The exact subject assignment is not active for judgment.');
    }
    this.#policies.requireActive({
      tenantId: reviewer.tenantId, environment: reviewer.environment, kind: 'ADVISING', policyId: policyVersionId,
    });
    const inputIds = input.inputIds.map((id) => opaque(id, 'judgment input id'));
    for (const inputId of inputIds) {
      const source = this.#canonical.get(scopedEntityKey(reviewer.tenantId, reviewer.environment, inputId));
      if (!source || source.tenantId !== reviewer.tenantId || source.environment !== reviewer.environment
        || source.subjectId !== subjectId || source.assignmentId !== assignmentId || source.state !== 'ACTIVE') {
        throw new MmcHttpError(404, 'JUDGMENT_INPUT_NOT_FOUND',
          'A judgment input was not found in the exact active subject assignment.');
      }
    }
    const record = deepFreeze({
      id: opaque(input.id, 'judgment id'), tenantId: reviewer.tenantId, environment: reviewer.environment,
      subjectId, assignmentId, kind,
      text: boundedText(input.text, 1, 8000, 'judgment text'),
      origin: 'HUMAN_JUDGMENT', rationale: boundedText(input.rationale, 3, 2000, 'judgment rationale'),
      uncertainty: boundedText(input.uncertainty, 1, 1000, 'judgment uncertainty'),
      inputIds,
      evidenceSpanIds: [], evidenceBadge: false, reviewerId: reviewer.id, policyVersionId,
      reviewState: 'APPROVED', operationalEligible: true, publicationEligible: false,
      state: 'ACTIVE', version: 1, createdAt: this.#clock().toISOString(),
    });
    const recordKey = scopedEntityKey(record.tenantId, record.environment, record.id);
    if (this.#canonical.has(recordKey)) conflict('CANONICAL_EXISTS', 'The immutable judgment already exists.');
    const lineage = inputIds.map((sourceId) => deepFreeze({
      relation: 'CANONICAL_TO_JUDGMENT', sourceId, targetId: record.id,
      tenantId: record.tenantId, environment: record.environment,
      subjectId: record.subjectId, assignmentId: record.assignmentId,
    }));
    this.#canonical.set(recordKey, record);
    this.#lineage.push(...lineage);
    return structuredClone(record);
  }

  async revokeSpan(spanId, reason, context = {}) {
    const reviewer = requirePrincipal(context.principal);
    assertCapability(reviewer, MMC_CAPABILITIES.REVIEW);
    const observedSpan = this.#scopedSpan(spanId, reviewer);
    if (observedSpan.state !== 'ACTIVE') {
      conflict('EVIDENCE_SPAN_ALREADY_REVOKED', 'The evidence span has already been revoked.');
    }
    const revocationReason = boundedText(reason, 3, 1000, 'revocation reason');
    if (await this.#authorizeAssignment({
      action: 'EVIDENCE_REVOKE',
      principal: reviewer,
      assignmentId: observedSpan.assignmentId,
      subjectId: observedSpan.subjectId,
      tenantId: reviewer.tenantId,
      environment: reviewer.environment,
    }) !== true) {
      throw new MmcHttpError(403, 'REVIEW_ASSIGNMENT_DENIED', 'The exact subject assignment is not active for evidence revocation.');
    }
    return this.#withSpanLock(reviewer, observedSpan.id, async () => {
      const span = this.#scopedSpan(observedSpan.id, reviewer);
      if (span.state !== 'ACTIVE') {
        conflict('EVIDENCE_SPAN_ALREADY_REVOKED', 'The evidence span has already been revoked.');
      }
      if (await this.#authorizeAssignment({
        action: 'EVIDENCE_REVOKE',
        principal: reviewer,
        assignmentId: span.assignmentId,
        subjectId: span.subjectId,
        tenantId: reviewer.tenantId,
        environment: reviewer.environment,
      }) !== true) {
        throw new MmcHttpError(403, 'REVIEW_ASSIGNMENT_DENIED',
          'The exact subject assignment is not active for evidence revocation.');
      }
    const revoked = deepFreeze({ ...span, state: 'REVOKED', revokedBy: reviewer.id,
      revocationReason, revokedAt: this.#clock().toISOString() });
    this.#spans.set(scopedEntityKey(span.tenantId, span.environment, span.id), revoked);
    const affectedProposalIds = new Set();
    const affectedCanonicalIds = new Set();
    for (const [key, proposal] of this.#proposals) {
      if (proposal.tenantId === span.tenantId && proposal.environment === span.environment
        && proposal.subjectId === span.subjectId && proposal.assignmentId === span.assignmentId
        && proposal.evidenceSpanIds.includes(span.id)) {
        this.#proposals.set(key, deepFreeze({ ...proposal, reviewState: 'REVOKED', operationalEligible: false }));
        affectedProposalIds.add(proposal.id);
      }
    }
    for (const [key, record] of this.#canonical) {
      if (record.tenantId === span.tenantId && record.environment === span.environment
        && record.subjectId === span.subjectId && record.assignmentId === span.assignmentId
        && record.evidenceSpanIds?.includes(span.id)) {
        this.#canonical.set(key, deepFreeze({ ...record, state: 'REASSESSMENT_REQUIRED', operationalEligible: false }));
        affectedCanonicalIds.add(record.id);
      }
    }

    // Traverse every durable lineage edge so revocation cannot stop at a
    // directly supported AI canonical while leaving downstream human judgment
    // operational. Scope checks and a visited set keep traversal fail-closed
    // and cycle-safe even if future lineage relations form a graph.
    const queue = [span.id, ...affectedProposalIds, ...affectedCanonicalIds];
    const visited = new Set();
    while (queue.length) {
      const sourceId = queue.shift();
      if (visited.has(sourceId)) continue;
      visited.add(sourceId);
      for (const edge of this.#lineage) {
        if (edge.tenantId !== span.tenantId || edge.environment !== span.environment
          || edge.subjectId !== span.subjectId || edge.assignmentId !== span.assignmentId
          || edge.sourceId !== sourceId || visited.has(edge.targetId)) continue;
        const proposal = this.#proposals.get(scopedEntityKey(span.tenantId, span.environment, edge.targetId));
        if (proposal && proposal.tenantId === span.tenantId && proposal.environment === span.environment
          && proposal.subjectId === span.subjectId && proposal.assignmentId === span.assignmentId) {
          this.#proposals.set(scopedEntityKey(proposal.tenantId, proposal.environment, proposal.id),
            deepFreeze({ ...proposal, reviewState: 'REVOKED', operationalEligible: false }));
          affectedProposalIds.add(proposal.id);
          queue.push(proposal.id);
        }
        const canonical = this.#canonical.get(scopedEntityKey(span.tenantId, span.environment, edge.targetId));
        if (canonical && canonical.tenantId === span.tenantId && canonical.environment === span.environment
          && canonical.subjectId === span.subjectId && canonical.assignmentId === span.assignmentId) {
          this.#canonical.set(scopedEntityKey(canonical.tenantId, canonical.environment, canonical.id),
            deepFreeze({ ...canonical, state: 'REASSESSMENT_REQUIRED', operationalEligible: false }));
          affectedCanonicalIds.add(canonical.id);
          queue.push(canonical.id);
        }
      }
    }
    return Object.freeze({
      spanId: span.id,
      affectedProposalIds: Object.freeze([...affectedProposalIds]),
      affectedCanonicalIds: Object.freeze([...affectedCanonicalIds]),
    });
    });
  }

  snapshot() {
    return structuredClone({
      transcripts: [...this.#transcripts.values()].map(publicTranscript),
      spans: [...this.#spans.values()].map(publicSpan),
      proposals: [...this.#proposals.values()], canonical: [...this.#canonical.values()],
      reviews: this.#reviews, lineage: this.#lineage,
    });
  }

  #scopedTranscript(id, principal) {
    const transcriptId = opaque(id, 'transcript id');
    const transcript = this.#transcripts.get(scopedEntityKey(principal.tenantId, principal.environment, transcriptId));
    if (!transcript || transcript.tenantId !== principal.tenantId || transcript.environment !== principal.environment) {
      throw new MmcHttpError(404, 'TRANSCRIPT_NOT_FOUND', 'The transcript was not found.');
    }
    return transcript;
  }

  #scopedActiveSpan(id, principal) {
    const span = this.#scopedSpan(id, principal);
    if (span.state !== 'ACTIVE') {
      throw new MmcHttpError(404, 'EVIDENCE_SPAN_NOT_FOUND', 'The active evidence span was not found.');
    }
    return span;
  }

  #scopedSpan(id, principal) {
    const spanId = opaque(id, 'evidence span id');
    const span = this.#spans.get(scopedEntityKey(principal.tenantId, principal.environment, spanId));
    if (!span || span.tenantId !== principal.tenantId || span.environment !== principal.environment) {
      throw new MmcHttpError(404, 'EVIDENCE_SPAN_NOT_FOUND', 'The evidence span was not found.');
    }
    return span;
  }

  #scopedProposal(id, principal) {
    const proposalId = opaque(id, 'proposal id');
    const proposal = this.#proposals.get(scopedEntityKey(principal.tenantId, principal.environment, proposalId));
    if (!proposal || proposal.tenantId !== principal.tenantId || proposal.environment !== principal.environment) {
      throw new MmcHttpError(404, 'PROPOSAL_NOT_FOUND', 'The proposal was not found.');
    }
    return proposal;
  }
}

function scopedEntityKey(tenantId, environment, id) {
  return JSON.stringify([tenantId, environment, id]);
}

function validateSegments(segments, buffer) {
  if (!Array.isArray(segments) || segments.length < 1 || segments.length > 100_000) {
    invalid('TRANSCRIPT_SEGMENTS_INVALID', 'Transcript segments are invalid.');
  }
  let lastEnd = 0;
  return Object.freeze(segments.map((segment) => {
    assertExact(segment, ['startByte', 'endByte', 'speaker', 'startMs', 'endMs']);
    const startByte = boundedInteger(segment.startByte, lastEnd, buffer.length - 1, 'segment start');
    const endByte = boundedInteger(segment.endByte, startByte + 1, buffer.length, 'segment end');
    if (startByte < lastEnd || !Buffer.from(buffer.subarray(startByte, endByte).toString('utf8'), 'utf8').equals(buffer.subarray(startByte, endByte))) {
      invalid('TRANSCRIPT_SEGMENTS_INVALID', 'Transcript segment byte boundaries are invalid.');
    }
    lastEnd = endByte;
    return deepFreeze({
      startByte, endByte, speaker: boundedText(segment.speaker, 1, 160, 'segment speaker'),
      startMs: boundedInteger(segment.startMs, 0, Number.MAX_SAFE_INTEGER, 'segment start time'),
      endMs: boundedInteger(segment.endMs, segment.startMs, Number.MAX_SAFE_INTEGER, 'segment end time'),
    });
  }));
}

function publicTranscript(record) {
  const { transcript: _privateTranscript, ...safe } = record;
  return structuredClone(safe);
}

function publicSpan(record) {
  return structuredClone(record);
}

function requirePrincipal(principal) {
  if (typeof principal?.id !== 'string' || !principal.id.trim()
    || typeof principal?.tenantId !== 'string' || !principal.tenantId.trim()
    || typeof principal?.environment !== 'string' || !principal.environment.trim()
    || !Array.isArray(principal.capabilities)) {
    throw new MmcHttpError(401, 'MMC_PRINCIPAL_INVALID', 'A valid MMC principal is required.');
  }
  return principal;
}

function assertExact(value, fields) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype
    || Object.keys(value).some((key) => !fields.includes(key)) || fields.some((key) => !Object.hasOwn(value, key))) {
    invalid('EVIDENCE_FIELDS_INVALID', 'The evidence fields are invalid.');
  }
}

function opaque(value, label) {
  if (typeof value !== 'string') invalid('EVIDENCE_IDENTIFIER_INVALID', `${label} is invalid.`);
  const text = value.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{2,199}$/u.test(text)) invalid('EVIDENCE_IDENTIFIER_INVALID', `${label} is invalid.`);
  return text;
}

function requireHash(value, label) {
  if (typeof value !== 'string') invalid('EVIDENCE_HASH_INVALID', `${label} is invalid.`);
  const text = value.trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/u.test(text)) invalid('EVIDENCE_HASH_INVALID', `${label} is invalid.`);
  return text;
}

function boundedText(value, min, maxBytes, label, allowNewlines = false) {
  if (typeof value !== 'string') invalid('EVIDENCE_TEXT_INVALID', `${label} is invalid.`);
  const text = value.normalize('NFC').replace(/\r\n?/gu, '\n');
  if (Buffer.byteLength(text, 'utf8') < min || Buffer.byteLength(text, 'utf8') > maxBytes
    || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(text)
    || (!allowNewlines && text.includes('\n'))) invalid('EVIDENCE_TEXT_INVALID', `${label} is invalid.`);
  return text;
}

function boundedInteger(value, minimum, maximum, label) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) invalid('EVIDENCE_INTEGER_INVALID', `${label} is invalid.`);
  return value;
}

function requireEnum(value, allowed, label) {
  if (typeof value !== 'string') invalid('EVIDENCE_ENUM_INVALID', `${label} is invalid.`);
  const text = value.trim();
  if (!allowed.has(text)) invalid('EVIDENCE_ENUM_INVALID', `${label} is invalid.`);
  return text;
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const entry of Object.values(value)) deepFreeze(entry);
  return value;
}

function invalid(code, message) {
  throw new MmcHttpError(422, code, message);
}

function conflict(code, message) {
  throw new MmcHttpError(409, code, message);
}

export const MMC_MAX_TRANSCRIPT_BYTES = MAX_TRANSCRIPT_BYTES;
