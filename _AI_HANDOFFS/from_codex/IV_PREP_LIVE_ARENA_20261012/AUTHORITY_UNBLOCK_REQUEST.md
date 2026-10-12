# Bounded authority request — IV Prep Live Arena

Status: PROPOSED, NOT APPROVED OR REGISTERED. Intended mission: `MX-IVPREP-LIVE-ARENA-20261012`.

## Decision needed

Authorize the current OS registration process for a separate IV Prep instructor-led Arena mission, plus the minimal source-rebinding/isolated-extension exception needed to avoid stale Matrix shell edits. The packet's protected-write condition cannot be satisfied by the existing Dr J or InterviewIQ decisions. No blanket Matrix lock override is requested.

## Proposed bounded scope for registration

- Work only in `/Users/brianb/MissionMed_worktrees/matrix-ivprep-live-arena-20261012`, branch `codex/ivprep-live-arena-20261012`.
- Reuse verified Drills LIVE concepts/source; preserve all eight original Dr J runtime files and every historical session. Add a dedicated IV Prep extension under proposed `wp-content/mu-plugins/missionmed-ivprep-live-arena.php` and `wp-content/mu-plugins/missionmed-ivprep-live-arena/`, plus scoped tests and this handoff. These are proposed paths, not created source files.
- Namespaced route and instructor-only APIs. Existing server-verified WordPress administrator role; do not grant new roles or bypass auth. Candidate existing class roster adapter reads only class membership; instructor confirms attendance. Tonight's class/template identifier must be verified privately before use.
- Separate IV Prep class/session persistence with instructor/student/time/question/amount event attribution and idempotency. Any new WordPress option/private state location must be named in the decision; no write to `mmed_live_drills_v3_*` or its snapshots. No Supabase schema change proposed.
- No shared shell, auth, entitlement, commerce, provider configuration or Webex token changes. Add a current-family Matrix entry only through an independently reviewed dedicated extension. If that cannot avoid a protected shared seam, stop for exact additional scope.
- Resolve Brain's missing Matrix pack through its authorized owner process; do not synthesize current authority from history.
- Register under the normal serialized REGISTRY lease process, independent authority review, canonical commit/push/readback and release/provider-clear. Revalidate BOOT and take exact PATH/shared leases only after registration activates.
- If protected production release is authorized by the new decision: fresh read-only live source binding, exact preimages and rollback, narrowly deploy reviewed extension bytes, synthetic isolated class proof, genuine instructor canary, independent read-only verification and normal lease release. If release is not authorized, stop at a locally demonstrated candidate with honest status.

## Known runtime conflict to adjudicate

Global guard exit 42 is caused by unrelated stale shell/Calendar source and absent File Vault/StoryForge files in this old checkout. Drills LIVE eight-file source parity passed. Prefer a dedicated-source exception preserving all mismatched assets; do not adopt or overwrite the current production shell from this checkout and do not reconcile a global manifest as part of this feature.

## Approval boundary

This request is not a decision record, lease or permission to deploy. After the scope is approved/registered, proceed autonomously through the authorized implementation and evidence ladder. No additional routine confirmation should be required within that recorded scope.
