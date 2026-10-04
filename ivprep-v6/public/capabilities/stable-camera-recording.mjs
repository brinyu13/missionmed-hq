// A silent, presentation-independent video tap. MediaRecorder's track set must
// not change after start. Read actual camera frames rather than repainting a
// canvas from a visible DOM element (which would depend on layout/visibility).
const usable = track => track?.kind === 'video' && track.readyState === 'live'
  && track.enabled !== false && track.muted !== true;

export function supportsStableCameraRecording(runtime = globalThis) {
  return ['MediaStreamTrackProcessor','MediaStreamTrackGenerator','VideoFrame','MediaStream']
    .every(name => typeof runtime[name] === 'function');
}

export class StableCameraRecording {
  constructor({Processor = globalThis.MediaStreamTrackProcessor, Generator = globalThis.MediaStreamTrackGenerator,
    Frame = globalThis.VideoFrame, Stream = globalThis.MediaStream, now = () => performance.now(),
    timeoutMs = 3000, onFault = () => {}} = {}) {
    if (![Processor,Generator,Frame,Stream].every(x => typeof x === 'function')) throw new Error('Stable camera recording is unsupported.');
    Object.assign(this,{Processor,Frame,now,timeoutMs,onFault});
    this.output = new Generator({kind:'video'});
    this.writer = this.output.writable.getWriter();
    this.stream = new Stream([this.output]);
    this.current = null; this.pending = null; this.inputs = new Set();
    this.closed = false; this.fault = null; this.lastTimestamp = -1; this.writes = Promise.resolve();
  }

  static async create(track, options) {
    const tap = new StableCameraRecording(options);
    try {
      const tx = await tap.prepareCamera(track);
      tx.commit(); tx.complete(); tx.release();
      // Admission requires an actual generated frame, not just a live track.
      await tap.deadline(tap.current.firstWrite);
      return tap;
    } catch (error) { tap.destroy(); throw error; }
  }

  deadline(operation) {
    let timer;
    return Promise.race([operation,new Promise((_,reject) => {timer=setTimeout(() => reject(new Error('The recording camera did not produce a frame.')),this.timeoutMs);})])
      .finally(() => clearTimeout(timer));
  }

  assertHealthy() {
    if (this.closed || this.fault || this.output.readyState !== 'live') throw new Error('The recording camera has closed.');
  }

  async prepareCamera(track) {
    this.assertHealthy();
    if (this.pending) throw new Error('A recording camera change is already in progress.');
    if (!usable(track)) throw new Error('A usable recording camera is required.');
    const reader = new this.Processor({track,maxBufferSize:1}).readable.getReader();
    const input = {track,reader,held:null,retired:false,firstWrite:null};
    const previous = this.current, tx = {input,previous,state:'preparing'};
    this.pending=tx;this.inputs.add(input);
    try {
      // The late read also closes its frame if timeout/release invalidated it.
      const first = reader.read().then(result => {
        if (input.retired || this.closed) {result.value?.close?.();throw new Error('Recording camera change was cancelled.');}
        input.held=result.value;
        if (result.done || !result.value) throw new Error('The recording camera produced no frame.');
      });
      await this.deadline(first);
      this.assertHealthy();
      if (this.pending!==tx || !usable(track)) throw new Error('Recording camera change was cancelled.');
      tx.state='prepared';
    } catch(error) {this.retire(input);if(this.pending===tx)this.pending=null;throw error;}
    return Object.freeze({
      commit: () => {
        this.assertHealthy();
        if(this.pending!==tx || tx.state!=='prepared' || !usable(track)) throw new Error('Recording camera change was cancelled.');
        this.current=input;tx.state='committed';
        input.firstWrite=this.pump(input);
        input.firstWrite.catch(error=>this.fail(input,error));
      },
      rollback: () => {
        if(this.closed || this.pending!==tx) return false;
        if(tx.state==='committed')this.current=previous;
        this.retire(input);tx.state='rolled_back';this.pending=null;return true;
      },
      complete: () => {
        this.assertHealthy();
        if(this.pending!==tx || tx.state!=='committed' || this.current!==input || !usable(track)) throw new Error('Recording camera change is not committed.');
        return true;
      },
      release: () => {
        if(this.closed || this.pending!==tx || tx.state!=='committed') return false;
        tx.state='complete';this.pending=null;this.retire(previous);return true;
      },
    });
  }

  async pump(input) {
    const first = input.held;input.held=null;
    await this.write(input,first);
    // firstWrite is only an admission receipt. The continuing loop owns each
    // incoming frame and always closes dropped/late frames.
    void (async () => {
      while(!this.closed && !input.retired) {
        const {value,done}=await input.reader.read();
        if(done) {if(this.current===input&&!this.closed)throw new Error('The recording camera ended.');break;}
        await this.write(input,value);
      }
    })().catch(error=>this.fail(input,error));
  }

  write(input, frame) {
    if(!frame)return Promise.reject(new Error('A camera frame is required.'));
    const operation=this.writes.catch(()=>{}).then(async () => {
      let output;
      try {
        if(this.closed || input.retired || this.current!==input)return;
        if(!usable(input.track))throw new Error('The recording camera is unavailable.');
        // Rebase device timestamps to the one monotonic capture time domain;
        // switching cameras must never rewind the generated recording track.
        const timestamp=Math.max(this.lastTimestamp+1,Math.round(this.now()*1000));
        output=new this.Frame(frame,{timestamp});this.lastTimestamp=timestamp;
        await this.writer.write(output);
      } finally {output?.close?.();frame.close?.();}
    });
    this.writes=operation;return operation;
  }

  fail(input,error) {
    if(this.closed || input.retired || this.current!==input || this.fault)return;
    this.fault=error;this.destroy();
    try {this.onFault(error);} catch {/* Reporting cannot revive capture. */}
  }

  retire(input) {
    if(!input || input.retired)return;
    input.retired=true;this.inputs.delete(input);input.held?.close?.();input.held=null;
    // Cancel the frame consumer, never stop the raw camera owned by the bridge.
    void input.reader.cancel().catch(()=>{});
  }

  destroy() {
    if(this.closed)return;
    this.closed=true;this.pending=null;this.current=null;
    for(const input of this.inputs)this.retire(input);
    void this.writer.abort().catch(()=>{});this.output.stop();
  }
}
