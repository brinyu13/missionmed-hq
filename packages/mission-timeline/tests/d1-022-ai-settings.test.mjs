import assert from 'node:assert/strict';
import test from 'node:test';
import {founderStandardsView,mountTimelineAiSettings,mountFounderStandardsManager,timelineAiSettingsState,TIMELINE_AI_DISCLOSURE_022} from '../web/js/production/ai-settings-022.js';

class Element {
  constructor(tag,ownerDocument){this.tagName=tag.toUpperCase();this.ownerDocument=ownerDocument;this.children=[];this.listeners=new Map();this.attributes={};this.textContent='';this.className='';this.value='';this.checked=false;this.disabled=false;}
  append(...children){for(const child of children){child.parentElement?.children.splice(child.parentElement.children.indexOf(child),1);child.parentElement=this;this.children.push(child);}}
  replaceChildren(...children){this.children.forEach(child=>{child.parentElement=null;});this.children=[];this.append(...children);}
  setAttribute(name,value){this.attributes[name]=String(value);}
  addEventListener(name,listener){const listeners=this.listeners.get(name)||[];listeners.push(listener);this.listeners.set(name,listeners);}
  dispatch(name){for(const listener of this.listeners.get(name)||[])listener({preventDefault(){},target:this});}
  remove(){if(this.parentElement)this.parentElement.children.splice(this.parentElement.children.indexOf(this),1);this.parentElement=null;}
  all(){return this.children.flatMap(child=>[child,...child.all()]);}
  querySelectorAll(selector){return this.all().filter(el=>el.tagName===selector.toUpperCase());}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
  get text(){return[this.textContent,...this.children.map(child=>child.text)].join(' ');}
}
function dom(){const doc={createElement(tag){return new Element(tag,doc);},querySelector(){return null;}};doc.head=doc.createElement('head');return doc.createElement('div');}
function client(extra={}){let callback;return{bootstrapState:{role:'STUDENT',aiProcessingAvailable:true,aiConsent:false,aiConsentVersion:'d1-022-ai-v1',...extra},subscribeClaims(fn){callback=fn;return()=>{callback=null;};},notify(){callback?.({});}};}
const button=(host,text)=>host.all().find(el=>el.tagName==='BUTTON'&&el.textContent===text);
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));

test('Permission begins unchecked, Not now performs no write, and submit requires explicit check',async()=>{
 const host=dom();const auth=client();const calls=[];let closed=0;auth.setAiConsent=async decision=>{calls.push(decision);auth.bootstrapState.aiConsent=true;};
 const view=mountTimelineAiSettings(host,{authClient:auth,onClose:()=>closed++});
 const check=host.all().find(el=>el.type==='checkbox');assert.equal(check.checked,false);assert.equal(button(host,'Enable Timeline AI').disabled,true);
 host.querySelector('form').dispatch('submit');await tick();assert.equal(calls.length,0);
 button(host,'Not now').dispatch('click');assert.equal(closed,1);assert.equal(calls.length,0);
 check.checked=true;check.dispatch('change');assert.equal(button(host,'Enable Timeline AI').disabled,false);
 host.querySelector('form').dispatch('submit');await tick();assert.deepEqual(calls,['grant']);assert.match(host.text,/Permission enabled/);view.destroy();assert.equal(host.children.length,0);
});

test('No optimistic enabled state: failed server acknowledgement remains unconsented and reports error',async()=>{
 const host=dom();const auth=client();let release;let changes=0;auth.setAiConsent=()=>new Promise(resolve=>{release=resolve;});
 mountTimelineAiSettings(host,{authClient:auth,onChange:()=>changes++});const check=host.all().find(el=>el.type==='checkbox');check.checked=true;check.dispatch('change');host.querySelector('form').dispatch('submit');
 assert.match(host.text,/Saving your choice/);assert.doesNotMatch(host.text,/Permission enabled/);release({ok:true});await tick();
 assert.equal(changes,0);assert.match(host.text,/server has not confirmed/);assert.match(host.text,/Permission not enabled/);assert.equal(host.all().find(el=>el.type==='checkbox').checked,false);
});

test('Revocation waits for server claims and notifies the host only after acknowledgement',async()=>{
 const host=dom();const auth=client({aiConsent:true,aiConsentedAt:'2026-09-06T01:00:00Z'});const changes=[];const calls=[];
 auth.setAiConsent=async decision=>{calls.push(decision);auth.bootstrapState.aiConsent=false;auth.notify();};
 mountTimelineAiSettings(host,{authClient:auth,onChange:event=>changes.push(event)});button(host,'Withdraw AI permission').dispatch('click');await tick();
 assert.deepEqual(calls,['withdraw']);assert.equal(changes.length,1);assert.equal(changes[0].state.consented,false);assert.match(host.text,/Future AI requests are disabled/);
});

test('Unavailable provider preserves withdrawal and manual flow; admin lens cannot grant student consent',()=>{
 const host=dom();const auth=client({aiConsent:true,aiProcessingAvailable:false});mountTimelineAiSettings(host,{authClient:auth});
 assert.ok(button(host,'Withdraw AI permission'));assert.equal(button(host,'Enable Timeline AI'),undefined);assert.match(host.text,/editor and MissionMed rules remain available/);
 const admin=dom();mountTimelineAiSettings(admin,{authClient:client({role:'PROGRAM_ADMIN'})});assert.equal(admin.querySelector('form'),null);assert.match(admin.text,/managed by each student/);
 assert.equal(timelineAiSettingsState(client({aiConsentVersion:'',configuredAiConsentVersion:'d1-022-ai-v1'})).version,'d1-022-ai-v1');
 assert.match(TIMELINE_AI_DISCLOSURE_022.storage,/does not mean every form of provider retention is disabled/);
});

test('Founder management does not load or mutate for a client without the verified manager presentation capability',async()=>{
 let calls=0;const auth=client({role:'PROGRAM_ADMIN',founderStandardsManager:false});auth.request=async()=>{calls++;};const host=dom();mountFounderStandardsManager(host,{authClient:auth});await tick();
 assert.equal(calls,0);assert.match(host.text,/authorized standards manager/);
});

test('Retirement cannot resurrect old approval; rejected new draft retains prior current approval',()=>{
 const revisions=[{standard_id:'example',version:1},{standard_id:'example',version:2}];const decisions=[{standard_id:'example',version:1,sequence:'9007199254740993',decision:'APPROVE'},{standard_id:'example',version:2,sequence:'9007199254740994',decision:'REJECT'}];
 let view=founderStandardsView({revisions,decisions});assert.equal(view.find(r=>r.version===1).current,true);assert.equal(view.find(r=>r.version===2).status,'REJECTED');
 decisions.push({standard_id:'example',version:2,sequence:'9007199254740995',decision:'APPROVE'},{standard_id:'example',version:2,sequence:'9007199254740996',decision:'RETIRE'});
 view=founderStandardsView({revisions,decisions});assert.equal(view.some(r=>r.current),false);assert.equal(view.find(r=>r.version===2).status,'RETIRED');assert.equal(view.find(r=>r.version===1).status,'SUPERSEDED');
});

test('Founder approval is explicit, exact-version bound, and sends no action before reviewed source/reference/reason',async()=>{
 const host=dom();const auth=client({role:'PROGRAM_ADMIN',founderStandardsManager:true});const calls=[];
 const row={standard_id:'synthetic-guidance',title:'Synthetic only',version:2,guidance:'<script>not markup</script>',kind:'LAYOUT',provenance_json:{dataClass:'SYNTHETIC',sourceRef:'SYNTHETIC-TEST',sourceSha256:'a'.repeat(64)},applicability_json:{workflows:['GUARDIAN'],categoryIds:[]}};
 auth.request=async(path,options)=>{calls.push({path,options});return{revisions:[row],decisions:[]};};
 mountFounderStandardsManager(host,{authClient:auth});await tick();assert.equal(calls.length,1);assert.match(host.text,/<script>not markup<\/script>/);assert.equal(host.querySelector('script'),null);
 const approve=button(host,'Approve this exact version');assert.equal(approve.disabled,true);approve.dispatch('click');await tick();assert.equal(calls.length,1);
 const card=host.all().find(el=>el.className==='tl-ai022-decision');const input=card.querySelector('input'),reason=card.querySelector('textarea'),check=card.all().find(el=>el.type==='checkbox');
 input.value='synthetic-explicit-approval';input.dispatch('input');reason.value='Synthetic unit-test approval only.';reason.dispatch('input');assert.equal(approve.disabled,true);check.checked=true;check.dispatch('change');assert.equal(approve.disabled,false);
 approve.dispatch('click');await tick();const post=calls.find(call=>call.options?.method==='POST');assert.deepEqual(post.options.body,{standardId:'synthetic-guidance',version:2,decision:'APPROVE',approvalRef:'synthetic-explicit-approval',reason:'Synthetic unit-test approval only.'});
});
