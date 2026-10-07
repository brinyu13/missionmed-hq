import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// ── V2 Specialty-Filterable Program Finder contract tests ───────────────
// These verify the Step 1 specialty chip filter enhancement:
// 1. Specialty filter chips render in views.js Step 1
// 2. specFilters and specChip CSS classes exist with V2 design tokens
// 3. intake-spec-filter action handler wired in actions.js
// 4. freshIntake includes specialtyFilter in initial state
// 5. Filtered count shown in status text
// 6. Mobile responsive styles for filter chips

const viewsSrc = readFileSync(new URL('../../public/source/views.js', import.meta.url), 'utf8');
const actionsSrc = readFileSync(new URL('../../public/source/actions.js', import.meta.url), 'utf8');
const cssSrc = readFileSync(new URL('../../public/styles.css', import.meta.url), 'utf8');

// Extract renderIntakeWizard function body for targeted assertions.
const wizStart = viewsSrc.indexOf('function renderIntakeWizard()');
const wizEnd = viewsSrc.indexOf('\nfunction ', wizStart + 1);
const wizSrc = viewsSrc.slice(wizStart, wizEnd > -1 ? wizEnd : undefined);

// ── Views: specialty filter rendering ───────────────────────────────────
test('Step 1 reads specialtyFilter from intakeFlow', () => {
  assert.ok(wizSrc.includes("f.specialtyFilter||''"), 'Reads specialtyFilter with fallback');
});

test('Step 1 extracts unique specialties from matches', () => {
  assert.ok(wizSrc.includes('new Set(f.matches.map(p=>p.specialty)'), 'Extracts specialties via Set');
  assert.ok(wizSrc.includes('.filter(Boolean)'), 'Filters out falsy specialties');
  assert.ok(wizSrc.includes('.sort()'), 'Sorts specialties alphabetically');
});

test('Step 1 filters matches by specialty', () => {
  assert.ok(wizSrc.includes('specFilter?f.matches.filter(p=>p.specialty===specFilter):f.matches'), 'Filters matches when specFilter active');
});

test('Step 1 renders specFilters container with ARIA', () => {
  assert.ok(wizSrc.includes('class="specFilters"'), 'specFilters container exists');
  assert.ok(wizSrc.includes('role="group"'), 'Filter group has ARIA role');
  assert.ok(wizSrc.includes('aria-label="Filter by specialty"'), 'Filter group has ARIA label');
});

test('Step 1 renders specChip buttons with data-act', () => {
  assert.ok(wizSrc.includes('class="specChip'), 'specChip class used');
  assert.ok(wizSrc.includes('data-act="intake-spec-filter"'), 'Chips use intake-spec-filter action');
  assert.ok(wizSrc.includes('data-spec='), 'Chips carry data-spec attribute');
  assert.ok(wizSrc.includes('All specialties'), '"All specialties" reset chip exists');
});

test('Active spec chip gets active class', () => {
  assert.ok(wizSrc.includes("specFilter===sp?' active':''"), 'Active specialty chip gets active class');
  assert.ok(wizSrc.includes("!specFilter?' active':''"), 'All-specialties chip active when no filter');
});

test('Step 1 shows filtered count in status text', () => {
  assert.ok(wizSrc.includes("filtered.length"), 'Displays filtered count');
  assert.ok(wizSrc.includes("specFilter?' filtered':''"), 'Labels count as filtered');
  assert.ok(wizSrc.includes("specFilter?' of '+f.matches.length:''"), 'Shows total matches when filtering');
});

test('V2: Step 1 renders filtered matches as large program cards', () => {
  assert.ok(wizSrc.includes('filtered.map(p=>programCard('), 'Renders filtered matches via programCard()');
  assert.ok(wizSrc.includes('class="programCards"'), 'Program cards container');
  assert.ok(!wizSrc.includes('filtered.map(p=>btn('), 'No tiny dropdown-row buttons for results');
});

// ── Actions: spec filter handler ────────────────────────────────────────
test('intake-spec-filter action handler exists', () => {
  assert.ok(actionsSrc.includes("'intake-spec-filter'"), 'Action handler registered');
});

test('intake-spec-filter sets specialtyFilter and re-renders', () => {
  const handlerMatch = actionsSrc.match(/'intake-spec-filter'\(el\)\{[^}]+\}/);
  assert.ok(handlerMatch, 'Handler function found');
  assert.ok(handlerMatch[0].includes('el.dataset.spec'), 'Reads data-spec from element');
  assert.ok(handlerMatch[0].includes('intakeFlow.specialtyFilter'), 'Sets specialtyFilter on intakeFlow');
  assert.ok(handlerMatch[0].includes('renderDrawer()'), 'Re-renders drawer');
});

test('freshIntake includes specialtyFilter in initial state', () => {
  const freshStart = actionsSrc.indexOf('function freshIntake(');
  assert.ok(freshStart > -1, 'freshIntake function found');
  const freshEnd = actionsSrc.indexOf('\nfunction ', freshStart + 1);
  const freshSrc = actionsSrc.slice(freshStart, freshEnd > -1 ? freshEnd : freshStart + 2000);
  assert.ok(freshSrc.includes("specialtyFilter:''"), 'specialtyFilter initialized to empty string');
});

// ── CSS: specFilters and specChip styling ────────────────────────────────
test('specFilters has flex layout', () => {
  const filtersMatch = cssSrc.match(/\.specFilters\{[^}]+\}/);
  assert.ok(filtersMatch, 'specFilters rule found');
  assert.ok(filtersMatch[0].includes('display:flex'), 'Uses flex layout');
  assert.ok(filtersMatch[0].includes('flex-wrap:wrap'), 'Wraps chips');
  assert.ok(filtersMatch[0].includes('gap:'), 'Has gap spacing');
});

test('specChip has pill styling with transitions', () => {
  const chipMatch = cssSrc.match(/\.specChip\{[^}]+\}/);
  assert.ok(chipMatch, 'specChip rule found');
  assert.ok(chipMatch[0].includes('border-radius:20px'), 'Pill shape radius');
  assert.ok(chipMatch[0].includes('border:1px solid var(--edge)'), 'Has border');
  assert.ok(chipMatch[0].includes('transition:'), 'Has transition');
  assert.ok(chipMatch[0].includes('text-transform:uppercase'), 'Uppercase text');
});

test('specChip hover shows feedback', () => {
  assert.ok(cssSrc.includes('.specChip:hover'), 'Hover rule exists');
});

test('specChip active state uses accent color', () => {
  const activeMatch = cssSrc.match(/\.specChip\.active\{[^}]+\}/);
  assert.ok(activeMatch, 'Active state rule found');
  assert.ok(activeMatch[0].includes('color:var(--accent)'), 'Active uses accent color');
  assert.ok(activeMatch[0].includes('border-color:var(--accent)'), 'Active uses accent border');
  assert.ok(activeMatch[0].includes('accentGlow'), 'Active uses accent glow');
});

// ── Mobile responsive ───────────────────────────────────────────────────
test('Mobile responsive styles for spec filter chips', () => {
  assert.ok(cssSrc.includes('.specChip{font-size:10px'), 'Chip font shrinks on mobile');
  assert.ok(cssSrc.includes('.specFilters{gap:4px'), 'Filter gap tightens on mobile');
});

// ── Step 1 block syntax ─────────────────────────────────────────────────
test('Step 1 block is properly closed before Step 2', () => {
  // The if(s===1){...} block must close before if(s===2)
  const step1Start = wizSrc.indexOf('if(s===1){');
  assert.ok(step1Start > -1, 'Step 1 opens block with brace');
  // Find the if(s===2) and verify a closing brace precedes it
  const step2Start = wizSrc.indexOf('if(s===2)');
  assert.ok(step2Start > step1Start, 'Step 2 comes after Step 1');
  const between = wizSrc.slice(step1Start, step2Start);
  assert.ok(between.trimEnd().endsWith('}'), 'Step 1 block closes before Step 2');
});
