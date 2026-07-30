import assert from "node:assert/strict";
import test from "node:test";

import {
  EXAM_SYSTEMS,
  PERSONAL_ICONS,
  beginBuilderEntryEdit,
  builderStepForEvent,
  builderStepState,
  builderStepStates,
  commitBuilderEntry,
  deleteBuilderEntry,
  ensureBuilderState,
  eventFromBuilderEntry,
  installBuilder,
  rankCountryMatches,
  renderBuilder,
  renderBuilderEntryDetails,
  syncEducationMilestone,
  typeaheadProviders,
  typeaheadRows,
  validateBuilderEntry,
  validateCoreInfo,
  validateExam
} from "../web/js/uxr-002/builder.js";
import {VISIBILITY} from "../web/js/uxr-002/constants.js";
import {defaultDocument} from "../web/js/uxr-002/store.js";

function ids(){
  let value=0;
  return(prefix)=>`${prefix}-${++value}`;
}

function validProfile(overrides={}){
  return{
    fullName:"Amara Osei",
    medicalSchool:"University of Ghana Medical School",
    medicalSchoolShortName:"UGMS",
    medicalSchoolCountry:"Ghana",
    graduationDate:"2028-06",
    expectedGraduation:true,
    degree:"MBBS",
    degreeOther:"",
    visaStatus:"Need J-1",
    ...overrides
  };
}

test("Builder renders the frozen seven-step titles and exact Step 1 field order without inventing data",()=>{
  const document=defaultDocument();
  const html=renderBuilder({document});

  const stepTitles=[
    "Core Info",
    "Exams",
    "US Clinical Rotations",
    "Work Experience",
    "Research",
    "Personal",
    "Review &amp; Finish"
  ];
  let cursor=-1;
  for(const title of stepTitles){
    const index=html.indexOf(`>${title}<`);
    assert.ok(index>cursor,title);
    cursor=index;
  }
  assert.match(html,/<h1 id="builder-title" tabindex="-1">Core Info<\/h1>/);
  assert.match(html,/>Who you are and where you trained\.<\/p>/);

  const ordered=[
    'for="fullName">Full name',
    'for="medicalSchool">Medical school',
    'for="medicalSchoolCountry">Medical school country',
    'for="core-graduation-date">Graduation date',
    "I haven't graduated yet",
    "<legend>Degree",
    'for="visaStatus">Visa / work status'
  ];
  cursor=-1;
  for(const fragment of ordered){
    const index=html.indexOf(fragment);
    assert.ok(index>cursor,fragment);
    cursor=index;
  }
  assert.match(html,/placeholder="e\.g\., Amara Osei"/);
  assert.match(html,/data-typeahead-provider="schools"/);
  assert.match(html,/data-typeahead-provider="countries"/);
  assert.equal(document.events.length,0,"rendering must not fabricate an Education event");
  assert.equal(document.exams.length,0,"rendering must not pre-add exams");
});

test("Canvas Details reuses the owning Builder entry fields",()=>{
  const document=defaultDocument();
  const event=eventFromBuilderEntry("clinical",{
    institution:"Harbor Teaching Hospital",
    institutionShortName:"Harbor",
    specialty:"Internal Medicine",
    rotationType:"Sub-internship",
    city:"Boston",
    state:"MA",
    startDate:"2025-06",
    endDate:"2025-07",
    current:false,
    notes:"Ward team"
  },{entryId:"clinical-entry-1",eventId:"clinical-event-1"});
  document.events.push(event);

  const html=renderBuilderEntryDetails(document,event);
  assert.match(html,/data-entry-form="clinical"/);
  assert.match(html,/>Edit rotation</);
  assert.match(html,/value="Harbor Teaching Hospital"/);
  assert.match(html,/value="Internal Medicine"/);
  assert.match(html,/value="Sub-internship" selected/);
  assert.match(html,/value="Jun 2025"/);
  assert.match(html,/data-save-entry="clinical">Save changes</);
});

test("Step state is pure and follows required, committed-entry, and skip rules exactly",()=>{
  const document=defaultDocument();
  assert.deepEqual(builderStepStates(document),[
    "untouched","untouched","untouched","untouched","untouched","untouched","none"
  ]);

  document.studentProfile.fullName="Amara";
  assert.equal(builderStepState(document,1),"started");
  document.studentProfile=validProfile();
  assert.equal(builderStepState(document,1),"complete");

  document.studentProfile.degree="Other";
  document.studentProfile.degreeOther="";
  assert.equal(builderStepState(document,1),"started","Other(text) is not complete without text");
  document.studentProfile.degreeOther="MBBCh";
  assert.equal(builderStepState(document,1),"complete");

  const builder=ensureBuilderState(document);
  builder.skipped.push(2,4);
  assert.equal(builderStepState(document,2),"skipped");
  assert.equal(builderStepState(document,4),"skipped");
  builder.examSystems.push("USMLE");
  assert.equal(builderStepState(document,2),"started");
  document.exams.push({id:"exam-1",system:"USMLE",examId:"step-2-ck"});
  assert.equal(builderStepState(document,2),"complete");
});

test("Core validation uses only frozen messages and creates the canonical Education milestone",()=>{
  assert.deepEqual(validateCoreInfo({}),{
    fullName:"Required.",
    medicalSchool:"Required.",
    medicalSchoolCountry:"Required.",
    graduationDate:"Required.",
    degree:"Required."
  });
  assert.equal(
    validateCoreInfo(validProfile({graduationDate:"June 28"})).graduationDate,
    "Enter a month and year, like 'Jun 2023'."
  );

  const document=defaultDocument();
  document.studentProfile=validProfile();
  const event=syncEducationMilestone(document,{idFactory:ids()});
  assert.deepEqual({
    title:event.title,
    categoryId:event.categoryId,
    eventType:event.eventType,
    startDate:event.startDate,
    visibilityState:event.visibilityState,
    sourceType:event.sourceType,
    builderDomain:event.fields.builderDomain,
    educationMilestone:event.fields.educationMilestone,
    country:event.fields.medicalSchoolCountry
  },{
    title:"Medical Degree — UGMS",
    categoryId:"education",
    eventType:"milestone",
    startDate:"2028-06",
    visibilityState:"INTERVIEWER_SAFE",
    sourceType:"guided-builder",
    builderDomain:"core",
    educationMilestone:true,
    country:"Ghana"
  });
  syncEducationMilestone(document,{idFactory:ids()});
  assert.equal(document.events.length,1,"Core edits must upsert rather than duplicate the degree");
});

test("USMLE and COMLEX are independent, chip-added, and retain score/result/date priority",()=>{
  const document=defaultDocument();
  const builder=ensureBuilderState(document);
  builder.step=2;
  builder.examSystems=["USMLE","COMLEX-USA"];

  const emptyHtml=renderBuilder({document});
  assert.equal((emptyHtml.match(/data-add-exam-system=/g)||[]).length,6);
  assert.match(emptyHtml,/>USMLE<\/span>/);
  assert.match(emptyHtml,/>COMLEX-USA<\/span>/);
  assert.match(emptyHtml,/>No exams added yet\.<\/p>/);
  assert.doesNotMatch(emptyHtml,/data-exam-card/);

  document.exams=[
    {
      id:"step-one",
      system:"USMLE",
      examId:"step-1",
      name:"Step 1",
      passFailOnly:true,
      attempt:1,
      result:"Passed",
      score:"",
      examDate:"2025-05",
      studyStartDate:"2025-01",
      showScoreOnTimeline:false
    },
    {
      id:"level-two",
      system:"COMLEX-USA",
      examId:"level-2-ce",
      name:"Level 2-CE",
      passFailOnly:false,
      attempt:1,
      result:"Awaiting result",
      score:"650",
      examDate:"2026-06",
      studyStartDate:"2026-02",
      showScoreOnTimeline:false
    }
  ];
  const html=renderBuilder({document});
  const stepOne=html.slice(html.indexOf('data-exam-id="step-one"'),html.indexOf("</article>",html.indexOf('data-exam-id="step-one"')));
  assert.doesNotMatch(stepOne,/Score \(optional\)/,"pass/fail-only exams hide score");

  const levelTwo=html.slice(html.indexOf('data-exam-id="level-two"'),html.indexOf("</article>",html.indexOf('data-exam-id="level-two"')));
  assert.ok(levelTwo.indexOf("<legend>Result")<levelTwo.indexOf("Score (optional)"));
  assert.ok(levelTwo.indexOf("Score (optional)")<levelTwo.indexOf("Exam date (taken)"));
  assert.ok(levelTwo.indexOf("Exam date (taken)")<levelTwo.indexOf("Started studying (optional)"));
  assert.match(levelTwo,/Show score on timeline/);

  assert.equal(validateExam({system:"USMLE",result:"Passed",examDate:"2024-01",score:"301"}).score,"USMLE scores run 1–300.");
  assert.equal(validateExam({system:"COMLEX-USA",result:"Passed",examDate:"2024-01",score:"8"}).score,"COMLEX scores run 9–999.");
  assert.deepEqual(validateExam({system:"USMLE",result:"Awaiting result",examDate:"2024-01",score:""}),{});
  assert.deepEqual(Object.keys(EXAM_SYSTEMS),["USMLE","COMLEX-USA"]);
});

test("Clinical, Work, Research, and Personal render exact frozen field order and one-at-a-time entry cards",()=>{
  const document=defaultDocument();
  const expectations=[
    {
      step:3,
      title:"US Clinical Rotations",
      purpose:"One rotation at a time. We'll fill in what we can.",
      fragments:["Add a rotation","Institution","Specialty","Rotation type","City","State","Start","End","Currently on this rotation","Notes (optional)","Add rotation"]
    },
    {
      step:4,
      title:"Work Experience",
      purpose:"Clinical or not, US or abroad — work belongs on the story.",
      fragments:["Add work experience","Role / title","Organization","Country","City (optional)","Kind","Start","End","I still work here","One-line description (optional)"]
    },
    {
      step:5,
      title:"Research",
      purpose:"Projects, posters, and papers — with your author position.",
      fragments:["Add research","Project title","Institution / lab","Role","Start","End","Ongoing","Publication status"]
    },
    {
      step:6,
      title:"Personal",
      purpose:"The life behind the CV — moves, family, service, anything that shaped the journey.",
      fragments:["Add personal event","What happened","When","Date","Icon","Visibility"]
    }
  ];

  for(const expectation of expectations){
    ensureBuilderState(document).step=expectation.step;
    const html=renderBuilder({document});
    assert.match(html,new RegExp(`<h1 id="builder-title" tabindex="-1">${expectation.title}</h1>`));
    assert.ok(html.replaceAll("&#039;","'").includes(expectation.purpose));
    let cursor=-1;
    for(const fragment of expectation.fragments){
      const index=html.indexOf(fragment,cursor+1);
      assert.ok(index>cursor,`${expectation.title}: ${fragment}`);
      cursor=index;
    }
    assert.equal((html.match(/data-entry-form=/g)||[]).length,1);
    assert.match(html,/>I have nothing to add here → skip<\/button>/);
  }

  ensureBuilderState(document).step=3;
  let html=renderBuilder({document});
  for(const type of ["Elective","Sub-internship","Observership","Externship","Clerkship (core)","Other"])assert.ok(html.includes(`>${type}</option>`));
  assert.match(html,/data-typeahead-provider="usTeachingInstitutions"/);
  assert.match(html,/data-typeahead-provider="specialties"/);

  const research=ensureBuilderState(document).drafts.research;
  research.publicationStatus="Published";
  research.markPublication=true;
  ensureBuilderState(document).step=5;
  html=renderBuilder({document});
  for(const value of ["Journal / venue","Publication year","Author position","DOI or PMID (optional)","Mark the publication on the timeline"])assert.ok(html.includes(value));
  for(const position of ["First author","Co-first author","Second author","Middle author","Last / senior author","Corresponding author"])assert.ok(html.includes(`>${position}</option>`));

  ensureBuilderState(document).step=6;
  html=renderBuilder({document});
  assert.equal((html.match(/name="icon"/g)||[]).length,12);
  assert.deepEqual(PERSONAL_ICONS,["heart","home","plane","baby","ring","star","flag","globe","shield","sun","book","sparkle"]);
  assert.match(html,/value="INTERVIEWER_SAFE"/);
  assert.match(html,/value="ADVISOR_ONLY"/);
});

test("Typeahead interfaces use injected results, cap matches at eight, and always end exact free-text workflows with no bundled fabrication",async()=>{
  const calls=[];
  const providers=typeaheadProviders({
    specialties:{search:async(query,options)=>{calls.push({query,options});return[{name:"Internal Medicine"}];}}
  });
  assert.deepEqual(await providers.schools.search("Ya"),[]);
  assert.deepEqual(await providers.usTeachingInstitutions.search("Ma"),[]);
  assert.deepEqual(await providers.institutions.search("Ma"),[]);

  const matches=Array.from({length:10},(_,index)=>({
    id:`site-${index}`,
    name:`Teaching Site ${index}`,
    city:"Boston",
    state:"MA"
  }));
  const rows=typeaheadRows("Mass",matches);
  assert.equal(rows.length,9);
  assert.equal(rows[0].label,"Teaching Site 0 — Boston, MA");
  assert.deepEqual(rows.at(-1),{
    id:"free-text",
    kind:"free-text",
    value:"Mass",
    label:'Use "Mass" as written'
  });
  assert.deepEqual(typeaheadRows("M",matches),[]);

  const result=await providers.specialties.search("Int",{limit:8});
  assert.deepEqual(result,[{name:"Internal Medicine"}]);
  assert.deepEqual(calls,[{query:"Int",options:{limit:8}}]);

  const countries=rankCountryMatches(["Zimbabwe","United States","Ghana","Albania"],{schoolCountry:"Ghana"});
  assert.deepEqual(countries,["Ghana","United States","Albania","Zimbabwe"]);
});

test("Entry validation uses frozen required and date-order messages without adding IMG assumptions",()=>{
  assert.deepEqual(validateBuilderEntry("work",{
    role:"",
    organization:"",
    country:"",
    kind:"",
    startDate:"2025-03",
    endDate:"2025-02"
  }),{
    role:"Required.",
    organization:"Required.",
    country:"Required.",
    kind:"Required.",
    endDate:"End date is before the start date."
  });
  assert.deepEqual(validateBuilderEntry("research",{
    projectTitle:"Hypertension study",
    publicationStatus:"Published",
    journal:"",
    publicationYear:"",
    authorPosition:""
  }),{
    journal:"Required.",
    publicationYear:"Required.",
    authorPosition:"Required."
  });
  assert.deepEqual(validateBuilderEntry("personal",{happened:""}),{happened:"Required."});
  assert.deepEqual(validateBuilderEntry("clinical",{startDate:"2025-04",endDate:"2025-03"}),{
    endDate:"End date is before the start date."
  });
});

test("Unlimited entry commits preserve canonical category, visibility, advisor-only fields, publication linkage, and edit/delete ownership",()=>{
  const document=defaultDocument();
  const idFactory=ids();

  const clinical=commitBuilderEntry(document,"clinical",{
    institution:"Massachusetts General Hospital",
    institutionShortName:"Mass General",
    specialty:"Internal Medicine",
    rotationType:"Observership",
    city:"Boston",
    state:"MA",
    startDate:"2025-01",
    endDate:"",
    current:true,
    notes:"Dr. Rivera"
  },{idFactory});
  assert.equal(clinical.ok,true);
  assert.deepEqual({
    title:clinical.event.title,
    categoryId:clinical.event.categoryId,
    openEnded:clinical.event.openEnded,
    visibilityState:clinical.event.visibilityState,
    rotationType:clinical.event.fields.rotationType,
    notes:clinical.event.notes,
    domain:clinical.event.fields.builderDomain
  },{
    title:"Internal Medicine · Mass General",
    categoryId:"clinical",
    openEnded:true,
    visibilityState:"INTERVIEWER_SAFE",
    rotationType:"Observership",
    notes:"Dr. Rivera",
    domain:"clinical"
  });

  const work=commitBuilderEntry(document,"work",{
    role:"Medical Officer",
    organization:"Korle Bu Teaching Hospital",
    country:"Ghana",
    city:"Accra",
    kind:"Clinical",
    startDate:"2022-01",
    endDate:"2023-12",
    current:false,
    description:"Inpatient clinical care"
  },{idFactory});
  assert.equal(work.ok,true);
  assert.equal(work.event.categoryId,"work");
  assert.equal(work.event.fields.country,"Ghana");
  assert.equal(work.event.fields.kind,"Clinical");
  assert.equal(work.event.notes,"Inpatient clinical care");

  const research=commitBuilderEntry(document,"research",{
    projectTitle:"Hypertension outcomes",
    institution:"University Lab",
    role:"Research fellow",
    startDate:"2023-01",
    endDate:"2024-08",
    ongoing:false,
    publicationStatus:"Published",
    journal:"Medical Science",
    publicationYear:"2025",
    authorPosition:"Co-first author",
    doiOrPmid:"10.1000/example",
    markPublication:true
  },{idFactory});
  assert.equal(research.ok,true);
  const publication=document.events.find((event)=>event.fields.publicationMilestone);
  assert.equal(publication.title,"Medical Science · co-1st");
  assert.equal(publication.startDate,"2025-01");
  assert.equal(publication.fields.builderEntryId,research.entryId);

  const personal=commitBuilderEntry(document,"personal",{
    happened:"Moved to the US",
    whenKind:"One date",
    startDate:"2024-06",
    endDate:"",
    icon:"plane",
    visibilityState:VISIBILITY.ADVISOR_ONLY
  },{idFactory});
  assert.equal(personal.ok,true);
  assert.equal(personal.event.categoryId,"personal");
  assert.equal(personal.event.eventType,"milestone");
  assert.equal(personal.event.visibilityState,"ADVISOR_ONLY");
  assert.equal(personal.event.fields.icon,"plane");
  assert.ok(!("imgStatus" in personal.event.fields),"country data must not infer IMG status");
  assert.ok(!("residencyStatus" in personal.event.fields),"journey data must not infer residency status");

  assert.equal(beginBuilderEntryEdit(document,research.event.id),true);
  assert.equal(builderStepForEvent(research.event),5);
  assert.equal(document.builder.step,5);
  assert.equal(document.builder.editing.research,research.entryId);
  assert.equal(document.builder.drafts.research.projectTitle,"Hypertension outcomes");

  assert.equal(deleteBuilderEntry(document,research.event.id),true);
  assert.equal(document.events.some((event)=>event.fields.builderEntryId===research.entryId),false,"project and linked publication are removed together");
  assert.equal(document.builder.editing.research,undefined);

  const secondClinical=commitBuilderEntry(document,"clinical",{
    institution:"Community Clinic",
    specialty:"Pediatrics",
    rotationType:"Elective",
    startDate:"2026-01",
    endDate:"2026-02"
  },{idFactory});
  assert.equal(secondClinical.ok,true);
  assert.equal(document.events.filter((event)=>event.fields.builderDomain==="clinical").length,2,"entry model is unlimited");

  assert.equal(beginBuilderEntryEdit(document,document.events.find((event)=>event.fields.builderDomain==="personal").id),true);
  assert.equal(document.builder.step,6);
});

class FakeElement{
  constructor(dataset={}){
    this.dataset=dataset;
    this.listeners=new Map();
    this.disabled=false;
  }
  addEventListener(type,listener){this.listeners.set(type,listener);}
  async fire(type){
    const listener=this.listeners.get(type);
    assert.ok(listener,`missing ${type} listener`);
    return listener({preventDefault(){}});
  }
}

function fakeRoot({stepButtons=[],back=null,next=null,skip=null,coreForm=null}={}){
  return{
    querySelectorAll(selector){
      if(selector==="[data-builder-step]")return stepButtons;
      return[];
    },
    querySelector(selector){
      return({
        "[data-builder-back]":back,
        "[data-builder-next]":next,
        "[data-skip-step]":skip,
        "[data-core-form]":coreForm
      })[selector]||null;
    }
  };
}

function fakeStore(document){
  return{
    document,
    routes:[],
    mutations:[],
    mutate(label,operation,options){
      operation(this.document);
      this.mutations.push({label,options});
      return true;
    },
    navigate(route){this.routes.push(route);}
  };
}

function fakeCoreForm(values){
  const controls=new Map(Object.entries(values).map(([name,value])=>[name,{
    name,
    value:typeof value==="boolean"?"":value,
    type:typeof value==="boolean"?"checkbox":"text",
    checked:!!value
  }]));
  return{
    elements:{namedItem:(name)=>controls.get(name)||null},
    querySelectorAll:()=>[],
    querySelector:()=>null
  };
}

test("Installed handlers preserve free step navigation, exact skip semantics, and the sole Step 1 Continue gate",async()=>{
  const document=defaultDocument();
  ensureBuilderState(document).step=3;
  const chooseSix=new FakeElement({builderStep:"6"});
  const back=new FakeElement();
  const next=new FakeElement();
  const skip=new FakeElement();
  const root=fakeRoot({stepButtons:[chooseSix],back,next,skip});
  const store=fakeStore(document);
  installBuilder(root,store,{idFactory:ids()});

  await chooseSix.fire("click");
  assert.equal(document.builder.step,6);
  await back.fire("click");
  assert.equal(document.builder.step,5);
  document.builder.drafts.research.projectTitle="Uncommitted draft";
  await skip.fire("click");
  assert.equal(document.builder.step,6);
  assert.deepEqual(document.builder.skipped,[5]);
  assert.equal(document.builder.drafts.research.projectTitle,"");
  assert.equal(builderStepState(document,5),"skipped");
  await next.fire("click");
  assert.equal(document.builder.step,7);
  await next.fire("click");
  assert.deepEqual(store.routes,["canvas"]);

  const coreDocument=defaultDocument();
  const coreNext=new FakeElement();
  const coreForm=fakeCoreForm({
    fullName:"Amara Osei",
    medicalSchool:"University of Ghana Medical School",
    medicalSchoolCountry:"Ghana",
    "core-graduation-date":"Jun 2028",
    expectedGraduation:true,
    degree:"MBBS",
    degreeOther:"",
    visaStatus:"Need J-1",
    visaStatusOther:""
  });
  const coreRoot=fakeRoot({next:coreNext,coreForm});
  const coreStore=fakeStore(coreDocument);
  installBuilder(coreRoot,coreStore,{idFactory:ids()});
  await coreNext.fire("click");
  assert.equal(coreDocument.builder.step,2);
  assert.equal(coreDocument.events[0].title,"Medical Degree — University of Ghana Medical School");

  const invalidDocument=defaultDocument();
  const invalidNext=new FakeElement();
  const invalidRoot=fakeRoot({next:invalidNext,coreForm:fakeCoreForm({})});
  installBuilder(invalidRoot,fakeStore(invalidDocument),{idFactory:ids()});
  await invalidNext.fire("click");
  assert.equal(invalidDocument.builder.step,1,"Step 1 alone blocks Continue until core anchors are valid");
});
