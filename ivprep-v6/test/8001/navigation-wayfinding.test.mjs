import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { resolveReviewDestination } from '../../public/studio/review-scope.mjs';

const html = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../public/studio/index.html'), 'utf8');

test('Home points to the actual saved-attempt chooser rather than stale review state', () => {
  assert.match(html, /Your saved practice[\s\S]*?data-goto="vault"><span>Browse recordings<\/span>/u);
  assert.equal(resolveReviewDestination('postanswer', null), 'vault');
});

test('review navigation describes its destination and Film Room can return to Results', () => {
  assert.match(html, /data-nav="lab"[^>]*>[\s\S]*?Analytics Lab<\/button>/u);
  assert.match(html, /data-nav="postanswer"[^>]*>[\s\S]*?Review My Answers<\/button>/u);
  assert.match(html, /data-view-panel="filmroom"[\s\S]*?data-goto="postanswer"><span>← Back to Results<\/span>/u);
  assert.doesNotMatch(html, /class="nav-count">3<\/b>/u);
  assert.equal(resolveReviewDestination('postanswer', { persisted: true }), 'postanswer');
});
