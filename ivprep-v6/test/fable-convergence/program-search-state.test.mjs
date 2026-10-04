import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../../public/studio-fable/app/main.mjs',import.meta.url),'utf8');
const body=source.slice(source.indexOf('async function renderPrepare('),source.indexOf('// ---------- REVIEW & IMPROVE'));
const result=id=>({rows:[{id,name:id,city:'City',specialty:'Internal Medicine',verified:true}],total:1,page:1,totalPages:1});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function harness(){
  let html='',nodes={},writes=0,route=true;
  const requests=[],state={program:null},account={subject:'wp:1',liveInterviewAvailable:true},controller={account,durable:{}},location={hash:''};
  const main={
    set innerHTML(value){
      html=value;writes++;
      const form={querySelector:()=>form.query,elements:{specialty:{value:''},jurisdiction:{value:''},programType:{value:''}},query:{value:''}};
      nodes={'#program-form':form,'#search-state':{},'#program-mock':{disabled:/id="program-mock"[^>]*disabled/.test(value)},'#prev-page':{disabled:/id="prev-page"[^>]*disabled/.test(value)},'#next-page':{disabled:/id="next-page"[^>]*disabled/.test(value)},'[data-interview-calendar]':{}};
      nodes.rows=[...value.matchAll(/data-program="([^"]+)"/g)].map(match=>({dataset:{program:match[1]}}));
    },
    get innerHTML(){return html;},
    querySelector:key=>nodes[key],querySelectorAll:()=>nodes.rows,
  };
  const context={controller,state,main,location,guarded:()=>route,loadQuestions:async()=>({questions:[]}),
    calendarMarkup:()=>'',readOwnCalendar:async()=>({state:'unavailable'}),esc:value=>String(value),commit:()=>{},
    searchPrograms:(actor,filters)=>new Promise((resolve,reject)=>requests.push({actor,filters:{...filters},resolve,reject})),
  };
  const pending=vm.runInNewContext(body+';renderPrepare(guarded)',context);
  return {main,state,controller,location,requests,pending,nodes:()=>nodes,writes:()=>writes,leave:()=>{route=false;},
    submit(q){const form=nodes['#program-form'];form.query.value=q;form.onsubmit({preventDefault(){},currentTarget:form});}};
}
async function loaded(){const h=harness();await tick();h.requests[0].resolve(result('old-program'));await h.pending;return h;}

test('actual Prepare removes old selectable results and prevents retained handlers during a new query',async()=>{
  const h=await loaded(),oldRow=h.nodes().rows[0];oldRow.onclick();assert.equal(h.state.program.id,'old-program');
  const oldMock=h.nodes()['#program-mock'];h.submit('new program');
  assert.match(h.main.innerHTML,/Searching RISE/);assert.equal(h.nodes().rows.length,0);assert.equal(h.nodes()['#program-mock'].disabled,true);
  oldRow.onclick();oldMock.onclick();assert.equal(h.state.program,null);assert.equal(h.location.hash,'');
  h.requests[1].resolve(result('new-program'));await tick();assert.equal(h.nodes().rows[0].dataset.program,'new-program');
  h.nodes().rows[0].onclick();assert.equal(h.state.program.id,'new-program');assert.equal(h.nodes()['#program-mock'].disabled,false);
  h.nodes()['#program-mock'].onclick();assert.equal(h.location.hash,'#/mock?program=1');
});
test('a superseded reply cannot restore its rows or clear the current loading state',async()=>{
  const h=await loaded();h.submit('first');h.submit('second');
  h.requests[1].resolve(result('superseded'));await tick();assert.equal(h.nodes().rows.length,0);assert.match(h.main.innerHTML,/Searching RISE/);
  h.requests[2].resolve(result('current'));await tick();assert.equal(h.nodes().rows[0].dataset.program,'current');assert.doesNotMatch(h.main.innerHTML,/superseded/);
});
test('query failure clears selectable results and keeps general interview recovery',async()=>{
  const h=await loaded();h.submit('failed');h.requests[1].reject(new Error('owner unavailable'));await tick();
  assert.equal(h.nodes().rows.length,0);assert.equal(h.nodes()['#program-mock'].disabled,true);
  assert.match(h.main.innerHTML,/search is unavailable/);assert.match(h.main.innerHTML,/General mock instead/);
});
test('account or route replacement rejects a pending reply before redraw or selection',async()=>{
  for(const change of ['account','route']){
    const h=await loaded(),oldRow=h.nodes().rows[0];h.submit('pending');const writes=h.writes();
    if(change==='account')h.controller.account={subject:'wp:2'};else h.leave();
    h.requests[1].resolve(result('private-late'));await tick();assert.equal(h.writes(),writes,change);assert.doesNotMatch(h.main.innerHTML,/private-late/);
    oldRow.onclick();assert.equal(h.state.program,null,change);
  }
});
test('paging blocks retained page and launch handlers while preserving a separately verified selection',async()=>{
  const h=harness();await tick();h.requests[0].resolve({...result('selected-program'),total:20,totalPages:2});await h.pending;
  h.nodes().rows[0].onclick();const oldNext=h.nodes()['#next-page'],oldMock=h.nodes()['#program-mock'];oldNext.onclick();
  assert.equal(h.requests[1].filters.page,2);assert.equal(h.nodes()['#prev-page'].disabled,true);assert.equal(h.nodes()['#next-page'].disabled,true);assert.equal(h.nodes()['#program-mock'].disabled,true);
  oldNext.onclick();oldMock.onclick();assert.equal(h.requests.length,2);assert.equal(h.location.hash,'');assert.equal(h.state.program.id,'selected-program');
  h.requests[1].resolve({...result('page-two'),page:2,total:20,totalPages:2});await tick();
  assert.equal(h.nodes()['#prev-page'].disabled,false);assert.equal(h.nodes()['#program-mock'].disabled,false);
});
