import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// ── Advanced → Prelim/TY LOI bridge contract tests ───────────────────
// Verify the client-side intake wizard bridge that connects Advanced
// interviews to their Preliminary/Transitional Year letter targets:
// 1. intakePrelimTargets function filters LOI targets correctly
// 2. Step 2 renders prelim/TY panel for ADVANCED position type
// 3. intake-prelim-letter action handler validates the bridge
// 4. freshIntake includes positionType in initial state
// 5. intakeBody sends positionType in save payload

const viewsSrc = readFileSync(new URL('../../public/source/views.js', import.meta.url), 'utf8');
const actionsSrc = readFileSync(new URL('../../public/source/actions.js', import.meta.url), 'utf8');

// Extract intakePrelimTargets function
const prelimStart = viewsSrc.indexOf('function intakePrelimTargets()');
const prelimEnd = viewsSrc.indexOf('\n', prelimStart);
const prelimSrc = viewsSrc.slice(prelimStart, prelimEnd);

// Extract intake-prelim-letter handler
const handlerStart = actionsSrc.indexOf("'intake-prelim-letter'");
const handlerEnd = actionsSrc.indexOf('\n', handlerStart);
const handlerSrc = actionsSrc.slice(handlerStart, handlerEnd);

// Extract Step 2 rendering (within renderIntakeWizard scope to avoid other if(s===2) matches)
const wizStart = viewsSrc.indexOf('function renderIntakeWizard()');
const wizEnd = viewsSrc.indexOf('\nfunction ', wizStart + 1);
const wizSrc = viewsSrc.slice(wizStart, wizEnd > -1 ? wizEnd : undefined);
const step2Idx = wizSrc.indexOf('if(s===2)');
const step3Idx = wizSrc.indexOf('if(s===3)');
const step2Src = wizSrc.slice(step2Idx, step3Idx > -1 ? step3Idx : step2Idx + 3000);

// ── intakePrelimTargets function ───────────────────────────────────────
test('intakePrelimTargets filters by CREATE_LETTER choice', () => {
  assert.ok(prelimSrc.includes("choice==='CREATE_LETTER'"), 'Filters targets with CREATE_LETTER choice');
});

test('intakePrelimTargets requires program on target', () => {
  assert.ok(prelimSrc.includes('t.program'), 'Requires program to be set');
});

test('intakePrelimTargets checks for PRELIMINARY position type', () => {
  assert.ok(prelimSrc.includes("'PRELIMINARY'"), 'Checks PRELIMINARY position type');
});

test('intakePrelimTargets checks for TRANSITIONAL_YEAR position type', () => {
  assert.ok(prelimSrc.includes("'TRANSITIONAL_YEAR'"), 'Checks TRANSITIONAL_YEAR position type');
});

test('intakePrelimTargets verifies APPLIED application state', () => {
  assert.ok(prelimSrc.includes("applicationState==='APPLIED'"), 'Requires APPLIED application state');
});

test('intakePrelimTargets matches on program ID', () => {
  assert.ok(prelimSrc.includes('i.program===t.program.id'), 'Cross-references interview program with target program');
});

test('intakePrelimTargets checks actor ownership', () => {
  assert.ok(prelimSrc.includes('i.owner===actor.id'), 'Verifies interview ownership');
});

// ── Step 2 Advanced → PGY-1 panel ──────────────────────────────────────
test('Step 2 renders PGY-1 panel for ADVANCED position type', () => {
  assert.ok(step2Src.includes("f.positionType==='ADVANCED'"), 'Conditional on ADVANCED positionType');
  assert.ok(step2Src.includes('qualifying PGY-1 year'), 'Panel mentions PGY-1');
});

test('Step 2 asks about preliminary/TY applications', () => {
  assert.ok(step2Src.includes("details.pgy1Applied"), 'pgy1Applied field rendered');
  assert.ok(step2Src.includes("Preliminary or Transitional Year"), 'Options mention both position types');
});

test('Step 2 renders preliminary target selector when pgy1Applied is YES', () => {
  assert.ok(step2Src.includes("f.details.pgy1Applied==='YES'"), 'Conditional on YES answer');
  assert.ok(step2Src.includes('details.prelimTargetId'), 'prelimTargetId select rendered');
  assert.ok(step2Src.includes('intakePrelimTargets()'), 'Uses intakePrelimTargets for options');
});

test('Step 2 renders advancedFactConfirmed checkbox', () => {
  assert.ok(step2Src.includes('details.advancedFactConfirmed'), 'advancedFactConfirmed checkbox');
  assert.ok(step2Src.includes('Advanced interview fact'), 'Mentions Advanced interview fact');
});

test('Step 2 renders BUILD A PRELIM/TY LETTER button', () => {
  assert.ok(step2Src.includes('intake-prelim-letter'), 'Button action is intake-prelim-letter');
  assert.ok(step2Src.includes('BUILD A PRELIM/TY LETTER OF INTEREST'), 'Button label text');
});

test('Step 2 gates prelim letter button on loiTargetsEnabled', () => {
  assert.ok(step2Src.includes('loiTargetsEnabled()'), 'Checks loiTargetsEnabled before rendering');
});

// ── intake-prelim-letter action handler ────────────────────────────────
test('intake-prelim-letter requires ADVANCED position type', () => {
  assert.ok(handlerSrc.includes("f.positionType!=='ADVANCED'"), 'Validates ADVANCED positionType');
});

test('intake-prelim-letter requires pgy1Applied YES', () => {
  assert.ok(handlerSrc.includes("f.details.pgy1Applied!=='YES'"), 'Validates pgy1Applied');
});

test('intake-prelim-letter requires advancedFactConfirmed', () => {
  assert.ok(handlerSrc.includes("f.details.advancedFactConfirmed!==true"), 'Validates advancedFactConfirmed');
});

test('intake-prelim-letter reads prelimTargetId from details', () => {
  assert.ok(handlerSrc.includes('f.details.prelimTargetId'), 'Reads prelimTargetId');
});

test('intake-prelim-letter validates target via loiTargetRow', () => {
  assert.ok(handlerSrc.includes('loiTargetRow(id)'), 'Calls loiTargetRow');
});

test('intake-prelim-letter verifies CREATE_LETTER choice on target', () => {
  assert.ok(handlerSrc.includes("t.choice!=='CREATE_LETTER'"), 'Validates target choice');
});

test('intake-prelim-letter verifies program on target', () => {
  assert.ok(handlerSrc.includes('!t.program'), 'Validates target has program');
});

test('intake-prelim-letter cross-checks interview facts', () => {
  assert.ok(handlerSrc.includes("['PRELIMINARY','TRANSITIONAL_YEAR'].includes"), 'Verifies position type in interviews');
  assert.ok(handlerSrc.includes("applicationState==='APPLIED'"), 'Verifies APPLIED application state');
});

test('intake-prelim-letter closes drawer and opens target', () => {
  assert.ok(handlerSrc.includes('closeDrawer()'), 'Closes intake drawer');
  assert.ok(handlerSrc.includes("A['loitarget-open']"), 'Opens LOI target');
});

// ── freshIntake positionType ───────────────────────────────────────────
test('freshIntake initializes positionType to UNKNOWN', () => {
  const freshStart = actionsSrc.indexOf('function freshIntake(');
  const freshEnd = actionsSrc.indexOf('\nfunction ', freshStart + 1);
  const freshSrc = actionsSrc.slice(freshStart, freshEnd > -1 ? freshEnd : freshStart + 2000);
  assert.ok(freshSrc.includes("positionType:'UNKNOWN'"), 'positionType initialized to UNKNOWN');
});

// ── intakeBody sends positionType ──────────────────────────────────────
test('intakeBody includes positionType in payload', () => {
  const bodyStart = actionsSrc.indexOf('function intakeBody()');
  const bodyEnd = actionsSrc.indexOf('\n', bodyStart);
  const bodySrc = actionsSrc.slice(bodyStart, bodyEnd);
  assert.ok(bodySrc.includes('positionType:f.positionType'), 'positionType sent in body');
});

// ── intakeFieldEvent re-renders on positionType change ─────────────────
test('positionType change triggers re-render', () => {
  assert.ok(actionsSrc.includes("'positionType'"), 'positionType in re-render list');
  const fieldEventStart = actionsSrc.indexOf('function intakeFieldEvent(');
  const fieldEventEnd = actionsSrc.indexOf('\n', fieldEventStart);
  const fieldEventSrc = actionsSrc.slice(fieldEventStart, fieldEventEnd);
  assert.ok(fieldEventSrc.includes("'positionType'"), 'positionType triggers renderDrawer');
  assert.ok(fieldEventSrc.includes("'details.pgy1Applied'"), 'pgy1Applied triggers renderDrawer');
});
