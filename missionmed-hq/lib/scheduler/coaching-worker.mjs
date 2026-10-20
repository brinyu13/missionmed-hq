/** Single existing-HQ process lifecycle, not a new service or credential.
 * DB ownership/CAS remains in run(); local flag only avoids overlapping ticks.
 */
export function startCoachingMaintenanceWorker({ enabled = false, run,
  setIntervalImpl = setInterval, clearIntervalImpl = clearInterval,
  setTimeoutImpl = setTimeout, clearTimeoutImpl = clearTimeout,
  onFailure = () => {}, intervalMs = 60000, drainTimeoutMs = 10000 } = {}) {
  if (enabled !== true) return Object.freeze({ enabled: false, stop: async () => {} });
  if (typeof run !== 'function' || !Number.isSafeInteger(intervalMs) || intervalMs < 60000 ||
      !Number.isSafeInteger(drainTimeoutMs) || drainTimeoutMs < 1 || drainTimeoutMs > 10000) {
    throw new Error('coaching_maintenance_configuration_invalid');
  }
  let stopped = false; let pending = null;
  function tick() {
    if (stopped || pending) return;
    pending = Promise.resolve().then(run).catch(() => { onFailure('coaching_maintenance_requires_review'); })
      .finally(() => { pending = null; });
  }
  const timer = setIntervalImpl(tick, intervalMs); timer?.unref?.();
  return Object.freeze({ enabled: true,
    async stop() {
      // Stop admission synchronously; never keep HTTP admission open while draining.
      stopped = true; clearIntervalImpl(timer);
      const active = pending;
      if (!active) return { drained: true };
      let timeout;
      try {
        return await Promise.race([
          active.then(() => ({ drained: true })),
          new Promise(resolve => {
            timeout = setTimeoutImpl(() => resolve({ drained: false, active_work_continues: true }), drainTimeoutMs);
          }),
        ]);
      } finally { if (timeout !== undefined) clearTimeoutImpl(timeout); }
      // Timeout does not cancel or claim completion of an external transaction.
      // Durable leases, tombstones and uncertain-outcome review survive shutdown.
    },
  });
}
