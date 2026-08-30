const DEFAULT_PROCESSOR_URL = '/iv-prep-on-call/assets/analytics/pcm-capture-processor.mjs';

export class AudioWorkletPcmCapture {
  constructor({
    AudioWorkletNodeClass = globalThis.AudioWorkletNode,
    processorUrl = DEFAULT_PROCESSOR_URL,
    chunkSize = 2048,
    onFrame = () => {},
  } = {}) {
    this.AudioWorkletNodeClass = AudioWorkletNodeClass;
    this.processorUrl = processorUrl;
    this.chunkSize = chunkSize;
    this.onFrame = onFrame;
    this.node = null;
    this.context = null;
    this.source = null;
    this.sink = null;
    this.startedAtFrame = 0;
  }

  async start({ context, source, sink }) {
    if (!context?.audioWorklet?.addModule || !source?.connect || !sink) {
      throw new Error('AUDIO_WORKLET_CAPTURE_UNAVAILABLE');
    }
    if (!this.AudioWorkletNodeClass) throw new Error('AUDIO_WORKLET_NODE_UNAVAILABLE');
    await context.audioWorklet.addModule(this.processorUrl);
    this.context = context;
    this.source = source;
    this.sink = sink;
    this.startedAtFrame = Math.round(context.currentTime * context.sampleRate);
    this.node = new this.AudioWorkletNodeClass(context, 'ivprep-pcm-capture', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [1],
      processorOptions: { chunkSize: this.chunkSize },
    });
    this.node.port.onmessage = (event) => {
      const message = event?.data || {};
      if (message.type !== 'pcm' || !(message.samples instanceof Float32Array)) return;
      const frame = Number(message.frame);
      const sampleRate = Number(message.sampleRate) || Number(context.sampleRate);
      this.onFrame(Object.freeze({
        atMs: Number.isFinite(frame) ? Math.max(0, (frame - this.startedAtFrame) / sampleRate * 1_000) : null,
        sampleRate,
        samples: message.samples,
        provenance: Object.freeze({ source: 'MICROPHONE', method: 'AUDIO_WORKLET_PCM' }),
      }));
    };
    source.connect(this.node);
    this.node.connect(sink);
    return true;
  }

  stop() {
    if (this.node?.port) this.node.port.onmessage = null;
    try { this.source?.disconnect?.(this.node); } catch {}
    try { this.node?.disconnect?.(); } catch {}
    this.node = null;
    this.context = null;
    this.source = null;
    this.sink = null;
  }
}
