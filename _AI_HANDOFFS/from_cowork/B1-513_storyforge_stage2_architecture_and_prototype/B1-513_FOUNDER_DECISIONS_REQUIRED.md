# B1-513 Founder Decisions Required

Everything the architecture team could resolve, it resolved (the spine records those decisions and their rationale). Four items remain that are genuinely Founder-level — each changes privacy/legal meaning, student-facing promise language, or requires inherent Founder product judgment. None block review of the prototype; all block production implementation of their lane.

## FD-1 — Approve (or edit) the student-facing consent wording · blocks R1
The exact first-use disclosure and Settings copy in doc 07 §4 (rendered live in the prototype; screenshots 40–42). This text is a promise to students about who can see their work; its final wording is inherently yours. Options: approve as written / edit lines / replace. Everything structural (affirmative checkbox, co-equal decline, receipt, Settings access) stays regardless.

## FD-2 — Confirm the visibility default policy · blocks R1
Recommended and architected: after consent, **new stories default to Mentor Visible; historical stories stay Private until the student changes each one; declining students keep today's behavior entirely.** Alternative defensible position: new stories default Private with a one-tap "share with mentor" (weaker mentorship default, stronger privacy optics). The architecture supports either with a one-line default change; the consent copy would change accordingly. Recommendation: as architected — it matches your stated product direction while keeping every escape hatch honest.

## FD-3 — Prototype product approval (the gate this whole package exists for)
Walk the prototype (Founder persona → Student and Administrator Views; Maya persona → consent). Approve the Stage 2 product shape — version tabs + labels ("Full Story" / "30-Second Version" / "NNQ Setup Version"), Inspiration wizard tone and prompt voice, directory/profile/Review Check ergonomics, direct review controls. **The Codex execution prompt becomes binding only after this approval; the unapproved prototype is not production visual authority.**

## FD-4 — Optional R4 bulk visibility opt-in tool · blocks only that tool
Should students later get a one-screen "make my earlier stories mentor-visible" bulk action (explicit, per-story checkboxes, logged)? Architecturally trivial; deliberately excluded from R1–R3 so the historical transition stays maximally conservative. Decide at R4 time; no earlier work depends on it.

### Explicitly NOT Founder decisions (already resolved, recorded in the spine)
Release order (R1→R4 with rationale), zero-copy version storage, NNQ terminology reuse, activity-time model and its do-not-capture list, Review Check rate limit (1/day), prompt-bank governance mechanics, directory population source, flag/kill-switch layout, rollback order. Relitigating these is available to you at any time, but nothing is waiting on them.
