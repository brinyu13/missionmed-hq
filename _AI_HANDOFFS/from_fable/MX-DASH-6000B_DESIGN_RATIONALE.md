# MX-DASH-6000B — Matrix Dashboard 2.0 · Design Rationale

STATUS: PROTOTYPE — AWAITING FOUNDER APPROVAL
Prepared by: Fable 5 · 2026-09-02
Prototype: `_AI_HANDOFFS/from_fable/MX-DASH-6000B_DASHBOARD_2_0_PROTOTYPE.html` (open locally, no backend)
Assets: `_AI_HANDOFFS/from_fable/MX-DASH-6000B_assets/` (eight card-art SVGs + evidence screenshots)

This document is written for one reader (Dr. Brian) and one job: make the eight product decisions in the ticket easy.

---

## 1. Source lineage used (what the design is grounded in)

| Source | What was read | How it shaped the prototype |
|---|---|---|
| Dashboard V1 — `student-os.css` / `student-os.js` / `class-mmed-student-os.php` (b1-storyforge-advanced-102-live-matrix-source-export) | Navy tokens (#061727/#09243d), aurora background, gold eyebrow pill, "Welcome back, {First}." 42px heading, 5-stat row, overview grid, sidebar sections (Command · Planning · Learning · Documents · Match Prep · Training · Account · Support), route map | Sidebar section grammar, the eyebrow pill, the greeting, the aurora, and the entire **Classic** render |
| StoryForge V5 — `04_STORYFORGE_V5/styles.css` @ brinyu13/missionmed-hq 084ce55c (design authority) | Archivo / Rajdhani / Lora, ember accent, 60px header, panel hairline, radius 14/16, `roleSwitch` bottom-left ●/○ pattern, catch-button clip-path, `heroCapture` launcher, hover lift | Typography system, controls, panel construction, perspective switch, launcher shape, detail-overlay treatment |
| MX-APPT-5003F Appointments prototype (sibling Fable deliverable) | Prototype control bar convention, Classic/StoryForge coexistence, settings row pattern | Kept the same review controls so the two prototypes read as one series |
| Fortnite screenshots (supplied in thread) | Interaction pattern only — see §7 | Image-led cards → detail experience → CTA |
| Ticket product anchors | Student problem / purpose / visual concept per app | All eight card concepts and detail copy |

Nothing was inferred from app names alone. Where I could not verify a feature from source (IV Prep On-Call, RISE, RankList IQ, LOR Builder are not in this worktree), the copy stays at the level of the ticket's anchors and avoids claims about specific data or intelligence.

---

## 2. Key design decisions (mapped to the ticket's eight questions)

**Q1 · Should Dashboard 2.0 remain predominantly light?**
The prototype defaults to a **hybrid**: V1's navy shell (sidebar) with a **light canvas** (cool paper #eef2f5 with V1's aurora softened to tints). A **Deep** canvas is one click away in the prototype bar and in Settings — same components, only canvas tokens change. Recommendation: light canvas by default. The image-led cards carry all the richness; a dark canvas around them makes the page heavier without adding meaning. Deep is worth keeping as a *user* option because it reads closest to StoryForge.

**Q2 · How much StoryForge DNA belongs on Dashboard?**
Structure and grammar: yes. Atmosphere: no. Typography, controls, panel hairlines, radii, the role switch, and the launcher shape are StoryForge's. The dark "forge" atmosphere, the skewed-italic-everywhere headline style (used once, on the greeting only), the ambient aurora blobs, and the opening ceremony stay in StoryForge.

**Q3 · Should the discovery launcher dominate the opening screen?**
It leads, but does not dominate: hero ≈ 40% of the first viewport on desktop, with the eight featured cards visible without scrolling at 1440×900. The launcher answers "where can I take you?"; the cards answer it for people who would rather browse. Both are on screen at once.

**Q4 · How much Today information before the page feels busy?**
Three panels (Next up · Due soon · Messages) plus one "Continue" row, placed **after** the featured apps so the first impression is calm. Settings → Today panel offers **Standard / Minimal** so you can feel the difference live. Recommendation: Standard; Minimal for students who ask for it.

**Q5 · Search, categories, suggested actions, app cards, or hybrid?**
Hybrid, in this order of prominence: launcher → suggested problems (chips) → featured cards → All Apps (categories + filter). Search routing is deterministic in the prototype (keyword tables in `ROUTES`), and the UI never claims intelligence it doesn't have.

**Q6 · What remains visible from V1?**
See §3. The short version: the greeting, the gold eyebrow pill, the sidebar sections, the aurora, the "next session / due / messages" information set, the App Mode "Return to Matrix" contract, and the whole V1 dashboard as Classic.

**Q7 · Does Student/Admin perspective belong in the same bottom-left pattern as StoryForge?**
Yes — it is implemented exactly there (●/○ `roleSwitch`), and mirrored in the prototype bar for reviewers. The admin perspective changes nav (adds Administration), subtitles (each card gets an admin job), the hero question, and the Today content. A cyan banner states it is prototype-only. Production must derive it from server authorization, never client state.

**Q8 · Does the ecosystem feel like one family?**
The StoryForge transition view exists to answer this by juxtaposition: open StoryForge from its card, then press "Back to Matrix." Same sidebar grammar, same role switch, same ember buttons, same hairline panels — different job, different atmosphere.

---

## 3. What I preserved from Dashboard V1

- The navy shell and sidebar section grammar (Command · Planning · Learning · Documents · Match Prep · Training · Account · Support) with two-letter icon chips.
- The gold **STUDENT DASHBOARD** eyebrow pill and the **"Welcome back, Maya."** greeting — the first two things a V1 student recognizes.
- The aurora background (green/cyan/gold), reduced to tints so the light canvas stays calm.
- The "home base" information set V1 already loads (events, scheduler events, messages, files, todos) — reorganized as Next up / Due soon / Messages / Continue.
- The route/App Mode model: apps still open as App Modes inside the Matrix shell with a Return to Matrix affordance. The prototype's generic app landing states this boundary explicitly.
- V1 in its entirety as **Classic**, rendered with V1's own tokens and fonts (Space Grotesk / Poppins), reachable from Settings and from the prototype bar. Admin **Force Classic** demonstrates the emergency path (precedence: force → user preference → admin default → Classic, matching the Calendar V2 contract).

## 4. What I borrowed from StoryForge

- Typography: Archivo (display), Rajdhani (labels, numerics, uppercase tracking), Lora (the human "voice" lines).
- Control grammar: ember gradient primary, ghost secondary, catch-button clip-path for the single most important CTA (detail overlay only), pill role switch, segmented controls.
- Panel construction: 1px edge, 16px radius, top hairline glow, hover lift on cards.
- The `heroCapture` launcher form ("Take me to…" prefix, input, Go) as the shape of "Where can I take you today?".
- The bottom-left "Viewing as" role switch.
- Header rhythm: 60px, breadcrumb in Rajdhani uppercase, search shortcut with ⌘K.
- The opening moment — a bounded 0.9s "StoryForge" strike when transitioning into the app (and only then).

## 5. What I intentionally did NOT borrow from StoryForge

- Full-dark default. Dashboard is a front door, not a workspace; it should feel open.
- Skewed-italic headline style on every heading. Used once (the greeting) so it reads as a family signature, not a tic.
- Ambient drifting aurora blobs with heavy blur and "motion energy" states. Dashboard's aurora is a still tint.
- The advisor cyan accent as a role color on the canvas. Admin gets a banner and content changes, not a repainted UI.
- StoryForge's own product copy voice ("Shape what only you can tell") — Dashboard's voice is plainer.
- Any StoryForge feature UI (capture sheets, story rooms). Only the shell grammar crossed over.

---

## 6. App-by-app design table

| App | Student problem | Purpose / value | Card-art concept (original SVG) | Subtitle | Benefits (feature → benefit) | Primary CTA · secondary |
|---|---|---|---|---|---|---|
| HomeBase | "I have a lot going on and don't know what to focus on or where to go." | One calm place that makes priorities and destinations obvious; front door to the ecosystem | Teal command environment: concentric rings, five destination paths converging on a lit gold beacon | Your command center — what matters today, and where to go next. | Today at a glance → next step in 5 s · Priority tasks → stop guessing what's due · Continue → last work one click away · Ask, don't browse → routed to the right tool | Open HomeBase · See today's plan |
| Calendar | "I don't want to miss something important or waste time figuring out what's happening." | Everything scheduled in one timeline, next item first | Blue time-block timeline with a gold "now" line intersecting a lit block | See what's coming — classes, live sessions, appointments — in one timeline. | Unified timeline → no cross-checking · Next up first → instant answer · Join from the event → no inbox search · ET + local → no time-zone mistakes · Week/month → plan around real commitments | View My Calendar · What's next? |
| Scheduler | "I need help or practice time and don't want scheduling back-and-forth." | Find and book the right session, in under a minute | Green availability grid with four open slots (checks) and a dashed path to two overlapping people (mentor + student) | Book advising, mock interviews, and practice time — no back-and-forth. | Live availability → only real times · Appointment types → right length/mentor · ET + local · Manage in place → no email chains | Find a Time · See upcoming appointments |
| StoryForge | "I know what I've done, but I struggle to turn experiences into strong stories." | Raw experience → memorable interview stories | Ember: scattered moments (dots, shards) flowing along dotted paths into three ordered story-beat bars, heat strike beneath | Turn what you've lived into interview-ready stories. | Quick capture → 10 s save · Story shaping → beats that land · Question workshop → which story answers which question · Mentor review on your terms | Open StoryForge · Capture a story |
| IV Prep On-Call | "I need realistic interview practice so I can answer confidently under pressure." | Repeatable interview practice so the real one feels familiar | Violet: two abstract figures under a spotlight cone, a voice waveform between them, an on-call pulse ring and timer | Realistic residency interview practice, whenever you're ready. | Timed sessions → reps on your schedule · Question bank by type · Delivery review → pacing/clarity · Recordings → coaching session | Start Interview Practice · Book a mock interview |
| RISE | "There are too many programs and too much scattered information." | Residency Intelligence: research, compare, strategize | Deep blue constellation of programs, four lit, with a rising cyan→gold line | Research residency programs and build a target list you can defend. | Profiles in one place → one search not forty tabs · Filters that fit your situation · Side-by-side → evidence not vibes · Living target list | Research Programs · Open my target list |
| RankList IQ | "I have interviews and competing priorities but need clarity on how to rank." | Competing priorities → a rank order that explains itself | Amber: four dashed, tilted, unordered options resolving via paths into a numbered 1-2-3-4 stack | Rank your programs with clarity and a defensible order. | Weighted priorities → ranking is yours · Consistent scoring · Order that explains itself · Revisit after interviews | Build My Rank List · Review my priorities |
| LOR Builder | "I need a strong letter but don't know what to give my recommender." | Organized evidence → specific, strong letters | Burgundy: evidence chips flowing along dotted paths into a cream letter with signature and a gold seal | Give recommenders exactly what they need to write a strong letter. | Evidence packet · Guided prompts → believable specifics · Recommender-ready brief · Request tracking | Prepare My LOR · Track my requests |

Every detail view also carries a one-line "When to use it" and an outcome statement ("After you use it…"), which is how the prototype sells value without a sales page.

---

## 7. Fortnite Discover — what was borrowed conceptually, what was rejected

**Borrowed (interaction pattern)**
- Image-led destination cards where the picture communicates purpose before the copy is read.
- Browse → tap → rich detail (name, one-liner, what it does, why you'd care, ratings-free) → one clear action. The detail overlay keeps Fortnite's "About" rhythm as *Solve / How it helps / What you get / Outcome / CTA*.
- Row-based progressive disclosure: featured first, "All apps" catalog grouped by category behind it, and the Discover-style category chips in the All Apps view.
- Left/right browsing within the detail experience (arrow keys and chevrons) so a student can compare apps without closing the sheet.
- On mobile, a horizontally snapping row of large cards rather than a stack of small tiles.

**Rejected (deliberately)**
- Branding, typography, palette, and any Fortnite artwork or licensed characters. All eight card images are original SVG compositions.
- Game language: no "players", "select", "rewards", "levels", XP, currencies, or unlock states.
- Motion-heavy backgrounds, character stages, and the sense of a lobby. Cards lift on hover; nothing bounces.
- Social proof metrics ("214.5K playing now", likes). Matrix should not rank apps by popularity; it routes by need.
- Autoplaying trailers and full-bleed hero media. The hero is a question, not a billboard.

---

## 8. What is simulated

- All student/admin data (Maya Student, Dr. Brian's tiles, messages, due items, recent work).
- Search routing: keyword matching (`ROUTES`, `ADMIN_ROUTES`); "What should I work on today?" returns a fixed ordered list. No AI, no semantic model, and the UI says so.
- Perspective switch: client state only; a banner states it does not change authorization.
- Experience setting (Classic / Matrix 2.0), canvas, Today density, admin default, Force Classic: in-memory only.
- App launches other than StoryForge open a labeled "App mode · simulated" landing; StoryForge opens a faithful V5 home rendered from its design authority (not the live app).
- Fonts load from Google Fonts; offline, the page falls back to system faces gracefully.

---

## 9. Things to inspect during review

1. First impression at 1440×900 and on a phone (390px): calm or busy?
2. Toggle **Canvas: Light ↔ Deep** on the home view — this is Q1 made concrete.
3. Open any card, then press → repeatedly to walk all eight; check the copy explains the job in one read.
4. Type "I need to practice for interviews", "book time", "what's coming up?", "what should I work on today?" and press Enter.
5. Switch to **Admin** (bottom-left of the sidebar): nav, subtitles, hero, Today, and Settings → Experience Controls → **Force Classic**.
6. Settings → **Classic**: V1 rendered as-is; then "Try Matrix 2.0".
7. Open StoryForge from its card, then **Back to Matrix**: do they read as siblings?
8. Naming check: the ticket names the card **Scheduler**; MX-APPT-5001/5003F retired that label in favor of **Appointments** for students. The prototype follows the ticket; the swap is one string in `APPS` and `NAV_*`. Same for **LOR Builder** vs V1's **LOR Writer**.
