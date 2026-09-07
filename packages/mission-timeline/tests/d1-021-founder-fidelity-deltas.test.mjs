import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {serializeFounderPresentation} from '../web/js/presentation/founder-presentation-serializer.js';
import {resolveFounderPresentationSvg} from '../web/js/presentation/resolved-founder-presentation.js';
import {createEditableFounderPptx,inspectEditablePptx} from '../web/js/presentation/editable-pptx.js';
import {normalizeExplanationEvent,layoutExplanationText} from '../web/js/uxr-002/explanation.js';
import {canvasEffectiveHitGeometry,canvasPaintHitPath} from '../web/js/uxr-002/canvas.js';
import {buildKeynoteClassicScene} from '../web/js/uxr-002/board-renderer.js';
import {buildExportPreviewInput} from '../web/js/uxr-002/export-screen.js';
import {JSZip} from '../web/vendor/presentation/pptx-runtime.js';
import {TIMELINE_SCENE_SCHEMA,TIMELINE_SCENE_VERSION} from '../web/js/editor/scene-graph.js';

// Authored through normal Builder controls. Every biography and exam is synthetic.
const document=JSON.parse(await readFile(new URL('./fixtures/d1-timeline-astra-021/fidelity-required-authored.json',import.meta.url),'utf8'));
const rescuedExam=JSON.parse(await readFile(new URL('./fixtures/d1-timeline-astra-021/rescue-result-provenance-authored.json',import.meta.url),'utf8'));
const personal=document.events.filter(e=>e.categoryId==='personal'&&e.eventType==='duration');
const note=document.events.find(e=>e.fields?.builderDomain==='explanation');
const render=doc=>serializeFounderPresentation(doc,{scope:'INTERVIEWER_SAFE',currentMonth:'2026-09'});
const resolved=doc=>resolveFounderPresentationSvg(render(doc).svg);
const arrow=(nodes,id)=>nodes.find(n=>n.semanticRef===id&&n.sourceAttributes['data-continuous-duration-arrow']);
function override(doc,id,geometry){
  doc.advanced={...doc.advanced,scene:{schema:TIMELINE_SCENE_SCHEMA,version:TIMELINE_SCENE_VERSION,revision:1,board:{width:1920,height:1080},objects:[{id:'event:'+id,type:'event',semanticRef:id,geometry,locked:false,aspectLocked:false,z:0,groupId:null,presentation:{}}],groups:[],legacyDigest:''}};
}
function separatedNote(){
  const doc=structuredClone(document);
  override(doc,note.id,{x:1470,y:674,width:180,height:166,rotation:8});
  return doc;
}

test('exact adjacent personal phases form one segmented band without changing chronology or canonical records',()=>{
  const before=JSON.stringify(document),out=render(document),nodes=resolveFounderPresentationSvg(out.svg).nodes;
  const [a,b]=personal.map(e=>arrow(nodes,e.id));
  assert.equal(a.bounds.y,b.bounds.y);assert.ok(Math.abs(a.bounds.x+a.bounds.width-b.bounds.x)<.03);
  assert.equal(nodes.filter(n=>n.sourceAttributes['data-personal-band-separator']).length,1);
  // Break adjacency while preserving the auto axis span; removing the last
  // phase would legitimately shrink the span from four years to two.
  const isolated=structuredClone(document);isolated.events.find(e=>e.id===personal[1].id).startDate='2022-02';
  const independent=arrow(resolved(isolated).nodes,personal[0].id);
  assert.equal(a.bounds.x,independent.bounds.x);assert.equal(a.bounds.width,independent.bounds.width);
  for(const event of personal){
    const phase=out.scene.arrows.find(a=>a.id===event.id);
    assert.deepEqual([phase.startMonth,phase.endMonth],[event.startDate,event.endDate]);
    assert.ok(nodes.some(n=>n.semanticRef===event.id&&n.sourceAttributes['data-arrow-caption']));
  }
  assert.equal(a.commands.filter(c=>!c.close).length,4,'Internal segment ends square at its exact boundary');
  assert.equal(b.commands.filter(c=>!c.close).length,5,'The last phase retains the Founder arrow tip');
  assert.equal(JSON.stringify(document),before);
});

test('a visible sticky receives its own ordered hit proxy at every zoom, bounded to its card rather than its leader',()=>{
  const cardBox={left:966.7247,top:281.7701,width:116.3007,height:54.3755};
  const card={getBoundingClientRect:()=>cardBox};
  const sticky={querySelector:()=>card,getBoundingClientRect:()=>({left:650,top:260,width:480,height:330})};
  const bounds=canvasEffectiveHitGeometry(sticky,{left:100,top:200});
  assert.deepEqual(bounds,{left:cardBox.left-100,top:cardBox.top-200,width:cardBox.width,height:cardBox.height,sourceWidth:cardBox.width,sourceHeight:cardBox.height});
  const enlarged=canvasEffectiveHitGeometry({querySelector:()=>null,getBoundingClientRect:()=>({left:10,top:20,width:100,height:9})});
  assert.deepEqual(enlarged,{left:10,top:2.5,width:100,height:44,sourceWidth:100,sourceHeight:9});
  assert.equal(canvasEffectiveHitGeometry({getBoundingClientRect:()=>({left:0,top:0,width:100,height:100})}).width,100);
  const handle=canvasEffectiveHitGeometry({hasAttribute:name=>name==='data-drag-kind',getBoundingClientRect:()=>({left:40,top:50,width:44,height:44})});
  assert.deepEqual(handle,{left:40,top:50,width:44,height:44,sourceWidth:44,sourceHeight:44});
  assert.equal(canvasEffectiveHitGeometry(null),null);
});

test('exact hit contours omit the empty space between chronology caption and label',()=>{
  const rect=(left,top,width,height)=>({getBoundingClientRect:()=>({left,top,width,height})});
  const target={getBoundingClientRect:()=>({left:100,top:100,width:200,height:50}),querySelectorAll:()=>[rect(100,100,40,10),rect(220,130,80,20)]};
  const box=canvasEffectiveHitGeometry(target);
  assert.equal(canvasPaintHitPath(target,box),'M0 0h40v10h-40Z M120 30h80v20h-80Z');
});

test('gaps, overlaps, hidden phases and explicit manual positioning never fabricate continuous personal history',()=>{
  for(const change of [e=>e.startDate='2022-02',e=>e.startDate='2021-12',e=>e.visibilityState='ADVISOR_ONLY']){
    const doc=structuredClone(document);change(doc.events.find(e=>e.id===personal[1].id));
    assert.doesNotMatch(render(doc).svg,/data-personal-band-separator/);
  }
  const moved=structuredClone(document);override(moved,personal[1].id,{x:750,y:640,width:520,height:30,rotation:0});
  const paint=resolved(moved);assert.doesNotMatch(render(moved).svg,/data-personal-band-separator/);
  assert.deepEqual(arrow(paint.nodes,personal[1].id).bounds,{x:750,y:640,width:520,height:30,rotation:0});
});

test('only explicit exam results color native pennants; score, title and attempt order cannot imply success',()=>{
  const out=render(document),nodes=resolveFounderPresentationSvg(out.svg).nodes;
  for(const [result,color] of [['Failed','#C92113'],['Passed','#379B43']]){
    const event=document.events.find(e=>e.eventType==='milestone'&&e.fields?.result===result);
    assert.ok(nodes.some(n=>n.semanticRef===event.id&&n.kind==='path'&&n.style.fill===color));
    const flag=out.scene.flags.find(f=>f.id===event.id),study=out.scene.arrows.find(a=>a.study&&a.examAttemptId===flag.examAttemptId);
    assert.ok(study);const studyPaint=arrow(nodes,study.id),pole=nodes.find(n=>n.semanticRef===event.id&&n.lineOnly);
    assert.equal(pole.commands.at(-1).y,studyPaint.bounds.y);
    assert.ok(pole.bounds.y>170,'Attempt flags remain above their study window, clear of the title plaque');
  }
  const unknown=structuredClone(document);unknown.exams=[];
  unknown.events=unknown.events.map(e=>e.categoryId==='exams'?{...e,title:'Passed in title is not evidence',result:undefined,fields:{...e.fields,result:undefined,score:'299'}}:e);
  const uncertain=render(unknown);assert.doesNotMatch(uncertain.svg,/data-exam-result=/);
  for(const event of unknown.events.filter(e=>e.categoryId==='exams'&&e.eventType==='milestone')){
    assert.ok(resolveFounderPresentationSvg(uncertain.svg).nodes.some(n=>n.semanticRef===event.id&&n.kind==='path'&&n.style.fill==='#A6AAAE'));
  }
});

test('private result provenance neutralizes the flag at every shared export boundary and native XML without changing its permitted chronology',async()=>{
  for(const source of [document,rescuedExam]){
  const doc=structuredClone(source),exam=doc.exams.find(e=>e.result==='Passed');
  exam.fieldProvenance={result:{sourceType:'manual',visibilityState:'ADVISOR_ONLY'}};
  const before=JSON.stringify(doc),event=doc.events.find(e=>(e.fields?.attemptId===exam.id||e.id===exam.sourceEventId)&&e.eventType==='milestone');
  for(const scope of ['INTERVIEWER_SAFE','PRINT','ACCESSIBLE','EVERYTHING']){
    const out=serializeFounderPresentation(doc,{scope,currentMonth:'2026-09'});
    const flag=out.scene.flags.find(f=>f.id===event.id);
    assert.equal(flag.examResult,scope==='EVERYTHING'?'Passed':null);
    assert.equal(flag.month,event.startDate);
    assert.equal(flag.title,scope==='EVERYTHING'?event.title:event.title.replace(/ — Pass$/,''));
    if(scope!=='EVERYTHING')assert.doesNotMatch(flag.ariaLabel,/\bPass(?:ed)?\b/);
  }
  assert.equal(buildKeynoteClassicScene(doc,{currentMonth:'2026-09',audience:'INTERVIEWER_SAFE'}).flags.find(f=>f.id===event.id).examResult,null);
  const preview=buildExportPreviewInput(doc);
  assert.equal(buildKeynoteClassicScene(preview.timeline,{...preview.rendererOptions,currentMonth:'2026-09'}).flags.find(f=>f.id===event.id).examResult,null);
  const out=render(doc),artifact=await createEditableFounderPptx({svg:out.svg,document:doc,resolveImage:async src=>{
    const path=src.slice(src.indexOf('assets/'));
    return'data:'+(path.endsWith('.png')?'image/png':'image/jpeg')+';base64,'+(await readFile(new URL('../web/'+path,import.meta.url))).toString('base64');
  }});
  const zip=await JSZip.loadAsync(await artifact.blob.arrayBuffer());
  for(const file of Object.values(zip.files).filter(f=>!f.dir&&f.name.endsWith('.xml'))){
    const contents=await file.async('string');assert.doesNotMatch(contents,/\bPass(?:ed)?\b|379B43/,file.name);
  }
  assert.equal(JSON.stringify(doc),before);
  }
});

test('full-length explanations and long words remain within a readable card and the board',()=>{
  const cases=[
    ['During this period I supported my family while studying for board examinations and volunteering at a community clinic. I maintained clinical reading and returned to full time work.',132,96],
    ['Electroencephalography and electrophysiology supported this synthetic clinical learning period.',180,166],
    ['W'.repeat(180),132,96]
  ];
  for(const [text,width,height] of cases){
    const box=layoutExplanationText(text,{width,height,x:1744,y:904});
    assert.equal(box.lines.join('').replace(/\s/g,''),text.replace(/\s/g,''));
    assert.ok(box.fontSize>=12);
    assert.ok(box.lines.every(line=>line.length*box.fontSize*.57<=box.width-28));
    assert.ok(box.lines.length*box.fontSize*1.12<=box.height-28);
    const angle=8*Math.PI/180;
    assert.ok(box.x+box.width/2+(box.width*Math.cos(angle)+box.height*Math.sin(angle))/2<=1920+.00001);
    assert.ok(box.y+box.height/2+(box.width*Math.sin(angle)+box.height*Math.cos(angle))/2<=1080+.00001);
    const normalized=normalizeExplanationEvent({title:text,fields:{width,height,x:1744,y:904}});
    assert.equal(normalized.fields.height,box.height);assert.equal(normalized.fields.y,box.y);
  }
});

test('explanatory note is complete rotated serif text with vector card and leader attached to final rendered personal phase',()=>{
  const placed=separatedNote(),nodes=resolved(placed).nodes,card=nodes.find(n=>n.sourceAttributes['data-explanation-card']);
  const lines=nodes.filter(n=>n.sourceAttributes['data-explanation-text']);
  assert.equal(lines.map(n=>n.text).join(' '),note.fields.explanationText);
  assert.ok(lines.every(n=>n.fontFamily==='Baskerville'&&n.fontSize>=19.99&&Math.abs(n.bounds.rotation-8)<.001));
  assert.equal(card.style.fill,'#FFF1A0');assert.equal(card.kind,'shape');
  const leader=nodes.find(n=>n.sourceAttributes['data-explanation-leader']),head=nodes.find(n=>n.sourceAttributes['data-explanation-arrowhead']);
  assert.ok(leader&&head);assert.equal(leader.style.stroke,'#C73A25');
  assert.deepEqual(head.commands[1],leader.commands.at(-1));
  const box=arrow(nodes,note.fields.target.eventId).bounds,end=leader.commands.at(-1);
  assert.ok(end.x>=box.x-.001&&end.x<=box.x+box.width+.001&&end.y>=box.y-.001&&end.y<=box.y+box.height+.001);
  assert.ok(Math.min(Math.abs(end.x-box.x),Math.abs(end.x-box.x-box.width),Math.abs(end.y-box.y),Math.abs(end.y-box.y-box.height))<.001);
  const moved=structuredClone(document);override(moved,note.id,{x:1300,y:700,width:180,height:166,rotation:-6});
  const after=resolved(moved).nodes,changed=after.find(n=>n.sourceAttributes['data-explanation-card']);
  assert.equal(changed.bounds.rotation,-6);assert.equal(after.filter(n=>n.sourceAttributes['data-explanation-text']).map(n=>n.text).join(' '),note.fields.explanationText);
  assert.deepEqual(moved.events,document.events,'Move and resize only touch presentation geometry');
  const fresh=normalizeExplanationEvent({title:'An explicitly authored synthetic explanation'});
  assert.deepEqual([fresh.fields.width,fresh.fields.height,fresh.fields.x,fresh.fields.y],[180,166,1470,674]);
});

test('native PPTX reopens with separate editable personal groups, yellow note shapes/text and explicit-result colors',async()=>{
  const placed=separatedNote(),before=JSON.stringify(placed),out=render(placed);
  const artifact=await createEditableFounderPptx({svg:out.svg,document:placed,resolveImage:async src=>{
    const path=src.slice(src.indexOf('assets/'));
    return 'data:'+(path.endsWith('.png')?'image/png':'image/jpeg')+';base64,'+(await readFile(new URL('../web/'+path,import.meta.url))).toString('base64');
  }});
  const reopened=await inspectEditablePptx(artifact.blob);assert.deepEqual(reopened.errors,[]);
  assert.ok(reopened.shapeCount>50&&reopened.textCount>20&&reopened.groupCount>10);
  for(const event of placed.events.filter(e=>e.id!==note.id)){const fact=reopened.recovery.facts.find(f=>f.id===event.id);assert.ok(fact,event.id);assert.deepEqual([fact.title,fact.startDate,fact.endDate],[event.title,event.startDate,event.endDate]);}
  assert.ok(!reopened.recovery.facts.some(f=>f.id===note.id),'An explanatory note stays presentation content, never a fabricated CV fact');
  const objects=reopened.recovery.objects;
  for(const event of personal)assert.ok(objects.some(n=>n.semanticRef===event.id&&n.kind==='path'));
  assert.ok(objects.some(n=>n.semanticRef===note.id&&n.kind==='shape'));
  assert.ok(objects.filter(n=>n.semanticRef===note.id&&n.kind==='text').length>=2);
  assert.ok(objects.filter(n=>n.semanticRef===note.id&&n.kind==='path').length>=2);
  assert.equal(JSON.stringify(placed),before);
});

test('denim vignette is the exact pinned source asset, with no second unapproved darkening layer',async()=>{
  const board=await readFile(new URL('../web/assets/founder_keynote_2024/background/Magnetboard-1920-107.jpg',import.meta.url));
  assert.equal(createHash('sha256').update(board).digest('hex'),'f5d28c36504ea8fa0b54a55975b493bd9a0c1d6948ca447eb88a9198b8777cc1');
  const nodes=resolved(document).nodes,full=nodes.filter(n=>n.bounds.x<=1&&n.bounds.y<=1&&n.bounds.width>=1918&&n.bounds.height>=1078);
  assert.ok(full.some(n=>n.kind==='image'&&n.source.endsWith('Magnetboard-1920-107.jpg')));
  assert.ok(!full.some(n=>n.kind==='shape'&&['black','#000000','#000'].includes(n.style.fill)));
});
