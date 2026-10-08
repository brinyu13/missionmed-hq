import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveGeneralProgram} from '../../public/studio-fable/app/adapters/context-adapter.mjs';
const row=(overrides={})=>({programId:'synthetic-upstate-im',name:'SUNY Upstate Medical University Program',specialty:'Internal Medicine',state:'NY',...overrides});
function account(records,extra={}){
  const calls=[];
  return {calls,mode:'REAL',durable:{ready:true,programs:async query=>(calls.push(query),{records,registryReleaseId:'synthetic-release',totalPages:1,...extra})}};
}
test('default requires authorized exact program/specialty identity and release',async()=>{
  const a=account([row(),row({programId:'synthetic-downstate',name:'SUNY Downstate Program'}),row({programId:'synthetic-surgery',specialty:'Surgery'})]);
  const result=await resolveGeneralProgram(a);
  assert.equal(result.state,'default');assert.equal(result.program.programId,'synthetic-upstate-im');
  assert.equal(result.program.programReleaseId,'synthetic-release');
  assert.deepEqual(a.calls,[{q:'SUNY Upstate',specialty:'Internal Medicine',jurisdiction:'NY',programType:'',page:1}]);
});
test('ambiguous, truncated, wrong-location, missing release and unavailable results never invent a default',async()=>{
  for(const a of [account([row(),row({programId:'another'})]),account([row()],{totalPages:2}),account([row({state:'CA'})]),account([row()],{registryReleaseId:null}),account([])]){
    assert.equal((await resolveGeneralProgram(a)).program,null);
  }
});
test('explicit selection and opt-out win without querying; cancelled response is discarded',async()=>{
  const a=account([row()]),selected={verified:true,programId:'chosen',programReleaseId:'release',name:'Chosen program'};
  assert.equal((await resolveGeneralProgram(a,{selected})).program,selected);
  assert.equal((await resolveGeneralProgram(a,{selected,disabled:true})).program,null);
  assert.equal(a.calls.length,0);
  assert.equal((await resolveGeneralProgram(a,{isCurrent:()=>false})).state,'cancelled');
  await assert.rejects(resolveGeneralProgram({mode:'REAL',durable:{ready:false}}),/Sign in/);
});
