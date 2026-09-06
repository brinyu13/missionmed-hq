import {
  DomainInvariantError,
  NotFoundError,
  StaleRevisionError,
  ValidationError,
} from '../domain/errors.js';
import { assertNonEmptyString, cloneFrozen } from '../domain/value-utils.js';
import { FacultyInvitationRepositoryPort } from '../services/ports.js';

export class InMemoryFacultyInvitationRepository extends FacultyInvitationRepositoryPort {
  constructor() {
    super();
    this.durability = 'NON_DURABLE_TEST_ONLY';
    this.isDurable = false;
    this.#records = new Map();
  }

  #records;

  assertProductionReady() {
    throw new DomainInvariantError('In-memory faculty invitation persistence is not production-ready');
  }

  async create(invitation) {
    if (!invitation || invitation.schemaVersion !== 'missionmed.lor.faculty-invitation.v1') {
      throw new ValidationError('Unsupported faculty invitation');
    }
    if (this.#records.has(invitation.id)) throw new DomainInvariantError('Invitation ID already exists');
    if (invitation.revision !== 0) throw new DomainInvariantError('New invitations must start at revision zero');
    this.#records.set(invitation.id, cloneFrozen(invitation));
    return cloneFrozen(invitation);
  }

  async getById(invitationId) {
    assertNonEmptyString(invitationId, 'invitationId');
    const invitation = this.#records.get(invitationId);
    if (!invitation) throw new NotFoundError('faculty_invitation', invitationId);
    return cloneFrozen(invitation);
  }

  async save(invitation, { expectedRevision }) {
    const current = this.#records.get(invitation.id);
    if (!current) throw new NotFoundError('faculty_invitation', invitation.id);
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) {
      throw new ValidationError('expectedRevision must be non-negative');
    }
    if (current.revision !== expectedRevision) {
      throw new StaleRevisionError({
        caseId: invitation.caseId,
        expectedRevision,
        actualRevision: current.revision,
      });
    }
    if (invitation.revision !== expectedRevision + 1) {
      throw new DomainInvariantError('Invitation save must advance exactly one revision');
    }
    if (
      invitation.id !== current.id ||
      invitation.caseId !== current.caseId ||
      invitation.tokenHash !== current.tokenHash ||
      invitation.recipientEmailHash !== current.recipientEmailHash
    ) {
      throw new DomainInvariantError('Invitation identity and recipient binding are immutable');
    }
    this.#records.set(invitation.id, cloneFrozen(invitation));
    return cloneFrozen(invitation);
  }
}
