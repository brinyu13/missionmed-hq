// Observed teaching state only. Native InterviewBrain owns the conversation.
// No scripted answer loop, timed silence termination, browser TTS or synthetic facts.
import {detectHooks,evaluateBite} from './hook-detector.mjs';
import {InterviewProgression} from '../../../capabilities/interview-progression.mjs';
const normalized=s=>String(s||'').toLowerCase().replace(/[^a-z0-9 ]/g,'').trim();
export class NativeInterviewObserver {
  constructor({questions=[],config={},context={},now=()=>0}={}) {
    this.questions=questions;this.config=config;this.context=context;this.now=now;
    this.state='PREFLIGHT';this.n=1;this.hooks=[];this.turns=[];this.closeSent=0;
    this.closing={reached:false,skipped:false,candidateQuestions:[],delivery:'unverified'};
    this.progression=new InterviewProgression();this.sequence=0;
  }
  start(){this.state='QUESTION';this.progression.start();return null;}
  current(){const q=this.questions[this.n-1]||this.questions[0];return {id:q?.question_id,text:q?.canonical_text,tags:q?.tags};}
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
      if(hit>=0){this.n=hit+1;this.state='QUESTION';}
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
  snapshot(){return {state:this.state,n:this.n,N:this.questions.length,hooks:this.hooks,closing:this.closing,closeSent:this.closeSent,finalObservationCount:this.turns.length,
    plan:this.questions.map((q,i)=>({n:i+1,text:q.canonical_text,status:i<this.n-1?'ASKED':i===this.n-1?'CURRENT':'QUEUED'}))};}
}
