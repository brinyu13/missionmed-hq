// Observed teaching state only. Native InterviewBrain owns the conversation.
// No scripted answer loop, timed silence termination, browser TTS or synthetic facts.
import {detectHooks,evaluateBite} from './hook-detector.mjs';
import {InterviewProgression} from '../../../capabilities/interview-progression.mjs';
const normalized=s=>String(s||'').toLowerCase().replace(/[^a-z0-9 ]/g,'').replace(/\s+/g,' ').trim();
const metaSpeech=text=>/\b(?:do not|don't|not yet|do not say|quoted?|the phrase|the question|(?:i|you|we) (?:should|will|would|might) (?:say|ask))\b/i.test(text);
const closingInvite=text=>!metaSpeech(text)&&/^(?:(?:before we (?:finish|wrap up)|finally|now|so)[,:]?\s*)?(?:do you have any questions for me|any questions (?:for me|you.d like)[^?]*)\?$/i.test(text);
const signOff=text=>!metaSpeech(text)&&!/[?]/.test(text)&&/^(?:thank you for (?:your time|the interview|this interview)\b|best of luck\b|(?:you can|please) (?:select|click|choose|press) [^.!?]{0,80}finish\s*(?:&|and)\s*save\b)/i.test(text);
export class NativeInterviewObserver {
  constructor({questions=[],config={},context={},now=()=>0}={}) {
    this.questions=questions;this.config=config;this.context=context;this.now=now;
    this.state='PREFLIGHT';this.n=1;this.hooks=[];this.turns=[];this.closeSent=0;
    this.closing={reached:false,skipped:false,candidateQuestions:[],delivery:'unverified'};
    this.progression=new InterviewProgression();this.sequence=0;
    this.fragmentIds=new Map();this.fragmentBuffers={input:'',output:''};this.fragmentEnds={input:-1,output:-1};
    this.fragmentObservationCount=0;this.fragmentTextObservationCount=0;this.fragmentEvidenceIncomplete=false;this.fragmentHalted=false;
    this.observedQuestions=new Set();this.fragmentWindow=0;this.inputQuestionCursor=0;
  }
  start(){this.state='QUESTION';this.progression.start();return null;}
  current(){const q=this.questions[this.n-1]||this.questions[0];return {id:q?.question_id,text:q?.canonical_text,tags:q?.tags};}
  // Observe lexical evidence, NOT completed turns. Speaker windows never close
  // on silence, packet gaps or remote VAD. No provider instructions are emitted.
  ingestFragment(event={}) {
    if(this.state==='ENDED'||this.state==='PREFLIGHT'||this.fragmentHalted)return null;
    const side=event.type==='session.input_transcript.delta'?'input':event.type==='session.output_transcript.delta'?'output':null;
    if(!side||typeof event.delta!=='string'||event.delta.length>16384
      ||typeof event.event_id!=='string'||!/^[A-Za-z0-9_.:-]{1,160}$/.test(event.event_id)
      ||!Number.isSafeInteger(event.start_ms)||!Number.isSafeInteger(event.end_ms)
      ||event.start_ms<0||event.end_ms<event.start_ms||event.end_ms>86400000)return null;
    const fingerprint=JSON.stringify([side,event.delta,event.start_ms,event.end_ms]);
    if(this.fragmentIds.has(event.event_id)){
      if(this.fragmentIds.get(event.event_id)!==fingerprint){
        this.fragmentEvidenceIncomplete=true;this.fragmentHalted=true;this.fragmentTextObservationCount=0;
        this.hooks=this.hooks.filter(h=>h.decision!=='OBSERVED_FRAGMENT');
        if(this.closing.delivery==='observed_fragment'){this.closing={reached:false,skipped:false,candidateQuestions:[],delivery:'unverified'};this.closeSent=0;}
        if(this.turns.length===0){this.observedQuestions.clear();this.n=1;this.state='QUESTION';}
        return this.snapshot();
      }
      return null;
    }
    this.fragmentIds.set(event.event_id,fingerprint);
    if(this.fragmentIds.size>2048)this.fragmentIds.delete(this.fragmentIds.keys().next().value);
    if(event.end_ms<this.fragmentEnds[side]){this.fragmentEvidenceIncomplete=true;return null;}
    this.fragmentEnds[side]=event.end_ms;this.fragmentObservationCount++;
    const joined=this.fragmentBuffers[side]+event.delta;
    if(joined.length>8192){this.fragmentEvidenceIncomplete=true;this.fragmentBuffers[side]='';this.inputQuestionCursor=0;return null;}
    this.fragmentBuffers[side]=joined;
    if(side==='input'){
      if(this.closing.reached){
        const tail=joined.slice(this.inputQuestionCursor),matches=[...tail.matchAll(/[^?]*\?/g)];
        for(const match of matches){const text=match[0].trim();if(text&&this.closing.candidateQuestions.length<32)this.closing.candidateQuestions.push(text);this.inputQuestionCursor+=match[0].length;}
      }else{
        const report=detectHooks({question:this.current(),answer:{text:joined},priorTurns:this.turns,context:this.context,policy:this.config});
        const pending=this.hooks.find(h=>h.fragmentWindow===this.fragmentWindow);
        if(!report.primary){if(pending){this.hooks=this.hooks.filter(h=>h!==pending);this.fragmentTextObservationCount=Math.max(0,this.fragmentTextObservationCount-1-(pending.bitTaken===true?1:0));if(this.state==='FOLLOWUP')this.state='QUESTION';}}
        else if(pending){pending.report=report;pending.span=report.primary.span.text;pending.category=report.primary.category;}
        else if(/[.!?]\s*$/.test(joined)&&this.hooks.length<32){
          this.hooks.push({questionId:this.current().id,span:report.primary.span.text,category:report.primary.category,
            decision:'OBSERVED_FRAGMENT',report,reference:null,fragmentWindow:this.fragmentWindow,
            providerEndMs:event.end_ms,bitTaken:null,followUp:null});this.fragmentTextObservationCount++;
        }
      }
    }else{
      // Punctuation identifies inspectable text, not a speech/turn completion.
      const sentences=[...joined.matchAll(/[\s\S]*?[.!?]+(?=\s|$)/g)];let consumed=0;
      for(const match of sentences){this.observeFragmentText(match[0].trim(),event);consumed=match.index+match[0].length;}
      if(consumed)this.fragmentBuffers.output=joined.slice(consumed);
    }
    return this.snapshot();
  }
  observeFragmentText(text,event){
    if(!text)return;
    if(!this.closing.reached){
      const hit=metaSpeech(text)?-1:this.questions.findIndex(q=>normalized(q.canonical_text)&&normalized(text)===normalized(q.canonical_text));
      if(hit>=0){
        const changed=this.n!==hit+1;this.n=hit+1;this.state='QUESTION';
        this.observedQuestions.add(this.questions[hit].question_id);this.fragmentTextObservationCount++;
        if(changed){this.fragmentWindow++;this.fragmentBuffers.input='';this.inputQuestionCursor=0;}
      }
      const pending=[...this.hooks].reverse().find(h=>h.bitTaken===null&&h.fragmentWindow===this.fragmentWindow);
      if(pending&&!metaSpeech(text)&&event.end_ms>=pending.providerEndMs&&(/\?/.test(text)||/^(?:tell me|walk me|describe)\b/i.test(text))&&evaluateBite(pending.report.primary,text).taken){
        pending.bitTaken=true;pending.followUp=text;this.state='FOLLOWUP';this.fragmentTextObservationCount++;
      }
      if(closingInvite(text)){
        this.closing.reached=true;this.closing.delivery='observed_fragment';this.state='CANDIDATE_QUESTIONS';
        this.fragmentTextObservationCount++;this.fragmentBuffers.input='';this.inputQuestionCursor=0;
      }
    }else if(this.closeSent===0&&signOff(text)){
      this.closeSent=1;this.state='PROFESSIONAL_CLOSE';this.fragmentTextObservationCount++;
    }
  }
  ingestFinal({speaker,text,identity=null,sessionId=null}={}) {
    if(!text)return null;
    const prior=this.turns.slice();this.turns.push({speaker,text});
    if(speaker==='applicant') {
      if(this.closing.reached) {
        if(/[?]/.test(text))this.closing.candidateQuestions.push(text);
      } else {
        const report=detectHooks({question:this.current(),answer:{text},priorTurns:prior,context:this.context,policy:this.config});
        if(report.primary){
          const span=report.primary.span,start=span.startChar,end=span.endChar;
          const reference=typeof identity==='string'&&identity.length<=240&&typeof sessionId==='string'
            &&Number.isSafeInteger(start)&&Number.isSafeInteger(end)&&start>=0&&end>start&&text.slice(start,end)===span.text
            ?{sessionId,turnId:identity,startChar:start,endChar:end,basis:'PROVISIONAL_TRANSCRIPT'}:null;
          this.hooks.push({questionId:this.current().id,span:span.text,category:report.primary.category,
            decision:'OBSERVED',report,turn:this.turns.length,reference,bitTaken:null,followUp:null});
        }
      }
    } else if(speaker==='interviewer') {
      const hit=this.questions.findIndex(q=>normalized(text).includes(normalized(q.canonical_text)));
      if(hit>=0){this.n=hit+1;this.state='QUESTION';this.observedQuestions.add(this.questions[hit].question_id);}
      const pending=this.hooks.findLast?.(h=>h.bitTaken===null)||[...this.hooks].reverse().find(h=>h.bitTaken===null);
      if(pending){const bite=evaluateBite(pending.report.primary,text);pending.bitTaken=bite.taken;pending.followUp=bite.taken?text:null;if(bite.taken)this.state='FOLLOWUP';}
      if(/do you have any questions for me|any questions (?:for me|you.d like)/i.test(text)) {this.closing.reached=true;this.closing.delivery='observed_transcript';this.state='CANDIDATE_QUESTIONS';}
      else if(this.closing.reached) {this.state='CANDIDATE_QUESTIONS';if(/finish.*save|thank you.*(?:time|interview)|best of luck/i.test(text)){this.closeSent++;this.state='PROFESSIONAL_CLOSE';}}
    }
    return null;
  }
  requestEnd(kind) {
    if(kind==='leave') {this.closing.skipped=!this.closing.reached;this.closing.reason='student_hard_stop';this.state='ENDED';return null;}
    const content=this.progression.requestClosing();
    if(!content)return null;this.state='CLOSING_INVITE';
    return {id:'d-'+(++this.sequence),kind:'CLOSING_INVITE',content};
  }
  tick(){return null;}
  snapshot(){return {state:this.state,n:this.n,N:this.questions.length,hooks:this.hooks.map(h=>({...h})),closing:{...this.closing,candidateQuestions:[...this.closing.candidateQuestions]},closeSent:this.closeSent,finalObservationCount:this.turns.length,
    fragmentObservationCount:this.fragmentObservationCount,fragmentTextObservationCount:this.fragmentTextObservationCount,fragmentEvidenceIncomplete:this.fragmentEvidenceIncomplete,fragmentHalted:this.fragmentHalted,
    plan:this.questions.map((q,i)=>({n:i+1,text:q.canonical_text,status:i===this.n-1?'CURRENT':this.observedQuestions.has(q.question_id)?'ASKED':'QUEUED'}))};}
}
