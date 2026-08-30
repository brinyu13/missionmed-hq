import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const html = await readFile(new URL("../public/aaa/index.html", import.meta.url), "utf8");
const css = await readFile(new URL("../public/aaa/styles.css", import.meta.url), "utf8");
const app = await readFile(new URL("../public/aaa/app.mjs", import.meta.url), "utf8");

test("prototype has a keyboard bypass and route focus target", () => {
  assert.match(html, /class="skip-link" href="#main-content"/);
  assert.match(html, /<main id="main-content" tabindex="-1">/);
  assert.match(app, /main-content.*focus/s);
});

test("dialogs are labelled, dismissible, and Escape-aware", () => {
  assert.match(html, /<dialog[^>]+id="workspace-modal"[^>]+aria-labelledby="modal-title"/);
  assert.match(html, /<dialog[^>]+id="playbook-modal"[^>]+aria-labelledby="playbook-title"/);
  assert.match(html, /aria-label="Close workspace"/);
  assert.match(html, /aria-label="Close playbook"/);
  assert.match(app, /addEventListener\("cancel"/);
});

test("dynamic and interview states are announced without fake hidden telemetry", () => {
  assert.match(html, /id="room-status" aria-live="polite"/);
  assert.match(html, /id="question-count" aria-live="polite"/);
  assert.match(html, /id="conversation-log" aria-live="polite"/);
  assert.match(html, /id="toast-region" aria-live="polite"/);
  assert.doesNotMatch(html, /confidence score|emotion score|deception score/i);
});

test("interactive controls are semantic and do not use inline click handlers", () => {
  assert.doesNotMatch(html, /\sonclick=/i);
  assert.doesNotMatch(html, /<div[^>]+role="button"/i);
  assert.match(html, /<button[^>]+id="room-start"/);
  assert.match(html, /<label[^>]*>[^<]*Specialty|<fieldset><legend>Specialty/s);
});

test("focus visibility, reduced motion, and touch targets are explicit", () => {
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /min-height:\s*44px/);
});

test("mobile navigation and sheets expose deterministic focus boundaries", () => {
  assert.match(html, /id="nav-backdrop"[^>]+hidden/);
  assert.match(app, /rail\.inert = enabled && !nextOpen/);
  assert.match(app, /setAttribute\("aria-hidden"/);
  assert.match(app, /mobile-sheet-open/);
  assert.match(app, /event\.key !== "Escape"/);
});

test("mobile selection controls retain visible focus and semantic state", () => {
  assert.match(css, /choice input:focus-visible \+ span/);
  assert.match(css, /segmented input:focus-visible \+ span/);
  assert.match(css, /filter-options input:focus-visible \+ span/);
  assert.match(css, /switch input:focus-visible \+ span/);
  assert.match(html, /data-vault-mode="interviews" aria-pressed="true"/);
  assert.match(html, /data-debrief-mode="type" aria-pressed="true"/);
  assert.match(app, /setAttribute\("aria-pressed"/);
});

test("countdown and typed answer are modal, dismissible mobile states", () => {
  assert.match(html, /<dialog class="countdown-overlay"/);
  assert.match(app, /overlay\.showModal\(\)/);
  assert.match(app, /countdown-overlay.*addEventListener\("cancel"/s);
  assert.match(html, /id="typed-room-answer" role="dialog" aria-modal="true"/);
  assert.match(html, /id="room-type-close"/);
});
