# SAGAN Wave 1 Authority, Provenance, and Truth Audit

Ticket: `B1-502M`

Observed: `2026-07-27`

Scope: local evidence in `/Users/brianb/MissionMed_worktrees/B1-StoryForge-502`
and read-only MissionMed authority sources. No production endpoint, provider,
remote Git service, or private production data was contacted.

## Classification key

- `VERIFIED`: directly established from a current local file, hash, Git object,
  or command result in this run.
- `INFERRED`: a reasonable conclusion from verified local evidence, but not
  direct current production observation.
- `STALE`: once useful evidence whose observation date or governed version is
  not current enough to prove the present production fact.
- `CONFLICTING`: two or more sources prescribe or report materially different
  facts.
- `UNRESOLVED`: the required canonical evidence is absent or was not inspected.

## Executive verdict

`VERIFIED`: The V5 implementation lineage is locally coherent and hash-pinned:
the canonical V5 HTML hash is
`3ac2871ff286552abe89a785ff43967df3315922e3718f67a136b83db1ba8db1`,
the B1-501 integration commit is
`5ba56c7e3dd4f251ef4fc66c9de5fc4300c8acbc`, and the B1-502 evidence-only
commit is `e76193176e50fa0f0c329b40017c3e48b94510ef`.

`UNRESOLVED`: The current production revision, canonical deploy branch,
StoryForge application origin, edge owner, WordPress plugin deployment
mechanism, database project, founder identifier, production restore points,
and provider revisions are not proven by the local authority set.

`STALE`: MissionMed OS `CURRENT.md` was generated
`2026-07-22T08:55:20-04:00`, five days before this audit, and has no B1-502M
mission.

`CONFLICTING`: The active local Matrix lock governs the legacy
`/member-dashboard/#storyforge` Runtime V2 shell, while the founder-authorized
B1-502M target is same-origin `/storyforge/` for V5. The founder prompt resolves
the desired product decision, but it does not prove the route exists or identify
the current runtime owner that will serve it.

`VERIFIED`: Current protected authority does not register V5 `/storyforge/*`,
its application origin, database, feature flag, founder cohort, browser
journey, or rollback path. The Critical Systems contract explicitly says a new
route or app is not deployable until those entries exist.

Sagan therefore classifies Wave 1 as **not yet mutation-ready, but locally
resolvable through direct evidence and normal authority repair**. A stale
document alone is not a permanent blocker; it must be repaired from the
canonical evidence listed below.

## Authority chain audit

| Source or fact | Classification | Finding |
|---|---|---|
| `/Users/brianb/MissionMed_OS/BOOT.md` | VERIFIED | Version 1.1 requires resolution through `BOOT.md -> CURRENT.md -> missions.json -> products_index.json -> authority_index.json`, stops on stale current state or unresolved authority conflict, and requires protected work to remain local. |
| MissionMed OS repository | VERIFIED | Local HEAD is `f197c54a9d5b062fa3c8e773bc19c64de9dba6cb` on `main`. The checkout contains unrelated untracked authority/handoff directories and `.wrangler/`; it is not a clean filing surface. |
| `/Users/brianb/MissionMed_OS/CURRENT.md` | STALE | Generated 2026-07-22. It lists five active missions and no B1-502/B1-502M/StoryForge mission. |
| `/Users/brianb/MissionMed_OS/missions.json` | VERIFIED | Valid v1 registry with 26 missions. No StoryForge or B1-50x production mission exists. |
| `/Users/brianb/MissionMed_OS/products_index.json` | STALE | Updated 2026-07-22 from a source observed 2026-07-06. StoryForge is `protected_active_or_recent` with `passport_path: null`. |
| Matrix product passport | CONFLICTING | `products_index.json` points to `PRODUCT_PASSPORTS/matrix.md`, but that file is absent. The index therefore contains a dangling authority pointer. |
| StoryForge product passport | UNRESOLVED | No filed StoryForge passport exists in MissionMed OS. The older B1-304 passport is a `PROPOSED / NOT FILED` donor and describes V2 plus a local V3 candidate, not B1-502M V5. |
| `/Users/brianb/MissionMed_OS/authority_index.json` | VERIFIED | The active StoryForge-related entry is the Matrix Runtime Lock Protocol; the active Matrix manifest entry is also present. No B1-502M or V5-specific authority entry exists. |
| OS generation path | VERIFIED | `tools/mmos_status.py` is the normal writer for `CURRENT.md`; it writes generated state from `missions.json`, `products_index.json`, and the local worktree list. It must be run only after the registries are repaired. |
| OS lint state | CONFLICTING | `PYTHONDONTWRITEBYTECODE=1 python3 tools/lint_os.py` returned `FAIL`, entirely on dash findings in unrelated untracked handoff directories. This is not evidence that B1-502M fields are invalid, but it prevents an honest global OS lint PASS in this checkout. Use a clean authority worktree or first resolve the concurrent filing state without absorbing unrelated changes. |

## Protected runtime, manifest, and lock audit

### Matrix Runtime Lock

`VERIFIED`: The active manifest is:

`/Users/brianb/MissionMed/_SYSTEM/KNOWN_GOOD/MATRIX_RUNTIME_LOCK_MANIFEST.json`

It is marked `ACTIVE`, last updated `2026-07-15T11:43:51.670Z`, and records:

- production SSH alias `missionmed-kinsta`;
- plugin root
  `/www/theresidencyacademy_209/public/wp-content/plugins/missionmed-hub`;
- public asset base
  `https://missionmedinstitute.com/wp-content/plugins/missionmed-hub`;
- mandatory fresh backup before deploy;
- no broad cache purge;
- legacy StoryForge route
  `https://missionmedinstitute.com/member-dashboard/#storyforge`;
- legacy StoryForge JS hash
  `a4aa9665012206771fc8549c897cb5d22801899347c706626062dbafb29c81fa`;
- legacy StoryForge CSS hash
  `5b0426a7af9dbc36a1401c5d2829ca8cf7827e8070b783fbfe64875c847af7d8`.

`INFERRED`: Those are the strongest locally recorded production pins, but they
are not a current live observation from 2026-07-27.

`VERIFIED`: The manifest's current shell and PHP pins were updated by later CAM
work:

- shell `student_os_js`:
  `c1d97237eab4936d014ec00549deb2358a056d5b8f430fe7713f5dd2ac39e76a`;
- PHP `class_mmed_student_os_php`:
  `5ed6e92eb9bf748a01f475bc5a6a72e249e21a2b7560d07d2acf66f8058e8d95`.

`CONFLICTING`: The manifest names
`/Users/brianb/MissionMed_worktrees/b1-storyforge-advanced-102-live-matrix-source-export`
as a canonical worktree, but that checkout contains its entire
`wp-content/plugins/` tree as untracked material. Its legacy StoryForge JS/CSS
match the active pins, while its unversioned shell and PHP hashes do not match
the active July 15 shell/PHP pins. It is an evidence donor, not a clean
all-assets deploy source.

### Critical Systems Manifest

`VERIFIED`: The active Critical Systems manifest is dated
`2026-06-25T19:53:29Z`. It delegates Matrix to the Matrix lock and registers
only these StoryForge-relevant protected facts:

- Matrix owner and delegated lock;
- legacy `#storyforge` route in the Matrix browser journey.

`VERIFIED`: It does not register:

- V5 `/storyforge/*` or `/storyforge/assets/*`;
- a StoryForge application runtime owner or deploy artifact;
- the WordPress SSO plugin and token/bootstrap routes;
- an edge account, zone, worker, origin, or cache contract;
- a StoryForge Supabase/PostgreSQL project;
- `sf_*` tables, RPCs, migration history, or RLS pin;
- the `storyforge_enabled` feature flag;
- the exact founder cohort;
- the V5 browser journey;
- V5 restore points or rollback.

`VERIFIED`: The Critical Systems contract requires owner, runtime owner,
source-of-truth, routes/assets, dependencies, browser expectation, and rollback
before a new protected route can deploy. The missing entries are therefore
required registration work, not optional documentation.

## Git and implementation provenance

| Fact | Classification | Evidence |
|---|---|---|
| Current ticket worktree | VERIFIED | `/Users/brianb/MissionMed_worktrees/B1-StoryForge-502`, branch `b1-502-storyforge-production-deployment`. |
| Current local HEAD | VERIFIED | `e76193176e50fa0f0c329b40017c3e48b94510ef`, subject `B1-502: record blocked production deployment gates`. |
| B1-501 baseline | VERIFIED | `5ba56c7e3dd4f251ef4fc66c9de5fc4300c8acbc` is the direct parent of B1-502 and an ancestor of current HEAD. |
| B1-500 foundation | VERIFIED | `be43c6d0a4520ed761a3d112a25452f26683f9ca` is the parent of B1-501. |
| Repository | VERIFIED | Git common repository is `/Users/brianb/MissionMed/.git`; locally configured remote is `https://github.com/brinyu13/missionmed-hq.git`. |
| Release branch publication | UNRESOLVED | No local remote-tracking ref contains B1-502 HEAD. No remote network inspection was performed. A canonical push/deploy branch is not proven. |
| Canonical product HTML | VERIFIED | Required and observed SHA-256 are both `3ac2871ff286552abe89a785ff43967df3315922e3718f67a136b83db1ba8db1`. |
| V5 static candidate | VERIFIED | `dist/index.html` and the three fingerprinted CSS/JS assets match the hashes recorded in the B1-501 handoff. |
| B1-501 tests | VERIFIED as committed claim; raw receipt unavailable | The committed handoff records 5/5 integration, 7/7 unit, 3/3 browser, PostgreSQL PASS, audit clean, and rollback PASS. The named `storyforge-v5/evidence/*` raw receipt files are absent from both this worktree and the B1-501 worktree; only an untracked Playwright HTML report remains in B1-501. Production claims must use fresh, retained receipts. |
| B1-502 production activity | VERIFIED as local record | The B1-502 combined handoff records no production contact or mutation and no deployed revision. |

## Historical production receipts and supersession

`STALE`: The June 30 B1-Storyforge-100-g-a guarded-deploy report records a real
legacy Runtime V2 deploy through the Matrix guard, including remote backup:

`/www/theresidencyacademy_209/private/matrix-runtime-guard-backups/B1-Storyforge-100-g-a/20260630T094715Z`

and the same legacy StoryForge JS hash still present in the July 15 active lock.
This proves lineage for V2, not current live health and not V5 deployability.

`STALE`: B1-MacProStoryforge-304 recorded a July 22 read-only census in which
Runtime V2 was live and V3 assets were absent. Its passport explicitly says it
is a local proposal, not filed MissionMed OS state. It does not govern V5.

`CONFLICTING`: Older V3 authority says the single product route is
`/member-dashboard/#storyforge` and V3 is the next local candidate. B1-502M
founder authority now selects V5 at same-origin `/storyforge/` while retaining
legacy V2 as a fallback when practical. The older documents remain useful for
legacy rollback provenance only; they must not select the B1-502M product or
deployment architecture.

## Canonical evidence required for each production decision

| Production decision | Current classification | Canonical evidence required before claiming it |
|---|---|---|
| Founder/product owner and intended route | VERIFIED decision | B1-502M founder prompt. This proves authorization and intended state only. |
| Current WordPress/Matrix production environment | UNRESOLVED current truth | Fresh Kinsta/WordPress read receipt identifying site/environment, plugin root, deployed shell/PHP revisions, and authenticated Matrix journey. |
| Current StoryForge runtime | INFERRED legacy V2 | Fresh origin/public hashes plus authenticated browser evidence distinguishing V2 legacy from V5. |
| Canonical V5 source and release branch | UNRESOLVED | Clean tracked source worktree, exact commit/tree hashes, verified remote ref, protected branch/release workflow, and clean status. |
| WordPress SSO plugin target and deployment method | UNRESOLVED | Current plugin inventory, exact destination, owner, activation/config mechanism, pre-change file/option backup, deploy receipt, and rollback command. |
| Matrix entry source | UNRESOLVED | Fresh protected source export matching every intended manifest asset, guard PASS, exact changed asset allowlist, and current source owner. |
| StoryForge application runtime/origin | UNRESOLVED | Provider service/project ID, environment, start command, source commit, immutable deployment revision, health contract, logs, and rollback revision. The repository root `railway.json` starts `missionmed-hq/server.mjs` and is not a StoryForge V5 deployment manifest. |
| Edge/CDN route and cache | UNRESOLVED | Provider account/zone, worker or equivalent ID, current route table and precedence, `STORYFORGE_ORIGIN` binding name, nonsecret config digest, cache rules, pre-change export, deploy revision, and route-removal rollback. `wrangler.toml` is candidate configuration only. |
| Database project | UNRESOLVED | Exact project ref/name/region/owner, direct provider metadata, migration ledger, current schema/RLS inventory, role boundary, connection target proof, and retention class. No Critical Systems StoryForge pin exists. |
| Database migration | UNRESOLVED | Hash of the isolated B1-500 migration, reviewed delta against the exact project, dry-run or staging receipt, backup/PITR proof, apply receipt, post-apply object/RLS hashes, and forward-only rollback decision. |
| Founder account/cohort | VERIFIED policy, UNRESOLVED identifier | Privacy-safe read of the current WordPress account proving `manage_options`; retain only a redacted or one-way identifier receipt. Do not enable all administrators. |
| Feature flag | VERIFIED candidate behavior, UNRESOLVED production state | Pre/post WordPress option receipt for `missionmed_storyforge_settings.storyforge_enabled`, exact founder-only allowlist mechanism, and negative checks for every other account. |
| Legacy fallback | INFERRED available | Fresh legacy route and asset health, explicit precedence decision, and a rollback test that restores V2 without silently presenting its demo workspace as V5. |
| Restore points | UNRESOLVED | Fresh identifiers, timestamps, scopes, provider locations, readability tests, exact restoration procedure, owner, and expected restoration time for every mutated layer. |
| Final release claims | UNRESOLVED until Wave 9 | Timestamped provider revisions, Git commit, WordPress revision, edge revision, migration ledger, redacted cohort proof, browser/network/log receipts, negative authorization tests, and rollback readiness. |

## Mentor-assignment provenance audit

### What is proven

`VERIFIED`: B1-501's isolated plugin currently derives application roles as:

- `manage_options` -> `admin`;
- any WordPress role named `mentor`, `advisor`, or `coach` -> `mentor`;
- all others -> `student`.

`VERIFIED`: Its default assignment adapter reads
`_missionmed_storyforge_student_ids` from mentor user meta, maps WordPress users
to StoryForge UUIDs through `_missionmed_storyforge_user_id`, and allows a
future production owner to replace the source through filters.

`VERIFIED`: The B1-501 local reconciliation used synthetic WordPress users and
the local `seed_local.sql`; it matched three fixture rows to three fixture
database rows. This proves the adapter and comparison algorithm, not production
assignment truth.

`VERIFIED`: The inspected protected Matrix source contains no reference to
`_missionmed_storyforge_student_ids`,
`missionmed_storyforge_mentor_student_ids`, or `sf_mentor_assignments`.

`VERIFIED`: A historical/current Matrix communications component has configured
mentor routing keys such as `dr_brian` and `dr_j`, plus conversation rows keyed
by student and mentor. That structure routes messages. It is not sufficient
evidence of a StoryForge coaching assignment, approved staff role, or
many-to-many assignment lifecycle.

### What is not proven

- `UNRESOLVED`: authoritative production mentor-assignment owner;
- `UNRESOLVED`: whether an assignment is represented by WordPress user meta,
  LearnDash groups, a program CRM, communications conversations, Scheduler
  providers, or another service;
- `UNRESOLVED`: stable mapping from WordPress IDs to StoryForge UUIDs;
- `UNRESOLVED`: assignment activation, revocation, conflict, and reassignment
  semantics;
- `UNRESOLVED`: approval of `mentor`, `advisor`, and `coach` role names as
  equivalent StoryForge authority;
- `UNRESOLVED`: production reconciliation counts and drift.

### Safe founder-release disposition

`VERIFIED decision`: B1-502M explicitly permits mentor access to remain
disabled for founder launch.

Sagan recommendation:

1. Enable only the exact founder WordPress account as `admin`.
2. Configure the production allowed application role set as admin-only for this
   release; do not enable mentor/advisor/coach by role.
3. Create no mentor assignment rows and run no production assignment import.
4. Require all mentor endpoints and UI to deny, including guessed direct IDs.
5. Defer assignment reconciliation to a later gated release backed by a named
   production owner and privacy-safe count/digest receipts.

This preserves progress without treating unresolved mentor provenance as
permission.

## Demo and fixture data risk audit

### Legacy Runtime V2

`VERIFIED`: The legacy `student-os-storyforge.js` whose hash matches the active
lock contains 12 hard-coded synthetic story records, question mappings,
readiness counts, and disabled review controls. It renders the banner:
`Bootstrap demo` / `Static sample data. Not persistent yet.`

`INFERRED`: Because the active lock retains that exact hash, any enabled legacy
V2 workspace still contains those records. Current live visibility was not
probed in this run.

Risk: a failed V5 launch that silently falls back to the legacy workspace can
make demo records appear during founder acceptance and create a false
production-success claim.

Control: preserve the legacy route for rollback, but do not count it as a
successful V5 fallback. A V5 failure should show a truthful fail-closed error or
trigger rollback. Founder validation must assert the V5 artifact identity and
the absence of the legacy demo banner.

### V5 candidate

`VERIFIED`: `storyforge-v5/infra/postgres/seed_local.sql` contains six synthetic
users, three synthetic mentor assignments, and three sample questions. It is a
separate local seed file, not part of the isolated migration and not present in
root `supabase/migrations`.

`VERIFIED`: The V5 server contains local fixture identities, and the shipped
static JS bundle contains dormant fixture-persona UI code and fixture labels.
The runtime gates them with `STORYFORGE_DEV_AUTH`; WordPress local fixtures also
require both `WP_ENVIRONMENT_TYPE=local` and
`MISSIONMED_STORYFORGE_LOCAL_FIXTURES`.

Required production controls:

- never execute `seed_local.sql` on a provider project;
- prove `STORYFORGE_DEV_AUTH=0` without printing environment values;
- prove `MISSIONMED_STORYFORGE_LOCAL_FIXTURES` is absent/false in production;
- prove `/api/dev/session/*` fails closed from production;
- prove `/api/config` reports production identity mode and no local fixture
  mode;
- start with an empty StoryForge dataset except for the minimally required,
  verified founder identity row;
- query only privacy-safe aggregate counts to prove no fixture UUIDs, fixture
  display names, sample questions, demo stories, or legacy banner are present;
- scan the deployed bundle and runtime responses for fixture markers, while
  distinguishing dormant code from records actually returned or rendered.

## Receipt standard for Sagan re-audit

Every final production claim should have a retained receipt containing:

1. UTC timestamp and tool version;
2. canonical provider/site/project/service identifier;
3. redacted account or cohort identifier;
4. source commit and deploy revision;
5. exact route/asset/config/migration/backup identifiers;
6. before and after hashes or provider revision IDs;
7. command or API operation with secrets omitted;
8. exit status and bounded sanitized output;
9. independent negative check;
10. rollback reference.

Summary prose without the underlying retained receipt is not sufficient for a
`VERIFIED` production claim.

## Wave 2 actions requested from the Supervisor

1. Establish current runtime truth through provider and authenticated read-only
   evidence.
2. Repair MissionMed OS in an isolated clean authority worktree: register
   B1-502M, file a V5-aware StoryForge passport, update product and authority
   indices, then regenerate `CURRENT.md` with `tools/mmos_status.py`.
3. Register the V5 route, runtime, WordPress seam, edge, database, feature flag,
   founder cohort, browser journey, and rollback in the protected manifests
   using only the verified provider facts.
4. Do not use the untracked 102 export as an all-assets deploy source.
5. Keep mentor access and assignment synchronization disabled for founder
   launch.
6. Treat any visible legacy or V5 fixture record as a release failure.
7. Run Sagan again after authority repair and before the first production
   mutation.

## No-contact and no-mutation attestation

`VERIFIED`: This audit performed local file reads, local Git reads, hash checks,
JSON queries, and a read-only OS lint. It wrote only this report.

No production HTTP/DNS probe, SSH session, provider CLI/API call, authenticated
browser action, remote Git operation, secret read, private-data query, push,
deploy, authority mutation, or production mutation was performed.

---

# Wave 3 Authority Re-Audit

Observed: `2026-07-27`

Re-audit target:
`/Users/brianb/MissionMed_OS` commit
`18df24dc4f1360551c7bf217f08d257a6e0cfee3`.

This section supersedes the Wave 1 statements that B1-502M was absent from the
MissionMed OS registry, that `CURRENT.md` was stale, and that StoryForge lacked
a filed passport. Other Wave 1 findings remain in force unless explicitly
changed below.

## Wave 3 verdict

`VERIFIED`: B1-502M authority is now committed and filed on MissionMed OS
`main`. The local `HEAD`, local `origin/main`, and the requested filing commit
all resolve to
`18df24dc4f1360551c7bf217f08d257a6e0cfee3`. The local remote-ref reflog records
`update by push` at `2026-07-27T12:51:04-04:00`. No remote refresh was performed
in this re-audit.

`VERIFIED`: DR-011, the StoryForge passport, the mission record, product index,
authority index, generated `CURRENT.md`, activity-log update, and registration
receipt are all members of that commit. The current working copies of the
tracked authority files are byte-identical to the commit.

`CONFLICTING`: The newly filed mission uses `"track": "cloud"`. `BOOT.md`
states both that protected scope tags force `track: local` and that deploy work
uses the local track. B1-502M is a protected Matrix/WordPress production deploy,
so this is an authority-chain violation and a BOOT hard stop until corrected.

`CONFLICTING`: The committed registration receipt still says
`status: validated-pending-filing` and says filing validation is pending, even
though the commit is now pushed and the local `origin/main` ref matches it.

`UNRESOLVED`: The authority now names the intended isolated topology, but the
application service, database, Worker deployment, restore points, provider
revision IDs, installed feature flag, and deploy revisions do not yet exist.
This is accurately described as premutation state, not deployment.

## Filing consistency audit

| Filed object | Classification | Re-audit result |
|---|---|---|
| Commit `18df24d...` | VERIFIED | Parent is `f197c54...`; subject is `governance(b1-502m): register StoryForge founder deployment`; `git show --check` passes. |
| Local remote-main consistency | VERIFIED | `refs/heads/main` and `refs/remotes/origin/main` both equal the filing commit; local reflog records the push update. This proves the locally retained push receipt, not a new network observation. |
| DR-011 | VERIFIED | Exists in the commit, is indexed at authority level 1, records Brian's bounded founder-only authorization, preserves all 13 premutation gates, requires exact-user isolation, keeps mentors denied, preserves legacy fallback, and prohibits fixtures/demo data. |
| `missions.json` | CONFLICTING | Contains exactly one active B1-502M record and correct worktree, branch, builder, packets, demo=false, and next action. Its cloud track conflicts with BOOT's protected/deploy track law. |
| StoryForge passport | VERIFIED with wording correction | Exists, is indexed, names the exact baseline and route, truthfully says provider resources are absent, and does not claim deployment. Its header says `FEATURE OFF`, although the plugin and option do not exist yet; `NOT INSTALLED / NO ENABLED FEATURE` is the exact premutation fact until Stage A installs an explicit false flag. |
| `products_index.json` | VERIFIED | StoryForge points to `PRODUCT_PASSPORTS/storyforge.md` and is classified as authorized, founder-only, feature-off, pending gates. The prior missing-passport defect is resolved. |
| `authority_index.json` | VERIFIED | Contains active `B1_502M_DR_011` and `STORYFORGE_V5_PRODUCTION_PASSPORT` entries; both paths exist and the passport is governed by DR-011. |
| `CURRENT.md` | VERIFIED | Generated `2026-07-27T12:50:36-04:00`; includes B1-502M in active missions with its guarded next action. The prior stale/unrouted state is resolved. |
| Packet/path integrity | VERIFIED | Every B1-502M mission packet exists; all three modified JSON registries parse; the StoryForge product and both new authority entries occur exactly once. |
| Registration receipt | CONFLICTING | Its evidence and boundaries agree with DR-011, but its status and filing-validation section are stale after the successful commit/push. |
| MissionMed OS checkout cleanliness | UNRESOLVED for broad lint | The tracked B1-502M authority files are clean, but unrelated pre-existing untracked handoff directories remain. Any corrective authority commit should use an isolated clean worktree and must not absorb them. |

## Re-audit of direct premutation facts

The following classifications distinguish a **filed direct observation** from
an independently reproducible provider receipt. Provider contact was prohibited
for this Sagan pass.

| Premutation fact recorded by DR-011 and the registration receipt | Classification | Corroboration and limit |
|---|---|---|
| Kinsta/WordPress production target is the MissionMed Institute site; WordPress is 7.0.2 and `missionmed-hub` is active at 1.5.1 | VERIFIED as filed direct observation | The target, SSH alias, plugin root, and domain agree with the active Matrix lock. This re-audit did not reconnect to Kinsta. |
| Legacy StoryForge JS/CSS and current Matrix shell/PHP match the active lock | VERIFIED | The four filed hashes exactly equal the active lock pins. The legacy JS/CSS also hash-match the retained local legacy source. |
| `/storyforge` and `/storyforge/` return 404 before mutation | VERIFIED as filed direct observation | Consistent with the absent edge route and absent isolated plugin. A fresh route receipt is required immediately before route creation because routing can drift. |
| `missionmed-storyforge-sso` directory and StoryForge option are absent | VERIFIED as filed direct observation | This is a valid before-state. A fresh Kinsta backup plus explicit absence receipt is still required before installation. |
| Seven WordPress administrators exist | VERIFIED as filed direct observation | This proves that administrator-role enablement would over-authorize. Stage B must test a second administrator denial, not merely founder success. |
| One exact active founder administrator was selected and only a digest was filed | VERIFIED selection; INFERRED privacy weakness | No raw identifier is present in the filed files. However, a plain unsalted SHA-256 receipt for a low-entropy numeric WordPress identifier is enumerable and must not be treated as strong redaction unless the digest construction is documented as keyed or otherwise non-enumerable. |
| Cloudflare authentication succeeded and Worker `missionmed-storyforge-v5` is absent | VERIFIED as filed direct observation | Absence means no Worker revision or rollback target exists yet. Exact account/zone/route IDs and the first immutable deployment revision remain unresolved. |
| Railway authentication succeeded and no StoryForge project/service exists | VERIFIED as filed direct observation | Correctly prevents reuse of the existing HQ Railway service. The isolated application project/service and rollback revision remain unresolved. |
| Supabase authentication succeeded and four existing projects contain no StoryForge project | VERIFIED as filed direct observation | Correctly prevents applying the B1 migration to an existing project by assumption. The isolated database owner, project/ref, empty-state collision check, migration ledger, backup, and restore process remain unresolved. |
| No raw provider receipts are stored in the current B1-502M handoff directory | UNRESOLVED reproducibility | DR-011 and the registration receipt preserve a concise claim ledger, but independent Sagan reproduction would require provider contact. Raw sanitized outputs or provider-generated revision receipts must be retained before any final production claim. |

## Authority decisions now resolved

`VERIFIED`: Wave 1's product-level gaps are now resolved as authoritative
decisions:

- product/release owner is Brian / MissionMed Institute;
- sole writer and rollback executor is the named Codex task;
- canonical local worktree, branch, and B1-501 baseline are pinned;
- the intended public route is `/storyforge/` through Matrix;
- release order is feature-off first, exact-founder second;
- exact-user allowlisting is mandatory and role-wide administrator access is
  prohibited;
- mentors, advisors, coaches, general students, and all other administrators
  remain denied;
- legacy Runtime V2 remains untouched as fallback and cannot count as V5
  success;
- local seeds, demo identities, dev auth, fake results, and frontend secrets
  are prohibited;
- isolated Worker, application, and database ownership is the selected
  architecture;
- rollback authority and mandatory rollback conditions are recorded.

These decisions do not substitute for the exact provider resource IDs,
restore-point IDs, deploy revisions, and validation receipts required by the 13
gates.

## Exact corrections required before the first production mutation

1. **Correct the mission track.** Change only the B1-502M mission record from
   `"track": "cloud"` to `"track": "local"` to comply with `BOOT.md` protected
   scope and deploy laws.
2. **Correct the filed receipt state.** Replace
   `validated-pending-filing` with a truthful filed/verified state and record
   commit `18df24dc4f1360551c7bf217f08d257a6e0cfee3`, the successful push receipt,
   and matching `origin/main`.
3. **Regenerate, validate, commit, and push authority normally.** Regenerate
   `CURRENT.md` through `tools/mmos_status.py`, run validation from an isolated
   clean MissionMed OS worktree, commit without unrelated files, push normally,
   and verify the new local remote-main ref.
4. **Clarify the passport's premutation feature state.** Until the isolated
   plugin and option are installed, report `not installed / no enabled feature`;
   reserve `feature flag explicitly OFF` for a retained post-install option
   receipt.
5. **Harden the founder evidence alias.** Keep the real WordPress identifier
   only in protected server configuration. Use a keyed HMAC or random opaque
   receipt alias in filed evidence, or document a non-enumerable keyed digest
   construction. Do not publish a reversible low-entropy identifier hash.
6. **Register V5 in the Critical Systems manifest before route launch.** Add the
   exact runtime owner, source, route/assets, WordPress seam, dependencies,
   provider pins, browser journey, feature flag, and rollback after exact
   resource selection. Update the Matrix lock only if protected Matrix assets
   actually change, through its guard/backup workflow.
7. **Retain sanitized underlying provider receipts.** Before mutation, preserve
   target IDs, route-table before-state, absent-resource proofs, provider
   revisions, restore identifiers, exact commands/API operations, exit states,
   and rollback references without credentials or private data.

Items 1 through 3 resolve an active BOOT authority conflict. Items 4 through 7
are required truth, privacy, manifest, and reproducibility gates. No production
mutation should be represented as permitted until these corrections and the
Sentinel 13-gate premutation approval are complete.

## Wave 3 no-contact and no-mutation attestation

`VERIFIED`: This re-audit read only local Git objects, local refs/reflogs,
committed MissionMed OS authority files, existing local manifests, and existing
B1-502M reports. It appended only this Wave 3 section to
`agents/SAGAN_REPORT.md`.

No fetch, pull, `ls-remote`, provider CLI/API call, production HTTP/DNS probe,
SSH session, authenticated browser action, credential read, private-data query,
remote mutation, authority mutation, code mutation, push, deploy, or production
mutation was performed.

---

# Wave 7/8 Provenance Re-Audit

Observed: `2026-07-27`

This section audits the corrected MissionMed OS authority at
`4f3c7e89efbb55956a39066bce7e42598f55a244` and the retained sanitized
provider receipts under
`evidence/provider-prestate/` plus
`evidence/REMOTE_MUTATION_LEDGER.md`.

## Verdict

`VERIFIED`: Commit `4f3c7e89efbb55956a39066bce7e42598f55a244`
resolves the Wave 3 mission-track, receipt-state, premutation feature wording,
and founder-evidence-alias conflicts. `git show --check` passes. The canonical
MissionMed OS checkout, its `main`, its local `origin/main`, and the clean
isolated B1-502M OS worktree all resolve to that commit. The local remote-ref
reflog records `update by push` at `2026-07-27T12:57:25-04:00`. No network
refresh was performed by Sagan.

`VERIFIED`: The isolated Railway identifiers are consistent across the
Railway receipt, architecture map, database evidence, restore record, mutation
ledger, and Critical Systems candidate:

- project `875e7c17-d06f-4301-a4bb-e61016f153cf`;
- environment `bcef8734-e42b-44df-8488-c2a3de68213f`;
- empty application service `dab015bf-15ef-4698-9f16-cbf8cf23de7a`;
- PostgreSQL service `a4a66362-c3ba-475a-ae21-2aa46624bafe`;
- provider database deployment
  `f5c7179e-b805-4e82-b080-d2349a0a47cf`.

`VERIFIED`: The private database dump exists locally, is mode `0600`, is 885
bytes, and hashes to
`8b192d3921d36feee62a48d5a99a4b6059b5ac8c090344752b9ec1fa01aa1fe2`.
PostgreSQL 18.3 `pg_restore --list` reads it and reports a PostgreSQL 18.4
custom archive created at `2026-07-27T17:31:45Z`, with no selected TOC
entries. This corroborates the empty pre-migration backup receipt
`B1-502M-RP-DB-PRE-20260727T173144Z`.

`PARTIAL`: The Kinsta and Cloudflare summaries are now receipt-backed, but the
current receipt set does not yet support the global
`PREMUTATION RESTORE EVIDENCE VERIFIED` claim in `07_RESTORE_POINTS.md`.
The exact remaining evidence is listed below.

## Receipt reconciliation

| Claim | Classification | Result |
|---|---|---|
| MissionMed OS filing and correction were pushed normally | VERIFIED from retained local Git evidence | Both push updates appear in the local `origin/main` reflog; current local refs equal `4f3c7e8...`. This is not a fresh remote observation. |
| Railway project/application/database targets exist and remain premutation | VERIFIED as retained direct observation | `RAILWAY_PRESTATE.md` records authenticated Railway CLI 5.26.1, exact IDs, no application source/deployment/domain, empty StoryForge database state, PostgreSQL 18.4, and the database-backup hash. |
| Kinsta target and private restore directory exist | VERIFIED as retained direct observation | `KINSTA_PRESTATE.md` records the canonical root, WordPress/PHP/plugin versions, absent StoryForge plugin/option, route 404s, backup location, artifact hashes/sizes, archive shape, and remote readability PASS. Sagan did not reconnect to Kinsta or read the private remote artifacts. |
| Database dump is readable | VERIFIED directly and receipt-backed | Hash, format, source database version, archive timestamp, and empty selected TOC were reproduced locally with PostgreSQL 18 tooling. |
| Named Cloudflare Worker is absent and public StoryForge URLs return 404 | VERIFIED as retained direct observation | `CLOUDFLARE_PRESTATE.md` records authenticated Wrangler 4.114.0, Worker-not-found results for deployments and versions, and three anonymous no-cookie 404s. |
| Both intended Cloudflare route triggers and relevant cache rules are absent | UNSUPPORTED by the retained receipt | Worker absence and HTTP 404 do not enumerate zone routes, route precedence, custom domains, or cache rules. The receipt intentionally retains no account/zone ID and contains no sanitized route/cache export. |
| Every remote write is completely enumerated | PARTIAL / supervisor attestation | `REMOTE_MUTATION_LEDGER.md` records the two authority pushes, isolated Railway resource creation, and the Kinsta private backup write. Git pushes are independently corroborated locally; Railway/Kinsta completeness cannot be independently reconstructed from the retained summaries alone. |
| No B1-502M application release commit was pushed | VERIFIED from the retained local view | The release branch remains at `e761931...`, no local remote-tracking release branch exists, the source tree is dirty, and the mutation ledger says no application repository push occurred. |

## Protected Matrix provenance conflict

`CONFLICTING`: The direct-observation hashes are locally corroborated by
retained production-source candidates, but the claim that all four match the
**active delegated Matrix lock** is false in this checkout.

| Protected asset | Filed/direct-observation hash | Current delegated-lock hash | Result |
|---|---|---|---|
| Legacy StoryForge JS | `a4aa9665012206771fc8549c897cb5d22801899347c706626062dbafb29c81fa` | `989c141068049eb6bf738a1404a61845d1db690dc66add165581e26bd21c2c67` | CONFLICTING |
| Legacy StoryForge CSS | `5b0426a7af9dbc36a1401c5d2829ca8cf7827e8070b783fbfe64875c847af7d8` | same | VERIFIED |
| Matrix PHP | `5ed6e92eb9bf748a01f475bc5a6a72e249e21a2b7560d07d2acf66f8058e8d95` | `0adf5e50e7336c7987ee27fb114997244c496de64996c6d0b824d01e3fc1d9f6` | CONFLICTING |
| Matrix shell | `c1d97237eab4936d014ec00549deb2358a056d5b8f430fe7713f5dd2ac39e76a` | `8e5bc1629af8d7de4c18d900ccf705307024bd3c00e90de6f008d66257c5317c` | CONFLICTING |

The delegated lock is
`_SYSTEM/KNOWN_GOOD/MATRIX_RUNTIME_LOCK_MANIFEST.json`, dated
`2026-06-23T18:30:57Z`. The Critical Systems manifest explicitly delegates
Matrix authority to that file. The filed hashes correspond to later retained
source candidates, but candidate correspondence is not equivalent to a current
lock match.

Before production mutation, either reconcile the delegated lock through its
normal guarded authority workflow or identify a different current lock source
and make the delegation explicit. Also retain the four per-file Kinsta
`sha256sum` results in the sanitized Kinsta receipt; the current Kinsta receipt
records the enclosing plugin archive hash but not these member hashes.

## Critical Systems candidate drift

`STALE`: The uncommitted Critical Systems candidate is not a final deploy
manifest:

- it pins `storyforge-v5/dist/index.html` to `550256c1...`, while the current
  file hashes to `5e3452bd...`;
- it pins and names `app.8569a6eccfcb.js`, which is absent; the current bundle
  is `app.78d47ab8a3b1.js` with SHA-256 `78d47ab8...`;
- it omits the present background-preference migration
  `20260727190000_b1_502_storyforge_background_preference.sql` from both the
  migration inventory and protected paths;
- it remains a modified, uncommitted file in a dirty release tree.

No `approved_sha256`, final source inventory, or protected-path claim may be
treated as release provenance until the canonical UI work is final, the build
is reproduced, every production migration is inventoried, the manifest gate
passes, and the exact tree is committed and pushed normally.

## Evidence required before the first production mutation

1. **Cloudflare route/cache export:** retain sanitized account and zone handles,
   the complete relevant route/trigger table and precedence, custom-domain
   state, cache-rule state, exact Worker-absence results, and exact scoped
   removal/purge operations.
2. **Protected hash reconciliation:** resolve the three delegated-lock
   mismatches and retain a fresh Kinsta per-file hash receipt for the legacy
   JS/CSS, Matrix PHP, and fingerprinted shell.
3. **Executable Kinsta rollback:** retain exact scoped restore commands and
   validation commands for the private plugin/config/database artifacts. The
   receipt proves readability, not a restore rehearsal.
4. **Pinned PostgreSQL 18 restore tooling:** the default PATH `pg_restore`
   16.13 rejects this v1.16 archive; the PostgreSQL 18.3 binary reads it.
   Record the exact PostgreSQL 18 restore command/environment and, before a
   destructive database change, rehearse it against an isolated disposable
   target.
5. **Complete remote-mutation ledger:** add UTC timestamps, sanitized operation
   or command identifiers, exit/outcome, target, validation, and rollback
   reference for each Railway creation and Kinsta write. Provider audit
   references should be retained if available. Continue appending every later
   remote write immediately.
6. **Final immutable source revision:** reconcile the canonical UI, rebuild,
   correct the Critical Systems pins and migration inventory, run the exact
   final gates, commit only the intended B1-502M tree, push normally, and record
   the release commit and matching remote ref before deploying from it.

## Wave 7/8 no-contact and no-mutation attestation

`VERIFIED`: This pass read local Git objects/refs/reflogs, local authority and
handoff records, local retained provider receipts, local source candidates,
the delegated lock, the Critical Systems candidate, and the private local
database dump. It appended only this section to `agents/SAGAN_REPORT.md`.

No fetch, pull, `ls-remote`, provider CLI/API call, production HTTP/DNS probe,
SSH session, authenticated browser action, credential read, private-data
query, source/authority mutation, remote write, push, deploy, rollback, or
production mutation was performed.
