import assert from 'node:assert/strict';
import {test} from 'node:test';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const {JSDOM}=createRequire(import.meta.url)('/Users/brianb/MissionMed/node_modules/jsdom');
const html=fs.readFileSync(new URL('../../LIVE/usce_admin.html',import.meta.url),'utf8');
function harness(){
 const dom=new JSDOM(html,{url:'https://synthetic.invalid',runScripts:'outside-only'}),w=dom.window;
 w.confirm=()=>true;w.fetch=()=>{throw Error('Network forbidden')};w.setInterval=()=>0;
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};
 let source=w.document.querySelector('script').textContent,anchor="renderRequestList(); switchView('hq'); loadLiveQueue();";
 assert.equal(source.split(anchor).length,2);
 source=source.replace(anchor,()=>"window.TEST={state,journey,openJourney,journeyStep,journeyNext,prepareJourneyMessage,saveAndCloseJourney,readOfferForm,sendOfferEmail,approvalSnapshot,offerFormSnapshot,syncOfferControlLocks,mocks(m){persistLiveOfferDraft=m.persist;recordLiveMessagePreview=m.preview;adminFetch=m.send;loadLiveQueue=async()=>{};}};");
 w.eval(source);
 const a=w.TEST,$=id=>w.document.getElementById(id),calls={persist:[],preview:[],send:[]};
 const r={id:'case-a',name:'Synthetic Student',email:'student@example.test',status:'NEW',specialties:['Internal Medicine'],locations:['New York'],months:['Oct 2026'],length:'4 weeks',comms:[],offerHistory:[],createdAt:Date.now()};
 Object.assign(a.state,{requests:[r],adapter:'live',selectedRequestId:r.id});
 let revision=1;
 const persist=async o=>{calls.persist.push(o);const saved={...o,id:'offer-a',revision:revision++,detailsLoaded:true,portalUrl:'https://cdn.missionmedinstitute.com/html-system/LIVE/usce_offer.html?offer=synthetic-only'};a.state.liveOffersByRequest[r.id]=saved;return saved};
 const preview=async(id,d)=>{calls.preview.push({id,...d});const saved=a.state.liveOffersByRequest[r.id];saved.subject=d.subject;saved.body=d.body;return{data:{preview_hash:'synthetic-hash-'+calls.preview.length,revision:saved.revision,rendered_email:{to_email:d.to,subject:d.subject,body:d.body,text_body:d.body,from_name:'Synthetic Clinicals',from_email:'clinicals@example.test',reply_to:'reply@example.test'}}}};
 const send=async(...args)=>{calls.send.push(args);return{data:{mode:'dry_run'}}};
 a.mocks({persist,preview,send});
 const input=(id,value)=>{$(id).value=value;$(id).dispatchEvent(new w.Event('input',{bubbles:true}))};
 const approve=()=>{$('mmJourneyApproval').checked=true;$('mmJourneyApproval').dispatchEvent(new w.Event('change',{bubbles:true}))};
 return{dom,w,a,$,r,calls,persist,preview,send,input,approve};
}
function check(name,fn){test(name,async()=>{const h=harness();try{await fn(h)}finally{h.dom.window.close()}})}
check('unique moved controls; open/progress/back/save-close never sends',async({a,$,w,calls})=>{
 const ids=[...w.document.querySelectorAll('[id]')].map(e=>e.id);assert.equal(new Set(ids).size,ids.length);assert.equal($('mmOfProgram').closest('section').id,'mmJourneyProgramHost');
 a.openJourney();assert.equal($('mmJourneyScrim').open,true);assert.equal(a.journey.step,0);
 await a.journeyNext();assert.equal(a.journey.step,1);await a.journeyNext();assert.equal(a.journey.step,2);await a.journeyNext();assert.equal(a.journey.step,3);assert.equal(calls.preview.length,1);
 $('mmJourneyBack').click();assert.equal(a.journey.step,2);await a.saveAndCloseJourney();assert.equal($('mmJourneyScrim').open,false);assert.equal(calls.send.length,0);
});
check('responded offer locks terms and blocks save/open/send',async({a,$,calls})=>{
 a.openJourney();a.state.liveOffersByRequest['case-a']={...a.readOfferForm(),id:'offer-a',detailsLoaded:true,status:'ACCEPTED'};a.syncOfferControlLocks();assert.equal($('mmOfProgram').disabled,true);assert.equal(a.readOfferForm(),null);
 $('mmJourneyScrim').close();a.openJourney();assert.equal($('mmJourneyScrim').open,false);await a.sendOfferEmail();assert.equal(calls.send.length,0);
});
check('editable email, blank and template invalidate approval and require new preview',async({a,$,input,approve,calls})=>{
 a.openJourney();a.journeyStep(3);await a.prepareJourneyMessage();approve();assert.equal(a.state.draftEmail.approved,true);
 input('mmJourneyMessage','Edited original message');assert.equal(a.state.draftEmail.approved,false);assert.equal($('mmJourneySendNow').disabled,true);
 await a.prepareJourneyMessage();assert.equal(calls.preview.at(-1).body.startsWith('Edited original message'),true);
 approve();$('mmJourneyBlank').click();$('mmJourneyReplaceConfirm').click();assert.equal(a.state.draftEmail.approved,false);await assert.rejects(a.prepareJourneyMessage(),/Add a subject/);
 $('mmJourneyUseTemplate').click();$('mmJourneyReplaceConfirm').click();assert.ok($('mmJourneySubject').value);assert.ok($('mmJourneyMessage').value);await a.prepareJourneyMessage();assert.equal(calls.preview.length,3);assert.equal(calls.send.length,0);
});
check('changed content/proof/sender/case cannot send; exact approved version sends once',async({a,approve,calls})=>{
 a.openJourney();a.journeyStep(3);await a.prepareJourneyMessage();
 for(const key of ['subject','previewHash','revision']){approve();const old=a.state.draftEmail[key];a.state.draftEmail[key]=String(old)+'changed';await a.sendOfferEmail();assert.equal(calls.send.length,0);a.state.draftEmail[key]=old;}
 approve();a.state.selectedRequestId='different';await a.sendOfferEmail();assert.equal(calls.send.length,0);a.state.selectedRequestId='case-a';
 approve();a.state.draftEmail.sender.reply_to='invalid';await a.sendOfferEmail();assert.equal(calls.send.length,0);a.state.draftEmail.sender.reply_to='reply@example.test';
 approve();assert.equal(await a.sendOfferEmail(),'Test recorded — no email sent.');assert.equal(calls.send.length,1);
 const body=calls.send[0][2].body;assert.equal(body.approve_live_send,true);assert.equal(body.preview_hash,a.state.draftEmail.previewHash);assert.equal(body.revision,a.state.draftEmail.revision);
});
check('saved custom composer reopens when backend returns stored subject/body',async({a,$,input,calls})=>{
 a.openJourney();a.journeyStep(3);input('mmJourneySubject','Saved custom subject');input('mmJourneyMessage','Saved custom message');await a.saveAndCloseJourney();
 assert.equal($('mmJourneyScrim').open,false);a.openJourney();assert.equal($('mmJourneySubject').value,'Saved custom subject');assert.equal($('mmJourneyMessage').value,'Saved custom message');assert.equal(calls.send.length,0);
});
check('deferred save rejects case race; deferred preview rejects message race',async({a,input,persist,preview,send,calls})=>{
 a.openJourney();let release;const gate=new Promise(r=>{release=r});a.mocks({persist:async o=>{await gate;return persist(o)},preview,send});
 const pending=a.prepareJourneyMessage();a.state.selectedRequestId='different';release();await assert.rejects(pending,/case or form changed/);assert.equal(calls.preview.length,0);
 a.state.selectedRequestId='case-a';let done;const gate2=new Promise(r=>{done=r});a.mocks({persist,preview:async(...args)=>{await gate2;return preview(...args)},send});
 const pending2=a.prepareJourneyMessage();await new Promise(r=>setImmediate(r));input('mmJourneyMessage','Changed during preview');done();await assert.rejects(pending2,/case or message changed/);assert.equal(a.state.draftEmail,null);assert.equal(calls.send.length,0);
});

check('untouched template follows current terms without duplicated stale terms',async({a,$,input,calls})=>{
 a.openJourney();input('mmOfSpecialty','Family Medicine');input('mmOfLength','8 weeks');
 await a.prepareJourneyMessage();
 const offer=calls.persist.at(-1),mail=calls.preview.at(-1);
 assert.equal(offer.specialty,'Family Medicine');assert.equal(offer.length,'8 weeks');
 assert.match(mail.subject,/Family Medicine/);assert.doesNotMatch(mail.body,/Specialty: Internal Medicine|Length: 4 weeks/);
 assert.doesNotMatch($('mmJourneyMessage').value,/Review offer:|offer=synthetic-only/);
});
check('responded offer retains coordinator records; case actions close native details before prompt',async({a,$})=>{
 a.openJourney();a.state.liveOffersByRequest['case-a']={...a.readOfferForm(),id:'offer-a',detailsLoaded:true,status:'ACCEPTED'};a.syncOfferControlLocks();
 assert.equal($('mmOpenOps').disabled,false);$('mmOpenOps').click();assert.equal($('mmOpsDialog').open,true);$('mmOpsClose').click();
 $('mmReadStudentRequest').click();assert.equal($('mmCaseFactsDialog').open,true);$('mmActNote').click();
 assert.equal($('mmCaseFactsDialog').open,false);assert.equal($('mmPromptScrim').classList.contains('is-open'),true);
});

check('default email uses newly edited student-facing instructions',async({a,input,calls})=>{
 a.openJourney();input('mmOfInstructions','Bring the required orientation document.');
 await a.prepareJourneyMessage();
 assert.equal(calls.persist.at(-1).instructions,'Bring the required orientation document.');
 assert.match(calls.preview.at(-1).body,/Bring the required orientation document\./);
});

check('inline replacement preserves edits until confirmed and rejects stale case/message',async({a,$,input,calls,w})=>{
 a.openJourney();a.journeyStep(3);input('mmJourneySubject','Keep this subject');input('mmJourneyMessage','Keep this body');
 w.confirm=()=>{throw Error('Email choices must not use a browser popup')};
 const recipient=$('mmJourneyTo').textContent,program=$('mmOfProgram').value;
 $('mmJourneyBlank').click();assert.equal($('mmJourneyReplacePrompt').hidden,false);assert.equal($('mmJourneyMessage').value,'Keep this body');
 $('mmJourneyReplaceCancel').click();assert.equal($('mmJourneyMessage').value,'Keep this body');assert.equal($('mmJourneyReplacePrompt').hidden,true);
 $('mmJourneyBlank').click();input('mmJourneyMessage','Newer edit');$('mmJourneyReplaceConfirm').click();assert.equal($('mmJourneyMessage').value,'Newer edit');
 $('mmJourneyBlank').click();a.state.selectedRequestId='different';$('mmJourneyReplaceConfirm').click();assert.equal($('mmJourneyMessage').value,'Newer edit');a.state.selectedRequestId='case-a';
 $('mmJourneyBlank').click();$('mmJourneyReplaceConfirm').click();assert.equal($('mmJourneySubject').value,'');assert.equal($('mmJourneyMessage').value,'');assert.equal($('mmJourneyTo').textContent,recipient);assert.equal($('mmOfProgram').value,program);
 $('mmJourneyUseTemplate').click();$('mmJourneyReplaceConfirm').click();assert.ok($('mmJourneyMessage').value);assert.equal(calls.persist.length,0);assert.equal(calls.preview.length,0);assert.equal(calls.send.length,0);
});

for(const [name,response,expected] of [
 ['provider outcome',{ok:true,mode:'live',dry_run:false,data:{provider_outcome:'provider_accepted',claim:{state:'provider_accepted',mode:'live'}}},'Email accepted by provider. Delivery is tracked in Activity.'],
 ['idempotent accepted claim',{ok:true,mode:'live',idempotent:true,dry_run:false,data:{claim:{state:'provider_accepted',mode:'live'}}},'Email accepted by provider. Delivery is tracked in Activity.'],
 ['history reconciliation',{ok:true,mode:'live',history_sync:'requires_reconciliation',dry_run:false,data:{provider_outcome:'provider_accepted',claim:{state:'provider_accepted',mode:'live'}}},'Email accepted by provider. History needs reconciliation; do not resend.'],
 ['route dry run',{ok:true,mode:'live',dry_run:true,data:{provider_outcome:'dry_run',claim:{state:'dry_run',mode:'dry_run'}}},'Test recorded — no email sent.'],
 ['queued',{ok:true,data:{status:'queued'}},'Message queued. Check Activity for its outcome.'],
 ['unknown live mode',{ok:true,mode:'live',data:{}},'Send request recorded. Refresh Activity to verify the outcome.']
])check('Journey reports '+name+' from route-shaped response without claiming delivery',async({a,$,approve,persist,preview,calls})=>{
 a.mocks({persist,preview,send:async(...args)=>{calls.send.push(args);return response}});
 a.openJourney();a.journeyStep(3);await a.prepareJourneyMessage();a.journeyStep(4);approve();await a.journeyNext();$('mmJourneySendNow').click();await new Promise(resolve=>setImmediate(resolve));
 assert.equal($('mmJourneySendResult').textContent,expected);assert.equal($('mmJourneyState').textContent,expected);assert.equal(calls.send.length,1);assert.equal($('mmJourneySendNow').disabled,true);
 $('mmJourneySendNow').click();await new Promise(resolve=>setImmediate(resolve));assert.equal(calls.send.length,1);assert.doesNotMatch($('mmJourneySendResult').textContent,/Delivery recorded|delivered/i);
});
