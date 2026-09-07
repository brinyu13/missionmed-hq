const text=value=>String(value??'').trim();
const escape=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');

// The profile summarizes the latest visible attempt; historical attempts stay
// on the chronology. Call only after field/source privacy projection.
export function presentationExamSummary(exams,system,examId){
  const matches=(exams||[]).filter(exam=>
    text(exam.system).toUpperCase()===system&&text(exam.examId).toLowerCase()===examId
  ).map((exam,index)=>({exam,index})).sort((a,b)=>
    text(b.exam.examDate).localeCompare(text(a.exam.examDate))||
    (Number(b.exam.attempt)||0)-(Number(a.exam.attempt)||0)||b.index-a.index
  );
  const exam=matches[0]?.exam;
  const value=text(exam?.score||exam?.result);
  const attempt=Number(exam?.attempt);
  if(!value||exam?.attemptNumberUnconfirmed||!Number.isInteger(attempt)||attempt<2)return value;
  const suffix=attempt%100>=11&&attempt%100<=13?'th':({1:'st',2:'nd',3:'rd'}[attempt%10]||'th');
  return `${value} (${attempt}${suffix} attempt)`;
}

// Display preferences are a projection. The accepted title, score and evidence
// remain unchanged in the document used by source review and provider binding.
export function projectPresentationExamEvents(document,events=document?.events||[]){
  return events.map(event=>{
    const records=(document?.exams||[]).filter(exam=>exam.showScoreOnTimeline===false&&[
      exam.sourceEventId,exam.fieldProvenance?.score?.sourceEventId
    ].some(id=>id&&String(id)===String(event.id)));
    if(!records.length)return event;
    const scores=[...new Set([event.fields?.score,...records.map(record=>record.score)].map(text).filter(Boolean))];
    let title=String(event.title||'');
    for(const score of scores){
      const token=escape(score);
      title=title.replace(new RegExp(`\\(\\s*(?:score\\s*[:=]?\\s*)?${token}\\s*\\)`,'gi'),'')
        .replace(new RegExp(`\\b(?:score\\s*[:=]?\\s*)?${token}\\b`,'gi'),'');
    }
    title=title.replace(/\s*[—–:;,\-]\s*$/,'').replace(/\s{2,}/g,' ').trim();
    const fields={...(event.fields||{})};delete fields.score;
    return{...event,title,fields,presentationRedactions:['EXAM_SCORE_HIDDEN']};
  });
}
