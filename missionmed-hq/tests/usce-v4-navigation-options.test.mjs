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
 source=source.replace(anchor,()=>"window.TEST={state,journey,openJourney,journeyStep,journeyNext,prepareJourneyMessage,saveAndCloseJourney,readOfferForm,sendOfferEmail,approvalSnapshot,offerFormSnapshot,syncOfferControlLocks,renderOfferBuilder,offerPayload,mergeLiveOffer,collectJourneyOptions,addJourneyOption,removeJourneyOption,applyKpiFilter,filteredRequests,setV3Workspace,renderRequestList,renderOfferSummary,renderJourneyReview,updateJourneyDates,renderSelectedStatus,closeJourneyWithoutSave,mocks(m){persistLiveOfferDraft=m.persist;recordLiveMessagePreview=m.preview;adminFetch=m.send;loadLiveQueue=async()=>{};}};");
 w.eval(source); w.eval(w.document.querySelectorAll('script')[1].textContent);
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

check('left rail is the only app navigation and Overview without a selected case is functional',async({a,w,$})=>{
 assert.equal(w.document.querySelector('.mm-topbar'),null);assert.equal(w.document.querySelector('[data-v3-workspace]'),null);
 a.state.selectedRequestId=null;w.document.querySelector('[data-sf-nav="overview"]').click();
 assert.equal($('mmCx').dataset.workspace,'overview');assert.match(w.document.querySelector('#mmWorkspace > .mm-hero p').textContent,/Select a student/);assert.equal(w.document.querySelector('[data-sf-nav="overview"]').disabled,false);assert.equal(w.document.querySelectorAll('.mm-req-item').length,1);
 w.document.querySelector('[data-sf-nav="pipeline"]').click();assert.equal(w.document.querySelectorAll('.mm-pipeline-lane').length,4);
 w.document.querySelector('[data-sf-nav="cases"]').click();assert.equal($('mmCx').dataset.workspace,'dashboard');
});
check('KPI filters clear incompatible state and include every recorded status alias',async({a,w,$,r})=>{
 a.state.selectedRequestId=null;a.state.requests=['NEW','IN_PROGRESS','OFFERED','OFFER_SENT','OFFER_DECLINE_PENDING','ACCEPTED','OFFER_ACCEPTED','ARCHIVED'].map((status,i)=>({...r,id:'case-'+i,status}));
 for(const [key,count] of [['new',1],['progress',1],['offered',3],['accepted',2]]){Object.assign(a.state,{query:'no matching student',workFilter:'archived',filter:'ARCHIVED'});a.applyKpiFilter(key);assert.equal(a.filteredRequests().length,count);assert.equal(a.state.query,'');assert.equal(a.state.workFilter,'active');assert.equal(a.state.filter,'all');assert.equal(w.document.querySelector('[data-kpi="'+key+'"]').getAttribute('aria-pressed'),'true');assert.equal($('mmKpiClear').hidden,false);}
 $('mmKpiClear').click();assert.equal(a.state.kpiFilter,null);assert.equal(a.filteredRequests().length,7);assert.equal($('mmKpiClear').hidden,true);
});
function completeExtras(h){for(const el of h.w.document.querySelectorAll('[data-option-field]')){const k=el.dataset.optionField;const v={program_type:'Distinct verified program',specialty:'Neurology',location:'Boston',month_label:'Nov 2026',duration_weeks:'8',date_window_start:'2026-11-02',date_window_end:'2026-12-25'}[k];el.value=v;el.dispatchEvent(new h.w.Event('input',{bubbles:true}));}}
check('legacy stays empty until Add; independent dates and stable IDs persist through save exit and reload',async(h)=>{
 const {a,$,calls}=h;a.openJourney();assert.equal(a.readOfferForm().options.length,0);$('mmAddOption').click();const ids=a.journey.options.map(o=>o.id);assert.equal(new Set(ids).size,2);completeExtras(h);
 h.input('mmOfStart','2026-10-05');h.input('mmOfEnd','2026-10-30');h.input('mmOfMonthLabel','Oct 2026');const form=a.readOfferForm();assert.equal(form.options[1].date_window_start,'2026-11-02');assert.equal(form.options[0].date_window_start,'2026-10-05');assert.equal(form.options[1].duration_weeks,8);assert.equal(a.offerPayload(form).options.length,2);assert.equal(a.offerPayload(form).specialty,form.options[0].specialty);
 a.journeyStep(2);$('mmJourneyBack').click();assert.equal(JSON.stringify(a.collectJourneyOptions().map(o=>o.id)),JSON.stringify(ids));await a.saveAndCloseJourney();assert.equal(calls.send.length,0);a.openJourney();assert.equal(JSON.stringify(a.collectJourneyOptions().map(o=>o.id)),JSON.stringify(ids));assert.equal(a.readOfferForm().options[1].date_window_end,'2026-12-25');
 const dto={id:'offer-a',intake_request_id:'case-a',options:JSON.parse(JSON.stringify(form.options)),format:form.program,specialty:form.specialty,location:form.location,timing:'Oct 2026',duration_weeks:4,admin_message:'',status:'draft',revision:7,expires_at:new Date(form.expiresAt).toISOString()};a.mergeLiveOffer(dto,'case-a');a.renderOfferBuilder(h.r);assert.equal(JSON.stringify(a.collectJourneyOptions().map(o=>o.id)),JSON.stringify(ids));
});
check('max five options; remove primary promotes exact next option and invalidates approval',async(h)=>{
 const {a,$}=h;a.openJourney();$('mmAddOption').click();completeExtras(h);const second=a.journey.options[1].id;const first=a.journey.options[0].id;a.state.draftEmail={approved:true};a.removeJourneyOption(first);assert.equal(a.journey.options[0].id,second);assert.equal($('mmOfProgram').value,'Distinct verified program');assert.equal(a.collectJourneyOptions()[0].program_type,'Distinct verified program');assert.equal($('mmOfSpecialty').value,'Neurology');assert.equal($('mmOfStart').value,'2026-11-02');assert.equal(a.state.draftEmail.approved,false);await a.saveAndCloseJourney();a.openJourney();assert.equal(a.collectJourneyOptions()[0].id,second);assert.equal(a.collectJourneyOptions()[0].program_type,'Distinct verified program');for(let i=0;i<8;i++)a.addJourneyOption();assert.equal(a.journey.options.length,5);assert.equal($('mmAddOption').disabled,true);
});
check('incomplete options, invalid duration and date order block saving without sends',async(h)=>{
 const {a,$,calls}=h;a.openJourney();$('mmAddOption').click();assert.equal(a.readOfferForm(),null);completeExtras(h);const input=h.w.document.querySelector('[data-option-field="duration_weeks"]');input.value='25';input.dispatchEvent(new h.w.Event('input',{bubbles:true}));assert.equal(a.readOfferForm(),null);completeExtras(h);h.input('mmOfEnd','2026-10-01');h.input('mmOfStart','2026-10-05');assert.equal(a.readOfferForm(),null);assert.equal(calls.send.length,0);
});
check('server checked preview and grouped review contain every saved option; later edits invalidate approval',async(h)=>{
 const {a,$,persist,send,approve}=h;a.openJourney();$('mmAddOption').click();completeExtras(h);a.mocks({persist,send,preview:async(id,d)=>{const o=a.state.liveOffersByRequest['case-a'];return{data:{preview_hash:'all-options-proof',revision:o.revision,rendered_email:{to_email:d.to,subject:d.subject,body:d.body,text_body:d.body+'\n'+o.options.map(v=>v.specialty+' '+v.location+' '+v.month_label).join('\n'),from_name:'Synthetic Clinicals',from_email:'clinicals@example.test',reply_to:'reply@example.test'}}}}});await a.prepareJourneyMessage();a.renderJourneyReview();assert.equal(h.w.document.querySelectorAll('.mm-review-option').length,2);assert.equal(a.state.draftEmail.subject,'Your MissionMed rotation options');assert.match($('mmJourneyReviewMessage').textContent,/Neurology Boston Nov 2026/);approve();const el=h.w.document.querySelector('[data-option-field="location"]');el.value='Chicago';el.dispatchEvent(new h.w.Event('input',{bubbles:true}));assert.equal(a.state.draftEmail.approved,false);assert.notEqual(a.offerFormSnapshot(),a.journey.preparedForm);
});
check('accepted option two is clearly shown while both original alternatives remain visible',async(h)=>{
 const {a,$}=h;a.openJourney();$('mmAddOption').click();completeExtras(h);const form=a.readOfferForm();a.mergeLiveOffer({id:'offer-a',intake_request_id:'case-a',options:form.options,selected_option_id:form.options[1].id,selected_option:form.options[1],format:form.program,specialty:form.specialty,location:form.location,timing:'Oct 2026',duration_weeks:4,admin_message:'',status:'accepted',revision:8},'case-a');a.renderOfferSummary();assert.match($('mmOfferSummary').textContent,/Option 2 · Neurology · Boston/);assert.match($('mmOfferSummary').textContent,/Option 1/);assert.match($('mmOfferSummary').textContent,/selected by student/);
});

check('ISO preferences and human month labels compare equally across every independent option',async(h)=>{
 const {a,$,r}=h;r.months=['2027-03','2027-04'];a.openJourney();$('mmAddOption').click();completeExtras(h);h.input('mmOfMonthLabel','March 2027');h.input('mmOfStart','2027-03-01');for(const [key,value] of [['month_label','April 2027'],['date_window_start','2027-04-05'],['date_window_end','2027-04-30']]){const e=h.w.document.querySelector('[data-option-field="'+key+'"]');e.value=value;e.dispatchEvent(new h.w.Event('input',{bubbles:true}));}a.updateJourneyDates();assert.equal($('mmJourneyDateWarning').classList.contains('is-warning'),false);assert.match($('mmJourneyDateWarning').textContent,/Each option has its own dates/);assert.doesNotMatch($('mmJourneyDateWarning').textContent,/Select the month/);
 h.input('mmOfStart','2027-05-01');assert.match($('mmJourneyDateWarning').textContent,/Option 1: The start date differs/);assert.match($('mmJourneyDateWarning').textContent,/outside the offered timing/);
});
check('closing saved Journey refreshes selected status and next action without resetting its form',async(h)=>{
 const {a,$,r}=h;a.openJourney();r.status='IN_PROGRESS';a.state.liveOffersByRequest[r.id]={...a.readOfferForm(),id:'offer-a',detailsLoaded:true,status:'DRAFT'};const before=a.offerFormSnapshot();a.closeJourneyWithoutSave();assert.equal($('mmDetStatus').textContent,'In progress');assert.match($('mmAdminTracker').textContent,/Review offer draft/);assert.equal(a.offerFormSnapshot(),before);
});

check('legacy ISO month chips match a valid start date without any false warnings',async(h)=>{
 const {a,$,r}=h;r.months=['2027-03'];a.openJourney();h.input('mmOfStart','2027-03-01');a.updateJourneyDates();assert.equal($('mmJourneyDateWarning').classList.contains('is-warning'),false);assert.match($('mmJourneyDateWarning').textContent,/Select the month/);
});
