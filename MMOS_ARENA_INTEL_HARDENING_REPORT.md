# MMOS-ARENA-INTEL PRE-LAUNCH HARDENING REPORT

**System:** MMOS-ARENA-INTEL-01
**Date:** 2026-04-27
**Prompt:** (Z)-MMOS-ARENA-INTEL-claude-high-600
**Risk Classification:** LOW (CONTENT / AUDIT / STRATEGY)
**Authority:** PRIMER_CORE.md, DATA_FLOW_CONTRACT.md, MMOS_MODE_PATTERN.md, STAT_CANON_SPEC.md

---

## 1. FAILURE MAP

### F-01: CDN Unavailable (Cloudflare R2 down)
- **What user sees:** Blank screen or broken layout. Arena shell loads from WordPress but JS/CSS assets from R2 fail. Console shows 404/503 on CDN URLs.
- **What system should do:** Arena auth bootstrap detects missing MMOS core (window.MMOS undefined after 5s). Show a branded "Arena is temporarily unavailable" static fallback page served from WordPress origin. Log CDN failure to console with `[ARENA_CDN_FAIL]` tag.
- **What MUST NOT happen:** User stuck on infinite loader with no explanation. User seeing raw HTML scaffolding without styles. System silently degrading into a half-functional state where some modes work and others do not.

### F-02: Pipeline Delay (intel_jobs stuck in pending/running)
- **What user sees:** HUD shows stale intelligence data. "Last updated" timestamp is hours old. Diagnostic insights reflect yesterday's performance, not today's.
- **What system should do:** HUD displays last-known-good snapshot with a visible "Updated X hours ago" timestamp. If data is >24h stale, show a muted disclaimer: "Your insights are being refreshed." Never show empty panels.
- **What MUST NOT happen:** User sees "real-time" label on data that is 12 hours old. System shows a loading spinner indefinitely waiting for pipeline. User assumes their current performance is reflected when it is not.

### F-03: Missing Snapshots (no computed snapshot for user)
- **What user sees:** HUD intel panels are empty. No topic breakdown, no strength/weakness map, no study plan.
- **What system should do:** Detect zero snapshots for user_id. Render onboarding state: "Complete your first Arena session to unlock your performance intelligence." Show a single clear CTA pointing to Drills or STAT duel. Do not render empty chart containers or skeleton loaders.
- **What MUST NOT happen:** Empty charts with axis labels and no data points. Generic "No data" error that feels broken. System computing a snapshot from zero answers and presenting fabricated intelligence.

### F-04: Empty Diagnostics (snapshot exists but diagnostic engine returns nothing)
- **What user sees:** Performance snapshot shows numbers (accuracy, speed) but the diagnostic narrative section is blank.
- **What system should do:** Show quantitative panels (accuracy %, response time, topic breakdown) without diagnostic commentary. Display: "More practice data needed for detailed insights." Hide the diagnostic section entirely rather than showing an empty container.
- **What MUST NOT happen:** Partial diagnostic text that cuts off mid-sentence. System inventing diagnostic insights from insufficient data. A visible "Error" label on what should be a graceful degradation.

### F-05: Stale Enrollment (enrollment_status = 'stale' in student_profiles)
- **What user sees:** System is unsure whether user is enrolled or free. Could display wrong tier features.
- **What system should do:** When enrollment_status = 'stale', treat as free tier for feature gating (conservative). Trigger background enrollment sync via LearnDash verification. If sync succeeds, upgrade in-session without page reload. If sync fails, maintain free tier and set last_enrollment_error.
- **What MUST NOT happen:** User with active paid enrollment locked out of features they paid for, with no path to resolution. System granting paid features to a stale-status free user. Silent enrollment check that blocks page load.

### F-06: RLS Blocking Unexpected Flows
- **What user sees:** RPC calls fail silently. HUD shows stale or missing data with no error message.
- **What system should do:** Every Supabase RPC call wraps in try/catch. On RLS denial (403 or empty result set where data is expected), log `[RLS_DENY]` with table name and user_id hash. Surface: "Unable to load your data. Please try refreshing." with a refresh button.
- **What MUST NOT happen:** Silent data omission where user sees partial dashboard and assumes they have no data. Unhandled promise rejection crashing the HUD. System exposing RLS error internals ("policy violation on student_profiles") to the student.

### F-07: Partial Data (user has duel history but no daily_participation, or vice versa)
- **What user sees:** Some HUD panels populated, others empty. Looks inconsistent.
- **What system should do:** qstat_answers_v1 view handles this via UNION ALL across all four source types. If one source is empty, others still populate. HUD panels should render with whatever data exists and suppress panels that have zero relevant rows. No panel should show "0%" when the actual situation is "no data."
- **What MUST NOT happen:** Accuracy showing 0% (misleading) vs "no data" (accurate). Topic breakdown showing topics from one source but not another, creating false weakness signals.

### F-08: Race Conditions (concurrent snapshot computation for same user)
- **What user sees:** Nothing visible if handled correctly. Incorrect if not: two different snapshot versions, flickering data.
- **What system should do:** intel_jobs.dedupe_key ensures only one job per user per pipeline_stage can exist. claim_jobs uses `FOR UPDATE SKIP LOCKED`. If two workers try to claim the same job, one gets it and the other moves on. Watermarks track last processed event per user/stage.
- **What MUST NOT happen:** Two snapshot computations running simultaneously producing conflicting results. One overwriting the other mid-write. User seeing snapshot data oscillate between two versions on refresh.

### F-09: Timer Desync (client clock vs server clock drift)
- **What user sees:** Response times appear wrong. "Completed 2 hours ago" when it was 5 minutes ago.
- **What system should do:** All timestamps in qstat_answers_v1 come from server-side (answered_at from submitted_at, completed_at, created_at). Client should display relative times ("5 min ago") computed against server timestamp returned in the most recent RPC response, not client Date.now().
- **What MUST NOT happen:** Client computing relative times against local clock, producing "in the future" or wildly wrong durations. Absolute timestamps displayed without timezone context.

### F-10: User Abandons Flow Mid-Action (closes browser during snapshot computation or study plan generation)
- **What user sees:** On return: either stale data or the system picks up where it left off.
- **What system should do:** Jobs are stateless from the client perspective. If a job was running when user left, it either completes (succeeds/fails) server-side regardless. On next page load, client fetches latest snapshot. If job is still running, show "Your insights are being prepared" with last-known-good data. intel_watermarks prevent reprocessing already-handled events.
- **What MUST NOT happen:** Orphaned running jobs that never complete (claim_jobs timeout + fail_job with exponential backoff handles this). User returning to see a permanent "loading" state. Data loss from abandoned session.

### F-11: Auth Token Expired Mid-Session
- **What user sees:** Was using Arena normally. Suddenly RPCs fail. HUD stops updating.
- **What system should do:** Per DATA_FLOW_CONTRACT 6.1: Supabase JS client manages token refresh automatically. If refresh fails (Railway down), detect 401 on any RPC, trigger re-auth via /api/auth/exchange then /api/auth/bootstrap. If WordPress session also expired, redirect to login.
- **What MUST NOT happen:** Silent degradation where old cached data remains on screen but new actions fail without explanation. Infinite retry loop hammering Railway. User losing unsaved state without warning.

---

## 2. UX HARDENING RULES

### UXR-01: Empty User (never used Arena)
- No student_profiles row exists. No qstat_answers_v1 rows. No snapshots.
- **Display:** Full onboarding state. Show Arena lobby with prominent "Start Your First Session" CTA. HUD intel section shows a single card: "Complete your first practice session to unlock personalized intelligence." No charts, no metrics, no skeleton loaders.
- **Messaging tone:** Inviting, not empty. "Your performance dashboard activates after your first session" not "No data found."

### UXR-02: Low-Data User (1-10 total answers across all sources)
- student_profiles exists. Fewer than 10 rows in qstat_answers_v1.
- **Display:** Show raw metrics only: total questions answered, overall accuracy %, average response time. No topic breakdown (insufficient per-topic sample). No diagnostic narrative. No study plan.
- **Messaging:** "Answer 10+ questions to unlock topic-level insights." Show a progress indicator toward the insight threshold. Make the threshold feel achievable, not arbitrary.
- **Critical rule:** Never compute a topic accuracy percentage from fewer than 3 answers in that topic. Display "Exploring" instead of a misleading percentage.

### UXR-03: Stale-Data User (has history but last activity >7 days ago)
- Snapshots exist but are outdated. enrollment_status may be stale.
- **Display:** Show last snapshot with clear "Last active: [date]" label. Diagnostic section shows: "Welcome back. Your last insights are from [date]. Jump into a session to refresh your dashboard."
- **Messaging tone:** Welcoming return, not punitive. No "You've been inactive" shaming. Emphasize what they accomplished before, then invite them to continue.

### UXR-04: Enrolled vs Free Tier
- enrollment_tier array in student_profiles determines feature access.
- **Free tier sees:** Basic accuracy/speed metrics from their practice sessions. Topic list (names only, no deep analysis). "Upgrade to unlock full diagnostic intelligence, personalized study plans, and weakness targeting."
- **Enrolled tier sees:** Full diagnostic engine output. Personalized study plan. Topic-level drill recommendations. Priority queue of weakest areas.
- **Critical rule:** Free users must NEVER see locked panels with blurred content (feels manipulative). Show what they get cleanly, and a single upgrade CTA. Enrolled users must NEVER see upgrade prompts.

### UXR-05: Enrollment Grace Period
- enrollment_grace_expires_at allows temporary access after enrollment lapses.
- **Display during grace:** Full enrolled features with a subtle banner: "Your enrollment access expires on [date]. Contact admissions to continue." No countdown timer. No urgency manipulation.
- **Display after grace:** Downgrade to free tier immediately. Show: "Your enrolled access has expired. Your data is preserved. Contact us to reactivate."

### UXR-06: Messaging Hierarchy
- **Priority 1 (blocking):** Auth failures, CDN failures, system errors. Full-screen overlay with action button.
- **Priority 2 (contextual):** Stale data warnings, enrollment status. Inline banner within the HUD, dismissible.
- **Priority 3 (ambient):** Progress toward thresholds, motivational nudges. Embedded in panel content, never overlay.
- **Rule:** Never stack more than one Priority 1 message. Never show Priority 3 if Priority 1 or 2 is active.

---

## 3. HUD IMPROVEMENTS

### HUD-01: Today Focus Logic
- **Current risk:** "Today Focus" could show the same recommendation daily if the user does not act on it.
- **Improvement:** Today Focus should cycle through a priority queue: (1) Weakest topic by accuracy (minimum 5 answers in topic), (2) Fastest-declining topic (accuracy dropped >10% over last 3 sessions), (3) Longest-untouched topic (no answers in >7 days), (4) Random from middle-tier topics if all strong. Each day surfaces the top item from the queue. If the user completes a session in that topic, mark it as addressed and surface the next item on next visit.
- **Fallback:** If no topics qualify (new user, insufficient data), Today Focus shows: "Jump into any practice session to get started." Not a recommendation, just a launch point.

### HUD-02: Mission Intel Messaging
- **Current risk:** Intelligence summaries could read as generic or AI-generated.
- **Improvement:** All diagnostic messages must reference specific, concrete data points from the user's performance. Instead of "You need to improve in Cardiology," write "Cardiology: 4 of 10 correct (40%). Your last 3 attempts show improvement." Every statement must be traceable to a number. No vague motivational language. No superlatives ("great job!") unless accuracy is >90% with sample size >20.
- **Formatting rule:** Lead with the metric. Follow with the trend. End with the action. Example: "Pharmacology: 62% accuracy (13 questions). Down from 71% last week. Recommended: 10-question Pharmacology drill."

### HUD-03: Task Prioritization
- **Current risk:** User sees a flat list of recommendations with no clear starting point.
- **Improvement:** Rank all recommendations by impact score: (topic_weight * accuracy_gap * recency_factor). Show maximum 3 recommendations at a time. Number them: "#1 Priority", "#2", "#3". Each recommendation includes estimated time ("~5 min drill") and expected impact ("targets your weakest area"). Collapse additional recommendations behind "Show more" if they exist.
- **Rule:** Never show more than 3 active recommendations. Cognitive overload kills engagement.

### HUD-04: Cognitive Load Reduction
- **Current risk:** Dense data panels compete for attention. User does not know where to look first.
- **Improvement:** Enforce visual hierarchy: (1) One hero metric at the top (overall readiness score or primary accuracy), (2) Today Focus card directly below, (3) Topic breakdown below that, (4) Detailed analytics in expandable sections. Default state on page load shows only the hero metric and Today Focus. Everything else loads below the fold or in collapsed sections.
- **Rule:** Above-the-fold content on HUD load must answer one question: "What should I do right now?" Everything else is secondary.

---

## 4. TRUST MODEL

### T-01: Avoid Misleading Users
- Never present computed insights with more precision than the data supports. If a user has answered 5 Cardiology questions, do not show "67.3% accuracy." Show "3 of 5 correct." Percentages require minimum 10 answers in a category.
- Never present trend data from fewer than 3 data points. Two sessions is not a trend.
- Never say "predicted" or "estimated" without disclosing the basis. If a study plan assumes 30 minutes/day, state that assumption.

### T-02: Build Trust with Data
- Show the user their raw numbers alongside any computed metric. If the HUD says "Improving in Anatomy," show the underlying data: "Session 1: 4/10, Session 2: 6/10, Session 3: 7/10." Let the user verify the claim.
- Timestamp everything. Every metric panel should show when the data was last computed. "Based on 47 answers through April 27."
- Show data sources. If the accuracy number combines duel answers, daily participation, and drill attempts, show the breakdown: "Duels: 72%, Daily: 68%, Drills: 75%."

### T-03: Avoid "Fake Intelligence"
- Never generate diagnostic text when the data is insufficient. An empty diagnostic panel with a clear threshold message is infinitely more trustworthy than a fabricated insight from 3 data points.
- Never use hedge words to mask data gaps ("You might be struggling with..."). Either the data supports the claim or it does not. If it does not, say "Not enough data yet."
- Never show a "study plan" generated from fewer than 20 total answers. Below that threshold, the plan would be noise. Show: "Complete 20+ questions across multiple topics to generate your personalized study plan."

### T-04: Handle Uncertainty
- When confidence is low (sparse data, conflicting signals across sources), explicitly label it: "Low confidence: based on 6 answers." Use visual differentiation: full-opacity for high-confidence metrics (20+ answers), reduced opacity or a subtle indicator for low-confidence metrics (5-19 answers), and omission for insufficient data (<5 answers).
- Never present a single bad session as a trend reversal. Require 2+ consecutive sessions showing the same direction before labeling it a trend.
- When the pipeline is delayed and data is stale, do not hide the staleness. Show it. "Insights current as of 6 hours ago" is honest. Showing hours-old data with no timestamp is deceptive.

---

## 5. EDGE CASES

### E-01: User with Answers Only from Deprecated Source Types
- qstat_answers_v1 unions 4 source types. If a source type is deprecated in a future migration but existing rows remain, the view still includes them. No action needed at view level, but the diagnostic engine must not weight deprecated source types equally with current ones. Add source_type weighting: current sources = 1.0, deprecated = 0.5.

### E-02: Multiple Devices / Concurrent Sessions
- User opens Arena HUD on laptop and phone simultaneously. Both fetch the same snapshot. No conflict. If user completes a drill on phone while viewing HUD on laptop, the laptop HUD shows stale data until refresh.
- **Rule:** Do not implement WebSocket push for snapshot updates (over-engineering). Accept that the laptop view goes stale. On next user interaction (click, tab focus), trigger a lightweight freshness check. If snapshot timestamp has advanced, refresh the data.

### E-03: Session Expiry Mid-RPC
- User's Supabase token expires between clicking "Generate Study Plan" and the RPC response arriving.
- **What happens:** RPC returns 401. Supabase JS client auto-refreshes token and retries. If refresh also fails (Railway down), the auto-refresh fails and the RPC rejects.
- **What HUD should do:** Catch the rejection. Show: "Session expired. Refreshing..." Attempt re-auth. If re-auth fails: "Please log in again" with login redirect button. Never retry the original action silently more than once.

### E-04: User Enrolled in Multiple Tiers Simultaneously
- enrollment_tier is text[]. A user could have `['free', 'bootcamp', 'masterclass']` if the sync is not deduplicating.
- **Rule:** Feature gating checks for the highest tier present. Priority: '360_elite' > 'masterclass' > 'bootcamp' > 'free'. If array contains 'masterclass', grant masterclass features regardless of other entries.

### E-05: Question Metadata Missing for Some Questions
- User answered questions that have no row in question_metadata. Topic breakdown shows "Unknown Topic" bucket.
- **Rule:** Never hide unclassified answers. Show them in an "Other" or "Uncategorized" bucket. Do not count them toward any specific topic accuracy. Include them in overall accuracy. Flag in admin/system logs: `[QMETA_MISS] question_id=X has no metadata row.`

### E-06: Extremely Fast Answers (response_ms < 500)
- Could indicate random clicking, auto-submit bug, or network-level deduplication error.
- **Rule:** Include in raw count but flag in diagnostic engine. If >50% of a user's answers in a session are <500ms, add a disclaimer to that session's metrics: "Some responses were faster than typical reading time." Do not silently exclude them (that would be data manipulation).

### E-07: User Deletes Their WordPress Account
- auth.users(id) ON DELETE CASCADE propagates to student_profiles, intel_watermarks. intel_event_inbox.user_id is SET NULL.
- **What happens:** All user-specific intelligence is deleted. Inbox events become anonymous (user_id NULL). Jobs in flight for that user will complete but the results write to a now-deleted student_profiles row (no-op due to CASCADE).
- **Rule:** This is correct behavior. No orphan cleanup needed. The ON DELETE CASCADE chain handles it. But: if a user contacts support asking to restore data, there is no recovery path. This should be documented in the support playbook.

### E-08: Pipeline Job Enters 'dead' State (max_attempts exhausted)
- fail_job transitions to 'dead' after max_attempts (default 5).
- **What user sees:** Permanently stale snapshot for the affected pipeline stage.
- **What system should do:** Admin monitoring should alert on dead jobs. Dead jobs need manual triage: check last_error, fix root cause, then manually reset to pending with `UPDATE intel_jobs SET status = 'pending', attempts = 0 WHERE id = X`.
- **What MUST NOT happen:** Dead jobs silently accumulating with no alerting. User's intelligence permanently stuck without admin awareness.

---

## 6. PRODUCT RISKS

### PR-01: Intelligence Feels Generic
- **Risk:** If diagnostic messages use templated language ("You should practice more Cardiology"), users will perceive the system as a glorified calculator, not intelligence. They will stop checking it.
- **Mitigation:** Every diagnostic statement must cite specific numbers. Every recommendation must include a concrete action with estimated time. Review diagnostic output templates for any sentence that could apply to every user identically and rewrite it to require user-specific data interpolation.

### PR-02: Cold Start Feels Empty
- **Risk:** New user logs in, sees an empty HUD, and concludes the system has nothing for them. First impressions determine adoption.
- **Mitigation:** UXR-01 onboarding state must feel designed, not accidental. Show a clear path: "Step 1: Choose a topic. Step 2: Answer 10 questions. Step 3: See your first insights." Make the empty state a feature, not an error.

### PR-03: Stale Data Erodes Trust
- **Risk:** User completes a drill, returns to HUD, sees the same old data. Thinks the system is broken. Does this twice and stops trusting it.
- **Mitigation:** After any drill/duel completion, show a "Refreshing your insights..." indicator on HUD load. Even if the pipeline takes 30 seconds, the user knows the system is working. Never show stale data without a timestamp.

### PR-04: Enrollment Gating Feels Punitive
- **Risk:** Free users see locked features and feel the free tier is useless. They leave instead of upgrading.
- **Mitigation:** Free tier must deliver genuine value: overall accuracy, basic topic awareness, session history. The upgrade path should feel like "more depth" not "the actual product." Never show a feature, blur it, and put a lock icon on it.

### PR-05: Cognitive Overload on Return
- **Risk:** A returning user with 200+ answers sees dense analytics and does not know what to do. Analysis paralysis leads to disengagement.
- **Mitigation:** HUD-04 hierarchy. One question answered above the fold: "What should I do right now?" Everything else is opt-in depth.

### PR-06: Study Plan Feels Disconnected from Practice
- **Risk:** Study plan says "Focus on Pharmacology" but user cannot directly launch a Pharmacology drill from the plan. Manual navigation breaks the flow.
- **Mitigation:** Every study plan recommendation must include a direct-action link/button that launches the relevant drill or topic filter in one click. Recommendation without action is decoration.

---

## 7. HIGH ROI IMPROVEMENTS (No New Systems)

### IMP-01: Add Freshness Indicator to Every HUD Panel
- **Effort:** Low (frontend display logic)
- **Impact:** Directly addresses trust erosion (PR-03, T-04)
- **Implementation:** Each panel footer shows "Based on N answers through [date]". Computed from MAX(answered_at) in the underlying snapshot data. No new queries needed; the snapshot already contains the timestamp range.

### IMP-02: Minimum Sample Size Guards in Diagnostic Engine
- **Effort:** Low (conditional logic in snapshot computation)
- **Impact:** Prevents fake intelligence (T-03, E-05, E-06)
- **Implementation:** Before computing any topic-level metric, check answer count for that topic. <3 answers: omit topic entirely. 3-9 answers: show count only ("5 questions attempted"), no percentage. 10+: show full metrics. Add this as a guard at the computation layer, not the display layer.

### IMP-03: One-Click Drill Launch from Study Plan
- **Effort:** Medium (frontend wiring to existing drill routing)
- **Impact:** Directly addresses disconnection risk (PR-06)
- **Implementation:** Study plan recommendations include a concept_id or topic from question_metadata. Map this to the existing drill_registry/menu_categories to find relevant drills. Render a "Practice Now" button that calls the existing drill launch flow with the topic pre-selected. Uses existing MMOS.navigate infrastructure.

### IMP-04: Onboarding Progress Bar for New Users
- **Effort:** Low (frontend component)
- **Impact:** Addresses cold start risk (PR-02)
- **Implementation:** For users with <20 total answers, show a progress bar: "5/20 questions answered. 15 more to unlock your full dashboard." When they cross 20, celebrate briefly ("Your dashboard is ready!") and transition to the full HUD. Threshold data comes from COUNT(*) on qstat_answers_v1 for user_id.

### IMP-05: Dead Job Alerting
- **Effort:** Low (SQL query + scheduled check)
- **Implementation:** Scheduled query: `SELECT * FROM intel_jobs WHERE status = 'dead' AND updated_at > now() - interval '24 hours'`. If rows exist, log to a monitoring channel or admin dashboard. No new infrastructure. Can run as a Supabase edge function on a cron or as a manual admin query.
- **Impact:** Prevents silent pipeline failures (E-08, F-02).

### IMP-06: Enrollment Sync Retry on Page Load
- **Effort:** Low (frontend logic on HUD init)
- **Impact:** Addresses stale enrollment (F-05, UXR-04)
- **Implementation:** On HUD load, if student_profiles.enrollment_status = 'stale' AND last_enrollment_sync_attempt_at is >1 hour ago, trigger a background LearnDash verification call. If it returns an active enrollment, update student_profiles and refresh feature gating in-session. Rate-limit to once per hour to prevent hammering.

### IMP-07: Suppress Diagnostic Narrative Below Threshold
- **Effort:** Low (conditional rendering)
- **Impact:** Prevents generic/fake intelligence (PR-01, T-03)
- **Implementation:** If total qstat_answers_v1 count for user < 20, hide the diagnostic narrative section entirely. Show only raw metrics. The diagnostic engine should not even run below this threshold. Add a `DIAGNOSTIC_MIN_ANSWERS = 20` constant. This is a display rule, not a computation rule.

---

## EXECUTION REPORT

**WHAT WAS DONE:**
- Loaded PRIMER_CORE.md (system authority)
- Loaded KNOWLEDGE_INDEX.md (routing)
- Loaded all 4 MMOS-ARENA-INTEL Supabase migrations (P0 question_metadata, P0 qstat_answers_v1 view, P0 student_profiles enrollment, P1 pipeline core)
- Loaded arena.html production file (version header + change log)
- Loaded MMOS_MODE_PATTERN.md (canonical mode lifecycle)
- Loaded DATA_FLOW_CONTRACT.md (full data architecture)
- Loaded STAT_CANON_SPEC.md (duel contract)
- Loaded RULES_ENGINE.md (active rules)
- Produced 7-section hardening report covering: 11 failure modes, 6 UX hardening rules, 4 HUD improvements, 4 trust model principles, 8 edge cases, 6 product risks, 7 high-ROI improvements

**RESULT:**
Complete pre-launch hardening analysis delivered. All sections address existing system components only. No new features proposed. No architecture changes proposed.

**ISSUES:**
- LEARNINGS_LOG.jsonl referenced in RULES_ENGINE.md RULE-001 but file existence not confirmed at the canonical path. Non-blocking for this audit task.
- KNOWLEDGE_INDEX.md found at backup path (07_BACKUPS) rather than canonical path (08_AI_SYSTEM). The canonical path referenced in PRIMER_CORE.md should be verified.

**RISK LEVEL:** LOW (CONTENT / AUDIT / STRATEGY)

**STATUS:** COMPLETE

---

## NEXT ACTION

Prioritize implementation of IMP-02 (minimum sample size guards) and IMP-01 (freshness indicators) as they are the lowest-effort, highest-trust-impact items. Then IMP-04 (onboarding progress bar) and IMP-07 (suppress diagnostic below threshold) to address the cold start and fake intelligence risks. IMP-03 (one-click drill launch) is the highest-impact UX improvement but requires medium effort for drill routing wiring.
