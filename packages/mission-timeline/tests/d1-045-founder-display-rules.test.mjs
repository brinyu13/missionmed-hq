import test from 'node:test';
import assert from 'node:assert/strict';
import {computeFounderCategoryKey,setFounderCategoryKey,resetFounderCategoryKey,setFounderEventDisplay,deriveFounderEventDisplay,projectFounderDisplayEvents,founderInstitutionLabel,FOUNDER_DISPLAY_CATEGORY_ROWS} from '../web/js/presentation/founder-display-rules.js';
import {serializeFounderPresentation,assertCompleteFounderPresentation,founderMilestoneTemplateGeometry} from '../web/js/presentation/founder-presentation-serializer.js';
import {resolveFounderPresentationSvg,materialPresentationCollisions} from '../web/js/presentation/resolved-founder-presentation.js';
import {locked407FMilestoneGeometry} from '../web/js/uxr-002/locked-407f-export.js';
import {applySceneCommandToDocument} from '../web/js/editor/scene-commands.js';
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
 assert.ok(r.svg.includes('2/15/23'));assert.equal(r.scene.arrows.find(arrow=>arrow.id==='study').display.role,'Study');
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
