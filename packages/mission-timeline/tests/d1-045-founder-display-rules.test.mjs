import test from 'node:test';
import assert from 'node:assert/strict';
import {computeFounderCategoryKey,setFounderCategoryKey,resetFounderCategoryKey,setFounderEventDisplay,deriveFounderEventDisplay,projectFounderDisplayEvents,founderInstitutionLabel,FOUNDER_DISPLAY_CATEGORY_ROWS} from '../web/js/presentation/founder-display-rules.js';
import {buildFounderPresentationScene,serializeFounderPresentation,assertCompleteFounderPresentation,founderMilestoneTemplateGeometry} from '../web/js/presentation/founder-presentation-serializer.js';
import {resolveFounderPresentationSvg,materialPresentationCollisions,founderPaintCollisionParts} from '../web/js/presentation/resolved-founder-presentation.js';
import {locked407FMilestoneGeometry,composeLocked407FPortableSvg,locked407FInstitutionFurnitureMinimumX} from '../web/js/uxr-002/locked-407f-export.js';
import {applySceneCommandToDocument} from '../web/js/editor/scene-commands.js';
import {advancedEventCreation407F,applySceneCommandToDocument as applyHumanEventCommand407F} from '../web/js/407f-engineering-adapter.js';
const event=(id,extra={})=>({id,title:'Role',siteName:'Synthetic Institution',categoryId:'work',eventType:'duration',startDate:'2020-01',endDate:'2020-12',visibilityState:'INTERVIEWER_SAFE',provenance:[{sourceExcerpt:'Synthetic accepted record'}],...extra});
const doc=events=>({id:'synthetic-display-rules',revision:1,studentProfile:{fullName:'Synthetic Applicant'},events,mediaItems:[],exams:[],advanced:{media:[],textBlocks:[],elements:[],groups:[]}});
const render=d=>serializeFounderPresentation(d,{currentMonth:'2026-10'});
const paint=r=>resolveFounderPresentationSvg(r.svg);

test('positive top-band eligibility excludes ordinary CV milestones with exact retained sources',()=>{
 const d=doc([
  ...[['pub','PUBLICATION','Research publication'],['award','AWARD_HONOR','Recognition award'],['bs','GRADUATION','Bachelor of Science degree'],['cert','CERTIFICATION','Ordinary training certificate'],['unknown','UNKNOWN','Unclassified CV record']].map(([id,canonicalType,title])=>event(id,{title,categoryId:'education',eventType:'milestone',endDate:null,fields:{canonicalType}})),
  event('medical',{title:'Medical degree completed',categoryId:'education',eventType:'milestone',endDate:null,fields:{canonicalType:'MEDICAL_DEGREE'}}),
  event('life',{title:'Moved to United States',categoryId:'personal',eventType:'milestone',endDate:null}),
  event('generic-personal',{title:'Ordinary personal CV record',categoryId:'personal',eventType:'milestone',endDate:null})
 ]),before=JSON.stringify(d),r=render(d);
 assert.deepEqual(r.scene.flags.map(flag=>flag.id),['medical','life']);
 for(const excluded of r.scene.presentationAccounting.excludedEvents)assert.deepEqual(excluded.source,d.events.find(event=>event.id===excluded.eventId));
 assert.equal(r.scene.presentationAccounting.excludedEvents.length,6);assert.equal(JSON.stringify(d),before);
 assert.doesNotThrow(()=>assertCompleteFounderPresentation(r));
 r.scene.presentationAccounting.excludedEvents[0].source.siteName='Changed';assert.throws(()=>assertCompleteFounderPresentation(r),e=>e.code==='TIMELINE_EXPORT_MISSING_FIELDS');
});

test('custom milestone opt-in is explicit, editable and requires a true single date',()=>{
 const original=doc([event('custom',{eventType:'milestone',endDate:null}),event('range')]);
 const d=setFounderEventDisplay(original,'custom',{showAsMilestone:true,label:'Custom life event'});
 const selection=projectFounderDisplayEvents(d);assert.equal(selection.events.find(event=>event.id==='custom').display.label,'Custom life event');
 const ranged={...d,events:[event('custom',{eventType:'milestone'})]};assert.equal(projectFounderDisplayEvents(ranged).events.length,0);
 assert.equal(original.presentationOverrides,undefined);assert.deepEqual(d.events,original.events);
 const r=render(d);assert.ok(r.svg.includes('Custom life event'));assert.doesNotThrow(()=>assertCompleteFounderPresentation(r));
});

test('known exact aliases and verified short names are conservative; unknown names stay complete',()=>{
 assert.equal(founderInstitutionLabel('State University of New York Upstate Medical University'),'SUNY Upstate');
 assert.equal(founderInstitutionLabel('University of Wisconsin'),'U of Wisconsin');
 assert.equal(founderInstitutionLabel('University of Pittsburgh Medical Center'),'UPMC');
 assert.equal(founderInstitutionLabel('University of California Los Angeles'),'UCLA');
 assert.equal(founderInstitutionLabel('University of Southern California'),'USC');
 assert.equal(founderInstitutionLabel('University of South Carolina'),'University of South Carolina');
 assert.equal(founderInstitutionLabel('Unknown Academic Organization'),'Unknown Academic Organization');
 assert.equal(founderInstitutionLabel('Saint Synthetic University Medical Center',{compact:true}),'St. Synthetic U Med Ctr');
 const d=doc([]);assert.equal(deriveFounderEventDisplay(d,event('verified',{fields:{displayInstitution:'Verified supplied alias'}})).institution,'Verified supplied alias');
 assert.equal(deriveFounderEventDisplay(d,event('unknown')).institution,'Synthetic Institution');
});

test('location uses supplied US city/state or non-US country without inventing geography',()=>{
 const d=doc([]);assert.equal(deriveFounderEventDisplay(d,event('us',{fields:{country:'United States',cityState:'Synthetic City, NY'}})).location,'Synthetic City, NY');
 assert.equal(deriveFounderEventDisplay(d,event('outside',{fields:{country:'India',cityState:'Synthetic City'}})).location,'India');
 assert.equal(deriveFounderEventDisplay(d,event('unknown',{location:'Supplied uncertain location'})).location,'Supplied uncertain location');
 assert.equal(deriveFounderEventDisplay(d,event('absent')).location,'');
});

test('used-only key unifies legacy USCE, includes explicit Volunteer and never changes source categories',()=>{
 const d=doc([event('hospital',{categoryId:'clinical'}),event('volunteer',{fields:{canonicalType:'VOLUNTEER_EXPERIENCE',programName:'Supplied service program'}})]);
 d.presentationOverrides={categoryKey:[{id:'clinical-hospital',label:'USCE: Teaching Hosp',color:'#DF6A0F'},{id:'clinical-clinic',label:'USCE: Clinics',color:'#F49018'}]};
 const before=JSON.stringify(d),rows=computeFounderCategoryKey(d);
 assert.deepEqual(rows.map(row=>row.id),['clinical','volunteer']);assert.equal(rows[0].label,'USCE');assert.equal(rows[0].color,'#DF6A0F');
 assert.equal(deriveFounderEventDisplay(d,d.events[1]).role,'Supplied service program');
 assert.equal(deriveFounderEventDisplay(d,event('paid',{title:'Clinical work'})).categoryId,'work');
 assert.equal(JSON.stringify(d),before);
});

test('key and display edit/reset APIs are immutable and reject removal of used categories',()=>{
 const original=doc([event('a')]),before=JSON.stringify(original);
 assert.throws(()=>setFounderCategoryKey(original,[]),e=>e.code==='FOUNDER_DISPLAY_CATEGORY_IN_USE');
 const rows=[...FOUNDER_DISPLAY_CATEGORY_ROWS,{id:'custom-category',label:'Custom Category',color:'#123456'}];
 const keyed=setFounderCategoryKey(original,rows),edited=setFounderEventDisplay(keyed,'a',{role:'Edited role',institution:'Edited institution',location:'Edited place',categoryId:'custom-category'});
 assert.deepEqual(edited.events,original.events);assert.deepEqual(computeFounderCategoryKey(edited).map(row=>row.id),['custom-category']);
 assert.deepEqual(computeFounderCategoryKey(resetFounderCategoryKey(edited)).map(row=>row.id),['work']);
 assert.equal(setFounderEventDisplay(edited,'a',{role:null}).presentationOverrides.events.a.role,undefined);
 assert.throws(()=>setFounderEventDisplay(original,'a',{categoryId:'unknown'}),e=>e.code==='FOUNDER_DISPLAY_CATEGORY_NOT_FOUND');assert.equal(JSON.stringify(original),before);
});

test('known Research Associate default abbreviation preserves exact source and student display ownership',()=>{
 const d=doc([event('associate',{title:'Research Associate',categoryId:'work'})]),before=JSON.stringify(d);
 assert.equal(deriveFounderEventDisplay(d,d.events[0]).role,'Research Assoc.');assert.equal(JSON.stringify(d),before);
 const edited=setFounderEventDisplay(d,'associate',{role:'Student chosen role'});assert.equal(deriveFounderEventDisplay(edited,edited.events[0]).role,'Student chosen role');assert.deepEqual(edited.events,d.events);
 assert.equal(deriveFounderEventDisplay(d,{...d.events[0],title:'Unclassified Research Associate Position'}).role,'Unclassified Research Associate Position');
});

test('duration group keeps institution LEFT, close date ABOVE, concise role INSIDE, location BELOW at native type',()=>{
 const d=doc([event('earlier',{siteName:'University of Wisconsin',location:'Synthetic City, WI'}),event('later',{title:'Internal Medicine Extern',categoryId:'clinical',startDate:'2023-01',endDate:'2023-12',siteName:'University of Pittsburgh Medical Center',location:'Synthetic City, PA'})]);
 const before=JSON.stringify(d),r=render(d),nodes=paint(r).nodes;
 for(const arrow of r.scene.arrows){
  const group=nodes.filter(node=>node.semanticRef===arrow.id),body=group.find(node=>node.sourceAttributes['data-continuous-duration-arrow']),site=group.find(node=>node.sourceAttributes['data-board-ink-role']==='site'),date=group.find(node=>node.sourceAttributes['data-board-ink-role']==='caption'),role=group.find(node=>node.sourceAttributes['data-board-ink-role']==='inside-arrow'),location=group.find(node=>node.sourceAttributes['data-board-ink-role']==='location');
  assert.ok(site.bounds.x+site.bounds.width<body.bounds.x-4);assert.ok(date.bounds.y+date.bounds.height<body.bounds.y);assert.ok(body.bounds.y-date.bounds.y-date.bounds.height<20);
  assert.ok(role.bounds.x>=body.bounds.x&&role.bounds.x+role.bounds.width<=body.bounds.x+body.bounds.width);assert.ok(location.bounds.y>body.bounds.y+body.bounds.height);
  assert.equal(site.fontSize,19);for(const node of [date,role,location])assert.equal(node.fontSize,18);
 }
 assert.deepEqual(r.scene.chronologyOrder.violations,[]);assert.equal(materialPresentationCollisions(paint(r)).filter(collision=>collision.elements.some(id=>r.scene.arrows.some(arrow=>arrow.id===id))).length,0);
 assert.doesNotThrow(()=>assertCompleteFounderPresentation(r));assert.equal(JSON.stringify(d),before);assert.equal(render(d).svg,r.svg);
 const edited=setFounderEventDisplay(d,'later',{role:'Edited',institution:'Edited institution'});assert.doesNotThrow(()=>assertCompleteFounderPresentation(render(edited)));assert.deepEqual(edited.events,d.events);
});

test('authored arrow geometry moves complete display groups without moving source dates or reverting labels',()=>{
 const d=doc([event('moved',{siteName:'University of Wisconsin',location:'Synthetic City, WI'})]);
 const geometry={x:500,y:400,width:400,height:44,rotation:0};
 const owned=applySceneCommandToDocument(d,{kind:'geometry',target:{type:'event',id:'moved'},geometry,create:{type:'event',semanticRef:'moved',presentation:{eventType:'duration'}}}).document;
 const r=render(owned),nodes=paint(r).nodes.filter(node=>node.semanticRef==='moved'),body=nodes.find(node=>node.sourceAttributes['data-continuous-duration-arrow']),site=nodes.find(node=>node.sourceAttributes['data-board-ink-role']==='site');
 assert.equal(body.bounds.x,500);assert.ok(site.bounds.x+site.bounds.width<500);assert.ok(nodes.some(node=>node.sourceAttributes['data-board-ink-role']==='inside-arrow'));assert.deepEqual(owned.events,d.events);assert.equal(owned.advanced.scene.objects.find(object=>object.semanticRef==='moved').geometry.y,400);
});

test('structural abbreviation is an allowed visible projection and missing display ink still blocks export',()=>{
 const d=doc([event('long',{siteName:'Saint Synthetic University Medical Center'})]),r=render(d);
 assert.ok(r.svg.includes('St. Synthetic U Med Ctr')||r.svg.includes('Saint Synthetic University Medical Center'));assert.doesNotThrow(()=>assertCompleteFounderPresentation(r));
 r.svg=r.svg.replace(/>Role</g,'><');assert.throws(()=>assertCompleteFounderPresentation(r),e=>e.code==='TIMELINE_EXPORT_MISSING_FIELDS');
});

test('general milestones retain native dark-gray pennants and USA entry uses the native US asset',()=>{
 const d=doc([event('degree',{title:'Medical degree',categoryId:'education',eventType:'milestone',endDate:null}),event('usa',{title:'Moved to United States',categoryId:'personal',eventType:'milestone',startDate:'2023-06',endDate:null})]),r=render(d);
 assert.ok(r.svg.includes('fill="#5B6168"'));assert.ok(paint(r).nodes.some(node=>node.kind==='image'&&node.sourceAttributes['data-founder-usa-flag-asset-sha256']));
 const geometry=locked407FMilestoneGeometry(r.scene,'degree');assert.equal(geometry.width,50);assert.equal(geometry.height,64);
 for(const milestone of founderMilestoneTemplateGeometry(r.scene,paint(r)))assert.equal(milestone.poleFootY,125);
});

test('local TEST study events are restricted to explicitly marked loopback prototypes',()=>{
 const d=doc([event('test',{sourceType:'local-test-study',categoryId:'exams',fields:{localTestOnly:true}})]);d.metadata={localTestPrototype:true};
 const old=globalThis.location;try{
  globalThis.location={protocol:'https:',hostname:'example.com'};assert.equal(projectFounderDisplayEvents(d).events.length,0);
  globalThis.location={protocol:'http:',hostname:'127.0.0.1'};assert.equal(projectFounderDisplayEvents(d).events.length,1);assert.ok(render(d).svg.includes('LOCAL TEST'));
  d.metadata.localTestPrototype=false;assert.equal(projectFounderDisplayEvents(d).events.length,0);
 }finally{if(old===undefined)delete globalThis.location;else globalThis.location=old;}
});

test('canonical intake endpoints retain dates, bind stable studies and require explicit study review',()=>{
 const endpoint=event('source-step',{title:'USMLE Step 1',categoryId:'exams',eventType:'milestone',startDate:'2023-01',endDate:null,fields:{canonicalType:'STEP_1'}});
 const d=doc([endpoint]);d.exams=[{id:'source-record',system:'USMLE',examId:'step-1',examDate:'2023-01',sourceEventId:'source-step',attemptNumberUnconfirmed:true,sourceType:'document-intake',visibilityState:'INTERVIEWER_SAFE'}];
 const missing=render(d);assert.ok(missing.scene.flags.some(flag=>flag.id==='source-step'));
 assert.throws(()=>assertCompleteFounderPresentation(missing),error=>error.code==='TIMELINE_EXPORT_STUDY_REQUIRED');
 d.events.push(event('study',{title:'USMLE Step 1 study period',categoryId:'exams',startDate:'2022-09',endDate:'2023-01',fields:{isStudyPeriod:true,sourceExamRecordId:'source-record',attemptId:'source-exam:source-record'}}));
 d.builder={examReviewCorrections:{'source-record':{examDate:'2023-02-15',result:'Passed',score:'215'}}};
 const before=JSON.stringify(d),r=render(d),flag=r.scene.flags.find(flag=>flag.id==='source-step');
 assert.deepEqual(r.scene.presentationExamContext.exams,[],'result-less intake records remain redacted by the existing privacy projector');
 assert.deepEqual(r.scene.presentationExamContext.presentationExamLinks,[{id:'source-record',sourceEventId:'source-step'}]);
 assert.equal(flag.examAttemptId,'source-exam:source-record');assert.equal(flag.startDate,'2023-02-15');assert.equal(flag.datePrecision.start,'DAY');assert.equal(flag.examResult,'Passed');
 const selection=projectFounderDisplayEvents(d);assert.equal(selection.events.find(event=>event.id==='source-step').fields.score,'215');
 assert.ok(r.svg.includes('2/15/23'));assert.equal(r.scene.arrows.find(arrow=>arrow.id==='study').display.role,'Step 1');
 assert.equal(r.scene.flags.length,1);assert.equal(JSON.stringify(d),before);
 assert.equal(founderMilestoneTemplateGeometry(r.scene,paint(r)).find(item=>item.eventId==='source-step').kind,'EXAM_RESULT');
 assert.deepEqual(r.scene.chronologyOrder.violations,[]);
 const redacted={...d,events:d.events.map(event=>event.id==='source-step'?{...event,presentationRedactions:['EXAM_RESULT_PRIVATE','EXAM_SCORE_HIDDEN']}:event)};
 const protectedEndpoint=projectFounderDisplayEvents(redacted).events.find(event=>event.id==='source-step');
 assert.equal(protectedEndpoint.fields.result,undefined);assert.equal(protectedEndpoint.fields.score,undefined);
});

test('all explicit Founder US status presets use USA assets, including punctuation and EAD',()=>{
 for(const [type,title] of [['US_MOVE','Moved to U.S.'],['US_CITIZENSHIP','US Citizenship'],['US_GREEN_CARD','Received permanent residency / green card'],['US_EAD','EAD']]){
  const d=doc([event(type,{title,categoryId:'personal',eventType:'milestone',endDate:null,fields:{founderMilestoneType:type}})]),before=JSON.stringify(d),r=render(d);
  assert.equal(r.scene.flags.length,1);assert.ok(paint(r).nodes.some(node=>node.kind==='image'&&node.sourceAttributes['data-founder-usa-flag-asset-sha256']));assert.equal(JSON.stringify(d),before);
  assert.equal(founderMilestoneTemplateGeometry(r.scene,paint(r))[0].poleFootY,125);
 }
 for(const categoryId of ['work','research','education']){
  const cv=doc([event('cv',{title:'United States Research Award',categoryId,eventType:'milestone',endDate:null,fields:{canonicalType:'AWARD_HONOR'}})]);assert.equal(render(cv).scene.flags.length,0);
 }
 const foreign=doc([event('foreign',{title:'Foreign work authorization',categoryId:'personal',eventType:'milestone',endDate:null,fields:{canonicalType:'CUSTOM_MILESTONE'}})]);
 assert.ok(!paint(render(foreign)).nodes.some(node=>node.kind==='image'&&node.sourceAttributes['data-founder-usa-flag-asset-sha256']));assert.ok(render(foreign).svg.includes('fill="#5B6168"'));
 const bachelor=doc([event('bachelor',{title:'Bachelor of Science',categoryId:'education',eventType:'milestone',endDate:null,fields:{canonicalType:'MEDICAL_DEGREE'}})]);
 assert.equal(render(bachelor).scene.flags.length,0);
});

test('saved local studies cannot satisfy real endpoint review outside prototype and foreign statuses do not imply USA',()=>{
 const endpoint=event('endpoint',{categoryId:'exams',eventType:'milestone',endDate:null,fields:{canonicalType:'STEP_1'}});
 const d=doc([endpoint,event('local-study',{categoryId:'exams',sourceType:'local-test-study',fields:{localTestOnly:true,isStudyPeriod:true,sourceEventId:'endpoint',attemptId:'source-exam:record'}})]);d.metadata={localTestPrototype:true};
 const old=globalThis.location;try{
  globalThis.location={protocol:'https:',hostname:'example.com'};const reopened=JSON.parse(JSON.stringify(d)),r=render(reopened);
  assert.ok(!r.scene.arrows.some(arrow=>arrow.id==='local-study'));assert.equal(r.scene.flags[0].display.requiresStudy,true);
  assert.throws(()=>assertCompleteFounderPresentation(r),error=>error.code==='TIMELINE_EXPORT_STUDY_REQUIRED');
 }finally{if(old===undefined)delete globalThis.location;else globalThis.location=old;}
 for(const title of ['EAD','Green Card']){
  const unknown=doc([event('status',{title,categoryId:'personal',eventType:'milestone',endDate:null,fields:{canonicalType:'CUSTOM_MILESTONE',country:'Synthetic Foreign Country'}})]),r=render(unknown);
  assert.equal(r.scene.flags.length,1);assert.ok(!paint(r).nodes.some(node=>node.kind==='image'&&node.sourceAttributes['data-founder-usa-flag-asset-sha256']));assert.ok(r.svg.includes('fill="#5B6168"'));
 }
});

test('source exam alias without optional taxonomy links a result-less record without bypassing privacy',()=>{
 const d=doc([event('alias-exam',{title:'Step 2 CK',categoryId:'exams',eventType:'milestone',endDate:null}),event('actual-study',{title:'Step 2 CK study',categoryId:'exams',startDate:'2019-09',endDate:'2020-01',fields:{isStudyPeriod:true,sourceExamRecordId:'alias-record',attemptId:'source-exam:alias-record'}})]);
 d.exams=[{id:'alias-record',sourceType:'document-intake',sourceEventId:'alias-exam',visibilityState:'INTERVIEWER_SAFE',attemptNumberUnconfirmed:true}];
 d.builder={examReviewCorrections:{'alias-record':{examDate:'2020-01-15'}}};
 const before=JSON.stringify(d),r=render(d),flag=r.scene.flags.find(event=>event.id==='alias-exam');
 assert.equal(flag.examAttemptId,'source-exam:alias-record');assert.equal(flag.startDate,'2020-01-15');assert.equal(flag.examResult,null);assert.equal(flag.display.requiresStudy,false);
 assert.equal(r.scene.presentationExamContext.exams.length,0);assert.equal(JSON.stringify(d),before);
 assert.equal(founderMilestoneTemplateGeometry(r.scene,paint(r))[0].kind,'EXAM_RESULT');
});

test('verified structured city/state and explicit sourceCountry project without institution-based inference',()=>{
 const d=doc([]),source=event('structured',{fields:{country:'United States of America',city:'Synthetic City',state:'NY'}}),before=JSON.stringify(source);
 assert.equal(deriveFounderEventDisplay(d,source).location,'Synthetic City, NY');assert.equal(JSON.stringify(source),before);
 assert.equal(deriveFounderEventDisplay(d,event('outside',{fields:{sourceCountry:'Synthetic Country',city:'Supplied city',state:'Supplied state'}})).location,'Synthetic Country');
 assert.equal(deriveFounderEventDisplay(d,event('absent',{siteName:'Institution containing a city-like name'})).location,'');
 assert.equal(deriveFounderEventDisplay(d,event('explicit',{fields:{sourceLocation:'Supplied verified location'}})).location,'Supplied verified location');
});

test('source-authored Moved to the US uses the US asset without a canonical-type inference',()=>{
 const d=doc([event('source-us-move',{title:'Moved to the US',categoryId:'personal',eventType:'milestone',endDate:null})]),before=JSON.stringify(d),r=render(d);
 assert.equal(r.scene.flags.length,1);assert.ok(paint(r).nodes.some(node=>node.kind==='image'&&node.sourceAttributes['data-founder-usa-flag-asset-sha256']));assert.equal(JSON.stringify(d),before);
 assert.equal(founderMilestoneTemplateGeometry(r.scene,paint(r))[0].poleFootY,125);
});

test('entered study exact end dates with source wording strings paint the known date without mutating source',()=>{
 const d=doc([event('study-day',{title:'Step 1 study period',categoryId:'exams',startDate:'2022-09',endDate:'2023-01-15',fields:{isStudyPeriod:true,datePrecision:{start:'MONTH',end:'DAY'},sourceDateWording:{start:'2022-09',end:'2023-01-15'}}})]),before=JSON.stringify(d),r=render(d);
 const arrow=r.scene.arrows.find(arrow=>arrow.id==='study-day'),caption=paint(r).nodes.filter(node=>node.semanticRef==='study-day'&&node.sourceAttributes['data-board-ink-role']==='caption').map(node=>node.text).join(' ');
 assert.equal(caption,'9/22 - 1/15/23');assert.ok(!caption.includes('Date needed'));
 assert.deepEqual(arrow.sourceDateWording.end,{raw:'2023-01-15',normalizedMonth:'2023-01-15',precision:'DAY'});assert.equal(JSON.stringify(d),before);assert.doesNotThrow(()=>assertCompleteFounderPresentation(r));
 const conflict=doc([event('conflict',{categoryId:'exams',startDate:'2022-09',endDate:'2023-01-15',fields:{isStudyPeriod:true,datePrecision:{start:'MONTH',end:'DAY'},sourceDateWording:{end:'2023-02-15'}}})]);
 assert.equal(render(conflict).scene.arrows[0].sourceDateWording.end,'2023-02-15','conflicting supplied wording is not silently rewritten');
});

test('exact unprovided exam profile values are concise exclusions with accounting; known results remain visible',()=>{
 const d=doc([event('experience')]),sourceValues={step1:'Unknown',step2:'Unprovided',step2Cs:'Not provided',step3:'Passed'};
 d.exams=[['step-1','Unknown'],['step-2-ck','Unprovided'],['step-2-cs','Not provided'],['step-3','Passed']].map(([examId,result])=>({id:examId,system:'USMLE',examId,result,visibilityState:'INTERVIEWER_SAFE'}));
 const before=JSON.stringify(d),r=render(d),nodes=paint(r).nodes.filter(node=>node.sourceAttributes['data-profile-field']);
 for(const field of ['step1','step2','step2Cs']){
  assert.equal(r.scene.profile[field],sourceValues[field]);assert.ok(!r.scene.profileDisplay.includedFields.includes(field));
  assert.deepEqual(r.scene.profileDisplay.excludedFields.find(record=>record.field===field),{field,reason:'unprovided-exam-result',sourceValue:sourceValues[field]});
 }
 assert.ok(nodes.some(node=>node.sourceAttributes['data-profile-field']==='Step 3'&&node.text.includes('Passed')));assert.doesNotThrow(()=>assertCompleteFounderPresentation(r));assert.equal(JSON.stringify(d),before);
 r.scene.profileDisplay.excludedFields=r.scene.profileDisplay.excludedFields.filter(record=>record.field!=='step1');assert.throws(()=>assertCompleteFounderPresentation(r),error=>error.code==='TIMELINE_EXPORT_MISSING_FIELDS');
 const known=render({...d,exams:d.exams.map(exam=>exam.examId==='step-1'?{...exam,score:'215'}:exam)});assert.ok(known.scene.profileDisplay.includedFields.includes('step1'));assert.ok(paint(known).nodes.some(node=>node.sourceAttributes['data-profile-field']==='Step 1'&&node.text.includes('215')));
});


test('four attached native study flags join a fourteen-duration spine and disclose any remaining painted conflicts',()=>{
 const experiences=Array.from({length:10},(_,index)=>event('experience-'+index,{title:'Work',siteName:'Supplied organization',location:'Supplied city',startDate:`${2010+index}-01`,endDate:`${2010+index}-12`}));
 const studies=Array.from({length:4},(_,index)=>event('study-'+index,{title:'Study period',siteName:'',categoryId:'exams',startDate:`${2020+index}-01`,endDate:`${2020+index}-06`,fields:{isStudyPeriod:true,attemptId:'attempt-'+index}}));
 const flags=studies.map((study,index)=>event('endpoint-'+index,{title:'Step 1',siteName:'',categoryId:'exams',eventType:'milestone',startDate:study.endDate,endDate:null,fields:{canonicalType:'STEP_1',attemptId:'attempt-'+index}}));
 const d=doc([...experiences,...studies,...flags]);d.presentationOverrides={events:Object.fromEntries(flags.map(flag=>[flag.id,{showAsMilestone:true}]))};
 const before=JSON.stringify(d),r=render(d),resolved=paint(r);
 assert.equal(r.scene.arrows.length,14);assert.equal(r.scene.chronologyOrder.ordinaryIds.length,14);assert.deepEqual(r.scene.chronologyOrder.violations,[]);
 for(const [index,study] of studies.entries()){
  const milestone=founderMilestoneTemplateGeometry(r.scene,resolved).find(item=>item.eventId==='endpoint-'+index);
  assert.equal(milestone.poleFootY,milestone.attachmentY);
  assert.equal(materialPresentationCollisions(resolved).filter(collision=>collision.elementIds.includes(study.id)&&collision.elementIds.includes('endpoint-'+index)).length,0,'a study date and its own pennant must not overlap');
 }
 const collisions=materialPresentationCollisions(resolved);
 if(collisions.length)assert.throws(()=>assertCompleteFounderPresentation(r),error=>['TIMELINE_EXPORT_TEXT_COLLISION','TIMELINE_EXPORT_TEXT_OVERFLOW','TIMELINE_EXPORT_TEMPLATE_FIDELITY_HOLD'].includes(error.code));
 else assert.doesNotThrow(()=>assertCompleteFounderPresentation(r));
 assert.equal(JSON.stringify(d),before);
 const automatic=applySceneCommandToDocument(d,{kind:'geometry',target:{type:'event',id:'endpoint-2'},geometry:{x:700,y:300,width:50,height:64,rotation:0},create:{type:'event',semanticRef:'endpoint-2',presentation:{eventType:'milestone'}}}).document;
 automatic.advanced.scene.objects.find(object=>object.semanticRef==='endpoint-2').presentation.localLayoutCriticAuto=true;delete automatic.presentationOverrides.axis;
 const reflow=render(automatic),attached=founderMilestoneTemplateGeometry(reflow.scene,paint(reflow)).find(item=>item.eventId==='endpoint-2');
 assert.equal(attached.poleFootY,attached.attachmentY);assert.notEqual(locked407FMilestoneGeometry(reflow.scene,'endpoint-2').x,700,'critic-owned body pennant retains its date anchor');
 const manual=structuredClone(automatic);delete manual.advanced.scene.objects.find(object=>object.semanticRef==='endpoint-2').presentation.localLayoutCriticAuto;
 const manualRender=render(manual),preserved=locked407FMilestoneGeometry(manualRender.scene,'endpoint-2');assert.equal(preserved.x,700);assert.equal(preserved.y,300);
 assert.equal(materialPresentationCollisions(paint(manualRender)).filter(collision=>collision.elementIds.includes('endpoint-2')).length,0,'the fixed human pennant remains an actual obstacle during body composition');
});


test('exact linked exam endpoints are accounted on the study arrow while optional and unmatched flags stay visible',()=>{
 const study=event('study-exact',{title:'Step 2 CK study period',siteName:'',categoryId:'exams',startDate:'2022-09',endDate:'2023-01-15',fields:{isStudyPeriod:true,attemptId:'linked',datePrecision:{start:'MONTH',end:'DAY'},sourceDateWording:{end:'2023-01-15'}}});
 const endpoint=event('exam-exact',{title:'Step 2 CK',siteName:'',categoryId:'exams',eventType:'milestone',startDate:'2023-01-15',endDate:null,fields:{canonicalType:'STEP_2_CK',attemptId:'linked',datePrecision:{start:'DAY'}}});
 const d=doc([study,endpoint]),before=JSON.stringify(d),r=render(d);
 assert.equal(r.scene.flags.length,0);assert.equal(r.scene.arrows[0].display.role,'Step 2 CK');
 const exclusion=r.scene.presentationAccounting.excludedEvents[0];assert.equal(exclusion.reason,'covered-by-study-endpoint');assert.equal(exclusion.coveredByEventId,'study-exact');assert.deepEqual(exclusion.source,endpoint);assert.ok(r.svg.includes('1/15/23'));assert.equal(JSON.stringify(d),before);
 assert.doesNotThrow(()=>assertCompleteFounderPresentation(r));
 exclusion.endpointDate='2023-02-15';assert.throws(()=>assertCompleteFounderPresentation(r),error=>error.code==='TIMELINE_EXPORT_MISSING_FIELDS');
 assert.equal(render(setFounderEventDisplay(d,'exam-exact',{showAsMilestone:true})).scene.flags.length,1);
 assert.equal(render({...d,events:[study,{...endpoint,startDate:'2023-02-15'}]}).scene.flags.length,1);
 assert.equal(render({...d,events:[study,{...endpoint,fields:{...endpoint.fields,result:'Passed'}}]}).scene.flags.length,1,'known results without visible profile coverage retain their flag');
 const authored=applySceneCommandToDocument(d,{kind:'geometry',target:{type:'event',id:'exam-exact'},geometry:{x:900,y:400,width:50,height:64,rotation:0},create:{type:'event',semanticRef:'exam-exact',presentation:{eventType:'milestone'}}}).document;
 assert.equal(render(authored).scene.flags.length,1);
});


const linkedAccountingDocument=()=>doc([
 event('accounting-study',{title:'Step 2 CK study period',siteName:'',categoryId:'exams',startDate:'2022-09',endDate:'2023-01-15',fields:{isStudyPeriod:true,attemptId:'accounting-attempt'}}),
 event('accounting-endpoint',{title:'Step 2 CK',siteName:'',categoryId:'exams',eventType:'milestone',startDate:'2023-01-15',endDate:null,fields:{canonicalType:'STEP_2_CK',attemptId:'accounting-attempt'}})
]);
const authoredAccountingDocument=()=>{
 let d=linkedAccountingDocument();
 for(const [id,geometry] of [['accounting-study',{x:600,y:250,width:450,height:44,rotation:0}],['accounting-endpoint',{x:1030,y:186,width:50,height:64,rotation:0}]]){
  d=applySceneCommandToDocument(d,{kind:'geometry',target:{type:'event',id},geometry,create:{type:'event',semanticRef:id,presentation:{eventType:id==='accounting-study'?'duration':'milestone'}}}).document;
 }
 return d;
};
const accountingFailure=error=>error.code==='TIMELINE_EXPORT_MISSING_FIELDS'&&error.fields.some(field=>field.id==='presentation'&&field.field==='excluded-source-accounting');

test('export accounting replays saved manual, critic, object and group ownership without changing geometry',()=>{
 for(const ownership of ['manual','critic','object-lock','group-membership','group-lock']){
  const d=authoredAccountingDocument(),object=d.advanced.scene.objects.find(object=>object.semanticRef==='accounting-endpoint');
  if(ownership!=='manual')object.presentation.localLayoutCriticAuto=true;
  if(ownership==='object-lock')object.locked=true;
  if(ownership==='group-membership'||ownership==='group-lock'){
   const children=d.advanced.scene.objects.filter(object=>object.type==='event');
   d.advanced.scene.groups=[{id:'accounting-group',childIds:children.map(object=>object.id),locked:ownership==='group-lock',aspectLocked:true}];
   for(const child of children)child.groupId='accounting-group';
  }
  const before=JSON.stringify(d),r=render(d),covered=ownership==='critic';
  assert.equal(r.scene.flags.length,covered?0:1,ownership);
  assert.equal(r.scene.presentationAccounting.excludedEvents.length,covered?1:0,ownership);
  assert.doesNotThrow(()=>assertCompleteFounderPresentation(r),ownership);
  if(ownership==='manual'||ownership==='object-lock'){
   const geometry=locked407FMilestoneGeometry(r.scene,'accounting-endpoint');
   for(const field of ['x','y','width','height','rotation'])assert.equal(geometry[field],object.geometry[field],ownership+' '+field);
  }
  assert.equal(JSON.stringify(d),before,ownership);assert.equal(render(d).svg,r.svg,ownership);
  if(covered)r.scene.presentationAccounting.excludedEvents[0].endpointDate='2023-02-15';
  else r.scene.presentationAccounting.excludedEvents=render(linkedAccountingDocument()).scene.presentationAccounting.excludedEvents;
  assert.throws(()=>assertCompleteFounderPresentation(r),accountingFailure,ownership);
 }
});

test('document layoutLock retains linked flags and does not relax endpoint accounting or template gates',()=>{
 const d=linkedAccountingDocument();d.layoutLock=true;
 const before=JSON.stringify(d),r=render(d);
 assert.equal(r.scene.flags.length,1);assert.deepEqual(r.scene.presentationAccounting.excludedEvents,[]);
 assert.doesNotThrow(()=>assertCompleteFounderPresentation(r));assert.equal(JSON.stringify(d),before);
 r.scene.presentationAccounting.excludedEvents=render(linkedAccountingDocument()).scene.presentationAccounting.excludedEvents;
 assert.throws(()=>assertCompleteFounderPresentation(r),accountingFailure);
 const moved=authoredAccountingDocument();moved.advanced.scene.objects.find(object=>object.semanticRef==='accounting-endpoint').geometry.y+=50;
 assert.throws(()=>assertCompleteFounderPresentation(render(moved)),error=>error.code==='TIMELINE_EXPORT_TEMPLATE_FIDELITY_HOLD');
});

test('saved ownership accounting preserves audience exclusions and redacted exam review corrections',()=>{
 const d=authoredAccountingDocument(),endpoint=d.events.find(event=>event.id==='accounting-endpoint');
 endpoint.startDate='2023-01';endpoint.presentationRedactions=['EXAM_RESULT_PRIVATE','EXAM_SCORE_HIDDEN'];
 d.exams=[{id:'accounting-record',sourceEventId:endpoint.id,system:'USMLE',examId:'step-2-ck',visibilityState:'INTERVIEWER_SAFE'}];
 d.builder={examReviewCorrections:{'accounting-record':{examDate:'2023-01-15',result:'PRIVATE_RESULT_TOKEN',score:'PRIVATE_SCORE_TOKEN'}}};
 d.events.push(event('private-source',{title:'PRIVATE_SOURCE_TOKEN',visibilityState:'ADVISOR_ONLY'}));
 const before=JSON.stringify(d),r=render(d),flag=r.scene.flags.find(flag=>flag.id===endpoint.id);
 assert.equal(flag.startDate,'2023-01-15');assert.equal(flag.examResult,null);
 assert.equal(r.scene.presentationSourceEvents.some(event=>event.id==='private-source'),false);
 for(const token of ['PRIVATE_RESULT_TOKEN','PRIVATE_SCORE_TOKEN','PRIVATE_SOURCE_TOKEN'])assert.ok(!r.svg.includes(token));
 assert.doesNotThrow(()=>assertCompleteFounderPresentation(r));assert.equal(JSON.stringify(d),before);
 const grouped=structuredClone(d),object=grouped.advanced.scene.objects.find(object=>object.semanticRef===endpoint.id);
 object.groupId='privacy-group';
 grouped.advanced.scene.objects.push({...structuredClone(object),id:'PRIVATE_OBJECT_TOKEN',semanticRef:'private-source'});
 grouped.advanced.scene.groups=[{id:'privacy-group',childIds:[object.id,'PRIVATE_OBJECT_TOKEN'],locked:true,aspectLocked:true}];
 const context=buildFounderPresentationScene(grouped).presentationLayoutContext;
 assert.ok(!JSON.stringify(context).includes('PRIVATE_OBJECT_TOKEN'));
 assert.deepEqual(context.advanced.scene.groups,[{locked:true,childIds:[object.id]}]);
});


test('alternate outside-title bounds retain attached pennants in the measured study group',()=>{
 const study=event('legacy-study',{title:'Supplied long study role with a readable full outside caption',siteName:'',categoryId:'exams',startDate:'2023-05',endDate:'2023-06',fields:{isStudyPeriod:true,attemptId:'legacy-attempt'}});
 const endpoint=event('legacy-endpoint',{title:'Step 1',siteName:'',categoryId:'exams',eventType:'milestone',startDate:'2023-07',endDate:null,fields:{canonicalType:'STEP_1',attemptId:'legacy-attempt'}});
 const d=doc([event('first',{title:'Work',startDate:'2020-01',endDate:'2020-12'}),study,endpoint,event('following',{title:'Work',startDate:'2023-08',endDate:'2023-12'})]);
 const initial=render(d).scene,arrow=initial.arrows.find(arrow=>arrow.id===study.id);delete arrow.display;arrow.title=study.title;initial.autoArrowLabelSides=new Map([[study.id,false]]);
 const result=composeLocked407FPortableSvg(initial),resolved=paint(result),title=resolved.nodes.find(node=>node.semanticRef===study.id&&node.sourceAttributes['data-board-ink-role']==='outside-arrow');
 assert.ok(title);assert.ok(['outside-left','outside-right'].includes(title.sourceAttributes['data-arrow-label-placement']));assert.equal(result.scene.chronologyOrder.violations.length,0);
 const ownIds=new Set([study.id,endpoint.id]);assert.equal(materialPresentationCollisions(resolved).filter(collision=>collision.elementIds.some(id=>ownIds.has(id))).length,0);
 const attachment=founderMilestoneTemplateGeometry(result.scene,resolved).find(item=>item.eventId===endpoint.id);assert.equal(attachment.poleFootY,attachment.attachmentY);
});


test('native left institution words that cannot fit their authored space give an honest readability hold',()=>{
 const d=doc([event('narrow-institution',{siteName:'UnbreakableSyntheticInstitution'})]),before=JSON.stringify(d);
 const owned=applySceneCommandToDocument(d,{kind:'geometry',target:{type:'event',id:'narrow-institution'},geometry:{x:60,y:600,width:400,height:44,rotation:0},create:{type:'event',semanticRef:'narrow-institution',presentation:{eventType:'duration'}}}).document,r=render(owned);
 const site=paint(r).nodes.find(node=>node.semanticRef==='narrow-institution'&&node.sourceAttributes['data-board-ink-role']==='site');
 assert.equal(site.fontSize,19);assert.equal(site.sourceAttributes['data-text-overflow'],'true');
 assert.throws(()=>assertCompleteFounderPresentation(r),error=>error.code==='TIMELINE_EXPORT_TEXT_OVERFLOW');assert.equal(JSON.stringify(d),before);assert.equal(owned.events[0].siteName,d.events[0].siteName);
});


test('minimum native clinical arrows center concise roles in the true shaft with unchanged eighteen-point type',()=>{
 const d=doc([event('minimum-fm',{title:'Family Medicine Extern',siteName:'',categoryId:'clinical'})]),before=JSON.stringify(d);
 const owned=applySceneCommandToDocument(d,{kind:'geometry',target:{type:'event',id:'minimum-fm'},geometry:{x:900,y:400,width:52,height:43.56779479980469,rotation:0},create:{type:'event',semanticRef:'minimum-fm',presentation:{eventType:'duration'}}}).document,r=render(owned),nodes=paint(r).nodes;
 const role=nodes.find(node=>node.semanticRef==='minimum-fm'&&node.sourceAttributes['data-board-ink-role']==='inside-arrow'),body=nodes.find(node=>node.semanticRef==='minimum-fm'&&node.sourceAttributes['data-continuous-duration-arrow']);
 assert.equal(role.text,'FM');assert.equal(role.fontSize,18);assert.notEqual(role.sourceAttributes['data-text-overflow'],'true');
 assert.ok(role.bounds.x>=body.bounds.x+1);assert.ok(role.bounds.x+role.bounds.width<=body.bounds.x+body.bounds.width-19.45389175415039-1);
 assert.ok(Math.abs(role.bounds.x+role.bounds.width/2-(body.bounds.x+(body.bounds.width-19.45389175415039)/2))<.1);assert.equal(JSON.stringify(d),before);assert.deepEqual(owned.events,d.events);
});


test('native below-arrow alignments stay associated and human-owned display geometry retains its location',()=>{
 const d=doc([event('aligned',{title:'Work',siteName:'',location:'Supplied City, ST'})]),before=JSON.stringify(d);
 d.presentationOverrides={axis:{mode:'manual',startYear:2020,endYear:2026,includeFuture:false,segmentWeights:Array.from({length:7},(_,i)=>({id:String(2020+i),weight:1}))}};
 const base=buildFounderPresentationScene(d,{currentMonth:'2026-10'}),candidate=composeLocked407FPortableSvg({...base,autoLocationAlignments:new Map([['aligned','end']])}),parts=paint(candidate).nodes;
 const body=parts.find(node=>node.semanticRef==='aligned'&&node.sourceAttributes['data-continuous-duration-arrow']),location=parts.find(node=>node.semanticRef==='aligned'&&node.sourceAttributes['data-board-ink-role']==='location');
 assert.equal(location.text,'Supplied City, ST');assert.equal(location.fontSize,18);assert.ok(location.bounds.y>body.bounds.y+body.bounds.height);const alignment=candidate.scene.autoLocationAlignments.get('aligned');assert.ok(['end','tip'].includes(alignment));assert.ok(Math.abs(location.bounds.x+(alignment==='tip'?location.bounds.width/2:location.bounds.width)-(body.bounds.x+body.bounds.width))<.1);
 const owned=applySceneCommandToDocument(d,{kind:'geometry',target:{type:'event',id:'aligned'},geometry:{x:500,y:400,width:400,height:43.56779479980469,rotation:0},create:{type:'event',semanticRef:'aligned',presentation:{eventType:'duration'}}}).document;
 const manual=composeLocked407FPortableSvg({...buildFounderPresentationScene(owned,{currentMonth:'2026-10'}),autoLocationAlignments:new Map([['aligned','end']])}),manualLocation=paint(manual).nodes.find(node=>node.semanticRef==='aligned'&&node.sourceAttributes['data-board-ink-role']==='location');
 assert.equal(manualLocation.bounds.x,500);assert.deepEqual(owned.events,d.events);assert.deepEqual(d.events,JSON.parse(before).events);
});

test('a supplied right-edge location stays one line below its arrow within native board margins',()=>{
 const d=doc([event('right-edge',{title:'Family Medicine Extern',siteName:'',categoryId:'clinical',fields:{country:'United States of America',city:'Synthetic City',state:'AZ'}})]),before=JSON.stringify(d);
 const owned=applySceneCommandToDocument(d,{kind:'geometry',target:{type:'event',id:'right-edge'},geometry:{x:1850,y:400,width:52,height:43.56779479980469,rotation:0},create:{type:'event',semanticRef:'right-edge',presentation:{eventType:'duration'}}}).document,r=render(owned),nodes=paint(r).nodes;
 const location=nodes.filter(node=>node.semanticRef==='right-edge'&&node.sourceAttributes['data-board-ink-role']==='location'),body=nodes.find(node=>node.semanticRef==='right-edge'&&node.sourceAttributes['data-continuous-duration-arrow']);
 assert.equal(location.length,1);assert.equal(location[0].text,'Synthetic City, AZ');assert.equal(location[0].fontSize,18);
 assert.ok(location[0].bounds.x>=24);assert.ok(location[0].bounds.x+location[0].bounds.width<=1896.1);assert.ok(location[0].bounds.y>=body.bounds.y+body.bounds.height);
 assert.equal(body.bounds.x,1850);assert.equal(JSON.stringify(d),before);assert.deepEqual(owned.events,d.events);
});


test('two automatic milestone captions use native side flips while the manual axis and source facts stay fixed',()=>{
 const d=doc([event('degree-caption',{title:'MD',siteName:'Supplied School',categoryId:'education',eventType:'milestone',startDate:'2022-07',endDate:null,fields:{canonicalType:'MEDICAL_DEGREE'}}),event('us-caption',{title:'Moved to the US',siteName:'',categoryId:'personal',eventType:'milestone',startDate:'2023-03',endDate:null}),event('work-caption',{title:'Work',siteName:'',startDate:'2020-01',endDate:'2026-12'})]);
 d.presentationOverrides={axis:{mode:'manual',startYear:2020,endYear:2026,includeFuture:false,segmentWeights:Array.from({length:7},(_,index)=>({id:String(2020+index),weight:1}))}};
 const before=JSON.stringify(d),r=render(d),resolved=paint(r),labels=resolved.nodes.filter(node=>node.sourceAttributes['data-board-ink-role']==='flag-label');
 assert.equal(materialPresentationCollisions(resolved).filter(collision=>collision.elementIds.includes('degree-caption')&&collision.elementIds.includes('us-caption')).length,0);
 assert.ok(labels.every(node=>node.fontSize===18));assert.deepEqual(r.scene.founderPresentation.axis,d.presentationOverrides.axis);assert.equal(JSON.stringify(d),before);
});


test('an automatic location corridor survives first human takeover, group movement and JSON reopen',()=>{
 const d=doc([event('corridor',{title:'Work',siteName:'',location:'Supplied City, ST',startDate:'2023-01',endDate:'2026-12'})]);
 d.presentationOverrides={axis:{mode:'manual',startYear:2020,endYear:2026,includeFuture:false,segmentWeights:Array.from({length:7},(_,i)=>({id:String(2020+i),weight:1}))}};
 d.advanced.elements=[{id:'fixed-caption-corridor',kind:'rectangle',x:800,y:248,width:150,height:824,fill:'#ffffff'}];
 const before=JSON.stringify(d),r=render(d),nodes=paint(r).nodes,body=nodes.find(node=>node.semanticRef==='corridor'&&node.sourceAttributes['data-continuous-duration-arrow']),location=nodes.find(node=>node.semanticRef==='corridor'&&node.sourceAttributes['data-board-ink-role']==='location');
 const alignment=r.scene.autoLocationAlignments.get('corridor');assert.ok(['center','end'].includes(alignment));assert.equal(materialPresentationCollisions(paint(r)).filter(collision=>collision.elementIds.includes('corridor')).length,0);
 const create=advancedEventCreation407F(d,'corridor',{currentMonth:'2026-10'});assert.equal(create.presentation.locationLabelLayout.alignment,alignment);
 const moved=applyHumanEventCommand407F(d,{kind:'geometry',target:{type:'event',id:'corridor'},geometry:{x:body.bounds.x+12,y:body.bounds.y+10,width:body.bounds.width,height:body.bounds.height,rotation:0},create}).document;
 const stored=moved.advanced.scene.objects.find(object=>object.semanticRef==='corridor');assert.equal(stored.presentation.locationLabelLayout.alignment,alignment);assert.notEqual(stored.presentation.localLayoutCriticAuto,true);
 const reopened=JSON.parse(JSON.stringify(moved)),after=render(reopened),afterLocation=paint(after).nodes.find(node=>node.semanticRef==='corridor'&&node.sourceAttributes['data-board-ink-role']==='location');
 assert.ok(Math.abs(afterLocation.bounds.x-location.bounds.x-12)<.1);assert.ok(Math.abs(afterLocation.bounds.y-location.bounds.y-10)<.1);assert.equal(after.svg,render(moved).svg);
 assert.deepEqual(moved.events,d.events);assert.equal(JSON.stringify(d),before);
});


test('an automatic right-edge date clamps above its own arrow and survives first takeover without altering authored dates',()=>{
 const d=doc([event('edge-date',{title:'Family Medicine Extern',siteName:'',categoryId:'clinical',startDate:'2026-12',endDate:'2026-12'})]);
 d.presentationOverrides={axis:{mode:'manual',startYear:2020,endYear:2026,includeFuture:false,segmentWeights:Array.from({length:7},(_,i)=>({id:String(2020+i),weight:1}))}};
 const before=JSON.stringify(d),r=render(d),parts=paint(r).nodes,body=parts.find(node=>node.semanticRef==='edge-date'&&node.sourceAttributes['data-continuous-duration-arrow']),date=parts.find(node=>node.semanticRef==='edge-date'&&node.sourceAttributes['data-arrow-caption']);
 assert.equal(date.text,'12/26 - 12/26');assert.equal(date.fontSize,18);assert.equal(date.sourceAttributes['data-automatic-caption-clamp'],'true');assert.ok(date.bounds.x+date.bounds.width<=1896.1);
 const create=advancedEventCreation407F(d,'edge-date',{currentMonth:'2026-10'});assert.ok(Number.isFinite(create.presentation.dateLabelLayout.xOffset));
 const moved=applyHumanEventCommand407F(d,{kind:'geometry',target:{type:'event',id:'edge-date'},geometry:{x:body.bounds.x-20,y:body.bounds.y+5,width:body.bounds.width,height:body.bounds.height,rotation:0},create}).document;
 const reopened=render(JSON.parse(JSON.stringify(moved))),afterDate=paint(reopened).nodes.find(node=>node.semanticRef==='edge-date'&&node.sourceAttributes['data-arrow-caption']);
 assert.ok(Math.abs(afterDate.bounds.x-date.bounds.x+20)<.1);assert.ok(Math.abs(afterDate.bounds.y-date.bounds.y-5)<.1);assert.deepEqual(moved.events,d.events);assert.equal(JSON.stringify(d),before);
 const authored=applySceneCommandToDocument(d,{kind:'geometry',target:{type:'event',id:'edge-date'},geometry:{x:1800,y:400,width:52,height:43.56779479980469,rotation:0},create:{type:'event',semanticRef:'edge-date',presentation:{eventType:'duration'}}}).document;
 const authoredDate=paint(render(authored)).nodes.find(node=>node.semanticRef==='edge-date'&&node.sourceAttributes['data-arrow-caption']);assert.equal(Number(authoredDate.sourceAttributes.x),1840);assert.notEqual(authoredDate.sourceAttributes['data-automatic-caption-clamp'],'true');
});


test('bounded whole-spine frontier preserves future caption corridors and compresses early clear rows',()=>{
 const events=Array.from({length:10},(_,index)=>event('frontier-'+index,{
  title:'Role',siteName:index%3===0?'Supplied University Organization':'Supplied Organization',location:'Supplied City, ST',
  startDate:index<6?`${2010+index}-01`:`2026-${String(1+(index-6)*3).padStart(2,'0')}`,
  endDate:index<6?`${2010+index}-12`:`2026-${String(3+(index-6)*3).padStart(2,'0')}`
 })),d=doc(events),before=JSON.stringify(d),r=render(d),resolved=paint(r);
 assert.deepEqual(r.scene.chronologyOrder.violations,[]);
 const conflicts=materialPresentationCollisions(resolved);assert.equal(conflicts.length,0,'fresh calendar geometry clears the complete spine and fixed furniture');
 // A clear initial composition need not run the optional furniture search.
 // Painted collisions, chronology, legibility and complete export remain mandatory.
 const assessment=r.scene.autoFurnitureBudgetAssessment;
 if(assessment){
  assert.equal(assessment.accepted,true);assert.ok(assessment.budgets.every(item=>item.deficit<.1));
  const risk=assessment.readability;assert.equal(risk.candidate.overflow,0);assert.equal(risk.candidate.bodyRisk,0);assert.equal(risk.candidate.collisions,0);assert.equal(risk.candidate.chronology,0);assert.equal(risk.candidate.score,0);assert.ok(r.svg.includes('data-furniture-axis-risks='));
 }
 const earliest=r.scene.autoNativeEarliestAssessment;
 if(earliest)assert.ok(r.svg.includes(`data-native-earliest-decision="${earliest.accepted?'accepted':earliest.fit?'rejected':'infeasible'}"`),'a bounded native alternative reports its final decision');
 assert.ok([...r.scene.autoArrowGeometry.values()].every(geometry=>geometry.y>=171&&geometry.y+geometry.height<=1072));
 assert.ok(resolved.nodes.filter(node=>node.sourceAttributes['data-board-ink-role']==='location').every(node=>node.fontSize===18&&node.text==='Supplied City, ST'));
 assert.equal(JSON.stringify(d),before);assert.equal(render(d).svg,r.svg);
 assert.doesNotThrow(()=>assertCompleteFounderPresentation(r),'a complete clear presentation passes the unchanged export gates');
});


test('recognized automatic native arrows collide with the filled shaft and head, never empty shoulder corners',()=>{
 const arrow=(extra='')=>`<g data-event-id="native-arrow" data-event-kind="arrow" ${extra}><path data-native-arrow-paint="automatic" data-continuous-duration-arrow="true" d="M100 210H480V200L500 222L480 244V234H100Z" fill="#DF6A0F"/></g>`;
 const paintAt=(x,y,markup=arrow())=>resolveFounderPresentationSvg(`<svg viewBox="0 0 1920 1080">${markup}<g data-event-id="caption" data-event-kind="arrow"><text x="${x}" y="${y}" font-size="18" font-family="Arial">Text</text></g></svg>`);
 const empty=paintAt(110,202),path=empty.nodes.find(node=>node.kind==='path'),parts=founderPaintCollisionParts(path);
 assert.equal(parts.length,2);assert.equal(path.commands.filter(point=>!point.close).length,7);assert.deepEqual(path.bounds,{x:100,y:200,width:400,height:44,rotation:0});
 assert.equal(materialPresentationCollisions(empty).length,0,'caption above the shaft lies in unpainted shoulder space');
 assert.equal(materialPresentationCollisions(paintAt(110,224)).length,1,'actual shaft intersection still blocks');
 assert.equal(materialPresentationCollisions(paintAt(483,224)).length,1,'actual triangular head intersection still blocks');
 const authored=paintAt(110,202,arrow().replace(' data-native-arrow-paint="automatic"',''));assert.equal(founderPaintCollisionParts(authored.nodes.find(node=>node.kind==='path')).length,1);assert.equal(materialPresentationCollisions(authored).length,1);
 const rotated=paintAt(110,202,arrow('transform="rotate(12 300 222)"'));assert.equal(founderPaintCollisionParts(rotated.nodes.find(node=>node.kind==='path')).length,1);
 const unfamiliar=paintAt(110,202,arrow().replace('V234H100Z','V234H200L100 234Z'));assert.equal(founderPaintCollisionParts(unfamiliar.nodes.find(node=>node.kind==='path')).length,1);
});


test('critic retained or explicit duration Y stays fixed inside the complete chronology validator',()=>{
 let d=doc([event('fixed-earlier',{title:'Role',siteName:'',startDate:'2021-01',endDate:'2021-12'}),event('fixed-later',{title:'Role',siteName:'',startDate:'2023-01',endDate:'2023-12'})]);
 for(const [id,y,marker] of [['fixed-earlier',700,'localLayoutCriticYRetained'],['fixed-later',800,'localLayoutCriticYExplicit']]){
  d=applySceneCommandToDocument(d,{kind:'geometry',target:{type:'event',id},geometry:{x:500,y,width:200,height:43.56779479980469,rotation:0},create:{type:'event',semanticRef:id,presentation:{eventType:'duration'}}}).document;
  const object=d.advanced.scene.objects.find(item=>item.semanticRef===id);object.presentation={...object.presentation,localLayoutCriticAuto:true,[marker]:true};
 }
 delete d.presentationOverrides.axis;const before=JSON.stringify(d),r=render(d),resolved=paint(r);
 for(const [id,y] of [['fixed-earlier',700],['fixed-later',800]]){
  const path=resolved.nodes.find(node=>node.semanticRef===id&&node.sourceAttributes['data-continuous-duration-arrow']);assert.ok(Math.abs(path.bounds.y-y)<.01);
  assert.ok(r.scene.chronologyOrder.ordinaryIds.includes(id),'critic-owned saved coordinates remain chronological participants');
 }
 assert.deepEqual(r.scene.chronologyOrder.violations,[]);assert.equal(JSON.stringify(d),before);
 const inverted=structuredClone(d);inverted.advanced.scene.objects.find(item=>item.semanticRef==='fixed-later').geometry.y=150;
 const bad=render(inverted);assert.ok(bad.scene.chronologyOrder.ordinaryIds.includes('fixed-later'));assert.ok(bad.scene.chronologyOrder.violations.some(item=>item.eventId==='fixed-later'));
 assert.throws(()=>assertCompleteFounderPresentation(bad),'a bad critic Y cannot hide as an authored exception');
});


test('a pin-only institution conflict reserves its whole fixed furniture paper corridor',()=>{
 const furniture=[{groupId:'furniture:color-key',bounds:{x:20,y:300,width:284,height:296},occlusionBounds:{x:20,y:335,width:284,height:261}},{groupId:'furniture:color-key',bounds:{x:148,y:288,width:28,height:28}},{groupId:'furniture:profile',bounds:{x:13,y:661,width:545,height:410}}];
 const site={x:90,y:292,width:180,height:23},before=JSON.stringify({furniture,site});
 const required=locked407FInstitutionFurnitureMinimumX(site,282,furniture);
 assert.equal(required,499,'the group paper right edge304 binds even when only the pin is initially touched');
 assert.equal(site.x+required-282,307,'the native left institution clears the paper by three pixels');
 assert.equal(locked407FInstitutionFurnitureMinimumX({...site,x:700},892,furniture),null);
 assert.equal(JSON.stringify({furniture,site}),before);
});


test('a bounded below-tip location clears a future corridor and survives human acquisition, move and JSON reopen',()=>{
 const d=doc([event('tip-corridor',{title:'Work',siteName:'',location:'Supplied City, ST',startDate:'2021-01',endDate:'2022-12'})]);
 d.presentationOverrides={axis:{mode:'manual',startYear:2020,endYear:2026,includeFuture:false,segmentWeights:Array.from({length:7},(_,i)=>({id:String(2020+i),weight:1}))}};
 const base=render(d),baseNodes=paint(base).nodes,baseBody=baseNodes.find(node=>node.semanticRef==='tip-corridor'&&node.sourceAttributes['data-continuous-duration-arrow']),baseLocation=baseNodes.find(node=>node.semanticRef==='tip-corridor'&&node.sourceAttributes['data-board-ink-role']==='location');
 const tipX=baseBody.bounds.x+baseBody.bounds.width-baseLocation.bounds.width/2;
 d.advanced.elements=[{id:'fixed-tip-corridor',kind:'rectangle',x:24,y:248,width:tipX-40-24,height:824,fill:'#FFFFFF'}];
 const before=JSON.stringify(d),r=render(d),nodes=paint(r).nodes,body=nodes.find(node=>node.semanticRef==='tip-corridor'&&node.sourceAttributes['data-continuous-duration-arrow']),location=nodes.find(node=>node.semanticRef==='tip-corridor'&&node.sourceAttributes['data-board-ink-role']==='location');
 assert.equal(r.scene.autoLocationAlignments.get('tip-corridor'),'tip');assert.ok(Math.abs(location.bounds.x+location.bounds.width/2-body.bounds.x-body.bounds.width)<.1);
 assert.equal(location.fontSize,18);assert.equal(location.text,'Supplied City, ST');assert.ok(location.bounds.y>body.bounds.y+body.bounds.height);
 assert.equal(materialPresentationCollisions(paint(r)).filter(collision=>collision.elementIds.includes('tip-corridor')).length,0);assert.deepEqual(r.scene.chronologyOrder.violations,[]);
 const create=advancedEventCreation407F(d,'tip-corridor',{currentMonth:'2026-10'});assert.equal(create.presentation.locationLabelLayout.alignment,'tip');
 const moved=applyHumanEventCommand407F(d,{kind:'geometry',target:{type:'event',id:'tip-corridor'},geometry:{x:body.bounds.x+12,y:body.bounds.y+10,width:body.bounds.width,height:body.bounds.height,rotation:0},create}).document;
 const stored=moved.advanced.scene.objects.find(object=>object.semanticRef==='tip-corridor');assert.equal(stored.presentation.locationLabelLayout.alignment,'tip');assert.notEqual(stored.presentation.localLayoutCriticAuto,true);
 const reopened=JSON.parse(JSON.stringify(moved)),after=render(reopened),afterLocation=paint(after).nodes.find(node=>node.semanticRef==='tip-corridor'&&node.sourceAttributes['data-board-ink-role']==='location');
 assert.ok(Math.abs(afterLocation.bounds.x-location.bounds.x-12)<.1);assert.ok(Math.abs(afterLocation.bounds.y-location.bounds.y-10)<.1);assert.equal(after.svg,render(moved).svg);
 const explicit=JSON.parse(JSON.stringify(reopened));explicit.advanced.scene.objects.find(object=>object.semanticRef==='tip-corridor').presentation.locationLabelLayout={alignment:'end'};
 const fixed=composeLocked407FPortableSvg({...buildFounderPresentationScene(explicit,{currentMonth:'2026-10'}),autoLocationAlignments:new Map([['tip-corridor','tip']])}),fixedNodes=paint(fixed).nodes,fixedBody=fixedNodes.find(node=>node.semanticRef==='tip-corridor'&&node.sourceAttributes['data-continuous-duration-arrow']),fixedLocation=fixedNodes.find(node=>node.semanticRef==='tip-corridor'&&node.sourceAttributes['data-board-ink-role']==='location');
 assert.ok(Math.abs(fixedLocation.bounds.x+fixedLocation.bounds.width-fixedBody.bounds.x-fixedBody.bounds.width)<.1,'an explicit owned end alignment is preserved over automatic tip suggestions');
 assert.deepEqual(moved.events,d.events);assert.equal(JSON.stringify(d),before);
});


test('bounded automatic dates above arrow endpoints preserve native text and first human ownership',()=>{
 const events=Array.from({length:10},(_,index)=>event('date-corridor-'+index,{title:'Role',siteName:index%3===0?'Supplied University Organization':'Supplied Organization',location:'Supplied City, ST',startDate:index<6?`${2010+index}-01`:`2026-${String(1+(index-6)*3).padStart(2,'0')}`,endDate:index<6?`${2010+index}-12`:`2026-${String(3+(index-6)*3).padStart(2,'0')}`}));
 const d=doc(events),before=JSON.stringify(d),r=render(d),nodes=paint(r).nodes;
 assert.equal(materialPresentationCollisions(paint(r)).length,0);assert.deepEqual(r.scene.chronologyOrder.violations,[]);assert.doesNotThrow(()=>assertCompleteFounderPresentation(r));
 const [id,alignment]=[...r.scene.autoDateAlignments].find(([,value])=>value!=='center');assert.ok(['start','end'].includes(alignment));
 const body=nodes.find(node=>node.semanticRef===id&&node.sourceAttributes['data-continuous-duration-arrow']),date=nodes.find(node=>node.semanticRef===id&&node.sourceAttributes['data-arrow-caption']);
 assert.equal(date.fontSize,18);assert.equal(date.sourceAttributes['data-automatic-date-alignment'],alignment);assert.ok(date.bounds.y+date.bounds.height<body.bounds.y);
 const create=advancedEventCreation407F(d,id,{currentMonth:'2026-10'});assert.ok(Number.isFinite(create.presentation.dateLabelLayout.xOffset));
 const moved=applyHumanEventCommand407F(d,{kind:'geometry',target:{type:'event',id},geometry:{x:body.bounds.x+12,y:body.bounds.y+10,width:body.bounds.width,height:body.bounds.height,rotation:0},create}).document;
 const reopened=render(JSON.parse(JSON.stringify(moved))),afterDate=paint(reopened).nodes.find(node=>node.semanticRef===id&&node.sourceAttributes['data-arrow-caption']);
 assert.equal(afterDate.text,date.text);assert.ok(Math.abs(afterDate.bounds.x-date.bounds.x-12)<.1);assert.ok(Math.abs(afterDate.bounds.y-date.bounds.y-10)<.1);assert.deepEqual(moved.events,d.events);assert.equal(JSON.stringify(d),before);
 const stored=moved.advanced.scene.objects.find(object=>String(object.semanticRef)===id);stored.presentation.dateLabelLayout={xOffset:30};
 const owned=composeLocked407FPortableSvg({...buildFounderPresentationScene(moved,{currentMonth:'2026-10'}),autoDateAlignments:new Map([[id,'end']])}),ownedNodes=paint(owned).nodes,ownedBody=ownedNodes.find(node=>node.semanticRef===id&&node.sourceAttributes['data-continuous-duration-arrow']),ownedDate=ownedNodes.find(node=>node.semanticRef===id&&node.sourceAttributes['data-arrow-caption']);
 assert.equal(Number(ownedDate.sourceAttributes.x),ownedBody.bounds.x+30,'an explicit owned date offset wins over automatic endpoint suggestions');
});


test('an automatic USA milestone keeps its native date anchor while a bounded adjacent caption clears the plaque and ribbon',()=>{
 const d=doc([event('native-us',{title:'Moved to the US',siteName:'',categoryId:'personal',eventType:'milestone',startDate:'2024-02',endDate:null}),event('native-degree',{title:'MD',siteName:'Supplied School',categoryId:'education',eventType:'milestone',startDate:'2021-07',endDate:null,fields:{canonicalType:'MEDICAL_DEGREE'}}),event('work-span',{title:'Work',siteName:'',startDate:'2020-01',endDate:'2026-12'}),event('native-custom',{title:'Custom life event',siteName:'',categoryId:'personal',eventType:'milestone',startDate:'2020-03',endDate:null})]);
 d.presentationOverrides={events:{'native-custom':{showAsMilestone:true}},axis:{mode:'manual',startYear:2020,endYear:2026,includeFuture:false,segmentWeights:Array.from({length:7},(_,i)=>({id:String(2020+i),weight:1}))}};
 const before=JSON.stringify(d),r=render(d),nodes=paint(r).nodes,us=nodes.filter(node=>node.semanticRef==='native-us'),image=us.find(node=>node.kind==='image'),label=us.find(node=>node.sourceAttributes['data-board-ink-role']==='flag-label'),date=us.find(node=>node.sourceAttributes['data-board-ink-role']==='flag-date'),plaque=nodes.find(node=>node.groupId==='furniture:title'&&node.kind==='image');
 assert.equal(r.scene.flags.length,3);assert.equal(materialPresentationCollisions(paint(r)).filter(collision=>collision.elementIds.includes('native-us')).length,0);assert.equal(image.bounds.width,50);assert.equal(image.bounds.height,41);assert.equal(image.bounds.y,84);assert.equal(date.text,'2/24');assert.equal(label.text,'Moved to the US');assert.equal(label.fontSize,18);assert.equal(date.fontSize,18);assert.ok(label.bounds.x>=plaque.bounds.x+plaque.bounds.width+6);assert.ok(label.bounds.x-image.bounds.x-image.bounds.width<=100);assert.ok(date.bounds.y+date.bounds.height<=125.04);
 const native=locked407FMilestoneGeometry(r.scene,'native-us'),create=advancedEventCreation407F(d,'native-us',{currentMonth:'2026-10'});assert.ok(Number.isFinite(create.presentation.flagLabelLayout.xOffset));assert.equal(create.presentation.flagLabelLayout.yOffset,-21);
 const moved=applyHumanEventCommand407F(d,{kind:'geometry',target:{type:'event',id:'native-us'},geometry:{x:native.x+10,y:native.y+4,width:native.width,height:native.height,rotation:0},create}).document,reopened=render(JSON.parse(JSON.stringify(moved))),movedNodes=paint(reopened).nodes;
 const afterLabel=movedNodes.find(node=>node.semanticRef==='native-us'&&node.sourceAttributes['data-board-ink-role']==='flag-label');assert.ok(Math.abs(afterLabel.bounds.x-label.bounds.x-10)<.1);assert.ok(Math.abs(afterLabel.bounds.y-label.bounds.y-4)<.1);assert.deepEqual(moved.events,d.events);assert.equal(JSON.stringify(d),before);
});

test('B1 readable display text sizes clamp and fit without changing source, native date/institution fonts or chronology',()=>{
 const document=doc([event('work',{title:'Family Medicine Extern',siteName:'Synthetic Hospital',startDate:'2020-01',endDate:'2021-12'})]),before=JSON.stringify(document),source=structuredClone(document.events);
 const small=setFounderEventDisplay(document,'work',{role:'FM',labelSize:2,labelFit:'fit'}),large=setFounderEventDisplay(document,'work',{role:'FM',labelSize:100,labelFit:'fixed'});
 assert.equal(deriveFounderEventDisplay(small,small.events[0]).labelSize,18);assert.equal(deriveFounderEventDisplay(large,large.events[0]).labelSize,24);
 const rendered=render(large),parts=paint(rendered).nodes.filter(node=>node.semanticRef==='work'),label=parts.find(node=>node.sourceAttributes['data-board-ink-role']==='inside-arrow');
 assert.equal(label.fontSize,24);assert.equal(label.text,'FM');assert.equal(label.sourceAttributes['data-text-overflow'],'true','fixed oversized native role is honestly held, not compressed');assert.throws(()=>assertCompleteFounderPresentation(rendered),{code:'TIMELINE_EXPORT_TEXT_OVERFLOW'});
 assert.equal(parts.find(node=>node.sourceAttributes['data-board-ink-role']==='site').fontSize,19);assert.equal(parts.find(node=>node.sourceAttributes['data-arrow-caption']).fontSize,18);
 const fitted=setFounderEventDisplay(large,'work',{labelFit:'fit'}),fitLabel=paint(render(fitted)).nodes.find(node=>node.semanticRef==='work'&&node.sourceAttributes['data-board-ink-role']==='inside-arrow');assert.ok(fitLabel.fontSize>=18&&fitLabel.fontSize<=24);assert.notEqual(fitLabel.sourceAttributes['data-text-overflow'],'true');
 assert.deepEqual(fitted.events,source);assert.deepEqual(large.events,source);assert.equal(JSON.stringify(document),before);assert.deepEqual(rendered.scene.arrows.map(event=>[event.id,event.startDate,event.endDate]),render(document).scene.arrows.map(event=>[event.id,event.startDate,event.endDate]));
 assert.throws(()=>setFounderEventDisplay(document,'work',{labelSize:NaN}),{code:'FOUNDER_DISPLAY_INVALID_FIELD'});assert.throws(()=>setFounderEventDisplay(document,'work',{labelFit:'compress-fonts'}),{code:'FOUNDER_DISPLAY_INVALID_FIELD'});
});
test('B1 native milestone display text and size survive JSON with exact source date and native pennant unchanged',()=>{
 const document=doc([event('degree',{categoryId:'education',eventType:'milestone',title:'Medical degree',siteName:'',startDate:'2020-06',endDate:null})]),source=structuredClone(document.events),edited=setFounderEventDisplay(document,'degree',{label:'Medical graduation',labelSize:22,labelFit:'fixed',institution:''});
 const first=render(edited),reopened=render(JSON.parse(JSON.stringify(edited))),nodes=paint(first).nodes.filter(node=>node.semanticRef==='degree'),label=nodes.find(node=>node.sourceAttributes['data-board-ink-role']==='flag-label'),date=nodes.find(node=>node.sourceAttributes['data-founder-pennant-date']);
 assert.equal(label.fontSize,22);assert.equal(label.text,'Medical graduation');assert.equal(date.fontSize,18);assert.equal(date.text,'6/20');assert.equal(first.svg,reopened.svg);assert.deepEqual(edited.events,source);
 assert.equal(founderMilestoneTemplateGeometry(first.scene,paint(first)).find(target=>target.eventId==='degree').poleFootY,125);
 const baselinePaths=paint(render(document)).nodes.filter(node=>node.semanticRef==='degree'&&node.kind==='path').map(node=>node.commands),editedPaths=nodes.filter(node=>node.kind==='path').map(node=>node.commands);assert.deepEqual(editedPaths,baselinePaths);
});
