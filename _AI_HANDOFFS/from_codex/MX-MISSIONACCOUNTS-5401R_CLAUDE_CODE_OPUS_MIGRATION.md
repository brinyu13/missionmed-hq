# Claude Code Opus Migration — MX-MISSIONACCOUNTS-5401R

## Mission

Continue the existing protected MissionAccounts 5401R repair toward the shortest safe path to a live, operational Matrix app. Optimize for low token use: reuse the completed evidence, avoid rerunning finished work, inspect only the exact files and provider surfaces needed for the next gate, and stop immediately on a genuine human/provider blocker.

The target is a fully working live Matrix deployment with real Founder/Dr J/student acceptance. Do not call the task complete, AAA-successful, Founder-accepted, Matrix-reopened, or ready for 5402A until every required security and real-role gate passes.

## First instruction to Claude

You are continuing an existing protected production repair. Do not start from a blank plan and do not rebuild the product.

Work from:

- Worktree: `/Users/brianb/MissionMed_worktrees/MX-MISSIONACCOUNTS-5401R`
- Branch: `codex/mx-missionaccounts-5401r`
- Current branch head at migration creation: `9e2a3efaf1bc72731b15b764a99c218c0d5c2d7b`
- Deployed repair source: `48e4283277e9601b6026bd09bd177216582b8fbb`
- Current public posture: Matrix/WordPress `/missionaccounts` remains an unconditional generic HTTP 503.

Read only these first:

1. This migration file.
2. `AGENTS.md` governing the worktree.
3. [Latest orchestrator relay](/Users/brianb/MissionMed/_AI_HANDOFFS/from_codex/MX-MISSIONACCOUNTS-5401R_LATEST_ORCHESTRATOR_RELAY.md).
4. [Repair completion](/Users/brianb/MissionMed/_AI_HANDOFFS/from_codex/MX-MISSIONACCOUNTS-5401R_REPAIR_COMPLETION.md).
5. [5402A handoff](/Users/brianb/MissionMed/_AI_HANDOFFS/from_codex/MX-MISSIONACCOUNTS-5401R_TO_5402A_HANDOFF.md).

Do not reread the full historical prompt or every test file unless a narrow check requires it. Use `rg`, targeted file reads, and the sanitized evidence JSON.

## Completed work — do not redo it without evidence of drift

- Application repair committed and deployed from `codex/mx-missionaccounts-5401r`.
- Railway app deployment `8b38d28f-a285-47f7-8096-9f7aa852d43a` is SUCCESS with image `sha256:d676f9ffb57e311bd82abcf20a65d26d01e4dd31dfaade7d1942f3baa20fd376`.
- Dedicated Zoom worker deployment `ebbf2d4b-612c-4e21-90ad-cb7934af34bd` is SUCCESS on `30 6 * * *` UTC. Its next actual scheduled execution was not yet witnessed in the source evidence.
- Four new reviewed Supabase migrations were applied. Do not edit applied migrations or rerun the one-time repair blindly.
- Guarded repair receipt: `44f24da2-b69e-4a20-af39-ec9d87a393d0`.
- Canonical historical classes: June `34`, July `35`, August `31`.
- Raw source and physical records were preserved. Final readback: `5575` source rows, `4018` physical events, `3941` effective events, `72` exact corroborations, `5` unresolved occurrences, `76` retired technical projections.
- Final financial counts: invoices `0`, charges `0`, consents `0`, billing decisions `0`, running reconciliations `0`.
- Six core capability variables are deployed after transaction/security tests. Real-role witness status is still `NOT_VERIFIED`.
- Live charging and automatic billing are disabled. Production config reports payment setup disabled, mode disabled, and no publishable key.
- Source validation, Node `176/176`, PostgreSQL/concurrency, historical-import, targeted privacy/auth/workflow/UI tests passed.
- Direct pilot HTTP principal probes passed for Founder, two existing pilot student principals, anonymous denial, alternating principals, and foreign-student authorization denial. These are engineering probes, not genuine browser acceptance.
- Limited synthetic browser smoke passed at actual CSS `1440×900` and `1024×768`. Actual `390` CSS-pixel QA was not established.

Do not spend tokens reproducing those results unless current provider/source readback shows drift or a required acceptance row specifically needs a fresh check.

## Fastest authorized path to live Matrix

### Gate 1 — preserve containment and verify provider cache control

1. Keep the unconditional WordPress/MU route 503 active.
2. The Kinsta support request is drafted but not sent. Do not send an external message without explicit user authorization.
3. Obtain an unconditional Kinsta origin/full-page/Nginx and Edge exclusion for the complete `/missionaccounts` namespace, including private descendants and the dedicated SSO token endpoint. It must not depend on cookies, Authorization headers, query parameters, or request method.
4. Obtain a controlled source-IP QA admission mechanism that leaves all other traffic on 503.
5. Verify effective headers and cache identity on the same canonical URL before any reopening. A prior unsupported GET to the token endpoint returned a generic 404 with `X-Kinsta-Cache:HIT` despite `no-store`; do not treat application headers as provider exclusion proof.

If provider exclusion cannot be verified through an authorized control surface, stop and give the user one concise blocker question. Do not bypass it with a query parameter, cookie trick, broad purge, or public reopen.

### Gate 2 — resolve Matrix runtime and entitlement with minimum scope

1. Re-read the current live Matrix controller/JS/CSS hashes and the applicable runtime lock. They previously differed, so the stale-runtime hard stop applies.
2. Do not modify the shared Matrix runtime until the current owner/source authority is reconciled and an exact shared-domain fence is available.
3. Use the narrowest supported discovery seam to expose MissionAccounts in the intended Matrix navigation and return flow.
4. Replace the temporary three-user SSO allowlist with server-authoritative entitlement for the intended roles/product. Do not hardcode a guessed entitlement model from the pilot or read-only product observations.

If the current Matrix owner or entitlement source is unavailable, preserve containment and report the exact missing authority. Do not patch a stale bundle.

### Gate 3 — obtain genuine browser sessions

The next run needs the intended real Dr J account plus two distinct genuine students. Existing pilot IDs and signed HTTP tokens are not substitutes.

- Do not request or store passwords, cookies, JWTs, or private student payloads in the report.
- Use normal login in controlled browser sessions.
- Prove Founder, real Dr J, Student A, Student B, anonymous, logout, clean-browser, repeated warm request, and alternating-principal behavior on the canonical URL.

### Gate 4 — complete the six real persisted workflow witnesses

For each workflow, execute through the visible UI and capture only sanitized identifiers/counts:

1. Contacts.
2. Attendance corrections.
3. Billing decisions, including valid cap/UCC/MUL/no-charge and reversal.
4. Identity adjudication/device ambiguity.
5. Exam plans, approval/date changes, grace/passed/reminder behavior.
6. Comp days, including default, override reason, prospective behavior, and audit.

Each witness must show: pre-state → visible UI action → API response → authoritative DB state/version → reload persistence → audit/history → correct other-role visibility → supported undo/reversal/final state.

Current complete count is `0/6`. Do not promote unit tests or synthetic PreviewStore smoke to a real-role PASS.

### Gate 5 — responsive and operational proof

Run the real workflows at actual CSS widths approximately `1440`, `1024`, and `390`. Verify entry, search, student detail, reports, billing review, exam flow, dialogs, keyboard access, overflow, and error recovery.

Capture the first successful post-resume daily Zoom worker execution and verify no duplicate or billing effects. Keep Live charging and automatic billing disabled.

### Gate 6 — conditional reopening and independent acceptance

Only after all previous gates pass:

1. Re-run the full same-URL security/principal matrix.
2. Remove the 503 guard only under current authority, narrow lease, and documented rollback.
3. Perform only scoped MissionAccounts cache purge if provider instructions require it.
4. Re-run the principal matrix immediately after reopening.
5. Update the five 5401R reports with fresh evidence.
6. Leave final Founder acceptance and 5402A re-acceptance to the independent auditor.

## Token-efficiency rules

- Do not rerun the full suite, rebuild canon, reapply migrations, or replay the production repair unless current state drift makes it necessary.
- Prefer existing sanitized evidence and one targeted provider readback over broad logs.
- Use `rg` and narrow reads; do not dump private response bodies or credentials.
- Make one provider mutation at a time, with exact target IDs, preimage, rollback, and post-readback.
- Do not spawn agents unless a bounded read-only check materially reduces time.
- If blocked by a human/provider dependency, ask one precise question and preserve the 503. Do not generate another broad strategy cycle.
- Never place secrets, tokens, cookies, passwords, or private identity data in this file, commits, prompts, or reports.

## Hard safety boundaries

- No real Stripe card, Live charge, real invoice, automatic Live billing, or money movement.
- No raw Zoom evidence deletion.
- No historical truth overwrite or fabricated identity resolution.
- No broad cache purge.
- No shared Matrix overwrite while runtime authority is stale.
- No public Matrix reopen before the complete cache/principal matrix passes.
- No self-certification of Founder acceptance or 5402A readiness.

## Useful exact references

- Canonical report directory: `/Users/brianb/MissionMed/_AI_HANDOFFS/from_codex/`
- Sanitized evidence: `/Users/brianb/MissionMed_worktrees/MX-MISSIONACCOUNTS-5401R/missionaccounts/evidence/MX-MISSIONACCOUNTS-5401R/`
- Supabase project: `dwwsahpzblgrgducxtzw`
- Railway project: `244bf2d1-1eca-4b97-95ab-95a565a8b4d0`
- Railway environment: `db6dae0e-cc37-4eff-9bed-3d5fe7cc8f9f`
- Railway app service: `857cdc07-2482-4cc0-a2a1-70b38f65542b`
- Railway Zoom worker: `ed6498e3-81dd-479a-a659-28b1783e1a75`
- Kinsta SSH alias: `missionmed-kinsta`
- WordPress root: `/www/theresidencyacademy_209/public`

## Required final response from Claude

Report only:

1. What changed since source commit `48e4283277e9601b6026bd09bd177216582b8fbb`.
2. Exact current deployment/provider IDs and sanitized readback.
3. Which AAA rows are PASS, FAIL, or NOT VERIFIED.
4. Whether Matrix is still 503 or safely reopened.
5. The single next human/provider action if blocked.

Never say “live and fully functional” unless the full matrix, six genuine workflow witnesses, responsive QA, and independent acceptance evidence all pass.
