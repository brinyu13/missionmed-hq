import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..', '..');
const publicRoot = path.join(rootDir, 'missionmed-hq/public/mmc-private');
const runtimeRequire = createRequire('/Users/brianb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/');
const { chromium } = runtimeRequire('playwright');
const port = Number(process.env.MMC_507_BROWSER_SMOKE_PORT || 19907);
const origin = `http://127.0.0.1:${port}`;

const server = createServer(async (request, response) => {
  const url = new URL(request.url || '/', origin);
  if (url.pathname.startsWith('/api/mmc/persistence')) {
    sendJson(response, 200, {
      ok: true,
      csrfToken: 'csrf-mmc-507-browser-smoke',
      projectRef: 'local-browser-smoke',
      state: {},
      persistedDomains: [],
      writeCount: 0,
    });
    return;
  }
  if (url.pathname.startsWith('/api/mmc/coaching-pipeline')) {
    sendJson(response, 200, pipelinePayload(url.pathname.replace('/api/mmc/coaching-pipeline', '') || '/'));
    return;
  }

  const pathname = url.pathname === '/' ? '/mmc-private/' : url.pathname;
  const relative = pathname.startsWith('/mmc-private/')
    ? pathname.slice('/mmc-private/'.length)
    : pathname.replace(/^\/+/u, '');
  const filePath = path.normalize(path.join(publicRoot, relative || 'index.html'));
  if (!filePath.startsWith(publicRoot) || !existsSync(filePath)) {
    response.writeHead(404);
    response.end('not found');
    return;
  }
  response.writeHead(200, { 'content-type': contentType(filePath) });
  response.end(readFileSync(filePath));
});

await new Promise((resolve) => server.listen(port, resolve));

try {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.MMC_507_CHROME_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  const page = await context.newPage();
  const consoleErrors = [];
  const externalRequests = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('request', (request) => {
    const requestUrl = new URL(request.url());
    if (requestUrl.origin !== origin && requestUrl.protocol !== 'data:') externalRequests.push(request.url());
  });

  await page.goto(`${origin}/mmc-private/`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.MMCApp && window.renderPipelineAdmin), null, { timeout: 15000 });
  const proof = await page.evaluate(async () => {
    window.switchScreen('meeting');
    window.renderPipelineAdmin();
    await window.refreshPipelineAdmin();
    window.renderPipelineAdmin();
    const panel = document.querySelector('[data-testid="pipeline-webex-trigger-status"]');
    const pullButton = document.querySelector('[data-testid="pipeline-webex-pull"]');
    const triggerInput = document.querySelector('[data-testid="pipeline-webex-triggers"]');
    const initialTriggerInputValue = triggerInput ? triggerInput.value : '';
    if (triggerInput) {
      triggerInput.value = '[MM-GRP]';
      triggerInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
    return {
      panelVisible: Boolean(panel),
      tokenMissingVisible: document.body.innerText.includes('Token Missing'),
      pullGateClosedVisible: document.body.innerText.includes('Pull Gate Closed'),
      defaultTriggerVisible: document.body.innerText.includes('[MM-ADV]'),
      ignoredRuleVisible: document.body.innerText.includes('Untriggered recordings are ignored'),
      localConfigVisible: document.body.innerText.includes('stored locally for Pipeline Admin review'),
      triggerInputValue: initialTriggerInputValue,
      persistedTriggerValue: localStorage.getItem('mmc.private.webexAllowedTriggers.mentor-brian.v1') || '',
      pullButtonDisabled: pullButton ? pullButton.disabled : false,
      pipelineAdminVisible: Boolean(document.querySelector('[data-testid="pipeline-admin-panel"]')),
    };
  });

  assert.equal(proof.panelVisible, true, 'Webex trigger status panel must render.');
  assert.equal(proof.tokenMissingVisible, true, 'Browser smoke must show safe missing-token state.');
  assert.equal(proof.pullGateClosedVisible, true, 'Browser smoke must show pull gate closed.');
  assert.equal(proof.defaultTriggerVisible, true, 'Default [MM-ADV] trigger must be visible.');
  assert.equal(proof.ignoredRuleVisible, true, 'Ignored untriggered policy must be visible.');
  assert.equal(proof.localConfigVisible, true, 'Local-only trigger configuration note must be visible.');
  assert.equal(proof.triggerInputValue, '[MM-ADV]', 'Trigger input must default to [MM-ADV].');
  assert.equal(proof.persistedTriggerValue, '[MM-GRP]', 'Trigger input changes must persist locally for Pipeline Admin.');
  assert.equal(proof.pullButtonDisabled, true, 'Pull button must be disabled without token/gate.');
  assert.equal(proof.pipelineAdminVisible, true, 'Pipeline Admin must remain visible.');
  assert.deepEqual(consoleErrors, [], `Browser console errors detected: ${consoleErrors.join('\n')}`);
  assert.deepEqual(externalRequests, [], `Unexpected browser external requests: ${externalRequests.join('\n')}`);

  const screenshotDir = path.join(rootDir, '_AI_HANDOFFS/from_codex');
  if (!existsSync(screenshotDir)) mkdirSync(screenshotDir, { recursive: true });
  const screenshotPath = path.join(screenshotDir, 'MMC-507_BROWSER_SMOKE_WEBEX_TRIGGER_PANEL.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await browser.close();

  console.log(JSON.stringify({
    result: 'MMC-507 Webex trigger browser smoke passed',
    origin,
    screenshotPath,
    proof,
    consoleErrors: consoleErrors.length,
    externalRequests: externalRequests.length,
  }, null, 2));
} finally {
  await new Promise((resolve) => server.close(resolve));
}

function pipelinePayload(route) {
  if (route === '/' || route === '/status') {
    return {
      ok: true,
      status: 'VERIFIED',
      principalRole: 'admin',
      routes: ['GET /api/mmc/coaching-pipeline/webex/status', 'GET /api/mmc/coaching-pipeline/webex/recordings'],
    };
  }
  if (route === '/inventory') return { ok: true, status: 'VERIFIED', candidates: [] };
  if (route === '/source-assets') return { ok: true, status: 'VERIFIED', data: [] };
  if (route === '/worker/status') {
    return {
      ok: true,
      status: 'VERIFIED',
      dropZone: {
        path: '/Users/brianb/MissionMed/VIDEO_SYSTEM/DROP_ZONE/MISSION_RESIDENCY/MissionWebexVideos',
        exists: true,
        knownTypoSiblingExists: true,
      },
      dbQueue: { reviewRequired: 0, analysisReady: 0, analyzed: 0 },
      protections: { dailyDrillsWatcherStarted: false, videoRegistryWritten: false },
    };
  }
  if (route === '/worker/scan') return { ok: true, status: 'VERIFIED', candidates: [], incomplete: [] };
  if (route === '/webex/status') {
    return {
      ok: true,
      status: 'UNVERIFIED',
      mode: 'webex-triggered-recording-pull',
      tokenConfigured: false,
      pullEnabled: false,
      dropZonePath: '/Users/brianb/MissionMed/VIDEO_SYSTEM/DROP_ZONE/MISSION_RESIDENCY/MissionWebexVidoes',
      allowedTriggers: ['[MM-ADV]'],
      supportedTriggers: ['[MM-ADV]', '[MM-GRP]', '[MM-MOCK]', '[MM-PS]', '[MM-IGNORE]'],
      triggerPolicy: {
        defaultAllowed: '[MM-ADV]',
        explicitDeny: '[MM-IGNORE]',
      },
    };
  }
  if (route === '/webex/recordings') {
    return {
      ok: true,
      status: 'UNVERIFIED',
      configured: false,
      allowedTriggers: ['[MM-ADV]'],
      allowed: [],
      ignored: [],
      data: [],
    };
  }
  if (route === '/student-resolution/review-queue') return { ok: true, status: 'VERIFIED', data: [] };
  if (route === '/roster-verification/sources') return { ok: true, status: 'VERIFIED', sources: [] };
  return { ok: true, status: 'VERIFIED' };
}

function sendJson(response, status, payload) {
  response.writeHead(status, { 'content-type': 'application/json' });
  response.end(JSON.stringify(payload));
}

function contentType(filePath) {
  if (filePath.endsWith('.css')) return 'text/css';
  if (filePath.endsWith('.js')) return 'application/javascript';
  if (filePath.endsWith('.html')) return 'text/html';
  return 'application/octet-stream';
}
