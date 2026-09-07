import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import {analyzeTimelineQuality,applySafeQualityFixes} from '../web/js/uxr-002/quality-guardian.js';
import {createMediaElement} from '../web/js/uxr-002/advanced-studio.js';
import {reconcileAdvancedScene,sceneGraphFromLegacy} from '../web/js/editor/scene-graph.js';
import {applyDocumentTo407FState,apply407FStateToDocument} from '../web/js/407f-engineering-adapter.js';
import {serializeFounderPresentation} from '../web/js/presentation/founder-presentation-serializer.js';
import {locked407FMilestoneGeometry} from '../web/js/uxr-002/locked-407f-export.js';

const fixture=JSON.parse(await readFile(new URL('fixtures/d1-timeline-astra-021/golden2-guardian-milestones.json',import.meta.url),'utf8'));
const adapter=await readFile(new URL('../web/js/407f-engineering-adapter.js',import.meta.url),'utf8');
const eventOverrides=d=>d.advanced.scene.objects.filter(o=>o.type==='event').map(o=>({id:o.id,semanticRef:o.semanticRef,geometry:o.geometry,presentation:o.presentation}));
function fixedGolden(){
  const document=structuredClone(fixture.document),report=analyzeTimelineQuality(document);
  const fixed=applySafeQualityFixes(document,{...report,findings:report.findings.filter(f=>f.code==='COLLISION_RISK')});
  assert.equal(fixed.changed,true);
  assert.equal(eventOverrides(fixed.document).length,2);
  return fixed.document;
}

test('021 actual Add image callback retains Guardian flag geometry, anchors and facts',async()=>{
  const document=fixedGolden(),before=structuredClone(document),mutations=[];
  const source={name:'synthetic-added-image.png',type:'image/png',size:100};
  const context={store:{document,async mutateWithBlobs(label,mutator){mutations.push(label);mutator(document);}},
    chooseLocalFile:async()=>source,uid:()=> 'added-synthetic-image',imageMetrics:async()=>({width:200,height:120}),createMediaElement,
    nextAdvancedLayerIndex:()=>20,sha256File:async()=> 'a'.repeat(64),prepareMediaPersistence:async()=>({source:{name:source.name,localOnly:true,contentSha256:'a'.repeat(64)},blob:{},rollback(){throw new Error('Unexpected rollback');}}),
    reconcileAdvancedScene,sceneGraphFromLegacy,mediaUrls:new Map(),syncBridgeStateFromStore(){},canvasController:{setUiState(){}}};
  vm.createContext(context);
  vm.runInContext(adapter.slice(adapter.indexOf('  const addAdvancedMedia=async(kind)=>{'),adapter.indexOf('  const addAdvancedBackground=async(file)=>{')),context);
  await vm.runInContext('addAdvancedMedia("image")',context);
  assert.deepEqual(mutations,['Add image']);
  assert.equal(document.advanced.media.length,before.advanced.media.length+1);
  assert.deepEqual(eventOverrides(document),eventOverrides(before));
  assert.deepEqual(document.events,before.events);
  assert.deepEqual(document.exams,before.exams);
  assert.deepEqual(document.studentProfile,before.studentProfile);
  for(const id of eventOverrides(before).map(o=>o.semanticRef)){
    const oldScene=serializeFounderPresentation(before,{scope:'FULL_STORY'}).scene;
    const newScene=serializeFounderPresentation(document,{scope:'FULL_STORY'}).scene;
    assert.deepEqual(locked407FMilestoneGeometry(newScene,id),locked407FMilestoneGeometry(oldScene,id),'Canonical flag geometry must survive new media');
  }
  assert.equal(sceneGraphFromLegacy(document.advanced).objects.filter(o=>o.type==='event').length,0,'Preserve the exact old rebuilding defect in the regression');
});

test('021 Builder score preference roundtrip retains the existing Guardian offsets',()=>{
  const document=fixedGolden(),before=eventOverrides(document);
  const state=applyDocumentTo407FState(document,{user:{},builder:{},profile:{},wiz:{}});
  const exam=state.builder.exams.find(e=>e.examId==='step-2-ck');
  assert.ok(exam);exam.showScoreOnTimeline=true;exam.showScoreTouched=true;
  apply407FStateToDocument(state,document);
  assert.deepEqual(eventOverrides(document),before);
  assert.equal(document.exams.find(e=>e.examId==='step-2-ck').showScoreOnTimeline,true);
});
