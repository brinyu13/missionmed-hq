// Normalizer: `storyforge.approved_stories` → story_theme facts.
//
//   payload = { stories: [{ story_id, version, title, themes?, summary? (≤60 words), maturity?, consent_state }] }
//
// Consent law: only `consent_state === 'granted'` stories become facts; everything
// else is counted in ctx.dropped_items and never enters the pack (opt-in before reveal).

import { buildFact } from '../fact-builder.mjs';
import { wordCount } from '../../contracts/application-fact.mjs';
import { NormalizerError } from './filevault-document.mjs';

export const PROJECTION_TYPE = 'storyforge.approved_stories';
const NON_EMPTY = (value) => typeof value === 'string' && value.trim().length > 0;

export function normalize(ctx) {
  const stories = ctx.projection.payload?.stories;
  if (!Array.isArray(stories)) throw new NormalizerError('invalid_storyforge_payload', 'payload.stories must be an array');
  if (ctx.receipt.authorization_basis !== 'student_consent') {
    ctx.dropped_items.push({ projection_id: ctx.receipt.projection_id, reason: 'storyforge_requires_student_consent_basis', count: stories.length });
    return [];
  }
  const facts = [];
  for (const story of stories) {
    if (!NON_EMPTY(story.story_id) || !NON_EMPTY(story.version) || !NON_EMPTY(story.title)) {
      throw new NormalizerError('invalid_story', 'each story needs story_id, version and title');
    }
    if (story.consent_state !== 'granted') {
      ctx.dropped_items.push({ projection_id: ctx.receipt.projection_id, item: story.story_id, reason: 'story_consent_not_granted' });
      continue;
    }
    if (NON_EMPTY(story.summary) && wordCount(story.summary) > 60) throw new NormalizerError('invalid_story', `story ${story.story_id} summary exceeds 60 words`);
    facts.push(buildFact(ctx, {
      fact_type: 'story_theme',
      normalized_key: `story:${story.story_id}@${story.version}`,
      attributes: {
        story_id: story.story_id,
        story_version: story.version,
        title: story.title,
        themes: Array.isArray(story.themes) ? story.themes : undefined,
        summary: story.summary,
        maturity: story.maturity,
        consent_state: 'granted',
      },
    }));
  }
  return facts;
}
