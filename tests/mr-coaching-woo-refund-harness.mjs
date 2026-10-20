import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Own disposable container only. No pulls, production credentials or public bind.
const name = 'fixture-mr-coaching-' + randomBytes(8).toString('hex');
const password = randomBytes(32).toString('hex');
const test = path.join(path.dirname(fileURLToPath(import.meta.url)), 'mr-coaching-woo-refund.spec.php');
const php = process.env.MM_TEST_PHP_BINARY || 'php';
let created = false;
function docker(args, env = process.env) { return spawnSync('docker', args, { encoding: 'utf8', env, timeout: 20000 }); }
try {
  const image = docker(['image', 'inspect', 'mariadb:11.4', '--format', '{{.Id}}']);
  if (image.status !== 0) throw new Error('cached MariaDB11.4 image unavailable');
  const run = docker(['run', '--detach', '--pull=never', '--memory=384m', '--memory-swap=384m', '--name', name, '--label', 'missionmed.private-fixture=MR-IR-COMMERCE-0001', '--env', 'MARIADB_ROOT_PASSWORD', '--env', 'MARIADB_ROOT_HOST=%', '--publish', '127.0.0.1::3306', 'mariadb:11.4', '--max-connections=100'], { ...process.env, MARIADB_ROOT_PASSWORD: password });
  if (run.status !== 0) throw new Error('isolated fixture container start failed');
  created = true;
  const published = docker(['port', name, '3306/tcp']);
  const address = published.stdout.trim();
  if (published.status !== 0 || !/^127\.0\.0\.1:[0-9]+$/.test(address)) throw new Error('fixture bind was not exclusive loopback');
  const env = { ...process.env, MM_TEST_DB_PORT: address.split(':')[1], MM_TEST_DB_PASSWORD: password };
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    const probe = spawnSync(php, [test, '--probe'], { env, encoding: 'utf8', timeout: 2000 });
    if (probe.status === 0) { ready = true; break; }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  if (!ready) throw new Error('isolated fixture database did not become ready');
  const result = spawnSync(php, [test], { env, encoding: 'utf8', timeout: 60000 });
  if (result.status !== 0) {
    // PHP emits only a fixed diagnostic or a controlled assertion label.
    const safe = result.stderr.trim();
    if (safe.startsWith('{') && !safe.includes(password)) process.stderr.write(safe + '\n');
    throw new Error('isolated synthetic allocator verification failed');
  }
  const report = JSON.parse(result.stdout);
  if (!report.ok) throw new Error('isolated fixture result invalid');
  console.log(JSON.stringify(report));
} catch (error) {
  console.error('FAIL: ' + (String(error.message).includes(password) ? 'redacted fixture failure' : error.message));
  process.exitCode = 1;
} finally {
  if (created) {
    const cleanup = docker(['rm', '--force', name]);
    if (cleanup.status !== 0) { console.error('Own fixture cleanup failed: ' + name); process.exitCode = 1; }
    else console.log('Own disposable fixture container removed; no other containers modified.');
  }
}
