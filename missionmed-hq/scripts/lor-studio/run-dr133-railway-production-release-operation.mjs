// This executable intentionally has no static imports. It snapshots only the
// small credential/runtime allowlist below, erases the ambient environment,
// and only then imports the release orchestrator.

const MAX_ARGUMENT_LENGTH = 32 * 1_024;
const MAX_STDIN_BYTES = 64 * 1_024;
const CONTROL = /[\u0000-\u001f\u007f]/u;
const OPERATIONS = new Set([
  'activate-canary',
  'activate-rollout',
  'bind-variable',
  'capture-preimage',
  'deploy-dark',
  'inspect-variable',
  'rollback-redeploy',
  'verify-bindings',
  'verify-dark',
]);

function ownString(environment, key, { optional = false } = {}) {
  const descriptor = Object.getOwnPropertyDescriptor(environment, key);
  if (descriptor === undefined && optional) return undefined;
  if (!descriptor || !Object.hasOwn(descriptor, 'value')
    || typeof descriptor.value !== 'string' || descriptor.value.length > 4_096
    || CONTROL.test(descriptor.value)) throw new TypeError('invalid environment');
  return descriptor.value;
}

function absolutePath(value) {
  return typeof value === 'string' && value.startsWith('/')
    && value.length <= 4_096 && !CONTROL.test(value);
}

function sanitizedAmbientEnvironment(ambient) {
  const home = ownString(ambient, 'HOME');
  const temporary = ownString(ambient, 'TMPDIR', { optional: true }) ?? '/tmp';
  const token = ownString(ambient, 'RAILWAY_API_TOKEN', { optional: true });
  const socket = ownString(ambient, 'DR133_SSH_AUTH_SOCK', { optional: true });
  if (!absolutePath(home) || !absolutePath(temporary)
    || (socket !== undefined && !absolutePath(socket))) throw new TypeError('invalid environment');
  if (token !== undefined && (token.length < 20 || /[\u0000-\u0020\u007f]/u.test(token))) {
    throw new TypeError('invalid environment');
  }
  return {
    HOME: home,
    TMPDIR: temporary,
    PATH: '/usr/bin:/bin',
    LANG: 'C',
    LC_ALL: 'C',
    TZ: 'UTC',
    TERM: 'dumb',
    NO_COLOR: '1',
    CI: '1',
    DO_NOT_TRACK: '1',
    RAILWAY_NO_TELEMETRY: '1',
    RAILWAY_NO_AUTO_UPDATE: '1',
    ...(token === undefined ? {} : { RAILWAY_API_TOKEN: token }),
    ...(socket === undefined ? {} : { DR133_SSH_AUTH_SOCK: socket }),
  };
}

function scrub(environment) {
  for (const key of Object.keys(environment)) {
    delete environment[key];
    if (Object.hasOwn(environment, key)) throw new TypeError('environment scrub failed');
  }
}

async function readBoundedStdin() {
  const chunks = [];
  let total = 0;
  try {
    for await (const raw of process.stdin) {
      const bytes = Buffer.from(raw);
      total += bytes.length;
      if (total > MAX_STDIN_BYTES) {
        bytes.fill(0);
        throw new TypeError('stdin overflow');
      }
      chunks.push(bytes);
    }
    return Buffer.concat(chunks);
  } finally {
    for (const chunk of chunks) chunk.fill(0);
  }
}

let operation = 'unknown';
let stdin = null;
try {
  const args = process.argv.slice(2);
  operation = args.shift() ?? 'unknown';
  const safeEnvironment = sanitizedAmbientEnvironment(process.env);
  scrub(process.env);
  Object.assign(process.env, safeEnvironment);
  if (!OPERATIONS.has(operation) || args.some(
    (value) => typeof value !== 'string' || value.length > MAX_ARGUMENT_LENGTH
      || CONTROL.test(value),
  )) throw new TypeError('operation invalid');

  const module = await import('./railway-dr133-production-release-orchestrator.mjs');
  if (['bind-variable', 'inspect-variable'].includes(operation)) stdin = await readBoundedStdin();
  const orchestrate = module.createDr133ProductionReleaseOrchestrator();
  const receipt = await orchestrate({
    args,
    environment: process.env,
    operation,
    stdin,
  });
  process.stdout.write(`${JSON.stringify(receipt)}\n`);
} catch (error) {
  try {
    const module = await import('./railway-dr133-production-release-orchestrator.mjs');
    const receipt = module.dr133ProductionReleaseErrorReceipt(error, operation);
    process.stdout.write(`${JSON.stringify(receipt)}\n`);
  } catch {
    process.stdout.write('{"contract":"missionmed.lor.railway-dr133-production-release-orchestrator.v1","operation":"unknown","result":"BLOCKED","errorCode":"LAUNCHER_FAILED_CLOSED","mutationState":"OUTCOME_UNKNOWN"}\n');
  }
  process.exitCode = 2;
} finally {
  stdin?.fill(0);
}
