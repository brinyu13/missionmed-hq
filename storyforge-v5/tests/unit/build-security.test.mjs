import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const packageDir = fileURLToPath(new URL('../..', import.meta.url));

function git(directory, args) {
  const result = spawnSync('git', ['-C', directory, ...args], { encoding: 'utf8' });
  assert.equal(
    result.status,
    0,
    String(result.stderr || result.stdout || '').trim(),
  );
  return String(result.stdout || '').trim();
}

test('WordPress release generation rejects symlinks outside the approved regular-file topology', async (context) => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'storyforge-build-security.'));
  const fixturePackage = path.join(temporary, 'storyforge-v5');
  context.after(async () => {
    await rm(temporary, { recursive: true, force: true });
  });

  await Promise.all([
    mkdir(path.join(fixturePackage, 'scripts'), { recursive: true }),
    mkdir(path.join(fixturePackage, 'infra', 'wordpress'), { recursive: true }),
    mkdir(path.join(fixturePackage, 'infra', 'edge'), { recursive: true }),
    mkdir(path.join(fixturePackage, 'infra', 'postgres', 'migrations'), {
      recursive: true,
    }),
    cp(path.join(packageDir, 'dist'), path.join(fixturePackage, 'dist'), { recursive: true }),
  ]);
  const fixtureM1 = path.join(
    fixturePackage,
    'infra',
    'postgres',
    'migrations',
    '20260729000100_b1_506_voice_recording_sessions.sql',
  );
  await Promise.all([
    cp(
      path.join(packageDir, 'scripts', 'build-wordpress-route-manifest.mjs'),
      path.join(fixturePackage, 'scripts', 'build-wordpress-route-manifest.mjs'),
    ),
    cp(
      path.join(packageDir, 'scripts', 'release-source.mjs'),
      path.join(fixturePackage, 'scripts', 'release-source.mjs'),
    ),
    cp(
      path.join(packageDir, 'scripts', 'phase-one-release-safety.mjs'),
      path.join(fixturePackage, 'scripts', 'phase-one-release-safety.mjs'),
    ),
    cp(
      path.join(
        packageDir,
        'infra',
        'postgres',
        'migrations',
        '20260729000100_b1_506_voice_recording_sessions.sql',
      ),
      fixtureM1,
    ),
    cp(
      path.join(packageDir, 'infra', 'wordpress', 'missionmed-storyforge-route.php'),
      path.join(fixturePackage, 'infra', 'wordpress', 'missionmed-storyforge-route.php'),
    ),
  ]);
  await writeFile(
    fixtureM1,
    (await readFile(fixtureM1, 'utf8')).replaceAll(
      'public.sf_has_live_identity()',
      "public.sf_has_live_identity(ARRAY['student'])",
    ),
  );
  await symlink(
    process.execPath,
    path.join(fixturePackage, 'dist', 'assets', 'unexpected-runtime-link'),
  );
  git(temporary, ['init', '--quiet']);
  git(temporary, ['config', 'user.email', 'storyforge-test@example.test']);
  git(temporary, ['config', 'user.name', 'StoryForge Test']);
  git(temporary, ['add', '--all']);
  git(temporary, ['commit', '--quiet', '-m', 'test release topology']);
  const expectedCommit = git(temporary, ['rev-parse', 'HEAD^{commit}']);

  const result = spawnSync(
    process.execPath,
    [
      path.join(fixturePackage, 'scripts', 'build-wordpress-route-manifest.mjs'),
      '--mode=release',
    ],
    {
      cwd: fixturePackage,
      encoding: 'utf8',
      env: {
        ...process.env,
        STORYFORGE_EXPECTED_COMMIT: expectedCommit,
      },
    },
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unsupported StoryForge release filesystem entry/);
});
