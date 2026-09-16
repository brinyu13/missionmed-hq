export const TEARDOWN_ORDER = Object.freeze([
  'director', 'embodiment', 'transport', 'detectors', 'recorder',
  'media_stopped', 'lease', 'session_sealing',
]);

export async function runTeardown(steps, prior = new Map()) {
  const records = prior;
  for (const name of TEARDOWN_ORDER) {
    if (records.get(name)?.status === 'ok') continue;
    try {
      const result = typeof steps[name] === 'function' ? await steps[name]() : undefined;
      records.set(name, { status: 'ok', result });
    } catch (error) {
      records.set(name, { status: 'failed', error: String(error?.message ?? error) });
    }
  }
  return records;
}
