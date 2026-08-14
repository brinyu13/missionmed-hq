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
    "['marriage_partner','Partner life']",
    "['travel','Travel']",
    'Dr Brian Recommends',
    'data-inspiration-move',
    'text/storyforge-inspiration-pin',
    'api.inspirationPins',
    'Answer by voice',
  ]) assert.match(app, new RegExp(marker.replaceAll('.', '\\.')));
  assert.match(app, /group\('domain', 'What part of life\?'/);
  assert.match(app, /group\('lifeStage', 'When did it happen\?'/);
  assert.match(app, /state\.capabilities\?\.voiceCapture \? `<button class="btnSave b1515Speak/);
  assert.match(app, /inspiration: \{[\s\S]*layout: 'list'/);
  assert.match(styles, /\.b1515PinnedPrompt\.dragOver/);
});

test('B1-515 Request a Story uses relationship buttons and previews both delivery surfaces', () => {
  assert.match(app, /data-request-relationship=/);
  assert.match(app, /Exactly what <em>\$\{esc\(invitation\.recipientFirstName\)\}<\/em> will receive/);
  assert.match(app, /Preview the actual guest surface/);
  assert.match(app, /api\.requestGuestPreview/);
  assert.match(app, /data-guest-surface-preview/);
  assert.match(app, /server-authorized preview data/);
  assert.doesNotMatch(app, /Who knows a story of you\?|Ask someone/);
  assert.match(app, /Nothing sends before your final confirmation/);
  assert.match(styles, /\.b1515RelationshipButtons/);
  assert.match(styles, /\.b1515GuestPreviewScreen/);
});

test('B1-515R uses signed actor avatar and explicit read-only administrator subject context', () => {
  assert.match(app, /state\.avatarIdentity = session\?\.avatarIdentity \|\| null/);
  assert.match(app, /identity\?\.headshotUrl/);
  assert.match(app, /b1515AvatarFallback/);
  assert.match(app, /\/api\/admin\/console\/subjects\/\$\{id\}\/home/);
  assert.match(app, /VIEWING STORYFORGE FOR/);
  assert.match(app, /data-admin-open-subject/);
  assert.match(app, /data-admin-subject-story/);
  assert.match(app, /studentOwnedMutations/);
  assert.match(styles, /\.b1515SubjectBanner/);
  assert.match(styles, /\.b1515Avatar img/);
});

test('B1-515R direct review controls persist immediately and mentor composer accepts submitted visibility', () => {
  assert.match(app, /async function saveDirectAdminScore/);
  assert.match(app, /async function saveDirectUseReviews/);
  assert.match(app, /await saveDirectUseReviews\(\{/);
  assert.match(app, /storyVisibility\(story\) !== 'mentor_visible'[\s\S]*story\.status === 'private'/);
  assert.match(app, /Text-only share · no original audio is attached/);
  assert.match(app, /open\.hasAudio === true/);
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
  assert.match(styles, /\.adminStoryRow\{display:grid;/);
  assert.match(styles, /\.adminStoryRow \.rMain\{display:grid;/);
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

test('B1-515 fast repair uses explicit start, shared segmentation, and one admin feedback workspace', () => {
  assert.match(app, /🎙 Start recording/);
  assert.match(app, /VOICE_SEGMENT_PLAN\[0\]/);
  assert.match(app, /api\.transcribeMentorNoteSegment/);
  assert.match(app, /appendMentorLiveTranscript/);
  assert.match(app, /cancelMentorNoteRecording/);
  assert.match(app, /noteId: draft\.id,[\s\S]{0,180}storyId: story\.id,[\s\S]{0,180}identitySub/);
  assert.doesNotMatch(app, /window\.setTimeout\(\(\) => \{\s*void voiceStart\(\);\s*\}, 350\)/);
  assert.match(app, /b1515AdminReviewWorkspace/);
  assert.match(app, /Mentor Review/);
  assert.match(app, /Private admin note · only you \/ authorized admins can see this/);
  assert.doesNotMatch(app, /id="adminStudentFeedback"/);
  assert.match(app, /data-version-voice>🎙 Start recording/);
  assert.match(app, /data-version-voice-pause hidden>Pause/);
  assert.match(app, /pollPurposefulVersionVoice/);
  assert.match(app, /closePurposefulVersionSegment/);
  assert.match(app, /pausePurposefulVersionVoice/);
  assert.match(app, /Microphone off\. Every saved change remains in version history\./);
  assert.match(styles, /\.b1515AdminReviewWorkspace/);
});

test('B1-515R action center, contribution review, Content Studio, and grouped Settings remain bounded', () => {
  for (const marker of [
    'Who needs me', 'What should I do next?', 'What changed',
    'data-contribution-review=', 'api.reviewContribution',
    'Overview', 'Add One', 'Import', 'Environments',
    'Validate draft', 'Validated preview · not published', 'Commit retired drafts',
    'api.adminInspirationReorder', 'expectedVersions',
    'Appearance', 'Story Preferences', 'Notifications', 'Invitations', 'Identity',
    'No notification preference endpoint is available in this release',
  ]) assert.match(app, new RegExp(marker.replaceAll('?', '\\?').replaceAll('.', '\\.')));
  assert.match(app, /reviewContribution:[\s\S]{0,180}jsonOptions\('PATCH'/);
  assert.match(app, /actionCenter\.whoNeedsMe\?\.needsReview\?\.items/);
  assert.match(app, /actionCenter\.changed\?\.newSinceLastVisit/);
  assert.match(app, /item\.studentScore,item\.student_score/);
  assert.match(app, /item\.studentReviewNote,item\.student_review_note/);
  assert.match(app, /maxlength="2000"/);
  assert.match(app, /state\.adminBulkPreview = parsed/);
  assert.match(app, /state\.adminBulkPreview\?\.validation\?\.publishable===true/);
  assert.match(app, /activeOrder\.get\(String\(prompt\.id\)\)/);
  assert.doesNotMatch(app, /api\.adminInspirationBulkCommit\(parsed\.prompts\)/);
  assert.match(styles, /\.b1515ActionCenter/);
  assert.match(styles, /\.b1515ContentTabs/);
  assert.match(styles, /\.b1515SettingsGroup/);
});

test('Question Workshop starts at the top without resetting later workshop rerenders', () => {
  const openWorkshopBody = app.match(/async function openWorkshop\(questionId\) \{([\s\S]*?)\n\}/)?.[1] || '';
  assert.match(openWorkshopBody, /renderQuestionWorkshop\(\);[\s\S]*main\.scrollTop = 0;[\s\S]*main\.scrollLeft = 0;/);
  assert.doesNotMatch(app, /function renderQuestionWorkshop\([^)]*\) \{[\s\S]*?main\.scrollTop = 0;/);
});

test('legacy submitted visibility is labeled truthfully instead of private', () => {
  assert.match(app, /function storyVisibilityDisplay\(story\)/);
  assert.match(app, /return story\?\.status && story\.status !== 'private' \? 'legacy_review' : 'private'/);
  assert.match(app, /Legacy review access/);
  assert.match(app, /pre-consent transition/);
  assert.match(styles, /\.b1513VisLegacy/);
});

test('mobile Story Room shrinks every grid child and scrolls only the version tabs', () => {
  assert.match(styles, /@media\(max-width:900px\)\{\.roomGrid\{grid-template-columns:minmax\(0,1fr\)\}\.roomGrid>\*\{min-width:0\}\.voiceTabs\{max-width:100%;overflow-x:auto\}\}/);
});
