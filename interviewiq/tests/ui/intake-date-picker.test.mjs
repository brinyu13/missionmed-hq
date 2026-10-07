import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// ── V2 Friendly Calendar/Date Picker contract tests ─────────────────────
// These verify the intake wizard date picker enhancements:
// 1. Date+time pair grouped in a datePair wrapper
// 2. Calendar icon element (dateIcon)
// 3. Separate dateField/timeField layout
// 4. Dark-mode picker indicator styling
// 5. datePair focus-within interaction
// 6. Mobile responsive adjustments

const viewsSrc = readFileSync(new URL('../../public/source/views.js', import.meta.url), 'utf8');
const cssSrc = readFileSync(new URL('../../public/styles.css', import.meta.url), 'utf8');

// Extract intakeSchedule function body.
const schedStart = viewsSrc.indexOf('function intakeSchedule(');
const schedEnd = viewsSrc.indexOf('\nfunction ', schedStart + 1);
const schedSrc = viewsSrc.slice(schedStart, schedEnd > -1 ? schedEnd : schedStart + 2000);

// ── Views: datePair structure ───────────────────────────────────────────
test('intakeSchedule wraps date+time in datePair container', () => {
  assert.ok(schedSrc.includes('class="datePair"'), 'datePair wrapper exists');
});

test('intakeSchedule has calendar icon', () => {
  assert.ok(schedSrc.includes('class="dateIcon"'), 'dateIcon element exists');
  assert.ok(schedSrc.includes('aria-hidden="true"'), 'Icon is decorative');
});

test('intakeSchedule separates date and time fields', () => {
  assert.ok(schedSrc.includes('class="dateField"'), 'dateField wrapper exists');
  assert.ok(schedSrc.includes('class="timeField"'), 'timeField wrapper exists');
});

test('V2: date uses the visual calendar picker; time still uses intakeInput', () => {
  assert.ok(schedSrc.includes("intakeDatePicker(path+'.date'"), 'Date uses visual intakeDatePicker');
  assert.ok(schedSrc.includes("intakeInput(path+'.time'"), 'Time uses intakeInput');
  // Typed entry remains available as a secondary control inside the picker.
  const pickStart = viewsSrc.indexOf('function intakeDatePicker(');
  const pickEnd = viewsSrc.indexOf('\nfunction ', pickStart + 1);
  const pickSrc = viewsSrc.slice(pickStart, pickEnd);
  assert.ok(pickSrc.includes("intakeInput(path,'Date (YYYY-MM-DD)','date')"), 'Typed date entry retained as secondary');
  assert.ok(pickSrc.includes('data-act="intake-cal-pick"'), 'Day cells dispatch intake-cal-pick');
  assert.ok(pickSrc.includes('data-act="intake-cal-nav"'), 'Month navigation dispatches intake-cal-nav');
  assert.ok(pickSrc.includes('data-act="intake-cal-clear"'), 'Unknown/clear dispatches intake-cal-clear');
  assert.ok(pickSrc.includes('role="grid"'), 'Picker grid has ARIA role');
});

test('V2: format is a choice-card question; duration/zone/fold stay in the secondary grid', () => {
  assert.ok(schedSrc.includes("intakeInput(path+'.duration'"), 'Duration in grid');
  assert.ok(schedSrc.includes("intakeSelect(path+'.zone'"), 'Zone in grid');
  assert.ok(schedSrc.includes("intakeChoice(path+'.format'"), 'Format uses large choice cards');
  assert.ok(schedSrc.includes("intakeSelect(path+'.fold'"), 'Fold in grid');
  assert.ok(schedSrc.includes('class="moreDetails"'), 'Secondary fields are progressively disclosed');
});

// ── CSS: datePair styling ───────────────────────────────────────────────
test('datePair has flex layout with border and background', () => {
  const pairMatch = cssSrc.match(/\.datePair\{[^}]+\}/);
  assert.ok(pairMatch, 'datePair rule found');
  assert.ok(pairMatch[0].includes('display:flex'), 'Uses flex layout');
  assert.ok(pairMatch[0].includes('border:1px solid var(--edge)'), 'Has border');
  assert.ok(pairMatch[0].includes('border-radius:14px'), 'Has rounded corners');
  assert.ok(pairMatch[0].includes('transition:'), 'Has transition');
});

test('datePair has focus-within interaction', () => {
  assert.ok(cssSrc.includes('.datePair:focus-within'), 'focus-within rule exists');
  assert.ok(cssSrc.includes('.datePair:focus-within{border-color:var(--accent)'), 'Focus shows accent border');
});

test('dateIcon has styled container', () => {
  const iconMatch = cssSrc.match(/\.dateIcon\{[^}]+\}/);
  assert.ok(iconMatch, 'dateIcon rule found');
  assert.ok(iconMatch[0].includes('border-radius:'), 'Icon has rounded shape');
  assert.ok(iconMatch[0].includes('background:'), 'Icon has background');
  assert.ok(iconMatch[0].includes('accentGlow'), 'Icon uses accent glow');
});

test('dateField and timeField have flex proportions', () => {
  assert.ok(cssSrc.includes('.dateField{flex:2'), 'dateField takes more space');
  assert.ok(cssSrc.includes('.timeField{flex:1'), 'timeField takes less space');
});

test('Date/time inputs in datePair have monospace font', () => {
  assert.ok(cssSrc.includes('.datePair input[type=date]'), 'Date input in pair styled');
  assert.ok(cssSrc.includes('.datePair input[type=time]'), 'Time input in pair styled');
  assert.ok(cssSrc.includes('font-family:var(--num)'), 'Uses numeric font');
});

// ── Dark mode picker indicators ─────────────────────────────────────────
test('Dark mode calendar picker indicator styled', () => {
  assert.ok(cssSrc.includes('::-webkit-calendar-picker-indicator'), 'WebKit picker indicator styled');
  assert.ok(cssSrc.includes('filter:invert('), 'Picker inverted for dark mode');
});

test('Picker indicator has hover interaction', () => {
  assert.ok(cssSrc.includes('::-webkit-calendar-picker-indicator:hover'), 'Picker hover rule exists');
});

test('Date/time inputs use dark color scheme', () => {
  assert.ok(cssSrc.includes('color-scheme:dark'), 'Dark color scheme applied');
});

// ── Mobile responsive ───────────────────────────────────────────────────
test('Mobile datePair stacks vertically', () => {
  assert.ok(cssSrc.includes('.datePair{flex-direction:column'), 'datePair stacks on mobile');
});

test('Mobile dateIcon shrinks', () => {
  assert.ok(cssSrc.includes('.dateIcon{width:34px'), 'Icon shrinks on mobile');
});
