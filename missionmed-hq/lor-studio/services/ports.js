import { IntegrationDisabledError } from '../domain/errors.js';
import { deepFreeze } from '../domain/value-utils.js';

export const ENTITLEMENT_PRODUCER_STATUS = 'MUST_VERIFY';

export const PORT_CONTRACTS = deepFreeze({
  recommendationCaseRepository: {
    ownership: 'F2-LOR',
    durabilityRequiredForProduction: true,
    concurrency: 'optimistic_revision',
    retries: 'idempotency_key_and_request_hash',
    durableWriteContract: 'commitWithEvent atomically persists state and its metadata event',
    nonDurableTestContract: 'explicit NON_DURABLE_TEST_ONLY repository plus separate test event sink',
    prohibited: [
      'durable_state_before_event',
      'cross_case_reads',
      'history_rewrite',
      'implicit_upsert',
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
  async create() { return this.notImplemented('create'); }
  async getById() { return this.notImplemented('getById'); }
  async save() { return this.notImplemented('save'); }
  async commitWithEvent() { return this.notImplemented('commitWithEvent'); }
}

export class FacultyInvitationRepositoryPort extends RequiredPort {
  async create() { return this.notImplemented('create'); }
  async getById() { return this.notImplemented('getById'); }
  async save() { return this.notImplemented('save'); }
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
  async put() { return this.notImplemented('put'); }
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
