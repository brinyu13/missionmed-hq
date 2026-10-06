import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {commandSurfaceMarkup,mountCommandSurface} from '../../public/studio-fable/app/adapters/command-surface.mjs';
import {commandChips} from '../../public/studio-fable/app/adapters/command-router.mjs';

const read=path=>readFileSync(new URL('../../public/studio-fable/'+path,import.meta.url),'utf8');
const main=read('app/main.mjs'),css=read('styles/app.css');
const home=main.slice(main.indexOf('async function renderHome('),main.indexOf('// ---------- PRACTICE:'));

test('Home renders the command surface between the hero and the four goals, keeping the now card and recent reps',()=>{
  const hero=home.indexOf('<section class="home-hero">'),surface=home.indexOf('${commandSurfaceMarkup({ chips })}'),goals=home.indexOf('<section class="goal-grid" aria-label="Four goals">'),strip=home.indexOf('Recent reps');
  assert.ok(hero>0&&surface>hero&&goals>surface&&strip>goals);
  assert.ok(home.includes('aria-label="What should I do now"'));
  assert.ok(home.includes('const chips = commandChips({ latest: last });'));
  assert.ok(home.includes("mountCommandSurface(main.querySelector('[data-command-surface]'), { questions, latest: last, isCurrent: current });"));
  assert.ok(main.includes("import {commandChips} from './adapters/command-router.mjs';"));
  assert.ok(main.includes("import {commandSurfaceMarkup,mountCommandSurface} from './adapters/command-surface.mjs';"));
});

test('command surface markup is a labelled, keyboard-reachable form with escaped chips and an initially empty status line',()=>{
  const markup=commandSurfaceMarkup({chips:[...commandChips(),{id:'evil',label:'<script>alert("x")</script> & "quotes"',href:'#/review'},{id:'unsafe',label:'Nope',href:'javascript:alert(1)'}]});
  assert.match(markup,/<form class="command-form" data-command-form role="search" novalidate>/);
  assert.match(markup,/<label class="t-kick gold command-label" id="command-label" for="command-input">What do you want to work on\?<\/label>/);
  assert.match(markup,/<input id="command-input" class="command-input" type="text" name="command" autocomplete="off"[^>]*aria-describedby="command-help">/);
  assert.match(markup,/<button type="submit" class="btn btn-secondary command-go">/);
  assert.match(markup,/<div class="command-chips" role="group" aria-label="Suggestions">/);
  for(const label of ['Practice tell me about yourself','Give me a full mock','Prepare me for a program','Show me what to improve'])assert.ok(markup.includes('>'+label+'</button>'),label);
  assert.ok(markup.includes('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &quot;quotes&quot;'));
  assert.doesNotMatch(markup,/<script>/);
  assert.doesNotMatch(markup,/javascript:/,'unsafe chip hrefs are dropped at render time');
  assert.match(markup,/<p class="note command-help" id="command-help" role="status" aria-live="polite"><\/p>/);
  assert.equal((markup.match(/data-command-href="/g)||[]).length,5);
});

function host(){
  const listeners={};const input={value:''},help={textContent:'',innerHTML:'',querySelector:()=>null};
  const form={addEventListener:(type,fn)=>{listeners['form:'+type]=fn;},removeEventListener:(type)=>{delete listeners['form:'+type];}};
  const node={querySelector:selector=>({'[data-command-form]':form,'#command-input':input,'#command-help':help})[selector]||null,addEventListener:(type,fn)=>{listeners['host:'+type]=fn;},removeEventListener:(type)=>{delete listeners['host:'+type];}};
  return{node,input,help,listeners};
}
const questions=[{question_id:'CORE-01',canonical_text:'Tell me about yourself.',core_priority:true},{question_id:'CORE-08',canonical_text:'What is your greatest weakness?',core_priority:true}];

test('Enter routes typed text through the pure router; unknown text shows three suggestions and never navigates',()=>{
  const h=host(),navigated=[];let current=true;
  const dispose=mountCommandSurface(h.node,{questions,latest:{id:'att-1',mode:'practice',questionId:'CORE-01',priorityText:'Pause.'},navigate:href=>navigated.push(href),isCurrent:()=>current});
  h.input.value='practice my weakness answer';h.listeners['form:submit']({preventDefault(){}});
  assert.deepEqual(navigated,['#/practice?q=CORE-08']);assert.match(h.help.textContent,/Opening Practice/);
  h.input.value='what is the weather';h.listeners['form:submit']({preventDefault(){}});
  assert.equal(navigated.length,1);assert.equal((h.help.innerHTML.match(/data-command-href="/g)||[]).length,3);assert.doesNotMatch(h.help.innerHTML,/<script/);
  h.input.value='what should I improve';h.listeners['form:submit']({preventDefault(){}});assert.equal(navigated.at(-1),'#/results/att-1');
  current=false;h.input.value='mock';h.listeners['form:submit']({preventDefault(){}});assert.equal(navigated.length,2,'a stale Home never routes');
  dispose();assert.deepEqual(Object.keys(h.listeners),[]);
});

test('chip clicks route by their data href and only through the safety gate',()=>{
  const h=host(),navigated=[];
  mountCommandSurface(h.node,{questions,navigate:href=>navigated.push(href)});
  const click=href=>h.listeners['host:click']({target:{closest:()=>({getAttribute:()=>href})},preventDefault(){}});
  click('#/mock?min=5&preset=pressure');click('javascript:alert(1)');click('#/vault');click('#/results/att-9');
  assert.deepEqual(navigated,['#/mock?min=5&preset=pressure','#/results/att-9']);
  h.listeners['host:click']({target:{closest:()=>null}});assert.equal(navigated.length,2);
  assert.equal(typeof mountCommandSurface(null),'function');assert.equal(typeof mountCommandSurface({querySelector:()=>null}),'function');
});

test('Prepare reads the pre-filled RISE query from the route and Mock applies only valid length/preset hints',()=>{
  assert.ok(main.includes("async function renderPrepare(isCurrent = guarded, { initialQuery = '' } = {}) {"));
  assert.ok(main.includes("let filters={q:String(initialQuery||'').slice(0,120),"));
  assert.ok(main.includes("else if(name==='prepare')await renderPrepare(isCurrent,{initialQuery:params.get('q')||''});"));
  assert.ok(main.includes("if([5,10,15,25].includes(requestedMinutes)){session.config.durationMin=requestedMinutes;session.settings.durationMin=requestedMinutes;}"));
  assert.ok(main.includes("const presetHint=EASY_PRESETS.some(p=>p.id===params.get('preset'))?params.get('preset'):null;"));
  assert.ok(main.includes("if(presetHint&&isCurrent()){Object.assign(st,applyPreset(st,presetHint,{interviewPolicy:controller.interviewPolicy}));st.advanced=false;draw();}"));
  assert.doesNotMatch(main,/searchPrograms\([^)]*\)[^\n]*renderHome/,'Home never calls RISE');
  assert.equal(home.includes('searchPrograms('),false);
});

test('command surface styling keeps the goals above the fold and documents the 1440×900 budget',()=>{
  assert.match(css,/Budget at 1440×900/);
  assert.match(css,/\.command-surface \{ margin-top: 16px; padding: 12px 16px; \}/);
  assert.match(css,/\.command-input \{[^}]*min-height: 50px;/);
  assert.match(css,/\.command-input:focus-visible \{[^}]*box-shadow: var\(--focus-ring\)/);
  assert.match(css,/\.chip-cmd \{[^}]*min-height: 30px;/);
  assert.match(css,/\.command-help:empty \{ display: none; \}/);
  assert.match(css,/\.home-hero \{[^}]*padding: 34px 44px;/);
  assert.match(css,/@media \(max-width: 960px\) \{ \.command-row \{ grid-template-columns: minmax\(0, 1fr\) auto; \}/);
  assert.ok(css.indexOf('.command-help:empty')<css.lastIndexOf('@media (max-width: 760px)'),'display:none rules stay out of the narrow-drawer block the selector-layout contract audits');
});
