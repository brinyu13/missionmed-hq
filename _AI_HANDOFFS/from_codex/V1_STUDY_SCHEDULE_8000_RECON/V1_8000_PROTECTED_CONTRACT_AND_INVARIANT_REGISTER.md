# V1 Study Schedule — Protected Contract and Invariant Register

| Contract | Owner / producer | Consumers | Current source/runtime | Allowed future change | Forbidden change | Required compatibility tests | Rollback consequence |
|---|---|---|---|---|---|---|---|
| Plugin bootstrap | MissionMed Hub / WordPress | All plugin modules | `missionmed-hub.php` / recovered runtime | Add guarded V1 includes | Reorder/remove shared initialization | PHP load, activation, all routes flag-off | Restore prior plugin package |
| MU-plugin load order | WordPress MU layer | Matrix shell and shims | D9-415 9-file safe closure | Add only with explicit dependency proof | Alphabetic rename or broad cleanup | Closure hashes, boot smoke | Restore MU package before app |
| Student OS controller | `MMED_Student_OS` | Shell and every module | SHA `23da5c...` | Emit V1 config/loader for eligible users | Client-only auth; broad payload rewrite | All module payloads, auth cohorts, guard | Restore prior controller |
| Hashed shell asset | Student OS | Every Matrix route | Public and recovered `student-os.646e...js` bytes match, but this hashed path is absent from the global lock and stale Matrix passport inventory | Treat as protected by blast radius; pin controller + hashed bundle + source twin + cache behavior before adding a loader beside it | Edit in place, enqueue an unhashed replacement, or assume the existing lock covers it | Byte/hash map for controller, hashed path, unversioned twin, warm/cold cache, and route matrix | Re-enqueue a newly pinned known-good descriptor/package |
| Hash routing | Student OS/Matrix Runtime | Dashboard modules | `study` source route | Register a single V1 owner | Two active renderers or Scheduler alias | direct/back/forward/race/unmount | Disable V1 loader |
| WordPress identity | WordPress | REST, repository, audit | `get_current_user_id()` | Add validated context claims | Infer identity from client or unknown Supabase UUID | two-user isolation, admin impersonation denial | Disable writes |
| V1 access context | Future V1 access service + scoped repository | Nav, assets, REST, rollout | Missing | Auth+nonce; entitlement/rollout/action; learner-scoped lookup; resource/field checks; non-enumerating errors | `is_user_logged_in()` alone; pre-lookup ownership guesses; flag as auth; admin learner mutation | cohort matrix, CSRF/XSS/mass-assignment/enumeration/rate, forged client, admin-write/import/impersonation denial | Disable writes; retain authorized reader |
| REST namespace | MissionMed REST + V1 controller | Client/adapters | `mmed/v1/study-blocks` | Add versioned V1 routes with schemas | Change unrelated endpoints | route collision, schema, auth regression | Disable V1 routes |
| Legacy Study IDs | Calendar engine | Legacy client | Numeric Calendar IDs | Guard owner+type; read/import only | Mutate foreign event by ID | foreign-owner/type negative tests | Restore guarded legacy adapter |
| Plan IDs/revisions | V1 repository | UI/adapters/audit | Missing | Stable UUID + monotonic revision | Numeric Calendar ID as canonical key | retry/stale/two-tab/concurrency | Disable writes, preserve data |
| Plan write authority | V1 repository | All V1 features | Missing | One operation path | Calendar/Admin/mentor direct writes | writer inventory and DB audit | Flag off and stop writer |
| Adapter event envelope | Source systems | V1 adapters/domain | Missing | Source system/object/version, event ID, occurred time, kind, tombstone; stale/replay rules | Unversioned last-arrival-wins transforms | replay/reorder/move/cancel/delete/tombstone tests | Stop adapter |
| Calendar boundary | Calendar | V1 anchor/import adapter | Current owner of Study rows | Read busy/fixed; marked export excluded from inbound processing | Dual-write canonical Plan or export echo | import idempotency, echo suppression, foreign event integrity | Stop adapter/export |
| Mentor ghosts/privacy | Mentor service | Learner V1 domain | Prototype only | Assigned scope, `mentorVis` server filtering, actuals opt-in, reason/provenance, withdrawal version, CAS learner decision | Direct mentor edits or serialization of hidden/unconsented fields | hidden-field, minute-actual, assignment, withdrawal/accept race, audit | Disable mentor adapter |
| Completion | Learner V1 operation | Review/streak/adapters | Legacy status toggle | Learner operation; external evidence only | Silent external “done” | Arena/course proposal and learner action tests | Rebuild read model from ops |
| Reserve/recovery | V1 domain | Planner, UI, review | Prototype only | Preserve provenance and conservation | Silent reserve consumption/reflow | property tests and edge catalog | Rebuild from operation log |
| Timezone/week | V1 temporal service | Every surface/streak/notifications | Naive legacy timestamps | IANA zone + local intent + instant | Browser locale as sole truth | DST gap/fold/travel/week-boundary tests | Stop writes if interpretation differs |
| Settings | Owner TBD in V1-8010A | UI, sound, motion, quotes | Prototype local state | Select one owner, then versioned server round-trip | Multiple implicit owners or schema before decision | ownership/default/migration/privacy/reduced-motion tests | Fall back to safe defaults |
| Retention/history | Owner TBD: V1 data + privacy/legal | Ops, Review, audit, backup | D9-100 inherited 90-day/permanent language | Revalidate and record hot/archive/tombstone/audit/deletion/backup rules | Blind permanent retention or unrebuildable expiry | expiry/archive/rebuild/delete/anonymize/restore/export | Stop deletion/expiry jobs |
| Runtime modes | Server registry/access/release | Loader/API/reader/rollback | Missing | Separate legacy-precutover, V1 active read/write, V1 degraded read-only, and hidden-without-truth modes; atomic watermark | One boolean for exposure+writes+reader or flag as entitlement | pre/post-cutover, atomic watermark, current/N-1 reader, legacy-write denial, cohort/cache tests | Enter degraded read-only after cutover; legacy only before cutover |
| Runtime manifest | Matrix runtime governance | Deploy/rollback/guard | No V1 entries; global lock inventories unversioned `assets/student-os.js`, not the active hashed bundle | Add immutable loader/bundle/controller hashes and close the active-shell coverage gap | Unlocked/mutable release assets or partial descriptor coverage | guard preflight, public/source/cache hash map, path-coverage assertion | Restore prior manifest/package |
| Telemetry | V1 release owner | Operators | Missing | Privacy-safe structural events | Student content, tokens, PII | payload allowlist/redaction tests | Disable telemetry |

## Non-negotiable product invariants

1. V1 Study Schedule is never conflated with booking or Calendar products.
2. D9-300's validated visual/interaction foundation is visible in the first
   learner slice.
3. The learner remains completion and mentor-ghost acceptance authority.
4. Plan, actual, external evidence, and Calendar projection are separate facts.
5. One repository writes canonical Plan state.
6. Operations are atomic, versioned, idempotent, auditable, and timezone-safe.
7. Recovery and reserve preserve provenance and learner control.
8. Flag-off leaves current shared behavior intact.
9. Rollback preserves learner data.
10. Post-cutover rollback never exposes a second mutable legacy truth.
11. No protected contract changes without tests, hashes, manifest, and a
    rollback checkpoint.
