import { randomUUID } from 'node:crypto';

export class StoryMediaError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = 'StoryMediaError';
    this.code = code;
    this.status = status;
  }
}

export function storyMediaForceOff(environment = process.env) {
  return !['0', 'false', 'no', 'off'].includes(
    String(environment.STORYFORGE_STORY_MEDIA_FORCE_OFF ?? '1').trim().toLowerCase(),
  );
}

function ensureEnabled(environment) {
  if (storyMediaForceOff(environment)) {
    throw new StoryMediaError('story_media_disabled', 'Private story media is currently unavailable.', 403);
  }
}

function ensureStudent(identity) {
  if (identity?.eligible !== true || identity?.role !== 'student') {
    throw new StoryMediaError('student_required', 'An eligible student identity is required.', 403);
  }
}

function caption(value) {
  const text = String(value || '').trim();
  if (text.length > 240 || /[<>\u0000-\u001f\u007f]/u.test(text)) {
    throw new StoryMediaError('invalid_story_media_caption', 'Use a plain-text description of 240 characters or fewer.');
  }
  return text;
}

function databaseError(error) {
  if (error?.code === 'P0002') return new StoryMediaError('story_media_not_found', 'Story media was not found.', 404);
  if (error?.code === '42501') return new StoryMediaError('story_media_forbidden', 'Story media is unavailable for this signed account.', 403);
  if (error?.code === '40001') return new StoryMediaError('story_media_conflict', 'Story media changed. Reload before trying again.', 409);
  if (error?.code === '23514') return new StoryMediaError('story_media_limit', error.message || 'Story media cannot be changed.', 409);
  return error;
}

export function createStoryMediaService({
  withIdentity,
  environment = process.env,
  storage,
} = {}) {
  if (typeof withIdentity !== 'function') throw new TypeError('withIdentity must be supplied.');
  for (const name of ['spec', 'createUpload', 'verifyUpload', 'promoteObject', 'signPlayback', 'deleteObject']) {
    if (typeof storage?.[name] !== 'function') throw new TypeError(`storage.${name} must be supplied.`);
  }

  async function query(identity, text, values = []) {
    try {
      return await withIdentity(identity, async (client) => client.query(text, values), {
        adminMode: identity?.role === 'admin',
      });
    } catch (error) {
      throw databaseError(error);
    }
  }

  return Object.freeze({
    capability(identity) {
      return !storyMediaForceOff(environment) && identity?.eligible === true;
    },

    async allocate(identity, input = {}) {
      ensureEnabled(environment);
      ensureStudent(identity);
      const storyId = String(input.storyId || '');
      const mediaId = randomUUID();
      const spec = storage.spec(input.mimeType, Number(input.byteSize));
      const result = await query(
        identity,
        'SELECT public.sf_allocate_story_media($1, $2, $3, $4, $5) AS media',
        [storyId, mediaId, spec.contentType, spec.byteSize, caption(input.caption)],
      );
      const media = result.rows[0]?.media;
      const upload = await storage.createUpload({
        studentId: identity.sub,
        storyId,
        mediaId,
        contentType: spec.contentType,
        byteSize: spec.byteSize,
      });
      if (upload.objectKey !== media?.uploadObjectKey) {
        throw new StoryMediaError('story_media_allocation_mismatch', 'Private media allocation could not be verified.', 500);
      }
      return { media, upload: { uploadUrl: upload.uploadUrl, expiresIn: upload.expiresIn } };
    },

    async verify(identity, mediaId, input = {}) {
      ensureEnabled(environment);
      ensureStudent(identity);
      const claimResult = await query(identity, 'SELECT public.sf_pending_story_media_claim($1) AS media', [mediaId]);
      const claim = claimResult.rows[0]?.media;
      const durationMs = claim.kind === 'video' ? Number(input.durationMs) : null;
      if (claim.kind === 'video' && (!Number.isInteger(durationMs) || durationMs < 1 || durationMs > 60_000)) {
        throw new StoryMediaError('invalid_story_media_duration', 'Videos must be 60 seconds or shorter.');
      }
      const verified = await storage.verifyUpload({
        objectKey: claim.uploadObjectKey,
        expectedType: claim.mimeType,
        expectedSize: Number(claim.byteSize),
      });
      const promoted = await storage.promoteObject({
        objectKey: claim.uploadObjectKey,
        studentId: claim.studentId,
        storyId: claim.storyId,
        mediaId: claim.id,
        contentType: claim.mimeType,
      });
      try {
        const result = await query(
          identity,
          'SELECT public.sf_commit_story_media($1, $2, $3, $4) AS media',
          [claim.id, promoted.targetObjectKey, verified.etag, durationMs],
        );
        await storage.deleteObject({ objectKey: claim.uploadObjectKey });
        return result.rows[0]?.media;
      } catch (error) {
        await storage.deleteObject({ objectKey: promoted.targetObjectKey }).catch(() => {});
        throw error;
      }
    },

    async list(identity, storyId) {
      ensureEnabled(environment);
      if (identity?.eligible !== true) throw new StoryMediaError('story_media_forbidden', 'Story media is unavailable for this signed account.', 403);
      const result = await query(identity, 'SELECT public.sf_list_story_media($1) AS media', [storyId]);
      return result.rows[0]?.media || [];
    },

    async playback(identity, mediaId) {
      ensureEnabled(environment);
      if (identity?.eligible !== true) throw new StoryMediaError('story_media_forbidden', 'Story media is unavailable for this signed account.', 403);
      const result = await query(identity, 'SELECT public.sf_story_media_playback_claim($1) AS media', [mediaId]);
      const media = result.rows[0]?.media;
      const signed = await storage.signPlayback({ objectKey: media.objectKey });
      return { ...media, url: signed.playbackUrl, expiresIn: signed.expiresIn };
    },

    async update(identity, mediaId, input = {}) {
      ensureEnabled(environment);
      ensureStudent(identity);
      const sortOrder = Number(input.sortOrder);
      if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 10_000) {
        throw new StoryMediaError('invalid_story_media_order', 'Story media order is invalid.');
      }
      const result = await query(
        identity,
        'SELECT public.sf_update_story_media($1, $2, $3, $4) AS media',
        [mediaId, Number(input.expectedVersion), caption(input.caption), sortOrder],
      );
      return result.rows[0]?.media;
    },

    async remove(identity, mediaId) {
      ensureEnabled(environment);
      ensureStudent(identity);
      const intended = await query(identity, 'SELECT public.sf_begin_story_media_delete($1) AS intent', [mediaId]);
      const intent = intended.rows[0]?.intent;
      try {
        await storage.deleteObject({ objectKey: intent.objectKey });
        await query(identity, 'SELECT public.sf_resolve_story_media_delete($1, true)', [intent.intentId]);
        return { removed: true, id: mediaId };
      } catch (error) {
        await query(identity, 'SELECT public.sf_resolve_story_media_delete($1, false)', [intent.intentId]).catch(() => {});
        throw error;
      }
    },
  });
}
