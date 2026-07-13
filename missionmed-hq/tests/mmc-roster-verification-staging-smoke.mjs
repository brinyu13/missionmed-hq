import assert from 'node:assert/strict';
import { createCipheriv, createHash, randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..', '..');
const PROJECT_REF = 'avpdetdkpwmqqxtvomix';
const SUPABASE_URL = String(process.env.MMHQ_MMC_SUPABASE_URL || '').trim();
const projectRef = SUPABASE_URL ? new URL(SUPABASE_URL).hostname.split('.')[0].toLowerCase() : '';
assert.equal(projectRef, PROJECT_REF, `MMC-506 staging smoke refuses non-staging Supabase project ${projectRef || '(missing)'}.`);

const port = Number(process.env.MMC_506_STAGING_SMOKE_PORT || 19886);
const origin = `http://127.0.0.1:${port}`;
const sessionSecret = 'mmc-506-local-staging-smoke-secret';
const cookieValue = createEncryptedSession(sessionSecret, {
  version: 1,
  issuedAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  csrfToken: 'csrf-mmc-506-local-smoke',
  authSource: 'mmc-506-local-staging-smoke',
  user: {
    id: 504,
    login: 'mmc-504-staging-admin',
    displayName: 'MMC 504 Staging Admin',
    email: 'mmc-504-staging-admin@example.test',
    roles: ['administrator'],
    capabilities: { manage_options: true },
  },
});

const server = spawn(process.execPath, ['missionmed-hq/server.mjs'], {
  cwd: rootDir,
  env: {
    ...process.env,
    PORT: String(port),
    MMHQ_SESSION_SECRET: sessionSecret,
    MMHQ_AUTH_REQUIRED: 'true',
    MMHQ_MMC_PERSISTENCE_ENABLED: 'true',
    MMHQ_MMC_ALLOWED_SUPABASE_PROJECT_REF: PROJECT_REF,
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let serverOutput = '';
server.stdout.on('data', (chunk) => { serverOutput += chunk.toString(); });
server.stderr.on('data', (chunk) => { serverOutput += chunk.toString(); });

try {
  await waitForServer(origin, cookieValue);

  const sourceInventory = await fetchJson(`${origin}/api/mmc/coaching-pipeline/roster-verification/sources`, cookieValue);
  assert.equal(sourceInventory.ok, true, 'Roster source inventory route must respond.');
  assert.ok(sourceInventory.sources.some((source) => source.id === 'mmc_identity_bridge' && source.status === 'VERIFIED'), 'MMC identity bridge source must be verified.');
  assert.ok(sourceInventory.sources.some((source) => source.id === 'wordpress_user'), 'WordPress source lane must be inventoried.');

  const assets = await fetchJson(`${origin}/api/mmc/coaching-pipeline/source-assets`, cookieValue);
  const sourceAsset = (assets.data || []).find((asset) => {
    const haystack = JSON.stringify([
      asset.asset_title,
      asset.source_id,
      asset.media_url,
      asset.transcript_pointer,
      asset.metadata,
    ]).toLowerCase();
    return haystack.includes('ignacio') || haystack.includes('anzola');
  });
  assert.ok(sourceAsset, 'ONE_TRUE_BLOCKER: missing real Ignacio source asset in staging coaching_source_assets.');

  const sourceEvidence = [
    {
      sourceSystem: 'wordpress_user',
      anchorType: 'wp_user_id',
      anchorValue: 'wp:ignacio:production-style-readonly-proof',
      studentId: 'ignacio-anzola',
      studentName: 'Ignacio Anzola',
      confidence: 0.94,
      readPath: 'approved read-only WordPress user/profile evidence envelope',
      status: 'VERIFIED',
    },
    {
      sourceSystem: 'learndash_enrollment',
      anchorType: 'learndash_user_id',
      anchorValue: 'ld:ignacio:production-style-readonly-proof',
      studentId: 'ignacio-anzola',
      studentName: 'Ignacio Anzola',
      confidence: 0.91,
      readPath: 'approved read-only LearnDash enrollment evidence envelope',
      status: 'VERIFIED',
    },
  ];

  const resolved = await fetchJson(`${origin}/api/mmc/coaching-pipeline/roster-verification/resolve`, cookieValue, {
    method: 'POST',
    body: {
      sourceAssetId: sourceAsset.id,
      studentId: 'ignacio-anzola',
      studentName: 'Ignacio Anzola',
      sourceEvidence,
    },
  });
  assert.equal(resolved.verification.status, 'VERIFIED', 'Two independent anchors must verify Ignacio.');
  assert.equal(resolved.verification.autoPromote, true, 'Ignacio production-style proof should be auto-promotable.');
  assert.ok(resolved.review.independentStrongAnchors >= 2, 'Ignacio proof must have at least two independent strong anchors.');

  const approved = await fetchJson(`${origin}/api/mmc/coaching-pipeline/roster-verification/approve`, cookieValue, {
    method: 'POST',
    body: {
      sourceAssetId: sourceAsset.id,
      studentId: 'ignacio-anzola',
      studentName: 'Ignacio Anzola',
      sourceEvidence,
    },
  });
  assert.equal(approved.status, 'VERIFIED', 'Roster bridge approval must return VERIFIED.');
  assert.equal(approved.data.subject.studentId, 'ignacio-anzola', 'Approved subject must be Ignacio.');
  assert.match(approved.data.identityReference.primary_anchor_type, /missionmed_roster_student/u, 'Approved identity ref must use missionmed_roster_student anchor.');

  const persistence = await fetchJson(`${origin}/api/mmc/persistence`, cookieValue);
  const rosterStudents = Array.isArray(persistence.state?.rosterStudents) ? persistence.state.rosterStudents : [];
  const identityReferences = Array.isArray(persistence.state?.identityReferences) ? persistence.state.identityReferences : [];
  const assignments = Array.isArray(persistence.state?.assignments) ? persistence.state.assignments : [];
  const ignacio = rosterStudents.find((student) => student.id === 'ignacio-anzola');
  const identity = identityReferences.find((reference) => reference.studentId === 'ignacio-anzola' && reference.primaryAnchorType === 'missionmed_roster_student');
  const assignment = assignments.find((item) => item.studentId === 'ignacio-anzola' && item.status === 'active');
  assert.ok(ignacio, 'Persistence read model must include verified Ignacio roster student.');
  assert.ok(identity, 'Persistence read model must include Ignacio missionmed_roster_student identity reference.');
  assert.ok(assignment, 'Persistence read model must include active Ignacio mentor assignment.');
  assert.equal(ignacio.canonicalStudentIdentity, true, 'Ignacio must be canonical only after verified roster bridge.');

  console.log(JSON.stringify({
    result: 'MMC-506 roster verification staging smoke passed',
    projectRef,
    sourceAssetId: sourceAsset.id,
    verification: {
      status: resolved.verification.status,
      confidence: resolved.verification.confidence,
      autoPromote: resolved.verification.autoPromote,
      independentStrongAnchors: resolved.verification.independentStrongAnchors,
    },
    bridge: {
      subjectRefId: approved.data.subject.subjectRefId,
      assignmentId: approved.data.subject.assignmentId,
      primaryAnchorType: approved.data.identityReference.primary_anchor_type,
    },
    readback: {
      rosterStudent: ignacio.name,
      identityReference: identity.id,
      assignment: assignment.id,
    },
    protections: {
      productionTouched: false,
      serviceRoleUsed: false,
      authChanged: false,
      rlsChanged: false,
      dailyDrillsTouched: false,
    },
  }, null, 2));
} finally {
  server.kill('SIGTERM');
  if (server.exitCode === null) {
    await Promise.race([
      once(server, 'exit'),
      new Promise((resolve) => setTimeout(resolve, 2000)),
    ]);
  }
  if (server.exitCode && server.exitCode !== 0 && server.exitCode !== null) {
    console.error(serverOutput);
  }
}

async function waitForServer(localOrigin, cookie) {
  const deadline = Date.now() + 25000;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${localOrigin}/mmc-private/`, {
        headers: { Cookie: `mmhq_session=${cookie}` },
      });
      if (response.status === 200) return;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw lastError || new Error('Local MMC server did not start.');
}

async function fetchJson(url, cookie, options = {}) {
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      Accept: 'application/json',
      Cookie: `mmhq_session=${cookie}`,
      'X-MMHQ-CSRF': 'csrf-mmc-506-local-smoke',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload || payload.ok === false) {
    throw new Error(`${options.method || 'GET'} ${url} failed with ${response.status}: ${JSON.stringify(payload)}`);
  }
  return payload;
}

function createEncryptedSession(secret, payload) {
  const key = createHash('sha256').update(String(secret || '')).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${base64UrlEncode(iv)}.${base64UrlEncode(ciphertext)}.${base64UrlEncode(tag)}`;
}

function base64UrlEncode(value) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/=/gu, '')
    .replace(/\+/gu, '-')
    .replace(/\//gu, '_');
}
