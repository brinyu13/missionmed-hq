import assert from "node:assert/strict";
import test from "node:test";

import {
  ADVISOR_CHECKLIST_ITEMS,
  ADVISOR_COPY,
  ADVISOR_HIGHLIGHT_COLOR,
  ADVISOR_LOCAL_ADAPTER_CONTRACT,
  ADVISOR_PIN_NOTE_MAX,
  ADVISOR_QUESTION_HIGHLIGHT_MS,
  ADVISOR_SESSION_THEME_ID,
  ADVISOR_STATUSES,
  CHECKLIST_STATES,
  addAdvisorComment,
  advisorApprovalBadge,
  advisorCommentModel,
  advisorEventDataFingerprint,
  advisorPinsForContext,
  advisorQuestionModel,
  advisorReviewCardModel,
  advisorSessionModel,
  advisorSessionRoute,
  applyAdvisorRequest,
  approveAdvisorReview,
  buildAdvisorRequestPlan,
  canRequestAdvisorChanges,
  cancelAdvisorRequest,
  checklistGate,
  computeAdvisorQuestions,
  deleteAdvisorComment,
  hideAdvisorQuestion,
  installAdvisorWorkflow,
  isActiveAdvisorSession,
  markApprovalEditedSince,
  normalizeAdvisorDocument,
  questionHighlightEffect,
  reconcileApprovalFingerprint,
  renderAdvisorRequestSheet,
  renderAdvisorSession,
  renderStudentCommentLayer,
  requestAdvisorChanges,
  resolveAdvisorComment,
  setChecklistState,
  updateAdvisorComment,
  validateAdvisorNote
} from "../web/js/uxr-002/advisor.js";

const fixedClock=()=>new Date("2026-07-29T16:00:00.000Z");

function timeline(overrides={}){
  const base={
    id:"timeline-1",
    title:"Timeline Builder",
    theme:"horizon",
    mode:"guided",
    studentProfile:{
      fullName:"Avery Student",
      graduationDate:"2024-05",
      expectedGraduation:false,
      visaStatus:""
    },
    events:[
      {
        id:"event-1",
        title:"Medical school",
        categoryId:"education",
        eventType:"duration",
        startDate:"2020-01",
        endDate:"2024-05",
        visibilityState:"INTERVIEWER_SAFE"
      },
      {
        id:"advisor-only-1",
        title:"Private context",
        categoryId:"personal",
        eventType:"milestone",
        startDate:"2023-04",
        visibilityState:"ADVISOR_ONLY"
      }
    ],
    exams:[],
    advisor:{status:"not-requested"}
  };
  return{
    ...base,
    ...structuredClone(overrides),
    studentProfile:{
      ...base.studentProfile,
      ...structuredClone(overrides.studentProfile||{})
    },
    events:"events" in overrides?structuredClone(overrides.events):base.events,
    exams:"exams" in overrides?structuredClone(overrides.exams):base.exams,
    advisor:{
      ...base.advisor,
      ...structuredClone(overrides.advisor||{})
    }
  };
}

function requestedDocument(overrides={}){
  const source=timeline(overrides);
  const plan=buildAdvisorRequestPlan(source,{
    message:"Please focus on chronology.",
    clock:fixedClock
  });
  return applyAdvisorRequest(source,plan).document;
}

function touchAll(document,{flagId=null}={}){
  let next=document;
  for(const item of ADVISOR_CHECKLIST_ITEMS){
    next=setChecklistState(
      next,
      item.id,
      item.id===flagId?CHECKLIST_STATES.FLAG:CHECKLIST_STATES.PASS
    ).document;
  }
  return next;
}

test("the five frozen checklist items and advisor copy match §10 exactly",()=>{
  assert.deepEqual(ADVISOR_CHECKLIST_ITEMS.map(({label})=>label),[
    "Chronology is complete — no unexplained gaps",
    "Overlaps look intentional and readable",
    "Nothing here the student wouldn't want asked about",
    "Advisor-only items are correctly marked",
    "The story reads in under 30 seconds"
  ]);
  assert.equal(ADVISOR_CHECKLIST_ITEMS.length,5);
  assert.ok(Object.isFrozen(ADVISOR_CHECKLIST_ITEMS));
  assert.deepEqual(ADVISOR_COPY,{
    inactive:"This review link isn't active.",
    requestCard:"Get a second pair of eyes before you export.",
    requestAction:"Request advisor review",
    requestMessage:"Anything you want your advisor to focus on?",
    send:"Send for review",
    checklist:"Checklist",
    questions:"Likely interview questions",
    comments:"Comments",
    pinInstruction:"Click anywhere on the board to pin a comment.",
    approve:"Approve for export",
    requestChanges:"Request changes",
    resolve:"Resolve"
  });
});

test("request planning creates the exact local route, Everything handoff, and pre-mutation version",()=>{
  const source=timeline();
  const original=structuredClone(source);
  const plan=buildAdvisorRequestPlan(source,{
    message:"Please focus on my gaps.",
    clock:fixedClock
  });
  assert.equal(plan.route,"advisor-session:timeline-1");
  assert.equal(advisorSessionRoute("timeline-1"),"advisor-session:timeline-1");
  assert.deepEqual(plan.versionRequest,{
    name:"Sent for review · Jul 29, 2026",
    kind:"automatic",
    requiredBeforeMutation:true
  });
  assert.deepEqual(plan.mutation,{
    label:"Request advisor review",
    history:true,
    undoSteps:1
  });
  assert.equal(plan.handoff.kind,"local-advisor-session");
  assert.equal(plan.handoff.dataset.audience,"everything");
  assert.equal(plan.handoff.dataset.includesAdvisorOnlyItems,true);
  assert.equal(plan.handoff.dataset.events.length,2);
  assert.equal(
    plan.handoff.dataset.events.find(({id})=>id==="advisor-only-1").visibilityState,
    "ADVISOR_ONLY"
  );
  assert.equal(plan.handoff.dataset.studentThemeId,"horizon");
  assert.equal(plan.handoff.dataset.renderThemeId,"advisor-paper");
  assert.deepEqual(source,original,"request planning must not mutate the timeline");
});

test("applying a request flips the card to pending and retains a functional local session handoff",()=>{
  const source=timeline();
  const plan=buildAdvisorRequestPlan(source,{
    message:"Please focus on chronology.",
    clock:fixedClock
  });
  const applied=applyAdvisorRequest(source,plan);
  assert.equal(applied.document.advisor.status,ADVISOR_STATUSES.PENDING);
  assert.equal(applied.document.advisor.requestedAt,"2026-07-29T16:00:00.000Z");
  assert.equal(applied.document.advisor.message,"Please focus on chronology.");
  assert.equal(applied.document.advisor.route,"advisor-session:timeline-1");
  assert.deepEqual(applied.versionRequest,plan.versionRequest);
  assert.equal(isActiveAdvisorSession(applied.document,plan.route),true);
  assert.deepEqual(advisorReviewCardModel(applied.document),{
    state:"pending",
    body:"Awaiting advisor review · requested Jul 29, 2026",
    action:"Cancel request"
  });
  assert.equal(source.advisor.status,"not-requested");
});

test("cancel makes the local route inactive without network or protected-runtime behavior",()=>{
  const requested=requestedDocument();
  const result=cancelAdvisorRequest(requested);
  assert.equal(result.changed,true);
  assert.equal(result.document.advisor.status,ADVISOR_STATUSES.CANCELLED);
  assert.equal(result.document.advisor.route,null);
  assert.equal(isActiveAdvisorSession(result.document,"advisor-session:timeline-1"),false);
  assert.deepEqual(advisorSessionModel(result.document,{
    route:"advisor-session:timeline-1"
  }),{
    state:"invalid",
    message:"This review link isn't active."
  });
  assert.equal(cancelAdvisorRequest(result.document).changed,false);
});

test("Advisor session always uses Advisor Paper, Everything, read-only board, and the student's theme chip",()=>{
  const requested=requestedDocument();
  const model=advisorSessionModel(requested,{
    route:"advisor-session:timeline-1",
    now:fixedClock()
  });
  assert.equal(model.state,"active");
  assert.equal(model.themeId,ADVISOR_SESSION_THEME_ID);
  assert.equal(model.themeId,"advisor-paper");
  assert.equal(model.themeForced,true);
  assert.equal(model.boardReadOnly,true);
  assert.equal(model.audience,"everything");
  assert.equal(model.studentThemeId,"horizon");
  assert.equal(model.studentThemeChip,"Student's theme: Horizon");
  assert.equal(model.checklist.length,5);
  assert.equal(model.approveEnabled,false);
});

test("invalid, loading, and active Advisor renders each expose one accessible screen h1",()=>{
  const requested=requestedDocument();
  const invalid=renderAdvisorSession(requested,{route:"advisor-session:wrong"});
  assert.ok(invalid.includes("This review link isn't active."));
  assert.equal((invalid.match(/<h1/g)||[]).length,1);

  const loading=renderAdvisorSession(requested,{
    route:"advisor-session:timeline-1",
    loading:true
  });
  assert.ok(loading.includes('data-advisor-session="loading"'));
  assert.ok(loading.includes('aria-busy="true"'));
  assert.equal((loading.match(/<h1/g)||[]).length,1);

  const active=renderAdvisorSession(requested,{
    route:"advisor-session:timeline-1",
    boardHtml:'<svg data-test-board aria-label="Board"></svg>',
    now:fixedClock()
  });
  assert.ok(active.includes('data-advisor-theme="advisor-paper"'));
  assert.ok(active.includes("Student&#039;s theme: Horizon"));
  assert.ok(active.includes('data-test-board'));
  assert.ok(active.includes('data-advisor-rail'));
  assert.equal((active.match(/<h1/g)||[]).length,1);
  assert.equal((active.match(/<h2/g)||[]).length,3);
});

test("tri-state checklist starts untouched, accepts pass or flag, and gates approval only after all five are touched",()=>{
  let document=requestedDocument();
  assert.deepEqual(checklistGate(document),{
    complete:false,
    touched:0,
    total:5,
    untouchedIds:["chronology","overlaps","interview-comfort","advisor-only","thirty-seconds"],
    flaggedIds:[]
  });
  document=setChecklistState(document,"chronology","pass").document;
  document=setChecklistState(document,"overlaps","flag").document;
  assert.equal(checklistGate(document).touched,2);
  assert.deepEqual(checklistGate(document).flaggedIds,["overlaps"]);
  assert.throws(()=>setChecklistState(document,"invented","pass"),RangeError);

  document=touchAll(document,{flagId:"overlaps"});
  const gate=checklistGate(document);
  assert.equal(gate.complete,true);
  assert.equal(gate.touched,5);
  assert.deepEqual(gate.flaggedIds,["overlaps"]);
  assert.equal(advisorSessionModel(document,{
    route:"advisor-session:timeline-1",
    now:fixedClock()
  }).approveEnabled,true);
});

test("gap questions are computed only at six months or longer with source-event highlights",()=>{
  const source=timeline({
    studentProfile:{graduationDate:"2026-06"},
    events:[
      {id:"before",title:"Before",eventType:"duration",startDate:"2020-01",endDate:"2020-03"},
      {id:"after",title:"After",eventType:"duration",startDate:"2020-10",endDate:"2020-12"}
    ]
  });
  const questions=computeAdvisorQuestions(source,{now:fixedClock()});
  const gap=questions.find(({type})=>type==="gap");
  assert.deepEqual(gap,{
    id:"advisor-gap-24243-24248",
    type:"gap",
    text:"There is a 6-month gap from Apr 2020 to Sep 2020. What was happening then?",
    sourceEventIds:["before","after"],
    sourceMonth:"2020-04",
    count:6
  });
  const fiveMonth=computeAdvisorQuestions({
    ...source,
    events:[
      source.events[0],
      {...source.events[1],startDate:"2020-09"}
    ]
  },{now:fixedClock()});
  assert.equal(fiveMonth.some(({type})=>type==="gap"),false);
});

test("failed exam attempts compute a question and point to the projected board event",()=>{
  const source=timeline({
    studentProfile:{graduationDate:"2026-06"},
    events:[{
      id:"exam-flag",
      title:"Step 2 CK",
      eventType:"milestone",
      startDate:"2024-03",
      attemptId:"exam-attempt-1",
      fields:{builderEntryId:"exam-attempt-1"}
    }],
    exams:[{
      id:"exam-attempt-1",
      name:"Step 2 CK",
      result:"Failed",
      examDate:"2024-03"
    }]
  });
  const failed=computeAdvisorQuestions(source,{now:fixedClock()})
    .find(({type})=>type==="failed-attempt");
  assert.equal(failed.text,"How would you discuss the Step 2 CK attempt from Mar 2024?");
  assert.deepEqual(failed.sourceEventIds,["exam-flag"]);
  assert.equal(failed.examId,"exam-attempt-1");
});

test("three or more simultaneous duration events compute one question per overlap run",()=>{
  const source=timeline({
    studentProfile:{graduationDate:"2026-06"},
    events:[
      {id:"a",title:"A",eventType:"duration",startDate:"2023-01",endDate:"2023-06"},
      {id:"b",title:"B",eventType:"duration",startDate:"2023-02",endDate:"2023-07"},
      {id:"c",title:"C",eventType:"duration",startDate:"2023-03",endDate:"2023-05"},
      {id:"flag",title:"Flag",eventType:"milestone",startDate:"2023-03"}
    ]
  });
  const overlap=computeAdvisorQuestions(source,{now:fixedClock()})
    .find(({type})=>type==="overlap");
  assert.equal(overlap.text,"How did you balance 3 overlapping commitments in Mar 2023?");
  assert.deepEqual(overlap.sourceEventIds,["a","b","c"]);
  assert.equal(overlap.count,3);
});

test("visa and more-than-two-years-since-graduation questions use the frozen trigger boundaries",()=>{
  const triggered=computeAdvisorQuestions(timeline({
    events:[],
    studentProfile:{
      visaStatus:"Need J-1",
      graduationDate:"2024-06",
      expectedGraduation:false
    }
  }),{now:fixedClock()});
  assert.equal(triggered.some(({type})=>type==="visa-status"),true);
  const graduation=triggered.find(({type})=>type==="graduation-age");
  assert.equal(graduation.text,"How have you stayed current since graduating in 2024?");
  assert.equal(graduation.monthsSinceGraduation,25);

  const boundary=computeAdvisorQuestions(timeline({
    events:[],
    studentProfile:{
      visaStatus:"US citizen / permanent resident",
      graduationDate:"2024-07",
      expectedGraduation:false
    }
  }),{now:fixedClock()});
  assert.equal(boundary.some(({type})=>type==="visa-status"),false);
  assert.equal(boundary.some(({type})=>type==="graduation-age"),false);
  const expected=computeAdvisorQuestions(timeline({
    events:[],
    studentProfile:{graduationDate:"2020-01",expectedGraduation:true}
  }),{now:fixedClock()});
  assert.equal(expected.some(({type})=>type==="graduation-age"),false);
});

test("questions hide into the exact Hidden count and preserve the 2-second gold-halo contract",()=>{
  let document=requestedDocument({
    studentProfile:{graduationDate:"2026-06"},
    events:[
      {id:"before",title:"Before",eventType:"duration",startDate:"2020-01",endDate:"2020-03"},
      {id:"after",title:"After",eventType:"duration",startDate:"2020-10",endDate:"2020-12"}
    ]
  });
  const question=computeAdvisorQuestions(document,{now:fixedClock()})[0];
  document=hideAdvisorQuestion(document,question.id).document;
  const model=advisorQuestionModel(document,{now:fixedClock()});
  assert.equal(model.visible.length,0);
  assert.equal(model.hidden.length,1);
  assert.equal(model.hiddenCount,1);
  assert.deepEqual(questionHighlightEffect(question),{
    questionId:question.id,
    eventIds:["before","after"],
    color:ADVISOR_HIGHLIGHT_COLOR,
    durationMs:ADVISOR_QUESTION_HIGHLIGHT_MS,
    animation:"gold-halo"
  });
  assert.equal(ADVISOR_QUESTION_HIGHLIGHT_MS,2000);
  assert.equal(ADVISOR_HIGHLIGHT_COLOR,"#B98A2E");
  assert.equal(questionHighlightEffect(question,{reducedMotion:true}).animation,"none");

  const html=renderAdvisorSession(document,{
    route:"advisor-session:timeline-1",
    now:fixedClock()
  });
  assert.ok(html.includes("<summary>Hidden (1)</summary>"));
});

test("click-to-pin comments use normalized board coordinates, stable numbers, and a 280-character note limit",()=>{
  const requested=requestedDocument();
  const first=addAdvisorComment(requested,{
    x:1.5,
    y:-.5,
    clock:fixedClock,
    idFactory:()=>"pin-1"
  });
  assert.deepEqual(first.comment,{
    id:"pin-1",
    number:1,
    x:1,
    y:0,
    note:"",
    resolved:false,
    createdAt:"2026-07-29T16:00:00.000Z",
    updatedAt:"2026-07-29T16:00:00.000Z",
    resolvedAt:null
  });
  assert.equal(first.openNoteField,true);
  const second=addAdvisorComment(first.document,{
    x:.25,
    y:.75,
    note:"Please clarify this overlap.",
    clock:fixedClock,
    idFactory:()=>"pin-2"
  });
  assert.equal(second.comment.number,2);
  assert.equal(validateAdvisorNote("x".repeat(ADVISOR_PIN_NOTE_MAX)).valid,true);
  assert.equal(validateAdvisorNote("x".repeat(ADVISOR_PIN_NOTE_MAX+1)).valid,false);
  assert.throws(()=>addAdvisorComment(requested,{
    note:"x".repeat(ADVISOR_PIN_NOTE_MAX+1)
  }),RangeError);
});

test("comment edit, resolve, and delete round-trip through the shared student/advisor state",()=>{
  let document=addAdvisorComment(requestedDocument(),{
    note:"First note",
    clock:fixedClock,
    idFactory:()=>"pin-1"
  }).document;
  document=updateAdvisorComment(document,"pin-1","Edited note",{
    clock:()=>new Date("2026-07-29T17:00:00.000Z")
  }).document;
  assert.equal(advisorCommentModel(document).active[0].note,"Edited note");
  document=resolveAdvisorComment(document,"pin-1",{
    clock:()=>new Date("2026-07-29T18:00:00.000Z")
  }).document;
  const model=advisorCommentModel(document);
  assert.equal(model.activeCount,0);
  assert.equal(model.resolved.length,1);
  assert.equal(model.resolved[0].resolvedAt,"2026-07-29T18:00:00.000Z");
  assert.equal(model.toolbarLabel,"Comments · 0");
  const deleted=deleteAdvisorComment(document,"pin-1");
  assert.equal(deleted.changed,true);
  assert.equal(deleted.document.advisor.comments.length,0);
});

test("Request changes requires at least one unresolved saved comment or a flagged checklist item",()=>{
  const requested=requestedDocument();
  assert.deepEqual(canRequestAdvisorChanges(requested),{
    allowed:false,hasComment:false,hasFlag:false
  });
  const draft=addAdvisorComment(requested,{
    note:"",
    clock:fixedClock,
    idFactory:()=>"draft"
  }).document;
  assert.equal(canRequestAdvisorChanges(draft).allowed,false);
  assert.throws(()=>requestAdvisorChanges(draft),/requires a comment or flagged/);

  const commented=updateAdvisorComment(draft,"draft","Please revise this.",{
    clock:fixedClock
  }).document;
  assert.equal(canRequestAdvisorChanges(commented).allowed,true);
  const changes=requestAdvisorChanges(commented,{clock:fixedClock});
  assert.equal(changes.document.advisor.status,ADVISOR_STATUSES.CHANGES_REQUESTED);
  assert.equal(changes.activePins.length,1);
  assert.deepEqual(advisorReviewCardModel(changes.document),{
    state:"changes-requested",
    chip:"1 advisor comments",
    action:"open-comments"
  });

  const flagged=setChecklistState(requested,"chronology","flag").document;
  assert.deepEqual(canRequestAdvisorChanges(flagged),{
    allowed:true,hasComment:false,hasFlag:true
  });
});

test("approval is gated by all five touched items and stamps the exact badge",()=>{
  const requested=requestedDocument();
  assert.throws(()=>approveAdvisorReview(requested,{
    advisorName:"Dr. Rivera",
    clock:fixedClock
  }),/All five checklist items/);

  const completed=touchAll(requested,{flagId:"overlaps"});
  const approved=approveAdvisorReview(completed,{
    advisorName:"Dr. Rivera",
    clock:fixedClock
  });
  assert.equal(approved.document.advisor.status,ADVISOR_STATUSES.APPROVED);
  assert.equal(approved.document.advisor.approvedAt,"2026-07-29T16:00:00.000Z");
  assert.equal(approved.document.advisor.editedSince,false);
  assert.ok(approved.document.advisor.approvalEventFingerprint);
  assert.deepEqual(approved.badge,{
    status:"approved",
    tone:"success",
    text:"Dr. Rivera approved · Jul 29, 2026",
    silentlyRevoked:false
  });
  assert.deepEqual(advisorReviewCardModel(approved.document),{
    state:"approved",
    badge:approved.badge
  });
});

test("event-data edits downgrade the badge while theme/mode edits do not and approval is never revoked",()=>{
  const approved=approveAdvisorReview(touchAll(requestedDocument()),{
    clock:fixedClock
  }).document;
  const theme=markApprovalEditedSince({...approved,theme:"mission-navy"},"theme");
  assert.equal(theme.changed,false);
  assert.equal(theme.badge.text,"Advisor approved · Jul 29, 2026");
  const mode=markApprovalEditedSince({...approved,mode:"advanced"},"mode");
  assert.equal(mode.changed,false);

  const eventData=markApprovalEditedSince(approved,"event-data");
  assert.equal(eventData.changed,true);
  assert.equal(eventData.document.advisor.status,ADVISOR_STATUSES.APPROVED);
  assert.deepEqual(eventData.badge,{
    status:"approved-edited",
    tone:"success",
    text:"Approved Jul 29, 2026 · edited since",
    silentlyRevoked:false
  });
  assert.equal(advisorApprovalBadge(eventData.document).silentlyRevoked,false);
});

test("fingerprint reconciliation detects event/exam data only and ignores theme/mode changes",()=>{
  const approved=approveAdvisorReview(touchAll(requestedDocument()),{
    clock:fixedClock
  }).document;
  const baseline=advisorEventDataFingerprint(approved);
  assert.equal(
    advisorEventDataFingerprint({...approved,theme:"mission-navy",mode:"advanced"}),
    baseline
  );
  assert.equal(reconcileApprovalFingerprint({
    ...approved,
    theme:"mission-navy",
    mode:"advanced"
  }).changed,false);

  const edited=structuredClone(approved);
  edited.events[0].title="Medical school — updated";
  const result=reconcileApprovalFingerprint(edited);
  assert.equal(result.changed,true);
  assert.equal(result.document.advisor.editedSince,true);
  assert.equal(result.document.advisor.status,ADVISOR_STATUSES.APPROVED);
});

test("student Canvas pins can resolve shared comments and no pins render in any export",()=>{
  const withPin=addAdvisorComment(requestedDocument(),{
    x:.4,
    y:.6,
    note:"Clarify this date.",
    clock:fixedClock,
    idFactory:()=>"pin-1"
  }).document;
  assert.equal(advisorPinsForContext(withPin,{context:"export"}).length,0);
  assert.equal(advisorPinsForContext(withPin,{context:"advisor"}).length,1);
  assert.equal(renderStudentCommentLayer(withPin,{visible:false}),"");
  assert.equal(renderStudentCommentLayer(withPin,{
    visible:true,context:"export"
  }),"");
  const layer=renderStudentCommentLayer(withPin,{
    visible:true,
    activePinId:"pin-1",
    context:"canvas"
  });
  assert.ok(layer.includes('data-advisor-pin="pin-1"'));
  assert.ok(layer.includes("Clarify this date."));
  assert.ok(layer.includes(">Resolve<"));
});

test("request sheet contains the exact optional focus prompt and primary action",()=>{
  const html=renderAdvisorRequestSheet(timeline(),{
    message:"Review dates <please>"
  });
  assert.ok(html.includes("Request advisor review"));
  assert.ok(html.includes("Anything you want your advisor to focus on?"));
  assert.ok(html.includes("Send for review"));
  assert.ok(html.includes("Review dates &lt;please&gt;"));
  assert.ok(html.includes('role="dialog"'));
  assert.ok(html.includes('aria-modal="true"'));
});

test("active session renders exactly five tri-state rows, the three rail sections, verdict gates, and keyboard board affordance",()=>{
  const requested=requestedDocument();
  const html=renderAdvisorSession(requested,{
    route:"advisor-session:timeline-1",
    now:fixedClock()
  });
  assert.equal((html.match(/data-checklist-item=/g)||[]).length,5);
  assert.equal((html.match(/data-checklist-choice="pass"/g)||[]).length,5);
  assert.equal((html.match(/data-checklist-choice="flag"/g)||[]).length,5);
  assert.ok(html.includes(">Checklist<"));
  assert.ok(html.includes(">Likely interview questions<"));
  assert.ok(html.includes(">Comments<"));
  assert.ok(html.includes("Click anywhere on the board to pin a comment."));
  assert.ok(html.includes(">Approve for export<"));
  assert.ok(html.includes(">Request changes<"));
  assert.equal((html.match(/data-advisor-approve disabled/g)||[]).length,1);
  assert.equal((html.match(/data-advisor-request-changes disabled/g)||[]).length,1);
  assert.ok(html.includes('tabindex="0"'));
  assert.ok(html.includes("Use arrow keys to move the comment cursor and Enter to pin a comment."));
  assert.ok(html.includes('aria-live="polite"'));
});

test("install hook supports pointer pinning and keyboard cursor movement/creation",()=>{
  const listeners=new Map();
  const announcements=[];
  const pins=[];
  const cursorStyles={};
  const marker={style:{setProperty(name,value){cursorStyles[name]=value;}}};
  const board={
    dataset:{},
    closest(selector){return selector==="[data-advisor-board]"?this:null;},
    getBoundingClientRect(){return{left:100,top:50,width:400,height:200};},
    querySelector(selector){return selector==="[data-advisor-pin-cursor]"?marker:null;}
  };
  const root={
    addEventListener(type,listener){listeners.set(type,listener);},
    removeEventListener(){},
    querySelector(){return null;}
  };
  const dispose=installAdvisorWorkflow(root,{
    onCreatePin:(position)=>pins.push(position),
    onBoardCursor:(position)=>pins.push({cursor:position}),
    onAnnounce:(message)=>announcements.push(message)
  });

  listeners.get("click")({target:board,clientX:300,clientY:150});
  assert.deepEqual(pins.slice(0,2),[
    {cursor:{x:.5,y:.5}},
    {x:.5,y:.5}
  ]);
  assert.equal(announcements.at(-1),"Comment pin added.");

  let prevented=0;
  listeners.get("keydown")({
    target:board,
    key:"ArrowRight",
    shiftKey:false,
    preventDefault(){prevented+=1;}
  });
  assert.equal(cursorStyles["--pin-x"],"55.00000000000001%");
  listeners.get("keydown")({
    target:board,
    key:"Enter",
    preventDefault(){prevented+=1;}
  });
  assert.deepEqual(pins.at(-1),{x:.55,y:.5});
  assert.equal(prevented,2);
  dispose();
});

test("install hook delegates checklist, questions, comments, verdicts, and request-sheet actions",()=>{
  const listeners=new Map();
  const calls=[];
  const messageField={value:"Focus on chronology."};
  const noteField={value:"Updated note."};
  const root={
    addEventListener(type,listener){listeners.set(type,listener);},
    removeEventListener(){},
    querySelector(selector){
      if(selector==="[data-advisor-request-message]")return messageField;
      if(selector==='[data-advisor-comment-note="pin-1"]')return noteField;
      return null;
    }
  };
  const hooks={
    onChecklist:(value)=>calls.push(["checklist",value]),
    onHideQuestion:(value)=>calls.push(["hide",value]),
    onQuestion:(value,effect)=>calls.push(["question",value,effect]),
    onPin:(value)=>calls.push(["pin",value]),
    onSaveComment:(value)=>calls.push(["save",value]),
    onEditComment:(value)=>calls.push(["edit",value]),
    onDeleteComment:(value)=>calls.push(["delete",value]),
    onResolveComment:(value)=>calls.push(["resolve",value]),
    onApprove:()=>calls.push(["approve"]),
    onRequestChanges:()=>calls.push(["changes"]),
    onSendRequest:(value)=>calls.push(["send",value]),
    onAnnounce:()=>{}
  };
  installAdvisorWorkflow(root,hooks);
  const target=(selector,dataset={})=>({
    dataset,
    closest(query){return query===selector?this:null;}
  });
  const click=(selector,dataset)=>listeners.get("click")({
    target:target(selector,dataset)
  });
  click("[data-checklist-choice]",{checklistId:"chronology",checklistChoice:"pass"});
  click("[data-hide-advisor-question]",{hideAdvisorQuestion:"q-1"});
  click("[data-advisor-question]",{advisorQuestion:"q-1"});
  click("[data-advisor-pin]",{advisorPin:"pin-1"});
  click("[data-save-advisor-comment]",{saveAdvisorComment:"pin-1"});
  click("[data-edit-advisor-comment]",{editAdvisorComment:"pin-1"});
  click("[data-delete-advisor-comment]",{deleteAdvisorComment:"pin-1"});
  click("[data-resolve-advisor-comment]",{resolveAdvisorComment:"pin-1"});
  click("[data-advisor-approve]");
  click("[data-advisor-request-changes]");
  click("[data-advisor-send]");
  assert.deepEqual(calls,[
    ["checklist",{id:"chronology",state:"pass"}],
    ["hide","q-1"],
    ["question","q-1",{color:"#B98A2E",durationMs:2000}],
    ["pin","pin-1"],
    ["save",{id:"pin-1",note:"Updated note."}],
    ["edit","pin-1"],
    ["delete","pin-1"],
    ["resolve","pin-1"],
    ["approve"],
    ["changes"],
    ["send",{message:"Focus on chronology."}]
  ]);
});

test("Advisor capability is explicitly local-only and makes no Matrix, network, or protected-runtime claim",()=>{
  assert.deepEqual(ADVISOR_LOCAL_ADAPTER_CONTRACT,{
    route:"advisor-session:{timelineId}",
    invitation:"local handoff stub",
    audience:"everything",
    includesAdvisorOnlyItems:true,
    sessionTheme:"advisor-paper",
    networkCalls:false,
    protectedRuntimeCalls:false,
    matrixIntegration:false,
    persistence:"consumer-supplied local store adapter"
  });
  const normalized=normalizeAdvisorDocument(timeline());
  assert.equal(normalized.advisor.status,"not-requested");
  assert.equal(normalized.advisor.checklist.length,5);
});
