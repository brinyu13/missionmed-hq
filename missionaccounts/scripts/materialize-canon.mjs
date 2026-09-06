import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(here, '..');
const defaultSource = '/Users/brianb/MissionMed/_PROTOTYPES/MISSIONACCOUNTS/MX-MISSIONACCOUNTS-5300A/MX-MISSIONACCOUNTS-5300A_CANON_StoryForge_Prototype.html';
const source = process.env.MISSIONACCOUNTS_CANON_PATH || defaultSource;
const expected = '3cd77871f4cb1bc70d71a87d2fa9fe0f85604969e4cbe94d44aa9816386a82d8';
const bytes = await readFile(source);
const actual = createHash('sha256').update(bytes).digest('hex');
if (actual !== expected) throw new Error(`5300A canon hash mismatch: expected ${expected}, got ${actual}`);

const runtimeTag = '\n<script type="module" src="/missionaccounts-runtime.js"></script>\n';
const html = bytes.toString('utf8').replace('</body>', `${runtimeTag}</body>`);
await mkdir(path.join(appRoot, 'public'), { recursive: true });
await writeFile(path.join(appRoot, 'public', 'index.html'), html);
await writeFile(path.join(appRoot, 'public', 'canon-manifest.json'), JSON.stringify({
  ticket: 'MX-MISSIONACCOUNTS-5301P',
  source,
  source_sha256: actual,
  generated_at: new Date().toISOString(),
}, null, 2) + '\n');
console.log(`Materialized Founder canon ${actual} (${bytes.byteLength} bytes)`);
