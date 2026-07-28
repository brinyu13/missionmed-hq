import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  CANONICAL_RELATIVE_PATH,
  CANONICAL_SHA256,
  PRODUCT_SURFACES,
} from '../tests/conformance/authority-contract.mjs';
import {
  assertReleaseSource,
  parseBuildMode,
} from './release-source.mjs';

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(packageDir, 'public');
const releaseDistDir = path.join(packageDir, 'dist');
const releaseRuntimeDir = path.join(
  packageDir,
  'infra',
  'wordpress',
  'missionmed-storyforge-runtime',
);
const guardedReleasePaths = [publicDir, releaseDistDir, releaseRuntimeDir];
const mode = parseBuildMode(process.argv.slice(2));
const releaseProof = mode === 'release'
  ? assertReleaseSource({
    startDirectory: packageDir,
    forbiddenIgnoredPaths: guardedReleasePaths,
  })
  : null;
const repositoryDir = releaseProof?.repositoryDir || path.resolve(packageDir, '..');
const canonicalFile = path.join(repositoryDir, ...CANONICAL_RELATIVE_PATH);
const distDir = mode === 'release'
  ? releaseDistDir
  : path.join(packageDir, '.local', 'development-dist');
const routeFile = path.join(packageDir, 'infra', 'wordpress', 'missionmed-storyforge-route.php');
const releaseFile = path.join(
  releaseRuntimeDir,
  'release.php',
);
const developmentMarker = Buffer.from(`${JSON.stringify({
  mode: 'development',
  deployable: false,
  warning: 'StoryForge development output is not a release artifact.',
}, null, 2)}\n`);

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function alias(value) {
  return sha256(value).slice(0, 12);
}

function fail(message) {
  throw new Error(`StoryForge product provenance failed: ${message}`);
}

function replaceExactlyOnce(source, needle, replacement, label) {
  const pieces = source.split(needle);
  if (pieces.length !== 2) {
    fail(`expected exactly one ${label} reference in the public source.`);
  }
  return `${pieces[0]}${replacement}${pieces[1]}`;
}

async function filesBelow(directory, prefix = '') {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    const absolute = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) {
      fail(`release topology contains a symbolic link: ${relative}.`);
    }
    if (entry.isDirectory()) {
      files.push(...await filesBelow(absolute, relative));
    } else if (entry.isFile()) {
      files.push(relative);
    } else {
      fail(`release topology contains an unsupported entry: ${relative}.`);
    }
  }
  return files;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: packageDir,
    encoding: 'utf8',
    ...options,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = String(result.stderr || result.stdout || '').trim();
    fail(`${command} ${args.join(' ')} failed${detail ? `: ${detail}` : '.'}`);
  }
  return String(result.stdout || '').trim();
}

const canonicalBytes = await readFile(canonicalFile);
const canonicalSha256 = sha256(canonicalBytes);
if (canonicalSha256 !== CANONICAL_SHA256) {
  fail(
    `canonical authority hash is ${canonicalSha256}; required ${CANONICAL_SHA256}.`,
  );
}

const [sourceHtml, sourceApp, sourceAuth, sourceStyles] = await Promise.all([
  readFile(path.join(publicDir, 'index.html'), 'utf8'),
  readFile(path.join(publicDir, 'app.js'), 'utf8'),
  readFile(path.join(publicDir, 'auth.js'), 'utf8'),
  readFile(path.join(publicDir, 'styles.css'), 'utf8'),
]);

const expected = new Map();
const fontDir = path.join(publicDir, 'fonts');
const fontNames = (await readdir(fontDir, { withFileTypes: true }))
  .map((entry) => {
    if (!entry.isFile() || entry.isSymbolicLink()) {
      fail(`public/fonts contains an unsupported entry: ${entry.name}.`);
    }
    return entry.name;
  })
  .sort();

const fontAliases = new Map();
for (const fontName of fontNames.filter((name) => name.endsWith('.woff2'))) {
  const bytes = await readFile(path.join(fontDir, fontName));
  const fingerprint = fontName.match(/\.([a-f0-9]{12})\.woff2$/i)?.[1]?.toLowerCase();
  if (!fingerprint || fingerprint !== alias(bytes)) {
    fail(`self-hosted font fingerprint does not match content: ${fontName}.`);
  }
  fontAliases.set(fontName, fingerprint);
}

const authAlias = alias(sourceAuth);
const rewrittenApp = replaceExactlyOnce(
  sourceApp,
  "from './auth.js'",
  `from './${authAlias}'`,
  'auth module',
);
let rewrittenStyles = sourceStyles;
for (const [fontName, fontAlias] of fontAliases) {
  rewrittenStyles = replaceExactlyOnce(
    rewrittenStyles,
    `./fonts/${fontName}`,
    `./${fontAlias}`,
    `${fontName} font`,
  );
}

const appAlias = alias(rewrittenApp);
const stylesAlias = alias(rewrittenStyles);
const builtHead = mode === 'release'
  ? '<head>\n  <base href="/storyforge/">'
  : [
    '<head>',
    '  <base href="/">',
    '  <meta name="storyforge-build-mode" content="development-only">',
  ].join('\n');
const builtHtml = replaceExactlyOnce(
  replaceExactlyOnce(
    replaceExactlyOnce(
      sourceHtml,
      '<head>',
      builtHead,
      'document head',
    ),
    'href="./styles.css"',
    `href="./_asset/${stylesAlias}"`,
    'stylesheet',
  ),
  'src="./app.js"',
  `src="./_asset/${appAlias}"`,
  'application module',
);

expected.set('index.html', Buffer.from(builtHtml));
expected.set(`assets/app.${appAlias}.js`, Buffer.from(rewrittenApp));
expected.set(`assets/auth.${authAlias}.js`, Buffer.from(sourceAuth));
expected.set(`assets/styles.${stylesAlias}.css`, Buffer.from(rewrittenStyles));
for (const fontName of fontNames) {
  expected.set(
    `assets/fonts/${fontName}`,
    await readFile(path.join(fontDir, fontName)),
  );
}
if (mode === 'development') {
  expected.set('DEVELOPMENT_ONLY.json', developmentMarker);
}

const actualPaths = await filesBelow(distDir);
const expectedPaths = [...expected.keys()].sort((left, right) => left.localeCompare(right));
if (JSON.stringify(actualPaths) !== JSON.stringify(expectedPaths)) {
  fail(
    `${path.relative(packageDir, distDir)} topology is not the deterministic public build.\n`
      + `expected: ${expectedPaths.join(', ')}\n`
      + `actual: ${actualPaths.join(', ')}`,
  );
}

const distManifest = [];
for (const relative of actualPaths) {
  const bytes = await readFile(path.join(distDir, relative));
  const expectedBytes = expected.get(relative);
  if (!expectedBytes?.equals(bytes)) {
    fail(`${path.relative(packageDir, distDir)}/${relative} is stale or was not generated from public source.`);
  }
  const fingerprint = relative.match(/\.([a-f0-9]{12})\.(?:css|js|woff2)$/i)?.[1]?.toLowerCase();
  const digest = sha256(bytes);
  if (fingerprint && fingerprint !== digest.slice(0, 12)) {
    fail(`${path.relative(packageDir, distDir)}/${relative} content fingerprint does not match its bytes.`);
  }
  distManifest.push({
    path: relative,
    sha256: digest,
    size: bytes.length,
  });
}

let wordpress = null;
if (mode === 'release') {
  const routeCheck = run(process.execPath, [
    path.join(packageDir, 'scripts', 'build-wordpress-route-manifest.mjs'),
    '--mode=release',
    '--check',
  ]);
  const [routeSource, releaseBytes] = await Promise.all([
    readFile(routeFile, 'utf8'),
    readFile(releaseFile),
  ]);
  const releaseSource = releaseBytes.toString('utf8');

  const releaseId = routeSource.match(
    /define\(\s*'MMSFR_RELEASE_ID',\s*'([^']+)'\s*\);/,
  )?.[1];
  const releasePhpSha256 = routeSource.match(
    /define\(\s*'MMSFR_RELEASE_PHP_SHA256',\s*'([a-f0-9]{64})'\s*\);/i,
  )?.[1]?.toLowerCase();
  const releasePhpSize = Number(routeSource.match(
    /define\(\s*'MMSFR_RELEASE_PHP_SIZE',\s*(\d+)\s*\);/,
  )?.[1]);
  const bundledReleaseId = releaseSource.match(/'release_id'\s*=>\s*'([^']+)'/)?.[1];

  if (!releaseId || !/^v-[a-f0-9]{16}$/.test(releaseId)) {
    fail('WordPress route release ID is missing or malformed.');
  }
  if (bundledReleaseId !== releaseId) {
    fail(`release bundle ID ${bundledReleaseId || '(missing)'} does not match route ${releaseId}.`);
  }
  if (releasePhpSha256 !== sha256(releaseBytes)) {
    fail('release.php hash does not match the route-pinned hash.');
  }
  if (releasePhpSize !== releaseBytes.length) {
    fail('release.php size does not match the route-pinned size.');
  }

  wordpress = {
    releaseId,
    releasePhpSha256,
    releasePhpSize,
    check: routeCheck,
  };
}

const contractSha256 = sha256(Buffer.from(JSON.stringify({
  canonicalSha256: CANONICAL_SHA256,
  surfaces: PRODUCT_SURFACES,
})));
if (process.env.STORYFORGE_TEST_TERMINAL_RECHECK_SIGNAL) {
  if (process.env.NODE_ENV !== 'test' || mode !== 'release') {
    fail('the terminal recheck test hook requires NODE_ENV=test release mode.');
  }
  const delayMilliseconds = Number(
    process.env.STORYFORGE_TEST_TERMINAL_RECHECK_DELAY_MS || 1000,
  );
  if (
    !Number.isSafeInteger(delayMilliseconds)
    || delayMilliseconds < 1
    || delayMilliseconds > 10_000
  ) {
    fail('the terminal recheck test delay must be between 1 and 10000 milliseconds.');
  }
  await writeFile(
    process.env.STORYFORGE_TEST_TERMINAL_RECHECK_SIGNAL,
    'ready\n',
    { flag: 'wx' },
  );
  await new Promise((resolve) => setTimeout(resolve, delayMilliseconds));
}
const completedReleaseProof = mode === 'release'
  ? assertReleaseSource({
    startDirectory: packageDir,
    forbiddenIgnoredPaths: guardedReleasePaths,
  })
  : null;

console.log(JSON.stringify({
  ok: true,
  mode,
  releaseArtifactEligible: mode === 'release',
  deployable: false,
  deploymentAuthorized: false,
  warning: mode === 'development'
    ? 'Development-only validation cannot produce or certify release artifacts.'
    : 'Artifact provenance does not grant staging or production deployment authority.',
  canonical: {
    path: path.relative(repositoryDir, canonicalFile),
    sha256: canonicalSha256,
    bytes: canonicalBytes.length,
  },
  conformanceContract: {
    sha256: contractSha256,
    surfaces: Object.keys(PRODUCT_SURFACES).length,
  },
  source: {
    indexSha256: sha256(sourceHtml),
    appSha256: sha256(sourceApp),
    authSha256: sha256(sourceAuth),
    stylesSha256: sha256(sourceStyles),
  },
  build: {
    outputDirectory: path.relative(packageDir, distDir),
    files: distManifest,
  },
  wordpress,
  releaseSource: completedReleaseProof
    ? {
      expectedCommit: completedReleaseProof.expectedCommit,
      head: completedReleaseProof.head,
      clean: completedReleaseProof.clean,
    }
    : null,
}, null, 2));
