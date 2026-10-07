import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// ── V2 Wizard Micro-Interactions contract tests ──────────────────────────
// These verify game-like guided wizard micro-interactions:
// 1. Form field focus effects (glow, border color, background)
// 2. Step entrance animation (wizStepIn)
// 3. Button press feedback (scale transform)
// 4. Checkbox card-style interaction (intakeCheck hover/checked)
// 5. Progress node current-step pulse
// 6. Panel hover effects
// 7. Choice card hover lift

const cssSrc = readFileSync(new URL('../../public/styles.css', import.meta.url), 'utf8');

// ── Form field focus effects ─────────────────────────────────────────────
test('Intake form fields have transition on focus-related properties', () => {
  const inputRule = cssSrc.match(/\.intakeWizard input[^{]*\{[^}]+\}/);
  assert.ok(inputRule, 'Input rule found');
  assert.ok(inputRule[0].includes('transition:'), 'Input has transition');
});

test('Form fields have focus glow effect', () => {
  assert.ok(cssSrc.includes('.intakeWizard input:focus'), 'Input focus rule exists');
  assert.ok(cssSrc.includes('box-shadow:0 0 0 2px rgba(var(--accentGlow)'), 'Focus uses accent glow ring');
  assert.ok(cssSrc.includes('.intakeWizard textarea:focus'), 'Textarea focus rule exists');
});

test('Valid form fields show green border feedback', () => {
  assert.ok(cssSrc.includes(':not(:placeholder-shown):valid'), 'Valid non-empty input has rule');
  assert.ok(cssSrc.includes('border-color:rgba(74,222,157'), 'Valid fields get green border');
});

// ── Step entrance animation ──────────────────────────────────────────────
test('Wizard step content has entrance animation', () => {
  assert.ok(cssSrc.includes('@keyframes wizStepIn'), 'wizStepIn keyframes defined');
  assert.ok(cssSrc.includes('animation:wizStepIn'), 'fieldset uses wizStepIn animation');
});

test('wizStepIn slides from right', () => {
  const match = cssSrc.match(/@keyframes wizStepIn\{([^}]+)\}/);
  assert.ok(match, 'wizStepIn body found');
  assert.ok(match[1].includes('translateX'), 'Uses horizontal slide');
});

// ── Button press feedback ────────────────────────────────────────────────
test('Buttons have active press scale effect', () => {
  assert.ok(cssSrc.includes('.intakeWizard .btn:active:not(:disabled)'), 'Active button state rule exists');
  assert.ok(cssSrc.includes('transform:scale(.97)'), 'Button press scales down');
});

test('Buttons have transition for smooth interaction', () => {
  assert.ok(cssSrc.includes('.intakeWizard .btn{transition:'), 'Button transition defined');
});

// ── Checkbox card interaction ────────────────────────────────────────────
test('Checkbox items have card-style styling', () => {
  const checkRule = cssSrc.match(/\.intakeCheck\{[^}]+\}/);
  assert.ok(checkRule, 'intakeCheck rule found');
  assert.ok(checkRule[0].includes('border:1px solid var(--edge)'), 'Checkbox has border');
  assert.ok(checkRule[0].includes('border-radius:10px'), 'Checkbox has rounded corners');
  assert.ok(checkRule[0].includes('padding:10px'), 'Checkbox has padding');
  assert.ok(checkRule[0].includes('transition:'), 'Checkbox has transition');
});

test('Checkbox hover state shows feedback', () => {
  assert.ok(cssSrc.includes('.intakeCheck:hover'), 'Checkbox hover rule exists');
});

test('Checked checkbox shows green confirmation', () => {
  assert.ok(cssSrc.includes('.intakeCheck:has(input:checked)'), 'Checked state uses :has selector');
  assert.ok(cssSrc.includes('border-color:rgba(74,222,157'), 'Checked state has green border');
});

// ── Progress node pulse ──────────────────────────────────────────────────
test('Current progress step node has pulse animation', () => {
  assert.ok(cssSrc.includes('@keyframes stepPulse'), 'stepPulse keyframes defined');
  assert.ok(cssSrc.includes('.intakeProgress li[aria-current=step]::before{animation:stepPulse'), 'Current step node uses pulse');
});

// ── Panel hover effects ──────────────────────────────────────────────────
test('Intake wizard panels have hover interaction', () => {
  assert.ok(cssSrc.includes('.intakeWizard .panel{transition:'), 'Panel has transition');
  assert.ok(cssSrc.includes('.intakeWizard .panel:hover'), 'Panel hover rule exists');
});

// ── Choice card hover lift ───────────────────────────────────────────────
test('Drawer choice items have hover lift effect', () => {
  assert.ok(cssSrc.includes('.intakeWizard .drawerChoice button:hover'), 'Choice button hover exists');
  assert.ok(cssSrc.includes('translateY(-1px)'), 'Hover lifts choice card');
});
