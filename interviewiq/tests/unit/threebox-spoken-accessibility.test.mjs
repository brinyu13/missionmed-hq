import test from 'node:test';
import assert from 'node:assert/strict';
import {spokenDetail,assembleThreebox} from '../../server/threebox.mjs';

test('accessibility wording preserves assertions, negation and limitations without narrator metadata',()=>{
 const value={signal:'STRONG: The official application accepts COMLEX scores; however the complete current roster is unresolved.'};const before=JSON.stringify(value);const e={field:'research.do_accessibility',value};
 assert.equal(spokenDetail(e),'The official application accepts COMLEX scores; however the complete current roster is unresolved.');
 const r={general:{category:'Program-specific opportunity'},details:[{field:e.field,claimRef:'claim1'}],personal:{enabled:false,text:''},selected:true,rank:1};
 const a=assembleThreebox({name:'Synthetic program'},[r],[{...e,claimRef:'claim1'}]);for(const text of [a.standard,a.concise,a.bullets]){assert.match(text,/however the complete current roster is unresolved/);assert.doesNotMatch(text,/signal:|STRONG:|source url:/);}
 assert.equal(JSON.stringify(value),before);
 assert.equal(spokenDetail({...e,value:{signal:'MODERATE: Does not require USCE; current screening rules are unknown.'}}),'Does not require USCE; current screening rules are unknown.');
 assert.equal(spokenDetail({...e,value:{signal:'STRONG claim with no prefix'}}),'STRONG claim with no prefix');
});
test('malformed accessibility cannot become an assembled unsupported assertion',()=>{
 for(const value of [null,[],{}, {signal:null},{signal:''},{signal:'MODERATE:'},{signal:'WEAK:   '},{signal:'STRONG:'},{signal:'Claim',private_note:'extra'},Object.assign(Object.create({signal:'Inherited assertion'}),{other:'key'})])assert.throws(()=>spokenDetail({field:'research.do_accessibility',value}),{code:'threebox_rendering_review_required'});
 assert.equal(spokenDetail({field:'research.curriculum',value:'Ward and clinic rotations'}),'Ward and clinic rotations');
});
