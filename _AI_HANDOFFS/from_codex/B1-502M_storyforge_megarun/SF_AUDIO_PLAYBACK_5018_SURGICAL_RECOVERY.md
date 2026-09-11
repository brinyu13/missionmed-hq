# SF-AUDIO-PLAYBACK-5018 — StoryForge recorded-audio surgical recovery

## 1. RESULT

**DEPLOYED — FULLY VERIFIED**

Recorded StoryForge audio now plays through the existing student and bounded administrator-subject paths. The repair was limited to one database projection function and one existing API transaction option. No frontend, WordPress, Matrix, identity, role, enrollment, story, or audio row was changed.

Production acceptance used Alejandra Baez's existing verified recording for story `5d94c425-f8aa-415f-8cc4-8fd015643c23`, audio asset `5b029331-fccc-4d22-a4b8-d539f65d5c65` (WebM, 2,548,795 bytes, 158,500 ms). In the real administrator subject view the player advanced, completed at `2:39 / 2:39`, and replayed. A fresh legitimate signed student token for the same student received HTTP 200 from the playback API and a real byte-range request to the signed R2 object returned HTTP 206.

## 2. Exact root cause

There were two consecutive, independently proven seams:

1. `public.sf_admin_subject_story(uuid,uuid)` did not project `audioAssetId` or `audioDurationMs`. The admin UI therefore truthfully rendered the recording as unavailable even though the verified audio object existed.
2. Once the projection was fixed, `GET /api/audio/:assetId/playback` performed its asset lookup with the ordinary identity transaction. A canonical WordPress administrator can have a historical/student base role; without the already-supported bounded `adminMode`, RLS correctly hid the student's audio row and the route returned private 404. Railway emitted `unauthorized_denied` for the real asset, proving the rejecting layer.

The student path itself was healthy before the change: a legitimate signed student could obtain HTTP 200 from the playback API and HTTP 206 from the signed R2 object. This ticket preserved that path.

## 3. Surgical fix

### Runtime implementation

- `storyforge-v5/infra/postgres/migrations/20260911030000_sf_audio_playback_admin_projection.sql`
  - Replaces only `public.sf_admin_subject_story(uuid,uuid)`.
  - Adds a lateral lookup for the newest verified audio asset whose `story_id` and `student_id` both match the already-authorized story.
  - Projects only `audioAssetId` and `audioDurationMs` into the existing bounded admin story response.
  - Preserves the prior function boundary, `SECURITY DEFINER`, search path, observability predicate, audit event, and exact ACL: `authenticated` may execute; `anon` and `PUBLIC` may not.
  - SHA-256: `0ae478be4060ce0f0ad93e62745e2d91f2b0b414e7cc6e5932736e0b0baaec53`.
- `storyforge-v5/server/app.mjs`
  - The existing audio playback row lookup now passes `{ adminMode: identity.wordpressAdmin === true }` to `withIdentity`.
  - `withIdentity` already rejects admin mode unless the JWT has verified `wordpress_admin=true`; database admin mode still requires the admin console, an in-scope student, and an observable non-private story.
  - Ordinary student requests continue with `adminMode=false` and owner-only RLS.
  - Final SHA-256: `5f38fd584007df440636c6faa1c27932e1822b96e097e622d9a86c601420a293`.

### Tests and harness registration

- Registered the additive migration in the existing local, PostgreSQL, e2e, integration, and conformance runners.
- Extended the PostgreSQL admin-subject test to prove projection, ACLs, private-story denial, unrelated-admin denial, and direct audio-row RLS.
- Extended the admin e2e story view to prove enabled playback and advancing time.
- Extended the route unit test with the production-shaped canonical admin/student-base-role identity and asserted `adminMode=true` plus preserved actor/subject separation.

## 4. Before/after proof

Before:

- Verified audio row and R2 object existed.
- Legitimate student: playback API 200; R2 range 206.
- Administrator subject response omitted audio identity and duration; disabled `0:00 / —:—` player.
- After exposing the projection, the real admin playback request returned 404 and logged `unauthorized_denied`, proving the second seam.

After:

- Administrator story response contained the exact verified asset and 158,500 ms duration.
- Real browser showed `Play original audio` and `0:00 / 2:39`.
- Playback advanced to `0:06`, completed at `2:39 / 2:39`, and replayed to `0:01` before being paused.
- Railway logged `audio_playback_granted` with distinct actor `09c3b822-75e7-4f3f-bd3f-58afc0865a78` and student subject `15d353e4-90cf-4cdc-94f4-2cde5906d4af`.
- Fresh signed student session: session 200, role `student`, stable subject matched; playback 200; R2 byte range 206 with `Content-Type: audio/webm` and `Content-Range: bytes 0-1023/2548795`.
- Railway separately logged student `audio_playback_granted` with actor and student both `15d353e4-90cf-4cdc-94f4-2cde5906d4af`.

## 5. Security and denial proof

- Canonical admin playback requires a valid signed token with `wordpress_admin=true`; the client cannot opt into admin mode.
- The existing admin transaction gate, feature state, student population scope, story observability, and RLS policies remain authoritative.
- A private story remains unavailable even to the new admin playback branch.
- A legitimate student remains owner-only.
- Production cross-student audio direct-ID probe returned private HTTP 404 / `P0002`.
- Production anonymous session returned HTTP 401.
- Production invalid-token session returned HTTP 401.
- No RLS policy, table grant, routine grant, table, row, identity, role, enrollment, or audio object was widened or mutated.
- Postdeploy database counts match the predeploy snapshot: 441 users, 115 stories, 26 audio assets, 75 policies, 88 public tables, 87 RLS-enabled tables, 62 forced-RLS tables, 703 table-grant rows, and 572 routine-privilege rows.
- Function privileges are exactly: authenticated `true`, anon `false`, PUBLIC `false`.

## 6. Full verification

All gates ran from clean commit `4c1978d8089d163f04fa210f4436142b332b74c0` unless noted.

| Gate | Command / evidence | Result |
|---|---|---|
| Unit | `npm test` | PASS — 503/503 |
| PostgreSQL 18 / RLS | `STORYFORGE_PG_BIN=/opt/homebrew/opt/postgresql@18/bin npm run test:postgres` | PASS — 37/37 primary; 140/140 reconciliation/survival |
| Full e2e | `npm run test:e2e` | PASS — 98/98 |
| WordPress integration | `STORYFORGE_EXPECTED_COMMIT=4c1978d... STORYFORGE_PG_BIN=/opt/homebrew/opt/postgresql@18/bin npm run test:integration` | PASS — 8/8; release provenance and secret scan passed |
| Product conformance | `STORYFORGE_EXPECTED_COMMIT=4c1978d... STORYFORGE_PG_BIN=/opt/homebrew/opt/postgresql@18/bin npm run test:conformance` | PASS — 72/72 desktop/tablet/mobile/accessibility |
| API package | `npm run build:api` | PASS |
| Syntax | `node --check server/app.mjs` plus migration execution in PostgreSQL harness | PASS |
| Diff | `git diff --check` | PASS |
| Restore rehearsal | PostgreSQL 18 full dump restore, migration apply, predecessor-function restore | PASS; both function hashes exact |

Final integration evidence:

`storyforge-v5/.local/integration-evidence/run.4c1978d8089d163f04fa210f4436142b332b74c0.6c9188cc-5d5e-492d-af80-c35aaedabe2f`

## 7. Git state

- Worktree: `/Users/brianb/MissionMed_worktrees/SF-AUDIO-PLAYBACK-5018`
- Branch: `codex/sf-audio-playback-5018`
- Base: `6d5a5601b387b7ab7afadb0ba75da8b0533e98f0`
- Projection/test commit: `e64bcea29db48a69782bd909f1d3f633c92cdc06`
- API authority/test commit: `4c1978d8089d163f04fa210f4436142b332b74c0`
- The protected `/Users/brianb/MissionMed_worktrees/B1-StoryForge-502` worktree was not read from, modified, cleaned, reset, stashed, staged, or used as a deployment source.

## 8. Production predecessors and rollback

Private recovery directory: `/Users/brianb/MissionMed_recovery/SF-AUDIO-PLAYBACK-5018.aykOr0`

| Artifact | SHA-256 | Bytes | Owner / mode | Captured UTC |
|---|---|---:|---|---|
| `storyforge-production-pre-audio-fix.dump` | `530df2372f13874ab6f2ef7445e8f3113313a262f10f4f93c75c814afab98812` | 1,562,905 | `brianb:staff` / `0600` | 2026-09-10T23:23:06Z |
| `sf_admin_subject_story.pre.sql` | `5f353b06238aa079d17c90fd9c23c64c12f4d50d8cd5a8ca5ce84ff7513c1f0c` | 5,899 | `brianb:staff` / `0600` | 2026-09-10T23:23:07Z |
| `storyforge-api-predecessor-6d5a5601b387.tar.gz` | `4fdd5cccd3404025cf10effc620c532b934af9a590c6d5dca803abd5d9fafd9a` | 2,161,286 | `brianb:staff` / `0600` | 2026-09-10T23:35:14Z |

Predecessors:

- Database function MD5: `73a511689a238923b4b87a68c09e9a7a`.
- API deployment: `01308d3b-6a91-4b4b-aced-0eb9e98b2ef8`.
- API image: `sha256:99ca9c08db8b46c450bf67d4b227593a457ed32e19e572e63b2443d8a953591f`.
- Predecessor application source SHA-256: `ee4676dca602206cedc75413c7ea60dd018879c1b119d5a4ca761c941539c2fa`.

Rollback was not invoked. If required, redeploy the private predecessor API archive to the exact API service, then restore the captured predecessor function in an advisory-locked transaction and remove only the exact migration ledger row after verifying its version, hash, backup ID, and commit. The full database dump is an additional recovery layer. The restore path was rehearsed before production mutation.

## 9. Deployment

### Database

- Railway project: `875e7c17-d06f-4301-a4bb-e61016f153cf`
- Production environment: `bcef8734-e42b-44df-8488-c2a3de68213f`
- PostgreSQL service: `a4a66362-c3ba-475a-ae21-2aa46624bafe`
- PostgreSQL: 18.6 over TLS; system identifier `7667256745042145332`
- Applied: 2026-09-11T03:25:54.296656Z
- Mechanism: advisory-locked, single-transaction migration with exact pre/post assertions and serialized migration ledger write.
- Ledger version: `20260911030000`; backup ID `13c1c1ac-a017-41de-bed3-7af8cf8080c9`.
- Live function MD5: `d4706ac75a7ccf6242e233eb85903423`.

### API

- Service: `dab015bf-15ef-4698-9f16-cbf8cf23de7a`
- Public provider domain: `storyforge-v5-api-production.up.railway.app`
- Deployment: `f8c48798-6b35-46bb-806d-0e2a166ef277`
- Created: 2026-09-11T03:50:25.123Z
- Status: SUCCESS
- Image: `sha256:6d485a80f5d26db57167586e40a71ded9ad41fe25db5eb41b191e0dd9255b102`
- Mechanism: clean local upload of the self-contained `storyforge-v5` API package to the exact production service; no static/WordPress/Matrix deploy.

## 10. Stability and blast-radius proof

- Public `/storyforge/healthz`: HTTP 200 before and after; `no-store, private` retained.
- Direct Railway `/healthz`: HTTP 200.
- Anonymous `/storyforge/api/session`: HTTP 401.
- Invalid token: HTTP 401.
- Runtime logs contained three expected playback grants (admin completion/replay and student canary), no attributable exception, crash, fatal, or 5xx. One `errorCategory=auth` entry is the deliberately executed cross-student denial canary.
- WordPress StoryForge SSO remained byte-identical at SHA-256 `f3d34519f78cda688e4225cefb6ce9e1432fb7f3d4e9a28a490baae29c79f5c7`, owner/group `theresidencyacademy:www-data`, mode `0444`, 31,626 bytes.
- Frontend remained byte-identical and was not deployed:
  - app `6bc7f9341a22` / SHA-256 `6bc7f9341a2232723269f00df910f00e402cbdee39e15d0b5335d82e21ce7a62`
  - auth `d2cfc4e447d2` / SHA-256 `d2cfc4e447d23c2e6c164978221417a333764b33fd1dfea7cb1ae415b99118e6`
  - styles `03dfd2fc42f0` / SHA-256 `03dfd2fc42f0a80d9adf01805be094383421333e19c6fa62e4c6d9436e999409`
- The 12-student live directory still included Ruqayyah Jukaku; no roster mutation occurred.
- LearnDash, WordPress roles, StoryForge identity rows, enrollment state, stories, audio rows/objects, MyERAS, Request a Story, and unrelated products were not changed.

### Matrix protected runtime

The Matrix guard continues to report the same pre-existing unrelated manifest drift and missing local protected source that existed before this ticket; no override was invented or used. The exact production hashes remained byte-identical:

- `student_os_js`: `38507e1ac8a555baa4eca6015c8cefd014e414a2d3159929f3cd451a47ad937a`
- `student_os_css`: `707ab52f7157db618be307f83548b2410d5cdb82359fc6c0f47025996c275260`
- `class_mmed_student_os_php`: `b3f797c7ef5ff1ebadd6b482aa95f283273201d536ad5749c83926e96c4ac02d`
- `calendar_v4_js`: `6a1ca3d7e4b955ea4cbea13f956b08f1533b638264d94c11ded5ead6703cb480`
- `calendar_v4_css`: `b6a858491aade89770383b498433578a657d87b71d738dc71b49c216f420598e`
- `storyforge_js`: `a4aa9665012206771fc8549c897cb5d22801899347c706626062dbafb29c81fa`
- Already lock-exact assets also remained exact: scheduler `2a47b847...`, File Vault JS `f1639c41...`, File Vault CSS `6daeaf25...`, StoryForge CSS `5b0426a7...`.

No `wp-content/plugins/missionmed-hub/**` file appears in the diff, and no Matrix source, public asset, lock manifest, or guard was modified, staged, copied, deployed, restored, or refreshed.

## 11. Final production state

Production is live on the verified database projection plus API deployment `f8c48798-6b35-46bb-806d-0e2a166ef277`. Student self-playback and bounded canonical-admin subject playback both work against the real signed storage object. Existing private-data, RLS, authentication, actor/subject, and feature-state boundaries remain fail-closed.

## 12. Residual uncertainty

No repair-related uncertainty remains from the executed acceptance matrix. The unrelated pre-existing Matrix lock drift remains a separate governance item; its protected production bytes did not change during this ticket.
