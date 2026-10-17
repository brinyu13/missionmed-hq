import { createHash } from 'node:crypto';
import { readFile, realpath } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createQuestionPlatformServer } from './server.mjs';
import { MemoryRepository } from './store.mjs';

const APP_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const ADAPTER_ROOT = resolve(APP_ROOT, 'runtime-adapters');
const HASH_PATTERN = /^[0-9a-f]{64}$/u;
const MODULE_PATTERN = /^runtime-adapters\/[a-z0-9._-]+\.mjs$/u;
const REQUIRED_PLATFORM_METHODS = Object.freeze([
  'featureFlagEnabled',
  'governance',
  'assignGovernanceSlot',
  'registerReviewer',
  'setFeatureFlag',
  'get',
  'list',
  'create',
  'update',
  'createRevision',
  'editDraftRevision',
  'submitRevisionCandidate',
  'readAssignedReviewContent',
  'createReviewAssignment',
  'acceptReviewAssignment',
  'submitReviewEvent',
  'assembleRelease',
  'recordReleaseValidation',
  'promoteRelease',
  'artifactForPhase',
]);
const REQUIRED_RESOLVERS = Object.freeze([
  'identityResolver',
  'staticAccessResolver',
  'logoutResolver',
  'readinessResolver',
  'finalizationResolver',
  'reviewContentResolver',
]);

export class RuntimeConfigurationError extends Error {
  constructor(code, options = {}) {
    super(code, options);
    this.name = 'RuntimeConfigurationError';
    this.code = code;
  }
}

function fail(code, options) {
  throw new RuntimeConfigurationError(code, options);
}

function assertComposition(composition) {
  if (!composition || typeof composition !== 'object' || Array.isArray(composition)) {
    fail('runtime_composition_required');
  }
  const descriptor = composition.descriptor;
  if (
    !descriptor
    || descriptor.contract !== 'i1q.runtime.v1'
    || descriptor.persistence !== 'postgresql'
    || descriptor.actor_context !== 'transaction_local'
    || descriptor.audit !== 'durable'
    || descriptor.synthetic_data_only !== true
    || descriptor.feature_flags_default_off !== true
  ) {
    fail('runtime_descriptor_invalid');
  }
  if (
    !composition.platform
    || composition.platform.syntheticDemo === true
    || composition.platform.repository instanceof MemoryRepository
  ) {
    fail('persistent_runtime_platform_required');
  }
  for (const method of REQUIRED_PLATFORM_METHODS) {
    if (typeof composition.platform[method] !== 'function') {
      fail(`runtime_platform_method_missing:${method}`);
    }
  }
  for (const resolver of REQUIRED_RESOLVERS) {
    if (typeof composition[resolver] !== 'function') {
      fail(`runtime_resolver_missing:${resolver}`);
    }
  }
  return composition;
}

export function createProductionQuestionPlatformServer(composition) {
  const validated = assertComposition(composition);
  return createQuestionPlatformServer({
    platform: validated.platform,
    identityResolver: validated.identityResolver,
    staticAccessResolver: validated.staticAccessResolver,
    logoutResolver: validated.logoutResolver,
    readinessResolver: validated.readinessResolver,
    finalizationResolver: validated.finalizationResolver,
    reviewContentResolver: validated.reviewContentResolver,
  });
}

export async function loadHashPinnedRuntimeComposition({ modulePath, moduleSha256 } = {}) {
  if (!MODULE_PATTERN.test(modulePath || '')) fail('runtime_composition_module_invalid');
  if (!HASH_PATTERN.test(moduleSha256 || '')) fail('runtime_composition_hash_invalid');
  const requestedPath = resolve(APP_ROOT, modulePath);
  let canonicalPath;
  try {
    canonicalPath = await realpath(requestedPath);
  } catch (cause) {
    fail('runtime_composition_module_unavailable', { cause });
  }
  if (canonicalPath !== ADAPTER_ROOT && !canonicalPath.startsWith(`${ADAPTER_ROOT}${sep}`)) {
    fail('runtime_composition_module_outside_adapter_root');
  }
  const bytes = await readFile(canonicalPath);
  const actualHash = createHash('sha256').update(bytes).digest('hex');
  if (actualHash !== moduleSha256) fail('runtime_composition_hash_mismatch');

  let loaded;
  try {
    loaded = await import(`${pathToFileURL(canonicalPath).href}?sha256=${actualHash}`);
  } catch (cause) {
    fail('runtime_composition_module_load_failed', { cause });
  }
  if (typeof loaded.createI1QRuntimeComposition !== 'function') {
    fail('runtime_composition_factory_missing');
  }
  const composition = await loaded.createI1QRuntimeComposition();
  return assertComposition(composition);
}

export async function startConfiguredRuntime(env = process.env) {
  if (env.I1Q_RUNTIME_MODE !== 'staging') fail('runtime_mode_not_authorized');
  const host = env.I1Q_BIND_HOST;
  if (!['127.0.0.1', '0.0.0.0', '::'].includes(host)) fail('runtime_bind_host_invalid');
  const port = Number(env.PORT);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) fail('runtime_port_invalid');
  const composition = await loadHashPinnedRuntimeComposition({
    modulePath: env.I1Q_RUNTIME_COMPOSITION_MODULE,
    moduleSha256: env.I1Q_RUNTIME_COMPOSITION_SHA256,
  });
  const server = createProductionQuestionPlatformServer(composition);
  await new Promise((resolveListen, rejectListen) => {
    server.once('error', rejectListen);
    server.listen(port, host, () => {
      server.off('error', rejectListen);
      resolveListen();
    });
  });
  process.stdout.write(`I1Q Question Platform listening on ${host}:${port} (authenticated-staging)\n`);
  return server;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    await startConfiguredRuntime();
  } catch (error) {
    const code = error instanceof RuntimeConfigurationError ? error.code : 'runtime_start_failed';
    process.stderr.write(`${code}\n`);
    process.exitCode = 1;
  }
}
