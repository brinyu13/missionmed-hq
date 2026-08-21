import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const app = await readFile(new URL('../../public/app.js', import.meta.url), 'utf8');
const styles = await readFile(new URL('../../public/styles.css', import.meta.url), 'utf8');

test('B1-517 adds a signed-capability MyERAS route without changing the StoryForge shell', () => {
  assert.match(app, /\['myeras', 'MyERAS Experiences', '▦'\]/);
  assert.ok(app.includes("const ADMIN_SUBJECT_NAV = Object.freeze([\n  ['home', 'Home', '⌂'],\n  ['library', 'Story Library', '▤'],\n  ['myeras', 'MyERAS Experiences', '▦'],\n]);"));
  assert.match(app, /myerasWorkspace: Boolean\(session\?\.capabilities\?\.myerasWorkspace\)/);
  assert.match(app, /data-view="myeras"/);
  assert.match(app, /data-subject-route="\$\{route\}"/);
  assert.match(app, /api\.adminSubjectMyeras/);
  assert.match(app, /Read-only mirror/);
});

test('MyERAS editor follows the AAMC field order and keeps profile limits advisory', () => {
  const form = app.match(/function myerasExperienceForm\(experience = null\) \{([\s\S]*?)\n\}/)?.[1] || '';
  for (const marker of [
    'Organization', 'Experience type', 'Position or role', 'This experience is current',
    'Start month', 'End month', 'Country', 'State or province', 'City', 'Postal code',
    'Setting', 'Primary focus', 'Key characteristic', 'Context, roles &amp; responsibilities',
    'Most meaningful reflection',
  ]) assert.match(form, new RegExp(marker));
  assert.doesNotMatch(form, /data-myeras-field="participationFrequency"/);
  assert.match(form, /Participation frequency remains unavailable/);
  assert.match(form, /data-myeras-advisory="descriptionText"/);
  assert.match(form, /data-myeras-advisory="mostMeaningfulText"/);
  assert.doesNotMatch(form, /data-myeras-field="descriptionText"[^>]*maxlength/);
  assert.doesNotMatch(form, /data-myeras-field="mostMeaningfulText"[^>]*maxlength/);
  assert.match(app, /over ERAS target; nothing is truncated/);
});

test('MyERAS uses a two-pane truth-linking workspace and preserves all location/reflection fields', () => {
  assert.match(app, /b1517EditorGrid/);
  assert.match(app, /Back this experience with StoryForge truth/);
  assert.match(app, /Linking never changes the original story/);
  assert.match(app, /data-myeras-link-form/);
  for (const field of ['country', 'stateProvince', 'city', 'postalCode', 'mostMeaningfulText']) {
    assert.match(app, new RegExp(`${field}: value\\('${field}'\\)`));
  }
  assert.match(app, /mostMeaningful: form\.dataset\.mostMeaningful === 'true'/);
  assert.match(styles, /\.b1517EditorGrid\{display:grid;grid-template-columns:/);
  assert.match(styles, /@media\(max-width:900px\)\{\.b1517EditorGrid\{grid-template-columns:1fr\}/);
});

test('B1-517 exposes the active profile and all four durable purposeful story versions', () => {
  assert.match(app, /Active profile/);
  assert.match(app, /ERAS 2027/);
  for (const key of ['thirty_second', 'nnq_setup', 'myeras_experience', 'myeras_impactful']) {
    assert.match(app, new RegExp(`${key}: Object\\.freeze`));
  }
  assert.match(app, /state\.capabilities\?\.myerasVersions/);
  assert.match(app, /Promote to my MyERAS Impactful Experience/);
  assert.match(app, /Every saved change remains in version history/);
});

test('ERAS classification, suggestions, and clinical metadata remain explicit and bounded', () => {
  assert.match(app, /function erasClassificationMarkup/);
  assert.match(app, /Suggestions never save themselves/);
  assert.match(app, /Original themes/);
  assert.match(app, /Read-only history\. B1-517 never rewrites these values/);
  assert.match(app, /Clinical case <span>optional · collapsed by default/);
  assert.match(app, /I confirm this text contains no patient name, MRN, exact date, or facility identifier/);
  assert.match(app, /if \(!state\.capabilities\?\.clinicalCaseMetadata \|\| !b1517ClinicalStory\(story\)\) return ''/);
});

test('Impactful drafting is manual-first and never truncated by the active profile target', () => {
  const impactful = app.match(/<form id="myerasImpactfulForm"[\s\S]*?<\/form>/)?.[0] || '';
  assert.match(impactful, /data-myeras-advisory="impactfulText"/);
  assert.doesNotMatch(impactful, /maxlength=/);
  assert.match(app, /AI condensing is off\. You can complete every MyERAS field manually/);
  assert.doesNotMatch(app, /submit to AAMC|export to MyERAS/i);
});
