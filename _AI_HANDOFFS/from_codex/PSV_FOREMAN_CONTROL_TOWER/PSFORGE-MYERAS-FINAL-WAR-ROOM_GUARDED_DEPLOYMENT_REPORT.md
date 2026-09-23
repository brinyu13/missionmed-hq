# PSForge MyERAS final war-room guarded deployment report

Date: 2026-09-23

## Outcome

**PSForge / PSV v1.5.1 is live.** The release gives the accepted PSV engine its official PSForge student presentation and adds a safe, owner-scoped MyERAS assistant with AI Bulk Setup, Guided Manual Setup and standalone AI Double-Check. v1.5.1 closes the independent verifier's one v1.5.0 P1 by requiring content and observed-identity agreement before any external readback can count as correct. Existing ROOT protection, writer/editor behavior, File Vault, RISE, Bulk Rush, Prompt Management and Deep Research Stage A were preserved.

No MyERAS account mutation was performed during deployment or acceptance. A student must explicitly give the generated package to their chosen external AI or follow the manual queue. Any returned external report is displayed as **AI-VERIFIED MYERAS READBACK**, not as MissionMed independent verification.

## Authority and exact custody

- Mission: `PSV-PROTOTYPE-0001`
- Authority: DR-335
- MissionMed OS: `c3c3790eb12edb2577256f719507b523a58de7b5`
- Branch: `codex/psv-prototype-foreman`
- Main implementation commit: `732c44a161353e4e90f7a7e350487c560b175b31`
- Exact live fix-forward commit: `6490d5da1e36049ccf9c9ee904473a3513e839e9`
- Origin/source equality before deployment: PASS
- Plugin version: `1.5.1`
- ZIP SHA-256: `c187665449f7b0b11ad8ff6f4fed1bcbb29333c0d19f913ff43718e9e94b85ef`
- Manifest SHA-256: `9e670bd6475cd644fe6dc210dd658880a43004d58fbf09c24f02477231c91192`
- Live custody: exact 28/28 files, no extras
- Production PHP lint: 25/25 PASS
- Rollback: `/www/theresidencyacademy_209/private/psv-rollbacks/PSV-1.5.1-6490d5d-20260923T0206Z/live-retired`

## Delivered student experience

### PSForge presentation

- Official PSForge product name, title and StoryForge-family opening.
- Clear `Start Personalizing`, resume, Library and `Prepare for MyERAS` actions.
- Existing workflow remains available through the rail; Matrix return remains intact.
- Responsive desktop/phone presentation, reduced-motion support, large actions and human-language states.

### MyERAS Path A — AI Bulk Setup / Do It For Me

- One downloadable ZIP, generated server-side from the authenticated owner's latest approved assignment plan.
- Provider choices are configuration-backed, with safe defaults for Claude Cowork / Fable 5.1 and Codex / Astra 6.
- The ZIP contains the executable mission, canonical plan, return schema and exact approved statement bodies.
- The mission starts with `EXECUTE THIS MISSION.` and `DO NOT SUMMARIZE THESE INSTRUCTIONS.`
- It navigates from `https://myeras.aamc.org/` through visible UI, never requests credentials, and prohibits Apply, Pay, Certify, Submit, Withdraw, Signal and Message.
- One unresolved item does not stop the rest of the bounded batch.
- PASS 1 performs the work; mandatory PASS 2 starts over and reads the portal back against the canonical plan.

### MyERAS Path B — Guided Manual Setup / I'll Do It Myself

- One program and statement at a time.
- Large Copy Title, Copy Statement, Done, I Assigned It, Skip and Exit actions.
- Only plan-hash-bound progress/status is retained locally; statement prose is not placed in browser persistence.
- Missing or ambiguous RISE-owned identity/training type is shown as Needs attention and is never guessed.

### MyERAS Path C — AI Double-Check

- Separate downloadable mission with strict read-only authority.
- It may inspect assignments and produce the bounded completion artifact only.
- It cannot create, edit, assign, apply, pay, certify, submit, withdraw, signal or message.

### Completion validation

- Mission IDs are bound to owner, exact plan hash, mode and provider with a server-side WordPress nonce-salt HMAC.
- Return accepts one strict fenced JSON artifact within a bounded size.
- Owner, plan, mission, provider, mode, requested documents, program identities, timestamps and allowed statuses must match exactly.
- Duplicate, missing, extra, ambiguous, malformed and active-content/credential/session artifacts fail closed.
- Correct, Needs attention and Unknown totals are non-overlapping.
- `AI_READBACK_CORRECT` additionally requires an assignment-eligible canonical item, `ASSIGNED`, normalized content `MATCH`, and observed program, track and statement title consistent with the canonical plan. Contradictions are rejected rather than counted as correct.
- Attention states expose a large `Review N Issues` action.
- Raw manifest download remains secondary under collapsed `Advanced · Technical Downloads`.

## Verification

- Full tracked PHP suite: 25/25 PASS.
- Plugin PHP lint: 25/25 PASS.
- MyERAS contract: 20/20 PASS.
- Presentation contract: 10/10 PASS.
- Disposable WordPress plus real-Chrome MyERAS acceptance: 21/21 PASS, including rejected content/program/track/title/eligibility contradictions.
- Real-Chrome PSForge presentation acceptance: 13/13 PASS at desktop and 390px.
- JavaScript syntax and `git diff --check`: PASS.
- Actual generated assistant download: real ZIP with friendly PSForge filename and `PK` signature; student prose was not inspected or logged.
- Authenticated production Chrome: PSForge title/hero, resume, Library, two route choices, both provider cards, package-ready state, official MyERAS root, manual queue, read-only double-check and Advanced manifest placement PASS.
- Fresh independent exact-release verdict: **PASS**, with no P0, P1 or code P2 finding. The verifier independently matched source/origin, package/manifest, 28/28 source/live custody, all focused suites, production boundaries, rollback and closed lease state. Its separate actual-method adversarial harness passed 9/9 and rejected content, program, track, title, blank-observation and ineligible-item contradictions.

The older broad `e2e-api.mjs` is not green because it still expects a Family Medicine insert under an Internal Medicine ROOT. Current canonical server-side specialty isolation correctly rejects that cross-specialty fixture. This stale harness expectation is disclosed and is not counted as release evidence.

## Production state and regression sentinel

- Schema: 8.
- Access: `members`.
- Deep Research Stage A: `members`.
- Dedicated OpenAI key: defined/nonempty by boolean-only inspection.
- Stage A mission key: defined/nonempty by boolean-only inspection.
- Stage B return key: absent.
- `MMED_PS_PROTO_ALLOW_REAL_ROOT_AI`: undefined.
- Testing constant: undefined.
- Counts after final live package acceptance: roots 20, runs 138, library 13, audit 348, jobs 4, job items 90, provider attempts 172, research artifacts 2, research missions 3, edit revisions 18.
- Owner activity created one uploaded ROOT and one fail-closed Research Needed run before the v1.5.1 preflight; both were preserved and provider attempts did not change. The fix-forward itself changed no business row. Its post-deploy audit delta is one expected read-only double-check package download.
- File Vault sentinels remain exact: controller `e60b2695e7bed4e04497d0122c7dc3a5b45daca2f415f5fbac55dabc9f7bb424`, repository `a97842553c9c1d997d80903cb367b9ffba5c80a9967b6b3a5a43c5143c0f4896`, scanner `6b5cf0ebc99227e14f63a2d034c03f5beac591451314b8d55d15c57428f78a5a`.
- RISE: HTTP 200, `ok=true`, production, registry `rise_registry_acgme_2026-09-20_50d08ea6f2da`, build `rise_web_a250aa9db9a6`, `sourceRightsCurrent=true`.
- Public home/PSForge: HTTP 200; anonymous bootstrap/package/completion: HTTP 404.
- One earlier `01:51:49Z` diagnostic fatal was caused by the independent verifier's incorrect first boolean probe, not by a product/web request. The corrected probe and exact-release verification completed safely; post-`02:02Z` PSV/fatal log count is zero.
- No File Vault, RISE, Stage B, prompt, writer, ROOT, run, library or provider mutation occurred.

## Guarded deployment and rollback

- PATH lease: `0c3aa9f0-961e-4870-b75e-aebb73254d0e`.
- Fencing epoch: 3677.
- Binding: `5c9b7fa717be5802e7b782e6d2cdbb2ae1e271879093760fa32a88e3eedb594f`.
- Acquired: `2026-09-23T02:05:58.889810Z`.
- Atomic swap: `2026-09-23T02:06:19Z`.
- Expired closed: `2026-09-23T02:06:28.889810Z`; the release acknowledgement arrived after TTL and returned false.
- Active global/PSV lease count after release: 0.
- Rollback is the byte-preserved prior v1.5.0 plugin directory listed above.

## Truthful boundary and remaining limitations

- PSForge prepares and validates bounded MyERAS work; it does not hold MyERAS credentials or call a private MyERAS API.
- External AI operates the visible browser only after the student supplies the package. Its completion report is AI-verified, not MissionMed-authoritative portal readback.
- Items lacking unambiguous RISE-owned assignment identity/training type remain Needs attention; the live sample correctly exposed two such items rather than guessing.
- Authored SLOTTED Mad-Lib templates remain safely unavailable under the accepted v1.4.4 boundary.
- The stale broad API fixture should be updated separately to use canonical same-specialty data; no production functionality depends on that fixture.
- The MissionMed Supabase coordination project currently reports RLS disabled on `missionmed_ops.engineering_resource_leases` and `missionmed_ops.engineering_registry_waiters`. This is a pre-existing authority-system security advisory outside the PSV runtime and release scope. No automatic policy change was made because enabling RLS without approved policies would break coordination access.
