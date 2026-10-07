// Contract checks, NOT a claim that a provider produced an intelligent spoken turn.
import test from 'node:test';
import assert from 'node:assert/strict';
import {buildLiveInterviewInstructions} from '../../server/providers/openai-live-session.mjs';
import {interviewTeachingPolicy} from '../../public/capabilities/interview-progression.mjs';

const context={goal:'Full interview simulation',questionIds:['CORE-02','CORE-03'],targetQuestions:2,
  interviewer:'Program Director · balanced',pressurePractice:false,program:'General residency interview',
  environment:'MissionMed · interview only',interviewerStyle:'Owl',
  followUpDepth:1,maxFollowUps:4,interviewPolicyVersion:1};
const actor={receipt:'ctxpack:bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb@'+'c'.repeat(64),
  actorBlock:'AUTHORIZED APPLICATION CONTEXT\nNo applicant or program facts provided.',
  interviewPolicy:{schema:'ivoc.interview-policy.v1',version:1,maxFollowUpsPerAnswer:2,
    defaultFollowUpDepth:1,defaultPressureEnabled:false}};
const preferences=curiosity=>({schema:'ivoc.interviewer-preferences.v1',curiosity,pacing:'normal',
  interruption:false,programEmphasis:'normal'});

test('normal curiosity does not suppress exploration of a short substantive detail',()=>{
  const p=buildLiveInterviewInstructions({...context,interviewerPreferences:preferences('normal')},actor);
  assert.match(p,/Normal — be naturally interested/);
  assert.match(p,/curiosity is not limited to factual clarification/);
  assert.match(p,/A clear sentence is not necessarily a sufficient answer/);
  assert.match(p,/A named hobby, activity, career goal or strength without explanation is an opening for curiosity/);
  assert.match(p,/Do not require clinical relevance for a hobbies question/);
  assert.doesNotMatch(p,/probe only where a useful grounded clarification is needed|Follow-ups are optional, never mandatory; move on when the answer is sufficiently clear/);
});
test('non-answers, unresolved anecdotes and evidence claims have distinct semantic guidance',()=>{
  const p=interviewTeachingPolicy(2);
  for(const rule of ['compare the actual answer with what you asked','neutrally clarify the unanswered part',
    'Do not infer that they are joking','unresolved anecdote','surprising outcome','claim needing evidence',
    'Choose the most salient thread','missing event, choice, action, reasoning or consequence',
    'not on an older unresolved fragment'])assert.ok(p.includes(rule),rule);
  assert.doesNotMatch(p,/Fortnite|pottery|son yesterday/,'no hardcoded Founder answer or fixture topic');
});
test('all curiosity levels retain server ceilings and cannot reset depth after a probe',()=>{
  for(const curiosity of ['low','normal','high']){
    const p=buildLiveInterviewInstructions({...context,interviewerPreferences:preferences(curiosity)},actor);
    assert.match(p,/at most 1 substantive follow-up per answer and at most 4 substantive follow-ups total/);
    assert.match(p,/not a renewed allowance after each follow-up answer/);
    assert.match(p,/Clarification and content probes consume that same budget/);
    assert.match(p,/Follow-up answers do not reset it/);
  }
});
test('zero depth, zero total and Admin clamp omit semantic probing rather than bypassing limits',()=>{
  for(const [request,policy] of [[{followUpDepth:0},{}],[{maxFollowUps:0},{}],
    [{},{maxFollowUpsPerAnswer:0,defaultFollowUpDepth:0}]]){
    const p=buildLiveInterviewInstructions({...context,...request,interviewerPreferences:preferences('high')},
      {...actor,interviewPolicy:{...actor.interviewPolicy,...policy}});
    assert.match(p,/No substantive follow-ups are permitted/);
    assert.doesNotMatch(p,/ANSWER-TO-QUESTION CHECK:|SHORT ANSWERS:|NON-ANSWERS:|BOTTOM LINING \/ CONVERSATIONAL HOOKS:/);
  }
});
test('adequate answers, declined/private material and closing remain protected',()=>{
  const p=buildLiveInterviewInstructions(context,actor);
  for(const rule of ['already explained the thread and answered the question','declines to expand',
    'protected personal topics','Do not always ask a follow-up','Do you have any questions for me?',
    'Never restart substantive hook probing during closing','Never infer emotion, personality, diagnosis, protected traits',
    'do not authorize a second scripted turn controller'])assert.ok(p.includes(rule),rule);
  assert.ok(p.endsWith(actor.actorBlock));
});
