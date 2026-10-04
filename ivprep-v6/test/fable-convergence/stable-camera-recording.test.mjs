import test from 'node:test';
import assert from 'node:assert/strict';
import {StableCameraRecording,supportsStableCameraRecording} from '../../public/capabilities/stable-camera-recording.mjs';

class Frame {
  constructor(source,{timestamp=source?.timestamp||0}={}) {this.source=source;this.timestamp=timestamp;this.closed=false;}
  close(){this.closed=true;}
}
class Track {
  constructor(id){this.kind='video';this.id=id;this.readyState='live';this.enabled=true;this.muted=false;this.stops=0;this.frames=[];}
  stop(){this.stops++;this.readyState='ended';}
}
class Stream {constructor(tracks){this.tracks=[...tracks];}getVideoTracks(){return [...this.tracks];}getTracks(){return [...this.tracks];}}
class Processor {
  constructor({track,maxBufferSize}){
    assert.equal(maxBufferSize,1);
    this.readable=new ReadableStream({start(controller){track.push=frame=>controller.enqueue(frame);track.end=()=>controller.close();
      if(!track.silent){const frame=new Frame({id:track.id},{timestamp:track.timestamp||0});track.frames.push(frame);controller.enqueue(frame);}},
      cancel(){track.cancelled=true;}});
  }
}
class Generator extends Track {
  constructor({kind}){super('generated');assert.equal(kind,'video');this.written=[];
    this.writable=new WritableStream({write:async frame=>{if(this.rejectWrite)throw new Error('writer failed');
      if(this.wait)await this.wait;this.written.push({source:frame.source.source?.id||frame.source.source?.source?.id,timestamp:frame.timestamp});frame.close();}});
  }
}
const options={Processor,Generator,Frame,Stream,timeoutMs:25};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function tap(){const camera=new Track('camera-one');let now=100;const output=await StableCameraRecording.create(camera,{...options,now:()=>now});return{camera,output,setNow:value=>{now=value;}};}

test('stable video uses actual frames, no DOM/canvas, one generated track and no raw-track stop',async()=>{
  const f=await tap();assert.equal(f.output.output.written.length,1);assert.equal(f.camera.frames[0].closed,true);
  assert.equal(f.output.stream.getVideoTracks()[0],f.output.output);assert.equal(f.output.output.written[0].source,'camera-one');
  f.output.destroy();assert.equal(f.camera.stops,0);assert.equal(f.output.output.stops,1);assert.equal(f.camera.cancelled,true);
});
test('camera replacement preserves output identity and monotonic recording timestamps across device clocks',async()=>{
  const f=await tap(),track=f.output.stream.getVideoTracks()[0],next=new Track('camera-two');next.timestamp=-50000;
  const tx=await f.output.prepareCamera(next);assert.equal(f.output.output.written.length,1,'preparation must not publish fresh frames');
  f.setNow(100);tx.commit();tx.complete();tx.release();await tick();
  assert.equal(f.output.stream.getVideoTracks()[0],track);assert.equal(f.output.output.written[1].source,'camera-two');
  assert.ok(f.output.output.written[1].timestamp>f.output.output.written[0].timestamp);
  assert.equal(f.camera.cancelled,true);assert.equal(f.camera.stops,0);assert.equal(next.stops,0);f.output.destroy();
});
test('composite rejection returns to the still-live old frame consumer',async()=>{
  const f=await tap(),next=new Track('camera-two'),tx=await f.output.prepareCamera(next);
  tx.commit();tx.complete();assert.equal(tx.rollback(),true);await tick();
  f.camera.push(new Frame({id:'camera-one'},{timestamp:500}));await tick();
  assert.equal(f.output.output.written.at(-1).source,'camera-one');assert.equal(next.cancelled,true);
  assert.equal(f.camera.cancelled,undefined);assert.equal(f.camera.stops,0);f.output.destroy();
});
test('completed stale rollback cannot retire a newer input reservation',async()=>{
  const f=await tap(),two=new Track('two'),a=await f.output.prepareCamera(two);a.commit();a.complete();a.release();
  const three=new Track('three'),b=await f.output.prepareCamera(three);assert.equal(a.rollback(),false);
  assert.equal(two.cancelled,undefined);b.rollback();assert.equal(f.output.current.track,two);f.output.destroy();
});
test('Finish while a replacement awaits its first frame rejects and closes the late consumer',async()=>{
  const f=await tap(),next=new Track('camera-two');next.silent=true;
  const changing=f.output.prepareCamera(next);const rejected=assert.rejects(changing,/cancelled|no frame/);
  f.output.destroy();await rejected;assert.equal(next.cancelled,true);assert.equal(next.stops,0);assert.equal(f.camera.stops,0);
});
test('a camera producing no actual frame is rejected without changing the healthy current recorder',async()=>{
  const f=await tap(),next=new Track('camera-two');next.silent=true;
  await assert.rejects(f.output.prepareCamera(next),/did not produce a frame/);
  assert.equal(f.output.current.track,f.camera);assert.equal(next.cancelled,true);assert.equal(f.output.pending,null);f.output.assertHealthy();f.output.destroy();
});
test('unusable input and overlapping reservations never replace the active track',async()=>{
  const f=await tap(),next=new Track('next');next.muted=true;await assert.rejects(f.output.prepareCamera(next),/usable/);
  next.muted=false;const tx=await f.output.prepareCamera(next);
  await assert.rejects(f.output.prepareCamera(new Track('third')),/progress/);tx.rollback();assert.equal(f.output.current.track,f.camera);f.output.destroy();
});
test('recording output failure reports once and closes derived output without ending bridge-owned camera',async()=>{
  let faults=0;const camera=new Track('original'),output=await StableCameraRecording.create(camera,{...options,onFault:()=>{faults++;}});
  output.output.rejectWrite=true;const frame=new Frame({id:'original'});camera.push(frame);await tick();
  assert.equal(faults,1);assert.equal(output.closed,true);assert.equal(frame.closed,true);assert.equal(camera.stops,0);
  assert.throws(()=>output.assertHealthy(),/closed/);output.destroy();assert.equal(faults,1);
});
test('initial output failure leaves no derived consumer and does not stop raw capture',async()=>{
  class Broken extends Generator {constructor(v){super(v);this.rejectWrite=true;}}
  const camera=new Track('original');await assert.rejects(StableCameraRecording.create(camera,{...options,Generator:Broken}),/writer failed/);
  assert.equal(camera.cancelled,true);assert.equal(camera.stops,0);
});
test('unsupported frame APIs are explicit, not a silent canvas or fabricated video fallback',()=>{
  assert.equal(supportsStableCameraRecording({}),false);
  assert.equal(supportsStableCameraRecording({MediaStreamTrackProcessor:Processor,MediaStreamTrackGenerator:Generator,VideoFrame:Frame,MediaStream:Stream}),true);
});
