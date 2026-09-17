import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const handoffRoot = fileURLToPath(new URL('.', import.meta.url));
const repositoryRoot = fileURLToPath(new URL('../../../', import.meta.url));
const publicRoot = path.join(repositoryRoot, 'ivprep-v6', 'public');
const liveRoot = path.join(publicRoot, 'live-analytics');
const outputPath = path.join(handoffRoot, 'IV_PREP_ON_CALL_LIVE_ANALYTICS_STANDALONE.html');
const entryId = 'public/live-analytics/live-analytics.mjs';

const modulePaths = Object.freeze([
  'public/analytics/audio-signal.mjs',
  'public/analytics/pitch-f0.mjs',
  'public/analytics/session-clock.mjs',
  'public/analytics/vision-geometry.mjs',
  'public/live-analytics/hud-renderers.mjs',
  'public/live-analytics/live-metric-projector.mjs',
  'public/live-analytics/visibility-state.mjs',
  entryId,
]);

function resolveImport(moduleId, specifier) {
  if (!specifier.startsWith('.')) throw new Error(`Standalone bundle rejects non-local import ${specifier}.`);
  return path.posix.normalize(path.posix.join(path.posix.dirname(moduleId), specifier));
}

function importBindings(source) {
  return source
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => value.replace(/\s+as\s+/u, ': '))
    .join(', ');
}

function transformModule(moduleId, originalSource) {
  const exports = new Set();
  let source = originalSource.replace(
    /import\s*\{([\s\S]*?)\}\s*from\s*['"]([^'"]+)['"];\s*/gu,
    (_match, bindings, specifier) => `const { ${importBindings(bindings)} } = __require(${JSON.stringify(resolveImport(moduleId, specifier))});\n`,
  );

  source = source.replace(
    /export\s*\{([\s\S]*?)\}\s*from\s*['"]([^'"]+)['"];\s*/gu,
    (_match, bindings, specifier) => {
      const dependency = resolveImport(moduleId, specifier);
      const assignments = bindings
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
        .map((value) => {
          const [imported, exposed = imported] = value.split(/\s+as\s+/u);
          exports.add(exposed.trim());
          return `const ${exposed.trim()} = __require(${JSON.stringify(dependency)}).${imported.trim()};`;
        });
      return `${assignments.join('\n')}\n`;
    },
  );

  source = source.replace(
    /\bexport\s+(const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/gu,
    (_match, declaration, name) => {
      exports.add(name);
      return `${declaration} ${name}`;
    },
  );

  if (/\b(?:import|export)\s/u.test(source)) {
    throw new Error(`Unsupported module syntax remains in ${moduleId}.`);
  }

  const expose = exports.size
    ? `\nObject.assign(__exports, { ${[...exports].join(', ')} });`
    : '';
  return `__define(${JSON.stringify(moduleId)}, (__exports, __require) => {\n${source}${expose}\n});`;
}

function standaloneRuntimeSource(source) {
  const mountNeedle = 'const runtime = new LiveAnalyticsRuntime({ fixtureMode: localhostFixtureEnabled() }).mount();';
  if (!source.includes(mountNeedle)) throw new Error('Standalone mount seam not found.');
  return source
    .replace(
      mountNeedle,
      `const runtime = new LiveAnalyticsRuntime({ fixtureMode: true }).mount();
  globalThis.__IVPREP_STANDALONE_RUNTIME__ = runtime;
  queueMicrotask(async () => {
    await runtime.connect();
    await runtime.start();
  });`,
    )
    .replace(
      `const localQa = typeof location !== 'undefined'
    && ['127.0.0.1', 'localhost', '::1'].includes(location.hostname);`,
      'const localQa = true;',
    );
}

function inlineScannerAssets(css, faceBase64, bodyBase64) {
  const result = css
    .replace('url("./founder-face-scanner.png")', `url("data:image/png;base64,${faceBase64}")`)
    .replace('url("./founder-body-scanner.png")', `url("data:image/png;base64,${bodyBase64}")`);
  if (result.includes('./founder-face-scanner.png') || result.includes('./founder-body-scanner.png')) {
    throw new Error('A scanner asset URL was not embedded.');
  }
  return result;
}

const sourceSha = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: repositoryRoot,
  encoding: 'utf8',
}).trim();

const [htmlSource, cssSource, faceAsset, bodyAsset] = await Promise.all([
  readFile(path.join(liveRoot, 'index.html'), 'utf8'),
  readFile(path.join(liveRoot, 'live-analytics.css'), 'utf8'),
  readFile(path.join(liveRoot, 'founder-face-scanner.png')),
  readFile(path.join(liveRoot, 'founder-body-scanner.png')),
]);

const modules = new Map();
for (const moduleId of modulePaths) {
  const filePath = path.join(repositoryRoot, 'ivprep-v6', moduleId.replace(/^public\//u, 'public/'));
  let source = await readFile(filePath, 'utf8');
  if (moduleId === entryId) source = standaloneRuntimeSource(source);
  modules.set(moduleId, source);
}
modules.set(
  'public/live-analytics/local-transcript-timing.mjs',
  `export class LocalTranscriptTimingProducer {
    constructor() {
      this.state = Object.freeze({ state: 'unavailable', reason: 'STANDALONE_REVIEW_DETERMINISTIC_ONLY' });
    }
    async start({ onState } = {}) { onState?.(this.state); return false; }
    stop() { return false; }
  }`,
);
modules.set(
  'public/live-analytics/media-bridge.mjs',
  `const STANDALONE_MEDIA = Object.freeze({
    cam: false,
    mic: false,
    stream: null,
    cameraTrack: null,
    microphoneTrack: null,
    AC: null,
    analyser: null,
    data: null,
  });
  const STANDALONE_READINESS = Object.freeze({
    camera: Object.freeze({ ready: false, reason: 'STANDALONE_REVIEW_DETERMINISTIC_ONLY' }),
    microphone: Object.freeze({ ready: false, reason: 'STANDALONE_REVIEW_DETERMINISTIC_ONLY' }),
    anyReady: false,
    fullyReady: false,
  });
  export class LiveAnalyticsMediaBridge {
    constructor() {
      this.media = STANDALONE_MEDIA;
      this.readiness = STANDALONE_READINESS;
      this.sessionClock = null;
      this.analyticsPipeline = null;
    }
    addEventListener() {}
    removeEventListener() {}
    primeAudioContext() { return null; }
    requestMedia() { throw new Error('PHYSICAL_CAPTURE_REQUIRES_HOSTED_OR_LOCALHOST_RUNTIME'); }
    switchDevice() { throw new Error('PHYSICAL_CAPTURE_REQUIRES_HOSTED_OR_LOCALHOST_RUNTIME'); }
    ensureAnalytics() { throw new Error('PHYSICAL_CAPTURE_REQUIRES_HOSTED_OR_LOCALHOST_RUNTIME'); }
    startAnalytics() { return false; }
    endAnalytics() { return null; }
    stopMedia() { return STANDALONE_MEDIA; }
    destroy() { return STANDALONE_MEDIA; }
  }
  export function createLiveAnalyticsMediaBridge() { return new LiveAnalyticsMediaBridge(); }`,
);

const moduleDefinitions = [...modules]
  .map(([moduleId, source]) => transformModule(moduleId, source))
  .join('\n\n');

const bundle = `
const __moduleFactories = new Map();
const __moduleCache = new Map();
function __define(id, factory) { __moduleFactories.set(id, factory); }
function __require(id) {
  if (__moduleCache.has(id)) return __moduleCache.get(id);
  const factory = __moduleFactories.get(id);
  if (!factory) throw new Error('Standalone module unavailable: ' + id);
  const exports = {};
  __moduleCache.set(id, exports);
  factory(exports, __require);
  return Object.freeze(exports);
}
${moduleDefinitions}
globalThis.__IVPREP_STANDALONE__ = Object.freeze({
  sourceSha: ${JSON.stringify(sourceSha)},
  mode: 'DETERMINISTIC_LOCAL_SIGNALS',
  providerSessions: 0,
  physicalCapture: 'REQUIRES_HOSTED_OR_LOCALHOST_RUNTIME',
});
__require(${JSON.stringify(entryId)});
`;

const css = inlineScannerAssets(cssSource, faceAsset.toString('base64'), bodyAsset.toString('base64'));
const metadata = `
  <meta name="missionmed-standalone" content="deterministic-review-only">
  <meta name="missionmed-source-sha" content="${sourceSha}">
  <!-- Self-contained Fable 5 review artifact. Physical capture and local transcript timing intentionally require the governed runtime. -->`;

let standalone = htmlSource
  .replace('<html lang="en"', '<html lang="en" data-standalone-review="true"')
  .replace('</head>', `${metadata}\n</head>`)
  .replace(
    '  <link rel="stylesheet" href="/iv-prep-on-call/assets/live-analytics/live-analytics.css">',
    `  <style>\n${css.replace(/<\/style/giu, '<\\/style')}\n  </style>`,
  )
  .replace(
    '  <script type="module" src="/iv-prep-on-call/assets/live-analytics/live-analytics.mjs"></script>',
    `  <script type="module">\n${bundle.replace(/<\/script/giu, '<\\/script')}\n  </script>`,
  );

if (/\b(?:src|href)=["']\/iv-prep-on-call\/assets\//u.test(standalone)) {
  throw new Error('Standalone output retained a server asset URL.');
}
if (!standalone.includes('data:image/png;base64,')) throw new Error('Standalone output is missing embedded scanner images.');
if (!standalone.includes('__IVPREP_STANDALONE__')) throw new Error('Standalone runtime marker is missing.');

await writeFile(outputPath, standalone, 'utf8');
process.stdout.write(`STANDALONE_HTML=${outputPath}\nSOURCE_SHA=${sourceSha}\nBYTES=${Buffer.byteLength(standalone)}\n`);
