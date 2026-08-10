#!/usr/bin/env node
/*
 * B1-513 prototype build.
 * Takes the EXACT production StoryForge frontend (public/app.js, styles.css,
 * auth.js, fonts, logo — byte-identical to live release v-10688bb24bca7965
 * modulo the release alias pass) and applies a small, fully enumerated list of
 * anchored patches, then emits ONE self-contained HTML file.
 * Every patch below is documented in B1-513_PROTOTYPE_TO_PRODUCTION_MAPPING.md.
 * The build FAILS LOUDLY if any anchor is missing, so drift is impossible to miss.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const BASE = '/home/claude/b1-513/production-baseline';
const PROTO = '/home/claude/b1-513r';
const OUT = `${PROTO}/B1-513R_FINAL_WORKING_PROTOTYPE.html`;

const read = (path) => readFileSync(path, 'utf8');
const readB64 = (path) => readFileSync(path).toString('base64');

let appliedPatches = [];

function patch(source, id, anchor, replacement, { expect = 1 } = {}) {
  const count = source.split(anchor).length - 1;
  if (count !== expect) {
    throw new Error(`PATCH ${id}: anchor found ${count} times (expected ${expect}).\nAnchor: ${anchor.slice(0, 120)}`);
  }
  appliedPatches.push(id);
  return source.split(anchor).join(replacement);
}

function replaceBetween(source, id, startAnchor, endAnchor, replacement) {
  const start = source.indexOf(startAnchor);
  if (start === -1) throw new Error(`PATCH ${id}: start anchor missing`);
  const end = source.indexOf(endAnchor, start);
  if (end === -1) throw new Error(`PATCH ${id}: end anchor missing after start`);
  appliedPatches.push(id);
  return source.slice(0, start) + replacement + source.slice(end);
}

/* ---------------- load sources ---------------- */
let app = read(`${BASE}/app.js`);
let authJs = read(`${BASE}/auth.js`);
let css = read(`${BASE}/styles.css`);
const extJs = read(`${PROTO}/extensions.js`);
const ext2Js = read(`${PROTO}/extensions2.js`);
const rCss = read(`${PROTO}/b1513r.css`);
const contribLibrary = read('/home/claude/b1-513r-out/B1-513R_CONTRIBUTOR_PROMPT_LIBRARY.json');
const extCss = read(`${PROTO}/extensions.css`);
let shim = read(`${PROTO}/shim.js`);
const promptLibrary = read('/home/claude/b1-513/research/PROMPT_LIBRARY.json');

const sourceHashes = {
  'app.js': createHash('sha256').update(app).digest('hex'),
  'styles.css': createHash('sha256').update(css).digest('hex'),
  'auth.js': createHash('sha256').update(authJs).digest('hex'),
};

/* ---------------- auth.js patches ---------------- */
authJs = patch(authJs, 'A1-origin-safe-api-url',
  "return new URL(`${config.basePath}api/${normalized}`, window.location.origin).toString();",
  "return new URL(`${config.basePath}api/${normalized}`, window.__B1513_ORIGIN || window.location.origin).toString(); // B1-513 prototype: file:// safe origin");
authJs = authJs.replaceAll('export async function', 'async function').replaceAll('export function', 'function');
appliedPatches.push('A2-strip-esm-exports (inline single-module build)');

/* ---------------- app.js patches ---------------- */
app = patch(app, 'P01-strip-import',
  "import { createAuthClient } from './auth.js';",
  '// B1-513 prototype single-file build: auth client inlined above in this module.');

app = patch(app, 'P02-nav-inspiration',
  "    ['library', 'Story Library', '▤'],\n    ['prep', 'Interview Prep', '◇'],",
  "    ['library', 'Story Library', '▤'],\n    ['inspiration', 'Inspiration', '✧'],\n    ['prep', 'Interview Prep', '◇'],");

app = patch(app, 'P03-route-title',
  "    library: 'Story Library',",
  "    library: 'Story Library',\n    inspiration: 'Inspiration',");

app = patch(app, 'P04-student-route-allowlist',
  "const studentRoutes = new Set(['home', 'library', 'notifications', 'settings', 'prep', 'qshop', 'qlib', 'story']);",
  "const studentRoutes = new Set(['home', 'library', 'inspiration', 'notifications', 'settings', 'prep', 'qshop', 'qlib', 'story']);");

app = patch(app, 'P05-render-route-inspiration',
  "    if (state.route === 'settings') {\n      renderSettings();\n      return;\n    }\n    if (state.route === 'prep') {",
  "    if (state.route === 'settings') {\n      renderSettings();\n      return;\n    }\n    if (state.route === 'inspiration' && b1513FeatureOn('inspiration')) {\n      await b1513LoadInspiration();\n      renderShell();\n      renderInspiration();\n      return;\n    }\n    if (state.route === 'prep') {");

app = patch(app, 'P06-session-b1513',
  "  state.library.sort = state.capabilities.inlinePriority ? 'priority' : 'new';",
  "  b1513InitFromSession(session);\n  state.library.sort = state.capabilities.inlinePriority ? 'priority' : 'new';");

app = patch(app, 'P07-boot-consent',
  '  await renderRoute();\n  await recoverVoiceDraftOnBoot();',
  '  await renderRoute();\n  await b1513MaybeShowConsent();\n  await recoverVoiceDraftOnBoot();');

app = patch(app, 'P08-room-active-version',
  "  const originalTab = state.storyTab !== 'working';\n  const title = originalTab ? story.originalTitle : story.title;\n  const text = originalTab ? story.originalText : story.text;",
  "  const b1513Tab = b1513ActiveVersionTab();\n  const originalTab = b1513Tab === 'original';\n  const title = originalTab ? story.originalTitle : story.title;\n  const text = b1513ActiveVersionText(story, b1513Tab);\n  void title; void text;");

app = replaceBetween(app, 'P09-room-version-surface',
  '        <div class="voiceTabs" role="tablist" aria-label="Story versions">',
  '        ${storyMediaMarkup(story)}',
  '        ${b1513VersionSurface(story, mentor)}\n\n');

app = patch(app, 'P10-room-visibility-chip',
  '    <div class="roomMeta">\n      ${statusChip(story)}',
  '    <div class="roomMeta">\n      ${statusChip(story)}\n      ${b1513VisibilityChip(story)}');

app = patch(app, 'P11-room-visibility-card',
  "      <aside>\n        ${presentationSectionVisible('reviewSubmission')",
  "      <aside>\n        ${b1513VisibilityCard(story, mentor)}\n        ${presentationSectionVisible('reviewSubmission')");

app = patch(app, 'P12-library-row-badges',
  '      ${statusChip(story)}\n      <button class="rowBtn" type="button" data-open-quick=',
  '      ${statusChip(story)}${b1513RowBadges(story)}\n      <button class="rowBtn" type="button" data-open-quick=');

app = patch(app, 'P13-home-inspiration-link',
  '<button class="rowBtn" type="button" data-capture-prompt="${attr(MEMORY_PROMPTS[state.promptIndex])}">Write about this</button>',
  '<button class="rowBtn" type="button" data-capture-prompt="${attr(MEMORY_PROMPTS[state.promptIndex])}">Write about this</button>\n      ${b1513HomeInspirationLink()}');

app = patch(app, 'P14-admin-students-directory',
  "      if (state.route === 'students') {\n        await loadAdminStudents();\n        renderAdminStudents();\n        return;\n      }",
  "      if (state.route === 'students') {\n        if (b1513FeatureOn('directory')) {\n          await b1513LoadAdminDirectory();\n          renderShell();\n          b1513RenderAdminDirectory();\n          return;\n        }\n        await loadAdminStudents();\n        renderAdminStudents();\n        return;\n      }");

app = patch(app, 'P15-admin-home-extras',
  '<div class="fstat"><div class="n metric-violet">${Number(metrics.unscored || 0)}</div><div class="l">Unscored</div></div>\n    </div>',
  '<div class="fstat"><div class="n metric-violet">${Number(metrics.unscored || 0)}</div><div class="l">Unscored</div></div>\n    </div>\n    ${b1513AdminHomeExtras()}');

app = replaceBetween(app, 'P16-admin-review-direct-controls',
  '        <label class="fLbl" for="adminReviewStatus">Review status</label>',
  '        <label class="fLbl" for="adminStudentFeedback">',
  '        ${b1513DirectReviewControls(story)}\n');

app = patch(app, 'P17-admin-review-save-fallback',
  "  const scoreValue = $('#adminReviewScore', form)?.value || '';\n  const suitability = $('#adminReviewSuitability', form)?.value || '';",
  "  const scoreValue = $('#adminReviewScore', form)?.value || String(story.mentorScore || ''); // B1-513: selects replaced by direct controls\n  const suitability = $('#adminReviewSuitability', form)?.value || story.reviewSuitability || '';");

app = patch(app, 'P18-admin-student-profile-link',
  '<div class="privacyBoundary" role="note">Private and archived stories are intentionally absent.',
  '<div class="inlineActions"><button class="rowBtn" type="button" data-b1513-open-profile="${attr(student.id)}">Open full profile drawer ▸</button></div>\n    <div class="privacyBoundary" role="note">Private and archived stories are intentionally absent.');

app = patch(app, 'P19-settings-privacy-panel',
  '    <div class="panel panel-spaced"><div class="pBody pbody-top">',
  '    ${b1513PrivacySettingsPanel()}\n    <div class="panel panel-spaced"><div class="pBody pbody-top">');

app = patch(app, 'P20-content-display-version-config',
  "        ${renderSectionConfiguration()}",
  "        ${renderSectionConfiguration()}\n        ${b1513VersionConfigPanel()}");

app = patch(app, 'P21-release-controls-inspiration-admin',
  '    ${renderContentDisplayControls()}',
  '    ${renderContentDisplayControls()}\n    ${b1513InspirationConfigPanel()}');

app = patch(app, 'P22-sync-version-config',
  "  draft.navigation.interviewPrepVisible = Boolean($('[data-config-interview-prep]', form)?.checked);\n  return draft;",
  "  draft.navigation.interviewPrepVisible = Boolean($('[data-config-interview-prep]', form)?.checked);\n  b1513SyncVersionConfigDraft(form);\n  return draft;");

app = patch(app, 'P23-playback-blob-allowance',
  "    if (parsed.protocol !== 'https:') throw new Error('invalid_playback_url');",
  "    if (!['https:', 'blob:'].includes(parsed.protocol)) throw new Error('invalid_playback_url'); // B1-513 PROTOTYPE ONLY: blob: for simulated audio. Production stays https-only.");


/* ==================== B1-513R refinement patches (applied on top) ==================== */

/* Module scope forbids duplicate function declarations, so the B1-513 layer's
 * superseded functions are renamed to *_v1 at build time; the R layer declares
 * the active versions. Call sites keep the plain name and thus bind to R. */
let extJsPatched = extJs;
for (const name of ['b1513VersionSurface', 'renderInspiration', 'b1513WizardStepMarkup', 'b1513WizardPick', 'b1513WizardBack', 'b1513RenderAdminDirectory', 'b1513AdminPatch']) {
  const marker = `function ${name}(`;
  const count = extJsPatched.split(marker).length - 1;
  if (count !== 1) throw new Error(`OVERRIDE ${name}: declaration found ${count} times`);
  extJsPatched = extJsPatched.replace(marker, `function ${name}__v1(`);
  appliedPatches.push(`RO-${name}-superseded`);
}

app = patch(app, 'R01-storyrow-delegate',
  `function storyRow(story, options = {}) {`,
  `function storyRow(story, options = {}) {\n  return b1513rStoryRow(story, options); // B1-513R: progressive-disclosure row\n}\nfunction b1513LegacyStoryRow(story, options = {}) {`);

app = patch(app, 'R02-room-title-single-hierarchy',
  `    <div class="roomTitleWrap">\n      \${story.prefixEnabled ? '<div class="roomPre">The One Where</div>' : ''}\n      <h1 class="roomTitle" id="roomStoryTitle">\${esc(story.title)}</h1>\n    </div>`,
  `    <div class="roomTitleWrap">\n      \${story.prefixEnabled ? '<div class="roomPre">The One Where</div>' : ''}\n      <h1 class="roomTitle \${b1513Tab === 'working' && !mentor ? 'srOnly' : ''}" id="roomStoryTitle">\${esc(story.title)}</h1>\n    </div>`);

app = patch(app, 'R03-room-single-status-chip',
  '          <div>\${statusChip(story)}</div>\n          <div class="stageHint">\${esc(presentationSection(\'reviewSubmission\').helper',
  '          <div class="stageHint">\${esc(presentationSection(\'reviewSubmission\').helper');

app = patch(app, 'R04-room-admin-status-neutral',
  '\${mentor ? `<div class="statusRow">',
  '\${canAdminReview() ? \'<div class="stageHint">Review controls live in the Mentor Review rail.</div>\' : mentor ? `<div class="statusRow">',
  { expect: 2 });

app = patch(app, 'R05-room-mentor-semantics',
  `function renderStoryRoom() {\n  const story = state.storyDetail;\n  if (!story) return;\n  const mentor = isMentor();`,
  `function renderStoryRoom() {\n  const story = state.storyDetail;\n  if (!story) return;\n  const mentor = isMentor() || canAdminReview(); // B1-513R: mirrored admin review uses the same room`);

app = patch(app, 'R06-room-mentor-rail',
  "      <aside>\n        \${b1513VisibilityCard(story, mentor)}",
  "      <aside>\n        \${canAdminReview() ? b1513rMentorReviewRail(story) : ''}\n        \${b1513VisibilityCard(story, mentor)}");

app = patch(app, 'R07-room-scorepicker-admin-neutral',
  '\${mentor ? scorePicker(\'room-mentor\', story.mentorScore, true) : `<span class="scoreTag">',
  '\${isMentor() ? scorePicker(\'room-mentor\', story.mentorScore, true) : `<span class="scoreTag">');

app = patch(app, 'R08-room-feedback-composer-mentor-only',
  '\${mentor ? `<div class="noteCompose">',
  '\${isMentor() ? `<div class="noteCompose">', { expect: 2 });

app = patch(app, 'R09-room-ask-mentor-only',
  '\${mentor ? `<div class="askRow"><input id="mentorAskText"',
  '\${canAdminReview() ? \'\' : isMentor() ? `<div class="askRow"><input id="mentorAskText"');

app = patch(app, 'R10-admin-nav-split',
  `const ADMIN_CONSOLE_NAV = Object.freeze([\n  ['home', 'Admin Home', '⌂'],\n  ['students', 'Students', '◎'],\n  ['queue', 'Review Queue', '◫'],\n  ['qlib', 'Question Library', '◇'],\n  ['settings', 'Release Controls', '⚙'],\n]);`,
  `const ADMIN_CONSOLE_NAV = Object.freeze([\n  ['home', 'Home', '⌂'],\n  ['students', 'Students', '◎'],\n  ['queue', 'Review Queue', '◫'],\n  ['content', 'Content Studio', '▦'],\n  ['settings', 'System Controls', '⚙'],\n]);`);

app = patch(app, 'R10b-nav-requests',
  "    ['inspiration', 'Inspiration', '✧'],",
  "    ['inspiration', 'Inspiration', '✧'],\n    ['requests', 'Request a Story', '✉'],");

app = patch(app, 'R11-route-titles',
  "    inspiration: 'Inspiration',",
  "    inspiration: 'Inspiration',\n    requests: 'Request a Story',\n    content: 'Content Studio',");

app = patch(app, 'R12-student-routes-requests',
  "const studentRoutes = new Set(['home', 'library', 'inspiration', 'notifications', 'settings', 'prep', 'qshop', 'qlib', 'story']);",
  "const studentRoutes = new Set(['home', 'library', 'inspiration', 'requests', 'notifications', 'settings', 'prep', 'qshop', 'qlib', 'story']);");

app = patch(app, 'R13-admin-routes-content',
  "? ['home', 'students', 'student', 'queue', 'story', 'qlib', 'settings']",
  "? ['home', 'students', 'student', 'queue', 'story', 'qlib', 'content', 'settings']");

app = patch(app, 'R14-student-requests-branch',
  "    if (state.route === 'inspiration' && b1513FeatureOn('inspiration')) {\n      await b1513LoadInspiration();\n      renderShell();\n      renderInspiration();\n      return;\n    }",
  "    if (state.route === 'inspiration' && b1513FeatureOn('inspiration')) {\n      await b1513LoadInspiration();\n      await b1513rLoadBrowse().catch(() => {});\n      renderShell();\n      renderInspiration();\n      return;\n    }\n    if (state.route === 'requests') {\n      await b1513rLoadRequests();\n      renderShell();\n      renderRequests();\n      return;\n    }");

app = patch(app, 'R15-student-settings-preload',
  "    if (state.route === 'settings') {\n      renderSettings();\n      return;\n    }\n    if (state.route === 'inspiration'",
  "    if (state.route === 'settings') {\n      if (isStudent()) await b1513rLoadRequests().catch(() => {});\n      renderSettings();\n      return;\n    }\n    if (state.route === 'inspiration'");

app = patch(app, 'R16-admin-home-mirror',
  "      if (state.route === 'home') {\n        await loadAdminHome();\n        renderAdminHome();\n        return;\n      }",
  "      if (state.route === 'home') {\n        await Promise.all([loadAdminHome(), b1513LoadAdminDirectory()]);\n        renderShell();\n        b1513rRenderAdminHome();\n        return;\n      }");

app = patch(app, 'R17-admin-student-workspace',
  "      if (state.route === 'student' && state.routeId) {\n        await loadAdminStudent(state.routeId);\n        renderAdminStudent();\n        return;\n      }",
  "      if (state.route === 'student' && state.routeId) {\n        b1513State().directory.profile = await b1513Api.directoryStudent(state.routeId);\n        b1513State().directory.profileTab = 'stories';\n        renderShell();\n        b1513rRenderStudentWorkspace();\n        return;\n      }");

app = patch(app, 'R18-admin-story-mirrored-room',
  "      if (state.route === 'story' && state.routeId) {\n        await loadAdminStory(state.routeId);\n        renderAdminStory();\n        return;\n      }",
  "      if (state.route === 'story' && state.routeId) {\n        renderShell();\n        await loadAdminStory(state.routeId);\n        const adminStory = adminConsoleState().story;\n        if (adminStory?.studentId) {\n          try {\n            b1513State().directory.profile = await b1513Api.directoryStudent(adminStory.studentId);\n            b1513State().directory.profileTab = 'stories';\n            b1513rRenderStudentWorkspace();\n          } catch { await loadAdminQueue(); renderAdminQueue(); }\n        } else { await loadAdminQueue(); renderAdminQueue(); }\n        state.storyDetail = adminStory;\n        state.storyTab = 'original';\n        room.classList.add('open');\n        renderStoryRoom();\n        return;\n      }");

app = patch(app, 'R19-content-studio-branch',
  "      if (state.route === 'queue') {\n        await loadAdminQueue();\n        renderAdminQueue();\n        return;\n      }",
  "      if (state.route === 'queue') {\n        await loadAdminQueue();\n        renderAdminQueue();\n        return;\n      }\n      if (state.route === 'content') {\n        await b1513rLoadContentStudio();\n        renderShell();\n        b1513rRenderContentStudio();\n        return;\n      }");

app = patch(app, 'R20-system-controls-title',
  `<h1 class="h1">Release <em>Controls</em></h1>`,
  `<h1 class="h1">System <em>Controls</em></h1>`);

app = patch(app, 'R21-system-controls-split',
  '    \${renderContentDisplayControls()}\n    \${b1513InspirationConfigPanel()}',
  '    <p class="stageHint b1513rSplitNote">Student-facing content — labels, taxonomy, versions, Inspiration and Request-a-Story questions — now lives in <b>Content Studio</b>. This page changes authorization and runtime state only, and is deliberately harder to change by accident.</p>');

app = patch(app, 'R22-settings-appearance-group',
  `    <div class="panel panel-spaced">\n        <div class="pHead"><div class="h2">Background <em>environment</em></div></div>`,
  `    <div class="b1513rSettingsGroup" role="heading" aria-level="2">Appearance</div>\n    <div class="panel panel-spaced">\n        <div class="pHead"><div class="h2">Background <em>environment</em></div></div>`);

app = patch(app, 'R23-settings-extra-panels',
  '    \${b1513PrivacySettingsPanel()}\n    <div class="panel panel-spaced"><div class="pBody pbody-top">',
  '    \${b1513rSettingsExtraPanels()}\n    <div class="panel panel-spaced"><div class="pBody pbody-top">');

app = patch(app, 'R24-shell-identity-avatar',
  '<div class="signedIdentity">\${esc(state.user.display_name)}\${state.user.cohort ? ` · \${esc(state.user.cohort)}` : \'\'}</div>',
  '<div class="signedIdentity b1513rSignedIdentity">\${b1513rHeadshot(state.user, { sub: state.user.cohort || \'\' })}</div>');

app = patch(app, 'R25-home-mentor-avatar',
  `<span class="avc adv">M</span>`,
  "\${b1513rHeadshot('u-founder', { withName: false, size: 'sm' })}");

app = patch(app, 'R26-admin-queue-avatars',
  `<span class="stuAv">\${esc((current.studentName || 'S').split(/\\s+/).map((part) => part[0]).slice(0, 2).join(''))}</span>`,
  "\${b1513rHeadshot({ id: current.studentId, name: current.studentName }, { withName: false, size: 'sm' })}");

app = patch(app, 'R27-clearoverlays-guest-mode',
  '  state.storyDetail = null;\n  state.storyCompletionIntent = null;',
  "  document.body.classList.remove('b1513rGuestMode');\n  state.storyDetail = null;\n  state.storyCompletionIntent = null;");

/* logo → data URL */
const logoData = `data:image/png;base64,${readB64(`${BASE}/missionmed-logo.png`)}`;
const logoCount = app.split('./missionmed-logo.png').length - 1;
app = app.split('./missionmed-logo.png').join(logoData);
appliedPatches.push(`P24-logo-data-url (${logoCount} refs in app.js)`);

/* ---------------- styles: fonts → data URLs ---------------- */
const fonts = [
  'archivo-normal.7150c0ec5ad3.woff2', 'archivo-italic.e1989a572737.woff2',
  'lora-normal.6b102ab35aa1.woff2', 'lora-italic.3d536d49566e.woff2',
  'rajdhani-500.4745b75b6e92.woff2', 'rajdhani-600.35f7e628ec8e.woff2', 'rajdhani-700.7597c31a957a.woff2',
];
for (const font of fonts) {
  const marker = `url("./fonts/${font}")`;
  if (!css.includes(marker)) throw new Error(`FONT: ${marker} not found in styles.css`);
  css = css.split(marker).join(`url('data:font/woff2;base64,${readB64(`${BASE}/fonts/${font}`)}')`);
}
appliedPatches.push('S1-fonts-inlined (7 woff2 data URLs)');

/* ---------------- shim: inject prompt library ---------------- */
shim = patch(shim, 'H1-prompt-library', '/* __B1513_PROMPT_LIBRARY__ */ null', promptLibrary.trim());
shim = patch(shim, 'H2-contrib-library', '/* __B1513R_CONTRIB_LIBRARY__ */ null', contribLibrary.trim());

/* ---------------- assemble ---------------- */
const html = `<!doctype html>
<!--
  B1-513R STORYFORGE V2 FINAL WORKING PROTOTYPE (refined from the accepted B1-513 prototype)
  ============================================
  Foundation: EXACT production StoryForge frontend from live release
  v-10688bb24bca7965 (source commit 8ca5d60fffcbb479fc5ced4689702fd4a7defb58).
  Production source hashes at build time:
    app.js     ${sourceHashes['app.js']}
    styles.css ${sourceHashes['styles.css']}
    auth.js    ${sourceHashes['auth.js']}
  Stage 2 additions are applied as ${appliedPatches.length} documented anchored patches plus an
  appended extension module — see B1-513_PROTOTYPE_TO_PRODUCTION_MAPPING.md.
  SYNTHETIC DATA ONLY. Standalone. No production system is contacted.
  Open this file directly in a browser (Chrome recommended). You land signed in
  as the Founder (Student View). Use the sidebar "Viewing as" control for
  Administrator View, or "Change fixture identity" to try other personas
  (Maya demonstrates the first-use mentorship disclosure).
-->
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#0a0d14">
  <title>StoryForge · MissionMed — B1-513R V2 Prototype</title>
  <style>
${css}
/* ==================== B1-513 STAGE 2 ADDITIVE STYLES ==================== */
${extCss}
/* ==================== B1-513R REFINEMENT STYLES ==================== */
${rCss}
  </style>
</head>
<body data-role="student" data-background="ember" class="is-booting">
  <a class="skip-link" href="#main">Skip to content</a>
  <canvas id="bgfx" aria-hidden="true"></canvas>
  <div class="aur a" aria-hidden="true"></div>
  <div class="aur b" aria-hidden="true"></div>
  <div class="aur c" aria-hidden="true"></div>
  <div class="vg" aria-hidden="true"></div>
  <nav id="rail" aria-label="StoryForge navigation"></nav>
  <header id="hdr"></header>
  <div id="advBanner"><span></span></div>
  <main id="main">
    <section class="storyforgeIntro" role="status" aria-live="polite">
      <img class="introLogo" src="${logoData}" alt="MissionMed Institute">
      <p class="introCreator">Dr Brian's IV Prep On-Call</p>
      <p class="introInstitution">MissionMed Institute</p>
      <p class="introDivision">Mission:Residency Division</p>
      <h1 class="introProduct">Story<span>Forge</span></h1>
      <p class="introStatus">Opening your private story workspace…</p>
    </section>
  </main>
  <div id="room"></div>
  <div id="capture"></div>
  <div id="quick" class="drawerWrap"></div>
  <div id="qad" class="drawerWrap"></div>
  <div id="pal"></div>
  <div id="sesh"></div>
  <div id="teach"></div>
  <div id="toast" role="status" aria-live="polite"></div>
  <script>
${shim}
  </script>
  <script type="module">
/* ==================== production auth.js (inlined) ==================== */
${authJs}
/* ==================== production app.js (patched at documented seams) ==================== */
${app}
/* ==================== B1-513 Stage 2 extensions ==================== */
${extJsPatched}
/* ==================== B1-513R refinement layer (overrides + new modules) ==================== */
${ext2Js}
  </script>
</body>
</html>
`;

writeFileSync(OUT, html);
const outHash = createHash('sha256').update(html).digest('hex');
console.log(`Built ${OUT}`);
console.log(`Bytes: ${Buffer.byteLength(html)}`);
console.log(`SHA-256: ${outHash}`);
console.log(`Patches applied (${appliedPatches.length}):`);
appliedPatches.forEach((id) => console.log(`  - ${id}`));
