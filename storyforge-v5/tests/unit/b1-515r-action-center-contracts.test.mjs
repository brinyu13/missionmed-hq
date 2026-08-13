import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../../infra/postgres/migrations/20260813130000_b1_515r_action_center_contribution_review.sql', import.meta.url), 'utf8');

test('A38 migration binds owner-only optimistic review, redacted audit, and private scored promotion', () => {
  for (const marker of [
    'sf_request_review_contribution', "contribution.state IN ('new', 'favorite')",
    "ERRCODE = 'P0002'", "ERRCODE = '40001'", "ERRCODE = '22023'",
    "'notePresent'", "'noteLength'", "'rowVersion'", "'studentScore', v_contribution.student_score",
    "visibility = 'private'", 'row_version = row_version + 1',
  ]) assert.ok(source.includes(marker), marker);
  assert.match(source, /REVOKE ALL ON FUNCTION public\.sf_request_review_contribution.*FROM PUBLIC, anon/);
});

test('A19 migration uses the central observable predicate for Home and scaled queue', () => {
  assert.equal((source.match(/sf_admin_subject_story_observable\(/g) || []).length, 2);
  for (const marker of [
    "'actionCenter'", "'needsReview'", "'needsNudge'", "'newSinceLastVisit'",
    "'boundaryLimited'", "event.action = 'admin.home_viewed'", "'result_count'",
  ]) assert.ok(source.includes(marker), marker);
  assert.doesNotMatch(source, /WHERE\s+(story|s)\.status\s*<>\s*'private'/i);
});
