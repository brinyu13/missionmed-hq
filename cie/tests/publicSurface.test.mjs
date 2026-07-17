import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const publicDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../public");

test("Moment review surface is semantic, keyboard-visible, responsive, and future-feature silent", async () => {
  const [html, css, script] = await Promise.all([
    readFile(path.join(publicDirectory, "review.html"), "utf8"),
    readFile(path.join(publicDirectory, "review.css"), "utf8"),
    readFile(path.join(publicDirectory, "review.js"), "utf8")
  ]);

  assert.match(html, /<main id="main-content">/u);
  assert.match(html, /<h1 id="page-title">/u);
  assert.match(html, /role="status" aria-live="polite"/u);
  assert.match(html, /<video[^>]+controls[^>]+aria-label=/u);
  assert.match(html, /href="#main-content">Skip to main content/u);
  assert.match(html, /name="robots" content="noindex,nofollow,noarchive"/u);
  assert.match(html, /name="referrer" content="no-referrer"/u);
  assert.doesNotMatch(html, /<script(?![^>]+src=)/u);
  assert.doesNotMatch(html, /<style/u);

  assert.match(css, /:focus-visible/u);
  assert.match(css, /\[hidden\] \{ display: none !important; \}/u);
  assert.match(css, /prefers-reduced-motion/u);
  assert.match(css, /@media \(max-width: 820px\)/u);
  assert.match(css, /grid-template-columns: 1fr/u);
  assert.match(css, /playback-unavailable/u);
  assert.match(css, /aspect-ratio: 16 \/ 9/u);

  assert.match(script, /textContent/u);
  assert.match(script, /replayRegion\.hidden = true/u);
  assert.doesNotMatch(script, /innerHTML|outerHTML|insertAdjacentHTML/u);
  assert.doesNotMatch(script, /localStorage|sessionStorage|indexedDB|document\.cookie/u);
  assert.doesNotMatch(script, /service[_-]?role|bearer|api[_-]?token|refresh[_-]?token/iu);
  assert.doesNotMatch(`${html}\n${script}`, /transcript|artificial intelligence|AI analysis|coming soon|premium unlock/iu);
  assert.match(script, /does not establish a trait, score, or outcome/u);
});
