import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const sql = await readFile(new URL('../../infra/postgres/migrations/20260810230000_b1_514_v2_preferences_environments.sql', import.meta.url), 'utf8');

test('V2 preferences add exactly dark light auto and the two accepted environments', () => {
  assert.match(sql, /theme_preference IN \('dark', 'light', 'auto'\)/);
  assert.match(sql, /'emberstorm','lumen','static'/);
  assert.match(sql, /sf_set_theme_preference/);
  assert.doesNotMatch(sql, /UPDATE public\.sf_stories/);
});
