import test from 'node:test';
import assert from 'node:assert/strict';

import { AnalyticsSession } from '../../analytics/analytics-session.mjs';
import { describeStudentEvent, persistentAnalyticsEnvelopes, studentResultProjection } from '../../analytics/results-projection.mjs';

function resultEnvelope() {
  let now=0;
  const session=new AnalyticsSession({sessionId:'projection',now:()=>now,wallClock:()=>0});
  session.beginAnswer({answerId:'a'});now=1_000;
  return session.endAnswer();
}

test('results projection accepts only a canonical sealed privacy-safe envelope',()=>{
  const envelope=resultEnvelope();
  const projected=studentResultProjection({communicationAnalytics:[envelope]});
  assert.equal(projected.available,true);
  assert.deepEqual(projected.events.map((event)=>event.metric),['answer_duration_ms']);

  for(const forged of [
    {...envelope,validationRecordId:'lookalike'},
    {...envelope,validationManifestSha256:'0'.repeat(64)},
    {...envelope,privacy:{...envelope.privacy,rawAudioStored:true}},
    {...envelope,engineVersion:'3420r-lookalike'},
    {...envelope,startedAtMs:10_000,endedAtMs:11_000},
    {...envelope,answerId:'crossed-answer'},
    {...envelope,durationMs:10_000,endedAtMs:10_000,events:envelope.events.map((event)=>({...event,endMs:event.metric==='answer_duration_ms'?1_000:event.endMs,durationMs:event.metric==='answer_duration_ms'?1_000:event.durationMs}))},
  ]) assert.equal(studentResultProjection({communicationAnalytics:[forged]}).engineAvailable,false);
});

test('student clipping copy describes samples rather than windows',()=>{
  const envelope=resultEnvelope();
  const base=envelope.events[0];
  assert.match(describeStudentEvent({...base,metric:'digital_clipping_fraction',observation:{value:.05,unit:'fraction',qualifiers:[]}}),/samples/u);
  assert.match(describeStudentEvent({...base,metric:'digital_clipping_fraction',observation:{value:0,unit:'fraction',qualifiers:[]}}),/No digital clipping/u);
  for(const value of [.0001,.004,.005]){
    const copy=describeStudentEvent({...base,metric:'digital_clipping_fraction',observation:{value,unit:'fraction',qualifiers:[]}});
    assert.match(copy,/<1%/u);
    assert.doesNotMatch(copy,/No digital clipping/u);
  }
});

test('saved analytics metadata retains only sealed student-safe events',()=>{
  const envelope=resultEnvelope();
  assert.equal(envelope.events.some((event)=>event.maturity==='FOUNDER_EXPERIMENTAL'),true);
  const [persisted]=persistentAnalyticsEnvelopes([envelope]);
  assert.deepEqual(persisted.events.map((event)=>event.metric),['answer_duration_ms']);
  assert.equal(JSON.stringify(persisted).includes('FOUNDER_EXPERIMENTAL'),false);
  assert.equal(persisted.events[0].evidenceRef.mediaId,null);
  assert.equal(studentResultProjection({communicationAnalytics:[persisted]}).available,true);
});
