import { createHash } from 'node:crypto';
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDir = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const distDir = path.join(packageDir, 'dist');
const routeFile = path.join(packageDir, 'infra', 'wordpress', 'missionmed-storyforge-route.php');
const checkOnly = process.argv.includes('--check');
const startMarker = '\t\t// BEGIN GENERATED STORYFORGE ASSET MANIFEST.';
const endMarker = '\t\t// END GENERATED STORYFORGE ASSET MANIFEST.';

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
  const entries = await readdir(directory, { withFileTypes: true });
  const output = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      output.push(...await filesBelow(path.join(directory, entry.name), relative));
    } else if (entry.isFile()) {
      output.push(relative);
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

const lines = [startMarker];
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
  lines.push(`\t\t${phpString(relative)} => array(`);
  lines.push(`\t\t\t'sha256' => ${phpString(sha256)},`);
  lines.push(`\t\t\t'size' => ${details.size},`);
  lines.push(`\t\t\t'type' => ${phpString(type)},`);
  lines.push(`\t\t\t'cache' => ${phpString(cacheClass(relative))},`);
  lines.push('\t\t),');
}
lines.push(endMarker);

const source = await readFile(routeFile, 'utf8');
const start = source.indexOf(startMarker);
const end = source.indexOf(endMarker);
if (start === -1 || end === -1 || end < start) {
  throw new Error('StoryForge route manifest markers are missing or invalid.');
}
const next = `${source.slice(0, start)}${lines.join('\n')}${source.slice(end + endMarker.length)}`;

if (checkOnly) {
  if (next !== source) {
    throw new Error('StoryForge WordPress route manifest is stale; run npm run build.');
  }
  console.log('StoryForge WordPress route manifest matches the approved 14-file release.');
} else {
  await writeFile(routeFile, next);
  console.log('StoryForge WordPress route manifest updated from the approved 14-file release.');
}
