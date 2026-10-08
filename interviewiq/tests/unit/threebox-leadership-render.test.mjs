import test from 'node:test';
import assert from 'node:assert/strict';
import {assembleThreebox,spokenDetail,detailText,checkThreebox} from '../../server/threebox.mjs';
import {digest} from '../../server/validation.mjs';

// Synthetic public-shaped fixture; no production receipt, owner or interview data.
const program={id:'synthetic-program',name:'Synthetic Leadership Program',track:''};
const leadership={field:'research.leadership',claimRef:'synthetic-leadership',selectionHash:'a'.repeat(64),state:'SUPPORTED',value:[
  {name:'Director Example, MD',role:'Program Director, Internal Medicine Residency',source_url:null,credentials:null},
  {name:'Associate Example, DO',role:'Associate Program Director; Director of Student Programs',source_url:null,credentials:null},
  {name:'Chief Example, MD',role:'Section Chief, Cardiology',source_url:null,credentials:null}
]};
const reason={id:'00000000-0000-4000-8000-000000000001',general:{category:'Faculty / leadership'},details:[{field:leadership.field,claimRef:leadership.claimRef,selectionHash:leadership.selectionHash}],personal:{enabled:true,confirmed:true,text:'For this synthetic QA answer, I value being able to identify program leadership before an interview.'},selected:true,rank:1,followUpDefense:'Ask about the published leadership roles.',intel:[]};

test('all answer forms and deliveries summarize exact PD/APD roles without raw metadata or mutating evidence',()=>{
  const before=JSON.stringify({program,reason,leadership}),hash=digest(leadership);
  for(const delivery of ['STANDARD','CONCISE','DETAIL_ORIENTED','RELATIONSHIP','RESEARCH']){
    const answer=assembleThreebox(program,[reason],[leadership],delivery);
    for(const form of ['standard','concise','bullets']){
      assert.match(answer[form],/Director Example, MD as Program Director/);
      assert.match(answer[form],/listed Associate Program Director is Associate Example, DO/);
      assert.match(answer[form],/synthetic QA answer/);
      assert.doesNotMatch(answer[form],/Chief Example|source url:|credentials:|name:|role:|null|mentor/);
    }
  }
  assert.equal(JSON.stringify({program,reason,leadership}),before);assert.equal(digest(leadership),hash);
  assert.equal(checkThreebox([reason],[leadership],{factualConfirmed:true,specificityConfirmed:true}).ready,true);
});
test('all matching names are kept, including multiple directors or associates with no director',()=>{
  const text=spokenDetail({...leadership,value:[{name:'One',role:'Program Director'},{name:'Two',role:'Program Director'},{name:'Three',role:'Associate Program Director'},{name:'Four',role:'Associate Program Director'}]});
  assert.equal(text,'The program lists One and Two as Program Directors; the listed Associate Program Directors are Three and Four');
  assert.equal(spokenDetail({...leadership,value:[{name:'Associate Only',role:'Associate Program Director'}]}),'The program lists Associate Only as Associate Program Director');
});
test('absent, malformed, unrecognized or duplicate leadership requires review without guessing roles',()=>{
  for(const value of [null,[],{},[{name:'Chief',role:'Section Chief'}],[{name:'Former',role:'Former Program Director'}],[{name:'Named',role:null}],[{name:null,role:'Program Director'}],[{name:'Same',role:'Program Director'},{name:'Same',role:'Associate Program Director'}]]){
    assert.throws(()=>spokenDetail({...leadership,value}),{code:'threebox_rendering_review_required'});
    assert.throws(()=>assembleThreebox(program,[reason],[{...leadership,value}]),{code:'threebox_rendering_review_required'});
  }
});
test('other evidence fields keep the existing generic formatter and supported selection gate',()=>{
  for(const value of ['Published curriculum',7,true,null,['One','Two'],{signal:'Official page accepts COMLEX scores.',extra:null}])assert.equal(spokenDetail({field:'research.other',value}),detailText(value));
  for(const state of ['STALE','UNKNOWN','CONFLICTED','WEAK'])assert.equal(checkThreebox([reason],[{...leadership,state}],{factualConfirmed:true,specificityConfirmed:true}).ready,false);
  assert.equal(checkThreebox([{...reason,details:[{...reason.details[0],selectionHash:'b'.repeat(64)}]}],[leadership],{factualConfirmed:true,specificityConfirmed:true}).ready,false);
});
