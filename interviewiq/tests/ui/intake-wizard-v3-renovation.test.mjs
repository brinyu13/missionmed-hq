import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// ── Founder V2 UX renovation — source contract tests (IIQ-1204) ───────────
// Covers: P0 readability, game-like choice cards, Matrix progress tracker,
// program finder cards, visual date pickers, no Application Status question,
// friendly language, photographic hero architecture, celebration + truthful
// visibility + next-action cards, needed-vs-helpful, interview cards, research
// CTAs, journey navigation and permanent next actions.

const views = readFileSync(new URL('../../public/source/views.js', import.meta.url), 'utf8');
const actions = readFileSync(new URL('../../public/source/actions.js', import.meta.url), 'utf8');
const shell = readFileSync(new URL('../../public/source/shell.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../../public/styles.css', import.meta.url), 'utf8');
const fn = (src, name) => { const a = src.indexOf(`function ${name}(`); assert.ok(a > -1, `${name} defined`); const b = src.indexOf('\nfunction ', a + 1); return src.slice(a, b > -1 ? b : undefined); };
const wizard = fn(views, 'renderIntakeWizard');
const v2css = css.slice(css.indexOf('V2 UX RENOVATION'));
assert.ok(v2css.length > 1000, 'V2 renovation CSS layer present');

// ── P0 readability ────────────────────────────────────────────────────────
test('wizard primary text is white/high-contrast and large', () => {
  assert.ok(v2css.includes('.intakeWizard h2{font-size:36px'), 'wizard title 36px');
  assert.ok(v2css.includes('.intakeWizard p{font-size:17px;line-height:1.6;color:var(--tx)}'), 'question/body text 17px, primary color');
  assert.ok(v2css.includes('.intakeWizard .lead{font-size:18px;color:var(--tx)'), 'lead text 18px primary');
  assert.ok(v2css.includes('.intakeWizard .f{font-size:13px;letter-spacing:.12em;color:var(--tx)'), 'labels 13px primary, not dim');
  assert.ok(v2css.includes('.intakeWizard input,.intakeWizard select,.intakeWizard textarea{font-size:17px;padding:14px 16px'), 'inputs 17px');
  assert.ok(v2css.includes('.intakeWizard .btn{font-size:13px;letter-spacing:.1em;padding:13px 20px;border-radius:12px;min-height:46px'), 'buttons larger with 46px min target');
  assert.ok(v2css.includes('.intakeWizard .fieldHint{font-size:14.5px;color:var(--mid)'), 'helper text is secondary-muted but ≥14.5px');
});

test('muted text is reserved for secondary metadata (hint/eyebrow), not body', () => {
  assert.ok(!/\.intakeWizard p\{[^}]*color:var\(--mid\)[^}]*\}\s*$/.test(v2css), 'body paragraph in V2 layer is not --mid');
  assert.ok(v2css.includes('.intakeWizard .eyebrow{font-size:12px;color:var(--mid)}'));
});

// ── Game-like interaction ─────────────────────────────────────────────────
test('intakeChoice renders large choice cards with icons and aria-pressed', () => {
  const src = fn(views, 'intakeChoice');
  assert.ok(src.includes('class="choiceCards'), 'choiceCards grid');
  assert.ok(src.includes('class="choiceCard'), 'choiceCard buttons');
  assert.ok(src.includes('data-act="intake-choice"'), 'dispatch intake-choice');
  assert.ok(src.includes('aria-pressed="${on}"'), 'toggle state exposed to AT');
  assert.ok(src.includes('class="choiceIcon"'), 'icon slot');
  assert.ok(src.includes('role="group"') && src.includes('aria-labelledby'), 'group semantics preserved');
  assert.ok(src.includes(`"I don't know yet"`), 'allowUnknown option offered');
});

test('primary wizard questions use choice cards instead of tiny selects', () => {
  for (const field of ['positionType', `schedule',{dateLabel`, 'details.relationshipState', 'details.signalState', 'details.loiTemporal', 'details.itineraryState', 'details.invitationSource', 'details.structure', 'details.priority']) {
    assert.ok(wizard.includes(field), `${field} present in wizard`);
  }
  assert.ok(wizard.includes("intakeChoice('positionType'"), 'position type as cards');
  assert.ok(wizard.includes("intakeChoice('details.relationshipState'"), 'connection as cards');
  assert.ok(wizard.includes("intakeChoice('details.signalState'"), 'signal as cards');
  assert.ok(wizard.includes("intakeChoice('details.loiTemporal'"), 'LOI temporal as cards');
  assert.ok(!wizard.includes("intakeSelect('positionType'"), 'no select for position type');
  assert.ok(!wizard.includes("intakeSelect('details.relationshipState'"), 'no select for connection');
});

test('intake-choice action sets the field and re-renders without touching the save contract', () => {
  const h = actions.slice(actions.indexOf("'intake-choice'("), actions.indexOf("'intake-cal-nav'("));
  assert.ok(h.includes('requireIntakeUI()'));
  assert.ok(h.includes('intakeSet(field,value)'));
  assert.ok(h.includes('renderDrawer()'));
  const body = actions.slice(actions.indexOf('function intakeBody()'), actions.indexOf('\n', actions.indexOf('function intakeBody()')));
  assert.ok(!body.includes('calView'), 'calView never sent to the server');
  assert.ok(body.includes('identity:f.identity') && body.includes('details:f.details'), 'save body unchanged');
});

test('V2 CSS: choice cards are large, tappable and state-visible', () => {
  assert.ok(v2css.includes('.choiceCard{display:flex;flex-direction:column;align-items:flex-start;gap:8px;min-height:84px'), 'min height 84px');
  assert.ok(v2css.includes('.choiceCard.on{border-color:var(--accent)'), 'selected state');
  assert.ok(v2css.includes('.choiceCard:focus-visible{outline:2px solid var(--cy)'), 'keyboard focus ring');
  assert.ok(v2css.includes('.choiceCard .choiceText b{display:block;font-size:16px;font-weight:800;color:#fff'), 'labels 16px white');
});

// ── Matrix-style progress tracker ─────────────────────────────────────────
test('progress tracker communicates completed / current / upcoming', () => {
  assert.ok(wizard.includes(`k+1<s?'class="done"':k+1>s?'class="upcoming"':''`), 'done + upcoming classes');
  assert.ok(wizard.includes(`aria-current="step"`), 'current step exposed');
  assert.ok(wizard.includes(`<span class="srOnly">${'${'}k+1<s?'Completed':k+1===s?'Current step':'Upcoming'}</span>`), 'state text for screen readers');
  assert.ok(wizard.includes('class="wizStage"'), 'readable current stage line');
  assert.ok(v2css.includes('.intakeProgress li::before{width:40px;height:40px;font-size:15px'), 'nodes 40px');
  assert.ok(v2css.includes('.intakeProgress li{font-size:11.5px'), 'labels ≥11.5px');
  assert.ok(v2css.includes('.intakeProgress li.upcoming{opacity:.78}'), 'upcoming visibly distinct');
  assert.ok(v2css.includes('.intakeProgress li.done .stepLabel{color:var(--gn)}'), 'done visibly distinct');
  assert.ok(/@media\(max-width:600px\)\{[\s\S]*\.intakeProgress li::before\{width:30px;height:30px/.test(v2css), 'mobile tracker');
});

// ── Program finder ────────────────────────────────────────────────────────
test('program finder searches by name, institution or canonical ID and renders large cards', () => {
  assert.ok(wizard.includes('placeholder="Program name, hospital or program ID"'), 'search placeholder covers name/institution/ID');
  assert.ok(wizard.includes('Supported IDs: native RISE ID or the 10-digit ACGME ID'), 'ID guidance');
  assert.ok(wizard.includes('class="finder"'), 'prominent finder');
  assert.ok(wizard.includes('aria-label="Filter by specialty"'), 'specialty filter retained');
  assert.ok(wizard.includes('class="programCards"') && wizard.includes('programCard(p,{selected:f.program?.id===p.id,ambiguous:'), 'cards with ambiguity flag');
  const card = fn(views, 'programCard');
  for (const s of ['pcName', 'pcChip', 'pcWhere', 'pcMeta', 'pcIds', 'RISE ID', 'ACGME ID', 'pcWarn', 'data-act="intake-select"', 'aria-pressed']) assert.ok(card.includes(s), `programCard has ${s}`);
  assert.ok(card.includes("typeof p.institution==='string'") && card.includes('p.city,p.state'), 'institution + city/state shown only when present');
  assert.ok(card.includes('Several results share this name'), 'ambiguous matches are flagged');
});

test('ambiguous or chosen program still requires explicit confirmation', () => {
  assert.ok(wizard.includes("intakeCheck('identity.confirmed','Yes — this is the exact program and track that invited me.')"), 'explicit confirmation');
  assert.ok(wizard.includes("intakeCheck('identity.provisionalConfirmed'"), 'unresolved path retained');
  assert.ok(wizard.includes("btn('intake-unresolved','Not this one — keep unresolved'"), 'un-choose path');
});

test('Enter in the search box triggers the RISE search', () => {
  assert.ok(actions.includes("ev.key==='Enter'&&ev.target?.id==='in-searchText'"), 'Enter key handler on search input');
  assert.ok(actions.includes("A['intake-search']()"), 'dispatches the existing bounded search');
});

test('V2 CSS: program cards are large and readable', () => {
  assert.ok(v2css.includes('.programCard .pcName{font-size:19px;font-weight:800'), 'name 19px');
  assert.ok(v2css.includes('.programCard .pcWhere{font-size:15.5px;color:var(--tx)}'), 'institution/location readable');
  assert.ok(v2css.includes('.pcIds{display:flex;flex-wrap:wrap;gap:8px 18px;font-family:var(--num);font-size:15px'), 'IDs readable');
  assert.ok(v2css.includes('.finder input{flex:1;min-width:0;font-size:18px'), 'search input 18px');
});

// ── Date pickers ──────────────────────────────────────────────────────────
test('visual calendar pickers cover interview, invite-received, deadline and event dates', () => {
  assert.ok(wizard.includes("intakeSchedule('schedule',{dateLabel:'Which day is the interview?'})"), 'interview date');
  assert.ok(wizard.includes("intakeDatePicker('deadline','Do you need to reply by a date?'"), 'deadline');
  assert.ok(wizard.includes("intakeDatePicker('details.invitationReceivedDate','When did the invite hit your inbox?'"), 'invite received');
  assert.ok(wizard.includes('intakeSchedule(`events.${k}.schedule`'), 'related event dates');
  const picker = fn(views, 'intakeDatePicker');
  assert.ok(picker.includes('todayKey()') && picker.includes("class=\"calPickDay${on?' on':''}${key===today?' today':''}\""), 'today + selected states');
  assert.ok(picker.includes('aria-label="${esc(fmtDateOnly(key))}"'), 'each day has an accessible label');
  assert.ok(picker.includes('<details class="calPickTyped"><summary>Type the date instead</summary>'), 'keyboard entry secondary');
});

test('calendar picker actions validate input shape', () => {
  assert.ok(actions.includes("if(!field||!/^\\d{4}-\\d{2}$/.test(month))return;"), 'month nav validated');
  assert.ok(actions.includes("if(!field||!/^\\d{4}-\\d{2}-\\d{2}$/.test(date))return;"), 'date pick validated');
  assert.ok(actions.includes("'intake-cal-clear'(el)") && actions.includes('intakeSet(field,null)'), 'clear sets null (unknown)');
  assert.ok(actions.includes('calView:{}'), 'freshIntake carries picker view state');
});

test('V2 CSS: picker days are ≥40px targets', () => {
  assert.ok(v2css.includes('.calPickDay{min-height:40px'), 'day target');
  assert.ok(v2css.includes('.calPickNav{width:40px;height:40px'), 'nav target');
  assert.ok(v2css.includes('.calPickDay.on{background:linear-gradient(135deg,var(--accent),var(--accent2))'), 'selected day styled');
});

// ── Application status removed ────────────────────────────────────────────
test('wizard never asks APPLIED / NOT APPLIED as a primary step', () => {
  assert.ok(!wizard.includes("'details.applicationState'"), 'no applicationState control in the wizard');
  assert.ok(!/APPLIED \/ NOT APPLIED|Application status/i.test(wizard), 'no application-status copy');
  // Underlying semantics preserved for the Advanced → prelim bridge.
  assert.ok(views.includes("i.intake?.details.applicationState==='APPLIED'"), 'prelim bridge still reads applicationState');
});

// ── Friendly language ─────────────────────────────────────────────────────
test('sterile labels are rewritten as student-facing questions without losing precision', () => {
  assert.ok(wizard.includes('When did the invite hit your inbox?'), 'invite received question');
  assert.ok(wizard.includes('Have you <em>been here before?</em>'), 'prior relationship question');
  assert.ok(wizard.includes('Rotation, research, observership, work, volunteering or another experience'), 'explanatory line');
  assert.ok(wizard.includes('Which program <em>invited you?</em>'), 'program question');
  assert.ok(wizard.includes('When is the <em>big day?</em>'), 'interview question');
  assert.ok(wizard.includes('Did you reach out <em>first?</em>'), 'outreach question');
  assert.ok(wizard.includes('Outreach and signals'), 'precise kicker retained');
  assert.ok(wizard.includes('Did you signal this program?'), 'signal question precise');
  assert.ok(wizard.includes('Did this interview arrive after a Letter of Interest?'), 'LOI temporal precise');
});

// ── Needed vs helpful; fast entry ─────────────────────────────────────────
test('wizard distinguishes NEEDED TO SAVE from HELPS IV IQ PREPARE YOU BETTER and allows skipping', () => {
  assert.ok(wizard.includes(`s===1?'Needed to save':s===7?'Review and save':'Helps IV IQ prepare you better'`), 'need/help pill per step');
  assert.ok(wizard.includes("btn('intake-skip','Skip for now'"), 'Skip for now');
  assert.ok(wizard.includes(`"I don't know yet"`), "I don't know yet options");
  assert.ok(wizard.includes("'Quick save basics'"), 'quick save from any step');
  assert.ok(wizard.includes("const canQuickSave=!!(f.identity.invitationLabel||'').trim();"), 'quick save needs only the invitation name');
  assert.ok(wizard.includes('readinessMeter(f)'), 'readiness indicator after save and at review');
  const r = fn(views, 'intakeReadiness');
  assert.ok(r.includes("'Program identity'") && r.includes("'Invite received date'") && r.includes("'Signal / outreach'"), 'readiness items');
});

// ── Photographic experience + RISE seam ───────────────────────────────────
test('hero imagery is only ever an approved, canonical-program-matched exterior with an honest fallback', () => {
  const hero = fn(views, 'programHero');
  assert.ok(hero.includes("m.approvalState==='APPROVED'") && hero.includes("m.category==='INSTITUTION_EXTERIOR'") && hero.includes('m.programId===programId'), 'strict eligibility');
  assert.ok(hero.includes('/^https:\\/\\//.test(m.url)'), 'https only');
  const media = fn(views, 'heroMedia');
  assert.ok(media.includes('loading="lazy"') && media.includes('decoding="async"') && media.includes('width="1200" height="514"'), 'lazy, async, sized (no layout shift)');
  assert.ok(media.includes('class="heroMedia heroFallback'), 'MissionMed fallback');
  assert.ok(media.includes('Verified hospital imagery arrives once approved for this program.'), 'fallback is truthful');
  assert.ok(v2css.includes('.heroMedia{position:relative;display:block;width:100%;aspect-ratio:21/9'), 'fixed aspect ratio');
});

test('server program-media contract exists and does not wire RISE', () => {
  const pm = readFileSync(new URL('../../server/program-media.mjs', import.meta.url), 'utf8');
  for (const k of ['sourceUrl', 'publisher', 'assetRef', 'programId', 'category', 'caption', 'alt', 'verifiedAt', 'identityConfidence', 'licenseState', 'approvalState']) assert.ok(pm.includes(k), `contract preserves ${k}`);
  assert.ok(pm.includes('NOT_WIRED'), 'promotion is a documented protected owner action');
  assert.ok(!/fetch\(|rise-owner|owner-services/.test(pm), 'no RISE calls');
});

// ── Celebration, visibility and next actions ──────────────────────────────
test('success celebrates with finite confetti, large congratulations, hero, reduced-motion and skip', () => {
  const step8 = wizard.slice(wizard.indexOf('if(s===8)'), wizard.indexOf('if(s===1)'));
  assert.ok(step8.includes("f.saveResult?.edited?'':confettiHTML()"), 'confetti only for a new interview');
  assert.ok(step8.includes('<em>Congratulations!</em> You earned this interview.'), 'large congratulations');
  assert.ok(step8.includes('heroMedia(i?.program||f.identity.programId,name)'), 'program/hospital hero where available');
  assert.ok(step8.includes('class="btn ghost sm skipCelebrate" data-act="intake-done"'), 'skip/dismiss');
  const conf = fn(views, 'confettiHTML');
  assert.ok(conf.includes('class="confetti" aria-hidden="true"') && conf.includes('balloon'), 'confetti + balloons, hidden from AT');
  assert.ok(v2css.includes('animation:confettiFall 2.8s') && v2css.includes('animation:balloonRise 3.4s'), 'finite animation');
  assert.ok(!/confettiFall[^;]*infinite|balloonRise[^;]*infinite/.test(v2css), 'never infinite');
  assert.ok(v2css.includes('@media(prefers-reduced-motion:reduce){.confetti{display:none}'), 'reduced-motion support');
  assert.ok(v2css.includes('.intakeSuccess h2{font-size:40px;color:#fff'), 'success heading 40px white');
});

test('Dr Brian visibility copy is truthful: no fabricated notification delivery', () => {
  const step8 = wizard.slice(wizard.indexOf('if(s===8)'), wizard.indexOf('if(s===1)'));
  assert.ok(!/HAS BEEN NOTIFIED|has been notified/.test(step8), 'no notification-delivery claim');
  assert.ok(step8.includes('Your interview is now visible to Dr Brian and your authorized MissionMed team.'), 'truthful visibility sentence');
  assert.ok(step8.includes("coreOnly()?'Saved privately to your MissionMed workspace.'"), 'core mode stays private-only');
});

test('next-action cards reflect feature readiness', () => {
  const s = fn(views, 'intakeSuccessActions');
  for (const label of ['Deep research my program', 'Help research this program', 'Build my timeline', 'Start my Why This Program', 'Prepare for my interview', 'Not now', 'Add another interview']) assert.ok(s.includes(label), `card: ${label}`);
  assert.ok(s.includes("data-act=\"coming-soon\" data-label=\"${esc(label)} · BEING CONNECTED\""), 'coming soon for paths that cannot execute');
  assert.ok(s.includes("deepResearch()&&resolved?go('brief'"), 'research card gated on capability + resolved program');
  assert.ok(s.includes("(capabilities.contributions===true)?"), 'help-research gated on contributions capability');
  assert.ok(s.includes("go('timeline','Build my timeline','📊','Timeline',false)"), 'timeline coming soon (not executable)');
  const h = actions.slice(actions.indexOf("'intake-go'("), actions.indexOf('\n', actions.indexOf("'intake-go'(")));
  assert.ok(h.includes('clearIntakeMemory()') && h.includes('closeDrawer()') && h.includes("if(route){go(route);return;}") && h.includes('S.ui.section=section'), 'intake-go navigates after save');
});

// ── Interview cards ───────────────────────────────────────────────────────
test('interview cards carry hero, specialty, date/time, invite received, format, position/track, readiness and next action', () => {
  const card = fn(shell, 'interviewCard');
  for (const s of ['programHero(i.program)', 'class="ivHero"', 'dateBlock(i)', 'ivChips(i)', 'metaLine(i)', 'inviteReceived(i)', 'pulseSVG(i)', 'nm.label', 'researchCta(i)', 'data-act="open-interview"']) assert.ok(card.includes(s), `card has ${s}`);
  const chips = fn(shell, 'ivChips');
  assert.ok(chips.includes('it?.specialty') && chips.includes('it?.positionType') && chips.includes('i.track') && chips.includes('i.format'), 'chips: specialty, position, track, format');
  assert.ok(fn(shell, 'inviteReceived').includes('invitationReceivedDate'), 'invite received date surfaced');
  assert.ok(fn(shell, 'interviewRow').includes('interviewCard(i)'), 'legacy interviewRow delegates to the card');
});

// ── Research CTAs ─────────────────────────────────────────────────────────
test('research CTAs are first-class, state-aware and never start a paid run', () => {
  const r = fn(shell, 'researchCta');
  assert.ok(r.includes('Deep research this program') && r.includes('Program intelligence ready') && r.includes('Refresh research') && r.includes('Researching your program…'), 'state-aware labels');
  assert.ok(r.includes("['queued','researching'].includes(st)") && r.includes("st==='available'"), 'driven by demand status');
  assert.ok(r.includes('data-act="research-refresh"'), 'refresh uses the existing saved-request check');
  assert.ok(!r.includes('research.request') && !r.includes('mission.create'), 'card never dispatches a paid run');
  assert.ok(r.includes('Confirm program for research'), 'unresolved program routes to identity first');
  const h = fn(shell, 'helpResearchCta');
  assert.ok(h.includes('Help research this program') && h.includes('data-to="contribute"') && h.includes("capabilities.contributions===true"), 'crowdsourced CTA adjacent, capability-gated');
  const room = shell.slice(shell.indexOf('function renderRoom('), shell.indexOf('/* ---------------- PREPARE'));
  assert.ok(room.includes('roomQuickActions(i,secs)'), 'workspace exposes research CTAs');
  assert.ok(fn(shell, 'renderInterviews').includes('interviewRow') || fn(shell, 'renderInterviews').includes('interviewCard'), 'list uses the cards');
});

// ── Journey navigation + permanent next actions ───────────────────────────
test('interview workspace uses grouped journey stage cards with completion state', () => {
  const j = fn(shell, 'journeyNav');
  assert.ok(j.includes('class="sections journey" role="tablist" aria-label="Sections of this interview"'), 'tablist contract kept');
  assert.ok(j.includes("role=\"tab\"") && j.includes('aria-selected="${sec===k}"') && j.includes('data-act="section"'), 'tab buttons dispatch section');
  assert.ok(j.includes("state=sec===k?'current':done?'done':'upcoming'"), 'current/done/upcoming');
  assert.ok(j.includes("sec===k?'You are here':done?'Done':soon?'Coming soon':'Open'"), 'readable state label');
  assert.ok(shell.includes("const JOURNEY_GROUPS=[['Know the program',['identify','brief','why']],['Get ready',['rehearse','day']],['Afterwards',['debrief','learned']],['Logistics & outreach',['schedule','loi']]];"), 'grouping');
  assert.ok(v2css.includes('.sections.journey .stageText b{display:block;font-size:15.5px;font-weight:800;color:#fff'), 'stage labels 15.5px white');
  assert.ok(v2css.includes('.sections.journey button.stage{display:flex;align-items:center;gap:12px;text-align:left;min-height:62px'), 'stage cards ≥62px');
});

test('workspace permanently surfaces Research, Crowdsourced Research, LOI, Why, Timeline, Preparation, Itinerary, Debrief', () => {
  const q = fn(shell, 'roomQuickActions');
  for (const s of ["researchCta(i,'quick')", "helpResearchCta(i,'quick')", "'Letter of Interest'", "'Why This Program'", "soon('Timeline'", "'Preparation'", "'Itinerary'", "'Debrief'"]) assert.ok(q.includes(s), `quick action ${s}`);
  assert.ok(q.includes('Available after the interview'), 'debrief disabled before the interview with a reason');
  assert.ok(q.includes("calendarV2()&&own?q('Itinerary','📄',`data-act=\"itinerary-open\""), 'itinerary when authorized');
  assert.ok(q.includes('data-act="coming-soon"'), 'coming soon where not executable');
});

// ── Calendar information (safe fields only) ───────────────────────────────
test('calendar item drawer shows specialty, canonical program, invite received, format, position/track without private leaks', () => {
  const item = shell.slice(shell.indexOf("d.kind==='item'"), shell.indexOf("d.kind==='add'"));
  assert.ok(item.includes("chip(esc(spec),'spec')") && item.includes("chip(esc(pos),'pos')") && item.includes("chip(esc(i.format),'fmt')"), 'specialty/position/format chips');
  assert.ok(item.includes('Canonical RISE ID'), 'canonical program id');
  assert.ok(item.includes("own&&invDate?`<dt>Invite received</dt>"), 'invite received only for the owner');
  assert.ok(item.includes("(mentor||roleName()==='admin')&&!own?`<dt>Student</dt>"), 'student identity only for mentor/admin scope');
  assert.ok(!item.includes('privateNotes') && !item.includes('coordinatorContact') && !item.includes('signalState'), 'no private fields in calendar presentation');
  assert.ok(item.includes("i.joining?`<dt>Joining details</dt>"), 'joining details remain in the existing owner-scoped block');
});

// ── Mobile ────────────────────────────────────────────────────────────────
test('V2 layer keeps the wizard usable on phones', () => {
  const mobile = v2css.slice(v2css.indexOf('@media(max-width:600px){\n'));
  assert.ok(mobile.includes('.choiceCards,.choiceCards.cols-3,.choiceCards.cols-4,.choiceCards.cols-5{grid-template-columns:repeat(2,minmax(0,1fr))}'), 'two-column choice cards');
  assert.ok(mobile.includes('.finder{flex-direction:column}'), 'finder stacks');
  assert.ok(mobile.includes('.sections.journey{grid-template-columns:minmax(0,1fr)'), 'journey stacks');
  assert.ok(mobile.includes('.intakeWizard .mcv2-drawer-actions .btn{min-height:46px}'), '46px touch targets');
});
