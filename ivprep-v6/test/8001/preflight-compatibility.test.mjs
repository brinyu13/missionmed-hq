import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const guard = fileURLToPath(new URL('../../../_SYSTEM/scripts/mm-preflight.sh', import.meta.url));
function fixture(run) {
  const root = mkdtempSync(join(tmpdir(), 'ivoc-preflight-regression-'));
  const git = (...args) => {
    const result = spawnSync('git', args, { cwd: root, encoding: 'utf8', env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' } });
    assert.equal(result.status, 0, result.stderr);
  };
  const put = (path, text = 'fixture\n') => { mkdirSync(join(root, path, '..'), { recursive: true }); writeFileSync(join(root, path), text); };
  try {
    git('init', '-q'); git('checkout', '-qb', 'codex/preflight-fixture');
    put('ordinary.txt'); put('missionmed-hq/server.mjs');
    git('add', '.'); git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'core.hooksPath=/dev/null', 'commit', '-qm', 'fixture');
    const check = scope => spawnSync('/bin/bash', [guard, '--intent', 'edit', '--edit-scope', scope], {
      cwd: root, encoding: 'utf8', env: { ...process.env, PROTECTED_MAIN_ROOT: root },
    });
    run({ put, check });
  } finally { rmSync(root, { recursive: true, force: true }); }
}
for (const mode of ['clean', 'tracked-only', 'untracked-only', 'mixed']) {
  test(`actual Bash guard handles ${mode} without losing non-overlap checks`, () => fixture(({ put, check }) => {
    if (mode === 'tracked-only' || mode === 'mixed') put('ordinary.txt', 'changed\n');
    if (mode === 'untracked-only' || mode === 'mixed') put('unrelated-note.md');
    const result = check('ivprep-v6/public/capabilities/interview-progression.mjs');
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.doesNotMatch(result.stderr, /unbound variable/);
    assert.match(result.stdout, mode === 'clean' ? /Repo is currently clean/ : /No dirty-file overlap detected/);
  }));
}
test('actual Bash guard preserves ordinary dirty overlap warning', () => fixture(({ put, check }) => {
  put('ordinary.txt', 'changed\n');
  const result = check('ordinary.txt');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Dirty overlap detected/);
}));
for (const mode of ['tracked', 'untracked']) {
  test(`actual Bash guard still rejects ${mode} sensitive dirty overlap`, () => fixture(({ put, check }) => {
    const path = mode === 'tracked' ? 'missionmed-hq/server.mjs' : 'LIVE/fixture.mjs';
    put(path, 'changed\n');
    const result = check(mode === 'tracked' ? 'missionmed-hq' : 'LIVE');
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stdout, /Sensitive dirty overlap/);
    assert.match(result.stdout, /Preflight result: FAIL/);
    assert.doesNotMatch(result.stderr, /unbound variable/);
  }));
}
