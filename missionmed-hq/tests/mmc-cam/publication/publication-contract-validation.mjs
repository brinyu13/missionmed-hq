import assert from 'node:assert/strict';

import {
  MMC_STUDENT_RESPONSE_KIND,
  validateCommandEnvelope,
} from '../../../lib/mmc/contracts/command-contract.mjs';
import { MMC_CAPABILITIES, deriveMmcPrincipal } from '../../../lib/mmc/trust/security.mjs';
import {
  PUBLICATION_AUTHORITY_OPERATION,
  PUBLICATION_CONTRACT_LIMITS,
  PUBLICATION_ITEM_KIND,
  STUDENT_RESPONSE_KIND,
  assertPublicationBytesEquivalent,
  buildPublication,
  buildStudentResponse,
  computePublicationProjectionDigest,
  createPublicationAuthorityVerifier,
  serializePublicationPreview,
  serializePublicationReadback,
  validatePublication,
  validateStudentResponse,
} from '../../../lib/mmc/publication/publication-contract.mjs';

const REVIEWED_AT = '2026-07-15T10:00:00.000Z';
const APPROVED_AT = '2026-07-15T11:00:00.000Z';
const EFFECTIVE_AT = '2026-07-15T12:00:00.000Z';
const NOW = '2026-07-15T13:00:00.000Z';

function sourceFixture(sourceKind, suffix, hashCharacter) {
  return {
    sourceId: `source_006_${suffix}`,
    sourceKind,
    sourceVersion: 3,
    sourceVersionHash: hashCharacter.repeat(64),
    tenantId: 'tenant_fixture_006',
    environment: 'FIXTURE',
    subjectLinkId: 'subject_link_006_student_a',
    assignmentId: 'assignment_006_mentor_a',
    reviewState: 'APPROVED',
    reviewDecisionId: `review_decision_006_${suffix}`,
    reviewedByPrincipalId: 'mentor_principal_006_a',
    reviewerRole: 'MENTOR',
    reviewedAt: REVIEWED_AT,
    origin: 'OBSERVED',
    visibility: 'PUBLICATION_CANDIDATE',
    sensitivity: 'NORMAL',
    publicationEligible: true,
  };
}

function publicationFixture(state = 'APPROVED') {
  return {
    publicationId: 'publication_006_0001',
    schemaVersion: 1,
    version: 7,
    predecessorPublicationId: 'publication_006_0001_v6',
    predecessorVersion: 6,
    predecessorProjectionDigest: 'd'.repeat(64),
    tenantId: 'tenant_fixture_006',
    environment: 'FIXTURE',
    subjectLinkId: 'subject_link_006_student_a',
    assignmentId: 'assignment_006_mentor_a',
    studentPrincipalId: 'student_principal_006_a',
    identityState: 'VERIFIED_LOCAL_LINK',
    policyVersionId: 'policy_version_006_0001',
    state,
    approvedByPrincipalId: 'mentor_principal_006_a',
    approverRole: 'MENTOR',
    approvalDecisionId: 'publication_approval_006_0001',
    approvedAt: APPROVED_AT,
    projectionEffectiveAt: EFFECTIVE_AT,
    items: [
      {
        itemId: 'publication_item_006_task_1',
        kind: 'TASK',
        source: sourceFixture('TASK', 'task_1', 'a'),
        title: 'Revise the personal statement opening',
        description: 'Submit a revised opening that centers the patient story discussed with your mentor.',
        owner: 'STUDENT',
        dueAt: '2026-07-20T17:00:00.000-04:00',
      },
      {
        itemId: 'publication_item_006_summary_1',
        kind: 'SESSION_SUMMARY',
        source: sourceFixture('SESSION_SUMMARY', 'summary_1', 'b'),
        title: 'Session summary',
        summary: 'You agreed to narrow the outreach list and confirm the next checkpoint with your mentor.',
        sessionAt: '2026-07-14T15:00:00.000-04:00',
      },
    ],
  };
}

function expectCode(action, code, message) {
  assert.throws(action, (error) => error?.code === code, message);
}

function mentorPrincipal(publication) {
  return deriveMmcPrincipal({
    sourcePrincipal: {
      id: publication.approvedByPrincipalId, tenantId: publication.tenantId,
      environment: publication.environment, role: 'mentor',
      subjectId: publication.subjectLinkId, assignmentId: publication.assignmentId,
    },
    principalId: publication.approvedByPrincipalId,
    tenantId: publication.tenantId,
    environment: publication.environment,
    role: 'mentor',
    subjectId: publication.subjectLinkId,
    assignmentId: publication.assignmentId,
    capabilities: [MMC_CAPABILITIES.PUBLICATION_APPROVE],
  });
}

function studentPrincipal(publication, capability = 'mmc:publication:read') {
  return deriveMmcPrincipal({
    sourcePrincipal: {
      id: publication.studentPrincipalId, tenantId: publication.tenantId,
      environment: publication.environment, role: 'student',
      subjectId: publication.subjectLinkId, assignmentId: publication.assignmentId,
    },
    principalId: publication.studentPrincipalId,
    tenantId: publication.tenantId,
    environment: publication.environment,
    role: 'student',
    subjectId: publication.subjectLinkId,
    assignmentId: publication.assignmentId,
    capabilities: [capability],
  });
}

function persistedAttestation(publication, overrides = {}) {
  const readable = ['PUBLISHED', 'ACKNOWLEDGED', 'CORRECTED'].includes(publication.state);
  const previousState = {
    APPROVED: 'DRAFT',
    PUBLISHED: 'APPROVED',
    ACKNOWLEDGED: 'PUBLISHED',
    CORRECTED: 'PUBLISHED',
    WITHDRAWN: 'PUBLISHED',
    SUPERSEDED: 'PUBLISHED',
    EXPIRED: 'PUBLISHED',
  }[publication.state];
  const attestation = {
    publication: {
      publicationId: publication.publicationId,
      version: publication.version,
      predecessorPublicationId: publication.predecessorPublicationId,
      predecessorVersion: publication.predecessorVersion,
      predecessorProjectionDigest: publication.predecessorProjectionDigest,
      predecessorItemIds: publication.items.map((item) => item.itemId),
      isCurrentSubjectHead: publication.state !== 'SUPERSEDED',
      tenantId: publication.tenantId,
      environment: publication.environment,
      subjectLinkId: publication.subjectLinkId,
      assignmentId: publication.assignmentId,
      studentPrincipalId: publication.studentPrincipalId,
      policyVersionId: publication.policyVersionId,
      state: publication.state,
      previousState,
      approvalDecisionId: publication.approvalDecisionId,
      approvedByPrincipalId: publication.approvedByPrincipalId,
      approverRole: publication.approverRole,
      approvedAt: publication.approvedAt,
      projectionEffectiveAt: publication.projectionEffectiveAt,
      projectionDigest: computePublicationProjectionDigest(publication),
      stateChangedAt: readable ? EFFECTIVE_AT : APPROVED_AT,
      publishedAt: readable ? EFFECTIVE_AT : null,
      expiresAt: null,
      withdrawnAt: publication.state === 'WITHDRAWN' ? EFFECTIVE_AT : null,
    },
    identity: {
      tenantId: publication.tenantId,
      environment: publication.environment,
      subjectLinkId: publication.subjectLinkId,
      studentPrincipalId: publication.studentPrincipalId,
      state: 'VERIFIED_LOCAL_LINK',
      revokedAt: null,
    },
    assignment: {
      tenantId: publication.tenantId,
      environment: publication.environment,
      assignmentId: publication.assignmentId,
      subjectLinkId: publication.subjectLinkId,
      mentorPrincipalId: publication.approvedByPrincipalId,
      state: 'ACTIVE',
      effectiveAt: '2026-07-01T00:00:00.000Z',
      expiresAt: null,
      revokedAt: null,
    },
    policy: {
      tenantId: publication.tenantId,
      environment: publication.environment,
      policyVersionId: publication.policyVersionId,
      state: 'ACTIVE',
      effectiveAt: '2026-07-01T00:00:00.000Z',
      expiresAt: null,
    },
    approval: {
      tenantId: publication.tenantId,
      environment: publication.environment,
      approvalDecisionId: publication.approvalDecisionId,
      publicationId: publication.publicationId,
      publicationVersion: publication.version,
      subjectLinkId: publication.subjectLinkId,
      assignmentId: publication.assignmentId,
      reviewerPrincipalId: publication.approvedByPrincipalId,
      reviewerRole: 'MENTOR',
      state: 'APPROVED',
      publicationEligible: true,
      decidedAt: publication.approvedAt,
      revokedAt: null,
    },
    sources: [...new Map(publication.items.map((item) => [
      `${item.source.sourceId}:${item.source.sourceVersion}`,
      structuredClone(item.source),
    ])).values()],
  };
  for (const [section, values] of Object.entries(overrides)) {
    if (section === 'sources') attestation.sources = values;
    else Object.assign(attestation[section], values);
  }
  return attestation;
}

function verifierFor(attestation, clock = NOW) {
  return createPublicationAuthorityVerifier({
    clock: () => new Date(clock),
    loadAttestation: async () => structuredClone(attestation),
  });
}

async function grant(verifier, publication, operation, principal) {
  return verifier.authorize(publication, { operation, principal });
}

assert.equal(Object.isFrozen(PUBLICATION_ITEM_KIND), true);
assert.equal(Object.isFrozen(STUDENT_RESPONSE_KIND), true);
assert.equal(STUDENT_RESPONSE_KIND, MMC_STUDENT_RESPONSE_KIND, 'Command and publication must share one enum object.');
assert.deepEqual(Object.keys(PUBLICATION_ITEM_KIND), [
  'TASK',
  'MILESTONE',
  'PLAN_UPDATE',
  'SESSION_SUMMARY',
  'FEEDBACK',
  'CORRECTION',
  'WITHDRAWAL_NOTICE',
]);

const approved = buildPublication(publicationFixture('APPROVED'));
const published = buildPublication(publicationFixture('PUBLISHED'));
const notMetMilestoneFixture = publicationFixture('APPROVED');
notMetMilestoneFixture.items = [{
  itemId: 'publication_item_006_milestone_not_met',
  kind: 'MILESTONE',
  source: sourceFixture('MILESTONE', 'milestone_not_met', 'c'),
  title: 'Submission checkpoint',
  criteria: 'The reviewed submission evidence was not received by the checkpoint.',
  milestoneState: 'NOT_MET',
  targetAt: '2026-07-14T17:00:00.000-04:00',
}];
const notMetMilestone = buildPublication(notMetMilestoneFixture);
assert.equal(validatePublication(approved), true);
assert.equal(validatePublication(published), true);
assert.equal(notMetMilestone.items[0].milestoneState, 'NOT_MET');
assert.equal(Object.isFrozen(approved), true);
assert.equal(Object.isFrozen(approved.items[0].source), true);

const approvedVerifier = verifierFor(persistedAttestation(approved));
const publishedVerifier = verifierFor(persistedAttestation(published));
const previewAuthority = await grant(
  approvedVerifier,
  approved,
  PUBLICATION_AUTHORITY_OPERATION.PREVIEW,
  mentorPrincipal(approved),
);
const readbackAuthority = await grant(
  publishedVerifier,
  published,
  PUBLICATION_AUTHORITY_OPERATION.READBACK,
  studentPrincipal(published),
);
const previewBytes = serializePublicationPreview(approved, previewAuthority);
const readbackBytes = serializePublicationReadback(published, readbackAuthority);
assert.equal(assertPublicationBytesEquivalent(previewBytes, readbackBytes), true);
assert.equal(Buffer.from(previewBytes, 'utf8').equals(Buffer.from(readbackBytes, 'utf8')), true);

expectCode(
  () => serializePublicationPreview(approved),
  'MMC_PUBLICATION_AUTHORITY_REQUIRED',
  'A shape-valid DTO without persisted authority must not release preview bytes.',
);
expectCode(
  () => serializePublicationPreview(approved, Object.freeze({})),
  'MMC_PUBLICATION_AUTHORITY_REQUIRED',
  'A caller-forged authority object must fail closed.',
);
expectCode(
  () => serializePublicationPreview(approved, previewAuthority),
  'MMC_PUBLICATION_AUTHORITY_REPLAYED',
  'Persisted authority grants must be single-use.',
);

const studentPayload = JSON.parse(readbackBytes);
assert.equal(studentPayload.publicationVersion, published.version);
assert.equal(studentPayload.subjectLinkId, published.subjectLinkId);
assert.equal(studentPayload.studentPrincipalId, published.studentPrincipalId);
assert.equal(studentPayload.items.length, 2);
assert.equal(Object.hasOwn(studentPayload.items[0], 'source'), false, 'Internal source references must not enter student bytes.');
assert.equal(Object.hasOwn(studentPayload, 'assignmentId'), false, 'Internal assignment must not enter student bytes.');
assert.equal(Object.hasOwn(studentPayload, 'policyVersionId'), false, 'Internal policy identifiers must not enter student bytes.');

const normalizedFixture = publicationFixture('APPROVED');
normalizedFixture.items[0].description = '  Cafe\u0301\r\nخطة  ';
const normalizedPublication = buildPublication(normalizedFixture);
assert.equal(normalizedPublication.items[0].description, 'Café\nخطة');
expectCode(
  () => validatePublication(normalizedFixture),
  'MMC_PUBLICATION_TEXT_NOT_NORMALIZED',
  'Direct validation must reject non-canonical publication text.',
);

const nanosecondTimestampFixture = publicationFixture('APPROVED');
nanosecondTimestampFixture.items[0].dueAt = '2026-07-20T17:00:00.123456789-04:00';
assert.equal(
  buildPublication(nanosecondTimestampFixture).items[0].dueAt,
  nanosecondTimestampFixture.items[0].dueAt,
  'The exact bounded RFC 3339 payload may preserve sub-microsecond source precision.',
);
for (const invalidTimestamp of [
  '2026-02-29T17:00:00.000Z',
  '2026-04-31T17:00:00.000Z',
  '2026-07-20T17:00:00.000+14:01',
  '2026-07-20T17:00:00.000+15:00',
]) {
  const invalidTimestampFixture = publicationFixture('APPROVED');
  invalidTimestampFixture.items[0].dueAt = invalidTimestamp;
  expectCode(
    () => buildPublication(invalidTimestampFixture),
    'MMC_PUBLICATION_TIMESTAMP_INVALID',
    `Publication timestamps must reject invalid calendar/offset value ${invalidTimestamp}.`,
  );
}

const rtlCharacter = 'س';
const rtlBytes = new TextEncoder().encode(rtlCharacter).byteLength;
const boundedRtlBody = rtlCharacter.repeat(PUBLICATION_CONTRACT_LIMITS.BODY_MAX_BYTES / rtlBytes);
const boundedRtlFixture = publicationFixture('APPROVED');
boundedRtlFixture.items[0].description = boundedRtlBody;
assert.equal(buildPublication(boundedRtlFixture).items[0].description, boundedRtlBody);
const oversizedRtlFixture = publicationFixture('APPROVED');
oversizedRtlFixture.items[0].description = `${boundedRtlBody}${rtlCharacter}`;
expectCode(
  () => buildPublication(oversizedRtlFixture),
  'MMC_PUBLICATION_TEXT_TOO_LARGE',
  'Publication text must fail closed beyond its UTF-8 byte boundary.',
);

const crossSubject = publicationFixture();
crossSubject.items[0].source.subjectLinkId = 'subject_link_006_student_b';
expectCode(
  () => buildPublication(crossSubject),
  'MMC_PUBLICATION_BINDING_MISMATCH',
  'A cross-subject source must fail closed.',
);

const crossTenant = publicationFixture();
crossTenant.items[0].source.tenantId = 'tenant_fixture_999';
expectCode(
  () => buildPublication(crossTenant),
  'MMC_PUBLICATION_BINDING_MISMATCH',
  'A cross-tenant source must fail closed.',
);

const crossEnvironment = publicationFixture();
crossEnvironment.items[0].source.environment = 'LOCAL';
expectCode(
  () => buildPublication(crossEnvironment),
  'MMC_PUBLICATION_BINDING_MISMATCH',
  'A fixture/local source mismatch must fail closed.',
);

const mentorPrivate = publicationFixture();
mentorPrivate.items[0].source.visibility = 'MENTOR_PRIVATE';
expectCode(
  () => buildPublication(mentorPrivate),
  'MMC_PUBLICATION_SOURCE_PRIVATE',
  'Mentor-private source content must be publication-ineligible.',
);

const unreviewed = publicationFixture();
unreviewed.items[0].source.reviewState = 'REVIEW_REQUIRED';
expectCode(
  () => buildPublication(unreviewed),
  'MMC_PUBLICATION_SOURCE_UNREVIEWED',
  'Unreviewed source content must be publication-ineligible.',
);

const aiProposal = publicationFixture();
aiProposal.items[0].source.origin = 'AI_PROPOSAL';
expectCode(
  () => buildPublication(aiProposal),
  'MMC_PUBLICATION_SOURCE_ORIGIN_INELIGIBLE',
  'An AI proposal must not reach student publication directly.',
);

const unresolvedIdentity = publicationFixture();
unresolvedIdentity.identityState = 'PROBABLE';
expectCode(
  () => buildPublication(unresolvedIdentity),
  'MMC_PUBLICATION_IDENTITY_UNRESOLVED',
  'Unresolved identity must block publication.',
);

const sensitiveSource = publicationFixture();
sensitiveSource.items[0].source.sensitivity = 'SENSITIVE';
expectCode(
  () => buildPublication(sensitiveSource),
  'MMC_PUBLICATION_SOURCE_SENSITIVE',
  'Sensitive source content must require a separately designed policy path.',
);

const ineligibleSource = publicationFixture();
ineligibleSource.items[0].source.publicationEligible = false;
expectCode(
  () => buildPublication(ineligibleSource),
  'MMC_PUBLICATION_SOURCE_INELIGIBLE',
  'A source cannot self-promote past publication eligibility.',
);

const htmlPayload = publicationFixture();
htmlPayload.items[0].description = '<script>synthetic hostile fixture</script>';
expectCode(
  () => buildPublication(htmlPayload),
  'MMC_PUBLICATION_TEXT_UNSAFE',
  'HTML must be rejected rather than sanitized into publication.',
);

const urlPayload = publicationFixture();
urlPayload.items[0].description = 'Open https://example.invalid/private to continue.';
expectCode(
  () => buildPublication(urlPayload),
  'MMC_PUBLICATION_TEXT_UNSAFE',
  'URLs must be rejected from bounded publication text.',
);

const credentialCorpus = [
  'Bearer abcdefghijklmnop',
  'sk-proj-abcdefghijklmnop',
  'ghp_abcdefghijklmnop1234',
  'xoxb-1234567890-abcdef',
  'AKIAABCDEFGHIJKLMNOP',
  'eyJabcdefghi.eyJabcdefghi.abcdefghijkl',
  '-----BEGIN PRIVATE KEY-----',
  'api_key=abcdefghijklmnop',
];
for (const credential of credentialCorpus) {
  const credentialPayload = publicationFixture();
  credentialPayload.items[0].description = `Credential material ${credential}`;
  expectCode(
    () => buildPublication(credentialPayload),
    'MMC_PUBLICATION_CREDENTIAL_FORBIDDEN',
    `Credential-shaped publication text must be rejected: ${credential.slice(0, 12)}`,
  );
}
const credentialIdentifier = publicationFixture();
credentialIdentifier.publicationId = 'sk-proj-abcdefghijklmnop';
expectCode(
  () => buildPublication(credentialIdentifier),
  'MMC_PUBLICATION_CREDENTIAL_FORBIDDEN',
  'Credential material must be rejected even when hidden in a serialized identifier.',
);

const arbitraryPointer = publicationFixture();
arbitraryPointer.items[0].sourcePointer = '/Users/example/private/source.json';
expectCode(
  () => buildPublication(arbitraryPointer),
  'MMC_PUBLICATION_UNKNOWN_FIELD',
  'Arbitrary pointer fields must fail exact-schema validation.',
);

const unknownKind = publicationFixture();
unknownKind.items[0].kind = 'GENERIC_CARD';
expectCode(
  () => buildPublication(unknownKind),
  'MMC_PUBLICATION_ITEM_KIND_UNKNOWN',
  'Publication items must use the exact discriminated kind allowlist.',
);

const wrongSourceKind = publicationFixture();
wrongSourceKind.items[0].source.sourceKind = 'SESSION_SUMMARY';
expectCode(
  () => buildPublication(wrongSourceKind),
  'MMC_PUBLICATION_SOURCE_KIND_INELIGIBLE',
  'Each item discriminator must bind to an eligible source kind.',
);

const duplicateSourceFixture = publicationFixture();
duplicateSourceFixture.items.push({
  ...structuredClone(duplicateSourceFixture.items[0]),
  itemId: 'publication_item_006_duplicate_source',
  source: {
    ...structuredClone(duplicateSourceFixture.items[0].source),
    sourceVersionHash: 'e'.repeat(64),
    reviewDecisionId: 'review_decision_006_duplicate_source_conflict',
  },
});
expectCode(
  () => buildPublication(duplicateSourceFixture),
  'MMC_PUBLICATION_DUPLICATE_SOURCE',
  'One persisted source identity cannot attest two conflicting publication items.',
);

const privateSourcePointer = publicationFixture();
privateSourcePointer.items[0].source.absolutePath = '/Users/example/private/source.json';
expectCode(
  () => buildPublication(privateSourcePointer),
  'MMC_PUBLICATION_UNKNOWN_FIELD',
  'Source paths must fail exact-schema validation.',
);

const unavailableVerifier = createPublicationAuthorityVerifier({
  clock: () => new Date(NOW),
  loadAttestation: async () => null,
});
await assert.rejects(
  grant(
    unavailableVerifier,
    approved,
    PUBLICATION_AUTHORITY_OPERATION.PREVIEW,
    mentorPrincipal(approved),
  ),
  (error) => error?.code === 'MMC_PUBLICATION_AUTHORITY_UNAVAILABLE',
  'A missing persisted publication row must fail closed.',
);

const arbitraryApproverFixture = publicationFixture('APPROVED');
arbitraryApproverFixture.approvedByPrincipalId = 'mentor_principal_006_evil';
const arbitraryApprover = buildPublication(arbitraryApproverFixture);
await assert.rejects(
  grant(
    approvedVerifier,
    arbitraryApprover,
    PUBLICATION_AUTHORITY_OPERATION.PREVIEW,
    mentorPrincipal(arbitraryApprover),
  ),
  (error) => error?.code === 'MMC_PUBLICATION_PERSISTED_BINDING_MISMATCH',
  'Caller-authored approval claims must not replace the persisted approver.',
);

const arbitraryReviewerFixture = publicationFixture('APPROVED');
arbitraryReviewerFixture.items[0].source.reviewedByPrincipalId = 'mentor_principal_006_evil';
const arbitraryReviewer = buildPublication(arbitraryReviewerFixture);
await assert.rejects(
  grant(
    approvedVerifier,
    arbitraryReviewer,
    PUBLICATION_AUTHORITY_OPERATION.PREVIEW,
    mentorPrincipal(arbitraryReviewer),
  ),
  (error) => error?.code === 'MMC_PUBLICATION_PERSISTED_BINDING_MISMATCH',
  'Caller-authored source reviewer claims must not replace persisted review authority.',
);

await assert.rejects(
  grant(
    approvedVerifier,
    approved,
    PUBLICATION_AUTHORITY_OPERATION.PREVIEW,
    { ...mentorPrincipal(approved), id: 'mentor_principal_006_evil' },
  ),
  (error) => error?.code === 'MMC_PUBLICATION_AUTHORITY_PRINCIPAL_MISMATCH',
  'A different mentor principal must not consume another mentor assignment approval.',
);

const digestMismatchAttestation = persistedAttestation(published, {
  publication: { projectionDigest: 'f'.repeat(64) },
});
await assert.rejects(
  grant(
    verifierFor(digestMismatchAttestation),
    published,
    PUBLICATION_AUTHORITY_OPERATION.READBACK,
    studentPrincipal(published),
  ),
  (error) => error?.code === 'MMC_PUBLICATION_PROJECTION_DIGEST_MISMATCH',
  'Persisted projection digest mismatch must deny readback.',
);

const futurePublishedFixture = publicationFixture('PUBLISHED');
futurePublishedFixture.projectionEffectiveAt = '2099-01-01T00:00:00.000Z';
const futurePublished = buildPublication(futurePublishedFixture);
await assert.rejects(
  grant(
    verifierFor(persistedAttestation(futurePublished)),
    futurePublished,
    PUBLICATION_AUTHORITY_OPERATION.READBACK,
    studentPrincipal(futurePublished),
  ),
  (error) => error?.code === 'MMC_PUBLICATION_FUTURE_STATE_DENIED',
  'A persisted but not-yet-effective projection must not be read early.',
);

const expiredAttestation = persistedAttestation(published, {
  publication: { expiresAt: NOW },
});
await assert.rejects(
  grant(
    verifierFor(expiredAttestation),
    published,
    PUBLICATION_AUTHORITY_OPERATION.READBACK,
    studentPrincipal(published),
  ),
  (error) => error?.code === 'MMC_PUBLICATION_EXPIRED',
  'The server clock must deny an expired persisted publication.',
);

// Assignment expiry or revocation after approval blocks the former mentor from
// creating a new preview, but it must not silently revoke the exact student's
// already-published projection or response agency.
for (const assignmentEnd of [
  { state: 'EXPIRED', expiresAt: '2026-07-15T12:30:00.000Z', revokedAt: null },
  { state: 'REVOKED', expiresAt: null, revokedAt: '2026-07-15T12:30:00.000Z' },
  { state: 'REASSIGNED', expiresAt: null, revokedAt: '2026-07-15T12:30:00.000Z' },
]) {
  const endedAssignmentAttestation = persistedAttestation(published, { assignment: assignmentEnd });
  const endedAssignmentVerifier = verifierFor(endedAssignmentAttestation);
  const endedReadAuthority = await grant(
    endedAssignmentVerifier,
    published,
    PUBLICATION_AUTHORITY_OPERATION.READBACK,
    studentPrincipal(published),
  );
  assert.equal(serializePublicationReadback(published, endedReadAuthority), readbackBytes,
    'The exact student keeps the immutable projection after the mentor assignment ends.');
  const endedRespondAuthority = await grant(
    endedAssignmentVerifier,
    published,
    PUBLICATION_AUTHORITY_OPERATION.STUDENT_RESPOND,
    studentPrincipal(published, 'mmc:student:respond'),
  );
  const endedAssignmentResponse = buildStudentResponse({
    responseId: `student_response_006_assignment_${assignmentEnd.state.toLowerCase()}`,
    schemaVersion: 1,
    version: 1,
    tenantId: published.tenantId,
    environment: published.environment,
    subjectLinkId: published.subjectLinkId,
    studentPrincipalId: published.studentPrincipalId,
    authorPrincipalId: published.studentPrincipalId,
    authorship: 'STUDENT',
    publicationId: published.publicationId,
    publicationVersion: published.version,
    publicationItemId: published.items[0].itemId,
    kind: 'ACKNOWLEDGEMENT',
    createdAt: NOW,
    supersedesResponseId: null,
  }, published, endedRespondAuthority);
  assert.equal(endedAssignmentResponse.kind, 'ACKNOWLEDGEMENT');
}

const retiredPolicyAttestation = persistedAttestation(published, {
  policy: { state: 'RETIRED', expiresAt: '2026-07-15T12:30:00.000Z' },
});
const retiredPolicyAuthority = await grant(
  verifierFor(retiredPolicyAttestation),
  published,
  PUBLICATION_AUTHORITY_OPERATION.READBACK,
  studentPrincipal(published),
);
assert.equal(serializePublicationReadback(published, retiredPolicyAuthority), readbackBytes,
  'Retiring a policy after approval must not erase an immutable published student projection.');
const approvedUnderRetiredPolicy = persistedAttestation(approved, {
  policy: { state: 'RETIRED', expiresAt: '2026-07-15T12:30:00.000Z' },
});
await assert.rejects(
  grant(
    verifierFor(approvedUnderRetiredPolicy),
    approved,
    PUBLICATION_AUTHORITY_OPERATION.PREVIEW,
    mentorPrincipal(approved),
  ),
  (error) => error?.code === 'MMC_PUBLICATION_AUTHORITY_INACTIVE',
  'A retired policy cannot authorize a new preview even when an older publication remains readable.',
);

const formerMentorAttestation = persistedAttestation(approved, {
  assignment: { state: 'REVOKED', revokedAt: '2026-07-15T12:30:00.000Z' },
});
await assert.rejects(
  grant(
    verifierFor(formerMentorAttestation),
    approved,
    PUBLICATION_AUTHORITY_OPERATION.PREVIEW,
    mentorPrincipal(approved),
  ),
  (error) => error?.code === 'MMC_PUBLICATION_AUTHORITY_INACTIVE',
  'A former mentor assignment must not authorize a new publication preview.',
);

const neverActiveAtApproval = persistedAttestation(published, {
  assignment: { state: 'EXPIRED', expiresAt: '2026-07-15T10:30:00.000Z' },
});
await assert.rejects(
  grant(
    verifierFor(neverActiveAtApproval),
    published,
    PUBLICATION_AUTHORITY_OPERATION.READBACK,
    studentPrincipal(published),
  ),
  (error) => error?.code === 'MMC_PUBLICATION_AUTHORITY_INACTIVE',
  'Historical student entitlement requires proof that the assignment was active at approval.',
);

const forgedVersionFixture = publicationFixture('PUBLISHED');
forgedVersionFixture.version = 999;
expectCode(
  () => buildPublication(forgedVersionFixture),
  'MMC_PUBLICATION_PREDECESSOR_INVALID',
  'A caller cannot jump the publication lineage version without its exact predecessor.',
);
await assert.rejects(
  grant(
    verifierFor(persistedAttestation(published, { publication: { isCurrentSubjectHead: false } })),
    published,
    PUBLICATION_AUTHORITY_OPERATION.READBACK,
    studentPrincipal(published),
  ),
  (error) => error?.code === 'MMC_PUBLICATION_NOT_CURRENT_HEAD',
  'A superseded/non-head publication record cannot be released as current student truth.',
);

const correctionFixture = publicationFixture('CORRECTED');
correctionFixture.items = [{
  itemId: 'publication_item_006_correction',
  kind: 'CORRECTION',
  source: sourceFixture('CORRECTION', 'correction', 'f'),
  title: 'Correction',
  correctedText: 'The reviewed corrected statement.',
  changeSummary: 'Corrected an inaccurate prior statement.',
  replacesPublicationItemId: 'publication_item_006_unrelated_prior',
}];
const correction = buildPublication(correctionFixture);
await assert.rejects(
  grant(
    verifierFor(persistedAttestation(correction)),
    correction,
    PUBLICATION_AUTHORITY_OPERATION.READBACK,
    studentPrincipal(correction),
  ),
  (error) => error?.code === 'MMC_PUBLICATION_CORRECTION_LINEAGE_INVALID',
  'A correction must replace an item attested in the exact predecessor publication.',
);
const versionOneCorrection = structuredClone(correctionFixture);
versionOneCorrection.version = 1;
versionOneCorrection.predecessorPublicationId = null;
versionOneCorrection.predecessorVersion = null;
versionOneCorrection.predecessorProjectionDigest = null;
expectCode(
  () => buildPublication(versionOneCorrection),
  'MMC_PUBLICATION_PREDECESSOR_INVALID',
  'A corrected publication cannot exist without a predecessor.',
);
const selfPredecessor = publicationFixture('PUBLISHED');
selfPredecessor.predecessorPublicationId = selfPredecessor.publicationId;
expectCode(
  () => buildPublication(selfPredecessor),
  'MMC_PUBLICATION_PREDECESSOR_INVALID',
  'A publication cannot be its own predecessor.',
);

const originalProjectionAuthority = await grant(
  publishedVerifier,
  published,
  PUBLICATION_AUTHORITY_OPERATION.READBACK,
  studentPrincipal(published),
);
const driftedProjectionFixture = publicationFixture('PUBLISHED');
driftedProjectionFixture.items[0].description = 'Unpersisted readback drift.';
const driftedProjection = buildPublication(driftedProjectionFixture);
expectCode(
  () => serializePublicationReadback(driftedProjection, originalProjectionAuthority),
  'MMC_PUBLICATION_AUTHORITY_BINDING_MISMATCH',
  'An authority grant must bind the exact immutable projection digest.',
);

const withdrawn = buildPublication(publicationFixture('WITHDRAWN'));
await assert.rejects(
  grant(
    verifierFor(persistedAttestation(withdrawn)),
    withdrawn,
    PUBLICATION_AUTHORITY_OPERATION.READBACK,
    studentPrincipal(withdrawn),
  ),
  (error) => error?.code === 'MMC_PUBLICATION_READ_DENIED',
  'Persisted withdrawn state must deny active-content readback authority.',
);

const changedPublishedFixture = publicationFixture('PUBLISHED');
changedPublishedFixture.items[0].description = 'A materially different student payload.';
const changedPublished = buildPublication(changedPublishedFixture);
const changedReadbackAuthority = await grant(
  verifierFor(persistedAttestation(changedPublished)),
  changedPublished,
  PUBLICATION_AUTHORITY_OPERATION.READBACK,
  studentPrincipal(changedPublished),
);
const changedReadback = serializePublicationReadback(changedPublished, changedReadbackAuthority);
expectCode(
  () => assertPublicationBytesEquivalent(previewBytes, changedReadback),
  'MMC_PUBLICATION_BYTE_MISMATCH',
  'Preview/readback drift must fail byte-equivalence proof.',
);

const responseKinds = Object.keys(STUDENT_RESPONSE_KIND);
for (const [index, kind] of responseKinds.entries()) {
  const requiresMessage = !['ACKNOWLEDGEMENT', 'AGREEMENT'].includes(kind);
  const validatedResponseCommand = validateCommandEnvelope({
    commandId: `00600000-0000-4000-8000-${String(index + 100).padStart(12, '0')}`,
    idempotencyKey: `idem_student_response_006_${index}`,
    expectedVersion: 0,
    targetId: published.publicationId,
    kind: 'student.respond',
    purpose: 'Record a typed student response.',
    payload: {
      publicationId: published.publicationId,
      itemId: published.items[0].itemId,
      response: kind,
      ...(requiresMessage ? { comment: 'A bounded student-authored explanation.' } : {}),
    },
    schemaVersion: 1,
  });
  assert.equal(validatedResponseCommand.payload.response, kind);

  const responseAuthority = await grant(
    publishedVerifier,
    published,
    PUBLICATION_AUTHORITY_OPERATION.STUDENT_RESPOND,
    studentPrincipal(published, 'mmc:student:respond'),
  );
  const response = buildStudentResponse({
    responseId: `student_response_006_enum_${index}`,
    schemaVersion: 1,
    version: 1,
    tenantId: published.tenantId,
    environment: published.environment,
    subjectLinkId: published.subjectLinkId,
    studentPrincipalId: published.studentPrincipalId,
    authorPrincipalId: published.studentPrincipalId,
    authorship: 'STUDENT',
    publicationId: published.publicationId,
    publicationVersion: published.version,
    publicationItemId: published.items[0].itemId,
    kind,
    createdAt: NOW,
    supersedesResponseId: null,
    ...(requiresMessage ? { message: 'A bounded student-authored explanation.' } : {}),
  }, published, responseAuthority);
  assert.equal(response.kind, kind);
}

for (const legacyKind of ['ACKNOWLEDGED', 'ACCEPTED', 'QUESTION', 'COMPLETE', 'BLOCKED']) {
  expectCode(
    () => validateCommandEnvelope({
      commandId: '00600000-0000-4000-8000-000000000199',
      idempotencyKey: 'idem_student_response_006_legacy',
      expectedVersion: 0,
      targetId: published.publicationId,
      kind: 'student.respond',
      purpose: 'Reject a legacy student response spelling.',
      payload: {
        publicationId: published.publicationId,
        itemId: published.items[0].itemId,
        response: legacyKind,
        comment: 'Legacy value.',
      },
      schemaVersion: 1,
    }),
    'COMMAND_ENUM_INVALID',
    `Legacy response spelling must be rejected: ${legacyKind}`,
  );
}

expectCode(
  () => validateCommandEnvelope({
    commandId: '00600000-0000-4000-8000-000000000200',
    idempotencyKey: 'idem_student_response_006_ack_comment',
    expectedVersion: 0,
    targetId: published.publicationId,
    kind: 'student.respond',
    purpose: 'Reject an acknowledgment comment.',
    payload: {
      publicationId: published.publicationId,
      itemId: published.items[0].itemId,
      response: 'ACKNOWLEDGEMENT',
      comment: 'Unexpected comment.',
    },
    schemaVersion: 1,
  }),
  'STUDENT_RESPONSE_COMMENT_FORBIDDEN',
  'Acknowledgement commands must match the no-message publication response shape.',
);
expectCode(
  () => validateCommandEnvelope({
    commandId: '00600000-0000-4000-8000-000000000201',
    idempotencyKey: 'idem_student_response_006_dispute_missing',
    expectedVersion: 0,
    targetId: published.publicationId,
    kind: 'student.respond',
    purpose: 'Reject a dispute without explanation.',
    payload: {
      publicationId: published.publicationId,
      itemId: published.items[0].itemId,
      response: 'DISPUTE',
    },
    schemaVersion: 1,
  }),
  'STUDENT_RESPONSE_COMMENT_REQUIRED',
  'Message-bearing response commands must require the same content as publication responses.',
);

const publicationBeforeResponse = JSON.stringify(published);
const selfReportedCompleteAuthority = await grant(
  publishedVerifier,
  published,
  PUBLICATION_AUTHORITY_OPERATION.STUDENT_RESPOND,
  studentPrincipal(published, 'mmc:student:respond'),
);
const selfReportedComplete = buildStudentResponse({
  responseId: 'student_response_006_0001',
  schemaVersion: 1,
  version: 1,
  tenantId: published.tenantId,
  environment: published.environment,
  subjectLinkId: published.subjectLinkId,
  studentPrincipalId: published.studentPrincipalId,
  authorPrincipalId: published.studentPrincipalId,
  authorship: 'STUDENT',
  publicationId: published.publicationId,
  publicationVersion: published.version,
  publicationItemId: published.items[0].itemId,
  kind: 'SELF_REPORTED_COMPLETE',
  createdAt: '2026-07-15T13:00:00.000Z',
  supersedesResponseId: null,
  message: 'I completed the revision and am submitting it for mentor review.',
}, published, selfReportedCompleteAuthority);

const responseValidationAuthority = await grant(
  publishedVerifier,
  published,
  PUBLICATION_AUTHORITY_OPERATION.STUDENT_RESPOND,
  studentPrincipal(published, 'mmc:student:respond'),
);
assert.equal(validateStudentResponse(selfReportedComplete, published, responseValidationAuthority), true);
assert.equal(selfReportedComplete.kind, 'SELF_REPORTED_COMPLETE');
assert.equal(selfReportedComplete.createdAt, NOW, 'Student response creation time is server-derived.');
assert.equal(selfReportedComplete.authorship, 'STUDENT');
assert.equal(Object.isFrozen(selfReportedComplete), true);
assert.equal(Object.hasOwn(selfReportedComplete, 'mentorVerified'), false);
assert.equal(Object.hasOwn(selfReportedComplete, 'sourceMutation'), false);
assert.equal(Object.hasOwn(selfReportedComplete, 'publicationMutation'), false);
assert.equal(JSON.stringify(published), publicationBeforeResponse, 'A student response must not mutate publication or source state.');

const fabricatedResponseLineageAuthority = await grant(
  publishedVerifier,
  published,
  PUBLICATION_AUTHORITY_OPERATION.STUDENT_RESPOND,
  studentPrincipal(published, 'mmc:student:respond'),
);
expectCode(
  () => buildStudentResponse({
    ...structuredClone(selfReportedComplete),
    responseId: 'student_response_006_fabricated_lineage',
    version: 999,
    createdAt: '2099-01-01T00:00:00.000Z',
    supersedesResponseId: 'student_response_006_unrelated',
  }, published, fabricatedResponseLineageAuthority),
  'MMC_STUDENT_RESPONSE_DURABLE_STREAM_REQUIRED',
  'The local response contract cannot fabricate durable version or supersession chronology.',
);

const callerFutureTimeAuthority = await grant(
  publishedVerifier,
  published,
  PUBLICATION_AUTHORITY_OPERATION.STUDENT_RESPOND,
  studentPrincipal(published, 'mmc:student:respond'),
);
const callerFutureTimeResponse = buildStudentResponse({
  ...structuredClone(selfReportedComplete),
  responseId: 'student_response_006_server_time',
  createdAt: '2099-01-01T00:00:00.000Z',
}, published, callerFutureTimeAuthority);
assert.equal(callerFutureTimeResponse.createdAt, NOW,
  'Caller-authored response time must be replaced by the verifier server clock.');

let advancingClockMs = Date.parse(NOW);
const advancingVerifier = createPublicationAuthorityVerifier({
  clock: () => new Date(advancingClockMs += 1),
  loadAttestation: async () => structuredClone(persistedAttestation(published)),
});
const advancingAuthority = await grant(
  advancingVerifier,
  published,
  PUBLICATION_AUTHORITY_OPERATION.STUDENT_RESPOND,
  studentPrincipal(published, 'mmc:student:respond'),
);
const advancingResponse = buildStudentResponse({
  ...structuredClone(selfReportedComplete),
  responseId: 'student_response_006_advancing_clock',
}, published, advancingAuthority);
assert.equal(Date.parse(advancingResponse.createdAt), Date.parse(NOW) + 1,
  'An advancing server clock must create a usable deterministic response timestamp.');
advancingClockMs += 1_000;
const advancingValidationAuthority = await grant(
  advancingVerifier,
  published,
  PUBLICATION_AUTHORITY_OPERATION.STUDENT_RESPOND,
  studentPrincipal(published, 'mmc:student:respond'),
);
assert.equal(validateStudentResponse(
  advancingResponse, published, advancingValidationAuthority,
), true, 'A legitimate persisted response must remain valid under a later server clock.');

const responseWithMentorPromotion = {
  ...structuredClone(selfReportedComplete),
  responseId: 'student_response_006_0002',
  mentorVerified: true,
};
const promotionAuthority = await grant(
  publishedVerifier,
  published,
  PUBLICATION_AUTHORITY_OPERATION.STUDENT_RESPOND,
  studentPrincipal(published, 'mmc:student:respond'),
);
expectCode(
  () => buildStudentResponse(responseWithMentorPromotion, published, promotionAuthority),
  'MMC_PUBLICATION_UNKNOWN_FIELD',
  'Student attestation cannot carry a mentor-verification mutation.',
);

const falseMentorVerification = {
  ...structuredClone(selfReportedComplete),
  responseId: 'student_response_006_0003',
  kind: 'MENTOR_VERIFIED_COMPLETE',
};
const falseVerificationAuthority = await grant(
  publishedVerifier,
  published,
  PUBLICATION_AUTHORITY_OPERATION.STUDENT_RESPOND,
  studentPrincipal(published, 'mmc:student:respond'),
);
expectCode(
  () => buildStudentResponse(falseMentorVerification, published, falseVerificationAuthority),
  'MMC_STUDENT_RESPONSE_KIND_UNKNOWN',
  'Student response kinds cannot become mentor verification.',
);

const crossSubjectResponse = {
  ...structuredClone(selfReportedComplete),
  responseId: 'student_response_006_0004',
  subjectLinkId: 'subject_link_006_student_b',
};
const crossSubjectResponseAuthority = await grant(
  publishedVerifier,
  published,
  PUBLICATION_AUTHORITY_OPERATION.STUDENT_RESPOND,
  studentPrincipal(published, 'mmc:student:respond'),
);
expectCode(
  () => buildStudentResponse(crossSubjectResponse, published, crossSubjectResponseAuthority),
  'MMC_PUBLICATION_BINDING_MISMATCH',
  'A student response must remain bound to the exact publication subject.',
);

await assert.rejects(
  grant(
    verifierFor(persistedAttestation(withdrawn)),
    withdrawn,
    PUBLICATION_AUTHORITY_OPERATION.STUDENT_RESPOND,
    studentPrincipal(withdrawn, 'mmc:student:respond'),
  ),
  (error) => error?.code === 'MMC_PUBLICATION_READ_DENIED',
  'A withdrawn publication must reject new active-content responses.',
);

console.log(JSON.stringify({
  result: 'MMC v2 publication contract validation passed',
  itemKinds: Object.keys(PUBLICATION_ITEM_KIND),
  previewReadbackByteEquivalent: true,
  sourceBinding: 'tenant+environment+subject+assignment+version',
  hostileContentRejected: true,
  privateAndUnreviewedRejected: true,
  withdrawnReadDenied: true,
  persistedAuthorityGate: true,
  serverClockStateGate: true,
  assignmentEndPreservesStudentProjection: true,
  formerMentorPreviewDenied: true,
  projectionDigestBound: true,
  predecessorAndCurrentHeadBound: true,
  correctionAncestryBound: true,
  duplicateSourceAttestationRejected: true,
  notMetMilestoneTruthPreserved: true,
  strictRfc3339CalendarAndOffset: true,
  credentialDlp: true,
  canonicalStudentResponseKinds: responseKinds,
  studentResponseSeparated: true,
  studentResponseChronologyFailClosed: true,
  mentorVerificationNotInStudentContract: true,
}, null, 2));
