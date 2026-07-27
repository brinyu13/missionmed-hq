import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(packageDir, 'public');
const distDir = path.join(packageDir, 'dist');
const assetsDir = path.join(distDir, 'assets');

function digest(value) {
  return createHash('sha256').update(value).digest('hex').slice(0, 12);
}

const [sourceHtml, sourceApp, sourceAuth, sourceStyles] = await Promise.all([
  readFile(path.join(publicDir, 'index.html'), 'utf8'),
  readFile(path.join(publicDir, 'app.js'), 'utf8'),
  readFile(path.join(publicDir, 'auth.js'), 'utf8'),
  readFile(path.join(publicDir, 'styles.css'), 'utf8'),
]);

const authName = `auth.${digest(sourceAuth)}.js`;
const rewrittenApp = sourceApp.replace("from './auth.js'", `from './${authName}'`);
const appName = `app.${digest(rewrittenApp)}.js`;
const stylesName = `styles.${digest(sourceStyles)}.css`;
const html = sourceHtml
  .replace('<head>', '<head>\n  <base href="/storyforge/">')
  .replace('href="./styles.css"', `href="./assets/${stylesName}"`)
  .replace('src="./app.js"', `src="./assets/${appName}"`);

await rm(distDir, { recursive: true, force: true });
await mkdir(assetsDir, { recursive: true });
await Promise.all([
  writeFile(path.join(distDir, 'index.html'), html),
  writeFile(path.join(assetsDir, appName), rewrittenApp),
  writeFile(path.join(assetsDir, authName), sourceAuth),
  writeFile(path.join(assetsDir, stylesName), sourceStyles),
]);

console.log(JSON.stringify({
  basePath: '/storyforge/',
  index: 'index.html',
  assets: [appName, authName, stylesName],
}, null, 2));
