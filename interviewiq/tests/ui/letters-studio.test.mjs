import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {webcrypto} from 'node:crypto';
const {JSDOM}=createRequire(import.meta.url)('jsdom');

// Letters of Interest studio student journey (IIQ-LOI-RAPID-20261019): sidebar -> gallery -> example ->
// template -> personalize -> edit -> copy/download, with no server LOI capability, no RISE and no AI.
const root=new URL('../../',import.meta.url),html=fs.readFileSync(new URL('public/index.html',root),'utf8');
const names=['runtime','model','views','shell','roles','actions','letters-studio','opening'];
const code=names.map(n=>fs.readFileSync(new URL('public/source/'+n+'.js',root),'utf8')).join('\n');
const owner='11111111-1111-4111-8111-111111111111',id='22222222-2222-4222-8222-222222222222';
function workspace({role='student',tier='360',loi=false,interviews=true}={}){
  return {actor:{id:owner,role,tier,zone:'UTC',firstName:'Amara',displayName:'Amara Okafor'},version:1,capabilities:{coreOnly:true,loi},
    catalog:{programs:[{id:'program-one',name:'Example Program',specialty:'Internal Medicine',track:'Categorical',fact_ids:[]}],student_zone:'UTC'},
    state:{interviews:interviews?[{id,owner,program:'program-one',saved:true,state:'scheduled',programName:'Example Program',zone:'UTC',related:[],history:[]},{id:'33333333-3333-4333-8333-333333333333',owner,program:null,saved:true,state:'invited',programName:'Typed Program Name',intake:{specialty:'Family Medicine'},zone:'UTC',related:[],history:[]}]:[],loi:{}}};
}
function setup(initial=workspace()){
  const dom=new JSDOM(html,{url:'https://missionmed.test/interviewiq/',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,clip=[],downloads=[];
  Object.defineProperty(w,'crypto',{value:webcrypto});w.Headers=Headers;w.matchMedia=()=>({matches:true,addEventListener(){}});
  w.HTMLElement.prototype.scrollIntoView=()=>{};w.HTMLElement.prototype.scrollTo=()=>{};w.scrollTo=()=>{};
  w.navigator.clipboard={writeText:async t=>{clip.push(t);}};
  w.URL.createObjectURL=b=>{downloads.push(b);return 'blob:test';};w.URL.revokeObjectURL=()=>{};
  w.HTMLAnchorElement.prototype.click=function(){downloads.push({name:this.download});};
  w.fetch=async()=>({ok:true,status:200,json:async()=>({bootstrap:initial})});
  w.eval(code+"\nwindow.__h={applyBootstrap,render,A,coreAction,lettersStudioEnabled,navItems,loiStudioState,getS:()=>S,setRoute:r=>{S.ui.route=r;},setPreview:v=>{administratorPreview=v;},draftValues,draftKey,composeLoiStudio};");
  const h=w.__h;h.applyBootstrap(initial);h.setRoute('letters');h.render();
  return {w,h,clip,downloads,doc:w.document,close:()=>w.close()};
}
const click=(x,sel)=>{const b=x.doc.querySelector(sel);assert.ok(b,'missing '+sel);return x.h.A[b.dataset.act](b);};
const type=(x,id,value)=>{const f=x.doc.getElementById(id);assert.ok(f,id);if(f.type==='checkbox')f.checked=value;else f.value=value;f.dispatchEvent(new x.w.Event('input',{bubbles:true}));f.dispatchEvent(new x.w.Event('change',{bubbles:true}));return f;};

test('eligible student sees Letters in the rail and the full gallery without any server LOI capability',()=>{
  const x=setup();try{
    assert.equal(x.h.lettersStudioEnabled(),true);
    assert.ok(x.h.navItems().some(i=>i[0]==='letters'&&i[1]==='Letters of Interest'),'rail item');
    assert.ok(x.doc.querySelector('#rail [data-act="nav"][data-to="letters"]'),'rail button rendered');
    const cards=[...x.doc.querySelectorAll('.studioCard')];
    assert.equal(cards.length,7);
    assert.equal(JSON.stringify(cards.map(c=>c.dataset.template)),JSON.stringify(['initial','update','intent','thankyou','short','research','clinical']));
    for(const c of cards){assert.ok(c.querySelector('[data-act="studio-use"]'));assert.ok(c.querySelector('[data-act="studio-read"]'));}
    assert.ok(x.doc.querySelector('section[data-view="letters"]'));
    assert.equal(x.doc.querySelector('[data-act="studio-use"]').querySelector('[data-soon-badge]'),null,'studio actions are not marked coming soon');
    assert.ok(x.h.coreAction('studio-use')&&x.h.coreAction('studio-copy'));
    assert.doesNotMatch(x.doc.body.textContent,/Your programs and letters/,'server letter builder stays hidden when capability is off');
  }finally{x.close();}
});

test('home card routes to Letters and ineligible roles never see the studio',()=>{
  const x=setup();try{
    x.h.setRoute('home');x.h.render();
    const cta=[...x.doc.querySelectorAll('[data-act="nav"][data-to="letters"]')].find(b=>/OPEN LETTERS/.test(b.textContent));
    assert.ok(cta,'home CTA');
    for(const b of [workspace({role:'mentor'}),workspace({role:'admin',tier:null}),workspace({role:'student',tier:'bootcamp'})]){
      x.h.applyBootstrap(b);x.h.setRoute('letters');x.h.render();
      assert.equal(x.h.lettersStudioEnabled(),false,b.actor.role+'/'+b.actor.tier);
      assert.equal(x.doc.querySelector('.studioCard'),null,b.actor.role+' sees no gallery');
      assert.equal(x.h.coreAction('studio-use'),false);
    }
  }finally{x.close();}
});

test('read example shows the fictional sample with guidance and copies it with a warning',async()=>{
  const x=setup();try{
    await click(x,'[data-act="studio-read"][data-template="intent"]');
    assert.match(x.doc.querySelector('#studio-sample').textContent,/intend to rank Lakeside first/);
    assert.match(x.doc.body.textContent,/Fictional example/);
    assert.match(x.doc.body.textContent,/Why it works/);assert.match(x.doc.body.textContent,/What you must personalize/);assert.match(x.doc.body.textContent,/What to avoid/);
    await click(x,'[data-act="studio-copy-sample"]');
    assert.match(x.clip[0],/^Dear Dr\. Whitaker,/);
    assert.match(x.doc.getElementById('toast').textContent,/Replace every name, program and fact/);
    await click(x,'[data-act="studio-gallery"]');
    assert.equal(x.doc.querySelectorAll('.studioCard').length,7);
  }finally{x.close();}
});

test('personalize from saved interviews, live preview, edit, copy and download, with honest save status',async()=>{
  const x=setup();try{
    await click(x,'[data-act="studio-use"][data-template="initial"]');
    assert.match(x.doc.body.textContent,/NOT SAVED TO YOUR ACCOUNT/);
    assert.match(x.doc.body.textContent,/Step 1 of 2/);
    const pick=x.doc.getElementById('studio-program-pick');assert.ok(pick,'saved interview picker');
    assert.equal(pick.options.length,3);assert.match(pick.options[1].textContent,/Example Program · Internal Medicine · verified program/);assert.match(pick.options[2].textContent,/Typed Program Name · Family Medicine · as you entered it/);
    type(x,'studio-program-pick',id);
    assert.equal(x.doc.getElementById('studio-f-programName').value,'Example Program');
    assert.equal(x.doc.getElementById('studio-f-specialty').value,'Internal Medicine');
    assert.match(x.doc.getElementById('studio-preview').textContent,/interest in the Example Program in Internal Medicine/);
    assert.ok(x.doc.querySelectorAll('#studio-preview .studioPh').length>=3,'missing facts are highlighted placeholders');
    type(x,'studio-f-yourName','Amara Okafor, MBBS');type(x,'studio-f-pdName','Elena Marchetti');type(x,'studio-f-applied','in September');
    type(x,'studio-f-reasons','Your ambulatory block in year two.\nYour sickle cell referral service.');type(x,'studio-f-strengths','I bring four years of district hospital practice.');
    assert.match(x.doc.getElementById('studio-preview').textContent,/Dear Dr\. Elena Marchetti,/);
    assert.match(x.doc.getElementById('studio-preview').textContent,/First, your ambulatory block in year two\. Second, your sickle cell referral service\./);
    assert.equal(x.doc.querySelectorAll('#studio-preview .studioPh').length,0);
    await click(x,'[data-act="studio-continue"]');
    assert.match(x.doc.body.textContent,/Step 2 of 2/);
    const ta=x.doc.getElementById('studio-text');assert.match(ta.value,/Dear Dr\. Elena Marchetti,/);
    assert.match(x.doc.querySelector('.studioMissing').textContent,/No placeholders left/);
    assert.match(x.doc.getElementById('studio-subject').textContent,/Letter of Interest – Amara Okafor, MBBS, Internal Medicine Applicant/);
    type(x,'studio-text',ta.value.replace('I bring four years','I bring FIVE years'));
    assert.match(x.doc.getElementById('studio-preview').textContent,/FIVE years/);
    await click(x,'[data-act="studio-copy"]');assert.match(x.clip.at(-1),/FIVE years/);assert.equal(x.doc.getElementById('toast').textContent,'Letter copied.');
    await click(x,'[data-act="studio-copy-subject"]');assert.match(x.clip.at(-1),/^Letter of Interest – Amara Okafor/);
    await click(x,'[data-act="studio-download"]');assert.equal(x.downloads.length,2);assert.equal(x.downloads[1].name,'Initial-Letter-of-Interest-Example-Program.txt');
    // Re-render keeps the edited text; rebuilding from details discards it explicitly.
    x.h.render();assert.match(x.doc.getElementById('studio-text').value,/FIVE years/);
    await click(x,'[data-act="studio-regenerate"]');assert.match(x.doc.getElementById('studio-text').value,/four years/);assert.doesNotMatch(x.doc.getElementById('studio-text').value,/FIVE/);
    await click(x,'[data-act="studio-personalize"]');assert.equal(x.doc.getElementById('studio-f-yourName').value,'Amara Okafor, MBBS','facts persist across steps');
  }finally{x.close();}
});

test('letter of intent withholds the ranking sentence until first choice is confirmed, and copies with placeholder warning',async()=>{
  const x=setup();try{
    await click(x,'[data-act="studio-use"][data-template="intent"]');
    assert.match(x.doc.body.textContent,/ranking sentence is left out/);
    assert.doesNotMatch(x.doc.getElementById('studio-preview').textContent,/rank/i);
    type(x,'studio-f-firstChoice',true);
    assert.match(x.doc.getElementById('studio-preview').textContent,/intend to rank your program first/);
    assert.equal(x.doc.querySelector('.studioWarn'),null);
    await click(x,'[data-act="studio-continue"]');
    await click(x,'[data-act="studio-copy"]');
    assert.match(x.doc.getElementById('toast').textContent,/still contains \[bracketed\] placeholders/);
    assert.match(x.doc.querySelector('.studioMissing').textContent,/details still in \[brackets\]/);
  }finally{x.close();}
});

test('administrator Student View preview can browse and personalize without saving; actor switch clears the studio',async()=>{
  const x=setup(workspace({role:'admin',tier:null}));try{
    x.h.setPreview(true);x.h.setRoute('letters');x.h.render();
    assert.equal(x.h.lettersStudioEnabled(),true);
    assert.equal(x.doc.querySelectorAll('.studioCard').length,7);
    assert.equal(x.doc.getElementById('studio-program-pick'),null,'preview loads no private interviews');
    await click(x,'[data-act="studio-use"][data-template="short"]');
    type(x,'studio-f-yourName','Preview Person');
    assert.match(x.doc.getElementById('studio-preview').textContent,/Preview Person/);
    const other=workspace();other.actor.id='99999999-9999-4999-8999-999999999999';
    x.h.setPreview(false);x.h.applyBootstrap(other);x.h.setRoute('letters');x.h.render();
    assert.equal(x.h.loiStudioState().mode,'gallery','studio memory cleared on actor change');
    assert.equal(x.doc.body.textContent.includes('Preview Person'),false);
  }finally{x.close();}
});

test('server letter builder still renders beneath the studio when the LOI capability is on',()=>{
  const x=setup(workspace({loi:true}));try{
    assert.equal(x.doc.querySelectorAll('.studioCard').length,7);
    assert.match(x.doc.body.textContent,/SAVED LETTERS · YOUR INTERVIEWS/);
    assert.match(x.doc.body.textContent,/Your programs and letters/);
    assert.ok(x.doc.querySelector('[data-act="open-section"][data-section="loi"]'),'existing per-interview letter builder entry');
  }finally{x.close();}
});
