import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";

import {
  renderKeynoteClassicBoard,
  serializeKeynoteClassicSvg
} from "../web/js/uxr-002/board-renderer.js";
import {
  THEME_DEFINITIONS,
  applyThemeToTimelineRender
} from "../web/js/uxr-002/themes.js";
import {
  timelineWithLorPresentation
} from "../web/js/407f-engineering-adapter.js";
import {contrastRatio} from "../web/js/uxr-002/utils.js";
import {
  LOR_BUILDER_ADAPTER_KIND,
  LOR_DERIVED_STATE_IDS,
  LOR_GUIDED_STATUS_OPTIONS,
  LOR_STATUS_IDS,
  createLocalQueuedLorBuilderAdapter,
  createLorBuilderCommand,
  createLorBuilderQueueState,
  createLorLegendModel,
  createRotationLorState,
  createUnavailableLorBuilderAdapter,
  deriveLorState,
  recommendedLorTaskType,
  resolveLorBuilderAdapter,
  rotationLorIndicator,
  rotationLorStatus,
  setRotationLorStatus
} from "../web/js/uxr-002/rotation-lor.js";

const css=await readFile(
  new URL("../web/styles/407f-upgrade.css",import.meta.url),
  "utf8"
);

const commandInput=Object.freeze({
  studentId:"student-17",
  timelineId:"timeline-407f",
  rotationId:"rotation-icu",
  institution:"Mission University Hospital",
  specialty:{id:"internal-medicine",label:"Internal Medicine"},
  preceptor:"Dr. Rivera",
  rotationDates:{startDate:"2026-01-05",endDate:"2026-02-01"},
  currentStatus:"writer-accepted",
  requestedTargetSpecialty:{
    id:"diagnostic-radiology",
    label:"Diagnostic Radiology"
  }
});

test("H3 exposes every founder-required guided LOR status in stable order",()=>{
  assert.deepEqual(
    LOR_GUIDED_STATUS_OPTIONS.map(({id,label})=>({id,label})),
    [
      {id:"not-requested",label:"Not requested"},
      {id:"request-planned",label:"Request planned"},
      {id:"requested",label:"Requested"},
      {id:"writer-accepted",label:"Writer accepted"},
      {id:"drafting-in-progress",label:"Drafting / in progress"},
      {id:"uploaded",label:"Uploaded"},
      {id:"submitted-to-eras",label:"Submitted to ERAS"},
      {id:"unavailable",label:"Unavailable"},
      {id:"declined",label:"Declined"},
      {id:"unknown",label:"Unknown"}
    ]
  );
});

test("H3 derives the four required LOR states from useful guided statuses",()=>{
  const expected=new Map([
    [LOR_STATUS_IDS.SUBMITTED_TO_ERAS,LOR_DERIVED_STATE_IDS.SUBMITTED_TO_ERAS],
    [LOR_STATUS_IDS.UPLOADED,LOR_DERIVED_STATE_IDS.AVAILABLE_NOT_SUBMITTED],
    [LOR_STATUS_IDS.REQUEST_PLANNED,LOR_DERIVED_STATE_IDS.REQUESTED_IN_PROGRESS],
    [LOR_STATUS_IDS.REQUESTED,LOR_DERIVED_STATE_IDS.REQUESTED_IN_PROGRESS],
    [LOR_STATUS_IDS.WRITER_ACCEPTED,LOR_DERIVED_STATE_IDS.REQUESTED_IN_PROGRESS],
    [LOR_STATUS_IDS.DRAFTING_IN_PROGRESS,LOR_DERIVED_STATE_IDS.REQUESTED_IN_PROGRESS],
    [LOR_STATUS_IDS.NOT_REQUESTED,LOR_DERIVED_STATE_IDS.NO_LOR],
    [LOR_STATUS_IDS.UNAVAILABLE,LOR_DERIVED_STATE_IDS.NO_LOR],
    [LOR_STATUS_IDS.DECLINED,LOR_DERIVED_STATE_IDS.NO_LOR],
    [LOR_STATUS_IDS.UNKNOWN,LOR_DERIVED_STATE_IDS.NO_LOR]
  ]);
  for(const [status,derived] of expected){
    assert.equal(deriveLorState(status).id,derived);
  }
  assert.equal(deriveLorState("drafting/in progress").id,"requested-in-progress");
  assert.throws(()=>deriveLorState("invented"),/Unsupported LOR status/);
});

test("H3 keeps LOR status immutable, per rotation, and per target specialty",()=>{
  const initial=createRotationLorState();
  const radiology=setRotationLorStatus(initial,{
    rotationId:"rotation-icu",
    targetSpecialtyId:"diagnostic-radiology",
    status:"submitted-to-eras"
  });
  const internalMedicine=setRotationLorStatus(radiology,{
    rotationId:"rotation-icu",
    targetSpecialtyId:"internal-medicine",
    status:"requested"
  });
  const secondRotation=setRotationLorStatus(internalMedicine,{
    rotationId:"rotation-surgery",
    targetSpecialtyId:"diagnostic-radiology",
    status:"unavailable"
  });

  assert.deepEqual(initial.records,[]);
  assert.equal(Object.isFrozen(secondRotation),true);
  assert.equal(Object.isFrozen(secondRotation.records),true);
  assert.equal(rotationLorStatus(secondRotation,{
    rotationId:"rotation-icu",
    targetSpecialtyId:"diagnostic-radiology"
  }).statusId,"submitted-to-eras");
  assert.equal(rotationLorStatus(secondRotation,{
    rotationId:"rotation-icu",
    targetSpecialtyId:"internal-medicine"
  }).statusId,"requested");
  assert.equal(rotationLorStatus(secondRotation,{
    rotationId:"rotation-surgery",
    targetSpecialtyId:"diagnostic-radiology"
  }).statusId,"unavailable");
  assert.equal(rotationLorStatus(secondRotation,{
    rotationId:"rotation-surgery",
    targetSpecialtyId:"internal-medicine"
  }).statusId,"not-requested");
  assert.deepEqual(
    createRotationLorState(structuredClone(secondRotation.records)),
    secondRotation,
    "serialized statusId records must round-trip through durable storage"
  );
});

test("H4 shows the accessible star only for a submitted LOR in the selected specialty",()=>{
  let state=createRotationLorState();
  state=setRotationLorStatus(state,{
    rotationId:"rotation-icu",
    targetSpecialtyId:"diagnostic-radiology",
    status:"submitted-to-eras"
  });
  state=setRotationLorStatus(state,{
    rotationId:"rotation-icu",
    targetSpecialtyId:"internal-medicine",
    status:"uploaded"
  });

  const radiology=rotationLorIndicator(state,{
    rotationId:"rotation-icu",
    selectedTargetSpecialtyId:"diagnostic-radiology"
  });
  assert.deepEqual(radiology,{
    visible:true,
    rotationId:"rotation-icu",
    targetSpecialtyId:"diagnostic-radiology",
    symbol:"★",
    symbolAriaHidden:true,
    accessibleLabel:"LOR submitted",
    colorOnly:false
  });

  const internalMedicine=rotationLorIndicator(state,{
    rotationId:"rotation-icu",
    selectedTargetSpecialtyId:"internal-medicine"
  });
  assert.equal(internalMedicine.visible,false);
  assert.equal(internalMedicine.symbol,"");
  assert.equal(internalMedicine.accessibleLabel,"");

  const legend=createLorLegendModel(state,{
    selectedTargetSpecialtyId:"diagnostic-radiology",
    rotationIds:["rotation-icu"]
  });
  assert.equal(legend.visible,true);
  assert.equal(legend.label,"LOR submitted");
  assert.equal(legend.accessibleLabel,"LOR submitted");
  assert.equal(legend.symbolAriaHidden,true);
  assert.equal(legend.colorOnly,false);
  assert.equal(createLorLegendModel(state,{
    selectedTargetSpecialtyId:"internal-medicine"
  }).visible,false);
});

test("H5 creates a stable complete local command without claiming production creation",()=>{
  const first=createLorBuilderCommand(commandInput);
  const second=createLorBuilderCommand(structuredClone(commandInput));
  assert.deepEqual(first,second);
  assert.equal(first.command,"queue-lor-builder-todo");
  assert.equal(
    first.commandId,
    "lor-builder-todo:timeline-407f:rotation-icu:diagnostic-radiology"
  );
  assert.equal(first.deliveryStatus,"queued-local");
  assert.equal(first.productionCreated,false);
  assert.deepEqual(first.payload,{
    studentId:"student-17",
    timelineId:"timeline-407f",
    rotationId:"rotation-icu",
    institution:"Mission University Hospital",
    specialty:{id:"internal-medicine",label:"Internal Medicine"},
    preceptor:"Dr. Rivera",
    rotationDates:{startDate:"2026-01-05",endDate:"2026-02-01"},
    currentLorStatus:{
      id:"writer-accepted",
      label:"Writer accepted",
      derivedState:{
        id:"requested-in-progress",
        label:"Requested / in progress"
      }
    },
    requestedTargetSpecialty:{
      id:"diagnostic-radiology",
      label:"Diagnostic Radiology"
    },
    recommendedTaskType:"support-lor-writer"
  });
  assert.equal(recommendedLorTaskType("uploaded"),"submit-lor-to-eras");
  assert.equal(Object.isFrozen(first.payload.rotationDates),true);
});

test("H5 local adapter queues idempotently and updates the same stable command",()=>{
  const adapter=createLocalQueuedLorBuilderAdapter();
  assert.equal(adapter.kind,LOR_BUILDER_ADAPTER_KIND);
  assert.equal(adapter.productionConnected,false);
  const initial=createLorBuilderQueueState();
  const queued=adapter.queue(initial,commandInput);
  assert.equal(queued.result.status,"queued-local");
  assert.equal(queued.result.productionCreated,false);
  assert.equal(queued.result.updated,false);
  assert.equal(queued.state.commands.length,1);
  assert.match(queued.result.message,/No production LOR Builder task was created/);

  const updated=adapter.queue(queued.state,{
    ...commandInput,
    currentStatus:"uploaded"
  });
  assert.equal(updated.result.updated,true);
  assert.equal(updated.state.commands.length,1);
  assert.equal(
    updated.state.commands[0].payload.currentLorStatus.id,
    "uploaded"
  );
});

test("H5 adapter failures preserve the queue and fail without fabricated success",()=>{
  const adapter=createLocalQueuedLorBuilderAdapter();
  const queued=adapter.queue(createLorBuilderQueueState(),commandInput);
  const failed=adapter.queue(queued.state,{
    ...commandInput,
    rotationId:""
  });
  assert.equal(failed.result.status,"unavailable");
  assert.equal(failed.result.productionCreated,false);
  assert.equal(failed.result.error.code,"LOR_BUILDER_COMMAND_INVALID");
  assert.deepEqual(failed.state,queued.state);
  assert.equal(failed.state.commands.length,1);

  const unavailable=createUnavailableLorBuilderAdapter({
    reason:"Local queue disabled for this review."
  });
  const unavailableResult=unavailable.queue(queued.state,commandInput);
  assert.equal(unavailableResult.result.status,"unavailable");
  assert.equal(unavailableResult.result.productionCreated,false);
  assert.equal(
    unavailableResult.result.error.message,
    "Local queue disabled for this review."
  );
  assert.deepEqual(unavailableResult.state,queued.state);
  assert.equal(resolveLorBuilderAdapter({productionConnected:true}).mode,"unavailable");
  assert.equal(resolveLorBuilderAdapter(adapter),adapter);
});

function submittedRotationDocument(targetSpecialtyId="acgme:internal-medicine"){
  return{
    id:"timeline-407f",
    studentProfile:{
      fullName:"Amara Osei",
      specialtyGoal:"Internal Medicine"
    },
    builder:{
      targetSpecialtyId:"acgme:internal-medicine",
      targetSpecialtyLabel:"Internal Medicine"
    },
    events:[{
      id:"rotation-event",
      title:"Internal Medicine · Mission University Hospital",
      categoryId:"clinical",
      eventType:"duration",
      startDate:"2025-06",
      endDate:"2025-07",
      openEnded:false,
      visibilityState:"INTERVIEWER_SAFE",
      fields:{
        builderEntryId:"rotation-entry",
        specialty:"Internal Medicine",
        specialtyId:"acgme:internal-medicine"
      }
    }],
    rotationLor:{
      records:[{
        rotationId:"rotation-entry",
        targetSpecialtyId,
        status:"submitted-to-eras"
      }]
    }
  };
}

test("H4 decorates only the active target specialty and keeps source events unchanged",()=>{
  const source=submittedRotationDocument();
  const decorated=timelineWithLorPresentation(source);
  assert.equal(decorated.events[0].fields.lorSubmitted,true);
  assert.equal(
    decorated.events[0].fields.lorSubmittedTargetSpecialtyId,
    "acgme:internal-medicine"
  );
  assert.equal(source.events[0].fields.lorSubmitted,undefined);

  const other=timelineWithLorPresentation(
    submittedRotationDocument("acgme:diagnostic-radiology")
  );
  assert.equal(other.events[0].fields.lorSubmitted,undefined);
});

test("H4 renders the accessible star and conditional legend in every approved theme",()=>{
  const base=renderKeynoteClassicBoard(
    timelineWithLorPresentation(submittedRotationDocument()),
    {currentMonth:"2026-07"}
  );
  for(const theme of THEME_DEFINITIONS){
    const themed=applyThemeToTimelineRender(base,theme.id);
    const svg=serializeKeynoteClassicSvg(themed.scene);
    assert.match(svg,/data-lor-submitted="true" role="img" aria-label="LOR submitted"/);
    assert.match(svg,/data-lor-legend="true"/);
    assert.match(svg,/>LOR submitted<\/div>/);
  }

  const withoutSubmission=renderKeynoteClassicBoard({
    ...submittedRotationDocument(),
    rotationLor:{records:[]}
  },{currentMonth:"2026-07"});
  assert.doesNotMatch(
    serializeKeynoteClassicSvg(withoutSubmission.scene),
    /data-lor-(submitted|legend)/
  );
});

test("H3 LOR micro-label keeps compact hierarchy and passes on both card gradient bounds",()=>{
  assert.match(
    css,
    /\.builderLorCard \.microLabel\{[\s\S]*color:#75cfea;[\s\S]*font-size:11px;[\s\S]*font-weight:650;/
  );
  assert.ok(contrastRatio("#75CFEA","#131B29")>=4.5);
  assert.ok(contrastRatio("#75CFEA","#080D16")>=4.5);
});
