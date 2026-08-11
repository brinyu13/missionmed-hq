import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const htmlUrl = new URL("../public/aaa/index.html", import.meta.url);
const cssUrl = new URL("../public/aaa/styles.css", import.meta.url);
const appUrl = new URL("../public/aaa/app.mjs", import.meta.url);
const fixturesUrl = new URL("../public/aaa/fixtures.mjs", import.meta.url);

const [html, css, app, fixtures] = await Promise.all([
  readFile(htmlUrl, "utf8"),
  readFile(cssUrl, "utf8"),
  readFile(appUrl, "utf8"),
  readFile(fixturesUrl, "utf8")
]);

test("AAA prototype preserves the accepted live V6 as a separate truthful rail", () => {
  assert.match(html, /href="\/"[^>]*>OPEN LIVE ALPHA ROOM/);
  assert.match(html, /accepted full-duplex interviewer/i);
  assert.match(app, /no provider call was made/i);
  assert.doesNotMatch(app, /OPENAI_API_KEY|LIVEAVATAR_API_KEY|client_secret/i);
});

test("AAA prototype contains the required founder journey surfaces", () => {
  for (const view of ["home", "instant", "custom", "room", "results", "vault", "mentor", "debrief", "file", "program"]) {
    assert.match(html, new RegExp(`data-view-panel="${view}"`));
  }
  for (const feature of ["question-search", "plan-list", "room-start", "moment-timeline", "vault-search", "request-review", "conversation-log", "playbook-list"]) {
    assert.match(html, new RegExp(`id="${feature}"`));
  }
});

test("interview designer provides search, filter, accessible reorder, and drag/drop", () => {
  assert.match(app, /filteredQuestions/);
  assert.match(app, /data-move-plan/);
  assert.match(app, /dragstart/);
  assert.match(app, /dragover/);
  assert.match(app, /drop/);
  assert.match(app, /addToPlan/);
  assert.match(fixtures, /gap-transition/);
  assert.match(fixtures, /research-contribution/);
  assert.match(fixtures, /specialty-transition/);
});

test("dynamic workspaces use the responsive presentation contracts", () => {
  for (const dynamicClass of [
    "card-actions",
    "order",
    "item-actions",
    "question-workspace-grid",
    "workspace-section",
    "source-chooser-grid",
    "source-option",
    "session-player",
    "workspace-transcript",
    "user-message",
    "playbook-topic",
    "playbook-order"
  ]) {
    assert.match(app, new RegExp(`["'][^"']*${dynamicClass}[^"']*["']`));
    assert.match(css, new RegExp(`\\.${dynamicClass}(?:[\\s.{>:]|$)`));
  }
  assert.doesNotMatch(app, /question-actions|plan-index|plan-item-actions|student-message|class="workspace-grid"/);
});

test("vault supports interview, question, and transcript-word retrieval states", () => {
  assert.match(app, /vaultMode/);
  assert.match(app, /transcriptHits/);
  assert.match(app, /data-transcript-session/);
  assert.match(fixtures, /professional home|clinical home|a home/i);
});

test("debrief elicits one topic at a time and separates typed prototype from live voice", () => {
  assert.match(app, /DEBRIEF_FOLLOWUPS\[state\.debriefStep\]/);
  assert.match(html, /Talk joins with the live rail in 3440/);
  assert.match(html, /student recollection stays distinct from verified program intelligence/i);
  assert.match(app, /No account record was changed/i);
});

test("prototype styling includes product tokens and narrow responsive layouts", () => {
  assert.match(css, /--mm-gold:/);
  assert.match(css, /--mm-coral:/);
  assert.match(css, /@media \(max-width: 1180px\)/);
  assert.match(css, /@media \(max-width: 680px\)/);
  assert.match(css, /@media \(max-width: 380px\)/);
  assert.match(css, /prefers-reduced-motion/);
});

test("mobile Class A surfaces use the dynamic viewport and safe areas", () => {
  assert.match(html, /viewport-fit=cover/);
  assert.match(css, /100dvh/);
  assert.match(css, /env\(safe-area-inset-top\)/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(css, /body\[data-active-view="room"\][^{]*\{[^}]*overflow:\s*hidden/s);
  assert.match(css, /body\[data-active-view="room"\][\s\S]*?\.mobile-nav,[\s\S]*?\.live-rail-link\s*\{\s*display:\s*none\s*!important/s);
  assert.match(css, /orientation:\s*landscape/);
  assert.match(app, /dataset\.roomState = "active"/);
  assert.match(app, /Tap again to end/);
});

test("mobile content screens have purpose-built panes, summaries, and sheets", () => {
  assert.match(html, /data-builder-tab="questions"/);
  assert.match(html, /data-builder-tab="plan"/);
  assert.match(css, /data-mobile-pane="questions"/);
  assert.match(css, /data-mobile-pane="plan"/);
  assert.match(html, /class="mobile-results-summary"/);
  assert.match(html, /id="mobile-vault-filter"/);
  assert.match(html, /id="mobile-debrief-review"/);
  assert.match(css, /body\.vault-filter-open \.vault-filters/);
  assert.match(css, /body\.debrief-review-open \.debrief-record/);
  assert.match(app, /class="transcript-hit"/);
});

test("all static IDs in the prototype HTML are unique", () => {
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length);
});
