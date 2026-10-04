import assert from 'node:assert/strict';
import test from 'node:test';
import {serializeFounderPresentation,assertCompleteFounderPresentation} from '../web/js/presentation/founder-presentation-serializer.js';
import {resolveFounderPresentationSvg,materialPresentationCollisions} from '../web/js/presentation/resolved-founder-presentation.js';
const pixel='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNw6VgFAAKKAXc8PYUaAAAAAElFTkSuQmCC'; // CRC-valid synthetic blue pixel, never an applicant photograph.
const source=()=>({id:'overlap-with-photos',revision:1,theme:'keynote-classic',studentProfile:{fullName:'Synthetic Robin Hill',medicalSchool:'Synthetic Medical College',degree:'MBBS'},events:[
  ['clinical','IM rotation'],['research','Clinical research'],['work','Teaching assistant']
].map(([id,title])=>({id,title,categoryId:id,eventType:'duration',startDate:'2023-01',endDate:'2024-12',siteName:'Synthetic Hospital',visibilityState:'INTERVIEWER_SAFE'})),mediaItems:['profile','photo1','photo2','photo3'].map(placement=>({id:placement,type:placement==='profile'?'profilePhoto':'photo',placement,resolvedUrl:pixel,naturalAspect:1,crop:{x:35,y:65,zoom:1.2},visibilityState:'INTERVIEWER_SAFE'})),advanced:{media:[],textBlocks:[],elements:[],groups:[]}});
const render=document=>serializeFounderPresentation(document,{scope:'INTERVIEWER_SAFE',currentMonth:'2026-10'});
test('simultaneous histories with all photo slots use bounded context without dropping facts or media',()=>{
  const document=source(),before=JSON.stringify(document),result=render(document);
  assert.doesNotThrow(()=>assertCompleteFounderPresentation(result));
  assert.equal(materialPresentationCollisions(resolveFounderPresentationSvg(result.svg)).length,0);
  assert.equal(result.scene.composedAxis.startYear,2022);
  assert.equal(result.scene.composedAxis.endYear,2024);
  for(const event of document.events){assert.ok(result.svg.includes(event.title));assert.ok(result.svg.includes(`data-event-id="${event.id}"`));}
  assert.equal((result.svg.match(/data-material-field="siteName"/g)||[]).length,3);
  for(const photo of document.mediaItems)assert.ok(result.svg.includes(`data-media-id="${photo.id}"`));
  assert.equal((result.svg.match(/data-artifact-photo-frame=/g)||[]).length,3);
  assert.equal(JSON.stringify(document),before);
  assert.equal(render(document).svg,result.svg,'composition is deterministic');
});
test('explicit two-year axis stays authored and unresolved collision remains export-gated',()=>{
  const document={...source(),presentationOverrides:{axis:{mode:'manual',startYear:2023,endYear:2024,includeFuture:false,segmentWeights:[{id:'2023',weight:1},{id:'2024',weight:1}]}}};
  const before=JSON.stringify(document),result=render(document);
  assert.equal(result.scene.composedAxis,undefined);
  assert.throws(()=>assertCompleteFounderPresentation(result),error=>error.code==='TIMELINE_EXPORT_TEXT_COLLISION');
  assert.equal(JSON.stringify(document),before);
});
