import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, lstatSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

// DR-350: same tracked-source staging pattern as the MissionMed DR-133 release.
// No local/untracked inputs and no --no-gitignore. Railway's custom ignore file
// takes precedence over Git ignore rules. Nested Git rules remain in scope.
// Preserve the established whole-repository upload scope; filter tracked inputs
// rather than silently dropping shared HQ-mounted surfaces outside IVOC roots.
export const releaseRoots = ['.'];
export const requiredRuntime = [
  'missionmed-hq/lib/auth/session-token.mjs',
  'missionmed-hq/lor-studio/security/faculty-candidate-credential-context.mjs',
  'ivprep-v6/public/ivoc-standalone/styles/tokens.css',
  'missionmed-hq/server.mjs', 'ivprep-v6/server/hq-mount.mjs',
  'ivprep-v6/public/studio/index.html', 'ivprep-v6/public/studio/studio.mjs',
  'ivprep-v6/public/studio/presentation-view-model.mjs',
];
export const privateExamples = ['.env', '.env.production', 'missionmed-hq/.env', 'session-token.json', 'missionmed-hq/lib/auth/session-token.json', 'credentials.json', 'missionmed-hq/secret.json', 'private.key', 'private.pem'];

function run(binary, args, options = {}) {
  const result = spawnSync(binary, args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, ...options });
  if (result.error || result.status !== 0) throw new Error(`RELEASE_COMMAND_FAILED:${binary}`);
  return result.stdout;
}
function git(root, args, options = {}) {
  return run('git', ['-C', root, ...args], { env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' }, ...options });
}

export function releaseManifest(root) {
  const tracked = git(root, ['ls-files', '-z', '--', ...releaseRoots]).split('\0').filter(Boolean);
  const sandbox = mkdtempSync(join(tmpdir(), 'ivoc-release-ignore-'));
  try {
    git(sandbox, ['init', '-q']);
    // Evaluate Railway custom rules last, including its four audited image includes.
    for (const name of tracked.filter(p => p.endsWith('.gitignore'))) {
      mkdirSync(dirname(join(sandbox, name)), { recursive: true });
      const rules = readFileSync(join(root, name), 'utf8');
      const custom = join(root, dirname(name), '.railwayignore');
      writeFileSync(join(sandbox, name), `${rules}\n${existsSync(custom) ? readFileSync(custom, 'utf8') : ''}\n`);
    }
    const candidates = [...tracked, ...privateExamples];
    const checked = spawnSync('git', ['-C', sandbox, 'check-ignore', '--no-index', '-z', '--stdin'], {
      input: `${candidates.join('\0')}\0`, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
      env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' },
    });
    if (![0, 1].includes(checked.status)) throw new Error('RELEASE_IGNORE_CHECK_FAILED');
    const excluded = new Set(checked.stdout.split('\0').filter(Boolean));
    for (const p of privateExamples) if (!excluded.has(p)) throw new Error('RELEASE_PRIVATE_EXCLUSION_FAILED');
    const included = tracked.filter(p => !excluded.has(p)).sort();
    for (const p of requiredRuntime) if (!included.includes(p)) throw new Error(`RELEASE_REQUIRED_MISSING:${p}`);
    for (const p of included) {
      if (lstatSync(join(root, p)).isSymbolicLink()) throw new Error('RELEASE_SYMLINK_REJECTED');
      if (/secret|credential|token/i.test(p) && !requiredRuntime.includes(p)) throw new Error('RELEASE_PRIVATE_NAME_REJECTED');
    }
    return included;
  } finally { rmSync(sandbox, { recursive: true, force: true }); }
}

export function prepareRelease(root) {
  if (git(root, ['status', '--porcelain']).trim()) throw new Error('RELEASE_DIRTY_SOURCE');
  const source = git(root, ['rev-parse', 'HEAD']).trim();
  const remote = git(root, ['config', '--get', `branch.${git(root, ['branch', '--show-current']).trim()}.remote`]).trim();
  const ref = git(root, ['config', '--get', `branch.${git(root, ['branch', '--show-current']).trim()}.merge`]).trim();
  if (!remote || remote === '.' || !ref.startsWith('refs/heads/')) throw new Error('RELEASE_REMOTE_NOT_CONFIGURED');
  const actualRemote = git(root, ['ls-remote', '--exit-code', remote, ref]).trim().split(/\s+/)[0];
  if (source !== actualRemote) throw new Error('RELEASE_SOURCE_NOT_PUSHED');
  const files = releaseManifest(root);
  const artifact = mkdtempSync(join(tmpdir(), 'ivoc-release-artifact-'));
  const stage = join(artifact, 'stage');
  mkdirSync(stage, { mode: 0o700 });
  const archive = join(artifact, 'source.tar');
  git(root, ['archive', '--format=tar', `--output=${archive}`, source, '--', ...files]);
  run('tar', ['-xf', archive, '-C', stage]);
  for (const p of requiredRuntime) if (!existsSync(join(stage, p))) throw new Error(`RELEASE_ARTIFACT_MISSING:${p}`);
  for (const p of privateExamples) if (existsSync(join(stage, p))) throw new Error('RELEASE_PRIVATE_ARTIFACT_PRESENT');
  // Prove materialized files match the tracked inputs, not a stale/local artifact.
  for (const p of files) if (!readFileSync(join(stage, p)).equals(readFileSync(join(root, p)))) throw new Error('RELEASE_ARTIFACT_DRIFT');
  return { source, stage, files: files.length, sha256: createHash('sha256').update(readFileSync(archive)).digest('hex') };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
  console.log(JSON.stringify(prepareRelease(root)));
}
