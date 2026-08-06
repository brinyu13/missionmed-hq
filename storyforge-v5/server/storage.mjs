import { randomUUID } from 'node:crypto';
import {
  CopyObjectCommand,
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
const storyMediaTypes = Object.freeze({
  'image/jpeg': { extension: 'jpg', kind: 'photo', maximum: 5 * 1024 * 1024 },
  'image/png': { extension: 'png', kind: 'photo', maximum: 5 * 1024 * 1024 },
  'image/webp': { extension: 'webp', kind: 'photo', maximum: 5 * 1024 * 1024 },
  'video/mp4': { extension: 'mp4', kind: 'video', maximum: 50 * 1024 * 1024 },
  'video/webm': { extension: 'webm', kind: 'video', maximum: 50 * 1024 * 1024 },
});
const legacyAudioExtension = /\.(?:webm|m4a|mp4|ogg|wav)$/i;
let client;

export function audioExtension(contentType) {
  const extension = {
    'audio/webm': 'webm',
    'audio/mp4': 'm4a',
    'audio/ogg': 'ogg',
    'audio/wav': 'wav',
  }[String(contentType || '').toLowerCase()];
  if (!extension) {
    const error = new Error('Unsupported audio format.');
    error.code = 'unsupported_audio_format';
    throw error;
  }
  return extension;
}

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
  const extension = audioExtension(contentType);
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

export function storyMediaSpec(contentType, byteSize) {
  const normalizedType = String(contentType || '').toLowerCase();
  const spec = storyMediaTypes[normalizedType];
  if (!spec) {
    const error = new Error('Use a JPEG, PNG, WebP, MP4, or WebM file.');
    error.code = 'unsupported_story_media_format';
    throw error;
  }
  if (!Number.isInteger(byteSize) || byteSize < 1 || byteSize > spec.maximum) {
    const error = new Error(spec.kind === 'photo' ? 'Photos must be 5 MB or smaller.' : 'Videos must be 50 MB or smaller.');
    error.code = 'invalid_story_media_size';
    throw error;
  }
  return Object.freeze({ ...spec, contentType: normalizedType, byteSize });
}

export async function createStoryMediaUpload({ studentId, storyId, mediaId, contentType, byteSize }) {
  const spec = storyMediaSpec(contentType, byteSize);
  const objectKey = `storyforge-media/pending/${studentId}/${storyId}/${mediaId}.${spec.extension}`;
  const command = new PutObjectCommand({
    Bucket: config.r2.bucket,
    Key: objectKey,
    ContentType: spec.contentType,
    ContentLength: spec.byteSize,
    Metadata: { student: studentId, story: storyId, media: mediaId, kind: spec.kind },
  });
  return {
    objectKey,
    uploadUrl: await getSignedUrl(storageClient(), command, { expiresIn: config.r2.signedUrlTtlSeconds }),
    expiresIn: config.r2.signedUrlTtlSeconds,
    kind: spec.kind,
  };
}

function validStoryMediaSignature(contentType, bytes) {
  const hex = Buffer.from(bytes).toString('hex');
  if (contentType === 'image/jpeg') return hex.startsWith('ffd8ff');
  if (contentType === 'image/png') return hex.startsWith('89504e470d0a1a0a');
  if (contentType === 'image/webp') return hex.startsWith('52494646') && hex.slice(16, 24) === '57454250';
  if (contentType === 'video/mp4') return hex.slice(8, 16) === '66747970';
  if (contentType === 'video/webm') return hex.startsWith('1a45dfa3');
  return false;
}

export async function verifyStoryMediaUpload({ objectKey, expectedType, expectedSize }) {
  const spec = storyMediaSpec(expectedType, expectedSize);
  const metadata = await storageClient().send(new HeadObjectCommand({ Bucket: config.r2.bucket, Key: objectKey }));
  const actualType = String(metadata.ContentType || '').toLowerCase();
  const actualSize = Number(metadata.ContentLength);
  if (actualType !== spec.contentType || actualSize !== spec.byteSize) {
    const error = new Error('Uploaded media metadata does not match the signed request.');
    error.code = 'story_media_verification_failed';
    throw error;
  }
  const object = await storageClient().send(new GetObjectCommand({
    Bucket: config.r2.bucket,
    Key: objectKey,
    Range: 'bytes=0-31',
  }));
  const bytes = await object.Body.transformToByteArray();
  if (!validStoryMediaSignature(spec.contentType, bytes)) {
    const error = new Error('The uploaded file content does not match its approved media type.');
    error.code = 'story_media_signature_mismatch';
    throw error;
  }
  return { ...spec, etag: String(metadata.ETag || '').replaceAll('"', '') };
}

export async function promoteStoryMediaObject({ objectKey, studentId, storyId, mediaId, contentType }) {
  const spec = storyMediaSpec(contentType, 1);
  const targetObjectKey = `storyforge-media/${studentId}/${storyId}/${mediaId}.${spec.extension}`;
  await storageClient().send(new CopyObjectCommand({
    Bucket: config.r2.bucket,
    CopySource: `${config.r2.bucket}/${encodeURIComponent(objectKey).replaceAll('%2F', '/')}`,
    Key: targetObjectKey,
    ContentType: spec.contentType,
    MetadataDirective: 'REPLACE',
    Metadata: { student: studentId, story: storyId, media: mediaId, kind: spec.kind },
  }));
  return { targetObjectKey };
}

export async function copyAudioObject({ sourceKey, targetKey, contentType }) {
  await storageClient().send(new CopyObjectCommand({
    Bucket: config.r2.bucket,
    CopySource: `${config.r2.bucket}/${encodeURIComponent(sourceKey).replaceAll('%2F', '/')}`,
    Key: targetKey,
    ContentType: contentType,
    MetadataDirective: 'REPLACE',
  }));
}

export async function headAudioObject({ objectKey }) {
  const result = await storageClient().send(new HeadObjectCommand({
    Bucket: config.r2.bucket,
    Key: objectKey,
  }));
  return {
    objectKey,
    contentType: result.ContentType || null,
    byteSize: Number(result.ContentLength || 0),
    etag: String(result.ETag || '').replaceAll('"', ''),
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

export async function listAudioObjects({ prefix }) {
  const objects = [];
  let continuationToken;
  do {
    const page = await listAudioObjectsPage({ prefix, continuationToken });
    objects.push(...page.objects);
    continuationToken = page.continuationToken || undefined;
  } while (continuationToken);
  return objects;
}

export async function listAudioObjectsPage({
  prefix,
  continuationToken,
  maxKeys = 1000,
}) {
  const boundedMaxKeys = Math.max(1, Math.min(1000, Number(maxKeys) || 1000));
  const result = await storageClient().send(new ListObjectsV2Command({
    Bucket: config.r2.bucket,
    Prefix: prefix,
    ContinuationToken: continuationToken || undefined,
    MaxKeys: boundedMaxKeys,
  }));
  const nextContinuationToken = result.IsTruncated
    ? String(result.NextContinuationToken || '')
    : '';
  if (result.IsTruncated && !nextContinuationToken) {
    const error = new Error('Private audio storage returned an incomplete listing page.');
    error.code = 'audio_storage_unavailable';
    throw error;
  }
  return {
    objects: (result.Contents || [])
      .filter((item) => item.Key)
      .map((item) => ({
        objectKey: item.Key,
        byteSize: item.Size == null ? null : Number(item.Size),
        lastModified: item.LastModified || null,
        etag: String(item.ETag || '').replaceAll('"', ''),
      })),
    continuationToken: nextContinuationToken || null,
    truncated: Boolean(result.IsTruncated),
  };
}

export async function readAudioControlObject({ objectKey }) {
  let result;
  try {
    result = await storageClient().send(new GetObjectCommand({
      Bucket: config.r2.bucket,
      Key: objectKey,
    }));
  } catch (error) {
    if (
      error?.name === 'NoSuchKey'
      || error?.Code === 'NoSuchKey'
      || error?.$metadata?.httpStatusCode === 404
    ) {
      return null;
    }
    throw error;
  }
  let content;
  if (typeof result.Body?.transformToString === 'function') {
    content = await result.Body.transformToString();
  } else if (typeof result.Body?.transformToByteArray === 'function') {
    content = Buffer.from(await result.Body.transformToByteArray()).toString('utf8');
  } else {
    const error = new Error('Private audio storage returned an unreadable control object.');
    error.code = 'audio_storage_unavailable';
    throw error;
  }
  const parsed = JSON.parse(content);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    const error = new Error('Private audio storage returned an invalid control object.');
    error.code = 'audio_storage_unavailable';
    throw error;
  }
  return parsed;
}

export async function writeAudioControlObject({ objectKey, value }) {
  const body = JSON.stringify(value);
  await storageClient().send(new PutObjectCommand({
    Bucket: config.r2.bucket,
    Key: objectKey,
    ContentType: 'application/json',
    ContentLength: Buffer.byteLength(body),
    Body: body,
  }));
}

export async function deleteAudioObject({ objectKey }) {
  await storageClient().send(new DeleteObjectCommand({
    Bucket: config.r2.bucket,
    Key: objectKey,
  }));
}

export async function deleteRecordingPrefix({ prefix }) {
  const objects = await listAudioObjects({ prefix });
  await deleteRecordingObjects({
    objectKeys: objects.map((item) => item.objectKey),
  });
  return { deleted: objects.length };
}

export async function deleteAudioAssetObject({ asset }) {
  const objectKey = String(asset?.objectKey || asset?.object_key || '');
  if (!objectKey) return;
  if (!legacyAudioExtension.test(objectKey)) {
    const objects = await listAudioObjects({ prefix: objectKey });
    await deleteRecordingObjects({
      objectKeys: objects.map((item) => item.objectKey),
    });
    return;
  }
  await storageClient().send(new DeleteObjectCommand({
    Bucket: config.r2.bucket,
    Key: objectKey,
  }));
}
