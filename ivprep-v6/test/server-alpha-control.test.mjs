import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { AlphaStore } from '../persistence/alpha-store.mjs';
import { createIvPrepServer } from '../server/serve.mjs';

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return `http://127.0.0.1:${server.address().port}`;
}

test('local API rejects simple cross-origin and non-JSON POST requests', async (t) => {
  const path = join(mkdtempSync(join(tmpdir(), 'ivprep-alpha-security-')), 'sessions.json');
  const server = createIvPrepServer({ apiKey: 'unit-key', alphaStore: new AlphaStore({ path }) });
  t.after(() => server.close());
  const base = await listen(server);

  const simple = await fetch(`${base}/api/surprise-me`, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: '{}' });
  assert.equal(simple.status, 400);
  assert.match((await simple.json()).error, /application\/json/);

  const crossOrigin = await fetch(`${base}/api/surprise-me`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://example.invalid', 'Sec-Fetch-Site': 'cross-site' }, body: '{}',
  });
  assert.equal(crossOrigin.status, 400);
  assert.match((await crossOrigin.json()).error, /Cross-site|Cross-origin/);
});

test('server-owned alpha routes persist, enforce one active identity, and emergency-disable starts', async (t) => {
  const path = join(mkdtempSync(join(tmpdir(), 'ivprep-alpha-routes-')), 'sessions.json');
  const server = createIvPrepServer({ apiKey: 'unit-key', alphaStore: new AlphaStore({ path }) });
  t.after(() => server.close());
  const base = await listen(server);
  const jsonHeaders = { 'Content-Type': 'application/json' };
  const input = {
    testIdentity: 'route-smoke', durationMinutes: 25, selectedInterviewer: 'senior-academic-pd-male',
    model: 'gpt-5.6-terra', voice: 'cedar', avatar: null, behavior: 'direct-program-director', mode: 'voice-only',
  };

  const startedResponse = await fetch(`${base}/api/alpha-sessions/start`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify(input) });
  assert.equal(startedResponse.status, 201);
  const started = (await startedResponse.json()).session;
  assert.equal(started.durationMinutes, 20);

  const duplicate = await fetch(`${base}/api/alpha-sessions/start`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify(input) });
  assert.equal(duplicate.status, 409);

  const ended = await fetch(`${base}/api/alpha-sessions/${started.id}/end`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ terminationState: 'completed' }) });
  assert.equal(ended.status, 200);

  const disabled = await fetch(`${base}/api/alpha-control/emergency-disable`, {
    method: 'POST', headers: { ...jsonHeaders, 'X-IVPrep-Founder': 'local-founder' }, body: JSON.stringify({ disabled: true }),
  });
  assert.deepEqual(await disabled.json(), { disabled: true });
  const blocked = await fetch(`${base}/api/alpha-sessions/start`, { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ ...input, testIdentity: 'blocked-smoke' }) });
  assert.equal(blocked.status, 503);

  const ledger = await fetch(`${base}/api/alpha-sessions`, { headers: { 'X-IVPrep-Founder': 'local-founder' } });
  const ledgerBody = await ledger.json();
  assert.equal(ledgerBody.sessions.length, 1);
  assert.equal(ledgerBody.usage.length, 1);
  assert.equal(ledgerBody.commercialization.active, false);
});

test('browser adapter wires provider media without persisting or logging credentials', async () => {
  const client = await readFile(new URL('../public/avatar-provider.mjs', import.meta.url), 'utf8');
  const integration = await readFile(new URL('../public/v6-integration.mjs', import.meta.url), 'utf8');
  assert.match(client, /import\('\/vendor\/livekit-client\.esm\.mjs'\)/);
  assert.match(client, /RoomEvent\.TrackSubscribed/);
  assert.match(client, /\/api\/avatar\/session\/audio/);
  assert.match(client, /async interrupt\(\)/);
  assert.match(client, /async reconnect\(\)/);
  assert.doesNotMatch(client, /localStorage|sessionStorage|console\.log/);
  assert.match(integration, /Live avatar unavailable: provider authorization is missing/);
  assert.match(integration, /The interviewer intelligence and voice are unchanged/);
});
