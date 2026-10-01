import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { releaseManifest, requiredRuntime, privateExamples } from '../../scripts/check-release-artifact.mjs';

const sourceRoot = new URL('../../../', import.meta.url);
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'ivoc-release-test-'));
  spawnSync('git', ['init', '-q', root]);
  for (const name of ['.gitignore', '.railwayignore']) writeFileSync(join(root, name), readFileSync(new URL(name, sourceRoot)));
  for (const p of [...requiredRuntime, ...privateExamples, 'wp-content/mu-plugins/shared-source.php', 'untracked-local.mjs']) {
    mkdirSync(dirname(join(root, p)), { recursive: true });
    writeFileSync(join(root, p), '// synthetic fixture, no credentials\n');
  }
  // Deliberately tracked private-looking fixtures must still not enter a release.
  spawnSync('git', ['-C', root, 'add', '-f', '--', '.gitignore', '.railwayignore', ...requiredRuntime, ...privateExamples, 'wp-content/mu-plugins/shared-source.php']);
  return root;
}
test('release includes exact required runtime and excludes private/untracked inputs', () => {
  const root = fixture();
  try {
    const files = releaseManifest(root);
    for (const p of requiredRuntime) assert.ok(files.includes(p));
    for (const p of privateExamples) assert.ok(!files.includes(p));
    assert.ok(!files.includes('untracked-local.mjs'));
    assert.ok(files.includes('wp-content/mu-plugins/shared-source.php'));
  } finally { rmSync(root, { recursive: true, force: true }); }
});
test('reintroduced token filter fails before upload', () => {
  const root = fixture();
  try {
    writeFileSync(join(root, '.gitignore'), `${readFileSync(join(root, '.gitignore'), 'utf8')}\n*token*\n`);
    assert.throws(() => releaseManifest(root), /RELEASE_REQUIRED_MISSING/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
test('private-file unignore fails closed', () => {
  const root = fixture();
  try {
    writeFileSync(join(root, '.railwayignore'), `${readFileSync(join(root, '.railwayignore'), 'utf8')}\n!credentials.json\n`);
    assert.throws(() => releaseManifest(root), /RELEASE_PRIVATE_EXCLUSION_FAILED/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
