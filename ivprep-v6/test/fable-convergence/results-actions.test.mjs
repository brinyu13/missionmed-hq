import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source=readFileSync(new URL('../../public/studio-fable/app/results.mjs',import.meta.url),'utf8');
const reportCode=source.slice(source.indexOf('function appendFullReport('),source.indexOf('\nfunction renderProviderTranscript('));
test('Full Analytics joins Film/Compare in the existing wrapping action group',()=>{
  const nodes=[],actions=[],events=new Map(),calls=[];
  const document={createElement:tag=>{const node={tag,addEventListener:(type,fn)=>events.set(type,fn),removeEventListener:(type,fn)=>{assert.equal(events.get(type),fn);events.delete(type);},scrollIntoView:options=>calls.push(['scroll',options]),focus:options=>calls.push(['focus',options])};nodes.push(node);return node;}};
  const main={append:node=>calls.push(['append',node]),querySelector:selector=>{assert.equal(selector,'.screen-head .review-actions');return {append:node=>actions.push(node)};}};
  const context={document,DI_GROUPS:[],resultLaneReadouts:()=>({}),esc:s=>s};
  runInNewContext(reportCode+';this.appendFullReport=appendFullReport;',context);
  const dispose=context.appendFullReport(main,{id:'own-attempt',analytics:{}});
  assert.equal(actions.length,1);assert.equal(actions[0].tag,'button');assert.equal(actions[0].type,'button');assert.equal(actions[0].textContent,'Full Analytics ↓');
  events.get('click')();assert.equal(calls[1][0],'scroll');assert.equal(calls[2][0],'focus');assert.equal(calls[2][1].preventScroll,true);
  assert.equal(nodes[0].id,'full-analytics');assert.equal(nodes[0].tabIndex,-1);dispose();assert.equal(events.size,0);
  assert.match(source,/<div class="review-actions"><a class="btn btn-secondary" href="#\/film\/\$\{a\.id\}">Film Room<\/a>/);
  assert.match(source,/href="#\/compare\/\$\{earlier\.id\}\/\$\{a\.id\}"/);
  const css=readFileSync(new URL('../../public/studio-fable/styles/app.css',import.meta.url),'utf8');
  assert.match(css,/\.review-actions\s*\{[^}]*flex-wrap:\s*wrap/);
});
