import assert from 'node:assert/strict';
import test from 'node:test';

import { createLiveContext } from '../../public/studio/live-context-adapter.mjs';

test('adapts frozen Astra labels to the bounded InterviewBrain contract', () => {
  assert.deepEqual(createLiveContext({
    wizard: {
      goal: 'Full IV Simulation', interviewer: 'Program Director', environment: 'MissionMed',
      analyticsEnabled: true, pressurePractice: false,
    },
    interviewSet: [{ question_id: 'CORE-01' }],
    targetQuestions: 5,
  }), {
    goal: 'Full interview simulation',
    questionIds: ['CORE-01'],
    interviewer: 'Program Director · balanced',
    pressurePractice: false,
    program: 'General residency interview',
    environment: 'MissionMed · coached analytics',
    targetQuestions: 5,
  });
});

test('maps Founder pressure practice without exposing UI implementation terms', () => {
  const context = createLiveContext({ wizard: { goal: 'Individual Question', pressurePractice: true }, targetQuestions: 99 });
  assert.equal(context.goal, 'Individual question');
  assert.equal(context.interviewer, 'Program Director · balanced');
  assert.equal(context.pressurePractice, false, 'hidden pressure must not survive Individual Question');
  assert.equal(context.targetQuestions, 30);
});

test('only visible Guided focus enters the live preference contract', () => {
  const wizard = { goal: 'Guided Mock IV Practice', focus: '  Explain my contribution.  ', pressurePractice: true };
  assert.equal(createLiveContext({ wizard }).practiceFocus, 'Explain my contribution.');
  assert.equal(createLiveContext({ wizard }).pressurePractice, true);
  for (const goal of ['Individual Question', 'Full IV Simulation']) {
    assert.equal(Object.hasOwn(createLiveContext({ wizard: { ...wizard, goal } }), 'practiceFocus'), false);
  }
  for (const focus of [null, 42, {}, 'a'.repeat(501), 'line\ncommand', 'hidden\u200bcommand']) {
    assert.throws(() => createLiveContext({ wizard: { ...wizard, focus } }), /Practice focus/);
  }
  assert.equal(Object.hasOwn(createLiveContext({ wizard: { ...wizard, focus: '   ' } }), 'practiceFocus'), false);
});

test('all approved role and bird-style selections survive the actual client projection', () => {
  const roles = {
    'Program Director': 'Program Director · balanced',
    'Associate Program Director': 'Associate Program Director · balanced',
    Faculty: 'Faculty · conversational',
    'Chief Resident': 'Chief Resident · warm',
  };
  for (const [role, expected] of Object.entries(roles)) {
    for (const style of ['Dove', 'Peacock', 'Owl', 'Eagle']) {
      const context = createLiveContext({
        wizard: { interviewer: role, interviewerStyle: style },
        interviewSet: [{ question_id: 'CORE-01' }],
      });
      assert.equal(context.interviewer, expected);
      assert.equal(context.interviewerStyle, style);
      assert.equal(context.pressurePractice, false);
      assert.deepEqual(context.questionIds, ['CORE-01']);
    }
  }
});

test('legacy context stays seven-field while explicit invalid styles are not silently discarded', () => {
  assert.equal(Object.keys(createLiveContext()).length, 7);
  assert.equal(Object.hasOwn(createLiveContext(), 'interviewerStyle'), false);
  for (const interviewerStyle of ['', null, undefined, 'Invalid', ['Owl']]) {
    const context = createLiveContext({ wizard: { interviewerStyle } });
    assert.equal(Object.hasOwn(context, 'interviewerStyle'), true);
    assert.equal(context.interviewerStyle, interviewerStyle);
  }
});
