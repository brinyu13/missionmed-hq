# MissionAccounts 5400A — Bounded repair specification

**Recommended next ticket: MX-MISSIONACCOUNTS-5401R. Required: YES.** Current Founder verdict FAIL; P0 contained with Matrix route off. This is the concrete repair scope, not authorization to execute non-P0 production changes in this audit continuation.

Use `/Users/brianb/MissionMed_worktrees/MX-MISSIONACCOUNTS-5400A-CONT`, branch `codex/mx-missionaccounts-5400a-containment`, whose deployed containment commit is `ece63b6`. Start the actual repair in a clean isolated branch from the current accepted committed state after BOOT/authority and live drift checks. Preserve unrelated dirty trees, original evidence, donor sources and all raw attendance. Revalidate production hashes and scoped leases before protected writes.

## R0 — keep containment; repair caching before reopening

Affected file: `missionaccounts/infra/wordpress/missionmed-missionaccounts-route.php`. Production path and backup hashes are in the master audit. The emergency guard must remain until a provider-native exclusion/bypass for the dedicated route and all private/API descendants is demonstrably effective at every cache layer. A PHP `no-store` header alone did not prevent the prior Kinsta cached disclosure.

Review the Kinsta cache configuration and WordPress route behavior for the exact MissionAccounts namespace. Make the smallest authorized provider/application change. Preserve anonymous denial, role resolution, short-lived SSO, response redaction and direct Railway isolation. Do not broaden the three-user pilot or change shared Matrix runtime without separately routed authority.

Reopening test sequence: clear only affected cache; anonymous bootstrap has no private body; Founder gets correct Founder payload; students620/624 each get only self; both foreign-resource directions deny; alternate principals on the same URL repeatedly with cold/warm cache; repeat anonymous after Founder/student; exercise actual logout and real incognito/clean browser; reload after purge; recheck direct Railway. Capture allowlisted cache headers/status/body shape or digest, never private payloads, cookies or JWTs. A generic shutdown satisfies containment but not the correct-role availability rows. `/api/me` may legitimately ignore foreign selectors and return self; assert no foreign data and separately assert foreign-resource denial.

Release the guard only when the complete matrix passes on the intended browser path. If any layer serves stale private data or authority conflicts arise, keep the route denied. Restoring the preimage is not safe rollback while the cache defect remains.

## R1 — repair the four observed navigation failures

| Control | Expected | Actual | Error | Route | Severity | Source pointer |
| --- | --- | --- | --- | --- | --- | --- |
| Start with the questions | Open June attention queue | Home remains after hash change | TypeError: Cannot read properties of undefined (reading 'label') | #/cycle/june#attention | P1 | index.production.html:1346,1410,1483; secondary hash becomes cycle key |
| Billing: Details | Open rule details in All cycles | Billing remains after hash change | TypeError: Cannot read properties of undefined (reading 'name') | #/billing?cycle=all#rule | P1 | index.production.html:1346,1750; anchor becomes part of cycle query |
| Data controls | Show source reconciliation controls | Previous Advanced view remains | TypeError: Cannot read properties of undefined (reading 'toLocaleString') | #/advanced/controls | P1 | index.production.html:1960–1961; canonical adapter controls shape is incomplete |
| Classes | Show canonical classes and source links | Previous Advanced view remains | TypeError: Cannot read properties of null (reading 'mid') | #/advanced/sessions | P1 | index.production.html:1959; adapter sets review_meeting=null |


Parse path, query and secondary anchor distinctly. Validate cycle keys and default or show a truthful recoverable error for unknown values. Preserve canonical links/anchors and browser Back behavior. Do not silently show the previous screen under a new URL.

Reconcile the canonical hydration contract in `public/missionaccounts-canonical-adapter.js` with `viewAdvanced` expectations. Current `D.meta.controls` is a shallow aggregate, while Data controls expects the prototype's richer field structure. Current `review_meeting` is null, while Classes reads `.mid` unconditionally. Build a faithful source/canonical projection or an honest empty state; do not insert fabricated prototype values. Make changes through `scripts/materialize-canon.mjs` and the adapter/source as appropriate, then regenerate `public/index.production.html` reproducibly. Fixing generated HTML alone is insufficient.

Regression acceptance: click the four original labelled controls from the prior screen, verify route and heading/content, no JS exception, intended section focus/anchor, back navigation, invalid/empty model behavior, no mutation or cross-user data. Repeat on desktop and phone widths with real roles.

## R2 — restore core workflows deliberately

Effective false capabilities: `student_contacts`, `billing_decisions`, `attendance_corrections`, `identity_review`, `exam_plans`, `comp_days`. Source config: `src/server.mjs:32–42`; session capability projection `:480–490`; UI policy `scripts/materialize-canon.mjs:196–217`. Live charging is a separate gate and remains off.

For each core feature, establish its authoritative route/RPC, input/role validation, idempotency, audit event, versioning/reversal and UI hydration. Use designated reversible test fixtures under the repair ticket's explicit authority. Enable only the capability whose full workflow is ready. Contact fields must be read-only when edits cannot save or explain the unavailable state before typing.

Batch/group confirmation, confirm-all, decision undo and clear policy have a second explicit source lock pending authoritative transactions. Implement those transactions with per-record outcomes, scope/hold validation, idempotency and audit before removing that lock. Do not substitute client-only arrays/localStorage or broadly unlock every selector.

Required six E2E chains: contact update; source-preserving attendance correction and undo; Dr J billing decision including separate UCC/MUL and capped cases; identity decision and reopen with no guessed merge; exam plan through both roles; comp override with reason. Each must establish pre-state → UI → API → DB → reload → history → other role → supported reversal. No real invoice send or automatic charge is part of these chains.

Exam acceptance includes Level1/2/3/date, approve/alternate/speak, result wait/grace, Passed/no-result/follow-up/reopen, student status/history and third-Wednesday reminder suppression after Passed. Comp default/override and prospective behavior must preserve the canonical contract.

## R3 — reconcile duplicate Zoom classes without deleting evidence

Read-only witness: two June8 pairs with identical start/Step, distinct historical/API provider keys; 72/77 new rows exactly match historical name/join/leave/start/Step evidence; 77 effective events and76 needs_review identities/days were added. Current billing decisions/invoices/charges/consents are zero. Future billing inflation is not yet ruled out.

Relevant sources: `scripts/build-historical-import.mjs` historical provider identifiers; `supabase/migrations/20260906100746_zoom_ingestion_port.sql` provider/instance uniqueness; `supabase/migrations/20260906134000_zoom_attendance_reconciliation.sql` review identity/event creation. Do not rewrite applied migrations.

Create a source-preserving canonical session crosswalk and reversible adjudication/supersession migration or service transaction under explicit repair authority. Retain all raw rows, provider run payloads, source hashes and links. A replay should attach evidence to the correct canonical class without creating another billable attendance interpretation. Treat matching start/Step as a class candidate, not automatic person identity proof. The five rows without the exact historical match need individual evidence review; never merge by similar name alone. Preserve unresolved identity holds and source custody.

Before/after acceptance: original historical sources/hashes unchanged; each of the two witness class pairs resolves to one effective canonical class; no additional effective student/day charges; no prior Dr J decision silently changes; replay is idempotent; exact and ambiguous participants have appropriate source links and holds; a genuinely new class imports normally. Compute billing derivation before/after across day, Step, identity, comp/grace and capped-cycle cases. A clean June witness should explain the original34-class count versus36, while allowing legitimate later imports under separate evidence. Report raw-source count separately from effective canonical count.

Do not activate future collections until the zero-inflation result holds after identity adjudication as well as before it. Do not delete the76 review identities/days or mutate historical attendance to make counts look correct. Use append-only/reversible decisions and supersession with audit.

## R4 — Matrix and genuine role acceptance

Verify actual current Matrix launcher/search/navigation consumes the MissionAccounts registration hooks; merely adding a WordPress filter is insufficient. Capture entry as Founder, the intended Dr J admin, and each real authenticated student. Pilot expansion or shared-shell changes require their own authority decision; the audit does not broaden access.

Prove actor/subject distinction, own-only record lists/resources, no admin navigation or prototype controls for students, correct avatar/name/role, HomeBase context switch/deep-link/back continuity, and unavailable-entitlement behavior. `View As` and programmatically issued JWTs are not browser role acceptance. Use separate authentic sessions without reading or recording passwords, cookies or tokens.

## R5 — truthful product and provider states

Replace hard-coded scheduler/future integration copy in the materializer with a read-only runtime projection of actual provider last/next run, attempt/result and actionable exception counts. A successful zero-session run must not imply class import success or deduplication correctness. Label people versus review/device identities and raw versus canonical class/event totals.

Keep Test provider readiness, student setup, consent, hosted invoices and Live automatic charging distinct. `hosted_invoices=true` does not mean every billing action works; `auto_billing=false` must not be presented as the reason unrelated contact/exam/comp actions cannot run. Review the current student setup notice coupled to auto_billing without enabling Live charging to expose a button. Do not redesign the StoryForge shell.

Explain $25 eligible-day basis, same-day Steps counted once, authoritative historical $300 ceiling eligibility and required holds. The observed $350/14-day proposal beside a $300 full-cycle option requires an unambiguous allowed action, not new billing policy. Preserve separate UCC/MUL treatments and current retroactive day-rule authority.

## Required regression and acceptance evidence

Use the 99-case recovered control inventory as a starting set, then add uncaptured Home intents, cycle review controls, dialogs, real student actions, empty/error states and every newly reachable control. Current interaction coverage is 35/99; that is not a complete denominator for the app. Make a rendered-control reconciliation for each tested role/route/state so nothing disappears from coverage.

At1440,1024 and about390 widths, exercise navigation, search, profiles/cycles, attendance, decisions, exams, billing, reports, student actions, dialogs and app switching. Verify keyboard activation, focus/scroll/back continuity, reduced motion, input validation, duplicate submit and refresh mid-workflow. Separate intentional Live/role/hold disables from implementation gaps, and verify every action's stated effect.

Preserve source images, design contract, $25-day baseline, same-day dedupe, $300 historical ceiling where valid, no-charge categories, grace never billed retroactively, comp rules/reasons, independent consent and Live charging off. Broaden/repeat testing only for changed behavior or unresolved defects; old suites are useful regression checks but do not replace real-user acceptance.

Deliver exact commits/provider hashes, before/after aggregate controls, sanitized browser/API/DB/audit evidence, rollback/supersession plan, fresh authority/lease readbacks and independent Founder review result. End with FIXED/CONTAINED/OPEN for privacy, actual role/workflow PASS/PARTIAL/FAIL, residual unverified cases and a provider-native lease release readback. Never self-approve human acceptance or production money movement.
