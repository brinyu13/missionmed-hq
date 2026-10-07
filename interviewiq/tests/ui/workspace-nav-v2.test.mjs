import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// ── V2 Interview Workspace Navigation contract tests ─────────────────────
// These verify the V2 UX steer is applied to the interview workspace:
// 1. Breadcrumb-style navigation in roomHead
// 2. Enhanced nextMove panel with icon element
// 3. Matrix-style sections tablist with visited states
// 4. Section entrance animation
// 5. V2 typography upgrades for workspace

const shellSrc = readFileSync(new URL('../../public/source/shell.js', import.meta.url), 'utf8');
const cssSrc = readFileSync(new URL('../../public/styles.css', import.meta.url), 'utf8');

// Extract the journey navigation + renderRoom bodies for targeted assertions.
// (V2 renovation: the tablist is rendered by journeyNav(), directly before renderRoom.)
const roomStart = shellSrc.indexOf('function journeyNav(');
const roomEnd = shellSrc.indexOf('/* ---------------- PREPARE', roomStart + 1);
const roomSrc = shellSrc.slice(roomStart, roomEnd > -1 ? roomEnd : undefined);

// ── Breadcrumb navigation ────────────────────────────────────────────────
test('roomHead uses breadcrumb-style navigation', () => {
  assert.ok(roomSrc.includes('class="roomNav"'), 'roomNav container exists');
  assert.ok(roomSrc.includes('class="back"'), 'Back button present');
  assert.ok(roomSrc.includes('backIcon'), 'Back icon element present');
  assert.ok(roomSrc.includes('breadSep'), 'Breadcrumb separator present');
  assert.ok(roomSrc.includes('breadCurrent'), 'Current breadcrumb label present');
});

test('roomHead has structured meta layout', () => {
  assert.ok(roomSrc.includes('class="roomMeta"'), 'roomMeta wrapper exists');
  assert.ok(roomSrc.includes('class="roomDetails"'), 'roomDetails wrapper exists');
  assert.ok(roomSrc.includes('class="roomActions"'), 'roomActions wrapper exists');
  assert.ok(roomSrc.includes('roomId'), 'Interview ID has roomId class');
});

test('Back button navigates to close-interview', () => {
  assert.ok(roomSrc.includes('data-act="close-interview"'), 'Back uses data-act for delegation');
  assert.ok(roomSrc.includes('Interviews'), 'Back label says "Interviews"');
});

// ── CSS: breadcrumb styling ──────────────────────────────────────────────
test('CSS styles breadcrumb navigation elements', () => {
  assert.ok(cssSrc.includes('.roomNav'), 'roomNav styled');
  assert.ok(cssSrc.includes('.breadSep'), 'Breadcrumb separator styled');
  assert.ok(cssSrc.includes('.breadCurrent'), 'Current breadcrumb styled');
  assert.ok(cssSrc.includes('.backIcon'), 'Back icon styled');
});

test('roomHead uses column layout', () => {
  assert.ok(cssSrc.includes('.roomHead{display:flex;flex-direction:column'), 'roomHead uses column flex');
});

// ── Enhanced nextMove panel ──────────────────────────────────────────────
test('nextMove panel has icon element', () => {
  assert.ok(roomSrc.includes('nextMoveIcon'), 'nextMoveIcon element present');
  assert.ok(roomSrc.includes('nextMoveBody'), 'nextMoveBody wrapper present');
});

test('CSS styles nextMove icon and panel shine', () => {
  assert.ok(cssSrc.includes('.nextMoveIcon'), 'nextMoveIcon styled');
  assert.ok(cssSrc.includes('.nextMoveBody'), 'nextMoveBody styled');
  assert.ok(cssSrc.includes('.nextMove::before'), 'nextMove has top shine line');
  assert.ok(cssSrc.includes('.nextMove:hover'), 'nextMove has hover interaction');
});

test('nextMove panel has overflow hidden and border-radius upgrade', () => {
  const nmMatch = cssSrc.match(/\.nextMove\{[^}]+\}/);
  assert.ok(nmMatch, 'nextMove base rule found');
  const nmRule = nmMatch[0];
  assert.ok(nmRule.includes('overflow:hidden'), 'overflow hidden for shine line');
  assert.ok(nmRule.includes('border-radius:16px'), 'Border radius upgraded to 16px');
});

// ── Matrix-style sections tablist ────────────────────────────────────────
test('Sections tablist has pill-container styling', () => {
  const secMatch = cssSrc.match(/\.sections\{[^}]+\}/);
  assert.ok(secMatch, 'sections base rule found');
  const secRule = secMatch[0];
  assert.ok(secRule.includes('background:'), 'Sections has background');
  assert.ok(secRule.includes('border:1px solid var(--edge)'), 'Sections has border');
  assert.ok(secRule.includes('border-radius:12px'), 'Sections has rounded container');
});

test('Active section tab has glow shadow', () => {
  assert.ok(cssSrc.includes('.sections button[aria-selected="true"]{'), 'Active tab has styles');
  assert.ok(cssSrc.includes('box-shadow:0 2px 12px rgba(var(--accentGlow)'), 'Active tab has glow shadow');
});

test('Sections buttons have visited state', () => {
  assert.ok(roomSrc.includes("${idx<secIdx?' visited':''}"), 'visited class applied to prior tabs');
  assert.ok(cssSrc.includes('.sections button.visited'), 'visited state styled in CSS');
});

test('Sections buttons have transition effects', () => {
  const btnMatch = cssSrc.match(/\.sections button\{[^}]+\}/);
  assert.ok(btnMatch, 'sections button rule found');
  assert.ok(btnMatch[0].includes('transition:'), 'Buttons have transition');
});

test('Sections hover state has subtle background', () => {
  assert.ok(cssSrc.includes('.sections button:hover:not([aria-selected="true"])'), 'Non-active hover state exists');
});

// ── Section entrance animation ───────────────────────────────────────────
test('Section content has entrance animation', () => {
  assert.ok(cssSrc.includes('@keyframes sectionIn'), 'sectionIn keyframes defined');
  assert.ok(cssSrc.includes('animation:sectionIn'), 'Section uses sectionIn animation');
});

// ── Typography upgrades ──────────────────────────────────────────────────
test('Section h2 upgraded to 24px', () => {
  assert.ok(cssSrc.includes('.section h2{font-size:24px'), 'Section h2 is 24px');
});

test('Section h3 upgraded to 15.5px', () => {
  assert.ok(cssSrc.includes('.section h3{font-size:15.5px'), 'Section h3 is 15.5px');
});

// ── Mobile responsive ────────────────────────────────────────────────────
test('Mobile responsive styles for workspace navigation', () => {
  assert.ok(cssSrc.includes('.roomNav{font-size:11px'), 'roomNav font shrinks on mobile');
  assert.ok(cssSrc.includes('.sections button{padding:7px 10px'), 'Section buttons compact on mobile');
  assert.ok(cssSrc.includes('.nextMoveIcon{width:34px'), 'nextMove icon shrinks on mobile');
});

// ── Data-act wiring preserved ────────────────────────────────────────────
test('Workspace buttons use data-act for click delegation', () => {
  assert.ok(roomSrc.includes('data-act="close-interview"'), 'Close uses data-act');
  assert.ok(roomSrc.includes('data-act="cal-item"'), 'Calendar uses data-act');
  assert.ok(roomSrc.includes('data-act="section"'), 'Section tabs use data-act');
  assert.ok(!roomSrc.includes('data-action='), 'No data-action attributes');
});

// ── Accessibility preserved ──────────────────────────────────────────────
test('Sections tablist preserves ARIA attributes', () => {
  assert.ok(roomSrc.includes('role="tablist"'), 'tablist role preserved');
  assert.ok(roomSrc.includes('role="tab"'), 'tab role on buttons preserved');
  assert.ok(roomSrc.includes('aria-selected='), 'aria-selected preserved');
  assert.ok(roomSrc.includes('aria-label="Sections of this interview"'), 'tablist aria-label preserved');
});
