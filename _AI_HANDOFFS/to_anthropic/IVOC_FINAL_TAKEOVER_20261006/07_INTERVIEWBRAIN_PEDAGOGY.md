# InterviewBrain / MissionMed pedagogy

Preserve native GPT-Live full-duplex provider and current server-owned limits/context. A better InterviewBrain is not a new dialogue engine.

Founder semantic example:
“Actually, there was a really interesting teaching moment with my son yesterday.”
Candidate stops. A human interviewer naturally asks “What happened?” because an interesting anecdote/outcome is introduced but not explained. The teaching contract is semantic curiosity, not this exact string.

Classes to preserve/test: unresolved anecdote, surprising outcome, unexplained experience, deliberately bottom-lined hook, evidence-demanding claim, irrelevant tangent, resolved hook, multiple competing hooks. Prioritize one salient context-appropriate hook; do not interrogate every dangling phrase. Authorized application context may make a research/teaching hook salient; no private context leakage or fabricated conclusions.

## Current implementation

Fable brain/hook-detector.mjs and conductor.mjs detect/arbitrate candidates. brain/native-observer.mjs plus model/native-observation-marks.mjs project native events. Native provider, not local synthetic conductor, owns completed spoken turns.

Current quiet hook bridge uses session.thinking.append, maxone attempted hint per planned question and bounded32attempts. Candidate text serialized as untrusted data; not a command to speak. No forced response.create/VAD turn or retry. Withhold stale/conflicting/private/resolved evidence and closing/exhausted-budget hints.

Native fragments deduplicated with bounded2048identity retention; conflicting duplicate IDs withhold evidence. A fragment or transcript punctuation does not prove a completed turn, hook-followed speech, or audible output.

Canonical path:
candidate transcript/event → semantic hook observation → bounded native guidance/context → ordinary GPT follow-up → canonical provider output/turn → qualified hook-followed event. Final spoken acceptance open.

## Progression / closing

public/capabilities/interview-progression.mjs, interview-policy.mjs, interviewer-preferences.mjs; server/providers/openai-live-session.mjs and ivoc-context-pack-resolver.mjs own selected question/context/config limits.

Opening is substantive question1. Follow-ups consume allowed follow-up budget, not base slots. Selected questions in order; short selected pool may use distinct authorized appropriate questions, never repetition just to fill count. Reserve time/budget for closing.

ALWAYS “Do you have any questions for me?” even custom pool. Candidate-question phase uses current server/config bounds; read those exact active bounds, do not invent a new hardcoded number. Stay in this phase until explicit finish/no-more-questions. Role-fictional educational answers permitted; real program facts only authorized verified context; answer AI identity truthfully if asked. Professional thanks and explicit invitation to Finish & save; provider must not falsely claim save or hang up to simulate completion.

DR392 fixes role/candidate-question policy and explicit transition guidance. Observed closing text is qualified as observed, never heard. Progress adapter now includes that status without silently promoting audibility.

Interruption must cancel/gate the actual output generation; reject stale output. Embodiment requires acknowledged flush before resume. Keep one audio authority and matching recording/transcript clock.

## Tests / required evidence

ivprep-v6/test/fable-convergence/hook-guidance.test.mjs
ivprep-v6/test/fable-convergence/hook-references.test.mjs
ivprep-v6/test/8001/openai-live-transcript-observer.test.mjs
ivprep-v6/test/8001/closing-role-policy.test.mjs
ivprep-v6/test/8001/live-interview.test.mjs
ivprep-v6/test/8001/live-interview-integration.test.mjs
ivoc/intelligence/acceptance.test.mjs
ivoc/intelligence/director/triggers.test.mjs

Fixtures are deterministic regression, not real student achievement. Positive real acceptance: selected question, answer with unresolved meaningful hook, heard natural answer-grounded follow-up, answer, interruption, resumed conversation, next planned question, mandatory closing, candidate question and professional sign-off; save and hear exact two-sided cold replay. A failure returns to affected guidance/state/audio boundary, not new architecture.
