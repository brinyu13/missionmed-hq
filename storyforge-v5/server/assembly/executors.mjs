import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const maxSegments = 200;
const maxAssetBytes = 50 * 1024 * 1024;

export const assemblyMimeExtensions = Object.freeze({
  'audio/webm': 'webm',
  'audio/mp4': 'm4a',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
});

export class AssemblyExecutorError extends Error {
  constructor(code, message, cause) {
    super(message, cause ? { cause } : undefined);
    this.name = 'AssemblyExecutorError';
    this.code = code;
  }
}

function requireFunction(value, name) {
  if (typeof value !== 'function') {
    throw new TypeError(`${name} must be supplied.`);
  }
  return value;
}

function exactUuid(value, name) {
  const result = String(value || '');
  if (!uuidPattern.test(result)) {
    throw new AssemblyExecutorError(
      'assembly_invalid_identifier',
      `${name} must be a UUID.`,
    );
  }
  return result;
}

function exactMimeType(value) {
  const mimeType = String(value || '');
  if (!Object.hasOwn(assemblyMimeExtensions, mimeType)) {
    throw new AssemblyExecutorError(
      'assembly_unsupported_audio_format',
      'The recording manifest contains an unsupported audio format.',
    );
  }
  return mimeType;
}

function segmentValue(segment, camel, snake) {
  return segment?.[camel] ?? segment?.[snake];
}

export function validateAssemblySegments({
  studentId: studentIdValue,
  recordingId: recordingIdValue,
  segments,
}) {
  const studentId = exactUuid(studentIdValue, 'studentId');
  const recordingId = exactUuid(recordingIdValue, 'recordingId');
  if (!Array.isArray(segments) || segments.length < 1 || segments.length > maxSegments) {
    throw new AssemblyExecutorError(
      'assembly_segment_manifest_invalid',
      'The recording manifest must contain between 1 and 200 segments.',
    );
  }

  let mimeType = null;
  const normalized = segments.map((segment, index) => {
    const seq = Number(segmentValue(segment, 'seq', 'seq'));
    if (!Number.isInteger(seq) || seq !== index) {
      throw new AssemblyExecutorError(
        'assembly_segment_manifest_invalid',
        'Recording segments must be ordered contiguously from sequence zero.',
      );
    }
    const currentMimeType = exactMimeType(segmentValue(segment, 'mimeType', 'mime_type'));
    if (mimeType == null) mimeType = currentMimeType;
    if (currentMimeType !== mimeType) {
      throw new AssemblyExecutorError(
        'assembly_mime_mismatch',
        'Every segment in one recording session must use the same audio format.',
      );
    }
    const extension = assemblyMimeExtensions[currentMimeType];
    const expectedObjectKey = (
      `storyforge-rec/${studentId}/${recordingId}/`
      + `seg-${String(seq).padStart(5, '0')}.${extension}`
    );
    const objectKey = String(segmentValue(segment, 'objectKey', 'object_key') || '');
    if (objectKey !== expectedObjectKey) {
      throw new AssemblyExecutorError(
        'assembly_segment_manifest_invalid',
        'A recording segment key does not match its server-derived session path.',
      );
    }
    return Object.freeze({
      seq,
      mimeType: currentMimeType,
      objectKey,
    });
  });

  return Object.freeze({
    studentId,
    recordingId,
    mimeType,
    extension: assemblyMimeExtensions[mimeType],
    prefix: `storyforge-rec/${studentId}/${recordingId}/`,
    segments: Object.freeze(normalized),
  });
}

export function ffmpegStreamCopyArgs({
  manifestName = 'concat.txt',
  outputName,
}) {
  if (!outputName || path.basename(outputName) !== outputName) {
    throw new AssemblyExecutorError(
      'assembly_output_invalid',
      'The ffmpeg output name must be a local filename.',
    );
  }
  return Object.freeze([
    '-hide_banner',
    '-loglevel',
    'error',
    '-nostdin',
    '-f',
    'concat',
    '-safe',
    '1',
    '-i',
    manifestName,
    '-map',
    '0:a:0',
    '-c',
    'copy',
    '-y',
    outputName,
  ]);
}

function runProcess({
  binary,
  args,
  cwd,
  spawnProcess,
}) {
  return new Promise((resolve, reject) => {
    let stderr = '';
    let child;
    try {
      child = spawnProcess(binary, args, {
        cwd,
        shell: false,
        stdio: ['ignore', 'ignore', 'pipe'],
      });
    } catch (cause) {
      reject(new AssemblyExecutorError(
        'assembly_ffmpeg_failed',
        'The ffmpeg assembly process could not start.',
        cause,
      ));
      return;
    }
    child.stderr?.on('data', (chunk) => {
      if (stderr.length < 8_192) {
        stderr += String(chunk).slice(0, 8_192 - stderr.length);
      }
    });
    child.once('error', (cause) => {
      reject(new AssemblyExecutorError(
        'assembly_ffmpeg_failed',
        'The ffmpeg assembly process failed.',
        cause,
      ));
    });
    child.once('close', (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      const detail = stderr.trim();
      reject(new AssemblyExecutorError(
        'assembly_ffmpeg_failed',
        `The ffmpeg assembly process exited unsuccessfully (${code ?? signal ?? 'unknown'})${detail ? `: ${detail}` : '.'}`,
      ));
    });
  });
}

export async function ffmpegConcatStreamCopy({
  segments,
  extension,
  ffmpegBinary = 'ffmpeg',
  spawnProcess = spawn,
}) {
  requireFunction(spawnProcess, 'spawnProcess');
  const temporary = await mkdtemp(path.join(tmpdir(), 'storyforge-assembly.'));
  try {
    const manifestLines = [];
    for (const segment of segments) {
      const filename = `seg-${String(segment.seq).padStart(5, '0')}.${extension}`;
      await writeFile(path.join(temporary, filename), segment.body, { flag: 'wx' });
      manifestLines.push(`file '${filename}'`);
    }
    const manifestName = 'concat.txt';
    const outputName = `assembled.${extension}`;
    await writeFile(
      path.join(temporary, manifestName),
      `${manifestLines.join('\n')}\n`,
      { flag: 'wx' },
    );
    await runProcess({
      binary: ffmpegBinary,
      args: ffmpegStreamCopyArgs({ manifestName, outputName }),
      cwd: temporary,
      spawnProcess,
    });
    return await readFile(path.join(temporary, outputName));
  } finally {
    await rm(temporary, { force: true, recursive: true });
  }
}

function normalizeObjectBytes(value) {
  const body = Buffer.isBuffer(value)
    ? value
    : (value instanceof Uint8Array ? Buffer.from(value) : null);
  if (!body || body.byteLength < 1) {
    throw new AssemblyExecutorError(
      'assembly_segment_missing',
      'A recording segment could not be read from private storage.',
    );
  }
  return body;
}

export function createOptionAAssemblyExecutor({
  loadSegments,
  getObject,
  putObject,
  runConcatRemux = ffmpegConcatStreamCopy,
  ffmpegBinary = 'ffmpeg',
  spawnProcess = spawn,
}) {
  requireFunction(loadSegments, 'loadSegments');
  requireFunction(getObject, 'getObject');
  requireFunction(putObject, 'putObject');
  requireFunction(runConcatRemux, 'runConcatRemux');

  async function assembleRecording({ studentId, recordingId }) {
    const manifest = validateAssemblySegments({
      studentId,
      recordingId,
      segments: await loadSegments({ studentId, recordingId }),
    });
    const hydrated = [];
    let sourceByteSize = 0;
    for (const segment of manifest.segments) {
      const body = normalizeObjectBytes(await getObject({ objectKey: segment.objectKey }));
      sourceByteSize += body.byteLength;
      if (sourceByteSize > maxAssetBytes) {
        throw new AssemblyExecutorError(
          'assembly_output_too_large',
          'The assembled recording exceeds the 50 MB limit.',
        );
      }
      hydrated.push(Object.freeze({ ...segment, body }));
    }
    const output = normalizeObjectBytes(await runConcatRemux({
      segments: Object.freeze(hydrated),
      mimeType: manifest.mimeType,
      extension: manifest.extension,
      ffmpegBinary,
      spawnProcess,
    }));
    if (output.byteLength > maxAssetBytes) {
      throw new AssemblyExecutorError(
        'assembly_output_too_large',
        'The assembled recording exceeds the 50 MB limit.',
      );
    }
    const artifactKey = `${manifest.prefix}assembled.${manifest.extension}`;
    await putObject({
      objectKey: artifactKey,
      contentType: manifest.mimeType,
      body: output,
      byteSize: output.byteLength,
    });
    return Object.freeze({
      option: 'A',
      artifactReady: true,
      artifactKey,
      mimeType: manifest.mimeType,
      extension: manifest.extension,
      segmentCount: manifest.segments.length,
      byteSize: output.byteLength,
      checksumSha256: createHash('sha256').update(output).digest('hex'),
    });
  }

  return Object.freeze({
    available: true,
    option: 'A',
    assembleRecording,
  });
}

function headContentType(head) {
  return String(head?.contentType ?? head?.ContentType ?? '');
}

function headByteSize(head) {
  return Number(head?.byteSize ?? head?.ContentLength ?? 0);
}

export function createOptionBAssemblyExecutor({
  loadSegments,
  headObject,
}) {
  requireFunction(loadSegments, 'loadSegments');
  requireFunction(headObject, 'headObject');

  async function assembleRecording({ studentId, recordingId }) {
    const manifest = validateAssemblySegments({
      studentId,
      recordingId,
      segments: await loadSegments({ studentId, recordingId }),
    });
    for (const segment of manifest.segments) {
      const head = await headObject({ objectKey: segment.objectKey });
      if (
        headContentType(head) !== manifest.mimeType
        || !Number.isInteger(headByteSize(head))
        || headByteSize(head) < 1
      ) {
        throw new AssemblyExecutorError(
          'assembly_segment_missing',
          'A recording segment is missing or has incompatible storage metadata.',
        );
      }
    }
    return Object.freeze({
      option: 'B',
      artifactReady: true,
      mimeType: manifest.mimeType,
      extension: manifest.extension,
      segmentCount: manifest.segments.length,
      sourceKeys: Object.freeze(manifest.segments.map((segment) => segment.objectKey)),
    });
  }

  return Object.freeze({
    available: true,
    option: 'B',
    assembleRecording,
  });
}
