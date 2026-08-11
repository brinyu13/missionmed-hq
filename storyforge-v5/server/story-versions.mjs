const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const versionKeys = new Set(['thirty_second', 'nnq_setup']);
const modes = new Set(['save', 'append', 'retell']);
const sources = new Set(['typed', 'voice']);

export class StoryVersionsError extends Error {
  constructor(code, message, status = 400, options = {}) {
    super(message, options);
    this.name = 'StoryVersionsError';
    this.code = code;
    this.status = status;
  }
}

function requireFunction(value, name) {
  if (typeof value !== 'function') throw new TypeError(`${name} must be supplied.`);
  return value;
}

function forceOff(environment) {
  return !['0', 'false', 'no', 'off'].includes(String(environment.STORYFORGE_STORY_VERSIONS_FORCE_OFF ?? '1').trim().toLowerCase());
}

function identifier(value, label) {
  const result = String(value || '').trim();
  if (!uuidPattern.test(result)) throw new StoryVersionsError('invalid_identifier', `${label} is invalid.`);
  return result;
}

function versionKey(value) {
  const result = String(value || '').trim();
  if (!versionKeys.has(result)) throw new StoryVersionsError('invalid_version_key', 'This telling is not supported.');
  return result;
}

function expectedVersion(value) {
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < 0) throw new StoryVersionsError('version_required', 'Reload this telling before saving.');
  return result;
}

function mutation(input = {}) {
  const mode = String(input.mode || 'save');
  const source = String(input.source || 'typed');
  const body = String(input.body ?? '');
  const recordingId = input.recordingId == null ? null : identifier(input.recordingId, 'Recording identifier');
  const audioAssetId = input.audioAssetId == null ? null : identifier(input.audioAssetId, 'Audio identifier');
  if (
    !modes.has(mode)
    || !sources.has(source)
    || body.length > 20_000
    || (mode !== 'retell' && !body.trim())
    || (source === 'typed' && (recordingId || audioAssetId))
    || (source === 'voice' && (!recordingId || !audioAssetId))
  ) {
    throw new StoryVersionsError('invalid_story_version', 'This telling could not be saved.');
  }
  return {
    body,
    mode,
    source,
    expectedVersion: expectedVersion(input.expectedVersion),
    recordingId,
    audioAssetId,
  };
}

function translate(error) {
  if (error?.code === '40001') throw new StoryVersionsError('story_version_conflict', 'This telling changed. Reload before saving.', 409, { cause: error });
  if (error?.code === 'P0002') throw new StoryVersionsError('story_not_found', 'Story not found.', 404, { cause: error });
  if (error?.code === '42501' || error?.code === '42883' || error?.code === '42P01') {
    throw new StoryVersionsError('story_versions_disabled', 'Story versions are unavailable.', 403, { cause: error });
  }
  throw error;
}

export function createStoryVersionsService({ withIdentity, environment = process.env } = {}) {
  requireFunction(withIdentity, 'withIdentity');

  async function capability(identity) {
    if (forceOff(environment) || identity?.eligible !== true) return false;
    try {
      return await withIdentity(identity, async (client) => {
        const result = await client.query('SELECT public.sf_story_versions_enabled() AS enabled');
        return result.rows[0]?.enabled === true;
      });
    } catch (error) {
      if (['42501', '42883', '42P01'].includes(error?.code)) return false;
      throw error;
    }
  }

  async function requireEnabled(identity) {
    if (!await capability(identity)) throw new StoryVersionsError('story_versions_disabled', 'Story versions are unavailable.', 403);
  }

  async function rpc(identity, sql, values) {
    try {
      return await withIdentity(identity, async (client) => {
        const result = await client.query(sql, values);
        return result.rows[0]?.payload ?? null;
      });
    } catch (error) {
      return translate(error);
    }
  }

  return Object.freeze({
    capability,
    async list(identity, storyId) {
      await requireEnabled(identity);
      return rpc(identity, 'SELECT public.sf_list_story_versions($1) AS payload', [identifier(storyId, 'Story identifier')]);
    },
    async save(identity, storyId, key, input) {
      await requireEnabled(identity);
      if (identity?.role !== 'student') throw new StoryVersionsError('student_required', 'Only the story owner may edit a telling.', 403);
      const value = mutation(input);
      return rpc(identity, 'SELECT public.sf_save_story_version($1,$2,$3,$4,$5,$6,$7,$8) AS payload', [
        identifier(storyId, 'Story identifier'), versionKey(key), value.body, value.mode,
        value.source, value.expectedVersion, value.recordingId, value.audioAssetId,
      ]);
    },
    async restore(identity, storyId, input = {}) {
      await requireEnabled(identity);
      if (identity?.role !== 'student') throw new StoryVersionsError('student_required', 'Only the story owner may restore a telling.', 403);
      return rpc(identity, 'SELECT public.sf_restore_story_version($1,$2,$3,$4) AS payload', [
        identifier(storyId, 'Story identifier'), versionKey(input.versionKey),
        identifier(input.revisionId, 'Earlier telling identifier'), expectedVersion(input.expectedVersion),
      ]);
    },
  });
}
