# I1Q-1007X Protected Consumers Matrix

## Baseline Rule

This is a pre-mutation matrix. No protected consumer was edited, deployed, migrated, or activated. DR-006 is recorded as REVIEWED CANDIDATE, CANONICAL MERGE PENDING at assignment time. MissionMed OS main 93c0404 later showed the candidate merged unchanged; Root acceptance and all release certification remain outside this mapper's authority.

## Consumer Matrix

| Consumer | System owner | Runtime/data authority | Current coupling to I1Q | Protected status | Safest backward-compatible adapter | Minimum baseline before shared mutation | Current verdict |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Matrix | Matrix; delegated runtime lock | Matrix Runtime Lock Protocol and Manifest; Matrix passport | No direct I1Q consumer. Shares WordPress identity, Kinsta estate, and global release risk only. | Protected active delegated lock | None in this wave. Any future link requires a separate Matrix decision and manifest registration. | Guard preflight; exact asset hashes; dashboard, calendar, scheduler, filevault, messages, storyforge App Mode smokes; Return to Matrix Dashboard; rollback hash proof | UNTOUCHED; no adapter authorized |
| Arena | Arena | Arena passport; Critical Systems Manifest; MR-078B | Authenticates through HQ/RANKLISTIQ; routes to STAT and Daily; reads drill controls. | Legacy protected | Do not edit Arena for I1Q. Publish only an additive STAT dataset release or read-only Drills sidecar after each owner certifies it. | Static deploy validator; authenticated entry; RANKLISTIQ pin; no signUp/service-role exposure; avatar/profile hydration; /stat and /drills?entry=daily_rounds; browser console; rollback | ACTIVE AND UNCHANGED |
| STAT | STAT | STAT_CANON_SPEC; MR-078B; DR-006 | Future consumer of exact I1Q nine-field dataset rows. Existing sealed duel and telemetry runtime remains separate. | Frozen protected contract | New server-side dataset version and release projection. No active v4 mutation, pack rewrite, answer_map exposure, client fallback, or historical-attempt rewrite. | Exact nine fields; fixed SHA-256 vector; exact pack owner ruling; choice order; participant gate; pre-answer answer/explanation absence; post-finalization answer only; old-attempt and metadata joins; Arena route; rollback | FLAG OFF; owner ruling required before integration |
| Drills | Drills and existing MMVS ingestion owner | DR-006; Drills current API contract; HTML Deployment Lock | Future sidecar consumer. Current runtime loads playback or stream ID, required nodes, and optional transcript from /api/drills. | Ingestion ownership protected | Add I1Q-owned read-only projection keyed by stable video_id and explicit playback, transcript, VTT, and nodes availability. Never alter registry ingestion. | GET array contract; duplicate IDs; host allowlist; playback adapter; required nodes; explicit optional transcript; flat/wrapped node normalization; transcript wrapper normalization; launch and return; no source mutation | FLAG OFF; 5ae58b0 artifact incompatible; 4724a24 adapter repair passed direct tests but lacks integration and owner certification |
| Daily Rounds | Daily surface with Drills/Arena integration ownership; distinct human owner not found | DR-006; Arena route contract; HTML Deployment Lock | Reads MMVS registry and RANKLISTIQ drill_registry_control; requires video_id, title, playback_url, nodes_url, transcript_url; launches Drills. | Protected shared runtime | Reuse the Drills owner sidecar and existing launch contract. Do not add an I1Q write path or duplicate registry rows. | Five required fields; active filter; credentials/cross-origin behavior; selected drill payload; /drills?video_id launch; /drills?entry=daily_rounds entry; Arena return; rollback | NO I1Q CHANNEL ACTIVE |
| MissionMed HQ | HQ | Critical Systems Contract and Manifest; HQ passport | Required canonical session and identity bootstrap for the dedicated internal app. | Protected active Railway runtime | Root-owned app-specific session introspection or isolated route after shared auth repair; app-owned role/assignment mapping. | Missing-secret hard fail; expiry/revocation/fixation; cookie/bearer parity; CSRF; CORS allowlist; WordPress outage; Supabase outage; logout; logs contain no tokens | REQUIRED DEPENDENCY; not ready for I1Q |
| WordPress auth relay | WordPress and HQ | MR-078B; DR-006 | Signed 60-second handoff and first-party /api/auth proxy. | Protected | Reuse unchanged. Add app audience/final route only through Root review; do not widen global accepted roles. | Logged-out redirect; signature tamper; expiry; nonce replay; return/final host allowlist; cookie forwarding; Set-Cookie forwarding | ACTIVE SHARED DEPENDENCY |
| RANKLISTIQ | Arena/STAT data plane; Root migration owner | MR-078B; Critical Manifest; DR-006 | Authorized home of additive i1q schema and canonical Supabase Auth identity. | Protected shared datastore | New MR-078A-compliant migration plus server repository with trusted transaction-local actor and assignment roles. | Preview migration; project pin; forced RLS; anonymous, cross-role, cross-assignment, GUC-spoof, pooled-connection tests; immutable records; rollback/reapply; Arena/STAT regression | TARGET AUTHORIZED; route and implementation absent |
| Growth Engine | HQ/Growth data owner | MR-078A/B | Owns CRM/media and contract-listed drill tables; root migration directory targets it. It is not the I1Q schema target. | Protected and migration-history desynchronized | Existing owner read APIs only. Never route I1Q SQL here because the local directory happens to exist. | Project pin; migration list/history reconciliation; no RANKLISTIQ object assumptions | NO I1Q WRITES |
| MMVS drill API | MMVS/Drills ingestion owner; named human owner not found | DR-006 read-only source authority | Canonical current source for Drills and Daily. | Read-only source for I1Q | Inventory, hash, and fetch only; persist derived lineage in i1q. | GET-only; content schema; duplicate/empty IDs; hash; URL reachability; no PUT/PATCH/DELETE | 97 real rows inventoried |
| CIE/HQ Media | HQ Media Engine and CIE | HQ runtime; MR-078B media ownership; DR-006 | Optional authenticated media metadata and transcript chunk route. | Protected | Owner-provided read endpoint or static export; never use mutation routes. | Auth gate; health/list/detail; transcript chunk authorization; no favorite/rate/tag/playlist/clip/upload calls | PATH EXISTS; not wired to I1Q |
| Stream and R2/CDN source objects | Media owner; Root controls runtime deployment | DR-006; HTML Deployment Lock | Playback and source artifact delivery; CDN also serves protected runtime HTML. | Protected | Source metadata and GET only during corpus work. Runtime upload only via canonical GitHub route. | Host, MIME, length, hash, no mutation; for deploy: staging checksum, wrapper smoke, cache and rollback proof | NO I1Q DEPLOYMENT |
| Transcript, VTT, nodes | Media/Drills owner; Privacy Owner processes | DR-006; 1004C privacy gates | Restricted source for privacy-safe derivation. | Restricted | Restricted fetch -> hash -> speaker classification -> redaction -> privacy-safe normalized working transcript. | Student-name recall, patient recall, third-party removal, speaker attribution, timestamp coverage, no raw logs, rights state | 97 transcript JSON and 97 nodes JSON available; all 97 source-level verified_drj; 96 only potentially eligible after every privacy gate; one generic source is zero-retention; VTT not observed; zero privacy-safe working transcripts |
| MissionMed Drive | File owner and Privacy Owner | DR-006 for authorized MissionMed corpus files | Optional source only. | Read-only if explicitly allowlisted | File-ID allowlist with owner, rights, MIME, and hash evidence. | Access scope; ownership; rights; MIME/hash; privacy normalization | No additional corpus found; absence not proven |
| Legacy v4 and attempt joins | STAT | DR-006; STAT Canon; MR-078B | Read-only hashed reconciliation, duplicate mapping, replacement, and retirement planning. | Immutable | Reconcile owner-approved static and CDN exports as separate immutable collections, then map with composite dataset_version plus question_id. Never silently join on question_id alone. | Row count/hash; no source write; collision map; old attempts; sealed packs; question_metadata version identity | Sanitized evidence: 845 static v4 rows and 3,961 CDN runtime IDs, zero overlap; no import or production DB access; historical attempt-join proof still absent |

## Shared Baseline Commands And Evidence

| Baseline | Existing path or command | Mapper result |
| --- | --- | --- |
| I1Q unit/API/static suite at 5ae58b0-era snapshot | npm test in i1q-question-platform | PASS, 30 of 30 |
| Adapter/security direct suite after 4724a24 | node --test with the tracked test set | PASS, 34 of 34; this is not protected-consumer or integrated release certification |
| Protected HTML static contract | bash VALIDATION/validate_deploy.sh | PASS |
| Evidence validator | npm run validate in i1q-question-platform | FAIL, target file missing |
| Matrix guard | /Users/brianb/MissionMed/_SYSTEM/tools/matrix_runtime_guard.py | Not run because no Matrix path was touched |
| Critical systems gate | /Users/brianb/MissionMed/_SYSTEM/tools/critical_systems_gate.py | Not run because no protected path was touched |
| Live consumer smokes | VALIDATION/validate_runtime.sh plus browser journeys | Not run |
| Supabase RLS/migration | Preview RANKLISTIQ environment | Not run; no canonical migration route |
| Rollback/reapply | Canonical GitHub route | Not run |

## Contract Collisions Requiring Owner Ruling

| ID | Collision | Required owner |
| --- | --- | --- |
| PC-01 | STAT Canon requires exactly seven get_duel_pack fields, while the tracked SQL returns status, a broad duel object, and questions; current client normalizes additional fields. | STAT owner and Root architect |
| PC-02 | STAT Canon requires client hash recomputation, while MR-078B says content_hash is never recomputed client-side. | STAT owner and authority maintainer |
| PC-03 | DR-006 requires exact nine-field dataset rows and composite metadata identity, while current public.question_metadata uses question_id alone as primary key. | STAT/Data owner |
| PC-04 | MR-078B assigns drill_registry to Growth Engine, while current Arena/Daily are pinned to RANKLISTIQ and the current MMVS /api/drills path is a separate Railway source. | Drills ingestion owner, Data owner, Root |
| PC-05 | 1004C deferred Daily Rounds, while later DR-006 recognizes a future Daily channel. | Question Platform architect and Daily owner |

## Proposed File Ownership

| Change class | Proposed owner | Files |
| --- | --- | --- |
| I1Q projection adapters | Adapter and Identity Implementer | i1q-question-platform/src/contracts.mjs, exports.mjs, new adapters files, new adapter tests |
| I1Q auth/release controls | Auth and Release Security Implementer | i1q-question-platform/src/auth.mjs, server.mjs, platform.mjs, new security tests |
| Privacy normalization | Privacy Normalization Implementer | privacy.mjs, pipeline.mjs, new privacy tests |
| Evidence validator | Evidence Validator Implementer | new validate-evidence.mjs and new validator tests/fixtures |
| Canonical repository and SQL design | Architecture and Data | New I1Q-owned repository files and a new migration candidate |
| MissionMed OS, HQ, WordPress, shared SQL, protected consumers, workflows, deployment, flags | Root Supervisor with each system owner | Root-only; no implementation agent writes these paths without a new decision and ownership row |

## Release Position

No protected consumer can be activated from this baseline. Internal engineering and privacy-safe inventory may continue. Security, UX, auth, datastore, privacy, dependency, staging, rollback, monitoring, and dependent-product evidence must converge on one fixed commit before Root requests consumer-owner certification.

The worktree was concurrently advancing during this map. Commit 4724a24 added adapter files and direct tests, while auth, server, privacy, and pipeline repairs were later observed in flight. Those changes were inspected read-only and are not promoted by this report.
