import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { handleUsceAdminOfferRoute,handleUsceOfferPortalPublicRoute } from '../routes/usce-offer-portal.mjs';
const {JSDOM}=createRequire(import.meta.url)('/Users/brianb/MissionMed/node_modules/jsdom');
process.env.MMHQ_SUPABASE_URL='https://fglyvdykwgbuivikqoah.supabase.co';
process.env.MMHQ_SUPABASE_SERVICE_ROLE_KEY='synthetic-options-test';
const id=randomUUID(),intake=randomUUID(),session={user:{id:1,login:'qa',roles:['administrator']}};
const option=(overrides={})=>({id:randomUUID(),program_type:'Observership',specialty:'Internal Medicine',location:'Boston',month_label:'November 2026',duration_weeks:4,date_window_start:'2026-11-01',date_window_end:'2026-11-28',...overrides});
async function route(path,body={},method='PATCH',student=false){
 const req=Readable.from([Buffer.from(JSON.stringify(body))]);req.method=method;req.headers={};req.socket={remoteAddress:'127.0.0.1'};
 let status,reply;const res={writeHead(s){status=s;},end(s){reply=JSON.parse(s)}};
 await (student?handleUsceOfferPortalPublicRoute:handleUsceAdminOfferRoute)(req,res,new URL('http://local'+path),{session});return {status,reply};
}
function mocked(fn){const old=globalThis.fetch;globalThis.fetch=async(url,opts)=>{assert.ok(String(url).startsWith('https://fglyvdykwgbuivikqoah.supabase.co/rest/v1/rpc/'),'No provider calls');return Response.json(fn(String(url).split('/').at(-1),JSON.parse(opts.body)));};return ()=>globalThis.fetch=old;}
test('options persist through existing update and derive primary scalar compatibility',async()=>{
 const options=[option(),option({location:'Chicago',specialty:'Pediatrics'})];let saved;
 const restore=mocked((name,b)=>{assert.equal(name,'update_usce_offer_draft');saved=b.p_offer;return {ok:true,item:saved}});
 try {assert.equal((await route('/api/usce/admin/offers/'+id,{expected_revision:3,options,specialty:'Wrong'})).status,200);assert.deepEqual(saved.options,options);assert.equal(saved.specialty,options[0].specialty);assert.equal(saved.format,options[0].program_type);assert.equal(saved.expected_revision,3);}finally{restore();}
});
test('legacy payload omission does not clear options and explicit empty list remains legacy',async()=>{
 const bodies=[];const restore=mocked((n,b)=>{bodies.push(b.p_offer);return {ok:true}});
 try {await route('/api/usce/admin/offers/'+id,{expected_revision:2,specialty:'Legacy'});await route('/api/usce/admin/offers/'+id,{expected_revision:2,options:[]});assert.equal(Object.hasOwn(bodies[0],'options'),false);assert.deepEqual(bodies[1].options,[]);}finally{restore();}
});
test('rejects malformed, duplicate, excessive and inconsistent option fields without persistence',async()=>{
 const first=option(); const bad=[{},[first,first],Array.from({length:6},()=>option()),[option({id:'forged'})],[option({duration_weeks:25})],[option({duration_weeks:'4'})],[option({specialty:''})],[option({location:'x'.repeat(181)})],[option({date_window_start:'2026-02-30'})],[option({date_window_start:null})],[option({date_window_end:'2026-10-01'})]];
 const restore=mocked(()=>{throw Error('invalid input must not persist')});
 try{for(const options of bad)assert.equal((await route('/api/usce/admin/offers/'+id,{expected_revision:1,options})).reply.error,'invalid_offer_options');}finally{restore();}
});
test('preview renders every independent option and binds canonical snapshot in hash',async()=>{
 const offer={id,revision:2,intake:{email:'qa@example.invalid'},options:[option(),option({program_type:'Externship',specialty:'Surgery',location:'Seattle',month_label:'December 2026'})]};
 const restore=mocked((name,b)=>name==='get_usce_offer_draft_admin'?{ok:true,item:offer}:{ok:true,data:b.p_message});
 try {const body={subject:'TEST',body:'Controlled test',to_email:'qa@example.invalid'},path='/api/usce/admin/offers/'+id+'/message-preview';const a=await route(path,body,'POST');assert.equal(a.status,200);assert.deepEqual(a.reply.data.rendered_email.offer_options,offer.options);assert.equal(a.reply.data.rendered_email.text_body.match(/Specialty:/g).length,2);assert.equal(a.reply.data.rendered_email.text_body.includes('Format: Not specified'),false);assert.match(a.reply.data.rendered_email.text_body,/Option 2\nProgram: Externship\nSpecialty: Surgery\nLocation: Seattle/);offer.options[1].date_window_end='2026-12-28';const b=await route(path,body,'POST');assert.notEqual(a.reply.data.preview_hash,b.reply.data.preview_hash);}finally{restore();}
});
test('applicant only forwards validated ID and revision, never a client selected snapshot',async()=>{
 const chosen=option();let payload;const restore=mocked((n,b)=>{assert.equal(n,'respond_usce_offer_by_token_hash');payload=b;return {ok:true}});
 try {const path='/api/usce/offer/usce_'+'a'.repeat(43)+'/respond';assert.equal((await route(path,{action:'accept',selected_option_id:chosen.id,expected_revision:5,selected_option:{forged:true}},'POST',true)).status,200);assert.equal(payload.p_metadata.selected_option_id,chosen.id);assert.equal(payload.p_metadata.expected_revision,5);assert.equal(payload.p_metadata.selected_option,undefined);assert.equal((await route(path,{action:'accept',selected_option_id:'bad'},'POST',true)).reply.error,'invalid_option_selection');}finally{restore();}
});
function applicant(){
 const html=fs.readFileSync(new URL('../../LIVE/usce_offer.html',import.meta.url),'utf8');
 const dom=new JSDOM(html,{url:'https://synthetic.invalid',runScripts:'outside-only'}),w=dom.window;
 w.fetch=()=>{throw Error('No network')};w.HTMLElement.prototype.scrollIntoView=()=>{};
 const script=[...w.document.querySelectorAll('script')].map(x=>x.textContent).find(s=>s.includes('function mapApiOfferToView'));
 w.__MISSIONMED_USCE_OFFER_CONFIG={};
 w.eval(script.replace("document.addEventListener('DOMContentLoaded', init);","window.TEST={state,cacheEls,applyOffer,mapApiOfferToView,showConfirmBar,respondToOffer};"));
 const t=w.TEST;t.cacheEls();return {dom,w,t};
}
test('applicant requires explicit option, safely renders text, reviews chosen dates and resets stale choice',()=>{
 const {dom,w,t}=applicant();try{
 const options=[option(),option({program_type:'<img src=x onerror=alert(1)>',location:'Seattle'})];
 t.applyOffer(t.mapApiOfferToView({id,revision:1,options,status:'sent'}));
 t.showConfirmBar('accepted');assert.equal(w.document.querySelector('#acceptConfirm').classList.contains('open'),false);
 const radios=w.document.querySelectorAll('input[name=offer-option]');assert.equal(radios.length,2);assert.equal(w.document.querySelector('#offerOptionCards img'),null);
 radios[1].checked=true;radios[1].dispatchEvent(new w.Event('change'));t.showConfirmBar('accepted');
 assert.match(w.document.querySelector('#selectedOptionReview').textContent,/Seattle.*2026-11-28/);
 t.applyOffer(t.mapApiOfferToView({id,revision:2,options,status:'sent'}));assert.equal(t.state.selectedOptionId,'');
 t.applyOffer(t.mapApiOfferToView({id,revision:2,options,status:'accepted',selected_option_id:options[1].id,selected_option:options[1]}));
 assert.equal(w.document.querySelectorAll('input[name=offer-option]:disabled').length,2);assert.equal(t.state.selectedOptionId,options[1].id);
 }finally{dom.window.close();}
});

 test('bound email reuses branded HTML tracker with escaped exact choices and only canonical action links',async()=>{
 const offer={id,revision:2,intake:{email:'qa@example.invalid'},options:[option(),option({location:'Chicago <script>alert(1)</script>',specialty:'Family Medicine'})]};
 const restore=mocked((name,b)=>name==='get_usce_offer_draft_admin'?{ok:true,item:offer}:{ok:true,data:b.p_message});
 try{const token='usce_'+'a'.repeat(43),url='https://cdn.missionmedinstitute.com/html-system/LIVE/usce_offer.html?offer='+token;const a=await route('/api/usce/admin/offers/'+id+'/message-preview',{subject:'TEST',body:'CONTROLLED TEST <img src=x> https://evil.invalid/usce_offer.html '+url,to_email:'qa@example.invalid'},'POST');assert.equal(a.status,200);const mail=a.reply.data.rendered_email,dom=new JSDOM(mail.html_body),doc=dom.window.document;assert.match(mail.html_body,/Request Tracker/);assert.match(mail.html_body,/current segment is highlighted/);assert.match(doc.body.textContent,/Received.*Review.*Options.*Offer.*Next steps/s);assert.match(doc.body.textContent,/Option 2.*Family Medicine.*Chicago/s);assert.equal(doc.querySelector('script,img'),null);assert.equal([...doc.querySelectorAll('a')].some(e=>e.href.startsWith('https://evil.invalid')),false);assert.equal([...doc.querySelectorAll('a')].find(e=>e.textContent==='Review your offer').href,url);assert.equal(mail.html_sha256.length,64);assert.match(mail.text_body,/Option 2/);dom.window.close();}finally{restore();}
 });
