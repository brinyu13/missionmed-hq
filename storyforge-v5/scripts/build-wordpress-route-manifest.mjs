import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  assertReleaseSource,
  parseBuildMode,
} from './release-source.mjs';

const packageDir = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const distDir = path.join(packageDir, 'dist');
const wordpressDir = path.join(packageDir, 'infra', 'wordpress');
const routeFile = path.join(wordpressDir, 'missionmed-storyforge-route.php');
const runtimeRoot = path.join(wordpressDir, 'missionmed-storyforge-runtime');
const edgeAliasFile = path.join(packageDir, 'infra', 'edge', 'generated-asset-aliases.mjs');
const guardedReleasePaths = [distDir, runtimeRoot];
const checkOnly = process.argv.includes('--check');
const mode = parseBuildMode(process.argv.slice(2));
if (mode !== 'release') {
  throw new Error(
    'StoryForge release provenance failed: WordPress artifacts require --mode=release.',
  );
}
const releaseProof = assertReleaseSource({
  startDirectory: packageDir,
  allowedDirtyPaths: checkOnly ? [] : [distDir],
  forbiddenIgnoredPaths: guardedReleasePaths,
});
const manifestStartMarker = '\t\t// BEGIN GENERATED STORYFORGE ASSET MANIFEST.';
const manifestEndMarker = '\t\t// END GENERATED STORYFORGE ASSET MANIFEST.';
const releaseStartMarker = '// BEGIN GENERATED STORYFORGE RELEASE ID.';
const releaseEndMarker = '// END GENERATED STORYFORGE RELEASE ID.';

const mimeTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.woff2', 'font/woff2'],
  ['.txt', 'text/plain; charset=utf-8'],
]);

const approvedTopology = [
  ['index', /^index\.html$/],
  ['app bundle', /^assets\/app\.[a-f0-9]{12}\.js$/],
  ['auth bundle', /^assets\/auth\.[a-f0-9]{12}\.js$/],
  ['stylesheet', /^assets\/styles\.[a-f0-9]{12}\.css$/],
  ['Archivo license', /^assets\/fonts\/OFL-Archivo\.txt$/],
  ['Lora license', /^assets\/fonts\/OFL-Lora\.txt$/],
  ['Rajdhani license', /^assets\/fonts\/OFL-Rajdhani\.txt$/],
  ['Archivo italic', /^assets\/fonts\/archivo-italic\.[a-f0-9]{12}\.woff2$/],
  ['Archivo normal', /^assets\/fonts\/archivo-normal\.[a-f0-9]{12}\.woff2$/],
  ['Lora italic', /^assets\/fonts\/lora-italic\.[a-f0-9]{12}\.woff2$/],
  ['Lora normal', /^assets\/fonts\/lora-normal\.[a-f0-9]{12}\.woff2$/],
  ['Rajdhani 500', /^assets\/fonts\/rajdhani-500\.[a-f0-9]{12}\.woff2$/],
  ['Rajdhani 600', /^assets\/fonts\/rajdhani-600\.[a-f0-9]{12}\.woff2$/],
  ['Rajdhani 700', /^assets\/fonts\/rajdhani-700\.[a-f0-9]{12}\.woff2$/],
];

async function filesBelow(directory, prefix = '') {
  const directoryEntries = await readdir(directory, { withFileTypes: true });
  const output = [];
  for (const entry of directoryEntries.sort((a, b) => a.name.localeCompare(b.name))) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      output.push(...await filesBelow(path.join(directory, entry.name), relative));
    } else if (entry.isFile()) {
      output.push(relative);
    } else {
      throw new Error(`Unsupported StoryForge release filesystem entry: ${relative}.`);
    }
  }
  return output;
}

function phpString(value) {
  return `'${String(value).replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;
}

function cacheClass(relative) {
  if (relative === 'index.html') return 'html';
  if (/^assets\/(?:[^/]+\/)*[^/]+\.[a-f0-9]{12}\.(?:css|js|woff2)$/i.test(relative)) {
    return 'immutable';
  }
  return 'revalidate';
}

function replaceMarkedBlock(source, startMarker, endMarker, replacement) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker);
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`StoryForge route marker block is missing or invalid: ${startMarker}`);
  }
  return `${source.slice(0, start)}${replacement}${source.slice(end + endMarker.length)}`;
}

function base64Expression(bytes, indent) {
  const encoded = bytes.toString('base64');
  const chunks = encoded.match(/.{1,120}/g) || [''];
  return chunks
    .map((chunk, index) => `${indent}${index === 0 ? '' : '. '}${phpString(chunk)}`)
    .join('\n');
}

const files = await filesBelow(distDir);
if (files.length !== approvedTopology.length) {
  throw new Error(`Expected the approved 14-file StoryForge release, found ${files.length}.`);
}
for (const [label, pattern] of approvedTopology) {
  const matches = files.filter((relative) => pattern.test(relative));
  if (matches.length !== 1) {
    throw new Error(`Expected exactly one approved ${label} file, found ${matches.length}.`);
  }
}
for (const relative of files) {
  const matches = approvedTopology.filter(([, pattern]) => pattern.test(relative));
  if (matches.length !== 1) {
    throw new Error(`Unexpected StoryForge release path: ${relative}.`);
  }
}

const entries = [];
for (const relative of files) {
  const absolute = path.join(distDir, relative);
  const extension = path.extname(relative).toLowerCase();
  const type = mimeTypes.get(extension);
  if (!type) throw new Error(`No approved MIME type for ${relative}.`);
  const bytes = await readFile(absolute);
  const details = await stat(absolute);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const fingerprint = relative.match(/\.([a-f0-9]{12})\.(?:css|js|woff2)$/i)?.[1]?.toLowerCase();
  if (fingerprint && fingerprint !== sha256.slice(0, 12)) {
    throw new Error(`Fingerprint does not match content for ${relative}.`);
  }
  entries.push({
    path: relative,
    alias: sha256.slice(0, 12),
    sha256,
    size: details.size,
    type,
    cache: cacheClass(relative),
    bytes,
  });
}

const aliases = new Set(entries.map((entry) => entry.alias));
if (aliases.size !== entries.length) {
  throw new Error('The approved StoryForge release contains a 12-character SHA alias collision.');
}

const entryFor = (pattern, label) => {
  const matches = entries.filter((entry) => pattern.test(entry.path));
  if (matches.length !== 1) {
    throw new Error(`Expected exactly one ${label} release entry.`);
  }
  return matches[0];
};
const indexEntry = entryFor(/^index\.html$/, 'index');
const appEntry = entryFor(/^assets\/app\./, 'app');
const authEntry = entryFor(/^assets\/auth\./, 'auth');
const stylesEntry = entryFor(/^assets\/styles\./, 'stylesheet');
const fontEntries = entries.filter((entry) => entry.path.endsWith('.woff2'));
const indexText = indexEntry.bytes.toString('utf8');
const appText = appEntry.bytes.toString('utf8');
const stylesText = stylesEntry.bytes.toString('utf8');
if (
  !indexText.includes(`href="./_asset/${stylesEntry.alias}"`)
  || !indexText.includes(`src="./_asset/${appEntry.alias}"`)
  || indexText.includes('./assets/')
) {
  throw new Error('Built StoryForge HTML does not use only the approved extensionless asset aliases.');
}
if (
  !appText.includes(`from './${authEntry.alias}'`)
  || /from ['"].*auth\.[a-f0-9]{12}\.js['"]/.test(appText)
) {
  throw new Error('Built StoryForge app module does not use the approved extensionless auth alias.');
}
for (const fontEntry of fontEntries) {
  if (!stylesText.includes(`url("./${fontEntry.alias}")`)) {
    throw new Error(`Built StoryForge stylesheet does not use the alias for ${fontEntry.path}.`);
  }
}
if (stylesText.includes('./fonts/')) {
  throw new Error('Built StoryForge stylesheet still contains an extension-bearing font URL.');
}

const releaseDescriptor = entries.map((entry) => ({
  path: entry.path,
  alias: entry.alias,
  sha256: entry.sha256,
  size: entry.size,
  type: entry.type,
  cache: entry.cache,
}));
const releaseDigest = createHash('sha256')
  .update(JSON.stringify(releaseDescriptor))
  .digest('hex');
const releaseId = `v-${releaseDigest.slice(0, 16)}`;

const manifestLines = [manifestStartMarker];
for (const entry of entries) {
  manifestLines.push(`\t\t${phpString(entry.path)} => array(`);
  manifestLines.push(`\t\t\t'alias' => ${phpString(entry.alias)},`);
  manifestLines.push(`\t\t\t'sha256' => ${phpString(entry.sha256)},`);
  manifestLines.push(`\t\t\t'size' => ${entry.size},`);
  manifestLines.push(`\t\t\t'type' => ${phpString(entry.type)},`);
  manifestLines.push(`\t\t\t'cache' => ${phpString(entry.cache)},`);
  manifestLines.push('\t\t),');
}
manifestLines.push(manifestEndMarker);

const bundleLines = [
  '<?php',
  '/**',
  ' * Generated StoryForge V5 execution-private release bundle.',
  ' *',
  ' * This nested file is not a WordPress MU-plugin entrypoint.',
  ' */',
  '',
  "if ( ! defined( 'ABSPATH' ) ) {",
  '\tif ( ! headers_sent() ) {',
  '\t\thttp_response_code( 404 );',
  "\t\theader( 'Cache-Control: no-store, private', true );",
  "\t\theader( 'Pragma: no-cache', true );",
  "\t\theader( 'X-Content-Type-Options: nosniff', true );",
  "\t\theader( 'X-Robots-Tag: noindex, nofollow, noarchive', true );",
  "\t\theader( 'Content-Length: 0', true );",
  '\t}',
  '\texit;',
  '}',
  '',
  'return array(',
  `\t'release_id' => ${phpString(releaseId)},`,
  "\t'assets' => array(",
];
for (const entry of entries) {
  bundleLines.push(`\t\t${phpString(entry.alias)} => array(`);
  bundleLines.push(`\t\t\t'path' => ${phpString(entry.path)},`);
  bundleLines.push(`\t\t\t'alias' => ${phpString(entry.alias)},`);
  bundleLines.push(`\t\t\t'sha256' => ${phpString(entry.sha256)},`);
  bundleLines.push(`\t\t\t'size' => ${entry.size},`);
  bundleLines.push(`\t\t\t'type' => ${phpString(entry.type)},`);
  bundleLines.push(`\t\t\t'cache' => ${phpString(entry.cache)},`);
  bundleLines.push("\t\t\t'bytes_base64' =>");
  bundleLines.push(`${base64Expression(entry.bytes, '\t\t\t\t')},`);
  bundleLines.push('\t\t),');
}
bundleLines.push('\t),');
bundleLines.push(');');
bundleLines.push('');
const bundleSource = bundleLines.join('\n');
const releasePhpBytes = Buffer.from(bundleSource);
const releasePhpSha256 = createHash('sha256').update(releasePhpBytes).digest('hex');
const edgeAliasManifest = Object.fromEntries(
  entries
    .filter((entry) => entry.path !== 'index.html')
    .map((entry) => [
      entry.alias,
      {
        path: entry.path,
        sha256: entry.sha256,
        size: entry.size,
        type: entry.type,
        cache: entry.cache,
      },
    ]),
);
const edgeAliasSource = [
  '// Generated by scripts/build-wordpress-route-manifest.mjs. Do not edit.',
  `export default Object.freeze(${JSON.stringify(edgeAliasManifest, null, 2)});`,
  '',
].join('\n');
const releaseLines = [
  releaseStartMarker,
  `define( 'MMSFR_RELEASE_ID', ${phpString(releaseId)} );`,
  `define( 'MMSFR_RELEASE_PHP_SHA256', ${phpString(releasePhpSha256)} );`,
  `define( 'MMSFR_RELEASE_PHP_SIZE', ${releasePhpBytes.length} );`,
  releaseEndMarker,
];

const source = await readFile(routeFile, 'utf8');
const withRelease = replaceMarkedBlock(
  source,
  releaseStartMarker,
  releaseEndMarker,
  releaseLines.join('\n'),
);
const next = replaceMarkedBlock(
  withRelease,
  manifestStartMarker,
  manifestEndMarker,
  manifestLines.join('\n'),
);
const bundleFile = path.join(runtimeRoot, 'release.php');

if (checkOnly) {
  if (next !== source) {
    throw new Error('StoryForge WordPress route manifest is stale; run npm run build:release.');
  }
  let releaseEntries;
  try {
    releaseEntries = await readdir(runtimeRoot, { withFileTypes: true });
  } catch {
    throw new Error('StoryForge WordPress release bundle is missing; run npm run build:release.');
  }
  if (
    releaseEntries.length !== 1
    || !releaseEntries[0].isFile()
    || releaseEntries[0].name !== 'release.php'
  ) {
    throw new Error('StoryForge WordPress release source is stale; run npm run build:release.');
  }
  let existingBundle;
  try {
    existingBundle = await readFile(bundleFile, 'utf8');
  } catch {
    throw new Error('StoryForge WordPress release bundle is incomplete; run npm run build:release.');
  }
  if (existingBundle !== bundleSource) {
    throw new Error('StoryForge WordPress release bundle bytes are stale; run npm run build:release.');
  }
  let existingEdgeAliases;
  try {
    existingEdgeAliases = await readFile(edgeAliasFile, 'utf8');
  } catch {
    throw new Error('StoryForge edge alias manifest is missing; run npm run build:release.');
  }
  if (existingEdgeAliases !== edgeAliasSource) {
    throw new Error('StoryForge edge alias manifest is stale; run npm run build:release.');
  }
  const completedReleaseProof = assertReleaseSource({
    startDirectory: packageDir,
    forbiddenIgnoredPaths: guardedReleasePaths,
  });
  console.log(
    `StoryForge WordPress route and ${releaseId} release.php match commit `
      + `${completedReleaseProof.expectedCommit}'s approved 14-file release.`,
  );
} else {
  await rm(runtimeRoot, { recursive: true, force: true });
  await mkdir(runtimeRoot, { recursive: true });
  await writeFile(bundleFile, bundleSource);
  await writeFile(edgeAliasFile, edgeAliasSource);
  await writeFile(routeFile, next);
  const completedReleaseProof = assertReleaseSource({
    startDirectory: packageDir,
    allowedDirtyPaths: [
      distDir,
      routeFile,
      runtimeRoot,
      edgeAliasFile,
    ],
    forbiddenIgnoredPaths: guardedReleasePaths,
  });
  const sourceLabel = completedReleaseProof.clean
    ? ` from clean commit ${releaseProof.expectedCommit}`
    : '';
  console.log(
    `StoryForge WordPress route and ${releaseId} release.php generated as a candidate`
      + `${sourceLabel}; terminal clean provenance verification is still required.`,
  );
}
