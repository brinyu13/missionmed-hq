import {BUILDER_STEPS,VISIBILITY} from "./constants.js";
import {
  addBuilderExam,
  deleteBuilderExamAttempt,
  finalizeBuilderExams,
  setBuilderExamSystem,
  updateBuilderExamAttempt
} from "./exam-integration.js";
import {icon} from "./icons.js";
import {
  compareExactDates,
  exactDateFieldMarkup,
  installExactDateFields,
  monthFromExactDate,
  parseExactDate
} from "./exact-date-field.js";
import {installMonthFields,monthFieldMarkup} from "./month-field.js";
import {installReviewFinish,renderReviewFinish} from "./review.js";
import {escapeHtml,formatMonth,monthIndex,parseMonth,uid} from "./utils.js";

export const EXAM_SYSTEMS=Object.freeze({
  USMLE:Object.freeze({
    id:"USMLE",
    exams:Object.freeze([
      Object.freeze({id:"step-1",name:"Step 1",passFailOnly:true}),
      Object.freeze({id:"step-2-ck",name:"Step 2 CK",passFailOnly:false}),
      Object.freeze({id:"step-3",name:"Step 3",passFailOnly:false})
    ])
  }),
  "COMLEX-USA":Object.freeze({
    id:"COMLEX-USA",
    exams:Object.freeze([
      Object.freeze({id:"level-1",name:"Level 1",passFailOnly:true}),
      Object.freeze({id:"level-2-ce",name:"Level 2-CE",passFailOnly:false}),
      Object.freeze({id:"level-3",name:"Level 3",passFailOnly:false})
    ])
  })
});

export const PERSONAL_ICONS=Object.freeze([
  "heart","home","plane","baby","ring","star","flag","globe","shield","sun","book","sparkle"
]);

export const TYPEAHEAD_PROVIDER_KEYS=Object.freeze([
  "schools","countries","usTeachingInstitutions","institutions","specialties"
]);

const EMPTY_SEARCH=async()=>[];

export function typeaheadProviders(providers={}){
  return Object.fromEntries(TYPEAHEAD_PROVIDER_KEYS.map((key)=>{
    const provider=providers?.[key];
    return[key,provider&&typeof provider.search==="function"?provider:Object.freeze({search:EMPTY_SEARCH})];
  }));
}

function providerLabel(item){
  if(typeof item==="string")return item;
  if(item?.label)return String(item.label);
  const value=String(item?.value||item?.name||"");
  if(item?.city&&item?.state)return`${value} — ${item.city}, ${item.state}`;
  if(item?.country)return`${value} — ${item.country}`;
  return value;
}

export function typeaheadRows(query,matches,{allowFreeText=true,limit=8}={}){
  const typed=String(query||"").trim();
  if(typed.length<2)return[];
  const rows=(Array.isArray(matches)?matches:matches?.items||[]).slice(0,limit).map((item,index)=>{
    const source=typeof item==="string"?{value:item,label:item}:item||{};
    const value=String(source.value||source.name||source.label||"");
    return{
      ...source,
      id:String(source.id||`match-${index}`),
      kind:"match",
      value,
      label:providerLabel(source)
    };
  }).filter((item)=>item.value);
  if(allowFreeText)rows.push({
    id:"free-text",
    kind:"free-text",
    value:typed,
    label:`Use "${typed}" as written`
  });
  return rows;
}

export function rankCountryMatches(matches,{schoolCountry="",pinUnitedStates=true}={}){
  const school=String(schoolCountry||"").trim().toLocaleLowerCase();
  return[...(matches||[])].map((item,index)=>({item,index,label:providerLabel(item)})).sort((a,b)=>{
    const first=a.label.toLocaleLowerCase(),second=b.label.toLocaleLowerCase();
    const rank=(value)=>{
      if(school&&value===school)return 0;
      if(pinUnitedStates&&(value==="united states"||value==="united states of america"||value==="us"||value==="usa"))return 1;
      return 2;
    };
    return rank(first)-rank(second)||first.localeCompare(second)||a.index-b.index;
  }).map(({item})=>item);
}

function blankDraft(domain){
  if(domain==="clinical")return{
    institution:"",
    institutionShortName:"",
    specialty:"",
    rotationType:"",
    city:"",
    state:"",
    startDate:"",
    endDate:"",
    rotationStartDate:"",
    rotationEndDate:"",
    rotationDatePrecision:"unknown",
    current:false,
    notes:""
  };
  if(domain==="work")return{
    role:"",
    organization:"",
    country:"",
    city:"",
    kind:"",
    startDate:"",
    endDate:"",
    current:false,
    description:""
  };
  if(domain==="research")return{
    projectTitle:"",
    institution:"",
    institutionShortName:"",
    role:"",
    roleOther:"",
    startDate:"",
    endDate:"",
    ongoing:false,
    publicationStatus:"Not published",
    journal:"",
    publicationYear:"",
    authorPosition:"",
    doiOrPmid:"",
    markPublication:false
  };
  return{
    happened:"",
    whenKind:"One date",
    startDate:"",
    endDate:"",
    icon:"star",
    visibilityState:VISIBILITY.INTERVIEWER_SAFE
  };
}

function builderView(document){
  const source=document?.builder||{};
  return{
    step:Number(source.step)||1,
    skipped:Array.isArray(source.skipped)?source.skipped:[],
    touched:Array.isArray(source.touched)?source.touched:[],
    examSystems:Array.isArray(source.examSystems)?source.examSystems:[],
    drafts:{
      clinical:{...blankDraft("clinical"),...(source.drafts?.clinical||{})},
      work:{...blankDraft("work"),...(source.drafts?.work||{})},
      research:{...blankDraft("research"),...(source.drafts?.research||{})},
      personal:{...blankDraft("personal"),...(source.drafts?.personal||{})}
    },
    editing:{...(source.editing||{})}
  };
}

export function ensureBuilderState(document){
  document.builder=document.builder&&typeof document.builder==="object"?document.builder:{};
  const current=builderView(document);
  Object.assign(document.builder,current);
  return document.builder;
}

function hasValue(value){
  if(typeof value==="boolean")return value;
  if(Array.isArray(value))return value.length>0;
  return String(value??"").trim().length>0;
}

function entryEvents(document,domain){
  return(document?.events||[]).filter((event)=>event?.fields?.builderDomain===domain&&event?.fields?.builderEntryId&&!event?.fields?.publicationMilestone);
}

export function validateCoreInfo(profile={}){
  const errors={};
  if(!String(profile.fullName||"").trim())errors.fullName="Required.";
  if(!String(profile.medicalSchool||"").trim())errors.medicalSchool="Required.";
  if(!String(profile.medicalSchoolCountry||"").trim())errors.medicalSchoolCountry="Required.";
  if(!String(profile.graduationDate||"").trim())errors.graduationDate="Required.";
  else if(!parseMonth(profile.graduationDate))errors.graduationDate="Enter a month and year, like 'Jun 2023'.";
  if(!["MD","DO","MBBS","Other"].includes(profile.degree))errors.degree="Required.";
  else if(profile.degree==="Other"&&!String(profile.degreeOther||"").trim())errors.degreeOther="Required.";
  return errors;
}

export function validateExam(exam={}){
  const errors={};
  if(!["Passed","Failed","Awaiting result"].includes(exam.result))errors.result="Required.";
  if(!String(exam.examDate||"").trim())errors.examDate="Required.";
  else if(!parseMonth(exam.examDate))errors.examDate="Enter a month and year, like 'Jun 2023'.";
  if(exam.studyStartDate&&!parseMonth(exam.studyStartDate))errors.studyStartDate="Enter a month and year, like 'Jun 2023'.";
  if(exam.score!==""&&exam.score!=null){
    const value=Number(exam.score);
    if(!Number.isInteger(value)||(exam.system==="USMLE"&&(value<1||value>300)))errors.score="USMLE scores run 1–300.";
    if(!Number.isInteger(value)||(exam.system==="COMLEX-USA"&&(value<9||value>999)))errors.score="COMLEX scores run 9–999.";
  }
  return errors;
}

function dateOrderError(start,end){
  const first=monthIndex(start),last=monthIndex(end);
  return first!=null&&last!=null&&last<first?"End date is before the start date.":null;
}

export function validateBuilderEntry(domain,entry={}){
  const errors={};
  const exactRotation=domain==="clinical"&&(
    entry.rotationDatePrecision==="day"||
    !!entry.rotationStartDate||
    !!entry.rotationEndDate
  );
  const orderError=exactRotation
    ?(!entry.current&&compareExactDates(
      entry.rotationStartDate,
      entry.rotationEndDate
    )===1?"End date is before the start date.":null)
    :(!entry.current&&!entry.ongoing&&entry.whenKind!=="One date"
      ?dateOrderError(entry.startDate,entry.endDate)
      :null);
  if(domain==="clinical"){
    if(exactRotation&&!String(entry.specialty||"").trim())errors.specialty="Required.";
    if(exactRotation){
      if(!parseExactDate(entry.rotationStartDate))errors.rotationStartDate="Required.";
      if(!entry.current&&!parseExactDate(entry.rotationEndDate))errors.rotationEndDate="Required.";
    }
  }else if(domain==="work"){
    if(!String(entry.role||"").trim())errors.role="Required.";
    if(!String(entry.organization||"").trim())errors.organization="Required.";
    if(!String(entry.country||"").trim())errors.country="Required.";
    if(!["Clinical","Non-clinical"].includes(entry.kind))errors.kind="Required.";
  }else if(domain==="research"){
    if(!String(entry.projectTitle||"").trim())errors.projectTitle="Required.";
    if(entry.publicationStatus==="Published"){
      if(!String(entry.journal||"").trim())errors.journal="Required.";
      if(!/^\d{4}$/.test(String(entry.publicationYear||"")))errors.publicationYear="Required.";
      if(!String(entry.authorPosition||"").trim())errors.authorPosition="Required.";
    }
  }else if(domain==="personal"){
    if(!String(entry.happened||"").trim())errors.happened="Required.";
  }
  if(orderError)errors.endDate=orderError;
  if(orderError&&exactRotation){
    delete errors.endDate;
    errors.rotationEndDate=orderError;
  }
  return errors;
}

function stepHasStarted(document,step){
  const builder=builderView(document);
  if(step===1)return Object.values(document?.studentProfile||{}).some(hasValue);
  if(step===2)return builder.examSystems.length>0||(document?.exams||[]).length>0;
  const domain={3:"clinical",4:"work",5:"research",6:"personal"}[step];
  if(!domain)return false;
  return entryEvents(document,domain).length>0||Object.entries(builder.drafts[domain]).some(([key,value])=>{
    if(domain==="clinical"&&key==="rotationDatePrecision")return value!=="unknown";
    if(domain==="research"&&key==="publicationStatus")return value!=="Not published";
    if(domain==="personal"&&key==="whenKind")return value!=="One date";
    if(domain==="personal"&&key==="icon")return value!=="star";
    if(domain==="personal"&&key==="visibilityState")return value!==VISIBILITY.INTERVIEWER_SAFE;
    return hasValue(value);
  });
}

export function builderStepState(document,step){
  if(step===7)return"none";
  if(step===1){
    if(Object.keys(validateCoreInfo(document?.studentProfile||{})).length===0)return"complete";
    return stepHasStarted(document,step)?"started":"untouched";
  }
  const domain={3:"clinical",4:"work",5:"research",6:"personal"}[step];
  const hasEntry=step===2?(document?.exams||[]).length>0:entryEvents(document,domain).length>0;
  if(hasEntry)return"complete";
  if(stepHasStarted(document,step))return"started";
  if(builderView(document).skipped.includes(step))return"skipped";
  return"untouched";
}

export function builderStepStates(document){
  return BUILDER_STEPS.map((_,index)=>builderStepState(document,index+1));
}

function markStepTouched(document,step){
  const builder=ensureBuilderState(document);
  if(!builder.touched.includes(step))builder.touched.push(step);
  builder.skipped=builder.skipped.filter((value)=>value!==step);
}

function builderEventBase({id,entryId,domain,categoryId,title,eventType,startDate,endDate,openEnded,visibilityState,siteName="",notes="",fields={}}){
  return{
    id,
    title,
    categoryId,
    eventType,
    startDate:startDate||"",
    endDate:endDate||null,
    openEnded:!!openEnded,
    visibilityState:visibilityState||VISIBILITY.INTERVIEWER_SAFE,
    siteName,
    notes,
    lane:null,
    sourceType:"guided-builder",
    provenance:[],
    fields:{...fields,builderDomain:domain,builderEntryId:entryId}
  };
}

export function projectRotationDates(entry={}){
  const rotationStartDate=parseExactDate(entry.rotationStartDate);
  const rotationEndDate=entry.current?null:parseExactDate(entry.rotationEndDate);
  const dayPrecision=!!rotationStartDate&&(entry.current||!!rotationEndDate);
  return Object.freeze({
    rotationStartDate,
    rotationEndDate,
    rotationDatePrecision:dayPrecision
      ?"day"
      :(parseMonth(entry.startDate)?"month-legacy":"unknown"),
    startDate:rotationStartDate
      ?monthFromExactDate(rotationStartDate)
      :(parseMonth(entry.startDate)||""),
    endDate:entry.current
      ?null
      :(rotationEndDate
        ?monthFromExactDate(rotationEndDate)
        :(parseMonth(entry.endDate)||null))
  });
}

export function eventFromBuilderEntry(domain,entry,{entryId=null,eventId=null,idFactory=uid}={}){
  const resolvedEntryId=entryId||idFactory(`${domain}-entry`);
  const resolvedEventId=eventId||idFactory(`${domain}-event`);
  if(domain==="clinical"){
    const rotationDates=projectRotationDates(entry);
    const title=[entry.specialty,entry.institutionShortName||entry.institution].filter(Boolean).join(" · ");
    return builderEventBase({
      id:resolvedEventId,
      entryId:resolvedEntryId,
      domain,
      categoryId:"clinical",
      title,
      eventType:"duration",
      startDate:rotationDates.startDate,
      endDate:rotationDates.endDate,
      openEnded:entry.current,
      siteName:entry.institution||"",
      notes:entry.notes||"",
      fields:{
        institution:entry.institution||"",
        institutionShortName:entry.institutionShortName||"",
        specialty:entry.specialty||"",
        rotationType:entry.rotationType||"",
        city:entry.city||"",
        state:entry.state||"",
        current:!!entry.current,
        rotationStartDate:rotationDates.rotationStartDate,
        rotationEndDate:rotationDates.rotationEndDate,
        rotationDatePrecision:rotationDates.rotationDatePrecision
      }
    });
  }
  if(domain==="work"){
    return builderEventBase({
      id:resolvedEventId,
      entryId:resolvedEntryId,
      domain,
      categoryId:"work",
      title:[entry.role,entry.organization].filter(Boolean).join(" · "),
      eventType:"duration",
      startDate:entry.startDate,
      endDate:entry.current?null:entry.endDate,
      openEnded:entry.current,
      siteName:entry.organization||"",
      notes:entry.description||"",
      fields:{
        role:entry.role||"",
        organization:entry.organization||"",
        country:entry.country||"",
        city:entry.city||"",
        kind:entry.kind||"",
        current:!!entry.current,
        description:entry.description||""
      }
    });
  }
  if(domain==="research"){
    return builderEventBase({
      id:resolvedEventId,
      entryId:resolvedEntryId,
      domain,
      categoryId:"research",
      title:entry.projectTitle||"",
      eventType:"duration",
      startDate:entry.startDate,
      endDate:entry.ongoing?null:entry.endDate,
      openEnded:entry.ongoing,
      siteName:entry.institution||"",
      fields:{
        projectTitle:entry.projectTitle||"",
        institution:entry.institution||"",
        institutionShortName:entry.institutionShortName||"",
        role:entry.role||"",
        roleOther:entry.roleOther||"",
        ongoing:!!entry.ongoing,
        publicationStatus:entry.publicationStatus||"Not published",
        journal:entry.journal||"",
        publicationYear:String(entry.publicationYear||""),
        authorPosition:entry.authorPosition||"",
        doiOrPmid:entry.doiOrPmid||"",
        markPublication:!!entry.markPublication
      }
    });
  }
  return builderEventBase({
    id:resolvedEventId,
    entryId:resolvedEntryId,
    domain:"personal",
    categoryId:"personal",
    title:entry.happened||"",
    eventType:entry.whenKind==="A period"?"duration":"milestone",
    startDate:entry.startDate,
    endDate:entry.whenKind==="A period"?entry.endDate:null,
    openEnded:false,
    visibilityState:entry.visibilityState||VISIBILITY.INTERVIEWER_SAFE,
    fields:{
      happened:entry.happened||"",
      whenKind:entry.whenKind||"One date",
      icon:entry.icon||"star"
    }
  });
}

const AUTHOR_SHORT=Object.freeze({
  "First author":"1st",
  "Co-first author":"co-1st",
  "Second author":"2nd",
  "Middle author":"mid",
  "Last / senior author":"last",
  "Corresponding author":"corr."
});

function publicationMilestone(entry,entryId,eventId,idFactory){
  const month=/^\d{4}$/.test(String(entry.publicationYear||""))?`${entry.publicationYear}-01`:"";
  return builderEventBase({
    id:eventId||idFactory("research-publication"),
    entryId,
    domain:"research",
    categoryId:"research",
    title:[entry.journal,AUTHOR_SHORT[entry.authorPosition]||entry.authorPosition].filter(Boolean).join(" · "),
    eventType:"milestone",
    startDate:month,
    endDate:null,
    openEnded:false,
    fields:{
      publicationMilestone:true,
      journal:entry.journal||"",
      publicationYear:String(entry.publicationYear||""),
      authorPosition:entry.authorPosition||""
    }
  });
}

export function commitBuilderEntry(document,domain,entry,{entryId=null,idFactory=uid}={}){
  const errors=validateBuilderEntry(domain,entry);
  if(Object.keys(errors).length)return{ok:false,errors};
  const builder=ensureBuilderState(document);
  const resolvedEntryId=entryId||builder.editing[domain]||idFactory(`${domain}-entry`);
  const existing=(document.events||[]).find((event)=>event?.fields?.builderEntryId===resolvedEntryId&&!event?.fields?.publicationMilestone);
  const event=eventFromBuilderEntry(domain,entry,{
    entryId:resolvedEntryId,
    eventId:existing?.id,
    idFactory
  });
  document.events=Array.isArray(document.events)?document.events:[];
  const index=document.events.findIndex((item)=>item.id===event.id);
  if(index>=0)document.events[index]={...existing,...event};
  else document.events.push(event);
  if(domain==="research"){
    const publicationIndex=document.events.findIndex((item)=>item?.fields?.builderEntryId===resolvedEntryId&&item?.fields?.publicationMilestone);
    const shouldMark=entry.publicationStatus==="Published"&&entry.markPublication;
    if(shouldMark){
      const milestone=publicationMilestone(entry,resolvedEntryId,publicationIndex>=0?document.events[publicationIndex].id:null,idFactory);
      if(publicationIndex>=0)document.events[publicationIndex]={...document.events[publicationIndex],...milestone};
      else document.events.push(milestone);
    }else if(publicationIndex>=0)document.events.splice(publicationIndex,1);
  }
  builder.drafts[domain]=blankDraft(domain);
  delete builder.editing[domain];
  markStepTouched(document,{clinical:3,work:4,research:5,personal:6}[domain]);
  return{ok:true,errors:{},entryId:resolvedEntryId,event};
}

export function entryFromBuilderEvent(event){
  const domain=event?.fields?.builderDomain;
  const fields=event?.fields||{};
  if(domain==="clinical")return{
    ...blankDraft(domain),
    institution:fields.institution||event.siteName||"",
    institutionShortName:fields.institutionShortName||"",
    specialty:fields.specialty||"",
    rotationType:fields.rotationType||"",
    city:fields.city||"",
    state:fields.state||"",
    startDate:event.startDate||"",
    endDate:event.endDate||"",
    rotationStartDate:fields.rotationStartDate||"",
    rotationEndDate:fields.rotationEndDate||"",
    rotationDatePrecision:fields.rotationDatePrecision||(
      event.startDate?"month-legacy":"unknown"
    ),
    current:!!event.openEnded,
    notes:event.notes||""
  };
  if(domain==="work")return{
    ...blankDraft(domain),
    role:fields.role||"",
    organization:fields.organization||event.siteName||"",
    country:fields.country||"",
    city:fields.city||"",
    kind:fields.kind||"",
    startDate:event.startDate||"",
    endDate:event.endDate||"",
    current:!!event.openEnded,
    description:fields.description||event.notes||""
  };
  if(domain==="research")return{
    ...blankDraft(domain),
    projectTitle:fields.projectTitle||event.title||"",
    institution:fields.institution||event.siteName||"",
    institutionShortName:fields.institutionShortName||"",
    role:fields.role||"",
    roleOther:fields.roleOther||"",
    startDate:event.startDate||"",
    endDate:event.endDate||"",
    ongoing:!!event.openEnded,
    publicationStatus:fields.publicationStatus||"Not published",
    journal:fields.journal||"",
    publicationYear:fields.publicationYear||"",
    authorPosition:fields.authorPosition||"",
    doiOrPmid:fields.doiOrPmid||"",
    markPublication:!!fields.markPublication
  };
  return{
    ...blankDraft("personal"),
    happened:fields.happened||event?.title||"",
    whenKind:event?.eventType==="duration"?"A period":"One date",
    startDate:event?.startDate||"",
    endDate:event?.endDate||"",
    icon:fields.icon||"star",
    visibilityState:event?.visibilityState||VISIBILITY.INTERVIEWER_SAFE
  };
}

export function builderStepForEvent(event){
  const domain=event?.fields?.builderDomain;
  return{core:1,exams:2,clinical:3,work:4,research:5,personal:6}[domain]||null;
}

export function beginBuilderEntryEdit(document,eventId){
  const event=(document.events||[]).find((item)=>item.id===eventId);
  const domain=event?.fields?.builderDomain;
  if(!domain||event?.fields?.publicationMilestone)return false;
  const builder=ensureBuilderState(document);
  const step=builderStepForEvent(event);
  if(!step)return false;
  builder.step=step;
  if(domain==="core"||domain==="exams")return true;
  builder.drafts[domain]=entryFromBuilderEvent(event);
  builder.editing[domain]=event.fields.builderEntryId;
  return true;
}

export function deleteBuilderEntry(document,eventId){
  const event=(document.events||[]).find((item)=>item.id===eventId);
  const entryId=event?.fields?.builderEntryId;
  if(!entryId)return false;
  const before=document.events.length;
  document.events=document.events.filter((item)=>item?.fields?.builderEntryId!==entryId);
  const builder=ensureBuilderState(document);
  for(const [domain,value] of Object.entries(builder.editing)){
    if(value===entryId){
      delete builder.editing[domain];
      builder.drafts[domain]=blankDraft(domain);
    }
  }
  return document.events.length!==before;
}

export function syncEducationMilestone(document,{idFactory=uid}={}){
  document.events=Array.isArray(document.events)?document.events:[];
  const profile=document.studentProfile||{};
  const index=document.events.findIndex((event)=>event?.fields?.builderDomain==="core"&&event?.fields?.educationMilestone);
  if(!String(profile.medicalSchool||"").trim()||!parseMonth(profile.graduationDate)){
    if(index>=0)document.events.splice(index,1);
    return null;
  }
  const existing=index>=0?document.events[index]:null;
  const school=profile.medicalSchoolShortName||profile.medicalSchool;
  const event=builderEventBase({
    id:existing?.id||idFactory("education-degree"),
    entryId:"medical-degree",
    domain:"core",
    categoryId:"education",
    title:`Medical Degree — ${school}`,
    eventType:"milestone",
    startDate:parseMonth(profile.graduationDate),
    endDate:null,
    openEnded:false,
    fields:{
      educationMilestone:true,
      medicalSchool:profile.medicalSchool,
      medicalSchoolCountry:profile.medicalSchoolCountry||"",
      degree:profile.degree||"",
      degreeOther:profile.degreeOther||"",
      expectedGraduation:!!profile.expectedGraduation
    }
  });
  if(index>=0)document.events[index]={...existing,...event};
  else document.events.push(event);
  return event;
}

function requiredMark(){
  return'<span class="required-mark" aria-hidden="true"> *</span>';
}

function errorMarkup(id){
  return`<p class="field-error" id="${escapeHtml(id)}-error" data-error-for="${escapeHtml(id)}" aria-live="polite"></p>`;
}

function textField({id,label,value="",required=false,placeholder="",type="text",inputmode="",attributes=""}){
  return`<div class="field">
    <label for="${escapeHtml(id)}">${escapeHtml(label)}${required?requiredMark():""}</label>
    <input id="${escapeHtml(id)}" name="${escapeHtml(id)}" type="${escapeHtml(type)}" ${inputmode?`inputmode="${escapeHtml(inputmode)}"`:""} value="${escapeHtml(value)}" ${placeholder?`placeholder="${escapeHtml(placeholder)}"`:""} ${required?"required":""} aria-describedby="${escapeHtml(id)}-error" ${attributes}>
    ${errorMarkup(id)}
  </div>`;
}

function typeaheadField({id,label,value="",provider,context,required=false,placeholder="",allowFreeText=true}){
  const listId=`${id}-options`;
  return`<div class="field typeahead-field" data-typeahead-field data-typeahead-provider="${escapeHtml(provider)}" data-typeahead-context="${escapeHtml(context)}" data-allow-free-text="${String(allowFreeText)}">
    <label for="${escapeHtml(id)}">${escapeHtml(label)}${required?requiredMark():""}</label>
    <input id="${escapeHtml(id)}" name="${escapeHtml(id)}" type="search" role="combobox" aria-autocomplete="list" aria-controls="${escapeHtml(listId)}" aria-expanded="false" aria-describedby="${escapeHtml(id)}-error" autocomplete="off" value="${escapeHtml(value)}" ${placeholder?`placeholder="${escapeHtml(placeholder)}"`:""} ${required?"required":""}>
    <ul id="${escapeHtml(listId)}" class="typeahead-options" role="listbox" hidden></ul>
    ${errorMarkup(id)}
  </div>`;
}

function segmented({legend,name,values,selected,required=false,attributes=""}){
  return`<fieldset class="field segmented-field" ${attributes}>
    <legend>${escapeHtml(legend)}${required?requiredMark():""}</legend>
    <div class="segmented">${values.map((value)=>{
      const option=typeof value==="string"?{label:value,value}:value;
      return`<label><input type="radio" name="${escapeHtml(name)}" value="${escapeHtml(option.value)}" ${selected===option.value?"checked":""}><span>${escapeHtml(option.label)}</span></label>`;
    }).join("")}</div>
    ${errorMarkup(name)}
  </fieldset>`;
}

function selectField({id,label,value="",options,required=false}){
  return`<div class="field">
    <label for="${escapeHtml(id)}">${escapeHtml(label)}${required?requiredMark():""}</label>
    <select id="${escapeHtml(id)}" name="${escapeHtml(id)}" ${required?"required":""} aria-describedby="${escapeHtml(id)}-error">
      <option value="">Select</option>
      ${options.map((option)=>{
        const item=typeof option==="string"?{label:option,value:option}:option;
        return`<option value="${escapeHtml(item.value)}" ${value===item.value?"selected":""}>${escapeHtml(item.label)}</option>`;
      }).join("")}
    </select>
    ${errorMarkup(id)}
  </div>`;
}

function stateGlyph(state){
  if(state==="complete")return icon("check",{size:15});
  if(state==="started")return"◐";
  if(state==="skipped")return"—";
  return"○";
}

function renderStepper(document){
  const current=builderView(document).step;
  return`<nav class="wizard-stepper" aria-label="Builder steps">${BUILDER_STEPS.map((item,index)=>{
    const step=index+1,state=builderStepState(document,step);
    return`<button type="button" class="wizard-step ${step===current?"active":""}" data-builder-step="${step}" ${step===current?'aria-current="step"':""}>
      <span class="step-number">${step}</span>
      <span>${escapeHtml(item.title)}</span>
      ${step===7?"":`<span class="step-state ${state}" aria-label="${escapeHtml(state)}">${stateGlyph(state)}</span>`}
    </button>`;
  }).join("")}</nav>`;
}

function renderCore(document){
  const profile=document.studentProfile||{};
  const expected=!!profile.expectedGraduation;
  return`<form class="core-info-form" data-core-form novalidate>
    ${textField({id:"fullName",label:"Full name",value:profile.fullName,required:true,placeholder:"e.g., Amara Osei",attributes:'data-profile-field="fullName"'})}
    ${typeaheadField({id:"medicalSchool",label:"Medical school",value:profile.medicalSchool,provider:"schools",context:"core-school",required:true})}
    ${typeaheadField({id:"medicalSchoolCountry",label:"Medical school country",value:profile.medicalSchoolCountry,provider:"countries",context:"core-country",required:true,allowFreeText:false})}
    ${monthFieldMarkup({id:"core-graduation-date",label:expected?"Expected graduation":"Graduation date",value:profile.graduationDate,required:true})}
    <label class="check-row"><input type="checkbox" name="expectedGraduation" data-profile-field="expectedGraduation" ${expected?"checked":""}><span>I haven't graduated yet</span></label>
    ${segmented({legend:"Degree",name:"degree",values:["MD","DO","MBBS","Other"],selected:profile.degree,required:true,attributes:'data-profile-group="degree"'})}
    ${profile.degree==="Other"?textField({id:"degreeOther",label:"Degree (other)",value:profile.degreeOther,required:true,attributes:'data-profile-field="degreeOther"'}):""}
    ${selectField({id:"visaStatus",label:"Visa / work status",value:profile.visaStatus,options:["US citizen / permanent resident","Need H-1B","Need J-1","Other (text)","Prefer not to say"]})}
    ${profile.visaStatus==="Other (text)"?textField({id:"visaStatusOther",label:"Visa / work status (other)",value:profile.visaStatusOther,attributes:'data-profile-field="visaStatusOther"'}):""}
  </form>`;
}

function examDefinition(exam){
  return EXAM_SYSTEMS[exam.system]?.exams.find((item)=>item.id===exam.examId)||{
    id:exam.examId,
    name:exam.name||exam.examId,
    passFailOnly:!!exam.passFailOnly
  };
}

function ordinal(value){
  const number=Number(value)||1;
  const mod100=number%100;
  if(mod100>=11&&mod100<=13)return`${number}th`;
  return`${number}${number%10===1?"st":number%10===2?"nd":number%10===3?"rd":"th"}`;
}

function renderExamCard(exam){
  const definition=examDefinition(exam);
  const attempt=Number(exam.attempt)||1;
  const title=attempt>1?`${definition.name} — ${ordinal(attempt)} attempt`:definition.name;
  const scoreError=validateExam(exam).score||"";
  return`<article class="exam-card" data-exam-card data-exam-id="${escapeHtml(exam.id)}">
    <header><h3>${escapeHtml(title)}</h3><button type="button" class="button tertiary" data-delete-exam="${escapeHtml(exam.id)}">Delete</button></header>
    <div class="exam-primary-row">
      ${segmented({legend:"Result",name:`result-${exam.id}`,values:["Passed","Failed","Awaiting result"],selected:exam.result,required:true,attributes:'data-exam-result-group'})}
      ${definition.passFailOnly?"":`<div class="field score-field">
        <label for="score-${escapeHtml(exam.id)}">Score (optional)</label>
        <input id="score-${escapeHtml(exam.id)}" name="score" data-exam-field="score" inputmode="numeric" pattern="[0-9]{1,3}" maxlength="3" value="${escapeHtml(exam.score||"")}" aria-describedby="score-${escapeHtml(exam.id)}-error">
        <p class="field-error" id="score-${escapeHtml(exam.id)}-error" data-error-for="score" aria-live="polite">${escapeHtml(scoreError)}</p>
      </div>`}
    </div>
    <div class="exam-secondary-row">
      ${monthFieldMarkup({id:`exam-date-${exam.id}`,label:exam.result==="Awaiting result"?"Exam date (taken)":"Exam date",value:exam.examDate,required:true})}
      ${monthFieldMarkup({id:`exam-study-${exam.id}`,label:"Started studying (optional)",value:exam.studyStartDate})}
    </div>
    ${definition.passFailOnly?"":`<label class="check-row"><input type="checkbox" name="showScoreOnTimeline" data-exam-field="showScoreOnTimeline" ${exam.showScoreOnTimeline?"checked":""} ${exam.result==="Failed"?"disabled":""}><span>Show score on timeline</span></label>`}
  </article>`;
}

function renderExams(document){
  const builder=builderView(document);
  const selected=new Set(builder.examSystems);
  const exams=Array.isArray(document.exams)?document.exams:[];
  const chips=[];
  for(const systemId of builder.examSystems){
    const system=EXAM_SYSTEMS[systemId];
    if(!system)continue;
    for(const exam of system.exams){
      if(!exams.some((item)=>item.system===systemId&&item.examId===exam.id&&(Number(item.attempt)||1)===1)){
        chips.push(`<button type="button" class="exam-add-chip" data-add-exam-system="${escapeHtml(systemId)}" data-add-exam-id="${escapeHtml(exam.id)}">+ Add ${escapeHtml(exam.name)}</button>`);
      }
    }
  }
  return`<section class="exam-step">
    <fieldset class="exam-system-selection">
      <legend>Exam systems</legend>
      <div class="exam-system-cards">${Object.values(EXAM_SYSTEMS).map((system)=>`<label class="exam-system-card ${selected.has(system.id)?"selected":""}"><input type="checkbox" data-exam-system="${escapeHtml(system.id)}" ${selected.has(system.id)?"checked":""}><span>${escapeHtml(system.id)}</span></label>`).join("")}</div>
    </fieldset>
    ${selected.size===0?'<p class="step-helper">Choose USMLE, COMLEX, or both.</p>':`<div class="exam-add-chips" aria-label="Add exams">${chips.join("")}</div>`}
    <section class="added-exams" aria-labelledby="added-exams-title">
      <h2 id="added-exams-title">Added exams</h2>
      ${exams.length?exams.map(renderExamCard).join(""):'<p class="step-helper">No exams added yet.</p>'}
    </section>
    ${skipLink()}
  </section>`;
}

function entryInputAttributes(domain,field){
  return`data-draft-domain="${escapeHtml(domain)}" data-draft-field="${escapeHtml(field)}"`;
}

function clinicalForm(draft,editing){
  return`<form class="entry-card" data-entry-form="clinical" novalidate>
    <h2>${editing?"Edit rotation":"Add a rotation"}</h2>
    ${typeaheadField({id:"clinicalInstitution",label:"Institution",value:draft.institution,provider:"usTeachingInstitutions",context:"clinical-institution"})}
    ${typeaheadField({id:"clinicalSpecialty",label:"Specialty",value:draft.specialty,provider:"specialties",context:"clinical-specialty"})}
    ${selectField({id:"clinicalRotationType",label:"Rotation type",value:draft.rotationType,options:["Elective","Sub-internship","Observership","Externship","Clerkship (core)","Other"]})}
    <div class="field-row">
      ${textField({id:"clinicalCity",label:"City",value:draft.city,attributes:entryInputAttributes("clinical","city")})}
      ${textField({id:"clinicalState",label:"State",value:draft.state,attributes:entryInputAttributes("clinical","state")})}
    </div>
    <div class="field-row">
      ${exactDateFieldMarkup({id:"clinical-rotation-start",label:"Start date",value:draft.rotationStartDate,required:true,inputAttributes:{name:"rotationStartDate"},help:draft.rotationDatePrecision==="month-legacy"?`Legacy month ${formatMonth(draft.startDate)} — choose the exact day.`:"Exact day required."})}
      ${draft.current?"":exactDateFieldMarkup({id:"clinical-rotation-end",label:"End date",value:draft.rotationEndDate,required:true,inputAttributes:{name:"rotationEndDate"},help:draft.rotationDatePrecision==="month-legacy"?`Legacy month ${formatMonth(draft.endDate)} — choose the exact day.`:"Exact day required."})}
    </div>
    <label class="check-row"><input type="checkbox" name="current" data-draft-domain="clinical" data-draft-field="current" ${draft.current?"checked":""}><span>Currently on this rotation</span></label>
    ${textField({id:"clinicalNotes",label:"Notes (optional)",value:draft.notes,placeholder:"e.g., attending name",attributes:entryInputAttributes("clinical","notes")})}
    <div class="entry-actions"><button type="button" class="button primary" data-save-entry="clinical">${editing?"Save changes":"Add rotation"}</button>${editing?'<button type="button" class="button tertiary" data-cancel-entry="clinical">Cancel</button>':""}</div>
  </form>`;
}

function workForm(draft,editing,schoolCountry){
  return`<form class="entry-card" data-entry-form="work" novalidate data-school-country="${escapeHtml(schoolCountry||"")}">
    <h2>${editing?"Edit work experience":"Add work experience"}</h2>
    ${textField({id:"workRole",label:"Role / title",value:draft.role,required:true,attributes:entryInputAttributes("work","role")})}
    ${textField({id:"workOrganization",label:"Organization",value:draft.organization,required:true,attributes:entryInputAttributes("work","organization")})}
    ${typeaheadField({id:"workCountry",label:"Country",value:draft.country,provider:"countries",context:"work-country",required:true,allowFreeText:false})}
    ${textField({id:"workCity",label:"City (optional)",value:draft.city,attributes:entryInputAttributes("work","city")})}
    ${segmented({legend:"Kind",name:"kind",values:["Clinical","Non-clinical"],selected:draft.kind,required:true,attributes:'data-draft-group="work"'})}
    <div class="field-row">
      ${monthFieldMarkup({id:"work-start",label:"Start",value:draft.startDate})}
      ${draft.current?"":monthFieldMarkup({id:"work-end",label:"End",value:draft.endDate})}
    </div>
    <label class="check-row"><input type="checkbox" name="current" data-draft-domain="work" data-draft-field="current" ${draft.current?"checked":""}><span>I still work here</span></label>
    ${textField({id:"workDescription",label:"One-line description (optional)",value:draft.description,attributes:entryInputAttributes("work","description")})}
    <div class="entry-actions"><button type="button" class="button primary" data-save-entry="work">${editing?"Save changes":"Add work experience"}</button>${editing?'<button type="button" class="button tertiary" data-cancel-entry="work">Cancel</button>':""}</div>
  </form>`;
}

function researchForm(draft,editing){
  const hasPublication=["Submitted","Accepted","Published"].includes(draft.publicationStatus);
  return`<form class="entry-card" data-entry-form="research" novalidate>
    <h2>${editing?"Edit research":"Add research"}</h2>
    ${textField({id:"researchProjectTitle",label:"Project title",value:draft.projectTitle,required:true,attributes:entryInputAttributes("research","projectTitle")})}
    ${typeaheadField({id:"researchInstitution",label:"Institution / lab",value:draft.institution,provider:"institutions",context:"research-institution"})}
    ${selectField({id:"researchRole",label:"Role",value:draft.role,options:["Research assistant","Research fellow","Coordinator","Volunteer","Principal investigator","Other (text)"]})}
    ${draft.role==="Other (text)"?textField({id:"researchRoleOther",label:"Role (other)",value:draft.roleOther,attributes:entryInputAttributes("research","roleOther")}):""}
    <div class="field-row">
      ${monthFieldMarkup({id:"research-start",label:"Start",value:draft.startDate})}
      ${draft.ongoing?"":monthFieldMarkup({id:"research-end",label:"End",value:draft.endDate})}
    </div>
    <label class="check-row"><input type="checkbox" name="ongoing" data-draft-domain="research" data-draft-field="ongoing" ${draft.ongoing?"checked":""}><span>Ongoing</span></label>
    ${segmented({legend:"Publication status",name:"publicationStatus",values:["Not published","Submitted","Accepted","Published"],selected:draft.publicationStatus||"Not published",attributes:'data-draft-group="research"'})}
    ${hasPublication?`<div class="publication-fields">
      ${textField({id:"researchJournal",label:"Journal / venue",value:draft.journal,required:draft.publicationStatus==="Published",attributes:entryInputAttributes("research","journal")})}
      ${textField({id:"researchPublicationYear",label:"Publication year",value:draft.publicationYear,required:draft.publicationStatus==="Published",inputmode:"numeric",attributes:`maxlength="4" ${entryInputAttributes("research","publicationYear")}`})}
      ${selectField({id:"researchAuthorPosition",label:"Author position",value:draft.authorPosition,required:draft.publicationStatus==="Published",options:["First author","Co-first author","Second author","Middle author","Last / senior author","Corresponding author"]})}
      ${textField({id:"researchDoiOrPmid",label:"DOI or PMID (optional)",value:draft.doiOrPmid,attributes:entryInputAttributes("research","doiOrPmid")})}
      <label class="check-row"><input type="checkbox" name="markPublication" data-draft-domain="research" data-draft-field="markPublication" ${draft.markPublication?"checked":""}><span>Mark the publication on the timeline</span></label>
    </div>`:""}
    <div class="entry-actions"><button type="button" class="button primary" data-save-entry="research">${editing?"Save changes":"Add research"}</button>${editing?'<button type="button" class="button tertiary" data-cancel-entry="research">Cancel</button>':""}</div>
  </form>`;
}

const PERSONAL_GLYPHS=Object.freeze({
  heart:"♥",home:"⌂",plane:"✈",baby:"●",ring:"◯",star:"★",flag:"⚑",globe:"◎",shield:"⬟",sun:"☀",book:"▤",sparkle:"✦"
});

function personalForm(draft,editing){
  return`<form class="entry-card" data-entry-form="personal" novalidate>
    <h2>${editing?"Edit personal event":"Add personal event"}</h2>
    ${textField({id:"personalHappened",label:"What happened",value:draft.happened,required:true,placeholder:"e.g., Moved to the US · Became a parent · Military service",attributes:entryInputAttributes("personal","happened")})}
    ${segmented({legend:"When",name:"whenKind",values:["One date","A period"],selected:draft.whenKind||"One date",attributes:'data-draft-group="personal"'})}
    <div class="field-row">
      ${monthFieldMarkup({id:"personal-start",label:draft.whenKind==="A period"?"Start":"Date",value:draft.startDate})}
      ${draft.whenKind==="A period"?monthFieldMarkup({id:"personal-end",label:"End",value:draft.endDate}):""}
    </div>
    <fieldset class="field icon-picker"><legend>Icon</legend><div class="personal-icons">${PERSONAL_ICONS.map((name)=>`<label title="${escapeHtml(name)}"><input type="radio" name="icon" value="${escapeHtml(name)}" ${(draft.icon||"star")===name?"checked":""}><span aria-hidden="true">${PERSONAL_GLYPHS[name]}</span><span class="sr-only">${escapeHtml(name)}</span></label>`).join("")}</div></fieldset>
    ${segmented({legend:"Visibility",name:"visibilityState",values:[
      {label:"Show everyone",value:VISIBILITY.INTERVIEWER_SAFE},
      {label:"Advisor only",value:VISIBILITY.ADVISOR_ONLY}
    ],selected:draft.visibilityState||VISIBILITY.INTERVIEWER_SAFE,attributes:'data-draft-group="personal"'})}
    <div class="entry-actions"><button type="button" class="button primary" data-save-entry="personal">${editing?"Save changes":"Add personal event"}</button>${editing?'<button type="button" class="button tertiary" data-cancel-entry="personal">Cancel</button>':""}</div>
  </form>`;
}

function eventSummary(event,domain){
  const fields=event.fields||{};
  const dates=event.openEnded?`${formatMonth(event.startDate)}–now`:event.eventType==="milestone"?formatMonth(event.startDate):`${formatMonth(event.startDate)}–${formatMonth(event.endDate)}`;
  if(domain==="clinical")return`${fields.specialty||""} · ${fields.institution||event.siteName||""} · ${dates}`;
  if(domain==="work")return`${fields.role||""} · ${fields.organization||event.siteName||""} · ${dates}`;
  if(domain==="research")return`${fields.projectTitle||event.title||""} · ${dates}`;
  return`${event.title||""} · ${dates}`;
}

function savedEntryList(document,domain){
  const events=entryEvents(document,domain);
  if(!events.length)return'<p class="entry-list-empty">Nothing added yet.</p>';
  return`<ul class="saved-entry-list">${events.map((event)=>`<li data-saved-entry="${escapeHtml(event.id)}">
    <span>${escapeHtml(eventSummary(event,domain))}</span>
    ${event.visibilityState===VISIBILITY.ADVISOR_ONLY?'<span class="advisor-only-indicator" aria-label="Advisor only"><svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 3l18 18"/><path d="M10.6 10.7a2 2 0 0 0 2.7 2.7"/><path d="M9.9 4.2A10.8 10.8 0 0 1 12 4c5.5 0 9 5.2 9 8a8.8 8.8 0 0 1-2 3.5"/><path d="M6.6 6.6C4.3 8.1 3 10.4 3 12c0 2.8 3.5 8 9 8 1.1 0 2.1-.2 3-.5"/></svg></span>':""}
    <button type="button" class="button tertiary" data-edit-entry="${escapeHtml(event.id)}">Edit</button>
    <button type="button" class="button tertiary" data-delete-entry="${escapeHtml(event.id)}">Delete</button>
  </li>`).join("")}</ul>`;
}

function skipLink(){
  return'<button type="button" class="button tertiary skip-step" data-skip-step>I have nothing to add here → skip</button>';
}

function renderEntryStep(document,domain){
  const builder=builderView(document),draft=builder.drafts[domain],editing=!!builder.editing[domain];
  const form=domain==="clinical"?clinicalForm(draft,editing):
    domain==="work"?workForm(draft,editing,document.studentProfile?.medicalSchoolCountry):
    domain==="research"?researchForm(draft,editing):
    personalForm(draft,editing);
  return`<section class="builder-entry-step" data-entry-domain="${escapeHtml(domain)}">
    ${form}
    <section class="saved-entries" aria-label="Saved ${escapeHtml(domain)} entries">${savedEntryList(document,domain)}</section>
    ${skipLink()}
  </section>`;
}

export function renderBuilderEntryDetails(document,event){
  const domain=event?.fields?.builderDomain;
  if(domain==="core")return renderCore(document);
  if(domain==="exams"){
    const entryId=String(event?.fields?.builderEntryId||"");
    const exam=(document?.exams||[]).find((item)=>String(item.id)===entryId);
    return exam
      ?renderExamCard(exam)
      :'<p class="field-help">This exam detail is managed from the Exams step.</p>';
  }
  const entry=entryFromBuilderEvent(event);
  if(domain==="clinical")return clinicalForm(entry,true);
  if(domain==="work")return workForm(entry,true,document?.studentProfile?.medicalSchoolCountry);
  if(domain==="research")return researchForm(entry,true);
  if(domain==="personal")return personalForm(entry,true);
  return'<p class="field-help">This event has no Builder-owned details.</p>';
}

function renderStepBody(document,step){
  if(step===1)return renderCore(document);
  if(step===2)return renderExams(document);
  if(step===3)return renderEntryStep(document,"clinical");
  if(step===4)return renderEntryStep(document,"work");
  if(step===5)return renderEntryStep(document,"research");
  if(step===6)return renderEntryStep(document,"personal");
  return renderReviewFinish(document);
}

export function renderBuilder(store,{previewHtml=""}={}){
  const document=store?.document||store||{};
  const stepNumber=Math.max(1,Math.min(7,builderView(document).step));
  const step=BUILDER_STEPS[stepNumber-1];
  return`<div class="screen builder-screen" data-screen="builder">
    <div class="builder-layout">
      ${renderStepper(document)}
      <section class="wizard-form" aria-labelledby="builder-title">
        <h1 id="builder-title" tabindex="-1">${escapeHtml(step.title)}</h1>
        <p class="screen-purpose">${escapeHtml(step.purpose)}</p>
        <button type="button" class="button secondary show-preview" data-show-builder-preview aria-expanded="false">Show preview</button>
        ${renderStepBody(document,stepNumber)}
        <footer class="wizard-footer">
          <button type="button" class="button tertiary" data-builder-back ${stepNumber===1?"disabled":""}>← Back</button>
          ${stepNumber===7?"":'<button type="button" class="button primary" data-builder-next>Continue →</button>'}
        </footer>
      </section>
      <aside class="builder-preview" aria-label="Live timeline preview">
        ${previewHtml||'<div class="preview-empty"><span class="axis-illustration" aria-hidden="true"></span><p>Your timeline appears here as you answer.</p></div>'}
      </aside>
    </div>
  </div>`;
}

function setInlineErrors(form,errors){
  form?.querySelectorAll?.("[data-error-for]").forEach((node)=>{node.textContent="";});
  const domain=form?.dataset?.entryForm;
  const domainAliases={
    work:{
      role:"workRole",
      organization:"workOrganization",
      country:"workCountry",
      kind:"kind",
      endDate:"work-end"
    },
    research:{
      projectTitle:"researchProjectTitle",
      journal:"researchJournal",
      publicationYear:"researchPublicationYear",
      authorPosition:"researchAuthorPosition",
      endDate:"research-end"
    },
    personal:{
      happened:"personalHappened",
      endDate:"personal-end"
    },
    clinical:{
      rotationStartDate:"clinical-rotation-start",
      rotationEndDate:"clinical-rotation-end"
    }
  };
  for(const [field,message] of Object.entries(errors||{})){
    const aliases={
      graduationDate:"core-graduation-date",
      degree:"degree",
      ...(domainAliases[domain]||{})
    };
    const key=aliases[field]||field;
    const examNode=field==="result"?form?.querySelector?.("[data-exam-result-group] .field-error"):
      field==="examDate"?form?.querySelector?.('[data-month-field^="exam-date-"] .field-error'):
      field==="studyStartDate"?form?.querySelector?.('[data-month-field^="exam-study-"] .field-error'):
      null;
    const node=examNode||
      form?.querySelector?.(`[data-error-for="${key}"]`)||
      form?.querySelector?.(`[data-error-for$="${key}"]`)||
      form?.querySelector?.(`[name="${key}"]`)?.closest?.(".field")?.querySelector?.(".field-error");
    if(node)node.textContent=message;
  }
  const first=Object.keys(errors||{})[0];
  if(first){
    const key={graduationDate:"core-graduation-date",...(domainAliases[domain]||{})}[first]||first;
    form?.querySelector?.(`[name="${key}"],#${key}`)?.focus?.();
  }
}

function formValue(form,name){
  const control=form?.elements?.namedItem?.(name)||form?.querySelector?.(`[name="${name}"]`);
  if(!control)return"";
  if(typeof RadioNodeList!=="undefined"&&control instanceof RadioNodeList)return control.value;
  if(control.type==="checkbox")return!!control.checked;
  return String(control.value||"");
}

function profileFromForm(form,current={}){
  return{
    ...current,
    fullName:formValue(form,"fullName").trim(),
    medicalSchool:formValue(form,"medicalSchool").trim(),
    medicalSchoolCountry:formValue(form,"medicalSchoolCountry").trim(),
    graduationDate:parseMonth(formValue(form,"core-graduation-date"))||formValue(form,"core-graduation-date").trim(),
    expectedGraduation:!!formValue(form,"expectedGraduation"),
    degree:formValue(form,"degree"),
    degreeOther:formValue(form,"degreeOther").trim(),
    visaStatus:formValue(form,"visaStatus"),
    visaStatusOther:formValue(form,"visaStatusOther").trim()
  };
}

function draftFromForm(form,domain,current={}){
  const next={...current};
  const fields={
    clinical:["clinicalInstitution","clinicalSpecialty","clinicalRotationType","clinicalCity","clinicalState","clinicalNotes"],
    work:["workRole","workOrganization","workCountry","workCity","kind","workDescription"],
    research:["researchProjectTitle","researchInstitution","researchRole","researchRoleOther","publicationStatus","researchJournal","researchPublicationYear","researchAuthorPosition","researchDoiOrPmid"],
    personal:["personalHappened","whenKind","icon","visibilityState"]
  }[domain]||[];
  const maps={
    clinical:{clinicalInstitution:"institution",clinicalSpecialty:"specialty",clinicalRotationType:"rotationType",clinicalCity:"city",clinicalState:"state",clinicalNotes:"notes"},
    work:{workRole:"role",workOrganization:"organization",workCountry:"country",workCity:"city",workDescription:"description"},
    research:{researchProjectTitle:"projectTitle",researchInstitution:"institution",researchRole:"role",researchRoleOther:"roleOther",researchJournal:"journal",researchPublicationYear:"publicationYear",researchAuthorPosition:"authorPosition",researchDoiOrPmid:"doiOrPmid"},
    personal:{personalHappened:"happened"}
  }[domain]||{};
  for(const field of fields){
    const key=maps[field]||field,value=formValue(form,field);
    if(value!==""||Object.hasOwn(next,key))next[key]=typeof value==="string"?value.trim():value;
  }
  const booleanName={clinical:"current",work:"current",research:"ongoing"}[domain];
  if(booleanName)next[booleanName]=!!formValue(form,booleanName);
  if(domain==="research")next.markPublication=!!formValue(form,"markPublication");
  if(domain==="clinical"){
    next.rotationStartDate=parseExactDate(formValue(form,"rotationStartDate"))||formValue(form,"rotationStartDate").trim();
    next.rotationEndDate=next.current?"":(
      parseExactDate(formValue(form,"rotationEndDate"))||
      formValue(form,"rotationEndDate").trim()
    );
    const projected=projectRotationDates(next);
    Object.assign(next,projected);
    return next;
  }
  for(const [suffix,key] of [["start","startDate"],["end","endDate"]]){
    const raw=formValue(form,`${domain}-${suffix}`);
    if(raw)next[key]=parseMonth(raw)||raw;
    else if(suffix==="end"&&(next.current||next.ongoing||next.whenKind==="One date"))next[key]="";
  }
  return next;
}

function examRecord(systemId,examId,idFactory){
  const definition=EXAM_SYSTEMS[systemId]?.exams.find((item)=>item.id===examId);
  if(!definition)return null;
  return{
    id:idFactory("exam"),
    system:systemId,
    examId,
    name:definition.name,
    passFailOnly:definition.passFailOnly,
    attempt:1,
    result:"",
    score:"",
    examDate:"",
    studyStartDate:"",
    showScoreOnTimeline:false,
    sourceType:"guided-builder"
  };
}

function installTypeahead(root,store,providers){
  root.querySelectorAll("[data-typeahead-field]").forEach((field)=>{
    const input=field.querySelector('input[role="combobox"]'),list=field.querySelector('[role="listbox"]');
    if(!input||!list)return;
    const providerKey=field.dataset.typeaheadProvider;
    const provider=providers[providerKey];
    const allowFreeText=field.dataset.allowFreeText!=="false";
    let request=0,rows=[],active=-1;
    const close=()=>{
      list.hidden=true;
      input.setAttribute("aria-expanded","false");
      input.removeAttribute("aria-activedescendant");
      active=-1;
    };
    const commit=(row)=>{
      input.value=row.value;
      close();
      const context=field.dataset.typeaheadContext;
      store.mutate("Choose typeahead value",(document)=>{
        if(context==="core-school"){
          document.studentProfile.medicalSchool=row.value;
          document.studentProfile.medicalSchoolShortName=row.shortName||row.value;
          if(row.kind==="match"&&row.country)document.studentProfile.medicalSchoolCountry=String(row.country);
          syncEducationMilestone(document);
          markStepTouched(document,1);
        }else if(context==="core-country"){
          document.studentProfile.medicalSchoolCountry=row.value;
          syncEducationMilestone(document);
          markStepTouched(document,1);
        }else{
          const domain=context.split("-")[0],builder=ensureBuilderState(document),draft=builder.drafts[domain];
          if(context==="clinical-institution"){
            draft.institution=row.value;
            draft.institutionShortName=row.shortName||row.value;
            draft.city=row.kind==="match"?String(row.city||""):"";
            draft.state=row.kind==="match"?String(row.state||""):"";
          }else if(context==="clinical-specialty")draft.specialty=row.value;
          else if(context==="research-institution"){
            draft.institution=row.value;
            draft.institutionShortName=row.shortName||row.value;
          }else if(context==="work-country")draft.country=row.value;
          markStepTouched(document,{clinical:3,work:4,research:5}[domain]);
        }
      });
    };
    const paint=()=>{
      list.innerHTML=rows.map((row,index)=>`<li role="option" id="${escapeHtml(input.id)}-option-${index}" aria-selected="${String(index===active)}"><button type="button" data-typeahead-index="${index}">${escapeHtml(row.label)}</button></li>`).join("");
      list.hidden=!rows.length;
      input.setAttribute("aria-expanded",String(rows.length>0));
      if(active>=0)input.setAttribute("aria-activedescendant",`${input.id}-option-${active}`);
      else input.removeAttribute("aria-activedescendant");
      list.querySelectorAll("[data-typeahead-index]").forEach((button)=>button.addEventListener("mousedown",(event)=>{
        event.preventDefault();
        commit(rows[Number(button.dataset.typeaheadIndex)]);
      }));
    };
    const search=async()=>{
      const query=input.value.trim(),token=++request;
      if(query.length<2){rows=[];paint();return;}
      let matches=await provider.search(query,{limit:8,context:field.dataset.typeaheadContext});
      if(token!==request)return;
      if(providerKey==="countries")matches=rankCountryMatches(Array.isArray(matches)?matches:matches?.items||[],{
        schoolCountry:store.document.studentProfile?.medicalSchoolCountry
      });
      rows=typeaheadRows(query,matches,{allowFreeText,limit:8});
      active=-1;
      paint();
    };
    input.addEventListener("input",()=>{search().catch(()=>{rows=typeaheadRows(input.value,[],{allowFreeText,limit:8});paint();});});
    input.addEventListener("keydown",(event)=>{
      if(event.key==="ArrowDown"&&rows.length){event.preventDefault();active=(active+1)%rows.length;paint();}
      else if(event.key==="ArrowUp"&&rows.length){event.preventDefault();active=(active-1+rows.length)%rows.length;paint();}
      else if(event.key==="Enter"&&rows.length){
        event.preventDefault();
        commit(rows[active>=0?active:rows.length-1]);
      }else if(event.key==="Escape"){event.preventDefault();close();}
    });
    input.addEventListener("blur",()=>{
      setTimeout(close,0);
      if(!input.value.trim())return;
      const fallback={kind:"free-text",value:input.value.trim()};
      const context=field.dataset.typeaheadContext;
      if(context!=="core-country"&&context!=="work-country")commit(fallback);
      else{
        store.mutate("Commit country",(document)=>{
          if(context==="core-country"){
            document.studentProfile.medicalSchoolCountry=fallback.value;
            syncEducationMilestone(document);
            markStepTouched(document,1);
          }else{
            ensureBuilderState(document).drafts.work.country=fallback.value;
            markStepTouched(document,4);
          }
        });
      }
    });
  });
}

export function installBuilder(root,store,{
  providers:providerInput={},
  toast=()=>{},
  idFactory=uid
}={}){
  const providers=typeaheadProviders(providerInput);
  root.querySelector("[data-show-builder-preview]")?.addEventListener("click",(event)=>{
    const screen=root.querySelector(".builder-screen");
    const open=!screen?.classList.contains("preview-overlay-open");
    screen?.classList.toggle("preview-overlay-open",open);
    event.currentTarget.setAttribute("aria-expanded",String(open));
    event.currentTarget.textContent=open?"Close preview":"Show preview";
  });
  root.querySelectorAll("[data-builder-step]").forEach((button)=>button.addEventListener("click",()=>{
    store.mutate("Choose Builder step",(document)=>{
      ensureBuilderState(document).step=Number(button.dataset.builderStep);
    },{history:false,material:false});
  }));
  root.querySelector("[data-builder-back]")?.addEventListener("click",()=>store.mutate("Previous Builder step",(document)=>{
    const builder=ensureBuilderState(document);
    builder.step=Math.max(1,builder.step-1);
  },{history:false,material:false}));
  root.querySelector("[data-builder-next]")?.addEventListener("click",()=>{
    const step=builderView(store.document).step;
    if(step===7){
      store.mutate("Finish Builder exams",(document)=>{finalizeBuilderExams(document);});
      store.navigate("canvas");
      return;
    }
    if(step===1){
      const form=root.querySelector("[data-core-form]");
      const profile=profileFromForm(form,store.document.studentProfile);
      const errors=validateCoreInfo(profile);
      store.mutate("Continue Core Info",(document)=>{
        document.studentProfile={...document.studentProfile,...profile};
        syncEducationMilestone(document,{idFactory});
        markStepTouched(document,1);
        if(!Object.keys(errors).length)ensureBuilderState(document).step=2;
      });
      if(Object.keys(errors).length)setInlineErrors(form,errors);
      return;
    }
    store.mutate("Next Builder step",(document)=>{
      const builder=ensureBuilderState(document);
      builder.step=Math.min(7,builder.step+1);
    },{history:false,material:false});
  });
  root.querySelector("[data-skip-step]")?.addEventListener("click",()=>store.mutate("Skip Builder step",(document)=>{
    const builder=ensureBuilderState(document),step=builder.step;
    if(step>=2&&step<=6&&!builder.skipped.includes(step))builder.skipped.push(step);
    if(step===2&&!(document.exams||[]).length)builder.examSystems=[];
    const domain={3:"clinical",4:"work",5:"research",6:"personal"}[step];
    if(domain&&!entryEvents(document,domain).length){
      builder.drafts[domain]=blankDraft(domain);
      delete builder.editing[domain];
    }
    builder.step=Math.min(7,step+1);
  },{material:false}));

  const coreForm=root.querySelector("[data-core-form]");
  if(coreForm){
    coreForm.querySelectorAll("[data-profile-field],select[name='visaStatus'],input[name='degree']").forEach((control)=>{
      const commit=()=>{
        const profile=profileFromForm(coreForm,store.document.studentProfile);
        store.mutate("Update Core Info",(document)=>{
          document.studentProfile={...document.studentProfile,...profile};
          syncEducationMilestone(document,{idFactory});
          markStepTouched(document,1);
        });
      };
      control.addEventListener(control.matches?.("input[type='text'],input[type='search']")?"blur":"change",commit);
    });
  }

  root.querySelectorAll("[data-exam-system]").forEach((control)=>control.addEventListener("change",()=>store.mutate("Choose exam systems",(document)=>{
    setBuilderExamSystem(document,control.dataset.examSystem,control.checked);
    markStepTouched(document,2);
  })));
  root.querySelectorAll("[data-add-exam-system]").forEach((button)=>button.addEventListener("click",()=>store.mutate("Add exam",(document)=>{
    addBuilderExam(document,button.dataset.addExamSystem,button.dataset.addExamId);
    markStepTouched(document,2);
  })));
  root.querySelectorAll("[data-delete-exam]").forEach((button)=>button.addEventListener("click",()=>store.mutate("Delete exam",(document)=>{
    deleteBuilderExamAttempt(document,button.dataset.deleteExam);
  })));
  root.querySelectorAll("[data-exam-card]").forEach((card)=>{
    const examId=card.dataset.examId;
    card.querySelectorAll("[data-exam-field]").forEach((control)=>control.addEventListener(control.matches?.("input[type='text'],input:not([type])")?"blur":"change",()=>{
      store.mutate("Update exam",(document)=>{
        const field=control.dataset.examField;
        updateBuilderExamAttempt(document,examId,{
          [field]:control.type==="checkbox"?!!control.checked:String(control.value||"").trim()
        });
        markStepTouched(document,2);
      });
      const exam=store.document.exams.find((item)=>item.id===examId);
      setInlineErrors(card,validateExam(exam));
    }));
    card.querySelectorAll("[data-exam-result-group] input").forEach((control)=>control.addEventListener("change",()=>store.mutate("Update exam result",(document)=>{
      updateBuilderExamAttempt(document,examId,{result:control.value});
      markStepTouched(document,2);
    })));
  });

  root.querySelectorAll("[data-entry-form]").forEach((form)=>{
    const domain=form.dataset.entryForm;
    form.querySelectorAll("[data-draft-field],select,input[type='radio']").forEach((control)=>{
      if(control.closest?.("[data-month-field]"))return;
      const eventName=control.matches?.("input[type='text'],input[type='search'],input:not([type])")?"blur":"change";
      control.addEventListener(eventName,()=>{
        const current=builderView(store.document).drafts[domain];
        const draft=draftFromForm(form,domain,current);
        if(domain==="research"&&control.name==="publicationStatus"&&current.publicationStatus!=="Published"&&draft.publicationStatus==="Published")draft.markPublication=true;
        store.mutate(`Update ${domain} entry`,(document)=>{
          ensureBuilderState(document).drafts[domain]=draft;
          markStepTouched(document,{clinical:3,work:4,research:5,personal:6}[domain]);
        });
      });
    });
  });
  root.querySelectorAll("[data-save-entry]").forEach((button)=>button.addEventListener("click",()=>{
    const domain=button.dataset.saveEntry,form=root.querySelector(`[data-entry-form="${domain}"]`);
    const current=builderView(store.document).drafts[domain],draft=draftFromForm(form,domain,current);
    const errors=validateBuilderEntry(domain,draft);
    if(Object.keys(errors).length){setInlineErrors(form,errors);return;}
    store.mutate(domain==="clinical"?"Add rotation":`Add ${domain} entry`,(document)=>{
      ensureBuilderState(document).drafts[domain]=draft;
      commitBuilderEntry(document,domain,draft,{idFactory});
    });
  }));
  root.querySelectorAll("[data-cancel-entry]").forEach((button)=>button.addEventListener("click",()=>store.mutate("Cancel entry edit",(document)=>{
    const domain=button.dataset.cancelEntry,builder=ensureBuilderState(document);
    builder.drafts[domain]=blankDraft(domain);
    delete builder.editing[domain];
  },{history:false,material:false})));
  root.querySelectorAll("[data-edit-entry]").forEach((button)=>button.addEventListener("click",()=>store.mutate("Edit Builder entry",(document)=>{
    beginBuilderEntryEdit(document,button.dataset.editEntry);
  },{history:false,material:false})));
  root.querySelectorAll("[data-delete-entry]").forEach((button)=>button.addEventListener("click",()=>{
    const eventId=button.dataset.deleteEntry;
    store.mutate("Delete Builder entry",(document)=>{deleteBuilderEntry(document,eventId);});
    toast("Event deleted",{
      actionLabel:"Undo",
      onAction:()=>store.undo()
    });
  }));
  root.querySelectorAll("[data-builder-preview-entry]").forEach((button)=>button.addEventListener("click",()=>{
    const eventId=button.dataset.builderPreviewEntry;
    store.mutate("Edit preview event",(document)=>{
      beginBuilderEntryEdit(document,eventId);
    },{history:false,material:false});
    requestAnimationFrame(()=>{
      const form=document.querySelector("[data-entry-form],[data-core-form],[data-exam-card]");
      form?.scrollIntoView?.({block:"start",behavior:"smooth"});
      form?.querySelector?.("input:not([type='hidden']),select,textarea,button")?.focus?.();
    });
  }));

  installMonthFields(root,{onCommit:(id,value,input)=>{
    const examCard=input.closest?.("[data-exam-card]");
    if(examCard){
      store.mutate("Update exam date",(document)=>{
        updateBuilderExamAttempt(document,examCard.dataset.examId,{
          [id.startsWith("exam-study-")?"studyStartDate":"examDate"]:value
        });
        markStepTouched(document,2);
      });
      return;
    }
    if(id==="core-graduation-date"){
      store.mutate("Update graduation date",(document)=>{
        document.studentProfile.graduationDate=value;
        syncEducationMilestone(document,{idFactory});
        markStepTouched(document,1);
      });
      return;
    }
    const domain=input.closest?.("[data-entry-form]")?.dataset.entryForm;
    if(!domain)return;
    const key=id.endsWith("-end")?"endDate":"startDate";
    store.mutate(`Update ${domain} date`,(document)=>{
      ensureBuilderState(document).drafts[domain][key]=value;
      markStepTouched(document,{clinical:3,work:4,research:5,personal:6}[domain]);
    });
  }});
  installExactDateFields(root,{onCommit:(id,value,input)=>{
    const domain=input.closest?.("[data-entry-form]")?.dataset.entryForm;
    if(domain!=="clinical")return;
    const key=id.endsWith("-end")?"rotationEndDate":"rotationStartDate";
    store.mutate("Update clinical exact date",(document)=>{
      const draft=ensureBuilderState(document).drafts.clinical;
      draft[key]=value;
      Object.assign(draft,projectRotationDates(draft));
      markStepTouched(document,3);
    });
  }});
  installReviewFinish(root,store,{
    onJump:(target)=>{
      store.mutate("Review Builder entry",(document)=>{
        const builder=ensureBuilderState(document);
        builder.step=target.step;
        builder.reviewFocus=target;
        if(target.eventId)beginBuilderEntryEdit(document,target.eventId);
      },{history:false,material:false});
    },
    onOpenCanvas:()=>{
      store.mutate("Finish Builder exams",(document)=>{finalizeBuilderExams(document);});
      store.navigate("canvas");
    },
    onExport:()=>{
      store.mutate("Finish Builder exams",(document)=>{finalizeBuilderExams(document);});
      store.navigate("export");
    }
  });
  installTypeahead(root,store,providers);
}
