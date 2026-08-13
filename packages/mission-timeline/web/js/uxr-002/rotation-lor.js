export const ROTATION_LOR_SCHEMA="d1-405.rotation-lor.1";
export const LOR_BUILDER_COMMAND_SCHEMA="d1-405.lor-builder-command.1";
export const LOR_BUILDER_QUEUE_SCHEMA="d1-405.lor-builder-local-queue.1";
export const LOR_BUILDER_ADAPTER_KIND="missionmed-lor-builder-todo-adapter";

export const LOR_STATUS_IDS=Object.freeze({
  NOT_REQUESTED:"not-requested",
  REQUEST_PLANNED:"request-planned",
  REQUESTED:"requested",
  WRITER_ACCEPTED:"writer-accepted",
  DRAFTING_IN_PROGRESS:"drafting-in-progress",
  UPLOADED:"uploaded",
  SUBMITTED_TO_ERAS:"submitted-to-eras",
  UNAVAILABLE:"unavailable",
  DECLINED:"declined",
  UNKNOWN:"unknown"
});

export const LOR_DERIVED_STATE_IDS=Object.freeze({
  SUBMITTED_TO_ERAS:"submitted-to-eras",
  AVAILABLE_NOT_SUBMITTED:"available-not-submitted",
  REQUESTED_IN_PROGRESS:"requested-in-progress",
  NO_LOR:"no-lor"
});

export const LOR_GUIDED_STATUS_OPTIONS=Object.freeze([
  Object.freeze({
    id:LOR_STATUS_IDS.NOT_REQUESTED,
    label:"Not requested",
    group:"Planning"
  }),
  Object.freeze({
    id:LOR_STATUS_IDS.REQUEST_PLANNED,
    label:"Request planned",
    group:"Planning"
  }),
  Object.freeze({
    id:LOR_STATUS_IDS.REQUESTED,
    label:"Requested",
    group:"In progress"
  }),
  Object.freeze({
    id:LOR_STATUS_IDS.WRITER_ACCEPTED,
    label:"Writer accepted",
    group:"In progress"
  }),
  Object.freeze({
    id:LOR_STATUS_IDS.DRAFTING_IN_PROGRESS,
    label:"Drafting / in progress",
    group:"In progress"
  }),
  Object.freeze({
    id:LOR_STATUS_IDS.UPLOADED,
    label:"Uploaded",
    group:"Available"
  }),
  Object.freeze({
    id:LOR_STATUS_IDS.SUBMITTED_TO_ERAS,
    label:"Submitted to ERAS",
    group:"Submitted"
  }),
  Object.freeze({
    id:LOR_STATUS_IDS.UNAVAILABLE,
    label:"Unavailable",
    group:"No LOR"
  }),
  Object.freeze({
    id:LOR_STATUS_IDS.DECLINED,
    label:"Declined",
    group:"No LOR"
  }),
  Object.freeze({
    id:LOR_STATUS_IDS.UNKNOWN,
    label:"Unknown",
    group:"Unclear"
  })
]);

export const LOR_DERIVED_STATES=Object.freeze({
  [LOR_DERIVED_STATE_IDS.SUBMITTED_TO_ERAS]:Object.freeze({
    id:LOR_DERIVED_STATE_IDS.SUBMITTED_TO_ERAS,
    label:"Submitted to ERAS"
  }),
  [LOR_DERIVED_STATE_IDS.AVAILABLE_NOT_SUBMITTED]:Object.freeze({
    id:LOR_DERIVED_STATE_IDS.AVAILABLE_NOT_SUBMITTED,
    label:"Available not submitted"
  }),
  [LOR_DERIVED_STATE_IDS.REQUESTED_IN_PROGRESS]:Object.freeze({
    id:LOR_DERIVED_STATE_IDS.REQUESTED_IN_PROGRESS,
    label:"Requested / in progress"
  }),
  [LOR_DERIVED_STATE_IDS.NO_LOR]:Object.freeze({
    id:LOR_DERIVED_STATE_IDS.NO_LOR,
    label:"No LOR"
  })
});

const STATUS_BY_ID=new Map(
  LOR_GUIDED_STATUS_OPTIONS.map((option)=>[option.id,option])
);
const STATUS_ALIASES=new Map(
  LOR_GUIDED_STATUS_OPTIONS.flatMap((option)=>[
    [option.id.toLowerCase(),option.id],
    [option.label.toLowerCase(),option.id]
  ])
);
STATUS_ALIASES.set("drafting/in progress",LOR_STATUS_IDS.DRAFTING_IN_PROGRESS);
STATUS_ALIASES.set("submitted",LOR_STATUS_IDS.SUBMITTED_TO_ERAS);

const DERIVED_STATE_BY_STATUS=Object.freeze({
  [LOR_STATUS_IDS.SUBMITTED_TO_ERAS]:LOR_DERIVED_STATE_IDS.SUBMITTED_TO_ERAS,
  [LOR_STATUS_IDS.UPLOADED]:LOR_DERIVED_STATE_IDS.AVAILABLE_NOT_SUBMITTED,
  [LOR_STATUS_IDS.REQUEST_PLANNED]:LOR_DERIVED_STATE_IDS.REQUESTED_IN_PROGRESS,
  [LOR_STATUS_IDS.REQUESTED]:LOR_DERIVED_STATE_IDS.REQUESTED_IN_PROGRESS,
  [LOR_STATUS_IDS.WRITER_ACCEPTED]:LOR_DERIVED_STATE_IDS.REQUESTED_IN_PROGRESS,
  [LOR_STATUS_IDS.DRAFTING_IN_PROGRESS]:LOR_DERIVED_STATE_IDS.REQUESTED_IN_PROGRESS,
  [LOR_STATUS_IDS.NOT_REQUESTED]:LOR_DERIVED_STATE_IDS.NO_LOR,
  [LOR_STATUS_IDS.UNAVAILABLE]:LOR_DERIVED_STATE_IDS.NO_LOR,
  [LOR_STATUS_IDS.DECLINED]:LOR_DERIVED_STATE_IDS.NO_LOR,
  [LOR_STATUS_IDS.UNKNOWN]:LOR_DERIVED_STATE_IDS.NO_LOR
});

const RECOMMENDED_TASK_BY_STATUS=Object.freeze({
  [LOR_STATUS_IDS.NOT_REQUESTED]:"plan-lor-request",
  [LOR_STATUS_IDS.REQUEST_PLANNED]:"send-lor-request",
  [LOR_STATUS_IDS.REQUESTED]:"follow-up-lor-request",
  [LOR_STATUS_IDS.WRITER_ACCEPTED]:"support-lor-writer",
  [LOR_STATUS_IDS.DRAFTING_IN_PROGRESS]:"follow-up-lor-draft",
  [LOR_STATUS_IDS.UPLOADED]:"submit-lor-to-eras",
  [LOR_STATUS_IDS.SUBMITTED_TO_ERAS]:"verify-lor-specialty-assignment",
  [LOR_STATUS_IDS.UNAVAILABLE]:"identify-alternate-lor-writer",
  [LOR_STATUS_IDS.DECLINED]:"identify-alternate-lor-writer",
  [LOR_STATUS_IDS.UNKNOWN]:"confirm-lor-status"
});

function deepFreeze(value){
  if(!value||typeof value!=="object"||Object.isFrozen(value))return value;
  Object.freeze(value);
  for(const child of Object.values(value))deepFreeze(child);
  return value;
}

function text(value){
  return String(value??"").trim();
}

function requiredText(value,label){
  const normalized=text(value);
  if(!normalized)throw new TypeError(`${label} is required.`);
  return normalized;
}

function compareRecords(left,right){
  return left.rotationId.localeCompare(right.rotationId)||
    left.targetSpecialtyId.localeCompare(right.targetSpecialtyId);
}

function normalizeTaxonomyReference(value,label){
  if(typeof value==="string"){
    const id=requiredText(value,`${label} ID`);
    return{id,label:id};
  }
  const id=requiredText(value?.id,`${label} ID`);
  return{id,label:text(value?.label)||id};
}

function normalizeQueueState(state){
  const commands=Array.isArray(state?.commands)
    ?state.commands.map((command)=>deepFreeze(structuredClone(command)))
    :[];
  return deepFreeze({
    schemaVersion:LOR_BUILDER_QUEUE_SCHEMA,
    mode:"local-only",
    productionConnected:false,
    commands
  });
}

function stableCommandId({timelineId,studentId,rotationId,targetSpecialtyId}){
  const identity=timelineId||studentId;
  return[
    "lor-builder-todo",
    identity,
    rotationId,
    targetSpecialtyId
  ].map((part)=>encodeURIComponent(part)).join(":");
}

export function normalizeLorStatus(status){
  const normalized=STATUS_ALIASES.get(text(status).toLowerCase());
  if(!normalized)throw new TypeError(`Unsupported LOR status: ${String(status)}`);
  return normalized;
}

export function deriveLorState(status){
  const statusId=normalizeLorStatus(status);
  return LOR_DERIVED_STATES[DERIVED_STATE_BY_STATUS[statusId]];
}

export function recommendedLorTaskType(status){
  return RECOMMENDED_TASK_BY_STATUS[normalizeLorStatus(status)];
}

export function createRotationLorState(records=[]){
  let state=deepFreeze({
    schemaVersion:ROTATION_LOR_SCHEMA,
    records:[]
  });
  for(const record of Array.isArray(records)?records:[]){
    state=setRotationLorStatus(state,{
      rotationId:record?.rotationId,
      targetSpecialtyId:record?.targetSpecialtyId,
      status:record?.status??record?.statusId
    });
  }
  return state;
}

export function setRotationLorStatus(state,{
  rotationId,
  targetSpecialtyId,
  status
}={}){
  const normalizedRotationId=requiredText(rotationId,"Rotation ID");
  const normalizedSpecialtyId=requiredText(
    targetSpecialtyId,
    "Target specialty ID"
  );
  const statusId=normalizeLorStatus(status);
  const record=deepFreeze({
    rotationId:normalizedRotationId,
    targetSpecialtyId:normalizedSpecialtyId,
    statusId
  });
  const records=(Array.isArray(state?.records)?state.records:[])
    .filter((item)=>!(
      item?.rotationId===normalizedRotationId&&
      item?.targetSpecialtyId===normalizedSpecialtyId
    ))
    .map((item)=>deepFreeze(structuredClone(item)));
  records.push(record);
  records.sort(compareRecords);
  return deepFreeze({
    schemaVersion:ROTATION_LOR_SCHEMA,
    records
  });
}

export function rotationLorStatus(state,{
  rotationId,
  targetSpecialtyId
}={}){
  const normalizedRotationId=requiredText(rotationId,"Rotation ID");
  const normalizedSpecialtyId=requiredText(
    targetSpecialtyId,
    "Target specialty ID"
  );
  const record=(state?.records||[]).find((item)=>
    item?.rotationId===normalizedRotationId&&
    item?.targetSpecialtyId===normalizedSpecialtyId
  );
  const statusId=record?.statusId||LOR_STATUS_IDS.NOT_REQUESTED;
  const option=STATUS_BY_ID.get(statusId)||STATUS_BY_ID.get(LOR_STATUS_IDS.UNKNOWN);
  return deepFreeze({
    rotationId:normalizedRotationId,
    targetSpecialtyId:normalizedSpecialtyId,
    statusId:option.id,
    statusLabel:option.label,
    derivedState:deriveLorState(option.id)
  });
}

export function rotationLorIndicator(state,{
  rotationId,
  selectedTargetSpecialtyId
}={}){
  const model=rotationLorStatus(state,{
    rotationId,
    targetSpecialtyId:selectedTargetSpecialtyId
  });
  const visible=model.statusId===LOR_STATUS_IDS.SUBMITTED_TO_ERAS;
  return deepFreeze({
    visible,
    rotationId:model.rotationId,
    targetSpecialtyId:model.targetSpecialtyId,
    symbol:visible?"★":"",
    symbolAriaHidden:true,
    accessibleLabel:visible?"LOR submitted":"",
    colorOnly:false
  });
}

export function createLorLegendModel(state,{
  selectedTargetSpecialtyId,
  rotationIds
}={}){
  const specialtyId=requiredText(
    selectedTargetSpecialtyId,
    "Selected target specialty ID"
  );
  const scopedRotationIds=Array.isArray(rotationIds)
    ?new Set(rotationIds.map((id)=>text(id)).filter(Boolean))
    :null;
  const visible=(state?.records||[]).some((record)=>
    record?.targetSpecialtyId===specialtyId&&
    record?.statusId===LOR_STATUS_IDS.SUBMITTED_TO_ERAS&&
    (!scopedRotationIds||scopedRotationIds.has(record.rotationId))
  );
  return deepFreeze({
    visible,
    symbol:"★",
    symbolAriaHidden:true,
    label:"LOR submitted",
    accessibleLabel:"LOR submitted",
    colorOnly:false
  });
}

export function createLorBuilderCommand({
  studentId="",
  timelineId="",
  rotationId,
  institution,
  specialty,
  preceptor="",
  rotationDates,
  currentStatus,
  requestedTargetSpecialty,
  recommendedTaskType
}={}){
  const normalizedStudentId=text(studentId);
  const normalizedTimelineId=text(timelineId);
  if(!normalizedStudentId&&!normalizedTimelineId){
    throw new TypeError("Student ID or timeline ID is required.");
  }
  const normalizedRotationId=requiredText(rotationId,"Rotation ID");
  const normalizedInstitution=requiredText(institution,"Institution");
  const rotationSpecialty=normalizeTaxonomyReference(
    specialty,
    "Rotation specialty"
  );
  const targetSpecialty=normalizeTaxonomyReference(
    requestedTargetSpecialty,
    "Requested target specialty"
  );
  const startDate=requiredText(rotationDates?.startDate,"Rotation start date");
  const endDate=requiredText(rotationDates?.endDate,"Rotation end date");
  const statusId=normalizeLorStatus(currentStatus);
  const taskType=text(recommendedTaskType)||recommendedLorTaskType(statusId);
  const payload={
    studentId:normalizedStudentId||null,
    timelineId:normalizedTimelineId||null,
    rotationId:normalizedRotationId,
    institution:normalizedInstitution,
    specialty:rotationSpecialty,
    preceptor:text(preceptor)||null,
    rotationDates:{startDate,endDate},
    currentLorStatus:{
      id:statusId,
      label:STATUS_BY_ID.get(statusId).label,
      derivedState:deriveLorState(statusId)
    },
    requestedTargetSpecialty:targetSpecialty,
    recommendedTaskType:taskType
  };
  return deepFreeze({
    schemaVersion:LOR_BUILDER_COMMAND_SCHEMA,
    command:"queue-lor-builder-todo",
    commandId:stableCommandId({
      timelineId:normalizedTimelineId,
      studentId:normalizedStudentId,
      rotationId:normalizedRotationId,
      targetSpecialtyId:targetSpecialty.id
    }),
    deliveryStatus:"queued-local",
    productionCreated:false,
    payload
  });
}

export function createLorBuilderQueueState(commands=[]){
  return normalizeQueueState({commands});
}

function localQueueResult(queueState,input){
  const current=normalizeQueueState(queueState);
  try{
    const command=createLorBuilderCommand(input);
    const existingIndex=current.commands.findIndex(
      (item)=>item.commandId===command.commandId
    );
    const commands=current.commands.slice();
    if(existingIndex>=0)commands[existingIndex]=command;
    else commands.push(command);
    const state=normalizeQueueState({commands});
    return deepFreeze({
      state,
      result:{
        status:"queued-local",
        productionCreated:false,
        commandId:command.commandId,
        updated:existingIndex>=0,
        message:"Queued locally. No production LOR Builder task was created."
      }
    });
  }catch(error){
    return deepFreeze({
      state:current,
      result:{
        status:"unavailable",
        productionCreated:false,
        commandId:null,
        updated:false,
        error:{
          code:"LOR_BUILDER_COMMAND_INVALID",
          message:String(error?.message||"The LOR Builder command is invalid.")
        },
        message:"Nothing was queued and the existing local queue was preserved."
      }
    });
  }
}

export function createLocalQueuedLorBuilderAdapter(){
  return Object.freeze({
    kind:LOR_BUILDER_ADAPTER_KIND,
    version:1,
    mode:"local-queue",
    productionConnected:false,
    queue:localQueueResult
  });
}

export function createUnavailableLorBuilderAdapter({
  reason="LOR Builder is not connected in this local candidate."
}={}){
  const message=text(reason)||"LOR Builder is not connected in this local candidate.";
  return Object.freeze({
    kind:LOR_BUILDER_ADAPTER_KIND,
    version:1,
    mode:"unavailable",
    productionConnected:false,
    queue(queueState){
      return deepFreeze({
        state:normalizeQueueState(queueState),
        result:{
          status:"unavailable",
          productionCreated:false,
          commandId:null,
          updated:false,
          error:{
            code:"LOR_BUILDER_UNAVAILABLE",
            message
          },
          message:"Nothing was queued and the existing local queue was preserved."
        }
      });
    }
  });
}

export function resolveLorBuilderAdapter(candidate){
  if(
    candidate?.kind===LOR_BUILDER_ADAPTER_KIND&&
    candidate.version===1&&
    candidate.productionConnected===false&&
    typeof candidate.queue==="function"
  ){
    return candidate;
  }
  return createUnavailableLorBuilderAdapter();
}
