import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, rm, symlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const packageDir = fileURLToPath(new URL('../..', import.meta.url));

test('WordPress release generation rejects symlinks outside the approved regular-file topology', async (context) => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'storyforge-build-security.'));
  context.after(async () => {
    await rm(temporary, { recursive: true, force: true });
  });

  await Promise.all([
    mkdir(path.join(temporary, 'scripts'), { recursive: true }),
    mkdir(path.join(temporary, 'infra', 'wordpress'), { recursive: true }),
    mkdir(path.join(temporary, 'infra', 'edge'), { recursive: true }),
    cp(path.join(packageDir, 'dist'), path.join(temporary, 'dist'), { recursive: true }),
  ]);
  await Promise.all([
    cp(
      path.join(packageDir, 'scripts', 'build-wordpress-route-manifest.mjs'),
      path.join(temporary, 'scripts', 'build-wordpress-route-manifest.mjs'),
    ),
    cp(
      path.join(packageDir, 'infra', 'wordpress', 'missionmed-storyforge-route.php'),
      path.join(temporary, 'infra', 'wordpress', 'missionmed-storyforge-route.php'),
    ),
  ]);
  await symlink(
    process.execPath,
    path.join(temporary, 'dist', 'assets', 'unexpected-runtime-link'),
  );

  const result = spawnSync(
    process.execPath,
    [path.join(temporary, 'scripts', 'build-wordpress-route-manifest.mjs')],
    { encoding: 'utf8' },
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unsupported StoryForge release filesystem entry/);
});
