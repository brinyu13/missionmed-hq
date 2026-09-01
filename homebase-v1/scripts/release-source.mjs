import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  lstatSync,
  readFileSync,
  readlinkSync,
  realpathSync,
} from 'node:fs';
import path from 'node:path';

import { assertHomeBaseReleaseSafety } from './phase-one-release-safety.mjs';

const fullCommitPattern = /^[a-f0-9]{40}$/;
const forbiddenGitEnvironment = new Set([
  'GIT_ALTERNATE_OBJECT_DIRECTORIES',
  'GIT_CEILING_DIRECTORIES',
  'GIT_COMMON_DIR',
  'GIT_CONFIG',
  'GIT_CONFIG_COUNT',
  'GIT_CONFIG_GLOBAL',
  'GIT_CONFIG_NOSYSTEM',
  'GIT_CONFIG_PARAMETERS',
  'GIT_CONFIG_SYSTEM',
  'GIT_DIR',
  'GIT_DISCOVERY_ACROSS_FILESYSTEM',
  'GIT_GRAFT_FILE',
  'GIT_INDEX_FILE',
  'GIT_NAMESPACE',
  'GIT_OBJECT_DIRECTORY',
  'GIT_QUARANTINE_PATH',
  'GIT_REPLACE_REF_BASE',
  'GIT_SHALLOW_FILE',
  'GIT_WORK_TREE',
]);

function fail(message) {
  throw new Error(`HomeBase release provenance failed: ${message}`);
}

function safeGitEnvironment() {
  const overrides = Object.keys(process.env).filter(
    (name) => (
      forbiddenGitEnvironment.has(name)
      || /^GIT_CONFIG_(?:KEY|VALUE)_\d+$/.test(name)
    ) && process.env[name] !== undefined,
  );
  if (overrides.length) {
    fail(`ambient Git repository/config overrides are forbidden: ${overrides.join(', ')}.`);
  }
  const environment = { ...process.env };
  for (const name of forbiddenGitEnvironment) delete environment[name];
  for (const name of Object.keys(environment)) {
    if (/^GIT_CONFIG_(?:KEY|VALUE)_\d+$/.test(name)) delete environment[name];
  }
  return environment;
}

function gitResult(directory, args, options = {}) {
  const result = spawnSync('git', ['-C', directory, ...args], {
    ...options,
    env: safeGitEnvironment(),
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const detail = String(result.stderr || result.stdout || '').trim();
    fail(`git ${args.join(' ')} failed${detail ? `: ${detail}` : '.'}`);
  }
  return result.stdout;
}

function git(directory, args) {
  return String(gitResult(directory, args, { encoding: 'utf8' }) || '').trim();
}

function gitNulRecords(directory, args) {
  const output = gitResult(directory, args, { encoding: 'utf8' });
  return String(output || '').split('\0').filter(Boolean);
}

function treeEntries(repositoryDir, commit) {
  return gitNulRecords(repositoryDir, [
    'ls-tree',
    '-r',
    '-z',
    '--full-tree',
    commit,
  ]).map((record) => {
    const separator = record.indexOf('\t');
    if (separator < 0) fail('Git returned a malformed committed tree entry.');
    const [mode, type, objectId] = record.slice(0, separator).split(' ');
    return {
      mode,
      type,
      objectId,
      relative: record.slice(separator + 1),
    };
  });
}

function indexEntries(repositoryDir) {
  return gitNulRecords(repositoryDir, ['ls-files', '-s', '-z']).map((record) => {
    const separator = record.indexOf('\t');
    if (separator < 0) fail('Git returned a malformed index entry.');
    const [mode, objectId, stage] = record.slice(0, separator).split(' ');
    return {
      mode,
      objectId,
      stage,
      relative: record.slice(separator + 1),
    };
  });
}

function blobObjectId(bytes, objectFormat) {
  return createHash(objectFormat)
    .update(`blob ${bytes.length}\0`)
    .update(bytes)
    .digest('hex');
}

function within(candidate, root) {
  return candidate === root || candidate.startsWith(`${root}${path.sep}`);
}

function prospectiveRealpath(candidate) {
  const missing = [];
  let existing = path.resolve(candidate);
  while (true) {
    try {
      return path.resolve(realpathSync(existing), ...missing);
    } catch {
      const parent = path.dirname(existing);
      if (parent === existing) {
        fail(`cannot resolve release provenance path: ${candidate}.`);
      }
      missing.unshift(path.basename(existing));
      existing = parent;
    }
  }
}

function worktreeEntry(repositoryDir, entry, objectFormat) {
  const absolute = path.resolve(repositoryDir, entry.relative);
  if (!within(absolute, repositoryDir)) {
    fail(`committed path escapes the repository: ${entry.relative}.`);
  }
  if (entry.type !== 'blob' || entry.mode === '160000') {
    fail(`release source does not support Git links: ${entry.relative}.`);
  }

  let details;
  try {
    details = lstatSync(absolute);
  } catch {
    return { relative: entry.relative, reason: 'missing from the worktree' };
  }

  let bytes;
  let mode;
  if (details.isSymbolicLink()) {
    bytes = readlinkSync(absolute, { encoding: 'buffer' });
    mode = '120000';
  } else if (details.isFile()) {
    bytes = readFileSync(absolute);
    mode = details.mode & 0o111 ? '100755' : '100644';
  } else {
    return { relative: entry.relative, reason: 'is not a regular file or symbolic link' };
  }

  if (mode !== entry.mode) {
    return {
      relative: entry.relative,
      reason: `mode ${mode} does not match committed mode ${entry.mode}`,
    };
  }
  const objectId = blobObjectId(bytes, objectFormat);
  if (objectId !== entry.objectId) {
    return {
      relative: entry.relative,
      reason: `bytes do not match committed blob ${entry.objectId}`,
    };
  }
  return null;
}

export function releaseExpectedCommit(environment = process.env) {
  const expectedCommit = String(environment.HOMEBASE_EXPECTED_COMMIT || '').trim();
  if (!fullCommitPattern.test(expectedCommit)) {
    fail('HOMEBASE_EXPECTED_COMMIT must be an explicit full lowercase 40-character commit.');
  }
  return expectedCommit;
}

export function repositoryRoot(startDirectory) {
  return git(path.resolve(startDirectory), ['rev-parse', '--show-toplevel']);
}

export function assertReleaseSource({
  startDirectory,
  environment = process.env,
  allowedDirtyPaths = [],
  forbiddenIgnoredPaths = [],
} = {}) {
  if (!startDirectory) fail('a repository start directory is required.');
  const repositoryDir = repositoryRoot(startDirectory);
  const expectedRepositoryDir = realpathSync(path.resolve(startDirectory, '..'));
  const actualRepositoryDir = realpathSync(repositoryDir);
  if (actualRepositoryDir !== expectedRepositoryDir) {
    fail(
      `repository root ${actualRepositoryDir} is not the HomeBase package parent `
        + `${expectedRepositoryDir}.`,
    );
  }
  assertHomeBaseReleaseSafety({
    packageDir: realpathSync(startDirectory),
  });
  const expectedCommit = releaseExpectedCommit(environment);
  const head = git(repositoryDir, ['rev-parse', 'HEAD^{commit}']);
  if (head !== expectedCommit) {
    fail(`Git HEAD ${head} does not match HOMEBASE_EXPECTED_COMMIT ${expectedCommit}.`);
  }

  const flaggedEntries = gitNulRecords(repositoryDir, ['ls-files', '-v', '-z'])
    .filter((record) => {
      const flag = record[0];
      return flag === 'S' || /^[a-z]$/.test(flag);
    });
  if (flaggedEntries.length) {
    fail(
      'release mode rejects assume-unchanged and skip-worktree index flags: '
        + flaggedEntries.slice(0, 5).map((record) => record.slice(2)).join(', '),
    );
  }

  const committed = treeEntries(repositoryDir, expectedCommit);
  const indexed = indexEntries(repositoryDir);
  if (
    committed.length !== indexed.length
    || committed.some((entry, index) => {
      const candidate = indexed[index];
      return (
        !candidate
        || candidate.stage !== '0'
        || candidate.relative !== entry.relative
        || candidate.mode !== entry.mode
        || candidate.objectId !== entry.objectId
      );
    })
  ) {
    fail('the Git index does not exactly match HOMEBASE_EXPECTED_COMMIT.');
  }

  const objectFormat = git(repositoryDir, ['rev-parse', '--show-object-format']);
  if (!['sha1', 'sha256'].includes(objectFormat)) {
    fail(`unsupported Git object format: ${objectFormat}.`);
  }
  const allowedRoots = allowedDirtyPaths.map((candidate) => {
    const absolute = prospectiveRealpath(candidate);
    if (!within(absolute, repositoryDir)) {
      fail(`an allowed dirty path is outside the repository: ${absolute}.`);
    }
    return absolute;
  });
  const ignoredRoots = forbiddenIgnoredPaths.map((candidate) => {
    const absolute = prospectiveRealpath(candidate);
    if (!within(absolute, repositoryDir)) {
      fail(`an ignored-file guard path is outside the repository: ${absolute}.`);
    }
    return path.relative(repositoryDir, absolute);
  });
  const isAllowed = (relative) => {
    const absolute = path.resolve(repositoryDir, relative);
    return allowedRoots.some((root) => within(absolute, root));
  };

  const differences = committed
    .map((entry) => worktreeEntry(repositoryDir, entry, objectFormat))
    .filter(Boolean);
  for (const relative of gitNulRecords(repositoryDir, [
    'ls-files',
    '--others',
    '--exclude-standard',
    '-z',
  ])) {
    differences.push({ relative, reason: 'is untracked' });
  }
  const ignoredDifferences = ignoredRoots.length
    ? gitNulRecords(repositoryDir, [
      'ls-files',
      '--others',
      '--ignored',
      '--exclude-standard',
      '-z',
      '--',
      ...ignoredRoots,
    ]).map((relative) => ({
      relative,
      reason: 'is an ignored release input or output',
    }))
    : [];
  differences.push(...ignoredDifferences);
  const ignoredSet = new Set(ignoredDifferences.map(({ relative }) => relative));
  const forbidden = differences.filter(
    ({ relative }) => ignoredSet.has(relative) || !isAllowed(relative),
  );
  if (forbidden.length) {
    fail(
      'release mode requires a clean worktree, including no untracked files. '
        + forbidden
          .slice(0, 5)
          .map(({ relative, reason }) => `${relative} ${reason}`)
          .join('; '),
    );
  }

  return Object.freeze({
    repositoryDir,
    expectedCommit,
    head,
    clean: differences.length === 0,
    status: differences.map(
      ({ relative, reason }) => `${relative}: ${reason}`,
    ),
  });
}

export function parseBuildMode(argv = process.argv.slice(2), {
  defaultMode = null,
} = {}) {
  const modeArguments = argv.filter((value) => value.startsWith('--mode='));
  if (modeArguments.length > 1) {
    fail('build mode may be specified only once.');
  }
  const mode = modeArguments[0]?.slice('--mode='.length) || defaultMode;
  if (!['development', 'release'].includes(mode)) {
    fail('an explicit --mode=development or --mode=release is required.');
  }
  return mode;
}
