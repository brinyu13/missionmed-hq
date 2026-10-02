import test from 'node:test';
import assert from 'node:assert/strict';
import {FOUNDER_TEMPLATE_GRAMMAR} from '../web/js/presentation/founder-keynote-contract.js';
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
