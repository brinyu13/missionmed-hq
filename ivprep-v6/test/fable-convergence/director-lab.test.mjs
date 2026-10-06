// OWL ACCEPTANCE LAB — multi-turn Director sequences through the REAL production
// decision logic: NativeInterviewObserver (observer + Director) → GptLiveInterviewer →
// LiveInterviewSession wire. Interviewer output is simulated as GPT-Live fragments;
// nothing here speaks. The lab asserts WHICH objective reaches the provider and that
// it is sent BEFORE the next interviewer turn is observed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { NativeInterviewObserver } from '../../public/studio-fable/app/brain/native-observer.mjs';
import { GptLiveInterviewer } from '../../public/studio-fable/app/adapters/live-adapter.mjs';
import { LiveInterviewSession } from '../../public/capabilities/live-interview.mjs';
import { conductorConfig, applyPreset, defaultSettings } from '../../public/studio-fable/app/settings/interviewer.mjs';

const QUESTIONS = [
  { question_id: 'CORE-01', canonical_text: 'Tell me about yourself.', tags: ['CORE'] },
  { question_id: 'CORE-02', canonical_text: 'What are your hobbies? / What do you do in your spare time?', tags: ['CORE', 'PERSONAL', 'HOBBIES'] },
  { question_id: 'CORE-05', canonical_text: 'What are your strengths?', tags: ['CORE', 'STRENGTHS'] },
];

function lab(preset = 'balanced', { questions = QUESTIONS, durationMin = 15 } = {}) {
  const settings = applyPreset(defaultSettings(), preset);
  let clock = 0;
  const observer = new NativeInterviewObserver({ questions, config: conductorConfig(settings, { durationMin }), context: {}, now: () => clock });
  observer.start();
  const wire = [];
  const live = new LiveInterviewSession({ createSession() {}, endSession() {}, PeerConnection: class {} });
  live.state = 'active'; live.channel = { readyState: 'open', send: (raw) => wire.push({ ...JSON.parse(raw), order: wire.length, clock }) };
  const interviewer = new GptLiveInterviewer(); interviewer.live = live;
  let seq = 0;
  // Mirrors room.mjs guideHook(): Director objective first, quiet hint only as fallback.
  const guide = () => { const objective = observer.pendingObjective(); if (objective && interviewer.steerObjective(objective)) { observer.objectiveSent(objective); return objective; } return null; };
  const candidate = (text, ms = 2_000) => { clock += ms; const e = { type: 'session.input_transcript.delta', delta: text, event_id: `in-${++seq}`, start_ms: clock - ms, end_ms: clock }; observer.ingestFragment(e); return guide(); };
  const interviewerSays = (text, ms = 2_000) => { clock += ms; const e = { type: 'session.output_transcript.delta', delta: text, event_id: `out-${++seq}`, start_ms: clock - ms, end_ms: clock }; wire.push({ type: 'observed.interviewer', text, order: wire.length, clock }); observer.ingestFragment(e); };
  const objectives = () => wire.filter((e) => e.type === 'session.instructions.append' && /^ivoc-director-/.test(e.event_id)).map((e) => ({ kind: e.content.match(/Objective: ([A-Z_]+)/)?.[1], content: e.content, order: e.order }));
  return { observer, interviewer, wire, candidate, interviewerSays, objectives, settings };
}
const lastKind = (L) => L.objectives().at(-1)?.kind;

test('A · strong bottom line: the next turn pursues the unresolved story (and it is sent before the interviewer speaks)', () => {
  const L = lab('balanced');
  L.interviewerSays('Tell me about yourself.');
  L.candidate("I'm an internal medicine applicant who trained in Lagos and spent two years doing inpatient research in Boston. ");
  const obj = L.candidate('Actually, there was a really interesting teaching moment with my son yesterday.');
  assert.equal(obj?.kind, 'FOLLOW_HOOK'); assert.match(obj.target, /teaching moment with my son/);
  const sent = L.objectives().at(-1);
  L.interviewerSays('What happened with your son?');
  const followUp = L.wire.find((e) => e.type === 'observed.interviewer' && /son/.test(e.text));
  assert.ok(sent.order < followUp.order, 'objective reached the wire before the follow-up turn');
  assert.equal(L.observer.snapshot().hooks.at(-1).bitTaken, true, 'taken only from observed provider output');
  assert.equal(L.observer.snapshot().hooks.at(-1).decision, 'FOLLOW_HOOK', 'Results ledger marks the hook as attempted');
});

test('B · created venture: asks what/why/how', () => {
  const L = lab('balanced');
  L.interviewerSays('Tell me about yourself.');
  const obj = L.candidate('I went to Grenada for medical school and came back here. Then I started my own company called Northline Tutors, which is now called Northline Health.');
  assert.equal(obj?.kind, 'FOLLOW_HOOK'); assert.match(obj.target, /Northline Tutors/);
  assert.match(obj.instruction, /what it was, what they did, what resulted, or why it mattered/);
});

test('C · leadership claim left hanging is pursued', () => {
  const L = lab('balanced');
  L.interviewerSays('Tell me about yourself.');
  const obj = L.candidate('I went, became the captain, medical director of a private ambulance service in Albany. After that I moved back to Ohio and applied.');
  assert.equal(obj?.kind, 'FOLLOW_HOOK'); assert.match(obj.target, /captain/);
});

test('D · surprising result is pursued; E · learned lesson asks what was learned', () => {
  const D = lab('balanced'); D.interviewerSays('Tell me about yourself.');
  assert.equal(D.candidate('My thesis looked at early mobilization after hip fracture. We enrolled 210 patients across two sites. Our result surprised the whole department.')?.kind, 'FOLLOW_HOOK');
  const E = lab('balanced'); E.interviewerSays('Tell me about yourself.');
  const obj = E.candidate("Well, since I graduated I've been doing a lot of things. Um, everything I've been doing. Um, has really taught me a lot, uh, every single experience. I- I learned different lessons.");
  assert.equal(obj?.kind, 'FOLLOW_HOOK'); assert.match(obj.target, /lesson|taught/);
});

test('F · resolved detail is not pursued; G · irrelevant tangent moves on', () => {
  const F = lab('balanced'); F.interviewerSays('Tell me about yourself.');
  const f = F.candidate('I started my own company called Northline Tutors: we matched students with licensed tutors, grew to forty tutors in two years, and I sold it before I applied. That is the whole story.');
  assert.equal(f?.kind, 'MOVE_TO_NEXT_PLANNED_QUESTION'); assert.match(f.instruction, /hobbies/);
  const G = lab('balanced'); G.interviewerSays('Tell me about yourself.');
  const g = G.candidate("I'm an IM applicant from Lagos, two years of research in Boston, father of two, and I enjoy my work. Also, my son's soccer team won on Saturday, 3-1, which was a fun match.");
  assert.equal(g?.kind, 'MOVE_TO_NEXT_PLANNED_QUESTION');
});

test('H · multiple hooks: the highest-value interview hook is selected and the objective updates as the answer grows', () => {
  const L = lab('balanced');
  L.interviewerSays('Tell me about yourself.');
  const first = L.candidate("I'm an internal medicine applicant who trained in Lagos and spent two years doing inpatient research in Boston. Our main result surprised the whole department. ");
  assert.equal(first?.kind, 'FOLLOW_HOOK'); assert.match(first.target, /surprised/);
  const second = L.candidate('Outside the hospital, there was a really interesting teaching moment with my son yesterday.');
  assert.equal(second?.kind, 'FOLLOW_HOOK'); assert.match(second.target, /son/, 'stronger later hook supersedes');
  assert.equal(L.objectives().length, 2);
});

test('I · weak answer with no hook: Owl deepens, Direct moves on', () => {
  const owl = lab('balanced'); owl.interviewerSays('Tell me about yourself.');
  assert.equal(owl.candidate('I am from New Jersey and I like medicine a lot.')?.kind, 'DEEPEN');
  const direct = lab('direct'); direct.interviewerSays('Tell me about yourself.');
  assert.equal(direct.candidate('I am from New Jersey and I like medicine a lot.')?.kind, 'MOVE_TO_NEXT_PLANNED_QUESTION');
});

test('J · planned-question competition: for Owl the hook wins even when the next planned question is available', () => {
  const L = lab('balanced');
  L.interviewerSays('Tell me about yourself.');
  const obj = L.candidate('I trained in Lagos and did research in Boston, which I enjoyed. The clearest example was a code on my second week as a sub-intern.');
  assert.equal(obj?.kind, 'FOLLOW_HOOK');
  assert.doesNotMatch(obj.instruction, /hobbies/);
});

test('K · follow-up exhaustion: after the observed follow-up, the Director moves on instead of looping', () => {
  const L = lab('balanced'); // depth 1 per question
  L.interviewerSays('Tell me about yourself.');
  assert.equal(L.candidate('I went to Grenada for medical school and came back here. Then I started my own company called Northline Tutors.')?.kind, 'FOLLOW_HOOK');
  L.interviewerSays('What does Northline Tutors do, and what was your part in it?');
  assert.equal(L.observer.snapshot().director.followUps, 1, 'budget truth from observed interviewer output');
  const after = L.candidate('It matched medical students with tutors and I ran the operations side for two years before I sold it to a colleague. Then I started my own company called Second Venture Labs.');
  assert.equal(after?.kind, 'MOVE_TO_NEXT_PLANNED_QUESTION'); assert.match(after.reason, /budget/);
  assert.match(after.instruction, /planned question 2/);
});

test('K2 · an imperative probe without a question mark still consumes the follow-up ceiling', () => {
  const L = lab('balanced'); // depth 1 per question
  L.interviewerSays('Tell me about yourself.');
  assert.equal(L.candidate('I went to Grenada for medical school and came back here. Then I started my own company called Northline Tutors.')?.kind, 'FOLLOW_HOOK');
  L.interviewerSays('Tell me more about Northline Tutors.');
  assert.equal(L.observer.snapshot().hooks.at(-1).bitTaken, true);
  assert.equal(L.observer.snapshot().director.followUps, 1, 'imperative probes count against the ceiling');
  const after = L.candidate('It matched medical students with tutors for two years. Then I started my own company called Second Venture Labs.');
  assert.equal(after?.kind, 'MOVE_TO_NEXT_PLANNED_QUESTION'); assert.match(after.reason, /budget/);
  assert.equal(L.wire.filter((e) => e.type === 'session.thinking.append').length, 0, 'no quiet hint once the Director has steered this answer');
});

test('early fragments never assert "complete" or "thin"; guarded answers are neither deepened nor challenged', () => {
  const direct = lab('direct'); direct.interviewerSays('Tell me about yourself.');
  assert.equal(direct.candidate('So the thing is that I'), null, 'no move-on after five unsettled words');
  const owl = lab('balanced'); owl.interviewerSays('Tell me about yourself.');
  assert.equal(owl.candidate('Well I guess the main thing is'), null);
  assert.equal(owl.candidate(' I am from Ohio and I like medicine.')?.kind, 'DEEPEN', 'a settled short answer is deepened');
  const guarded = lab('pressure'); guarded.interviewerSays('Tell me about yourself.');
  const g = guarded.candidate('I took last year off for a medical situation and then applied.');
  assert.ok(!g || !['DEEPEN', 'CHALLENGE_GENTLY', 'FOLLOW_HOOK'].includes(g.kind), `guarded answer must not be probed: ${g?.kind}`);
});

test('L · closing: last planned question transitions to the mandatory invitation, answers candidate questions, then signs off', () => {
  const L = lab('balanced', { questions: QUESTIONS.slice(0, 1) });
  L.interviewerSays('Tell me about yourself.');
  const obj = L.candidate('I trained in Lagos, did two years of research in Boston, and I now tutor other IMGs on weekends: we meet twice a week and I enjoy it. That is my background.');
  assert.equal(obj?.kind, 'CLOSING_TRANSITION'); assert.match(obj.instruction, /Do you have any questions for me\?/);
  L.interviewerSays('Do you have any questions for me?');
  assert.equal(L.observer.snapshot().closing.reached, true);
  const ask = L.candidate('Yes, what is call like for interns here?');
  assert.equal(ask?.kind, 'ANSWER_CANDIDATE_QUESTION'); assert.match(ask.target, /call like for interns/);
  L.interviewerSays('Interns take call every fourth night in the first year. Do you have another question?');
  const done = L.candidate("No, that's all, thank you.");
  assert.equal(done?.kind, 'PROFESSIONAL_SIGNOFF');
  L.interviewerSays('Thank you for your time today. You can select Finish & save when you are ready to review your recording and feedback.');
  assert.equal(L.observer.snapshot().state, 'PROFESSIONAL_CLOSE');
  assert.equal(L.candidate('Thanks, that was helpful and I appreciate the time.'), null, 'nothing more is steered after sign-off');
});

test('persona differentiation across the same transcript: Owl pursues, Pressure challenges claims, Direct is selective', () => {
  const claim = "I'm calm under pressure and I'm a strong communicator. I think that is what I bring.";
  const owl = lab('balanced'); owl.interviewerSays('Tell me about yourself.');
  const pressure = lab('pressure'); pressure.interviewerSays('Tell me about yourself.');
  const direct = lab('direct'); direct.interviewerSays('Tell me about yourself.');
  const kinds = [owl, pressure, direct].map((L) => L.candidate(claim)?.kind);
  assert.deepEqual(kinds, ['SEEK_EVIDENCE', 'SEEK_EVIDENCE', 'SEEK_EVIDENCE'], 'an unsupported claim is probed by every persona that still has budget');
  const owlText = owl.objectives().at(-1).content, pressureText = pressure.objectives().at(-1).content;
  assert.match(owlText, /curious, attentive/); assert.match(pressureText, /appropriately skeptical/);
  assert.notEqual(owlText, pressureText);
});

test('wire discipline: strong steer shape, bounded, deduplicated, blocked when closing was requested, never a second audible owner', () => {
  const L = lab('balanced');
  L.interviewerSays('Tell me about yourself.');
  L.candidate('Then I started my own company called Northline Tutors.');
  const sent = L.objectives();
  assert.equal(sent.length, 1);
  const raw = L.wire.find((e) => e.type === 'session.instructions.append');
  assert.equal(raw.delegation_id, null); assert.match(raw.event_id, /^ivoc-director-obj-\d+$/); assert.ok(raw.content.length <= 1800);
  assert.equal(L.wire.filter((e) => e.type === 'session.thinking.append').length, 0, 'the strong objective replaces the quiet hint');
  assert.equal(L.candidate(' '), null, 'identical decision is not re-sent');
  assert.equal(L.interviewer.live.appendDirectorObjective({ id: 'obj-9', kind: 'SPEAK_NOW', instruction: 'NEXT TURN OBJECTIVE x' }), false);
  assert.equal(L.interviewer.live.appendDirectorObjective({ id: 'obj-9', kind: 'FOLLOW_HOOK', instruction: 'not an objective' }), false);
  L.interviewer.live.closingRequested = true;
  assert.equal(L.interviewer.live.appendDirectorObjective({ id: 'obj-10', kind: 'FOLLOW_HOOK', instruction: 'NEXT TURN OBJECTIVE … Objective: FOLLOW_HOOK' }), false);
  assert.equal(L.interviewer.live.appendDirectorObjective({ id: 'obj-11', kind: 'PROFESSIONAL_SIGNOFF', instruction: 'NEXT TURN OBJECTIVE … Objective: PROFESSIONAL_SIGNOFF' }), true);
  L.interviewer.stopping = true; assert.equal(L.interviewer.steerObjective({ id: 'obj-12', kind: 'DEEPEN', instruction: 'NEXT TURN OBJECTIVE …' }), false);
});
