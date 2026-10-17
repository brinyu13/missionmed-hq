const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const PROJECT = 'bscnrgqlwsyygyfrbhfn';
export function createNativeVoiceSpendStore({ rest } = {}) {
  if (rest?.projectRef !== PROJECT || typeof rest?.request !== 'function') {
    throw new TypeError('Native Voice ledger requires the exact authorized database.');
  }
  const rpc = async (name, input) => {
    try {
      const value = await rest.request(`/rpc/ivoc_native_voice_${name}`, { method: 'POST', body: input });
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid receipt');
      return Object.freeze(value);
    } catch { throw new Error('Native Voice durable operation unconfirmed.'); }
  };
  const reservation = value => { if (!UUID.test(value || '')) throw new TypeError('Native reservation invalid.'); return value; };
  return Object.freeze({
    reserve: binding => rpc('reserve', { p_binding: binding }),
    claimCreate: input => rpc('claim_create', { p_reservation_id: reservation(input.reservationId), p_binding: input }),
    bindProvider: input => rpc('bind_provider', { p_reservation_id: reservation(input.reservationId), p_provider_id: input.providerSessionId }),
    heartbeat: input => rpc('heartbeat', { p_reservation_id: reservation(input.reservationId), p_owner: input.ownerSubject,
      p_generation: input.generation, p_sequence: input.sequence }),
    recordUsage: input => rpc('record_usage', { p_reservation_id: reservation(input.reservationId), p_evidence: input }),
    requestEnd: input => rpc('request_end', { p_reservation_id: reservation(input.reservationId), p_reason: input.reason }),
    recordTerminal: input => rpc('record_terminal', { p_reservation_id: reservation(input.reservationId), p_evidence: input }),
    quarantine: input => rpc('quarantine', { p_reservation_id: reservation(input.reservationId), p_reason: input.reason }),
  });
}
