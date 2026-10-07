import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// ── V2 Intake Wizard UI contract tests ────────────────────────────────────
// These verify the V2 UX steer is applied to the source files:
// 1. Application Status question removed from Step 5
// 2. Matrix-style progress tracker (not plain numbered list)
// 3. Celebratory success state with animation
// 4. Correct INTAKE_STEPS labels
// 5. Typography and color token upgrades

const fullViewsSrc = readFileSync(new URL('../../public/source/views.js', import.meta.url), 'utf8');
const actionsSrc = readFileSync(new URL('../../public/source/actions.js', import.meta.url), 'utf8');
const cssSrc = readFileSync(new URL('../../public/styles.css', import.meta.url), 'utf8');

// Extract the renderIntakeWizard function body for targeted assertions.
// This avoids matching the myerasWizard which also uses if(s===5).
const intakeStart = fullViewsSrc.indexOf('function renderIntakeWizard()');
const intakeEnd = fullViewsSrc.indexOf('\nfunction ', intakeStart + 1);
const viewsSrc = fullViewsSrc.slice(intakeStart, intakeEnd > -1 ? intakeEnd : undefined);

// ── Step 5: Application Status removed ─────────────────────────────────────
test('Step 5 does not render applicationState select', () => {
  // The old Step 5 had: intakeSelect('details.applicationState', ...)
  // V2 removes that question entirely.
  const step5Start = viewsSrc.indexOf('if(s===5)');
  const step5End = viewsSrc.indexOf('if(s===6)');
  assert.ok(step5Start > -1, 'Step 5 body template exists');
  assert.ok(step5End > step5Start, 'Step 6 follows');
  const step5Body = viewsSrc.slice(step5Start, step5End);
  assert.ok(!step5Body.includes('applicationState'), 'applicationState select removed from Step 5');
  assert.ok(!step5Body.includes('Application status'), 'Application status label removed from Step 5');
});

test('Step 5 retains signalState and loiTemporal questions', () => {
  // Extract the Step 5 block between if(s===5) and the next if(s===6)
  const step5Start = viewsSrc.indexOf('if(s===5)');
  const step5End = viewsSrc.indexOf('if(s===6)');
  assert.ok(step5Start > -1, 'Step 5 block found');
  assert.ok(step5End > step5Start, 'Step 6 follows Step 5');
  const step5Body = viewsSrc.slice(step5Start, step5End);
  assert.ok(step5Body.includes('signalState'), 'signalState retained in Step 5');
  assert.ok(step5Body.includes('loiTemporal'), 'loiTemporal retained in Step 5');
  assert.ok(step5Body.includes('matchCycle'), 'matchCycle retained in Step 5');
});

test('Step 5 heading is "Outreach and signals"', () => {
  const step5Start = viewsSrc.indexOf('if(s===5)');
  const step5End = viewsSrc.indexOf('if(s===6)');
  const step5Body = viewsSrc.slice(step5Start, step5End);
  assert.ok(step5Body.includes('Outreach and signals'), 'Step 5 has updated heading');
});

// ── INTAKE_STEPS labels ───────────────────────────────────────────────────
test('INTAKE_STEPS uses V2 labels without APPLICATION', () => {
  const stepsMatch = actionsSrc.match(/const INTAKE_STEPS=\[([^\]]+)\]/);
  assert.ok(stepsMatch, 'INTAKE_STEPS declaration found');
  const steps = stepsMatch[1];
  assert.ok(!steps.includes("'APPLICATION'"), 'APPLICATION label removed');
  assert.ok(steps.includes("'OUTREACH'"), 'OUTREACH label present');
  assert.ok(steps.includes("'CONNECTION'"), 'CONNECTION label present');
  assert.ok(steps.includes("'PROGRAM'"), 'PROGRAM label present');
  assert.ok(steps.includes("'REVIEW'"), 'REVIEW label present');
});

// ── Matrix-style progress tracker ──────────────────────────────────────────
test('Progress tracker uses matrix-style step nodes with done class', () => {
  // V2 adds class="done" to completed steps and uses <span class="stepLabel">
  assert.ok(viewsSrc.includes('class="done"'), 'Done class applied to completed steps');
  assert.ok(viewsSrc.includes('class="stepLabel"'), 'stepLabel span used for labels');
  // Old numbered format removed: no more `${k+1}. ${esc(label)}`
  const intakeProgressPattern = /intakeProgress.*?\$\{INTAKE_STEPS\.map/;
  const progressMatch = viewsSrc.match(intakeProgressPattern);
  assert.ok(progressMatch, 'Progress tracker renders INTAKE_STEPS');
});

test('CSS has matrix-style progress tracker with node circles', () => {
  assert.ok(cssSrc.includes('.intakeProgress li::before'), 'Progress nodes have circle pseudo-elements');
  assert.ok(cssSrc.includes('border-radius:50%'), 'Progress nodes are circular');
  assert.ok(cssSrc.includes('.intakeProgress li.done'), 'Done state styled');
  assert.ok(cssSrc.includes('.intakeProgress li[aria-current=step]::before'), 'Current step has distinct style');
});

// ── Celebratory success state ──────────────────────────────────────────────
// V2 renovation moved the action cards into intakeSuccessActions(); check both.
const successStart = fullViewsSrc.indexOf('function intakeSuccessActions(');
const successEnd = fullViewsSrc.indexOf('\nfunction ', successStart + 1);
const successSrc = fullViewsSrc.slice(successStart, successEnd);
test('Step 8 success uses celebration animation', () => {
  assert.ok(viewsSrc.includes('intakeSuccess'), 'intakeSuccess class applied to Step 8');
  assert.ok(viewsSrc.includes('successIcon'), 'Success icon rendered');
  assert.ok(viewsSrc.includes('confettiHTML()'), 'Confetti rendered on new-interview success');
  assert.ok(successSrc.includes('nextActions'), 'Next actions container rendered');
  assert.ok(successSrc.includes('nextAction'), 'Individual next action buttons rendered');
});

test('Step 8 has large next-action cards instead of row buttons', () => {
  // Old: <div class="row">${btn('intake-done',...)}${btn('intake-new',...)}
  // New: <div class="nextActions"><button class="nextAction" data-act="intake-done">...
  assert.ok(viewsSrc.includes('intakeSuccessActions(f,i)'), 'Step 8 renders the large action cards');
  assert.ok(successSrc.includes('nextActions'), 'Uses nextActions layout');
  assert.ok(successSrc.includes('data-act="intake-done"'), 'Open interview action wired');
  assert.ok(successSrc.includes('data-act="intake-new"'), 'Add another action wired');
  assert.ok(successSrc.includes('actionIcon'), 'Action icons present');
  assert.ok(successSrc.includes('actionLabel'), 'Action labels present');
});

test('CSS has celebration keyframes', () => {
  assert.ok(cssSrc.includes('@keyframes intakeCelebrate'), 'Celebrate animation defined');
  assert.ok(cssSrc.includes('@keyframes intakeGlow'), 'Glow animation defined');
  assert.ok(cssSrc.includes('.intakeSuccess'), 'Success class styled');
  assert.ok(cssSrc.includes('.intakeSuccess h2'), 'Success heading styled');
  assert.ok(cssSrc.includes('.intakeSuccess .successIcon'), 'Success icon styled');
});

test('Next action cards have hover interaction styles', () => {
  assert.ok(cssSrc.includes('.intakeSuccess .nextAction:hover'), 'Next action hover state defined');
  assert.ok(cssSrc.includes('.intakeSuccess .nextAction .actionIcon'), 'Action icon styling defined');
});

// ── Typography and color upgrades ──────────────────────────────────────────
test('Body font-size upgraded from 15px to 16px', () => {
  assert.ok(cssSrc.includes('font-size:16px'), 'Body font-size is 16px');
  assert.ok(!cssSrc.match(/body\{[^}]*font-size:15px/), 'Old 15px body font-size removed');
});

test('Primary text color is whiter', () => {
  // V2: --tx:#f2f5fc (was #e9eefb)
  assert.ok(cssSrc.includes('--tx:#f2f5fc'), 'Primary text color updated to whiter value');
});

test('Wizard headings use large italic style', () => {
  assert.ok(cssSrc.includes('.intakeWizard h2'), 'Wizard h2 has custom style');
  assert.ok(cssSrc.includes('font-size:28px'), 'Wizard h2 is 28px');
});

test('Dim and mid colors are subtly brighter', () => {
  assert.ok(cssSrc.includes('--dim:#8e9bb6'), 'Dim color updated');
  assert.ok(cssSrc.includes('--mid:#b5c3db'), 'Mid color updated');
});

// ── Responsive mobile styles preserved ─────────────────────────────────────
test('Mobile responsive styles preserved for intake wizard', () => {
  assert.ok(cssSrc.includes('@media(max-width:600px){.mcv2-drawer.intakeModal'), 'Mobile breakpoint for intake modal');
  assert.ok(cssSrc.includes('.intakeGrid{grid-template-columns:minmax(0,1fr)'), 'Mobile grid collapses to single column');
});

// ── Data-act wiring ────────────────────────────────────────────────────────
test('Step 8 buttons use data-act for delegation', () => {
  // Verify buttons use data-act (not data-action) for the click dispatcher
  assert.ok(!successSrc.includes('data-action='), 'No data-action attributes (would not dispatch)');
  assert.ok(successSrc.includes('data-act='), 'Uses data-act for click delegation');
});
