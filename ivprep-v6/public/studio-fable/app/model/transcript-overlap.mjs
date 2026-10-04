// Approximate transcript interval overlap, NOT an audio interruption detector.
// Per native connection; never creates turns, controls playback or sends commands.
export class TranscriptOverlapObserver {
  constructor(){this.fragments=new Map();this.markedInputs=new Set();this.chars=0;this.halted=false;}
  invalidate(){this.halted=true;this.fragments.clear();this.markedInputs.clear();this.chars=0;return {invalidated:true};}
  ingest(event){
    if(this.halted)return null;
    const speaker=event?.type==='session.input_transcript.delta'?'applicant':event?.type==='session.output_transcript.delta'?'interviewer':null;
    if(!speaker||typeof event.event_id!=='string'||!event.event_id.length||event.event_id.length>240)return null;
    const prior=this.fragments.get(event.event_id);
    if(typeof event.delta!=='string'||event.delta.length>8192||!event.delta.trim()
      ||!Number.isSafeInteger(event.start_ms)||!Number.isSafeInteger(event.end_ms)||event.start_ms<0||event.end_ms<=event.start_ms)return prior?this.invalidate():null;
    if(!prior&&(this.fragments.size>=512||this.chars+event.delta.length>32768))return null;
    const signature=JSON.stringify([event.type,event.start_ms,event.end_ms,event.delta]);
    if(prior){
      if(prior.signature===signature)return null;
      return this.invalidate();
    }
    // Withhold at capacity; recycling identities could duplicate old observations.
    const fragment={speaker,start:event.start_ms,end:event.end_ms,signature};
    this.fragments.set(event.event_id,fragment);this.chars+=event.delta.length;
    const overlaps=(a,b)=>Math.max(a.start,b.start)<Math.min(a.end,b.end);
    const inputs=speaker==='applicant'?[[event.event_id,fragment]]:[...this.fragments].filter(([,f])=>f.speaker==='applicant'&&overlaps(f,fragment));
    let count=0;
    for(const [id,input]of inputs){
      if(this.markedInputs.has(id)||this.markedInputs.size>=128)continue;
      if(speaker==='applicant'&&![...this.fragments.values()].some(f=>f.speaker==='interviewer'&&overlaps(input,f)))continue;
      this.markedInputs.add(id);count++;
    }
    return count?{count}:null;
  }
}
