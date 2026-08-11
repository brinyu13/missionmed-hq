import { randomUUID } from 'node:crypto';

function canonicalRequest(value) {
  return JSON.stringify(value, Object.keys(value).sort());
}

function boundedId(value, label) {
  const id = String(value || '').trim();
  if (!/^[A-Za-z0-9._:-]{1,120}$/u.test(id)) throw new TypeError(`${label} is invalid.`);
  return id;
}

export class InMemoryVideoEntitlementStore {
  constructor({ now = () => Date.now(), idFactory = () => randomUUID() } = {}) {
    this.now = now;
    this.idFactory = idFactory;
    this.accounts = new Map();
    this.reservations = new Map();
    this.idempotency = new Map();
    this.interviewReservations = new Map();
    this.killSwitch = false;
  }

  grantSyntheticSeconds(subject, seconds) {
    const key = boundedId(subject, 'Subject');
    const granted = Math.max(0, Math.trunc(Number(seconds) || 0));
    this.accounts.set(key, { granted, consumed: 0, reserved: 0 });
    return this.balance(key);
  }

  balance(subject) {
    const key = boundedId(subject, 'Subject');
    const account = this.accounts.get(key) || { granted: 0, consumed: 0, reserved: 0 };
    return Object.freeze({
      granted: account.granted,
      consumed: account.consumed,
      reserved: account.reserved,
      available: Math.max(0, account.granted - account.consumed - account.reserved),
    });
  }

  reserve({ subject, interviewId, requestedSeconds, idempotencyKey, testNo = null }) {
    if (this.killSwitch) return Object.freeze({ ok: false, status: 503, code: 'ivprep_unavailable' });
    const owner = boundedId(subject, 'Subject');
    const interview = boundedId(interviewId, 'Interview');
    const key = boundedId(idempotencyKey, 'Idempotency key');
    const seconds = Math.max(1, Math.trunc(Number(requestedSeconds) || 0));
    const request = canonicalRequest({ owner, interview, seconds, testNo });
    const prior = this.idempotency.get(key);
    if (prior) return prior.request === request ? prior.result : Object.freeze({ ok: false, status: 409, code: 'ivprep_idempotency_conflict' });
    if (this.interviewReservations.has(interview)) return Object.freeze({ ok: false, status: 409, code: 'ivprep_reservation_exists' });

    const balance = this.balance(owner);
    if (seconds > balance.available) return Object.freeze({ ok: false, status: 409, code: 'ivprep_video_seconds_unavailable' });
    const account = this.accounts.get(owner) || { granted: 0, consumed: 0, reserved: 0 };
    account.reserved += seconds;
    this.accounts.set(owner, account);
    const reservation = {
      id: boundedId(this.idFactory(), 'Reservation'),
      subject: owner,
      interviewId: interview,
      reservedSeconds: seconds,
      consumedSeconds: 0,
      refundedSeconds: 0,
      state: 'RESERVED',
      testNo,
      dispatchId: null,
      providerSessionHash: null,
      createdAtMs: this.now(),
      terminalAtMs: null,
    };
    this.reservations.set(reservation.id, reservation);
    this.interviewReservations.set(interview, reservation.id);
    const result = Object.freeze({ ok: true, status: 201, reservation: structuredClone(reservation) });
    this.idempotency.set(key, { request, result });
    return result;
  }

  bindProvider({ reservationId, dispatchId, providerSessionHash }) {
    const reservation = this.#active(reservationId);
    const dispatch = boundedId(dispatchId, 'Dispatch');
    const providerHash = String(providerSessionHash || '').trim();
    if (!/^[a-f0-9]{64}$/u.test(providerHash)) throw new TypeError('Provider session hash is invalid.');
    if (reservation.dispatchId || reservation.providerSessionHash) {
      const same = reservation.dispatchId === dispatch && reservation.providerSessionHash === providerHash;
      if (!same) throw new Error('Reservation is already bound to another provider session.');
      return structuredClone(reservation);
    }
    reservation.dispatchId = dispatch;
    reservation.providerSessionHash = providerHash;
    reservation.state = 'PROVIDER_BOUND';
    return structuredClone(reservation);
  }

  reconcile({ reservationId, observedBillableSeconds, terminationConfirmed }) {
    const reservation = this.reservations.get(boundedId(reservationId, 'Reservation'));
    if (!reservation) throw new Error('Reservation was not found.');
    if (['CLOSED', 'TERMINATION_UNCONFIRMED'].includes(reservation.state)) return structuredClone(reservation);
    if (terminationConfirmed !== true) {
      reservation.state = 'TERMINATION_UNCONFIRMED';
      reservation.terminalAtMs = this.now();
      this.killSwitch = true;
      return structuredClone(reservation);
    }
    const consumed = Math.min(reservation.reservedSeconds, Math.max(0, Math.ceil(Number(observedBillableSeconds) || 0)));
    const refund = reservation.reservedSeconds - consumed;
    const account = this.accounts.get(reservation.subject);
    account.reserved -= reservation.reservedSeconds;
    account.consumed += consumed;
    reservation.consumedSeconds = consumed;
    reservation.refundedSeconds = refund;
    reservation.state = 'CLOSED';
    reservation.terminalAtMs = this.now();
    if (Number(observedBillableSeconds) > reservation.reservedSeconds) this.killSwitch = true;
    return structuredClone(reservation);
  }

  refundBeforeProviderStart(reservationId) {
    const reservation = this.reservations.get(boundedId(reservationId, 'Reservation'));
    if (!reservation) throw new Error('Reservation was not found.');
    if (reservation.state === 'CLOSED') return structuredClone(reservation);
    if (reservation.providerSessionHash) throw new Error('Provider-bound reservations require reconciliation.');
    const account = this.accounts.get(reservation.subject);
    account.reserved -= reservation.reservedSeconds;
    reservation.refundedSeconds = reservation.reservedSeconds;
    reservation.state = 'CLOSED';
    reservation.terminalAtMs = this.now();
    return structuredClone(reservation);
  }

  #active(reservationId) {
    const reservation = this.reservations.get(boundedId(reservationId, 'Reservation'));
    if (!reservation || ['CLOSED', 'TERMINATION_UNCONFIRMED'].includes(reservation.state)) {
      throw new Error('An active reservation is required.');
    }
    return reservation;
  }
}
