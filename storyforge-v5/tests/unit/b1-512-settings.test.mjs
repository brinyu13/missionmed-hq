import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const app = await readFile(new URL('../../public/app.js', import.meta.url), 'utf8');
const styles = await readFile(new URL('../../public/styles.css', import.meta.url), 'utf8');
const server = await readFile(new URL('../../server/app.mjs', import.meta.url), 'utf8');
const migration = await readFile(new URL('../../infra/postgres/migrations/20260806190000_b1_512_concrete_configuration_media.sql', import.meta.url), 'utf8');

test('environment Settings separates selection, temporary preview, save, and cancel', () => {
  assert.match(app, /data-select-background/);
  assert.match(app, /data-preview-background/);
  assert.match(app, /data-save-background/);
  assert.match(app, /data-cancel-background/);
  assert.match(app, /selectedBackground/);
  assert.match(app, /previewBackground/);
  assert.match(app, /Environment preview canceled\. Your saved environment is restored\./);
  assert.match(app, /Reduced motion/);
});

test('global reading size is account-scoped, previewable, and never uses CSS zoom', () => {
  for (const value of ['standard', 'large', 'extra_large']) {
    assert.match(app, new RegExp(value));
    assert.match(migration, new RegExp(`'${value}'`));
  }
  assert.match(app, /data-preview-text-size/);
  assert.match(app, /data-save-text-size/);
  assert.match(app, /data-cancel-text-size/);
  assert.match(app, /document\.body\.dataset\.textSize = activeTextSize\(\)/);
  assert.match(styles, /body\[data-text-size="extra_large"\]/);
  assert.doesNotMatch(styles, /\bzoom\s*:/i);
});

test('reading size persists through the authenticated API and least-privilege RPC', () => {
  assert.match(server, /PATCH' && url\.pathname === '\/api\/preferences\/text-size'/);
  assert.match(server, /sf_set_reading_size_preference/);
  assert.match(server, /reading_size_preference/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS reading_size_preference/);
  assert.match(migration, /IF NOT public\.sf_has_live_identity\(\)/);
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.sf_set_reading_size_preference\(text\) FROM PUBLIC, anon/);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.sf_set_reading_size_preference\(text\) TO authenticated/);
});
