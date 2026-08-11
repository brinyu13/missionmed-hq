import test from 'node:test';
import assert from 'node:assert/strict';

import { VisionEpisodeAnalyzer } from '../../analytics/episode-detectors.mjs';
import { assertCompactGeometry, deriveCompactGeometry, facialMovementRate, normalizedTemporalDelta } from '../../analytics/vision-geometry.mjs';

function sourceResult() {
  const face = Array(200).fill(null);face[33]={x:.42,y:.35};face[263]={x:.58,y:.35};face[1]={x:.5,y:.43};face[152]={x:.5,y:.58};
  const pose = Array(25).fill(null);pose[11]={x:.4,y:.45,visibility:1};pose[12]={x:.6,y:.45,visibility:1};pose[23]={x:.43,y:.75,visibility:1};pose[24]={x:.57,y:.75,visibility:1};
  const hand = Array(21).fill(null);hand[0]={x:.45,y:.55};hand[8]={x:.45,y:.4};hand[20]={x:.5,y:.4};
  return { faceLandmarks:[face],poseLandmarks:[pose],leftHandLandmarks:[hand],rightHandLandmarks:[],faceBlendshapes:[{categories:[{score:.2},{score:.1}]}] };
}

function compact(overrides = {}) {
  return {
    faceCount: 1,
    face: { present:true,box:{centerX:.5,centerY:.4,width:.3},yawProxyDeg:0,pitchProxyDeg:0,rollProxyDeg:0,movementRatePerSecond:0 },
    pose: { torsoPresent:true,shoulderWidth:.2,centerX:.5,centerY:.45,lateralLeanDeg:0 },
    hands: { left:{present:true,wristX:.4,wristY:.5,zone:'chest'},right:{present:false} },
    ...overrides,
  };
}

const primaryLock=(overrides={})=>({state:'PRIMARY_LOCKED',zoneStatus:'primary_inside',continuity:'locked',bystanderCount:0,excludedDurationMs:0,reacquisitionCount:0,selectionRequired:false,withheldIntervals:[],...overrides});

test('derives bounded geometry without raw landmarks', () => {
  const value = deriveCompactGeometry(sourceResult(), { faceCount: 1 });
  assert.equal(value.face.present, true);
  assert.ok(Math.abs(value.pose.lateralLeanDeg) < 0.01);
  assert.equal(value.hands.left.zone, 'chest');
  assert.equal(assertCompactGeometry(value), true);
  assert.doesNotMatch(JSON.stringify(value), /landmark|blendshape/iu);
});

test('sustained lean emits an episode while one frame does not stretch', () => {
  const transient = new VisionEpisodeAnalyzer();transient.begin(0);
  transient.ingest({atMs:0,geometry:compact({pose:{...compact().pose,lateralLeanDeg:20}})});
  transient.ingest({atMs:125,geometry:compact()});
  assert.equal(transient.finish(1_000).episodes.filter((event)=>event.metric==='lateral_torso_lean').length,0);
  const sustained = new VisionEpisodeAnalyzer();sustained.begin(0);
  for(let at=0;at<=875;at+=125)sustained.ingest({atMs:at,geometry:compact({pose:{...compact().pose,lateralLeanDeg:20}}),inferenceMs:(at/125)+1});
  const result=sustained.finish(1_000);
  assert.equal(result.durationMs,1_000);
  assert.equal(result.episodes.filter((event)=>event.metric==='lateral_torso_lean').length,1);
});

test('multi-face and unresolved face protection fail closed', () => {
  for (const faceCount of [2, null, 0]) {
    const analyzer=new VisionEpisodeAnalyzer();analyzer.begin(0);
    for(let at=0;at<1_000;at+=125)analyzer.ingest({atMs:at,geometry:compact({faceCount})});
    const result=analyzer.finish(1_000);
    assert.equal(result.personSpecificAvailable,false);
  }
});

test('locked primary geometry remains analyzable when a bystander is present',()=>{
  const analyzer=new VisionEpisodeAnalyzer();analyzer.begin(0);
  for(let at=0;at<1_000;at+=125)analyzer.ingest({
    atMs:at,
    geometry:compact({faceCount:2,primaryAssociated:true}),
    primaryLock:primaryLock({bystanderCount:1,continuity:'locked_bystander_excluded'}),
  });
  const result=analyzer.finish(1_000);
  assert.equal(result.personSpecificAvailable,true);
  assert.equal(result.facePresenceRatio,1);
  assert.equal(result.maximumBystanderCount,1);
  assert.equal(result.bystanderFrames,8);
  assert.equal(result.primaryLock.bystanderCount,1);
});

test('static facial geometry is not facial movement and gaps break episodes', () => {
  const analyzer=new VisionEpisodeAnalyzer();analyzer.begin(0);
  for(let at=0;at<=1_000;at+=125)analyzer.ingest({atMs:at,geometry:compact()});
  assert.equal(analyzer.finish(1_125).episodes.filter((event)=>event.metric==='facial_movement_episode').length,0);
  const gap=new VisionEpisodeAnalyzer();gap.begin(0);
  for(let at=0;at<=375;at+=125)gap.ingest({atMs:at,geometry:compact({hands:{left:{present:true,wristX:at%250?0.5:0.4,wristY:.5,zone:'chest'},right:{present:false}}})});
  gap.ingest({atMs:3_000,geometry:compact()});
  const result=gap.finish(3_125);
  assert.equal(result.episodes.some((event)=>event.metric==='hand_motion_episode'&&event.endMs>375),false);
  assert.equal(result.episodes.some((event)=>event.metric==='observation_gap'),true);
});

test('facial movement and anatomical left/right/both gestures emit bounded episodes',()=>{
  const face=new VisionEpisodeAnalyzer();face.begin(0);
  for(let at=0;at<=500;at+=125)face.ingest({atMs:at,geometry:compact({face:{...compact().face,movementRatePerSecond:1}})});
  assert.deepEqual(face.finish(625).episodes.filter((event)=>event.metric==='facial_movement_episode').map((event)=>[event.startMs,event.endMs,event.value]),[[0,500,1]]);

  const gesture=(sides)=>{const analyzer=new VisionEpisodeAnalyzer();analyzer.begin(0);for(let at=0;at<=500;at+=125){const x=(at/125)%2?.6:.3;analyzer.ingest({atMs:at,geometry:compact({hands:{left:{present:sides.includes('left'),wristX:x,wristY:.5,zone:'chest'},right:{present:sides.includes('right'),wristX:1-x,wristY:.5,zone:'chest'}}})})}return analyzer.finish(625).episodes.filter((event)=>event.metric==='hand_motion_episode')};
  assert.equal(gesture(['left']).some((event)=>event.value.hands==='left'),true);
  assert.equal(gesture(['right']).some((event)=>event.value.hands==='right'),true);
  assert.equal(gesture(['left','right']).some((event)=>event.value.hands==='both'),true);
  for(const episode of [...gesture(['left']),...gesture(['right']),...gesture(['left','right'])]) assert.deepEqual(Object.keys(episode.value).sort(),['hands','leftZone','rightZone']);
});

test('a single positive visual sample cannot stretch across an observation gap',()=>{
  const analyzer=new VisionEpisodeAnalyzer();analyzer.begin(0);
  analyzer.ingest({atMs:0,geometry:compact({pose:{...compact().pose,lateralLeanDeg:20},face:{...compact().face,yawProxyDeg:30,movementRatePerSecond:1}})});
  analyzer.gap(1_000,2_000,'document_hidden');
  const result=analyzer.finish(2_000);
  assert.equal(result.episodes.some((event)=>event.metric!=='observation_gap'),false);
  assert.deepEqual(result.episodes.find((event)=>event.metric==='observation_gap'),{metric:'observation_gap',startMs:1_000,endMs:2_000,value:'document_hidden'});
});

test('startup and trailing visual gaps are explicit and lower reliability inputs',()=>{
  const startup=new VisionEpisodeAnalyzer();startup.begin(0);
  for(let at=3_000;at<=4_000;at+=125)startup.ingest({atMs:at,expectedFrameMs:125,geometry:compact()});
  const startResult=startup.finish(4_125);
  assert.deepEqual(startResult.episodes.find((event)=>event.metric==='observation_gap'),{metric:'observation_gap',startMs:0,endMs:3_000,value:'visual_startup_gap'});
  assert.equal(startResult.trackingGapDetected,true);
  const trailing=new VisionEpisodeAnalyzer();trailing.begin(0);
  for(let at=0;at<=1_000;at+=125)trailing.ingest({atMs:at,expectedFrameMs:125,geometry:compact()});
  const tailResult=trailing.finish(2_000);
  assert.deepEqual(tailResult.episodes.find((event)=>event.metric==='observation_gap'),{metric:'observation_gap',startMs:1_000,endMs:2_000,value:'visual_trailing_gap'});
});

test('visual inference p95 uses nearest rank', () => {
  const analyzer=new VisionEpisodeAnalyzer();analyzer.begin(0);
  for(let i=1;i<=20;i++)analyzer.ingest({atMs:(i-1)*125,geometry:compact(),inferenceMs:i});
  assert.equal(analyzer.finish(2_500).inferenceP95Ms,19);
});

test('vision timestamps are finite and monotonic',()=>{
  assert.throws(()=>new VisionEpisodeAnalyzer().begin(Number.NaN),/finite/u);
  const analyzer=new VisionEpisodeAnalyzer();analyzer.begin(100);
  analyzer.ingest({atMs:200,geometry:compact()});
  assert.throws(()=>analyzer.ingest({atMs:150,geometry:compact()}),/monotonic/u);
  assert.throws(()=>analyzer.finish(Number.NaN),/finite/u);
});

test('adaptive 2 FPS cadence does not create artificial tracking gaps',()=>{
  const analyzer=new VisionEpisodeAnalyzer();analyzer.begin(0);
  for(let at=0;at<=2_500;at+=520)analyzer.ingest({atMs:at,geometry:compact(),expectedFrameMs:500});
  const result=analyzer.finish(2_600);
  assert.equal(result.episodes.some((event)=>event.metric==='observation_gap'),false);
  assert.ok(result.coverage>=.8);
});

test('facial movement delta is normalized across adaptive frame rates',()=>{
  assert.equal(normalizedTemporalDelta(.3,.2,125,0),.1);
  assert.equal(normalizedTemporalDelta(.6,.2,500,0),.1);
  assert.equal(normalizedTemporalDelta(.25,.2,62.5,0),.1);
});

test('facial movement compares label-aligned channels rather than a mean activation',()=>{
  const prior=[{categoryName:'mouthSmileLeft',score:.9},{categoryName:'browInnerUp',score:.1}];
  const current=[{categoryName:'mouthSmileLeft',score:.1},{categoryName:'browInnerUp',score:.9}];
  assert.equal(facialMovementRate(current,prior,125),6.4);
  assert.equal(facialMovementRate(prior,prior,125),0);
  assert.equal(facialMovementRate([{categoryName:'mouthSmileLeft',score:.2}], [{categoryName:'mouthSmileLeft',score:.1}], 125),facialMovementRate([{categoryName:'mouthSmileLeft',score:.5}], [{categoryName:'mouthSmileLeft',score:.1}], 500));
});
