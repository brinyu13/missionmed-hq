import test,{mock} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {webcrypto,randomUUID} from 'node:crypto';
const {JSDOM}=createRequire(import.meta.url)('jsdom');

// Letters of Interest studio Release A (IIQ LOI Phase 2): account-based drafts through the existing
// loi.save contract and RISE evidence through loi.evidence. A fake server enforces the real head check.
const root=new URL('../../',import.meta.url),html=fs.readFileSync(new URL('public/index.html',root),'utf8');
const names=['runtime','model','views','shell','roles','actions','letters-studio','opening'];
const code=names.map(n=>fs.readFileSync(new URL('public/source/'+n+'.js',root),'utf8')).join('\n');
const owner='11111111-1111-4111-8111-111111111111',id='22222222-2222-4222-8222-222222222222',id2='44444444-4444-4444-8444-444444444444',claim='rise-claim:'+'a'.repeat(64);
function workspace({loi=true,targets=false}={}){
  return {actor:{id:owner,role:'student',tier:'360',zone:'UTC',firstName:'Amara',displayName:'Amara Okafor'},version:1,capabilities:{coreOnly:true,loi,loiTargets:targets},
    catalog:{programs:[{id:'program-one',name:'Example Program',specialty:'Internal Medicine',track:'Categorical',fact_ids:[]},{id:'program-two',name:'Second Program',specialty:'Pediatrics',track:'Categorical',fact_ids:[]}],student_zone:'UTC'},
    state:{interviews:[{id,owner,program:'program-one',saved:true,state:'scheduled',programName:'Example Program',zone:'UTC',related:[],history:[]},{id:id2,owner,program:'program-two',saved:true,state:'invited',programName:'Second Program',zone:'UTC',related:[],history:[]},{id:'33333333-3333-4333-8333-333333333333',owner,program:null,saved:true,state:'invited',programName:'Typed Program Name',intake:{specialty:'Family Medicine'},zone:'UTC',related:[],history:[]}],loi:{},loiTargets:{targets:targets?[{targetKind:'program',targetId:id,program:{id:'program-one',name:'Example Program',track:'Categorical',registryReleaseId:'r1'},resolutionState:'MATCHED',choice:'CREATE_LETTER',version:1,loi:{history:[],outreach:[],current:null,currentBindingValid:false}},{targetKind:'program',targetId:id2,program:{id:'program-two',name:'Second Program',track:'Categorical',registryReleaseId:'r1'},resolutionState:'MATCHED',choice:'CREATE_LETTER',version:1,loi:{history:[],outreach:[],current:null,currentBindingValid:false}}]:[],savedPrograms:null,savedStatus:'unavailable'}}};
}
const evidenceBody=()=>({type:'loi_evidence',program:{id:'program-one',name:'Example Program',track:'Categorical'},research:{coverage:{programId:'program-one',registryReleaseId:'r1',observedAt:'2026-10-01T00:00:00.000Z',fields:[{field:'research.curriculum',area:'training',state:'SUPPORTED'},{field:'research.call_schedule',area:'training',state:'UNKNOWN',reason:'not published'}]},facts:[{area:'training',field:'research.curriculum',state:'SUPPORTED',claimRef:claim,value:'residents complete a dedicated ambulatory block in the second year',retrievedAt:'2026-09-30T00:00:00.000Z',asOf:null,sources:[{claimRef:claim,reviewRef:null,urls:['https://example.org/curriculum'],retrievedAt:'2026-09-30T00:00:00.000Z',reviewedAt:null}]}]}});
function server(ws){
  const s={ws,calls:[],evidenceMode:'facts',failNext:false,delaySave:null};const snapshot=()=>JSON.parse(JSON.stringify(s.ws));
  const ok=json=>({ok:true,status:200,json:async()=>json}),err=(status,code,message)=>({ok:false,status,json:async()=>({error:{code,message}})});
  s.fetch=async(url,options={})=>{const path=String(url),body=options.body?JSON.parse(options.body):null;s.calls.push({path,body});
    if(path.includes('missionmed_interviewiq_bootstrap'))return ok({nonce:'test',token_endpoint:'/token',api_base:'/interviewiq/api'});
    if(path.endsWith('/token'))return ok({token:'memory-only',ttl_seconds:600});
    if(path.includes('/bootstrap'))return ok({bootstrap:snapshot()});
    if(path.includes('/commands')){
      if(body.command==='loi.evidence'){if(s.delayEvidence)await s.delayEvidence;if(s.evidenceMode==='503')return err(503,'rise_unavailable','RISE is unavailable right now.');if(s.evidenceMode==='none'){const e=evidenceBody();e.research.facts=[];e.research.coverage.fields[0].state='UNKNOWN';return ok(e);}return ok(evidenceBody());}
      if(body.command==='loi.save'){if(s.evidenceMode==='503'&&body.data.selectedEvidence.length)return err(503,'rise_unavailable','RISE is unavailable right now.');if(s.delaySave)await s.delaySave;if(s.failNext){s.failNext=false;return err(503,'storage','Database unavailable.');}
        const target=body.targetKind==='program'?s.ws.state.loiTargets?.targets.find(t=>t.targetId===body.targetId):null;if(body.targetKind==='program'){assert.ok(target,'known program target');assert.equal(body.interviewId,undefined,'program save never manufactures an interview');assert.equal(target.choice,'CREATE_LETTER');assert.equal(target.resolutionState,'MATCHED');}
        const d=body.data,cur=(target?target.loi:s.ws.state.loi[body.interviewId])?.current||null;if((d.expectedHead||null)!==(cur?.revisionId||null)||d.expectedLetterVersion!==(cur?.letterVersion||0))return err(409,'loi_head_conflict','Review the latest saved letter.');
        for(const x of [...d.motivations,...d.facts])assert.match(x.id,/^[0-9a-f-]{36}$/);assert.ok(d.text.trim().length>0);
        const rev={type:'iiq.loi.revision',schemaVersion:1,revisionId:randomUUID(),letterId:d.letterId||randomUUID(),parentRevisionId:cur?.revisionId||null,letterVersion:(cur?.letterVersion||0)+1,createdAt:new Date().toISOString(),interviewId:body.interviewId,state:'draft',text:d.text,context:d.context,motivations:d.motivations,facts:d.facts,selectedEvidence:d.selectedEvidence,program:{id:'program-one',name:'Example Program',track:'Categorical'},contentHash:randomUUID()};
        if(target){delete rev.interviewId;rev.targetKind='program';rev.targetId=body.targetId;rev.program=target.program;}
        const prev=(target?target.loi:s.ws.state.loi[body.interviewId])||{history:[],outreach:[]},next={current:rev,history:[...prev.history,rev],outreach:[],currentBindingValid:true};if(target)target.loi=next;else s.ws.state.loi[body.interviewId]=next;return ok({bootstrap:snapshot()});}
    }
    return err(404,'unknown','Unknown request.');};
  return s;
}
function setup(ws=workspace(),sharedServer=null){
  const srv=sharedServer||server(ws),dom=new JSDOM(html,{url:'https://missionmed.test/interviewiq/',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,clip=[];
  Object.defineProperty(w,'crypto',{value:webcrypto});w.Headers=Headers;w.matchMedia=()=>({matches:true,addEventListener(){}});
  w.HTMLElement.prototype.scrollIntoView=()=>{};w.HTMLElement.prototype.scrollTo=()=>{};w.scrollTo=()=>{};
  w.navigator.clipboard={writeText:async t=>{clip.push(t);}};w.URL.createObjectURL=()=>'blob:test';w.URL.revokeObjectURL=()=>{};w.HTMLAnchorElement.prototype.click=function(){};
  w.fetch=srv.fetch;
  w.eval(code+"\nwindow.__h={applyBootstrap,render,A,navItems,loiStudioState,loiStudioBound,loiStudioDirty,loiStudioTimings:()=>loiStudioTimings,getS:()=>S,setRoute:r=>{S.ui.route=r;},composeLoiStudio};");
  const h=w.__h;h.applyBootstrap(ws);h.setRoute('letters');h.render();
  return {w,h,srv,clip,doc:w.document,close:()=>w.close()};
}
const click=(x,sel)=>{const b=x.doc.querySelector(sel);assert.ok(b,'missing '+sel);return x.h.A[b.dataset.act](b);};
const type=(x,id,value)=>{const f=x.doc.getElementById(id);assert.ok(f,id);if(f.type==='checkbox')f.checked=value;else f.value=value;f.dispatchEvent(new x.w.Event('input',{bubbles:true}));f.dispatchEvent(new x.w.Event('change',{bubbles:true}));return f;};
const tick=()=>new Promise(r=>setImmediate(r));
const settle=async(n=6)=>{for(let k=0;k<n;k++)await tick();};
const status=x=>x.doc.getElementById('studio-save-status')?.textContent||'';
const saves=x=>x.srv.calls.filter(c=>c.body?.command==='loi.save');

test('bound letter: RISE evidence appears asynchronously, selected fact and own connection enter the letter, save persists through loi.save',async()=>{
  const x=setup();try{
    await click(x,'[data-act="studio-use"][data-template="initial"]');
    assert.match(status(x),/NOT SAVED TO YOUR ACCOUNT/);assert.equal(x.doc.querySelector('[data-act="studio-save"]'),null);
    const pick=x.doc.getElementById('studio-program-pick');assert.match(pick.options[1].textContent,/saves to your account/);assert.match(pick.options[3].textContent,/program not confirmed yet/);
    type(x,'studio-program-pick',id);
    assert.ok(x.h.loiStudioBound(),'bound to the interview');assert.match(status(x),/UNSAVED CHANGES|SAVE/);
    assert.match(x.doc.getElementById('studio-evidence').textContent,/Reading published program evidence/);
    await settle();
    const ev=x.doc.getElementById('studio-evidence');assert.match(ev.textContent,/1 published fact for Example Program/);assert.match(ev.textContent,/curriculum/);assert.match(ev.textContent,/SUPPORTED · retrieved Sep 30, 2026/);assert.match(ev.innerHTML,/href="https:\/\/example.org\/curriculum"/);assert.match(ev.textContent,/Not published: call schedule \(unknown\)/);
    assert.equal(x.srv.calls.filter(c=>c.body?.command==='loi.evidence').length,1);
    assert.doesNotMatch(x.doc.getElementById('studio-preview').textContent,/ambulatory block/,'untick: nothing inserted');
    type(x,'studio-ev-0',true);
    assert.match(x.doc.getElementById('studio-preview').textContent,/Specific things I learned about your program also shaped this letter\. Residents complete a dedicated ambulatory block in the second year\. \[Your own connection/);
    type(x,'studio-ev-0-c','My strongest growth came from an eight-month continuity clinic.');
    assert.match(x.doc.getElementById('studio-preview').textContent,/second year\. My strongest growth came from an eight-month continuity clinic\./);
    type(x,'studio-f-yourName','Amara Okafor, MBBS');type(x,'studio-f-reasons','Your ambulatory block.\nYour referral service.');type(x,'studio-f-strengths','Four years of district hospital practice.');
    await click(x,'[data-act="studio-continue"]');
    assert.ok(x.doc.querySelector('[data-act="studio-save"]'),'Save button in editor');
    await click(x,'[data-act="studio-save"]');
    assert.match(status(x),/SAVED TO YOUR ACCOUNT/);assert.match(status(x),/Example Program/);
    const [call]=saves(x);assert.equal(call.body.interviewId,id);const d=call.body.data;
    assert.equal(d.expectedHead,null);assert.equal(d.expectedLetterVersion,0);assert.match(d.text,/My strongest growth came/);
    assert.equal(JSON.stringify(d.selectedEvidence),JSON.stringify([{field:'research.curriculum',claimRef:claim}]));
    assert.equal(JSON.stringify(d.motivations.map(m=>m.text)),JSON.stringify(['Your ambulatory block.','Your referral service.']));
    assert.equal(d.facts[0].text,'Letter type: Initial Letter of Interest');assert.ok(d.facts.some(f=>f.text==='Your full name: Amara Okafor, MBBS'));assert.ok(d.facts.some(f=>f.text.startsWith('Evidence connection · '+claim+': My strongest growth')));
    assert.ok(d.facts.every(f=>f.confirmed===true)&&d.studentFactualConfirmation===false,'facts are the student words; approval confirmations stay unset');
    assert.equal(x.h.loiStudioDirty(),false);
    assert.ok(x.h.loiStudioTimings().some(t=>t.label==='save-ack'&&t.ms>=0),'save acknowledgement timing recorded');
    await click(x,'[data-act="studio-gallery"]');
    assert.match(x.doc.querySelector('.studioSaved').textContent,/YOUR SAVED LETTERS · 1/);assert.match(x.doc.querySelector('.studioSavedCard').textContent,/Example Program.*Initial Letter of Interest · Draft · v1/);
  }finally{x.close();}
});

test('autosave debounces, never double-posts, and a reopened fresh session restores the exact draft without a spurious save',async()=>{
  mock.timers.enable({apis:['setTimeout']});
  const x=setup();try{
    await click(x,'[data-act="studio-use"][data-template="short"]');type(x,'studio-program-pick',id);await settle();
    type(x,'studio-f-yourName','Amara');type(x,'studio-f-reason','One true reason.');
    await click(x,'[data-act="studio-continue"]');
    type(x,'studio-text',x.doc.getElementById('studio-text').value+'\nPS: edited.');
    assert.match(status(x),/UNSAVED CHANGES/);assert.equal(saves(x).length,0);
    mock.timers.tick(2000);await settle();assert.equal(saves(x).length,0,'debounce not elapsed');
    type(x,'studio-text',x.doc.getElementById('studio-text').value+' More.');
    mock.timers.tick(2000);await settle();assert.equal(saves(x).length,0,'typing resets the debounce');
    mock.timers.tick(600);await settle();assert.equal(saves(x).length,1,'one autosave after quiet period');
    assert.match(status(x),/SAVED TO YOUR ACCOUNT/);
    // duplicate clicks while nothing changed: no extra post
    await Promise.all([click(x,'[data-act="studio-save"]'),click(x,'[data-act="studio-save"]')]);assert.equal(saves(x).length,1);
    const savedText=x.srv.ws.state.loi[id].current.text;assert.match(savedText,/PS: edited\. More\.\n?$/);
    // fresh authenticated session with the persisted workspace
    const y=setup(JSON.parse(JSON.stringify(x.srv.ws)));try{
      assert.match(y.doc.querySelector('.studioSaved').textContent,/Short and Direct LOI · Draft · v1/);
      await click(y,'[data-act="studio-reopen"]');
      assert.equal(y.doc.getElementById('studio-text').value,savedText,'exact text restored');
      assert.equal(y.h.loiStudioState().templateId,'short');assert.equal(y.h.loiStudioState().fields.reason,'One true reason.');assert.equal(y.h.loiStudioState().fields.yourName,'Amara');assert.equal(y.h.loiStudioState().fields.programName,'Example Program');
      assert.match(status(y),/SAVED TO YOUR ACCOUNT/);assert.equal(y.h.loiStudioDirty(),false,'restored draft is not dirty');
      mock.timers.tick(5000);await settle();assert.equal(saves(y).length,0,'no spurious autosave after reopen');
      assert.ok(y.h.loiStudioTimings().some(t=>t.label==='reopen'));
      await click(y,'[data-act="studio-personalize"]');assert.equal(y.doc.getElementById('studio-f-reason').value,'One true reason.');
    }finally{y.close();}
  }finally{mock.timers.reset();x.close();}
});

test('stale tab: a conflicting head never overwrites the newer draft; the student sees both and chooses',async()=>{
  const x=setup();try{
    await click(x,'[data-act="studio-use"][data-template="initial"]');type(x,'studio-program-pick',id);await settle();type(x,'studio-f-yourName','Amara');
    await click(x,'[data-act="studio-continue"]');await click(x,'[data-act="studio-save"]');assert.equal(saves(x).length,1);
    // another tab saves a newer revision
    const cur=x.srv.ws.state.loi[id].current;const newer={...cur,revisionId:randomUUID(),parentRevisionId:cur.revisionId,letterVersion:2,text:'Newer text from another tab.\n'};x.srv.ws.state.loi[id]={current:newer,history:[cur,newer],outreach:[],currentBindingValid:true};
    type(x,'studio-text','My stale-tab edit.\n');
    await assert.rejects(click(x,'[data-act="studio-save"]'),/another tab|latest/i);
    assert.match(status(x),/NEEDS YOUR REVIEW/);assert.equal(x.doc.getElementById('studio-text').value,'My stale-tab edit.\n','typed text kept');
    assert.match(x.doc.body.textContent,/Latest saved version \(v2\)/);assert.match(x.doc.body.textContent,/Newer text from another tab/);
    assert.equal(x.srv.ws.state.loi[id].current.text,'Newer text from another tab.\n','newer draft untouched');
    await click(x,'[data-act="studio-use-saved"]');assert.equal(x.doc.getElementById('studio-text').value,'Newer text from another tab.\n');assert.match(status(x),/SAVED TO YOUR ACCOUNT/);
  }finally{x.close();}
});

test('failed save keeps the text, shows retry, and never claims saved; retry succeeds',async()=>{
  const x=setup();try{
    await click(x,'[data-act="studio-use"][data-template="thankyou"]');type(x,'studio-program-pick',id);await settle();type(x,'studio-f-yourName','Amara');type(x,'studio-f-interviewDate','December 3');
    await click(x,'[data-act="studio-continue"]');x.srv.failNext=true;
    await assert.rejects(click(x,'[data-act="studio-save"]'),/Database unavailable/);
    assert.match(status(x),/SAVE FAILED · TEXT KEPT/);assert.ok(x.doc.querySelector('[data-act="studio-save"]'),'retry available');assert.match(x.doc.getElementById('studio-text').value,/December 3/);
    assert.doesNotMatch(status(x),/SAVED TO YOUR ACCOUNT/);
    await click(x,'#studio-save-status [data-act="studio-save"]');assert.match(status(x),/SAVED TO YOUR ACCOUNT/);assert.equal(saves(x).length,2);
  }finally{x.close();}
});

test('RISE unavailable or empty never blocks writing, saving or copying, and says so truthfully',async()=>{
  for(const mode of ['503','none']){
    const x=setup();try{x.srv.evidenceMode=mode;
      await click(x,'[data-act="studio-use"][data-template="clinical"]');type(x,'studio-program-pick',id);await settle();
      const ev=x.doc.getElementById('studio-evidence').textContent;
      if(mode==='503'){assert.match(ev,/Program evidence is unavailable right now: RISE is unavailable/);assert.ok(x.doc.querySelector('[data-act="studio-evidence-retry"]'));}
      else{assert.match(ev,/No published SUPPORTED facts are available for Example Program yet/);assert.match(ev,/Coverage: curriculum unknown; call schedule unknown/);}
      assert.equal(x.doc.querySelector('[data-studio-ev]'),null,'no fake facts to tick');
      type(x,'studio-f-yourName','Fatima');type(x,'studio-f-clinicalExperience','Five years in a district hospital.');
      await click(x,'[data-act="studio-continue"]');await click(x,'[data-act="studio-save"]');assert.match(status(x),/SAVED TO YOUR ACCOUNT/);
      assert.equal(JSON.stringify(saves(x)[0].body.data.selectedEvidence),'[]');
      await click(x,'[data-act="studio-copy"]');assert.match(x.clip.at(-1),/Five years in a district hospital/);
      if(mode==='503'){x.srv.evidenceMode='facts';await click(x,'[data-act="studio-evidence-retry"]');await settle();assert.match(x.doc.getElementById('studio-evidence').textContent,/1 published fact/);}
    }finally{x.close();}
  }
});

test('without the server LOI capability the studio stays tab-only and posts nothing; switching accounts clears the binding',async()=>{
  const x=setup(workspace({loi:false}));try{
    await click(x,'[data-act="studio-use"][data-template="initial"]');
    assert.match(x.doc.getElementById('studio-program-pick').options[1].textContent,/verified program/);assert.doesNotMatch(x.doc.getElementById('studio-program-pick').textContent,/saves to your account/);
    type(x,'studio-program-pick',id);assert.equal(x.h.loiStudioBound(),null);assert.match(status(x),/not available for this workspace yet/);
    assert.equal(x.doc.getElementById('studio-evidence'),null);type(x,'studio-f-yourName','Amara');await click(x,'[data-act="studio-continue"]');
    assert.equal(x.doc.querySelector('[data-act="studio-save"]'),null);assert.equal(x.srv.calls.filter(c=>c.path.includes('/commands')).length,0);
  }finally{x.close();}
  const y=setup();try{
    await click(y,'[data-act="studio-use"][data-template="initial"]');type(y,'studio-program-pick',id);await settle();type(y,'studio-f-yourName','Amara');
    const other=workspace();other.actor.id='99999999-9999-4999-8999-999999999999';other.state.interviews=[];y.h.applyBootstrap(other);y.h.setRoute('letters');y.h.render();
    assert.equal(y.h.loiStudioState().mode,'gallery');assert.equal(y.h.loiStudioBound(),null);assert.equal(saves(y).length,0);
  }finally{y.close();}
});

test('two program-specific drafts stay separate; switching interviews flushes unsaved work first',async()=>{
  const x=setup();try{
    await click(x,'[data-act="studio-use"][data-template="initial"]');type(x,'studio-program-pick',id);await settle();type(x,'studio-f-yourName','Amara');type(x,'studio-f-reasons','Reason for program one.');
    type(x,'studio-program-pick',id2);await settle();
    assert.equal(saves(x).length,1,'unsaved letter for program one was flushed before switching');assert.equal(saves(x)[0].body.interviewId,id);
    assert.equal(x.h.loiStudioBound().id,id2);assert.equal(x.doc.getElementById('studio-f-programName').value,'Second Program');
    type(x,'studio-f-reasons','Reason for program two.');await click(x,'[data-act="studio-continue"]');await click(x,'[data-act="studio-save"]');
    assert.equal(saves(x).length,2);assert.equal(saves(x)[1].body.interviewId,id2);
    assert.match(x.srv.ws.state.loi[id].current.text,/Reason for program one/);assert.match(x.srv.ws.state.loi[id2].current.text,/Reason for program two/);
    await click(x,'[data-act="studio-gallery"]');assert.match(x.doc.querySelector('.studioSaved').textContent,/YOUR SAVED LETTERS · 2/);
  }finally{x.close();}
});

test('NRMP correction survives save and reopen: four confirmations persist, revocation after reopen removes only the composer sentence, a legacy firstChoice fact never re-authorizes it',async()=>{
  const RANK='After completing my interviews, I am writing to let you know that I intend to rank your program first on my rank order list.';
  const x=setup();try{
    await click(x,'[data-act="studio-use"][data-template="intent"]');type(x,'studio-program-pick',id);await settle();
    type(x,'studio-f-yourName','Priya');type(x,'studio-f-interviewDate','January 8');type(x,'studio-f-moment','Morning report was resident-led.');
    for(const k of ['firstChoice','rankVoluntary','rankUnpressured'])type(x,'studio-f-'+k,true);
    assert.doesNotMatch(x.doc.getElementById('studio-preview').textContent,/intend to rank/,'three of four confirmations are not enough');
    type(x,'studio-f-rankNoReciprocity',true);assert.match(x.doc.getElementById('studio-preview').textContent,/intend to rank your program first/);
    await click(x,'[data-act="studio-continue"]');type(x,'studio-text',x.doc.getElementById('studio-text').value.replace('Thank you for your consideration.','Thank you for your consideration and for the tour.'));
    await click(x,'[data-act="studio-save"]');assert.match(status(x),/SAVED TO YOUR ACCOUNT/);
    const d=saves(x)[0].body.data;for(const label of ['Truthful: this program is my first choice and I intend to rank it first.: yes','I choose to disclose this voluntarily.: yes','No program requested or pressured me to disclose my ranking intentions.: yes','I understand that no reciprocal ranking commitment is implied.: yes'])assert.ok(d.facts.some(f=>f.text===label),label);
    assert.match(d.text,/intend to rank your program first/);
  }finally{x.close();}
  const y=setup(JSON.parse(JSON.stringify(x.srv.ws)));try{
    await click(y,'[data-act="studio-reopen"]');
    const st=y.h.loiStudioState();assert.equal(st.templateId,'intent');assert.equal(st.rankGenerated,true,'composer-sentence provenance restored only with all four confirmations');
    assert.match(y.doc.getElementById('studio-text').value,/intend to rank your program first/);assert.match(y.doc.getElementById('studio-text').value,/and for the tour/);
    await click(y,'[data-act="studio-personalize"]');type(y,'studio-f-rankUnpressured',false);
    assert.doesNotMatch(st.text,/intend to rank/,'exact composer sentence removed');assert.match(st.text,/and for the tour/,'student edit preserved');assert.match(st.text,/I remain strongly interested in your program and would value the opportunity to train with your team\.\n/);
    assert.match(y.doc.getElementById('toast').textContent,/Optional first-choice sentence removed/);
    assert.match(status(y),/UNSAVED CHANGES/,'revocation is a change to save');
    await click(y,'#studio-save-status [data-act="studio-save"]');assert.match(status(y),/SAVED TO YOUR ACCOUNT/);assert.doesNotMatch(y.srv.ws.state.loi[id].current.text,/intend to rank/);await settle();
  }finally{y.close();}
  // legacy draft: old single firstChoice fact plus the sentence in text
  const legacy=workspace();const rev={type:'iiq.loi.revision',schemaVersion:1,revisionId:randomUUID(),letterId:randomUUID(),parentRevisionId:null,letterVersion:1,createdAt:new Date().toISOString(),interviewId:id,state:'draft',text:'Dear Program Director,\n\nThank you again for the opportunity to interview with the Example Program on January 8. '+RANK+'\n\nSincerely,\nPriya\n',context:{whyNow:'',applicationState:'',interviewState:''},motivations:[],facts:[{id:randomUUID(),text:'Letter type: Letter of Intent',confirmed:true},{id:randomUUID(),text:'This program is genuinely my first choice and I intend to rank it first.: yes',confirmed:true}],selectedEvidence:[],program:{id:'program-one',name:'Example Program',track:'Categorical'},contentHash:randomUUID()};legacy.state.loi[id]={current:rev,history:[rev],outreach:[],currentBindingValid:true};
  const z=setup(legacy);try{
    await click(z,'[data-act="studio-reopen"]');await settle();const st=z.h.loiStudioState();
    assert.equal(st.rankGenerated,false,'legacy boolean alone grants no provenance');assert.notEqual(st.fields.firstChoice,true);
    assert.match(z.doc.getElementById('studio-text').value,/intend to rank/,'student text is never silently rewritten');
    assert.match(z.doc.querySelector('.studioPreview').textContent,/ranking language without all four first-choice confirmations/,'explicit review notice');
    await click(z,'[data-act="studio-personalize"]');assert.doesNotMatch(z.doc.getElementById('studio-preview').textContent,/intend to rank/,'rebuild would not regenerate the sentence');await settle();
  }finally{z.close();}
});


test('reopened citations survive edits while RISE is unavailable, and remain server-validated',async()=>{
 const x=setup();try{
  await click(x,'[data-act="studio-use"][data-template="initial"]');type(x,'studio-program-pick',id);await settle();type(x,'studio-ev-0',true);type(x,'studio-ev-0-c','My clinic connection.');await click(x,'[data-act="studio-continue"]');await click(x,'[data-act="studio-save"]');
  const y=setup(JSON.parse(JSON.stringify(x.srv.ws)));try{
   y.srv.evidenceMode='503';await click(y,'[data-act="studio-reopen"]');await settle();type(y,'studio-text',y.doc.getElementById('studio-text').value+'\nMy additional sentence.');await assert.rejects(click(y,'[data-act="studio-save"]'),/RISE is unavailable/);
   assert.match(status(y),/SAVE FAILED/);
   assert.deepEqual(JSON.parse(JSON.stringify(saves(y).at(-1).body.data.selectedEvidence)),[{field:'research.curriculum',claimRef:claim}]);
   assert.match(y.doc.getElementById('studio-text').value,/My additional sentence/);assert.match(y.doc.getElementById('studio-text').value,/My clinic connection/);
   y.srv.evidenceMode='facts';await click(y,'#studio-save-status [data-act="studio-save"]');assert.match(status(y),/SAVED TO YOUR ACCOUNT/);
  }finally{y.close();}
 }finally{x.close();}
});

test('program switching saves edited original, clears rank consent, and restores an existing destination without overwrite',async()=>{
 const x=setup();try{
  await click(x,'[data-act="studio-use"][data-template="intent"]');type(x,'studio-program-pick',id);await settle();for(const key of ['firstChoice','rankVoluntary','rankUnpressured','rankNoReciprocity'])type(x,'studio-f-'+key,true);
  await click(x,'[data-act="studio-continue"]');type(x,'studio-text',x.doc.getElementById('studio-text').value+'\nOnly for program one.');await click(x,'[data-act="studio-personalize"]');type(x,'studio-program-pick',id2);await settle();
  assert.match(x.srv.ws.state.loi[id].current.text,/Only for program one/);assert.equal(x.h.loiStudioBound().id,id2);assert.equal(x.h.loiStudioState().rankGenerated,false);
  for(const key of ['firstChoice','rankVoluntary','rankUnpressured','rankNoReciprocity'])assert.notEqual(x.h.loiStudioState().fields[key],true);
  assert.doesNotMatch(x.doc.getElementById('studio-preview').textContent,/Only for program one|intend to rank|Example Program/);
  await click(x,'[data-act="studio-continue"]');type(x,'studio-text','My already saved second-program letter.');await click(x,'[data-act="studio-save"]');const secondVersion=x.srv.ws.state.loi[id2].current.letterVersion;
  await click(x,'[data-act="studio-personalize"]');type(x,'studio-program-pick',id);await settle();assert.match(x.h.loiStudioState().text,/Only for program one/);
  type(x,'studio-program-pick',id2);await settle();assert.equal(x.h.loiStudioState().text,'My already saved second-program letter.');assert.equal(x.srv.ws.state.loi[id2].current.letterVersion,secondVersion);assert.equal(x.h.loiStudioDirty(),false);
 }finally{x.close();}
});


test('a pending RISE read does not queue an uncited draft save',async()=>{
 const x=setup();let release;try{
  x.srv.delayEvidence=new Promise(r=>release=r);
  await click(x,'[data-act="studio-use"][data-template="initial"]');type(x,'studio-program-pick',id);await settle();type(x,'studio-f-yourName','Amara');await click(x,'[data-act="studio-continue"]');
  const saving=click(x,'[data-act="studio-save"]');await settle();assert.equal(saves(x).length,1);await saving;assert.match(status(x),/SAVED TO YOUR ACCOUNT/);
 }finally{release?.();await settle();x.close();}
});


test('fresh session restores student-entered program name and specialty with no catalog metadata or spurious save',async()=>{
  const ws=workspace();ws.catalog.programs[0].specialty='';
  const x=setup(ws);try{
    await click(x,'[data-act="studio-use"][data-template="short"]');type(x,'studio-program-pick',id);await settle();
    type(x,'studio-f-yourName','Amara');type(x,'studio-f-programName','Example Program — categorical');type(x,'studio-f-specialty','Internal Medicine');type(x,'studio-f-reason','One true reason.');
    await click(x,'[data-act="studio-continue"]');type(x,'studio-text',x.doc.getElementById('studio-text').value+'\nMy own final edit.');await click(x,'[data-act="studio-save"]');
    const saved=x.srv.ws.state.loi[id].current;assert.equal(saves(x)[0].body.interviewId,id);assert.ok(saved.facts.some(f=>f.text==='Program name: Example Program — categorical'));assert.ok(saved.facts.some(f=>f.text==='Specialty: Internal Medicine'));
    const y=setup(JSON.parse(JSON.stringify(x.srv.ws)));try{
      await click(y,'[data-act="studio-reopen"]');await settle();
      assert.equal(y.doc.getElementById('studio-text').value,saved.text);assert.equal(y.h.loiStudioBound().id,id);
      assert.equal(y.doc.getElementById('studio-subject').textContent,'Letter of Interest – Amara, Internal Medicine Applicant');
      assert.equal(y.h.loiStudioDirty(),false);assert.equal(saves(y).length,0);
      await click(y,'[data-act="studio-personalize"]');
      assert.equal(y.doc.getElementById('studio-f-programName').value,'Example Program — categorical');assert.equal(y.doc.getElementById('studio-f-specialty').value,'Internal Medicine');
    }finally{y.close();}
  }finally{x.close();}
});


const targetState=(x,targetId=id)=>x.srv.ws.state.loiTargets.targets.find(t=>t.targetId===targetId).loi;

test('pre-interview program target saves, autosaves and reopens exact text and repaired metadata with no interview',async()=>{
 mock.timers.enable({apis:['setTimeout']});const ws=workspace({targets:true});ws.state.interviews=[];const x=setup(ws);try{
  await click(x,'[data-act="studio-use"][data-template="short"]');assert.doesNotMatch(x.doc.body.textContent,/Add the interview first/);
  type(x,'studio-program-pick','program:'+id);await settle();assert.equal(x.h.loiStudioBound().targetKind,'program');
  const ev=x.srv.calls.find(c=>c.body?.command==='loi.evidence').body;assert.equal(ev.targetKind,'program');assert.equal(ev.targetId,id);assert.equal(ev.interviewId,undefined);
  assert.match(x.doc.getElementById('studio-evidence').textContent,/1 published fact/);
  type(x,'studio-f-programName','Example Program — student correction');type(x,'studio-f-specialty','Anesthesiology');type(x,'studio-f-yourName','QA Student');type(x,'studio-f-reason','My program-specific reason.');
  await click(x,'[data-act="studio-continue"]');type(x,'studio-text',x.doc.getElementById('studio-text').value+'\nMy exact personal edit.');
  mock.timers.tick(2600);await settle();assert.equal(saves(x).length,1);assert.match(status(x),/SAVED TO YOUR ACCOUNT/);
  const d=saves(x)[0].body;assert.equal(d.targetKind,'program');assert.equal(d.targetId,id);assert.equal(d.interviewId,undefined);assert.deepEqual(x.srv.ws.state.interviews,[]);
  const text=targetState(x).current.text;assert.match(text,/My exact personal edit/);assert.doesNotMatch(text,/intend to rank|rank.*first/);
  const y=setup(JSON.parse(JSON.stringify(x.srv.ws)));try{
   await click(y,'[data-act="studio-reopen"][data-id="program:'+id+'"]');await settle();assert.equal(y.doc.getElementById('studio-text').value,text);assert.equal(y.h.loiStudioDirty(),false);
   assert.match(y.doc.getElementById('studio-subject').textContent,/Anesthesiology Applicant/);await click(y,'[data-act="studio-copy"]');assert.equal(y.clip.at(-1),text);
   await click(y,'[data-act="studio-personalize"]');assert.equal(y.doc.getElementById('studio-f-programName').value,'Example Program — student correction');assert.equal(y.doc.getElementById('studio-f-specialty').value,'Anesthesiology');
   mock.timers.tick(5000);await settle();assert.equal(saves(y).length,0,'reopen never overwrites the persisted draft');
  }finally{y.close();}
 }finally{x.close();mock.timers.reset();}
});

test('typed targets with the same display name and IDs as interviews remain isolated and switching flushes the original',async()=>{
 const ws=workspace({targets:true});ws.state.loiTargets.targets[1].program.name='Example Program';const x=setup(ws);try{
  await click(x,'[data-act="studio-use"][data-template="initial"]');const opts=[...x.doc.getElementById('studio-program-pick').options];for(const key of [id,'program:'+id,'program:'+id2])assert.ok(opts.some(o=>o.value===key),key);
  type(x,'studio-program-pick','program:'+id);await settle();type(x,'studio-f-yourName','QA');type(x,'studio-f-reasons','Only target one.');
  type(x,'studio-program-pick','program:'+id2);await settle();assert.equal(saves(x)[0].body.targetId,id);assert.doesNotMatch(x.doc.getElementById('studio-preview').textContent,/Only target one/);
  type(x,'studio-f-reasons','Only target two.');type(x,'studio-program-pick',id);await settle();assert.equal(saves(x)[1].body.targetId,id2);
  type(x,'studio-f-reasons','Only the interview.');await click(x,'[data-act="studio-continue"]');await click(x,'[data-act="studio-save"]');
  assert.match(targetState(x,id).current.text,/Only target one/);assert.doesNotMatch(targetState(x,id).current.text,/Only target two|Only the interview/);
  assert.match(targetState(x,id2).current.text,/Only target two/);assert.match(x.srv.ws.state.loi[id].current.text,/Only the interview/);
  await click(x,'[data-act="studio-gallery"]');assert.equal(x.doc.querySelectorAll('[data-act="studio-reopen"]').length,3);
 }finally{x.close();}
});

test('two actual Studio instances sharing the target head receive 409 without overwriting and safely use latest',async()=>{
 const ws=workspace({targets:true});ws.state.interviews=[];const x=setup(ws);let y;try{
  await click(x,'[data-act="studio-use"][data-template="initial"]');type(x,'studio-program-pick','program:'+id);await settle();type(x,'studio-f-yourName','QA');await click(x,'[data-act="studio-continue"]');await click(x,'[data-act="studio-save"]');
  y=setup(JSON.parse(JSON.stringify(x.srv.ws)),x.srv);await click(y,'[data-act="studio-reopen"][data-id="program:'+id+'"]');await settle();
  type(x,'studio-text','Newer text from tab A.');await click(x,'[data-act="studio-save"]');type(y,'studio-text','Unsaved text in tab B.');
  await assert.rejects(click(y,'[data-act="studio-save"]'),e=>e.status===409);assert.equal(targetState(x).current.text,'Newer text from tab A.');assert.equal(y.doc.getElementById('studio-text').value,'Unsaved text in tab B.');assert.match(status(y),/NEEDS YOUR REVIEW/);
  await click(y,'[data-act="studio-use-saved"]');assert.equal(y.doc.getElementById('studio-text').value,'Newer text from tab A.');assert.equal(y.h.loiStudioDirty(),false);
 }finally{y?.close();x.close();}
});

test('program target admission requires CREATE_LETTER, MATCHED canonical identity and actual capability',async()=>{
 for(const mutation of [ws=>{ws.capabilities.loiTargets=false;},ws=>{ws.state.loiTargets.targets[0].choice='DO_NOT_CONTACT';},ws=>{ws.state.loiTargets.targets[0].resolutionState='NOT_FOUND';},ws=>{ws.state.loiTargets.targets[0].program=null;}]){
  const ws=workspace({targets:true});ws.state.interviews=[];mutation(ws);const x=setup(ws);try{
   await click(x,'[data-act="studio-use"][data-template="initial"]');const option=x.doc.querySelector('option[value="program:'+id+'"]');if(option)type(x,'studio-program-pick','program:'+id);
   assert.equal(x.h.loiStudioBound(),null);assert.equal(x.srv.calls.filter(c=>c.path.includes('/commands')).length,0);
  }finally{x.close();}
 }
});

test('a bound target is revoked on registry identity, choice, capability or signed actor changes; edited text is never posted elsewhere',async()=>{
 for(const mutation of [ws=>{ws.state.loiTargets.targets[0].program.registryReleaseId='r2';},ws=>{ws.state.loiTargets.targets[0].choice='DO_NOT_CONTACT';},ws=>{ws.state.loiTargets.targets[0].resolutionState='NOT_FOUND';},ws=>{ws.capabilities.loiTargets=false;},ws=>{ws.actor.id='99999999-9999-4999-8999-999999999999';}]){
  const x=setup(workspace({targets:true}));try{
   await click(x,'[data-act="studio-use"][data-template="initial"]');type(x,'studio-program-pick','program:'+id);await settle();await click(x,'[data-act="studio-continue"]');type(x,'studio-text','Keep my private edit in this tab.');
   const next=JSON.parse(JSON.stringify(x.srv.ws));mutation(next);x.h.applyBootstrap(next);x.h.setRoute('letters');x.h.render();assert.equal(x.h.loiStudioBound(),null);assert.equal(saves(x).length,0);
   if(next.actor.id===owner){assert.equal(x.h.loiStudioState().text,'Keep my private edit in this tab.');await assert.rejects(x.h.A['studio-save'](),/confirmed program/);}
  }finally{x.close();}
 }
});
