import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const root = new URL('../../public/ivoc-standalone/app/', import.meta.url);
const read = (name) => readFileSync(new URL(name, root), 'utf8');
const browserPipeline = readFileSync(new URL('../../public/analytics/browser-pipeline.mjs', import.meta.url), 'utf8');
const migration = readFileSync(new URL('../../../supabase/migrations/20260830040054_ivoc_3528c_session_recording_results.sql', import.meta.url), 'utf8');

test('frozen cockpit uses only real analytics and account persistence', () => {
  const live = read('live.mjs');
  const data = read('data.mjs');
  const post = read('post.mjs');
  assert.match(live, /RealAnalyticsEngine/u);
  assert.match(live, /AccountRecordingController/u);
  assert.match(live, /ivoc\.analytics\.v1/u);
  assert.match(live, /Math\.min\(99, Math\.round\(rec\.finalizeT \* 83\)\)/u);
  assert.match(browserPipeline, /!advanced && this\.pcmConsumer/u);
  assert.match(browserPipeline, /method: 'ANALYSER_PCM_FALLBACK'/u);
  assert.doesNotMatch(data, /SimEngine|SESSIONS|STUDENT/u);
  assert.doesNotMatch(post, /Codex wires|prototype|SIMULATED/u);
});

test('private persistence migration denies browser roles and enables RLS everywhere', () => {
  const tables = ['sessions', 'recordings', 'results', 'reviews', 'preferences', 'access_log'];
  for (const table of tables) {
    assert.match(migration, new RegExp(`alter table public\\.ivoc_${table} enable row level security`, 'u'));
    assert.match(migration, new RegExp(`revoke all on table public\\.ivoc_${table} from public, anon, authenticated`, 'u'));
  }
  assert.doesNotMatch(migration, /grant .* to (anon|authenticated)/u);
});
