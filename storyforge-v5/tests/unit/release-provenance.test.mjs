import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import {
  access,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const packageDir = fileURLToPath(new URL('../..', import.meta.url));
const repositoryDir = path.resolve(packageDir, '..');
const safeM1Fixture = `
CREATE POLICY sf_recording_sessions_rw ON public.sf_recording_sessions
FOR ALL TO authenticated
USING (public.sf_has_live_identity(ARRAY['student']) AND student_id = public.sf_actor_id())
WITH CHECK (public.sf_has_live_identity(ARRAY['student']) AND student_id = public.sf_actor_id());
CREATE POLICY sf_recording_segments_rw ON public.sf_recording_segments
FOR ALL TO authenticated
USING (public.sf_has_live_identity(ARRAY['student']) AND true)
WITH CHECK (public.sf_has_live_identity(ARRAY['student']) AND true);
REVOKE ALL ON public.sf_recording_sessions, public.sf_recording_segments FROM PUBLIC;
`;

async function writeSafeM1(fixturePackage) {
  const migrations = path.join(
    fixturePackage,
    'infra',
    'postgres',
    'migrations',
  );
  await mkdir(migrations, { recursive: true });
  await writeFile(
    path.join(
      migrations,
      '20260729000100_b1_506_voice_recording_sessions.sql',
    ),
    safeM1Fixture,
  );
}

function command(executable, args, {
  cwd,
  environment = {},
} = {}) {
  const env = { ...process.env };
  delete env.STORYFORGE_EXPECTED_COMMIT;
  Object.assign(env, environment);
  return spawnSync(executable, args, {
    cwd,
    env,
    encoding: 'utf8',
  });
}

function git(directory, args) {
  const result = command('git', ['-C', directory, ...args]);
  assert.equal(
    result.status,
    0,
    String(result.stderr || result.stdout || '').trim(),
  );
  return String(result.stdout || '').trim();
}

async function releaseFixture(context) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'storyforge-release-source.'));
  const fixturePackage = path.join(root, 'storyforge-v5');
  const scripts = path.join(fixturePackage, 'scripts');
  context.after(async () => {
    await rm(root, { recursive: true, force: true });
  });
  await mkdir(scripts, { recursive: true });
  await writeSafeM1(fixturePackage);
  await Promise.all([
    cp(
      path.join(packageDir, 'scripts', 'release-source.mjs'),
      path.join(scripts, 'release-source.mjs'),
    ),
    cp(
      path.join(packageDir, 'scripts', 'phase-one-release-safety.mjs'),
      path.join(scripts, 'phase-one-release-safety.mjs'),
    ),
    cp(
      path.join(packageDir, 'scripts', 'assert-release-source.mjs'),
      path.join(scripts, 'assert-release-source.mjs'),
    ),
    writeFile(path.join(root, 'README.md'), 'committed release fixture\n'),
  ]);
  git(root, ['init', '--quiet']);
  git(root, ['config', 'user.email', 'storyforge-test@example.test']);
  git(root, ['config', 'user.name', 'StoryForge Test']);
  git(root, ['add', '--all']);
  git(root, ['commit', '--quiet', '-m', 'committed release fixture']);
  return {
    root,
    fixturePackage,
    assertionScript: path.join(scripts, 'assert-release-source.mjs'),
    head: git(root, ['rev-parse', 'HEAD^{commit}']),
  };
}

test('release source assertion requires an exact clean committed source', async (context) => {
  const fixture = await releaseFixture(context);
  const args = [fixture.assertionScript, '--mode=release'];

  const missing = command(process.execPath, args, { cwd: fixture.fixturePackage });
  assert.notEqual(missing.status, 0);
  assert.match(missing.stderr, /STORYFORGE_EXPECTED_COMMIT must be an explicit full lowercase 40-character commit/);

  const abbreviated = command(process.execPath, args, {
    cwd: fixture.fixturePackage,
    environment: { STORYFORGE_EXPECTED_COMMIT: fixture.head.slice(0, 12) },
  });
  assert.notEqual(abbreviated.status, 0);
  assert.match(abbreviated.stderr, /full lowercase 40-character commit/);

  const mismatch = command(process.execPath, args, {
    cwd: fixture.fixturePackage,
    environment: { STORYFORGE_EXPECTED_COMMIT: '0'.repeat(40) },
  });
  assert.notEqual(mismatch.status, 0);
  assert.match(mismatch.stderr, /does not match STORYFORGE_EXPECTED_COMMIT/);

  const clean = command(process.execPath, args, {
    cwd: fixture.fixturePackage,
    environment: { STORYFORGE_EXPECTED_COMMIT: fixture.head },
  });
  assert.equal(clean.status, 0, clean.stderr);
  assert.deepEqual(JSON.parse(clean.stdout), {
    ok: true,
    mode: 'release',
    stage: 'source-preflight',
    releaseEligible: true,
    deployable: false,
    expectedCommit: fixture.head,
    head: fixture.head,
    clean: true,
  });

  git(fixture.root, ['update-index', '--assume-unchanged', 'README.md']);
  await writeFile(path.join(fixture.root, 'README.md'), 'hidden dirty bytes\n');
  const assumeUnchanged = command(process.execPath, args, {
    cwd: fixture.fixturePackage,
    environment: { STORYFORGE_EXPECTED_COMMIT: fixture.head },
  });
  assert.notEqual(assumeUnchanged.status, 0);
  assert.match(
    assumeUnchanged.stderr,
    /rejects assume-unchanged and skip-worktree index flags/,
  );
  git(fixture.root, ['update-index', '--no-assume-unchanged', 'README.md']);
  await writeFile(path.join(fixture.root, 'README.md'), 'committed release fixture\n');

  git(fixture.root, ['update-index', '--skip-worktree', 'README.md']);
  const skipWorktree = command(process.execPath, args, {
    cwd: fixture.fixturePackage,
    environment: { STORYFORGE_EXPECTED_COMMIT: fixture.head },
  });
  assert.notEqual(skipWorktree.status, 0);
  assert.match(
    skipWorktree.stderr,
    /rejects assume-unchanged and skip-worktree index flags/,
  );
  git(fixture.root, ['update-index', '--no-skip-worktree', 'README.md']);

  const alternateRoot = await mkdtemp(path.join(os.tmpdir(), 'storyforge-git-override.'));
  context.after(async () => {
    await rm(alternateRoot, { recursive: true, force: true });
  });
  await writeFile(path.join(alternateRoot, 'README.md'), 'unrelated repository\n');
  git(alternateRoot, ['init', '--quiet']);
  git(alternateRoot, ['config', 'user.email', 'storyforge-test@example.test']);
  git(alternateRoot, ['config', 'user.name', 'StoryForge Test']);
  git(alternateRoot, ['add', '--all']);
  git(alternateRoot, ['commit', '--quiet', '-m', 'unrelated clean repository']);
  const alternateHead = git(alternateRoot, ['rev-parse', 'HEAD^{commit}']);
  const redirected = command(process.execPath, args, {
    cwd: fixture.fixturePackage,
    environment: {
      STORYFORGE_EXPECTED_COMMIT: alternateHead,
      GIT_DIR: path.join(alternateRoot, '.git'),
      GIT_WORK_TREE: alternateRoot,
    },
  });
  assert.notEqual(redirected.status, 0);
  assert.match(redirected.stderr, /ambient Git repository\/config overrides are forbidden/);

  await writeFile(path.join(fixture.root, 'untracked-release-input.txt'), 'dirty\n');
  const dirty = command(process.execPath, args, {
    cwd: fixture.fixturePackage,
    environment: { STORYFORGE_EXPECTED_COMMIT: fixture.head },
  });
  assert.notEqual(dirty.status, 0);
  assert.match(dirty.stderr, /release mode requires a clean worktree, including no untracked files/);
});

test('release source refuses M1 until both recording policies are explicitly student-only', async (context) => {
  const fixture = await releaseFixture(context);
  const migrations = path.join(
    fixture.fixturePackage,
    'infra',
    'postgres',
    'migrations',
  );
  const migration = path.join(
    migrations,
    '20260729000100_b1_506_voice_recording_sessions.sql',
  );
  await rm(migration);
  git(fixture.root, ['add', '--all']);
  git(fixture.root, ['commit', '--quiet', '-m', 'missing M1']);
  let head = git(fixture.root, ['rev-parse', 'HEAD^{commit}']);
  let result = command(process.execPath, [
    fixture.assertionScript,
    '--mode=release',
  ], {
    cwd: fixture.fixturePackage,
    environment: { STORYFORGE_EXPECTED_COMMIT: head },
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /the B1-506 M1 migration is missing/);

  await writeFile(migration, `
-- sf_has_live_identity(ARRAY['student']) appears only in this comment.
CREATE POLICY sf_recording_sessions_rw ON public.sf_recording_sessions
FOR ALL TO authenticated
USING (public.sf_has_live_identity() AND student_id = public.sf_actor_id())
WITH CHECK (public.sf_has_live_identity() AND student_id = public.sf_actor_id());
CREATE POLICY sf_recording_segments_rw ON public.sf_recording_segments
FOR ALL TO authenticated
USING (public.sf_has_live_identity() AND true)
WITH CHECK (public.sf_has_live_identity() AND true);
REVOKE ALL ON public.sf_recording_sessions, public.sf_recording_segments FROM PUBLIC;
`);
  git(fixture.root, ['add', '--all']);
  git(fixture.root, ['commit', '--quiet', '-m', 'comment-only M1']);
  head = git(fixture.root, ['rev-parse', 'HEAD^{commit}']);
  result = command(process.execPath, [
    fixture.assertionScript,
    '--mode=release',
  ], {
    cwd: fixture.fixturePackage,
    environment: { STORYFORGE_EXPECTED_COMMIT: head },
  });
  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /sf_recording_sessions_rw USING does not require a live student identity/,
  );

  await writeFile(migration, `
CREATE POLICY sf_recording_sessions_rw ON public.sf_recording_sessions
FOR ALL TO authenticated
USING (public.sf_has_live_identity(ARRAY['student']) AND student_id = public.sf_actor_id())
WITH CHECK (public.sf_has_live_identity() AND student_id = public.sf_actor_id());
CREATE POLICY sf_recording_segments_rw ON public.sf_recording_segments
FOR ALL TO authenticated
USING (public.sf_has_live_identity(ARRAY['student']) AND true)
WITH CHECK (public.sf_has_live_identity(ARRAY['student']) AND true);
REVOKE ALL ON public.sf_recording_sessions, public.sf_recording_segments FROM PUBLIC;
`);
  git(fixture.root, ['add', '--all']);
  git(fixture.root, ['commit', '--quiet', '-m', 'unsafe M1 WITH CHECK']);
  head = git(fixture.root, ['rev-parse', 'HEAD^{commit}']);
  result = command(process.execPath, [
    fixture.assertionScript,
    '--mode=release',
  ], {
    cwd: fixture.fixturePackage,
    environment: { STORYFORGE_EXPECTED_COMMIT: head },
  });
  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /sf_recording_sessions_rw WITH CHECK does not require a live student identity/,
  );

  await writeFile(migration, safeM1Fixture);
  git(fixture.root, ['add', '--all']);
  git(fixture.root, ['commit', '--quiet', '-m', 'fully student-only M1']);
  head = git(fixture.root, ['rev-parse', 'HEAD^{commit}']);
  result = command(process.execPath, [
    fixture.assertionScript,
    '--mode=release',
  ], {
    cwd: fixture.fixturePackage,
    environment: { STORYFORGE_EXPECTED_COMMIT: head },
  });
  assert.equal(result.status, 0, result.stderr);
});

test('development build is isolated, marked nondeployable, and does not write release paths', async (context) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'storyforge-development-build.'));
  const fixturePackage = path.join(root, 'storyforge-v5');
  const scripts = path.join(fixturePackage, 'scripts');
  context.after(async () => {
    await rm(root, { recursive: true, force: true });
  });
  await mkdir(scripts, { recursive: true });
  await Promise.all([
    cp(path.join(packageDir, 'public'), path.join(fixturePackage, 'public'), {
      recursive: true,
    }),
    cp(
      path.join(packageDir, 'scripts', 'build-static.mjs'),
      path.join(scripts, 'build-static.mjs'),
    ),
    cp(
      path.join(packageDir, 'scripts', 'release-source.mjs'),
      path.join(scripts, 'release-source.mjs'),
    ),
    cp(
      path.join(packageDir, 'scripts', 'phase-one-release-safety.mjs'),
      path.join(scripts, 'phase-one-release-safety.mjs'),
    ),
  ]);

  const result = command(process.execPath, [
    path.join(scripts, 'build-static.mjs'),
    '--mode=development',
  ], { cwd: fixturePackage });
  assert.equal(result.status, 0, result.stderr);
  const receipt = JSON.parse(result.stdout);
  assert.equal(receipt.mode, 'development');
  assert.equal(receipt.deployable, false);
  assert.equal(receipt.releaseCandidate, false);
  assert.equal(receipt.expectedCommit, null);
  assert.equal(receipt.outputDirectory, '.local/development-dist');

  const developmentDir = path.join(fixturePackage, '.local', 'development-dist');
  const marker = JSON.parse(await readFile(
    path.join(developmentDir, 'DEVELOPMENT_ONLY.json'),
    'utf8',
  ));
  assert.equal(marker.mode, 'development');
  assert.equal(marker.deployable, false);
  assert.match(
    await readFile(path.join(developmentDir, 'index.html'), 'utf8'),
    /storyforge-build-mode" content="development-only"/,
  );
  await assert.rejects(access(path.join(fixturePackage, 'dist')), { code: 'ENOENT' });
  await assert.rejects(
    access(path.join(fixturePackage, 'infra', 'wordpress')),
    { code: 'ENOENT' },
  );
});

test('a fully committed release candidate rebuilds deterministically without dirtying tracked files', async (context) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'storyforge-release-rebuild.'));
  const fixturePackage = path.join(root, 'storyforge-v5');
  const scripts = path.join(fixturePackage, 'scripts');
  const wordpress = path.join(fixturePackage, 'infra', 'wordpress');
  const edge = path.join(fixturePackage, 'infra', 'edge');
  const conformance = path.join(fixturePackage, 'tests', 'conformance');
  const canonical = path.join(
    root,
    '_AI_HANDOFFS',
    'from_cowork',
    'B1-500_storyforge_v5_production_authority',
  );
  context.after(async () => {
    await rm(root, { recursive: true, force: true });
  });
  await Promise.all([
    mkdir(scripts, { recursive: true }),
    mkdir(wordpress, { recursive: true }),
    mkdir(edge, { recursive: true }),
    mkdir(conformance, { recursive: true }),
    mkdir(canonical, { recursive: true }),
    cp(path.join(packageDir, 'public'), path.join(fixturePackage, 'public'), {
      recursive: true,
    }),
  ]);
  await writeSafeM1(fixturePackage);
  await Promise.all([
    ...[
      'assert-release-source.mjs',
      'build-static.mjs',
      'build-wordpress-route-manifest.mjs',
      'check-canonical-authority.mjs',
      'check-product-provenance.mjs',
      'create-integration-evidence-dir.mjs',
      'phase-one-release-safety.mjs',
      'release-source.mjs',
      'update-integration-evidence.mjs',
    ].map((name) => cp(
      path.join(packageDir, 'scripts', name),
      path.join(scripts, name),
    )),
    cp(path.join(packageDir, 'package.json'), path.join(fixturePackage, 'package.json')),
    cp(path.join(packageDir, '.gitignore'), path.join(fixturePackage, '.gitignore')),
    cp(
      path.join(packageDir, 'infra', 'wordpress', 'missionmed-storyforge-route.php'),
      path.join(wordpress, 'missionmed-storyforge-route.php'),
    ),
    cp(
      path.join(packageDir, 'tests', 'conformance', 'authority-contract.mjs'),
      path.join(conformance, 'authority-contract.mjs'),
    ),
    cp(
      path.join(
        repositoryDir,
        '_AI_HANDOFFS',
        'from_cowork',
        'B1-500_storyforge_v5_production_authority',
        'storyforge-v5.html',
      ),
      path.join(canonical, 'storyforge-v5.html'),
    ),
  ]);

  git(root, ['init', '--quiet']);
  git(root, ['config', 'user.email', 'storyforge-test@example.test']);
  git(root, ['config', 'user.name', 'StoryForge Test']);
  git(root, ['add', '--all']);
  git(root, ['commit', '--quiet', '-m', 'committed release source']);

  let expectedCommit = git(root, ['rev-parse', 'HEAD^{commit}']);
  let result = command('npm', ['run', 'build:release'], {
    cwd: fixturePackage,
    environment: { STORYFORGE_EXPECTED_COMMIT: expectedCommit },
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /release mode requires a clean worktree/);
  await Promise.all([
    access(path.join(fixturePackage, 'dist', 'index.html')),
    access(
      path.join(
        fixturePackage,
        'infra',
        'wordpress',
        'missionmed-storyforge-runtime',
        'release.php',
      ),
    ),
    access(path.join(edge, 'generated-asset-aliases.mjs')),
  ]);
  assert.notEqual(git(root, ['status', '--porcelain=v1']), '');
  git(root, ['add', '--all']);
  git(root, ['commit', '--quiet', '-m', 'commit deterministic release artifacts']);

  expectedCommit = git(root, ['rev-parse', 'HEAD^{commit}']);
  result = command('npm', ['run', 'build:release'], {
    cwd: fixturePackage,
    environment: { STORYFORGE_EXPECTED_COMMIT: expectedCommit },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /"releaseArtifactEligible": true/);
  assert.match(result.stdout, /"deploymentAuthorized": false/);
  assert.equal(
    git(root, ['status', '--porcelain=v1', '--untracked-files=all']),
    '',
  );

  const terminalSignalRoot = await mkdtemp(
    path.join(os.tmpdir(), 'storyforge-terminal-recheck.'),
  );
  context.after(async () => {
    await rm(terminalSignalRoot, { recursive: true, force: true });
  });
  const terminalSignal = path.join(terminalSignalRoot, 'ready');
  const childEnvironment = { ...process.env };
  delete childEnvironment.GIT_DIR;
  delete childEnvironment.GIT_WORK_TREE;
  Object.assign(childEnvironment, {
    NODE_ENV: 'test',
    STORYFORGE_EXPECTED_COMMIT: expectedCommit,
    STORYFORGE_TEST_TERMINAL_RECHECK_SIGNAL: terminalSignal,
    STORYFORGE_TEST_TERMINAL_RECHECK_DELAY_MS: '5000',
  });
  const provenanceChild = spawn(process.execPath, [
    path.join(scripts, 'check-product-provenance.mjs'),
    '--mode=release',
  ], {
    cwd: fixturePackage,
    env: childEnvironment,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let provenanceStdout = '';
  let provenanceStderr = '';
  provenanceChild.stdout.on('data', (chunk) => {
    provenanceStdout += chunk;
  });
  provenanceChild.stderr.on('data', (chunk) => {
    provenanceStderr += chunk;
  });
  const provenanceCompletion = new Promise((resolve) => {
    provenanceChild.once('close', (status) => resolve({
      status,
      stdout: provenanceStdout,
      stderr: provenanceStderr,
    }));
  });
  for (let attempt = 0; attempt < 250; attempt += 1) {
    try {
      await access(terminalSignal);
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }
  await access(terminalSignal);
  const sourceIndex = path.join(fixturePackage, 'public', 'index.html');
  const originalSourceIndex = await readFile(sourceIndex);
  await writeFile(
    sourceIndex,
    Buffer.concat([originalSourceIndex, Buffer.from('\nconcurrent mutation\n')]),
  );
  const concurrentResult = await provenanceCompletion;
  assert.notEqual(concurrentResult.status, 0, concurrentResult.stdout);
  assert.match(concurrentResult.stderr, /release mode requires a clean worktree/);
  await writeFile(sourceIndex, originalSourceIndex);
  assert.equal(
    git(root, ['status', '--porcelain=v1', '--untracked-files=all']),
    '',
  );

  const evidenceResult = command(process.execPath, [
    path.join(scripts, 'create-integration-evidence-dir.mjs'),
  ], {
    cwd: fixturePackage,
    environment: { STORYFORGE_EXPECTED_COMMIT: expectedCommit },
  });
  assert.equal(evidenceResult.status, 0, evidenceResult.stderr);
  const evidenceDir = evidenceResult.stdout;
  assert.match(path.basename(evidenceDir), new RegExp(`^run\\.${expectedCommit}\\.`));

  const terminalProof = command(process.execPath, [
    path.join(scripts, 'assert-release-source.mjs'),
    '--mode=release',
  ], {
    cwd: fixturePackage,
    environment: { STORYFORGE_EXPECTED_COMMIT: expectedCommit },
  });
  assert.equal(terminalProof.status, 0, terminalProof.stderr);
  const terminalProofFile = path.join(fixturePackage, '.local', 'terminal-proof.json');
  await writeFile(terminalProofFile, terminalProof.stdout);

  const stagedRuntime = await mkdtemp(path.join(os.tmpdir(), 'storyforge-staged-runtime.'));
  context.after(async () => {
    await rm(stagedRuntime, { recursive: true, force: true });
  });
  const stagedReleaseDir = path.join(stagedRuntime, 'releases', expectedCommit);
  await mkdir(stagedReleaseDir, { recursive: true });
  const releaseFile = path.join(
    wordpress,
    'missionmed-storyforge-runtime',
    'release.php',
  );
  const stagedRelease = path.join(stagedReleaseDir, 'release.php');
  await cp(releaseFile, stagedRelease);
  await symlink(`releases/${expectedCommit}`, path.join(stagedRuntime, 'current'));

  const completion = command(process.execPath, [
    path.join(scripts, 'update-integration-evidence.mjs'),
    '--status=complete',
    `--directory=${evidenceDir}`,
    `--terminal-proof=${terminalProofFile}`,
    `--dist=${path.join(fixturePackage, 'dist')}`,
    `--route=${path.join(wordpress, 'missionmed-storyforge-route.php')}`,
    `--release=${releaseFile}`,
    `--edge=${path.join(edge, 'generated-asset-aliases.mjs')}`,
    `--staged-release=${stagedRelease}`,
    `--current-link=${path.join(stagedRuntime, 'current')}`,
  ], {
    cwd: fixturePackage,
    environment: { STORYFORGE_EXPECTED_COMMIT: expectedCommit },
  });
  assert.equal(completion.status, 0, completion.stderr);
  const completedStatus = JSON.parse(
    await readFile(path.join(evidenceDir, 'RUN_STATUS.json'), 'utf8'),
  );
  assert.equal(completedStatus.status, 'complete');
  assert.equal(completedStatus.deployable, false);
  assert.equal(completedStatus.releaseArtifactEligible, true);
  assert.equal(completedStatus.deploymentAuthorized, false);
  assert.equal(completedStatus.expectedCommit, expectedCommit);
  assert.equal(completedStatus.terminal.head, expectedCommit);
  assert.equal(completedStatus.terminal.clean, true);
  assert.match(completedStatus.terminal.releaseId, /^v-[a-f0-9]{16}$/);
  assert.equal(
    completedStatus.terminal.stagedRuntime.releasePhpSha256,
    completedStatus.terminal.artifacts.releasePhp.sha256,
  );

  const corruptEvidenceResult = command(process.execPath, [
    path.join(scripts, 'create-integration-evidence-dir.mjs'),
  ], {
    cwd: fixturePackage,
    environment: { STORYFORGE_EXPECTED_COMMIT: expectedCommit },
  });
  assert.equal(corruptEvidenceResult.status, 0, corruptEvidenceResult.stderr);
  await writeFile(stagedRelease, 'corrupted staged release\n');
  const corruptedCompletion = command(process.execPath, [
    path.join(scripts, 'update-integration-evidence.mjs'),
    '--status=complete',
    `--directory=${corruptEvidenceResult.stdout}`,
    `--terminal-proof=${terminalProofFile}`,
    `--dist=${path.join(fixturePackage, 'dist')}`,
    `--route=${path.join(wordpress, 'missionmed-storyforge-route.php')}`,
    `--release=${releaseFile}`,
    `--edge=${path.join(edge, 'generated-asset-aliases.mjs')}`,
    `--staged-release=${stagedRelease}`,
    `--current-link=${path.join(stagedRuntime, 'current')}`,
  ], {
    cwd: fixturePackage,
    environment: { STORYFORGE_EXPECTED_COMMIT: expectedCommit },
  });
  assert.notEqual(corruptedCompletion.status, 0);
  assert.match(
    corruptedCompletion.stderr,
    /staged release\.php bytes differ from the committed release\.php/,
  );
  assert.equal(
    JSON.parse(await readFile(
      path.join(corruptEvidenceResult.stdout, 'RUN_STATUS.json'),
      'utf8',
    )).status,
    'in_progress',
  );

  await cp(releaseFile, stagedRelease);
  await rm(path.join(stagedRuntime, 'current'));
  await symlink(
    `releases/${'b'.repeat(40)}`,
    path.join(stagedRuntime, 'current'),
  );
  const wrongLinkEvidence = command(process.execPath, [
    path.join(scripts, 'create-integration-evidence-dir.mjs'),
  ], {
    cwd: fixturePackage,
    environment: { STORYFORGE_EXPECTED_COMMIT: expectedCommit },
  });
  assert.equal(wrongLinkEvidence.status, 0, wrongLinkEvidence.stderr);
  const wrongLinkCompletion = command(process.execPath, [
    path.join(scripts, 'update-integration-evidence.mjs'),
    '--status=complete',
    `--directory=${wrongLinkEvidence.stdout}`,
    `--terminal-proof=${terminalProofFile}`,
    `--dist=${path.join(fixturePackage, 'dist')}`,
    `--route=${path.join(wordpress, 'missionmed-storyforge-route.php')}`,
    `--release=${releaseFile}`,
    `--edge=${path.join(edge, 'generated-asset-aliases.mjs')}`,
    `--staged-release=${stagedRelease}`,
    `--current-link=${path.join(stagedRuntime, 'current')}`,
  ], {
    cwd: fixturePackage,
    environment: { STORYFORGE_EXPECTED_COMMIT: expectedCommit },
  });
  assert.notEqual(wrongLinkCompletion.status, 0);
  assert.match(
    wrongLinkCompletion.stderr,
    /staged current runtime selector is .* not the expected commit/,
  );

  const ignoredReleaseInput = path.join(
    fixturePackage,
    'public',
    'ignored-release-input.log',
  );
  await writeFile(ignoredReleaseInput, 'ignored but release-visible bytes\n');
  assert.equal(
    git(root, ['status', '--porcelain=v1', '--untracked-files=all']),
    '',
  );
  const ignoredInputBuild = command(process.execPath, [
    path.join(scripts, 'build-static.mjs'),
    '--mode=release',
  ], {
    cwd: fixturePackage,
    environment: { STORYFORGE_EXPECTED_COMMIT: expectedCommit },
  });
  assert.notEqual(ignoredInputBuild.status, 0);
  assert.match(ignoredInputBuild.stderr, /ignored release input or output/);
  await rm(ignoredReleaseInput);
});

test('integration evidence roots reject traversal, symlink, legacy, and protected-tree overlap', async (context) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'storyforge-evidence-root.'));
  const fixturePackage = path.join(root, 'storyforge-v5');
  const scripts = path.join(fixturePackage, 'scripts');
  const legacy = path.join(
    root,
    '_AI_HANDOFFS',
    'from_codex',
    'B1-502M_storyforge_megarun',
  );
  const expectedCommit = 'a'.repeat(40);
  context.after(async () => {
    await rm(root, { recursive: true, force: true });
  });
  await Promise.all([
    mkdir(scripts, { recursive: true }),
    mkdir(path.join(fixturePackage, 'dist'), { recursive: true }),
    mkdir(legacy, { recursive: true }),
  ]);
  await Promise.all([
    cp(
      path.join(packageDir, 'scripts', 'release-source.mjs'),
      path.join(scripts, 'release-source.mjs'),
    ),
    cp(
      path.join(packageDir, 'scripts', 'phase-one-release-safety.mjs'),
      path.join(scripts, 'phase-one-release-safety.mjs'),
    ),
    cp(
      path.join(packageDir, 'scripts', 'create-integration-evidence-dir.mjs'),
      path.join(scripts, 'create-integration-evidence-dir.mjs'),
    ),
    cp(
      path.join(packageDir, 'scripts', 'update-integration-evidence.mjs'),
      path.join(scripts, 'update-integration-evidence.mjs'),
    ),
  ]);
  const creator = path.join(scripts, 'create-integration-evidence-dir.mjs');

  const defaultEvidence = command(process.execPath, [creator], {
    cwd: fixturePackage,
    environment: { STORYFORGE_EXPECTED_COMMIT: expectedCommit },
  });
  assert.equal(defaultEvidence.status, 0, defaultEvidence.stderr);
  const physicalFixturePackage = await realpath(fixturePackage);
  assert(defaultEvidence.stdout.startsWith(
    `${path.join(physicalFixturePackage, '.local', 'integration-evidence')}${path.sep}`,
  ));
  const initial = JSON.parse(
    await readFile(path.join(defaultEvidence.stdout, 'RUN_STATUS.json'), 'utf8'),
  );
  assert.equal(initial.status, 'in_progress');
  assert.equal(initial.deployable, false);
  assert.equal(initial.releaseArtifactEligible, false);
  assert.equal(initial.deploymentAuthorized, false);
  assert.equal(initial.expectedCommit, expectedCommit);

  const failed = command(process.execPath, [
    path.join(scripts, 'update-integration-evidence.mjs'),
    '--status=failed',
    '--exit-code=17',
    `--directory=${defaultEvidence.stdout}`,
  ], {
    cwd: fixturePackage,
    environment: { STORYFORGE_EXPECTED_COMMIT: expectedCommit },
  });
  assert.equal(failed.status, 0, failed.stderr);
  const failedStatus = JSON.parse(
    await readFile(path.join(defaultEvidence.stdout, 'RUN_STATUS.json'), 'utf8'),
  );
  assert.equal(failedStatus.status, 'failed');
  assert.equal(failedStatus.deployable, false);
  assert.equal(failedStatus.terminal.exitCode, 17);

  const legacyAttempt = command(process.execPath, [creator], {
    cwd: fixturePackage,
    environment: {
      STORYFORGE_EXPECTED_COMMIT: expectedCommit,
      STORYFORGE_INTEGRATION_EVIDENCE_DIR: legacy,
    },
  });
  assert.notEqual(legacyAttempt.status, 0);
  assert.match(legacyAttempt.stderr, /prior-ticket B1-502M evidence receipts/);

  const traversalAttempt = command(process.execPath, [creator], {
    cwd: fixturePackage,
    environment: {
      STORYFORGE_EXPECTED_COMMIT: expectedCommit,
      STORYFORGE_INTEGRATION_EVIDENCE_DIR:
        `${path.join(root, '_AI_HANDOFFS', 'from_codex', 'B1-503-safe')}`
        + `${path.sep}..${path.sep}B1-502M_storyforge_megarun`,
    },
  });
  assert.notEqual(traversalAttempt.status, 0);
  assert.match(traversalAttempt.stderr, /prior-ticket B1-502M evidence receipts/);

  const external = await mkdtemp(path.join(os.tmpdir(), 'storyforge-evidence-link.'));
  context.after(async () => {
    await rm(external, { recursive: true, force: true });
  });
  const evidenceLink = path.join(external, 'linked-evidence');
  await symlink(legacy, evidenceLink, 'dir');
  const symlinkAttempt = command(process.execPath, [creator], {
    cwd: fixturePackage,
    environment: {
      STORYFORGE_EXPECTED_COMMIT: expectedCommit,
      STORYFORGE_INTEGRATION_EVIDENCE_DIR: evidenceLink,
    },
  });
  assert.notEqual(symlinkAttempt.status, 0);
  assert.match(symlinkAttempt.stderr, /prior-ticket B1-502M evidence receipts/);

  const protectedAttempt = command(process.execPath, [creator], {
    cwd: fixturePackage,
    environment: {
      STORYFORGE_EXPECTED_COMMIT: expectedCommit,
      STORYFORGE_INTEGRATION_EVIDENCE_DIR: path.join(fixturePackage, 'dist'),
    },
  });
  assert.notEqual(protectedAttempt.status, 0);
  assert.match(protectedAttempt.stderr, /in-worktree evidence root must stay/);

  const b1503EvidenceRoot = path.join(
    root,
    '_AI_HANDOFFS',
    'from_codex',
    'B1-503_release_evidence',
  );
  const b1503Evidence = command(process.execPath, [creator], {
    cwd: fixturePackage,
    environment: {
      STORYFORGE_EXPECTED_COMMIT: expectedCommit,
      STORYFORGE_INTEGRATION_EVIDENCE_DIR: b1503EvidenceRoot,
    },
  });
  assert.equal(b1503Evidence.status, 0, b1503Evidence.stderr);
  assert(b1503Evidence.stdout.startsWith(
    `${path.join(
      await realpath(path.join(root, '_AI_HANDOFFS', 'from_codex')),
      'B1-503_release_evidence',
    )}${path.sep}`,
  ));
});

test('Railway API-only build is self-contained within the uploaded package root', async (context) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'storyforge-api-build.'));
  const fixturePackage = path.join(root, 'storyforge-v5');
  context.after(async () => {
    await rm(root, { recursive: true, force: true });
  });
  await Promise.all([
    mkdir(path.join(fixturePackage, 'scripts'), { recursive: true }),
    cp(path.join(packageDir, 'server'), path.join(fixturePackage, 'server'), {
      recursive: true,
    }),
  ]);
  await Promise.all([
    cp(path.join(packageDir, 'package.json'), path.join(fixturePackage, 'package.json')),
    cp(path.join(packageDir, 'railway.json'), path.join(fixturePackage, 'railway.json')),
    cp(
      path.join(packageDir, 'scripts', 'check-api-only-build.mjs'),
      path.join(fixturePackage, 'scripts', 'check-api-only-build.mjs'),
    ),
    cp(
      path.join(packageDir, 'scripts', 'phase-one-release-safety.mjs'),
      path.join(fixturePackage, 'scripts', 'phase-one-release-safety.mjs'),
    ),
    symlink(
      path.join(packageDir, 'node_modules'),
      path.join(fixturePackage, 'node_modules'),
      'dir',
    ),
  ]);
  await writeSafeM1(fixturePackage);
  await assert.rejects(access(path.join(root, '_AI_HANDOFFS')), { code: 'ENOENT' });

  const result = command('npm', ['run', 'build:api'], { cwd: fixturePackage });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /"mode": "api-only-provider"/);
  assert.match(result.stdout, /"selfContainedPackageRoot": true/);
  assert.match(result.stdout, /"canonicalProductBuildInvoked": false/);
  assert.match(result.stdout, /"deploymentAuthorized": false/);
});

test('release scripts preflight before mutation and keep integration evidence out of prior receipts', async () => {
  const packageJson = JSON.parse(await readFile(path.join(packageDir, 'package.json'), 'utf8'));
  const releaseSource = await readFile(
    path.join(packageDir, 'scripts', 'release-source.mjs'),
    'utf8',
  );
  assert.match(
    releaseSource,
    /import \{ assertPhaseOneStudentOnlyRecordingPolicies \} from '\.\/phase-one-release-safety\.mjs';/,
  );
  assert(
    releaseSource.indexOf('assertPhaseOneStudentOnlyRecordingPolicies({')
      < releaseSource.indexOf('const expectedCommit = releaseExpectedCommit(environment);'),
  );
  for (const scriptName of [
    'build-static.mjs',
    'build-wordpress-route-manifest.mjs',
    'check-product-provenance.mjs',
  ]) {
    const scriptSource = await readFile(
      path.join(packageDir, 'scripts', scriptName),
      'utf8',
    );
    assert.match(scriptSource, /assertReleaseSource\(\{/);
  }
  assert.equal(packageJson.scripts.build, 'npm run build:development');
  assert.match(packageJson.scripts['build:development'], /--mode=development/);
  assert.doesNotMatch(packageJson.scripts['build:development'], /wordpress/);
  assert.match(
    packageJson.scripts['build:release'],
    /^node scripts\/assert-release-source\.mjs --mode=release /,
  );
  assert.match(
    packageJson.scripts['build:release'],
    /build-static\.mjs --mode=release .*build-wordpress-route-manifest\.mjs --mode=release .*check-product-provenance\.mjs --mode=release$/,
  );
  assert.equal(
    packageJson.scripts['check:product-provenance'],
    'node scripts/check-product-provenance.mjs --mode=release',
  );
  assert.equal(
    packageJson.scripts['build:api'],
    'node scripts/check-api-only-build.mjs',
  );
  const railway = JSON.parse(
    await readFile(path.join(packageDir, 'railway.json'), 'utf8'),
  );
  assert.equal(railway.build.buildCommand, 'npm run build:api');

  const integration = await readFile(
    path.join(packageDir, 'scripts', 'run-integration.sh'),
    'utf8',
  );
  const firstAssertion = integration.indexOf('assert-release-source.mjs" --mode=release');
  assert(firstAssertion > 0);
  assert(firstAssertion < integration.indexOf('mktemp -d'));
  assert(firstAssertion < integration.indexOf('docker compose'));
  assert.match(integration, /npm run build:release/);
  assert.doesNotMatch(integration, /rev-parse HEAD/);
  assert.match(integration, /SF_PRODUCT_COMMIT="\$STORYFORGE_EXPECTED_COMMIT"/);
  assert.match(integration, /create-integration-evidence-dir\.mjs/);
  assert.match(integration, /update-integration-evidence\.mjs/);
  assert.match(integration, /--status=failed/);
  assert.match(integration, /--status=complete/);
  assert.match(integration, /--staged-release=/);
  assert.match(integration, /--current-link=/);
  assert.equal(
    integration.match(/assert-release-source\.mjs" --mode=release/g)?.length,
    2,
  );
  const evidenceCreator = await readFile(
    path.join(packageDir, 'scripts', 'create-integration-evidence-dir.mjs'),
    'utf8',
  );
  assert.match(evidenceCreator, /\.local.*integration-evidence/s);
  assert.match(evidenceCreator, /B1-502M_storyforge_megarun/);
  assert.match(evidenceCreator, /B1-503/);

  const playwrightConfig = await readFile(
    path.join(packageDir, 'playwright.integration.config.mjs'),
    'utf8',
  );
  assert.match(playwrightConfig, /\.local\/integration-results/);
  assert.match(playwrightConfig, /\.local\/integration-report/);
  const ignoredEvidence = command('git', [
    '-C',
    repositoryDir,
    'check-ignore',
    '--quiet',
    path.join(packageDir, '.local', 'integration-evidence', 'run.test'),
  ]);
  assert.equal(ignoredEvidence.status, 0, ignoredEvidence.stderr);

  const statusBefore = git(repositoryDir, ['status', '--porcelain=v1', '--untracked-files=all']);
  const missingCommit = command('bash', [
    path.join(packageDir, 'scripts', 'run-integration.sh'),
  ], { cwd: packageDir });
  assert.notEqual(missingCommit.status, 0);
  assert.match(
    missingCommit.stderr,
    /release integration requires STORYFORGE_EXPECTED_COMMIT/,
  );
  assert.equal(
    git(repositoryDir, ['status', '--porcelain=v1', '--untracked-files=all']),
    statusBefore,
  );
});
