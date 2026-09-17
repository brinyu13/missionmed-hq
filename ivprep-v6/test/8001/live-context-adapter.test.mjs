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
    program: 'General residency interview',
    environment: 'MissionMed · coached analytics',
    targetQuestions: 5,
  });
});

test('maps Founder pressure practice without exposing UI implementation terms', () => {
  const context = createLiveContext({ wizard: { goal: 'Individual Question', pressurePractice: true }, targetQuestions: 99 });
  assert.equal(context.goal, 'Individual question');
  assert.equal(context.interviewer, 'Pressure practice · direct');
  assert.equal(context.targetQuestions, 30);
});
