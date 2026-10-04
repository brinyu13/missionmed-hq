import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {serializeFounderPresentation,assertCompleteFounderPresentation} from '../web/js/presentation/founder-presentation-serializer.js';
import {resolveFounderPresentationSvg,materialPresentationCollisions} from '../web/js/presentation/resolved-founder-presentation.js';
import {createEditableFounderPptx} from '../web/js/presentation/editable-pptx.js';
import {JSZip} from '../web/vendor/presentation/pptx-runtime.js';
import {measurePresentationText} from '../web/js/presentation/text-layout.js';
import {analyzeTimelineQuality} from '../web/js/uxr-002/quality-guardian.js';
import {parsePresentationXml,xmlNodes,xmlText} from '../web/js/presentation/presentation-xml.js';

const documentFor=fullName=>({id:'synthetic-title-fit',theme:'keynote-classic',events:[],advanced:{},studentProfile:{fullName}});
const resolveImage=async src=>'data:'+(src.endsWith('.png')?'image/png':'image/jpeg')+';base64,'+(await readFile(new URL('../web/'+src.slice(src.indexOf('assets/')),import.meta.url))).toString('base64');
const parts=doc=>{const rendered=serializeFounderPresentation(doc,{scope:'INTERVIEWER_SAFE',currentMonth:'2026-10'});const paint=resolveFounderPresentationSvg(rendered.svg);return{rendered,paint,title:paint.nodes.find(n=>n.sourceAttributes['data-board-headline']),frame:paint.nodes.filter(n=>n.groupId==='furniture:title'&&n.kind==='image')};};

test('short titles retain original plaque geometry and native typography',()=>{
  const {title,frame,rendered}=parts(documentFor('Dr B'));
  assert.equal(frame.length,1);
  assert.deepEqual(frame[0].bounds,{x:648,y:0,width:596,height:83,rotation:0});
  assert.equal(title.fontSize,36);assert.equal(title.fontFamily,'American Typewriter');
  assert.equal(title.characterSpacing,0);assert.equal(title.text,'Timeline: Dr B');
  assert.doesNotMatch(rendered.svg,/textLength=/);
});

test('long title expands existing centered plaque without shrinking fonts, deforming corners or changing supplied text',()=>{
  const doc=documentFor('Synthetic Alexandra Meridian Applicant'),before=JSON.stringify(doc);
  const {title,frame,rendered}=parts(doc);
  assert.equal(frame.length,3);assert.equal(frame[0].bounds.width,48);assert.equal(frame[2].bounds.width,48);
  const left=frame[0].bounds.x,right=frame[2].bounds.x+48;
  assert.equal((left+right)/2,946);assert.ok(right-left>596);
  assert.ok(title.bounds.x>=left+48-.01&&title.bounds.x+title.bounds.width<=right-48+.01);
  assert.equal(title.fontSize,36);assert.equal(title.characterSpacing,0);
  assert.equal(title.text,'Timeline: Synthetic Alexandra Meridian Applicant');
  assert.doesNotMatch(rendered.svg,/textLength=/);
  assert.equal(JSON.stringify(doc),before);
});

test('title and fixed legend export as natural-width editable native text with exact cropped frame caps',async()=>{
  const {rendered}=parts(documentFor('Synthetic Alexandra Meridian Applicant'));
  const result=await createEditableFounderPptx({svg:rendered.svg,resolveImage});
  assert.deepEqual(result.validation.errors,[]);
  const zip=await JSZip.loadAsync(await result.blob.arrayBuffer());
  const tree=parsePresentationXml(await zip.file('ppt/slides/slide1.xml').async('string'));
  const shape=xmlNodes(tree,n=>n.tag==='p:sp'&&xmlNodes(n,c=>c.tag==='a:t'&&xmlText(c).startsWith('Timeline:')).length)[0];
  const run=xmlNodes(shape,n=>n.tag==='a:rPr')[0];
  assert.equal(run.attrs.sz,'2700');assert.ok(!run.attrs.spc||Number(run.attrs.spc)===0);
  assert.equal(xmlNodes(run,n=>n.tag==='a:latin')[0].attrs.typeface,'American Typewriter');
  assert.ok(result.validation.text.includes('Personal (Not on CV)'));
  assert.ok(xmlNodes(tree,n=>n.tag==='a:srcRect').some(n=>Number(n.attrs.r)===Math.round((596-48)/596*100000)));
  assert.ok(!xmlNodes(tree,n=>n.tag==='p:cNvPr').some(n=>String(n.attrs.name).includes('glyph-fit')));
});

test('unfittable title stays complete and blocks final export instead of compressing or clipping silently',()=>{
  const name='Very long supplied name '.repeat(20),doc=documentFor(name);
  doc.events=[{id:'work',title:'Medical Officer',categoryId:'work',eventType:'duration',startDate:'2023-01',endDate:'2024-06',visibilityState:'INTERVIEWER_SAFE'}];
  const {rendered,title}=parts(doc);
  assert.equal(title.text,`Timeline: ${name}`);
  assert.equal(title.fontSize,36);assert.equal(title.sourceAttributes['data-text-overflow'],'true');
  assert.throws(()=>assertCompleteFounderPresentation(rendered),e=>e.code==='TIMELINE_EXPORT_TEXT_OVERFLOW'&&e.elementIds.includes('furniture:title'));
});

test('fractional browser font measurement does not falsely block an exactly fitted plaque',()=>{
  const rendered=serializeFounderPresentation(documentFor('Synthetic Alex Elm'),{measureText:(text,...args)=>text.startsWith('Timeline:')?503.8197937011719:measurePresentationText(text,...args)});
  const title=resolveFounderPresentationSvg(rendered.svg).nodes.find(n=>n.sourceAttributes['data-board-headline']);
  assert.equal(title.sourceAttributes['data-text-overflow'],undefined);
});

test('composer places existing milestone labels around the measured title plaque with all facts intact',()=>{
  const doc=documentFor('Synthetic Alexandra Meridian Applicant');
  doc.events=[{id:'degree',title:'Medical degree',categoryId:'education',eventType:'milestone',startDate:'2020-06',siteName:'Synthetic Medical College',visibilityState:'INTERVIEWER_SAFE'}, {id:'exam',title:'Step 1',categoryId:'exams',eventType:'milestone',startDate:'2025-04',siteName:'Synthetic Hospital',visibilityState:'INTERVIEWER_SAFE'}];
  const {paint}=parts(doc);
  assert.equal(materialPresentationCollisions(paint).filter(c=>c.elementIds.includes('furniture:title')).length,0);
  for(const e of doc.events)assert.ok(paint.nodes.filter(n=>n.semanticRef===e.id&&n.kind==='text').map(n=>n.text).join(' ').includes(e.siteName));
  assert.deepEqual(doc.events.map(e=>e.startDate),['2020-06','2025-04']);
});


test('fixed six-row legend keeps its natural font and fits inside the original card',()=>{
  const {paint}=parts(documentFor('Dr B'));
  const labels=paint.nodes.filter(n=>n.kind==='text'&&n.groupId==='furniture:color-key'&&n.text!=='COLOR KEY');
  assert.equal(labels.length,6);
  for(const label of labels){
    assert.equal(label.fontSize,18);assert.equal(label.characterSpacing,0);
    assert.equal(label.sourceAttributes['data-text-overflow'],undefined);
    assert.ok(label.bounds.x+label.bounds.width<=284+.01);
  }
});

test('authored legend overflow retains the full label and blocks final export and Guardian readiness',()=>{
  const doc=documentFor('Dr B');
  doc.events=[{id:'work',title:'Medical Officer',categoryId:'work',eventType:'duration',startDate:'2023-01',endDate:'2024-06',visibilityState:'INTERVIEWER_SAFE'}];
  doc.presentationOverrides={categoryKey:[{id:'work',label:'Clinical Research and Teaching'}]};
  const before=JSON.stringify(doc),{rendered,paint}=parts(doc);
  const label=paint.nodes.find(n=>n.text==='Clinical Research and Teaching');
  assert.equal(label.sourceAttributes['data-text-overflow'],'true');
  assert.equal(label.fontSize,18);assert.equal(label.characterSpacing,0);
  assert.throws(()=>assertCompleteFounderPresentation(rendered),e=>e.code==='TIMELINE_EXPORT_TEXT_OVERFLOW'&&e.elementIds.includes('furniture:color-key'));
  const finding=analyzeTimelineQuality(doc).findings.find(f=>f.code==='TEXT_CONTAINER_OVERFLOW'&&f.elementIds.includes('furniture:color-key'));
  assert.equal(finding?.severity,'BLOCK_EXPORT');assert.equal(JSON.stringify(doc),before);
});
