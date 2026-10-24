import { createHash, randomUUID } from 'node:crypto';
import { constants as fsConstants } from 'node:fs';
import {
  lstat,
  mkdir,
  open,
  readFile,
  rename,
  unlink,
} from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const CANONICAL_PROTOTYPE_SHA256 = '8560559341895f2973c51bdf7d7ba28ba7a9890d70c6bc6eb5976fc67371e037';
export const CANONICAL_PROTOTYPE_BYTES = 332807;
export const CANONICAL_MATERIALIZED_OUTPUT_SHA256 = 'a9ac6af59acbacedf23d8603f43a90aa6209017ab9b4d1a19503b588f5e946f8';
export const CANONICAL_MATERIALIZED_OUTPUT_BYTES = 333791;
export const PRODUCTION_ADAPTER_VERSION = 7;
export const PROTOTYPE_SOURCE_ENV_VAR = 'LOR_STUDIO_PROTOTYPE_SOURCE';

const UNSAFE_TOAST_IMPLEMENTATION = "function toast(m,ms){const t=$('#toast');t.innerHTML=m;t.classList.add('show');clearTimeout(t._h);t._h=setTimeout(()=>t.classList.remove('show'),ms||3200)}";
const SAFE_TOAST_IMPLEMENTATION = "function toast(m,ms){const t=$('#toast');t.textContent=String(m??'');t.classList.add('show');clearTimeout(t._h);t._h=setTimeout(()=>t.classList.remove('show'),ms||3200)}";
const FROZEN_SCRIPT_MARKER = '<script id="lorFrozenPrototypeRuntime" type="application/x-lor-frozen-prototype">';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const runtimeDirectory = path.resolve(scriptDirectory, '..', '..');
const defaultSource = '/Users/brianb/MissionMed/F2-LOR-1003-functional-prototype.html';
const defaultOutput = path.join(runtimeDirectory, 'public', 'lor-studio', 'index.html');
const defaultManifest = path.join(runtimeDirectory, 'public', 'lor-studio', 'FROZEN_PRESENTATION_MANIFEST.json');
const MISSING_SOURCE_CODES = new Set(['ENOENT', 'ENOTDIR', 'EISDIR']);
const ABSENT_SOURCE_CODES = new Set(['ENOENT', 'ENOTDIR']);
const MISSING_OUTPUT_CODES = new Set(['ENOENT', 'ENOTDIR']);
const CANONICAL_SOURCE_NAME = 'F2-LOR-1003-functional-prototype.html';
const SECURITY_TRANSFORMS = Object.freeze([
  'toast_text_only',
  'prototype_script_execution_quarantine',
]);
const EXPECTED_MANIFEST_KEYS = Object.freeze([
  'adapterVersion',
  'outputBytes',
  'outputSha256',
  'securityTransforms',
  'sourceBytes',
  'sourceName',
  'sourceSha256',
]);

export function resolvePrototypeSource(environment = process.env) {
  const configured = environment[PROTOTYPE_SOURCE_ENV_VAR];
  if (typeof configured === 'string' && configured.trim() !== '') {
    return path.resolve(configured.trim());
  }
  return defaultSource;
}

async function readPrototypeSource(sourcePath) {
  try {
    return await readFile(sourcePath);
  } catch (error) {
    if (error && MISSING_SOURCE_CODES.has(error.code)) {
      throw new Error(
        `Canonical frozen prototype was not readable at ${sourcePath}. `
        + `Set ${PROTOTYPE_SOURCE_ENV_VAR} to the path of the frozen prototype `
        + `(SHA-256 ${CANONICAL_PROTOTYPE_SHA256}), or pass the path as the first argument.`,
        { cause: error },
      );
    }
    throw error;
  }
}

function digest(value) {
  return createHash('sha256').update(value).digest('hex');
}

function isConfiguredSource(environment) {
  const configured = environment[PROTOTYPE_SOURCE_ENV_VAR];
  return typeof configured === 'string' && configured.trim() !== '';
}

function isAbsentSourceError(error) {
  return Boolean(
    error
    && ABSENT_SOURCE_CODES.has(error.cause?.code || error.code),
  );
}

async function readCommittedRegularFile(targetPath, label) {
  let handle;
  try {
    handle = await open(targetPath, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
    const stat = await handle.stat();
    if (!stat.isFile()) {
      throw new Error(`Committed ${label} is not a regular file at ${targetPath}`);
    }
    return await handle.readFile();
  } catch (error) {
    if (error instanceof Error && error.message.startsWith(`Committed ${label}`)) {
      throw error;
    }
    throw new Error(`Committed ${label} was not safely readable at ${targetPath}`, { cause: error });
  } finally {
    if (handle) await handle.close().catch(() => {});
  }
}

function assertExactManifest(manifest) {
  if (
    manifest === null
    || typeof manifest !== 'object'
    || Array.isArray(manifest)
    || Object.getPrototypeOf(manifest) !== Object.prototype
  ) {
    throw new Error('Committed frozen presentation manifest must be a plain JSON object.');
  }
  const keys = Object.keys(manifest).sort();
  if (JSON.stringify(keys) !== JSON.stringify(EXPECTED_MANIFEST_KEYS)) {
    throw new Error('Committed frozen presentation manifest has an unexpected shape.');
  }
  if (manifest.sourceName !== CANONICAL_SOURCE_NAME) {
    throw new Error('Committed frozen presentation manifest source name mismatch.');
  }
  if (manifest.sourceSha256 !== CANONICAL_PROTOTYPE_SHA256) {
    throw new Error('Committed frozen presentation manifest source digest mismatch.');
  }
  if (manifest.sourceBytes !== CANONICAL_PROTOTYPE_BYTES) {
    throw new Error('Committed frozen presentation manifest source byte count mismatch.');
  }
  if (manifest.adapterVersion !== PRODUCTION_ADAPTER_VERSION) {
    throw new Error('Committed frozen presentation manifest adapter version mismatch.');
  }
  if (manifest.outputSha256 !== CANONICAL_MATERIALIZED_OUTPUT_SHA256) {
    throw new Error('Committed frozen presentation manifest output digest mismatch.');
  }
  if (manifest.outputBytes !== CANONICAL_MATERIALIZED_OUTPUT_BYTES) {
    throw new Error('Committed frozen presentation manifest output byte count mismatch.');
  }
  if (
    !Array.isArray(manifest.securityTransforms)
    || manifest.securityTransforms.length !== SECURITY_TRANSFORMS.length
    || manifest.securityTransforms.some((value, index) => value !== SECURITY_TRANSFORMS[index])
  ) {
    throw new Error('Committed frozen presentation manifest security transforms mismatch.');
  }
}

function assertMaterializedSecurityMarkers(output) {
  const expectedMarkers = [
    `Frozen source SHA-256: ${CANONICAL_PROTOTYPE_SHA256}`,
    `production-adapter.css?v=${PRODUCTION_ADAPTER_VERSION}`,
    'id="lorRuntimeGate"',
    FROZEN_SCRIPT_MARKER,
    `production-projection-ui.js?v=${PRODUCTION_ADAPTER_VERSION}`,
    `production-adapter.js?v=${PRODUCTION_ADAPTER_VERSION}`,
    SAFE_TOAST_IMPLEMENTATION,
  ];
  for (const marker of expectedMarkers) {
    if (!output.includes(marker)) {
      throw new Error(`Committed materialized output is missing required security marker: ${marker}`);
    }
  }
  if (output.indexOf(FROZEN_SCRIPT_MARKER) !== output.lastIndexOf(FROZEN_SCRIPT_MARKER)) {
    throw new Error('Committed materialized output must contain exactly one quarantined prototype script marker.');
  }
  if (output.includes(UNSAFE_TOAST_IMPLEMENTATION)) {
    throw new Error('Committed materialized output contains the unsafe toast implementation.');
  }
}

export async function verifyCommittedMaterialization({
  outputPath = defaultOutput,
  manifestPath = defaultManifest,
} = {}) {
  const [output, manifestBytes] = await Promise.all([
    readCommittedRegularFile(outputPath, 'materialized output'),
    readCommittedRegularFile(manifestPath, 'frozen presentation manifest'),
  ]);
  let manifest;
  try {
    manifest = JSON.parse(manifestBytes.toString('utf8'));
  } catch (error) {
    throw new Error('Committed frozen presentation manifest is not valid JSON.', { cause: error });
  }
  assertExactManifest(manifest);
  if (output.byteLength !== CANONICAL_MATERIALIZED_OUTPUT_BYTES) {
    throw new Error('Committed materialized output byte count mismatch.');
  }
  const outputText = output.toString('utf8');
  assertMaterializedSecurityMarkers(outputText);
  if (digest(output) !== CANONICAL_MATERIALIZED_OUTPUT_SHA256) {
    throw new Error('Committed materialized output digest mismatch.');
  }
  return { outputPath, manifestPath, ...manifest };
}

function replaceLast(value, needle, replacement) {
  const index = value.lastIndexOf(needle);
  if (index < 0) throw new Error(`Required closing marker ${needle} was not found.`);
  return `${value.slice(0, index)}${replacement}${value.slice(index + needle.length)}`;
}

async function writeAtomicallyIfChanged(targetPath, value) {
  const content = Buffer.isBuffer(value) ? value : Buffer.from(value);
  let outputMode = 0o644;
  try {
    const outputStat = await lstat(targetPath);
    if (!outputStat.isFile() || outputStat.isSymbolicLink()) {
      throw new Error(`Refusing unsafe materialization target at ${targetPath}`);
    }
    outputMode = outputStat.mode & 0o777;
    if ((await readFile(targetPath)).equals(content)) return false;
  } catch (error) {
    if (!error || !MISSING_OUTPUT_CODES.has(error.code)) throw error;
  }

  const temporaryPath = path.join(
    path.dirname(targetPath),
    `.${path.basename(targetPath)}.${process.pid}.${randomUUID()}.tmp`,
  );
  let handle;
  try {
    handle = await open(temporaryPath, 'wx', 0o600);
    await handle.writeFile(content);
    await handle.sync();
    await handle.chmod(outputMode);
    await handle.close();
    handle = undefined;
    await rename(temporaryPath, targetPath);
    return true;
  } catch (error) {
    if (handle) await handle.close().catch(() => {});
    await unlink(temporaryPath).catch((cleanupError) => {
      if (!cleanupError || cleanupError.code !== 'ENOENT') {
        Object.defineProperty(error, 'cleanupError', { value: cleanupError });
      }
    });
    throw error;
  }
}

export function materializeFrozenPrototype(sourceHtml) {
  const sourceDigest = digest(sourceHtml);
  if (sourceDigest !== CANONICAL_PROTOTYPE_SHA256) {
    throw new Error(`Canonical prototype digest mismatch: expected ${CANONICAL_PROTOTYPE_SHA256}, received ${sourceDigest}`);
  }

  const headMarker = `
<!-- F2-LOR-1009 production adapter. Frozen source SHA-256: ${CANONICAL_PROTOTYPE_SHA256}. -->
<link rel="stylesheet" href="/lor-studio/production-adapter.css?v=${PRODUCTION_ADAPTER_VERSION}">
`;
  const bodyMarker = `
<section id="lorRuntimeGate" class="lor-runtime-gate" role="status" aria-live="polite" aria-busy="true">
  <div class="lor-runtime-gate__card">
    <p class="lor-runtime-gate__eyebrow">MissionMed LOR Studio</p>
    <h1 id="lorRuntimeGateTitle">Checking secure access</h1>
    <p id="lorRuntimeGateMessage">Confirming your session, LOR entitlement, and runtime readiness.</p>
    <div id="lorRuntimeGateActions" class="lor-runtime-gate__actions"></div>
    <p id="lorRuntimeGateCode" class="lor-runtime-gate__code"></p>
  </div>
</section>
`;
  // Order matters. production-projection-ui.js publishes the renderer factory the adapter looks
  // for; loading it second would leave the adapter with no renderer on first paint and fall back
  // to the closed state. Both are classic scripts, so this is load order, not module resolution.
  const scriptMarker = `
<script src="/lor-studio/production-projection-ui.js?v=${PRODUCTION_ADAPTER_VERSION}"></script>
<script src="/lor-studio/production-adapter.js?v=${PRODUCTION_ADAPTER_VERSION}"></script>
`;

  let generated = sourceHtml;
  if (!generated.includes(UNSAFE_TOAST_IMPLEMENTATION)) {
    throw new Error('Expected frozen toast implementation was not found; security transform cannot be proven.');
  }
  generated = generated.replace(UNSAFE_TOAST_IMPLEMENTATION, SAFE_TOAST_IMPLEMENTATION);
  if ((generated.match(/<script>/gu) || []).length !== 1) {
    throw new Error('Expected exactly one frozen prototype script before execution quarantine.');
  }
  generated = generated.replace('<script>', FROZEN_SCRIPT_MARKER);
  generated = generated.replace(/<html\b([^>]*)>/u, '<html$1 data-lor-runtime="gated">');
  generated = generated.replace('</head>', `${headMarker}</head>`);
  generated = generated.replace(/<body([^>]*)>/u, `<body$1>${bodyMarker}`);
  generated = replaceLast(generated, '</body>', `${scriptMarker}</body>`);

  if (generated === sourceHtml || !generated.includes('id="lorRuntimeGate"') || !generated.includes('production-adapter.js') || !generated.includes('production-projection-ui.js')) {
    throw new Error('Production adapter injection failed.');
  }

  return generated;
}

export async function materialize({
  sourcePath,
  outputPath = defaultOutput,
  manifestPath = defaultManifest,
  environment = process.env,
} = {}) {
  const implicitDefaultSource = sourcePath === undefined && !isConfiguredSource(environment);
  const resolvedSourcePath = sourcePath === undefined
    ? resolvePrototypeSource(environment)
    : path.resolve(sourcePath);
  let source;
  try {
    source = await readPrototypeSource(resolvedSourcePath);
  } catch (error) {
    if (!implicitDefaultSource || !isAbsentSourceError(error)) throw error;
    const committed = await verifyCommittedMaterialization({ outputPath, manifestPath });
    return {
      sourcePath: resolvedSourcePath,
      ...committed,
      reusedCommittedMaterialization: true,
    };
  }
  const generated = materializeFrozenPrototype(source.toString('utf8'));
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeAtomicallyIfChanged(outputPath, generated);
  const result = {
    sourceName: path.basename(resolvedSourcePath),
    sourceSha256: digest(source),
    sourceBytes: source.byteLength,
    outputSha256: digest(generated),
    outputBytes: Buffer.byteLength(generated),
    adapterVersion: PRODUCTION_ADAPTER_VERSION,
    securityTransforms: [...SECURITY_TRANSFORMS],
  };
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeAtomicallyIfChanged(manifestPath, `${JSON.stringify(result, null, 2)}\n`);
  return {
    sourcePath: resolvedSourcePath,
    outputPath,
    manifestPath,
    ...result,
    reusedCommittedMaterialization: false,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let result;
  try {
    result = await materialize({
      sourcePath: process.argv.length > 2 ? process.argv[2] : undefined,
      outputPath: process.argv.length > 3 ? process.argv[3] : undefined,
    });
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  }
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
