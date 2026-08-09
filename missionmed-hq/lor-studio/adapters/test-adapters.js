import {
  assertNonEmptyString,
  cloneFrozen,
  deepFreeze,
  sha256,
  toIso,
} from '../domain/value-utils.js';
import { EntitlementPort, MetadataEventSinkPort, OtpPort } from '../services/ports.js';
import { validateMetadataServiceEvent } from '../services/metadata-events.js';

export class MetadataOnlyEventBuffer extends MetadataEventSinkPort {
  constructor() {
    super();
    this.durability = 'NON_DURABLE_TEST_ONLY';
    this.isDurable = false;
    this.events = [];
  }

  async emit(event) {
    validateMetadataServiceEvent(event);
    this.events.push(cloneFrozen(event));
  }

  snapshot() {
    return deepFreeze(this.events.map((event) => structuredClone(event)));
  }
}

export class StaticOtpTestAdapter extends OtpPort {
  constructor({
    acceptedCode = '123456',
    principalId,
    clock = () => new Date('2026-01-01T00:00:00.000Z'),
  } = {}) {
    super();
    assertNonEmptyString(principalId, 'principalId');
    this.acceptedCode = acceptedCode;
    this.principalId = principalId;
    this.clock = clock;
    this.durability = 'NON_DURABLE_TEST_ONLY';
  }

  async verify(request) {
    if ('principalId' in request || 'facultyId' in request) {
      throw new TypeError('OTP callers may not assert a principal');
    }
    const { code, invitationId, recipientEmailHash } = request;
    assertNonEmptyString(invitationId, 'invitationId');
    if (!/^[a-f0-9]{64}$/u.test(recipientEmailHash ?? '')) {
      throw new TypeError('recipientEmailHash must be a SHA-256 digest');
    }
    const verified = code === this.acceptedCode;
    const verifiedAt = verified ? toIso(this.clock(), 'verifiedAt') : null;
    return deepFreeze({
      schemaVersion: 'missionmed.lor.otp-proof.v1',
      verified,
      principalId: verified ? this.principalId : null,
      invitationId,
      recipientEmailHash,
      proofId: verified
        ? sha256(`${invitationId}:${recipientEmailHash}:${this.principalId}:${verifiedAt}`)
        : null,
      verifiedAt,
      status: 'TEST_ONLY',
    });
  }
}

export class StaticEntitlementTestAdapter extends EntitlementPort {
  constructor(records = []) {
    super();
    this.durability = 'NON_DURABLE_TEST_ONLY';
    this.records = new Map(records.map((record) => [record.studentId, cloneFrozen(record)]));
  }

  async getStudentEntitlement({ studentId }) {
    return this.records.get(studentId) ?? deepFreeze({
      studentId,
      active: false,
      tier: null,
      lorEnabled: false,
      revoked: false,
      denialReason: 'TEST_RECORD_NOT_FOUND',
    });
  }
}
