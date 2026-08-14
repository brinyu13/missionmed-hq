import { expect, test } from '@playwright/test';

async function openStudentSettings(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Student · Maya' }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
}

test('environment selection previews without persistence, cancels, saves, and survives reload', async ({ page }) => {
  await openStudentSettings(page);
  await expect(page.locator('body')).toHaveAttribute('data-background', 'ember');

  await page.getByRole('button', { name: /Deep Tide/ }).click();
  await expect(page.locator('body')).toHaveAttribute('data-background', 'ember');
  await expect(page.getByText('Selected: Deep Tide')).toBeVisible();
  await expect(page.getByText('Saved: Emberlight')).toBeVisible();

  await page.getByRole('button', { name: 'Preview', exact: true }).first().click();
  await expect(page.locator('body')).toHaveAttribute('data-background', 'tide');
  await expect(page.getByText('Preview: Active')).toBeVisible();
  await page.getByRole('button', { name: 'Cancel preview', exact: true }).first().click();
  await expect(page.locator('body')).toHaveAttribute('data-background', 'ember');

  await page.getByRole('button', { name: /Aurora/ }).click();
  await page.getByRole('button', { name: 'Preview', exact: true }).first().click();
  await expect(page.locator('body')).toHaveAttribute('data-background', 'aurora');
  await page.getByRole('button', { name: 'Save environment' }).click();
  await page.reload();
  await expect(page.locator('body')).toHaveAttribute('data-background', 'aurora');
  await expect(page.getByText('Saved: Aurora')).toBeVisible();

  await page.getByRole('button', { name: /Emberlight/ }).click();
  await page.getByRole('button', { name: 'Save environment' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-background', 'ember');
});

test('Standard, Large, and Extra Large preview and persist per signed user without clipping', async ({ page }) => {
  await openStudentSettings(page);
  await expect(page.locator('body')).toHaveAttribute('data-text-size', 'standard');

  await page.getByRole('button', { name: /^Extra Large/ }).click();
  await expect(page.locator('body')).toHaveAttribute('data-text-size', 'standard');
  await page.getByRole('button', { name: 'Preview', exact: true }).last().click();
  await expect(page.locator('body')).toHaveAttribute('data-text-size', 'extra_large');
  await page.getByRole('button', { name: 'Cancel preview', exact: true }).last().click();
  await expect(page.locator('body')).toHaveAttribute('data-text-size', 'standard');

  await page.getByRole('button', { name: /^Large/ }).click();
  await page.getByRole('button', { name: 'Preview', exact: true }).last().click();
  await page.getByRole('button', { name: 'Save text size' }).click();
  await page.reload();
  await expect(page.locator('body')).toHaveAttribute('data-text-size', 'large');

  await page.setViewportSize({ width: 390, height: 844 });
  const overflow = await page.locator('main').evaluate((element) => element.scrollWidth - element.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await page.getByRole('button', { name: 'Standard' }).click();
  await page.getByRole('button', { name: 'Save text size' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-text-size', 'standard');
});

test('Opening Sound is default-off, previews by user gesture, persists, and requests no microphone', async ({ page }) => {
  let enabled = false;
  let microphoneRequests = 0;
  await page.addInitScript(() => {
    window.__openingSoundContexts = 0;
    const parameter = () => ({
      setValueAtTime() {},
      exponentialRampToValueAtTime() {},
    });
    class TestAudioContext {
      constructor() {
        window.__openingSoundContexts += 1;
        this.currentTime = 0;
        this.destination = {};
        this.state = 'running';
      }
      createGain() { return { gain: parameter(), connect() {} }; }
      createOscillator() { return { type: 'sine', frequency: parameter(), connect() {}, start() {}, stop() {} }; }
      async resume() { this.state = 'running'; }
      async close() { this.state = 'closed'; }
    }
    window.AudioContext = TestAudioContext;
    window.webkitAudioContext = TestAudioContext;
  });
  await page.route('**/api/session', async (route) => {
    const response = await route.fetch();
    const payload = await response.json();
    payload.user.opening_sound_enabled = enabled;
    await route.fulfill({ response, json: payload });
  });
  await page.route('**/api/preferences/opening-sound', async (route) => {
    const request = route.request();
    expect(request.method()).toBe('PATCH');
    const body = request.postDataJSON();
    expect(typeof body.enabled).toBe('boolean');
    enabled = body.enabled;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ openingSoundEnabled: enabled }) });
  });
  page.on('request', (request) => {
    if (/microphone|getUserMedia/i.test(request.url())) microphoneRequests += 1;
  });

  await openStudentSettings(page);
  const soundSwitch = page.getByRole('switch', { name: /Opening Sound/ });
  await expect(soundSwitch).toHaveAttribute('aria-checked', 'false');
  await expect(soundSwitch).toHaveText('OFF');

  await page.getByRole('button', { name: 'Preview sound' }).click();
  await expect(page.locator('#toast')).toContainText('Opening sound preview played.');
  expect(await page.evaluate(() => window.__openingSoundContexts)).toBe(1);

  await soundSwitch.click();
  await expect(page.getByRole('switch', { name: /Opening Sound/ })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('switch', { name: /Opening Sound/ })).toHaveText('ON');
  expect(enabled).toBe(true);

  await page.reload();
  await expect(page.locator('#storyforgeOpening')).toBeHidden();
  await expect(page.getByRole('switch', { name: /Opening Sound/ })).toHaveAttribute('aria-checked', 'true');
  expect(microphoneRequests).toBe(0);

  await page.getByRole('switch', { name: /Opening Sound/ }).click();
  await expect(page.getByRole('switch', { name: /Opening Sound/ })).toHaveAttribute('aria-checked', 'false');
  expect(enabled).toBe(false);
});
