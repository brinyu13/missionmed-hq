import { createHash } from 'node:crypto';

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const POLICY_VERSION = 'ivoc-approved-stories-1';
const MAX_SUMMARY_WORDS = 60;

export class IvocProjectionError extends Error {
  constructor(code, message, status = 400, options = {}) {
    super(message, options);
    this.name = 'IvocProjectionError';
    this.code = code;
    this.status = status;
  }
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

function sha256(value) {
  return createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

function requireStudent(identity) {
  if (identity?.role !== 'student' || identity?.eligible !== true
      || !UUID.test(String(identity?.sub || ''))
      || !Number.isSafeInteger(identity?.wpUserId) || identity.wpUserId <= 0) {
    throw new IvocProjectionError('student_required', 'An eligible student account is required.', 403);
  }
}

function exactObject(value, allowed, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
      || Object.keys(value).some((key) => !allowed.has(key))) {
    throw new IvocProjectionError(code, 'Unsupported projection consent fields were supplied.');
  }
}

function words(value) {
  return String(value || '').trim().split(/\s+/u).filter(Boolean);
}

function consentInput(value) {
  exactObject(
    value,
    new Set(['storyId', 'expectedVersion', 'decision', 'summary', 'includeStudentVisibleTips']),
    'invalid_ivoc_consent',
  );
  const storyId = String(value.storyId || '').trim().toLowerCase();
  const expectedVersion = Number(value.expectedVersion);
  const decision = String(value.decision || '').trim().toLowerCase();
  const summary = decision === 'grant' ? String(value.summary || '').trim() : '';
  const summaryWords = words(summary);
  if (!UUID.test(storyId) || !Number.isSafeInteger(expectedVersion) || expectedVersion < 0
      || !['grant', 'revoke'].includes(decision)
      || (decision === 'grant' && (!summaryWords.length || summaryWords.length > MAX_SUMMARY_WORDS))
      || summary.length > 1200
      || typeof value.includeStudentVisibleTips !== 'boolean') {
    throw new IvocProjectionError('invalid_ivoc_consent', 'Projection consent is invalid.');
  }
  return {
    storyId,
    expectedVersion,
    decision,
    summary: summary || null,
    includeStudentVisibleTips: decision === 'grant' && value.includeStudentVisibleTips,
  };
}

function text(value, max) {
  const result = String(value || '').trim();
  return result && result.length <= max ? result : null;
}

function normalizedPayload(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)
      || raw.policyVersion !== POLICY_VERSION || !Array.isArray(raw.stories)
      || raw.stories.length > 12) {
    throw new IvocProjectionError('ivoc_projection_malformed', 'The approved-story projection is malformed.', 502);
  }
  const stories = raw.stories.map((story) => {
    const storyId = text(story?.storyId, 36);
    const consentId = text(story?.consentId, 36);
    const title = text(story?.title, 160);
    const summary = text(story?.summary, 1200);
    const consentedAt = text(story?.consentedAt, 40);
    const version = Number(story?.version);
    const themes = Array.isArray(story?.themes)
      ? [...new Set(story.themes.map((item) => text(item, 80)).filter(Boolean))].slice(0, 12)
      : [];
    const applicability = Array.isArray(story?.applicability)
      ? story.applicability.slice(0, 12).map((item) => ({
        questionId: text(item?.questionId, 36),
        canonicalKey: text(item?.canonicalKey, 120),
        family: text(item?.family, 80),
        question: text(item?.question, 1000),
      })).filter((item) => item.questionId && item.question)
      : [];
    const tips = Array.isArray(story?.tips)
      ? story.tips.slice(0, 3).map((item) => ({
        noteId: text(item?.noteId, 36),
        body: text(item?.body, 280),
        publishedAt: text(item?.publishedAt, 40),
      })).filter((item) => item.noteId && item.body && item.publishedAt)
      : [];
    if (!UUID.test(storyId || '') || !UUID.test(consentId || '') || !title || !summary
        || words(summary).length > MAX_SUMMARY_WORDS
        || !Number.isSafeInteger(version) || version < 0
        || !Number.isFinite(Date.parse(consentedAt || ''))) {
      throw new IvocProjectionError('ivoc_projection_malformed', 'The approved-story projection is malformed.', 502);
    }
    return Object.freeze({
      story_id: storyId,
      version: String(version),
      consent_state: 'granted',
      title,
      themes,
      summary,
      applicability,
      maturity: {
        status: 'approved',
        mentor_score: Number.isInteger(story?.maturity?.mentorScore)
          ? story.maturity.mentorScore : null,
        review_suitability: text(story?.maturity?.reviewSuitability, 40),
      },
      tips,
      consent_id: consentId,
      consented_at: new Date(consentedAt).toISOString(),
    });
  });
  stories.sort((a, b) => a.story_id.localeCompare(b.story_id));
  return stories;
}

export function createIvocProjectionService({ withIdentity } = {}) {
  if (typeof withIdentity !== 'function') throw new TypeError('withIdentity must be supplied.');

  return Object.freeze({
    async consent(identity, input) {
      requireStudent(identity);
      const value = consentInput(input);
      try {
        return await withIdentity(identity, async (client) => {
          const result = await client.query(
            'SELECT public.sf_decide_ivoc_projection_consent($1,$2,$3,$4,$5) AS payload',
            [
              value.storyId, value.expectedVersion, value.decision,
              value.summary, value.includeStudentVisibleTips,
            ],
          );
          return result.rows[0]?.payload ?? null;
        });
      } catch (error) {
        if (error?.code === '40001') {
          throw new IvocProjectionError('ivoc_projection_conflict', 'The story changed. Review it before consenting.', 409, { cause: error });
        }
        if (error?.code === 'P0002') {
          throw new IvocProjectionError('story_not_found', 'Approved story not found.', 404, { cause: error });
        }
        if (error?.code === '42501') {
          throw new IvocProjectionError('ivoc_projection_denied', 'The story is not approved for IV Prep.', 403, { cause: error });
        }
        throw error;
      }
    },

    async read(identity) {
      requireStudent(identity);
      const raw = await withIdentity(identity, async (client) => {
        const result = await client.query(
          'SELECT public.sf_ivoc_approved_story_projection() AS payload',
        );
        return result.rows[0]?.payload ?? null;
      });
      if (!raw) return null;
      const stories = normalizedPayload(raw);
      if (!stories.length) return null;
      const subjectId = `wp:${identity.wpUserId}`;
      const producedAt = stories.reduce(
        (latest, story) => story.consented_at > latest ? story.consented_at : latest,
        stories[0].consented_at,
      );
      const content = { subject_id: subjectId, policy_version: POLICY_VERSION, stories };
      const sourceVersion = `sf-ivoc-${sha256(content).slice(0, 24)}`;
      const consentRef = `storyforge:${sha256(stories.map((story) => story.consent_id)).slice(0, 24)}`;
      const payload = { stories };
      return Object.freeze({
        projection_id: `storyforge-approved-stories:${subjectId}`,
        owner_app: 'storyforge',
        projection_type: 'storyforge.approved_stories',
        schema_version: '1',
        subject_id: subjectId,
        source_version: sourceVersion,
        produced_at: producedAt,
        authorization: {
          basis: 'student_consent',
          consent_ref: consentRef,
          scope: ['approved_story_summary', 'themes', 'question_applicability', 'student_visible_tips'],
        },
        minimization: {
          fields_included: ['story_id', 'version', 'consent_state', 'title', 'themes', 'summary', 'applicability', 'maturity', 'tips'],
          fields_excluded_reason: {
            full_story_prose: 'not required by IV Prep',
            recordings: 'private owner media',
            transcripts: 'private owner media',
            internal_notes: 'not student visible',
          },
        },
        payload,
        source_receipt: {
          owner_ref: `storyforge:${subjectId}@${sourceVersion}`,
          hash: sha256({ subject_id: subjectId, source_version: sourceVersion, payload }),
        },
        revocation: { revocable: true },
      });
    },
  });
}

export const ivocProjectionPolicy = Object.freeze({
  version: POLICY_VERSION,
  maxSummaryWords: MAX_SUMMARY_WORDS,
});
