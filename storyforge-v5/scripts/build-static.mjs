import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  assertReleaseSource,
  parseBuildMode,
} from './release-source.mjs';

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(packageDir, 'public');
const guardedReleasePaths = [publicDir, path.join(packageDir, 'dist')];
const mode = parseBuildMode(process.argv.slice(2), { defaultMode: 'development' });
const releaseProof = mode === 'release'
  ? assertReleaseSource({
    startDirectory: packageDir,
    forbiddenIgnoredPaths: guardedReleasePaths,
  })
  : null;
const distDir = mode === 'release'
  ? path.join(packageDir, 'dist')
  : path.join(packageDir, '.local', 'development-dist');
const assetsDir = path.join(distDir, 'assets');
const fontsDir = path.join(publicDir, 'fonts');
const developmentMarker = Buffer.from(`${JSON.stringify({
  mode: 'development',
  deployable: false,
  warning: 'StoryForge development output is not a release artifact.',
}, null, 2)}\n`);

function digest(value) {
  return createHash('sha256').update(value).digest('hex').slice(0, 12);
}

function replaceExactlyOnce(source, needle, replacement, label) {
  const pieces = source.split(needle);
  if (pieces.length !== 2) {
    throw new Error(`Expected exactly one ${label} reference in the StoryForge source.`);
  }
  return `${pieces[0]}${replacement}${pieces[1]}`;
}

const [sourceHtml, sourceApp, sourceAuth, sourceStyles] = await Promise.all([
  readFile(path.join(publicDir, 'index.html'), 'utf8'),
  readFile(path.join(publicDir, 'app.js'), 'utf8'),
  readFile(path.join(publicDir, 'auth.js'), 'utf8'),
  readFile(path.join(publicDir, 'styles.css'), 'utf8'),
]);
const fontNames = (await readdir(fontsDir)).sort();
const fontAliases = new Map();
for (const fontName of fontNames.filter((name) => name.endsWith('.woff2'))) {
  const fingerprint = fontName.match(/\.([a-f0-9]{12})\.woff2$/i)?.[1];
  if (!fingerprint) {
    throw new Error(`Self-hosted font is missing a 12-character content fingerprint: ${fontName}`);
  }
  const font = await readFile(path.join(fontsDir, fontName));
  if (digest(font) !== fingerprint.toLowerCase()) {
    throw new Error(`Self-hosted font fingerprint does not match its content: ${fontName}`);
  }
  fontAliases.set(fontName, fingerprint.toLowerCase());
}

const authName = `auth.${digest(sourceAuth)}.js`;
const authAlias = digest(sourceAuth);
const rewrittenApp = replaceExactlyOnce(
  sourceApp,
  "from './auth.js'",
  `from './${authAlias}'`,
  'auth module',
);
const appName = `app.${digest(rewrittenApp)}.js`;
let rewrittenStyles = sourceStyles;
for (const [fontName, alias] of fontAliases) {
  rewrittenStyles = replaceExactlyOnce(
    rewrittenStyles,
    `./fonts/${fontName}`,
    `./${alias}`,
    `${fontName} font`,
  );
}
const stylesName = `styles.${digest(rewrittenStyles)}.css`;
const head = mode === 'release'
  ? '<head>\n  <base href="/storyforge/">'
  : [
    '<head>',
    '  <base href="/">',
    '  <meta name="storyforge-build-mode" content="development-only">',
  ].join('\n');
const html = replaceExactlyOnce(
  replaceExactlyOnce(
    replaceExactlyOnce(
      sourceHtml,
      '<head>',
      head,
      'document head',
    ),
    'href="./styles.css"',
    `href="./_asset/${digest(rewrittenStyles)}"`,
    'stylesheet',
  ),
  'src="./app.js"',
  `src="./_asset/${digest(rewrittenApp)}"`,
  'application module',
);

await rm(distDir, { recursive: true, force: true });
await mkdir(assetsDir, { recursive: true });
const writes = [
  writeFile(path.join(distDir, 'index.html'), html),
  writeFile(path.join(assetsDir, appName), rewrittenApp),
  writeFile(path.join(assetsDir, authName), sourceAuth),
  writeFile(path.join(assetsDir, stylesName), rewrittenStyles),
  cp(fontsDir, path.join(assetsDir, 'fonts'), { recursive: true }),
];
if (mode === 'development') {
  writes.push(writeFile(path.join(distDir, 'DEVELOPMENT_ONLY.json'), developmentMarker));
}
await Promise.all(writes);
const completedReleaseProof = mode === 'release'
  ? assertReleaseSource({
    startDirectory: packageDir,
    allowedDirtyPaths: [distDir],
    forbiddenIgnoredPaths: guardedReleasePaths,
  })
  : null;

console.log(JSON.stringify({
  mode,
  deployable: false,
  releaseCandidate: mode === 'release',
  expectedCommit: releaseProof?.expectedCommit || null,
  cleanAfterBuild: completedReleaseProof?.clean ?? null,
  warning: mode === 'release'
    ? 'Release candidate bytes require the terminal clean provenance check.'
    : 'Development-only output cannot be used as a StoryForge release.',
  outputDirectory: path.relative(packageDir, distDir),
  basePath: mode === 'release' ? '/storyforge/' : '/',
  index: 'index.html',
  assets: [
    appName,
    authName,
    stylesName,
    ...fontNames.map((name) => `fonts/${name}`),
  ],
  aliases: {
    app: digest(rewrittenApp),
    auth: authAlias,
    styles: digest(rewrittenStyles),
    fonts: Object.fromEntries(fontAliases),
  },
}, null, 2));
