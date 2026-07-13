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
assert.equal(projectRef, PROJECT_REF, `MMC-505 browser smoke refuses non-staging Supabase project ${projectRef || '(missing)'}.`);

const port = Number(process.env.MMC_505_BROWSER_SMOKE_PORT || 19885);
const origin = `http://127.0.0.1:${port}`;
const sessionSecret = 'mmc-505-local-browser-smoke-secret';
const cookieValue = createEncryptedSession(sessionSecret, {
  version: 1,
  issuedAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  csrfToken: 'csrf-mmc-505-local-smoke',
  authSource: 'mmc-505-local-browser-smoke',
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
  const rosterStudents = Array.isArray(persistence.state?.rosterStudents) ? persistence.state.rosterStudents : [];
  assert.ok(rosterStudents.some((student) => student.id === 'ignacio-anzola'), 'Persistence read model must include verified Ignacio roster student.');

  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.MMC_505_CHROME_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
  });
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
  await page.waitForFunction(() => window.MMC_OWNERSHIP_RUNTIME && document.documentElement.dataset.mmcSchemaPersistenceStatus === 'connected', null, { timeout: 20000 });
  const runtimeProof = await page.evaluate(() => {
    const roster = window.MMC_OWNERSHIP_RUNTIME.getRosterStudents();
    const ignacio = roster.find((student) => student.id === 'ignacio-anzola') || null;
    const bundle = window.MMC_OWNERSHIP_RUNTIME.getStudentBundle('ignacio-anzola');
    window.switchScreen('directory');
    document.getElementById('student-search').value = 'Ignacio';
    window.filterStudents();
    const directoryText = document.body.innerText;
    window.openProfile('ignacio-anzola');
    const profileText = document.body.innerText;
    window.openCallPrep('ignacio-anzola');
    const callPrepText = document.body.innerText;
    window.switchScreen('meeting');
    window.selectMeetingStudent('ignacio-anzola');
    const meetingText = document.body.innerText;
    return {
      rosterCount: roster.length,
      rosterHasIgnacio: roster.some((student) => student.id === 'ignacio-anzola'),
      directoryHasIgnacio: directoryText.includes('Ignacio Anzola'),
      canonicalStudentIdentity: Boolean(ignacio && ignacio.canonicalStudentIdentity),
      assignedToMentor: Boolean(bundle.assignment),
      sessions: bundle.sessions.length,
      snapshots: bundle.intelligenceSnapshots.length,
      memory: bundle.memory.length,
      openLoops: bundle.openLoops.length,
      directoryTextHasIgnacio: directoryText.includes('Ignacio Anzola'),
      profileTextHasIgnacio: profileText.includes('Ignacio Anzola'),
      callPrepTextHasIgnacio: callPrepText.includes('Ignacio Anzola'),
      meetingTextHasIgnacio: meetingText.includes('Ignacio Anzola'),
      meetingTextHasHistory: meetingText.includes('Meeting History'),
      meetingTextHasPipelineOutput: meetingText.includes('Pipeline Output') || meetingText.includes('Pipeline Readback'),
      meetingTextHasNextMove: meetingText.includes('NEXT BEST COACHING MOVE'),
    };
  });

  assert.equal(runtimeProof.rosterHasIgnacio, true, 'Runtime roster bridge must expose Ignacio.');
  assert.equal(runtimeProof.directoryHasIgnacio, true, 'Global student selector/list must include Ignacio.');
  assert.equal(runtimeProof.canonicalStudentIdentity, true, 'Ignacio must carry verified canonical identity metadata from staging bridge.');
  assert.equal(runtimeProof.assignedToMentor, true, 'Ignacio must be marked assigned to mentor.');
  assert.ok(runtimeProof.sessions >= 1, 'Ignacio must expose meeting/session history.');
  assert.ok(runtimeProof.snapshots >= 1, 'Ignacio must expose intelligence snapshots.');
  assert.equal(runtimeProof.directoryTextHasIgnacio, true, 'Directory must render Ignacio.');
  assert.equal(runtimeProof.profileTextHasIgnacio, true, 'Student Profile must render Ignacio.');
  assert.equal(runtimeProof.callPrepTextHasIgnacio, true, 'Call Prep/Mentor Memory must render Ignacio.');
  assert.equal(runtimeProof.meetingTextHasIgnacio, true, 'Meeting Intelligence must render Ignacio.');
  assert.equal(runtimeProof.meetingTextHasHistory, true, 'Meeting Intelligence must show meeting history.');
  assert.equal(runtimeProof.meetingTextHasNextMove, true, 'Meeting Intelligence must show next best move.');
  assert.deepEqual(consoleErrors, [], `Browser console errors detected: ${consoleErrors.join('\n')}`);
  assert.deepEqual(externalRequests, [], `Unexpected browser external requests: ${externalRequests.join('\n')}`);

  const screenshotDir = path.join(rootDir, '_AI_HANDOFFS/from_codex');
  if (!existsSync(screenshotDir)) mkdirSync(screenshotDir, { recursive: true });
  const screenshotPath = path.join(screenshotDir, 'MMC-505_BROWSER_SMOKE_MEETING_INTELLIGENCE.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await browser.close();

  console.log(JSON.stringify({
    result: 'MMC-505 roster identity browser smoke passed',
    origin,
    projectRef: persistence.projectRef,
    screenshotPath,
    runtimeProof,
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
  const deadline = Date.now() + 20000;
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
