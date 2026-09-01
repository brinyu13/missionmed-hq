import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

function safetyError(message) {
  return new Error(`HomeBase Phase 1 release safety failed: ${message}`);
}

function executableSql(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/--[^\r\n]*/g, '');
}

export function assertPhaseOneStudentOnlyRecordingPolicies({
  packageDir,
} = {}) {
  if (!packageDir) throw safetyError('a HomeBase package directory is required.');
  const migrationFile = path.join(
    packageDir,
    'infra',
    'postgres',
    'migrations',
    '20260729000100_b1_506_voice_recording_sessions.sql',
  );
  let source;
  try {
    source = readFileSync(migrationFile, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') {
      throw safetyError('the B1-506 M1 migration is missing.');
    }
    throw error;
  }
  const sql = executableSql(source);
  if (
    /ALTER\s+POLICY\b[\s\S]*?\bON\s+public\.sf_recording_(?:sessions|segments)\b/i
      .test(sql)
  ) {
    throw safetyError('M1 may not alter a recording policy after its approved definition.');
  }
  if (/sf_has_live_identity\s*\(\s*\)/i.test(sql)) {
    throw safetyError('M1 contains an unrestricted live-identity policy predicate.');
  }
  const expectedPolicies = new Map([
    ['sf_recording_sessions_rw', 'authenticated'],
    ['sf_recording_segments_rw', 'authenticated'],
    ['sf_recording_sessions_service', 'homebase_app'],
    ['sf_recording_segments_service', 'homebase_app'],
  ]);
  const recordingPolicies = sql
    .split(';')
    .map((statement) => statement.trim())
    .filter((statement) => (
      /^CREATE\s+POLICY\b/i.test(statement)
      && /\bON\s+public\.sf_recording_(?:sessions|segments)\b/i.test(statement)
    ));
  if (recordingPolicies.length !== expectedPolicies.size) {
    throw safetyError('M1 must define exactly the four approved recording policies.');
  }
  const policiesByName = new Map();
  for (const policy of recordingPolicies) {
    const definition = policy.match(
      /^CREATE\s+POLICY\s+([a-z0-9_]+)\s+ON\s+public\.sf_recording_(?:sessions|segments)\s+FOR\s+ALL\s+TO\s+([a-z0-9_]+)\b/i,
    );
    if (!definition) {
      throw safetyError('M1 contains a malformed recording policy definition.');
    }
    const [, policyName, roleName] = definition;
    if (
      !expectedPolicies.has(policyName)
      || expectedPolicies.get(policyName) !== roleName
      || policiesByName.has(policyName)
    ) {
      throw safetyError(`M1 contains an unexpected or duplicate recording policy: ${policyName}.`);
    }
    policiesByName.set(policyName, policy);
  }
  const liveStudentRole =
    /sf_has_live_identity\s*\(\s*ARRAY\s*\[\s*'student'(?:\s*::\s*text)?\s*\]\s*\)/i;

  for (const policyName of [
    'sf_recording_sessions_rw',
    'sf_recording_segments_rw',
  ]) {
    const policy = policiesByName.get(policyName);
    if (!policy) {
      throw safetyError(`${policyName} is missing from M1.`);
    }
    if (/\bOR\b/i.test(policy)) {
      throw safetyError(`${policyName} may not broaden access with OR.`);
    }
    const usingStart = policy.indexOf('USING (');
    const withCheckStart = policy.indexOf('WITH CHECK (');
    if (usingStart < 0 || withCheckStart < 0 || usingStart >= withCheckStart) {
      throw safetyError(`${policyName} has malformed RLS clauses.`);
    }
    if (!liveStudentRole.test(policy.slice(usingStart, withCheckStart))) {
      throw safetyError(`${policyName} USING does not require a live student identity.`);
    }
    if (!liveStudentRole.test(policy.slice(withCheckStart))) {
      throw safetyError(`${policyName} WITH CHECK does not require a live student identity.`);
    }
    const helperCount = policy.match(
      /sf_has_live_identity\s*\(\s*ARRAY\s*\[\s*'student'(?:\s*::\s*text)?\s*\]\s*\)/gi,
    )?.length || 0;
    if (helperCount !== 2) {
      throw safetyError(`${policyName} must contain exactly two student-only identity checks.`);
    }
  }

  return Object.freeze({
    ok: true,
    gate: 'student-only-recording-rls',
    migration: path.relative(packageDir, migrationFile),
  });
}

const executedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (import.meta.url === executedPath) {
  const packageDir = path.resolve(path.dirname(process.argv[1]), '..');
  console.log(JSON.stringify(
    assertPhaseOneStudentOnlyRecordingPolicies({ packageDir }),
  ));
}
