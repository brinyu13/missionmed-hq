export const MATRIX_SCHEDULED_INTERVIEWS_CATEGORY="Scheduled Interviews";

function clone(value){
  return value==null?value:structuredClone(value);
}

function normalizeInterview(item={}){
  return Object.freeze({
    calendarEventId:String(item.calendarEventId||item.id||""),
    programName:String(item.programName||item.program||""),
    specialty:String(item.specialty||""),
    startsAt:String(item.startsAt||item.dateTime||item.date||""),
    location:String(item.location||""),
    meetingInformation:String(item.meetingInformation||item.meeting||""),
    category:MATRIX_SCHEDULED_INTERVIEWS_CATEGORY
  });
}

export function createUnavailableMatrixCalendarAdapter(){
  return Object.freeze({
    id:"matrix-calendar-unavailable",
    kind:"unavailable",
    live:false,
    productionWrites:false,
    async listScheduledInterviews(){
      return Object.freeze({
        status:"unavailable",
        live:false,
        category:MATRIX_SCHEDULED_INTERVIEWS_CATEGORY,
        interviews:Object.freeze([]),
        message:"Matrix Calendar interviews are not connected in this local review."
      });
    }
  });
}

export function createFixtureMatrixCalendarAdapter(items=[]){
  const interviews=Object.freeze(items.map(normalizeInterview));
  return Object.freeze({
    id:"matrix-calendar-test-fixture",
    kind:"fixture",
    live:false,
    productionWrites:false,
    async listScheduledInterviews(){
      return Object.freeze({
        status:interviews.length?"ready":"empty",
        live:false,
        category:MATRIX_SCHEDULED_INTERVIEWS_CATEGORY,
        interviews:clone(interviews),
        message:interviews.length
          ?`${interviews.length} local fixture interview${interviews.length===1?"":"s"}.`
          :"No scheduled interview fixtures."
      });
    }
  });
}

export function resolveMatrixCalendarAdapter(candidate){
  if(
    candidate?.productionWrites===false&&
    candidate?.live===false&&
    typeof candidate?.listScheduledInterviews==="function"
  )return candidate;
  return createUnavailableMatrixCalendarAdapter();
}
