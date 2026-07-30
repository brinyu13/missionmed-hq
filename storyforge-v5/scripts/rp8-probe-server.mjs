import { spawn } from 'node:child_process';
import { createHash, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import {
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';

export const RP8_FIXTURE_COUNT = 40;
export const RP8_FIXTURE_DURATION_SECONDS = 15;
export const RP8_PASS_LIMIT_MS = 60_000;

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function rp8FixtureFrequency(index) {
  if (!Number.isInteger(index) || index < 0 || index >= RP8_FIXTURE_COUNT) {
    throw new RangeError('RP-8 fixture index is out of range.');
  }
  return 220 + (index * 11);
}

export function rp8FixtureName(index) {
  rp8FixtureFrequency(index);
  return `fixture-${String(index).padStart(2, '0')}.webm`;
}

function run(binary, args, { cwd } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, {
      cwd,
      shell: false,
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    let stderr = '';
    child.stderr.on('data', (chunk) => {
      if (stderr.length < 8_192) {
        stderr += String(chunk).slice(0, 8_192 - stderr.length);
      }
    });
    child.once('error', reject);
    child.once('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${binary} exited ${code}: ${stderr.trim()}`));
    });
  });
}

async function fileHash(filePath) {
  return sha256(await readFile(filePath));
}

async function generateFixtures(directory, ffmpegBinary) {
  const fixtures = [];
  for (let index = 0; index < RP8_FIXTURE_COUNT; index += 1) {
    const name = rp8FixtureName(index);
    const fixturePath = path.join(directory, name);
    await run(ffmpegBinary, [
      '-hide_banner',
      '-loglevel',
      'error',
      '-nostdin',
      '-f',
      'lavfi',
      '-i',
      `sine=frequency=${rp8FixtureFrequency(index)}:duration=${RP8_FIXTURE_DURATION_SECONDS}:sample_rate=48000`,
      '-map',
      '0:a:0',
      '-c:a',
      'libopus',
      '-b:a',
      '32k',
      '-vbr',
      'off',
      '-application',
      'voip',
      '-map_metadata',
      '-1',
      '-fflags',
      '+bitexact',
      '-y',
      name,
    ], { cwd: directory });
    const details = await stat(fixturePath);
    fixtures.push(Object.freeze({
      index,
      name,
      byteSize: details.size,
      sha256: await fileHash(fixturePath),
    }));
  }
  return Object.freeze(fixtures);
}

async function runOptionA(directory, fixtures, ffmpegBinary, runNumber) {
  const concatName = `concat-${runNumber}.txt`;
  const outputName = `option-a-run-${runNumber}.webm`;
  await writeFile(
    path.join(directory, concatName),
    `${fixtures.map((fixture) => `file '${fixture.name}'`).join('\n')}\n`,
    { flag: 'wx' },
  );
  const started = performance.now();
  await run(ffmpegBinary, [
    '-hide_banner',
    '-loglevel',
    'error',
    '-nostdin',
    '-f',
    'concat',
    '-safe',
    '1',
    '-i',
    concatName,
    '-map',
    '0:a:0',
    '-c',
    'copy',
    '-map_metadata',
    '-1',
    '-fflags',
    '+bitexact',
    '-y',
    outputName,
  ], { cwd: directory });
  const wallTimeMs = Math.round((performance.now() - started) * 1000) / 1000;
  const outputPath = path.join(directory, outputName);
  const details = await stat(outputPath);
  return Object.freeze({
    run: runNumber,
    wallTimeMs,
    artifact: outputName,
    artifactBytes: details.size,
    artifactSha256: await fileHash(outputPath),
  });
}

function optionBManifest(fixtures) {
  return JSON.stringify({
    version: 1,
    mode: 'ordered-segment-playback',
    mimeType: 'audio/webm',
    durationSeconds: RP8_FIXTURE_COUNT * RP8_FIXTURE_DURATION_SECONDS,
    segments: fixtures.map((fixture) => ({
      seq: fixture.index,
      file: fixture.name,
      byteSize: fixture.byteSize,
      sha256: fixture.sha256,
    })),
  });
}

async function runOptionB(directory, fixtures, runNumber) {
  const started = performance.now();
  for (const fixture of fixtures) {
    const details = await stat(path.join(directory, fixture.name));
    if (details.size !== fixture.byteSize) {
      throw new Error(`RP-8 fixture ${fixture.name} changed during validation.`);
    }
    if (await fileHash(path.join(directory, fixture.name)) !== fixture.sha256) {
      throw new Error(`RP-8 fixture ${fixture.name} failed hash validation.`);
    }
  }
  const body = optionBManifest(fixtures);
  const name = `option-b-run-${runNumber}.json`;
  await writeFile(path.join(directory, name), `${body}\n`, { flag: 'wx' });
  const wallTimeMs = Math.round((performance.now() - started) * 1000) / 1000;
  return Object.freeze({
    run: runNumber,
    wallTimeMs,
    artifact: name,
    artifactBytes: Buffer.byteLength(`${body}\n`),
    artifactSha256: sha256(`${body}\n`),
  });
}

function octal(value, width) {
  return `${Math.max(0, Number(value) || 0).toString(8).padStart(width - 1, '0')}\0`;
}

function tarHeader(name, byteSize) {
  const header = Buffer.alloc(512);
  header.write(name, 0, 100, 'utf8');
  header.write(octal(0o644, 8), 100, 8, 'ascii');
  header.write(octal(0, 8), 108, 8, 'ascii');
  header.write(octal(0, 8), 116, 8, 'ascii');
  header.write(octal(byteSize, 12), 124, 12, 'ascii');
  header.write(octal(0, 12), 136, 12, 'ascii');
  header.fill(0x20, 148, 156);
  header[156] = '0'.charCodeAt(0);
  header.write('ustar\0', 257, 6, 'ascii');
  header.write('00', 263, 2, 'ascii');
  header.write('storyforge', 265, 10, 'ascii');
  header.write('storyforge', 297, 10, 'ascii');
  const checksum = header.reduce((sum, byte) => sum + byte, 0);
  header.write(`${checksum.toString(8).padStart(6, '0')}\0 `, 148, 8, 'ascii');
  return header;
}

export async function createRp8Tar(directory, fileNames) {
  const chunks = [];
  for (const name of [...fileNames].sort()) {
    const body = await readFile(path.join(directory, name));
    chunks.push(tarHeader(name, body.length), body);
    const padding = body.length % 512;
    if (padding) chunks.push(Buffer.alloc(512 - padding));
  }
  chunks.push(Buffer.alloc(1024));
  return Buffer.concat(chunks);
}

export function rp8RequestAuthorized(request, token) {
  const supplied = String(
    request?.headers?.['rp8-probe-token']
      ?? request?.headers?.['x-rp8-probe-token']
      ?? request?.headers?.rp8_probe_token
      ?? '',
  );
  const expected = String(token || '');
  if (!/^[0-9a-f]{64}$/i.test(expected) || supplied.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
}

export function evaluateRp8Selection({
  concat,
  copy,
}) {
  const concatPass = Boolean(
    concat?.ffmpegPresent
    && concat?.timingsPass
    && concat?.hashesMatch
    && concat?.chromePlayback
    && concat?.safariPlayback
    && concat?.interruptionIdempotent,
  );
  const copyPass = Boolean(
    copy?.timingsPass
    && copy?.hashesMatch
    && copy?.chromePlayback
    && copy?.safariPlayback,
  );
  return Object.freeze({
    concatPass,
    copyPass,
    result: concatPass ? 'option_a' : (copyPass ? 'option_b' : 'gate_failed'),
  });
}

export async function runRp8Probe({
  ffmpegBinary = 'ffmpeg',
  workspace,
} = {}) {
  const directory = workspace || path.join(tmpdir(), `storyforge-rp8-${process.pid}`);
  await rm(directory, { recursive: true, force: true });
  await mkdir(directory, { recursive: true });
  const fixtures = await generateFixtures(directory, ffmpegBinary);
  const optionA = [
    await runOptionA(directory, fixtures, ffmpegBinary, 1),
    await runOptionA(directory, fixtures, ffmpegBinary, 2),
  ];
  const optionB = [
    await runOptionB(directory, fixtures, 1),
    await runOptionB(directory, fixtures, 2),
  ];
  const optionAAutomatedPass = (
    optionA.every((item) => item.wallTimeMs <= RP8_PASS_LIMIT_MS)
    && optionA[0].artifactSha256 === optionA[1].artifactSha256
  );
  const optionBAutomatedPass = (
    optionB.every((item) => item.wallTimeMs <= RP8_PASS_LIMIT_MS)
    && optionB[0].artifactSha256 === optionB[1].artifactSha256
  );
  const manifest = {
    schemaVersion: 1,
    fixtureContract: {
      count: RP8_FIXTURE_COUNT,
      durationSeconds: RP8_FIXTURE_DURATION_SECONDS,
      totalDurationSeconds: RP8_FIXTURE_COUNT * RP8_FIXTURE_DURATION_SECONDS,
      generator: 'deterministic-sine-wave',
    },
    options: {
      concat: {
        runs: optionA,
        timingsMs: optionA.map((item) => item.wallTimeMs),
        artifactHashes: optionA.map((item) => item.artifactSha256),
        automatedPass: optionAAutomatedPass,
        playbackRequired: ['Chrome', 'Safari'],
        pass: false,
      },
      copy: {
        runs: optionB,
        timingsMs: optionB.map((item) => item.wallTimeMs),
        artifactHashes: optionB.map((item) => item.artifactSha256),
        automatedPass: optionBAutomatedPass,
        playbackRequired: ['Chrome', 'Safari'],
        pass: false,
      },
    },
    overall: {
      result: 'pending_manual_playback_and_interruption',
      selectedExecutor: null,
    },
  };
  const manifestBody = `${JSON.stringify(manifest, null, 2)}\n`;
  await writeFile(path.join(directory, 'manifest.json'), manifestBody, { flag: 'wx' });
  const names = await readdir(directory);
  const archive = await createRp8Tar(directory, names);
  await writeFile(path.join(directory, 'artifacts.tar'), archive, { flag: 'wx' });
  return Object.freeze({
    directory,
    manifest: Object.freeze(manifest),
    manifestBody,
    archive,
  });
}

export function createRp8ProbeServer({ token, manifestBody, archive }) {
  return createServer((request, response) => {
    if (!rp8RequestAuthorized(request, token)) {
      response.statusCode = 404;
      response.end();
      return;
    }
    if (request.method === 'GET' && request.url === '/rp8/manifest.json') {
      response.statusCode = 200;
      response.setHeader('Content-Type', 'application/json; charset=utf-8');
      response.setHeader('Cache-Control', 'no-store');
      response.end(manifestBody);
      return;
    }
    if (request.method === 'GET' && request.url === '/rp8/artifacts.tar') {
      response.statusCode = 200;
      response.setHeader('Content-Type', 'application/x-tar');
      response.setHeader('Content-Disposition', 'attachment; filename="artifacts.tar"');
      response.setHeader('Cache-Control', 'no-store');
      response.end(archive);
      return;
    }
    response.statusCode = 404;
    response.end();
  });
}

async function main() {
  const token = String(process.env.RP8_PROBE_TOKEN || '');
  if (!/^[0-9a-f]{64}$/i.test(token)) {
    throw new Error('RP8_PROBE_TOKEN must be exactly 64 hexadecimal characters.');
  }
  const port = Number.parseInt(String(process.env.PORT || ''), 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be a valid TCP port.');
  }
  const probe = await runRp8Probe();
  const server = createRp8ProbeServer({
    token,
    manifestBody: probe.manifestBody,
    archive: probe.archive,
  });
  server.listen(port, '0.0.0.0', () => {
    process.stdout.write(`${JSON.stringify({
      event: 'rp8_probe_ready',
      port,
      manifestSha256: sha256(probe.manifestBody),
      archiveSha256: sha256(probe.archive),
    })}\n`);
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${JSON.stringify({
      event: 'rp8_probe_failed',
      code: 'rp8_probe_failed',
    })}\n`);
    process.exitCode = 1;
  });
}
