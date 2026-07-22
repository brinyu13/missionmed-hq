import crypto from 'node:crypto';

export function assert(condition, message) {
  if (!condition) throw new Error(message);
}

export function assertEqual(actual, expected, message) {
  if (!Object.is(actual, expected)) {
    throw new Error(`${message} (expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)})`);
  }
}

export async function runChecks(suite, checks, claims = {}) {
  const startedAt = Date.now();
  const results = [];
  for (const [name, check] of checks) {
    const checkStartedAt = Date.now();
    try {
      await check();
      results.push({ name, status: 'PASS', durationMs: Date.now() - checkStartedAt });
    } catch (error) {
      results.push({ name, status: 'FAIL', durationMs: Date.now() - checkStartedAt, error: error.message });
    }
  }
  const failures = results.filter((result) => result.status === 'FAIL');
  const summary = {
    suite,
    status: failures.length ? 'FAIL' : 'PASS',
    browserEngineClaim: claims.browserEngineClaim || 'NOT_RUN',
    axeClaim: claims.axeClaim || 'NOT_RUN',
    firefoxClaim: claims.firefoxClaim || 'NOT_RUN',
    webkitClaim: claims.webkitClaim || 'NOT_RUN',
    passed: results.length - failures.length,
    total: results.length,
    durationMs: Date.now() - startedAt,
    results,
  };
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  if (failures.length) {
    const error = new Error(`${suite}: ${failures.length} of ${results.length} checks failed.`);
    error.summary = summary;
    throw error;
  }
  return summary;
}

export function installPageProbe(page, allowedBaseUrl) {
  const probe = {
    consoleErrors: [],
    pageErrors: [],
    failedRequests: [],
    unexpectedResponses: [],
    externalRequests: [],
  };
  page.on('console', (message) => {
    if (message.type() === 'error') probe.consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => probe.pageErrors.push(error.message));
  page.on('requestfailed', (request) => {
    probe.failedRequests.push({ url: request.url(), failure: request.failure()?.errorText || 'unknown' });
  });
  page.on('response', (response) => {
    if (response.status() >= 400) probe.unexpectedResponses.push({ url: response.url(), status: response.status() });
  });
  page.on('request', (request) => {
    const url = request.url();
    if (/^https?:/u.test(url) && !url.startsWith(`${allowedBaseUrl}/`) && url !== allowedBaseUrl) {
      probe.externalRequests.push(url);
    }
  });
  return probe;
}

export async function waitForCamShell(page, { timeout = 10_000 } = {}) {
  await page.getByTestId('cam-shell').waitFor({ state: 'visible', timeout });
}

export async function waitForRouteReady(page, { timeout = 10_000, allowState = null } = {}) {
  await waitForCamShell(page, { timeout });
  if (allowState) {
    await page.getByTestId(`state-${allowState}`).waitFor({ state: 'visible', timeout });
    return;
  }
  await page.getByTestId('route-stage').waitFor({ state: 'visible', timeout });
  await page.waitForFunction(() => {
    const stage = document.querySelector('[data-testid="route-stage"]');
    return Boolean(stage && stage.getAttribute('aria-busy') !== 'true' && document.body?.dataset.camReady === 'true');
  }, null, { timeout });
}

export async function assertNoHorizontalOverflow(page, tolerance = 1) {
  const metrics = await page.evaluate(() => ({
    documentClientWidth: document.documentElement.clientWidth,
    documentScrollWidth: document.documentElement.scrollWidth,
    bodyClientWidth: document.body?.clientWidth || 0,
    bodyScrollWidth: document.body?.scrollWidth || 0,
  }));
  assert(
    metrics.documentScrollWidth <= metrics.documentClientWidth + tolerance,
    `Document horizontally overflows: ${JSON.stringify(metrics)}`,
  );
  assert(
    metrics.bodyScrollWidth <= Math.max(metrics.bodyClientWidth, metrics.documentClientWidth) + tolerance,
    `Body horizontally overflows: ${JSON.stringify(metrics)}`,
  );
  return metrics;
}

export async function assertNoSensitiveBrowserText(page) {
  const text = await page.locator('body').innerText();
  const forbidden = [
    /\/Users\//u,
    /(?:sk|pk|rk)-[A-Za-z0-9_-]{16,}/u,
    /\bBearer\s+[A-Za-z0-9._~+/-]{8,}/iu,
    /service[_-]?role/iu,
    /SUPABASE_(?:SERVICE|SECRET|KEY)/u,
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/u,
  ];
  const matched = forbidden.find((pattern) => pattern.test(text));
  assert(!matched, `Rendered browser text matched a forbidden sensitive-value pattern: ${matched}`);
}

export function assertCleanProbe(probe, {
  allowFailedRequests = 0,
  allowHttpStatuses = [],
  allowConsolePatterns = [],
} = {}) {
  const consoleErrors = probe.consoleErrors.filter((entry) => !allowConsolePatterns.some((pattern) => pattern.test(entry)));
  const responses = probe.unexpectedResponses.filter((entry) => !allowHttpStatuses.includes(entry.status));
  assertEqual(probe.externalRequests.length, 0, `Unexpected external requests: ${probe.externalRequests.join(', ')}`);
  assertEqual(probe.pageErrors.length, 0, `Page errors: ${probe.pageErrors.join(' | ')}`);
  assert(probe.failedRequests.length <= allowFailedRequests, `Unexpected failed requests: ${JSON.stringify(probe.failedRequests)}`);
  assertEqual(responses.length, 0, `Unexpected HTTP responses: ${JSON.stringify(responses)}`);
  assertEqual(consoleErrors.length, 0, `Console errors: ${consoleErrors.join(' | ')}`);
}

export function createCommand(kind, {
  targetId,
  expectedVersion = 7,
  payload = {},
  purpose = `Fixture validation for ${kind}`,
  idempotencyKey = null,
} = {}) {
  const commandId = crypto.randomUUID();
  return {
    commandId,
    idempotencyKey: idempotencyKey || `fixture:${kind}:${commandId}`,
    expectedVersion,
    targetId,
    kind,
    purpose,
    payload,
    schemaVersion: 1,
  };
}

export function parseCliArgs(argv = process.argv.slice(2)) {
  const options = Object.create(null);
  for (const argument of argv) {
    if (argument === '--headed') options.headed = true;
    else if (argument === '--smoke') options.smoke = true;
    else if (argument.startsWith('--fixture=')) options.fixture = argument.slice('--fixture='.length);
    else if (argument.startsWith('--route=')) options.route = argument.slice('--route='.length);
    else if (argument.startsWith('--duration-ms=')) options.durationMs = Number(argument.slice('--duration-ms='.length));
    else if (argument.startsWith('--output=')) options.output = argument.slice('--output='.length);
    else throw new Error(`Unknown review harness argument: ${argument}`);
  }
  return options;
}

export function waitForShutdownSignal({ durationMs = null } = {}) {
  return new Promise((resolve) => {
    let timer = null;
    const done = (signal) => {
      process.off('SIGINT', onSigint);
      process.off('SIGTERM', onSigterm);
      if (timer) clearTimeout(timer);
      resolve(signal);
    };
    const onSigint = () => done('SIGINT');
    const onSigterm = () => done('SIGTERM');
    process.once('SIGINT', onSigint);
    process.once('SIGTERM', onSigterm);
    if (Number.isFinite(durationMs) && durationMs >= 0) timer = setTimeout(() => done('duration'), durationMs);
  });
}
