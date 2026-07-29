import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import {
  AssemblyExecutorError,
  assemblyMimeExtensions,
  createOptionAAssemblyExecutor,
  createOptionBAssemblyExecutor,
  ffmpegStreamCopyArgs,
  validateAssemblySegments,
} from '../../server/assembly/executors.mjs';

const studentId = '11111111-1111-4111-8111-111111111111';
const recordingId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function segment(seq, mimeType = 'audio/webm') {
  const extension = assemblyMimeExtensions[mimeType];
  return {
    seq,
    mimeType,
    objectKey: (
      `storyforge-rec/${studentId}/${recordingId}/`
      + `seg-${String(seq).padStart(5, '0')}.${extension}`
    ),
  };
}

test('assembly MIME mapping and ffmpeg command are exact and stream-copy only', () => {
  assert.deepEqual(assemblyMimeExtensions, {
    'audio/webm': 'webm',
    'audio/mp4': 'm4a',
    'audio/ogg': 'ogg',
    'audio/wav': 'wav',
  });
  const args = ffmpegStreamCopyArgs({
    manifestName: 'concat.txt',
    outputName: 'assembled.m4a',
  });
  assert.deepEqual(args.slice(args.indexOf('-c'), args.indexOf('-c') + 2), ['-c', 'copy']);
  assert.deepEqual(args.slice(args.indexOf('-f'), args.indexOf('-f') + 2), ['-f', 'concat']);
  assert.equal(args.includes('aac'), false);
  assert.equal(args.at(-1), 'assembled.m4a');
});

test('manifest validation requires exact keys, contiguous input order, and one supported MIME', () => {
  assert.deepEqual(
    validateAssemblySegments({
      studentId,
      recordingId,
      segments: [segment(0), segment(1)],
    }).segments.map(({ seq }) => seq),
    [0, 1],
  );

  for (const segments of [
    [segment(1)],
    [segment(0), segment(2)],
    [segment(1), segment(0)],
    [segment(0), segment(1, 'audio/mp4')],
    [{ ...segment(0), objectKey: `storyforge-rec/${studentId}/${recordingId}/assembled.webm` }],
    [{
      seq: 0,
      mimeType: 'audio/mpeg',
      objectKey: `storyforge-rec/${studentId}/${recordingId}/seg-00000.mp3`,
    }],
  ]) {
    assert.throws(
      () => validateAssemblySegments({ studentId, recordingId, segments }),
      (error) => error instanceof AssemblyExecutorError && error.code.startsWith('assembly_'),
    );
  }
});

test('Option A reads ordered segments, remuxes once, and writes only assembled.ext in the session prefix', async () => {
  const gets = [];
  const writes = [];
  const remuxes = [];
  const output = Buffer.from('stream-copy-output');
  const executor = createOptionAAssemblyExecutor({
    async loadSegments() {
      return [segment(0), segment(1)];
    },
    async getObject(input) {
      gets.push(input);
      return Buffer.from(input.objectKey.endsWith('00000.webm') ? 'first' : 'second');
    },
    async runConcatRemux(input) {
      remuxes.push(input);
      return output;
    },
    async putObject(input) {
      writes.push(input);
    },
  });

  const result = await executor.assembleRecording({ studentId, recordingId });
  assert.equal(executor.option, 'A');
  assert.equal(executor.available, true);
  assert.deepEqual(gets, [
    { objectKey: segment(0).objectKey },
    { objectKey: segment(1).objectKey },
  ]);
  assert.equal(remuxes.length, 1);
  assert.equal(remuxes[0].mimeType, 'audio/webm');
  assert.equal(remuxes[0].extension, 'webm');
  assert.deepEqual(
    remuxes[0].segments.map(({ seq, objectKey, body }) => ({
      seq,
      objectKey,
      body: body.toString(),
    })),
    [
      { seq: 0, objectKey: segment(0).objectKey, body: 'first' },
      { seq: 1, objectKey: segment(1).objectKey, body: 'second' },
    ],
  );
  assert.equal(writes.length, 1);
  assert.deepEqual(writes[0], {
    objectKey: `storyforge-rec/${studentId}/${recordingId}/assembled.webm`,
    contentType: 'audio/webm',
    body: output,
    byteSize: output.byteLength,
  });
  assert.deepEqual(result, {
    option: 'A',
    artifactReady: true,
    artifactKey: `storyforge-rec/${studentId}/${recordingId}/assembled.webm`,
    mimeType: 'audio/webm',
    extension: 'webm',
    segmentCount: 2,
    byteSize: output.byteLength,
    checksumSha256: createHash('sha256').update(output).digest('hex'),
  });
  assert.equal('assetId' in result, false);
});

test('Option A fails closed before any object write when the remux output is empty', async () => {
  let writeCount = 0;
  const executor = createOptionAAssemblyExecutor({
    async loadSegments() {
      return [segment(0)];
    },
    async getObject() {
      return Buffer.from('segment');
    },
    async runConcatRemux() {
      return Buffer.alloc(0);
    },
    async putObject() {
      writeCount += 1;
    },
  });
  await assert.rejects(
    executor.assembleRecording({ studentId, recordingId }),
    (error) => error instanceof AssemblyExecutorError
      && error.code === 'assembly_segment_missing',
  );
  assert.equal(writeCount, 0);
});

test('Option B HEAD-validates every ordered segment and writes no assembly artifact', async () => {
  const heads = [];
  const executor = createOptionBAssemblyExecutor({
    async loadSegments() {
      return [segment(0, 'audio/mp4'), segment(1, 'audio/mp4')];
    },
    async headObject(input) {
      heads.push(input);
      return { contentType: 'audio/mp4', byteSize: 1_024 };
    },
  });

  const result = await executor.assembleRecording({ studentId, recordingId });
  assert.equal(executor.option, 'B');
  assert.equal(executor.available, true);
  assert.deepEqual(heads, [
    { objectKey: segment(0, 'audio/mp4').objectKey },
    { objectKey: segment(1, 'audio/mp4').objectKey },
  ]);
  assert.deepEqual(result, {
    option: 'B',
    artifactReady: true,
    mimeType: 'audio/mp4',
    extension: 'm4a',
    segmentCount: 2,
    sourceKeys: [
      segment(0, 'audio/mp4').objectKey,
      segment(1, 'audio/mp4').objectKey,
    ],
  });
  assert.equal('artifactKey' in result, false);
  assert.equal('assetId' in result, false);
});

test('Option B rejects absent or mismatched object metadata', async () => {
  for (const head of [
    { contentType: 'audio/ogg', byteSize: 1 },
    { contentType: 'audio/webm', byteSize: 0 },
    null,
  ]) {
    const executor = createOptionBAssemblyExecutor({
      async loadSegments() {
        return [segment(0)];
      },
      async headObject() {
        return head;
      },
    });
    await assert.rejects(
      executor.assembleRecording({ studentId, recordingId }),
      (error) => error instanceof AssemblyExecutorError
        && error.code === 'assembly_segment_missing',
    );
  }
});
