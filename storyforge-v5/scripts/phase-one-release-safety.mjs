import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

function safetyError(message) {
  return new Error(`StoryForge Phase 1 release safety failed: ${message}`);
}

function executableSql(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/--[^\r\n]*/g, '');
}

export function assertPhaseOneStudentOnlyRecordingPolicies({
  packageDir,
} = {}) {
  if (!packageDir) throw safetyError('a StoryForge package directory is required.');
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
  const policyNames = [
    'sf_recording_sessions_rw',
    'sf_recording_segments_rw',
  ];
  const liveStudentRole =
    /sf_has_live_identity\s*\(\s*ARRAY\s*\[\s*'student'(?:\s*::\s*text)?\s*\]\s*\)/i;

  for (const [index, policyName] of policyNames.entries()) {
    const start = sql.indexOf(`CREATE POLICY ${policyName} `);
    const nextPolicy = index + 1 < policyNames.length
      ? sql.indexOf(`CREATE POLICY ${policyNames[index + 1]} `, start + 1)
      : sql.indexOf('REVOKE ALL ON public.sf_recording_sessions', start + 1);
    if (start < 0 || nextPolicy < 0) {
      throw safetyError(`${policyName} is missing from M1.`);
    }
    const policy = sql.slice(start, nextPolicy);
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
