import { createHash } from 'node:crypto';
import { constants as fsConstants } from 'node:fs';
import {
  open,
  readFile,
} from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const CANONICAL_PROTOTYPE_SHA256 = 'c249373619a45c31a1b895363fb1d3806d966c8fc413e0acdc4df0870c5a51b7';
export const CANONICAL_PROTOTYPE_BYTES = 451550;
export const CANONICAL_MATERIALIZED_OUTPUT_SHA256 = '9635e797a07cd7975f003055123f8e892bd31e2334ca66a5b0d6c3e7fa38b3bb';
export const CANONICAL_MATERIALIZED_OUTPUT_BYTES = 391492;
export const PRODUCTION_ADAPTER_VERSION = 8;
export const PROTOTYPE_SOURCE_ENV_VAR = 'LOR_STUDIO_PROTOTYPE_SOURCE';

const UNSAFE_TOAST_IMPLEMENTATION = "function toast(m,ms){const t=$('#toast');t.innerHTML=m;t.classList.add('show');clearTimeout(t._h);t._h=setTimeout(()=>t.classList.remove('show'),ms||3200)}";
const SAFE_TOAST_IMPLEMENTATION = "function toast(m,ms){const t=$('#toast');t.textContent=String(m??'');t.classList.add('show');clearTimeout(t._h);t._h=setTimeout(()=>t.classList.remove('show'),ms||3200)}";
const APPROVED_RUNTIME_MARKER = '<script id="lorFounderApprovedRuntime" type="text/javascript">';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const runtimeDirectory = path.resolve(scriptDirectory, '..', '..');
const defaultSource = '/Users/brianb/Dropbox (Personal)/SCREENSHOTS/F2-LOR-1012_LOR_STUDIO_STANDALONE_REVIEW_2026-08-24.html';
const defaultOutput = path.join(runtimeDirectory, 'public', 'lor-studio', 'index.html');
const defaultManifest = path.join(runtimeDirectory, 'public', 'lor-studio', 'FROZEN_PRESENTATION_MANIFEST.json');
const MISSING_SOURCE_CODES = new Set(['ENOENT', 'ENOTDIR', 'EISDIR']);
const ABSENT_SOURCE_CODES = new Set(['ENOENT', 'ENOTDIR']);
const CANONICAL_SOURCE_NAME = 'F2-LOR-1012_LOR_STUDIO_STANDALONE_REVIEW_2026-08-24.html';
const SECURITY_TRANSFORMS = Object.freeze([
  'toast_text_only',
  'production_local_storage_disabled',
  'founder_approved_runtime_executable',
  'reduced_projection_runtime_rejected',
  'faculty_ai_case_boundary_enforced',
  'student_release_export_restored',
  'durable_applicant_options_only',
  'production_server_role_selector_hidden',
  'writer_depot_missing_writer_fail_safe',
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
    `approvedArtifactSha256:'${CANONICAL_PROTOTYPE_SHA256}'`,
    `production-adapter.css?v=${PRODUCTION_ADAPTER_VERSION}`,
    'id="lorRuntimeGate"',
    APPROVED_RUNTIME_MARKER,
    "presentationIsolation:{value:'founder_approved_application_with_production_adapters'",
    'founderApprovedExecutable:{value:true',
    `production-adapter.js?v=${PRODUCTION_ADAPTER_VERSION}`,
    SAFE_TOAST_IMPLEMENTATION,
  ];
  for (const marker of expectedMarkers) {
    if (!output.includes(marker)) {
      throw new Error(`Committed materialized output is missing required security marker: ${marker}`);
    }
  }
  if (output.indexOf(APPROVED_RUNTIME_MARKER) !== output.lastIndexOf(APPROVED_RUNTIME_MARKER)) {
    throw new Error('Committed materialized output must contain exactly one executable Founder-approved runtime marker.');
  }
  if (output.includes(UNSAFE_TOAST_IMPLEMENTATION)) {
    throw new Error('Committed materialized output contains the unsafe toast implementation.');
  }
  if (output.includes('production-projection-ui.js')) {
    throw new Error('Committed materialized output still loads the rejected reduced projection runtime.');
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

export function materializeFrozenPrototype(sourceHtml) {
  const sourceDigest = digest(sourceHtml);
  if (sourceDigest !== CANONICAL_PROTOTYPE_SHA256) {
    throw new Error(`Canonical prototype digest mismatch: expected ${CANONICAL_PROTOTYPE_SHA256}, received ${sourceDigest}`);
  }
  throw new Error('Ticket 024 production adapters are custody-reviewed source and may not be regenerated from a lossy transform. Verify the committed materialization instead.');
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
  const sourceDigest = digest(source);
  if (sourceDigest !== CANONICAL_PROTOTYPE_SHA256 || source.byteLength !== CANONICAL_PROTOTYPE_BYTES) {
    throw new Error(`Canonical prototype digest mismatch: expected ${CANONICAL_PROTOTYPE_SHA256}, received ${sourceDigest}`);
  }
  const result = await verifyCommittedMaterialization({ outputPath, manifestPath });
  return {
    sourcePath: resolvedSourcePath,
    ...result,
    reusedCommittedMaterialization: true,
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
