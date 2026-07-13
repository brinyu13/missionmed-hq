import assert from 'node:assert/strict';
import { createCipheriv, createHash, randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..', '..');
const runtimeRequire = createRequire('/Users/brianb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/');
const { chromium } = runtimeRequire('playwright');

const PROJECT_REF = 'avpdetdkpwmqqxtvomix';
const SUPABASE_URL = String(process.env.MMHQ_MMC_SUPABASE_URL || '').trim();
const projectRef = SUPABASE_URL ? new URL(SUPABASE_URL).hostname.split('.')[0].toLowerCase() : '';
assert.equal(projectRef, PROJECT_REF, `MMC-506 browser smoke refuses non-staging Supabase project ${projectRef || '(missing)'}.`);

const port = Number(process.env.MMC_506_BROWSER_SMOKE_PORT || 19887);
const origin = `http://127.0.0.1:${port}`;
const sessionSecret = 'mmc-506-local-browser-smoke-secret';
const cookieValue = createEncryptedSession(sessionSecret, {
  version: 1,
  issuedAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  csrfToken: 'csrf-mmc-506-local-browser-smoke',
  authSource: 'mmc-506-local-browser-smoke',
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

  const persistence = await fetchJson(`${origin}/api/mmc/persistence`, cookieValue);
  assert.equal(persistence.ok, true, 'Persistence GET must succeed.');
  assert.equal(persistence.projectRef, PROJECT_REF, 'Persistence GET must remain on staging project.');
  assert.ok((persistence.state?.rosterStudents || []).some((student) => student.id === 'ignacio-anzola'), 'Ignacio verified roster student must exist before browser smoke.');

  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.MMC_506_CHROME_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1200 } });
  await context.addCookies([{
    name: 'mmhq_session',
    value: cookieValue,
    domain: '127.0.0.1',
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
  }]);
  const page = await context.newPage();
  const consoleErrors = [];
  const externalRequests = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('request', (request) => {
    const requestUrl = new URL(request.url());
    if (requestUrl.origin !== origin) externalRequests.push(request.url());
  });

  await page.goto(`${origin}/mmc-private/`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.MMC_OWNERSHIP_RUNTIME && document.documentElement.dataset.mmcSchemaPersistenceStatus === 'connected', null, { timeout: 25000 });
  const proof = await page.evaluate(async () => {
    window.switchScreen('meeting');
    window.selectMeetingStudent('ignacio-anzola');
    window.renderPipelineAdmin();
    await window.refreshPipelineAdmin();
    window.renderPipelineAdmin();
    const meetingText = document.body.innerText;
    window.switchScreen('directory');
    const search = document.getElementById('student-search');
    if (search) search.value = 'Ignacio';
    window.filterStudents();
    const directoryText = document.body.innerText;
    window.openProfile('ignacio-anzola');
    const profileText = document.body.innerText;
    window.openCallPrep('ignacio-anzola');
    const callPrepText = document.body.innerText;
    window.switchScreen('meeting');
    window.selectMeetingStudent('ignacio-anzola');
    window.renderPipelineAdmin();
    const finalText = document.body.innerText;
    const runtime = window.MMC_OWNERSHIP_RUNTIME;
    const bundle = runtime.getStudentBundle('ignacio-anzola');
    return {
      rosterHasIgnacio: runtime.getRosterStudents().some((student) => student.id === 'ignacio-anzola'),
      directoryHasIgnacio: directoryText.includes('Ignacio Anzola'),
      profileHasIgnacio: profileText.includes('Ignacio Anzola'),
      callPrepHasIgnacio: callPrepText.includes('Ignacio Anzola'),
      meetingHasIgnacio: finalText.includes('Ignacio Anzola') || meetingText.includes('Ignacio Anzola'),
      meetingHasHistory: finalText.includes('Meeting History') || meetingText.includes('Meeting History'),
      meetingHasNextMove: finalText.includes('NEXT BEST COACHING MOVE') || meetingText.includes('NEXT BEST COACHING MOVE'),
      pipelineAdminVisible: Boolean(document.querySelector('[data-testid="pipeline-admin-panel"]')),
      rosterCardVisible: Boolean(document.querySelector('[data-testid="pipeline-roster-verification-card"]')),
      evidenceInputVisible: Boolean(document.querySelector('[data-testid="pipeline-roster-evidence-json"]')),
      sessions: bundle.sessions.length,
      snapshots: bundle.intelligenceSnapshots.length,
      memory: bundle.memory.length,
      openLoops: bundle.openLoops.length,
    };
  });

  assert.equal(proof.rosterHasIgnacio, true, 'Roster runtime must include verified Ignacio.');
  assert.equal(proof.directoryHasIgnacio, true, 'Directory must include verified Ignacio.');
  assert.equal(proof.profileHasIgnacio, true, 'Student Profile must include verified Ignacio.');
  assert.equal(proof.callPrepHasIgnacio, true, 'Call Prep/Mentor Memory must include verified Ignacio.');
  assert.equal(proof.meetingHasIgnacio, true, 'Meeting Intelligence must include verified Ignacio.');
  assert.equal(proof.meetingHasHistory, true, 'Meeting Intelligence must render meeting history.');
  assert.equal(proof.meetingHasNextMove, true, 'Meeting Intelligence must render next best move.');
  assert.equal(proof.pipelineAdminVisible, true, 'Pipeline Admin must render.');
  assert.equal(proof.rosterCardVisible, true, 'Roster verification admin card must render.');
  assert.equal(proof.evidenceInputVisible, true, 'Evidence envelope review control must render.');
  assert.ok(proof.sessions >= 1, 'Ignacio must have session history.');
  assert.ok(proof.snapshots >= 1, 'Ignacio must have persisted intelligence snapshots.');
  assert.deepEqual(consoleErrors, [], `Browser console errors detected: ${consoleErrors.join('\n')}`);
  assert.deepEqual(externalRequests, [], `Unexpected browser external requests: ${externalRequests.join('\n')}`);

  const screenshotDir = path.join(rootDir, '_AI_HANDOFFS/from_codex');
  if (!existsSync(screenshotDir)) mkdirSync(screenshotDir, { recursive: true });
  const screenshotPath = path.join(screenshotDir, 'MMC-506_BROWSER_SMOKE_ROSTER_VERIFICATION.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await browser.close();

  console.log(JSON.stringify({
    result: 'MMC-506 roster verification browser smoke passed',
    origin,
    projectRef: persistence.projectRef,
    screenshotPath,
    proof,
    consoleErrors: consoleErrors.length,
    externalRequests: externalRequests.length,
  }, null, 2));
} finally {
  server.kill('SIGTERM');
  await new Promise((resolve) => {
    const timeout = setTimeout(resolve, 2000);
    server.once('exit', () => {
      clearTimeout(timeout);
      resolve();
    });
  });
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

async function fetchJson(url, cookie) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      Cookie: `mmhq_session=${cookie}`,
    },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload) {
    throw new Error(`GET ${url} failed with ${response.status}: ${JSON.stringify(payload)}`);
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
