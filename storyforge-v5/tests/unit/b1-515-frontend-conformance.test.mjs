import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const app = await readFile(new URL('../../public/app.js', import.meta.url), 'utf8');
const styles = await readFile(new URL('../../public/styles.css', import.meta.url), 'utf8');

test('B1-515 applies the page-introduction law without adding a renderer', () => {
  assert.match(app, /function pageIntroMarkup\(/);
  assert.match(styles, /\.b1515PageIntro\{[^}]*inset:auto;[^}]*height:auto;[^}]*z-index:auto;/);
  assert.match(app, /How this works/);
  for (const marker of ['Your story library', 'Notifications', "Your <em>StoryForge</em>", 'Interview Prep', 'MissionMed Question Library', 'Administrator workspace', 'Administrator · Students', 'Administrator · Review Queue', 'Administrator · Content Studio']) {
    assert.match(app, new RegExp(marker));
  }
  assert.doesNotMatch(app, /window\.__B1515|renderB1515|mountB1515/);
  assert.match(styles, /\.b1515PageIntro/);
});

test('B1-515 Inspiration is list-first, filterable, pinned, reorderable, and voice-capable only when authorized', () => {
  for (const marker of [
    'My Pinned Questions',
    'data-inspiration-filter="domain"',
    'data-inspiration-filter="lifeStage"',
    'Marriage / Partner life',
    'Travel / cultural experiences',
    'data-inspiration-filter="tone"',
    'data-inspiration-filter="status"',
    'Dr Brian Recommends',
    'data-inspiration-move',
    'text/storyforge-inspiration-pin',
    'api.inspirationPins',
    'Speak instead of type',
  ]) assert.match(app, new RegExp(marker.replaceAll('.', '\\.')));
  assert.match(app, /state\.capabilities\?\.voiceCapture \? `<button class="rowBtn b1515Speak/);
  assert.match(app, /inspiration: \{[\s\S]*layout: 'list'/);
  assert.match(styles, /\.b1515PinnedPrompt\.dragOver/);
});

test('B1-515 Request a Story uses relationship buttons and previews both delivery surfaces', () => {
  assert.match(app, /data-request-relationship=/);
  assert.match(app, /Exactly what <em>\$\{esc\(invitation\.recipientFirstName\)\}<\/em> will receive/);
  assert.match(app, /Preview their experience/);
  assert.match(app, /This is a product preview, not a live guest session/);
  assert.match(app, /Nothing sends before your final confirmation/);
  assert.match(styles, /\.b1515RelationshipButtons/);
  assert.match(styles, /\.b1515GuestPreviewScreen/);
});

test('B1-515 administrator controls are direct and remain signed-capability gated', () => {
  assert.match(app, /const direct = state\.capabilities\?\.adminReviewControls === true/);
  for (const marker of ['data-admin-review-status', 'data-admin-review-score', 'data-admin-suitability', 'data-admin-use-score', 'data-admin-promote']) {
    assert.match(app, new RegExp(marker));
  }
  assert.match(app, /state\.capabilities\?\.storyPromotions/);
  assert.match(app, /perUseScoring: Boolean\(session\?\.capabilities\?\.perUseScoring\)/);
  assert.match(app, /const perUseEnabled = direct && state\.capabilities\?\.perUseScoring === true/);
  assert.match(app, /api\.adminPromoteStory/);
  assert.match(app, /Another story is currently promoted to \$\{destinationLabel\}\. Replace it with this story while preserving history\?/);
  assert.match(app, /api\.adminUseReviews/);
  assert.match(app, /reviews: perUseReviews/);
  assert.match(app, /api\.adminSetStoryCollection/);
  assert.match(app, /\/api\/admin\/console\/stories\/\$\{id\}\/collection/);
  assert.match(app, /\{ collection, expectedVersion \}/);
  assert.match(app, /data-admin-collection="archived"/);
  assert.match(app, /data-admin-collection="trashed"/);
  assert.match(app, /data-admin-collection="active"/);
  assert.match(app, /\['awaiting', 'in_review', 'changes', 'reviewed', 'approved'\]/);
  assert.match(app, /api\.adminReviewStatus/);
  assert.doesNotMatch(app, /patch:\s*\{[\s\S]{0,400}perUseScores/);
  assert.match(app, /renderStoryRoom\(\{ adminStory: story \}\)/);
  assert.match(styles, /\.b1515AdminSegments/);
  assert.match(styles, /\.b1515PerUseScore/);
});

test('B1-515 Archive, Trash, source, and peer sharing are dormant without signed capabilities', () => {
  assert.match(app, /storyArchive: Boolean\(session\?\.capabilities\?\.storyArchive\)/);
  assert.match(app, /peerShare: Boolean\(session\?\.capabilities\?\.peerShare\)/);
  assert.match(app, /storyPromotions: Boolean\(session\?\.capabilities\?\.storyPromotions\)/);
  assert.match(app, /state\.capabilities\?\.storyArchive \? `<select id="libCollection"/);
  assert.match(app, /<option value="archive"/);
  assert.match(app, /<option value="trash"/);
  assert.match(app, /id="libSource"/);
  assert.match(app, /state\.capabilities\?\.peerShare \? `<form id="peerShareForm"/);
  assert.match(app, /api\.peerCandidates/);
  assert.match(app, /peerCandidates: \(\) => auth\.request\('\/api\/peer\/candidates'\)/);
  assert.match(app, /recipientIds,/);
  assert.match(app, /confirmPrivate: true/);
  assert.match(app, /api\.shareStoryWithClassmate/);
  for (const marker of ['api.peerInbox', 'api.peerOutbox', 'peerFeedbackForm', 'data-peer-revoke', 'data-peer-play']) {
    assert.match(app, new RegExp(marker.replaceAll('.', '\\.')));
  }
  assert.match(app, /Classmate Thoughts/);
  assert.match(styles, /\.b1515PeerReader/);
  assert.doesNotMatch(app, /includeAudio/);
  assert.doesNotMatch(app, /peerShareRecipient|Classmate’s MissionMed email or username/);
  assert.doesNotMatch(app, /peerShare: true|storyArchive: true|storyPromotions: true/);
});

test('B1-515 preserves the existing mentor transcript and original-audio controls', () => {
  for (const marker of ['Transcript + original voice', 'data-play-mentor-note', 'data-pause-mentor-note', 'data-resume-mentor-note', 'Publish transcript + audio']) {
    assert.match(app, new RegExp(marker.replaceAll('+', '\\+')));
  }
});
