# B1-510I-A Library Audio Replay Defect

## Classification

Separate, narrowly scoped follow-up defect. It is not a failure of the Founder-approved physical-microphone recording/transcription canary and does not block Phase A completion.

## Observed result

- Recording through the live physical microphone: PASS.
- Upload through the real WordPress gateway: PASS.
- Provider transcription: PASS by Founder assessment.
- Editable transcript insertion: PASS.
- Story/transcript save and Library persistence: PASS.
- Original audio playback after reopening from Library: FAIL; audio did not play.

## Preserved evidence

The latest recording session is attached to the saved Founder story and references one verified permanent private-R2 audio object. Transient database segments and transient `storyforge-rec/` objects are both zero. The permanent object must not be deleted merely to make cleanup counts resemble a cancelled canary; it is attached user content and evidence for this defect.

## Investigation boundary

Trace only the Library reopen path across saved story projection, audio-asset reference, signed playback URL issuance, client player hydration, and browser playback response. Do not change voice entitlement, recording, transcription, provider selection, R2 permissions, reconciliation, authentication, RLS, or unrelated UI without proven evidence.
