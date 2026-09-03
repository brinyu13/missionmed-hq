import test from 'node:test';
import assert from 'node:assert/strict';

import { ANALYTICS_ENGINE_VERSION, MATURITY, createEvidenceEvent } from '../../analytics/event-contract.mjs';
import { VALIDATION_RECORD, projectStudentEvents, registeredSignals } from '../../analytics/signal-registry.mjs';

function signal(metric='answer_duration_ms',overrides={}){
  const input=metric==='answer_duration_ms'?'clock':'mic';
  const engine=metric==='answer_duration_ms'?'missionmed-monotonic-clock':'missionmed-web-audio';
  const observation=metric==='answer_duration_ms'
    ? {value:1_000,unit:'ms',qualifiers:['monotonic']}
    : metric==='captured_level_dbfs'
      ? {value:-24,unit:'dBFS',qualifiers:[]}
      : {value:.01,unit:'fraction',qualifiers:[]};
  return createEvidenceEvent({
    eventId:`s:a:${metric}`,sessionId:'s',answerId:'a',sequence:1,family:'voice',metric,startMs:0,endMs:1_000,
    source:{engine,engineVersion:ANALYTICS_ENGINE_VERSION,modelVersion:null,input},
    observation,quality:{provenance:'observed',reliability:'high',coverage:1,sampleCount:20,limitations:[]},
    maturity:MATURITY.STUDENT_SAFE,evidenceRef:null,...overrides,
  });
}

test('canonical sealed record promotes only declared deterministic signals',()=>{
  assert.match(VALIDATION_RECORD.fixtureManifestSha256,/^[a-f0-9]{64}$/u);
  const events=['answer_duration_ms','captured_level_dbfs','digital_clipping_fraction'].map((metric)=>signal(metric));
  assert.deepEqual(projectStudentEvents(events).map((event)=>event.metric),events.map((event)=>event.metric));
});

test('projection rejects copied records, insufficient coverage or duration, and wrong source',()=>{
  assert.equal(projectStudentEvents([signal()],{validationRecord:{...VALIDATION_RECORD}}).length,0);
  assert.equal(projectStudentEvents([signal('answer_duration_ms',{endMs:999})]).length,0);
  assert.equal(projectStudentEvents([signal('answer_duration_ms',{quality:{provenance:'observed',reliability:'low',coverage:.8,sampleCount:2,limitations:[]}})]).length,0);
  assert.equal(projectStudentEvents([signal('answer_duration_ms',{source:{engine:'missionmed-monotonic-clock',engineVersion:ANALYTICS_ENGINE_VERSION,modelVersion:null,input:'camera'}})]).length,0);
});

test('projection rejects forged values, units, and engines',()=>{
  assert.equal(projectStudentEvents([signal('answer_duration_ms',{observation:{value:-999,unit:'bananas',qualifiers:[]}})]).length,0);
  assert.equal(projectStudentEvents([signal('captured_level_dbfs',{observation:{value:'not-a-number',unit:'dBFS',qualifiers:[]}})]).length,0);
  assert.equal(projectStudentEvents([signal('captured_level_dbfs',{observation:{value:-20,unit:'ms',qualifiers:[]}})]).length,0);
  assert.equal(projectStudentEvents([signal('digital_clipping_fraction',{observation:{value:99,unit:'fraction',qualifiers:[]}})]).length,0);
  assert.equal(projectStudentEvents([signal('digital_clipping_fraction',{source:{engine:'lookalike',engineVersion:ANALYTICS_ENGINE_VERSION,modelVersion:null,input:'mic'}})]).length,0);
});

test('all pause, transcript, visual, and rejected signals remain outside student results',()=>{
  const excluded=registeredSignals().filter((entry)=>!VALIDATION_RECORD.validatedSignals.includes(entry.metric));
  assert.ok(excluded.length>10);
  for(const entry of excluded){
    if(entry.maturity===MATURITY.REJECTED)continue;
    const family=['voice','pause','gesture','pose','face','framing','system'].includes(entry.family)?entry.family:'system';
    const value=createEvidenceEvent({
      eventId:`s:a:${entry.metric}`,sessionId:'s',answerId:'a',sequence:1,family,metric:entry.metric,startMs:0,endMs:1_000,
      source:{engine:'test',engineVersion:ANALYTICS_ENGINE_VERSION,modelVersion:null,input:family==='voice'?'mic':family==='system'?'system':'camera'},
      observation:{value:1,unit:null,qualifiers:[]},quality:{provenance:'derived',reliability:'high',coverage:1,sampleCount:20,limitations:[]},
      maturity:entry.maturity,evidenceRef:null,
    });
    assert.equal(projectStudentEvents([value]).length,0,entry.metric);
  }
});
