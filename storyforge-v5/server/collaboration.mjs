const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

export class CollaborationError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = 'CollaborationError';
    this.code = code;
    this.status = status;
  }
}

function explicitlyDisabled(value) {
  return !['0', 'false', 'no', 'off'].includes(String(value ?? '').trim().toLowerCase());
}

function requireUuid(value, label = 'Identifier') {
  const normalized = String(value || '').trim();
  if (!uuidPattern.test(normalized)) throw new CollaborationError('invalid_identifier', `${label} is not valid.`);
  return normalized;
}

function expectedVersion(value) {
  const normalized = Number(value);
  if (!Number.isSafeInteger(normalized) || normalized < 0) {
    throw new CollaborationError('invalid_story_version', 'A valid story version is required.');
  }
  return normalized;
}

function translate(error) {
  if (error instanceof CollaborationError) throw error;
  if (error?.code === '40001') throw new CollaborationError('story_version_conflict', 'This story changed. Refresh and try again.', 409);
  if (error?.code === '42501') throw new CollaborationError('collaboration_denied', 'This collaboration action is not available.', 403);
  if (error?.code === 'P0002') throw new CollaborationError('not_found', 'The requested StoryForge item was not found.', 404);
  if (['22023', '22P02', '23505'].includes(error?.code)) throw new CollaborationError('invalid_collaboration_request', 'The collaboration request is not valid.', 400);
  throw error;
}

export function createCollaborationService({
  withIdentity,
  signPlayback,
  environment = process.env,
} = {}) {
  if (typeof withIdentity !== 'function') throw new TypeError('withIdentity must be supplied.');

  async function rpc(identity, sql, values = []) {
    try {
      return await withIdentity(identity, async (client) => {
        const result = await client.query(sql, values);
        return result.rows[0]?.payload ?? null;
      });
    } catch (error) {
      return translate(error);
    }
  }

  async function capabilities(identity) {
    if (identity?.eligible !== true) return { storyArchive: false, peerShare: false, storyPromotions: false, perUseScoring: false };
    if (
      explicitlyDisabled(environment.STORYFORGE_STORY_ARCHIVE_FORCE_OFF)
      && explicitlyDisabled(environment.STORYFORGE_PEER_SHARE_FORCE_OFF)
      && explicitlyDisabled(environment.STORYFORGE_STORY_PROMOTIONS_FORCE_OFF)
      && explicitlyDisabled(environment.STORYFORGE_PER_USE_SCORING_FORCE_OFF)
    ) return { storyArchive: false, peerShare: false, storyPromotions: false, perUseScoring: false };
    try {
      return await withIdentity(identity, async (client) => {
        const result = await client.query(
          `SELECT
             public.sf_story_feature_enabled('story_archive', ARRAY['student','admin']) AS story_archive,
             public.sf_story_feature_enabled('peer_share', ARRAY['student']) AS peer_share,
             public.sf_story_feature_enabled('story_promotions', ARRAY['admin']) AS story_promotions,
             public.sf_story_feature_enabled('per_use_scoring', ARRAY['admin']) AS per_use_scoring`,
        );
        const row = result.rows[0] || {};
        return {
          storyArchive: !explicitlyDisabled(environment.STORYFORGE_STORY_ARCHIVE_FORCE_OFF) && row.story_archive === true,
          peerShare: !explicitlyDisabled(environment.STORYFORGE_PEER_SHARE_FORCE_OFF) && row.peer_share === true,
          storyPromotions: !explicitlyDisabled(environment.STORYFORGE_STORY_PROMOTIONS_FORCE_OFF) && row.story_promotions === true,
          perUseScoring: !explicitlyDisabled(environment.STORYFORGE_PER_USE_SCORING_FORCE_OFF) && row.per_use_scoring === true,
        };
      });
    } catch (error) {
      if (['42501', '42883', '42P01', '42703'].includes(error?.code)) {
        return { storyArchive: false, peerShare: false, storyPromotions: false, perUseScoring: false };
      }
      throw error;
    }
  }

  return Object.freeze({
    capabilities,
    setCollection: (identity, storyId, collection, version) => {
      if (explicitlyDisabled(environment.STORYFORGE_STORY_ARCHIVE_FORCE_OFF)) {
        throw new CollaborationError('story_archive_force_off', 'Story collections are disabled.', 403);
      }
      return rpc(
        identity,
        `SELECT public.sf_set_story_collection($1,$2,$3,'library') AS payload`,
        [requireUuid(storyId, 'Story identifier'), expectedVersion(version), collection],
      );
    },
    candidates: (identity) => {
      if (explicitlyDisabled(environment.STORYFORGE_PEER_SHARE_FORCE_OFF)) {
        throw new CollaborationError('peer_share_force_off', 'Classmate sharing is disabled.', 403);
      }
      return rpc(identity, 'SELECT public.sf_peer_candidates() AS payload');
    },
    share: (identity, storyId, input = {}) => {
      if (explicitlyDisabled(environment.STORYFORGE_PEER_SHARE_FORCE_OFF)) {
        throw new CollaborationError('peer_share_force_off', 'Classmate sharing is disabled.', 403);
      }
      if (!Array.isArray(input.recipientIds) || input.recipientIds.length < 1 || input.recipientIds.length > 10) {
        throw new CollaborationError('invalid_peer_recipients', 'Choose between one and ten classmates.');
      }
      const recipients = input.recipientIds.map((id) => requireUuid(id, 'Classmate identifier'));
      if (new Set(recipients).size !== recipients.length) {
        throw new CollaborationError('invalid_peer_recipients', 'Classmates may only be selected once.');
      }
      return rpc(
        identity,
        'SELECT public.sf_peer_share_story($1,$2,$3::uuid[],$4) AS payload',
        [requireUuid(storyId, 'Story identifier'), expectedVersion(input.expectedVersion), recipients, input.confirmPrivate === true],
      );
    },
    revoke: (identity, grantId) => rpc(
      identity,
      'SELECT public.sf_peer_revoke_grant($1) AS payload',
      [requireUuid(grantId, 'Peer grant identifier')],
    ),
    inbox: (identity) => rpc(identity, 'SELECT public.sf_peer_inbox() AS payload'),
    outbox: (identity) => rpc(identity, 'SELECT public.sf_peer_outbox() AS payload'),
    story: (identity, grantId) => rpc(
      identity,
      'SELECT public.sf_peer_story_view($1) AS payload',
      [requireUuid(grantId, 'Peer grant identifier')],
    ),
    feedback: (identity, grantId, input = {}) => {
      const body = String(input.body || '').trim();
      if (!body || body.length > 10000) throw new CollaborationError('invalid_peer_feedback', 'Feedback must be between 1 and 10,000 characters.');
      return rpc(identity, 'SELECT public.sf_peer_add_feedback($1,$2) AS payload', [requireUuid(grantId, 'Peer grant identifier'), body]);
    },
    playback: async (identity, grantId) => {
      if (typeof signPlayback !== 'function') throw new CollaborationError('peer_audio_unavailable', 'Audio playback is unavailable.', 503);
      const claim = await rpc(identity, 'SELECT public.sf_peer_audio_claim($1) AS payload', [requireUuid(grantId, 'Peer grant identifier')]);
      const signed = await signPlayback({ objectKey: claim.objectKey });
      return {
        audioId: claim.audioId,
        playbackUrl: signed.playbackUrl,
        expiresIn: signed.expiresIn,
        contentType: claim.contentType,
        durationMs: claim.durationMs,
        byteSize: claim.byteSize,
      };
    },
  });
}
