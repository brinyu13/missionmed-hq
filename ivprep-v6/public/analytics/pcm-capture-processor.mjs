// AudioWorklet execution scope. Raw PCM is transferred immediately to the local
// page and never retained, serialized, or sent to a network endpoint.
class IvPrepPcmCaptureProcessor extends AudioWorkletProcessor {
  constructor(options = {}) {
    super();
    this.chunkSize = Math.max(512, Math.min(4096, Number(options.processorOptions?.chunkSize) || 2048));
    this.buffer = new Float32Array(this.chunkSize);
    this.offset = 0;
  }

  process(inputs) {
    const channel = inputs?.[0]?.[0];
    if (!channel?.length) return true;
    let cursor = 0;
    while (cursor < channel.length) {
      const count = Math.min(channel.length - cursor, this.buffer.length - this.offset);
      this.buffer.set(channel.subarray(cursor, cursor + count), this.offset);
      cursor += count;
      this.offset += count;
      if (this.offset === this.buffer.length) {
        const samples = this.buffer;
        this.port.postMessage({
          type: 'pcm',
          frame: currentFrame,
          sampleRate,
          samples,
        }, [samples.buffer]);
        this.buffer = new Float32Array(this.chunkSize);
        this.offset = 0;
      }
    }
    return true;
  }
}

registerProcessor('ivprep-pcm-capture', IvPrepPcmCaptureProcessor);
