# Y1-Y2-CAM-V6-3401 browser journey

## In-app browser

The integrated build was opened at `http://127.0.0.1:8343/` and exercised
through Student, New Interview, Instant Interview, Camera and Microphone Check,
Station Check, Interview Room, self-rating, Results, transcript, instructor
record, and conduct termination.

The in-app browser denied microphone permission. The UI made that state
visible and the run continued through the labeled practice-without-devices and
typed-answer path. A typed answer produced a contextual live OpenAI utterance,
spoken with OpenAI Speech, followed by a separate observer record. The severe
synthetic conduct run displayed `INTERVIEW ENDED`, spoke the exact professional
boundary, and moved to the terminated self-rating path without another turn.

## Chrome microphone qualification

Chrome displayed its native microphone prompt. Permission was granted for the
test session, and the V6 device check reported `MIC GRANTED · MODE MIC ONLY`
with the visible `Mic live` confirmation. The agent-created test tab was then
closed, ending the session-scoped permission use.

## Fresh Safari recovery verification

A fresh Safari run began Q1, completed the answer with no transcript, and
verified that the repaired flow immediately reopened Q1 as Listening. A typed
answer was entered with real keystrokes and submitted. The provider advanced
to Q2 with a new contextual question and reopened the protected listening
window. The prior unavailable/dead-end and missing-Begin conditions did not
recur.

## Evidence limits

After the bounded safety/accessibility repair, the in-app browser reloaded the
current candidate and exposed the revised provider disclosure as visible text.
Its accessibility tree reported native buttons for the role switch, entry
actions, and question ordering; the custom builder exposed labeled Move up and
Move down controls. This is a semantic smoke, not an exhaustive screen-reader
qualification.

- `evidence/integration/03_results_transcript_observer.png` was captured before
  the final generated-utterance display repair. The repaired mapping is proved
  by the 33/33 current tests and the targeted evidence audit; do not use that
  image alone to prove the new line.
- `evidence/integration/04_conduct_termination_closed.png` proves arrival at
  self-rating after the conduct run but does not visibly include the earlier
  boundary statement. The authenticated smoke result and targeted audit are
  the authoritative termination evidence.
- No screenshot contains a provider secret.
