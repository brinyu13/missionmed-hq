export function reconcileProviderCost({ providerStatus, localElapsedSeconds }) {
  const elapsed = Math.max(0, Number(localElapsedSeconds) || 0);
  const providerSeconds = Number(providerStatus?.durationSeconds);
  const providerCredits = Number(providerStatus?.credits);
  const durationVerified = Number.isFinite(providerSeconds) && providerSeconds >= 0;
  const creditsVerified = Number.isFinite(providerCredits) && providerCredits >= 0;
  const minutes = durationVerified ? providerSeconds / 60 : null;
  return Object.freeze({
    terminalStatus: typeof providerStatus?.status === 'string' ? providerStatus.status.slice(0, 80) : 'UNRESOLVED',
    observedProviderSeconds: durationVerified ? providerSeconds : null,
    providerNativeCredits: creditsVerified ? providerCredits : null,
    localElapsedSeconds: elapsed,
    creditsPerRealSelfManagedMinute: durationVerified && creditsVerified && minutes > 0 ? providerCredits / minutes : null,
    costEvidence: durationVerified && creditsVerified ? 'VERIFIED' : 'NOT_EXPOSED',
  });
}
