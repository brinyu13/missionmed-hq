import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {serializeFounderPresentation,serializeFounderPresentationAsync,projectFounderPresentationDocument} from '../web/js/presentation/founder-presentation-serializer.js';
import {fillCanonicalMediaFrame} from '../web/js/uxr-002/advanced-studio.js';
import {createEditableFounderPptx,inspectEditablePptx,EDITABLE_PPTX_MIME} from '../web/js/presentation/editable-pptx.js';
import {resolveFounderPresentationSvg} from '../web/js/presentation/resolved-founder-presentation.js';
import {parsePresentationXml,xmlNodes,xmlText} from '../web/js/presentation/presentation-xml.js';
import {JSZip} from '../web/vendor/presentation/pptx-runtime.js';
import {FOUNDER_KEYNOTE_CONTRACT} from '../web/js/presentation/founder-keynote-contract.js';
import {EXPORT_FORMATS,buildExportPreviewInput} from '../web/js/uxr-002/export-screen.js';
import {TIMELINE_SCENE_SCHEMA,TIMELINE_SCENE_VERSION} from '../web/js/editor/scene-graph.js';

const fixture=JSON.parse(await readFile(new URL('./fixtures/d1-timeline-founder-reanchor-015/synthetic-founder-geometry.json',import.meta.url),'utf8'));
const pixel='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jE3sAAAAASUVORK5CYII=';
const sourceHash='ab'.repeat(32);
const document={...fixture,studentProfile:{...fixture.studentProfile,privateAdvisorNote:'NEVER_EMBED_ADVISOR_PRIVATE'},events:[...fixture.events.map(e=>({...e,provenance:[{sourceSha256:sourceHash,pageOrSlide:1,sourceText:'NEVER_EMBED_RAW_CV'}]})),{id:'hidden-event',title:'NEVER_EMBED_HIDDEN_FACT',categoryId:'work',eventType:'duration',startDate:'2025-01',endDate:'2025-03',visibilityState:'STUDENT_ONLY'}],mediaItems:[{id:'profile',type:'profilePhoto',placement:'profile',resolvedUrl:pixel,naturalAspect:1,crop:{x:20,y:80,zoom:2},visibilityState:'INTERVIEWER_SAFE'}],advanced:{textBlocks:[{id:'group-text',text:'Editable grouped note',x:1400,y:500,width:260,height:80,size:22,groupId:'proof-group'}],elements:[{id:'group-backing',kind:'rounded-rectangle',x:1390,y:490,width:290,height:100,fill:'#F5E47B',groupId:'proof-group'}],media:[],groups:[{id:'proof-group',children:['group-backing','group-text']} ]}};
const rendered=serializeFounderPresentation(document,{scope:'INTERVIEWER_SAFE',currentMonth:'2027-01'});
const artifact=await createEditableFounderPptx({svg:rendered.svg,document,resolveImage:async src=>{
  const pathname=src.slice(src.indexOf('assets/'));
  return'data:'+(pathname.endsWith('.png')?'image/png':'image/jpeg')+';base64,'+(await readFile(new URL('../web/'+pathname,import.meta.url))).toString('base64');
}});

test('native PPTX opens as valid OOXML with editable primitives, groups, crop and exact visible facts',async()=>{
  assert.equal(artifact.mimeType,EDITABLE_PPTX_MIME);assert.equal(artifact.editable,true);assert.equal(artifact.nativeKeynote,false);
  const result=await inspectEditablePptx(artifact.blob);assert.deepEqual(result.errors,[]);
  assert.ok(result.textCount>30);assert.ok(result.shapeCount>50);assert.ok(result.groupCount>10);assert.ok(result.cropCount>=1);
  assert.deepEqual(result.slideSizeEmu,{width:18288000,height:10287000});
  assert.deepEqual(result.recovery.facts.map(e=>e.id),fixture.events.map(e=>e.id));
  assert.equal(result.recovery.facts[0].startDate,'2019-08');assert.equal(result.recovery.facts[0].provenance[0].sourceSha256,sourceHash);
  assert.equal(result.recovery.authority.sourceSha256,FOUNDER_KEYNOTE_CONTRACT.source.sha256);
  assert.ok(result.recovery.groups.some(g=>g.id==='advanced-group:proof-group'));
  assert.doesNotMatch(JSON.stringify(result),/NEVER_EMBED/);
  assert.equal(createHash('sha256').update(JSON.stringify(result.recovery.facts)).digest('hex'),result.recovery.factsSha256);
});

test('PowerPoint crop preserves the original image and exact canonical crop offsets',async()=>{
  const zip=await JSZip.loadAsync(await artifact.blob.arrayBuffer());
  const tree=parsePresentationXml(await zip.file('ppt/slides/slide1.xml').async('string'));
  const crops=xmlNodes(tree,n=>n.tag==='a:srcRect');
  // Profile frame is 169x170, source is square, pan .2/.8, zoom 2.
  const expected={l:String(Math.round(((170-169/2)*.2)/170*100000)),t:'40000',r:String(Math.round(((170-169/2)*.8)/170*100000)),b:'10000'};
  assert.ok(crops.some(n=>JSON.stringify(n.attrs)===JSON.stringify(expected)),JSON.stringify(crops.map(n=>n.attrs)));
  const embedded=await Promise.all(Object.keys(zip.files).filter(p=>p.startsWith('ppt/media/')&&!zip.files[p].dir).map(p=>zip.file(p).async('uint8array')));
  const original=Uint8Array.from(atob(pixel.split(',')[1]),c=>c.charCodeAt(0));
  assert.ok(embedded.some(bytes=>Buffer.from(bytes).equals(Buffer.from(original))));
  assert.ok(xmlNodes(tree,n=>n.tag==='a:gradFill').length>0,'ribbon and arrow gradients remain native fills');
});

test('vertical milestone poles use native line geometry without a synthetic width or rotation',async()=>{
  const zip=await JSZip.loadAsync(await artifact.blob.arrayBuffer());
  const tree=parsePresentationXml(await zip.file('ppt/slides/slide1.xml').async('string'));
  const lines=xmlNodes(tree,n=>n.tag==='p:sp'&&xmlNodes(n,c=>c.tag==='a:prstGeom'&&c.attrs.prst==='line').length);
  const vertical=lines.filter(shape=>{const extent=xmlNodes(shape,n=>n.tag==='a:ext')[0]?.attrs;return extent?.cx==='0'&&Number(extent.cy)>0;});
  assert.ok(vertical.length>=1);
  for(const shape of vertical){
    const transform=xmlNodes(shape,n=>n.tag==='a:xfrm')[0].attrs;
    assert.ok(!transform.rot||Number(transform.rot)===0);
    assert.ok(!transform.flipH&&!transform.flipV);
    assert.equal(xmlNodes(shape,n=>n.tag==='a:custGeom').length,0);
  }
});

test('reopening an edited PPTX preserves the edit and treats recovery facts as a baseline',async()=>{
  const zip=await JSZip.loadAsync(await artifact.blob.arrayBuffer());
  const tree=parsePresentationXml(await zip.file('ppt/slides/slide1.xml').async('string'));
  const text=xmlNodes(tree,n=>n.tag==='a:t'&&xmlText(n).includes('Clinical Work'))[0];
  assert.ok(text);text.children=['Clinical Work edited in presentation'];
  const {serializePresentationXml}=await import('../web/js/presentation/presentation-xml.js');
  zip.file('ppt/slides/slide1.xml',serializePresentationXml(tree));
  const edited=await inspectEditablePptx(await zip.generateAsync({type:'uint8array'}));
  assert.ok(edited.text.includes('Clinical Work edited in presentation'));
  assert.equal(edited.recovery.facts.find(e=>e.id==='synthetic-work').title,'Clinical Work');
  assert.equal(edited.recovery.interpretation,'EXPORTED_BASELINE_REQUIRES_REVIEW_AGAINST_VISIBLE_EDITS');
});

test('final SVG geometry, rotation, curves and native group identity drive the export projection',()=>{
  const scene=resolveFounderPresentationSvg(rendered.svg,{advancedGroups:document.advanced.groups});
  const title=scene.nodes.find(n=>n.kind==='text'&&n.text.startsWith('Timeline:'));
  assert.equal(title.bounds.rotation,0);assert.ok(title.fontFamily.includes('American Typewriter'));
  assert.ok(scene.nodes.some(n=>n.kind==='path'&&n.commands.some(c=>c.curve?.type==='cubic')));
  assert.ok(scene.nodes.some(n=>Math.abs(n.bounds.rotation+10)<.001),'polaroid frame rotation remains exact');
  assert.equal(scene.groups.find(g=>g.id==='object:group-text').parentId,'advanced-group:proof-group');
  assert.ok(!scene.nodes.some(n=>n.sourceAttributes['data-axis-hit-target']));
  assert.throws(()=>parsePresentationXml('<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]><svg/>'),/DTD_DENIED/);
});

test('the existing export panel routes the new format through the audience-filtered render input',()=>{
  assert.equal(EXPORT_FORMATS.find(f=>f.id==='pptx-editable').kind,'PPTX');
  const input=buildExportPreviewInput(document,{formatId:'pptx-editable'});
  assert.equal(input.output.extension,'pptx');assert.equal(input.output.width,1920);
  assert.ok(!input.timeline.events.some(e=>e.id==='hidden-event'));
});

test('stored event scene does not erase a current annotation group on export',async()=>{
  const withScene={...document,advanced:{...document.advanced,scene:{groups:[]}}};
  const result=await createEditableFounderPptx({svg:rendered.svg,document:withScene,resolveImage:async src=>'data:'+(src.endsWith('.png')?'image/png':'image/jpeg')+';base64,'+(await readFile(new URL('../web/'+src.slice(src.indexOf('assets/')),import.meta.url))).toString('base64')});
  assert.ok(result.recovery.groups.some(group=>group.id==='advanced-group:proof-group'));
});

test('duration rotation applies once to banner, title and date in the canonical paint tree',()=>{
  const rotated={...document,advanced:{...document.advanced,scene:{schema:TIMELINE_SCENE_SCHEMA,version:TIMELINE_SCENE_VERSION,revision:1,board:{width:1920,height:1080},objects:[{id:'event-rotation',type:'event',semanticRef:'synthetic-work',geometry:{x:700,y:350,width:400,height:30,rotation:17},locked:false,aspectLocked:false,z:0,groupId:null,presentation:{}}],groups:[],legacyDigest:''}}};
  const result=serializeFounderPresentation(rotated,{scope:'INTERVIEWER_SAFE',currentMonth:'2027-01'});
  assert.match(result.svg,/data-event-id="synthetic-work"[^>]*transform="rotate\(17 900 365\)"/);
  const resolved=resolveFounderPresentationSvg(result.svg);
  const text=resolved.nodes.filter(n=>n.semanticRef==='synthetic-work'&&n.kind==='text');
  assert.ok(text.length>=2);
  assert.ok(text.every(n=>Math.abs(n.bounds.rotation-17)<.001));
  const arrow=resolved.nodes.find(n=>n.semanticRef==='synthetic-work'&&n.sourceAttributes['data-continuous-duration-arrow']);
  assert.ok(arrow.bounds.height>30,'native path bounds include the transformed banner');
});

test('year-only facts remain year-only in shared captions, accessibility and editable baseline',async()=>{
  const years={...document,events:[
    {id:'year-volunteer',title:'Volunteer',categoryId:'personal',eventType:'duration',startDate:'2019-01',endDate:'2021-12',fields:{datePrecision:{start:'YEAR',end:'YEAR'}}},
    {id:'year-publication',title:'Publication',categoryId:'research',eventType:'milestone',startDate:'2023-01',fields:{datePrecision:{start:'YEAR',end:null}}},
    {id:'mixed-precision',title:'Mixed precision',categoryId:'work',eventType:'duration',startDate:'2017-04',endDate:'2018-12',fields:{datePrecision:{start:'MONTH',end:'YEAR'}}}
  ]};
  const result=serializeFounderPresentation(years,{scope:'INTERVIEWER_SAFE',currentMonth:'2027-01'});
  const scene=resolveFounderPresentationSvg(result.svg);
  const visible=id=>scene.nodes.filter(n=>n.semanticRef===id&&n.kind==='text').map(n=>n.text);
  assert.ok(visible('year-volunteer').includes('2019 - 2021'));
  assert.ok(visible('year-publication').includes('2023'));
  assert.ok(visible('mixed-precision').includes('4/17 - 2018'));
  assert.match(result.svg,/aria-label="Volunteer,[^"]*2019 to 2021/);
  assert.doesNotMatch(result.svg,/aria-label="(?:Volunteer|Publication),[^\"]*(?:Jan|Dec)/);
  const native=await createEditableFounderPptx({svg:result.svg,document:years,resolveImage:async src=>'data:'+(src.endsWith('.png')?'image/png':'image/jpeg')+';base64,'+(await readFile(new URL('../web/'+src.slice(src.indexOf('assets/')),import.meta.url))).toString('base64')});
  assert.deepEqual(native.recovery.facts.find(e=>e.id==='year-volunteer').datePrecision,{start:'YEAR',end:'YEAR'});
  assert.ok(native.validation.text.includes('2019 - 2021'));
});

test('accepted exam scores follow both exam consent and current linked event visibility',()=>{
  const examEvent={id:'accepted-exam',title:'Step 2 CK',categoryId:'exams',eventType:'milestone',startDate:'2025-01',visibilityState:'ADVISOR_ONLY'};
  const exam={system:'USMLE',examId:'step-2-ck',score:'273',sourceType:'document-intake',sourceEventId:examEvent.id,visibilityState:'ADVISOR_ONLY'};
  const guarded={...document,events:[examEvent],exams:[exam]};
  assert.equal(projectFounderPresentationDocument(guarded,{scope:'INTERVIEWER_SAFE'}).exams.length,0);
  assert.equal(projectFounderPresentationDocument(guarded,{scope:'ADVISOR_PACKET'}).exams.length,1);
  assert.doesNotMatch(serializeFounderPresentation(guarded,{scope:'INTERVIEWER_SAFE'}).svg,/>273</);
  assert.match(serializeFounderPresentation(guarded,{scope:'ADVISOR_PACKET'}).svg,/>273</);
  const staleConsent={...guarded,exams:[{...exam,visibilityState:'INTERVIEWER_SAFE'}]};
  assert.equal(projectFounderPresentationDocument(staleConsent,{scope:'INTERVIEWER_SAFE'}).exams.length,0,'later event privacy changes take precedence over copied exam visibility');
});

test('interleaved logical group members preserve native slide stacking instead of regrouping over another object',async()=>{
  const svg='<svg viewBox="0 0 1920 1080"><g data-scene-object="back"><rect x="50" y="50" width="100" height="100" fill="#FF0000"/></g><g data-scene-object="middle"><rect x="75" y="75" width="100" height="100" fill="#00FF00"/></g><g data-scene-object="front"><text x="80" y="120" font-size="20">Front</text></g></svg>';
  const artifact=await createEditableFounderPptx({svg,document:{advanced:{groups:[{id:'logical',children:['back','front']}]}}});
  const zip=await JSZip.loadAsync(await artifact.blob.arrayBuffer());
  const tree=parsePresentationXml(await zip.file('ppt/slides/slide1.xml').async('string'));
  const objects=xmlNodes(tree,n=>n.tag==='p:cNvPr'&&String(n.attrs.name).startsWith('MM:annotation:')).map(n=>n.attrs.name.split(':')[3]);
  assert.deepEqual(objects,['back','middle','front']);
  assert.deepEqual(artifact.recovery.separatedNativeGroups,['advanced-group:logical']);
  assert.match(artifact.warnings.join(' '),/preserve their stacking order/);
});

test('transferring a canvas image into a frame removes its free picture from canonical SVG and editable PPTX',async()=>{
  const source={...fixture,layoutLock:false,mode:'advanced',mediaItems:[],advanced:{media:[{id:'transfer-image',placed:true,source:{url:pixel,name:'synthetic.png'},x:700,y:450,width:300,height:180}],textBlocks:[],elements:[],groups:[]}};
  const before=await serializeFounderPresentationAsync(source,{mediaResolver:async()=>pixel});
  assert.match(before.svg,/data-advanced-media="transfer-image"/);
  const result=fillCanonicalMediaFrame(source,'profile','transfer-image',{id:'profile-transfer',consumePlacement:true});
  assert.equal(result.changed,true);assert.equal(result.document.advanced.media[0].placed,false);
  const after=await serializeFounderPresentationAsync(result.document,{mediaResolver:async()=>pixel});
  assert.doesNotMatch(after.svg,/data-advanced-media="transfer-image"/);
  assert.equal(after.scene.mediaProjection.profilePhoto.source,pixel,'the unplaced library bytes still resolve in the assigned frame');
  assert.equal(after.scene.founderPresentation.advancedScene.objects.filter(o=>o.type==='media').length,0);
  const artifact=await createEditableFounderPptx({svg:after.svg,document:result.document,resolveImage:async src=>'data:'+(src.endsWith('.png')?'image/png':'image/jpeg')+';base64,'+(await readFile(new URL('../web/'+src.slice(src.indexOf('assets/')),import.meta.url))).toString('base64')});
  assert.ok(!artifact.recovery.objects.some(object=>object.groupId==='object:transfer-image'));
  const original=Uint8Array.from(atob(pixel.split(',')[1]),c=>c.charCodeAt(0));
  const zip=await JSZip.loadAsync(await artifact.blob.arrayBuffer());
  const matches=await Promise.all(Object.keys(zip.files).filter(name=>name.startsWith('ppt/media/')&&!zip.files[name].dir).map(async name=>Buffer.from(await zip.file(name).async('uint8array')).equals(Buffer.from(original))));
  assert.equal(matches.filter(Boolean).length,1,'one native image asset remains for the filled frame');
  assert.equal(artifact.validation.errors.length,0);
  assert.equal(source.advanced.media[0].placed,true,'projection and frame transfer preserve the original undo state');
});
