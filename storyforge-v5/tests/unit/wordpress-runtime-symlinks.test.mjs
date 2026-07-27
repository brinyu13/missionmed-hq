import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  copyFile,
  mkdir,
  mkdtemp,
  readlink,
  realpath,
  rename,
  rm,
  symlink,
  unlink,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const packageDir = fileURLToPath(new URL('../..', import.meta.url));
const productCommit = '0123456789abcdef0123456789abcdef01234567';
const alternateCommit = '89abcdef0123456789abcdef0123456789abcdef';

function probe(routeFile, probeFile) {
  const result = spawnSync(process.env.STORYFORGE_TEST_PHP || 'php', [probeFile, routeFile], {
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

test('WordPress runtime rejects every symlinked release hop and recovers after exact restoration', async (context) => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'storyforge-runtime-symlinks.'));
  context.after(async () => {
    await rm(temporary, { recursive: true, force: true });
  });

  const routeFile = path.join(temporary, 'missionmed-storyforge-route.php');
  const runtimeRoot = path.join(temporary, 'missionmed-storyforge-runtime');
  const releasesPath = path.join(runtimeRoot, 'releases');
  const selectedPath = path.join(releasesPath, productCommit);
  const currentLink = path.join(runtimeRoot, 'current');
  const probeFile = path.join(temporary, 'probe.php');
  await mkdir(selectedPath, { recursive: true });
  await Promise.all([
    copyFile(
      path.join(packageDir, 'infra', 'wordpress', 'missionmed-storyforge-route.php'),
      routeFile,
    ),
    copyFile(
      path.join(packageDir, 'infra', 'wordpress', 'missionmed-storyforge-runtime', 'release.php'),
      path.join(selectedPath, 'release.php'),
    ),
    writeFile(
      probeFile,
      [
        '<?php',
        "define( 'ABSPATH', __DIR__ );",
        'function add_action() {}',
        'require $argv[1];',
        "echo null === mmsfr_release_bundle() ? 'FAIL_CLOSED' : 'OK';",
        '',
      ].join('\n'),
    ),
  ]);
  await symlink(`releases/${productCommit}`, currentLink);
  assert.equal(await readlink(currentLink), `releases/${productCommit}`);
  assert.equal(probe(routeFile, probeFile), 'OK');

  const releasesReal = path.join(runtimeRoot, 'releases-real');
  await rename(releasesPath, releasesReal);
  await symlink('releases-real', releasesPath);
  assert.equal(probe(routeFile, probeFile), 'FAIL_CLOSED');
  await unlink(releasesPath);
  await rename(releasesReal, releasesPath);
  assert.equal(probe(routeFile, probeFile), 'OK');

  const selectedReal = path.join(releasesPath, alternateCommit);
  await rename(selectedPath, selectedReal);
  await symlink(alternateCommit, selectedPath);
  assert.equal(await realpath(selectedPath), await realpath(selectedReal));
  assert.equal(probe(routeFile, probeFile), 'FAIL_CLOSED');
  await unlink(selectedPath);
  await rename(selectedReal, selectedPath);
  assert.equal(probe(routeFile, probeFile), 'OK');

  await unlink(currentLink);
  await symlink(`releases/../releases/${productCommit}`, currentLink);
  assert.equal(probe(routeFile, probeFile), 'FAIL_CLOSED');
  await unlink(currentLink);
  await symlink(`releases/${productCommit}`, currentLink);
  assert.equal(probe(routeFile, probeFile), 'OK');

  const runtimeReal = path.join(temporary, 'runtime-real');
  await rename(runtimeRoot, runtimeReal);
  await symlink('runtime-real', runtimeRoot);
  assert.equal(probe(routeFile, probeFile), 'FAIL_CLOSED');
  await unlink(runtimeRoot);
  await rename(runtimeReal, runtimeRoot);
  assert.equal(probe(routeFile, probeFile), 'OK');
});
