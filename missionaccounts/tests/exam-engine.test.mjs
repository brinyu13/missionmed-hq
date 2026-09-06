import test from 'node:test';
import assert from 'node:assert/strict';
import { thirdWednesdayAfter, transitionExamPlan } from '../src/domain/exam-engine.mjs';

test('third Wednesday counts strictly after a Wednesday exam', () => {
  assert.equal(thirdWednesdayAfter('2026-09-09'), '2026-09-30');
});

test('approval opens grace and schedules a deterministic reminder', () => {
  const result = transitionExamPlan({
    plan: { id: 'p1', student_id: 'u1', state: 'pending', exam_on: '2026-08-21' },
    to: 'approved',
    actor: 'dr-j',
    today: '2026-08-01',
  });
  assert.equal(result.effects.open_grace.from_on, '2026-08-21');
  assert.equal(result.effects.reminder.due_on, '2026-09-09');
});

test('passed closes grace on the local result day and cancels reminder', () => {
  const result = transitionExamPlan({
    plan: { id: 'p1', student_id: 'u1', state: 'approved', exam_on: '2026-08-21' },
    to: 'passed',
    actor: 'u1',
    today: '2026-09-03',
  });
  assert.equal(result.plan.passed_on, '2026-09-03');
  assert.equal(result.effects.close_grace.to_on, '2026-09-03');
  assert.equal(result.effects.reminder.state, 'cancelled');
});

test('invalid transition fails closed', () => {
  assert.throws(() => transitionExamPlan({
    plan: { id: 'p1', student_id: 'u1', state: 'pending', exam_on: '2026-08-21' },
    to: 'passed',
    actor: 'u1',
    today: '2026-09-03',
  }), /invalid exam transition/);
});
