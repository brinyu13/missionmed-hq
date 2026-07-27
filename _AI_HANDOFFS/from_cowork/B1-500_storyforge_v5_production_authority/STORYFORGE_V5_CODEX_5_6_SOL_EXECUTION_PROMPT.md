# STORYFORGE_V5_CODEX_5_6_SOL_EXECUTION_PROMPT
B1-500 · Copy-paste execution contract for Codex.

## Operator setup (run before pasting the prompt)

Confirmed current selections (first-party OpenAI guidance, July 2026): the flagship coding model is **GPT-5.6 Sol**, API slug **`gpt-5.6-sol`** (the `gpt-5.6` alias also resolves to Sol in Codex docs). "Ultra" is not a model — it is a multi-agent reasoning mode (four parallel agents by default, Plus-and-higher plans, with a CLI usage warning). The founder's "Codex 5.6 Sol Ultra" therefore means: **model `gpt-5.6-sol` + Ultra reasoning when warranted**.

```bash
codex \
  --model gpt-5.6-sol \
  -c model_reasoning_effort="xhigh" \
  --sandbox workspace-write \
  --ask-for-approval on-request \
  -c 'sandbox_workspace_write={ network_access = false }'
```

- `xhigh` is the confirmed config literal for long agentic work; escalate to **`max`** or **Ultra** in-session via `/reasoning` for the hardest stages (Stage 1 authorization design; Stage 5 migration rehearsal) — the exact TOML strings for max/ultra were not confirmed in first-party docs at research time, so set them interactively and record what the CLI accepts.
- Enable network access only for tasks that need it (dependency installs, provider calls in staging), and never during credential or migration handling.
- Use `--ask-for-approval untrusted` for the migration/credential phases of Stages 5–6.
- Long-horizon pattern per OpenAI's guidance: keep four durable files in the repo — frozen spec (this package + the canonical artifact), living plan with milestone acceptance criteria, runbook, and an append-only work log — and verify (lint/type/test/build) at every milestone with a stop-and-fix rule.
- Recovery: `codex resume --last` continues an interrupted session; `/compact` when context grows; re-read the work log after any resume.
- Parallelism: spawn subagents only for truly independent tracks; isolate overlapping edits with `/worktree`; `codex cloud exec` for background-safe independent tasks.

---

## THE PROMPT (paste everything below into Codex)

**Title:** B1-500 — StoryForge V5 production implementation (Stage 0 authorized; subsequent stages per plan)

**Goal.** Implement StoryForge V5 for production inside the MissionMed ecosystem, exactly as specified by the canonical artifact and the B1-500 engineering authority, so that real students and mentors can trust it: private means private, saved means persisted, submitted means received, reviewed means a real reviewer acted, originals cannot be silently overwritten, notifications represent real events, AI is clearly AI, and every visible control works or truthfully explains why it is unavailable.

**Authority and precedence.**
1. `_AI_HANDOFFS/from_cowork/B1-500_storyforge_v5_production_authority/storyforge-v5.html` — StoryForge V5 is the only approved product, UI, UX, visual-design, interaction, navigation, and workflow authority. No earlier StoryForge prototype may be used to determine product behavior. **Pin:** SHA-256 `3ac2871ff286552abe89a785ff43967df3315922e3718f67a136b83db1ba8db1`. Phase 0 item 0: verify this file is present and hash-matching before anything else; if it is missing or differs, stop and surface it. Executed behavior is canon; the file contains dead overridden layers (e.g., a superseded `renderPrep` near line 1381) — never implement from dead code; run the file and observe.
2. The rest of `_AI_HANDOFFS/from_cowork/B1-500_storyforge_v5_production_authority/` — read every document, fully, before writing code: STORYFORGE_V5_CANONICAL_LOCK (invariants + historical-material rules), STORYFORGE_V5_PRODUCT_TO_ENGINEERING_MAP (feature accountability + the 16 simulations that must not ship), STORYFORGE_V5_PRODUCTION_ARCHITECTURE (recommended architecture + draft DDL + your Phase 0 discovery list), STORYFORGE_V5_HIGH_RISK_SYSTEMS, STORYFORGE_V5_IMPLEMENTATION_AND_RELEASE_PLAN, STORYFORGE_V5_PROJECT_MEMORY, STORYFORGE_V5_INDEPENDENT_VERIFICATION.
3. `HISTORICAL_ENGINEERING_BASE_COMPLETE_COMBINED_HANDOFF.md` (same folder) — historical, **except** that the sections CANONICAL_LOCK §5 lists as "carried forward unamended" (the v2 review-lifecycle state machine and its transition/timestamp/notification table, the role/permission ownership rules, the audit-event shape, the notification trigger table, the Mentor Activity spec, the mentor workflow model) are **binding engineering input**, applied with the LOCK §5 amendments. Product behavior still comes from V5 in every case.
4. Repository AGENTS.md files — inspect before changing anything; follow repo conventions; create/extend a StoryForge AGENTS.md section recording conventions you establish.
All other historical StoryForge documents and prototypes are engineering history only; where anything conflicts with `storyforge-v5.html`, V5 wins automatically.

**The 20 product invariants in CANONICAL_LOCK §4 are binding.** If any implementation choice would violate one, stop and surface it rather than "solving" it.

**Context.** The canonical artifact is a browser prototype: all authority is client-side, persistence is localStorage, auth/roles/notifications/audio/AI/imports are simulated (the map's §A lists all 16 mechanisms with code anchors). Your job is to make every capability real per the map, on the architecture recommended (WordPress = identity/eligibility; Supabase Postgres + RLS = records and enforcement; R2 = audio/files; server functions for signed URLs, transcription, AI proxy, imports, notifications). The architecture document separates verified facts from founder-supplied environment statements from unknowns — treat the unknowns as your Phase 0.

**Stage 0 (authorized now).** Resolve the nine discovery items in PRODUCTION_ARCHITECTURE §9 with recorded evidence (paths, queries, screenshots) before any architecture-dependent implementation. Where findings contradict the recommended architecture, adapt, record the reason in the work log and PROJECT_MEMORY, and preserve the invariants. Produce a Phase 0 report. Then proceed through Stages 1–4 of the IMPLEMENTATION_AND_RELEASE_PLAN as authorized reversible work, and prepare Stages 5–6 up to their founder gates.

**Working rules.**
- Plan before broad multi-file changes (plan mode); keep milestones small enough to verify in one loop; stop-and-fix on any failing check before new scope.
- Use parallel subagents only for genuinely independent tracks (e.g., audio pipeline ∥ library UI ∥ notifications); isolate overlapping work in worktrees/branches; migrations and API contracts change only on the integration branch.
- Implement reversible authorized work without re-asking permission. Pause ONLY for: destructive actions, irreversible production changes (production migrations, DNS cutover, data deletion), credentials or access you lack, true scope changes, or founder-only decisions (retention policy, support-access policy, AI provider DPA, UAT approval, production go-live, AI promotion steps).
- Test continuously: the authorization matrix (every table/RPC × every role, positive and negative, against real Postgres) is release-blocking; state-machine tests; contract tests; Playwright E2E for Student View and Mentor View independently, including the canonical 10-step submit→review→revise→approve loop and the notification round-trip; screenshot comparison against the canonical artifact for key surfaces; axe accessibility checks.
- Verify the real UI in a real browser (Playwright); use screenshots for visual comparison with the canonical artifact.
- Test authorization server-side by crafting raw API requests that the UI would never make — the client is untrusted.
- Verify migration up/down behavior on a staging copy before any founder gate; record a PITR restore point before irreversible migrations.
- Never report demo/seeded behavior as production functionality. Audit every progress claim against tool evidence before reporting it.
- Continue until the authorized stage is complete or you are genuinely blocked; if blocked, state the exact missing input.

**Deliverables and records.** Save all implementation records under `_AI_HANDOFFS/from_codex/B1-500_storyforge_v5_production/`:
- ticket-scoped implementation notes per stage/track;
- verified test evidence (reports, screenshots, logs) — linked from every completion claim;
- migration and deployment records (including restore points and rollback rehearsal results);
- unresolved blockers with exact missing inputs;
- one full combined Markdown handoff containing every Markdown deliverable you produce;
- PROJECT_MEMORY updates: one concise note per non-obvious lesson (corrected decisions, rejected approaches and why, environment surprises).

**Done when (per stage):** the stage's completion criteria in IMPLEMENTATION_AND_RELEASE_PLAN are met with linked evidence; CI green; no invariant violated; founder-gate packets prepared where the plan requires them. Report outcomes, evidence, decisions, test results, and unresolved blockers — not process narration or private reasoning.
