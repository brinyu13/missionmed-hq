import assert from 'node:assert/strict';
import crypto from 'node:crypto';

import { EvidenceKernel } from '../../../lib/mmc/evidence/evidence-kernel.mjs';
import { MMC_POLICY_KINDS, PolicyRegistry } from '../../../lib/mmc/policy/policy-registry.mjs';
import { MMC_CAPABILITIES, deriveMmcPrincipal } from '../../../lib/mmc/trust/security.mjs';

const admin = Object.freeze({
  id: 'admin_006_policy', tenantId: 'tenant_006_alpha', environment: 'LOCAL', role: 'admin',
  capabilities: Object.freeze([MMC_CAPABILITIES.POLICY_MANAGE]),
});
const otherTenantAdmin = Object.freeze({ ...admin, id: 'admin_006_policy_beta', tenantId: 'tenant_006_beta' });
const worker = deriveMmcPrincipal({
  sourcePrincipal: {
    id: 'worker_006_evidence', tenantId: 'tenant_006_alpha', environment: 'LOCAL', role: 'worker',
    workloadId: 'workload_006_evidence', queueName: 'mmc.analysis',
  },
  principalId: 'worker_006_evidence', tenantId: 'tenant_006_alpha', environment: 'LOCAL', role: 'worker',
  workloadId: 'workload_006_evidence', queueName: 'mmc.analysis',
  capabilities: [MMC_CAPABILITIES.WORKER_COMPLETE, MMC_CAPABILITIES.WORKER_ANALYSIS],
});
const otherTenantWorker = deriveMmcPrincipal({
  sourcePrincipal: {
    id: 'worker_006_evidence_beta', tenantId: 'tenant_006_beta', environment: 'LOCAL', role: 'worker',
    workloadId: 'workload_006_evidence_beta', queueName: 'mmc.analysis',
  },
  principalId: 'worker_006_evidence_beta', tenantId: 'tenant_006_beta', environment: 'LOCAL', role: 'worker',
  workloadId: 'workload_006_evidence_beta', queueName: 'mmc.analysis',
  capabilities: [MMC_CAPABILITIES.WORKER_COMPLETE, MMC_CAPABILITIES.WORKER_ANALYSIS],
});
const reviewer = Object.freeze({
  id: 'mentor_006_reviewer', tenantId: 'tenant_006_alpha', environment: 'LOCAL', role: 'mentor',
  capabilities: Object.freeze([MMC_CAPABILITIES.REVIEW]),
});
const otherTenantReviewer = Object.freeze({ ...reviewer, id: 'mentor_006_other', tenantId: 'tenant_006_beta' });

let concurrentReviewBarrier = null;
let releaseConcurrentReviews = null;
let concurrentReviewArrivals = 0;
let reviewRecheckControl = null;
let proposalGrantControl = null;
let judgmentAssignmentControl = null;
let proposalGrantAuthorityActive = true;

assert.deepEqual(MMC_POLICY_KINDS, [
  'ADVISING',
  'EVIDENCE',
  'IDENTITY',
  'ACQUISITION',
  'TRANSCRIPT_PROCESSING',
  'AI_TRANSFER',
  'PUBLICATION',
  'RETENTION',
]);

const policies = new PolicyRegistry();
assert.throws(
  () => policies.register({
    id: 12345678,
    kind: 'EVIDENCE',
    version: 1,
    rules: { exactEvidence: true },
    purpose: 'Reject numeric policy identifiers.',
  }, { principal: admin }),
  (error) => error?.code === 'POLICY_IDENTIFIER_INVALID',
  'Typed policy identifiers must never coerce numeric JSON values to strings.',
);
for (const policy of [
  { id: 'policy_006_evidence_v1', kind: 'EVIDENCE', purpose: 'Require exact evidence for factual promotion.' },
  { id: 'policy_006_advising_v1', kind: 'ADVISING', purpose: 'Record accountable human advising judgments.' },
]) {
  policies.register({ ...policy, version: 1, rules: { exactEvidence: true, publicationSeparate: true } }, { principal: admin });
  policies.activate(policy.id, { principal: admin });
}
const sameIdOtherTenant = policies.register({
  id: 'policy_006_evidence_v1',
  kind: 'EVIDENCE',
  version: 1,
  rules: { exactEvidence: true, publicationSeparate: true },
  purpose: 'Tenant-beta policy with a deliberately identical opaque ID.',
}, { principal: otherTenantAdmin });
assert.equal(sameIdOtherTenant.tenantId, 'tenant_006_beta');
policies.activate('policy_006_evidence_v1', { principal: otherTenantAdmin });
policies.register({
  id: 'policy_006_advising_v2', kind: 'ADVISING', version: 2,
  rules: { exactEvidence: true, publicationSeparate: true },
  purpose: 'Synthetic replacement policy used for a policy-switch race.',
}, { principal: admin });
assert.equal(policies.get('policy_006_advising_v1', { principal: otherTenantAdmin }), null,
  'Policy lookup must be tenant/environment scoped.');

const kernel = new EvidenceKernel({
  policyRegistry: policies,
  authorizeGrant: async ({ action, authorityGrantIds, tenantId, environment }) => {
    const authorized = environment === 'LOCAL' && (
      (authorityGrantIds.includes('grant_006_transcript') && tenantId === 'tenant_006_alpha')
      || (authorityGrantIds.includes('grant_006_transcript_beta') && tenantId === 'tenant_006_beta')
    );
    if (authorized && action === 'AI_PROPOSAL_CREATE' && proposalGrantControl) {
      await proposalGrantControl();
    }
    return authorized && proposalGrantAuthorityActive;
  },
  authorizeAssignment: async ({ action, principal, assignmentId, subjectId }) => {
    const authorized = (principal.id === reviewer.id
      && assignmentId === 'assignment_006_alpha_0001'
      && subjectId === 'subject_006_student_0001')
      || (principal.id === otherTenantReviewer.id
        && assignmentId === 'assignment_006_beta_0001'
        && subjectId === 'subject_006_student_beta_0001');
    if (authorized && action === 'PROPOSAL_REVIEW' && reviewRecheckControl) {
      return reviewRecheckControl();
    }
    if (authorized && action === 'HUMAN_JUDGMENT_CREATE' && judgmentAssignmentControl) {
      await judgmentAssignmentControl();
    }
    if (authorized && action === 'PROPOSAL_REVIEW' && concurrentReviewBarrier) {
      concurrentReviewArrivals += 1;
      const barrier = concurrentReviewBarrier;
      if (concurrentReviewArrivals === 2) {
        concurrentReviewBarrier = null;
        releaseConcurrentReviews();
      }
      await barrier;
    }
    return authorized;
  },
});

const transcript = 'Dr Brian: Submit the draft by Friday.\nStudent: I will send it tomorrow.';
const newline = Buffer.byteLength('Dr Brian: Submit the draft by Friday.', 'utf8');
const transcriptInput = {
  id: 'transcript_006_0001',
  assetHandle: 'asset_006_transcript_0001',
  contentHash: crypto.createHash('sha256').update(transcript).digest('hex'),
  transcript,
  segments: [
    { startByte: 0, endByte: newline, speaker: 'Dr Brian', startMs: 0, endMs: 10_000 },
    { startByte: newline + 1, endByte: Buffer.byteLength(transcript), speaker: 'Student', startMs: 10_001, endMs: 20_000 },
  ],
  authorityGrantIds: ['grant_006_transcript'],
  subjectId: 'subject_006_student_0001',
  assignmentId: 'assignment_006_alpha_0001',
};
const source = await kernel.registerTranscript(transcriptInput, { principal: worker });
assert.equal(Object.hasOwn(source, 'transcript'), false, 'Transcript content must not leak from the public source record.');

const transcriptRaceInputs = Array.from({ length: 100 }, (_, index) => {
  const content = index % 2 === 0
    ? 'Student: immutable transcript race variant A.'
    : 'Student: immutable transcript race variant B.';
  return {
    ...transcriptInput,
    id: 'transcript_006_registration_race',
    assetHandle: `asset_006_transcript_race_${index % 2}`,
    contentHash: crypto.createHash('sha256').update(content).digest('hex'),
    transcript: content,
    segments: [{
      startByte: 0, endByte: Buffer.byteLength(content), speaker: 'Student', startMs: 0, endMs: 1_000,
    }],
  };
});
const transcriptRace = await Promise.allSettled(transcriptRaceInputs.map((input) => (
  kernel.registerTranscript(input, { principal: worker })
)));
assert.equal(transcriptRace.filter((entry) => entry.status === 'fulfilled').length, 1,
  'Exactly one immutable transcript insert may win a concurrent same-ID race.');
assert.equal(transcriptRace.filter((entry) => entry.status === 'rejected'
  && entry.reason?.code === 'TRANSCRIPT_EXISTS').length, 99);
const transcriptRaceWinner = transcriptRace.find((entry) => entry.status === 'fulfilled').value;
const storedTranscriptRace = kernel.snapshot().transcripts
  .filter((entry) => entry.id === 'transcript_006_registration_race');
assert.equal(storedTranscriptRace.length, 1);
assert.equal(storedTranscriptRace[0].contentHash, transcriptRaceWinner.contentHash,
  'The winning immutable transcript must never be overwritten by a later authorization completion.');

const asyncDenyKernel = new EvidenceKernel({
  policyRegistry: policies,
  authorizeGrant: async () => false,
});
await assert.rejects(
  asyncDenyKernel.registerTranscript({ ...transcriptInput, id: 'transcript_006_async_deny' }, { principal: worker }),
  (error) => error?.code === 'TRANSCRIPT_AUTHORITY_DENIED',
  'A Promise returned by an authority adapter must be awaited and denied unless it resolves exactly true.',
);
assert.equal(asyncDenyKernel.snapshot().transcripts.length, 0);

const quote = 'Submit the draft by Friday.';
const startByte = Buffer.byteLength('Dr Brian: ', 'utf8');
const endByte = startByte + Buffer.byteLength(quote, 'utf8');
const span = await kernel.createTranscriptSpan({
  transcriptId: source.id, startByte, endByte, quote, speaker: 'Dr Brian', startMs: 1_000, endMs: 9_000,
}, { principal: worker });
assert.equal(span.quote, quote);

await assert.rejects(kernel.createTranscriptSpan({
  transcriptId: source.id, startByte, endByte, quote: 'Submit something else.',
  speaker: 'Dr Brian', startMs: 1_000, endMs: 9_000,
}, { principal: worker }), (error) => error?.code === 'EVIDENCE_SPAN_MISMATCH');
await assert.rejects(kernel.createTranscriptSpan({
  transcriptId: source.id, startByte, endByte, quote,
  speaker: 'Student', startMs: 1_000, endMs: 9_000,
}, { principal: worker }), (error) => error?.code === 'EVIDENCE_SPEAKER_MISMATCH');

await assert.rejects(kernel.createAiProposal({
  id: 'proposal_006_subject_attack', subjectId: 'subject_006_arbitrary_victim', proposalType: 'FACT',
  assertion: quote, evidenceSpanIds: [span.id], confidenceMethod: 'bounded_exact_span_v1', confidenceValue: 0.92,
  analysisRunId: 'analysis_006_subject_attack', modelId: 'model_fixture_006', promptVersionId: 'prompt_006_v1',
  policyVersionId: 'policy_006_evidence_v1',
}, { principal: worker }), (error) => error?.code === 'PROPOSAL_SUBJECT_EVIDENCE_MISMATCH');

await assert.rejects(kernel.createAiProposal({
  id: 'proposal_006_unsupported_fact', subjectId: 'subject_006_student_0001', proposalType: 'FACT',
  assertion: 'The student has already submitted the draft.', evidenceSpanIds: [span.id],
  confidenceMethod: 'bounded_exact_span_v1', confidenceValue: 0.99,
  analysisRunId: 'analysis_006_unsupported_fact', modelId: 'model_fixture_006', promptVersionId: 'prompt_006_v1',
  policyVersionId: 'policy_006_evidence_v1',
}, { principal: worker }), (error) => error?.code === 'PROPOSAL_FACT_UNSUPPORTED');

await assert.rejects(kernel.createAiProposal({
  id: 'proposal_006_ai_risk_forbidden', subjectId: 'subject_006_student_0001', proposalType: 'RISK_SIGNAL',
  assertion: 'The student is high risk.', evidenceSpanIds: [span.id],
  confidenceMethod: 'bounded_exact_span_v1', confidenceValue: 0.99,
  analysisRunId: 'analysis_006_ai_risk_forbidden', modelId: 'model_fixture_006', promptVersionId: 'prompt_006_v1',
  policyVersionId: 'policy_006_evidence_v1',
}, { principal: worker }), (error) => error?.code === 'EVIDENCE_ENUM_INVALID',
'AI output cannot author canonical risk truth; risk is a deterministic projection over reviewed facts.');

await assert.rejects(kernel.createAiProposal({
  id: 'proposal_006_string_confidence', subjectId: 'subject_006_student_0001', proposalType: 'FACT',
  assertion: quote, evidenceSpanIds: [span.id], confidenceMethod: 'bounded_exact_span_v1', confidenceValue: '0.92',
  analysisRunId: 'analysis_006_string_confidence', modelId: 'model_fixture_006', promptVersionId: 'prompt_006_v1',
  policyVersionId: 'policy_006_evidence_v1',
}, { principal: worker }), (error) => error?.code === 'PROPOSAL_CONFIDENCE_INVALID',
'Typed confidence values must never coerce JSON strings to numbers.');

const proposal = await kernel.createAiProposal({
  id: 'proposal_006_fact_0001', subjectId: 'subject_006_student_0001', proposalType: 'FACT',
  assertion: quote, evidenceSpanIds: [span.id], confidenceMethod: 'bounded_exact_span_v1', confidenceValue: 0.92,
  analysisRunId: 'analysis_006_0001', modelId: 'model_fixture_006', promptVersionId: 'prompt_006_v1',
  policyVersionId: 'policy_006_evidence_v1',
}, { principal: worker });
assert.equal(proposal.origin, 'AI_PROPOSAL');
assert.equal(proposal.reviewState, 'REVIEW_REQUIRED');
assert.equal(proposal.operationalEligible, false);
assert.equal(proposal.publicationEligible, false);

const proposalRace = await Promise.allSettled(Array.from({ length: 100 }, (_, index) => (
  kernel.createAiProposal({
    id: 'proposal_006_create_race',
    subjectId: 'subject_006_student_0001',
    proposalType: index % 2 === 0 ? 'FACT' : 'RECOMMENDATION',
    assertion: index % 2 === 0 ? quote : 'Schedule a bounded follow-up after the draft arrives.',
    evidenceSpanIds: [span.id],
    confidenceMethod: 'bounded_exact_span_v1',
    confidenceValue: 0.88,
    analysisRunId: `analysis_006_create_race_${index}`,
    modelId: 'model_fixture_006',
    promptVersionId: 'prompt_006_v1',
    policyVersionId: 'policy_006_evidence_v1',
  }, { principal: worker })
)));
assert.equal(proposalRace.filter((entry) => entry.status === 'fulfilled').length, 1,
  'Exactly one immutable proposal insert may win a concurrent same-ID race.');
assert.equal(proposalRace.filter((entry) => entry.status === 'rejected'
  && entry.reason?.code === 'PROPOSAL_EXISTS').length, 99);
const postProposalCreateRace = kernel.snapshot();
assert.equal(postProposalCreateRace.proposals.filter((entry) => entry.id === 'proposal_006_create_race').length, 1);
assert.equal(postProposalCreateRace.lineage.filter((edge) => edge.relation === 'SPAN_TO_PROPOSAL'
  && edge.targetId === 'proposal_006_create_race').length, 1,
  'The proposal insert and its lineage edge must commit exactly once.');

await assert.rejects(kernel.createAiProposal({
  id: 'proposal_006_fact_0002',
  subjectId: 'subject_006_student_0001',
  proposalType: 'FACT',
  assertion: quote,
  evidenceSpanIds: [],
  confidenceMethod: 'bounded_exact_span_v1',
  confidenceValue: 0.92,
  analysisRunId: 'analysis_006_0002',
  modelId: 'model_fixture_006',
  promptVersionId: 'prompt_006_v1',
  policyVersionId: 'policy_006_evidence_v1',
}, { principal: worker }), (error) => error?.code === 'PROPOSAL_EVIDENCE_REQUIRED');

await assert.rejects(kernel.reviewProposal({
  proposalId: proposal.id, decision: 'ACCEPT', editedText: 'The student definitely submitted the draft.',
  rationale: 'Synthetic unsupported edit.', policyVersionId: 'policy_006_evidence_v1',
}, { principal: reviewer }), (error) => error?.code === 'UNSUPPORTED_FACTUAL_EDIT');

const accepted = await kernel.reviewProposal({
  proposalId: proposal.id, decision: 'ACCEPT', editedText: quote,
  rationale: 'The factual text exactly matches the attested span.', policyVersionId: 'policy_006_evidence_v1',
}, { principal: reviewer });
assert.equal(accepted.reviewState, 'APPROVED');
assert.equal(accepted.operationalEligible, true);
assert.equal(accepted.publicationEligible, false, 'Human review must not silently publish a canonical object.');
assert.deepEqual(accepted.evidenceSpanIds, [span.id]);

const racingProposal = await kernel.createAiProposal({
  id: 'proposal_006_fact_review_race', subjectId: 'subject_006_student_0001', proposalType: 'FACT',
  assertion: quote, evidenceSpanIds: [span.id], confidenceMethod: 'bounded_exact_span_v1', confidenceValue: 0.93,
  analysisRunId: 'analysis_006_review_race', modelId: 'model_fixture_006', promptVersionId: 'prompt_006_v1',
  policyVersionId: 'policy_006_evidence_v1',
}, { principal: worker });
concurrentReviewArrivals = 0;
concurrentReviewBarrier = new Promise((resolve) => { releaseConcurrentReviews = resolve; });
const [concurrentAccept, concurrentReject] = await Promise.allSettled([
  kernel.reviewProposal({
    proposalId: racingProposal.id, decision: 'ACCEPT', editedText: quote,
    rationale: 'Concurrent accept must win exactly once.', policyVersionId: 'policy_006_evidence_v1',
  }, { principal: reviewer }),
  kernel.reviewProposal({
    proposalId: racingProposal.id, decision: 'REJECT', editedText: '',
    rationale: 'Concurrent reject must conflict deterministically.', policyVersionId: 'policy_006_evidence_v1',
  }, { principal: reviewer }),
]);
concurrentReviewBarrier = null;
releaseConcurrentReviews = null;
assert.equal(concurrentReviewArrivals, 2, 'Both concurrent reviews must complete the async authority recheck.');
assert.equal(concurrentAccept.status, 'fulfilled', 'The first authorized terminal review must win.');
assert.equal(concurrentReject.status, 'rejected', 'The conflicting terminal review must lose.');
assert.equal(concurrentReject.reason?.code, 'PROPOSAL_ALREADY_DECIDED',
  'The losing terminal review must receive the deterministic already-decided conflict.');
const postRaceSnapshot = kernel.snapshot();
assert.equal(postRaceSnapshot.reviews.filter((entry) => entry.proposalId === racingProposal.id).length, 1,
  'Concurrent terminal review attempts must append exactly one immutable review record.');
assert.equal(postRaceSnapshot.canonical.filter((entry) => entry.sourceProposalId === racingProposal.id).length, 1,
  'Concurrent terminal review attempts must promote exactly one canonical record.');
const racingCanonical = concurrentAccept.value;

// A review waiting behind another attempt must not reuse an authorization
// decision made before it acquired the serialization lock. The first attempt
// fails validation without changing the proposal; authority is then revoked
// before the waiting attempt performs its in-lock recheck.
const revocationRaceProposal = await kernel.createAiProposal({
  id: 'proposal_006_review_revocation_race', subjectId: 'subject_006_student_0001', proposalType: 'FACT',
  assertion: quote, evidenceSpanIds: [span.id], confidenceMethod: 'bounded_exact_span_v1', confidenceValue: 0.91,
  analysisRunId: 'analysis_006_review_revocation_race', modelId: 'model_fixture_006', promptVersionId: 'prompt_006_v1',
  policyVersionId: 'policy_006_evidence_v1',
}, { principal: worker });
let reviewAuthorizationCalls = 0;
let reviewAuthorityActive = true;
let announceFirstInner;
let releaseFirstInner;
let announceSecondInner;
let releaseSecondInner;
const firstInnerStarted = new Promise((resolve) => { announceFirstInner = resolve; });
const firstInnerGate = new Promise((resolve) => { releaseFirstInner = resolve; });
const secondInnerStarted = new Promise((resolve) => { announceSecondInner = resolve; });
const secondInnerGate = new Promise((resolve) => { releaseSecondInner = resolve; });
reviewRecheckControl = async () => {
  reviewAuthorizationCalls += 1;
  if (reviewAuthorizationCalls === 2) {
    announceFirstInner();
    await firstInnerGate;
  }
  if (reviewAuthorizationCalls === 4) {
    announceSecondInner();
    await secondInnerGate;
  }
  return reviewAuthorityActive;
};
const invalidFirstReview = kernel.reviewProposal({
  proposalId: revocationRaceProposal.id, decision: 'ACCEPT', editedText: quote,
  rationale: 'Synthetic first attempt fails its policy binding.', policyVersionId: 'policy_006_wrong',
}, { principal: reviewer });
await firstInnerStarted;
const waitingSecondReview = kernel.reviewProposal({
  proposalId: revocationRaceProposal.id, decision: 'ACCEPT', editedText: quote,
  rationale: 'This queued attempt must recheck assignment authority.', policyVersionId: 'policy_006_evidence_v1',
}, { principal: reviewer });
releaseFirstInner();
await assert.rejects(invalidFirstReview, (error) => error?.code === 'REVIEW_POLICY_MISMATCH');
await secondInnerStarted;
reviewAuthorityActive = false;
releaseSecondInner();
await assert.rejects(waitingSecondReview, (error) => error?.code === 'REVIEW_ASSIGNMENT_DENIED');
reviewRecheckControl = null;
const postRevocationRace = kernel.snapshot();
assert.equal(postRevocationRace.reviews.filter((entry) => entry.proposalId === revocationRaceProposal.id).length, 0);
assert.equal(postRevocationRace.canonical.filter((entry) => entry.sourceProposalId === revocationRaceProposal.id).length, 0);
assert.equal(postRevocationRace.proposals.find((entry) => entry.id === revocationRaceProposal.id).reviewState,
  'REVIEW_REQUIRED');

let announceJudgmentAuthorization;
let releaseJudgmentAuthorization;
const judgmentAuthorizationStarted = new Promise((resolve) => { announceJudgmentAuthorization = resolve; });
const judgmentAuthorizationRelease = new Promise((resolve) => { releaseJudgmentAuthorization = resolve; });
judgmentAssignmentControl = async () => {
  announceJudgmentAuthorization();
  await judgmentAuthorizationRelease;
};
const stalePolicyJudgment = kernel.createHumanJudgment({
  id: 'judgment_006_stale_policy', subjectId: 'subject_006_student_0001', kind: 'PROFESSIONAL_JUDGMENT',
  assignmentId: 'assignment_006_alpha_0001',
  text: 'This stale-policy judgment must not commit.',
  rationale: 'The policy changes while assignment authorization is pending.',
  uncertainty: 'Synthetic concurrency proof.',
  inputIds: [accepted.id], policyVersionId: 'policy_006_advising_v1',
}, { principal: reviewer });
await judgmentAuthorizationStarted;
policies.activate('policy_006_advising_v2', { principal: admin });
releaseJudgmentAuthorization();
await assert.rejects(stalePolicyJudgment, (error) => error?.code === 'POLICY_VERSION_NOT_ACTIVE');
judgmentAssignmentControl = null;
assert.equal(kernel.snapshot().canonical.some((entry) => entry.id === 'judgment_006_stale_policy'), false);
policies.activate('policy_006_advising_v1', { principal: admin });

const judgment = await kernel.createHumanJudgment({
  id: 'judgment_006_0001', subjectId: 'subject_006_student_0001', kind: 'PROFESSIONAL_JUDGMENT',
  assignmentId: 'assignment_006_alpha_0001',
  text: 'A shorter milestone may reduce avoidable delay.',
  rationale: 'This is explicit mentor judgment, not a factual assertion.',
  uncertainty: 'The student may have constraints not yet discussed.',
  inputIds: [accepted.id], policyVersionId: 'policy_006_advising_v1',
}, { principal: reviewer });
assert.equal(judgment.origin, 'HUMAN_JUDGMENT');
assert.equal(judgment.evidenceBadge, false);
assert.deepEqual(judgment.evidenceSpanIds, []);

await assert.rejects(kernel.reviewProposal({
  proposalId: proposal.id, decision: 'REJECT', editedText: '', rationale: 'Other tenant request.',
  policyVersionId: 'policy_006_evidence_v1',
}, { principal: otherTenantReviewer }), (error) => error?.statusCode === 404);

// Identical opaque IDs are legal in another tenant. Revoking alpha evidence
// must never mutate beta proposals or canonicals that happen to share those IDs.
const betaSource = await kernel.registerTranscript({
  ...transcriptInput,
  assetHandle: 'asset_006_transcript_beta_0001',
  authorityGrantIds: ['grant_006_transcript_beta'],
  subjectId: 'subject_006_student_beta_0001',
  assignmentId: 'assignment_006_beta_0001',
}, { principal: otherTenantWorker });
const betaSpan = await kernel.createTranscriptSpan({
  transcriptId: betaSource.id, startByte, endByte, quote,
  speaker: 'Dr Brian', startMs: 1_000, endMs: 9_000,
}, { principal: otherTenantWorker });
assert.equal(betaSpan.id, span.id, 'The regression intentionally uses an identical opaque span ID across tenants.');
const betaProposal = await kernel.createAiProposal({
  id: proposal.id,
  subjectId: 'subject_006_student_beta_0001',
  proposalType: 'FACT', assertion: quote, evidenceSpanIds: [betaSpan.id],
  confidenceMethod: 'bounded_exact_span_v1', confidenceValue: 0.9,
  analysisRunId: 'analysis_006_beta_0001', modelId: 'model_fixture_006', promptVersionId: 'prompt_006_v1',
  policyVersionId: 'policy_006_evidence_v1',
}, { principal: otherTenantWorker });
const betaCanonical = await kernel.reviewProposal({
  proposalId: betaProposal.id, decision: 'ACCEPT', editedText: quote,
  rationale: 'Beta review remains isolated from alpha revocation.', policyVersionId: 'policy_006_evidence_v1',
}, { principal: otherTenantReviewer });

// Grant authority is rechecked inside the final proposal-create critical
// section, after all asynchronous lock waits and immediately before write.
let proposalCommitAuthorizationCalls = 0;
let announceProposalCommitAuthorization;
let releaseProposalCommitAuthorization;
const proposalCommitAuthorizationStarted = new Promise((resolve) => { announceProposalCommitAuthorization = resolve; });
const proposalCommitAuthorizationRelease = new Promise((resolve) => { releaseProposalCommitAuthorization = resolve; });
proposalGrantControl = async () => {
  proposalCommitAuthorizationCalls += 1;
  if (proposalCommitAuthorizationCalls === 2) {
    announceProposalCommitAuthorization();
    await proposalCommitAuthorizationRelease;
  }
};
const revokedAtCommitProposal = kernel.createAiProposal({
  id: 'proposal_006_authority_revoked_at_commit',
  subjectId: 'subject_006_student_0001', proposalType: 'FACT', assertion: quote,
  evidenceSpanIds: [span.id], confidenceMethod: 'bounded_exact_span_v1', confidenceValue: 0.9,
  analysisRunId: 'analysis_006_authority_revoked_at_commit', modelId: 'model_fixture_006',
  promptVersionId: 'prompt_006_v1', policyVersionId: 'policy_006_evidence_v1',
}, { principal: worker });
await proposalCommitAuthorizationStarted;
proposalGrantAuthorityActive = false;
releaseProposalCommitAuthorization();
await assert.rejects(revokedAtCommitProposal, (error) => error?.code === 'PROPOSAL_AUTHORITY_DENIED');
proposalGrantAuthorityActive = true;
proposalGrantControl = null;
assert.equal(kernel.snapshot().proposals.some((entry) => entry.id === 'proposal_006_authority_revoked_at_commit'), false);
assert.equal(kernel.snapshot().lineage.some((edge) => edge.targetId === 'proposal_006_authority_revoked_at_commit'), false);

// A span revoked while AI grant authorization is in flight cannot enter a
// stale proposal or lineage edge after that async check returns.
const staleQuote = 'I will send it tomorrow.';
const staleStartByte = Buffer.byteLength('Dr Brian: Submit the draft by Friday.\nStudent: ', 'utf8');
const staleSpan = await kernel.createTranscriptSpan({
  transcriptId: source.id,
  startByte: staleStartByte,
  endByte: staleStartByte + Buffer.byteLength(staleQuote, 'utf8'),
  quote: staleQuote,
  speaker: 'Student',
  startMs: 11_000,
  endMs: 19_000,
}, { principal: worker });
let announceProposalGrant;
let releaseProposalGrant;
const proposalGrantStarted = new Promise((resolve) => { announceProposalGrant = resolve; });
const proposalGrantRelease = new Promise((resolve) => { releaseProposalGrant = resolve; });
proposalGrantControl = async () => {
  announceProposalGrant();
  await proposalGrantRelease;
};
const staleProposalAttempt = kernel.createAiProposal({
  id: 'proposal_006_revoked_during_authorization',
  subjectId: 'subject_006_student_0001',
  proposalType: 'FACT',
  assertion: staleQuote,
  evidenceSpanIds: [staleSpan.id],
  confidenceMethod: 'bounded_exact_span_v1',
  confidenceValue: 0.9,
  analysisRunId: 'analysis_006_revoked_during_authorization',
  modelId: 'model_fixture_006',
  promptVersionId: 'prompt_006_v1',
  policyVersionId: 'policy_006_evidence_v1',
}, { principal: worker });
await proposalGrantStarted;
await kernel.revokeSpan(staleSpan.id, 'Source was withdrawn while proposal authority waited.', { principal: reviewer });
releaseProposalGrant();
await assert.rejects(staleProposalAttempt, (error) => error?.code === 'EVIDENCE_SPAN_NOT_FOUND');
proposalGrantControl = null;
assert.equal(kernel.snapshot().proposals.some((entry) => entry.id === 'proposal_006_revoked_during_authorization'), false);
assert.equal(kernel.snapshot().lineage.some((edge) => edge.targetId === 'proposal_006_revoked_during_authorization'), false);

// One hundred concurrent terminal revocations serialize on the scoped span.
// Exactly one immutable terminal fact wins; every later attempt conflicts.
const revokeRaceQuote = 'Friday.';
const revokeRaceStart = Buffer.byteLength('Dr Brian: Submit the draft by ', 'utf8');
const revokeRaceSpan = await kernel.createTranscriptSpan({
  transcriptId: source.id,
  startByte: revokeRaceStart,
  endByte: revokeRaceStart + Buffer.byteLength(revokeRaceQuote, 'utf8'),
  quote: revokeRaceQuote,
  speaker: 'Dr Brian',
  startMs: 8_000,
  endMs: 9_000,
}, { principal: worker });
const revocationRace = await Promise.allSettled(Array.from({ length: 100 }, (_, index) => (
  kernel.revokeSpan(revokeRaceSpan.id, `Concurrent revocation reason ${index}.`, { principal: reviewer })
)));
assert.equal(revocationRace.filter((entry) => entry.status === 'fulfilled').length, 1);
assert.equal(revocationRace.filter((entry) => entry.status === 'rejected'
  && entry.reason?.code === 'EVIDENCE_SPAN_ALREADY_REVOKED').length, 99);
assert.equal(kernel.snapshot().spans.find((entry) => entry.id === revokeRaceSpan.id).state, 'REVOKED');

const revocation = await kernel.revokeSpan(span.id, 'Synthetic source correction invalidated this span.', { principal: reviewer });
assert.deepEqual(new Set(revocation.affectedProposalIds),
  new Set([proposal.id, 'proposal_006_create_race', racingProposal.id, revocationRaceProposal.id]));
assert.deepEqual(new Set(revocation.affectedCanonicalIds), new Set([accepted.id, racingCanonical.id, judgment.id]));
const snapshot = kernel.snapshot();
assert.equal(snapshot.proposals.find((entry) => entry.id === proposal.id).operationalEligible, false);
assert.equal(snapshot.canonical.find((entry) => entry.id === accepted.id).state, 'REASSESSMENT_REQUIRED');
assert.equal(snapshot.canonical.find((entry) => entry.id === accepted.id).operationalEligible, false);
assert.equal(snapshot.canonical.find((entry) => entry.id === racingCanonical.id).state, 'REASSESSMENT_REQUIRED');
assert.equal(snapshot.canonical.find((entry) => entry.id === judgment.id).state, 'REASSESSMENT_REQUIRED');
assert.equal(snapshot.canonical.find((entry) => entry.id === judgment.id).operationalEligible, false,
  'A human judgment must inherit reassessment when its canonical input loses evidence support.');
const betaProposalAfterAlphaRevocation = snapshot.proposals.find((entry) => (
  entry.id === betaProposal.id && entry.tenantId === otherTenantReviewer.tenantId
));
const betaCanonicalAfterAlphaRevocation = snapshot.canonical.find((entry) => (
  entry.id === betaCanonical.id && entry.tenantId === otherTenantReviewer.tenantId
));
assert.equal(betaProposalAfterAlphaRevocation.reviewState, 'APPROVED');
assert.equal(betaProposalAfterAlphaRevocation.operationalEligible, false,
  'AI proposal rows remain non-operational; the tenant-isolation signal is their unchanged APPROVED state.');
assert.equal(betaCanonicalAfterAlphaRevocation.state, 'ACTIVE');
assert.equal(betaCanonicalAfterAlphaRevocation.operationalEligible, true);
assert.ok(snapshot.lineage.some((edge) => edge.relation === 'CANONICAL_TO_JUDGMENT'
  && edge.sourceId === accepted.id && edge.targetId === judgment.id));
assert.equal(snapshot.reviews.length, 3, 'Review decisions must be retained in an immutable tenant-scoped decision ledger.');

console.log(JSON.stringify({
  result: 'MMC v2 evidence and policy validation passed',
  exactUtf8Span: true,
  asyncAuthorityDenyEnforced: true,
  immutableTranscriptCreateSerialized: true,
  immutableProposalCreateSerialized: true,
  speakerAttributionVerified: true,
  aiProposalOperationalBeforeReview: false,
  subjectEvidenceBindingEnforced: true,
  unsupportedFactDenied: true,
  concurrentTerminalReviewSerialized: true,
  concurrentTerminalRevocationSerialized: true,
  proposalEvidenceRecheckedAfterAsyncAuthority: true,
  proposalAuthorityRecheckedAtCommit: true,
  judgmentPolicyRecheckedAfterAsyncAuthority: true,
  queuedReviewAuthorityRecheckedInsideLock: true,
  reviewedCanonicalPublicationEligible: false,
  humanJudgmentSeparate: true,
  crossTenantDenied: true,
  crossTenantRevocationIsolation: true,
  policyRegistryScopeIsolated: true,
  revocationTraversedLineage: true,
  downstreamJudgmentReassessment: true,
}, null, 2));
