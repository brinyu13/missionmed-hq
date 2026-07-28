import { randomUUID } from 'node:crypto';
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config, isAudioConfigured } from './config.mjs';

const allowedTypes = new Set(['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/wav']);
let client;

function storageClient() {
  if (!isAudioConfigured()) {
    const error = new Error('Private StoryForge audio storage is not configured.');
    error.code = 'audio_storage_unavailable';
    throw error;
  }
  if (!client) {
    client = new S3Client({
      endpoint: config.r2.endpoint,
      region: config.r2.region,
      credentials: {
        accessKeyId: config.r2.accessKeyId,
        secretAccessKey: config.r2.secretAccessKey,
      },
    });
  }
  return client;
}

export async function createAudioUpload({ studentId, storyId, contentType, byteSize }) {
  if (!allowedTypes.has(contentType)) {
    const error = new Error('Unsupported audio format.');
    error.code = 'unsupported_audio_format';
    throw error;
  }
  if (!Number.isInteger(byteSize) || byteSize < 1 || byteSize > 50 * 1024 * 1024) {
    const error = new Error('Audio must be between 1 byte and 50 MB.');
    error.code = 'invalid_audio_size';
    throw error;
  }
  const extension = {
    'audio/webm': 'webm',
    'audio/mp4': 'm4a',
    'audio/ogg': 'ogg',
    'audio/wav': 'wav',
  }[contentType];
  const objectKey = `storyforge-audio/${studentId}/${storyId}/${randomUUID()}.${extension}`;
  const command = new PutObjectCommand({
    Bucket: config.r2.bucket,
    Key: objectKey,
    ContentType: contentType,
    ContentLength: byteSize,
    Metadata: { student: studentId, story: storyId },
  });
  const uploadUrl = await getSignedUrl(storageClient(), command, {
    expiresIn: config.r2.signedUrlTtlSeconds,
  });
  return {
    objectKey,
    uploadUrl,
    expiresIn: config.r2.signedUrlTtlSeconds,
  };
}

export async function verifyAudioUpload({ objectKey, expectedType, expectedSize }) {
  const result = await storageClient().send(new HeadObjectCommand({
    Bucket: config.r2.bucket,
    Key: objectKey,
  }));
  if (result.ContentType !== expectedType || Number(result.ContentLength) !== expectedSize) {
    const error = new Error('Uploaded audio metadata does not match the signed request.');
    error.code = 'audio_verification_failed';
    throw error;
  }
  return {
    contentType: result.ContentType,
    byteSize: Number(result.ContentLength),
    etag: String(result.ETag || '').replaceAll('"', ''),
  };
}

export async function createAudioPlayback({ objectKey }) {
  const command = new GetObjectCommand({
    Bucket: config.r2.bucket,
    Key: objectKey,
  });
  const playbackUrl = await getSignedUrl(storageClient(), command, {
    expiresIn: config.r2.signedUrlTtlSeconds,
  });
  return {
    playbackUrl,
    expiresIn: config.r2.signedUrlTtlSeconds,
  };
}
