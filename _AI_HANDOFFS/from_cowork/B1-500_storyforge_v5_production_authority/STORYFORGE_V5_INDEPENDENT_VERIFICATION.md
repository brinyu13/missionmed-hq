# STORYFORGE_V5_INDEPENDENT_VERIFICATION
B1-500 · Verification record, corrections, remaining unknowns, founder decisions, readiness verdict.

## 1. Verification performed

**Inputs verified during authoring (three independent subagent workstreams):**
- **Codex platform research** against current first-party OpenAI sources (openai.com, developers.openai.com, github.com/openai/codex, help.openai.com): confirmed GPT-5.6 Sol exists and is the flagship coding model (GA July 9, 2026), API slug `gpt-5.6-sol`; "Ultra" is a multi-agent reasoning mode, not a model; `model_reasoning_effort="xhigh"` is the confirmed config literal; current sandbox (`read-only|workspace-write|danger-full-access`) and approval (`untrusted|on-request|never`) values; AGENTS.md conventions; plan mode; worktrees/subagents/cloud; `codex resume`; the long-horizon four-file pattern. Unconfirmed items are labeled in the execution prompt (exact TOML strings for `max`/Ultra effort; whether the CLI picker uses `gpt-5.6-sol` or the `gpt-5.6` alias).
- **Canonical extraction:** a full read of `storyforge-v5.html` produced an 81-item capability inventory and a 16-item simulation inventory with code anchors; both drove the Product-to-Engineering Map.
- **Historical contradiction audit:** every canonicity claim in older documents located and quoted; superseded UI statements enumerated; carry-forward engineering content identified with amendments — the basis of CANONICAL_LOCK §§2–5.

**Fresh-context package audit (independent reviewer agent, after authoring):** read all package documents, ran the canonical artifact headless (Playwright), and spot-checked the package against executed behavior across the seven required dimensions. All behavioral spot-checks passed (statuses and labels, nine timestamps, centered Quick Look measured at runtime, stoplight dots, lesson-on-row, six environments and names, 26 questions / 7-family taxonomy confirmed at runtime, pair model incl. `why`/`fups`/`qpref`/`qcoach`, import duplicates unchecked by default, Teaching Mode hide-names defaults and "Story A/B" labels, coalescing branch behavior, `firstOpened` without status change, `feedbackSent` only from real comments). Authority hygiene was clean: no package sentence treats an older artifact as product authority; the required declaration appears verbatim in the LOCK and the Codex prompt.

## 2. Findings and corrections (all resolved before completion)

1. **CRITICAL — the Codex prompt did not locate or pin the canonical artifact, and the carried-forward historical sections had no path.** Fixed: the canonical artifact is now bundled inside the package with its SHA-256 (`3ac2871ff286552abe89a785ff43967df3315922e3718f67a136b83db1ba8db1`) pinned in the prompt; hash verification is Phase 0 item 0; the historical engineering base is bundled as `HISTORICAL_ENGINEERING_BASE_COMPLETE_COMBINED_HANDOFF.md` and its carried-forward sections are declared binding engineering input.
2. Dangling reference to this verification document — fixed by producing it and adding it to the prompt's read list.
3. Draft DDL lacked three requirements stated elsewhere in the package (mentor use-suggestions table, audit `surface` column, soft-delete column) — added.
4. Coalescing rule was stated less precisely than canon (blanket "status preserved" could keep a stale status over a newer one) — corrected to the exact branch rule in the Map and the Lock.
5. "You/DB/AI" badge lexicon invited a hardcoded mentor label — corrected to actor-derived mentor initials.
6. "7 family cards" overstated the default landing (Custom renders only when custom questions exist) — corrected.

## 3. Remaining unknowns (honestly labeled; converted to Codex Phase 0)

Fable had no MissionMed repository or infrastructure access in this run. Everything about the current repository, WordPress/LearnDash configuration, Supabase project state, Cloudflare/R2 setup, existing StoryForge code or legacy data, notification/email infrastructure, deployment pipeline, and mentor-assignment source of truth is unverified and is enumerated as mandatory Phase 0 discovery (Architecture §9, ten items including the hash check). Also unconfirmed: exact TOML literals for Codex `max`/Ultra effort (set in-session and record).

## 4. Founder decisions still required

1. Audio/data retention policy (retention length, account deletion/export, post-Match archival).
2. Support/emergency access policy — whether any admin path to private stories exists at all.
3. AI provider selection sign-off (data-processing agreement, no-training terms) and budget caps.
4. Email notifications — in or out of scope post-GA.
5. Production URL/path for StoryForge inside the Matrix.
6. Staging UAT approval (Stage 5 gate) and production go-live (Stage 6 gate).
7. Each AI promotion step (student general AI; clinical mentor beta; clinical student) — Stage 7 gates.
8. Legacy migration scope, if Phase 0 discovers real prior StoryForge data.

## 5. Readiness verdict

**READY.** The independent audit's verdict was ready-after-fixes; all six findings were corrected and re-checked. The package is self-contained (canonical artifact bundled and hash-pinned), internally consistent, honest about unknowns, and executable by Codex starting at Phase 0 without product guessing. Genuine blockers to implementation are limited to access Codex will have and Fable did not: the MissionMed repository, WordPress/Supabase/Cloudflare environments, and credentials — plus the founder decisions above at their gates.
