import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import assert from "node:assert/strict";

const appRoot = resolve("mmc-v1-core");
const runtimeFiles = [
  resolve(appRoot, "index.html"),
  resolve(appRoot, "src/styles.css"),
  resolve(appRoot, "src/mmc-data-adapters.js"),
  resolve(appRoot, "src/mmc-ownership-layer.js"),
  resolve(appRoot, "src/app.js")
];
const runtimeSource = runtimeFiles.map((file) => readFileSync(file, "utf8")).join("\n");
const indexSource = readFileSync(resolve(appRoot, "index.html"), "utf8");
const appSource = readFileSync(resolve(appRoot, "src/app.js"), "utf8");

const forbiddenRuntimePatterns = [
  /XMLHttpRequest\s*\(/i,
  /navigator\.sendBeacon/i,
  /WebSocket\s*\(/i,
  /EventSource\s*\(/i,
  /https?:\/\//i,
  /service_role/i,
  /wp-json/i,
  /api\/scheduler/i,
  /supabase/i,
  /cloudflare/i,
  /r2_/i,
  /railway/i,
  /kinsta/i,
  /<script[^>]+src=["'](?!\.\/src\/(?:mmc-data-adapters|mmc-ownership-layer|app)\.js(?:\?v=0(?:08b|09|10)|\?v=01(?:1|2|6)|\?v=021|\?v=100)?["'])/i,
  /<link[^>]+href=["'](?!data:,|\.\/src\/styles\.css(?:\?v=(?:008b|011|016|100))?["'])/i
];

for (const pattern of forbiddenRuntimePatterns) {
  assert.equal(pattern.test(runtimeSource), false, `Runtime contains forbidden integration pattern ${pattern}`);
}

assert.match(runtimeSource, /\/api\/mmc\/persistence/u, "Runtime must use only the same-origin MMC persistence API");
assert.doesNotMatch(runtimeSource, /fetch\s*\(\s*["']https?:/i, "Runtime must not fetch external URLs");

for (const testId of [
  "screen-today",
  "screen-actions",
  "screen-directory",
  "screen-profile",
  "screen-meeting",
  "screen-memory",
  "screen-studentview",
  "screen-session",
  "screen-post",
  "today-prep",
  "start-session",
  "end-session",
  "save-post-session",
  "directory-row",
  "action-checkbox",
  "quick-capture-open",
  "quick-capture-close",
  "quick-capture-save",
  "quick-capture-overlay",
  "student-briefing-card",
  "briefing-next-best-move",
  "briefing-personal-context",
  "briefing-professional-context",
  "briefing-last-meeting",
  "briefing-advice-history",
  "briefing-promises",
  "briefing-promises-overdue",
  "briefing-open-loops",
  "briefing-deadlines",
  "briefing-risk-summary",
  "briefing-relationship-context",
  "briefing-timeline-summary",
  "briefing-profile-photo",
  "profile-header-photo",
  "profile-photo-upload",
  "profile-photo-metadata",
  "pilot-readiness-panel",
  "pilot-persistence-state",
  "pilot-assignment-state",
  "pilot-session-recovery-state",
  "pilot-export-state",
  "resume-session",
  "export-alpha-snapshot"
]) {
  assert.match(runtimeSource, new RegExp(`data-testid=["']${testId}["']`), `Missing validation hook ${testId}`);
}

for (const screenId of [
  "screen-dashboard",
  "screen-actions",
  "screen-directory",
  "screen-profile",
  "screen-meeting",
  "screen-memory",
  "screen-studentview",
  "screen-sessioncmd",
  "screen-postsession"
]) {
  assert.match(indexSource, new RegExp(`id=["']${screenId}["']`), `Missing approved demo screen ${screenId}`);
}

for (const approvedDemoSurface of [
  "Active Programs",
  "Today's Operating Loop",
  "Urgent Actions",
  "Recent Transcripts",
  "Mentor Memory Alerts",
  "Attention-Ranked Directory",
  "Student Intelligence Profile",
  "Student Briefing Engine",
  "Mentor intelligence from MMC-owned memory, goals, tasks, sessions, promises, and assignments",
  "local MMC profile photo",
  "mentor/admin review only for now",
  "future-supported, not enabled publicly",
  "production storage",
  "WHO IS THIS PERSON?",
  "PERSONAL CONTEXT",
  "PROFESSIONAL CONTEXT",
  "LAST MEETING",
  "LAST ADVICE",
  "PROMISES MADE",
  "PROMISES OVERDUE",
  "OPEN LOOPS",
  "DEADLINES",
  "RISK",
  "RELATIONSHIP CONTEXT",
  "TIMELINE SUMMARY",
  "NEXT BEST MOVE",
  "Red Flags",
  "Current Strategy",
  "Mock Interview Performance",
  "Recent Meetings",
  "Recent Messages",
  "Submitted Files",
  "StoryForge Readiness",
  "Meeting Intelligence",
  "Webex Recording",
  "Transcript (AI-Enhanced)",
  "AI Session Summary",
  "Story Insights (AI-Extracted)",
  "Mentor-Only Notes",
  "Mentor Memory / Call Prep",
  "What I need to remember before this call",
  "Personal Details",
  "Family Context",
  "Promises Made",
  "Last Advice Given",
  "Sensitive Context",
  "Next Best Coaching Move",
  "Student View Preview",
  "Upcoming Deadlines",
  "My Submitted Files",
  "Session Command",
  "Student Quick Reference",
  "Follow-through Check",
  "Live Session Notes",
  "Quick Tags",
  "Created This Session",
  "Post-Session Capture",
  "Session Summary",
  "Action Items Review",
  "Student Visibility",
  "Quick Capture",
  "MMC Readiness Framework",
  "Student Journey Timeline",
  "Memory Search",
  "Relationship Context",
  "Readiness / Risk",
  "Private Alpha Control",
  "Persistence",
  "Assignments",
  "Session Recovery",
  "Export Snapshot"
]) {
  assert.match(runtimeSource, new RegExp(escapeRegExp(approvedDemoSurface)), `Missing approved demo surface: ${approvedDemoSurface}`);
}

assert.match(appSource, /window\.MMC_DEMO_PARITY/u, "Missing demo parity declaration");
assert.match(appSource, /authority:\s*'MMC-005A_OS_PATCHED_FROM_003\.html'/u, "Missing MMC-005A authority declaration");
assert.match(appSource, /productionDependencies:\s*false/u, "Production dependency flag must remain false");
assert.match(appSource, /apiCalls:\s*ownershipRuntime \? 'same-origin \/api\/mmc\/persistence only'/u, "API calls must be limited to same-origin MMC persistence");
assert.match(appSource, /integrationLayer:\s*'MMC-010 reality hydration guard'/u, "Missing MMC-010 integration layer declaration");
assert.match(appSource, /ownershipLayer:\s*ownershipRuntime \? 'MMC-021 mmc\.\* persistence ownership intelligence'/u, "Missing MMC-021 ownership layer declaration");
assert.match(appSource, /mentorIntelligenceLayer:\s*ownershipRuntime \? 'MMC-016 Student Briefing Engine backed by MMC-021 persistence'/u, "Missing MMC-016 mentor intelligence declaration");
assert.match(appSource, /window\.MMC_REALITY_RUNTIME/u, "Missing MMC reality runtime wiring");
assert.match(appSource, /window\.MMC_OWNERSHIP_RUNTIME/u, "Missing MMC ownership runtime wiring");
assert.match(appSource, /window\.MMC_MENTOR_INTELLIGENCE/u, "Missing MMC mentor intelligence declaration");
assert.match(appSource, /window\.MMCApp/u, "Missing browser validation harness");

for (const adapterContract of [
  "window.MMCDataAdapters",
  "MMC-010",
  "HARD_BLOCKED",
  "fixture-fallback-with-readiness-guards",
  "dataset.mmcAdapterMode",
  "dataset.mmcLiveDataReviewStatus",
  "dataset.mmcRealDataReplacements",
  "dataset.mmcExternalRequestsEnabled",
  "dataset.mmcWritesEnabled",
  "externalRequestsEnabled: false",
  "writesEnabled: false",
  "productionPayloadsLoaded: false",
  "realDataReplacements: 0",
  "fixtureFallbackRetained: true",
  "hydrationPhases",
  "safeSourceRegistry",
  "strictExclusions",
  "studentDirectory",
  "studentProfile",
  "meetingHistory",
  "taskLayer",
  "studentIdentity",
  "profiles",
  "appointments",
  "goals",
  "messages",
  "documentsMetadata",
  "readinessInputs",
  "mentorAuthorization"
]) {
  assert.match(runtimeSource, new RegExp(escapeRegExp(adapterContract)), `Missing MMC-009 adapter contract: ${adapterContract}`);
}

for (const ownershipContract of [
  "window.MMCOwnershipLayer",
  "MMC-011",
  "MMC-021",
  "PERSISTENCE_INTEGRATION_READY",
  "mmc-schema-persistence",
  "dataset.mmcOwnershipStatus",
  "dataset.mmcLocalOwnedWritesEnabled",
  "dataset.mmcLocalStorageEnabled",
  "externalRequestsEnabled: false",
  "externalWritesEnabled: false",
  "localOwnedWritesEnabled: false",
  "localStorageEnabled: false",
  "schemaPersistenceEnabled: true",
  "flushPersistence",
  "/api/mmc/persistence",
  "Mentor Memory",
  "mentorAssignments",
  "coachingSessions",
  "studentId",
  "getStudentBundle",
  "getReadiness",
  "getRisk",
  "getRelationshipContext",
  "getSessionInsights",
  "getStudentTimeline",
  "searchMemory",
  "completeTask",
  "quickCapture",
  "startSession",
  "addSessionItem",
  "savePostSession",
  "memorySearch",
  "studentTimeline",
  "readinessFramework",
  "riskFramework",
  "relationshipContext",
  "studentBriefingEngine",
  "openLoopDetector",
  "promiseEngine",
  "adviceHistoryEngine",
  "timelineSummarizer",
  "nextBestMoveEngine",
  "profilePhotos",
  "ownsProfilePhotos",
  "Student Briefing Engine",
  "Open Loop Detector",
  "Promise Engine",
  "Advice History Engine",
  "Relationship Context Engine",
  "Timeline Summarizer",
  "Risk Summary Engine",
  "Next Best Move Engine",
  "MENTOR_INTELLIGENCE_READY",
  "dataset.mmcMentorIntelligenceStatus",
  "dataset.mmcBriefingSource",
  "dataset.mmcProfilePhotoStatus",
  "getStudentBriefing",
  "getProfilePhoto",
  "setProfilePhoto",
  "getOpenLoops",
  "getPromiseBriefing",
  "getAdviceHistory",
  "getTimelineSummary",
  "getRiskSummary",
  "getNextBestMove",
  "handleProfilePhotoUpload",
  "profilePhotoSupport",
  "local-internal-pilot-only",
  "productionPhotoStorage",
  "studentPhotoUploadPublic",
  "renderStudentBriefing",
  "renderOwnedActions",
  "renderMemoryContent",
  "renderMemorySearchResults",
  "renderPostSessionReview",
  "MMC-MEGARUN-100",
  "window.MMC_PRIVATE_ALPHA",
  "PRIVATE_ALPHA_LAUNCH_READY",
  "getLaunchReadiness",
  "exportPilotSnapshot",
  "recoverLatestSession",
  "validatePrivateAlphaLaunch"
]) {
  assert.match(runtimeSource, new RegExp(escapeRegExp(ownershipContract)), `Missing MMC-011 ownership contract: ${ownershipContract}`);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

console.log("MMC core demo parity validation passed");
