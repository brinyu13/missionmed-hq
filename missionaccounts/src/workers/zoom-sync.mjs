import path from 'node:path';
import { fileURLToPath } from 'node:url';

function workerError(message) {
  return Object.assign(new Error(message), { status: 503 });
}

function partsInZone(value, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(value);
  return Object.fromEntries(parts.map(part => [part.type, part.value]));
}

function localDateInZone(value, timeZone) {
  const parts = partsInZone(value, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function zonedMidnight(localDate, timeZone) {
  const [year, month, day] = localDate.split('-').map(Number);
  const naiveUtc = Date.UTC(year, month - 1, day);
  let candidate = naiveUtc;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = partsInZone(new Date(candidate), timeZone);
    const renderedAsUtc = Date.UTC(
      Number(parts.year), Number(parts.month) - 1, Number(parts.day),
      Number(parts.hour), Number(parts.minute), Number(parts.second),
    );
    candidate -= renderedAsUtc - naiveUtc;
  }
  return new Date(candidate);
}

export function previousCompleteLocalDayWindow({ now = new Date(), timeZone = 'America/New_York' } = {}) {
  const today = localDateInZone(now, timeZone);
  const [year, month, day] = today.split('-').map(Number);
  const previous = new Date(Date.UTC(year, month - 1, day - 1)).toISOString().slice(0, 10);
  return {
    local_day: previous,
    window_from: zonedMidnight(previous, timeZone).toISOString(),
    window_to: zonedMidnight(today, timeZone).toISOString(),
    time_zone: timeZone,
  };
}

function validatedBaseUrl(value) {
  const url = new URL(String(value || ''));
  const local = ['127.0.0.1', 'localhost', '::1'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) {
    throw workerError('MissionAccounts Zoom worker requires an HTTPS application origin');
  }
  return url.origin;
}

export async function runZoomSync({ env = process.env, fetchImpl = fetch, now = new Date() } = {}) {
  const baseUrl = validatedBaseUrl(env.MISSIONACCOUNTS_INTERNAL_BASE_URL);
  const workerToken = String(env.MISSIONACCOUNTS_WORKER_TOKEN || '');
  if (workerToken.length < 24) throw workerError('MissionAccounts Zoom worker token is not configured');
  const window = previousCompleteLocalDayWindow({
    now,
    timeZone: env.MISSIONACCOUNTS_TIME_ZONE || 'America/New_York',
  });
  const shadow = env.MISSIONACCOUNTS_ZOOM_WORKER_MODE === 'shadow';
  const endpoint = shadow ? '/api/internal/zoom/shadow' : '/api/internal/zoom/sync';
  const keyMode = shadow ? 'shadow:' : '';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  let response;
  try {
    response = await fetchImpl(`${baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${workerToken}`,
        'content-type': 'application/json',
        'idempotency-key': `missionaccounts:zoom:${keyMode}daily:${window.local_day}`,
      },
      body: JSON.stringify({ window_from: window.window_from, window_to: window.window_to }),
      signal: controller.signal,
    });
  } catch {
    throw workerError('MissionAccounts Zoom worker could not reach the application');
  } finally {
    clearTimeout(timeout);
  }
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.accepted !== true) {
    throw workerError(`MissionAccounts Zoom sync was rejected with HTTP ${response.status}`);
  }
  return {
    accepted: true,
    mode: shadow ? 'shadow' : 'effective',
    duplicate: result.duplicate === true,
    local_day: window.local_day,
    sessions: Number(result.sessions || 0),
    source_rows: Number(result.source_rows || 0),
  };
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  runZoomSync()
    .then(result => process.stdout.write(`${JSON.stringify(result)}\n`))
    .catch(error => {
      process.stderr.write(`${error instanceof Error ? error.message : 'MissionAccounts Zoom worker failed'}\n`);
      process.exitCode = 1;
    });
}
