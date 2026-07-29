import { randomUUID } from 'node:crypto';
import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config, isAudioConfigured } from './config.mjs';

const allowedTypes = new Set(['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/wav']);
let client;

export function createR2StorageClient({
  endpoint,
  region,
  accessKeyId,
  secretAccessKey,
}) {
  return new S3Client({
    endpoint,
    region,
    // Keep browser-facing presigned URLs on the exact configured R2 origin.
    // Without path-style addressing the SDK prefixes the bucket onto the host,
    // which would diverge from the exact-origin CSP enforced by every gateway.
    forcePathStyle: true,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

function storageClient() {
  if (!isAudioConfigured()) {
    const error = new Error('Private StoryForge audio storage is not configured.');
    error.code = 'audio_storage_unavailable';
    throw error;
  }
  if (!client) {
    client = createR2StorageClient({
      endpoint: config.r2.endpoint,
      region: config.r2.region,
      accessKeyId: config.r2.accessKeyId,
      secretAccessKey: config.r2.secretAccessKey,
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

export async function putRecordingSegment({
  objectKey,
  contentType,
  body,
  byteSize,
}) {
  await storageClient().send(new PutObjectCommand({
    Bucket: config.r2.bucket,
    Key: objectKey,
    ContentType: contentType,
    ContentLength: byteSize,
    Body: body,
  }));
}

export async function getRecordingSegment({ objectKey }) {
  const result = await storageClient().send(new GetObjectCommand({
    Bucket: config.r2.bucket,
    Key: objectKey,
  }));
  if (!result.Body?.transformToByteArray) {
    const error = new Error('Private recording storage returned an unreadable segment.');
    error.code = 'audio_storage_unavailable';
    throw error;
  }
  return Buffer.from(await result.Body.transformToByteArray());
}

export async function deleteRecordingObjects({ objectKeys }) {
  const keys = [...new Set((objectKeys || []).map(String).filter(Boolean))];
  for (let index = 0; index < keys.length; index += 1000) {
    const batch = keys.slice(index, index + 1000);
    const result = await storageClient().send(new DeleteObjectsCommand({
      Bucket: config.r2.bucket,
      Delete: {
        Objects: batch.map((Key) => ({ Key })),
        Quiet: true,
      },
    }));
    if (result.Errors?.length) {
      const error = new Error('Private recording storage could not delete every object.');
      error.code = 'audio_storage_unavailable';
      throw error;
    }
  }
}

async function objectKeysUnder(prefix) {
  const keys = [];
  let continuationToken;
  do {
    const result = await storageClient().send(new ListObjectsV2Command({
      Bucket: config.r2.bucket,
      Prefix: prefix,
      ContinuationToken: continuationToken,
    }));
    result.Contents?.forEach((item) => {
      if (item.Key) keys.push(item.Key);
    });
    continuationToken = result.IsTruncated ? result.NextContinuationToken : undefined;
  } while (continuationToken);
  return keys;
}

export async function deleteAudioAssetObject({ asset }) {
  const objectKey = String(asset?.objectKey || asset?.object_key || '');
  if (!objectKey) return;
  if (objectKey.endsWith('/')) {
    await deleteRecordingObjects({ objectKeys: await objectKeysUnder(objectKey) });
    return;
  }
  await storageClient().send(new DeleteObjectCommand({
    Bucket: config.r2.bucket,
    Key: objectKey,
  }));
}
