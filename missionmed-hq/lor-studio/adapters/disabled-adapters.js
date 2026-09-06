import { IntegrationDisabledError } from '../domain/errors.js';
import { deepFreeze } from '../domain/value-utils.js';
import {
  AiProposalPort,
  EmailPort,
  ENTITLEMENT_PRODUCER_STATUS,
  EntitlementPort,
  MetadataEventSinkPort,
  OtpPort,
  PrivateStoragePort,
  StoryForgePort,
  TimelinePort,
} from '../services/ports.js';

export class DisabledEntitlementAdapter extends EntitlementPort {
  constructor() {
    super();
    this.producerStatus = ENTITLEMENT_PRODUCER_STATUS;
  }

  async getStudentEntitlement({ studentId }) {
    return deepFreeze({
      studentId,
      active: false,
      tier: null,
      lorEnabled: false,
      revoked: false,
      canaryEnabled: false,
      canaryConsented: false,
      producerStatus: ENTITLEMENT_PRODUCER_STATUS,
      denialReason: 'ENTITLEMENT_PRODUCER_MUST_VERIFY',
    });
  }
}

export class DisabledStoryForgeAdapter extends StoryForgePort {
  async getEvidenceProjection() {
    return deepFreeze({ available: false, status: 'DISABLED_FAIL_CLOSED', records: [] });
  }
}

export class DisabledTimelineAdapter extends TimelinePort {
  async getTimelineProjection() {
    return deepFreeze({ available: false, status: 'DISABLED_FAIL_CLOSED', records: [] });
  }
}

export class DisabledAiProposalAdapter extends AiProposalPort {
  async generateProposal() {
    throw new IntegrationDisabledError('ai', 'DISABLED_FAIL_CLOSED');
  }
}

export class DisabledOtpAdapter extends OtpPort {
  async verify({ invitationId, recipientEmailHash }) {
    return deepFreeze({
      schemaVersion: 'missionmed.lor.otp-proof.v1',
      verified: false,
      principalId: null,
      invitationId,
      recipientEmailHash,
      proofId: null,
      verifiedAt: null,
      status: 'DISABLED_FAIL_CLOSED',
    });
  }
}

export class DisabledEmailAdapter extends EmailPort {
  async sendFacultyInvitation() {
    throw new IntegrationDisabledError('email', 'DISABLED_FAIL_CLOSED');
  }
}

export class DisabledPrivateStorageAdapter extends PrivateStoragePort {
  async put() {
    throw new IntegrationDisabledError('private_storage', 'DISABLED_FAIL_CLOSED');
  }

  async get() {
    throw new IntegrationDisabledError('private_storage', 'DISABLED_FAIL_CLOSED');
  }
}

export class DisabledMetadataEventSink extends MetadataEventSinkPort {
  async emit() {
    throw new IntegrationDisabledError('metadata_event_sink', 'DISABLED_FAIL_CLOSED');
  }
}
