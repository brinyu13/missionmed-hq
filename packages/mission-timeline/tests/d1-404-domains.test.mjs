import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

import {
  apply407FStateToDocument,
  applyDocumentTo407FState
} from "../web/js/407f-engineering-adapter.js";
import {
  beginBuilderEntryEdit,
  commitBuilderEntry,
  deleteBuilderEntry,
  ensureBuilderState
} from "../web/js/uxr-002/builder.js";
import {defaultDocument} from "../web/js/uxr-002/store.js";

const webRoot=new URL("../web/",import.meta.url);
const index=await readFile(new URL("index.html",webRoot),"utf8");
const adapter=await readFile(new URL("js/407f-engineering-adapter.js",webRoot),"utf8");
const schoolRegistry=await readFile(
  new URL("js/uxr-002/medical-school-registry.js",webRoot),
  "utf8"
);

function sourceBetween(start,end){
  const from=index.indexOf(start);
  const to=index.indexOf(end,from+start.length);
  assert.ok(from>=0,`missing source marker: ${start}`);
  assert.ok(to>from,`missing source marker: ${end}`);
  return index.slice(from,to);
}

function ordered(source,fragments,label){
  let cursor=-1;
  for(const fragment of fragments){
    const next=source.indexOf(fragment,cursor+1);
    assert.ok(next>cursor,`${label}: ${fragment}`);
    cursor=next;
  }
}

function literal(name,nextMarker){
  const source=sourceBetween(`const ${name}=`,nextMarker);
  const literal=source.slice(source.indexOf("=")+1,source.lastIndexOf(";"));
  return Function(`"use strict";return (${literal});`)();
}

function idFactory(){
  let value=0;
  return(prefix)=>`${prefix}-${++value}`;
}

function canonicalState(){
  return{
    user:{events:[],interview:{prog:"",date:"",label:""}},
    profile:{name:"",country:"",visa:"",goal:"",s1:"",s2:""},
    sticky:"",
    media:{},
    canvasTheme:"keynote",
    wiz:{},
    builder:{
      step:3,
      examSystems:[],
      exams:[],
      domainDrafts:{},
      domainEditing:{},
      skipped:{}
    },
    saved:true,
    sel:null
  };
}

test("407F activates one-at-a-time entry workflows for Builder steps 3 through 6",()=>{
  assert.match(
    index,
    /step>=3&&step<=6\?domainStepMarkup404\(step\):builderPlaceholderMarkup\(step\)/
  );

  const domainStep=sourceBetween("function domainStepMarkup404(","function builderPlaceholderMarkup(");
  assert.match(domainStep,/const domain=\{3:'clinical',4:'work',5:'research',6:'personal'\}\[step\]/);
  assert.equal((domainStep.match(/<form class="builderDomainCard"/g)||[]).length,1);
  assert.match(domainStep,/data-domain-form="/);
  assert.match(domainStep,/domainSavedList404\(domain\)/);
  assert.match(domainStep,/data-domain-skip|data-builder-skip/);

  const clinical=sourceBetween("function clinicalMarkup404(","function workMarkup404(");
  ordered(clinical,[
    "'Institution'","'Specialty'","'Rotation type'","'City'","'State'",
    "'Start'","'End'","Currently on this rotation","'Notes <em>Optional</em>'"
  ],"US Clinical Rotations");

  const work=sourceBetween("function workMarkup404(","function researchMarkup404(");
  ordered(work,[
    "'Role / title'","'Organization'","'Country'","'City <em>Optional</em>'",
    "'Kind'","'Start'","'End'","I still work here",
    "'One-line description <em>Optional</em>'"
  ],"Work Experience");

  const research=sourceBetween("function researchMarkup404(","const PERSONAL_ICONS_404=");
  ordered(research,[
    "'Project title'","'Institution / lab <em>Optional</em>'","'Role'",
    "'Start'","'End'","Ongoing","'Publication status'"
  ],"Research");

  const personal=sourceBetween("function personalMarkup404(","function domainStepMarkup404(");
  ordered(personal,[
    "'What happened'","'When'","'Start'","'Date'","'End'","<legend>Icon",
    "'Visibility'"
  ],"Personal");
});

test("407F uses the normalized local school registry while preserving domain typeaheads and institution mapping",()=>{
  const specialties=literal("SPECIALTIES_404","const US_TEACHING_INSTITUTIONS_404=");
  const institutions=literal("US_TEACHING_INSTITUTIONS_404","function examDefinition404");

  assert.ok(specialties.length>=130);
  assert.ok(institutions.length>=25);
  assert.ok(specialties.includes("Internal Medicine"));
  assert.deepEqual(
    institutions.find(({name})=>name==="Massachusetts General Hospital"),
    {
      name:"Massachusetts General Hospital",
      city:"Boston",
      state:"MA",
      shortName:"Mass General"
    }
  );

  const clinical=sourceBetween("function clinicalMarkup404(","function workMarkup404(");
  assert.match(clinical,/domainTypeahead404\('Institution','institution',draft\.institution,'clinicalInstitutions'\)/);
  assert.match(clinical,/domainTypeahead404\('Specialty','specialty',draft\.specialty,'specialties'\)/);
  assert.match(clinical,/Type 2\+ characters; choose a match or keep your text as written\./);

  const typeahead=sourceBetween("function typeaheadSource404(","function domainFormData404(");
  assert.match(typeahead,/if\(provider!=='countries'&&query\.length<2\)return\[\]/);
  assert.match(typeahead,/matches\.slice\(0,8\)/);
  assert.match(typeahead,/typeahead\.rows\(query,matches,\{allowFreeText:allowFreeText,limit:8\}\)/);
  assert.match(typeahead,/institutionShortName:institution\.shortName,city:institution\.city,state:institution\.state/);
  assert.match(typeahead,/institutionShortName:'',city:'',state:''/);

  assert.match(index,/window\.D1_407F_ENGINEERING&&window\.D1_407F_ENGINEERING\.schoolRegistry/);
  assert.match(index,/data-school-combobox/);
  assert.match(index,/data-school-choice/);
  assert.match(index,/data-school-not-listed/);
  assert.match(schoolRegistry,/MEDICAL_SCHOOL_DATASET_URL/);
  assert.match(schoolRegistry,/networkRequests:false/);

  const serializer=sourceBetween("function domainFormData404(","function domainErrors404(");
  assert.match(serializer,/US_TEACHING_INSTITUTIONS_404\.find\(item=>item\.name===next\.institution\)/);
  assert.match(serializer,/next\.city=next\.city\|\|institution\.city/);
  assert.match(serializer,/next\.state=next\.state\|\|institution\.state/);
  assert.match(adapter,/\btypeaheadRows\b/);
  assert.match(adapter,/\brankCountryMatches\b/);
});

test("Published research exposes the six approved author positions and defaults its timeline milestone toggle on",()=>{
  const research=sourceBetween("function researchMarkup404(","const PERSONAL_ICONS_404=");
  const positions=[
    "First author",
    "Co-first author",
    "Second author",
    "Middle author",
    "Last / senior author",
    "Corresponding author"
  ];
  for(const position of positions)assert.ok(research.includes(`'${position}'`),position);
  assert.equal(
    positions.filter((position)=>research.includes(`'${position}'`)).length,
    6
  );
  assert.match(research,/name="markPublication" data-domain-toggle="markPublication"/);

  const clickHandler=sourceBetween("document.addEventListener('click'","document.addEventListener('change'");
  assert.match(
    clickHandler,
    /publicationStatus'&&segment\.dataset\.domainValue==='Published'.*changes\.markPublication=true/s
  );
});

test("Personal offers exactly 12 icons and only interviewer-safe or advisor-only visibility",()=>{
  const icons=literal("PERSONAL_ICONS_404","function personalMarkup404");
  assert.equal(icons.length,12);
  assert.deepEqual(
    icons.map(([name])=>name),
    ["heart","home","plane","baby","ring","star","flag","globe","shield","sun","book","sparkle"]
  );

  const personal=sourceBetween("function personalMarkup404(","function domainStepMarkup404(");
  assert.match(personal,/label:'Show everyone',value:'INTERVIEWER_SAFE'/);
  assert.match(personal,/label:'Advisor only',value:'ADVISOR_ONLY'/);
  assert.doesNotMatch(personal,/FULL_STORY|STUDENT_ONLY|HIDDEN/);
});

test("407F domain adapter reuses Builder commit, persistence round-trip, edit, and linked delete ownership",()=>{
  for(const name of [
    "beginBuilderEntryEdit",
    "commitBuilderEntry",
    "deleteBuilderEntry",
    "ensureBuilderState"
  ]){
    assert.match(adapter,new RegExp(`\\b${name}\\b`));
  }
  assert.match(adapter,/api\.domain=Object\.freeze\(\{/);
  assert.match(adapter,/save\(domain,entry\)[\s\S]*commitBuilderEntry\(document,domain,clone\(entry\|\|\{\}\)\)/);
  assert.match(adapter,/edit\(eventId\)[\s\S]*beginBuilderEntryEdit\(document,eventId\)/);
  assert.match(adapter,/delete\(eventId\)[\s\S]*deleteBuilderEntry\(document,eventId\)/);

  const document=defaultDocument();
  const ids=idFactory();
  const saved=commitBuilderEntry(document,"research",{
    projectTitle:"Hypertension outcomes",
    institution:"University Lab",
    role:"Research fellow",
    startDate:"2024-01",
    endDate:"2025-01",
    ongoing:false,
    publicationStatus:"Published",
    journal:"Medical Science",
    publicationYear:"2025",
    authorPosition:"First author",
    doiOrPmid:"10.1000/example",
    markPublication:true
  },{idFactory:ids});
  assert.equal(saved.ok,true);
  assert.equal(document.events.length,2,"research and its linked publication persist together");

  const state=canonicalState();
  applyDocumentTo407FState(document,state);
  assert.equal(state.user.events.length,2);
  assert.equal(state.user.events[0].fields.builderDomain,"research");

  const restored=defaultDocument();
  apply407FStateToDocument(state,restored);
  assert.equal(restored.events.length,2);
  assert.equal(restored.events[0].fields.builderDomain,"research");
  assert.equal(restored.events[1].fields.publicationMilestone,true);

  ensureBuilderState(restored);
  assert.equal(beginBuilderEntryEdit(restored,saved.event.id),true);
  assert.equal(restored.builder.step,5);
  assert.equal(restored.builder.drafts.research.projectTitle,"Hypertension outcomes");
  assert.equal(deleteBuilderEntry(restored,saved.event.id),true);
  assert.equal(
    restored.events.some((event)=>event.fields.builderEntryId===saved.entryId),
    false,
    "deleting the owning research entry also deletes its linked publication"
  );
});
