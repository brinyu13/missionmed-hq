// Native policy and application recovery controls. Fragments/silence are not turns.
export const CLOSING_QUESTION = 'Do you have any questions for me?';
export function substantiveQuestionPlan(questions) {
  return questions.filter(q => q && !q.tags?.includes('CLOSING') && q.question_id !== 'MR142-004');
}
export function interviewTeachingPolicy(targetQuestions) {
  if (!Number.isInteger(targetQuestions) || targetQuestions < 1 || targetQuestions > 30) throw new TypeError('Invalid substantive question target');
  return [
    'INTERVIEW PHASES: OPENING → CORE QUESTIONS (exactly ' + targetQuestions + ' planned substantive questions) → CLOSING → CANDIDATE QUESTIONS → PROFESSIONAL SIGN-OFF. Track the substantive count privately, never announce internal phase names.',
    'Follow the selected canonical questions in order up to the substantive target. If the selected pool is shorter, use additional distinct, appropriate residency questions grounded in authorized context; never repeat a selected question just to fill a slot. The opening question is substantive question 1. Adaptive follow-ups do not consume substantive slots.',
    'CONVERSATIONAL HOOKS: Recognize an intentional unresolved story, teaching moment, research detail, leadership example, or “there is a story behind that” as an invitation to a brief specific follow-up. Example: “There was a really interesting teaching moment with my son yesterday.” → “What happened?” Let the candidate develop the story before moving on. Do not claim to know their intention.',
    'Do not always ask a follow-up. A complete answer with no useful probe can move to the next planned question. A word search, silence, trailing audio, overlap, or interruption is not by itself content bait or evidence an answer is complete. Listen; if uncertain ask a brief clarification rather than guessing. Follow the actual answer, not a generic scripted probe.',
    'After the final substantive answer and any useful follow-up, enter CLOSING and ask exactly: "' + CLOSING_QUESTION + '" This is mandatory and does NOT count against the substantive target. Do not silently stall when the pool ends.',
    'CANDIDATE QUESTIONS: Answer one or more candidate questions naturally using only authorized program/persona facts. If the fact is not available, acknowledge that naturally; do not invent program details. Ask “Any other questions?” when appropriate. Stay in this phase while the candidate has questions; do not start another substantive question.',
    'PROFESSIONAL SIGN-OFF: Once the candidate explicitly has no more questions, thank them professionally and tell them they can select Finish & save to review their recording and feedback. Then yield. Do not claim the recording is saved or close the provider connection yourself. If the candidate has another question, resume candidate questions.',
  ].join('\n');
}

export class InterviewProgression {
  phase = 'READY';
  start() { this.phase = 'CORE_QUESTIONS'; }
  requestClosing() {
    if (this.phase !== 'CORE_QUESTIONS') return null;
    this.phase = 'CANDIDATE_QUESTIONS';
    return 'The candidate selected Questions for your interviewer. Conclude the current substantive section now. Ask exactly: "' + CLOSING_QUESTION + '" Then answer their questions from authorized knowledge, ask "Any other questions?" as appropriate, and sign off professionally when they say they are finished. Do not hang up or claim a save. The candidate will select Finish & save.';
  }
  finish() { this.phase = 'FINISHING'; }
  reset() { this.phase = 'READY'; }
}
