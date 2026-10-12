// Mock control-flow tests only. These do NOT prove audio/video capture quality.
import assert from 'node:assert/strict';import fs from 'node:fs';
const source=fs.readFileSync(new URL('../../wp-content/mu-plugins/missionmed-ivprep-live-arena/recorder.js',import.meta.url),'utf8');
const {ArenaRecorder}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
class Track extends EventTarget{constructor(kind){super();this.kind=kind;this.readyState='live';}stop(){this.readyState='ended';}getSettings(){return {displaySurface:'window'};}}
class Stream{constructor(tracks){this.tracks=tracks;}getTracks(){return this.tracks;}getAudioTracks(){return this.tracks.filter(t=>t.kind==='audio');}getVideoTracks(){return this.tracks.filter(t=>t.kind==='video');}}
class Node{connect(){}disconnect(){}getByteTimeDomainData(data){data.fill(128);}}
class Context{state='running';resume(){return Promise.resolve();}createMediaStreamDestination(){return {stream:new Stream([new Track('audio')])};}createMediaStreamSource(){return new Node();}createGain(){const n=new Node();n.gain={value:1};return n;}createAnalyser(){return new Node();}async close(){this.state='closed';}}
class Recorder extends EventTarget{static empty=false;static isTypeSupported(){return true;}constructor(s,o){super();this.mimeType=o.mimeType;this.state='inactive';}start(){this.state='recording';}stop(){this.state='inactive';queueMicrotask(()=>{this.ondataavailable({data:new Blob(Recorder.empty?[]:['test'])});this.dispatchEvent(new Event('stop'));});}}
globalThis.window={MediaRecorder:Recorder};globalThis.MediaRecorder=Recorder;globalThis.MediaStream=Stream;globalThis.AudioContext=Context;
let display,mic,denied=false,noAudio=false;
Object.defineProperty(globalThis,'navigator',{value:{mediaDevices:{async getDisplayMedia(){if(denied)throw new Error('Permission denied');return display=new Stream([new Track('video'),...noAudio?[]:[new Track('audio')]]);},async getUserMedia(){return mic=new Stream([new Track('audio')]);}}},configurable:true});
let count=0;function ok(v,name){assert.ok(v,name);console.log('PASS',name);count++;}
denied=true;let r=new ArenaRecorder();await assert.rejects(r.prepare(),/Permission denied/);ok(r.phase==='idle','Permission denial resets controls');
denied=false;noAudio=true;r=new ArenaRecorder();await assert.rejects(r.prepare(),/Incoming Webex audio/);ok(display.getTracks().every(t=>t.readyState==='ended'),'Missing incoming audio rejects and releases capture');
noAudio=false;r=new ArenaRecorder();const info=await r.prepare();ok(info.displayAudioTracks===1&&info.microphoneTracks===1,'Separate source presence reported');r.start();const result=await r.stop();ok(result.bytes>0&&!result.interrupted,'Normal stop returns local blob');ok([...display.getTracks(),...mic.getTracks()].every(t=>t.readyState==='ended'),'Stop releases capture devices');
Recorder.empty=true;r=new ArenaRecorder();await r.prepare();r.start();await assert.rejects(r.stop(),/empty/);ok(r.phase==='finished','Empty recording not accepted');Recorder.empty=false;
r=new ArenaRecorder();await r.prepare();r.start();const done=new Promise(resolve=>r.onInterrupted=resolve);mic.getAudioTracks()[0].dispatchEvent(new Event('ended'));ok((await done).interrupted,'Input ending labels partial recording');
console.log(`${count} recorder control checks passed. No real media acceptance inferred.`);

// Targeted frontend recovery regression against the actual arena.js module.
class Element {
 constructor(tag='div'){this.tag=tag;this.value='';this.checked=false;this.disabled=false;this.hidden=false;this.children=[];this.files=[];this.classList={toggle(){}};}
 showModal(){} close(){} pause(){} play(){return Promise.resolve();}
 append(...v){this.children.push(...v);} replaceChildren(...v){this.children=[...v];if(this.tag==='select')this.value=v[0]?.value||'';} add(v){this.children.push(v);} setAttribute(){}
}
globalThis.Option=class extends Element{constructor(text,value){super('option');this.textContent=text;this.value=value;}};
const elements=new Map();const element=id=>{if(!elements.has(id))elements.set(id,new Element(['class','sessions','attempts'].includes(id)?'select':'div'));return elements.get(id);};
const listeners={};globalThis.document={getElementById:element,createElement:tag=>new Element(tag),createTextNode:text=>text,body:{classList:{toggle(){},contains(){return false;}}}};
window.addEventListener=(type,fn)=>listeners[type]=fn;
const storage=new Map();globalThis.sessionStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
const old='11111111-1111-4111-8111-111111111111',session='22222222-2222-4222-8222-222222222222';
let server={id:session,class_id:'1',label:'Recovery fixture',version:8,students:{101:{id:'101',name:'A',present:true,points:1}},selected:'101',active:null,attempts:{[old]:{id:old,student_id:'101',status:'finalized',started_at:'2026-10-12T10:00:00Z',reviewed:true,awarded:'old-award',media:{sha256:'old'}}},events:[]};
storage.set('ivprep.session',session);element('arena-config').textContent=JSON.stringify({api:'/api',nonce:'fixture',assets:'/',local:true});
let conflict=true,newAttempt;
globalThis.fetch=async(target,options)=>{
 const u=new URL(target,'http://127.0.0.1'),op=u.searchParams.get('op');let data;
 if(op==='groups')data={groups:[{id:'1',group_name:'Test'}]};else if(op==='sessions')data={sessions:[]};else if(op==='state')data=server;else {
  const c=JSON.parse(options.body);
  if(c.type==='start'){newAttempt=c.attempt_id;server.active=newAttempt;server.attempts[newAttempt]={id:newAttempt,student_id:'101',status:'recording',started_at:'2026-10-12T10:01:00Z'};server.version++;}
  if(c.type==='finish'){
   if(conflict){conflict=false;server.version++;return {ok:false,status:409,json:async()=>({message:'External version change'})};}
   assert.equal(c.version,server.version);server.active=null;server.attempts[c.attempt_id].status='finalized';server.attempts[c.attempt_id].media={sha256:c.sha256};server.events.push({id:c.request_id,at:'2026-10-12T10:02:00Z',type:'finish',student_id:'101'});server.version++;
  }data=server;
 }return {ok:true,status:200,json:async()=>structuredClone(data)};
};
const testBlob=new Blob(['local frontend fixture'],{type:'video/webm'});
globalThis.FrontendRecorder=class{display=new Stream([new Track('video'),new Track('audio')]);phase='idle';async prepare(){this.phase='ready';return {};}start(){this.phase='recording';}async cleanup(){this.phase='finished';}async stop(){this.phase='finalizing';await Promise.resolve();this.phase='finished';return {blob:testBlob,bytes:testBlob.size,duration:2,mime:'video/webm',finalizeMs:1,interrupted:false};}};
const nativeInterval=globalThis.setInterval;globalThis.setInterval=(...args)=>{const timer=nativeInterval(...args);timer.unref();return timer;};
const frontend=fs.readFileSync(new URL('../../wp-content/mu-plugins/missionmed-ivprep-live-arena/arena.js',import.meta.url),'utf8').replace("import {ArenaRecorder} from './recorder.js';",'const ArenaRecorder=globalThis.FrontendRecorder;');
await import('data:text/javascript;base64,'+Buffer.from(frontend).toString('base64'));
await new Promise(r=>setTimeout(r,10));element('attempts').value=old;
await element('start').onclick();ok(element('player').srcObject.getVideoTracks().length===1&&element('player').srcObject.getAudioTracks().length===0&&element('player').muted,'Live preview has video only, no audio feedback path');ok(element('award').disabled&&element('undo').disabled&&element('review').disabled&&!element('end').disabled,'Prior reviewed attempt cannot score during new recording; local stop remains available');await element('end').onclick();ok(element('player').srcObject===null&&!element('player').muted,'Finalized playback clears preview and restores audio');
ok(element('attempts').value===newAttempt&&element('attempts').disabled,'Unsaved new clip remains selected after finish conflict');
await element('reload').onclick();await element('retry').onclick();
ok(element('attempts').value===newAttempt,'Deferred finish retry retains correct interview selection');
// Even if an external UI mutation points at historical A, custody cannot be bypassed.
element('attempts').value=old;element('file').files=[new Blob(['old'])];await element('file').onchange();ok(element('status').textContent.includes('current interview'),'Historical clip cannot discard unsaved new clip');
element('attempts').value=newAttempt;element('file').files=[testBlob];await element('file').onchange();
ok(element('media-status').textContent.includes('fingerprint matches'),'Recovered clip reopens against saved fingerprint');
ok(!element('start').disabled,'Next interview available after recovered clip custody');
console.log('Frontend conflict/custody regression passed using mocks; no real media success inferred.');
