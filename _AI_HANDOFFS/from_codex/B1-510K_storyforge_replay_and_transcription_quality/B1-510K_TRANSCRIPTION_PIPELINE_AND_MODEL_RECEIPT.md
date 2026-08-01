# B1-510K Transcription Pipeline and Model Receipt

## Production path before and after

| Boundary | Before | After |
|---|---|---|
| Provider | OpenAI | OpenAI |
| Primary | `gpt-4o-transcribe` | `gpt-4o-transcribe` |
| Fallback | `whisper-1` | `whisper-1` |
| Assembly | `concat` | `concat` |
| Reconciliation | `off` | `off` |

No provider, model, credential, response format, storage boundary, or cost class
changed.

## Proven defect

The former prompt-echo guard rejected a valid GPT-4o transcript whenever its
first 300 characters contained two vocabulary-term substrings. That rejected
real narrative such as `The patient had a Whipple and went to the ICU.` and
even matched `PEA` inside `speak` plus `ICU` inside `particular`. The adapter
then retranscribed that segment with Whisper.

The Founder canary session ended with `gpt-4o-transcribe` and had no session
failover event, but the pre-B1-510K audit could not prove every segment's model
because rejected-format fallback was not separately attributed.

## Correction

- Explicit `Vocabulary:` and guidance-prefix echoes remain rejected.
- GPT prompt-list echo detection now requires a structurally exact comma- or
  semicolon-separated keyword list, not narrative substrings.
- `segment_transcribed` now records only content-free provider/model metadata.
- GPT-4o receives one bounded presentation instruction; Whisper is unchanged.

The OpenAI transcription API supports a prompt for style/context guidance; the
candidate uses that existing boundary rather than a second formatting model.

## Source provenance

Before attachment deletes transient segment rows, their exact ordered provider
text is used to create the audio story and immutable original. Any student edit
is then applied through the existing `sf_update_story_v5` security-definer API
as the working text. No schema or duplicate transcript authority was added.
