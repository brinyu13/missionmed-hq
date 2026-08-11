const DENIED = Object.freeze({ ok: false, code: 'ivprep_durable_provider_gate_unavailable' });

// The production worker loads its agent module in a child process. Keep the
// concrete module-local gate fail-closed until a later exact database decision
// replaces these operations with the reviewed atomic ledger adapter.
export const profileBDurableGate = Object.freeze({
  claimJob: async () => DENIED,
  waitForTermination: async () => DENIED,
  markWorkerJoined: async () => DENIED,
  reconcileJob: async () => DENIED,
});

export default profileBDurableGate;
