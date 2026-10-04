import test from 'node:test';
import assert from 'node:assert/strict';
import {renderBuilder,installBuilder} from '../web/js/uxr-002/builder.js';
import {defaultDocument,migrateDocument} from '../web/js/uxr-002/store.js';
import {serializeFounderPresentation,assertCompleteFounderPresentation} from '../web/js/presentation/founder-presentation-serializer.js';
import {resolveFounderPresentationSvg} from '../web/js/presentation/resolved-founder-presentation.js';
import {FOUNDER_2025_MATRIX} from './fixtures/founder-2025-matrix.mjs';
const optional={aamcDisplay:'SYNTHETIC-026',emrExperience:'Epic, Cerner',languages:'English, Arabic',hobbies:'Piano, hiking',usceSummary:'Two rotation months',researchSummary:'One abstract'};
const base=()=>structuredClone(FOUNDER_2025_MATRIX.find(f=>f.id==='M02').document);
const render=document=>serializeFounderPresentation(document,{currentMonth:'2026-10',scope:'INTERVIEWER_SAFE'});
const profileText=rendered=>resolveFounderPresentationSvg(rendered.svg).nodes.filter(n=>n.kind==='text'&&n.sourceAttributes['data-profile-field']).map(n=>n.text).join(' ').replace(/\s+/g,' ');
function installForm(document,values){
  const controls=Object.fromEntries(Object.entries(values).map(([name,value])=>[name,{name,value,type:'text',listeners:{},matches:()=>true,addEventListener(type,callback){this.listeners[type]=callback;}}]));
  const form={elements:{namedItem:name=>controls[name]||null},querySelector:()=>null,querySelectorAll:selector=>selector.includes('[data-profile-field]')?Object.values(controls):[]};
  const root={querySelector:selector=>selector==='[data-core-form]'?form:null,querySelectorAll:()=>[]};
  installBuilder(root,{document,mutate(_label,operation){operation(document);}});
  return controls;
}
test('optional reference profile facts can be entered, corrected, cleared and reopened without dropping provenance',()=>{
  const document=defaultDocument();document.studentProfile.aamcId='LEGACY-SYNTHETIC';
  document.studentProfile.fieldProvenance={hobbies:{visibilityState:'ADVISOR_ONLY'}};
  const html=renderBuilder({document});
  for(const field of Object.keys(optional))assert.ok(html.includes(`data-profile-field="${field}"`),field);
  const controls=installForm(document,optional);controls.hobbies.listeners.blur();
  for(const [field,value] of Object.entries(optional))assert.equal(document.studentProfile[field],value,field);
  controls.hobbies.value='Classical piano';controls.hobbies.listeners.blur();
  controls.aamcDisplay.value='';controls.aamcDisplay.listeners.blur();
  assert.equal(document.studentProfile.aamcId,'','clearing display also clears the legacy fallback');
  const reopened=migrateDocument(JSON.parse(JSON.stringify(document)));
  assert.equal(reopened.studentProfile.hobbies,'Classical piano');
  assert.equal(reopened.studentProfile.fieldProvenance.hobbies.visibilityState,'ADVISOR_ONLY');
  assert.equal(reopened.studentProfile.researchSummary,optional.researchSummary);
  const limited=installForm(reopened,{fullName:'Synthetic correction'});limited.fullName.listeners.blur();
  assert.equal(reopened.studentProfile.emrExperience,optional.emrExperience,'absent optional controls do not clear existing facts');
});
test('full profile values reach visible native-size text, while private values are withheld',()=>{
  const document=base();Object.assign(document.studentProfile,optional);
  const before=JSON.stringify(document),rendered=render(document),text=profileText(rendered);
  for(const value of Object.values(optional))assert.ok(text.includes(value),value);
  assert.match(text,/Name: /);assert.doesNotMatch(text,/Your journey/);
  assert.equal(JSON.stringify(document),before);
  document.studentProfile.fieldProvenance={hobbies:{visibilityState:'ADVISOR_ONLY'}};
  assert.ok(!profileText(render(document)).includes(optional.hobbies));
  const nodes=resolveFounderPresentationSvg(rendered.svg).nodes.filter(n=>n.kind==='text'&&n.sourceAttributes['data-profile-field']);
  assert.ok(nodes.every(n=>Number(n.style['font-size'])===19));
});
test('export completeness detects profile facts removed after projection',()=>{
  const document=base();Object.assign(document.studentProfile,optional);
  const rendered=render(document);
  rendered.svg=rendered.svg.replace(/<text[^>]*data-profile-field="EMR Experience"[^>]*>[\s\S]*?<\/text>/g,'');
  assert.throws(()=>assertCompleteFounderPresentation(rendered),error=>error.code==='TIMELINE_EXPORT_MISSING_FIELDS'&&error.fields.some(field=>field.field==='emrExperience'));
});

// The actual golden shows clockwise tilts. Historical IWA angles 350/354 use
// the opposite sign convention from SVG; they are not SVG -10/-6 degrees.
test('photo frames retain the reference clockwise tilt and explicit manual geometry',async()=>{
  const {photoFrameGeometry}=await import('../web/js/uxr-002/locked-407f-export.js');
  assert.deepEqual([0,1,2].map(index=>photoFrameGeometry({},index).rotation),[10,6,0]);
  const scene={founderPresentation:{photoFrames:{'1':{x:620,y:760,width:180,height:240,rotation:-4}}}};
  assert.deepEqual(photoFrameGeometry(scene,0),{x:620,y:760,width:180,height:240,rotation:-4});
});
