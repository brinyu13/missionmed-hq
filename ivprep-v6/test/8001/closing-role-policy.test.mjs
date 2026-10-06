import test from 'node:test';
import assert from 'node:assert/strict';
import { CANDIDATE_QUESTION_POLICY, CLOSING_QUESTION, InterviewProgression, interviewTeachingPolicy } from '../../public/capabilities/interview-progression.mjs';
import { buildLiveInterviewInstructions } from '../../server/providers/openai-live-session.mjs';
import { createLiveContext } from '../../public/studio/live-context-adapter.mjs';

const actor = { receipt: `ctxpack:bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb@${'c'.repeat(64)}`, actorBlock: 'AUTHORIZED APPLICATION CONTEXT\nPROGRAM: none\nAPPLICANT FACTS:\n- none provided' };
test('automatic and requested closing share one truthful role-perspective policy', () => {
  const progression = new InterviewProgression(); progression.start();
  for (const instructions of [interviewTeachingPolicy(2), progression.requestClosing()]) {
    assert.ok(instructions.includes(CANDIDATE_QUESTION_POLICY));
    assert.ok(instructions.includes(CLOSING_QUESTION));
    for (const guard of ['clearly fictional role perspective', 'not as a claim of personal lived experience', 'do not invent program details', 'whether you are AI', 'answer truthfully', 'do not start another substantive question']) assert.ok(instructions.includes(guard), guard);
  }
  assert.equal(progression.requestClosing(), null);
});
test('all native interviewer roles retain closing realism without granting program facts or a second authority', () => {
  for (const interviewer of ['Program Director', 'Associate Program Director', 'Faculty', 'Chief Resident']) {
    const context = createLiveContext({ wizard: { goal: 'Full IV Simulation', interviewer, interviewerStyle: 'Owl' }, interviewSet: [{ question_id: 'CORE-01' }], targetQuestions: 1 });
    const instructions = buildLiveInterviewInstructions(context, actor);
    assert.ok(instructions.includes(CANDIDATE_QUESTION_POLICY));
    assert.match(instructions, /general educational role-perspective questions follow the CANDIDATE QUESTIONS policy/);
    assert.match(instructions, /Never claim access to records or facts not present/);
    assert.match(instructions, /If a requested program fact is absent/);
    assert.match(instructions, /Do not claim the recording is saved or close the provider connection yourself/);
    assert.match(instructions, /exact listed order/);
    assert.ok(instructions.endsWith(actor.actorBlock));
  }
  // Prompt-contract proof only: no provider call and no claim of audible model compliance.
});
