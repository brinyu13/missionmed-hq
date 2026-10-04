// GPT-Live adapter — REAL CURRENT ENGINE transport wrapped, not rewritten.
//
// Wraps `LiveInterviewSession` (ivprep-v6/public/capabilities/live-interview.mjs, verbatim) so the
// native InterviewBrain retains conversation authority. Bounded user directives:
//   • opening question   → LiveInterviewSession.start({ openingQuestion }) (its own requestOpening)
//   • QUESTION / FOLLOW_HOOK / PROBE_VAGUE / CLARIFY_CONTRADICTION / MID_CANDIDATE_QUESTION /
//     BOUNDED_ANSWER / PROFESSIONAL_CLOSE → steer(): the exact `session.instructions.append`
//     wire shape requestOpening/requestClosing already use, event_id `ivoc-steer-<directive.id>`
//   • CLOSING_INVITE     → LiveInterviewSession.requestClosing(content) (one-shot guard preserved)
//   • END                → stop({ notifyServer: true })
// A supported final transcript may resolve a pending directive; current GPT-Live
// timed deltas are captions only, never synthesized finals or a second Director. The authoritative remote audio
// stream (the one audible element, owned by LiveInterviewSession) is tapped with an AnalyserNode to
// drive interviewerTurnStarted/Ended on the behavior runtime (source REMOTE_VAD) so LISTENING is real.
// Barge-in stays provider-native: no extra mute/TTS loop is introduced here.
//
// Not touched: provider credentials, session creation (server broker), voice policy, delegation
// handling (the deployed `session.delegation.created` patch lives inside LiveInterviewSession).

import {TranscriptOverlapObserver} from '../model/transcript-overlap.mjs';
const ENGINE = '/iv-prep-on-call/assets';
export const STEER_KINDS = new Set(['QUESTION', 'FOLLOW_HOOK', 'PROBE_VAGUE', 'CLARIFY_CONTRADICTION', 'MID_CANDIDATE_QUESTION', 'BOUNDED_ANSWER', 'PROFESSIONAL_CLOSE']);
const FINAL_WAIT_MS = 45_000;

// GPT-Live has timed fragments, not transcript-done/turn-final events. These
// groups are captions only; they never manufacture canonical turns or drive AI.
export class LiveCaptionGroups {
  constructor(){this.groups=[];this.current={};this.ids=new Set();this.chars=0;}
  ingest(event){
    const speaker=event.type==='session.input_transcript.delta'?'applicant':event.type==='session.output_transcript.delta'?'interviewer':null;
    if(!speaker||typeof event.delta!=='string'||!Number.isInteger(event.start_ms)||!Number.isInteger(event.end_ms)||event.start_ms<0||event.end_ms<event.start_ms)return null;
    if(event.event_id&&this.ids.has(event.event_id))return null;
    if(this.groups.length>=256||this.chars+event.delta.length>32768)return null;
    if(event.event_id){this.ids.add(event.event_id);if(this.ids.size>2048)this.ids.delete(this.ids.values().next().value);}
    let group=this.current[speaker];
    if(!group||event.start_ms>group.endMs+1500){group={speaker,text:'',startMs:event.start_ms,endMs:event.end_ms,timingBasis:'PROVIDER_FRAGMENT',final:false};this.groups.push(group);this.current[speaker]=group;}
    group.text+=event.delta;group.endMs=Math.max(group.endMs,event.end_ms);this.chars+=event.delta.length;
    return {group:{...group},groups:this.groups.map(g=>({...g}))};
  }
}

// Pure, testable: build the wire event for a directive (same shape as requestOpening/requestClosing).
export function steerEvent(directive) {
  const content = String(directive?.content || '').trim();
  if (!content || content.length > 1800) throw new TypeError('A bounded steer instruction is required.');
  if (!/^d-\d+$/.test(String(directive.id || ''))) throw new TypeError('A directive id is required.');
  return { type: 'session.instructions.append', event_id: `ivoc-steer-${directive.id}`, delegation_id: null, content };
}

// Pure, testable: remote-audio speaking detector with hysteresis (used on the AnalyserNode tap).
export function createSpeakingGate({ onThreshold = 0.015, offThreshold = 0.008, holdMs = 320 } = {}) {
  let speaking = false; let lastAbove = -Infinity;
  return {
    get speaking() { return speaking; },
    ingest(rms, atMs) {
      if (rms >= onThreshold) { lastAbove = atMs; if (!speaking) { speaking = true; return 'started'; } return null; }
      if (speaking && rms < offThreshold && atMs - lastAbove >= holdMs) { speaking = false; return 'ended'; }
      return null;
    },
  };
}

export class GptLiveInterviewer {
  constructor({ account, audioElement, engine = null, recordingMix = null, durable = null,
    onLine = () => {}, onSpeaking = () => {}, onFinal = () => {}, onApplicantFinal = () => {}, onStatus = () => {}, onApplicantPartial = () => {}, onCaptions = () => {}, onTranscriptFragment = () => {}, onTranscriptOverlap = () => {},
    LiveInterviewSessionCtor = null, moduleLoader = path => import(path), now = () => performance.now() } = {}) {
    this.account = account; this.audioElement = audioElement; this.engine = engine; this.recordingMix = recordingMix; this.durable = durable;
    this.onLine = onLine; this.onSpeaking = onSpeaking; this.onFinal = onFinal; this.onApplicantFinal = onApplicantFinal; this.onStatus = onStatus; this.onApplicantPartial = onApplicantPartial;this.onCaptions=onCaptions;this.onTranscriptFragment=onTranscriptFragment;this.onTranscriptOverlap=onTranscriptOverlap;
    this.Ctor = LiveInterviewSessionCtor; this.load=moduleLoader;this.now = now;this.generation=0;
    this.live = null; this.pending = null; this.name = 'Program Director'; this.kind = 'gpt-live'; this.label = 'GPT-Live · native interviewer';
    this.finalIds = new Set(); this.sentIds = new Set(); this.stopping = false; this.openingObserved = false;
    this.gate = createSpeakingGate(); this.tapTimer = null; this.analyser = null; this.failed = false; this.lastInterviewerText = '';
    this.captions=new LiveCaptionGroups();this.releasing=null;
  }

  async connect({ audioTrack, voice = 'marin', context, ivocSessionId, openingQuestion }) {
    if(this.stopping)throw new Error('Interview startup was cancelled.');
    const ticket=++this.generation,current=()=>!this.stopping&&ticket===this.generation;
    const assertCurrent=()=>{if(!current())throw new Error('Interview startup was cancelled.');};
    if (!this.Ctor) ({ LiveInterviewSession: this.Ctor } = await this.load(`${ENGINE}/capabilities/live-interview.mjs`));
    assertCurrent();
    const apiClient = this.account.apiClient || await this.load(`${ENGINE}/aaa/api-client.mjs`);
    assertCurrent();
    const overlaps=new TranscriptOverlapObserver(); // exact connection generation; no old intervals
    const live = new this.Ctor({
      createSession: apiClient.createLiveInterview,
      endSession: apiClient.endLiveInterview,
      audioElement: this.audioElement,
      onStatus: (status) => { if(!current())return;this.onStatus(status); if (status.state === 'error' || status.state === 'closed') this.resolvePending(null, status); },
      onTranscript: (event) => {if(current())this.handleTranscript(event);},
      onEvent:(event)=>{if(!current())return;this.onTranscriptFragment(event);const observation=overlaps.ingest(event);if(observation)this.onTranscriptOverlap(observation);const update=this.captions.ingest(event);if(update){this.onCaptions(update.groups);if(update.group.speaker==='interviewer')this.onLine(update.group.text,{partial:true});}},
      // stop invalidates ordinary callbacks, but the actual sole-owner release
      // receipt must still reach this exact Durable session before Results seal.
      onTelemetry: (event) => {if(current()||(this.releasing===live&&event.state==='released'&&this.durable?.accountSession?.id===ivocSessionId))this.durable?.recordLiveAudioTelemetry?.(event);},
      onAuthoritativeAudioStream: async (stream) => {
        if(!current())return;
        if (this.recordingMix) await this.recordingMix.attachAuthoritativeAudio(stream);
        if(!current())return;
        this.tapRemote(stream);
      },
    });
    // The first QUESTION directive is the opening; LiveInterviewSession asks it itself.
    this.openingText = String(openingQuestion || '').trim();
    this.openingPending = true;
    assertCurrent();this.live=live;
    const result=await live.start({ audioTrack, voice, context, ivocSessionId, openingQuestion: this.openingText });
    assertCurrent();return result;
  }

  tapRemote(stream) {
    if(this.stopping)return;
    const AC = this.engine?.real?.bridge?.audioContext || null;
    if (!AC || typeof AC.createAnalyser !== 'function') return;
    try {
      const source = AC.createMediaStreamSource(stream);
      this.remoteSource = source;
      this.analyser = AC.createAnalyser(); this.analyser.fftSize = 512;
      source.connect(this.analyser); // analyser only; never to AC.destination (the audio element is the sole audible authority)
      const data = new Float32Array(this.analyser.fftSize);
      this.tapTimer = setInterval(() => {
        this.analyser.getFloatTimeDomainData(data);
        let sum = 0; for (let i = 0; i < data.length; i += 1) sum += data[i] * data[i];
        const edge = this.gate.ingest(Math.sqrt(sum / data.length), this.now());
        if (edge === 'started') { this.onSpeaking(true); this.engine?.interviewerTurn?.('started', { questionId: this.pending?.directive?.questionId || null, source: 'REMOTE_VAD' }); }
        if (edge === 'ended') { this.onSpeaking(false); this.engine?.interviewerTurn?.('ended', { questionId: this.pending?.directive?.questionId || null, source: 'REMOTE_VAD' }); }
      }, 50);
    } catch { /* optional observational tap; native provider remains in control */ }
  }

  handleTranscript(event) {
    if (this.stopping) return;
    const identity = event.identity || (event.itemId ? event.speaker + ':' + event.itemId : null);
    if (event.final && identity && this.finalIds.has(identity)) return;
    if (event.final && identity) { this.finalIds.add(identity); if(this.finalIds.size>256) this.finalIds.delete(this.finalIds.values().next().value); }
    this.durable?.recordLiveTranscript?.(event);
    if (event.speaker === 'interviewer') {
      if (!event.final) { if(event.type!=='session.output_transcript.delta')this.onLine(event.text,{partial:true});return; }
      const text = String(event.text || '').trim(); if (!text) return;
      this.lastInterviewerText = text;
      this.onLine(text, { typing: false });
      const directive = this.pending?.directive || (this.openingPending ? { kind: 'QUESTION', id: 'd-1', n: 1, opening: true } : null);
      this.openingPending = false; this.openingObserved = true;
      this.resolvePending(text, null);
      this.onFinal(text, directive, event);
      return;
    }
    if (event.speaker === 'applicant') {
      if (event.final) this.onApplicantFinal(String(event.text || '').trim(), event);
      else this.onApplicantPartial(String(event.text || ''), event);
    }
  }

  resolvePending(text, status) { const p = this.pending; if (!p) return; this.pending = null; clearTimeout(p.timer); p.resolve(text ?? null, status); }

  // Execute a directive; resolves with the interviewer's final text (or null when unverified).
  async execute(directive) {
    if (!this.live || this.failed || this.stopping) return null;
    if (directive.kind === 'END') { await this.stop(); return null; }
    if (directive.kind === 'QUESTION' && directive.n === 1) return this.openingObserved ? this.lastInterviewerText : this.await(directive);
    if (directive.kind === 'CLOSING_INVITE' || directive.kind === 'CLOSING_INVITE_LOCAL') {
      if (directive.resend) this.steer({ ...directive, id: `${directive.id}` }); // bounded re-send goes through steer; the one-shot invite guard stays intact
      else { try { this.live.requestClosing(directive.content); } catch (error) { this.failed = true; this.onStatus({ state: 'error', detail: error.message }); return null; } }
      return this.await(directive);
    }
    if (STEER_KINDS.has(directive.kind)) { if (!this.steer(directive)) return null; return this.await(directive); }
    return null;
  }

  steer(directive) {
    if (this.stopping)return false;
    if (!this.live || this.live.state !== 'active' || this.live.channel?.readyState !== 'open') { this.failed = true; this.onStatus({ state: 'error', detail: 'The interviewer is not connected.' }); return false; }
    if (this.sentIds.has(directive.id)) return true;
    try { this.live.channel.send(JSON.stringify(steerEvent(directive))); this.sentIds.add(directive.id); return true; }
    catch (error) { this.failed = true; this.onStatus({ state: 'error', detail: String(error?.message || error) }); return false; }
  }

  await(directive) {
    this.resolvePending(null, { state: 'superseded' });
    return new Promise((resolve) => {
      const timer = setTimeout(() => { if (this.pending?.directive === directive) { this.pending = null; resolve(null); } }, FINAL_WAIT_MS);
      this.pending = { directive, resolve, timer };
    });
  }

  cancel() { this.resolvePending(null, { state: 'cancelled' }); }
  async stop({keepalive=false}={}) {
    this.stopping = true;++this.generation;
    this.remoteSource?.disconnect?.(); this.remoteSource=null; this.analyser?.disconnect?.();
    clearInterval(this.tapTimer); this.tapTimer = null;
    this.cancel();
    if (!this.live) return;
    const live = this.live; this.live = null;this.releasing=live;
    try { await live.stop({ notifyServer: true, keepalive }); } catch { /* server hangup remains authoritative on its side */ }
    finally{if(this.releasing===live)this.releasing=null;}
  }
}
