# B1-511 Canonical Baseline and Scope

## Locked canonical production baseline

Captured before any B1-511 product-source edit on 2026-08-05.

| Item | Locked value | Evidence |
|---|---|---|
| Canonical URL | `https://missionmedinstitute.com/storyforge/` | Live HTTP and authenticated browser |
| Product source commit | `6efc0868036fde193b0b36504976cf5f32f525ca` | B1-510K final handoff and Git history |
| Deterministic release commit | `4e9472bc21f0ceeaeb67f7f0276b0c7d8339e981` | B1-510K final handoff and Git history |
| Release ID | `v-cf6c4b91bad6ac65` | B1-510K final handoff |
| Kinsta immutable pointer | `releases/4e9472bc21f0ceeaeb67f7f0276b0c7d8339e981` | B1-510K final handoff |
| Railway deployment | `0b64c2fc-9292-4d1a-9469-94f21b1a1ca4` (`SUCCESS`, one replica) | B1-510K production evidence |
| Critical Systems | `112 PASS / 2 known WARN / 0 FAIL` | B1-510K final handoff |
| Provider boundary | OpenAI; `gpt-4o-transcribe` primary, `whisper-1` fallback | B1-510K production evidence; names only |
| Audio assembly | `concat` | B1-510K production evidence |
| Reconciliation | `off` | B1-510K production evidence |
| Voice force-off | `0` | B1-510K production evidence |
| Transient recording state | 0 DB segments, 0 open sessions, 0 transient R2 objects | B1-510K production evidence |
| HTTP 5xx baseline | 0 after accepted B1-510K deployment | B1-510K production evidence |

Current accepted source hashes:

- `public/index.html`: `f22b076b31adba2fb1e11a679efbca2e0fb87f33319e94235ed1ed0a507c630a`
- `public/app.js`: `ff59780717606db2d27f5d67d5ff31ecfda3a45983fa30f75f545ee6b7dbef0a`
- `public/auth.js`: `d2cfc4e447d23c2e6c164978221417a333764b33fd1dfea7cb1ae415b99118e6`
- `public/styles.css`: `9523b523ddf192d01bdc24fc4d302ffac23998de9230b72459f30091c40d5da0`
- `public/missionmed-logo.png`: `f091d62ac5842cde0e9e455321839fd98b291598478aae6ce13b09ea3896ff56`
- WordPress route source: `e99a7f82b156962cb6f253a0b28f9a520cc87915288247ce6e1c3e40a05e34c1`
- Generated runtime bundle: `15ecc508346fb65743190093315b2267246c79afe862e9734016249f3cfea610`

The canonical V5 authority hash remains
`3ac2871ff286552abe89a785ff43967df3315922e3718f67a136b83db1ba8db1`.

## Live read-only baseline observation

The live route returned HTTP 200 with `x-storyforge-route: wordpress-gateway`,
`cache-control: no-store`, `x-robots-tag: noindex, nofollow, noarchive`, CSP,
same-origin framing, and microphone permission restricted to self.

An existing eligible-student Chrome session reached the canonical application,
showed the current dark MissionMed shell, Student View, Home, Library, private
story status, current filters, and the existing priority meter. No production
mutation was performed. Because the authenticated pages contain real private
student material, screenshots are stored outside Git with mode `0600`:

- `/Users/brianb/MissionMed_private_backups/B1-511/AUTHENTICATED_BASELINE/student-home-live.png`
  SHA-256 `8a566b5dfa9f789af75cfb0f17290c81a4dae356be11cf577e20d8d30bd669a9`
- `/Users/brianb/MissionMed_private_backups/B1-511/AUTHENTICATED_BASELINE/student-library-live.png`
  SHA-256 `1af25dc3df1ca92e32ce0e3967d03184419a0f3b858b2fc324747a03448e0eb0`

A current Founder-admin browser session was not available at baseline capture.
The accepted B1-510I administrator-console evidence is retained as the baseline
for that role; a fresh Founder canary remains mandatory before activation.

## Existing boundaries locked unchanged

- WordPress session, nonce, JWT, identity sync, first-name bridge, and LearnDash
  entitlement logic.
- One canonical frontend release for students and administrators.
- Private-by-default stories and explicit submission boundary.
- PostgreSQL transaction identity, least-privilege role, RLS, direct-ID denial,
  bounded SECURITY DEFINER administrator functions, and append-only audit.
- Student recording/transcription/original-audio/replay implementation and R2
  namespaces.
- Learning Lesson, current voice population, provider/model choice, audio
  assembly, reconciliation, Matrix routing, branding, and reduced motion.

## Accepted B1-511 change budget

Every product change must map to one of the following. Category `F` is not
authorized.

| Planned file or class | Class | Smallest authorized purpose | Locked behavior / rollback |
|---|---|---|---|
| `infra/postgres/migrations/20260805*_b1_511_*.sql` | C | Add bounded categories, expanded uses, feature flags, concurrency-safe mutations, mentor-note lifecycle/RLS | Additive only; disable flags and leave schema dormant |
| `server/admin-console.mjs` | A | Extend existing bounded submitted-story review/search/taxonomy surface | Preserve existing admin capability and denial model |
| `server/mentor-notes.mjs` | A | Isolated mentor-owned note/media orchestration | Separate namespace; feature force-off rollback |
| `server/app.mjs` | A | Add bounded routes and optional projections | Existing routes and response meanings remain compatible |
| `public/app.js` | A | Extend the sole renderer with exact categories/uses, priority row update, stable search, submission/admin/mentor-note controls | No second renderer; prior release pointer restores frontend |
| `public/styles.css` | A | Namespaced component styles only | No global token/layout/motion change |
| focused unit/PostgreSQL/E2E tests | B | Prove contracts, privacy, focus/no-rerender, and failures | Tests do not alter runtime |
| local migration harness lists, only if required | B | Include additive migrations in ephemeral verification | No production runner change unless separately proven necessary |
| deterministic `dist`, alias manifest, and runtime bundle | D | Generate exact candidate from committed source | Atomic pointer remains on prior release until promotion |
| B1-511 handoffs, receipts, manifests, screenshots | E | Evidence, rollback, and differential proof | Documentation only |

Files not named by this ledger may change only if a failing focused test proves
that exact file is necessary and the justification is added before the edit.

## Authorized feature partitions

1. Submission/review workflow.
2. Existing administrator workflow extension.
3. Categories and intended-use editing.
4. Inline student priority editing.
5. Search autocomplete.
6. Mentor text/voice notes.

Each new lane must fail closed and remain independently disableable. Product
implementation does not authorize deployment. Remote custody, fresh backup,
restored-database proof, Critical Systems zero failures, Founder canary, and the
three-stage release ladder remain mandatory.
