# STORYFORGE_V5_IMPLEMENTATION_AND_RELEASE_PLAN
B1-500 · Recommended execution program for Codex (GPT-5.6 Sol). Large coherent stages sized for long-horizon runs; founder gates only at genuine irreversibility. Codex may improve the internal plan where repository evidence supports it, recording the reason, provided the canonical product and invariants are preserved.

## Stage 0 — Discovery and verified baseline
**Outcome:** the nine discovery items in Architecture §9 answered with evidence; a written Phase 0 report (file paths, screenshots, query results); architecture confirmations or recorded adaptations; AGENTS.md read (and created/extended for StoryForge conventions if absent).
**Dependencies:** repository + environment access. **Parallel:** repo inventory, WP/LearnDash inspection, Supabase/Cloudflare inspection can run as parallel read-only investigations.
**Completion:** every "unverified" item in the architecture is marked verified/adapted; migration scope (legacy data yes/no) decided; **founder gate only if** discovery reveals a materially different environment than the architecture assumes (e.g., no Supabase at all).
**Rollback:** none — read-only.

## Stage 1 — Foundation: schema, authorization, trust primitives
**Outcome:** Supabase schema + RLS + immutability triggers migrated; WP→StoryForge JWT bridge working end-to-end in staging; lifecycle RPCs; audit + notification write paths (transactional); seed fixtures (the 26-question MissionMed library; dev-only demo roster); CI running the authorization test matrix and state-machine tests.
**Dependencies:** Stage 0. **Parallel:** JWT bridge (WP plugin work) ∥ schema/RLS ∥ CI scaffolding — three independent tracks; coordinate on the claims contract first.
**Tests/evidence:** full auth matrix green against real Postgres; immutability trigger tests; transition tests; bridge E2E (real WP staging login → authorized query).
**Completion:** a script can demonstrate: student creates story (private) → mentor cannot read it → student submits → assigned mentor reads, unassigned cannot — all via raw API.
**Migration/rollback:** new tables only; reversible; no founder gate.

## Stage 2 — Student experience
**Outcome:** the complete canonical Student View live against the real backend: shell + rail + six environments + settings sync; capture (text + real voice recording, resumable upload, transcription with truthful states, durable drafts); Story Library rows/filters; centered Quick Look; full workspace (originals chain, lesson, reflections, statuses, timestamps, scores, stars, classifications, uses, history); Notifications page + badge.
**Dependencies:** Stage 1. **Parallel:** audio/transcription pipeline ∥ library+workspace UI ∥ notifications UI (worktree-isolated; shared component/tokens package landed first).
**Tests/evidence:** Playwright student suite incl. capture-with-interruption, submit flow, notification round-trip (using a mentor test account via API), screenshot comparison with the canonical artifact on Home/Library/Quick Look/Workspace; axe checks.
**Completion:** a real student account can live the full pre-mentor experience with nothing simulated.

## Stage 3 — Mentor experience
**Outcome:** Mentor Home, Students roster (cohorts, sorts, counts), per-student workspace with filters, five-bucket Review Queue, My Activity (filters incl. custom range), centered Quick Review with one-click statuses, full-review powers (feedback, asks, scores, stars, classifications, suggestions), Teaching Mode (compare, hide-names rules, Story Anatomy, live actions), 1:1 sessions, coaching history.
**Dependencies:** Stage 2 (shared components + lifecycle live). **Parallel:** queue/activity ∥ teaching/1:1 ∥ quick-review powers.
**Tests/evidence:** mentor Playwright suite; two-mentor attribution tests; the canonical 10-step loop E2E (student submit → mentor open-without-review → review actions → status → student notification → revise → resubmit → re-review bucket → approve → history); authorization probes from the mentor session.
**Completion:** two real mentor accounts and one student account can run the entire coaching loop with correct attribution and privacy.

## Stage 4 — Interview Intelligence + Question Library + AI (flagged)
**Outcome:** Prep landing (families, readiness), Question Workshops (pairs, dual strengths, preferred, why, coaching notes, gaps), Next Natural Questions (manual, full CRUD + prepared + notes + sources), Question Library view + governance states, import pipeline (paste + CSV/XLSX at minimum; remaining parsers immediately after), Assign drawer; AI proxy + general-suggestion mentor beta behind a server flag; student AI button gated truthfully; clinical mode manual-first.
**Dependencies:** Stage 3. **Parallel:** workshops UI ∥ import pipeline ∥ AI proxy.
**Tests/evidence:** workshop E2E both roles; import corpus incl. malicious files + rollback; AI contract/injection/redaction tests; flag-state tests (AI off = truthful gates, zero fake responses).
**Completion:** the full V5 Interview Intelligence experience works for real accounts, with AI exactly as gated in the map §L.

## Stage 5 — Migration, staging hardening, UAT — **founder gate**
**Outcome:** staging environment fully populated (real WP-staging SSO; migrated legacy data if Stage 0 found any, with a validation report; otherwise production seed = question library only); performance pass at scale fixtures (300-story libraries, 100+ students); accessibility pass; backup-restore drill; rollback drill; complete E2E suite green in staging; UAT script for the founder (student persona + mentor persona walkthrough).
**Founder gate:** approve staging UAT + retention/access policy decisions before production.
**Migration/rollback:** legacy migration rehearsed with down-path or restore point; irreversible steps enumerated explicitly at the gate.

## Stage 6 — Production deployment and post-deployment verification — **founder gate to cut over**
**Outcome:** production infrastructure provisioned (DNS/path under Matrix, secrets, buckets, flags off-by-default for AI), forward migration run, smoke suite against production (synthetic accounts), monitoring + alerts live, runbook published, rollback verified available (asset rollback + DB PITR point recorded pre-migration).
**Post-deployment verification:** the 10-step loop executed by real founder-designated pilot accounts; authorization probes against production; audio round-trip; notification latency check. A written go-live report with evidence.
**Rollback:** documented one-command asset rollback + PITR procedure; decision criteria pre-agreed.

## Stage 7 — Post-launch: AI promotion and clinical intelligence
**Outcome:** mentor-beta review → student general-AI enablement decision; clinical evaluation program (eval set, hallucination testing, mentor panel) → clinical generator mentor beta → student clinical, each behind its flag with a written gate report. Optional email digests decided/implemented here.
**Founder gates:** each AI promotion step.

## Program rules
- Plan before each stage's broad multi-file changes; keep the spec (canonical artifact + this package) frozen — implementation adapts, product does not.
- Worktree/branch isolation for parallel tracks; migrations and API contracts change only on the integration branch with coordinated review.
- Continuous testing: every stage keeps CI green; a failing check is fixed before new scope (stop-and-fix).
- Evidence discipline: no stage is "done" by narrative — each completion claim links to tests, screenshots, or logs. Demo behavior is never reported as production behavior.
- Support & monitoring after GA: alert triage runbook, weekly audit-anomaly review, AI spend review, quarterly restore drill.
