import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { constants as fsConstants } from 'node:fs';
import { homedir } from 'node:os';
import {
  chmod,
  lstat,
  mkdir,
  open,
  readdir,
  realpath,
  rename,
  unlink,
} from 'node:fs/promises';
import {
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from 'node:path';

export const DEFAULT_RESTRICTED_BOUNDARY =
  resolve(homedir(), 'MissionMed_AI_Sandbox', 'I1Q-1008E_RESTRICTED_FULL_CORPUS_EXTRACTION');

export const DEFAULT_WORKTREE_ROOT =
  resolve(homedir(), 'MissionMed_worktrees', 'I1Q-STATQuestions-1008B-SourceFactory');

export const RESTRICTED_TOP_LEVEL_DIRECTORIES = Object.freeze([
  'raw',
  'working',
  'audit',
  'quarantine',
  'tmp',
  'keys',
  'state',
  'reviews',
]);

export const DEFAULT_ALIAS_MAP_RELATIVE_PATH = 'state/opaque-alias-map.json';

const ALIAS_LOCK_RELATIVE_PATH = 'state/.opaque-alias-map.lock';
const ALIAS_MAP_SCHEMA = 'missionmed.i1q1008e.opaque_alias_map.v1';
const LOCKF_PATH = '/usr/bin/lockf';
const LOCK_READY_MARKER = 'MISSIONMED_ALIAS_LOCK_READY';
const LOCK_HOLDER_SOURCE = [
  `process.stdout.write('${LOCK_READY_MARKER}\\n');`,
  'process.stdin.resume();',
  "process.stdin.once('end', () => process.exit(0));",
].join('');
const CHECK_SCHEMA = 'missionmed.i1q1008e.restricted_boundary_check.v1';
const DIRECTORY_MODE = 0o700;
const FILE_MODE = 0o600;
const MODE_MASK = 0o7777;
const MAX_JSON_BYTES = 512 * 1024 * 1024;
const MAX_RAW_ID_BYTES = 64 * 1024;
const NAMESPACE_PATTERN = /^[a-z][a-z0-9_]{0,31}$/u;
const GIT_MARKERS = new Set(['.git', '.gitmodules']);
const TOP_LEVEL_SET = new Set(RESTRICTED_TOP_LEVEL_DIRECTORIES);
const CLOUD_SYNC_SEGMENTS = Object.freeze([
  /cloudstorage/iu,
  /dropbox/iu,
  /google[ _-]?drive/iu,
  /icloud/iu,
  /mobile documents/iu,
  /one[ _-]?drive/iu,
  /syncthing/iu,
  /^box(?: sync)?$/iu,
]);

const SAFE_CODES = new Set([
  'alias_input_rejected',
  'alias_lock_busy',
  'alias_map_invalid',
  'boundary_cloud_sync_rejected',
  'boundary_cleanup_failed',
  'boundary_directory_mode_invalid',
  'boundary_file_mode_invalid',
  'boundary_fsync_failed',
  'boundary_git_marker_rejected',
  'boundary_hardlink_rejected',
  'boundary_io_failure',
  'boundary_keys_not_empty',
  'boundary_keys_write_rejected',
  'boundary_missing',
  'boundary_owner_invalid',
  'boundary_path_escape_rejected',
  'boundary_path_input_rejected',
  'boundary_platform_unsupported',
  'boundary_realpath_rejected',
  'boundary_special_file_rejected',
  'boundary_symlink_rejected',
  'boundary_top_level_invalid',
  'boundary_worktree_overlap_rejected',
  'boundary_write_failed',
  'json_input_rejected',
  'json_parse_rejected',
  'json_size_rejected',
]);

export class BoundaryError extends Error {
  constructor(code) {
    const safeCode = SAFE_CODES.has(code) ? code : 'boundary_io_failure';
    super(safeCode);
    this.name = 'BoundaryError';
    this.code = safeCode;
  }
}

function fail(code) {
  throw new BoundaryError(code);
}

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactKeys(value, expected) {
  if (!isPlainObject(value)) return false;
  const actual = Object.keys(value).sort();
  const required = [...expected].sort();
  return actual.length === required.length
    && actual.every((key, index) => key === required[index]);
}

function effectiveUid() {
  if (typeof process.getuid !== 'function') fail('boundary_platform_unsupported');
  return process.getuid();
}

function modeOf(stat) {
  return stat.mode & MODE_MASK;
}

function isContained(root, candidate) {
  const remainder = relative(root, candidate);
  return remainder === '' || (!remainder.startsWith(`..${sep}`) && remainder !== '..' && !isAbsolute(remainder));
}

function lexicalSegments(value) {
  return String(value).split(/[\\/]+/u).filter(Boolean);
}

function assertPathInput(value) {
  if (typeof value !== 'string' || value.length === 0 || value.includes('\0')) {
    fail('boundary_path_input_rejected');
  }
  if (lexicalSegments(value).some((segment) => segment === '.' || segment === '..')) {
    fail('boundary_path_escape_rejected');
  }
  if (lexicalSegments(value).some((segment) => GIT_MARKERS.has(segment))) {
    fail('boundary_git_marker_rejected');
  }
}

function resolvedTarget(boundaryRoot, targetPath, lexicalBoundaryRoot = boundaryRoot) {
  assertPathInput(targetPath);
  if (!isAbsolute(targetPath)) return resolve(boundaryRoot, targetPath);

  const absoluteTarget = resolve(targetPath);
  if (isContained(boundaryRoot, absoluteTarget)) return absoluteTarget;

  // macOS exposes canonical temporary paths below /private/var while tmpdir()
  // commonly returns the system alias /var. Map only the same lexical subtree
  // onto the already verified canonical root; never map an outside path.
  const lexicalRoot = resolve(lexicalBoundaryRoot);
  if (!isContained(lexicalRoot, absoluteTarget)) fail('boundary_path_escape_rejected');
  const mapped = resolve(boundaryRoot, relative(lexicalRoot, absoluteTarget));
  if (!isContained(boundaryRoot, mapped)) fail('boundary_path_escape_rejected');
  return mapped;
}

function assertNotCloudSynchronized(absolutePath) {
  if (lexicalSegments(absolutePath).some((segment) => CLOUD_SYNC_SEGMENTS.some((pattern) => pattern.test(segment)))) {
    fail('boundary_cloud_sync_rejected');
  }
}

async function assertNoWorktreeOverlap(boundaryRoot, worktreeRoot) {
  assertPathInput(worktreeRoot);
  const lexicalWorktree = resolve(worktreeRoot);
  const worktreeStat = await safeLstat(lexicalWorktree, { allowMissing: true });
  const canonicalWorktree = worktreeStat ? await safeRealpath(lexicalWorktree) : lexicalWorktree;
  if (isContained(canonicalWorktree, boundaryRoot) || isContained(boundaryRoot, canonicalWorktree)) {
    fail('boundary_worktree_overlap_rejected');
  }
}

async function safeLstat(path, { allowMissing = false } = {}) {
  try {
    return await lstat(path);
  } catch (error) {
    if (allowMissing && error && error.code === 'ENOENT') return null;
    if (error && error.code === 'ENOENT') fail('boundary_missing');
    fail('boundary_io_failure');
  }
}

async function safeRealpath(path) {
  try {
    return await realpath(path);
  } catch {
    fail('boundary_realpath_rejected');
  }
}

function assertOwner(stat) {
  if (stat.uid !== effectiveUid()) fail('boundary_owner_invalid');
}

function assertSecureDirectoryStat(stat) {
  if (stat.isSymbolicLink()) fail('boundary_symlink_rejected');
  if (!stat.isDirectory()) fail('boundary_special_file_rejected');
  assertOwner(stat);
  if (modeOf(stat) !== DIRECTORY_MODE) fail('boundary_directory_mode_invalid');
}

function assertSecureFileStat(stat) {
  if (stat.isSymbolicLink()) fail('boundary_symlink_rejected');
  if (!stat.isFile()) fail('boundary_special_file_rejected');
  assertOwner(stat);
  if (modeOf(stat) !== FILE_MODE) fail('boundary_file_mode_invalid');
  if (stat.nlink !== 1) fail('boundary_hardlink_rejected');
}

async function safeReadDir(path, options = undefined) {
  try {
    return await readdir(path, options);
  } catch {
    fail('boundary_io_failure');
  }
}

async function assertRootAndTopLevel(boundaryRoot, worktreeRoot) {
  assertPathInput(boundaryRoot);
  const lexicalRoot = resolve(boundaryRoot);
  assertNotCloudSynchronized(lexicalRoot);

  // Ancestors may include an operating-system alias such as /var ->
  // /private/var. The boundary entry itself must still be a real, secure
  // directory; only then is its canonical root accepted.
  const rootStat = await safeLstat(lexicalRoot);
  assertSecureDirectoryStat(rootStat);
  const canonicalRoot = await safeRealpath(lexicalRoot);
  const canonicalRootStat = await safeLstat(canonicalRoot);
  assertSecureDirectoryStat(canonicalRootStat);
  if (canonicalRootStat.dev !== rootStat.dev || canonicalRootStat.ino !== rootStat.ino) {
    fail('boundary_realpath_rejected');
  }
  assertNotCloudSynchronized(canonicalRoot);
  await assertNoWorktreeOverlap(canonicalRoot, worktreeRoot);

  const entries = await safeReadDir(canonicalRoot, { withFileTypes: true });
  if (entries.length !== RESTRICTED_TOP_LEVEL_DIRECTORIES.length) {
    fail('boundary_top_level_invalid');
  }

  const observed = new Set();
  for (const entry of entries) {
    if (!TOP_LEVEL_SET.has(entry.name) || GIT_MARKERS.has(entry.name)) {
      fail('boundary_top_level_invalid');
    }
    observed.add(entry.name);
    const entryPath = join(canonicalRoot, entry.name);
    const entryStat = await safeLstat(entryPath);
    assertSecureDirectoryStat(entryStat);
    const canonicalEntry = await safeRealpath(entryPath);
    if (!isContained(canonicalRoot, canonicalEntry) || canonicalEntry !== entryPath) {
      fail('boundary_realpath_rejected');
    }
  }
  if (RESTRICTED_TOP_LEVEL_DIRECTORIES.some((name) => !observed.has(name))) {
    fail('boundary_top_level_invalid');
  }

  const keysEntries = await safeReadDir(join(canonicalRoot, 'keys'));
  if (keysEntries.length !== 0) fail('boundary_keys_not_empty');
  return canonicalRoot;
}

function firstBoundarySegment(boundaryRoot, targetPath) {
  const remainder = relative(boundaryRoot, targetPath);
  if (remainder === '') return null;
  return remainder.split(sep)[0];
}

async function assertExistingTargetComponents(
  boundaryRoot,
  targetPath,
  { mustExist = false, kind = 'any' } = {},
) {
  if (!['any', 'file', 'directory'].includes(kind)) fail('boundary_path_input_rejected');
  const remainder = relative(boundaryRoot, targetPath);
  if (remainder === '') {
    if (kind === 'file') fail('boundary_special_file_rejected');
    return { exists: true, stat: await safeLstat(boundaryRoot) };
  }

  let current = boundaryRoot;
  const parts = remainder.split(sep);
  for (let index = 0; index < parts.length; index += 1) {
    current = join(current, parts[index]);
    const stat = await safeLstat(current, { allowMissing: true });
    if (!stat) {
      if (mustExist) fail('boundary_missing');
      const parentCanonical = await safeRealpath(dirname(current));
      if (!isContained(boundaryRoot, parentCanonical)) fail('boundary_realpath_rejected');
      return { exists: false, stat: null };
    }
    if (stat.isSymbolicLink()) fail('boundary_symlink_rejected');
    const isTarget = index === parts.length - 1;
    if (!isTarget || kind === 'directory') {
      assertSecureDirectoryStat(stat);
    } else if (kind === 'file') {
      assertSecureFileStat(stat);
    } else if (stat.isDirectory()) {
      assertSecureDirectoryStat(stat);
    } else {
      assertSecureFileStat(stat);
    }
    const canonical = await safeRealpath(current);
    if (!isContained(boundaryRoot, canonical) || canonical !== current) {
      fail('boundary_realpath_rejected');
    }
  }
  return { exists: true, stat: await safeLstat(targetPath) };
}

/**
 * Resolve a path only after proving that it is contained by the restricted root.
 * No raw value is included in an error. Set operation to "write" to reject keys/.
 */
export async function assertBoundaryPath(
  boundaryRoot,
  targetPath,
  {
    mustExist = false,
    kind = 'any',
    operation = 'read',
    worktreeRoot = DEFAULT_WORKTREE_ROOT,
  } = {},
) {
  if (!['read', 'write'].includes(operation)) fail('boundary_path_input_rejected');
  const canonicalRoot = await assertRootAndTopLevel(boundaryRoot, worktreeRoot);
  const target = resolvedTarget(canonicalRoot, targetPath, boundaryRoot);
  const topLevel = firstBoundarySegment(canonicalRoot, target);
  if (topLevel !== null && !TOP_LEVEL_SET.has(topLevel)) fail('boundary_top_level_invalid');
  if (operation === 'write' && (topLevel === null || topLevel === 'keys')) {
    fail('boundary_keys_write_rejected');
  }
  await assertExistingTargetComponents(canonicalRoot, target, { mustExist, kind });
  return target;
}

async function recursiveAudit(root, current, counters) {
  const entries = await safeReadDir(current, { withFileTypes: true });
  for (const entry of entries) {
    if (GIT_MARKERS.has(entry.name)) fail('boundary_git_marker_rejected');
    const entryPath = join(current, entry.name);
    const stat = await safeLstat(entryPath);
    if (stat.isSymbolicLink()) fail('boundary_symlink_rejected');
    const canonical = await safeRealpath(entryPath);
    if (!isContained(root, canonical) || canonical !== entryPath) fail('boundary_realpath_rejected');
    if (stat.isDirectory()) {
      assertSecureDirectoryStat(stat);
      counters.directories += 1;
      await recursiveAudit(root, entryPath, counters);
    } else if (stat.isFile()) {
      assertSecureFileStat(stat);
      counters.files += 1;
    } else {
      fail('boundary_special_file_rejected');
    }
  }
}

async function safeOpenRead(path) {
  if (!Number.isInteger(fsConstants.O_NOFOLLOW)) fail('boundary_platform_unsupported');
  try {
    return await open(path, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
  } catch {
    fail('boundary_io_failure');
  }
}

export async function readRestrictedFile(
  targetPath,
  {
    boundaryRoot = DEFAULT_RESTRICTED_BOUNDARY,
    worktreeRoot = DEFAULT_WORKTREE_ROOT,
    maximumBytes = MAX_JSON_BYTES,
  } = {},
) {
  if (!Number.isSafeInteger(maximumBytes) || maximumBytes < 0 || maximumBytes > MAX_JSON_BYTES) {
    fail('json_size_rejected');
  }
  const path = await assertBoundaryPath(boundaryRoot, targetPath, {
    mustExist: true,
    kind: 'file',
    operation: 'read',
    worktreeRoot,
  });
  const handle = await safeOpenRead(path);
  try {
    const stat = await handle.stat();
    assertSecureFileStat(stat);
    if (stat.size > maximumBytes) fail('json_size_rejected');
    const bytes = await handle.readFile();
    if (bytes.length > maximumBytes) fail('json_size_rejected');
    return bytes;
  } catch (error) {
    if (error instanceof BoundaryError) throw error;
    fail('boundary_io_failure');
  } finally {
    try {
      await handle.close();
    } catch {
      // The safe operation result is authoritative; never surface path-bearing errors.
    }
  }
}

async function readJsonKnownSafe(path) {
  const handle = await safeOpenRead(path);
  let bytes;
  try {
    const stat = await handle.stat();
    assertSecureFileStat(stat);
    if (stat.size > MAX_JSON_BYTES) fail('json_size_rejected');
    bytes = await handle.readFile();
  } catch (error) {
    if (error instanceof BoundaryError) throw error;
    fail('boundary_io_failure');
  } finally {
    try {
      await handle.close();
    } catch {
      // The operation already has a safe outcome; no raw exception is propagated.
    }
  }
  try {
    return JSON.parse(bytes.toString('utf8'));
  } catch {
    fail('json_parse_rejected');
  }
}

function validateRawId(rawId) {
  if (
    typeof rawId !== 'string'
    || rawId.trim().length === 0
    || rawId.includes('\0')
    || Buffer.byteLength(rawId, 'utf8') > MAX_RAW_ID_BYTES
  ) {
    fail('alias_input_rejected');
  }
  return rawId;
}

function validateNamespace(namespace) {
  if (typeof namespace !== 'string' || !NAMESPACE_PATTERN.test(namespace)) {
    fail('alias_input_rejected');
  }
  return namespace;
}

function aliasPatternFor(namespace) {
  return new RegExp(`^opaque_${namespace}_[A-Za-z0-9_-]{43}$`, 'u');
}

function assertAliasMapValue(value) {
  if (!exactKeys(value, ['schema_version', 'aliases'])
    || value.schema_version !== ALIAS_MAP_SCHEMA
    || !Array.isArray(value.aliases)) {
    fail('alias_map_invalid');
  }

  const rawKeys = new Set();
  const aliases = new Set();
  for (const entry of value.aliases) {
    if (!exactKeys(entry, ['namespace', 'raw_id', 'alias'])) fail('alias_map_invalid');
    try {
      validateNamespace(entry.namespace);
      validateRawId(entry.raw_id);
    } catch {
      fail('alias_map_invalid');
    }
    if (typeof entry.alias !== 'string' || !aliasPatternFor(entry.namespace).test(entry.alias)) {
      fail('alias_map_invalid');
    }
    const rawKey = `${entry.namespace}\0${entry.raw_id}`;
    if (rawKeys.has(rawKey) || aliases.has(entry.alias)) fail('alias_map_invalid');
    rawKeys.add(rawKey);
    aliases.add(entry.alias);
  }
  return value;
}

async function aliasCountIfPresent(boundaryRoot) {
  const mapPath = resolvedTarget(boundaryRoot, DEFAULT_ALIAS_MAP_RELATIVE_PATH);
  const stat = await safeLstat(mapPath, { allowMissing: true });
  if (!stat) return 0;
  assertSecureFileStat(stat);
  const map = assertAliasMapValue(await readJsonKnownSafe(mapPath));
  return map.aliases.length;
}

async function ensureAdvisoryLockFile(lockPath) {
  if (!Number.isInteger(fsConstants.O_NOFOLLOW)) fail('boundary_platform_unsupported');
  let handle;
  let created = false;
  try {
    try {
      handle = await open(
        lockPath,
        fsConstants.O_RDWR | fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_NOFOLLOW,
        FILE_MODE,
      );
      created = true;
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error;
      handle = await open(lockPath, fsConstants.O_RDWR | fsConstants.O_NOFOLLOW);
    }
    if (created) await handle.chmod(FILE_MODE);
    const stat = await handle.stat();
    assertSecureFileStat(stat);
    await handle.close();
    handle = null;
    if (created) await syncDirectory(dirname(lockPath));
  } catch (error) {
    await handle?.close().catch(() => {});
    if (error instanceof BoundaryError) throw error;
    fail('boundary_io_failure');
  }
}

async function acquireAdvisoryAliasLock(lockPath, { timeoutSeconds = 5 } = {}) {
  if (!Number.isSafeInteger(timeoutSeconds) || timeoutSeconds < 0 || timeoutSeconds > 60) {
    fail('boundary_io_failure');
  }
  await ensureAdvisoryLockFile(lockPath);
  const child = spawn(LOCKF_PATH, [
    '-k', '-s', '-t', String(timeoutSeconds), lockPath,
    process.execPath, '-e', LOCK_HOLDER_SOURCE,
  ], {
    stdio: ['pipe', 'pipe', 'ignore'],
  });
  child.stdin.on('error', () => {
    // Exit status below remains the authoritative ownership signal.
  });
  let readyBuffer = '';
  let lost = false;
  const ready = new Promise((resolveReady) => {
    child.stdout.on('data', (chunk) => {
      readyBuffer += chunk.toString('utf8');
      if (readyBuffer.includes(`${LOCK_READY_MARKER}\n`)) resolveReady({ kind: 'ready' });
    });
  });
  const exited = new Promise((resolveExit) => {
    child.once('error', () => resolveExit({ kind: 'error' }));
    child.once('exit', (code, signal) => {
      lost = true;
      resolveExit({ kind: 'exit', code, signal });
    });
  });
  const outcome = await Promise.race([ready, exited]);
  if (outcome.kind !== 'ready') {
    child.stdin.destroy();
    if (outcome.kind === 'exit' && outcome.code === 75) fail('alias_lock_busy');
    fail('boundary_platform_unsupported');
  }
  return {
    path: lockPath,
    child,
    exited,
    get lost() { return lost; },
    released: false,
  };
}

async function releaseAdvisoryAliasLock(lock) {
  if (!lock || lock.released || lock.lost) fail('alias_lock_busy');
  lock.released = true;
  lock.child.stdin.end();
  const outcome = await lock.exited;
  if (outcome.kind !== 'exit' || outcome.code !== 0 || outcome.signal !== null) {
    fail('boundary_cleanup_failed');
  }
}

function assertAdvisoryAliasLockHeld(lock) {
  if (!lock || lock.released || lock.lost) fail('alias_lock_busy');
}

// Advisory locks are released by the kernel when their holder exits, so no
// stale pathname takeover or unlink operation is needed. This probe is kept
// exported for boundary checks and focused concurrency regression tests.
export async function recoverStaleAliasLock(lockPath, { whileLockHeld = null } = {}) {
  if (whileLockHeld !== null && typeof whileLockHeld !== 'function') {
    fail('boundary_io_failure');
  }
  const lock = await acquireAdvisoryAliasLock(lockPath, { timeoutSeconds: 0 });
  try {
    if (whileLockHeld) await whileLockHeld();
    return true;
  } finally {
    await releaseAdvisoryAliasLock(lock);
  }
}

async function boundaryCheck(phase, { boundaryRoot, worktreeRoot }) {
  const root = await assertRootAndTopLevel(boundaryRoot, worktreeRoot);
  const counters = { directories: 0, files: 0 };
  await recursiveAudit(root, root, counters);
  await recoverStaleAliasLock(join(root, ALIAS_LOCK_RELATIVE_PATH));
  const aliasCount = await aliasCountIfPresent(root);
  return Object.freeze({
    schema_version: CHECK_SCHEMA,
    phase,
    status: 'PASS',
    top_level_directory_count: RESTRICTED_TOP_LEVEL_DIRECTORIES.length,
    directories_scanned: counters.directories,
    regular_files_scanned: counters.files,
    keys_entry_count: 0,
    alias_count: aliasCount,
  });
}

export async function preflightRestrictedBoundary({
  boundaryRoot = DEFAULT_RESTRICTED_BOUNDARY,
  worktreeRoot = DEFAULT_WORKTREE_ROOT,
} = {}) {
  return boundaryCheck('preflight', { boundaryRoot, worktreeRoot });
}

export async function postflightRestrictedBoundary({
  boundaryRoot = DEFAULT_RESTRICTED_BOUNDARY,
  worktreeRoot = DEFAULT_WORKTREE_ROOT,
} = {}) {
  return boundaryCheck('postflight', { boundaryRoot, worktreeRoot });
}

function runMutationGuard(mutationGuard) {
  if (mutationGuard === null || mutationGuard === undefined) return;
  if (typeof mutationGuard !== 'function') fail('boundary_write_failed');
  mutationGuard();
}

async function safeMkdir(path, mutationGuard = null) {
  runMutationGuard(mutationGuard);
  try {
    await mkdir(path, { mode: DIRECTORY_MODE });
    runMutationGuard(mutationGuard);
    await chmod(path, DIRECTORY_MODE);
  } catch (error) {
    if (error?.name === 'ExtractionOperationLockError') throw error;
    if (!error || error.code !== 'EEXIST') fail('boundary_io_failure');
  }
  const stat = await safeLstat(path);
  assertSecureDirectoryStat(stat);
}

async function ensureWritableParent(boundaryRoot, targetPath, mutationGuard = null) {
  const remainder = relative(boundaryRoot, dirname(targetPath));
  if (remainder === '' || remainder === '..' || remainder.startsWith(`..${sep}`)) {
    fail('boundary_path_escape_rejected');
  }
  const parts = remainder.split(sep);
  if (!TOP_LEVEL_SET.has(parts[0])) fail('boundary_top_level_invalid');
  if (parts[0] === 'keys') fail('boundary_keys_write_rejected');

  let current = boundaryRoot;
  for (const part of parts) {
    current = join(current, part);
    const stat = await safeLstat(current, { allowMissing: true });
    if (!stat) await safeMkdir(current, mutationGuard);
    else assertSecureDirectoryStat(stat);
    const canonical = await safeRealpath(current);
    if (!isContained(boundaryRoot, canonical) || canonical !== current) {
      fail('boundary_realpath_rejected');
    }
  }
}

async function syncDirectory(path, mutationGuard = null) {
  if (!Number.isInteger(fsConstants.O_DIRECTORY) || !Number.isInteger(fsConstants.O_NOFOLLOW)) {
    fail('boundary_platform_unsupported');
  }
  let handle;
  try {
    handle = await open(
      path,
      fsConstants.O_RDONLY | fsConstants.O_DIRECTORY | fsConstants.O_NOFOLLOW,
    );
    runMutationGuard(mutationGuard);
    await handle.sync();
  } catch (error) {
    if (error?.name === 'ExtractionOperationLockError') throw error;
    fail('boundary_fsync_failed');
  } finally {
    if (handle) {
      try {
        await handle.close();
      } catch {
        // Never surface or log an underlying exception containing path context.
      }
    }
  }
}

async function removeTemporary(path, mutationGuard = null) {
  try {
    runMutationGuard(mutationGuard);
    await unlink(path);
  } catch (error) {
    if (error?.name === 'ExtractionOperationLockError') throw error;
    if (!error || error.code !== 'ENOENT') fail('boundary_cleanup_failed');
  }
}

function bytesForWrite(data) {
  if (typeof data === 'string') return Buffer.from(data, 'utf8');
  if (Buffer.isBuffer(data)) return data;
  if (data instanceof Uint8Array) return Buffer.from(data);
  fail('boundary_write_failed');
}

export async function atomicWriteRestrictedFile(
  targetPath,
  data,
  {
    boundaryRoot = DEFAULT_RESTRICTED_BOUNDARY,
    worktreeRoot = DEFAULT_WORKTREE_ROOT,
    mutationGuard = null,
  } = {},
) {
  if (mutationGuard !== null && typeof mutationGuard !== 'function') {
    fail('boundary_write_failed');
  }
  const root = await assertRootAndTopLevel(boundaryRoot, worktreeRoot);
  const target = resolvedTarget(root, targetPath, boundaryRoot);
  const topLevel = firstBoundarySegment(root, target);
  if (topLevel === null || topLevel === 'keys' || !TOP_LEVEL_SET.has(topLevel)) {
    fail('boundary_keys_write_rejected');
  }
  await ensureWritableParent(root, target, mutationGuard);
  await assertExistingTargetComponents(root, target, { mustExist: false, kind: 'file' });

  const payload = bytesForWrite(data);
  if (payload.byteLength > MAX_JSON_BYTES) fail('json_size_rejected');
  if (!Number.isInteger(fsConstants.O_NOFOLLOW)) fail('boundary_platform_unsupported');

  const parent = dirname(target);
  const temporary = join(parent, `.boundary-write-${randomBytes(18).toString('hex')}.tmp`);
  let handle;
  let created = false;
  let renamed = false;
  try {
    runMutationGuard(mutationGuard);
    handle = await open(
      temporary,
      fsConstants.O_WRONLY
        | fsConstants.O_CREAT
        | fsConstants.O_EXCL
        | fsConstants.O_NOFOLLOW,
      FILE_MODE,
    );
    created = true;
    runMutationGuard(mutationGuard);
    await handle.chmod(FILE_MODE);
    runMutationGuard(mutationGuard);
    await handle.writeFile(payload);
    runMutationGuard(mutationGuard);
    await handle.sync();
    await handle.close();
    handle = null;

    const temporaryStat = await safeLstat(temporary);
    assertSecureFileStat(temporaryStat);
    const existing = await safeLstat(target, { allowMissing: true });
    if (existing) assertSecureFileStat(existing);
    runMutationGuard(mutationGuard);
    await rename(temporary, target);
    renamed = true;
    await syncDirectory(parent, mutationGuard);
    const finalStat = await safeLstat(target);
    assertSecureFileStat(finalStat);
  } catch (error) {
    if (error instanceof BoundaryError
        || error?.name === 'ExtractionOperationLockError') throw error;
    fail('boundary_write_failed');
  } finally {
    if (handle) {
      try {
        await handle.close();
      } catch {
        // The safe cleanup below is authoritative.
      }
    }
    if (created && !renamed) {
      let cleanupAllowed = true;
      try {
        runMutationGuard(mutationGuard);
      } catch (error) {
        if (error?.name === 'ExtractionOperationLockError') cleanupAllowed = false;
        else throw error;
      }
      if (cleanupAllowed) await removeTemporary(temporary, mutationGuard);
    }
  }
  return Object.freeze({ status: 'WRITTEN', bytes_written: payload.byteLength });
}

export async function readRestrictedJson(
  targetPath,
  {
    boundaryRoot = DEFAULT_RESTRICTED_BOUNDARY,
    worktreeRoot = DEFAULT_WORKTREE_ROOT,
  } = {},
) {
  const path = await assertBoundaryPath(boundaryRoot, targetPath, {
    mustExist: true,
    kind: 'file',
    operation: 'read',
    worktreeRoot,
  });
  return readJsonKnownSafe(path);
}

export async function writeRestrictedJson(
  targetPath,
  value,
  options = {},
) {
  let serialized;
  try {
    serialized = `${JSON.stringify(value, null, 2)}\n`;
  } catch {
    fail('json_input_rejected');
  }
  if (serialized === 'undefined\n') fail('json_input_rejected');
  return atomicWriteRestrictedFile(targetPath, serialized, options);
}

async function acquireAliasLock(boundaryRoot, worktreeRoot) {
  const lockPath = await assertBoundaryPath(boundaryRoot, ALIAS_LOCK_RELATIVE_PATH, {
    mustExist: false,
    kind: 'file',
    operation: 'write',
    worktreeRoot,
  });
  return acquireAdvisoryAliasLock(lockPath, { timeoutSeconds: 5 });
}

async function releaseAliasLock(lock) {
  await releaseAdvisoryAliasLock(lock);
}

async function loadAliasMap(boundaryRoot, worktreeRoot, mapRelativePath) {
  const path = await assertBoundaryPath(boundaryRoot, mapRelativePath, {
    mustExist: false,
    kind: 'file',
    operation: 'write',
    worktreeRoot,
  });
  const stat = await safeLstat(path, { allowMissing: true });
  if (!stat) return { schema_version: ALIAS_MAP_SCHEMA, aliases: [] };
  assertSecureFileStat(stat);
  return assertAliasMapValue(await readJsonKnownSafe(path));
}

function createUniqueAlias(namespace, existing) {
  for (let attempt = 0; attempt < 16; attempt += 1) {
    const alias = `opaque_${namespace}_${randomBytes(32).toString('base64url')}`;
    if (!existing.has(alias)) return alias;
  }
  fail('boundary_io_failure');
}

export async function getOrCreateOpaqueAliases(
  rawIds,
  {
    boundaryRoot = DEFAULT_RESTRICTED_BOUNDARY,
    worktreeRoot = DEFAULT_WORKTREE_ROOT,
    namespace = 'source',
    mapRelativePath = DEFAULT_ALIAS_MAP_RELATIVE_PATH,
  } = {},
) {
  if (!Array.isArray(rawIds)) fail('alias_input_rejected');
  const checkedNamespace = validateNamespace(namespace);
  const checkedRawIds = rawIds.map(validateRawId);
  if (checkedRawIds.length === 0) return [];

  const root = await assertRootAndTopLevel(boundaryRoot, worktreeRoot);
  const lock = await acquireAliasLock(root, worktreeRoot);
  try {
    assertAdvisoryAliasLockHeld(lock);
    const map = await loadAliasMap(root, worktreeRoot, mapRelativePath);
    assertAdvisoryAliasLockHeld(lock);
    const byRawKey = new Map(
      map.aliases.map((entry) => [`${entry.namespace}\0${entry.raw_id}`, entry.alias]),
    );
    const existingAliases = new Set(map.aliases.map((entry) => entry.alias));
    let changed = false;

    for (const rawId of checkedRawIds) {
      const rawKey = `${checkedNamespace}\0${rawId}`;
      if (!byRawKey.has(rawKey)) {
        const alias = createUniqueAlias(checkedNamespace, existingAliases);
        existingAliases.add(alias);
        byRawKey.set(rawKey, alias);
        map.aliases.push({ namespace: checkedNamespace, raw_id: rawId, alias });
        changed = true;
      }
    }

    if (changed) {
      map.aliases.sort((left, right) => {
        if (left.alias < right.alias) return -1;
        if (left.alias > right.alias) return 1;
        return 0;
      });
      assertAliasMapValue(map);
      assertAdvisoryAliasLockHeld(lock);
      await writeRestrictedJson(mapRelativePath, map, { boundaryRoot: root, worktreeRoot });
      assertAdvisoryAliasLockHeld(lock);
    }
    assertAdvisoryAliasLockHeld(lock);
    return checkedRawIds.map((rawId) => byRawKey.get(`${checkedNamespace}\0${rawId}`));
  } finally {
    await releaseAliasLock(lock);
  }
}

export async function getOrCreateOpaqueAlias(rawId, options = {}) {
  const [alias] = await getOrCreateOpaqueAliases([rawId], options);
  return alias;
}

export async function assertAliasMapIntegrity({
  boundaryRoot = DEFAULT_RESTRICTED_BOUNDARY,
  worktreeRoot = DEFAULT_WORKTREE_ROOT,
  mapRelativePath = DEFAULT_ALIAS_MAP_RELATIVE_PATH,
} = {}) {
  const root = await assertRootAndTopLevel(boundaryRoot, worktreeRoot);
  const map = await loadAliasMap(root, worktreeRoot, mapRelativePath);
  assertAliasMapValue(map);
  return Object.freeze({ status: 'PASS', alias_count: map.aliases.length });
}
