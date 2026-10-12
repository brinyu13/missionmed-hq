# IV Prep Live Arena discovery — NO-GO for protected implementation

Observed 2026-10-12T12:45:19.153138+00:00. Class deadline: October 12, 2026, America/New_York.

## Decision

GO: scoped read-only discovery and this evidence handoff. NO-GO: protected implementation, test-class writes, migration, deployment and tonight's Matrix launch. The user packet explicitly conditions protected work on current OS authority. This is an authority/runtime blocker, not a completed delivery.

## Authority and custody

- Repository: https://github.com/brinyu13/missionmed-hq.git. Worktree: `/Users/brianb/MissionMed_worktrees/matrix-ivprep-live-arena-20261012`. Branch `codex/ivprep-live-arena-20261012`, initial HEAD `c9493bcd941e0377e58416111d367495fd7c3807`, clean before handoff creation. Common Git directory `/Users/brianb/MissionMed/.git`.
- GitHub main verified by `git ls-remote`: `0feee579b0a9f2c90529220899f6cf6d21b8cd05`. Do not deploy the whole old checkout.
- Read `/Users/brianb/MissionMed_worktrees/missionmed-brain/AGENTS.md`. Its index and tracked `packs/` contain Calendar, File Vault, InterviewIQ and Mission Residency Commerce; no Matrix generated pack exists. No unrelated product pack was substituted.
- OS default checkout was behind remote and had unrelated untracked artifacts; preserved it. Read fresh shallow GitHub snapshot at `7c2dabc08414adc806034efb8e9d5e2e2747cc3c` in `/var/folders/xs/k4jpy4k177g_flhq3wp7p21r0000gn/T/ivprep-authority-20261012-wejyzsrv`.
- BOOT -> CURRENT -> missions -> products -> authority index -> Matrix passport and universal dependency manifest examined. Universal BOOT passes against canonical HQ origin/main and accepted MR-079 hash `9638e67841e98b278244c0d4f9ecd0ccbdc7a9e17c50a67dd45d1d31895a0357`.
- No matching IV Prep Live Arena / Drills LIVE / MX-WEBEX / AR-LIVELOCK mission or decision record found in fresh registries. `Daily Drills Live` is `legacy_protected`, `passport_path: null`.
- Matrix passport explicitly prohibits product/production mutation except separately registered bounded missions. Existing rail/InterviewIQ exceptions do not authorize this feature.
- Supabase coordination project `brxqytrfdisrgakrxkhd`: read-only query of `missionmed_ops.engineering_resource_leases` for unreleased unexpired rows returned zero. No lease acquired. An empty lease set does not supply mission authority.
- Actual Matrix runtime preflight returned **42**. Five local shared assets differ from the lock, six production assets differ, and four local assets are missing. Exact warning: `WARNING: You are about to work from an old Matrix runtime version. Do not edit or deploy without Brian approval.` See `RUNTIME_GUARD_SUMMARY.json`. No override was supplied.

## Source lineage and live proof

| Evidence worktree | Exact HEAD | State |
|---|---|---|
| F1-DrillsLive-605 | c9493bcd941e0377e58416111d367495fd7c3807 | Two untracked 610/611 handoff directories, preserved |
| F1-DrillsLive-604 | 55577a78de116591c73d9845019af6f9665f9149 | Untracked handoff preserved |
| F1-DrillsLive-603 | 55577a78de116591c73d9845019af6f9665f9149 | Untracked candidate source/handoff preserved |
| F1-DrillsLive-600 | 7409a82f056b58335e996dda7e101c310c982f1f | Untracked handoff preserved |
| ar-001-arena-stat-drills-dropdown-consolidation | 88a8d83a56cc09becaa2c3783e99d3b29ffa68c5 | Clean |
| AR-LIVELOCK-000_source_guardrails | 38ad5fb1798e9eae40b4fedc844c4b1c1231be81 | Dirty source/migrations/reports, read only |
| MX-WEBEX-360-20261012 | 4d1a8f5950668eed35a619f9a17aca7553c8308c | Untracked mission packet; not execution authority |
| G1-ClassManager-700 | 3faf0e8deb904dc7e3a8906f3aad29ccf3048871 | Untracked discovery handoff; no delivered ClassManager proven |

AR-LIVELOCK manifest/AR-LIVELOCK-002 report concern historic Arena/STAT/Drills/Daily CDN source adoption. Their May passing state is not today's Matrix lock acceptance. Source adoption report explicitly required fresh validation before further work.

Fresh SSH SHA-256 reads of the eight Drills LIVE files in `DRILLS_LIVE_HASHES.tsv` matched the task checkout 8/8. Production root `/www/theresidencyacademy_209/public/wp-content/plugins/missionmed-hub`. Thus the 611 Drills source is a verified narrow source donor even though its shared Matrix shell is stale. These are byte-custody checks, not workflow acceptance.

## Existing implementation

Paths below are relative to this worktree's `wp-content/plugins/missionmed-hub/`.

- `includes/class-mmed-live-drills-sdk-v3.php`: route constant `daily-drills-live-webex-v3`; enqueue/navigation integration and admin controls; WordPress options persistence. Source-derived entry is `https://missionmedinstitute.com/daily-drills-live-webex-v3/`. Current visible Matrix link has not been verified.
- `assets/daily-drills-team-challenge-v3-action.php`: sole POST gateway, same-origin check, WP nonce, viewer verification, writer lock, persistence-error response.
- `includes/class-mmed-live-drills-state-contract.php`: public initials/pseudonymous IDs, session-bound viewer tickets, state sequences, atomic JSON helpers.
- Scoring action requires `manage_options` and lifecycle `live`; uses current active student and boolean correct/missed. Correct adds **one** point. Undo exists. A chosen arbitrary point amount is not implemented.
- One global option `mmed_live_drills_v3_team_challenge_state` and `missionmed-live-drills-v3/team-challenge-state.json` hold Dr J state. Selecting a Webex session changes meeting/title while explicitly retaining roster; it is not a separate IV Prep score ledger.
- No mutation request-id deduplication found in inspected gateway/score path. Writer serialization prevents overlapping execution but does not make a retry idempotent. History records event text/time/sequence, not a full immutable instructor/session/student/amount ledger.
- Normal roster starts empty, or with explicitly enabled demo bots. Users/guests opt in; this does not verify Webex presence. Do not relabel it as attendance.
- `includes/class-mmed-session-manager.php::get_enrolled_students()` can derive candidate users from program tiers, task templates and LearnDash mappings. That source logic is not proof of tonight's class membership; live template and instructor confirmation remain necessary. No student roster exported.
- `includes/class-mmed-webex-client.php` supports schedules/invitees and declares participant scopes. No verified live attendee-to-Matrix identity mapping found. Its status helper may refresh credentials and write options, so it was not invoked under read-only authority.

## Runtime/browser limits

Existing authenticated Chrome Matrix tab shows the Welcome Home overlay and Matrix/Arena links. No instructor scoring action performed. Computer inventory reports Webex installed but not running; an existing Webex meeting-details browser tab is open. Neither proves attendance synchronization or screen sharing.

Anonymous HTTP GET to the existing action gateway returned **403 Forbidden**; no roster payload was logged. This is an observed request result, not proof of intended application authorization or a diagnosed defect.

## Smallest proposed architecture, pending authority

Use the verified Drills scoring/display concepts in a dedicated IV Prep extension with server-side administrator authorization. Read the verified class roster; require instructor confirmation; initially mark all absent. Store independent per-class/per-session state and event IDs, actor ID, student ID, question, amount and timestamp. Deduplicate retries and preserve the original request ID after uncertain failures. Show success only after durable save/readback. Add a names-only projection display for Webex window sharing. Do not use anonymous roster delivery or write Dr J state.

Prefer a dedicated extension/route over modifying stale shell files. No Supabase migration is inherently required for this WordPress-owned MVP, but all persistent option/file writes still need explicit registered scope. Final persistence implementation and exact path leases must be reviewed before edits.

See `AUTHORITY_UNBLOCK_REQUEST.md` for the actionable gate. No automatic Webex integration is on tonight's critical path.
