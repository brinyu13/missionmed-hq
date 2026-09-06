import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

import { loadLocalEnvironment } from '../config/load-environment.mjs';

test('local environment loading is optional, silent, and never overrides the current process authority', () => {
  const directory = mkdtempSync(join(tmpdir(), 'ivprep-env-'));
  const path = join(directory, '.env.local');
  writeFileSync(path, 'OPENAI_API_KEY=local-file-value\nLIVEAVATAR_API_KEY="provider-file-value"\n# ignored\n', { mode: 0o600 });
  const env = { OPENAI_API_KEY: 'process-authority' };
  assert.deepEqual(loadLocalEnvironment({ path, env }), { found: true, loaded: 1 });
  assert.equal(env.OPENAI_API_KEY, 'process-authority');
  assert.equal(env.LIVEAVATAR_API_KEY, 'provider-file-value');
  assert.deepEqual(loadLocalEnvironment({ path: join(directory, 'missing'), env }), { found: false, loaded: 0 });
});
