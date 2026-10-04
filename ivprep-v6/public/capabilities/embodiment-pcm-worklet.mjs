// Receives ONLY GPT-Live's remote track. Candidate microphone never enters it.
class InterviewerPcm extends AudioWorkletProcessor {
  constructor(){super();this.buffer=new Int16Array(1280);this.used=0;this.energy=0;}
  process(inputs,outputs){
    for(const output of outputs)for(const channel of output)channel.fill(0); // no second audible path
    const samples=inputs[0]?.[0];if(!samples)return true;
    for(const sample of samples){
      const value=Math.max(-1,Math.min(1,sample));this.energy+=value*value;
      this.buffer[this.used++]=Math.round(value<0?value*32768:value*32767);
      if(this.used===1280){
        const bytes=this.buffer.buffer;this.port.postMessage({pcm:bytes,rms:Math.sqrt(this.energy/1280)},[bytes]);
        this.buffer=new Int16Array(1280);this.used=0;this.energy=0;
      }
    }
    return true;
  }
}
registerProcessor('ivoc-interviewer-pcm',InterviewerPcm);
