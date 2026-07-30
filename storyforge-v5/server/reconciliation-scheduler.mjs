export const RECONCILIATION_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

function activeMode(environment) {
  const mode = String(environment?.STORYFORGE_AUDIO_RECONCILIATION || 'off')
    .trim()
    .toLowerCase();
  return mode === 'dry_run' || mode === 'on' ? mode : 'off';
}

export function startReconciliationScheduler(reconciliationService, {
  environment = process.env,
  setIntervalFn = setInterval,
  clearIntervalFn = clearInterval,
} = {}) {
  if (!reconciliationService || typeof reconciliationService.run !== 'function') {
    throw new TypeError('A reconciliation service must be supplied.');
  }
  if (
    activeMode(environment) === 'off'
    || String(environment.STORYFORGE_AUDIO_RECONCILIATION_SUSPENDED || '').trim()
  ) {
    return Object.freeze({ active: false, stop() {} });
  }
  const timer = setIntervalFn(() => {
    reconciliationService.run().catch(() => {});
  }, RECONCILIATION_INTERVAL_MS);
  timer?.unref?.();
  return Object.freeze({
    active: true,
    stop() {
      clearIntervalFn(timer);
    },
  });
}
