import test from 'node:test';
import assert from 'node:assert/strict';
import {BehaviorIntelligenceRuntime} from '../../public/live-analytics/behavior-intelligence-runtime.mjs';
import {pitchRailState} from '../../public/studio-fable/app/instruments/rails.mjs';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {COACHING_CONFIG,mapToLiveScale} from '../../public/analytics/coaching-config.mjs';
import {CALIBRATION} from '../../public/ivoc-standalone/app/data.mjs';

const audio=(atMs,f0Hz=200,extra={})=>({modality:'audio',atMs,available:true,rms:.08,speaking:true,
  loudness:{available:true,speechLufsK:-24},pitch:{voiced:true,f0Hz,clarity:.9,summary:{available:true,medianHz:f0Hz,referenceHz:120,referenceBasis:'FIXED_PERSONAL_CALIBRATION_MEDIAN',voicedFrames:30,voicedRatio:.9}},...extra});
function runtime(){const value=new BehaviorIntelligenceRuntime({now:()=>0});value.setBaseline({pitchMedianHz:120,speechLufsK:-24});value.beginInterview(0,{explicitMeasurementStart:true});return value;}
test('sustained validated calibrated pitch reaches the existing single correction arbiter',()=>{
  const value=runtime();for(let at=100;at<=15000;at+=100)value.ingestDiagnostic(audio(at));
  assert.equal(value.latest.cue?.id,'pitch-high');assert.match(value.latest.cue.message,/personal pitch range/i);
});
test('short excursions do not coach; both high and low corrections use the same personal corridor',()=>{
  for(const hz of [200,70]){
    const value=runtime();for(let at=100;at<=12000;at+=100)value.ingestDiagnostic(audio(at,hz));
    assert.equal(value.latest.cue,null);
    for(let at=12100;at<=15000;at+=100)value.ingestDiagnostic(audio(at,hz));
    assert.equal(value.latest.cue?.id,hz===200?'pitch-high':'pitch-low');
    value.ingestDiagnostic(audio(15100,120));assert.equal(value.latest.cue,null);
  }
});
test('absent, mismatched, rolling, low-coverage and malformed pitch evidence never coaches',()=>{
  const changes=[
    d=>{d.pitch.voiced=false;d.pitch.f0Hz=null;},d=>{d.pitch.summary.referenceBasis='CURRENT_OBSERVED_MEDIAN';},
    d=>{d.pitch.summary.referenceHz=130;},d=>{d.pitch.summary.voicedRatio=.6;},
    d=>{d.pitch.summary.voicedFrames=2;},d=>{d.pitch.clarity=.2;},d=>{d.pitch.f0Hz='200';},
    d=>{d.pitch.f0Hz=NaN;},d=>{d.pitch.f0Hz=900;},d=>{d.available='true';}];
  for(const change of changes){const value=runtime();for(let at=100;at<=20000;at+=100){const detail=audio(at);change(detail);value.ingestDiagnostic(detail);}assert.equal(value.latest.cue,null);}
  for(const baseline of [null,{pitchMedianHz:null},{pitchMedianHz:'120'}]){const value=runtime();value.setBaseline(baseline);for(let at=100;at<=20000;at+=100)value.ingestDiagnostic(audio(at));assert.equal(value.latest.cue,null);}
});
test('stale independent events, silence, listening and recalibration immediately withhold a pitch cue',()=>{
  for(const invalidate of [value=>value.ingestWordTiming({atMs:16001}),
    value=>value.ingestDiagnostic(audio(15100,200,{speaking:false,pitch:{voiced:false,f0Hz:null}})),
    value=>value.interviewerTurnStarted({atMs:15100,source:'REMOTE_VAD'}),value=>value.setBaseline(null)]){
    const value=runtime();for(let at=100;at<=15000;at+=100)value.ingestDiagnostic(audio(at));assert.equal(value.latest.cue?.id,'pitch-high');
    invalidate(value);assert.equal(value.latest.cue,null);
  }
  const value=runtime();for(let at=100;at<=12000;at+=100)value.ingestDiagnostic(audio(at));
  value.ingestWordTiming({atMs:14000});value.ingestDiagnostic(audio(14100));assert.equal(value.latest.cue,null,'gap restarts sustained evidence');
});
test('an unobserved audio gap restarts sustained pitch dwell without an independent event',()=>{
  const value=runtime();for(let at=100;at<=12000;at+=100)value.ingestDiagnostic(audio(at));
  value.ingestDiagnostic(audio(20000));assert.equal(value.latest.cue,null);
  assert.equal(value.cues.firstSeen.get('pitch-high'),20000);
  for(let at=20100;at<=29000;at+=100)value.ingestDiagnostic(audio(at));
  assert.equal(value.latest.cue,null);
  value.ingestDiagnostic(audio(30000));assert.equal(value.latest.cue?.id,'pitch-high');
});
test('existing priority, density suppression and cue limits govern pitch as well',()=>{
  const value=runtime();for(let at=100;at<=15000;at+=100)value.ingestDiagnostic(audio(at,200,{loudness:{available:true,speechLufsK:-40}}));
  assert.equal(value.latest.cue?.id,'loudness-low');
  const limited=runtime();for(let at=100;at<=60000;at+=100)limited.ingestDiagnostic(audio(at));
  assert.equal(limited.cues.answerIssued,2);assert.equal(limited.cues.issued.length,2);
  const simulation=runtime();simulation.setCoachingMode('SIMULATION');for(let at=100;at<=20000;at+=100)simulation.ingestDiagnostic(audio(at));assert.equal(simulation.latest.cue,null);
});
test('actual frame mapper preserves personal reference and exposes only fresh calibrated coaching',()=>{
  const source=readFileSync(new URL('../../public/ivoc-standalone/app/real-runtime.mjs',import.meta.url),'utf8');
  const start=source.indexOf('  mapFrame(snapshot'),end=source.indexOf('  clearOverlay()',start);
  const scope={CALIBRATION,COACHING_CONFIG,mapToLiveScale};vm.createContext(scope);
  vm.runInContext(source.slice(source.indexOf('const clamp ='),source.indexOf('export class RealAnalyticsEngine'))+'\nthis.map=({'+source.slice(start,end)+'}).mapFrame;',scope);
  const value=runtime();for(let at=100;at<=15000;at+=100)value.ingestDiagnostic(audio(at));
  const metrics={PITCH:{available:true,voiced:true,f0Hz:200,semitonesFromSpeakerMedian:8.8,referenceBasis:'FIXED_PERSONAL_CALIBRATION_MEDIAN',voicedFrames:30}};
  const owner={t:15000,latestAudioSpeaking:true,latest:null,wordTimingState:{},faceBaselineState:{}};
  const frame=scope.map.call(owner,{atMs:15000,metrics},value.latest);
  assert.equal(frame.pitch.referenceBasis,'FIXED_PERSONAL_CALIBRATION_MEDIAN');assert.equal(frame.pitch.coachingAvailable,true);
  const rail=pitchRailState({...frame,cue:value.latest.cue});assert.equal(rail.label,'Toward your range');
  assert.equal(scope.map.call(owner,{atMs:16001,metrics},value.latest).pitch.coachingAvailable,false);
  assert.equal(pitchRailState({...frame,pitch:{...frame.pitch,referenceBasis:'CURRENT_OBSERVED_MEDIAN'},cue:null}).label,'Calibrate');
  assert.equal(pitchRailState({...frame,speaking:false,cue:null}).label,'Listening');
  assert.equal(pitchRailState({...frame,pitch:{available:true,voiced:false},cue:null}).label,'Unvoiced');
});
