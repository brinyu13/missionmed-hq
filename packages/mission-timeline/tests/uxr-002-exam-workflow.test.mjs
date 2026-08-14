import assert from "node:assert/strict";
import test from "node:test";

import {
  EXAM_CARD_FIELD_ORDER,
  EXAM_RESULTS,
  EXAM_SYSTEM_IDS,
  EXAM_SYSTEMS,
  EXAM_TYPES,
  EXAM_WORKFLOW_COPY,
  activeExamSystems,
  addExam,
  availableExamChips,
  awaitingExamChecks,
  createExamWorkflowState,
  deleteExamAttempt,
  examAttemptId,
  examCardMetadata,
  examMilestoneEventId,
  examTimelineEvents,
  finalizeExamWorkflow,
  retakeStudyPeriodEventId,
  setExamSystemActive,
  updateExamAttempt,
  validateExamAttempt,
  validateExamResult,
  validateExamScore
} from "../web/js/uxr-002/exam-workflow.js";

function activate(state,...systemIds){
  return systemIds.reduce((current,systemId)=>setExamSystemActive(current,systemId,true),state);
}

function add(state,...examTypeIds){
  return examTypeIds.reduce((current,examTypeId)=>addExam(current,examTypeId),state);
}

function attempt(state,examTypeId,number=1){
  return state.exams
    .find((exam)=>exam.examTypeId===examTypeId)
    ?.attempts.find((item)=>item.attemptNumber===number);
}

function deepFreeze(value){
  if(!value||typeof value!=="object"||Object.isFrozen(value))return value;
  Object.freeze(value);
  for(const child of Object.values(value))deepFreeze(child);
  return value;
}

test("the canonical systems and supported chip exam types preserve frozen terminology",()=>{
  assert.deepEqual(
    EXAM_SYSTEMS.map(({id,label})=>({id,label})),
    [
      {id:"usmle",label:"USMLE"},
      {id:"comlex",label:"COMLEX-USA"}
    ]
  );
  assert.deepEqual(
    EXAM_TYPES.map(({id,systemId,label})=>({id,systemId,label})),
    [
      {id:"usmle-step-1",systemId:"usmle",label:"Step 1"},
      {id:"usmle-step-2-ck",systemId:"usmle",label:"Step 2 CK"},
      {id:"usmle-step-3",systemId:"usmle",label:"Step 3"},
      {id:"comlex-level-1",systemId:"comlex",label:"Level 1"},
      {id:"comlex-level-2-ce",systemId:"comlex",label:"Level 2-CE"},
      {id:"comlex-level-3",systemId:"comlex",label:"Level 3"}
    ]
  );
  assert.equal(EXAM_WORKFLOW_COPY.emptyHelper,"Choose USMLE, COMLEX, or both.");
});

test("the initial workflow has independent inactive systems and no pre-added exams",()=>{
  const state=createExamWorkflowState();
  assert.deepEqual(state.activeSystems,{usmle:false,comlex:false});
  assert.deepEqual(state.exams,[]);
  assert.deepEqual(state.studyPeriods,[]);
  assert.deepEqual(availableExamChips(state),[]);
});

test("USMLE and COMLEX activate independently and can both be active",()=>{
  const initial=deepFreeze(createExamWorkflowState());
  const usmle=setExamSystemActive(initial,EXAM_SYSTEM_IDS.USMLE,true);
  assert.deepEqual(activeExamSystems(usmle).map(({label})=>label),["USMLE"]);
  assert.equal(initial.activeSystems.usmle,false,"selection must not mutate caller state");
  assert.deepEqual(
    availableExamChips(usmle).map(({label})=>label),
    ["+ Add Step 1","+ Add Step 2 CK","+ Add Step 3"]
  );

  const both=setExamSystemActive(usmle,EXAM_SYSTEM_IDS.COMLEX,true);
  assert.deepEqual(activeExamSystems(both).map(({label})=>label),["USMLE","COMLEX-USA"]);
  assert.deepEqual(
    availableExamChips(both).map(({label})=>label),
    [
      "+ Add Step 1",
      "+ Add Step 2 CK",
      "+ Add Step 3",
      "+ Add Level 1",
      "+ Add Level 2-CE",
      "+ Add Level 3"
    ]
  );
});

test("only selected, supported exam chips add cards and no card is duplicated",()=>{
  let state=activate(createExamWorkflowState(),EXAM_SYSTEM_IDS.USMLE);
  assert.throws(
    ()=>addExam(state,"comlex-level-2-ce"),
    /COMLEX-USA must be active/
  );
  assert.throws(()=>addExam(state,"usmle-step-4"),/Unsupported exam type/);

  state=addExam(state,"usmle-step-2-ck");
  assert.equal(state.exams.length,1);
  assert.equal(state.exams[0].attempts.length,1);
  assert.deepEqual(
    {
      cardTitle:state.exams[0].attempts[0].cardTitle,
      attemptNumber:state.exams[0].attempts[0].attemptNumber,
      attemptLabel:state.exams[0].attempts[0].attemptLabel,
      attemptNumberVisible:state.exams[0].attempts[0].attemptNumberVisible
    },
    {
      cardTitle:"Step 2 CK",
      attemptNumber:1,
      attemptLabel:null,
      attemptNumberVisible:false
    }
  );
  assert.ok(!availableExamChips(state).some(({examTypeId})=>examTypeId==="usmle-step-2-ck"));
  assert.equal(addExam(state,"usmle-step-2-ck").exams.length,1);
});

test("score and result metadata are primary and ordered above secondary date fields",()=>{
  assert.deepEqual(
    EXAM_CARD_FIELD_ORDER.map(({id,row,priority})=>({id,row,priority})),
    [
      {id:"result",row:1,priority:"primary"},
      {id:"score",row:1,priority:"primary"},
      {id:"examDate",row:2,priority:"secondary"},
      {id:"studyPeriodStart",row:2,priority:"secondary"}
    ]
  );

  const scored=examCardMetadata("usmle-step-2-ck",EXAM_RESULTS.AWAITING);
  assert.equal(scored.score.visible,true);
  assert.deepEqual(scored.score.range,{min:1,max:300,message:"USMLE scores run 1–300."});
  assert.equal(scored.fieldOrder.find(({id})=>id==="examDate").label,"Exam date (taken)");
  assert.equal(scored.awaitingResult,true);

  const passFail=examCardMetadata("comlex-level-1",EXAM_RESULTS.PASSED);
  assert.equal(passFail.score.visible,false);
  assert.equal(passFail.fieldOrder.find(({id})=>id==="score").hidden,true);
  assert.equal(passFail.score.range,null);
});

test("scored pass/fail results require exact scores while valid nonnumeric result states remain supported",()=>{
  assert.deepEqual(validateExamResult(""),{value:"",valid:false,error:"Required."});
  assert.deepEqual(validateExamResult("Awaiting"),{
    value:"Awaiting result",
    valid:true,
    error:null
  });
  assert.equal(validateExamResult("Pending").valid,false);
  assert.equal(validateExamResult("toString").valid,false);
  assert.equal(validateExamResult("__proto__").valid,false);

  for(const score of ["1","254","300"])assert.equal(validateExamScore("usmle-step-2-ck",score).valid,true);
  for(const score of ["0","301","25.4","text"])assert.equal(validateExamScore("usmle-step-2-ck",score).valid,false);
  assert.equal(validateExamScore("usmle-step-2-ck","301").error,"USMLE scores run 1–300.");

  for(const score of ["9","600","999"])assert.equal(validateExamScore("comlex-level-2-ce",score).valid,true);
  for(const score of ["8","1000","60.0","text"])assert.equal(validateExamScore("comlex-level-2-ce",score).valid,false);
  assert.equal(validateExamScore("comlex-level-2-ce","8").error,"COMLEX scores run 9–999.");
  assert.equal(
    validateExamScore("usmle-step-2-ck","",{result:"Passed"}).valid,
    false
  );
  assert.equal(
    validateExamScore("usmle-step-2-ck","",{result:"Passed"}).error,
    "Required."
  );
  assert.equal(
    validateExamScore("usmle-step-2-ck","",{result:"Awaiting result"}).valid,
    true
  );
  assert.deepEqual(
    validateExamScore("usmle-step-1","275",{result:"Passed"}),
    {
      value:"",
      visible:false,
      optional:true,
      required:false,
      valid:true,
      error:null,
      range:null
    }
  );
});

test("Awaiting result keeps the taken date required and emits the frozen neutral story check",()=>{
  let state=activate(createExamWorkflowState(),EXAM_SYSTEM_IDS.USMLE);
  state=addExam(state,"usmle-step-2-ck");
  const id=attempt(state,"usmle-step-2-ck").id;
  state=updateExamAttempt(state,id,{result:"Awaiting result"});

  let validation=validateExamAttempt(attempt(state,"usmle-step-2-ck"));
  assert.equal(validation.awaitingResult,true);
  assert.equal(validation.examDate.label,"Exam date (taken)");
  assert.equal(validation.examDate.error,"Required.");
  assert.equal(validation.valid,false);

  state=updateExamAttempt(state,id,{examDate:"Jun 2024"});
  validation=validateExamAttempt(attempt(state,"usmle-step-2-ck"));
  assert.equal(validation.valid,true);
  assert.deepEqual(awaitingExamChecks(state),[
    {
      id:`awaiting-${id}`,
      attemptId:id,
      examTypeId:"usmle-step-2-ck",
      text:"Step 2 CK result pending — update it when it arrives."
    }
  ]);
  const milestone=examTimelineEvents(state).find(({eventType})=>eventType==="milestone");
  assert.equal(milestone.awaitingResult,true);
  assert.equal(milestone.startDate,"2024-06");
});

test("Failed instantly creates the next attempt and a linked three-month provisional study period",()=>{
  let state=activate(createExamWorkflowState(),EXAM_SYSTEM_IDS.USMLE);
  state=addExam(state,"usmle-step-2-ck");
  const firstId=attempt(state,"usmle-step-2-ck").id;
  const before=deepFreeze(structuredClone(state));

  state=updateExamAttempt(before,firstId,{
    result:"Failed",
    score:"214",
    examDate:"2024-01",
    showScoreOnTimeline:true
  });

  assert.equal(before.exams[0].attempts.length,1,"failure transition must remain pure");
  const first=attempt(state,"usmle-step-2-ck",1);
  const second=attempt(state,"usmle-step-2-ck",2);
  assert.equal(first.showScoreOnTimeline,false);
  assert.equal(first.showScoreLocked,true);
  assert.deepEqual(
    {
      id:second.id,
      cardTitle:second.cardTitle,
      attemptLabel:second.attemptLabel,
      attemptNumberVisible:second.attemptNumberVisible,
      automatic:second.automatic,
      linkedFailureAttemptId:second.linkedFailureAttemptId
    },
    {
      id:"exam-usmle-step-2-ck-attempt-2",
      cardTitle:"Step 2 CK — 2nd attempt",
      attemptLabel:"2nd attempt",
      attemptNumberVisible:true,
      automatic:true,
      linkedFailureAttemptId:first.id
    }
  );

  assert.equal(state.studyPeriods.length,1);
  assert.deepEqual(
    {
      id:state.studyPeriods[0].id,
      title:state.studyPeriods[0].title,
      startDate:state.studyPeriods[0].startDate,
      endDate:state.studyPeriods[0].endDate,
      provisional:state.studyPeriods[0].provisional,
      fillStyle:state.studyPeriods[0].fillStyle,
      fillOpacity:state.studyPeriods[0].fillOpacity,
      outlineStyle:state.studyPeriods[0].outlineStyle,
      actionChip:state.studyPeriods[0].actionChip
    },
    {
      id:"exam-usmle-step-2-ck-attempt-1-retake-study-period",
      title:"Step 2 CK — preparing for retake",
      startDate:"2024-02",
      endDate:"2024-05",
      provisional:true,
      fillStyle:"hatched",
      fillOpacity:0.6,
      outlineStyle:"dashed",
      actionChip:{
        label:"Set retake date",
        targetAttemptId:"exam-usmle-step-2-ck-attempt-2"
      }
    }
  );
});

test("entering the retake date snaps the linked study period closed without guessing a result",()=>{
  let state=activate(createExamWorkflowState(),EXAM_SYSTEM_IDS.COMLEX);
  state=addExam(state,"comlex-level-2-ce");
  state=updateExamAttempt(state,examAttemptId("comlex-level-2-ce",1),{
    result:"Failed",
    examDate:"2023-03"
  });
  state=updateExamAttempt(state,examAttemptId("comlex-level-2-ce",2),{
    examDate:"Sep 2023"
  });

  const second=attempt(state,"comlex-level-2-ce",2);
  assert.equal(second.result,"","a retake date must not infer a medical result");
  assert.equal(second.score,"","a retake date must not infer a score");
  assert.deepEqual(
    {
      startDate:state.studyPeriods[0].startDate,
      endDate:state.studyPeriods[0].endDate,
      provisional:state.studyPeriods[0].provisional,
      outlineStyle:state.studyPeriods[0].outlineStyle,
      actionChip:state.studyPeriods[0].actionChip
    },
    {
      startDate:"2023-04",
      endDate:"2023-09",
      provisional:false,
      outlineStyle:"solid",
      actionChip:null
    }
  );
});

test("a second failure creates a 3rd attempt and a second independently linked study period",()=>{
  let state=activate(createExamWorkflowState(),EXAM_SYSTEM_IDS.USMLE);
  state=addExam(state,"usmle-step-3");
  state=updateExamAttempt(state,examAttemptId("usmle-step-3",1),{
    result:"Failed",
    examDate:"2024-01"
  });
  state=updateExamAttempt(state,examAttemptId("usmle-step-3",2),{
    result:"Failed",
    examDate:"2024-06"
  });

  assert.deepEqual(
    state.exams[0].attempts.map(({attemptNumber,attemptLabel,cardTitle})=>({
      attemptNumber,
      attemptLabel,
      cardTitle
    })),
    [
      {attemptNumber:1,attemptLabel:null,cardTitle:"Step 3"},
      {attemptNumber:2,attemptLabel:"2nd attempt",cardTitle:"Step 3 — 2nd attempt"},
      {attemptNumber:3,attemptLabel:"3rd attempt",cardTitle:"Step 3 — 3rd attempt"}
    ]
  );
  assert.deepEqual(
    state.studyPeriods.map(({id,startDate,endDate})=>({id,startDate,endDate})),
    [
      {
        id:retakeStudyPeriodEventId("usmle-step-3",1),
        startDate:"2024-02",
        endDate:"2024-06"
      },
      {
        id:retakeStudyPeriodEventId("usmle-step-3",2),
        startDate:"2024-07",
        endDate:"2024-10"
      }
    ]
  );
});

test("timeline events use deterministic IDs, explicit score visibility, and only a neutral failed dot",()=>{
  let state=activate(createExamWorkflowState(),EXAM_SYSTEM_IDS.USMLE);
  state=addExam(state,"usmle-step-2-ck");
  state=updateExamAttempt(state,examAttemptId("usmle-step-2-ck",1),{
    result:"Failed",
    score:"210",
    examDate:"2023-01",
    studyPeriodStart:"2022-09"
  });
  state=updateExamAttempt(state,examAttemptId("usmle-step-2-ck",2),{
    result:"Passed",
    score:"254",
    examDate:"2023-08"
  });

  const events=examTimelineEvents(state);
  const failed=events.find(({id})=>id===examMilestoneEventId("usmle-step-2-ck",1));
  const passed=events.find(({id})=>id===examMilestoneEventId("usmle-step-2-ck",2));
  assert.equal(failed.title,"Step 2 CK");
  assert.equal(failed.dangerDot,true);
  assert.equal(failed.tone,"neutral");
  assert.equal(failed.showScoreOnTimeline,false);
  assert.equal(passed.title,"Step 2 CK · 2nd attempt · 254");
  assert.equal(passed.dangerDot,false);
  assert.equal(passed.showScoreOnTimeline,true);
  assert.ok(events.some(({id})=>id==="exam-usmle-step-2-ck-attempt-1-study-window"));
  assert.ok(events.some(({id})=>id===retakeStudyPeriodEventId("usmle-step-2-ck",1)));

  const replay=(()=>{
    let candidate=activate(createExamWorkflowState(),EXAM_SYSTEM_IDS.USMLE);
    candidate=addExam(candidate,"usmle-step-2-ck");
    candidate=updateExamAttempt(candidate,examAttemptId("usmle-step-2-ck",1),{
      result:"Failed",score:"210",examDate:"2023-01",studyPeriodStart:"2022-09"
    });
    return updateExamAttempt(candidate,examAttemptId("usmle-step-2-ck",2),{
      result:"Passed",score:"254",examDate:"2023-08"
    });
  })();
  assert.deepEqual(replay,state,"the same explicit inputs must produce byte-stable logical state");
});

test("deleting a failed attempt removes its study period and renumbers retained subsequent data",()=>{
  let state=activate(createExamWorkflowState(),EXAM_SYSTEM_IDS.USMLE);
  state=addExam(state,"usmle-step-2-ck");
  state=updateExamAttempt(state,examAttemptId("usmle-step-2-ck",1),{
    result:"Failed",
    examDate:"2023-02"
  });
  state=updateExamAttempt(state,examAttemptId("usmle-step-2-ck",2),{
    result:"Passed",
    score:"255",
    examDate:"2023-09"
  });

  state=deleteExamAttempt(state,examAttemptId("usmle-step-2-ck",1));
  assert.equal(state.studyPeriods.length,0);
  assert.equal(state.exams[0].attempts.length,1);
  assert.deepEqual(
    {
      id:state.exams[0].attempts[0].id,
      attemptNumber:state.exams[0].attempts[0].attemptNumber,
      attemptLabel:state.exams[0].attempts[0].attemptLabel,
      cardTitle:state.exams[0].attempts[0].cardTitle,
      result:state.exams[0].attempts[0].result,
      score:state.exams[0].attempts[0].score
    },
    {
      id:"exam-usmle-step-2-ck-attempt-1",
      attemptNumber:1,
      attemptLabel:null,
      cardTitle:"Step 2 CK",
      result:"Passed",
      score:"255"
    }
  );
});

test("wizard finish drops a fully empty automatic retake card but preserves its provisional study period",()=>{
  let state=activate(createExamWorkflowState(),EXAM_SYSTEM_IDS.COMLEX);
  state=addExam(state,"comlex-level-3");
  state=updateExamAttempt(state,examAttemptId("comlex-level-3",1),{
    result:"Failed",
    score:"601",
    examDate:"2025-01"
  });
  assert.equal(state.exams[0].attempts.length,2);

  state=finalizeExamWorkflow(state);
  assert.equal(state.exams[0].attempts.length,1);
  assert.equal(state.studyPeriods.length,1);
  assert.equal(state.studyPeriods[0].provisional,true);
  assert.equal(state.studyPeriods[0].outlineStyle,"dashed");
  assert.deepEqual(state.studyPeriods[0].actionChip,{
    label:"Set retake date",
    targetAttemptId:"exam-comlex-level-3-attempt-2"
  });
});
