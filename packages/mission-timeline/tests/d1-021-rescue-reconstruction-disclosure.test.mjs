import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import {createIntakeState,renderIntake} from '../web/js/uxr-002/intake.js';

const evidence=new URL('../../../_AI_HANDOFFS/from_codex/D1-TIMELINE-ASTRA6-AAA-FINAL-021/evidence/browser/',import.meta.url);
const actual=JSON.parse(await readFile(new URL('pdf-segmentation-repair-review-document.json',evidence),'utf8'));
const adapter=await readFile(new URL('../web/js/407f-engineering-adapter.js',import.meta.url),'utf8');

function assertNotice(html){
  assert.match(html,/aria-label="What Timeline Rescue rebuilds" data-rescue-reconstruction-notice/);
  assert.match(html,/Only the entries you accept and their supported profile details/);
  assert.match(html,/Photos, notes and original object positions from the uploaded file are not restored/);
  assert.match(html,/Your original file stays unchanged/);
  assert.match(html,/Preview the accepted suggestions below, then use Quality Guardian/);
  assert.ok(html.indexOf('data-rescue-reconstruction-notice')<html.indexOf('data-intake-action="approve"'));
  assert.doesNotMatch(html,/found nothing to flag|everything comes across|compare them with your CV/);
}

test('actual current Rescue review exposes reconstruction limits before Apply, even with no document-check findings',()=>{
  const state=structuredClone(actual.intake),before=structuredClone(state);
  assert.equal(state.suggestions.length,0);assert.equal(state.candidates.length,9);
  const html=renderIntake(state);assertNotice(html);
  assert.match(html,/Preview accepted suggestions \(0\)/);assert.match(html,/data-intake-action="approve" disabled/);
  assert.deepEqual(state,before,'Rendering the notice cannot approve or mutate facts');
});

test('all accepted Rescue rows keep the limitation visible and preserve the existing final approval action',()=>{
  const state=structuredClone(actual.intake);state.candidates.forEach(candidate=>candidate.decision='accepted');
  const before=structuredClone(state),html=renderIntake(state);assertNotice(html);
  assert.match(html,/Preview accepted suggestions \(9\)/);
  assert.match(html,/data-intake-action="approve">Add 9 accepted events/);
  assert.deepEqual(state,before);
});

test('ordinary CV review retains its document-check state; Rescue detection survives missing legacy parser fields',()=>{
  const cv=createIntakeState({candidates:[{id:'cv-one',title:'Source research',categoryId:'research',startDate:'2023-01',endDate:'2023-04'}]});cv.stage='review';
  assert.doesNotMatch(renderIntake(cv),/data-rescue-reconstruction-notice/);
  assert.match(renderIntake(cv),/found nothing to flag/);
  const legacy=structuredClone(actual.intake);legacy.detectedType=null;legacy.extraction.parser=null;legacy.extraction.sourceDocument=null;
  assertNotice(renderIntake(legacy));
});

test('actual Keynote/rebuild dialog handlers state limits and do not upload before explicit action',()=>{
  const dialogs=[],calls=[];
  const context={window:{D1_LOCAL_SYNTHETIC_AI:{}},productionRuntime:null,privateMediaStorageEnabled:false,openIntakeDialog:dialog=>dialogs.push(dialog),intakeMachine:{receiveFile:file=>calls.push(['receive',file.name]),setConsent:consent=>calls.push(['consent',consent]),startExtraction:()=>{calls.push(['read']);return Promise.resolve();}},toastStudentError:()=>{},file:{name:'synthetic.key'}};
  vm.createContext(context);
  vm.runInContext(adapter.slice(adapter.indexOf('    const handleTimelineRescueFile='),adapter.indexOf('    const looksLikeTimelineFile='))+'\nhandleTimelineRescueFile(file);',context);
  assert.equal(dialogs.length,1);assert.match(dialogs[0].body,/photos, notes and original positions are not restored/);assert.match(dialogs[0].body,/Keep your original Keynote file/);assert.doesNotMatch(dialogs[0].body,/everything comes across/);assert.equal(calls.length,0);
  context.file={name:'synthetic.pptx'};vm.runInContext('handleTimelineRescueFile(file);',context);
  assert.equal(dialogs.length,2);assert.match(dialogs[1].body,/Photos, notes and original positions are not restored/);assert.doesNotMatch(dialogs[1].body,/compare.*CV/);assert.equal(calls.length,0);
  dialogs[1].onPrimary();assert.deepEqual(calls,[['receive','synthetic.pptx'],['consent',true],['read']]);assert.equal(context.file.timelineRescue,true);
});

test('prototype Rescue front door and Keynote guidance expose limits before file selection',async()=>{
  const source=await readFile(new URL('../web/js/prototype-021.js',import.meta.url),'utf8');
  const context={family:false,rescueRoute:{innerHTML:''}};vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('  rescueRoute.innerHTML ='),source.indexOf('  if(syntheticAI)rescueRoute.')),context);
  const html=context.rescueRoute.innerHTML;
  assert.match(html,/Photos, notes and original object positions are not restored/);
  assert.match(html,/Read event details and dates from your Timeline for review/);
  assert.match(html,/Keep the original for continued editing/);
  assert.match(html,/Native \.key files cannot be read directly/);
  assert.doesNotMatch(html,/Find experiences, dates, images, and editable objects|everything comes across/);
  assert.ok(html.indexOf('original object positions are not restored')<html.indexOf('data-prototype-rescue-control'));
});
