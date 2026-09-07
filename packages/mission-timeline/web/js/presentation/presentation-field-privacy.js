const text=value=>String(value??'').trim();
const normalize=value=>{
  const key=String(value||'INTERVIEWER_SAFE').trim().toUpperCase();
  return({SAFE:'INTERVIEWER_SAFE',VISIBLE:'INTERVIEWER_SAFE',INTERVIEW_SAFE:'INTERVIEWER_SAFE',ADVISOR:'ADVISOR_ONLY',STUDENT:'STUDENT_ONLY',FULL:'FULL_STORY'})[key]||key;
};
const profileFields=['fullName','medicalSchool','medicalSchoolCountry','graduationDate','graduationDatePrecision','degree','currentUsWorkAuthorization','visaStatus','specialtyGoal','interviewSeason'];
const sourceEventForCandidate=(events,id)=>text(id)?events.find(event=>(event.provenance||[]).some(item=>text(item.extractionCandidateId)===text(id))):null;
const eventBinding=event=>({sourceType:'document-intake',sourceEventId:event?.id||null,visibilityState:event?.visibilityState||'ADVISOR_ONLY'});

function legacyProfileBinding(document,field,value){
  const profile=document.studentProfile||{};
  const hasNameEvidence=Array.isArray(profile.fullNameProvenance)&&profile.fullNameProvenance.length>0;
  const sourceSchool=profile.medicalSchoolVerificationStatus==='unverified-source-claimed'||profile.medicalSchoolNormalizationStatus==='review-required';
  if(field==='fullName'&&!hasNameEvidence)return null;
  if(field!=='fullName'&&(!sourceSchool||!['medicalSchool','medicalSchoolCountry','degree','graduationDate','graduationDatePrecision'].includes(field)))return null;
  const events=(document.events||[]).filter(event=>event.sourceType==='document-intake'&&event.categoryId==='education');
  const claims=(event)=>{
    const f=event.fields||{};
    if(field==='fullName')return[f.profileFullName];
    if(field==='medicalSchool')return[f.medicalSchool,event.siteName,f.institution,f.organization,text(event.title).replace(/^(?:doctor of medicine(?:\s*\(md\))?|medical degree|mbbs)\s*(?:,|\bat\b|[-—])\s*/i,'')];
    if(field==='medicalSchoolCountry')return[f.medicalSchoolCountry,f.sourceCountry];
    if(field==='degree')return[f.degree];
    if(field==='graduationDate')return[event.endDate,f.canonicalType==='GRADUATION'?event.startDate:null];
    return[];
  };
  const matches=events.filter(event=>claims(event).some(claim=>text(claim)&&text(claim)===text(value)));
  // Earlier imports did not retain field-level links. A source-marked value
  // with no unique surviving event stays private until its source is reviewed.
  return matches.length===1?eventBinding(matches[0]):eventBinding(null);
}

function legacyExamBinding(document,exam,field,value){
  if(!text(value)||exam.fieldProvenance?.[field]||exam.sourceType==='document-intake')return null;
  const canonical={ 'step-1':'STEP_1','step-2-ck':'STEP_2_CK','step-3':'STEP_3' }[exam.examId];
  const matches=(document.builder?.aiExamReviewQueue||[]).filter(item=>canonical&&item.canonicalType===canonical&&text(item.examDate)===text(exam.examDate)&&text(item[field])===text(value));
  if(!matches.length)return null;
  return matches.map(item=>({...eventBinding(sourceEventForCandidate(document.events||[],item.sourceCandidateId)),visibilityState:item.visibilityState||'ADVISOR_ONLY'}));
}

// Shared by canonical rendering, direct scene rendering and the Export boundary.
// A copied value never becomes more public than its source or its own consent.
export function projectPresentationFields(document,{allowed,visibleEventIds}){
  const visible=binding=>{
    if(!binding)return true;
    if(Array.isArray(binding))return binding.every(visible);
    if(binding.sourceType==='document-intake'&&(!binding.sourceEventId||!binding.visibilityState))return false;
    if(binding.sourceEventId&&!visibleEventIds.has(String(binding.sourceEventId)))return false;
    return allowed.has(normalize(binding.visibilityState||binding.visibility));
  };
  const original=document.studentProfile||{},profile={};
  for(const field of profileFields){
    if(original[field]===undefined)continue;
    const binding=original.fieldProvenance?.[field]||legacyProfileBinding(document,field,original[field]);
    if(visible(binding))profile[field]=original[field];
  }
  const exams=[];
  for(const originalExam of document.exams||[]){
    if(!visible(originalExam.sourceType==='document-intake'||originalExam.sourceEventId||originalExam.visibilityState?originalExam:null))continue;
    const exam={};
    for(const field of ['id','system','examId','name','examDate','studyStartDate','result','score','passFailOnly','showScoreOnTimeline','attempt','attemptNumberUnconfirmed']){
      if(originalExam[field]===undefined)continue;
      if(field==='score'&&originalExam.showScoreOnTimeline===false)continue;
      const binding=originalExam.fieldProvenance?.[field]||(['score','result'].includes(field)?legacyExamBinding(document,originalExam,field,originalExam[field]):null);
      if(visible(binding))exam[field]=originalExam[field];
    }
    if(text(exam.score)||text(exam.result))exams.push(exam);
  }
  const privateExamResults=new Set();
  for(const event of document.events||[]){
    if(event.categoryId!=='exams')continue;
    const linked=(document.exams||[]).filter(exam=>
      (event.fields?.attemptId&&text(exam.id)===text(event.fields.attemptId))||
      [exam.sourceEventId,exam.fieldProvenance?.result?.sourceEventId].some(id=>id&&text(id)===text(event.id))
    );
    const resultBinding=event.fieldProvenance?.result||event.fields?.fieldProvenance?.result;
    if(!visible(resultBinding)||linked.some(exam=>
      !visible(exam.sourceType==='document-intake'||exam.sourceEventId||exam.visibilityState?exam:null)||
      !visible(exam.fieldProvenance?.result||legacyExamBinding(document,exam,'result',exam.result))
    ))privateExamResults.add(text(event.id));
  }
  return{studentProfile:profile,exams,privateExamResults};
}

export function projectPresentationEventFields(events,projection){
  return(events||[]).map(event=>{
    if(!projection.privateExamResults?.has(text(event.id)))return event;
    const next={...event,fields:{...(event.fields||{})},presentationRedactions:[...new Set([...(event.presentationRedactions||[]),'EXAM_RESULT_PRIVATE'])]};
    delete next.result;delete next.fields.result;
    next.title=String(event.title||'').replace(/\(\s*(?:pass(?:ed)?|fail(?:ed)?)\s*\)/gi,'')
      .replace(/\b(?:pass(?:ed)?|fail(?:ed)?)\b/gi,'')
      .replace(/\s*[—–:;,\-]\s*$/,'').replace(/\s{2,}/g,' ').trim();
    return next;
  });
}
