# B1-508 Provider and Voice Preflight

## Production state

| Control | Exact value/state |
|---|---|
| `STORYFORGE_TRANSCRIBE_PROVIDER` | `none` |
| `STORYFORGE_AUDIO_RECONCILIATION` | `off` |
| `STORYFORGE_VOICE_FORCE_OFF` | `1` |
| `STORYFORGE_PLATFORM_OFF` | `1` |
| `STORYFORGE_ASSEMBLY_EXECUTOR` | absent |
| `STORYFORGE_OPENAI_API_KEY` | absent |
| StoryForge R2 variables | 0 |
| Public capability | `audioAvailable:false` |

No provider call occurred. No R2 operation occurred. No production audio was
accepted, retained, assembled, replayed, or reconciled.

## RP-8

The Founder accepted both Chrome and Safari perceptual playback for RP-8
Option A. The binding later activation value is:

`STORYFORGE_ASSEMBLY_EXECUTOR=concat`

That value remains a recorded future setting. It was deliberately not inserted
into production merely to claim readiness.

## Independent remaining voice gates

- FG-1 Founder-approved student-facing recording language.
- Private R2 and scoped production credentials.
- Scoped transcription-provider contract/key and synthetic acceptance.
- Governed RP-7 human corpus.
- Founder-only voice authorization and allowlist.
- Physical Chrome/Safari/mobile device recording acceptance.
- Real record/transcribe/assemble/replay/delete verification.
- E13 health and accepted reconciliation dry-run progression.

These gates do not affect text create/save/edit/reload.
