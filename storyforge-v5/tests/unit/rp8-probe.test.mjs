import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  RP8_FIXTURE_COUNT,
  RP8_FIXTURE_DURATION_SECONDS,
  createRp8ProbeServer,
  evaluateRp8Selection,
  rp8FixtureFrequency,
  rp8FixtureName,
  rp8RequestAuthorized,
} from '../../scripts/rp8-probe-server.mjs';

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const token = 'a'.repeat(64);

function request(server, pathname, suppliedToken = '') {
  const address = server.address();
  return new Promise((resolve, reject) => {
    const requestItem = http.get({
      host: '127.0.0.1',
      port: address.port,
      path: pathname,
      headers: suppliedToken ? { 'RP8-Probe-Token': suppliedToken } : {},
    }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve({
        status: response.statusCode,
        body: Buffer.concat(chunks),
      }));
    });
    requestItem.on('error', reject);
  });
}

test('T1-01 Nixpacks setup includes ffmpeg', () => {
  const source = readFileSync(path.join(packageDir, 'nixpacks.toml'), 'utf8');
  assert.match(source, /\[phases\.setup\]/);
  assert.match(source, /nixPkgs\s*=\s*\[[^\]]*['"]ffmpeg['"]/s);
});

test('T1-02 probe server is valid ESM', () => {
  const result = spawnSync(
    process.execPath,
    ['--check', path.join(packageDir, 'scripts', 'rp8-probe-server.mjs')],
    { encoding: 'utf8' },
  );
  assert.equal(result.status, 0, result.stderr);
});

test('T1-03 deterministic seeded fixture contract is stable', () => {
  const first = Array.from({ length: RP8_FIXTURE_COUNT }, (_, index) => ({
    name: rp8FixtureName(index),
    frequency: rp8FixtureFrequency(index),
    duration: RP8_FIXTURE_DURATION_SECONDS,
  }));
  const second = Array.from({ length: RP8_FIXTURE_COUNT }, (_, index) => ({
    name: rp8FixtureName(index),
    frequency: rp8FixtureFrequency(index),
    duration: RP8_FIXTURE_DURATION_SECONDS,
  }));
  assert.deepEqual(first, second);
  assert.equal(new Set(first.map((item) => item.frequency)).size, RP8_FIXTURE_COUNT);
});

test('T1-04 manifest authentication accepts only the exact token', () => {
  assert.equal(rp8RequestAuthorized({ headers: {} }, token), false);
  assert.equal(rp8RequestAuthorized({
    headers: { 'rp8-probe-token': token },
  }, token), true);
  assert.equal(rp8RequestAuthorized({
    headers: { 'rp8-probe-token': `${token.slice(0, -1)}b` },
  }, token), false);
});

test('T1-05 artifact authentication uses the same exact token boundary', () => {
  assert.equal(rp8RequestAuthorized({
    headers: { 'x-rp8-probe-token': token },
  }, token), true);
  assert.equal(rp8RequestAuthorized({
    headers: { 'x-rp8-probe-token': 'a'.repeat(63) },
  }, token), false);
});

test('T1-06 unauthorized and non-probe routes return 404', async (context) => {
  const server = createRp8ProbeServer({
    token,
    manifestBody: '{}\n',
    archive: Buffer.from('tar'),
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  context.after(() => new Promise((resolve) => server.close(resolve)));
  assert.equal((await request(server, '/rp8/manifest.json')).status, 404);
  assert.equal((await request(server, '/not-rp8', token)).status, 404);
});

test('T1-07 authorized manifest and archive responses preserve structure', async (context) => {
  const manifestBody = JSON.stringify({
    options: {
      concat: { timingsMs: [1, 1], artifactHashes: ['a', 'a'], pass: false },
      copy: { timingsMs: [1, 1], artifactHashes: ['b', 'b'], pass: false },
    },
    overall: { result: 'pending_manual_playback_and_interruption' },
  });
  const archive = Buffer.from('deterministic-tar');
  const server = createRp8ProbeServer({ token, manifestBody, archive });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  context.after(() => new Promise((resolve) => server.close(resolve)));
  const manifest = await request(server, '/rp8/manifest.json', token);
  const artifacts = await request(server, '/rp8/artifacts.tar', token);
  assert.equal(manifest.status, 200);
  assert.deepEqual(JSON.parse(manifest.body), JSON.parse(manifestBody));
  assert.equal(artifacts.status, 200);
  assert.deepEqual(artifacts.body, archive);
});

test('T1-08 Option A passes only when every ruled criterion passes', () => {
  const passing = {
    ffmpegPresent: true,
    timingsPass: true,
    hashesMatch: true,
    chromePlayback: true,
    safariPlayback: true,
    interruptionIdempotent: true,
  };
  assert.equal(evaluateRp8Selection({ concat: passing, copy: {} }).concatPass, true);
  for (const key of Object.keys(passing)) {
    assert.equal(evaluateRp8Selection({
      concat: { ...passing, [key]: false },
      copy: {},
    }).concatPass, false);
  }
});

test('T1-09 Option B passes only when timing, hashes, and both playback checks pass', () => {
  const passing = {
    timingsPass: true,
    hashesMatch: true,
    chromePlayback: true,
    safariPlayback: true,
  };
  assert.equal(evaluateRp8Selection({ concat: {}, copy: passing }).copyPass, true);
  for (const key of Object.keys(passing)) {
    assert.equal(evaluateRp8Selection({
      concat: {},
      copy: { ...passing, [key]: false },
    }).copyPass, false);
  }
});

test('T1-10 both passing options select Option A', () => {
  const result = evaluateRp8Selection({
    concat: {
      ffmpegPresent: true,
      timingsPass: true,
      hashesMatch: true,
      chromePlayback: true,
      safariPlayback: true,
      interruptionIdempotent: true,
    },
    copy: {
      timingsPass: true,
      hashesMatch: true,
      chromePlayback: true,
      safariPlayback: true,
    },
  });
  assert.equal(result.result, 'option_a');
});

test('T1-11 a single passing option selects that option', () => {
  const optionA = {
    ffmpegPresent: true,
    timingsPass: true,
    hashesMatch: true,
    chromePlayback: true,
    safariPlayback: true,
    interruptionIdempotent: true,
  };
  const optionB = {
    timingsPass: true,
    hashesMatch: true,
    chromePlayback: true,
    safariPlayback: true,
  };
  assert.equal(evaluateRp8Selection({ concat: optionA, copy: {} }).result, 'option_a');
  assert.equal(evaluateRp8Selection({ concat: {}, copy: optionB }).result, 'option_b');
});

test('T1-12 neither option passing fails the gate without selecting an executor', () => {
  assert.deepEqual(evaluateRp8Selection({ concat: {}, copy: {} }), {
    concatPass: false,
    copyPass: false,
    result: 'gate_failed',
  });
});
