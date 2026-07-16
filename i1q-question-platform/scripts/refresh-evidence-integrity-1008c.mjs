import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const WORKTREE = dirname(APP_ROOT);
const EVIDENCE_ROOT = join(APP_ROOT, 'evidence');

function digest(value) {
  return createHash('sha256').update(value).digest('hex');
}

async function walkFiles(root, excludedDirectory) {
  const files = [];
  async function visit(current) {
    const entries = await readdir(current, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name, 'en'));
    for (const entry of entries) {
      const path = join(current, entry.name);
      if (entry.isDirectory() && path === excludedDirectory) continue;
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile()) files.push(path);
    }
  }
  await visit(root);
  return files;
}

async function main() {
  const testFiles = (await readdir(join(APP_ROOT, 'tests')))
    .filter((name) => name.endsWith('.test.mjs'))
    .sort((left, right) => left.localeCompare(right, 'en'))
    .map((name) => `tests/${name}`);
  const run = spawnSync(process.execPath, ['--test', ...testFiles], {
    cwd: APP_ROOT,
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1' },
  });
  const output = `${run.stdout || ''}\n${run.stderr || ''}`;
  const passMatch = output.match(/^ℹ pass (\d+)$/mu);
  const failMatch = output.match(/^ℹ fail (\d+)$/mu);
  const passed = passMatch ? Number(passMatch[1]) : 0;
  const failed = failMatch ? Number(failMatch[1]) : 1;
  if (run.status !== 0 || failed !== 0 || passed === 0) {
    process.stderr.write(output);
    throw new Error(`test_refresh_failed:exit_${run.status}:fail_${failed}:pass_${passed}`);
  }

  const generatedAt = new Date().toISOString();
  await writeFile(join(EVIDENCE_ROOT, 'test_results.json'), `${JSON.stringify({
    generated_at: generatedAt,
    status: 'pass',
    exit_code: 0,
    test_files: testFiles,
    passed_assertions: passed,
    failed_assertions: failed,
    output_sha256: digest(output),
  }, null, 2)}\n`, 'utf8');

  const artifactFiles = await walkFiles(APP_ROOT, EVIDENCE_ROOT);
  const artifacts = [];
  for (const path of artifactFiles) {
    const info = await stat(path);
    const bytes = await readFile(path);
    artifacts.push({
      path: relative(WORKTREE, path),
      bytes: info.size,
      sha256: digest(bytes),
    });
  }
  await writeFile(join(EVIDENCE_ROOT, 'artifact_checksums.json'), `${JSON.stringify({
    generated_at: generatedAt,
    status: 'pass',
    artifact_count: artifacts.length,
    artifacts,
  }, null, 2)}\n`, 'utf8');

  console.log(JSON.stringify({
    status: 'pass',
    tests_passed: passed,
    tests_failed: failed,
    test_files: testFiles.length,
    checksummed_artifacts: artifacts.length,
  }));
}

await main();
