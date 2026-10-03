import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {analyzeTimelineQuality,applySafeQualityFixes} from '../web/js/uxr-002/quality-guardian.js';
import {analyzeCollisionLayout} from '../web/js/editor/collision-engine-410.js';
import {serializeFounderPresentation} from '../web/js/presentation/founder-presentation-serializer.js';
import {locked407FMilestoneGeometry} from '../web/js/uxr-002/locked-407f-export.js';
import {applySceneCommandToDocument} from '../web/js/editor/scene-commands.js';

const fixture=JSON.parse(await readFile(new URL('fixtures/d1-timeline-astra-021/golden2-guardian-milestones.json',import.meta.url),'utf8'));
const collisionOnly=document=>{const report=analyzeTimelineQuality(document);return{...report,findings:report.findings.filter(finding=>finding.code==='COLLISION_RISK')};};

test('021 automatic flag composition leaves residual collisions gated without changing source or authored geometry',()=>{
  const document=structuredClone(fixture.document),before=JSON.stringify(document);
  const originalSvg=serializeFounderPresentation(document,{scope:'FULL_STORY'}).svg;
  const original=analyzeCollisionLayout(document);
  assert.ok(original.stats.collisionCount>0);
  const fixed=applySafeQualityFixes(document,collisionOnly(document));
  assert.equal(fixed.changed,false,'no safe move may be invented after automatic composition');
  assert.equal(analyzeCollisionLayout(fixed.document).stats.collisionCount,original.stats.collisionCount);
  assert.ok(analyzeTimelineQuality(fixed.document).findings.some(f=>f.code==='COLLISION_RISK'));
  for(const flag of original.boxes.filter(b=>b.kind==='milestone'))assert.ok(flag.y>=0&&flag.y+flag.h<125,'General milestone stays above the ribbon');
  assert.deepEqual(fixed.document.events,document.events);
  assert.deepEqual(fixed.document.exams,document.exams);
  assert.deepEqual(fixed.document.studentProfile,document.studentProfile);
  assert.equal(JSON.stringify(document),before,'Proposal creation cannot mutate the source document');
  const overrides=fixed.document.advanced.scene.objects.filter(object=>object.type==='event');
  assert.equal(overrides.length,0);
  const resultSvg=serializeFounderPresentation(fixed.document,{scope:'FULL_STORY'}).svg;
  assert.equal(resultSvg,originalSvg);
  const preservedNote=fixed.document.advanced.scene.objects.find(object=>object.type==='text');
  assert.equal(preservedNote.presentation.text,document.advanced.scene.objects.find(object=>object.type==='text').presentation.text);
  assert.deepEqual(preservedNote.geometry,document.advanced.scene.objects.find(object=>object.type==='text').geometry);
  const second=applySafeQualityFixes(fixed.document,collisionOnly(fixed.document));
  assert.equal(second.changed,false,'A bounded repair must not keep rearranging flags when no safe improvement exists');
});

test('021 Guardian respects explicit manual flag geometry and returns an unchanged proposal when no safe move is owned',()=>{
  let document=structuredClone(fixture.document);
  const scene=serializeFounderPresentation(document,{scope:'FULL_STORY'}).scene;
  for(const flag of scene.flags){
    const geometry=locked407FMilestoneGeometry(scene,flag.id);
    document=applySceneCommandToDocument(document,{kind:'geometry',target:{type:'event',id:flag.id},geometry,create:{type:'event',semanticRef:flag.id,presentation:{eventType:'milestone'}}}).document;
  }
  const before=JSON.stringify(document);
  assert.ok(analyzeCollisionLayout(document).stats.collisionCount>0);
  const result=applySafeQualityFixes(document,collisionOnly(document));
  assert.equal(result.changed,false);
  assert.equal(JSON.stringify(result.document),before);
});

test('021 empty Founder layout stays unchanged with zero collision warnings',()=>{
  const document={id:'blank',events:[],advanced:{media:[],textBlocks:[],elements:[],groups:[]},theme:'keynote-classic'};
  const result=applySafeQualityFixes(document,collisionOnly(document));
  assert.equal(result.changed,false);
  assert.equal(analyzeCollisionLayout(document).stats.collisionCount,0);
});
