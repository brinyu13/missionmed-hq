import test from 'node:test';
import assert from 'node:assert/strict';
import {renderKeynoteClassicBoard} from '../web/js/uxr-002/board-renderer.js';
import {serializeFounderPresentation} from '../web/js/presentation/founder-presentation-serializer.js';
import {resolveFounderPresentationSvg} from '../web/js/presentation/resolved-founder-presentation.js';
import {presentationDateWording,presentationDayDate} from '../web/js/presentation/source-date-wording.js';
import {parseMonth} from '../web/js/uxr-002/utils.js';

const wording=(date,precision='DAY')=>({raw:date,normalizedMonth:date,precision});
const event=(id,startDate,endDate=null,overrides={})=>({
 id,title:'Synthetic source milestone',categoryId:'personal',
 eventType:endDate?'duration':'milestone',startDate,endDate,
 visibilityState:'INTERVIEWER_SAFE',
 fields:{datePrecision:{start:'DAY',end:endDate?'DAY':null},
  sourceDateWording:{start:wording(startDate),end:endDate?wording(endDate):null}},
 provenance:[{sourceDocumentId:'synthetic-only',sourceExcerpt:'Synthetic exact-date evidence'}],
 ...overrides
});
const document=events=>({id:'synthetic-day-projection',events,studentProfile:{fullName:'Synthetic Avery'},metadata:{},builder:{},presentationOverrides:{}});
const render=events=>renderKeynoteClassicBoard(document(events),{currentMonth:'2026-10'});
const eventNodes=(svg,id)=>resolveFounderPresentationSvg(svg).nodes.filter(node=>node.semanticRef===id);
const dateText=(result,id,attribute,expected)=>{
 if(result.svg.includes('<foreignObject')){
  assert.ok(result.svg.includes(`data-event-id="${id}"`));
  assert.ok(result.svg.includes(expected.replace(' - ',' – ')),expected);
 }else assert.equal(eventNodes(result.svg,id).find(node=>node.sourceAttributes[attribute]).text,expected);
};

test('exact-day milestones survive the normal board and Founder SVG paths with visible day wording',()=>{
 const source=event('day-milestone','2024-02-29');
 for(const result of [render([source]),serializeFounderPresentation(document([source]),{currentMonth:'2026-10'})]){
  assert.deepEqual(result.scene.omissions,[]);
  const flag=result.scene.flags.find(item=>item.id===source.id);
  assert.equal(flag.month,'2024-02');assert.equal(flag.startDate,'2024-02-29');
  assert.equal(flag.datePrecision.start,'DAY');assert.deepEqual(flag.sourceDateWording,source.fields.sourceDateWording);
  dateText(result,source.id,'data-founder-pennant-date','2/29/24');assert.match(flag.ariaLabel,/Feb 29, 2024/);
 }
});

test('exact-day duration captions preserve both days and do not change source dates or evidence',()=>{
 const source=event('day-duration','2023-05-19','2023-08-21',{categoryId:'research',title:'Synthetic research role'});
 const input=document([source]),before=JSON.stringify(input);
 for(const result of [renderKeynoteClassicBoard(input,{currentMonth:'2026-10'}),serializeFounderPresentation(input,{currentMonth:'2026-10'})]){
  assert.deepEqual(result.scene.omissions,[]);
  const arrow=result.scene.arrows.find(item=>item.id===source.id);
  assert.equal(arrow.startMonth,'2023-05');assert.equal(arrow.endMonth,'2023-08');
  assert.equal(arrow.startDate,source.startDate);assert.equal(arrow.endDate,source.endDate);
  assert.deepEqual(arrow.datePrecision,source.fields.datePrecision);
  assert.deepEqual(arrow.sourceDateWording,source.fields.sourceDateWording);
  assert.match(arrow.dateLabel,/May 19, 2023.*Aug 21, 2023/);
  dateText(result,source.id,'data-arrow-caption','5/19/23 - 8/21/23');
  // A month axis does not establish an exact whole-month aggregate for DAY facts.
  assert.equal(result.scene.profile.researchMonths,null);
 }
 assert.equal(JSON.stringify(input),before);
});

test('DAY dates without optional wording metadata remain exact in the rendered scene',()=>{
 const source=event('day-without-wording','2023-12-05',null,{fields:{}});
 const before=JSON.stringify(source),result=render([source]),flag=result.scene.flags[0];
 assert.equal(flag.datePrecision.start,'DAY');assert.equal(flag.sourceDateWording.start.normalizedMonth,'2023-12-05');
 dateText(result,source.id,'data-founder-pennant-date','12/5/23');
 assert.equal(JSON.stringify(source),before);
});

test('strict calendar validation rejects impossible, unsupported, and nonleap DAY strings',()=>{
 for(const date of ['2023-02-29','2100-02-29','2024-02-30','2023-04-31','2023-00-19','2023-13-19','2023-05-00','2023-05-32','2023-5-19','2023-05-19T00:00:00Z','May 19, 2023']){
  assert.equal(presentationDayDate(date),null,date);
  const result=render([event('invalid',date)]);
  assert.equal(result.scene.flags.length,0,date);
  assert.deepEqual(result.scene.omissions.map(item=>item.reason),['missing-valid-start-month'],date);
  assert.doesNotMatch(result.svg,/data-event-id="invalid"/);
 }
 for(const date of ['2024-02-29','2000-02-29','2023-04-30','2023-12-31'])assert.equal(presentationDayDate(date),date);
 // The general month parser remains strict and unchanged.
 assert.equal(parseMonth('2024-02-29'),null);
});

test('invalid duration end and reversed exact days in the same month are honestly omitted',()=>{
 for(const [start,end,reason] of [
  ['2023-02-01','2023-02-29','missing-valid-end-month'],
  ['2023-05-20','2023-05-19','end-before-start'],
  ['2023-06-01','2023-05-31','end-before-start']
 ]){
  const result=render([event('invalid-range',start,end,{categoryId:'work'})]);
  assert.equal(result.scene.arrows.length,0);assert.equal(result.scene.omissions[0].reason,reason);
 }
 assert.equal(render([event('same-day','2023-05-19','2023-05-19',{categoryId:'work'})]).scene.arrows.length,1);
});

test('mixed MONTH/DAY and open-ended durations use source precision independently',()=>{
 const mixed=event('mixed','2024-02-29','2024-03',{categoryId:'work',fields:{datePrecision:{start:'DAY',end:'MONTH'},sourceDateWording:{start:wording('2024-02-29'),end:wording('2024-03','MONTH')}}});
 const ongoing=event('ongoing','2024-02-29',null,{eventType:'duration',categoryId:'work',openEnded:true});
 const result=serializeFounderPresentation(document([mixed,ongoing]),{currentMonth:'2026-10'});assert.deepEqual(result.scene.omissions,[]);
 assert.equal(eventNodes(result.svg,'mixed').find(node=>node.sourceAttributes['data-arrow-caption']).text,'2/29/24 - 3/24');
 assert.equal(eventNodes(result.svg,'ongoing').find(node=>node.sourceAttributes['data-arrow-caption']).text,'2/29/24 - Present');
});

test('year, month, season and unknown wording regressions retain their source precision',()=>{
 const cases=[['2023-01','YEAR',wording('2023-01','YEAR'),'2023'],['2023-05','MONTH',null,'5/23'],['2023-03','SEASON',{raw:'Spring 2023',normalizedMonth:'2023-03'},'Spring 2023'],['2023-05','UNKNOWN',null,'Date needed']];
 for(const [date,precision,source,expected] of cases){
  assert.equal(presentationDateWording(date,precision,source),expected);
  const result=serializeFounderPresentation(document([event('coarse',date,null,{fields:{datePrecision:{start:precision},sourceDateWording:{start:source}}})]),{currentMonth:'2026-10'});
  assert.equal(eventNodes(result.svg,'coarse').find(node=>node.sourceAttributes['data-founder-pennant-date']).text,expected);
 }
 assert.equal(presentationDateWording('2023-05','DAY',wording('2023-06-19')),'Date needed');
 assert.equal(presentationDateWording('2023-05','DAY',wording('2023-05-32')),'Date needed');
 assert.equal(presentationDateWording('2023-05','DAY',null),'Date needed');
});

test('exact-day education keeps its completion milestone and original source-linked span',()=>{
 const source=event('day-degree','2018-09-03','2023-05-19',{categoryId:'education',title:'Synthetic degree',siteName:'Synthetic Medical College'});
 const input=document([source]),before=JSON.stringify(input),result=serializeFounderPresentation(input,{currentMonth:'2026-10'});
 assert.equal(result.scene.arrows.length,0);assert.deepEqual(result.scene.omissions,[]);
 const flag=result.scene.flags[0];assert.equal(flag.startDate,source.endDate);assert.equal(flag.datePrecision.start,'DAY');
 assert.equal(eventNodes(result.svg,source.id).find(node=>node.sourceAttributes['data-founder-pennant-date']).text,'5/19/23');
 assert.equal(result.scene.profile.educationRecords[0].startDate,source.startDate);
 assert.equal(result.scene.profile.educationRecords[0].endDate,source.endDate);
 assert.equal(JSON.stringify(input),before);
});

test('exact-day exam with unknown result renders without invented pass/fail or study periods',()=>{
 const source=event('day-exam','2023-05-19',null,{categoryId:'exams',title:'Step 2 CK',fields:{datePrecision:{start:'DAY'},sourceDateWording:{start:wording('2023-05-19')},score:'245',attemptId:'synthetic-attempt',result:''}});
 const input=document([source]),before=JSON.stringify(input),result=serializeFounderPresentation(input,{currentMonth:'2026-10'});
 assert.equal(result.scene.flags.length,1);assert.equal(result.scene.arrows.length,0);assert.equal(result.scene.flags[0].examResult,null);
 assert.equal(eventNodes(result.svg,source.id).find(node=>node.sourceAttributes['data-founder-pennant-date']).text,'5/19/23');
 assert.doesNotMatch(result.svg,/data-exam-result="(?:Passed|Failed)"/);assert.equal(JSON.stringify(input),before);
});

test('private DAY events and private exam results stay excluded from SVG and source wording',()=>{
 const privateEvent=event('private-day','2023-06-17',null,{title:'PRIVATE_SYNTHETIC_SENTINEL',visibilityState:'ADVISOR_ONLY'});
 const publicExam=event('private-result','2023-05-19',null,{categoryId:'exams',title:'Step 1 (Failed)',fields:{datePrecision:{start:'DAY'},sourceDateWording:{start:wording('2023-05-19')},attemptId:'synthetic-attempt',result:'Failed'},fieldProvenance:{result:{visibilityState:'ADVISOR_ONLY'}}});
 const input=document([privateEvent,publicExam]),before=JSON.stringify(input);
 for(const result of [renderKeynoteClassicBoard(input,{currentMonth:'2026-10'}),serializeFounderPresentation(input,{currentMonth:'2026-10'})]){
  assert.equal(result.scene.flags.length,1);assert.equal(result.scene.flags[0].examResult,null);
  assert.doesNotMatch(result.svg,/PRIVATE_SYNTHETIC_SENTINEL|6\/17\/23|2023-06-17|Failed|data-event-id="private-day"/);
  assert.ok(result.svg.includes('5/19/23'));
 }
 assert.equal(JSON.stringify(input),before);
});
