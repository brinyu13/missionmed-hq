import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const { JSDOM } = createRequire(import.meta.url)('/Users/brianb/MissionMed/node_modules/jsdom');
const form = fs.readFileSync(new URL('../../LIVE/usce_request.html', import.meta.url), 'utf8');
const tracker = fs.readFileSync(new URL('../../LIVE/usce_status_tracker.html', import.meta.url), 'utf8');
const id = '85f4401a-4d54-4b05-b44d-f311ce943789';
const tick = () => new Promise(resolve => setImmediate(resolve));

function open(html, storage = {}, fetch = () => { throw new Error('unexpected request'); }) {
  const dom = new JSDOM(html, {url:'https://synthetic.invalid/',runScripts:'outside-only',pretendToBeVisual:true});
  const w = dom.window;
  for (const [key,value] of Object.entries(storage)) w.sessionStorage.setItem(key,value);
  w.matchMedia = () => ({matches:true,addEventListener(){}});
  w.fetch = fetch;
  w.eval(w.document.querySelector('script').textContent);
  const el = selector => w.document.querySelector(selector);
  const set = (selector,value,event='input') => {
    const target = el(selector);
    target.value = value;
    target.dispatchEvent(new w.Event(event,{bubbles:true}));
  };
  const click = selector => el(selector).click();
  const snapshot = () => Object.fromEntries(Object.keys(w.sessionStorage).map(key=>[key,w.sessionStorage.getItem(key)]));
  return {dom,w,el,set,click,snapshot};
}

test('an unsent draft restores the typed profile, selected dates and review step in this tab', () => {
  const a=open(form);
  try {
    a.set('#student_name','Synthetic Student');
    a.set('#email','qa@example.test');
    a.set('#training_level_or_school','Synthetic school');
    a.click('#nextBtn');
    for (const kind of ['specialty','location']) {
      const selector = '[data-rank="'+kind+'"]';
      const option = Array.from(a.el(selector).options).find(option=>option.value && !option.disabled);
      a.set(selector,option.value,'change');
    }
    a.click('#nextBtn');
    a.click('[data-month]');
    a.click('#nextBtn');
    const b=open(form,a.snapshot());
    try {
      assert.equal(b.el('#student_name').value,'Synthetic Student');
      assert.equal(b.el('#email').value,'qa@example.test');
      assert.equal(b.el('.mm-section.is-active').dataset.step,'4');
      assert.match(b.el('#reviewList').textContent,/qa@example.test/);
      assert.equal(b.el('[data-month].is-on').getAttribute('aria-pressed'),'true');
    } finally {b.dom.window.close();}
  } finally {a.dom.window.close();}
});

test('retry preserves request and key, rejects an unverified success and restores a confirmed receipt', async () => {
  const bodies=[];
  const a=open(form,{},async(_url,options)=>{
    bodies.push(JSON.parse(options.body));
    return {ok:true,json:async()=>bodies.length===1 ? {success:true,request_id:id} : {success:true,request_id:id,dry_run:false,status:'new'}};
  });
  try {
    a.set('#student_name','Synthetic Student'); a.set('#email','qa@example.test'); a.set('#training_level_or_school','QA school');
    a.click('#nextBtn');
    for(const kind of ['specialty','location']) {
      const field='[data-rank="'+kind+'"]';
      a.set(field,Array.from(a.el(field).options).find(o=>o.value&&!o.disabled).value,'change');
    }
    a.click('#nextBtn'); a.click('[data-month]'); a.click('#nextBtn'); a.click('#consent');
    a.click('#nextBtn'); await tick();
    assert.equal(a.el('#successState').classList.contains('is-on'),false);
    a.click('#nextBtn'); await tick();
    assert.equal(bodies.length,2);assert.deepEqual(bodies[0],bodies[1]);
    assert.equal(a.el('#successState').classList.contains('is-on'),true);
    const receiptTarget=new URL(a.el('#trackerBtn').href); assert.equal(receiptTarget.searchParams.get('ref'),id); assert.equal(receiptTarget.searchParams.get('action'),'mmi_usce_student_tracker'); assert.equal(receiptTarget.pathname,'/wp-admin/admin-post.php');
    const saved=a.snapshot();
    assert.equal(saved.mm_usce_request_recovery_v1,undefined);
    assert.notEqual(saved.mm_usce_request_idempotency_key,bodies[0].idempotency_key);
    const b=open(form,saved);
    try {
      assert.equal(b.el('#requestRef').textContent,id);assert.match(b.el('#confirmedEmail').textContent,/qa@example.test/);
      assert.equal(b.el('#successState').classList.contains('is-on'),true);
    } finally {b.dom.window.close();}
  } finally {a.dom.window.close();}
});

test('public entry forwards only a case reference to the canonical signed-in tracker', () => {
  for (const query of ['?ref='+id+'&email=wrong@example.test&redirect_to=https://example.test/#old','?ref=invalid','']) {
    const dom = new JSDOM(tracker,{url:'https://synthetic.invalid/'+query,runScripts:'outside-only'});
    const w=dom.window; w.sessionStorage.setItem('mm_usce_student_bearer_session','retired-fixture');
    try {
      w.eval(w.document.querySelector('script').textContent);
      const href=new URL(w.document.querySelector('#accountLink').href);
      assert.equal(href.origin+href.pathname,'https://missionmedinstitute.com/wp-admin/admin-post.php');
      assert.deepEqual([...href.searchParams],query.startsWith('?ref='+id) ? [['action','mmi_usce_student_tracker'],['ref',id]] : [['action','mmi_usce_student_tracker']]);
      assert.equal(w.sessionStorage.getItem('mm_usce_student_bearer_session'),null);
      assert.equal(w.location.hash,''); assert.doesNotMatch(w.document.body.textContent,/Request received/i);
    } finally {w.close();}
  }
});

test('a full session store stops the intake before the first network write', async () => {
  let sends=0;
  const a=open(form,{},async()=>{sends++;throw new Error('unreachable');});
  try {
    a.set('#student_name','QA Storage');a.set('#email','qa@example.test');a.set('#training_level_or_school','QA school');
    a.click('#nextBtn');
    for(const kind of ['specialty','location']){
      const field='[data-rank="'+kind+'"]';a.set(field,Array.from(a.el(field).options).find(o=>o.value&&!o.disabled).value,'change');
    }
    a.click('#nextBtn');a.click('[data-month]');a.click('#nextBtn');a.click('#consent');
    a.w.Storage.prototype.setItem=function(){throw new Error('Storage unavailable');};
    a.click('#nextBtn'); await tick();
    assert.equal(sends,0);assert.match(a.el('#formAlert').textContent,/safe retry/);
  } finally {a.dom.window.close();}
});
