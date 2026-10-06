import test from 'node:test';
import assert from 'node:assert/strict';
import { directorPolicy, chooseObjective, objectiveInstruction, OBJECTIVE_KINDS, MAX_OBJECTIVE_CHARS } from '../../public/studio-fable/app/brain/interview-director.mjs';
import { detectHooks } from '../../public/studio-fable/app/brain/hook-detector.mjs';
import { conductorConfig, applyPreset, defaultSettings } from '../../public/studio-fable/app/settings/interviewer.mjs';

const Q = { id: 'CORE-01', text: 'Tell me about yourself.', tags: ['CORE'] };
const NEXT = { id: 'CORE-02', text: 'What do you do in your spare time?' };
const base = (over = {}) => ({ policy: directorPolicy(), phase: 'QUESTION', report: null, answerText: '', question: Q, nextQuestion: NEXT,
  depthUsed: 0, totalFollowUps: 0, closingReached: false, candidateQuestion: null, noMoreQuestions: false, program: null, remainingMs: null, closingReserveMs: 90_000, ...over });
const reportFor = (text, policy = directorPolicy(), q = Q) => detectHooks({ question: q, answer: text, policy: { followThreshold: policy.followThreshold } });

test('persona presets materially change Director policy, not just labels', () => {
  const owl = directorPolicy({ style: 'Owl' }), warm = directorPolicy({ style: 'Dove' }), direct = directorPolicy({ style: 'Eagle' }), pressure = directorPolicy({ style: 'Eagle', pressure: true });
  assert.ok(owl.followThreshold < warm.followThreshold && warm.followThreshold < direct.followThreshold, 'Owl pursues hooks at the lowest threshold');
  assert.equal(owl.persona, 'owl'); assert.equal(warm.persona, 'warm'); assert.equal(direct.persona, 'direct'); assert.equal(pressure.persona, 'pressure');
  assert.equal(owl.probeWeakAnswers, true); assert.equal(direct.probeWeakAnswers, false); assert.equal(pressure.challengeClaims, true); assert.equal(owl.challengeClaims, false);
  assert.ok(directorPolicy({ style: 'Owl', curiosity: 'Low' }).followThreshold > owl.followThreshold);
  assert.ok(directorPolicy({ style: 'Eagle', curiosity: 'High' }).followThreshold < direct.followThreshold);
  // Easy presets flow through conductorConfig
  const s = defaultSettings();
  const thresholds = ['balanced', 'warm', 'direct', 'pressure'].map((id) => conductorConfig(applyPreset(s, id)).followThreshold);
  assert.equal(new Set(thresholds).size, 4, `presets must differ: ${thresholds}`);
  assert.equal(conductorConfig(applyPreset(s, 'balanced')).curiosity, 'Normal');
});

test('Owl: a meaningful unresolved hook beats the next planned question', () => {
  const policy = directorPolicy({ style: 'Owl' });
  const text = 'I went to medical school in Grenada and came back here. Then I started my own company called Northline Tutors.';
  const obj = chooseObjective(base({ policy, report: reportFor(text, policy), answerText: text }));
  assert.equal(obj.kind, 'FOLLOW_HOOK'); assert.match(obj.target, /Northline Tutors/);
  const instruction = objectiveInstruction(obj, { policy, question: Q, nextQuestion: NEXT, questionNumber: 2 });
  assert.ok(instruction.startsWith('NEXT TURN OBJECTIVE')); assert.match(instruction, /Objective: FOLLOW_HOOK/); assert.match(instruction, /untrusted transcript data/);
  assert.doesNotMatch(instruction, /What happened with|Tell me about Northline/, 'the Director never scripts interviewer sentences');
  assert.ok(instruction.length <= MAX_OBJECTIVE_CHARS);
});

test('resolved detail, tangent and exhausted budget move to the next planned question; no next question closes', () => {
  const policy = directorPolicy({ style: 'Owl' });
  const resolved = 'I started my own company called Northline Tutors: we matched students with tutors, grew to forty tutors in two years, and I sold it before applying. That is the whole story.';
  assert.equal(chooseObjective(base({ policy, report: reportFor(resolved, policy), answerText: resolved })).kind, 'MOVE_TO_NEXT_PLANNED_QUESTION');
  const tangent = "I'm an IM applicant from Lagos with two years of research in Boston and I am a father of two. Also, my son's soccer team won on Saturday, 3-1, which was a great match to watch.";
  assert.equal(chooseObjective(base({ policy, report: reportFor(tangent, policy), answerText: tangent })).kind, 'MOVE_TO_NEXT_PLANNED_QUESTION');
  const hooky = 'I went to medical school in Grenada and came back here. Then I started my own company called Northline Tutors.';
  const exhausted = chooseObjective(base({ policy, report: reportFor(hooky, policy), answerText: hooky, depthUsed: 1 }));
  assert.equal(exhausted.kind, 'MOVE_TO_NEXT_PLANNED_QUESTION'); assert.match(exhausted.reason, /budget/);
  const last = chooseObjective(base({ policy, report: reportFor(resolved, policy), answerText: resolved, nextQuestion: null }));
  assert.equal(last.kind, 'CLOSING_TRANSITION');
  assert.match(objectiveInstruction(last, { policy }), /Do you have any questions for me\?/);
});

test('weak answers: Owl/Warm deepen, Pressure challenges, Direct moves on; thin fragments wait', () => {
  const weak = 'I am from New Jersey and I like medicine a lot.';
  assert.equal(chooseObjective(base({ policy: directorPolicy({ style: 'Owl' }), report: reportFor(weak), answerText: weak })).kind, 'DEEPEN');
  assert.equal(chooseObjective(base({ policy: directorPolicy({ style: 'Dove' }), report: reportFor(weak), answerText: weak })).kind, 'DEEPEN');
  assert.equal(chooseObjective(base({ policy: directorPolicy({ style: 'Eagle', pressure: true }), report: reportFor(weak), answerText: weak })).kind, 'CHALLENGE_GENTLY');
  assert.equal(chooseObjective(base({ policy: directorPolicy({ style: 'Eagle' }), report: reportFor(weak), answerText: weak })).kind, 'MOVE_TO_NEXT_PLANNED_QUESTION');
  assert.equal(chooseObjective(base({ answerText: 'Uh, well' })), null, 'no objective before the answer has substance');
});

test('claims without evidence seek evidence; contradictions clarify; guarded topics never become targets', () => {
  const policy = directorPolicy({ style: 'Owl' });
  const vague = "I'm hard-working, I'm a team player, and I'm very empathetic. I think those are my main strengths.";
  const r = reportFor(vague, policy, { id: 'CORE-05', text: 'What are your strengths?', tags: ['CORE', 'STRENGTHS'] });
  const obj = chooseObjective(base({ policy, report: r, answerText: vague, question: { id: 'CORE-05', text: 'What are your strengths?', tags: ['CORE', 'STRENGTHS'] } }));
  assert.equal(obj.kind, 'SEEK_EVIDENCE');
  const clash = detectHooks({ question: { id: 'MR142-FIT', text: 'Why this program?', tags: ['PROGRAM_FIT'] }, answer: "I've wanted internal medicine since my first clinical year, and your ambulatory block is the reason I applied.", priorTurns: [{ questionId: 'CORE-06', answerText: "I chose psychiatry because of my grandmother's care." }], policy: { followThreshold: policy.followThreshold } });
  assert.equal(chooseObjective(base({ policy, report: clash, answerText: 'x '.repeat(10) })).kind, 'CLARIFY');
  const guarded = 'I took a year off for a family medical situation and then started a research position in a lab.';
  const g = chooseObjective(base({ policy, report: reportFor(guarded, policy, { id: 'CORE-04', text: 'What have you been doing since graduation?', tags: ['CORE', 'BACKGROUND'] }), answerText: guarded }));
  assert.notEqual(g.kind, 'FOLLOW_HOOK'); assert.doesNotMatch(String(g.target || ''), /medical situation/);
});

test('closing objectives: answer candidate questions, then sign off; every kind yields a bounded instruction', () => {
  const policy = directorPolicy();
  assert.equal(chooseObjective(base({ policy, closingReached: true, phase: 'CANDIDATE_QUESTIONS', candidateQuestion: 'What is call like for interns?' })).kind, 'ANSWER_CANDIDATE_QUESTION');
  assert.equal(chooseObjective(base({ policy, closingReached: true, phase: 'CANDIDATE_QUESTIONS', noMoreQuestions: true })).kind, 'PROFESSIONAL_SIGNOFF');
  assert.equal(chooseObjective(base({ policy, closingReached: true, phase: 'CANDIDATE_QUESTIONS' })), null, 'waits while the candidate is thinking');
  assert.equal(chooseObjective(base({ phase: 'PROFESSIONAL_CLOSE' })), null);
  for (const kind of OBJECTIVE_KINDS) {
    const text = objectiveInstruction({ kind, target: 'a thread', reason: 'r' }, { policy, question: Q, nextQuestion: NEXT, questionNumber: 2 });
    assert.ok(text.startsWith('NEXT TURN OBJECTIVE') && text.includes(`Objective: ${kind}`) && text.length <= MAX_OBJECTIVE_CHARS, kind);
  }
  assert.throws(() => objectiveInstruction({ kind: 'SPEAK_NOW' }), /Director objective/);
});

test('determinism: identical inputs produce byte-identical objectives', () => {
  const policy = directorPolicy({ style: 'Owl' });
  const text = 'Then I started my own company called Northline Tutors, which is now called Northline Health.';
  const first = JSON.stringify(chooseObjective(base({ policy, report: reportFor(text, policy), answerText: text })));
  for (let i = 0; i < 50; i += 1) assert.equal(JSON.stringify(chooseObjective(base({ policy, report: reportFor(text, policy), answerText: text }))), first);
});
