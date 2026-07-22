#!/usr/bin/env node

import { createIsolatedContext, withReviewBrowser } from './playwright-runtime.mjs';
import { PRIMARY_SESSION_ID, PRIMARY_SUBJECT_ID } from './fixture-data.mjs';
import { withReviewServer } from './review-server.mjs';
import {
  assert,
  assertCleanProbe,
  assertEqual,
  assertNoHorizontalOverflow,
  assertNoSensitiveBrowserText,
  installPageProbe,
  runChecks,
  waitForRouteReady,
} from './review-test-kit.mjs';

const ROUTES = Object.freeze([
  ['/mmc-private/today', 'Today', 'attention-list'],
  ['/mmc-private/students', 'Students', 'student-directory'],
  [`/mmc-private/students/${PRIMARY_SUBJECT_ID}/overview`, 'Overview', 'student-workspace'],
  [`/mmc-private/students/${PRIMARY_SUBJECT_ID}/plan`, 'Plan', 'student-workspace'],
  [`/mmc-private/students/${PRIMARY_SUBJECT_ID}/history`, 'History', 'student-workspace'],
  [`/mmc-private/students/${PRIMARY_SUBJECT_ID}/files`, 'Files', 'student-workspace'],
  [`/mmc-private/students/${PRIMARY_SUBJECT_ID}/prep`, 'Call prep', 'call-prep'],
  [`/mmc-private/students/${PRIMARY_SUBJECT_ID}/history/sessions/${PRIMARY_SESSION_ID}`, 'Session detail', 'student-workspace'],
  ['/mmc-private/work', 'Work', 'work-queue'],
  ['/mmc-private/reviews', 'Reviews', 'reviews-workspace'],
  ['/mmc-private/operations', 'Operations', 'operations-workspace'],
]);

await withReviewServer({ scenario: 'default' }, async (review) => {
  await withReviewBrowser({}, async ({ browser, runtime }) => {
    const context = await createIsolatedContext(browser, { viewport: { width: 1280, height: 800 } });
    try {
      const page = await context.newPage();
      page.setDefaultTimeout(8_000);
      const probe = installPageProbe(page, review.baseUrl);

      await runChecks('MMC CAM 007 route and workflow browser validation', [
        ['canonical private root replaces to Today', async () => {
          await page.goto(review.url('/mmc-private/'), { waitUntil: 'domcontentloaded' });
          await waitForRouteReady(page);
          assertEqual(new URL(page.url()).pathname, '/mmc-private/today', 'Private root did not canonicalize to Today');
          await page.getByRole('heading', { level: 1, name: 'Today' }).waitFor();
        }],
        ['every mentor and Operations route renders its real frontend stage', async () => {
          for (const [route, heading, testId] of ROUTES) {
            await page.goto(review.url(route), { waitUntil: 'domcontentloaded' });
            await waitForRouteReady(page);
            await page.getByRole('heading', { level: 1, name: heading }).waitFor({ state: 'visible' });
            await page.getByTestId(testId).waitFor({ state: 'visible' });
            await assertNoHorizontalOverflow(page);
            await assertNoSensitiveBrowserText(page);
            assertEqual(new URL(page.url()).pathname, route, `Route identity drifted for ${route}`);
          }
        }],
        ['rail navigation performs same-origin client routing', async () => {
          await page.goto(review.url('/mmc-private/today'), { waitUntil: 'domcontentloaded' });
          await waitForRouteReady(page);
          await page.getByTestId('cam-rail').getByRole('link', { name: /Students/u }).click();
          await waitForRouteReady(page);
          assertEqual(new URL(page.url()).pathname, '/mmc-private/students', 'Rail navigation did not update route identity');
          await page.getByTestId('student-directory').waitFor({ state: 'visible' });
          assertEqual(await page.getByTestId('cam-rail').getByRole('link', { name: /Students/u }).getAttribute('aria-current'), 'page', 'Current navigation state is missing');
        }],
        ['directory selection owns student route context', async () => {
          await page.goto(review.url('/mmc-private/students'), { waitUntil: 'domcontentloaded' });
          await waitForRouteReady(page);
          const first = page.getByTestId('student-directory').getByRole('link', { name: 'Open workspace' }).first();
          await first.click();
          await waitForRouteReady(page);
          assert(new URL(page.url()).pathname.includes('/mmc-private/students/subject_007_'), 'Directory did not establish route-owned subject identity');
          await page.getByTestId('student-workspace').waitFor({ state: 'visible' });
          await page.getByText('Fixture · synthetic data').waitFor({ state: 'visible' });
        }],
        ['review and Operations deep links request exact resources and render the selected item', async () => {
          const scaleContext = await createIsolatedContext(browser, { viewport: { width: 1280, height: 800 } });
          try {
            const deepReview = await scaleContext.newPage();
            const deepReviewProbe = installPageProbe(deepReview, review.baseUrl);
            const reviewRoute = '/mmc-private/reviews/ai_claim/review_scale_000500';
            const expectedReviewApi = '/api/mmc/v2/mentor/reviews/ai_claim/review_scale_000500';
            const reviewRequestPromise = deepReview.waitForRequest((request) => (
              request.method() === 'GET' && new URL(request.url()).pathname === expectedReviewApi
            ));
            await deepReview.goto(review.url(reviewRoute, 'scale'), { waitUntil: 'domcontentloaded' });
            const reviewRequest = await reviewRequestPromise;
            assertEqual(new URL(reviewRequest.url()).pathname, expectedReviewApi, 'Review deep link requested a collection substitute');
            await waitForRouteReady(deepReview, { timeout: 15_000 });
            const selectedReview = deepReview.getByTestId('reviews-workspace');
            await selectedReview.waitFor({ state: 'visible' });
            assertEqual(await selectedReview.getAttribute('data-review-id'), 'review_scale_000500', 'Review deep link did not select its opaque item');
            await deepReview.getByText('Synthetic proposal 000500', { exact: true }).first().waitFor({ state: 'visible' });
            assertCleanProbe(deepReviewProbe);
          } finally {
            await scaleContext.close();
          }

          const operationsContext = await createIsolatedContext(browser, { viewport: { width: 1280, height: 800 } });
          try {
            const deepOperations = await operationsContext.newPage();
            const deepOperationsProbe = installPageProbe(deepOperations, review.baseUrl);
            const operationsRoute = '/mmc-private/operations/audit/audit_item_opaque_007';
            const expectedOperationsApi = '/api/mmc/v2/mentor/operations/audit/audit_item_opaque_007';
            const operationsRequestPromise = deepOperations.waitForRequest((request) => (
              request.method() === 'GET' && new URL(request.url()).pathname === expectedOperationsApi
            ));
            await deepOperations.goto(review.url(operationsRoute), { waitUntil: 'domcontentloaded' });
            const operationsRequest = await operationsRequestPromise;
            assertEqual(new URL(operationsRequest.url()).pathname, expectedOperationsApi, 'Operations deep link requested a collection substitute');
            await waitForRouteReady(deepOperations);
            await deepOperations.getByTestId('operations-workspace').waitFor({ state: 'visible' });
            await deepOperations.getByText('Selected opaque item: audit_item_opaque_007', { exact: true }).waitFor({ state: 'visible' });
            assertCleanProbe(deepOperationsProbe);
          } finally {
            await operationsContext.close();
          }
        }],
        ['attention defer and dismiss commands preserve strict versioned readback', async () => {
          await page.goto(review.url('/mmc-private/today'), { waitUntil: 'domcontentloaded' });
          await waitForRouteReady(page);
          const dispositions = [
            ['attention.defer', 'DEFERRED', 'Defer fixture condition with an explicit bounded reason.'],
            ['attention.dismiss', 'DISMISSED', 'Dismiss fixture condition after explicit human review.'],
          ];
          for (const [kind, expectedDisposition, reason] of dispositions) {
            const control = page.locator(`button[data-decision-kind="${kind}"]:visible`).first();
            const targetId = await control.getAttribute('data-object-id');
            assert(targetId, `${kind} control did not carry a target identity`);
            await control.click();
            const dialog = page.locator('#attention-decision-dialog');
            await dialog.waitFor({ state: 'visible' });
            await dialog.getByLabel('Reason').fill(reason);
            await dialog.getByLabel('Return to the queue after').selectOption('24');
            const responsePromise = page.waitForResponse((response) => (
              response.request().method() === 'POST'
                && new URL(response.url()).pathname === '/api/mmc/v2/mentor/commands'
            ));
            await dialog.getByRole('button', { name: 'Apply queue decision' }).click();
            const response = await responsePromise;
            assertEqual(response.status(), 200, `${kind} was not acknowledged`);
            const result = await response.json();
            assertEqual(result.status, 'COMMITTED', `${kind} did not return a committed raw result`);
            assertEqual(result.readback.kind, 'ATTENTION', `${kind} readback kind drifted`);
            assertEqual(result.readback.id, targetId, `${kind} readback identity drifted`);
            const persisted = review.storeForScenario('default').repository.snapshot().attentions.get(targetId);
            assertEqual(persisted?.disposition, expectedDisposition, `${kind} did not persist its disposition`);
            await waitForRouteReady(page);
          }
        }],
        ['unknown private route fails honestly without legacy fallback', async () => {
          await page.goto(review.url('/mmc-private/not-a-real-route'), { waitUntil: 'domcontentloaded' });
          await waitForRouteReady(page);
          await page.getByTestId('state-unavailable').waitFor({ state: 'visible' });
          assertEqual(new URL(page.url()).pathname, '/mmc-private/not-a-real-route', 'Unknown route was silently rewritten');
        }],
        ['pinned session captures a typed draft and completes one human review decision', async () => {
          const captureText = 'Workflow fixture: confirm a bounded next step with the student.';
          await page.goto(review.url(`/mmc-private/students/${PRIMARY_SUBJECT_ID}/prep`), { waitUntil: 'domcontentloaded' });
          await waitForRouteReady(page);
          await page.getByRole('button', { name: 'Start pinned session' }).click();
          await page.waitForURL(/\/mmc-private\/sessions\/[^/]+\/live$/u);
          await waitForRouteReady(page);
          await page.getByTestId('live-session').waitFor({ state: 'visible' });

          const captureForm = page.getByTestId('session-capture-form');
          await captureForm.getByLabel('Capture type').selectOption('STUDENT_TASK');
          await captureForm.getByLabel('Typed draft').fill(captureText);
          await captureForm.getByRole('button', { name: 'Add typed draft' }).click();
          await page.getByText(captureText, { exact: true }).waitFor({ state: 'visible' });

          await page.getByRole('button', { name: 'Pause session' }).click();
          await page.getByRole('heading', { level: 1, name: 'Session paused' }).waitFor({ state: 'visible' });
          await page.getByRole('button', { name: 'Resume session' }).click();
          await page.getByRole('heading', { level: 1, name: 'Live session' }).waitFor({ state: 'visible' });

          await page.getByRole('button', { name: 'End capture and review' }).click();
          await page.waitForURL(/\/mmc-private\/sessions\/[^/]+\/review$/u);
          await waitForRouteReady(page);
          await page.getByTestId('review-form').waitFor({ state: 'visible' });
          const actionable = page.locator('form[data-session-review-item]').filter({
            has: page.locator('select[name="decision"]:enabled'),
          }).first();
          await actionable.locator('select[name="decision"]').selectOption('ACCEPT');
          await actionable.locator('textarea[name="rationale"]').fill('Human-reviewed against the typed fixture evidence.');
          const decisionResponsePromise = page.waitForResponse((response) => (
            response.request().method() === 'POST'
              && new URL(response.url()).pathname === '/api/mmc/v2/mentor/commands'
          ));
          await actionable.getByRole('button', { name: 'Commit this decision' }).click();
          const decisionResponse = await decisionResponsePromise;
          assertEqual(decisionResponse.status(), 200, 'Review decision command was not acknowledged');
          const decision = await decisionResponse.json();
          assertEqual(decision.status, 'COMMITTED', 'Review decision did not return a committed raw result');
          assertEqual(decision.readback.kind, 'PROPOSAL', 'Review decision readback kind drifted');
          const persisted = review.storeForScenario('default').repository.snapshot().reviews.get(decision.readback.id);
          assertEqual(persisted?.state, 'APPROVED', 'Review decision was not persisted in the isolated repository');
          await assertNoHorizontalOverflow(page);
        }],
        ['browser stayed same-origin and free of runtime failures', async () => {
          assertCleanProbe(probe);
        }],
      ], {
        browserEngineClaim: `Chromium via local system Google Chrome (${await browser.version()})`,
      });
    } finally {
      await context.close();
    }
  });
});
