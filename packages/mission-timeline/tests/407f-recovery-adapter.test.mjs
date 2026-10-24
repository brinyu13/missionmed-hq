import assert from "node:assert/strict";
import test from "node:test";
import {
  apply407FStateToDocument,
  applyDocumentTo407FState,
  documentEventTo407F,
  event407FToDocument
} from "../web/js/407f-engineering-adapter.js";

test("407F event mapping round-trips canonical engineering fields",()=>{
  const source={
    id:"event-1",
    title:"IM Rotation",
    categoryId:"clinical",
    eventType:"duration",
    startDate:"2025-01",
    endDate:"2025-03",
    openEnded:false,
    visibilityState:"ADVISOR_ONLY",
    siteName:"Mission Hospital",
    notes:"Confirmed",
    lane:2,
    sourceType:"intake",
    provenance:[{source:"cv"}],
    fields:{score:false,legacy407fCategory:"cl"}
  };
  const ui=documentEventTo407F(source);
  assert.deepEqual(ui,{
    id:"event-1",
    t:"IM Rotation",
    cat:"cl",
    mile:false,
    s:"2025-01",
    e:"2025-03",
    vis:"advisor",
    loc:"Mission Hospital",
    origin:"intake",
    notes:"Confirmed",
    lane:2,
    provenance:[{source:"cv"}],
    fields:{score:false,legacy407fCategory:"cl"}
  });
  assert.deepEqual(event407FToDocument(ui),source);
});

test("407F milestone and visibility mappings preserve export semantics",()=>{
  const event=event407FToDocument({
    id:"m1",
    t:"Step 2 CK",
    cat:"usmle",
    mile:true,
    s:"2025-06",
    e:null,
    vis:"hidden"
  });
  assert.equal(event.categoryId,"exams");
  assert.equal(event.eventType,"milestone");
  assert.equal(event.endDate,null);
  assert.equal(event.openEnded,false);
  assert.equal(event.visibilityState,"HIDDEN");
});

test("document and 407F state bridge preserves profile, theme, media, and events",()=>{
  const state={
    user:{events:[],interview:{prog:"",date:"",label:""}},
    profile:{name:"Dr. Baseline",country:"",visa:"",goal:"IM",s1:"",s2:""},
    sticky:"Baseline",
    media:{photos:{},logo:false,avatar:false},
    canvasTheme:"keynote",
    saved:false,
    sel:"x"
  };
  const document={
    studentProfile:{
      fullName:"Dr. Test",
      medicalSchool:"Albany Medical College",
      canonicalSchoolId:"mm-school-us-dapip-46-129312",
      medicalSchoolRecord:{
        canonical_school_id:"mm-school-us-dapip-46-129312",
        canonical_name:"Albany Medical College",
        country:"United States",
        school_type:"MD"
      },
      medicalSchoolCountry:"Ghana",
      currentUsWorkAuthorization:"F-1",
      residencyVisaTypesOpenTo:"Either",
      specialtyGoal:"Internal Medicine"
    },
    events:[{
      id:"e1",
      title:"Research",
      categoryId:"research",
      eventType:"duration",
      startDate:"2024-01",
      endDate:"2024-12",
      openEnded:false,
      visibilityState:"FULL_STORY",
      siteName:"",
      notes:"",
      lane:null,
      sourceType:"manual",
      provenance:[],
      fields:{}
    }],
    exams:[
      {
        id:"exam-usmle-step-1-attempt-1",
        system:"USMLE",
        examId:"step-1",
        attempt:1,
        result:"Passed",
        score:""
      },
      {
        id:"exam-usmle-step-2-ck-attempt-1",
        system:"USMLE",
        examId:"step-2-ck",
        attempt:1,
        result:"Passed",
        score:"252"
      }
    ],
    builder:{examSystems:["USMLE"]},
    theme:"clean-advisor-paper",
    metadata:{
      interview:{prog:"Rutgers",date:"2026-12",label:"RUTGERS IV"},
      stickyNote:"Tell the research story",
      boardMedia:{photos:{0:true},logo:true,avatar:false},
      step1Score:"246",
      step2Score:"251"
    }
  };
  applyDocumentTo407FState(document,state);
  assert.equal(state.profile.name,"Dr. Test");
  assert.equal(state.wiz.canonicalSchoolId,"mm-school-us-dapip-46-129312");
  assert.equal(state.wiz.schoolRecord.school_type,"MD");
  assert.equal(state.wiz.visa,"F-1");
  assert.equal(state.wiz.residencyVisaTypesOpenTo,"Either");
  assert.equal(state.canvasTheme,"paper");
  assert.equal(state.user.events[0].cat,"res");
  assert.equal(state.user.events[0].vis,"full");
  assert.equal(state.media.logo,true);
  assert.equal(state.profile.s1,"Passed");
  assert.equal(state.profile.s2,"252");

  const target={
    studentProfile:{},
    events:[],
    theme:"keynote-classic",
    metadata:{localOnly:true}
  };
  apply407FStateToDocument(state,target);
  assert.equal(target.events[0].categoryId,"research");
  assert.equal(target.events[0].visibilityState,"FULL_STORY");
  assert.equal(target.metadata.canonicalUi,"407F");
  assert.equal(target.metadata.productionWrites,false);
  assert.equal(target.metadata.localOnly,true);
  assert.equal("step1Score" in target.metadata,false);
  assert.equal("step2Score" in target.metadata,false);
  assert.equal(
    target.studentProfile.canonicalSchoolId,
    "mm-school-us-dapip-46-129312"
  );
  assert.equal(target.studentProfile.currentUsWorkAuthorization,"F-1");
  assert.equal(target.studentProfile.residencyVisaTypesOpenTo,"Either");
});
