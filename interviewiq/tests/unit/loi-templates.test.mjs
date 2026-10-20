import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Pure checks of the Letters of Interest studio templates and composer (IIQ-LOI-RAPID-20261019).
// The studio source is evaluated with the runtime globals it needs stubbed.
const src=fs.readFileSync(new URL('../../public/source/letters-studio.js',import.meta.url),'utf8');
function harness(over={}){
  const ctx={console,Object,Array,String,Number,RegExp,JSON,Set,Map,Error,Boolean,Promise,
    esc:s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
    A:{},S:{interviews:[]},actor:{id:'me',role:'student',tier:'360'},studentPreview:()=>false,loiEnabled:()=>false,myInterviews:()=>[],P:()=>({name:'',specialty:''}),
    render:()=>{},notice:()=>{},draftValues:new Map(),draftKey:x=>x,forgetDrafts:()=>{},navigator:{},URL:{},Blob:class{},setTimeout:()=>{},
    document:{addEventListener:()=>{},getElementById:()=>null,querySelector:()=>null,querySelectorAll:()=>[],createElement:()=>({}),body:{append(){}}},
    ...over};
  vm.createContext(ctx);vm.runInContext(src+'\nthis.LOI_STUDIO_TEMPLATES=LOI_STUDIO_TEMPLATES;this.LOI_STUDIO_FIELDS=LOI_STUDIO_FIELDS;this.LOI_STUDIO_FIELD_SETS=LOI_STUDIO_FIELD_SETS;',ctx,{filename:'letters-studio.js'});return ctx;
}
const ids=['initial','update','intent','thankyou','short','research','clinical'];
const FORBIDDEN=/\b(dream program|perfect fit|game-changing|revolutionary|unlock|elevate|empower)\b/i;

test('seven meaningfully different templates with complete guidance and fictional labeling',()=>{
  const h=harness();const t=h.LOI_STUDIO_TEMPLATES;
  assert.equal(JSON.stringify(t.map(x=>x.id)),JSON.stringify(ids));
  const samples=new Set(),fieldSets=new Set();
  for(const x of t){
    for(const k of ['name','short','timing','length','when','summary','sampleMeta','sample','subject'])assert.ok(typeof x[k]==='string'&&x[k].trim().length>8,x.id+' '+k);
    for(const k of ['why','personalize','avoid'])assert.ok(Array.isArray(x[k])&&x[k].length>=2&&x[k].every(s=>s.length>12),x.id+' '+k);
    assert.match(x.sampleMeta,/Fictional example/,x.id+' sample is labeled fictional');
    assert.ok(x.sample.length>400&&x.sample.length<2400,x.id+' sample length');
    assert.match(x.sample,/^Dear /,x.id+' salutation');
    assert.match(x.sample,/Sincerely,\n/,x.id+' signature');
    assert.doesNotMatch(x.sample,FORBIDDEN,x.id+' avoids cliché');
    assert.doesNotMatch(x.sample,/guarantee|I will match|promise to match/i,x.id+' no match promises');
    assert.ok(!samples.has(x.sample));samples.add(x.sample);
    assert.ok(Array.isArray(h.LOI_STUDIO_FIELD_SETS[x.id])&&h.LOI_STUDIO_FIELD_SETS[x.id].length>=5,x.id+' fields');
    for(const f of h.LOI_STUDIO_FIELD_SETS[x.id])assert.ok(h.LOI_STUDIO_FIELDS[f],x.id+' unknown field '+f);
    fieldSets.add(h.LOI_STUDIO_FIELD_SETS[x.id].join('|'));
  }
  assert.equal(fieldSets.size,7,'each template collects a different set of facts');
  const intent=t.find(x=>x.id==='intent');
  assert.match(intent.sample,/strongly interested/);
  for(const x of t)assert.doesNotMatch(x.sample,/rank (you|your program|it) first|intend to rank/i,x.id+' makes no ranking commitment');
});

test('composer never invents facts: empty fields become visible bracket placeholders',()=>{
  const h=harness();
  for(const id of ids){
    const out=h.composeLoiStudio(id,{});
    assert.ok(out&&typeof out.text==='string'&&out.text.length>120,id);
    const ph=h.loiStudioPlaceholders(out.text);
    assert.ok(ph.length>=3,id+' has placeholders: '+ph.length);
    assert.match(out.text,/^Dear Program Director,/,id+' default salutation');
    assert.match(out.text,/\[Your full name, degree\]\n?$/m,id+' signature placeholder');
    assert.doesNotMatch(out.text,/AAMC ID/,id+' omits AAMC ID when blank');
    assert.doesNotMatch(out.text,/\{\{|undefined|null/,id+' no template leakage');
    assert.ok(out.subject.length>10,id+' subject');
  }
  assert.equal(h.composeLoiStudio('nope',{}),null);
});

test('composer uses the student words verbatim and formats salutation, reasons and signature',()=>{
  const h=harness();
  const fields={yourName:'Amara Okafor, MBBS',programName:'Riverbend Internal Medicine Residency',specialty:'Internal Medicine',pdName:'Elena Marchetti',applied:'in September',reasons:'Your ambulatory block in year two matches how I learned best.\nYour sickle cell referral service.\n',strengths:'I bring four years of district hospital practice.',aamcId:'12345678',contact:'me@example.com'};
  const out=h.composeLoiStudio('initial',fields);
  assert.match(out.text,/^Dear Dr\. Elena Marchetti,/);
  assert.match(out.text,/interest in the Riverbend Internal Medicine Residency\. I submitted my application in September/);
  assert.doesNotMatch(out.text,/Riverbend Internal Medicine Residency in Internal Medicine/,'specialty not repeated when the program name already names it');
  assert.match(out.text,/First, your ambulatory block in year two matches how I learned best\. Second, your sickle cell referral service\./);
  assert.match(out.text,/I bring four years of district hospital practice\./);
  assert.match(out.text,/Sincerely,\nAmara Okafor, MBBS\nAAMC ID 12345678 · me@example\.com\n$/);
  assert.equal(h.loiStudioPlaceholders(out.text).length,0);
  assert.equal(out.subject,'Letter of Interest – Amara Okafor, MBBS, Internal Medicine Applicant');
  const titled=h.composeLoiStudio('short',{...fields,pdName:'Dr. Patel',programName:'Westfield Residency'});
  assert.match(titled.text,/^Dear Dr\. Patel,/);
  assert.match(titled.text,/the Westfield Residency in Internal Medicine/);
});

test('letter of intent includes the ranking sentence only after explicit first-choice confirmation',()=>{
  const h=harness();
  const base={yourName:'Priya Raman, MBBS',programName:'Lakeside Pediatrics Residency',specialty:'Pediatrics',interviewDate:'January 8',moment:'Morning report was resident-led.',reasons:'The refugee health clinic.',contribute:'Three years of pediatric experience.'};
  const off=h.composeLoiStudio('intent',base);
  assert.doesNotMatch(off.text,/rank/i);
  assert.equal(off.warnings.length,1);assert.match(off.warnings[0],/all four confirmations/);
  const confirmations={firstChoice:true,rankVoluntary:true,rankUnpressured:true,rankNoReciprocity:true};
  for(const key of Object.keys(confirmations)){
    for(const value of [false,undefined,'true']){
      const incomplete=h.composeLoiStudio('intent',{...base,...confirmations,[key]:value});
      assert.doesNotMatch(incomplete.text,/intend to rank|#1/i,key+' needs explicit confirmation');
    }
  }
  assert.doesNotMatch(h.composeLoiStudio('intent',{...base,firstChoice:true}).text,/intend to rank/,'legacy single confirmation is insufficient');
  for(const id of ids.filter(id=>id!=='intent'))assert.doesNotMatch(h.composeLoiStudio(id,{...base,...confirmations}).text,/intend to rank|rank (you|your program|it) first|#1/i,id+' ignores intent confirmations');
  const on=h.composeLoiStudio('intent',{...base,...confirmations});
  assert.match(on.text,/I intend to rank your program first on my rank order list\./);
  assert.equal(on.warnings.length,0);
  assert.doesNotMatch(on.text,/guarantee|commit|promise/i);
});

test('update letter adapts to whether the student has interviewed',()=>{
  const h=harness();
  const a=h.composeLoiStudio('update',{programName:'Harbor Family Medicine Residency',specialty:'Family Medicine',update:'My manuscript was accepted.',reason:'Harbor integrates pharmacy.'});
  assert.match(a.text,/I am writing with an update to my application to the Harbor Family Medicine Residency\./);
  assert.doesNotMatch(a.text,/interviewed/);
  const b=h.composeLoiStudio('update',{programName:'Harbor Family Medicine Residency',specialty:'Family Medicine',interviewDate:'November 12',update:'My manuscript was accepted.',reason:'Harbor integrates pharmacy.'});
  assert.match(b.text,/I interviewed with the Harbor Family Medicine Residency on November 12/);
  assert.match(b.subject,/interviewed November 12/);
});

test('studio entitlement mirrors the gateway tiers and the administrator preview',()=>{
  for(const [actor,preview,expected] of [[{role:'student',tier:'360'},false,true],[{role:'student',tier:'ivprep_complete'},false,true],[{role:'student',tier:'bootcamp'},false,false],[{role:'mentor',tier:'360'},false,false],[{role:'admin',tier:null},false,false],[{role:'admin',tier:null},true,true],[null,false,false]]){
    const h=harness({actor,studentPreview:()=>preview});
    assert.equal(h.lettersStudioEnabled(),expected,JSON.stringify([actor,preview]));
  }
});
