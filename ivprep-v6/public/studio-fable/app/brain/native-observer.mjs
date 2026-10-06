// Observed teaching state only. Native InterviewBrain owns the conversation.
// No scripted answer loop, timed silence termination, browser TTS or synthetic facts.
import {detectHooks,evaluateBite,isGuardedText} from './hook-detector.mjs';
import {InterviewProgression} from '../../../capabilities/interview-progression.mjs';
import {directorPolicy,chooseObjective,objectiveInstruction} from './interview-director.mjs';
const normalized=s=>String(s||'').toLowerCase().replace(/[^a-z0-9 ]/g,'').replace(/\s+/g,' ').trim();
const metaSpeech=text=>/\b(?:do not|don't|not yet|do not say|quoted?|the phrase|the question|(?:i|you|we) (?:should|will|would|might) (?:say|ask))\b/i.test(text);
const closingInvite=text=>!metaSpeech(text)&&/^(?:(?:before we (?:finish|wrap up)|finally|now|so)[,:]?\s*)?(?:do you have any questions for me|any questions (?:for me|you.d like)[^?]*)\?$/i.test(text);
const IMPERATIVE_PROBE=/^(?:tell me|walk me|describe|give me|explain|say more|talk me|take me)\b/i;
const NO_MORE_QUESTIONS=/\b(?:no|nope|no thank you|no thanks|that'?s (?:all|it|everything)|i'?m (?:good|all set|done)|nothing (?:else|more|further)|i (?:don'?t|do not) (?:have any|think so)|not (?:right now|at the moment)|that covers it|i have no (?:more |other |further )?questions)\b/i;
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
    this.guidedQuestions=new Set();
    // Interview Director (deterministic turn policy). Objectives travel on the
    // strong steer path before the provider commits its next turn; GPT-Live still
    // owns every word. Follow-up accounting comes from observed provider output.
    this.director={policy:directorPolicy({style:config.style,pressure:config.pressure===true,curiosity:config.curiosity,maxDepth:config.maxDepth??1,maxFollowUps:config.maxFollowUps??4}),
      sent:[],lastKey:null,sequence:0,windowSends:new Map(),candidateQuestion:null,answeredCandidateQuestions:0,noMoreQuestions:false};
    this.followUpsByWindow=new Map();this.totalFollowUps=0;
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
        for(const match of matches){const text=match[0].trim();if(text&&this.closing.candidateQuestions.length<32)this.closing.candidateQuestions.push(text);this.inputQuestionCursor+=match[0].length;if(text)this.director.candidateQuestion=text;}
        if(NO_MORE_QUESTIONS.test(joined.slice(Math.max(0,joined.length-160)).trim()))this.director.noMoreQuestions=true;
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
        if(changed){this.fragmentWindow++;this.fragmentBuffers.input='';this.inputQuestionCursor=0;this.director.lastKey=null;}
      }
      // Observed interviewer follow-up: a question that is not a planned question or the
      // closing invitation, after the current planned question was asked. Budget truth
      // comes from actual provider output, never from the Director's own sends.
      // An interviewer probe is a question OR an imperative request ("Tell me more…", "Walk me through…").
      else if(!metaSpeech(text)&&(/\?/.test(text)||IMPERATIVE_PROBE.test(text))&&!closingInvite(text)&&this.observedQuestions.has(this.current().id)){
        this.followUpsByWindow.set(this.fragmentWindow,(this.followUpsByWindow.get(this.fragmentWindow)||0)+1);this.totalFollowUps++;
      }
      const pending=[...this.hooks].reverse().find(h=>h.bitTaken===null&&h.fragmentWindow===this.fragmentWindow);
      if(pending&&!metaSpeech(text)&&event.end_ms>=pending.providerEndMs&&(/\?/.test(text)||IMPERATIVE_PROBE.test(text))&&evaluateBite(pending.report.primary,text).taken){
        pending.bitTaken=true;pending.followUp=text;this.state='FOLLOWUP';this.fragmentTextObservationCount++;
      }
      if(closingInvite(text)){
        this.closing.reached=true;this.closing.delivery='observed_fragment';this.state='CANDIDATE_QUESTIONS';
        this.fragmentTextObservationCount++;this.fragmentBuffers.input='';this.inputQuestionCursor=0;
      }
    }else if(this.closeSent===0&&signOff(text)){
      this.closeSent=1;this.state='PROFESSIONAL_CLOSE';this.fragmentTextObservationCount++;
    }else if(this.closing.reached&&!metaSpeech(text)&&this.director.candidateQuestion){
      // Any interviewer text after a candidate question is its answer in progress.
      this.director.candidateQuestion=null;this.director.answeredCandidateQuestions++;
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
  // Advisory context only: fragments are not turn boundaries. The native brain
  // decides whether/when to follow; actual output alone can mark a hook taken.
  pendingHookContext(){
    if(this.fragmentHalted||this.fragmentEvidenceIncomplete||this.closing.reached
      ||!['QUESTION','FOLLOWUP'].includes(this.state))return null;
    if((this.director.windowSends.get(this.fragmentWindow)||0)>0)return null; // the Director already steers this answer; no second transport
    const questionId=this.current().id;
    if(this.guidedQuestions.has(questionId)||this.guidedQuestions.size>=Math.min(32,this.config.maxFollowUps??32)
      ||this.config.maxDepth===0)return null;
    const pending=[...this.hooks].reverse().find(h=>h.questionId===questionId&&h.bitTaken===null);
    const report=pending?.report,hook=report?.primary;
    if(!hook||report.blockedBy||!['FOLLOW_HOOK','PROBE_VAGUE'].includes(report.decision)
      ||hook.guarded||hook.resolvedInAnswer)return null;
    const span=String(hook.span?.text||'').trim();
    if(!span||span.length>128||new TextEncoder().encode(span).length>128
      ||/\b(?:private|confidential|off the record|prefer not|rather not|cannot discuss|can't discuss)\b/i.test(span))return null;
    return {questionId,span,kind:report.decision};
  }
  hookContextSent(hint){if(hint?.questionId===this.current().id)this.guidedQuestions.add(hint.questionId);}
  // Interview Director: one bounded NEXT TURN OBJECTIVE whenever the deterministic
  // decision changes for the current candidate answer. Re-evaluated on every
  // observed input fragment so the objective precedes the provider's next turn.
  pendingObjective(){
    if(this.fragmentHalted||this.fragmentEvidenceIncomplete||!['QUESTION','FOLLOWUP','CLOSING_INVITE','CANDIDATE_QUESTIONS'].includes(this.state))return null;
    const d=this.director,policy=d.policy,question=this.current(),window=this.fragmentWindow;
    if(d.sent.length>=96||(d.windowSends.get(window)||0)>=8)return null;
    const answerText=this.fragmentBuffers.input;
    const report=!this.closing.reached&&answerText.trim()?detectHooks({question,answer:{text:answerText},priorTurns:this.turns,context:this.context,policy:{...this.config,followThreshold:policy.followThreshold,depthUsedThisQuestion:this.followUpsByWindow.get(window)||0}}):null;
    const nextQ=this.questions[this.n]||null;
    const remainingMs=Number.isFinite(this.config.durationMs)?this.config.durationMs-this.now():null;
    const chosen=chooseObjective({policy,phase:this.state,report,answerText,question,guardedAnswer:isGuardedText(answerText),
      nextQuestion:nextQ?{id:nextQ.question_id,text:nextQ.canonical_text}:null,
      depthUsed:this.followUpsByWindow.get(window)||0,totalFollowUps:this.totalFollowUps,
      closingReached:this.closing.reached,candidateQuestion:d.candidateQuestion,noMoreQuestions:d.noMoreQuestions,
      program:this.context?.program||null,remainingMs,closingReserveMs:this.config.closingReserveMs??90000});
    if(!chosen)return null;
    const span=String(chosen.target||'');
    // Withheld/confidential threads are never steered; ordinary uses of "private" (a private practice) are not privacy signals.
    if(span&&/\b(?:confidential|off the record|prefer not to (?:say|share|discuss)|rather not (?:say|share|discuss)|cannot discuss|can't discuss|in private|private (?:matter|reasons?|information|details?)|asked me not to)\b/i.test(span))return null;
    const key=window+':'+this.state+':'+chosen.kind+':'+span+':'+(d.candidateQuestion||'')+':'+(d.noMoreQuestions?1:0);
    if(key===d.lastKey)return null;
    const instruction=objectiveInstruction(chosen,{policy,question,nextQuestion:nextQ?{text:nextQ.canonical_text}:null,questionNumber:this.n+1});
    return {id:'obj-'+(d.sequence+1),key,kind:chosen.kind,target:chosen.target,reason:chosen.reason,questionId:question.id,window,instruction};
  }
  objectiveSent(objective){
    const d=this.director;if(!objective||objective.id!=='obj-'+(d.sequence+1))return false;
    d.sequence++;d.lastKey=objective.key;d.windowSends.set(objective.window,(d.windowSends.get(objective.window)||0)+1);
    d.sent.push({id:objective.id,kind:objective.kind,target:objective.target,questionId:objective.questionId,at:this.now()});
    if(['FOLLOW_HOOK','CLARIFY','SEEK_EVIDENCE','CHALLENGE_GENTLY'].includes(objective.kind)){
      const hook=[...this.hooks].reverse().find(h=>h.fragmentWindow===objective.window&&h.bitTaken===null&&String(h.span||'')===String(objective.target||''))
        ||[...this.hooks].reverse().find(h=>h.fragmentWindow===objective.window&&h.bitTaken===null);
      if(hook)hook.decision='FOLLOW_HOOK'; // Results ledger: attempted; taken still requires observed provider output
    }
    return true;
  }
  snapshot(){return {state:this.state,n:this.n,N:this.questions.length,hooks:this.hooks.map(h=>({...h})),director:{policy:this.director.policy,sent:this.director.sent.map(x=>({...x})),followUps:this.totalFollowUps},closing:{...this.closing,candidateQuestions:[...this.closing.candidateQuestions]},closeSent:this.closeSent,finalObservationCount:this.turns.length,
    fragmentObservationCount:this.fragmentObservationCount,fragmentTextObservationCount:this.fragmentTextObservationCount,fragmentEvidenceIncomplete:this.fragmentEvidenceIncomplete,fragmentHalted:this.fragmentHalted,
    plan:this.questions.map((q,i)=>({n:i+1,text:q.canonical_text,status:i===this.n-1?'CURRENT':this.observedQuestions.has(q.question_id)?'ASKED':'QUEUED'}))};}
}
