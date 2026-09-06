import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const KEEPER = fileURLToPath(new URL('../../scripts/3441r/t1-durable-lease-keeper.py', import.meta.url));

function startKeeper(args = []) {
  const child = spawn('/opt/homebrew/bin/python3', ['-B', KEEPER, '--synthetic', ...args], {
    cwd: '/tmp',
    env: { PATH: '/opt/homebrew/bin:/usr/bin:/bin', HOME: process.env.HOME || '', TMPDIR: '/tmp' },
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  });
  const states = [];
  let raw = '';
  let stderr = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk) => { raw += chunk; });
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  const lines = createInterface({ input: child.stdout, crlfDelay: Infinity });
  lines.on('line', (line) => states.push(JSON.parse(line)));
  return { child, states, raw: () => raw, stderr: () => stderr };
}

async function waitForState(run, predicate, timeoutMs = 5_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const match = run.states.find(predicate);
    if (match) return match;
    if (run.child.exitCode !== null) break;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`keeper state timed out: ${JSON.stringify(run.states)}`);
}

async function stopKeeper(run, signal = null) {
  if (signal) run.child.kill(signal);
  else run.child.stdin.write('RELEASE\n');
  if (run.child.exitCode === null) await once(run.child, 'exit');
  return run.child.exitCode;
}

test('keeper acquires, heartbeats for 30 seconds and eight cycles, survives idle, then releases', { timeout: 50_000 }, async (context) => {
  const run = startKeeper();
  context.after(() => { if (run.child.exitCode === null) run.child.kill('SIGKILL'); });
  await waitForState(run, (state) => state.state === 'NOT_ACQUIRED');
  run.child.stdin.write('ACQUIRE\n');
  const stabilizing = await waitForState(run, (state) => state.state === 'STABILIZING');
  assert.equal(stabilizing.heartbeatCount, 0);
  const ready = await waitForState(run, (state) => state.state === 'READY', 35_000);
  assert.ok(ready.heartbeatCount >= 6);
  assert.ok(ready.stableSeconds >= 30);
  const idle = await waitForState(run, (state) => state.state === 'READY' && state.heartbeatCount >= 8, 12_000);
  assert.ok(idle.stableSeconds >= 40);
  assert.equal(await stopKeeper(run), 0);
  assert.equal(run.states.at(-1).state, 'RELEASED');
  assert.equal(run.stderr(), '');
});

test('keeper releases on SIGINT and SIGTERM without exposing its raw nonce', async () => {
  for (const signal of ['SIGINT', 'SIGTERM']) {
    const run = startKeeper(['--heartbeat-seconds', '0.05', '--stability-seconds', '0.15']);
    await waitForState(run, (state) => state.state === 'NOT_ACQUIRED');
    run.child.stdin.write('ACQUIRE\n');
    const acquired = await waitForState(run, (state) => state.state === 'STABILIZING');
    assert.match(acquired.nonceSha256, /^[0-9a-f]{64}$/u);
    assert.equal(await stopKeeper(run, signal), 0);
    assert.equal(run.states.at(-1).state, 'RELEASED');
    assert.equal(run.stderr(), '');
    const uuidValues = run.raw().match(/[0-9a-f]{8}-[0-9a-f-]{27}/gu) || [];
    assert.deepEqual([...new Set(uuidValues)], [acquired.leaseId]);
    assert.doesNotMatch(run.raw(), /"nonce"\s*:/u);
  }
});

test('heartbeat denial is terminal, never reaches READY, and cannot reuse the stale process', async () => {
  const run = startKeeper([
    '--heartbeat-seconds', '0.05', '--stability-seconds', '0.20', '--synthetic-fail-after', '1',
  ]);
  await waitForState(run, (state) => state.state === 'NOT_ACQUIRED');
  run.child.stdin.write('ACQUIRE\n');
  const lost = await waitForState(run, (state) => state.state === 'LOST');
  assert.equal(lost.heartbeatCount, 1);
  await once(run.child, 'exit');
  assert.equal(run.child.exitCode, 3);
  assert.equal(run.states.some((state) => state.state === 'READY'), false);
  assert.equal(run.child.stdin.writable, false);
  assert.equal(run.stderr(), '');
});

test('keeper source contains no provider capability and live timing cannot be weakened', async () => {
  const source = await readFile(KEEPER, 'utf8');
  assert.doesNotMatch(source, /lemonslice|livekit|openai|elevenlabs/iu);
  assert.match(source, /HEARTBEAT_SECONDS = 5\.0/u);
  assert.match(source, /STABILITY_SECONDS = 30\.0/u);
  assert.match(source, /MINIMUM_HEARTBEATS = 3/u);

  const child = spawn('/opt/homebrew/bin/python3', [
    '-B', KEEPER, '--heartbeat-seconds', '0.05', '--stability-seconds', '0.15',
  ], { cwd: '/tmp', env: { PATH: '/opt/homebrew/bin:/usr/bin:/bin' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk) => { output += chunk; });
  await once(child, 'exit');
  assert.equal(child.exitCode, 3);
  assert.match(output, /"state":"LOST"/u);
});
