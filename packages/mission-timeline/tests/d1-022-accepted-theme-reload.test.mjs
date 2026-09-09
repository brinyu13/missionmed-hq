import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';import vm from 'node:vm';
import {applyDocumentTo407FState,apply407FStateToDocument} from '../web/js/407f-engineering-adapter.js';
import {THEME_DEFINITIONS} from '../web/js/uxr-002/themes.js';
const raw=readFileSync(new URL('../../../_AI_HANDOFFS/from_codex/D1-TIMELINE-STORYFORGE-LIVE-022/evidence/canary-execution/022-be026e5a64ebd9ed/052-a2-document.json',import.meta.url));
assert.equal(createHash('sha256').update(raw).digest('hex'),'5bf07bf029a3dd0de972f648f39e3c7ad702c1158706b07d1e6bc37e8206eb66');
const actual=JSON.parse(raw),html=readFileSync(new URL('../web/index.html',import.meta.url),'utf8');
const between=(source,start,end)=>{const a=source.indexOf(start),b=source.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,`${start} source boundary`);return source.slice(a,b);};
function contextFor(state,source=html){
  const host={innerHTML:'',querySelector:()=>null},button={textContent:''};
  const context=vm.createContext({state,SPR402:null,document:{getElementById:()=>host},$$:()=>[button]});
  const parts=[between(source,'const THEMES={','const QUESTIONS='),between(source,'const CATS={','const COUNTRIES='),source.match(/const VISDEF=.+;/)[0],source.match(/const SCOPES=.+;/)[0],between(source,'const pm=','/* ---- 407F: snapshots'),between(source,'function renderBoard(','/* ============ BOARD INTERACTION'),between(source,'function renderThemeButtons()','function openThemeModal()')];
  vm.runInContext(parts.join('\n')+'\nglobalThis.themeTest={renderBoard,renderThemeButtons,THEMES};',context);return{context,host,button};
}
function hydrated(document){return applyDocumentTo407FState(document,{user:{events:[],interview:{}},profile:{},builder:{},media:{photos:{}},mode:'blank',safe:false,photoN:3,condensed:false,sprites:false});}
const facts=document=>document.events.map(({id,title,categoryId,startDate,endDate,eventType,openEnded,provenance})=>({id,title,categoryId,startDate,endDate,eventType,openEnded,provenance}));
const ids={'keynote-classic':'keynote','mission-navy':'navy','advisor-paper':'paper',horizon:'horizon','little-journeys':'journeys'};
test('actual saved052 changed only to Horizon reproduces legacy index crash with its original catalog',()=>{
  const document=structuredClone(actual);document.theme='horizon';const state=hydrated(document);
  const old=readFileSync(new URL('../../../_AI_HANDOFFS/from_codex/D1-TIMELINE-STORYFORGE-LIVE-022/evidence/theme-reload-compatibility-r5/before-index.html',import.meta.url),'utf8');
  const {context}=contextFor(state,old);assert.throws(()=>context.themeTest.renderBoard('boardUpload'),/Cannot read properties of undefined \(reading 'n'\)/);
  assert.deepEqual(facts(document),facts(actual));
});
for(const theme of THEME_DEFINITIONS)test(`${theme.name}: actual saved052 hydrates, renders every compatibility board, edits and reloads without changing theme or other facts`,()=>{
  const document=structuredClone(actual);document.theme=theme.id;const before=structuredClone(document),state=hydrated(document);assert.deepEqual(document,before);assert.equal(state.canvasTheme,ids[theme.id]);
  const first=contextFor(state);assert.doesNotThrow(()=>first.context.themeTest.renderThemeButtons());assert.ok(first.button.textContent.includes(first.context.themeTest.THEMES[state.canvasTheme].n.toUpperCase()));
  for(const host of ['boardCommand','boardUpload','boardMedia','boardAdvisor','boardQuestions','boardReference','boardPrint']){assert.doesNotThrow(()=>first.context.themeTest.renderBoard(host));assert.ok(first.host.innerHTML.includes('THEME · '+first.context.themeTest.THEMES[state.canvasTheme].n.toUpperCase()));assert.ok(first.host.innerHTML.includes('data-ev='));}
  state.user.events[0].t+=' — local reload check';apply407FStateToDocument(state,document);assert.equal(document.theme,theme.id);assert.equal(document.events.length,9);
  const expected=facts(before);expected[0].title+=' — local reload check';assert.deepEqual(facts(document),expected);
  const restored=JSON.parse(JSON.stringify(document)),second=hydrated(restored);assert.equal(second.canvasTheme,ids[theme.id]);assert.doesNotThrow(()=>contextFor(second).context.themeTest.renderBoard('boardUpload'));assert.deepEqual(facts(restored),expected);
});
test('all missing compatibility catalog entries reuse accepted names, descriptions and board swatches',()=>{
  const {context}=contextFor(hydrated(actual));for(const id of ['mission-navy','horizon','little-journeys']){const source=THEME_DEFINITIONS.find(t=>t.id===id),legacy=context.themeTest.THEMES[ids[id]];assert.equal(legacy.n,source.name);assert.equal(legacy.d,source.descriptor);assert.equal(legacy.sw,source.board.css);assert.notEqual(legacy.lk,true);}
});
test('theme mapping repair changes only the reviewed theme branches in document projection',()=>{
  const current=readFileSync(new URL('../web/js/407f-engineering-adapter.js',import.meta.url),'utf8'),before=readFileSync(new URL('../../../_AI_HANDOFFS/from_codex/D1-TIMELINE-STORYFORGE-LIVE-022/evidence/theme-reload-compatibility-r5/before-407f-engineering-adapter.js',import.meta.url),'utf8');
  const projection=(source)=>between(source,'export function applyDocumentTo407FState','export function apply407FStateToDocument');
  const persistence=(source)=>between(source,'export function apply407FStateToDocument','export function persistedIntakeState');
  assert.equal(projection(current).replace('    document.theme==="mission-navy"?"navy":\n',''),projection(before));
  assert.equal(persistence(current).replace('    state.canvasTheme==="navy"?"mission-navy":\n',''),persistence(before));
});
