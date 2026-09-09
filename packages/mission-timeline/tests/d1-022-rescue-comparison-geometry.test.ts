import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {analyzeTimelineRescue,acceptedCvCandidatesForRescue} from '../src/intelligence/timeline-rescue-service.js';
import type {RescueVisionObservation,RescueCvCandidate} from '../src/intelligence/timeline-rescue-schema.js';
const {createProductionCvIntakeAdapter}=await import(new URL('../web/js/uxr-002/intake-d1-408-adapter.js',import.meta.url).href);
const {createIntakeState,hydrateIntakeState,renderIntake,openSuggestions,acceptedCvImportReceipt,IntakeStateMachine,applyApprovalBatchToDocument}=await import(new URL('../web/js/uxr-002/intake.js',import.meta.url).href);
const fixtures=JSON.parse(readFileSync(new URL('./fixtures/rescue-022-live-observations.json',import.meta.url),'utf8'));
const png=Buffer.from([137,80,78,71,13,10,26,10]);
const rescue=(observations:RescueVisionObservation[],cv:RescueCvCandidate[]=[])=>analyzeTimelineRescue({filename:'synthetic.png',mimeType:'image/png',bytes:png,visualObservations:observations},cv);
const observed=(key:string)=>structuredClone(fixtures[key].observations) as RescueVisionObservation[];
const expected=[['Doctor of Medicine (MD)','2016-09','2022-06'],['Volunteer','2019-01','2021-12'],['Research Assistant','2021-03','2022-12'],['Resident Physician (PGY-1 equivalent)','2023-01','2024-06'],['Observership','2023-07','2023-08'],['Clinical Elective','2023-10','2023-11'],['USMLE Step 1 - Pass','2022-11',null],['USMLE Step 2 CK - 251','2023-03',null],['Outcomes after early anticoagulation.','2023-01',null]];
const projection=(result:ReturnType<typeof rescue>)=>result.candidates.map(c=>[c.title,c.startDate,c.endDate]).sort((a,b)=>String(a[0]).localeCompare(String(b[0])));
for(const key of ['016','018'])test(`actual ${key} observed regions recover nine exact entries, milestone semantics, YEAR precision and original observations`,()=>{
  const input=observed(key),before=structuredClone(input),result=rescue(input);
  assert.deepEqual(projection(result),[...expected].sort((a,b)=>String(a[0]).localeCompare(String(b[0]))));
  assert.deepEqual(input,before);assert.equal(result.candidates.length,9);
  for(const c of result.candidates){assert.equal(c.openEnded,false);assert.equal(c.reviewState,'REQUIRED');assert.equal(c.safeToAutoAccept,false);assert.ok(c.provenance.length);assert.ok(c.provenance.every(p=>p.support==='VISION_OBSERVATION'));}
  const pub=result.candidates.find(c=>c.title.startsWith('Outcomes'))!;
  assert.equal(pub.timelineKind,'milestone');assert.equal(pub.categoryId,'unclassified');assert.deepEqual(pub.datePrecision,{start:'YEAR',end:null});
  assert.deepEqual(pub.provenance.map(p=>p.sourceText),['2023','Outcomes after\nearly anticoagulation.']);
  assert.doesNotMatch(result.unresolvedQuestions.join(' '),/Confirm dates for.*Step/);
});
const pair=()=>observed('016').filter(o=>['usmle-step-1-date','usmle-step-1'].includes(o.id));
for(const [name,mutate] of [
  ['other page',(rows:RescueVisionObservation[])=>{rows[1]!.pageOrSlide=2;}],
  ['other units',(rows:RescueVisionObservation[])=>{rows[1]!.geometry!.unit='PDF_POINT';}],
  ['overlapping boxes',(rows:RescueVisionObservation[])=>{rows[1]!.geometry!.x=.76;}],
  ['distant label',(rows:RescueVisionObservation[])=>{rows[1]!.geometry!.x=.85;}],
  ['nearby different row',(rows:RescueVisionObservation[])=>{rows[1]!.geometry!.y+=.02;}],
  ['ambiguous second label',(rows:RescueVisionObservation[])=>{rows.push({...structuredClone(rows[1]!),id:'rival',text:'USMLE Step 3 - Pass'});}],
  ['ambiguous second date',(rows:RescueVisionObservation[])=>{rows.push({...structuredClone(rows[0]!),id:'rival-date',text:'10/22'});}],
  ['profile summary',(rows:RescueVisionObservation[])=>{rows[1]!.text='Step 1: Passed';}],
  ['malformed date',(rows:RescueVisionObservation[])=>{rows[0]!.text='13/22';}],
] as const)test(`milestone association rejects ${name}`,()=>{const rows=pair();mutate(rows);assert.equal(rescue(rows).candidates.length,0);});
test('wrapped Step 2 retains only an unambiguous adjacent explicit CK/result line',()=>{
  const base=observed('018').filter(o=>['obs-29','obs-30','obs-31'].includes(o.id));
  assert.equal(rescue(base).candidates[0]!.title,'USMLE Step 2 CK - 251');
  for(const change of ['far','page','ambiguous']){const rows=structuredClone(base);if(change==='far')rows[2]!.geometry!.y+=.1;if(change==='page')rows[2]!.pageOrSlide=2;if(change==='ambiguous')rows.push({...structuredClone(rows[2]!),id:'rival-result',text:'CK - 245'});assert.equal(rescue(rows).candidates[0]!.title,'USMLE Step 2');}
});
function cvFrom(result:ReturnType<typeof rescue>):RescueCvCandidate[]{return result.candidates.map((c,i)=>({id:`cv-${i}`,title:c.title,startDate:c.startDate,endDate:c.endDate,categoryId:({usmle:'exams',res:'research',cl:'clinical',th:'clinical',unclassified:'research'} as Record<string,string>)[c.categoryId]||c.categoryId,provenance:[{sourceExcerpt:c.title}]}));}
test('eight genuine matches and one unclassified publication review replace alias-only conflicts without mutating facts',()=>{
  const input=observed('016'),before=rescue(input),cv=cvFrom(before),result=rescue(input,cv);
  assert.deepEqual(result.candidates,before.candidates);assert.equal(result.reconciliation.filter(r=>r.state==='MATCH').length,8);
  const conflict=result.reconciliation.filter(r=>r.state!=='MATCH');assert.equal(conflict.length,1);assert.equal(conflict[0]!.state,'CATEGORY_CONFLICT');
  assert.match(conflict[0]!.recommendation,/Timeline category: Not established from the Timeline text\. Accepted CV category: Research\./);
});
for(const alias of ['exam','exams','usmle'])test(`known exam alias ${alias} compares without altering native category`,()=>{
  const cv=cvFrom(rescue(pair()));cv[0]!.categoryId=alias;const result=rescue(pair(),cv);assert.equal(result.reconciliation[0]!.state,'MATCH');assert.equal(result.candidates[0]!.categoryId,'usmle');
});
for(const [title,aliases] of [['Research Assistant',['res','research','research_awards']],['Observership',['cl','th','clinical','usce','us_clinical']]] as const)test(`known ${title} aliases agree while unsupported categories still conflict`,()=>{
  const source=rescue(observed('016')),base=cvFrom(source);const target=base.find(c=>c.title===title)!;
  for(const alias of aliases){const cv=structuredClone(base);cv.find(c=>c.id===target.id)!.categoryId=alias;
    const result=rescue(observed('016'),cv);assert.equal(result.reconciliation.find(r=>r.cvCandidateId===target.id)!.state,'MATCH');assert.deepEqual(result.candidates,source.candidates);}
  const cv=structuredClone(base);cv.find(c=>c.id===target.id)!.categoryId='personal';assert.equal(rescue(observed('016'),cv).reconciliation.find(r=>r.cvCandidateId===target.id)!.state,'CATEGORY_CONFLICT');
});
test('actual category/date disagreement includes both values and remains explicit review',()=>{
  const cv=cvFrom(rescue(pair()));cv[0]!.categoryId='research';cv[0]!.startDate='2024-05';
  const r=rescue(pair(),cv).reconciliation[0]!;assert.equal(r.state,'DATE_CONFLICT');assert.match(r.recommendation,/2022-11/);assert.match(r.recommendation,/2024-05/);assert.match(r.recommendation,/Timeline category: Exams\. Accepted CV category: Research/);assert.equal(r.requiresReview,true);
  cv[0]!.startDate='2022-11';cv[0]!.categoryId='UNKNOWN_OTHER';assert.equal(rescue(pair(),cv).reconciliation[0]!.state,'CATEGORY_CONFLICT');
});
test('ambiguous or merely contained titles are not silently reconciled; no CV produces no false CV-only warnings',()=>{
  const cv=cvFrom(rescue(pair()));cv.push({...cv[0]!,id:'second'});assert.deepEqual(rescue(pair(),cv).reconciliation.map(r=>r.state),['TIMELINE_ONLY','CV_ONLY','CV_ONLY']);
  assert.deepEqual(rescue(pair(),[{...cv[0]!,title:'USMLE Step'}]).reconciliation.map(r=>r.state),['TIMELINE_ONLY','CV_ONLY']);
  assert.deepEqual(rescue(pair()).reconciliation,[]);
});
test('API source selection rejects Rescue, untyped, conflicting type, pending and unprovenanced histories',()=>{
  const candidates=cvFrom(rescue(pair()));
  for(const lastImport of [{acceptedCandidates:candidates},{documentType:'TIMELINE_RESCUE',acceptedCandidates:candidates},{documentType:'CV',analysis:{effectiveType:'TIMELINE_RESCUE'},acceptedCandidates:candidates},{documentType:'CV',acceptedCandidates:[{...candidates[0],provenance:[]}]}])assert.deepEqual(acceptedCvCandidatesForRescue({lastImport}),[]);
  assert.deepEqual(acceptedCvCandidatesForRescue({candidates:candidates.map(c=>({...c,decision:'accepted'})),extraction:{parser:{effectiveType:'CV'}}}),[]);
  const old={analysis:{effectiveType:'cv'},acceptedCandidates:candidates};assert.deepEqual(acceptedCvCandidatesForRescue({lastImport:old}),candidates);
  const rescueImport={documentType:'TIMELINE_RESCUE',acceptedCandidates:[{...candidates[0],id:'rescued'}]};
  assert.deepEqual(acceptedCvCandidatesForRescue({lastImport:rescueImport,lastAcceptedCvImport:old}),candidates);
  assert.equal(acceptedCvImportReceipt(rescueImport),null);
  assert.equal(acceptedCvImportReceipt({documentType:'CV',acceptedCandidates:[null]}),null);
  assert.equal(acceptedCvImportReceipt({documentType:'CV',analysis:{effectiveType:'TIMELINE_RESCUE'},acceptedCandidates:candidates}),null);
});
async function mapped(result:ReturnType<typeof rescue>){
  const api={analyzeCv:async()=>{throw new Error('CV route must not run');},signObjectUpload:async()=>({objectId:'synthetic-source',uploadToken:'local-only'}),uploadSignedObject:async()=>{},confirmObjectUpload:async()=>({status:'CONFIRMED'}),rescueTimeline:async()=>({rescue:result,ai:{mode:'SERVER_AI',provider:'invented-without-receipt'}})};
  const file=Object.assign(new Blob([png],{type:'image/png'}),{name:'synthetic.png',timelineRescue:true});
  return createProductionCvIntakeAdapter({apiClient:api,documentId:'synthetic-document'}).extract({file});
}
test('production mapping shows one real review, keeps cleanup as context, and requires category choice for publication',async()=>{
  const source=rescue(observed('016')),result=await mapped(rescue(observed('016'),cvFrom(source)));
  assert.equal(result.qualitySuggestions.length,1);assert.equal(result.qualitySuggestions[0].type,'CATEGORY_REVIEW');
  assert.equal(result.parser.cleanupProposal.actions.length,12);assert.equal(result.parser.reconciliation.length,9);
  assert.equal(result.parser.intelligenceMode,'TIMELINE_RESCUE','No provider receipt means no AI review label');
  const state=createIntakeState({candidates:result.candidates,suggestions:result.qualitySuggestions});state.stage='review';state.detectedType='TIMELINE_RESCUE';state.extraction.parser=result.parser;
  const before=structuredClone(state),html=renderIntake(state);assert.match(html,/8 of 9 Timeline entries match/);assert.match(html,/1 thing we noticed/);assert.doesNotMatch(html,/Label too long|Line we did not use/);assert.match(html,/What will be rebuilt/);assert.deepEqual(state,before);
  const pub=state.candidates.find((c:any)=>c.title.startsWith('Outcomes'));assert.equal(pub.categoryId,'');assert.equal(pub.eventType,'milestone');assert.equal(pub.openEnded,false);assert.deepEqual(pub.fields.datePrecision,{start:'YEAR',end:null});
});
test('legacy persisted cleanup and MATCH warnings become context; unrelated readability and real conflicts remain',async()=>{
  const source=rescue(observed('016'),cvFrom(rescue(observed('016')))),result=await mapped(source);
  const state=createIntakeState({candidates:result.candidates});state.stage='review';state.detectedType='TIMELINE_RESCUE';state.extraction.parser=result.parser;
  state.suggestions=[...source.cleanupProposal.actions.map(a=>({id:a.id,type:'LABEL_READABILITY',status:'open',severity:'REVIEW',candidateIds:a.candidateIds})),...source.reconciliation.map(r=>({id:`rescue-reconcile-${r.timelineCandidateId||'none'}-${r.cvCandidateId||'none'}-${r.state}`,type:r.state==='MATCH'?'SOURCE_ITEM_NOT_INCLUDED':'CATEGORY_REVIEW',status:'open',severity:r.state==='MATCH'?'INFO':'REVIEW',candidateIds:[r.timelineCandidateId]})),{id:'actual-long-label',type:'LABEL_READABILITY',status:'open',severity:'REVIEW',candidateIds:[]}];
  const before=structuredClone(state);assert.equal(openSuggestions(state).length,2);assert.match(renderIntake(state),/2 things we noticed/);assert.match(renderIntake(state),/actual-long-label/);assert.deepEqual(state,before);
});
test('no accepted CV is stated honestly and a genuine collision proposal still appears for review',async()=>{
  const source=rescue(pair());source.cleanupProposal.actions.push({id:'actual-collision',kind:'RESOLVE_LAYOUT_COLLISION',scope:'PRESENTATION_ONLY',reason:'Two visible labels overlap.',candidateIds:[source.candidates[0]!.id],requiresReview:true,changesBiography:false});
  const result=await mapped(source);assert.equal(result.qualitySuggestions.length,1);assert.equal(result.qualitySuggestions[0].type,'VISUAL_OVERLAP');
  const state=createIntakeState({candidates:result.candidates,suggestions:result.qualitySuggestions});state.stage='review';state.detectedType='TIMELINE_RESCUE';state.extraction.parser=result.parser;
  const html=renderIntake(state);assert.match(html,/No accepted CV comparison is available/);assert.match(html,/actual-collision/);assert.doesNotMatch(html,/Source facts agree|Line we did not use|0 of.*match/);
});
test('source comparison names and both-value recommendations remain escaped HTML',async()=>{
  const source=rescue(pair(),cvFrom(rescue(pair()))),result=await mapped(source);
  const state=createIntakeState({candidates:result.candidates});state.stage='review';state.detectedType='TIMELINE_RESCUE';state.extraction.parser=result.parser;state.candidates[0].title='<img src=x onerror=alert(1)>';
  assert.doesNotMatch(renderIntake(state),/<img src=x/);assert.match(renderIntake(state),/&lt;img src=x/);
});
test('successful CV then Rescue apply keeps a distinct CV receipt through DONE, reset, reload and another Rescue; failure records no import',async()=>{
  const candidate={id:'cv-source',title:'Research Fellow',categoryId:'research',startDate:'2020-01',endDate:'2021-01',eventType:'duration',decision:'accepted',provenance:[{sourceExcerpt:'Research Fellow 2020-2021'}]};
  const state=createIntakeState({candidates:[candidate]});state.stage='review';state.detectedType='CV';state.extraction.parser={effectiveType:'CV',analysisId:'real-cv-analysis'};
  let doc:any={events:[],intake:state};const machine=new IntakeStateMachine({initialState:state,narrationDelay:null});
  const apply=async(batch:any)=>applyApprovalBatchToDocument(doc,batch);
  await machine.approveAccepted({saveVersion:async()=>{},applyBatch:apply});
  doc.intake=machine.snapshot();assert.equal(doc.intake.lastImport.documentType,'CV');assert.equal(doc.intake.lastAcceptedCvImport.analysis.analysisId,'real-cv-analysis');
  const cvReceipt=structuredClone(doc.intake.lastAcceptedCvImport);machine.resetUpload();assert.deepEqual(machine.snapshot().lastAcceptedCvImport,cvReceipt);assert.equal(machine.snapshot().candidates.length,0);
  const rescued=hydrateIntakeState({...machine.snapshot(),stage:'review',detectedType:'TIMELINE_RESCUE',extraction:{parser:{effectiveType:'TIMELINE_RESCUE'}},candidates:[{...candidate,id:'rescued',title:'Other source role'}]});
  const second=new IntakeStateMachine({initialState:rescued,narrationDelay:null});doc.intake=rescued;
  await second.approveAccepted({saveVersion:async()=>{},applyBatch:apply});doc.intake=second.snapshot();
  assert.equal(doc.intake.lastImport.documentType,'TIMELINE_RESCUE');assert.deepEqual(doc.intake.lastAcceptedCvImport,cvReceipt);
  assert.deepEqual(acceptedCvCandidatesForRescue(doc.intake),acceptedCvCandidatesForRescue({lastImport:cvReceipt}));
  const third=new IntakeStateMachine({initialState:hydrateIntakeState(doc.intake),narrationDelay:null});third.resetUpload();assert.deepEqual(third.snapshot().lastAcceptedCvImport,cvReceipt);
  const failed=new IntakeStateMachine({initialState:state,narrationDelay:null});await assert.rejects(failed.approveAccepted({saveVersion:async()=>{},applyBatch:async()=>{throw new Error('save failed');}}));assert.equal(failed.snapshot().lastImport,undefined);assert.equal(failed.snapshot().lastAcceptedCvImport,null);
});
test('actual production persistence seam retains only applied CV history across a reset and does not copy candidates/lastImport',()=>{
  const text=readFileSync(new URL('../web/js/407f-engineering-adapter.js',import.meta.url),'utf8');const a=text.indexOf('export function persistedIntakeState('),b=text.indexOf('\nfunction currentMonth()',a);
  const context=vm.createContext({clone:structuredClone});vm.runInContext(text.slice(a,b).replace('export function','function')+';globalThis.persist=persistedIntakeState;',context);
  const prior={lastAcceptedCvImport:{documentType:'CV',acceptedCandidates:cvFrom(rescue(pair()))},lastImport:{documentType:'TIMELINE_RESCUE'},candidates:[{id:'stale'}]};const next=context.persist({stage:'upload',candidates:[]},prior);
  assert.deepEqual(next.lastAcceptedCvImport,prior.lastAcceptedCvImport);assert.equal(next.lastImport,undefined);assert.deepEqual(next.candidates,[]);next.lastAcceptedCvImport.acceptedCandidates[0].title='changed';assert.notEqual(prior.lastAcceptedCvImport.acceptedCandidates[0]!.title,'changed');
});
