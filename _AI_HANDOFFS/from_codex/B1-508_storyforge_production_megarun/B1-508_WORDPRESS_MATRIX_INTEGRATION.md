# B1-508 WordPress and Matrix Integration

## Published state

- Live path: `https://missionmedinstitute.com/storyforge/`
- Kinsta source: `releases/97ebf2433849343acd521547e558a9713c579eb0`
- Release: `v-a9a076957973d7d4`
- Route SHA-256:
  `8426f705d4270abf45663868a501020d9c338cea80a186d350e3031edfa57476`
- Runtime SHA-256:
  `30fc0e380be9704ff3d52a8f3827edf4d578c1c7bb95e933a4ab21e268e11d9a`
- Index SHA-256:
  `5a5dd91609588f231310fb23df836dba9e4adaf9587d22986a9dbe476430fe1f`
- App SHA-256:
  `fded51e056c6a2c16b01c718bf2fa1f43aa4a45fb8ca2d48e8263a6e81d60827`
- Auth SHA-256:
  `d2cfc4e447d23c2e6c164978221417a333764b33fd1dfea7cb1ae415b99118e6`
- Styles SHA-256:
  `644548c5ff24b3b357c4194b97e56ce8525feab59b0f4914e3bf9779099e00fe`

Route/release files are mode `0444`; release directory is `0555`. The accepted
one-Founder WordPress settings were restored exactly after each drain:

- StoryForge enabled: true.
- Allowed users: 1.
- Role overrides: 1.
- Effective role: student.
- Cohorts: 0.
- JWT TTL: 60 seconds.

## Verified behavior

- `/storyforge/healthz`: 200, SHA-256
  `2f38f3be19943c2944d3e99280492a34e41db80ed0ce5064ae2c660896e24d86`.
- `/storyforge/`: 200 and exact index hash.
- `/storyforge/api/config`: 200, MissionMed signed-JWT mode, no dev auth, no
  audio, all AI flags false.
- Extensionless immutable assets pass exact hashes.
- Raw extension-bearing asset paths and index alias remain denied.
- API responses are private/no-store.
- WordPress performs the same-origin JWT/bootstrap bridge and bounded API proxy.
- Existing multipart and DELETE gateway controls retained their tests.
- Provider cache was cleared using MyKinsta after the host helper failed.
- `missionmed-hub` protected StoryForge assets were untouched.

The host `wp` CLI sometimes exited 139/255 after an option update. Independent
readback proved each exact option value. This did not affect the published
route or release and is documented as host CLI instability, not application
success inferred from exit status.
