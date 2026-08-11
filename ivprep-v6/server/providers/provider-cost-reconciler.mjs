export function reconcileProviderCost({ providerStatus, localElapsedSeconds }) {
  const elapsed = Math.max(0, Number(localElapsedSeconds) || 0);
  const terminalStatus = String(providerStatus?.sessionStatus || 'UNRESOLVED').toUpperCase().slice(0, 80);
  const providerCost = Number(providerStatus?.cost);
  const terminalVerified = ['COMPLETED', 'TIMED_OUT', 'FAILED'].includes(terminalStatus);
  const costVerified = terminalStatus === 'COMPLETED' && Number.isFinite(providerCost) && providerCost >= 0;
  return Object.freeze({
    terminalStatus,
    terminalVerified,
    observedProviderSeconds: null,
    providerNativeCost: costVerified ? providerCost : null,
    localElapsedSeconds: elapsed,
    costPerLocalElapsedMinute: costVerified && elapsed > 0 ? providerCost / (elapsed / 60) : null,
    costEvidence: costVerified ? 'VERIFIED' : (terminalVerified ? 'NOT_EXPOSED' : 'UNRESOLVED'),
  });
}
