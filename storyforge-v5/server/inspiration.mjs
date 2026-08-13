import { createHash, randomUUID } from 'node:crypto';

const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const allowedWho = new Set(['you', 'family', 'someone_else']);
const allowedDomain = new Set(['personal', 'academic', 'medical_clinical']);
const allowedEnergy = new Set(['serious', 'light', 'moving']);
const allowedWhoDetail = new Set(['parents', 'siblings', 'spouse_partner', 'relatives', 'friend', 'faculty_mentor', 'colleague_teammate', 'patient_clinical']);
const allowedPromptStates = new Set(['active', 'retired']);
const allowedReasons = new Set(['skip', 'another', 'lighter']);
const eventTypes = new Set(['shown', 'answered', 'skipped', 'promoted']);
const lifeStageTerritories = Object.freeze({
  childhood: new Set(['childhood_play', 'family_lore', 'home', 'home_remedies']),
  teen_years: new Set(['exams', 'self_belief', 'identity', 'friendship']),
  college: new Set(['learning_for_joy', 'study_life', 'teaching', 'feedback']),
  medical_school: new Set(['ordinary_clinical', 'firsts', 'milestones', 'patients', 'clinical_skills']),
  marriage_partner: new Set(['helping', 'trust', 'caregiving']),
  parenting: new Set(['family_values', 'education_values', 'being_taught']),
  work_first_jobs: new Set(['first_jobs', 'work_ethic', 'teamwork', 'career_choice']),
  hobbies_interests: new Set(['hobbies', 'food', 'objects', 'learning_for_joy', 'humor']),
  travel_culture: new Set(['travel', 'migration', 'language', 'tradition']),
});

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
    lifeStage: lifeStagesForPrompt(row),
    territory: row.territory,
    followUp: row.follow_up,
    interviewUse: row.interview_use,
    recommended: row.recommended,
  };
}

export function lifeStagesForPrompt(row) {
  const territory = String(row?.territory || '').trim();
  const text = String(row?.text || '').toLowerCase();
  const whoDetail = Array.isArray(row?.who_detail_ids) ? row.who_detail_ids : [];
  const matches = [];
  for (const [stage, territories] of Object.entries(lifeStageTerritories)) {
    if (territories.has(territory)) matches.push(stage);
  }
  if (/\b(child|childhood|growing up|about twelve|parent|grandparent)\b/u.test(text)) matches.push('childhood');
  if (/\b(teen|high school|adolescen)/u.test(text)) matches.push('teen_years');
  if (/\b(college|university|undergrad|classmate|lecture|lab|study group)\b/u.test(text)) matches.push('college');
  if (/\bmedical school|clinical|ward|clinic|patient|residency|medicine\b/u.test(text)) matches.push('medical_school');
  if (whoDetail.includes('spouse_partner') || /\b(spouse|partner|marriage|married)\b/u.test(text)) matches.push('marriage_partner');
  if (/\b(your child|your children|parenting|as a parent)\b/u.test(text)) matches.push('parenting');
  if (/\b(job|work|coworker|colleague|supervisor|shift)\b/u.test(text)) matches.push('work_first_jobs');
  if (/\b(hobby|skill|cook|dish|meal|game|sport|music)\b/u.test(text)) matches.push('hobbies_interests');
  if (/\b(travel|country|culture|language|tradition|migrat|somewhere new)\b/u.test(text)) matches.push('travel_culture');
  return [...new Set(matches.length ? matches : ['other'])];
}

function exactKeys(value, allowed, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new InspirationError('invalid_inspiration_prompt', `${label} is required.`);
  }
  const unknown = Object.keys(value).filter((key) => !allowed.has(key));
  if (unknown.length) throw new InspirationError('invalid_inspiration_prompt', `${label} contains unsupported fields.`);
}

function plainText(value, label, minimum, maximum) {
  const text = String(value ?? '').trim();
  const unsafe = /[<>\u0000-\u001f\u007f]/u.test(text)
    || /(?:javascript|data)\s*:/iu.test(text)
    || /\bon[a-z]+\s*=/iu.test(text);
  if (text.length < minimum || text.length > maximum || unsafe) {
    throw new InspirationError('invalid_inspiration_prompt', `${label} must be safe plain text between ${minimum} and ${maximum} characters.`);
  }
  return text;
}

function dimensionList(value, allowed, label, { allowEmpty = false } = {}) {
  if (!Array.isArray(value) || (!allowEmpty && !value.length)) {
    throw new InspirationError('invalid_inspiration_prompt', `${label} requires at least one governed value.`);
  }
  const normalized = [...new Set(value.map((item) => String(item || '').trim()))];
  if (normalized.some((item) => !allowed.has(item))) {
    throw new InspirationError('invalid_inspiration_prompt', `${label} contains an unsupported value.`);
  }
  return normalized;
}

function duplicateValues(values) {
  const seen = new Set();
  const duplicates = new Set();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates].sort((left, right) => String(left).localeCompare(String(right)));
}

const adminPromptFields = new Set([
  'id', 'libraryKey', 'text', 'who', 'whoDetail', 'domain', 'energy', 'territory',
  'followUp', 'interviewUse', 'state', 'recommended', 'sortOrder', 'expectedVersion',
]);

export function validateAdminPromptDraft(input = {}, { bulk = false } = {}) {
  exactKeys(input, adminPromptFields, 'Inspiration prompt');
  const id = input.id == null || input.id === '' ? null : uuid(input.id, 'Prompt identifier');
  const libraryKey = input.libraryKey == null || input.libraryKey === '' ? null : String(input.libraryKey).trim();
  if (libraryKey != null && !/^q-[0-9]{3}$/u.test(libraryKey)) {
    throw new InspirationError('invalid_inspiration_prompt', 'Prompt library key is invalid.');
  }
  if (id && !libraryKey) throw new InspirationError('invalid_inspiration_prompt', 'An existing prompt requires its stable library key.');
  if (bulk && id) throw new InspirationError('invalid_bulk_import', 'Bulk import never accepts client-supplied prompt identifiers.');
  const state = String(input.state || 'active').trim();
  if (!allowedPromptStates.has(state)) throw new InspirationError('invalid_inspiration_prompt', 'Prompt state is invalid.');
  if (typeof input.recommended !== 'boolean') throw new InspirationError('invalid_inspiration_prompt', 'Recommended must be true or false.');
  const sortOrder = Number(input.sortOrder);
  if (!Number.isInteger(sortOrder) || sortOrder < 1 || sortOrder > 100000) {
    throw new InspirationError('invalid_inspiration_prompt', 'Prompt order must be an integer between 1 and 100000.');
  }
  const expectedVersion = input.expectedVersion == null || input.expectedVersion === ''
    ? null
    : Number(input.expectedVersion);
  if (!bulk && (id || libraryKey) && (!Number.isSafeInteger(expectedVersion) || expectedVersion < 0)) {
    throw new InspirationError('invalid_inspiration_prompt', 'Existing prompts require an expected version.');
  }
  if (!id && !bulk && libraryKey) {
    throw new InspirationError('invalid_inspiration_prompt', 'Stable prompt identity must be supplied together.');
  }
  const territory = plainText(input.territory, 'Prompt territory', 1, 64).toLowerCase().replaceAll(' ', '_');
  if (!/^[a-z][a-z0-9_]{0,63}$/u.test(territory)) {
    throw new InspirationError('invalid_inspiration_prompt', 'Prompt territory is invalid.');
  }
  return Object.freeze({
    id,
    libraryKey,
    text: plainText(input.text, 'Prompt question', 10, 400),
    who: Object.freeze(dimensionList(input.who, allowedWho, 'Who dimensions')),
    whoDetail: Object.freeze(dimensionList(input.whoDetail, allowedWhoDetail, 'Relationship dimensions', { allowEmpty: true })),
    domain: Object.freeze(dimensionList(input.domain, allowedDomain, 'Domain dimensions')),
    energy: Object.freeze(dimensionList(input.energy, allowedEnergy, 'Energy dimensions')),
    territory,
    followUp: plainText(input.followUp, 'Prompt follow-up', 3, 400),
    interviewUse: plainText(input.interviewUse, 'Interview-use guidance', 3, 1000),
    state,
    recommended: input.recommended,
    sortOrder,
    expectedVersion,
  });
}

export function parseInspirationBulkCsv(csv) {
  const source = String(csv ?? '');
  if (!source.trim() || source.length > 500_000) throw new InspirationError('invalid_bulk_import', 'Bulk import CSV is empty or too large.');
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (character === '"' && source[index + 1] === '"') { field += '"'; index += 1; }
      else if (character === '"') quoted = false;
      else field += character;
    } else if (character === '"') {
      if (field) throw new InspirationError('invalid_bulk_import', 'A quoted CSV field must begin at the start of a field.');
      quoted = true;
    } else if (character === ',') {
      row.push(field); field = '';
    } else if (character === '\n') {
      row.push(field.replace(/\r$/u, '')); rows.push(row); row = []; field = '';
    } else field += character;
  }
  if (quoted) throw new InspirationError('invalid_bulk_import', 'Bulk import CSV contains an unterminated quoted field.');
  if (field || row.length) { row.push(field.replace(/\r$/u, '')); rows.push(row); }
  const nonblank = rows.filter((values) => values.some((value) => value.trim()));
  if (nonblank.length < 2 || nonblank.length > 101) throw new InspirationError('invalid_bulk_import', 'Bulk import requires a header and between 1 and 100 prompt rows.');
  const headers = nonblank.shift().map((value) => value.replace(/^\uFEFF/u, '').trim());
  const required = ['libraryKey', 'text', 'who', 'whoDetail', 'domain', 'energy', 'territory', 'followUp', 'interviewUse', 'state', 'recommended', 'sortOrder', 'expectedVersion'];
  if (headers.length !== required.length || headers.some((value, index) => value !== required[index])) {
    throw new InspirationError('invalid_bulk_import', `Bulk import headers must be exactly: ${required.join(',')}.`);
  }
  return nonblank.map((values, index) => {
    if (values.length !== headers.length) throw new InspirationError('invalid_bulk_import', `Bulk import row ${index + 2} has the wrong number of fields.`);
    const entry = Object.fromEntries(headers.map((header, column) => [header, values[column].trim()]));
    if (!['true', 'false'].includes(entry.recommended.toLowerCase())) {
      throw new InspirationError('invalid_bulk_import', `Bulk import row ${index + 2} has an invalid recommended value.`);
    }
    return validateAdminPromptDraft({
      ...entry,
      id: null,
      who: entry.who.split('|').map((item) => item.trim()).filter(Boolean),
      whoDetail: entry.whoDetail.split('|').map((item) => item.trim()).filter(Boolean),
      domain: entry.domain.split('|').map((item) => item.trim()).filter(Boolean),
      energy: entry.energy.split('|').map((item) => item.trim()).filter(Boolean),
      recommended: entry.recommended.toLowerCase() === 'true',
    }, { bulk: true });
  });
}

export function createInspirationService({ withIdentity, environment = process.env } = {}) {
  if (typeof withIdentity !== 'function') throw new TypeError('withIdentity must be supplied.');
  const withAdmin = (identity, operation) => identity?.role === 'admin'
    ? withIdentity(identity, operation)
    : withIdentity(identity, operation, { adminMode: true });
  function adminIdentity(identity) {
    return identity?.eligible === true
      && uuidPattern.test(String(identity?.sub || ''))
      && (identity?.role === 'admin' || identity?.wordpressAdmin === true);
  }
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
  async function adminCapability(identity) {
    if (disabled(environment.STORYFORGE_INSPIRATION_ADMIN_FORCE_OFF) || !adminIdentity(identity)) return false;
    try {
      return await withAdmin(identity, async (client) => {
        const result = await client.query("SELECT public.sf_story_feature_enabled('inspiration_admin', ARRAY['admin']) AS enabled");
        return result.rows[0]?.enabled === true;
      });
    } catch (error) {
      if (['42501', '42883', '42P01'].includes(error?.code)) return false;
      throw error;
    }
  }
  async function requireAdminEnabled(identity) {
    if (!await adminCapability(identity)) {
      throw new InspirationError('inspiration_admin_disabled', 'Inspiration Content Studio is unavailable.', 403);
    }
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
      'SELECT public.sf_inspiration_record_event($1,$2,$3,$4::jsonb,$5,$6,$7,$8) AS payload',
      [promptId, sessionId, type, JSON.stringify(dimensions), detail.reason || null, detail.inputSource || null, detail.lengthBucket || null, detail.storyId || null],
    );
  }
  return Object.freeze({
    capability,
    adminCapability,
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
                  pin.position AS pin_position,
                  answered.id AS answered_story_id
             FROM public.sf_inspiration_prompts prompt
             LEFT JOIN public.sf_inspiration_favorites favorite
               ON favorite.prompt_id=prompt.id AND favorite.student_id=public.sf_actor_id()
             LEFT JOIN public.sf_inspiration_pins pin
               ON pin.prompt_id=prompt.id AND pin.student_id=public.sf_actor_id()
             LEFT JOIN LATERAL (
               SELECT story.id
               FROM public.sf_stories story
               WHERE story.student_id=public.sf_actor_id()
                 AND story.archived_at IS NULL
                 AND story.origin->>'inspirationPromptId'=prompt.id::text
               ORDER BY story.created_at DESC,story.id DESC
               LIMIT 1
             ) answered ON true
            WHERE prompt.state='active' AND ($1='' OR prompt.text ILIKE '%'||$1||'%' OR prompt.territory ILIKE '%'||$1||'%')
            ORDER BY pin.position NULLS LAST,prompt.recommended DESC,prompt.sort_order,prompt.id
            LIMIT 200`, [search],
        );
        const prompts = result.rows.map((row) => ({
          ...safePrompt(row),
          favorite: row.favorite,
          pinPosition: row.pin_position,
          answeredStoryId: row.answered_story_id || null,
        }));
        return {
          layout,
          prompts,
          pinned: prompts.filter((prompt) => prompt.pinPosition != null),
        };
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
          'SELECT public.sf_inspiration_save($1,$2,$3,$4,$5) AS payload',
          [promptId, promptText, draft, kind, input.source || 'typed'],
        );
        return result.rows[0]?.payload;
      });
    },
    async removeSaved(identity, savedId) {
      await requireEnabled(identity);
      return transaction(identity, async (client) => {
        const result = await client.query('SELECT public.sf_inspiration_remove_saved($1) AS payload', [uuid(savedId, 'Saved item identifier')]);
        return result.rows[0]?.payload;
      });
    },
    async setFavorite(identity, promptId, enabled) {
      await requireEnabled(identity);
      return transaction(identity, async (client) => {
        const result = await client.query('SELECT public.sf_inspiration_set_favorite($1,$2) AS payload', [uuid(promptId, 'Prompt identifier'), enabled === true]);
        return result.rows[0]?.payload;
      });
    },
    async setPin(identity, promptId, position) {
      await requireEnabled(identity);
      if (position == null) {
        return transaction(identity, async (client) => {
          const id = uuid(promptId, 'Prompt identifier');
          const current = await client.query('SELECT prompt_id FROM public.sf_inspiration_pins WHERE student_id=public.sf_actor_id() AND prompt_id<>$1 ORDER BY position,prompt_id', [id]);
          await client.query('SELECT public.sf_inspiration_set_pins($1::uuid[]) AS payload', [current.rows.map((row) => row.prompt_id)]);
          return { pinned: false, position: null };
        });
      }
      const value = Number(position);
      if (!Number.isInteger(value) || value < 0 || value > 99) throw new InspirationError('invalid_pin_position', 'Pinned position is invalid.');
      return transaction(identity, async (client) => {
        const id = uuid(promptId, 'Prompt identifier');
        const active = await client.query("SELECT id FROM public.sf_inspiration_prompts WHERE id=$1 AND state='active'", [id]);
        if (!active.rowCount) throw Object.assign(new Error('not found'), { code: 'P0002' });
        const current = await client.query(
          `SELECT prompt_id FROM public.sf_inspiration_pins
            WHERE student_id=public.sf_actor_id()
            ORDER BY position,prompt_id`,
        );
        const ordered = current.rows.map((row) => row.prompt_id).filter((item) => item !== id);
        const nextPosition = Math.min(value, ordered.length);
        ordered.splice(nextPosition, 0, id);
        await client.query('SELECT public.sf_inspiration_set_pins($1::uuid[]) AS payload', [ordered]);
        return { pinned: true, position: nextPosition };
      });
    },
    async setPins(identity, promptIds = []) {
      await requireEnabled(identity);
      if (!Array.isArray(promptIds) || promptIds.length > 100) {
        throw new InspirationError('invalid_pin_order', 'Pinned prompt order is invalid.');
      }
      const ids = promptIds.map((promptId) => uuid(promptId, 'Prompt identifier'));
      if (new Set(ids).size !== ids.length) throw new InspirationError('invalid_pin_order', 'Pinned prompts must be unique.');
      return transaction(identity, async (client) => {
        const result = await client.query('SELECT public.sf_inspiration_set_pins($1::uuid[]) AS payload', [ids]);
        return result.rows[0]?.payload;
      });
    },
    async setLayout(identity, layout) {
      await requireEnabled(identity);
      if (!['list', 'grid'].includes(layout)) throw new InspirationError('invalid_layout', 'Inspiration layout is invalid.');
      return transaction(identity, async (client) => {
        const result = await client.query('SELECT public.sf_inspiration_set_layout($1) AS payload', [layout]);
        return result.rows[0]?.payload;
      });
    },
    async adminList(identity, { query = '', state = '', who = '', domain = '', energy = '' } = {}) {
      await requireAdminEnabled(identity);
      const search = String(query || '').trim().slice(0, 120);
      const promptState = state ? optionalChoice(state, allowedPromptStates, 'Prompt state') : '';
      const whoId = who ? optionalChoice(who, allowedWho, 'Who choice') : '';
      const domainId = domain ? optionalChoice(domain, allowedDomain, 'Domain choice') : '';
      const energyId = energy ? optionalChoice(energy, allowedEnergy, 'Energy choice') : '';
      return withAdmin(identity, async (client) => {
        const result = await client.query(
          `SELECT id,library_key,text,who_ids,who_detail_ids,domain_ids,energy_ids,territory,
                  follow_up,interview_use,state,recommended,imported,sort_order,row_version,
                  created_at,updated_at
             FROM public.sf_inspiration_prompts
            WHERE ($1='' OR text ILIKE '%'||$1||'%' OR territory ILIKE '%'||$1||'%' OR library_key=$1)
              AND ($2='' OR state=$2)
              AND ($3='' OR $3=ANY(who_ids))
              AND ($4='' OR $4=ANY(domain_ids))
              AND ($5='' OR $5=ANY(energy_ids))
            ORDER BY sort_order,id
            LIMIT 500`,
          [search, promptState, whoId, domainId, energyId],
        );
        return { prompts: result.rows.map((row) => ({
          ...safePrompt(row),
          state: row.state,
          imported: row.imported === true,
          sortOrder: row.sort_order,
          rowVersion: Number(row.row_version),
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        })) };
      });
    },
    async adminValidate(identity, input = {}) {
      await requireAdminEnabled(identity);
      return { draft: validateAdminPromptDraft(input.prompt || input) };
    },
    async adminPublish(identity, input = {}) {
      await requireAdminEnabled(identity);
      const prompt = validateAdminPromptDraft(input.prompt || input);
      const publishPayload = prompt.id ? prompt : { ...prompt, id: randomUUID() };
      try {
        return await withAdmin(identity, async (client) => {
          const result = await client.query(
            'SELECT public.sf_admin_publish_inspiration_prompt($1::jsonb) AS prompt',
            [JSON.stringify(publishPayload)],
          );
          return { prompt: result.rows[0]?.prompt || null };
        });
      } catch (error) {
        if (error?.code === '40001') throw new InspirationError('inspiration_prompt_conflict', 'This prompt changed. Reload before publishing.', 409, { cause: error });
        if (error?.code === '42501') throw new InspirationError('inspiration_admin_disabled', 'Inspiration Content Studio is unavailable.', 403, { cause: error });
        throw error;
      }
    },
    async adminHistory(identity, promptId) {
      await requireAdminEnabled(identity);
      return withAdmin(identity, async (client) => {
        const result = await client.query(
          `SELECT history.id,history.prompt_id,history.row_version,history.snapshot,
                  history.actor_id,history.created_at
             FROM public.sf_inspiration_prompt_history history
            WHERE history.prompt_id=$1
            ORDER BY history.row_version DESC,history.id DESC
            LIMIT 200`,
          [uuid(promptId, 'Prompt identifier')],
        );
        return { history: result.rows.map((row) => ({
          id: String(row.id),
          promptId: row.prompt_id,
          rowVersion: Number(row.row_version),
          snapshot: row.snapshot,
          actorId: row.actor_id,
          createdAt: row.created_at,
        })) };
      });
    },
    async adminParseBulk(identity, input = {}) {
      await requireAdminEnabled(identity);
      const prompts = parseInspirationBulkCsv(input.csv);
      const duplicateLibraryKeys = duplicateValues(prompts.map((prompt) => prompt.libraryKey).filter(Boolean));
      const duplicateSortOrders = duplicateValues(prompts.map((prompt) => prompt.sortOrder));
      return {
        prompts,
        count: prompts.length,
        persisted: false,
        validation: {
          validCount: prompts.length,
          duplicateLibraryKeys,
          duplicateSortOrders,
          publishable: duplicateLibraryKeys.length === 0 && duplicateSortOrders.length === 0,
          commitState: 'retired',
        },
      };
    },
    async adminCommitBulk(identity, input = {}) {
      await requireAdminEnabled(identity);
      if (!Array.isArray(input.prompts) || !input.prompts.length || input.prompts.length > 100) {
        throw new InspirationError('invalid_bulk_import', 'Bulk import requires between 1 and 100 prompts.');
      }
      const prompts = input.prompts.map((prompt) => {
        const normalized = validateAdminPromptDraft({ ...prompt, id: null }, { bulk: true });
        return {
          ...normalized,
          id: null,
          serverId: randomUUID(),
          state: 'retired',
          imported: true,
        };
      });
      const keys = prompts.map((prompt) => prompt.libraryKey).filter(Boolean);
      if (new Set(keys).size !== keys.length) throw new InspirationError('invalid_bulk_import', 'Bulk import contains duplicate stable keys.');
      const orders = prompts.map((prompt) => prompt.sortOrder);
      if (new Set(orders).size !== orders.length) throw new InspirationError('invalid_bulk_import', 'Bulk import contains duplicate prompt ordering.');
      try {
        return await withAdmin(identity, async (client) => {
          const result = await client.query(
            'SELECT public.sf_admin_publish_inspiration_bulk($1::jsonb) AS result',
            [JSON.stringify(prompts)],
          );
          return result.rows[0]?.result || { prompts: [] };
        });
      } catch (error) {
        if (error?.code === '40001') throw new InspirationError('inspiration_prompt_conflict', 'The prompt bank changed. Reload before importing.', 409, { cause: error });
        if (error?.code === '42501') throw new InspirationError('inspiration_admin_disabled', 'Inspiration Content Studio is unavailable.', 403, { cause: error });
        throw error;
      }
    },
    async adminReorder(identity, input = {}) {
      await requireAdminEnabled(identity);
      if (!Array.isArray(input.promptIds) || !input.promptIds.length || input.promptIds.length > 500) {
        throw new InspirationError('invalid_prompt_order', 'Prompt order must include the complete active prompt bank.');
      }
      const promptIds = input.promptIds.map((promptId) => uuid(promptId, 'Prompt identifier'));
      if (new Set(promptIds).size !== promptIds.length) {
        throw new InspirationError('invalid_prompt_order', 'Prompt order cannot contain duplicate prompts.');
      }
      if (!input.expectedVersions || typeof input.expectedVersions !== 'object' || Array.isArray(input.expectedVersions)) {
        throw new InspirationError('invalid_prompt_order', 'Prompt order requires exact row versions.');
      }
      const expectedVersions = new Map(promptIds.map((promptId) => {
        const value = Number(input.expectedVersions[promptId]);
        if (!Number.isSafeInteger(value) || value < 0) {
          throw new InspirationError('invalid_prompt_order', 'Prompt order contains an invalid row version.');
        }
        return [promptId, value];
      }));
      try {
        return await withAdmin(identity, async (client) => {
          const result = await client.query(
            `SELECT id,library_key,text,who_ids,who_detail_ids,domain_ids,energy_ids,territory,
                    follow_up,interview_use,state,recommended,sort_order,row_version
               FROM public.sf_inspiration_prompts
              WHERE state='active'
              ORDER BY sort_order,id
              FOR UPDATE`,
          );
          if (result.rows.length !== promptIds.length) {
            throw new InspirationError('incomplete_prompt_order', 'Reload the complete active prompt bank before reordering.', 409);
          }
          const byId = new Map(result.rows.map((row) => [row.id, row]));
          if (promptIds.some((promptId) => !byId.has(promptId))) {
            throw new InspirationError('incomplete_prompt_order', 'Prompt order does not match the active prompt bank.', 409);
          }
          for (const [index, promptId] of promptIds.entries()) {
            const row = byId.get(promptId);
            if (Number(row.row_version) !== expectedVersions.get(promptId)) {
              throw new InspirationError('inspiration_prompt_conflict', 'The prompt bank changed. Reload before reordering.', 409);
            }
            const payload = {
              id: row.id,
              libraryKey: row.library_key,
              text: row.text,
              who: row.who_ids,
              whoDetail: row.who_detail_ids,
              domain: row.domain_ids,
              energy: row.energy_ids,
              territory: row.territory,
              followUp: row.follow_up,
              interviewUse: row.interview_use,
              state: row.state,
              recommended: row.recommended === true,
              sortOrder: index + 1,
              expectedVersion: Number(row.row_version),
            };
            await client.query(
              'SELECT public.sf_admin_publish_inspiration_prompt($1::jsonb) AS prompt',
              [JSON.stringify(payload)],
            );
          }
          return { promptIds, count: promptIds.length, persisted: true };
        });
      } catch (error) {
        if (error instanceof InspirationError) throw error;
        if (error?.code === '40001') throw new InspirationError('inspiration_prompt_conflict', 'The prompt bank changed. Reload before reordering.', 409, { cause: error });
        if (error?.code === '42501') throw new InspirationError('inspiration_admin_disabled', 'Inspiration Content Studio is unavailable.', 403, { cause: error });
        throw error;
      }
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
