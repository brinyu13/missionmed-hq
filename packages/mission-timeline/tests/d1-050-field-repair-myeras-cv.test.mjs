import test from "node:test";
import assert from "node:assert/strict";
import {parseErasCvPages,isErasCvLayout,erasIdentityClaim} from "../web/js/ingestion/eras-cv-parser.js";
import {createD1408PdfIntakeAdapter} from "../web/js/uxr-002/intake-d1-408-adapter.js";
import {
  IntakeStateMachine,renderIntake,buildApprovalBatch,applyApprovalBatchToDocument,
  reviewSummary,identityDecisionRequired,identityReview,createIntakeState,transitionIntake
} from "../web/js/uxr-002/intake.js";
import {defaultDocument} from "../web/js/uxr-002/store.js";
import {analyzeTimelineQuality,applySafeQualityFixes} from "../web/js/uxr-002/quality-guardian.js";
import {deriveFounderYearDomain,clampTimelineSpanToDomain,deriveTimelineSpan} from "../web/js/uxr-002/adaptive-layout.js";
import {serializeFounderPresentation} from "../web/js/presentation/founder-presentation-serializer.js";
import {resolveFounderPresentationSvg} from "../web/js/presentation/resolved-founder-presentation.js";
import {founderConciseRole,founderConciseInstitution,deriveFounderEventDisplay} from "../web/js/presentation/founder-display-rules.js";

/* Synthetic applicant in the exact MyERAS CV layout (browser text-layer line model):
   page header "Lastname, First (AAMC ID)", fixed section headings, one experience block
   per entry with "<institution> MM/YYYY - MM/YYYY" and "<type> City, ST" lines. */
const CHROME=["Confidential - Do not disclose or distribute applicant information to persons outside the residency/fellowship application process."];
const PAGE_1=[
  "Synthetic, Avery Lane (99000001)","Curriculum Vitae","Synthetic, Avery Lane (Avery )","They/Them","AAMC ID: 99000001",
  "Present Mailing Address Permanent Mailing Address","1 Synthetic Way 1 Synthetic Way","avery@example.invalid",
  "Medical Education","Synthetic Medical College, Testland","08/2019 - 01/2026","M.B.,B.S. , 05/2026",
  "Postgraduate Training","None",
  "Honors & Awards","Top Synthetic Award","Research - Received the synthetic award at a synthetic meeting.","Received: Jan, 2026",
  "Professional Memberships","Synthetic Society","Page 1",...CHROME
];
const PAGE_2=[
  "Synthetic, Avery Lane (99000001)","Curriculum Vitae",
  "Hobbies & Interests","- Chess: club play","- Hiking",
  "Certifications","Other Certifications:","ECFMG Certification: Jun, 2026 - Dec, 2029","HIPAA: Jul, 2025 - Jul, 2026",
  "Experiences",
  "Clinical Elective","Cardiac Unit, Synthetic Einstein College of Medicine 10/2025 - 10/2025","Education/training Bronx, NY",
  "- One-month inpatient cardiology elective at Synthetic Einstein under Dr. Test.","Most Meaningful:","A synthetic reflection about treatment plans.",
  "Intern Doctor","Synthetic Medical College,Testville 06/2024 - 01/2026","Education/training Testville, Testland",
  "- Rotatory internship; treatment plans, deliveries and a diagnosis or two.",
  "Research Elective","Synthetic University, Test Lab 06/2026 - 07/2026","Research New Haven, CT","- Research elective in the Test Lab.",
  "Clinical Observership","Synthetic General Hospital 05/2026 - 05/2026","Education/training Pittsburgh, PA",
  "- Hematology/Oncology observership at Synthetic Health Network under Dr. Test.",
  "Clinical Observership","Synthetic Upstate Medical University 04/2026 - 04/2026","Education/training Syracuse, NY",
  "- Hospital Medicine observership at Synthetic Upstate alongside residents.",
  "Clinical Elective","Synthetic Hospital, Synthetic International University 09/2025 - 09/2025","Education/training Hialeah, FL",
  "- First U.S. clinical rotation: inpatient ID consult service at Synthetic Hospital.",
  "Cardiology Resident","Synthetic NIMS Hospital 08/2026 - Present","Work Wandoor, Testland","- Junior resident on 24-hour calls.",
  "Volunteer","Synthetic Palliative Institute 08/2019 - 01/2026","Volunteer/service/advocacy Testville, Testland","- Home visits for bed-bound patients.",
  "Team Captain","Synthetic FC 08/2019 - 01/2026","Other extracurricular activities/clubs Testville, Testland","- Captain of the college team.","Page 2",...CHROME
];
const PAGE_3=[
  "Synthetic, Avery Lane (99000001)","Curriculum Vitae",
  "Team Captain","- Led training sessions.","Most Meaningful:","Consistency.",
  "Scholarly Work","Journal Article (peer-reviewed)",
  "Synthetic A, Tester B. A synthetic study of nothing in particular. Journal of Synthetic Results. July 2026; 1(1):1-2.",
  "Publication Status: Published.",
  "Oral Presentation",
  "Synthetic A. A synthetic talk. Oral presentation: Synthetic Conference 2026; 03/2026. Washington, DC.",
  "Event Link: https://example.invalid/",
  "Proficient Languages","English","Testish","Page 3",...CHROME
];
function pages(){
  return [PAGE_1,PAGE_2,PAGE_3].map((lines,index)=>({id:`synthetic-eras:page:${index+1}`,sourceDocumentId:"synthetic-eras",pageNumber:index+1,lines,text:lines.join("\n"),charCount:lines.join("\n").length,textLayerPresent:true,extractionMethod:"PDFJS_TEXT_LAYER"}));
}
function extraction(){
  const list=pages();const text=list.map((page)=>page.text).join("\n");
  return{status:"EXTRACTED",sourceDocumentId:"synthetic-eras",inspected:{name:"synthetic_myeras_cv.pdf",size:2048,mimeType:"application/pdf",sha256:"c".repeat(64)},pageCount:3,charCount:text.length,text,extractionMethod:"PDFJS_TEXT_LAYER",warnings:[],pages:list};
}
const file=()=>({name:"synthetic_myeras_cv.pdf",type:"application/pdf",size:2048,arrayBuffer:async()=>new TextEncoder().encode("%PDF-1.7 synthetic").buffer});
async function extract(){
  return createD1408PdfIntakeAdapter({pdfExtractor:async()=>extraction()}).extract({file:file(),documentType:"CV"});
}
async function reviewMachine(profile={}){
  const adapter=createD1408PdfIntakeAdapter({pdfExtractor:async()=>extraction()});
  const machine=new IntakeStateMachine({adapter,existingProfile:profile,narrationDelay:null,idFactory:(prefix)=>`${prefix}-${Math.random().toString(16).slice(2,8)}`});
  machine.receiveFile(file());machine.setConsent(true);
  await machine.startExtraction();
  return machine;
}

test("MyERAS CV layout: identity, education span, degree milestone, experiences with type and location, records and profile claims",()=>{
  const list=pages();
  assert.equal(isErasCvLayout(list),true);
  const identity=erasIdentityClaim(list);
  assert.deepEqual({fullName:identity.fullName,sourceForm:identity.sourceForm,aamcId:identity.aamcId,preferredName:identity.preferredName},{fullName:"Avery Lane Synthetic",sourceForm:"Synthetic, Avery Lane",aamcId:"99000001",preferredName:"Avery"});
  assert.equal(identity.provenance.length,2,"page header and explicit AAMC line are the evidence");
  const parsed=parseErasCvPages(list);
  const experiences=parsed.records.filter((record)=>record.section==="experiences");
  assert.deepEqual(experiences.map((record)=>record.title),["Clinical Elective","Intern Doctor","Research Elective","Clinical Observership","Clinical Observership","Clinical Elective","Cardiology Resident","Volunteer","Team Captain"],"a title beginning with a type word still starts an entry");
  const observership=experiences[3];
  assert.equal(observership.organization,"Synthetic General Hospital");
  assert.equal(observership.dates,"05/2026 - 05/2026");
  assert.equal(observership.experienceType,"Education/training");
  assert.equal(observership.location,"Pittsburgh, PA");
  assert.equal(observership.specialty,"Hematology/Oncology","specialty comes from the applicant's own bullet");
  assert.equal(observership.fields.specialtyEvidence.support,"INFERRED");
  assert.equal(experiences[5].specialty,"Infectious Diseases");
  assert.equal(experiences[0].specialty,"Cardiology");
  assert.equal(experiences[6].dates,"08/2026 - Present");
  assert.equal(experiences[8].sourceBlocks.some((block)=>block.text==="- Led training sessions."),true,"a title repeated on the next page continues the entry");
  const education=parsed.records.filter((record)=>record.section==="education");
  assert.equal(education[0].organization,"Synthetic Medical College");
  assert.equal(education[0].dates,"08/2019 - 01/2026");
  assert.equal(education[1].title,"M.B.,B.S.");
  assert.equal(education[1].dates,"05/2026");
  assert.deepEqual({school:parsed.profile.medicalSchool.value,country:parsed.profile.medicalSchoolCountry.value,degree:parsed.profile.degree.value,grad:parsed.profile.graduationDate.value,languages:parsed.profile.languages.value,hobbies:parsed.profile.hobbies.value},
    {school:"Synthetic Medical College",country:"Testland",degree:"M.B.,B.S.",grad:"2026-05",languages:"English, Testish",hobbies:"Chess, Hiking"});
  assert.equal(parsed.records.filter((record)=>record.section==="honors").length,1);
  assert.equal(parsed.records.filter((record)=>record.section==="certifications").length,2);
  const scholarly=parsed.records.filter((record)=>record.section==="scholarly_work");
  assert.equal(scholarly.length,2);
  assert.equal(scholarly[0].title,"A synthetic study of nothing in particular");
  assert.equal(scholarly[0].organization,"Journal of Synthetic Results");
  assert.equal(scholarly[0].dates,"July 2026");
  assert.equal(scholarly[1].fields.scholarlyKind,"ABSTRACT_POSTER_PRESENTATION");
  assert.equal(scholarly[1].dates,"03/2026");
});

test("adapter reads the MyERAS layout structurally whatever the filename-based type says, classifies obvious rotations as USCE, and never asks for stated facts",async()=>{
  const result=await extract();
  assert.equal(result.parser.layout,"MYERAS_CV");
  assert.equal(result.parser.sourceIdentity.fullName,"Avery Lane Synthetic");
  const byTitle=(title,institution)=>result.candidates.find((candidate)=>candidate.title===title&&(!institution||candidate.fields.institution===institution||candidate.fields.organization===institution));
  const allegheny=byTitle("Clinical Observership","Synthetic General Hospital");
  assert.equal(allegheny.categoryId,"clinical");
  assert.equal(allegheny.fields.canonicalType,"OBSERVERSHIP");
  assert.equal(allegheny.confidence,"high");
  assert.deepEqual([allegheny.startDate,allegheny.endDate,allegheny.fields.city,allegheny.fields.state,allegheny.fields.country,allegheny.fields.specialty],["2026-05","2026-05","Pittsburgh","PA","United States","Hematology/Oncology"]);
  const resident=byTitle("Cardiology Resident");
  assert.equal(resident.categoryId,"work");assert.equal(resident.openEnded,true);assert.equal(resident.endDate,null);
  assert.equal(byTitle("Intern Doctor").fields.canonicalType,"INTERNSHIP_HOUSE_OFFICER");
  assert.equal(byTitle("Research Elective").categoryId,"research");
  assert.equal(byTitle("Volunteer").fields.canonicalType,"VOLUNTEER_EXPERIENCE");
  assert.equal(byTitle("Team Captain").fields.canonicalType,"LEADERSHIP");
  assert.equal(byTitle("ECFMG Certification").categoryId,"exams");
  assert.equal(byTitle("HIPAA").fields.sourceRecordOnly,true,"a course certificate is a record, not a drawn event");
  assert.equal(byTitle("Top Synthetic Award").fields.sourceRecordOnly,true);
  const degree=byTitle("M.B.,B.S.");
  assert.equal(degree.fields.canonicalType,"MEDICAL_DEGREE");
  assert.equal(degree.fields.degree,"MBBS");
  assert.equal(degree.fields.acceptProfileClaims,true,"explicit MyERAS profile facts are prefilled");
  assert.equal(degree.fields.profileClaims.languages.value,"English, Testish");
  assert.equal(result.parser.qualitySuggestions.filter((item)=>item.type==="POSSIBLE_DUPLICATE").length,0,"two observerships at different hospitals are not duplicates");
  assert.equal(result.parser.qualitySuggestions.filter((item)=>item.type==="LABEL_READABILITY").length,0,"record-only entries never raise card readability warnings");
});

test("review: ready/attention summary, compact ready rows, section acceptance and record grouping",async()=>{
  const machine=await reviewMachine();
  const state=machine.snapshot();
  const summary=reviewSummary(state);
  assert.equal(summary.total,state.candidates.length);
  assert.equal(summary.ready,12,"education span, degree, ECFMG and nine experiences are ready");
  assert.equal(summary.records,4,"award, HIPAA, article and talk are kept as records");
  assert.equal(summary.attention,0);
  const html=renderIntake(state);
  assert.match(html,/We found <strong>16<\/strong> items\. <strong>12<\/strong> look ready, plus 4 records we keep but do not draw\. <strong>0<\/strong> need your attention\./);
  assert.match(html,/data-review-group="ready"/);
  assert.match(html,/data-review-group="records"/);
  assert.match(html,/data-compact-candidate="true"/);
  assert.match(html,/data-accept-section="/);
  assert.match(html,/synthetic_myeras_cv\.pdf/);
  assert.match(html,/data-intake-identity="empty"/);
  const ready=state.candidates.filter((candidate)=>candidate.confidence==="high"&&candidate.fields?.sourceRecordOnly!==true).map(({id})=>id);
  machine.acceptSection(ready);
  const after=machine.snapshot();
  assert.equal(after.candidates.filter((candidate)=>candidate.decision==="accepted").length,12);
  assert.equal(after.candidates.filter((candidate)=>candidate.fields?.sourceRecordOnly===true&&candidate.decision==="undecided").length,4,"section acceptance leaves other groups alone");
});

test("duplicate groups offer Keep A, Keep B, Merge and Keep both without deleting anything",()=>{
  const twin=(id,institution)=>({id,title:"Clinical Observership",categoryId:"clinical",startDate:"2026-05",endDate:"2026-05",confidence:"high",provenance:[{sourceExcerpt:`${id} evidence`}],fields:{institution,canonicalType:"OBSERVERSHIP"}});
  const base=createIntakeState({candidates:[twin("a","Synthetic General Hospital"),twin("b","Synthetic General Hospital")],suggestions:[{id:"dup-1",type:"POSSIBLE_DUPLICATE",severity:"REVIEW",candidateIds:["a","b"],reason:"Read twice.",recommendation:"Decide.",source:"DETERMINISTIC"}]});
  base.stage="review";
  const html=renderIntake(base);
  assert.match(html,/data-duplicate-group="dup-1"/);
  for(const choice of ["keep-a","keep-b","merge","keep-both"])assert.match(html,new RegExp(`data-duplicate-choice="${choice}"`));
  const keptA=transitionIntake(base,{type:"RESOLVE_DUPLICATE_GROUP",id:"dup-1",choice:"keep-a"});
  assert.deepEqual(keptA.candidates.map(({decision})=>decision),["accepted","rejected"]);
  assert.equal(keptA.candidates[1].fields.duplicateOf,"a");
  assert.equal(keptA.suggestions[0].status,"applied");
  const restored=transitionIntake(keptA,{type:"UNDO_SUGGESTION",id:"dup-1"});
  assert.deepEqual(restored.candidates.map(({decision})=>decision),["undecided","undecided"]);
  const merged=transitionIntake(base,{type:"RESOLVE_DUPLICATE_GROUP",id:"dup-1",choice:"merge"});
  assert.equal(merged.candidates[0].provenance.length,2,"merge keeps both entries' evidence");
  assert.equal(merged.candidates[1].fields.duplicateDecision,"merged");
  const both=transitionIntake(base,{type:"RESOLVE_DUPLICATE_GROUP",id:"dup-1",choice:"keep-both"});
  assert.deepEqual(both.candidates.map(({decision})=>decision),["accepted","accepted"]);
});

test("identity: an empty Timeline adopts the document's applicant; a different name blocks approval until the student chooses",async()=>{
  const empty=await reviewMachine({});
  assert.equal(empty.snapshot().identity.status,"empty");
  assert.equal(identityDecisionRequired(empty.snapshot()),false);
  empty.acceptAllHighConfidence();
  const document=defaultDocument({id:"doc-empty"});
  await empty.approveAccepted({saveVersion:async()=>{},applyBatch:async(batch)=>applyApprovalBatchToDocument(document,batch)});
  assert.equal(document.studentProfile.fullName,"Avery Lane Synthetic");
  assert.equal(document.studentProfile.aamcDisplay,"99000001");
  assert.equal(document.studentProfile.fieldProvenance.fullName.sourceType,"document-identity");
  assert.equal(document.studentProfile.fullNameProvenance.length,2);
  assert.deepEqual({school:document.studentProfile.medicalSchool,degree:document.studentProfile.degree,grad:document.studentProfile.graduationDate,languages:document.studentProfile.languages},{school:"Synthetic Medical College",degree:"MBBS",grad:"2026-05",languages:"English, Testish"});
  assert.equal(empty.snapshot().lastImport.identity.decision,"use-source");
  const rendered=serializeFounderPresentation(document,{currentMonth:"2026-10",scope:"INTERVIEWER_SAFE"});
  assert.match(rendered.svg,/Timeline: Avery Lane Synthetic/,"the adopted identity is visible on the interview-safe board");

  const other=await reviewMachine({fullName:"Placeholder Person",medicalSchool:"Placeholder School of Medicine",degree:"MD",graduationDate:"2027-05"});
  const state=other.snapshot();
  assert.equal(state.identity.status,"conflict");
  assert.equal(identityDecisionRequired(state),true);
  assert.match(renderIntake(state),/data-intake-identity="conflict"/);
  assert.match(renderIntake(state),/Confirm whose document this is first/);
  other.acceptAllHighConfidence();
  await assert.rejects(()=>other.approveAccepted({saveVersion:async()=>{},applyBatch:async()=>({})}),(error)=>error.code==="INTAKE_IDENTITY_UNDECIDED");
  other.decideIdentity("use-source");
  const conflicted={...defaultDocument({id:"doc-conflict"}),studentProfile:{...defaultDocument().studentProfile,fullName:"Placeholder Person",medicalSchool:"Placeholder School of Medicine",degree:"MD",graduationDate:"2027-05"}};
  await other.approveAccepted({saveVersion:async()=>{},applyBatch:async(batch)=>applyApprovalBatchToDocument(conflicted,batch)});
  assert.equal(conflicted.studentProfile.fullName,"Avery Lane Synthetic");
  assert.equal(conflicted.studentProfile.medicalSchool,"Synthetic Medical College","typed facts beside the replaced identity are replaced by the document's explicit facts");
  assert.equal(conflicted.studentProfile.identityReplacedProfile.medicalSchool,"Placeholder School of Medicine","what was replaced is recorded");
  assert.equal(conflicted.intake.sourceIdentity.previousName,"Placeholder Person");
});

test("identity: keeping the current name is explicit, and Guardian blocks a Timeline whose name no longer matches the adopted document",async()=>{
  const machine=await reviewMachine({fullName:"Placeholder Person"});
  machine.decideIdentity("keep-current");
  machine.acceptAllHighConfidence();
  const document={...defaultDocument({id:"doc-keep"}),studentProfile:{...defaultDocument().studentProfile,fullName:"Placeholder Person"}};
  await machine.approveAccepted({saveVersion:async()=>{},applyBatch:async(batch)=>applyApprovalBatchToDocument(document,batch)});
  assert.equal(document.studentProfile.fullName,"Placeholder Person");
  assert.equal(document.intake.sourceIdentity.decision,"keep-current");
  assert.ok(!analyzeTimelineQuality(document).findings.some((finding)=>finding.code==="IDENTITY_MISMATCH"),"an explicit keep-current decision is honoured");

  const adopted={...defaultDocument({id:"doc-adopted"})};
  const adopter=await reviewMachine({});
  adopter.acceptAllHighConfidence();
  await adopter.approveAccepted({saveVersion:async()=>{},applyBatch:async(batch)=>applyApprovalBatchToDocument(adopted,batch)});
  assert.ok(!analyzeTimelineQuality(adopted).findings.some((finding)=>finding.code==="IDENTITY_MISMATCH"));
  adopted.studentProfile.fullName="Placeholder Person";
  const mismatch=analyzeTimelineQuality(adopted).findings.find((finding)=>finding.code==="IDENTITY_MISMATCH");
  assert.equal(mismatch?.severity,"BLOCK_EXPORT");
  assert.match(mismatch.message,/Placeholder Person/);
  assert.match(mismatch.message,/Avery Lane Synthetic/);
});

test("identityReview compares names by their parts and treats an unresolved page identity as a hold",()=>{
  const claim={fullName:"Avery Lane Synthetic",sourceForm:"Synthetic, Avery Lane",aamcId:"1",provenance:[{sourceExcerpt:"x"}]};
  assert.equal(identityReview(claim,{fullName:"Synthetic, Avery Lane"}).status,"match");
  assert.equal(identityReview(claim,{fullName:"avery   lane SYNTHETIC"}).status,"match");
  assert.equal(identityReview(claim,{fullName:"Someone Else"}).status,"conflict");
  const unresolved=identityReview({conflict:true,reason:"Two applicants.",provenance:[]},{fullName:"Someone Else"});
  assert.equal(unresolved.status,"unresolved");
  assert.equal(unresolved.decision,null);
  assert.equal(identityReview(null,{}),null);
});

function founderEvent(id,{categoryId,title,startDate,endDate=null,openEnded=false,eventType="duration",canonicalType="",siteName="",location=""}){
  return{id,title,categoryId,eventType,startDate,endDate,openEnded,siteName,visibilityState:"INTERVIEWER_SAFE",fields:{canonicalType,institution:siteName,sourceLocation:location}};
}
function graduateEvents(){
  return[
    founderEvent("edu",{categoryId:"education",title:"Medical Education",startDate:"2019-08",endDate:"2026-01",canonicalType:"EDUCATION",siteName:"Synthetic Medical College"}),
    founderEvent("vol",{categoryId:"work",title:"Volunteer",startDate:"2019-08",endDate:"2026-01",canonicalType:"VOLUNTEER_EXPERIENCE",siteName:"Synthetic Palliative Institute"}),
    founderEvent("intern",{categoryId:"work",title:"Intern Doctor",startDate:"2024-06",endDate:"2026-01",canonicalType:"INTERNSHIP_HOUSE_OFFICER",siteName:"Synthetic Medical College"}),
    founderEvent("hialeah",{categoryId:"clinical",title:"Clinical Elective",startDate:"2025-09",endDate:"2025-09",canonicalType:"USCE_TEACHING_HOSPITAL",siteName:"Synthetic Hospital",location:"Hialeah, FL"}),
    founderEvent("einstein",{categoryId:"clinical",title:"Clinical Elective",startDate:"2025-10",endDate:"2025-10",canonicalType:"USCE_TEACHING_HOSPITAL",siteName:"Synthetic Einstein College of Medicine",location:"Bronx, NY"}),
    founderEvent("obs",{categoryId:"clinical",title:"Hematology and Oncology Observership",startDate:"2026-03",endDate:"2026-03",canonicalType:"OBSERVERSHIP",siteName:"Synthetic General Hospital",location:"Cleveland, OH"}),
    founderEvent("resident",{categoryId:"work",title:"Cardiology Resident",startDate:"2026-08",openEnded:true,canonicalType:"RESIDENCY_FELLOWSHIP",siteName:"Synthetic NIMS Hospital"})
  ];
}

test("Founder start-year rule: graduates open at the graduation year, bounded earlier experiences extend it, background spans are clamped",()=>{
  const document={studentProfile:{graduationDate:"2026-05",expectedGraduation:false}};
  const domain=deriveFounderYearDomain(document,graduateEvents(),{currentMonth:"2026-10"});
  assert.equal(domain.basis,"graduation-year");
  assert.equal(domain.defaultFirstYear,2026);
  assert.equal(domain.firstYear,2025,"the two 2025 electives would otherwise vanish");
  assert.deepEqual(domain.extensions.map((item)=>item.eventId).sort(),["einstein","hialeah"]);
  assert.deepEqual([...domain.clampedEventIds].sort(),["edu","intern","vol"],"school, volunteering and internship paint from the left edge");
  const span=clampTimelineSpanToDomain(deriveTimelineSpan(graduateEvents(),{currentMonth:"2026-10"}),domain);
  assert.equal(span.startMonth,"2025-01");
  assert.deepEqual(span.segments.map((segment)=>segment.year),[2025,2026]);

  const student=deriveFounderYearDomain({studentProfile:{graduationDate:"2027-05",expectedGraduation:true}},graduateEvents(),{currentMonth:"2026-10"});
  assert.equal(student.basis,"school-start-minus-one");
  assert.equal(student.firstYear,2018);

  const withMilestone=deriveFounderYearDomain(document,[...graduateEvents(),founderEvent("move",{categoryId:"personal",title:"Moved to the United States",startDate:"2016-06",eventType:"milestone",canonicalType:"LIFE_EVENT"})],{currentMonth:"2026-10"});
  assert.equal(withMilestone.firstYear,2016,"an intentionally included earlier personal milestone opens earlier years");
  assert.equal(deriveFounderYearDomain({studentProfile:{}},[founderEvent("x",{categoryId:"work",title:"Job",startDate:"2020-01",endDate:"2021-01"})],{currentMonth:"2026-10"}),null,"no school or graduation fact leaves the existing span untouched");
});

test("rendered board honours the year domain, paints clamped spans from the left edge with their institution beneath, and Guardian shortens overflowing roles safely",()=>{
  const document={...defaultDocument({id:"doc-domain"}),studentProfile:{...defaultDocument().studentProfile,fullName:"Avery Lane Synthetic",graduationDate:"2026-05"},events:graduateEvents(),metadata:{renderCurrentMonth:"2026-10"}};
  const rendered=serializeFounderPresentation(document,{currentMonth:"2026-10",scope:"FULL_STORY"});
  assert.equal(rendered.scene.yearDomain.firstYear,2025);
  assert.equal(rendered.scene.composedAxis.startYear,2025);
  assert.equal(rendered.scene.composedAxis.endYear,2026);
  assert.ok(rendered.scene.arrows.find((arrow)=>arrow.id==="vol").clampedStart,"the volunteer span is marked as beginning before the domain");
  assert.match(rendered.svg,/data-clamped-start="true"/);
  const paint=resolveFounderPresentationSvg(rendered.svg);
  const site=paint.nodes.filter((node)=>node.kind==="text"&&node.sourceAttributes["data-board-ink-role"]==="site");
  assert.ok(!site.some((node)=>node.sourceAttributes["data-text-overflow"]==="true"),"no institution is crushed into the left margin");
  const display=deriveFounderEventDisplay(document,document.events.find((event)=>event.id==="hialeah"));
  assert.equal(display.role,"Elective","generic rotation wording is trimmed for display only");
  assert.equal(document.events.find((event)=>event.id==="hialeah").title,"Clinical Elective");

  const report=analyzeTimelineQuality(document);
  const overflow=report.findings.find((finding)=>finding.code==="TEXT_CONTAINER_OVERFLOW");
  assert.ok(overflow,"one-month rotations overflow at native text size");
  assert.equal(overflow.actionMode,"FIX_FOR_ME");
  assert.equal(overflow.fixKind,"CONCISE_LABELS");
  const fixed=applySafeQualityFixes(document,report);
  const change=fixed.changes.find((item)=>item.kind==="CONCISE_LABELS");
  assert.ok(change,"the safe repair applied");
  assert.equal(fixed.document.events.find((event)=>event.id==="obs").title,"Hematology and Oncology Observership","source titles are untouched");
  assert.equal(typeof fixed.document.presentationOverrides.events.obs.role,"string");
  const after=analyzeTimelineQuality(fixed.document).findings.find((finding)=>finding.code==="TEXT_CONTAINER_OVERFLOW");
  assert.ok(!after||after.evidence.count<overflow.evidence.count,"fewer labels overflow after the repair");
  assert.equal(fixed.biographyFieldsChanged,false);
});

test("concise display helpers never change facts and shorten in steps",()=>{
  assert.equal(founderConciseRole("Clinical Elective"),"Elective");
  assert.equal(founderConciseRole("Clinical Observership",{maxLength:6}),"Obs");
  assert.equal(founderConciseRole("Clinical Observership",{maxLength:6,specialty:"Hospital Medicine"}),"HM");
  assert.equal(founderConciseRole("Hematology and Oncology Observership",{maxLength:12}),"Heme/Onc Obs");
  assert.equal(founderConciseRole("Cardiology Resident"),"Cardiology Resident");
  assert.equal(founderConciseInstitution("Cardiac Care and Vascular Medicine, Synthetic Einstein College of Medicine"),"Synthetic Einstein College of Medicine");
  assert.equal(founderConciseInstitution("Synthetic Hospital, Synthetic International University"),"Synthetic Hospital");
  assert.equal(founderConciseInstitution("Synthetic Upstate Medical University"),"Synthetic Upstate Medical University");
});
