# B1-510I Authority and Canonical Release Graph

Date: 2026-08-01 EDT

## Binding authority

The B1-510I Founder prompt makes the current dark `MissionMed//Storyforge` product the August 1 canonical baseline. Earlier Bootstrap/demo generations are not production authority. B1-510I also newly authorizes voice for students who pass the existing trusted StoryForge entitlement boundary, but requires a real production student recording/transcription canary before that population may remain activated.

## Linear accepted source graph

The accepted work is linear; no competing merge or alternate product branch was found.

| Commit | Accepted change |
|---|---|
| `a8a156e` | eligible-student StoryForge routing correction |
| `04053a2` | routing deployment evidence |
| `d00c586` | entitled identity synchronization |
| `db20c5a` | B1-510H identity-sync evidence; B1-510I starting HEAD |
| `3aeceee268ed6fd9a8eaa50138b8c00e8f13211b` | eligible-student voice parity seam |
| `baf670c` | reject explicit transcription prompt echoes |
| `b0185f7` | reject raw multi-term vocabulary echoes |
| `eb02a91046f791d7f0f7541b3f0a214f4385b22d` | fail contaminated primary output to the accepted Whisper fallback |

## Canonical deployed release

- Static release ID: `v-21d896bc96f9c454`
- Static source commit: `3aeceee268ed6fd9a8eaa50138b8c00e8f13211b`
- Kinsta immutable pointer: `releases/3aeceee268ed6fd9a8eaa50138b8c00e8f13211b`
- Index SHA-256: `ffeb8b5f603d3c6113bca008cc2647fde8b7f17175ba268d6293d0c05349d93a`
- App SHA-256: `0dd4ed77dc52731cf49e95033c6962ad371cec2c3db3cc1248d5fa71c6b03176`
- Auth SHA-256: `d2cfc4e447d23c2e6c164978221417a333764b33fd1dfea7cb1ae415b99118e6`
- Styles SHA-256: `644548c5ff24b3b357c4194b97e56ce8525feab59b0f4914e3bf9779099e00fe`
- WordPress route SHA-256: `e673ed291b5fc070330d3c3b30a7ff7b267a7d8ce46f98ab9db8a8f854553925`
- Generated release PHP SHA-256: `3afec2a55716420b616d4dabd4c35baed741e2e88a219592f0690235d940b147`

The later commits are backend-only transcript safety changes. The current Railway runtime is deployment `80e39e8e-954f-4964-9bfc-6b7c98fac1a4`, built from the final backend source at `eb02a91`.

## Authority conclusion

The student and Founder paths were not serving different static product generations. They received the same canonical application bytes. The observed voice difference came from capability scope, not UI release drift. The Critical Systems manifest remains deliberately unamended because B1-510I permits its release-identity update only after the real production voice acceptance gate succeeds.
