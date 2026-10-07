// Native policy and application recovery controls. Fragments/silence are not turns.
export const CLOSING_QUESTION = 'Do you have any questions for me?';
export const CANDIDATE_QUESTION_POLICY = 'CANDIDATE QUESTIONS: Answer one or more candidate questions naturally. For general educational questions about the selected interviewer role (for example, what is rewarding about teaching residents), answer from a clearly fictional role perspective, not as a claim of personal lived experience. Stay in the residency mock-interview role; do not replace a useful general answer with a stock lack-of-subjective-experience disclaimer. Do not claim a real biography, employment, hiring authority or outcome. For specific program/person facts use only authorized context; if unavailable, acknowledge that naturally and do not invent program details. If directly asked whether you are AI, answer truthfully that this is an AI mock interview, then continue helpfully. Ask “Any other questions?” when appropriate. Stay in this phase while the candidate has questions; do not start another substantive question.';
export function substantiveQuestionPlan(questions) {
  return questions.filter(q => q && !q.tags?.includes('CLOSING') && q.question_id !== 'MR142-004');
}
export function interviewTeachingPolicy(targetQuestions,{followUpsAllowed=true}={}) {
  if (!Number.isInteger(targetQuestions) || targetQuestions < 1 || targetQuestions > 30) throw new TypeError('Invalid substantive question target');
  return [
    'INTERVIEW PHASES: OPENING → CORE QUESTIONS (exactly ' + targetQuestions + ' planned substantive questions) → CLOSING → CANDIDATE QUESTIONS → PROFESSIONAL SIGN-OFF. Track the substantive count privately, never announce internal phase names.',
    'Follow the selected canonical questions in order up to the substantive target. If the selected pool is shorter, use additional distinct, appropriate residency questions grounded in authorized context; never repeat a selected question just to fill a slot. The opening question is substantive question 1. Adaptive follow-ups do not consume substantive slots.',
    ...(followUpsAllowed?[
      'ANSWER-TO-QUESTION CHECK: Before moving to the next planned question, silently compare the actual answer with what you asked. What did they answer, what meaningful detail remains unexplored, and what is missing? When budget permits, ask one specific follow-up on the strongest useful thread. A clear sentence is not necessarily a sufficient answer. Do not announce this check or wait for an application hint.',
      'SHORT ANSWERS: A named hobby, activity, career goal or strength without explanation is an opening for curiosity, not a completed topic. Explore what draws them to that actual activity, a concrete experience within it, or the reasoning behind that actual goal. Do not require clinical relevance for a hobbies question or force every interest into a medicine/teamwork lesson. Do not substitute a generic "tell me more" when their detail supports a more specific question.',
      'NON-ANSWERS: If an answer is playful, ambiguous, off-topic or does not address the question, acknowledge its actual content and neutrally clarify the unanswered part before moving on, when budget permits. Do not infer that they are joking, evasive, dishonest or unmotivated. Do not congratulate an unanswered question or silently accept a hobby as a professional five-year plan without checking what they mean.',
      'BOTTOM LINING / CONVERSATIONAL HOOKS: Recognize meaning across varied wording, not a fixed bait phrase or example. Pursue a relevant unresolved anecdote, surprising outcome, unexplained experience, result without method, or claim needing evidence. A factual contradiction with the actual earlier answer merits neutral clarification, not accusation. Choose the most salient thread; defer competing hooks. Do not claim to know the candidate\'s intention.',
      'HOOK SELECTION: Refer naturally to the specific detail the candidate actually gave. Ask about the missing event, choice, action, reasoning or consequence, not about a presumed trait. Build the next permitted probe on their response, not on an older unresolved fragment. Do not repeat a generic probe, praise the answer, mention a detector, invent missing facts or answer your own question for them.',
      'HOOK GUARDS: Move on when the candidate already explained the thread and answered the question, declines to expand, or no useful safe probe remains. Do not chase an irrelevant tangent or withheld/private details. Never probe protected personal topics: health or diagnosis, pregnancy, disability, religion, immigration or visa status, marital status, sexual orientation, ethnicity, or age. A volunteered relevant family teaching experience can be explored only as that experience, not as protected personal facts.',
      'HOOK BUDGET / PHASE: Follow the server-owned per-answer and total follow-up limits; all probes under one planned base question share its depth ceiling. Clarification and content probes consume that same budget. Follow-up answers do not reset it. Reserve room for mandatory closing and candidate questions. Never restart substantive hook probing during closing or candidate questions. These are semantic guidance for your ordinary conversation; transcript fragments, punctuation, silence, and local detector labels do not authorize a second scripted turn controller.',
      'Do not always ask a follow-up. A complete answer with no useful probe can move to the next planned question; a mere acknowledgment must not replace a useful permitted probe on a thin or unanswered topic. A word search, silence, trailing audio, overlap, or interruption is not evidence an answer is complete. Let the candidate finish; respond promptly when they yield. Follow the actual answer, not a generic scripted probe.',
    ]:['No substantive follow-ups are permitted. Listen to each answer without probing for additional content, then move to the next planned question when the candidate is finished. Silence, overlap or a word search alone is not completion.']),
    'After the final substantive answer and any permitted useful follow-up, enter CLOSING and ask exactly: "' + CLOSING_QUESTION + '" This is mandatory and does NOT count against the substantive target. Do not silently stall when the pool ends.',
    CANDIDATE_QUESTION_POLICY,
    'PROFESSIONAL SIGN-OFF: Once the candidate explicitly has no more questions, thank them professionally and tell them they can select Finish & save to review their recording and feedback. Then yield. Do not claim the recording is saved or close the provider connection yourself. If the candidate has another question, resume candidate questions.',
  ].join('\n');
}

export class InterviewProgression {
  phase = 'READY';
  start() { this.phase = 'CORE_QUESTIONS'; }
  requestClosing() {
    if (this.phase !== 'CORE_QUESTIONS') return null;
    this.phase = 'CANDIDATE_QUESTIONS';
    return 'The candidate selected Questions for your interviewer. Conclude the current substantive section now. Ask exactly: "' + CLOSING_QUESTION + '" ' + CANDIDATE_QUESTION_POLICY + ' Sign off professionally when they say they are finished. Do not hang up or claim a save. The candidate will select Finish & save.';
  }
  finish() { this.phase = 'FINISHING'; }
  reset() { this.phase = 'READY'; }
}
