import { createHash } from 'node:crypto';

const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const allowedWho = new Set(['you', 'family', 'someone_else']);
const allowedDomain = new Set(['personal', 'academic', 'medical_clinical']);
const allowedEnergy = new Set(['serious', 'light', 'moving']);
const allowedReasons = new Set(['skip', 'another', 'lighter']);
const eventTypes = new Set(['shown', 'answered', 'skipped', 'promoted']);

export class InspirationError extends Error {
  constructor(code, message, status = 400, options = {}) {
    super(message, options);
    this.name = 'InspirationError';
    this.code = code;
    this.status = status;
  }
}

function disabled(value) {
  return !['0', 'false', 'no', 'off'].includes(String(value ?? '1').trim().toLowerCase());
}

function uuid(value, label) {
  const result = String(value || '').trim();
  if (!uuidPattern.test(result)) throw new InspirationError('invalid_identifier', `${label} is invalid.`);
  return result;
}

function optionalChoice(value, allowed, label) {
  const result = String(value || '').trim();
  if (result && !allowed.has(result)) throw new InspirationError('invalid_inspiration_path', `${label} is invalid.`);
  return result;
}

function pathInput(input = {}) {
  const excludeIds = [...new Set((Array.isArray(input.excludeIds) ? input.excludeIds : []).map((value) => uuid(value, 'Prompt identifier')))];
  if (excludeIds.length > 100) throw new InspirationError('invalid_inspiration_path', 'Too many prompts were excluded.');
  return {
    who: optionalChoice(input.who, allowedWho, 'Who choice'),
    whoDetail: String(input.whoDetail || '').trim().slice(0, 64),
    domain: optionalChoice(input.domain, allowedDomain, 'Domain choice'),
    energy: optionalChoice(input.energy, allowedEnergy, 'Energy choice'),
    excludeIds,
    sessionId: uuid(input.sessionId, 'Session identifier'),
  };
}

function score(prompt, input) {
  let total = 0;
  if (input.who && prompt.who_ids?.includes(input.who)) total += 4;
  if (input.whoDetail && prompt.who_detail_ids?.includes(input.whoDetail)) total += 3;
  if (input.domain && prompt.domain_ids?.includes(input.domain)) total += 2;
  if (input.energy && prompt.energy_ids?.includes(input.energy)) total += 2;
  return total;
}

export function deterministicPrompt(prompts, input, studentId, bankVersion) {
  const candidates = prompts
    .filter((prompt) => prompt.state === 'active' && !input.excludeIds.includes(prompt.id))
    .map((prompt) => ({ prompt, score: score(prompt, input) }))
    .sort((left, right) => right.score - left.score || left.prompt.library_key.localeCompare(right.prompt.library_key));
  if (!candidates.length) return null;
  const band = candidates.filter((candidate) => candidate.score >= candidates[0].score - 1);
  const seed = JSON.stringify([studentId, [...input.excludeIds].sort(), String(bankVersion)]);
  const index = Number.parseInt(createHash('sha256').update(seed).digest('hex').slice(0, 12), 16) % band.length;
  return band[index].prompt;
}

function safePrompt(row) {
  if (!row) return null;
  return {
    id: row.id,
    key: row.library_key,
    text: row.text,
    who: row.who_ids,
    whoDetail: row.who_detail_ids,
    domain: row.domain_ids,
    energy: row.energy_ids,
    territory: row.territory,
    followUp: row.follow_up,
    interviewUse: row.interview_use,
    recommended: row.recommended,
  };
}

export function createInspirationService({ withIdentity, environment = process.env } = {}) {
  if (typeof withIdentity !== 'function') throw new TypeError('withIdentity must be supplied.');
  async function capability(identity) {
    if (disabled(environment.STORYFORGE_INSPIRATION_FORCE_OFF) || identity?.eligible !== true || identity?.role !== 'student') return false;
    try {
      return await withIdentity(identity, async (client) => {
        const result = await client.query("SELECT public.sf_story_feature_enabled('inspiration', ARRAY['student']) AS enabled");
        return result.rows[0]?.enabled === true;
      });
    } catch (error) {
      if (['42501', '42883', '42P01'].includes(error?.code)) return false;
      throw error;
    }
  }
  async function requireEnabled(identity) {
    if (!await capability(identity)) throw new InspirationError('inspiration_disabled', 'Inspiration is unavailable.', 403);
  }
  async function transaction(identity, operation) {
    try { return await withIdentity(identity, operation); }
    catch (error) {
      if (error?.code === '42501') throw new InspirationError('inspiration_disabled', 'Inspiration is unavailable.', 403, { cause: error });
      if (error?.code === 'P0002') throw new InspirationError('inspiration_not_found', 'Inspiration item not found.', 404, { cause: error });
      throw error;
    }
  }
  async function recordEvent(client, identity, promptId, sessionId, type, detail = {}) {
    if (!eventTypes.has(type)) throw new InspirationError('invalid_inspiration_event', 'Inspiration event is invalid.');
    const dimensions = detail.dimensions || {};
    const forbidden = ['answer', 'draft', 'text', 'transcript', 'body'].some((key) => Object.hasOwn(dimensions, key));
    if (forbidden) throw new InspirationError('private_event_content', 'Private content cannot enter Inspiration analytics.');
    await client.query(
      `INSERT INTO public.sf_inspiration_events
        (student_id,prompt_id,session_id,event_type,dimensions,reason,input_source,length_bucket,story_id)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9)`,
      [identity.sub, promptId, sessionId, type, JSON.stringify(dimensions), detail.reason || null, detail.inputSource || null, detail.lengthBucket || null, detail.storyId || null],
    );
  }
  return Object.freeze({
    capability,
    async next(identity, rawInput) {
      await requireEnabled(identity);
      const input = pathInput(rawInput);
      return transaction(identity, async (client) => {
        const result = await client.query(
          `SELECT id,library_key,text,who_ids,who_detail_ids,domain_ids,energy_ids,territory,
                  follow_up,interview_use,state,recommended,row_version
             FROM public.sf_inspiration_prompts
            WHERE state='active'
            ORDER BY sort_order,id`,
        );
        const bankVersion = result.rows.reduce((maximum, row) => Math.max(maximum, Number(row.row_version)), 0);
        const selected = deterministicPrompt(result.rows, input, identity.sub, bankVersion);
        if (selected) await recordEvent(client, identity, selected.id, input.sessionId, 'shown', {
          dimensions: { who: input.who, whoDetail: input.whoDetail, domain: input.domain, energy: input.energy },
        });
        return { prompt: safePrompt(selected), bankVersion };
      });
    },
    async browse(identity, { query = '', layout = 'list' } = {}) {
      await requireEnabled(identity);
      if (!['list', 'grid'].includes(layout)) throw new InspirationError('invalid_layout', 'Inspiration layout is invalid.');
      const search = String(query || '').trim().slice(0, 120);
      return transaction(identity, async (client) => {
        const result = await client.query(
          `SELECT prompt.id,prompt.library_key,prompt.text,prompt.who_ids,prompt.who_detail_ids,
                  prompt.domain_ids,prompt.energy_ids,prompt.territory,prompt.follow_up,
                  prompt.interview_use,prompt.state,prompt.recommended,
                  (favorite.prompt_id IS NOT NULL) AS favorite,
                  pin.position AS pin_position
             FROM public.sf_inspiration_prompts prompt
             LEFT JOIN public.sf_inspiration_favorites favorite
               ON favorite.prompt_id=prompt.id AND favorite.student_id=public.sf_actor_id()
             LEFT JOIN public.sf_inspiration_pins pin
               ON pin.prompt_id=prompt.id AND pin.student_id=public.sf_actor_id()
            WHERE prompt.state='active' AND ($1='' OR prompt.text ILIKE '%'||$1||'%' OR prompt.territory ILIKE '%'||$1||'%')
            ORDER BY pin.position NULLS LAST,prompt.recommended DESC,prompt.sort_order,prompt.id
            LIMIT 200`, [search],
        );
        return { layout, prompts: result.rows.map((row) => ({ ...safePrompt(row), favorite: row.favorite, pinPosition: row.pin_position })) };
      });
    },
    async save(identity, input = {}) {
      await requireEnabled(identity);
      const promptId = input.promptId == null ? null : uuid(input.promptId, 'Prompt identifier');
      const promptText = String(input.promptText || '').trim();
      const draft = String(input.draft || '');
      const kind = input.kind === 'sparked' ? 'sparked' : 'saved';
      if (promptText.length < 3 || promptText.length > 2000 || draft.length > 20000) throw new InspirationError('invalid_saved_inspiration', 'This Inspiration item cannot be saved.');
      return transaction(identity, async (client) => {
        const result = await client.query(
          `INSERT INTO public.sf_inspiration_saved(student_id,prompt_id,prompt_text_snapshot,draft,kind,source)
           VALUES(public.sf_actor_id(),$1,$2,$3,$4,$5)
           RETURNING id,prompt_id,prompt_text_snapshot,draft,kind,source,created_at,updated_at`,
          [promptId, promptText, draft, kind, input.source || 'typed'],
        );
        return result.rows[0];
      });
    },
    async removeSaved(identity, savedId) {
      await requireEnabled(identity);
      return transaction(identity, async (client) => {
        const result = await client.query('DELETE FROM public.sf_inspiration_saved WHERE id=$1 AND student_id=public.sf_actor_id() RETURNING id', [uuid(savedId, 'Saved item identifier')]);
        if (!result.rowCount) throw Object.assign(new Error('not found'), { code: 'P0002' });
        return { removed: true };
      });
    },
    async setFavorite(identity, promptId, enabled) {
      await requireEnabled(identity);
      return transaction(identity, async (client) => {
        if (enabled) await client.query('INSERT INTO public.sf_inspiration_favorites(student_id,prompt_id) VALUES(public.sf_actor_id(),$1) ON CONFLICT DO NOTHING', [uuid(promptId, 'Prompt identifier')]);
        else await client.query('DELETE FROM public.sf_inspiration_favorites WHERE student_id=public.sf_actor_id() AND prompt_id=$1', [uuid(promptId, 'Prompt identifier')]);
        return { favorite: enabled === true };
      });
    },
    async setPin(identity, promptId, position) {
      await requireEnabled(identity);
      const value = Number(position);
      if (!Number.isInteger(value) || value < 0 || value > 99) throw new InspirationError('invalid_pin_position', 'Pinned position is invalid.');
      return transaction(identity, async (client) => {
        await client.query('DELETE FROM public.sf_inspiration_pins WHERE student_id=public.sf_actor_id() AND (prompt_id=$1 OR position=$2)', [uuid(promptId, 'Prompt identifier'), value]);
        await client.query('INSERT INTO public.sf_inspiration_pins(student_id,prompt_id,position) VALUES(public.sf_actor_id(),$1,$2)', [promptId, value]);
        return { pinned: true, position: value };
      });
    },
    async event(identity, promptId, sessionId, type, detail) {
      await requireEnabled(identity);
      if (detail?.reason && !allowedReasons.has(detail.reason)) throw new InspirationError('invalid_inspiration_event', 'Skip reason is invalid.');
      return transaction(identity, async (client) => {
        await recordEvent(client, identity, uuid(promptId, 'Prompt identifier'), uuid(sessionId, 'Session identifier'), type, detail);
        return { recorded: true };
      });
    },
  });
}
