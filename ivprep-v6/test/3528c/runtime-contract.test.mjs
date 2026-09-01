import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import test from 'node:test';

const root = new URL('../../public/ivoc-standalone/app/', import.meta.url);
const read = (name) => readFileSync(new URL(name, root), 'utf8');
const browserPipeline = readFileSync(new URL('../../public/analytics/browser-pipeline.mjs', import.meta.url), 'utf8');
const cockpit = readFileSync(new URL('../../public/ivoc-standalone/styles/cockpit.css', import.meta.url), 'utf8');
const standalone = new URL('../../public/ivoc-standalone/', import.meta.url);
const tokens = readFileSync(new URL('styles/tokens.css', standalone), 'utf8');
const standaloneHtml = readFileSync(new URL('index.html', standalone), 'utf8');
const railwayIgnore = readFileSync(new URL('../../../.railwayignore', import.meta.url), 'utf8');
const railwayIgnoreLines = new Set(railwayIgnore.split(/\r?\n/u));
const migration = readFileSync(new URL('../../../supabase/migrations/20260830040054_ivoc_3528c_session_recording_results.sql', import.meta.url), 'utf8');

test('frozen visual package includes its design tokens and approved bitmap art', () => {
  assert.match(tokens, /:root\s*\{/u);
  assert.match(tokens, /--g-bg:/u);
  assert.match(tokens, /--g-font:/u);
  for (const asset of [
    'assets/arena-world-day.jpg',
    'assets/arena-world-sunset.jpg',
    'assets/founder-face-scanner.png',
    'assets/founder-body-scanner.png',
  ]) assert.ok(statSync(new URL(asset, standalone)).size > 1_000, `${asset} must ship in the release archive`);
  assert.match(standaloneHtml, /\/iv-prep-on-call\/assets\/vendor\/vad-web\/0\.0\.30\/ort\.min\.js/u);
  assert.match(standaloneHtml, /\/iv-prep-on-call\/assets\/vendor\/vad-web\/0\.0\.30\/bundle\.min\.js/u);
  for (const asset of [
    'arena-world-day.jpg',
    'arena-world-sunset.jpg',
    'founder-face-scanner.png',
    'founder-body-scanner.png',
  ]) {
    assert.ok(
      railwayIgnoreLines.has(`!ivprep-v6/public/ivoc-standalone/assets/${asset}`),
      `${asset} must be explicitly restored after the global bitmap exclusion`,
    );
  }
});

test('frozen cockpit uses only real analytics and account persistence', () => {
  const live = read('live.mjs');
  const data = read('data.mjs');
  const menus = read('menus.mjs');
  const post = read('post.mjs');
  assert.match(live, /RealAnalyticsEngine/u);
  assert.match(live, /AccountRecordingController/u);
  assert.match(live, /ivoc\.analytics\.v1/u);
  assert.match(live, /Math\.min\(99, Math\.round\(rec\.finalizeT \* 83\)\)/u);
  assert.match(live, /instrument\._lastWpm = null/u);
  assert.match(live, /ins\._lastWpm = f\.speedWpm\.wordsPerMinute/u);
  assert.match(live, /wpmLastObserved: INSTRUMENTS\[0\]\._lastWpm \?\? null/u);
  assert.match(live, /wpmAvg: INSTRUMENTS\[0\]\._lastWpm \?\? null/u);
  assert.match(post, /payload\.wpmLastObserved \?\? payload\.metrics/u);
  assert.match(cockpit, /#vvCanvas \{ flex: 1 1 72px; width: 100%; min-height: 72px;/u);
  assert.match(cockpit, /@media \(max-height: 830px\) \{[\s\S]*?\.room-bottom \{ flex-basis: 142px; \}/u);
  assert.match(browserPipeline, /!advanced && this\.pcmConsumer/u);
  assert.match(browserPipeline, /method: 'ANALYSER_PCM_FALLBACK'/u);
  assert.doesNotMatch(data, /SimEngine|SESSIONS|STUDENT/u);
  assert.doesNotMatch(post, /Codex wires|prototype|SIMULATED/u);
  assert.match(menus, /THIS TAKE COULD NOT BE SEALED/u);
  assert.match(menus, /No recording or analytics result was saved for this interrupted take/u);
  assert.match(menus, /START A FRESH TAKE/u);
  assert.match(menus, /VIEW SAVED LIBRARY/u);
  assert.doesNotMatch(menus, /SAVE WHAT WAS RECORDED|Partial session saved to your library/u);
});

test('private persistence migration denies browser roles and enables RLS everywhere', () => {
  const tables = ['sessions', 'recordings', 'results', 'reviews', 'preferences', 'access_log'];
  for (const table of tables) {
    assert.match(migration, new RegExp(`alter table public\\.ivoc_${table} enable row level security`, 'u'));
    assert.match(migration, new RegExp(`revoke all on table public\\.ivoc_${table} from public, anon, authenticated`, 'u'));
  }
  assert.doesNotMatch(migration, /grant .* to (anon|authenticated)/u);
});
