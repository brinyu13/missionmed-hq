import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  listRosterVerificationSources,
  summarizeRosterVerificationForReview,
  verifyRosterCandidate,
  ROSTER_VERIFICATION_STATUS,
} from '../lib/mmc-roster-verification-lane.mjs';

const rootDir = process.cwd();
const routeSource = readFileSync(path.join(rootDir, 'missionmed-hq/routes/mmc-coaching-pipeline.mjs'), 'utf8');
const appSource = readFileSync(path.join(rootDir, 'missionmed-hq/public/mmc-private/src/app.js'), 'utf8');
const moduleSource = readFileSync(path.join(rootDir, 'missionmed-hq/lib/mmc-roster-verification-lane.mjs'), 'utf8');

const sources = listRosterVerificationSources();
assert.ok(sources.length >= 8, 'Roster source inventory must include all approved source lanes.');
assert.ok(sources.some((source) => source.id === 'mmc_identity_bridge' && source.status === 'VERIFIED'), 'Existing MMC identity bridge must be a verified source lane.');
assert.ok(sources.some((source) => source.id === 'wordpress_user'), 'WordPress read-only evidence lane must be inventoried.');
assert.ok(sources.some((source) => source.id === 'learndash_enrollment'), 'LearnDash read-only evidence lane must be inventoried.');
assert.ok(sources.some((source) => source.id === 'scheduler_student'), 'Scheduler read-only lane must be inventoried.');
assert.ok(sources.some((source) => source.id === 'calendar_title_date' && source.autoPromotion === 'supporting_only'), 'Calendar evidence must be supporting only.');
assert.ok(sources.some((source) => source.id === 'webex_title_date' && source.autoPromotion === 'supporting_only'), 'Webex evidence must be supporting only.');

const verified = verifyRosterCandidate({
  studentId: 'ignacio-anzola',
  studentName: 'Ignacio Anzola',
  sourceEvidence: [
    {
      sourceSystem: 'wordpress_user',
      anchorType: 'wp_user_id',
      anchorValue: 'wp:ignacio:verified',
      studentId: 'ignacio-anzola',
      studentName: 'Ignacio Anzola',
      confidence: 0.94,
    },
    {
      sourceSystem: 'learndash_enrollment',
      anchorType: 'learndash_user_id',
      anchorValue: 'ld:ignacio:verified',
      studentId: 'ignacio-anzola',
      studentName: 'Ignacio Anzola',
      confidence: 0.91,
    },
  ],
});
assert.equal(verified.status, ROSTER_VERIFICATION_STATUS.VERIFIED, 'Two independent strong anchors should verify a roster identity.');
assert.equal(verified.autoPromote, true, 'Two independent strong anchors should be auto-promotable.');
assert.equal(verified.independentStrongAnchors, 2, 'Independent strong anchor count must be tracked.');
assert.ok(verified.confidence >= 0.86, 'Verified confidence must meet threshold.');

const weakOnly = verifyRosterCandidate({
  studentId: 'ignacio-anzola',
  studentName: 'Ignacio Anzola',
  sourceEvidence: [
    {
      sourceSystem: 'calendar_title_date',
      anchorType: 'title_date',
      anchorValue: 'Ignacio Mentorship|2026-06-05',
      studentId: 'ignacio-anzola',
      studentName: 'Ignacio Anzola',
      confidence: 0.99,
    },
    {
      sourceSystem: 'drop_zone_filename',
      anchorType: 'display_name',
      anchorValue: 'Ignacio Anzola',
      studentId: 'ignacio-anzola',
      studentName: 'Ignacio Anzola',
      confidence: 0.99,
    },
  ],
});
assert.notEqual(weakOnly.status, ROSTER_VERIFICATION_STATUS.VERIFIED, 'Name/title evidence must not verify identity.');
assert.equal(weakOnly.autoPromote, false, 'Weak evidence cannot auto-promote.');
assert.ok(weakOnly.reasons.includes('strong_identity_anchor_missing'), 'Weak evidence result must explain missing strong anchor.');

const emailOnly = verifyRosterCandidate({
  studentId: 'ignacio-anzola',
  sourceEvidence: [
    {
      sourceSystem: 'wordpress_user',
      anchorType: 'email_hash',
      anchorValue: 'hash-only',
      studentId: 'ignacio-anzola',
      confidence: 1,
    },
    {
      sourceSystem: 'crm_person',
      anchorType: 'email',
      anchorValue: 'same-email@example.test',
      studentId: 'ignacio-anzola',
      confidence: 1,
    },
  ],
});
assert.notEqual(emailOnly.status, ROSTER_VERIFICATION_STATUS.VERIFIED, 'Email-only evidence must not verify identity.');

const conflict = verifyRosterCandidate({
  studentId: 'ignacio-anzola',
  sourceEvidence: [
    {
      sourceSystem: 'wordpress_user',
      anchorType: 'wp_user_id',
      anchorValue: 'wp:shared',
      studentId: 'ignacio-anzola',
      confidence: 0.95,
    },
    {
      sourceSystem: 'learndash_enrollment',
      anchorType: 'learndash_user_id',
      anchorValue: 'ld:other',
      studentId: 'someone-else',
      confidence: 0.95,
    },
  ],
});
assert.equal(conflict.status, ROSTER_VERIFICATION_STATUS.CONFLICT, 'Conflicting student IDs must be classified as conflict.');

const fixtureBlocked = verifyRosterCandidate({
  studentId: 'amara',
  studentName: 'Amara Okafor',
  sourceEvidence: [
    {
      sourceSystem: 'wordpress_user',
      anchorType: 'wp_user_id',
      anchorValue: 'wp:amara',
      studentId: 'amara',
      confidence: 0.96,
    },
    {
      sourceSystem: 'learndash_enrollment',
      anchorType: 'learndash_user_id',
      anchorValue: 'ld:amara',
      studentId: 'amara',
      confidence: 0.96,
    },
  ],
});
assert.notEqual(fixtureBlocked.status, ROSTER_VERIFICATION_STATUS.VERIFIED, 'Fixture students must never be promoted by roster verification.');
assert.ok(fixtureBlocked.reasons.includes('fixture_student_blocked'), 'Fixture block reason must be explicit.');

const adminApproved = verifyRosterCandidate({
  studentId: 'ignacio-anzola',
  studentName: 'Ignacio Anzola',
  sourceEvidence: [
    {
      sourceSystem: 'wordpress_user',
      anchorType: 'wp_user_id',
      anchorValue: 'wp:ignacio:admin-reviewed',
      studentId: 'ignacio-anzola',
      confidence: 0.9,
    },
  ],
}, { adminApproval: true });
assert.equal(adminApproved.status, ROSTER_VERIFICATION_STATUS.VERIFIED, 'Explicit admin approval can verify with at least one strong anchor.');
assert.equal(adminApproved.adminApproved, true, 'Admin approval must be recorded.');
assert.equal(summarizeRosterVerificationForReview(adminApproved).strongAnchors, 1, 'Review summary must expose strong anchor count.');

assert.match(routeSource, /roster-verification\/sources/u, 'Pipeline route must expose roster source inventory.');
assert.match(routeSource, /roster-verification\/resolve/u, 'Pipeline route must expose roster verification resolve.');
assert.match(routeSource, /roster-verification\/approve/u, 'Pipeline route must expose roster bridge approval.');
assert.match(routeSource, /ensureVerifiedRosterBridge/u, 'Pipeline route must persist verified bridge rows only after verification.');
assert.match(routeSource, /primary_anchor_type=eq\.missionmed_roster_student/u, 'Attachment path must prefer verified missionmed_roster_student references.');
assert.doesNotMatch(moduleSource, /fetch\(/u, 'Roster verification lane must not hide production fetches.');
assert.doesNotMatch(moduleSource, /service_role/iu, 'Roster verification lane must not introduce service_role runtime.');
assert.match(appSource, /pipeline-roster-verification-card/u, 'Pipeline Admin must render roster verification review UI.');
assert.match(appSource, /Approved Source Evidence JSON/u, 'Admin UI must expose explicit evidence envelope review.');
assert.match(appSource, /approveSelectedRosterBridge/u, 'Admin UI must expose explicit roster bridge approval action.');

console.log('MMC-506 roster verification lane validation passed');
