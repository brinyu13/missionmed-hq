import test from 'node:test';
import assert from 'node:assert/strict';
import {createAdminRosterReturn022} from '../web/js/production/family-runtime-022.js';
import {mountTimelineAdminWorkspace,TIMELINE_ADMIN_METRICS_022} from '../web/js/production/admin-workspace-022.js';

const view={query:'synthetic-reviewer@example.invalid',filter:'cv_imported',session:'Synthetic Session',page:2};
function fixture(){
  const map=new Map(),storage={getItem:key=>map.get(key),setItem:(key,value)=>map.set(key,value),removeItem:key=>map.delete(key)};
  let current=100000,allowed=true;
  const create=principalId=>createAdminRosterReturn022({storage:()=>storage,principalId,authorized:()=>allowed,now:()=>current});
  return{map,create,advance:ms=>{current+=ms;},deny:()=>{allowed=false;}};
}
test('one matching selected-student return preserves the exact private view and scroll; ordinary landing does not consume it',()=>{
  const f=fixture(),original=f.create('admin-a');assert.equal(original.remember(view,900031,572),true);
  assert.equal(f.create('admin-a').takeReturn(),null);assert.equal(f.map.size,1);
  const selected=f.create('admin-a');assert.equal(selected.requestReturn(900032),false);assert.equal(selected.takeReturn(),null);
  assert.equal(selected.requestReturn(900031),true);
  const back=f.create('admin-a').takeReturn();assert.deepEqual(back.view,view);assert.equal(back.scrollTop,572);assert.equal(back.studentWpId,900031);
  assert.equal(f.map.size,0);assert.equal(f.create('admin-a').takeReturn(),null);
});
test('another authenticated principal cannot consume or overwrite this tab-local return and locked access cannot use it',()=>{
  const f=fixture(),a=f.create('admin-a');a.remember(view,900031,10);
  assert.equal(f.create('admin-b').takeReturn(),null);assert.equal(f.create('admin-b').requestReturn(900031),false);assert.equal(f.map.size,1);
  a.requestReturn(900031);f.deny();assert.equal(a.takeReturn(),null);assert.equal(a.remember(view,900031,10),false);
});
test('exact expiry, future times, malformed or oversized storage and arbitrary fields cannot restore a roster',()=>{
  const cases=[
    value=>({...value,savedAt:value.savedAt+1}),value=>({...value,principalId:'admin-b'}),value=>({...value,version:2}),
    value=>({...value,role:'PROGRAM_ADMIN'}),value=>({...value,studentWpId:-1}),value=>({...value,scrollTop:Infinity}),
    value=>({...value,view:{...value.view,page:0}}),value=>({...value,view:{...value.view,page:10001}}),
    value=>({...value,view:{...value.view,filter:'arbitrary'}}),value=>({...value,view:{...value.view,query:'x'.repeat(201)}}),
    value=>({...value,view:{...value.view,session:'x'.repeat(201)}}),value=>({...value,view:{...value.view,canEdit:true}}),
    ()=>null,()=>[],()=>({})
  ];
  for(const mutate of cases){const f=fixture(),a=f.create('admin-a');a.remember(view,900031);a.requestReturn(900031);const key=[...f.map.keys()][0];f.map.set(key,JSON.stringify(mutate(JSON.parse(f.map.get(key)))));assert.equal(a.takeReturn(),null);assert.equal(f.map.size,0);}
  for(const raw of ['{','x'.repeat(4097)]){const f=fixture(),a=f.create('admin-a');a.remember(view,900031);f.map.set([...f.map.keys()][0],raw);assert.equal(a.takeReturn(),null);assert.equal(f.map.size,0);}
  const f=fixture(),a=f.create('admin-a');a.remember(view,900031);a.requestReturn(900031);f.advance(2*60*60*1000);assert.equal(a.takeReturn(),null);assert.equal(f.map.size,0);
});
test('unavailable private storage fails without changing navigation or storing authority claims',()=>{
  for(const storage of [()=>undefined,()=>{throw Error('storage disabled');},()=>({setItem(){throw Error('full');},getItem(){throw Error('disabled');}})]){
    const value=createAdminRosterReturn022({storage,principalId:'admin-a',authorized:()=>true});assert.equal(value.remember(view,900031),false);assert.equal(value.requestReturn(900031),false);assert.equal(value.takeReturn(),null);
  }
  const f=fixture(),a=f.create('admin-a');assert.equal(a.remember({...view,role:'ADMIN'},900031),false);assert.equal(f.map.size,0);
});

class Host{
  constructor(){this.innerHTML='';this.listeners=new Map();}
  addEventListener(type,fn){this.listeners.set(type,fn);}removeEventListener(type){this.listeners.delete(type);}
  querySelector(){return null;}contains(){return true;}
  async click(attributes){await this.listeners.get('click')({target:{closest:()=>({disabled:false,hasAttribute:key=>Object.hasOwn(attributes,key),getAttribute:key=>attributes[key]})}});}
}
test('actual roster restores all four fields on its first server read, exposes only presentation fields, and fresh metrics still reset',async()=>{
  const calls=[],host=new Host();
  const controller=mountTimelineAdminWorkspace(host,{initialView:view,authClient:{listAdminStudents:async options=>{
    calls.push(options);return{source:'learndash-course-3893',verifiedAt:'2026-09-07T00:00:00Z',metrics:Object.fromEntries(TIMELINE_ADMIN_METRICS_022.map(x=>[x.id,2])),students:[{wpUserId:900030+options.page,displayName:'Synthetic Roster Student',eligible:true,sessions:['Synthetic Session'],status:'DRAFT',cvStatus:'IMPORTED',documentId:'local-doc',canOpen:true}],sessions:['Synthetic Session'],total:2,page:options.page,pageSize:1};
  }}});
  await controller.ready;assert.deepEqual(calls,[view]);assert.deepEqual(controller.getViewState(),view);
  assert.match(host.innerHTML,/value="synthetic-reviewer@example.invalid"/);assert.match(host.innerHTML,/value="cv_imported" selected/);assert.match(host.innerHTML,/value="Synthetic Session" selected/);assert.match(host.innerHTML,/Page 2 of 2/);
  await host.click({'data-admin022-metric':'guardian_issues'});assert.deepEqual(calls.at(-1),{query:'',filter:'guardian_issues',session:'',page:1});
  assert.deepEqual(controller.getViewState(),calls.at(-1));controller.destroy();
});
