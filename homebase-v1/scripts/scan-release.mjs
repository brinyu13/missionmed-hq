import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(packageDir, 'dist');
const findings = [];
const patterns = [
  ['service role marker', /service[_-]?role/gi],
  ['JWT signing secret name', /HOMEBASE_(?:DEV_)?JWT_SECRET/g],
  ['provider service key name', /SUPABASE_SERVICE_ROLE_KEY/g],
  ['private key block', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
  ['secret-shaped API key', /\bsk-[A-Za-z0-9_-]{20,}\b/g],
];

async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await walk(filePath);
      continue;
    }
    const source = await readFile(filePath, 'utf8');
    for (const [label, pattern] of patterns) {
      pattern.lastIndex = 0;
      if (pattern.test(source)) findings.push({ file: path.relative(packageDir, filePath), label });
    }
  }
}

await walk(distDir);
if (findings.length) {
  console.error(JSON.stringify({ ok: false, findings }, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({ ok: true, scanned: path.relative(packageDir, distDir) }));
}
