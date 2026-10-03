import {buildRetryIntent} from '../../../studio/presentation-view-model.mjs';
export function projectOwnRetry(saved,catalog,subject){
  const detail=saved?.sessionDetail;
  if(saved?.reviewScope!=='own'||saved.scopeSubject!==subject||detail?.ownerSubject!==subject||detail.state!=='saved')return null;
  const intent=buildRetryIntent({detail,reviewScope:'own',catalog});if(!intent.available)return null;
  return {intent,record:{id:detail.id,questionId:intent.question.question_id,questionText:intent.question.canonical_text,remote:detail,
    wizard:intent.wizard,priorityText:intent.drill||null}};
}
