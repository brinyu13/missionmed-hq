import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {MYERAS_SOURCE_SCHEMA,createMyerasIntakeAdapter,normalizeMyerasSources} from '../web/js/uxr-002/myeras-intake-adapter.js';
import {IntakeStateMachine,installIntake,renderIntake} from '../web/js/uxr-002/intake.js';
import {installMyerasIntakeUi,myerasUploadMarkup,myerasReviewMarkup,myerasEntryMarkup} from '../web/js/uxr-002/myeras-intake-ui.js';
const sources={schemaVersion:MYERAS_SOURCE_SCHEMA,sources:[{id:'section',kind:'MYERAS_SECTION',label:'Synthetic profile',profile:{fullName:'Synthetic Person'},entries:[]}]};
test('actual engineering seam installs Builder entry, wrapped adapter and review on the existing machine',async()=>{
  const shell=await readFile(new URL('../web/js/407f-engineering-adapter.js',import.meta.url),'utf8');assert.match(shell,/createMyerasIntakeAdapter\(\{fallbackAdapter:documentIntakeAdapter/);assert.match(shell,/existingProfile:\(\)=>clone\(store.document.studentProfile/);assert.match(shell,/myerasReviewMarkup\(state\)/);assert.match(shell,/builderEntry.insertAdjacentHTML\("afterend",myerasEntryMarkup\(\)\)/);assert.match(shell,/installMyerasIntakeUi\(document,intakeMachine/);assert.match(shell,/cleanupMyeras\(\);cleanupDocumentIntake\(\)/);
  assert.match(myerasEntryMarkup(),/data-myeras-open/);assert.match(myerasUploadMarkup(),/data-myeras-file/);assert.match(myerasUploadMarkup(),/on this device/);
});
test('local paste requires consent and enters profile review without automatically approving',async()=>{
  const handlers=new Map(),errors=[];let consent=false;const machine=new IntakeStateMachine({adapter:createMyerasIntakeAdapter(),narrationDelay:null});
  const form={querySelector:selector=>selector==='[data-myeras-consent]'?{checked:consent}:selector==='[data-myeras-json]'?{value:JSON.stringify(sources)}:null};
  const button={closest:()=>form};const root={addEventListener:(name,fn)=>handlers.set(name,fn),removeEventListener:name=>handlers.delete(name),querySelector:()=>({textContent:''})};const cleanup=installMyerasIntakeUi(root,machine,{onError:error=>errors.push(error.message)});
  const event={target:{closest:selector=>selector==='[data-myeras-read]'?button:null}};await handlers.get('click')(event);assert.match(errors[0],/Consent/);assert.equal(machine.state.file,null);
  consent=true;await handlers.get('click')(event);assert.equal(machine.state.stage,'review');assert.equal(machine.state.file.name,'myeras-sources.json');assert.equal(machine.state.extraction.parser.myerasProfileReview.claims[0].decision,'undecided');cleanup();assert.equal(handlers.size,0);
});
test('profile source choices and per-field audience are actionable through installed UI',async()=>{
  const result=normalizeMyerasSources(sources),machine=new IntakeStateMachine();machine.dispatch({type:'EXTRACTION_SUCCEEDED',...result});const handlers=new Map();const root={addEventListener:(name,fn)=>handlers.set(name,fn),removeEventListener:()=>{},querySelector:()=>null};installMyerasIntakeUi(root,machine);
  const button={dataset:{myerasCandidate:'profile:fullName',myerasResolve:'profile:fullName',myerasChoice:'0',myerasProfile:'true'},closest:()=>({querySelector:()=>null})};await handlers.get('click')({target:{closest:selector=>selector==='[data-myeras-resolve]'?button:null}});
  handlers.get('change')({target:{matches:selector=>selector==='[data-myeras-profile-audience]',dataset:{myerasProfileAudience:'profile:fullName'},value:'INTERVIEWER_SAFE'}});
  const accept={dataset:{myerasClaim:'profile:fullName',myerasProfileDecision:'accepted'}};await handlers.get('click')({target:{closest:selector=>selector==='[data-myeras-profile-decision]'?accept:null}});const claim=machine.state.extraction.parser.myerasProfileReview.claims[0];assert.equal(claim.decision,'accepted');assert.equal(claim.visibilityState,'INTERVIEWER_SAFE');assert.equal(claim.resolution.value,'Synthetic Person');
});
test('review escapes untrusted evidence and exposes source-specific conflict controls',()=>{
  const result=normalizeMyerasSources({schemaVersion:MYERAS_SOURCE_SCHEMA,sources:[{id:'cv',kind:'CV',label:'Synthetic CV',entries:[{id:'one',recordKey:'shared',categoryId:'work',title:'<img src=x onerror=alert(1)>',institution:'Synthetic Hospital',startDate:'2022-01',endDate:'2022-05'}]},{id:'section',kind:'MYERAS_SECTION',label:'Synthetic section',entries:[{id:'two',recordKey:'shared',categoryId:'work',title:'Other source title',institution:'Synthetic Hospital',startDate:'2022-02',endDate:'2022-05'}]}]});
  const machine=new IntakeStateMachine();machine.dispatch({type:'EXTRACTION_SUCCEEDED',...result});const html=myerasReviewMarkup(machine.snapshot());assert.match(html,/data-myeras-choice="0"/);assert.match(html,/data-myeras-correction/);assert.doesNotMatch(html,/<img src=x/);assert.match(html,/&lt;img/);assert.match(html,/Original source values remain/);
});

 test('blocked candidate acceptance reaches the visible error callback and does not claim source review is clear',async()=>{
  const result=normalizeMyerasSources({schemaVersion:MYERAS_SOURCE_SCHEMA,sources:[{id:'cv',kind:'CV',label:'Synthetic CV',entries:[{recordKey:'shared',title:'Synthetic role',categoryId:'work',startDate:'2022-01',endDate:'2022-05'}]},{id:'section',kind:'MYERAS_SECTION',label:'Synthetic section',entries:[{recordKey:'shared',title:'Synthetic role',categoryId:'work',startDate:'2022-02',endDate:'2022-05'}]}]});const machine=new IntakeStateMachine();machine.dispatch({type:'EXTRACTION_SUCCEEDED',...result});const handlers=new Map(),errors=[];const root={addEventListener:(name,fn)=>handlers.set(name,fn),removeEventListener:()=>{}};const cleanup=installIntake(root,machine,{onError:error=>errors.push(error.message)});
  const button={dataset:{candidateId:machine.state.candidates[0].id,candidateAction:'accepted'},closest:()=>null};await handlers.get('click')({target:{closest:selector=>selector==='[data-candidate-action]'?button:null}});assert.match(errors[0],/source conflicts/);assert.equal(machine.state.candidates[0].decision,'undecided');assert.doesNotMatch(renderIntake(machine.state),/found nothing to flag|already answers everything/);cleanup();
 });

 test('clinical expanded review omits unrelated blank fields and uses understandable source names',()=>{
  const result=normalizeMyerasSources({schemaVersion:MYERAS_SOURCE_SCHEMA,sources:[{id:'src1',kind:'CV',label:'MyERAS CV',entries:[{recordKey:'shared',title:'Synthetic rotation',categoryId:'clinical',institution:'Synthetic Hospital',startDate:'2022-01',endDate:'2022-05'}]},{id:'src2',kind:'MYERAS_SECTION',label:'MyERAS',entries:[{recordKey:'shared',section:'Experiences',title:'Synthetic rotation',categoryId:'clinical',institution:'Synthetic Hospital',startDate:'2022-02',endDate:'2022-05'}]}]});const machine=new IntakeStateMachine();machine.dispatch({type:'EXTRACTION_SUCCEEDED',...result});machine.toggleEdit(machine.state.candidates[0].id);const html=renderIntake(machine.state);assert.doesNotMatch(html,/data-candidate-extra="(?:examSystem|examName|result|score|medicalSchoolCountry|degree|role|stillWorking|ongoing|sourceDescription)"/);assert.match(myerasReviewMarkup(machine.state),/MyERAS → Experiences/);assert.match(myerasReviewMarkup(machine.state),/MyERAS CV/);
 });
