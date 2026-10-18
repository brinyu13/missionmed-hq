import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const runtime=readFileSync(new URL('../../public/source/runtime.js',import.meta.url),'utf8');
const code=runtime.slice(runtime.indexOf('async function boot(){'),runtime.indexOf('const MRX_COMMANDS'));
test('fresh admitted bootstrap precedes cohort; optional details and adjacent prefetch wait for visible cohort',async()=>{
 for(const change of ['',"actor.id='other'",'sessionEpoch++','bootSequence++']){
 const calls=[];let finish;const pending=new Promise(resolve=>finish=resolve);
 const c=vm.createContext({Promise,session:{expiresAt:Date.now()+60000},document:{getElementById:()=>({innerHTML:''}),querySelector:()=>null},location:{search:''},actor:{id:'own'},sessionEpoch:0,bootSequence:0,parseInterviewIQEntry:()=>null,renderPublicCalendarShell:()=>'<div>Public dates</div>',fitCalendarViewport:()=>{},apiFetch:async path=>{calls.push(path);return{};},applyBootstrap:()=>calls.push('admitted'),applyInterviewIQEntry:()=>calls.push('entry'),render:()=>{},completeWorkspace:async()=>calls.push('details'),scheduleCalendarPrefetch:()=>calls.push('adjacent'),warmCalendar:()=>{calls.push('cohort');return pending;},lockWorkspace:message=>{throw Error(message);}});
 vm.runInContext(code,c);await vm.runInContext('boot()',c);assert.deepEqual(calls,['/bootstrap?view=calendar','admitted','cohort','entry']);if(change)vm.runInContext(change,c);finish();await Promise.resolve();await Promise.resolve();assert.equal(calls.includes('details'),!change);assert.equal(calls.includes('adjacent'),!change);
 }
});
