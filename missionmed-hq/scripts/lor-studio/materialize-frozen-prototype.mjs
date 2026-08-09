import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const CANONICAL_PROTOTYPE_SHA256 = '8560559341895f2973c51bdf7d7ba28ba7a9890d70c6bc6eb5976fc67371e037';
export const PRODUCTION_ADAPTER_VERSION = 5;

const UNSAFE_TOAST_IMPLEMENTATION = "function toast(m,ms){const t=$('#toast');t.innerHTML=m;t.classList.add('show');clearTimeout(t._h);t._h=setTimeout(()=>t.classList.remove('show'),ms||3200)}";
const SAFE_TOAST_IMPLEMENTATION = "function toast(m,ms){const t=$('#toast');t.textContent=String(m??'');t.classList.add('show');clearTimeout(t._h);t._h=setTimeout(()=>t.classList.remove('show'),ms||3200)}";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const runtimeDirectory = path.resolve(scriptDirectory, '..', '..');
const defaultSource = '/Users/brianb/MissionMed/F2-LOR-1003-functional-prototype.html';
const defaultOutput = path.join(runtimeDirectory, 'public', 'lor-studio', 'index.html');
const defaultManifest = path.join(runtimeDirectory, 'public', 'lor-studio', 'FROZEN_PRESENTATION_MANIFEST.json');

function digest(value) {
  return createHash('sha256').update(value).digest('hex');
}

function replaceLast(value, needle, replacement) {
  const index = value.lastIndexOf(needle);
  if (index < 0) throw new Error(`Required closing marker ${needle} was not found.`);
  return `${value.slice(0, index)}${replacement}${value.slice(index + needle.length)}`;
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
  const scriptMarker = `
<script src="/lor-studio/production-adapter.js?v=${PRODUCTION_ADAPTER_VERSION}"></script>
`;

  let generated = sourceHtml;
  if (!generated.includes(UNSAFE_TOAST_IMPLEMENTATION)) {
    throw new Error('Expected frozen toast implementation was not found; security transform cannot be proven.');
  }
  generated = generated.replace(UNSAFE_TOAST_IMPLEMENTATION, SAFE_TOAST_IMPLEMENTATION);
  generated = generated.replace(/<html\b([^>]*)>/u, '<html$1 data-lor-runtime="gated">');
  generated = generated.replace('</head>', `${headMarker}</head>`);
  generated = generated.replace(/<body([^>]*)>/u, `<body$1>${bodyMarker}`);
  generated = replaceLast(generated, '</body>', `${scriptMarker}</body>`);

  if (generated === sourceHtml || !generated.includes('id="lorRuntimeGate"') || !generated.includes('production-adapter.js')) {
    throw new Error('Production adapter injection failed.');
  }

  return generated;
}

export async function materialize({
  sourcePath = defaultSource,
  outputPath = defaultOutput,
  manifestPath = defaultManifest,
} = {}) {
  const source = await readFile(sourcePath);
  const generated = materializeFrozenPrototype(source.toString('utf8'));
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, generated);
  const result = {
    sourceName: path.basename(sourcePath),
    sourceSha256: digest(source),
    sourceBytes: source.byteLength,
    outputSha256: digest(generated),
    outputBytes: Buffer.byteLength(generated),
    adapterVersion: PRODUCTION_ADAPTER_VERSION,
    securityTransforms: ['toast_text_only'],
  };
  await writeFile(manifestPath, `${JSON.stringify(result, null, 2)}\n`);
  return { sourcePath, outputPath, manifestPath, ...result };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await materialize({
    sourcePath: process.argv[2] || process.env.LOR_STUDIO_PROTOTYPE_SOURCE || defaultSource,
    outputPath: process.argv[3] || defaultOutput,
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
