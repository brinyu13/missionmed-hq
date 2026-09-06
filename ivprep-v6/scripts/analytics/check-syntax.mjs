import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const roots = [
  'analytics',
  'public/analytics',
  'public/live-analytics',
  'scripts/3521',
  'scripts/analytics',
  'public/questions',
  'scripts/questions',
];
const files = [];
for (const root of roots) {
  for (const name of await readdir(root)) if (name.endsWith('.mjs')) files.push(join(root, name));
}
for (const file of files.sort()) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout);
    process.exit(result.status || 1);
  }
}
process.stdout.write(`Analytics syntax PASS · ${files.length} modules\n`);
