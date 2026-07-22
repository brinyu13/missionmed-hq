#!/usr/bin/env node

import { createIsolatedContext, withReviewBrowser } from './playwright-runtime.mjs';
import { PRIMARY_SUBJECT_ID, SECONDARY_SUBJECT_ID } from './fixture-data.mjs';
import { withReviewServer } from './review-server.mjs';
import {
  assert,
  assertCleanProbe,
  assertEqual,
  installPageProbe,
  runChecks,
  waitForRouteReady,
} from './review-test-kit.mjs';

await withReviewServer({ scenario: 'default' }, async (review) => {
  await withReviewBrowser({}, async ({ browser }) => {
    const context = await createIsolatedContext(browser, { viewport: { width: 1024, height: 768 } });
    try {
      const first = await context.newPage();
      const second = await context.newPage();
      const firstProbe = installPageProbe(first, review.baseUrl);
      const secondProbe = installPageProbe(second, review.baseUrl);
      await Promise.all([
        first.goto(review.url('/mmc-private/today'), { waitUntil: 'domcontentloaded' }),
        second.goto(review.url('/mmc-private/today'), { waitUntil: 'domcontentloaded' }),
      ]);
      await Promise.all([waitForRouteReady(first), waitForRouteReady(second)]);
      let winning = null;

      await runChecks('MMC CAM 007 multi-tab fencing browser validation', [
        ['two tabs race one active session and exactly one commits', async () => {
          const [left, right] = await Promise.all([
            postStart(first, PRIMARY_SUBJECT_ID, 'Left-tab session race'),
            postStart(second, PRIMARY_SUBJECT_ID, 'Right-tab session race'),
          ]);
          const results = [left, right].sort((a, b) => a.status - b.status);
          assertEqual(results[0].status, 200, `No tab committed the active session: ${JSON.stringify(results)}`);
          assertEqual(results[1].status, 409, `The second tab was not fenced: ${JSON.stringify(results)}`);
          assertEqual(results[0].payload.status, 'COMMITTED', 'Winner did not receive a committed typed result');
          assertEqual(results[1].payload.error.code, 'ACTIVE_SESSION_CONFLICT', 'Loser conflict did not name the active-session invariant');
          winning = results[0].payload.readback;
        }],
        ['winning session readback remains subject-pinned', async () => {
          assert(winning?.id, 'Winning session readback was not retained');
          assertEqual(winning.subjectLinkId, PRIMARY_SUBJECT_ID, 'Winning session changed subject');
          const response = await first.evaluate(async ({ sessionId }) => {
            const result = await fetch(`/api/mmc/v2/mentor/sessions/${encodeURIComponent(sessionId)}/live`, { credentials: 'same-origin' });
            return { status: result.status, payload: await result.json() };
          }, { sessionId: winning.id });
          assertEqual(response.status, 200, 'Winning live-session query failed');
          assertEqual(response.payload.data.subjectLinkId, PRIMARY_SUBJECT_ID, 'Live-session query changed subject');
          assertEqual(response.payload.data.subjectLocked, true, 'Live-session query did not preserve subject lock');
        }],
        ['cross-subject capture against winning session is denied', async () => {
          const response = await first.evaluate(async ({ sessionId, wrongSubjectId, expectedVersion }) => {
            const auth = await fetch('/api/auth/session', { credentials: 'same-origin' }).then((result) => result.json());
            const commandId = crypto.randomUUID();
            const result = await fetch('/api/mmc/v2/mentor/commands', {
              method: 'POST',
              credentials: 'same-origin',
              headers: { 'Content-Type': 'application/json', 'X-MMHQ-CSRF': auth.csrfToken },
              body: JSON.stringify({
                commandId,
                idempotencyKey: `multitab-cross-subject-${commandId}`,
                expectedVersion: 0,
                targetId: crypto.randomUUID(),
                kind: 'capture.save',
                purpose: 'Verify cross-subject capture denial',
                payload: {
                  subjectLinkId: wrongSubjectId,
                  sessionId,
                  captureKind: 'QUESTION',
                  text: 'This synthetic cross-subject capture must be rejected.',
                },
                schemaVersion: 1,
              }),
            });
            return { status: result.status, payload: await result.json() };
          }, { sessionId: winning.id, wrongSubjectId: SECONDARY_SUBJECT_ID, expectedVersion: winning.version });
          assert(response.status >= 400, 'Cross-subject capture was accepted');
          assert(['MENTOR_RESOURCE_NOT_FOUND', 'MENTOR_SUBJECT_MISMATCH'].includes(response.payload.error.code), `Unexpected cross-subject denial: ${JSON.stringify(response)}`);
        }],
        ['frontend creates no durable browser cache or service worker', async () => {
          const state = await first.evaluate(async () => ({
            localStorage: localStorage.length,
            sessionStorage: sessionStorage.length,
            serviceWorkerControlled: Boolean(navigator.serviceWorker?.controller),
            indexedDatabases: typeof indexedDB.databases === 'function' ? (await indexedDB.databases()).length : 0,
          }));
          assertEqual(state.localStorage, 0, 'Frontend wrote localStorage');
          assertEqual(state.sessionStorage, 0, 'Frontend wrote sessionStorage');
          assertEqual(state.serviceWorkerControlled, false, 'Frontend is controlled by a service worker');
          assertEqual(state.indexedDatabases, 0, 'Frontend created IndexedDB storage');
        }],
        ['both tabs stayed same-origin without runtime errors', async () => {
          assertCleanProbe(firstProbe, {
            allowHttpStatuses: [404, 409],
            allowConsolePatterns: [expectedResourceConsole(404), expectedResourceConsole(409)],
          });
          assertCleanProbe(secondProbe, {
            allowHttpStatuses: [409],
            allowConsolePatterns: [expectedResourceConsole(409)],
          });
        }],
      ], {
        browserEngineClaim: `Chromium via local system Google Chrome (${await browser.version()})`,
      });
    } finally {
      await context.close();
    }
  });
});

function postStart(page, subjectLinkId, objective) {
  return page.evaluate(async ({ subjectLinkId: subject, objective: callObjective }) => {
    const auth = await fetch('/api/auth/session', { credentials: 'same-origin' }).then((result) => result.json());
    const commandId = crypto.randomUUID();
    const response = await fetch('/api/mmc/v2/mentor/commands', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-MMHQ-CSRF': auth.csrfToken },
      body: JSON.stringify({
        commandId,
        idempotencyKey: `multitab-session-${commandId}`,
        expectedVersion: 0,
        targetId: crypto.randomUUID(),
        kind: 'session.start',
        purpose: 'Verify one-active-session multi-tab fencing',
        payload: { subjectLinkId: subject, objective: callObjective },
        schemaVersion: 1,
      }),
    });
    return { status: response.status, payload: await response.json() };
  }, { subjectLinkId, objective });
}

function expectedResourceConsole(status) {
  return new RegExp(`Failed to load resource: the server responded with a status of ${status}\\b`, 'u');
}
