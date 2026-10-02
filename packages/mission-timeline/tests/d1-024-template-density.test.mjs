import test from 'node:test';
import assert from 'node:assert/strict';
import {serializeFounderPresentation,assertCompleteFounderPresentation} from '../web/js/presentation/founder-presentation-serializer.js';
import {resolveFounderPresentationSvg} from '../web/js/presentation/resolved-founder-presentation.js';
import {FOUNDER_2025_MATRIX} from './fixtures/founder-2025-matrix.mjs';

for(const fixture of FOUNDER_2025_MATRIX){
  test(`${fixture.id} ${fixture.case}: template, source preservation and truthful gate`,()=>{
    const before=JSON.stringify(fixture.document),r=serializeFounderPresentation(fixture.document);
    assert.equal(JSON.stringify(fixture.document),before);
    assert.match(r.svg,/viewBox="0 0 1920 1080"/);assert.match(r.svg,/data-founder-keynote-source-sha256="113d22/);
    assert.equal(r.pages,undefined);
    const nodes=resolveFounderPresentationSvg(r.svg).nodes;
    const ids=new Set(nodes.map(n=>n.semanticRef));
    for(const e of r.scene.events)assert.ok(ids.has(e.id),'No included event may silently disappear: '+e.id);
    // Dense mode must retain institution names just as ordinary mode does.
    for(const e of r.scene.arrows){
      const text=nodes.filter(n=>n.kind==='text'&&n.semanticRef===e.id).map(n=>n.text).join(' ').replace(/\s+/g,' ');
      assert.ok(text.includes(e.siteName),'Institution absent: '+e.id);
    }
    if(fixture.reviewRequired)assert.throws(()=>assertCompleteFounderPresentation(r),e=>['TIMELINE_EXPORT_INCOMPLETE','TIMELINE_EXPORT_EMPTY'].includes(e.code));
    // A rendering that passes technical bounds still needs visual acceptance.
    else try{assertCompleteFounderPresentation(r);}catch(e){assert.ok(['TIMELINE_EXPORT_TEXT_OVERFLOW','TIMELINE_EXPORT_MISSING_FIELDS','TIMELINE_EXPORT_TEXT_COLLISION'].includes(e.code));}
  });
}
test('an institution omission is detected even when all event IDs remain in the artifact',()=>{
  const r=serializeFounderPresentation(FOUNDER_2025_MATRIX[0].document);
  r.svg=r.svg.replace(/<text[^>]*data-material-field="siteName"[\s\S]*?<\/text>/g,'');
  assert.throws(()=>assertCompleteFounderPresentation(r),e=>e.code==='TIMELINE_EXPORT_MISSING_FIELDS'&&e.fields.some(f=>f.field==='siteName'));
});

test('material text collisions block the same final render used for export',()=>{
  const r=serializeFounderPresentation(FOUNDER_2025_MATRIX.find(f=>f.id==='M05').document);
  assert.throws(()=>assertCompleteFounderPresentation(r),e=>e.code==='TIMELINE_EXPORT_TEXT_COLLISION');
});
