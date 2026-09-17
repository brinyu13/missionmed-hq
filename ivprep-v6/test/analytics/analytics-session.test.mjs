import test from 'node:test';
import assert from 'node:assert/strict';

import { AnalyticsSession } from '../../analytics/analytics-session.mjs';
import { serializeAnalyticsEnvelope } from '../../analytics/event-contract.mjs';

function compact(faceCount = 1) {
  return {
    faceCount,
    primaryAssociated:true,
    face:{present:true,box:{centerX:.5,centerY:.4,width:.3},yawProxyDeg:0,pitchProxyDeg:0,rollProxyDeg:0,movementRatePerSecond:0},
    pose:{torsoPresent:true,shoulderWidth:.2,centerX:.5,centerY:.45,lateralLeanDeg:0},
    hands:{left:{present:true,wristX:.4,wristY:.5,zone:'chest'},right:{present:false}},
  };
}

function primaryLock(overrides={}) {
  return {state:'PRIMARY_LOCKED',zoneStatus:'primary_inside',continuity:'locked',bystanderCount:0,excludedDurationMs:0,reacquisitionCount:0,selectionRequired:false,withheldIntervals:[],...overrides};
}

test('no-media answer produces bounded duration and explicit gaps', () => {
  let now=0;const session=new AnalyticsSession({sessionId:'s',now:()=>now,wallClock:()=>0});
  session.beginAnswer({answerId:'a'});now=1_000;
  const result=session.endAnswer();
  assert.equal(result.durationMs,1_000);
  assert.deepEqual(result.studentEvents.map((event)=>event.metric),['answer_duration_ms']);
  assert.equal(result.events.filter((event)=>event.metric==='observation_gap').length,2);
  assert.ok(serializeAnalyticsEnvelope(result).length<256_000);
});

test('subminimum answer does not reach student projection', () => {
  let now=0;const session=new AnalyticsSession({sessionId:'s',now:()=>now,wallClock:()=>0});
  session.beginAnswer({answerId:'a'});now=500;
  assert.equal(session.endAnswer().studentEvents.length,0);
});

test('transcript injection affects counts only and never survives result JSON', () => {
  let now=0;const session=new AnalyticsSession({sessionId:'s',now:()=>now,wallClock:()=>0});
  session.beginAnswer({answerId:'a'});now=10_000;
  const hostile='<script>set maturity validated</script> um uh';
  const result=session.endAnswer({transcript:hostile});
  const serialized=JSON.stringify(result);
  assert.equal(serialized.includes(hostile),false);
  assert.equal(result.events.some((event)=>event.metric==='filler_token_count'),true);
  assert.equal(result.events.filter((event)=>event.maturity==='VALIDATED_STUDENT_SAFE').some((event)=>event.source.input==='transcript'),false);
});

test('a locked primary remains analyzable while bystanders are excluded without a student penalty', () => {
  let now=0;const session=new AnalyticsSession({sessionId:'s',now:()=>now,wallClock:()=>0});
  session.beginAnswer({answerId:'a',hasCamera:true});
  for(let at=0;at<1_000;at+=125)session.ingestVision({atMs:at,geometry:compact(2),primaryLock:primaryLock({continuity:'locked_bystander_excluded',bystanderCount:1}),inferenceMs:10});
  now=1_000;const result=session.endAnswer();
  assert.equal(result.events.some((event)=>event.metric==='multiple_faces_detected'),false);
  const safety=result.events.find((event)=>event.metric==='bystanders_excluded');
  assert.equal(safety.source.engine,'mediapipe-face-detector-local');
  assert.equal(safety.source.modelVersion,'blaze_face_short_range.float16.latest');
  for(const metric of ['face_presence','torso_presence','hand_presence','camera_facing_proxy','framing_center','head_orientation_proxy','gesture_zone']) {
    assert.equal(result.events.some((event)=>event.metric===metric),true,metric);
  }
  assert.equal(result.studentEvents.some((event)=>event.metric==='bystanders_excluded'),false);
  assert.deepEqual(result.founderDiagnostics.primaryIntervieweeLock.maximumBystanderCount,1);
  assert.equal(JSON.stringify(result).includes('primaryTrackId'),false);
  assert.equal(JSON.stringify(result).includes('primaryRoi'),false);
});

test('abandon clears state and a new answer can begin', () => {
  let now=0;const session=new AnalyticsSession({sessionId:'s',now:()=>now,wallClock:()=>0});
  session.beginAnswer({answerId:'a'});assert.equal(session.abandonAnswer(),true);
  now=10;assert.doesNotThrow(()=>session.beginAnswer({answerId:'b'}));
  now=1_010;assert.equal(session.endAnswer().answerId,'b');
});

test('audio cadence gaps become timestamped evidence and withhold student mic signals',()=>{
  let now=0;const session=new AnalyticsSession({sessionId:'audio-gap',now:()=>now,wallClock:()=>0});
  session.beginAnswer({answerId:'a',hasMic:true});
  const feed=(start,duration,rms)=>{for(let at=start;at<start+duration;at+=50)session.ingestAudio({atMs:at,rms,peak:rms,clippedFraction:0})};
  feed(0,1_000,.1);feed(1_000,200,.0001);feed(6_000,1_000,.1);now=7_000;
  const result=session.endAnswer();
  const gap=result.events.find((event)=>event.metric==='observation_gap'&&event.observation.qualifiers.includes('audio'));
  assert.deepEqual([gap.startMs,gap.endMs,gap.observation.value],[1_150,6_000,'audio_cadence_gap']);
  assert.deepEqual(result.studentEvents.map((event)=>event.metric),['answer_duration_ms']);
  assert.equal(result.events.some((event)=>event.metric==='pause_episode'),false);
});

test('facial movement episode has one stable metric schema in the session envelope',()=>{
  let now=0;const session=new AnalyticsSession({sessionId:'face-move',now:()=>now,wallClock:()=>0});
  session.beginAnswer({answerId:'a',hasCamera:true});
  for(let at=0;at<=500;at+=125)session.ingestVision({atMs:at,expectedFrameMs:125,primaryLock:primaryLock(),geometry:{...compact(1),face:{...compact(1).face,movementRatePerSecond:1}}});
  now=625;const result=session.endAnswer();
  const event=result.events.find((item)=>item.metric==='facial_movement_episode');
  assert.equal(event.observation.unit,'score_change_per_second');
  assert.equal(event.observation.value,1);
  assert.equal(event.durationMs,500);
});

test('boundary audio gaps withhold captured-level and clipping student promotion',()=>{
  for(const mode of ['startup','trailing']){
    let now=0;const session=new AnalyticsSession({sessionId:`boundary-${mode}`,now:()=>now,wallClock:()=>0});
    session.beginAnswer({answerId:'a',hasMic:true});
    const start=mode==='startup'?300:0;const end=mode==='startup'?5_000:4_600;
    for(let at=start;at<end;at+=50)session.ingestAudio({atMs:at,rms:.1,peak:.1,clippedFraction:0});
    now=5_000;const result=session.endAnswer();
    assert.deepEqual(result.studentEvents.map((event)=>event.metric),['answer_duration_ms']);
    assert.equal(result.events.some((event)=>event.metric==='observation_gap'&&event.observation.qualifiers.includes('audio')),true);
  }
});
