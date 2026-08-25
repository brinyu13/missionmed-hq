import { createHash, randomUUID } from 'node:crypto';
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
const MISSING_OUTPUT_CODES = new Set(['ENOENT', 'ENOTDIR']);

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
  sourcePath = resolvePrototypeSource(),
  outputPath = defaultOutput,
  manifestPath = defaultManifest,
} = {}) {
  const source = await readPrototypeSource(sourcePath);
  const generated = materializeFrozenPrototype(source.toString('utf8'));
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeAtomicallyIfChanged(outputPath, generated);
  const result = {
    sourceName: path.basename(sourcePath),
    sourceSha256: digest(source),
    sourceBytes: source.byteLength,
    outputSha256: digest(generated),
    outputBytes: Buffer.byteLength(generated),
    adapterVersion: PRODUCTION_ADAPTER_VERSION,
    securityTransforms: ['toast_text_only', 'prototype_script_execution_quarantine'],
  };
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeAtomicallyIfChanged(manifestPath, `${JSON.stringify(result, null, 2)}\n`);
  return { sourcePath, outputPath, manifestPath, ...result };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let result;
  try {
    result = await materialize({
      sourcePath: process.argv[2] || resolvePrototypeSource(),
      outputPath: process.argv[3] || defaultOutput,
    });
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  }
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
