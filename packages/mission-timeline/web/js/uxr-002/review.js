import {escapeHtml,formatMonth,monthIndex,monthString} from "./utils.js";

export const REVIEW_DOMAINS=Object.freeze([
  Object.freeze({step:1,id:"core",label:"Core Info",categoryId:"education"}),
  Object.freeze({step:2,id:"exams",label:"Exams",categoryId:"exams"}),
  Object.freeze({step:3,id:"clinical",label:"US Clinical Rotations",categoryId:"clinical"}),
  Object.freeze({step:4,id:"work",label:"Work Experience",categoryId:"work"}),
  Object.freeze({step:5,id:"research",label:"Research",categoryId:"research"}),
  Object.freeze({step:6,id:"personal",label:"Personal",categoryId:"personal"})
]);

function validMonth(value){
  const index=monthIndex(value);
  return Number.isInteger(index)?index:null;
}

function currentMonthIndex(now=new Date()){
  return now.getUTCFullYear()*12+now.getUTCMonth();
}

function eventDomain(event){
  return event?.fields?.builderDomain||
    REVIEW_DOMAINS.find((domain)=>domain.categoryId===event?.categoryId)?.id||
    null;
}

function countForDomain(document,domain){
  if(domain.id==="core"){
    return(document?.events||[]).some((event)=>
      eventDomain(event)==="core"||
      event?.fields?.builderDomain==="core"||
      event?.fields?.coreInfoMilestone
    )?1:0;
  }
  if(domain.id==="exams"){
    const exams=Array.isArray(document?.exams)?document.exams:[];
    if(exams.length)return exams.length;
  }
  return(document?.events||[]).filter((event)=>{
    if(domain.id==="exams"&&event?.fields?.studyPeriod)return false;
    return eventDomain(event)===domain.id||event?.categoryId===domain.categoryId;
  }).length;
}

function hasCoreValues(profile={}){
  return[
    profile.fullName,
    profile.medicalSchool,
    profile.medicalSchoolCountry,
    profile.graduationDate,
    profile.degree
  ].some((value)=>String(value||"").trim());
}

function coreComplete(profile={}){
  return[
    profile.fullName,
    profile.medicalSchool,
    profile.medicalSchoolCountry,
    profile.graduationDate,
    profile.degree
  ].every((value)=>String(value||"").trim())&&
    (profile.degree!=="Other"||String(profile.degreeOther||"").trim());
}

export function buildCompletenessSummary(document={}){
  const skipped=new Set(document?.builder?.skipped||[]);
  const touched=new Set(document?.builder?.touched||[]);
  return REVIEW_DOMAINS.map((domain)=>{
    const count=countForDomain(document,domain);
    let state="empty";
    if(domain.step===1){
      state=coreComplete(document.studentProfile)?"complete":
        hasCoreValues(document.studentProfile)?"started":"empty";
    }else if(count>0)state="complete";
    else if(skipped.has(domain.step))state="skipped";
    else if(touched.has(domain.step))state="started";
    return{...domain,count,state};
  });
}

function normalizedIntervals(events,{now=new Date()}={}){
  const present=currentMonthIndex(now);
  return(events||[]).flatMap((event)=>{
    const start=validMonth(event?.startDate);
    if(start==null)return[];
    const explicitEnd=validMonth(event?.endDate);
    const end=event?.eventType==="milestone"?start:
      event?.openEnded?Math.max(start,present):
      Math.max(start,explicitEnd??start);
    return[{
      id:String(event.id||""),
      event,
      start,
      end,
      step:REVIEW_DOMAINS.find((domain)=>
        domain.id===eventDomain(event)||domain.categoryId===event?.categoryId
      )?.step||1
    }];
  }).sort((a,b)=>a.start-b.start||b.end-a.end||a.id.localeCompare(b.id));
}

export function gapStoryChecks(events,{now=new Date()}={}){
  const intervals=normalizedIntervals(events,{now});
  if(intervals.length<2)return[];
  const checks=[];
  let coveredThrough=intervals[0].end;
  let prior=intervals[0];
  for(const interval of intervals.slice(1)){
    const gapMonths=interval.start-coveredThrough-1;
    if(gapMonths>=6){
      const firstGapMonth=coveredThrough+1;
      checks.push({
        id:`gap-${prior.id}-${interval.id}`,
        type:"gap",
        month:monthString(firstGapMonth),
        count:gapMonths,
        message:`There's a ${gapMonths}-month gap in ${Math.floor(firstGapMonth/12)}. Interviewers ask about gaps — add what happened, or be ready to talk about it.`,
        target:{step:interval.step,eventId:interval.id}
      });
    }
    if(interval.end>coveredThrough){
      coveredThrough=interval.end;
      prior=interval;
    }
  }
  return checks;
}

function overlapCountAt(intervals,month){
  return intervals.filter((interval)=>interval.start<=month&&interval.end>=month);
}

export function overlapStoryChecks(events,{now=new Date()}={}){
  const intervals=normalizedIntervals(events,{now}).filter(({event})=>event?.eventType!=="milestone");
  if(intervals.length<3)return[];
  const min=Math.min(...intervals.map((item)=>item.start));
  const max=Math.max(...intervals.map((item)=>item.end));
  const checks=[];
  let month=min;
  while(month<=max){
    const active=overlapCountAt(intervals,month);
    if(active.length<=2){month+=1;continue;}
    const runStart=month;
    let peakMonth=month,peak=active;
    while(month<=max){
      const current=overlapCountAt(intervals,month);
      if(current.length<=2)break;
      if(current.length>peak.length){
        peak=current;
        peakMonth=month;
      }
      month+=1;
    }
    const target=peak.slice().sort((a,b)=>a.start-b.start||a.id.localeCompare(b.id))[0];
    checks.push({
      id:`overlap-${runStart}-${peakMonth}`,
      type:"overlap",
      month:monthString(peakMonth),
      count:peak.length,
      message:`You have ${peak.length} things running at once in ${formatMonth(monthString(peakMonth))}. That's a strength — check the labels read clearly.`,
      target:{step:target.step,eventId:target.id}
    });
  }
  return checks;
}

export function awaitingExamStoryChecks(exams=[]){
  return(exams||[]).filter((exam)=>exam?.result==="Awaiting result").map((exam,index)=>{
    const name=String(exam.name||exam.examName||exam.examId||"Exam");
    return{
      id:`awaiting-${exam.id||index}`,
      type:"awaiting-exam",
      message:`${name} result pending — update it when it arrives.`,
      target:{step:2,examId:exam.id||null}
    };
  });
}

export function computeStoryChecks(document={},options={}){
  return[
    ...gapStoryChecks(document.events||[],options),
    ...overlapStoryChecks(document.events||[],options),
    ...awaitingExamStoryChecks(document.exams||[])
  ];
}

function stateGlyph(state){
  if(state==="complete")return"✓";
  if(state==="started")return"◐";
  if(state==="skipped")return"—";
  return"○";
}

function targetAttributes(target={}){
  return[
    `data-review-step="${Number(target.step)||1}"`,
    target.eventId?`data-review-event="${escapeHtml(target.eventId)}"`:"",
    target.examId?`data-review-exam="${escapeHtml(target.examId)}"`:""
  ].filter(Boolean).join(" ");
}

export function renderReviewFinish(document={},options={}){
  const completeness=buildCompletenessSummary(document);
  const checks=computeStoryChecks(document,options);
  return`<section class="review-finish" data-review-step-content>
    <section class="review-completeness" aria-labelledby="review-completeness-title">
      <h2 id="review-completeness-title">Completeness summary</h2>
      <ul>${completeness.map((row)=>`<li class="review-row ${row.state}">
        <span class="review-state" aria-label="${escapeHtml(row.state)}">${stateGlyph(row.state)}</span>
        <span>${escapeHtml(row.label)} · ${row.count} events</span>
        <button type="button" class="button tertiary" data-review-step="${row.step}">Edit</button>
      </li>`).join("")}</ul>
    </section>
    <section class="review-story-checks" aria-labelledby="review-story-checks-title">
      <h2 id="review-story-checks-title">Story checks</h2>
      <ul>${checks.map((check)=>`<li class="story-check" data-story-check="${escapeHtml(check.type)}">
        <span>${escapeHtml(check.message)}</span>
        <button type="button" class="button tertiary" ${targetAttributes(check.target)}>Review</button>
      </li>`).join("")}</ul>
    </section>
    <div class="review-actions">
      <button type="button" class="button primary" data-review-open-canvas>Open my canvas →</button>
      <button type="button" class="button secondary" data-review-export>Export now</button>
    </div>
  </section>`;
}

export function installReviewFinish(root,store,{onJump=null,onOpenCanvas=null,onExport=null}={}){
  root.querySelectorAll("[data-review-step]").forEach((button)=>button.addEventListener("click",()=>{
    const target={
      step:Number(button.dataset.reviewStep)||1,
      eventId:button.dataset.reviewEvent||null,
      examId:button.dataset.reviewExam||null
    };
    if(typeof onJump==="function"){
      onJump(target);
      return;
    }
    store.mutate("Review Builder entry",(document)=>{
      document.builder=document.builder||{};
      document.builder.step=target.step;
      document.builder.reviewFocus=target;
    },{history:false,material:false});
  }));
  root.querySelector("[data-review-open-canvas]")?.addEventListener("click",()=>{
    if(typeof onOpenCanvas==="function")onOpenCanvas();
    else store.navigate("canvas");
  });
  root.querySelector("[data-review-export]")?.addEventListener("click",()=>{
    if(typeof onExport==="function")onExport();
    else store.navigate("export");
  });
}
