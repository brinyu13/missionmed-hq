import test from 'node:test';
import assert from 'node:assert/strict';
import {FOUNDER_TEMPLATE_GRAMMAR,FOUNDER_COLOR_KEY_ROWS} from '../web/js/presentation/founder-keynote-contract.js';
import {serializeFounderPresentation,assertCompleteFounderPresentation} from '../web/js/presentation/founder-presentation-serializer.js';
import {resolveFounderPresentationSvg} from '../web/js/presentation/resolved-founder-presentation.js';
import {FOUNDER_2025_MATRIX} from './fixtures/founder-2025-matrix.mjs';

test('stored rejected composition options cannot select another template or continuation',()=>{
  const d=structuredClone(FOUNDER_2025_MATRIX[0].document);
  d.metadata.compositionMode='measured';d.advanced.compositionMode='adaptive';
  const r=serializeFounderPresentation(d);
  assert.match(r.svg,/113d22efb8ca2c00c29d8e57b92c1eb24ff2c66931f7138bbf23daa66dbba706/);
  assert.match(r.svg,/data-axis-ribbon="continuous"/);
  assert.doesNotMatch(r.svg,/Experience Key|data-composition-page|data-event-number/);
  assert.equal(r.pages,undefined);assert.equal(FOUNDER_TEMPLATE_GRAMMAR.locked.slideCount,1);
});
test('native reference typography is retained in the visible artifact',()=>{
  const nodes=resolveFounderPresentationSvg(serializeFounderPresentation(FOUNDER_2025_MATRIX[0].document).svg).nodes;
  const label=nodes.find(n=>n.sourceAttributes['data-arrow-label-placement']);
  assert.equal(label.fontSize,18);assert.match(label.fontFamily,/American Typewriter/);assert.equal(label.sourceAttributes['font-weight'],'400');
  const site=nodes.find(n=>n.sourceAttributes['data-material-field']==='siteName');
  assert.equal(site.fontSize,19);assert.match(site.fontFamily,/Baskerville/);
  assert.equal(nodes.find(n=>n.sourceAttributes['data-arrow-caption']).fontSize,18);
});
test('profile wrapping preserves a long unbroken token and reports overflow instead of inventing spaces or truncating',()=>{
  const d=structuredClone(FOUNDER_2025_MATRIX[0].document);d.studentProfile.medicalSchool='W'.repeat(600);
  const r=serializeFounderPresentation(d),lines=resolveFounderPresentationSvg(r.svg).nodes.filter(n=>n.sourceAttributes['data-profile-field']==='Medical school');
  assert.equal(lines.map(n=>n.text).join('').replace(/^Medical school:\s*/,''),d.studentProfile.medicalSchool);
  assert.throws(()=>assertCompleteFounderPresentation(r),e=>e.code==='TIMELINE_EXPORT_TEXT_OVERFLOW');
});
test('late corrections, manual overlay and JSON save/reopen are deterministic without modifying facts',()=>{
  const d=structuredClone(FOUNDER_2025_MATRIX.find(f=>f.id==='M16').document),before=JSON.stringify(d);
  const first=serializeFounderPresentation(d).svg,again=serializeFounderPresentation(JSON.parse(before)).svg;
  assert.equal(first,again);assert.equal(JSON.stringify(d),before);
  assert.match(first,/Corrected Medical Officer title/);assert.match(first,/Reviewed source correction/);
});

test('category colors use the color-managed 2025 golden swatches and white native arrow labels',()=>{
 assert.deepEqual(FOUNDER_COLOR_KEY_ROWS.map(r=>r.color),['#00882B','#763F9B','#0565C0','#DF6A0F','#F49018','#DCBE23']);
 const r=serializeFounderPresentation(FOUNDER_2025_MATRIX.find(f=>f.id==='M05').document);
 const nodes=resolveFounderPresentationSvg(r.svg).nodes;
 for(const n of nodes.filter(n=>n.sourceAttributes['data-arrow-label-placement']==='inside'))assert.equal(n.style.fill,'#FFFFFF');
 assert.match(r.svg,/#DF6A0F/);assert.equal(FOUNDER_TEMPLATE_GRAMMAR.locked.examResultMarker,'explicit-result-flag-attached-to-study-arrow-below-ribbon');
});

test('general milestone pennants stay gray with white date text as in the reference',()=>{
 const d=structuredClone(FOUNDER_2025_MATRIX.find(f=>f.id==='M09').document);
 d.events=[{id:'personal-marker',categoryId:'personal',eventType:'milestone',title:'Married',startDate:'2023-06',visibilityState:'INTERVIEWER_SAFE'}];
 const nodes=resolveFounderPresentationSvg(serializeFounderPresentation(d).svg).nodes.filter(n=>n.semanticRef==='personal-marker');
 assert.ok(nodes.some(n=>n.kind==='path'&&n.style.fill==='#A6AAAE'));
 const date=nodes.find(n=>n.sourceAttributes['data-founder-pennant-date']);assert.equal(date.style.fill,'#FFFFFF');assert.equal(date.fontSize,18);
});
