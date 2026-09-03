import { IntegrationDisabledError } from '../domain/errors.js';
import { deepFreeze } from '../domain/value-utils.js';

export const ENTITLEMENT_PRODUCER_STATUS = 'MUST_VERIFY';

export const PORT_CONTRACTS = deepFreeze({
  recommendationCaseRepository: {
    ownership: 'F2-LOR',
    durabilityRequiredForProduction: true,
    concurrency: 'optimistic_revision',
    retries: 'idempotency_key_and_request_hash',
    identifierAllocation: 'server_only_durable_atomic_creation_reservation',
    durableWriteContract: 'actor-safe student and faculty command methods atomically persist state, protected history, and metadata event',
    durableStudentCapability: 'actorSafeCommands=true with exact student action-specific methods',
    durableStudentReadContract: 'readStudentSafeCase returns only the exact 15-key student-safe DTO',
    durableFacultyReadContract: 'readFacultyCaseProjection returns only the exact seven-field faculty DTO',
    durableFacultyReleaseContract: 'commitFacultyFinalDocumentRelease accepts no caller state or private payload',
    durableMentorReadContract: 'readMentorCaseProjection returns only the exact five-field mentor DTO',
    legacyProtectedContract: 'getById and commitWithEvent remain fail-closed compatibility seams',
    nonDurableTestContract: 'explicit NON_DURABLE_TEST_ONLY repository plus separate test event sink',
    prohibited: [
      'durable_state_before_event',
      'cross_case_reads',
      'history_rewrite',
      'implicit_upsert',
    ],
  },
  facultyInvitationRepository: {
    ownership: 'F2-LOR',
    durabilityRequiredForProduction: true,
    concurrency: 'atomic_invitation_otp_audit_transaction',
    retries: 'idempotency_key_and_request_hash',
    identifierAllocation: 'server_only',
    commandContract: 'issue resend revoke verify and delivery are fixed SECURITY DEFINER commands with database-owned receipts',
    verifiedWriteContract: 'verifyAndCommit atomically consumes the OTP challenge, updates invitation state, and appends metadata audit',
    prohibited: [
      'in_memory_production_fallback',
      'client_asserted_invitation_or_challenge',
      'client_asserted_case_role_purpose_or_principal',
      'split_otp_and_invitation_commit',
      'raw_token_code_email_or_session_secret_receipt',
    ],
  },
  mentorAssignmentRepository: {
    ownership: 'F2-LOR',
    durabilityRequiredForProduction: true,
    authority: 'trusted_server_operator_only',
    concurrency: 'database_advisory_lock_and_append_only_idempotency',
    operation: 'read_only_mentor_case_access',
    commandContract: 'assign and revoke are fixed SECURITY DEFINER commands with database-owned hashes and metadata audit',
    prohibited: [
      'browser_or_request_context_assignment',
      'client_asserted_hash_uid_timestamp_or_audit',
      'direct_application_table_dml',
      'mutable_or_write_capable_mentor_assignment',
    ],
  },
  entitlement: {
    producer: ENTITLEMENT_PRODUCER_STATUS,
    minimumData: ['studentId', 'active', 'tier', 'lorEnabled', 'revoked'],
    freshness: 'request_time_server_side',
    failure: 'deny',
    prohibited: ['client_asserted_entitlement', 'menu_visibility_as_authority'],
  },
  storyForge: {
    direction: 'read_only_projection',
    consentRequired: true,
    failure: 'explicit_unavailable_manual_entry',
    prohibited: ['database_reads', 'credential_sharing', 'writeback'],
  },
  timeline: {
    direction: 'read_only_projection',
    consentRequired: true,
    failure: 'explicit_unavailable_manual_entry',
    prohibited: ['database_reads', 'credential_sharing', 'writeback'],
  },
  ai: {
    direction: 'server_side_proposal_only',
    requiredMetadata: ['provider', 'model', 'templateVersion', 'sourceHashes', 'outputHash'],
    failure: 'disabled_or_deterministic_local_fallback',
    prohibited: ['automatic_finalization', 'provider_training', 'unrelated_analytics'],
  },
  otp: {
    direction: 'server_side_verification',
    subjectBinding: 'recipient_email_hash_and_invitation_id',
    verifiedProof: ['principalId', 'invitationId', 'recipientEmailHash', 'proofId', 'verifiedAt'],
    failure: 'deny',
    prohibited: ['client_asserted_verification', 'client_asserted_principal', 'reusable_success'],
  },
  email: {
    direction: 'server_side_transactional',
    failure: 'fail_closed',
    prohibited: ['embedded_credentials', 'protected_letter_content'],
  },
  storage: {
    direction: 'private_server_side',
    failure: 'fail_closed',
    prohibited: ['public_urls', 'unscoped_reads', 'embedded_credentials'],
  },
  metadataEvents: {
    content: 'identifiers_and_low_cardinality_metadata_only',
    atomicity: 'production_repository_must_commit_state_and_event_atomically',
    prohibited: ['letter_text', 'answers', 'notes', 'evidence_text', 'tokens', 'email_addresses'],
  },
});

class RequiredPort {
  notImplemented(method) {
    throw new IntegrationDisabledError(`${this.constructor.name}.${method}`, 'PORT_NOT_IMPLEMENTED');
  }
}

export class RecommendationCaseRepositoryPort extends RequiredPort {
  async reserveCaseCreation() { return this.notImplemented('reserveCaseCreation'); }
  async readStudentSafeCase() { return this.notImplemented('readStudentSafeCase'); }
  async commitStudentCaseCreate() { return this.notImplemented('commitStudentCaseCreate'); }
  async commitStudentBuilderAutosave() { return this.notImplemented('commitStudentBuilderAutosave'); }
  async commitStudentBuilderComplete() { return this.notImplemented('commitStudentBuilderComplete'); }
  async commitStudentConsentReceipt() { return this.notImplemented('commitStudentConsentReceipt'); }
  async commitStudentWaiverReceipt() { return this.notImplemented('commitStudentWaiverReceipt'); }
  async readFacultyCaseProjection() { return this.notImplemented('readFacultyCaseProjection'); }
  async commitFacultyFinalDocumentRelease() {
    return this.notImplemented('commitFacultyFinalDocumentRelease');
  }
  async readMentorCaseProjection() { return this.notImplemented('readMentorCaseProjection'); }
  // Full aggregate compatibility methods are never used by actor-safe durable paths.
  async create() { return this.notImplemented('create'); }
  async getById() { return this.notImplemented('getById'); }
  async save() { return this.notImplemented('save'); }
  async commitWithEvent() { return this.notImplemented('commitWithEvent'); }
}

export class FacultyInvitationRepositoryPort extends RequiredPort {
  async issueAndCommit() { return this.notImplemented('issueAndCommit'); }
  async resendOtpAndCommit() { return this.notImplemented('resendOtpAndCommit'); }
  async revokeAndCommit() { return this.notImplemented('revokeAndCommit'); }
  async commitDelivery() { return this.notImplemented('commitDelivery'); }
  async create() { return this.notImplemented('create'); }
  async getById() { return this.notImplemented('getById'); }
  async save() { return this.notImplemented('save'); }
  async verifyAndCommit() { return this.notImplemented('verifyAndCommit'); }
}

export class MentorAssignmentRepositoryPort extends RequiredPort {
  async assignAndCommit() { return this.notImplemented('assignAndCommit'); }
  async revokeAndCommit() { return this.notImplemented('revokeAndCommit'); }
}

export class EntitlementPort extends RequiredPort {
  async getStudentEntitlement() { return this.notImplemented('getStudentEntitlement'); }
}

export class StoryForgePort extends RequiredPort {
  async getEvidenceProjection() { return this.notImplemented('getEvidenceProjection'); }
}

export class TimelinePort extends RequiredPort {
  async getTimelineProjection() { return this.notImplemented('getTimelineProjection'); }
}

export class AiProposalPort extends RequiredPort {
  async generateProposal() { return this.notImplemented('generateProposal'); }
}

export class OtpPort extends RequiredPort {
  async verify() { return this.notImplemented('verify'); }
}

export class EmailPort extends RequiredPort {
  async sendFacultyInvitation() { return this.notImplemented('sendFacultyInvitation'); }
}

export class PrivateStoragePort extends RequiredPort {
  /** @returns {Promise<unknown>} */
  async put() { return this.notImplemented('put'); }
  /** @returns {Promise<unknown>} */
  async get() { return this.notImplemented('get'); }
}

export class MetadataEventSinkPort extends RequiredPort {
  async emit() { return this.notImplemented('emit'); }
}

export function assertPort(port, methodNames, portName) {
  if (!port || methodNames.some((method) => typeof port[method] !== 'function')) {
    throw new TypeError(`${portName} must implement ${methodNames.join(', ')}`);
  }
  return port;
}
