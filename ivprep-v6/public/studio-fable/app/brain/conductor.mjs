// InterviewConductor — ivoc.interview-conductor.v1
//
// Deterministic interview lifecycle. The MODEL NEVER DECIDES TO END. The conductor owns the
// plan, follow-up depth, the closing invitation, candidate questions, the professional
// sign-off and every transition. It consumes transcript finals and emits bounded
// DIRECTIVES; a transport adapter executes each directive (GPT-Live: steer() = the
// requestOpening pattern generalised; local scripted interviewer: speaks the utterance).
//
//   PREFLIGHT → OPENING → QUESTION(n) → DECIDE(n) → [FOLLOWUP(n,d)] → QUESTION(n+1) …
//   → CLOSING_INVITE → CANDIDATE_QUESTIONS(k) → [BOUNDED_ANSWER] → PROFESSIONAL_CLOSE → ENDED
//   Early end "Wrap up" → CLOSING_INVITE. "Leave now" → ENDED (closingSkipped: student_hard_stop).
//   Provider failure → CLOSING_INVITE_LOCAL → ENDED (closingDelivery: local_fallback).
//   Server terminated → ENDED (closingSkipped: server_terminated).
// Every path to ENDED passes through a closing invite or records an explicit closingSkipped reason.

import { detectHooks, evaluateBite } from './hook-detector.mjs';

export const CONDUCTOR_VERSION = 'ivoc.interview-conductor.v1';
export const CLOSING_QUESTION = 'Do you have any questions for me?';
export const PROFESSIONAL_CLOSE = "Thank you for your time today. That's everything from my side. We'll be in touch.";
export const DEFLECTION = "I can't speak to that for this program specifically. It's a good one to ask on interview day.";

export const DEFAULT_CONFIG = Object.freeze({
  maxDepth: 1,                 // follow-ups per base question (admin "follow-up intensity")
  maxFollowUps: 4,             // per interview
  maxCandidateQuestions: 2,    // K
  durationMs: null,            // time budget (null = none)
  closingReserveMs: 90_000,
  settleMs: 1_200,
  pressure: false,
  style: 'Owl',
  followThreshold: 0.62,       // curiosity (Advanced interviewer): Low .72 / Normal .62 / High .55
  interviewerName: 'Program Director',
});

const ACK = ['Okay.', 'Got it.', 'Understood.', 'Right.'];
const NO_MORE = /^(no|nope|no thank you|no thanks|that'?s (all|it|everything)|i'?m (good|all set|done)|nothing (else|more|further)|i (don'?t|do not) (have|think so)|not (right now|at the moment)|that covers it)\b/i;
const WRAP_PHRASES = /^(that'?s (all|it) (i have|from me)?|i'?d like to (stop|end|wrap up)|can we (stop|end|wrap up)|let'?s (stop|end|wrap up)|i think we can (stop|end|wrap up))/i;

export class InterviewConductor {
  constructor({ questions = [], config = {}, context = {}, programFacts = [], now = () => 0 } = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.context = context;
    this.programFacts = programFacts;
    this.now = now;
    this.plan = questions.filter((q) => q && !(q.tags || []).includes('CLOSING') && q.question_id !== 'MR142-004')
      .map((q, i) => ({ n: i + 1, id: q.question_id || q.id, text: q.canonical_text || q.text, tags: q.tags || [], status: 'QUEUED' }));
    this.N = this.plan.length;
    this.reset();
  }

  reset() {
    this.state = 'PREFLIGHT';
    this.n = 0;                 // current base question index (1-based)
    this.depth = 0;             // follow-up depth on current question
    this.followUpsTotal = 0;
    this.k = 0;                 // candidate questions answered
    this.startedAtMs = null;
    this.ledger = [];           // every transition / directive / detection, in order
    this.turns = [];            // transcript turns {speaker,text,atMs,phase,n}
    this.hooks = [];            // {turn, report, directive, bitTaken}
    this.directives = [];
    this.inviteSent = 0; this.closeSent = 0;
    this.closing = { reached: false, delivery: null, skipped: false, reason: null, candidateQuestions: [], inviteDeliveryUnverified: false, inviteResends: 0 };
    this.pendingBite = null;
    this.endedEarly = false;
    this.deferredQuestions = [];
    this.priorTurns = [];
    this.lastApplicantFinalAt = null;
    this.awaitingDecision = false;
    for (const q of this.plan) q.status = 'QUEUED';
  }

  // ---------- helpers ----------
  log(kind, detail = {}) { const entry = { seq: this.ledger.length + 1, atMs: this.now(), state: this.state, kind, ...detail }; this.ledger.push(entry); return entry; }
  transition(to, detail = {}) { const from = this.state; this.state = to; this.log('transition', { from, to, ...detail }); }
  directive(kind, content, utterance, extra = {}) {
    const d = { id: `d-${this.directives.length + 1}`, kind, state: this.state, content, utterance, atMs: this.now(), ...extra };
    this.directives.push(d); this.log('directive', { directive: d.id, kind, utterance });
    return d;
  }
  current() { return this.plan[this.n - 1] || null; }
  next() { return this.plan[this.n] || null; }
  remainingReserveMs() {
    if (!this.config.durationMs || this.startedAtMs === null) return Infinity;
    return this.config.durationMs - (this.now() - this.startedAtMs);
  }
  timeForClosing() { return Number.isFinite(this.remainingReserveMs()) && this.remainingReserveMs() <= this.config.closingReserveMs; }
  snapshot() {
    return {
      version: CONDUCTOR_VERSION, state: this.state, n: this.n, N: this.N, depth: this.depth, followUpsTotal: this.followUpsTotal, k: this.k,
      plan: this.plan.map((q) => ({ ...q })), closing: { ...this.closing, candidateQuestions: this.closing.candidateQuestions.slice() },
      inviteSent: this.inviteSent, closeSent: this.closeSent, endedEarly: this.endedEarly, deferredQuestions: this.deferredQuestions.slice(),
      hooks: this.hooks.map((h) => ({ turn: h.turn, questionId: h.questionId, span: h.report.primary?.span?.text || null, category: h.report.primary?.category || null, decision: h.report.decision, blockedBy: h.report.blockedBy, bitTaken: h.bitTaken, directive: h.directive?.id || null, followUp: h.report.primary?.suggestedFollowUp || null, deferred: h.report.hooks.filter((x) => x.deferred).map((x) => x.span.text) })),
      turns: this.turns.slice(), directives: this.directives.map((d) => ({ ...d })), ledger: this.ledger.slice(),
    };
  }

  // ---------- lifecycle ----------
  start() {
    if (this.state !== 'PREFLIGHT') throw new Error('Interview already started.');
    this.startedAtMs = this.now();
    this.transition('OPENING');
    if (!this.N) return this.enterClosing('no_substantive_questions');
    return this.askQuestion(1);
  }

  askQuestion(n) {
    this.n = n; this.depth = 0;
    const q = this.current(); q.status = 'CURRENT';
    this.transition('QUESTION', { n });
    const content = n === 1
      ? `Ask this opening interview question now, naturally, without waiting for the applicant to speak, without adding a preamble or a second question, then pause and listen: ${JSON.stringify(q.text)}`
      : `Acknowledge the previous answer in at most one short clause, then ask planned question ${n} now, as one question, in these words: ${JSON.stringify(q.text)} Then listen.`;
    const spoken = q.text.includes(' / ') ? q.text.split(' / ').pop().trim() : q.text; // one variant is spoken; the canonical text stays in the directive
    const utterance = n === 1 ? spoken : `${ACK[(n - 1) % ACK.length]} ${spoken}`;
    return this.directive('QUESTION', content, utterance, { n, questionId: q.id });
  }

  // Transcript input. speaker: 'interviewer' | 'applicant'. Only FINAL turns are turns.
  ingestFinal({ speaker, text, atMs = this.now() }) {
    const clean = String(text || '').trim();
    if (!clean) return null;
    this.turns.push({ speaker, text: clean, atMs, phase: this.state, n: this.n });
    if (speaker === 'interviewer') return this.onInterviewerFinal(clean);
    if (speaker === 'applicant') return this.onApplicantFinal(clean, atMs);
    return null;
  }

  onInterviewerFinal(text) {
    // Bite evaluation: did the interviewer's next question take the hook?
    if (this.pendingBite) {
      const bite = evaluateBite(this.pendingBite.report.primary, text);
      this.pendingBite.bitTaken = bite.taken;
      this.log('bite', { hook: this.pendingBite.report.primary?.span?.text, taken: bite.taken, overlap: bite.overlap });
      this.pendingBite = null;
    }
    if (this.state === 'CLOSING_INVITE' || this.state === 'CLOSING_INVITE_LOCAL') {
      if (/questions? for me|any questions/i.test(text)) { this.closing.delivery = this.state === 'CLOSING_INVITE_LOCAL' ? 'local_fallback' : 'provider'; this.transition('CANDIDATE_QUESTIONS'); this.log('invite_verified'); }
      else if (this.closing.inviteResends < 1) { this.closing.inviteResends += 1; this.log('invite_resend'); return this.directive('CLOSING_INVITE', this.inviteContent(), CLOSING_QUESTION, { resend: true }); }
      else { this.closing.inviteDeliveryUnverified = true; this.closing.delivery = 'unverified'; this.transition('CANDIDATE_QUESTIONS'); }
    } else if (this.state === 'PROFESSIONAL_CLOSE') {
      this.closeSent += 1; this.transition('ENDING'); this.transition('ENDED', { reason: 'professional_close_delivered' });
    } else if (this.state === 'QUESTION') {
      const q = this.current(); if (q && q.status === 'CURRENT') q.status = 'ASKED';
    }
    return null;
  }

  onApplicantFinal(text, atMs) {
    this.lastApplicantFinalAt = atMs;
    if (this.state === 'QUESTION' || this.state === 'FOLLOWUP') {
      if (WRAP_PHRASES.test(text)) { this.log('student_wrap_phrase'); return this.requestEnd('wrap'); }
      return this.decide(text);
    }
    if (this.state === 'CANDIDATE_QUESTIONS') {
      if (NO_MORE.test(text) || !/\?|\b(what|how|do|does|is|are|would|will|could|can|when|where|who)\b/i.test(text)) return this.enterProfessionalClose();
      this.closing.candidateQuestions.push(text);
      // Hooks during closing are logged, never followed (phase guard inside detectHooks).
      const report = detectHooks({ question: { id: 'CLOSING', text: CLOSING_QUESTION, tags: ['CLOSING'] }, answer: text, policy: { phase: 'CANDIDATE_QUESTIONS' } });
      if (report.primary) { this.hooks.push({ turn: this.turns.length, questionId: 'CLOSING', report, directive: null, bitTaken: null, phase: 'closing' }); this.log('hook_logged_closing', { span: report.primary.span.text }); }
      this.k += 1;
      this.transition('BOUNDED_ANSWER', { k: this.k });
      const answer = this.boundedAnswer(text);
      const more = this.k < this.config.maxCandidateQuestions;
      const utterance = more ? `${answer} Do you have another question?` : `${answer} Let's leave it there.`;
      const content = `The applicant asked: ${JSON.stringify(text)}. Answer in at most two sentences using only the authorized context. If the context does not cover it, say: ${JSON.stringify(DEFLECTION)} ${more ? 'Then ask if they have another question.' : 'Then move directly to the professional close.'}`;
      const d = this.directive('BOUNDED_ANSWER', content, utterance, { k: this.k, answerSource: answer === DEFLECTION ? 'deflection' : 'authorized_fact' });
      if (more) this.transition('CANDIDATE_QUESTIONS'); else this.enterProfessionalClose({ afterLimit: true });
      return d;
    }
    return null;
  }

  decide(text) {
    const q = this.current();
    const report = detectHooks({
      question: { id: q.id, text: q.text, tags: q.tags },
      answer: text,
      priorTurns: this.priorTurns,
      context: { style: this.config.style, pressure: this.config.pressure, specialty: this.context.specialty },
      policy: { maxDepth: this.config.maxDepth, depthUsedThisQuestion: this.depth, remainingReserveMs: this.remainingReserveMs(), closingReserveMs: this.config.closingReserveMs, phase: this.state, followThreshold: this.config.followThreshold },
    });
    this.priorTurns.push({ questionId: q.id, answerText: text });
    const budgetLeft = this.followUpsTotal < this.config.maxFollowUps;
    let decision = report.decision;
    if (!budgetLeft && decision !== 'MOVE_ON') { decision = 'MOVE_ON'; this.log('follow_up_budget_exhausted'); }
    if (report.flags?.rambling) { decision = 'MOVE_ON'; this.log('recover_ramble'); }
    const entry = { turn: this.turns.length, questionId: q.id, report, directive: null, bitTaken: null, decision };
    if (report.primary || report.flags?.candidateQuestion) this.hooks.push(entry);
    this.log('decision', { decision, category: report.primary?.category || null, span: report.primary?.span?.text || null, blockedBy: report.blockedBy, reasons: report.reasons });

    if (report.flags?.candidateQuestion && decision === 'MOVE_ON') {
      // Mid-interview candidate question: bounded answer, no depth cost, then resume.
      const answer = this.boundedAnswer(report.flags.candidateQuestionText);
      const nextDirective = this.advanceOrClose();
      // One composite directive: bounded answer, "Back to you", then the next planned step verbatim.
      const d = this.directive('MID_CANDIDATE_QUESTION',
        `The applicant asked a question mid-interview: ${JSON.stringify(report.flags.candidateQuestionText)}. Answer in at most two sentences from authorized context (or say ${JSON.stringify(DEFLECTION)}), say "Back to you", then: ${nextDirective?.content || 'wait for the next directive'}`,
        `Fair question. ${answer} Back to you. ${nextDirective?.utterance || ''}`.trim(),
        { merges: nextDirective?.kind || null, n: nextDirective?.n ?? this.n, questionId: nextDirective?.questionId || null, answerSource: answer === DEFLECTION ? 'deflection' : 'authorized_fact' });
      entry.directive = d;
      return d;
    }

    if (decision === 'FOLLOW_HOOK' || decision === 'PROBE_VAGUE' || decision === 'CLARIFY_CONTRADICTION') {
      this.depth += 1; this.followUpsTotal += 1;
      this.transition('FOLLOWUP', { n: this.n, depth: this.depth, decision });
      const primary = report.primary;
      const followUp = primary.suggestedFollowUp;
      const nextText = this.next() ? this.next().text : null;
      const content = decision === 'FOLLOW_HOOK'
        ? `The applicant mentioned ${JSON.stringify(primary.span.text.slice(0, 160))} and did not explain it. Ask exactly one natural follow-up about it now, in your own words, for example: ${JSON.stringify(followUp)}. Do not ask a second question. After the applicant answers, ${nextText ? `continue with planned question ${this.n + 1}: ${JSON.stringify(nextText)}` : 'the planned questions are finished; wait for the closing directive'}.`
        : decision === 'PROBE_VAGUE'
          ? `The applicant asserted ${JSON.stringify(primary.span.text)} without an example. Ask for exactly one concrete example now, for example: ${JSON.stringify(followUp)}. Do not ask a second question.`
          : `The applicant's statements conflict: ${JSON.stringify(primary.meta.a)} versus ${JSON.stringify(primary.meta.b)}. Neutrally state both and ask them to reconcile, for example: ${JSON.stringify(followUp)}.`;
      const d = this.directive(decision, content, followUp, { n: this.n, depth: this.depth, hook: primary.span.text, category: primary.category });
      entry.directive = d;
      this.pendingBite = entry;
      return d;
    }
    return this.advanceOrClose();
  }

  advanceOrClose() {
    if (this.state === 'FOLLOWUP') { /* fell through after a follow-up answer */ }
    const q = this.current(); if (q) q.status = 'ASKED';
    if (this.timeForClosing() && this.n < this.N) {
      this.deferredQuestions = this.plan.slice(this.n).map((x) => { x.status = 'DEFERRED'; return x.text; });
      this.log('time_reserve_reached', { deferred: this.deferredQuestions.length });
      return this.enterClosing('time_budget');
    }
    if (this.n < this.N) return this.askQuestion(this.n + 1);
    return this.enterClosing('plan_complete');
  }

  // The student pressed End. mode: 'wrap' (recommended) | 'leave'.
  requestEnd(mode = 'wrap') {
    if (['ENDED', 'ENDING'].includes(this.state)) return null;
    this.endedEarly = this.n < this.N || ['QUESTION', 'FOLLOWUP', 'OPENING'].includes(this.state);
    if (mode === 'leave') {
      this.closing.skipped = true; this.closing.reason = 'student_hard_stop';
      for (const x of this.plan) if (x.status !== 'ASKED') x.status = 'DEFERRED';
      this.transition('ENDING', { reason: 'student_hard_stop' }); this.transition('ENDED', { reason: 'student_hard_stop', closingSkipped: true });
      return this.directive('END', 'End the session now.', null, { closingSkipped: true });
    }
    if (['CLOSING_INVITE', 'CLOSING_INVITE_LOCAL', 'CANDIDATE_QUESTIONS', 'BOUNDED_ANSWER'].includes(this.state)) return this.enterProfessionalClose();
    if (this.state === 'PROFESSIONAL_CLOSE') return null;
    this.deferredQuestions = this.plan.filter((x) => x.status !== 'ASKED').map((x) => { x.status = 'DEFERRED'; return x.text; });
    return this.enterClosing('student_wrap_up');
  }

  providerFailed(reason = 'provider_error') {
    if (['ENDED', 'ENDING'].includes(this.state)) return null;
    this.log('provider_failed', { reason });
    if (this.state === 'PROFESSIONAL_CLOSE') { this.closing.delivery = 'local_fallback'; this.closeSent += 1; this.transition('ENDING'); this.transition('ENDED', { reason: 'professional_close_local' }); return this.directive('PROFESSIONAL_CLOSE_LOCAL', null, PROFESSIONAL_CLOSE, { local: true }); }
    if (['CANDIDATE_QUESTIONS', 'BOUNDED_ANSWER'].includes(this.state)) { this.closing.delivery = 'local_fallback'; return this.enterProfessionalClose({ local: true }); }
    this.deferredQuestions = this.plan.filter((x) => x.status !== 'ASKED').map((x) => { x.status = 'DEFERRED'; return x.text; });
    this.closing.reached = true; this.closing.delivery = 'local_fallback'; this.inviteSent += 1;
    this.transition('CLOSING_INVITE_LOCAL', { reason });
    return this.directive('CLOSING_INVITE_LOCAL', null, `That's the last of my questions. ${CLOSING_QUESTION}`, { local: true });
  }

  serverTerminated(reason = 'server_terminated') {
    if (['ENDED'].includes(this.state)) return null;
    this.closing.skipped = !this.closing.reached; this.closing.reason = reason;
    this.transition('ENDING', { reason }); this.transition('ENDED', { reason, closingSkipped: this.closing.skipped });
    return this.directive('END', null, null, { closingSkipped: this.closing.skipped, reason });
  }

  tick(atMs = this.now()) {
    // Time budget while a question is open and the student is between answers.
    if (['QUESTION', 'FOLLOWUP'].includes(this.state) && this.timeForClosing() && this.lastApplicantFinalAt !== null) {
      // Only acts between turns; never cuts an answer. The next decide() handles it.
    }
    // Silence in CANDIDATE_QUESTIONS: 8 s with no applicant turn → professional close.
    if (this.state === 'CANDIDATE_QUESTIONS' && this.candidateWaitSince && atMs - this.candidateWaitSince >= 8_000) { this.log('candidate_silence_timeout'); return this.enterProfessionalClose(); }
    return null;
  }

  inviteContent() { return `The planned questions are finished. Say exactly one short transition, then ask: ${JSON.stringify(CLOSING_QUESTION)} Then listen. Do not ask another interview question.`; }

  enterClosing(reason) {
    if (this.closing.reached) return null;
    this.closing.reached = true; this.closing.reason = reason;
    const q = this.current(); if (q && q.status === 'CURRENT') q.status = 'ASKED';
    this.transition('CLOSING_INVITE', { reason });
    this.inviteSent += 1; this.candidateWaitSince = this.now();
    return this.directive('CLOSING_INVITE', this.inviteContent(), `That's the last of my questions. ${CLOSING_QUESTION}`);
  }

  enterProfessionalClose({ local = false } = {}) {
    if (['PROFESSIONAL_CLOSE', 'ENDING', 'ENDED'].includes(this.state)) return null;
    this.transition('PROFESSIONAL_CLOSE');
    const content = `Close the interview now with this line and nothing else: ${JSON.stringify(PROFESSIONAL_CLOSE)}`;
    const d = this.directive('PROFESSIONAL_CLOSE', content, PROFESSIONAL_CLOSE, { local });
    if (local) { this.closeSent += 1; this.transition('ENDING'); this.transition('ENDED', { reason: 'professional_close_local' }); }
    return d;
  }

  boundedAnswer(question) {
    const toks = String(question).toLowerCase().split(/\W+/).filter((t) => t.length > 3);
    const hit = this.programFacts.find((f) => (f.keys || []).some((k) => toks.some((t) => t.startsWith(k))));
    return hit ? hit.answer : DEFLECTION;
  }
}

// Determinism helper for tests: replay a scripted stream of events.
export function replay(conductor, events) {
  const out = [];
  conductor.start();
  for (const ev of events) {
    let d = null;
    if (ev.type === 'interviewer_final') d = conductor.ingestFinal({ speaker: 'interviewer', text: ev.text, atMs: ev.atMs });
    else if (ev.type === 'applicant_final') d = conductor.ingestFinal({ speaker: 'applicant', text: ev.text, atMs: ev.atMs });
    else if (ev.type === 'student_end') d = conductor.requestEnd(ev.mode);
    else if (ev.type === 'provider_failed') d = conductor.providerFailed(ev.reason);
    else if (ev.type === 'server_terminated') d = conductor.serverTerminated(ev.reason);
    else if (ev.type === 'tick') d = conductor.tick(ev.atMs);
    if (d) out.push(d);
  }
  return out;
}
