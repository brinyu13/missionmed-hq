import test from 'node:test';
import assert from 'node:assert/strict';
import {GptLiveInterviewer} from '../../public/studio-fable/app/adapters/live-adapter.mjs';
import {NativeInterviewObserver} from '../../public/studio-fable/app/brain/native-observer.mjs';
import {LiveInterviewSession} from '../../public/capabilities/live-interview.mjs';
import {applyNativeObservationMarks} from '../../public/studio-fable/app/model/native-observation-marks.mjs';
import {closingLedger,hookLedger} from '../../public/studio-fable/app/model/teaching.mjs';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {TranscriptOverlapObserver} from '../../public/studio-fable/app/model/transcript-overlap.mjs';
import {sealDerivedEvidence} from '../../public/studio-fable/app/adapters/derived-evidence.mjs';
import {projectSavedAttempt} from '../../public/studio-fable/app/adapters/saved-review.mjs';

const questions=[{question_id:'CORE-01',canonical_text:'Tell me about yourself.'},
  {question_id:'CORE-02',canonical_text:'Why did you choose internal medicine?'}];
const fragment=(side,delta,id,start=100,end=start+100)=>({type:`session.${side}_transcript.delta`,delta,event_id:id,start_ms:start,end_ms:end});

function overlapRoomCallbacks(){
  const source=readFileSync(new URL('../../public/studio-fable/app/room.mjs',import.meta.url),'utf8');
  const from=source.indexOf('  const callbacks={'),to=source.indexOf('\n  function providerFailed()',from);
  const context={current:()=>true,started:true,saving:false,finished:false,events:[],controller:{elapsed:37.25,durableActive:true,recordingOrigin:1},
    at:()=>context.controller.elapsed,$:()=>({dataset:{}}),providerFailed(){},addTurn(){}};
  runInNewContext(source.slice(from,to)+'\nglobalThis.roomCallbacks=callbacks;',context);
  return context;
}

test('actual native event → adapter → Room receipt marks survive sealed cold own review without inventing interruption',async()=>{
  for(const reverse of [false,true]){
    const room=overlapRoomCallbacks(),natives=[];let finals=0,canonical=0,sends=0;
    class Native extends LiveInterviewSession{constructor(options){super({...options,PeerConnection:class{}});natives.push(this);}async start(){this.startedAtMs=0;return{};}async stop(){}}
    const adapter=new GptLiveInterviewer({account:{apiClient:{createLiveInterview(){throw new Error('No provider in regression');},endLiveInterview(){throw new Error('No provider in regression');}}},LiveInterviewSessionCtor:Native,onTranscriptOverlap:room.roomCallbacks.onTranscriptOverlap,
      onFinal(){finals++;},onApplicantFinal(){finals++;},durable:{recordLiveTranscript(){canonical++;}}});
    await adapter.connect({ivocSessionId:'own-session',openingQuestion:'Question?'});
    const native=natives.at(-1);native.channel={readyState:'open',send(){sends++;}};
    const pair=[fragment('output','Question?','out',1000,2000),fragment('input','Answer.','in',1500,2500)];
    if(reverse)pair.reverse();for(const event of pair)native.handleEvent(JSON.stringify(event));
    assert.equal(room.events.length,1);assert.equal(room.events[0].t,37.25,'provider milliseconds are not recording time');
    assert.equal(room.events[0].kind,'overlap');assert.equal(room.events[0].state,'MESSAGE_RECEIPT');
    assert.match(room.events[0].label,/Transcript overlap observed.*interruption unverified/);
    native.handleEvent(JSON.stringify(pair[0]));native.handleEvent(JSON.stringify(fragment('output','More output.','extra',1700,1900)));
    assert.equal(room.events.length,1,'one marker per input ID, not one per pair');
    assert.equal(finals,0);assert.equal(sends,0);assert.equal(canonical,4,'canonical custody is unchanged');
    const sealed=JSON.parse(JSON.stringify(sealDerivedEvidence({events:room.events,transport:'gpt-live'})));
    const recording={id:'recording',status:'saved',durationMs:60000};
    const detail={id:'own-session',ownerSubject:'wp:1',state:'saved',recording,results:{payload:{analytics:{fable:sealed}}}};
    const projected=projectSavedAttempt({persisted:true,session:{...detail},sessionDetail:detail},'wp:1');
    assert.equal(projected.events[0].t,37.25);assert.equal(projected.events[0].label,room.events[0].label);
    assert.deepEqual(sealed.turns,[]);assert.equal(JSON.stringify(sealed).includes('start_ms'),false);
    room.saving=true;native.handleEvent(JSON.stringify(fragment('input','Save-time input.','save',1600,1800)));assert.equal(room.events.length,1);
    room.saving=false;room.started=false;native.handleEvent(JSON.stringify(fragment('input','Preflight.','pre',1600,1800)));assert.equal(room.events.length,1);
    room.started=true;room.current=()=>false;native.handleEvent(JSON.stringify(fragment('input','Wrong owner.','foreign',1600,1800)));assert.equal(room.events.length,1);
    room.current=()=>true;room.controller.durableActive=false;native.handleEvent(JSON.stringify(fragment('input','No recording.','idle',1600,1800)));assert.equal(room.events.length,1);
    room.controller.durableActive=true;room.controller.recordingOrigin=null;native.handleEvent(JSON.stringify(fragment('input','No clock.','no-clock',1600,1800)));assert.equal(room.events.length,1);
    room.controller.recordingOrigin=1;room.finished=true;native.handleEvent(JSON.stringify(fragment('input','Finished.','finished',1600,1800)));assert.equal(room.events.length,1);room.finished=false;
    room.current=()=>true;await adapter.connect({ivocSessionId:'second-session',openingQuestion:'Question?'});
    native.handleEvent(JSON.stringify(fragment('input','Stale generation.','stale',1600,1800)));assert.equal(room.events.length,1);
    const fresh=natives.at(-1);fresh.handleEvent(JSON.stringify(fragment('input','Fresh input.','fresh',1600,1800)));assert.equal(room.events.length,1,'new generation cannot reuse old output intervals');
    fresh.handleEvent(JSON.stringify(fragment('output','Fresh output.','fresh-out',1700,1900)));assert.equal(room.events.length,2);
    room.events.push({t:0,kind:'recording',label:'Recording started'});
    fresh.handleEvent(JSON.stringify(fragment('output','Conflicting output.','fresh-out',1700,1900)));
    assert.equal(room.events.length,1);assert.equal(room.events[0].kind,'recording','conflicts retract overlap only before sealing');
    assert.equal(sealDerivedEvidence({events:room.events}).events.some(e=>e.kind==='overlap'),false);
    await adapter.stop();fresh.handleEvent(JSON.stringify(fragment('input','After stop.','late',1700,1800)));assert.equal(room.events.length,1);
  }
});

test('overlap observer rejects touching/non-overlapping, malformed, duplicate/conflicting and unbounded fragments',()=>{
  const observer=new TranscriptOverlapObserver();
  assert.equal(observer.ingest(fragment('output','Question','o',100,200)),null);
  for(const event of [fragment('input','Touch','touch',200,300),fragment('input','Before','before',0,100),fragment('input','Bad','bad',200,200),fragment('input','Negative','neg',-1,100),fragment('input','Fraction','frac',1.5,180),{...fragment('input','No ID',''),event_id:null}])assert.equal(observer.ingest(event),null);
  const input=fragment('input','Answer','i',150,250);assert.equal(observer.ingest(input).count,1);assert.equal(observer.ingest(input),null);
  assert.deepEqual(observer.ingest({...input,delta:'Conflicting text'}),{invalidated:true});assert.equal(observer.ingest(fragment('input','After conflict','next',150,250)),null);
  const bounded=new TranscriptOverlapObserver();for(let i=0;i<512;i++)bounded.ingest(fragment('input','a',String(i),i*10,i*10+5));
  assert.equal(bounded.ingest(fragment('output','At capacity','overflow',0,6000)),null);assert.equal(bounded.fragments.size,512);
  const chars=new TranscriptOverlapObserver();for(let i=0;i<5;i++)chars.ingest(fragment('input','a'.repeat(8192),String(i),i*10,i*10+5));
  assert.equal(chars.fragments.size,4);assert.equal(chars.chars,32768);
  const limited=new TranscriptOverlapObserver();limited.ingest(fragment('output','Wide','wide',0,10000));
  for(let i=0;i<200;i++)limited.ingest(fragment('input','a',String(i),i*10,i*10+5));
  assert.equal(limited.markedInputs.size,128);
});

test('real adapter event path observes native question/closing text without manufacturing finals',async()=>{
  const observer=new NativeInterviewObserver({questions});observer.start();
  let native,finals=0;const recorded=[];
  class Native extends LiveInterviewSession {constructor(options){super({...options,PeerConnection:class{}});native=this;}async start(){this.startedAtMs=0;return{};}async stop(){}}
  const adapter=new GptLiveInterviewer({account:{apiClient:{createLiveInterview(){throw new Error('No provider calls in regression');},endLiveInterview(){throw new Error('No provider calls in regression');}}},LiveInterviewSessionCtor:Native,
    durable:{recordLiveTranscript(event){recorded.push(event);}},
    onFinal(){finals++;},onApplicantFinal(){finals++;},
    onTranscriptFragment:event=>observer.ingestFragment(event)});
  await adapter.connect({ivocSessionId:'session-test',openingQuestion:questions[0].canonical_text});
  const pending=adapter.await({id:'d-1',kind:'QUESTION',n:1});
  const emit=event=>native.handleEvent(JSON.stringify(event));
  emit(fragment('output','Why did you choose ','one'));
  emit(fragment('input','I enjoy working with ','overlap',150,250));
  emit(fragment('output','internal medicine?','two',200,400));
  assert.equal(observer.snapshot().n,2);
  assert.equal(observer.snapshot().plan[0].status,'QUEUED','Q2 evidence cannot prove Q1 was asked');
  emit(fragment('output','Do you have any questions ','three',450,650));
  emit(fragment('output','for me?','four',650,750));
  assert.equal(observer.snapshot().closing.reached,true);
  assert.equal(observer.snapshot().closing.delivery,'observed_fragment');
  assert.equal(closingLedger(observer.snapshot()).status,'observed');
  assert.equal(finals,0);assert.equal(observer.snapshot().finalObservationCount,0);
  assert.equal(recorded.length,5,'existing Native transcript path records each fragment exactly once');
  assert.equal(recorded.every(event=>event.final===false),true);
  assert.ok(adapter.pending,'fragment observations cannot resolve a directive as a completed turn');
  await adapter.stop();const before=observer.snapshot().fragmentObservationCount;
  await pending;emit(fragment('output','Thank you for your time.','late',800,900));
  assert.equal(observer.snapshot().fragmentObservationCount,before,'old owner cannot update observations');
  assert.equal(recorded.length,5,'stale fragment cannot enter canonical custody');
});

test('overlapping fragments preserve speaker evidence, hooks and sign-off without a guessed turn boundary',()=>{
  const observer=new NativeInterviewObserver({questions});observer.start();
  observer.ingestFragment(fragment('input','Actually, there was a really interesting teaching ','a'));
  observer.ingestFragment(fragment('output','Tell me about yourself.','b'));
  observer.ingestFragment(fragment('input','moment with my son yesterday.','c',100000,100200));
  assert.equal(observer.snapshot().hooks.length,1);
  assert.equal(hookLedger(observer.snapshot())[0].reference,null,'multi-fragment span is not an invented canonical turn reference');
  observer.ingestFragment(fragment('output','Tell me more about that teaching moment with your son?','d',100210,100400));
  assert.equal(observer.snapshot().hooks[0].bitTaken,true);
  assert.equal(observer.snapshot().state,'FOLLOWUP');
  observer.ingestFragment(fragment('output','Do you have any questions for me?','e',100500,100700));
  observer.ingestFragment(fragment('input','How do you support research?','f',100710,100800));
  observer.ingestFragment(fragment('output','I do not have verified program facts.','g',100810,100900));
  observer.ingestFragment(fragment('input','What about teaching?','h',101000,101200));
  observer.ingestFragment(fragment('output','Thank you for your time. Best of luck.','i',101210,101400));
  const snap=observer.snapshot();assert.equal(snap.closing.candidateQuestions.length,2);
  assert.equal(snap.closeSent,1);assert.equal(snap.state,'PROFESSIONAL_CLOSE');
  assert.equal(snap.finalObservationCount,0);assert.deepEqual(observer.turns,[]);
  assert.equal(observer.tick(),null,'no timeout or autonomous provider instruction');
});

test('invalid/duplicate/delayed/oversized fragment evidence stays bounded and cannot reopen an ended observer',()=>{
  const observer=new NativeInterviewObserver({questions});observer.start();
  assert.equal(observer.ingestFragment(fragment('output','Do you have any questions for me?','invalid',-1,100)),null);
  observer.ingestFragment(fragment('output','Why did you choose internal medicine?','q2',500,600));
  observer.ingestFragment(fragment('output','Tell me about yourself.','older',100,200));
  assert.equal(observer.snapshot().n,2,'late older output does not regress live state');
  observer.ingestFragment(fragment('output','Do you have any questions for me?','close',700,800));
  const before=observer.snapshot().fragmentObservationCount;
  observer.ingestFragment(fragment('output','Do you have any questions for me?','close',700,800));
  assert.equal(observer.snapshot().fragmentObservationCount,before);
  assert.equal(observer.ingestFragment(fragment('output','x'.repeat(17000),'oversized',900,1000)),null);
  observer.requestEnd('leave');observer.ingestFragment(fragment('output','Thank you for your time.','ended',1100,1200));
  assert.equal(observer.snapshot().state,'ENDED');assert.equal(observer.snapshot().closeSent,0);
  assert.equal(closingLedger(new NativeInterviewObserver({questions}).snapshot()).status,'unverified');
});

test('snapshots retain before values for actual hook and closing transition marks',()=>{
  const observer=new NativeInterviewObserver({questions});observer.start();const before=observer.snapshot();
  observer.ingestFinal({speaker:'applicant',text:'Actually, there was a really interesting teaching moment with my son yesterday.'});
  observer.ingestFinal({speaker:'interviewer',text:'Do you have any questions for me?'});
  assert.equal(before.hooks.length,0);assert.equal(before.closing.reached,false);
  assert.equal(observer.snapshot().hooks.length,1);assert.equal(observer.snapshot().closing.reached,true);
});

test('later explained or guarded bait retracts an unconfirmed fragment hook',()=>{
  for(const continuation of [
    ' In that teaching moment, I listened to my son, I asked him what happened, and I taught him how to finish the lesson.',
    ' I do not want to discuss that teaching moment with my son.']){
    const observer=new NativeInterviewObserver({questions});observer.start();
    observer.ingestFragment(fragment('input','Actually, there was a really interesting teaching moment with my son yesterday.','hook'));
    assert.equal(observer.snapshot().hooks.length,1);
    observer.ingestFragment(fragment('input',continuation,'continued',200,300));
    assert.equal(observer.snapshot().hooks.length,0,'partial text must not become a permanent unexplained-hook claim');
    assert.equal(observer.snapshot().finalObservationCount,0);
  }
});

test('quoted/negated instructions and a clinical save question are not interview phases',()=>{
  const observer=new NativeInterviewObserver({questions});observer.start();
  observer.ingestFragment(fragment('output',"Do not say 'Why did you choose internal medicine?' yet.",'quote-q'));
  observer.ingestFragment(fragment('output',"The question 'Why did you choose internal medicine?' is not the one I am asking you now.",'meta-q',120,180));
  observer.ingestFragment(fragment('output',"Do not say 'Do you have any questions for me?' yet; we are still on your background.",'quote-close',200,300));
  assert.equal(observer.snapshot().n,1);assert.equal(observer.snapshot().closing.reached,false);
  observer.ingestFragment(fragment('output','Do you have any questions for me?','real-close',400,500));
  observer.ingestFragment(fragment('output','Before we finish, how would you save a patient in shock?','clinical',600,700));
  observer.ingestFragment(fragment('output','That is not the end of the interview; do not say best of luck yet.','negated',800,900));
  assert.equal(observer.snapshot().closeSent,0);assert.equal(observer.snapshot().state,'CANDIDATE_QUESTIONS');
});

test('withheld provisional hook retracts after a matching follow-up and conflicting IDs invalidate fragment claims',()=>{
  const observer=new NativeInterviewObserver({questions});observer.start();
  observer.ingestFragment(fragment('input','Actually, there was a really interesting teaching moment with my son yesterday.','hook'));
  observer.ingestFragment(fragment('output','Do not tell me more about that teaching moment with your son?','negated-bite',120,150));
  assert.equal(observer.snapshot().hooks[0].bitTaken,null);
  observer.ingestFragment(fragment('output','Tell me more about that teaching moment with your son?','bite',200,300));
  assert.equal(observer.snapshot().hooks[0].bitTaken,true);
  observer.ingestFragment(fragment('input',' I would rather not say anything about that teaching moment.','withheld',400,500));
  assert.equal(observer.snapshot().hooks.length,0);
  observer.ingestFragment(fragment('output','Do you have any questions for me?','ambiguous',600,700));
  observer.ingestFragment(fragment('output','Different text.','ambiguous',600,700));
  observer.ingestFragment(fragment('output','Thank you for your time.','after-conflict',800,900));
  const snap=observer.snapshot();assert.equal(snap.fragmentEvidenceIncomplete,true);
  assert.equal(snap.fragmentTextObservationCount,0);assert.equal(snap.closeSent,0);
  assert.equal(closingLedger(snap).status,'unverified');
});

test('conflict notifies presentation, removes provisional marks and cannot invent Q1 evidence',()=>{
  const observer=new NativeInterviewObserver({questions});observer.start();const events=[{t:0,kind:'recording',label:'Recording started'}];
  const ingest=event=>{const before=observer.snapshot(),after=observer.ingestFragment(event);if(after)applyNativeObservationMarks(events,before,after,event.type.includes('input')?'applicant':'interviewer',1);return after;};
  ingest(fragment('output','Why did you choose internal medicine?','q',100,200));
  ingest(fragment('output','Do you have any questions for me?','close',300,400));
  assert.equal(events.some(e=>e.kind==='closing'),true);
  const invalidated=ingest(fragment('output','Different text.','close',300,400));
  assert.ok(invalidated,'Room must receive the invalidation snapshot');assert.equal(invalidated.fragmentHalted,true);
  assert.deepEqual(events,[{t:0,kind:'recording',label:'Recording started'}]);
});

test('withholding removes provisional hook/follow-up marks before sealing while retaining real recording events',()=>{
  const observer=new NativeInterviewObserver({questions});observer.start();const events=[{t:0,kind:'recording',label:'Recording started'}];
  const ingest=event=>{const before=observer.snapshot(),after=observer.ingestFragment(event);if(after)applyNativeObservationMarks(events,before,after,event.type.includes('input')?'applicant':'interviewer',1);};
  ingest(fragment('input','Actually, there was a really interesting teaching moment with my son yesterday.','hook'));
  ingest(fragment('output','Tell me more about that teaching moment with your son?','bite',200,300));
  assert.equal(events.filter(e=>['hook','followup'].includes(e.kind)).length,2);
  ingest(fragment('input',' I would rather not say anything about that teaching moment.','withheld',400,500));
  assert.deepEqual(events,[{t:0,kind:'recording',label:'Recording started'}]);
});
