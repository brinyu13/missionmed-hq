# B1-513R Administrator View — Mirrored UX Final

**Hard law implemented: Administrator View is StoryForge Student View with administrative superpowers — not another app.**

**Shell.** The advisor cyan accent-swap is neutralized: Administrator View runs the same navy/orange shell, typography, cards, spacing, environments, and interaction language as Student View. Cyan survives only as the restrained admin-state accent: the small `ADMIN` badge, thin Mentor-Review-rail border, and status chips that were already cyan for students. Nav: Home · Students · Review Queue · Content Studio · System Controls (Question Library reachable from Content Studio, preserved, de-emphasized).

**Admin Home (shot 40).** Answers **"Who needs my attention today?"** — the same greeting hero as Student Home, then attention buckets in priority order, each a StoryForge panel of student cards: **Needs Review** (submitted work waiting) · **Needs a Nudge** (quiet 14+ days with work in flight) · **Changes Returned** (waiting on revision) · **Never Started / Quiet** (eligible, nothing yet) · **Making Progress** (active this week). Aggregate metrics are demoted to one quiet stat line at the bottom. Buckets derive from the existing directory aggregates — no new schema.

**Students (shot 41).** The ledger is gone. StoryForge-style card rows exactly per the Founder example: `[avatar] Maya Osei · Active 2 days ago · 2 stories · 1 awaiting review · Last review none · OPEN WORKSPACE`, with warnings as a single ⚠ (title-text detail). Filters: All Students · Needs Review · Needs a Nudge · Making Progress · Never Started. Search preserved; count line preserved; "private = counts only" line preserved.

**Student workspace (shot 42).** Opening a student is **"Maya's StoryForge"**: her avatar + name in the student hero style, an `mentor view` badge, her mentor-visible/submitted stories rendered with the SAME refined Library rows the student sees, plus tabs Overview / Activity (truthful boundaries) / Reviews / Notifications / Account (justified technical state). Record Review Check lives here (preview → send → receipt, inherited). Private stories: a counts-only line, never listed. Context chain preserved: Students → Maya's StoryForge → story → review → back lands where you left.

**Story review (shots 43–45).** **The same Story Room the student sees** — same tabs (Original 🔒 / Full Story / 30-Second / NNQ), Learning Lesson, categories, uses, authorized audio, history, mentor notes (same recorder architecture) — opened over the student workspace with "‹ Maya Osei's stories" as the back action. Added: one **Mentor Review rail**: five ★ Mentor Score (radiogroup, labeled "distinct from the student's own priority"), segmented Review Status pills, suitability buttons, student-visible feedback, private admin note, mentor voice note entry point, save triad + audit line — every control instant-save, version-checked, audited. Student-only editing affordances are inert-hidden for admins (no dead controls: submission actions, self-rating picker, and reflection-prompt pulls render as the rail note or read-only states). `renderAdminStory`'s parallel renderer is retired from the flow — net divergence deleted.

**Content Studio (shot 46) / System Controls (shot 47)** — doc 12.

**Review Queue (shot 48).** Preserved production queue with avatar identity frames in rows.

**Identity everywhere it materially appears:** signed-in identity, student cards, workspace header, queue rows, review-rail attribution ("Reviewing **Maya Osei**'s story" with her headshot) — headshot + first name, initials fallback when no avatar exists (Maya demonstrates it).
