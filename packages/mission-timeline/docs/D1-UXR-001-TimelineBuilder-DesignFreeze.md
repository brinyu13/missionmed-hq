# D1-UXR-001 — MISSION TIMELINE BUILDER
## DEFINITIVE UX ARCHITECTURE & DESIGN FREEZE

| | |
|---|---|
| Document ID | D1-UXR-001 |
| Status | **FROZEN** — supersedes all prior UX direction for Timeline Builder |
| Baseline implementation | D1-413R engineering build · 407F standalone prototype (donor) |
| Package | `/Users/brianb/MissionMed_worktrees/D1-MacProTimeline-400/packages/mission-timeline` |
| Implementation target | Claude Opus 4.8 / 4.6 + Claude Code — execution only, zero UX decisions |
| Out of scope | Matrix integration work, engineering architecture changes, backend redesign |
| Date | 2026-07-29 |

**Reading rule for the implementation model:** every statement in this document is a decision, not a suggestion. Where a number appears, it is the number. Where copy appears in quotation marks, it is the copy, verbatim. If a situation arises that this document does not cover, the implementation model stops and asks; it does not invent.

---

# 1 · EXECUTIVE PRODUCT DIRECTION

## 1.1 What this product is

Mission Timeline Builder turns a medical student's journey — school, exams, US clinical rotations, work, research, and personal life — into the exact Keynote-style visual timeline that residency interviews require. The student never touches Keynote. The engine draws the arrows from dates; the student edits events, not pixels.

## 1.2 What is wrong with the current build (407F / D1-413R)

The current build is technically functional and fails the founder's product bar for five identified reasons. These are the problems this freeze eliminates:

1. **Navigation sprawl.** Eleven permanent rail destinations (Command, Builder, Canvas, Intake, Review, Media, Advisor, Questions, Versions, Export, Reference) for a product with three real jobs: get data in, refine the picture, get the picture out.
2. **Status noise.** The Home screen leads with engine chips ("OP D1 · TIMELINE ENGINE", "AXIS AUTO-CALIBRATES", "BLANK BUILDER DEFAULT"), a draft-status telemetry panel, and a gamification HUD (XP bar, MP coins, level hex). None of it helps a student build a timeline.
3. **Wizard compression.** Four clipped horizontal step chips ("IDENTITY", "SCHOOL + EXAMS", "US EXPERIENCE", "STORY + TARGET") cram six different life domains into fixed single fields (exactly one Step 1 window, exactly one research block, one personal milestone).
4. **Permanent inspector.** A always-visible right panel forces form-editing of a visual object, splitting attention between the board and a sidebar.
5. **Arrow rendering drift.** Arrows carry rectangular label plates that break the clean Keynote appearance the product exists to reproduce.

## 1.3 Product direction (frozen)

Timeline Builder becomes a calm, premium, three-act product:

- **Act 1 — Add your journey.** Guided Builder (wizard) or Document Intake (CV / MyERAS upload → AI extraction → student review → student approval). Both feed one shared timeline dataset.
- **Act 2 — Refine on the canvas.** A Keynote-faithful board with direct manipulation and contextual editing. Two modes: **Guided Mode** (safe, interview-optimized, nearly impossible to make ugly) and **Advanced Studio** (Canva-class freedom for power users).
- **Act 3 — Export for interviews.** Audience-filtered, theme-rendered export with professional printing guidance and an optional advisor approval gate.

## 1.4 The five-second contract

Within five seconds of first landing on Home, a first-time student can answer all five of these, because the screen states them explicitly (exact copy in §3.2):

1. What it is — the H1 names the product outcome.
2. Why it exists — the subline names the interview use case.
3. What the first step is — one gold primary button.
4. How to save time — the CV/MyERAS upload card is a co-equal first-class region.
5. How to get back to Matrix — a persistent "← Matrix" link, top-left, always.

## 1.5 Experience principles (frozen, in priority order)

1. **The board is the hero.** Chrome recedes; the timeline is always the largest, brightest thing on screen.
2. **One decision per moment.** Every screen has exactly one primary action, styled uniquely (gold). Everything else is secondary.
3. **Nothing lands without consent.** Extracted data is quarantined until the student approves it. No exceptions.
4. **Direct before abstract.** Editing happens on the object (drag, inline text, contextual toolbar), never in a permanent side form.
5. **Safe by default, free by choice.** Guided Mode cannot produce an ugly board. Advanced Studio is opt-in and clearly gated.
6. **Premium is calm.** Generous spacing, restrained color, no ALL-CAPS body text, no telemetry chips, no gamification in this product.

## 1.6 Explicit removals (frozen)

The following current-build elements are **removed** and do not reappear anywhere:

- XP bar, MP coin counter, level hex, avatar hex HUD (the Season One gamification shell).
- The 11-item rail; replaced by 4 destinations (§2.1).
- Permanent Review, Media, Questions, Versions, Reference destinations (each is relocated per §2.3).
- The Home "Draft status" telemetry panel and all engine-status chips.
- Rectangular plates behind arrow labels.
- The permanent right-side Inspector.
- ALL-CAPS letter-spaced microcopy as a body-text style (retained only for small section labels per §3.1 type scale).
- "Command", "Keynote Dupe Engine", "fixture", "quarantine", "stress" and any other internal engineering vocabulary in user-facing copy.

---

# 2 · INFORMATION ARCHITECTURE

## 2.1 Primary navigation (frozen: exactly four destinations)

A slim left rail, 72px collapsed / 220px expanded (expands on hover after 250ms, pinned open via chevron toggle; state persists per user). Order, labels, and icons are frozen:

| # | Label | Icon (Lucide name) | Purpose |
|---|-------|--------------------|---------|
| 1 | **Home** | `house` | Orientation, resume, and both entry workflows |
| 2 | **Builder** | `list-checks` | The guided wizard (§4) |
| 3 | **Canvas** | `presentation` | The board: Guided Mode + Advanced Studio (§5, §8) |
| 4 | **Export** | `download` | Export, print guidance, advisor review entry (§3.6) |

Rail footer: none. No version strings, no "LOCAL · NO NETWORK", no engine credits in the rail.

Header (one 56px bar, full width, all screens):
- Left: "**← Matrix**" text link (returns to Matrix shell; while Matrix integration is out of scope, the link renders and fires a `navigate:matrix` event stub). 16px from edge.
- Center-left: wordmark "Timeline Builder", 15px/600.
- Right cluster, 16px gap: autosave state ("Saved just now" / "Saving…" in 12px tertiary ink; never an error color unless save fails, then "Couldn't save — retry" as a link), then the **Export** gold button (enabled when the timeline has ≥1 event; disabled state has a tooltip: "Add at least one event first").

## 2.2 Full sitemap (frozen)

```
Timeline Builder
├── Home
│   ├── Region A · Build your timeline  → Builder
│   ├── Region B · Start from CV/MyERAS → Intake flow (modal sequence)
│   └── Region C · Your timeline        → Canvas (click preview)
├── Builder (wizard)
│   ├── 1 Core Info
│   ├── 2 Exams
│   ├── 3 US Clinical Rotations
│   ├── 4 Work Experience
│   ├── 5 Research
│   ├── 6 Personal
│   └── 7 Review & finish   (contextual final step, not a nav item)
├── Canvas
│   ├── Guided Mode (default)
│   ├── Advanced Studio (opt-in mode switch)
│   ├── Theme picker (popover)
│   ├── History & versions (slide-over)
│   └── Contextual toolbar / context menus (selection-driven)
├── Export
│   ├── Preview & audience filter
│   ├── Format & size
│   ├── Printing guidance
│   └── Advisor review (entry point → Advisor session)
└── Advisor session (role-scoped view, reached by invitation, not by rail)
    ├── Read-only board + comment pins
    ├── Review checklist
    ├── Likely interview questions
    └── Approve / request changes
```

## 2.3 Relocation map — where every old destination went (frozen)

| 407F rail item | Disposition |
|---|---|
| Command | Becomes **Home** (§3.2), rebuilt to three regions |
| Builder | Stays; rebuilt per §4 |
| Canvas | Stays; rebuilt per §5 |
| Intake | Becomes a **flow** launched from Home Region B (and from Builder's empty state link). Not a nav destination. §6 |
| Review | **Contextual**: appears only as the extraction-review stage of the Intake flow (§6.4) and as wizard step 7 (§4.9). Badge on Home Region C when candidates await decision. |
| Media | Dissolved. Image/GIF/logo upload lives in **Advanced Studio** insert tools (§8.5). Program logo + photos are Advanced Studio elements. |
| Advisor | Becomes the **Advisor session**, reached from Export → "Request advisor review" (§10). Not in the student rail. |
| Questions | Folded into the Advisor session ("Likely interview questions" panel) and into wizard step 7's story hints. No student-facing standalone screen. |
| Versions | Becomes the **History slide-over** inside Canvas (§5.8). |
| Export | Stays; rebuilt per §3.6 with printing guidance (§3.6.4). |
| Reference | Dissolved. The reference sample becomes (a) the ghost example board behind Home's empty state and (b) the "Example" thumbnail in the theme picker. No standalone screen. |

## 2.4 Data model vocabulary (frozen names, used everywhere in UI copy)

- **Event** — anything on the board. Six categories, frozen names and order: **Education, Exams, US Clinical, Work, Research, Personal**.
- **Timeline** — the single dataset per student. One timeline per student in this release.
- **Draft** — the autosaved working state. **Version** — a named snapshot.
- **Candidate** — an extracted-but-unapproved item from Document Intake.
- **Interview-safe** — the audience filter that excludes advisor-only items.

Category color tokens (identical across shell UI chips; themes restyle them per §8.2):

| Category | Token | Default hex |
|---|---|---|
| Education | `cat.education` | `#2C6E8F` |
| Exams | `cat.exams` | `#3A78C9` |
| US Clinical | `cat.clinical` | `#C8641C` |
| Work | `cat.work` | `#3F9B52` |
| Research | `cat.research` | `#C9A227` |
| Personal | `cat.personal` | `#8A5BBF` |

---

# 3 · SCREEN-BY-SCREEN SPECIFICATION

## 3.1 Global design system (frozen)

**Shell character:** light, warm, calm studio. The dark gamified Season One shell is retired for this product. Board themes (§8) are independent of the shell.

**Design tokens:**

| Token | Value |
|---|---|
| `shell.bg` | `#F7F6F3` |
| `shell.surface` | `#FFFFFF` |
| `shell.surface2` (inset wells, dropzones) | `#FBFAF7` |
| `shell.border` | `#E6E2D9` |
| `shell.borderStrong` | `#D4CFC2` |
| `ink.primary` | `#191C21` |
| `ink.secondary` | `#565D66` |
| `ink.tertiary` | `#8A9099` |
| `accent.gold` (primary actions) | `#B98A2E` |
| `accent.goldHover` | `#A67A26` |
| `accent.goldText` (on gold) | `#FFFFFF` |
| `focus.ring` | `#2F6FED`, 2px, offset 2px, always visible on `:focus-visible` |
| `danger` | `#C4453B` |
| `success` | `#2E7D4F` |
| Radius | cards 12px · buttons & inputs 8px · chips 999px |
| Shadow (cards) | `0 1px 2px rgba(20,18,12,.06), 0 4px 16px rgba(20,18,12,.05)` |
| Spacing grid | 4px base. Card padding 24px. Between-card gap 20px. Screen gutter 32px. Max content width 1440px, centered. |

**Type scale (font: Inter; numerals tabular in data contexts):**

| Role | Spec |
|---|---|
| Display (Home H1 only) | 34px / 40 / 700 |
| Screen title (one per screen) | 28px / 34 / 700 |
| Section title | 18px / 24 / 650 |
| Card title | 15px / 20 / 600 |
| Body | 14px / 21 / 450 |
| Secondary body | 13px / 19 / 450, `ink.secondary` |
| Micro label (the only ALL-CAPS style) | 11px / 14 / 650, letter-spacing .08em, `ink.tertiary` |
| Button | 14px / 600 |

**Buttons:** Primary = gold fill, white text. Secondary = white fill, `shell.borderStrong` border, `ink.primary` text. Tertiary = borderless text button in `ink.secondary`. Destructive = white fill, `danger` text and border. Heights: 40px (primary contexts), 32px (toolbars). One primary button per screen, no exceptions.

**Motion:** 160ms ease-out for hover/press; 240ms ease-in-out for layout shifts (panel collapse, adaptive year widths); 200ms fade+8px-rise for popovers. All motion is disabled under `prefers-reduced-motion` (§11.4).

**Toasts:** bottom-center, 3.5s, single line, with an action slot (e.g., "Event deleted · **Undo**"). Never stacked more than 2; older collapses.

## 3.2 Home (frozen)

**Layout:** header (§2.1) + rail (§2.1). Content area holds exactly **three regions** in a 12-column grid, 20px gaps:

- **Region A — "Build your timeline"** — columns 1–7, top row. Card, 24px padding, min-height 260px.
- **Region B — "Start from your CV or MyERAS"** — columns 8–12, top row, same height as A.
- **Region C — "Your timeline"** — columns 1–12, below, min-height 320px.

Nothing else renders on Home. No status panel, no chips row, no role explainer minis, no demo-story button (the example lives inside Region C's empty state).

**Region A copy (verbatim):**
- H1 (Display): "Turn your medical journey into an interview-ready timeline."
- Subline (Body, `ink.secondary`, max-width 46ch): "Answer guided questions about your school, exams, rotations, work, and research. Timeline Builder draws the Keynote-style timeline for you — no design work."
- Primary button (gold): "Start building" → Builder step 1. When a draft with ≥1 event exists, this button becomes "Continue building" and a tertiary link "Start over" appears beside it; "Start over" opens a confirm dialog: title "Start a new timeline?", body "Your current draft stays in History as a version. You can restore it anytime.", buttons "Save & start new" (primary) / "Cancel". On confirm, current draft is saved as an automatic version named "Before starting over · {date}".
- Beneath the buttons, a three-step strip (Micro label style, single line): "1 · ADD YOUR JOURNEY&nbsp;&nbsp;&nbsp;2 · REFINE ON THE CANVAS&nbsp;&nbsp;&nbsp;3 · EXPORT FOR INTERVIEWS".

**Region B copy (verbatim):**
- Card title: "Start from your CV or MyERAS"
- Body: "Upload your CV or MyERAS export. We'll read it, suggest timeline events, and you approve each one before it appears."
- A dashed dropzone (`shell.surface2`, dashed 1.5px `shell.borderStrong`, radius 12, 96px tall): icon `file-up`, line 1 "Drop a PDF here, or browse", line 2 (Secondary body) "CV · MyERAS PDF · résumé".
- Micro-assurance line under the dropzone: "Nothing appears on your timeline until you approve it."
- Clicking/dropping launches the Intake flow (§6). No document-type pre-selection buttons — type is detected, with a correction affordance inside the flow (§6.2).

**Region C — "Your timeline":**
- Card title row: "Your timeline" + right-aligned metadata line (Secondary body): "{n} events · {startYear}–{endYear} · edited {relative time}". Exactly these three data points; nothing else. If an intake review is pending, one gold chip appears in this row: "{n} suggestions to review" → opens the Review stage (§6.4).
- Body of the card: a live, non-interactive render of the current board at fit-width scale, current theme, interview-safe filter ON. Clicking anywhere on it navigates to Canvas. Hover shows a centered ghost button "Open canvas".
- If an advisor has approved: a small `success` badge left of the metadata: "Advisor approved · {date}".

**Home empty state (no events, no draft):** Region C renders the example board (the packaged demo story) at 40% opacity with a centered overlay card: title "This is what you're building." body "A one-page visual story an interviewer can read at a glance." tertiary link "Use the guided builder →". The example is never loaded into the student's data from Home; it is a background illustration only.

**First-run:** no modal tour, no coach marks. The five-second contract is carried by the layout and copy alone.

## 3.3 Builder screen chrome

Specified fully in §4. Chrome facts frozen here: the Builder screen title is the current step's title at Screen-title scale (28px) — one large section title, replacing 407F's clipped horizontal chips. A vertical stepper occupies a fixed 264px left column. The live board preview occupies the right pane and updates on every field commit (input blur or Enter), with the newest-changed event pulsing once (single 400ms outline pulse; suppressed under reduced motion).

## 3.4 Canvas screen chrome

Specified fully in §5 and §8. Chrome facts frozen here: no permanent side panels of any kind. Top of screen carries a single 48px toolbar (§5.2). Below it, the board fills all remaining space, centered, letterboxed on `#EFEDE8`.

## 3.5 Intake flow chrome

Specified fully in §6. The flow renders as a focused, full-content stage (not a small modal): rail stays visible, header stays visible, content area is replaced by the flow's stages so the student cannot wander mid-extraction; an "✕ Cancel upload" tertiary button top-right of the stage returns Home (confirm dialog if extraction finished but review undecided: title "Discard these suggestions?", body "You haven't approved any of the {n} suggested events. They'll be deleted.", buttons "Discard" (destructive) / "Keep reviewing" (primary)).

## 3.6 Export screen (frozen)

Layout: two columns. Left, 380px fixed: controls stack. Right, fluid: full live preview of the final render (theme + filter applied), letterboxed, with a subtle print-margin overlay toggle.

**3.6.1 Controls stack, top to bottom:**

1. Screen title: "Export".
2. **Audience** card — segmented control, 2 options, frozen labels: "Interview-safe" (default) / "Everything". Beneath it, Secondary body: "Interview-safe hides items you marked advisor-only." When "Everything" is selected the line changes to: "Includes advisor-only items. Don't hand this version to programs." with the text in `danger`.
3. **Theme** card — the same theme popover trigger as Canvas (§8.3); changing theme here changes the timeline's theme globally (one theme per timeline, not per export).
4. **Format & size** card — radio list, frozen options:
   - "PNG · 1920 × 1080 — screens and slides" (default)
   - "PNG · 2560 × 1440 — high-res screens"
   - "PDF · Letter landscape — printing (300 DPI)"
   - "PDF · A4 landscape — printing (300 DPI)"
5. **Advisor review** card — if never requested: body "Get a second pair of eyes before you export." + secondary button "Request advisor review" (§10.2). If pending: "Awaiting advisor review · requested {date}" + tertiary "Cancel request". If approved: `success` badge "Advisor approved · {date}". If changes requested: gold chip "{n} advisor comments" → opens Canvas with pins shown (§10.4).
6. Primary button (gold, full-width): "Export {format}". On click: renders, downloads, and fires a toast "Exported · {filename}". An automatic version "Export · {date}" is saved (§5.8).

**3.6.2 Preview behaviors:** the preview always shows exactly what the file will contain, including audience filtering. Advisor-only items never render in "Interview-safe" previews. A "Show print margins" checkbox (visible only when a PDF format is selected) overlays a 12.7mm margin guide.

**3.6.3 Export filename (frozen):** `{StudentLastName}_{FirstName}_Timeline_{YYYY-MM-DD}.{ext}`, spaces stripped, from Core Info name.

**3.6.4 Printing guidance (frozen — a collapsed accordion card under Format & size, title "Printing for interviews", collapsed by default; expands to this copy verbatim):**

> **For interview handouts:**
> - Export the PDF (Letter or A4) — it renders at 300 DPI for sharp print.
> - Print at a professional print shop (FedEx Office, Staples, or a local printer), not a home inkjet.
> - Ask for **heavyweight matte cardstock, 80–100 lb (216–270 gsm)**. Glossy stock glares under interview-room lighting.
> - For a handout you'll reuse across interview season, ask for **matte lamination (3 mil)** — it resists fingerprints and stays flat in a padfolio.
> - Print one per interviewer plus two spares.
> - Do a single test print first and check that the smallest text is comfortably readable at arm's length.

## 3.7 States matrix (frozen)

Every screen implements exactly these states; visuals as specified:

| Screen | Empty | Loading | Error | Success |
|---|---|---|---|---|
| Home | §3.2 empty state (ghost example + overlay) | Skeleton cards (shimmer, 3 regions) on first paint only | Save-failure link in header (§2.1); no error takeover | Advisor badge + normal state |
| Builder | Step forms always render; preview pane empty state: centered Secondary body "Your timeline appears here as you answer." over a faint axis illustration | n/a (local) | Inline field validation only (§4.11) | Step check marks in stepper |
| Canvas | Board with axis placeholder and centered ghost text "No events yet — add one below or use the Builder." + secondary button "Open Builder" | n/a | Toast on failed action + automatic revert | Selection/edit feedback per §5 |
| Intake | n/a (flow starts with a file) | Extraction progress stage (§6.3) | §6.6 failure card | §6.5 completion stage |
| Export | If 0 events: controls disabled, preview shows ghost board, banner "Add events before exporting." with "Open Builder" secondary button | Render spinner ≤400ms on preview refresh | Toast "Export failed — try again"; button re-enabled | Toast + downloaded file |
| Advisor session | If link invalid/expired: full-page card "This review link isn't active." | Skeleton board | n/a | Approval confirmation (§10.5) |

---

# 4 · WIZARD WORKFLOW SPECIFICATION (BUILDER)

## 4.1 Structure (frozen)

Seven steps. Steps 1–6 are data domains; step 7 is the contextual review/finish stage (this is the only "Review" in the product's navigation, satisfying the removal of permanent Review).

| # | Step title (verbatim) | Domain |
|---|---|---|
| 1 | Core Info | Identity + medical school (renamed from "Identity"; medical school moves here) |
| 2 | Exams | USMLE / COMLEX, attempts, scores |
| 3 | US Clinical Rotations | Renamed from "US Experience" |
| 4 | Work Experience | New |
| 5 | Research | New |
| 6 | Personal | Renamed from "Personal Milestones" |
| 7 | Review & finish | Contextual summary + handoff to Canvas |

## 4.2 Layout (frozen)

Three zones:

- **Left — vertical stepper**, fixed 264px. Each row: number circle (24px), step title (Card title scale), and a state glyph: empty circle (untouched), half-filled circle (started), check (complete per §4.10). Current row has a gold left bar (3px) and `shell.surface` background. All rows are always clickable — free navigation between steps at any time; the wizard never traps.
- **Center — the form column**, max-width 560px, 32px top padding. Topped by the **one large section title** (28px) and a one-line purpose sentence (Secondary body) frozen per step below.
- **Right — live preview** pane (min 420px, fluid): the real board, Guided render, fit-to-width, non-interactive except click-through: clicking an event on the preview jumps to the step and entry that owns it, scrolls to it, and focuses its first field.

Footer of the form column (sticky): "← Back" (tertiary) · "Continue →" (primary, gold). No "Save draft" button — autosave is continuous (§2.1 header state). No "Preview changes" button — the preview is always live.

Below 1280px viewport width the preview pane collapses to a "Show preview" toggle button (§11.6).

## 4.3 Step 1 · Core Info

Purpose line: "Who you are and where you trained."

Fields (order frozen):

1. **Full name** — text, required. Placeholder "e.g., Amara Osei".
2. **Medical school** — text with typeahead against the bundled school list; free text allowed (same pattern as §4.5 institution search). Required.
3. **Medical school country** — searchable select, required. Defaults from school selection when known.
4. **Graduation date** — month picker (§4.12), required. Toggle beneath: "I haven't graduated yet" → relabels the field "Expected graduation".
5. **Degree** — segmented: MD / DO / MBBS / Other(text). Required.
6. **Visa / work status** — select: "US citizen / permanent resident", "Need H-1B", "Need J-1", "Other (text)", "Prefer not to say". Optional.

Board effect: creates the **Education** milestone "Medical Degree — {school short name}" at graduation month, and anchors the timeline's left edge (§7.2).

## 4.4 Step 2 · Exams (frozen workflow)

Purpose line: "Your exam story — scores and results first, dates second."

**4.4.1 Exam system selection.** Two large toggle cards side by side: "USMLE" and "COMLEX-USA". Independently selectable; both allowed simultaneously; at least one required to add exams (zero selected shows the exam list empty with helper "Choose USMLE, COMLEX, or both."). Selecting a system reveals its exam rows.

**4.4.2 Exam rows.** For USMLE: Step 1, Step 2 CK, Step 3. For COMLEX: Level 1, Level 2-CE, Level 3. Each exam renders as a card in an "Added exams" list only after the student adds it via an "+ Add {exam}" chip row (chips for each not-yet-added exam of the selected systems). No exam is pre-added.

**4.4.3 Attempt model (automatic).** The student never sees or sets an "attempt number" field. The first entry for an exam is Attempt 1 silently. Attempt labels ("2nd attempt") appear only when a second attempt exists, both in the card and on the board.

**4.4.4 Exam card fields — visual priority frozen: score and result first, dates second.**

Row 1 (primary, large):
- **Result** — segmented: "Passed" / "Failed" / "Awaiting result". Required.
- **Score** — numeric text, 3 digits (USMLE 1–300; COMLEX 9–999), shown large (18px/650). Hidden when the exam is pass/fail-only (USMLE Step 1, COMLEX Level 1 → Result only). Optional even when visible ("Score (optional)").

Row 2 (secondary, smaller):
- **Exam date** — month picker + manual entry (§4.12). Required for "Passed"/"Failed"; for "Awaiting result", the field is labeled "Exam date (taken)" and remains required.
- **Study period start** — month picker, optional, labeled "Started studying (optional)". When set, the board draws a study arrow from this month to the exam date.

**4.4.5 Failure → automatic study period (frozen rule).** When Result = "Failed" is saved:

1. The exam renders on the board as a milestone flag with the attempt label and a small `danger`-tinted dot — never hidden, never shameful styling beyond the dot.
2. The system immediately creates a linked **study period event**: title "{Exam} — preparing for retake", category Exams, hatched fill at 60% opacity, starting the month after the failed attempt.
3. Until the retake date exists, the study period renders 3 months long with a dashed outline and an attached chip "Set retake date" (clicking focuses the auto-added next-attempt card).
4. The next-attempt card is auto-added beneath the failed one, pre-labeled "{Exam} — 2nd attempt" (3rd, 4th…), with the same field set. When its date is entered, the study period's end snaps to that month and the dashed outline becomes solid.
5. Deleting a failed attempt deletes its auto-created study period and renumbers subsequent attempts. A retake card left fully empty at wizard finish is dropped silently; the study period then persists with its dashed provisional render.

**4.4.6 Board effect:** passed/awaiting exams = milestone flags at exam month (label "Step 2 CK · 254" when score present, else "Step 2 CK"); study windows = Exams-category arrows. Scores render on the board only when the student toggles the per-exam "Show score on timeline" switch (in the exam card, default ON when score entered and Result = Passed; locked OFF for failed attempts).

## 4.5 Step 3 · US Clinical Rotations (frozen workflow)

Purpose line: "One rotation at a time. We'll fill in what we can."

**Entry model:** a single always-visible entry card ("Add a rotation") above a list of saved rotation rows. One rotation is composed at a time; "Add rotation" (primary within the card) commits it to the list and clears the card. Unlimited rotations. Saved rows are single-line summaries — "{Specialty} · {Institution} · {Mon YYYY}–{Mon YYYY}" — with Edit (reopens in the entry card) and Delete (with undo toast).

**Fields (order frozen):**

1. **Institution** — search-first typeahead. Behavior frozen: from 2 typed characters, show top 8 matches from the bundled US teaching-institution dataset, each row "Name — City, ST". Arrow keys + Enter select. Final row always: "Use \"{typed text}\" as written" for unlisted sites. Selection auto-fills City and State; free-text selection leaves them blank for manual entry.
2. **Specialty** — same typeahead pattern against the bundled specialty list (all ACGME specialties + common subspecialties); free text allowed.
3. **Rotation type** — select: Elective, Sub-internship, Observership, Externship, Clerkship (core), Other.
4. **City / State** — two fields, auto-filled from institution when known, always editable.
5. **Start / End** — two month pickers (§4.12). End must be ≥ start. Toggle: "Currently on this rotation" → hides End, arrow renders to "now" with an open end (§7.6).
6. **Notes (optional)** — one-line text (e.g., attending name); appears in advisor cheat sheet, never on the board.

**Board effect:** each rotation = a US Clinical arrow from start to end, label "{Specialty} · {Institution short name}".

## 4.6 Step 4 · Work Experience (frozen)

Purpose line: "Clinical or not, US or abroad — work belongs on the story."

Same one-at-a-time entry model as §4.5. Unlimited entries. Fields:

1. **Role / title** — text, required.
2. **Organization** — text, required.
3. **Country** — searchable select, required (international fully supported; no US bias in ordering — alphabetical with the student's school country and the US pinned top).
4. **City (optional)** — text.
5. **Kind** — segmented: "Clinical" / "Non-clinical". Required. (Clinical work renders in Work green with a stethoscope glyph prefix on the label; non-clinical renders plain.)
6. **Start / End** — month pickers; "I still work here" toggle → open-ended arrow.
7. **One-line description (optional)** — feeds the advisor cheat sheet only.

Board effect: Work-category arrow, label "{Role} · {Organization}".

## 4.7 Step 5 · Research (frozen)

Purpose line: "Projects, posters, and papers — with your author position."

Same one-at-a-time entry model. Unlimited entries. Fields:

1. **Project title** — text, required.
2. **Institution / lab** — text with institution typeahead (§4.5 pattern), optional.
3. **Role** — select: Research assistant, Research fellow, Coordinator, Volunteer, Principal investigator, Other(text).
4. **Start / End** — month pickers; "Ongoing" toggle.
5. **Publication status** — segmented: "Not published" (default) / "Submitted" / "Accepted" / "Published". Selecting Submitted/Accepted/Published reveals:
   - **Journal / venue** — text, required for Published.
   - **Publication year** — 4-digit numeric, required for Published.
   - **Author position** — select, frozen options: "First author", "Co-first author", "Second author", "Middle author", "Last / senior author", "Corresponding author". Required for Published.
   - **DOI or PMID (optional)** — text.
6. Publication milestone toggle — "Mark the publication on the timeline" (default ON for Published): adds a Research milestone flag at the publication year labeled "{Journal} · {position short form}" (short forms: 1st, co-1st, 2nd, mid, last, corr.).

Board effect: Research arrow for the project span; optional publication flag.

## 4.8 Step 6 · Personal (frozen)

Purpose line: "The life behind the CV — moves, family, service, anything that shaped the journey."

One-at-a-time entry model. Unlimited entries. Fields:

1. **What happened** — text, required. Placeholder "e.g., Moved to the US · Became a parent · Military service".
2. **When** — segmented "One date" / "A period", then one or two month pickers accordingly.
3. **Icon** — a 12-glyph picker (frozen set: heart, home, plane, baby, ring, star, flag, globe, shield [service], sun, book, sparkle). Default: star.
4. **Visibility** — segmented: "Show everyone" (default) / "Advisor only". Advisor-only items are excluded from interview-safe renders and carry a small eye-off glyph in lists.

Board effect: Personal milestone flag (one date) or Personal arrow (period).

## 4.9 Step 7 · Review & finish (contextual review — frozen)

Purpose line: "Everything in one place. Fix anything, then open your canvas."

Content, top to bottom:

1. **Completeness summary** — six rows, one per domain, each: check/half/empty glyph + "{Domain} · {n} events" + tertiary "Edit" link to the step.
2. **Story checks** — automatic, computed, each rendered as a neutral (never alarmist) row with a "Review" link that jumps to the owning entry. Exactly three check types, frozen:
   - Gap: any span ≥ 6 months between consecutive events → "There's a {n}-month gap in {year}. Interviewers ask about gaps — add what happened, or be ready to talk about it."
   - Overlap: >2 concurrent arrows in any month → "You have {n} things running at once in {Mon YYYY}. That's a strength — check the labels read clearly."
   - Awaiting exam: any exam with Result = Awaiting → "{Exam} result pending — update it when it arrives."
3. Primary button: "Open my canvas →" (to Canvas, Guided Mode). Secondary: "Export now" (to Export).

Finishing the wizard is not a gate: the canvas and export work at any completeness level.

## 4.10 Step completion rules (frozen)

- Started (half circle): any field in the step has a committed value.
- Complete (check): Step 1 — all required fields valid. Steps 2–6 — at least one committed entry, or the student pressed the step's "Nothing to add here" tertiary link (each of steps 2–6 has one, bottom of form: "I have nothing to add here → skip"); skipped steps show a dash glyph, not a check.
- Step 7 shows no state glyph.

## 4.11 Validation (frozen)

Inline, on blur, never modal. Message renders 12px `danger` under the field. Frozen messages: required empty → "Required."; end before start → "End date is before the start date."; score out of range → "USMLE scores run 1–300." / "COMLEX scores run 9–999."; future date beyond +6 years → "That's more than 6 years out — double-check the year." (warning style `ink.secondary`, non-blocking). "Continue →" never blocks on validation except in Step 1 (its required core anchors the axis); in steps 2–6 it simply advances.

## 4.12 Date input component (frozen)

One component everywhere: a month field showing "Mon YYYY". Click opens a calendar-style month/year picker popover (year spinner + 12-month grid, keyboard navigable). Typing directly is fully supported and parses "6/2023", "Jun 2023", "June 2023", "2023-06". Invalid parse → validation message "Enter a month and year, like 'Jun 2023'." Day-level precision does not exist anywhere in the product.

---

# 5 · CANVAS INTERACTION SPECIFICATION

## 5.1 Frame

The Canvas screen = one toolbar (48px) + the board stage. The board is a 16:9 surface at 1920×1080 logical coordinates, scaled to fit the stage at "Fit" by default. Letterbox color `#EFEDE8`. No permanent panels — the 407F left "Add elements / Event list" panel and right "Inspector / Draft history" panel are removed.

## 5.2 Toolbar (frozen, left → right)

1. Mode switch — segmented, center-weighted visual priority: "**Guided**" | "**Advanced Studio**" (§8.4 gate).
2. Divider.
3. "+ Add event" button (secondary) → §5.5 popover.
4. Undo / Redo icon buttons (`undo-2`, `redo-2`), disabled at stack ends.
5. Divider.
6. Theme button ("Theme ▾") → §8.3 popover.
7. Zoom segmented: Fit · 100% · 150% (Fit default). Pinch/trackpad zoom also supported, 50–200%, snapping indicator when passing 100%.
8. Spacer (flex).
9. "History" button (`history`) → §5.8 slide-over.
10. Advisor pins toggle (visible only when advisor comments exist): "Comments · {n}".

In Advanced Studio, an **Insert strip** appears as a second 44px toolbar row (§8.5). In Guided Mode there is no second row.

## 5.3 Selection model (frozen)

- **Click** an element → selected: 2px `focus.ring`-colored outline, plus handles per mode (Guided: left/right end handles on arrows only; Advanced: 8 resize handles on media/text, end handles on arrows).
- Selection summons the **contextual floating toolbar**: a pill-shaped surface 12px above the element (below, if within 64px of board top), auto-flipping, max-width 520px. This toolbar is the product's replacement for the permanent Inspector; every property edit in Guided Mode happens here or directly on the object.
- **Esc** or click on empty board → deselect. **Tab / Shift-Tab** cycles selection through events in chronological order (§11.3). Only single selection exists in Guided; Advanced supports shift-click multi-select for move/delete only.
- **Double-click** any label → inline text edit in place (Enter commits, Esc reverts).
- **Right-click** → context menu: Edit details, Duplicate, {Show everyone / Advisor only} toggle, Bring forward / Send backward (Advanced only, media/text only), Delete.

## 5.4 Contextual toolbar contents (frozen by element type)

| Element | Controls (order frozen) |
|---|---|
| Arrow (event span) | Category color dot (opens category swap menu) · title text (click = inline edit) · start "Mon YYYY" chip · end "Mon YYYY" chip (each opens the §4.12 picker) · visibility eye toggle · "Details" (opens the owning wizard entry in a centered sheet, 560px, same fields as the wizard step) · trash |
| Milestone flag | Same minus end chip; plus icon swap (Personal only); plus "Show score" toggle (Exams with score) |
| Study period (auto) | Start chip · end chip ("Set retake date" chip while provisional) · note "Created automatically after a failed attempt" (Secondary body, non-interactive) · trash |
| Media / text (Advanced only) | Per §8.5 |

## 5.5 Adding events on the canvas (frozen)

"+ Add event" opens a popover with the six category rows (icon + name). Choosing one drops a new event of that category at the board's temporal center, selects it, opens its Details sheet with empty fields. Events created here are the same data objects as wizard-created events and appear back in the wizard lists. There is no separate "canvas-only event" concept — one dataset (§2.4).

## 5.6 Direct manipulation (frozen)

- **Drag arrow body** horizontally → moves the event in time. Snapping: to month boundaries always (both modes). Live tooltip above cursor while dragging: "Jun 2023 – Feb 2024".
- **Drag arrow end handle** → changes duration (start or end respectively), min 1 month.
- **Vertical drag** (arrow or flag) → moves the event to another lane. In Guided Mode, lanes re-run auto-arrange on drop (the element lands in the nearest legal lane; §7.5). In Advanced Studio with Layout lock OFF, vertical position is free (still month-snapped horizontally).
- **Drag flag** → moves its date; flags snap to months.
- Dragging never changes category. Deleting is explicit (toolbar trash, context menu, or Delete key) and always undoable via toast.
- While any drag is active, the adaptive axis (§7) does **not** reflow; reflow runs once on drop (single 240ms settle animation).

## 5.7 Undo / redo / autosave (frozen)

- Undo stack: 50 steps, session-persistent (survives view switches, cleared on app close). Cmd/Ctrl-Z, Shift-Cmd/Ctrl-Z, toolbar buttons. Every mutation (create, edit, move, resize, delete, theme change, mode-switch side effects, intake approval batch) is one undo step; an intake approval batch undoes as one step.
- Autosave: continuous, debounced 800ms, reflected in the header state (§2.1).

## 5.8 History & versions (frozen)

The "History" button opens a right slide-over (360px, scrim over board, dismiss via ✕/Esc/scrim click):

- Top: "Save current as version" secondary button → inline name field, default "Version {n} · {Mon D}".
- List: versions, newest first. Automatic versions are created at: every export ("Export · {date}"), advisor request ("Sent for review · {date}"), "Start over" (§3.2), and before an intake approval batch ("Before CV import · {date}"). Each row: name, date, event count, and two actions: "Restore" (confirm dialog: "Restore this version? Your current board is saved as a version first." → "Restore" primary / "Cancel") and "⋯" menu (Rename, Delete).
- No compare view, no JSON import/export in the student UI (these were 407F debug affordances; removed).

## 5.9 Keynote arrow rendering (frozen — this closes founder directive 12)

- An event arrow is a **flat, solid, tapered Keynote-style arrow**: rectangular shaft with a triangular head. Shaft height 28px; head length 18px, head height 40px (extends 6px above/below shaft); left end square with 3px corner radius. One fill: the category color in the active theme. No plate, panel, card, or rectangle behind or around the arrow or its label — ever, in any theme.
- **Label**: 12.5px/600, single line, ellipsized. If the label fits inside the shaft at ≥ 8px padding each side → centered inside, colored white or `ink.primary` (whichever of the two hits ≥ 4.5:1 on the fill; test both, prefer white). Otherwise → 11.5px/600 in the theme's ink color, positioned 4px above the arrow, left-aligned to the shaft start, **bare text with no background**.
- Open-ended arrows ("Present"): shaft fades to 0% opacity over its final 48px; no head.
- Study periods: same geometry, 45° hatch pattern of the Exams color at 60% opacity; dashed 1.5px outline while provisional (§4.4.5).
- Milestone flags: the canonical Keynote flag — a small date plate (this plate is part of the flag glyph, not a label background) on a 1.5px pole planted on the axis; flag height 34px, plate radius 6px.
- Shadows: each theme's arrow shadow is fixed by §8.2 (`0 1px 2px rgba(0,0,0,.18)` where "on", Little Journeys' softened variant, none for Advisor Paper). No other shadow values exist on arrows.

---

# 6 · DOCUMENT INTAKE SPECIFICATION

## 6.1 Position in the product

Intake is one of the two first-class entry workflows (Home Region B). It also opens from the Builder: each of steps 3–5 carries a footer tertiary link "Have it all in your CV? Upload it instead →". The flow has four stages: **Upload → Extraction → Review → Done**. A slim four-segment progress indicator sits at the top of every stage (segments: Upload, Read, Review, Done).

## 6.2 Stage 1 · Upload (frozen)

- Title: "Add your document". Dropzone (as §3.2 Region B, larger: 200px). Accepted: PDF, DOCX; max 20MB. On file receipt, the detected type renders as a chip: "Looks like: {CV / MyERAS export / Résumé}" with a tertiary "Change" toggle cycling the three (detection heuristic is engineering's; the correction affordance is this chip).
- Privacy line (verbatim, always visible, Secondary body): "Your document is processed for extraction and can be deleted afterward. Nothing appears on your timeline until you approve it."
- One checkbox (unchecked default, required to proceed, verbatim): "I understand I'll review every suggestion before it lands on my timeline."
- Primary: "Read my document →" (disabled until file + checkbox).

## 6.3 Stage 2 · Extraction (frozen)

- Title: "Reading {filename}…". A single indeterminate progress bar plus a rotating status line (2s interval, frozen sequence): "Finding dates…", "Matching institutions…", "Sorting your story…". No fake console logs, no pipeline step lists, no fixture vocabulary.
- On completion (auto-advance): if ≥1 candidate → Stage 3. If 0 candidates → §6.6 empty result card.

## 6.4 Stage 3 · Review (the contextual Review — frozen)

Layout: left column (fluid) = candidate list; right column (420px) = live board preview where accepted candidates appear instantly.

- Title: "Review {n} suggestions". Subline: "Accept what's right, fix what's close, reject what's wrong. Nothing lands until you decide."
- Toolbar row: "Accept all high-confidence ({n})" secondary button · filter chips: All / Accepted / Rejected / Undecided · progress text right-aligned: "{decided} of {n} decided".
- **Candidate card** (one per suggestion), contents frozen: category chip (editable via dropdown — extraction's guess), proposed title (inline-editable), date or range (two §4.12 fields, inline-editable), confidence tag ("High" `success` / "Medium" gold / "Low" `ink.tertiary`), source snippet (the sentence from the document, Secondary body, quoted, collapsible at 2 lines), and three actions: "Accept" (primary-styled small), "Edit" (expands the card into the full field set for its category, per §4 field specs), "Reject" (tertiary).
- Accepted cards collapse to a single `success`-tinted row with "Undo". Rejected collapse to a muted row with "Restore". Duplicate detection: if a candidate matches an existing event (same category + ≥50% month overlap + title similarity), the card carries a gold banner "Looks like a duplicate of '{event}'" and its Accept is replaced by "Merge" (merge = keep existing event, extend its span to the union, append source snippet to its notes) and "Add anyway".
- Footer (sticky): primary "Add {n} accepted events to my timeline →" (disabled at n=0, then reads "Nothing accepted yet"); tertiary "Discard all".
- Nothing is written to the timeline until the footer primary is pressed; that press = one undo step and creates the automatic version "Before CV import · {date}" (§5.8).

## 6.5 Stage 4 · Done (frozen)

Card: `success` check, "Added {n} events from {filename}.", body "Your document has been processed. You can delete it now or keep it for another pass." Buttons: primary "Open my canvas →"; secondary "Review my timeline in the Builder"; tertiary "Delete the document" (confirm-less; toast "Document deleted"). Undecided candidates persist and surface via the Home Region C chip (§3.2) until decided or discarded.

## 6.6 Failure & edge states (frozen)

- Unreadable/scanned-no-text file: card "We couldn't read text in this document. If it's a scan, export a text PDF from MyERAS or your CV app and try again." Buttons: "Try another file" primary / "Use the guided builder instead" secondary.
- Zero candidates from a readable file: "We read it, but didn't find dated events we're confident about. The guided builder takes about 10 minutes." Same two buttons.
- Oversize/wrong type: inline dropzone error "PDF or DOCX, up to 20MB."

---

# 7 · ADAPTIVE TIMELINE LAYOUT SPECIFICATION

## 7.1 Axis anatomy (frozen)

Horizontal year axis at y = 68% of board height. Year segments sit on the axis: year label (numeral, theme-styled) centered under each segment; month tick marks inside each segment (11 minor ticks); a heavier tick + label at each year boundary. Above the axis: event lanes (arrows/flags). Below the axis: the interview target marker (§7.7) and nothing else.

## 7.2 Time span (frozen)

- Start = January of the earliest event's start year, minus 0 padding.
- End = December of the latest of: latest event end/date, interview date if set, current year. 
- Span is clamped to a maximum of 12 years; if data exceeds 12 years, the earliest years compress into a leading "…{startYear}" condensed segment of fixed 64px containing its events at proportional positions (label carries a tooltip "Condensed early years").

## 7.3 Adaptive year widths (frozen algorithm — closes founder directive 13)

Busy years get more room; sparse years get less. Deterministic algorithm:

```
innerWidth = boardWidth − 2·margin          // margin = 96px logical
N          = number of year segments
density(y) = Σ over events e of overlapMonths(e, y) / 12
             (a milestone counts as 1 month; open ends count to span end)
weight(y)  = 1 + density(y)
raw(y)     = weight(y) / Σ weights × innerWidth
Clamp pass: min(y) = max(88px, innerWidth × 0.05)
            max(y) = innerWidth × 0.28
            Clamp each raw(y); redistribute the surplus/deficit
            proportionally among unclamped years; repeat up to 3
            passes; after pass 3, distribute any remainder equally.
Month positions inside a year are linear within that year's width.
```

- Recompute triggers: event add / delete / date change / span change / intake batch / version restore. Never during an active drag (§5.6).
- Transition: year widths animate 240ms ease-in-out; arrows animate to their new x-positions in the same tick. Under reduced motion: instant.
- Guarantee: Σ yearWidths = innerWidth exactly (distribute rounding remainder left to right, 1px each).

## 7.4 Density responses beyond width (frozen)

- If any year's month-pitch < 7px, that year hides minor ticks (keeps quarter ticks).
- If total lanes needed > 6, the board enters **condensed row mode** automatically: lane height 28px, arrow shaft 22px, label 11px. Leaving the condition restores standard mode. No user toggle; this replaces 407F's manual "CONDENSED" button and "CROWDED" chip.

## 7.5 Lane assignment (frozen)

Auto-arrange (always on in Guided; on in Advanced until Layout lock is OFF):

1. Sort events: arrows before flags, then by start date, then longer first.
2. Greedy placement top-down: an event takes the highest lane where it has ≥ 1 month horizontal clearance from every occupant.
3. Category affinity: when multiple lanes qualify, prefer the lane already containing the same category.
4. Flags plant on the axis; their poles extend to their date; overlapping flags (< 1 month apart) alternate two flag heights (34px / 52px).
5. Lane order is stable across recomputes: an event keeps its lane unless a new conflict forces the minimal set of moves.

## 7.6 Open-ended events (frozen)

Render to "now" (current month) with the fade treatment (§5.9). A small "Present" label (10.5px, theme ink, 60% opacity) sits at the fade end of the topmost open arrow only.

## 7.7 Interview target (frozen)

If Core Info's optional interview season is set (an "Interview season" month field appears on the Export screen's Audience card — single month), a downward flag renders below the axis at that month, label "Interview season". This is the only below-axis element.

---

# 8 · THEME & ADVANCED STUDIO SPECIFICATION

## 8.1 Theme system rules (frozen)

- Exactly **five** themes ship. One theme is active per timeline (not per export). Themes restyle the **board only** — never the shell.
- Every theme defines the full token set: board background, axis style, year-label style, six category colors, label ink, flag plate style, arrow shadow on/off, headline font treatment. No theme changes arrow geometry (§5.9) except Little Journeys' corner radius as specified below.
- All five themes pass the §11.5 contrast requirements by construction; the values below are the shipped values.

## 8.2 The five themes (frozen)

**T1 · Keynote Classic** (default) — "The original, perfected."
Board: linear-gradient 165°, `#F5F7FB → #E9EEF6`. Axis: `#2A3442` 2px, ticks `#8B98AA`. Year labels: 20px/700 `#2A3442`. Ink: `#232B36`. Categories: the §2.4 defaults. Flag plates: white, 1px `#C6CFDB` border. Arrow shadow: on. Headline (student name, top-left of board, 24px/700): `#232B36`.

**T2 · Mission Navy** — "Premium dark, gold accents."
Board: radial-gradient at 50% 30%, `#1B2A4A → #0E1730`. Axis: `#D9C489` 2px, ticks `#66738F`. Year labels: 20px/700 `#D9C489`. Ink: `#F2F4F8`. Categories: Education `#5FA8CE`, Exams `#6FA0E8`, US Clinical `#E08B45`, Work `#5FBF7A`, Research `#E3C55A`, Personal `#B08AE0`. Flag plates: `#22304F`, 1px `#3A4A6E` border, ink `#F2F4F8`. Arrow shadow: on. Headline: `#FFFFFF`.

**T3 · Advisor Paper** — "Print-first, calm, zero glare."
Board: flat `#FAF6EC`. Axis: `#4A443A` 1.5px, ticks `#A79E8C`. Year labels: 18px/650 `#4A443A`. Ink: `#33302A`. Categories: desaturated set — Education `#4A7A93`, Exams `#5578B0`, US Clinical `#B06A35`, Work `#55884F`, Research `#A98F3D`, Personal `#7E6398`. Flag plates: `#FFFFFF`, 1px `#CFC7B4`. Arrow shadow: **off**. Headline: `#33302A`. This theme is auto-suggested (one-time toast "Advisor Paper prints best — switch?") when a PDF format is selected in Export while another theme is active; the toast's action applies it, dismissal never repeats.

**T4 · Horizon** — "Modern editorial."
Board: `#FDFCF9` with a horizon band: linear-gradient 180° from `#FFF7EA` (0%) to transparent (26%) across the top 26% of the board. Axis: 1px `#1F232A` with 8px-tall end serifs; ticks `#B9BDC6`. Year labels: 16px/650, letter-spacing .04em, `#1F232A`. Ink: `#1F232A`. Categories: Education `#3D6B7D`, Exams `#3E6FBF`, US Clinical `#D07530`, Work `#3E8E5A`, Research `#C7A23A`, Personal `#8E67C0`. Flag plates: `#1F232A` fill, white ink (inverted plates — the theme's signature). Arrow shadow: on. Headline: 24px/700 with a 24px gold rule beneath.

**T5 · Little Journeys** (Pediatric) — "Warm, rounded, and still professional."
Board: linear-gradient 170° `#F4FAFD → #EAF4F0`. Axis: `#3E5A6B` 2.5px with rounded caps; ticks `#9FB8C4`. Year labels: 19px/700 `#3E5A6B` in rounded type (Nunito; bundled). Ink: `#2E4552`. Categories (pastel-strong, AA-checked): Education `#3E7C96`, Exams `#4C7ECF`, US Clinical `#E0813F`, Work `#4E9E6B`, Research `#D3AC3B`, Personal `#9A6FCB`. Arrow corner radius raises to 8px (only geometry delta any theme applies); flags render as rounded pennants (radius 8). Arrow shadow: on, softened `0 1px 3px rgba(40,70,90,.15)`. Headline: Nunito 24px/800. No cartoons, no clip art — the pediatric warmth comes from shape, palette, and type only.

## 8.3 Theme picker (frozen)

Popover from the Theme button (Canvas toolbar + Export): a 2×3 grid of theme cards (last cell in Guided Mode: "Your background — Advanced Studio" teaser card, non-interactive, lock glyph; in Advanced Studio this sixth cell is the Backgrounds entry, §8.5). Each card: 128×72 live miniature of the student's actual board in that theme, theme name, one-line descriptor (the quoted taglines above). Click applies instantly (undoable). Active card carries a gold border + check.

## 8.4 Modes (frozen — closes founder directives 16/17)

**Guided Mode** (default; the mode every student starts and most stay in):
- Auto-arrange always on. Month snapping always on. Typography locked. Category colors locked to theme. No free elements, no media, no backgrounds beyond the theme's. Contextual toolbar exposes only §5.4's listed controls. It is by construction impossible to overlap labels, break alignment, or leave the theme — "nearly impossible to make ugly" is enforced by the absence of the tools to do so.

**Advanced Studio** (opt-in):
- First activation shows a one-time dialog (per user): title "Advanced Studio", body "Full creative control: backgrounds, images, logos, typography, and free placement. The safety rails come off — Guided Mode keeps a version of your board from just before you switch.", buttons "Enter Advanced Studio" (primary) / "Stay in Guided" (secondary). Entering creates automatic version "Before Advanced Studio · {date}".
- Switching **back to Guided**: dialog "Return to Guided Mode?" body "Your board will be re-arranged automatically. Backgrounds, images, and typography changes are kept but hidden until you return to Advanced Studio." buttons "Return to Guided" primary / "Cancel". On confirm: auto-arrange re-runs, Advanced-only elements (media, text blocks, custom background) are retained in data but not rendered, typography reverts to theme. Re-entering Advanced restores them exactly.
- Exports always render whatever the current mode renders.

## 8.5 Advanced Studio tool set (frozen — the complete list; nothing more, nothing less)

The Insert strip (second toolbar row): **Image** · **GIF** · **Logo** · **Text** · **Background** · divider · **Layout lock** toggle.

1. **Background** — popover with three tabs, frozen: "Presets" (12 curated backgrounds shipped with the product: 4 subtle gradients, 4 paper/linen textures, 4 soft scenic washes; each 96×54 thumbnail), "Upload" (PNG/JPG up to 10MB; auto-fitted cover; a "Dim for readability" slider 0–60%, default 20%, applies a white or black scrim chosen by background luminance), "Color" (flat color via the color picker below). Custom backgrounds belong ONLY here — no background controls exist anywhere in Guided Mode.
2. **Image / GIF / Logo upload** — PNG, JPG, GIF (animated GIFs animate on canvas, export as first frame in PNG/PDF with a one-time notice "GIFs export as a still frame"). Logo is an image with a preset placement: it drops at top-right, 120px wide, snap-aligned to the board margin. All media: move (free drag), resize (corner handles, aspect locked; Shift unlocks), rotate is **not** offered (frozen: no rotation in this release), bring forward/send backward via context menu, delete.
3. **Text** — free text block: font (frozen menu: Inter, Georgia, Nunito), size 10–72, weight (400/600/700), color (color picker), alignment (L/C/R). Applies also to the board headline when selected (typography controls work on the headline only in Advanced Studio).
4. **Color picker** — panel with: theme swatches row, 20-swatch curated palette, hex input, and an **Eyedropper** (uses the native EyeDropper API; the eyedropper button is hidden when the API is unavailable). Recent colors row (last 8).
5. **Layout lock** — toggle, default ON. ON = auto-arrange and lane snapping stay active (Advanced users keep the safety). OFF = free vertical placement of arrows/flags (horizontal month snapping never turns off), auto-arrange suspended. Turning it back ON re-runs auto-arrange (undoable).

## 8.6 Guided/Advanced feature matrix (frozen summary)

| Capability | Guided | Advanced Studio |
|---|---|---|
| Edit event data, dates, categories, visibility | ✓ | ✓ |
| Drag to move/resize arrows (month-snapped) | ✓ | ✓ |
| Theme switch (5 themes) | ✓ | ✓ |
| Undo/redo, versions, history | ✓ | ✓ |
| Auto-arrange lanes | always | Layout lock toggle |
| Backgrounds (preset/upload/color) | — | ✓ |
| Image / GIF / logo upload | — | ✓ |
| Free text blocks + typography | — | ✓ |
| Color picker + eyedropper | — | ✓ |
| Vertical free placement | — | lock OFF only |

---

# 9 · STUDENT WORKFLOW (END TO END, FROZEN)

**Persona anchor:** IMG or US senior, 2–8 weeks before interviews, has a CV, has never used the product, on a laptop.

1. **Arrive** — lands on Home from Matrix. Reads H1/subline, sees the two entry cards and the ghost example. (Five-second contract met: §1.4.)
2. **Choose an entry path** — (a) "Start building" → wizard, or (b) drops CV → Intake. Both paths are complete and interchangeable; a student can do both in either order — intake merges via duplicate detection (§6.4).
3. **Wizard pass** — steps 1→6 in ~10 minutes, watching the live preview grow. Skips what doesn't apply via "Nothing to add here". Fails/attempts handled automatically in Exams (§4.4.5).
4. **Review & finish** — step 7 shows completeness + story checks (gap/overlap/awaiting). Student fixes or acknowledges, presses "Open my canvas →".
5. **Refine in Guided Mode** — drags a rotation arrow to correct months, renames a label inline, tries three themes from the picker, stays in Guided (most students never leave it).
6. **(Power-user branch)** — enters Advanced Studio, uploads school logo, picks a preset background, dims it 20%, returns to Guided or stays.
7. **Advisor gate (optional)** — from Export, "Request advisor review" (§10.2). Continues editing while waiting; advisor comments arrive as pins (§10.4); resolves them; advisor approves.
8. **Export** — Interview-safe ON, PDF Letter for print + PNG 1920 for slides; reads "Printing for interviews" guidance; prints matte-laminated handouts.
9. **Return trips** — Home now leads with "Continue building" and the live Region C preview; new exam result arrives → student updates the Awaiting exam via canvas contextual toolbar → re-exports. The Home chip surfaces any still-undecided intake candidates.

Workflow invariants: at no point does the student meet a permanent inspector, a Review nav item, engine vocabulary, or a decision the product was able to make for them and didn't.

---

# 10 · ADVISOR WORKFLOW (FROZEN)

## 10.1 Model

Advisor review is session-scoped and reached by invitation, never via the student rail. In this release (Matrix integration out of scope), "Request advisor review" generates a local advisor session link/handoff stub (`advisor-session:{timelineId}` route); the review UI is fully specified and functional against local data.

## 10.2 Request (student side)

From Export's Advisor card (§3.6.1-5): "Request advisor review" → sheet: optional message field ("Anything you want your advisor to focus on?"), primary "Send for review". Sends the **Everything** dataset (advisor sees advisor-only items — that is their purpose) plus the student message; creates the automatic version "Sent for review · {date}"; card flips to pending state.

## 10.3 Advisor session screens

One screen, two zones. Left (fluid): the student's board, read-only, rendered in **Advisor Paper** theme regardless of the student's theme (consistent review surface; the student's chosen theme is shown as a small chip "Student's theme: {name}"). Right rail (380px), three stacked sections:

1. **Checklist** — five fixed items, each a tri-state control (untouched / pass ✓ / flag ⚑): "Chronology is complete — no unexplained gaps", "Overlaps look intentional and readable", "Nothing here the student wouldn't want asked about", "Advisor-only items are correctly marked", "The story reads in under 30 seconds". All five must be touched (either state) before Approve enables.
2. **Likely interview questions** — auto-computed list (from gaps ≥6mo, failed attempts, overlaps ≥3, visa status, >2yr since graduation). Clicking a question highlights its source event on the board (gold halo, 2s). Advisor can hide irrelevant ones (per-question ✕); hidden ones collapse into "Hidden ({n})".
3. **Comments** — "Click anywhere on the board to pin a comment." Click drops a numbered gold pin + opens a note field (280 chars). Pins list here with edit/delete.

## 10.4 Comments on the student side

Student's Canvas toolbar shows "Comments · {n}" (§5.2-10). Toggling ON renders the pins; clicking a pin shows the note in a popover with a "Resolve" button. Resolving strikes it for both sides. Pins never render in exports under either audience filter.

## 10.5 Verdict

Footer of the advisor rail: "Approve for export" (gold; enabled per §10.3-1) and "Request changes" (secondary; requires ≥1 comment or ≥1 flagged checklist item; sends pins back). Approval stamps "{Advisor} approved · {date}" onto the student's Export card and Home badge. Any subsequent student edit that changes event data (not theme/mode) downgrades the badge to "Approved {date} · edited since" — it never silently revokes.

---

# 11 · ACCESSIBILITY & RESPONSIVE RULES (FROZEN)

## 11.1 Baseline

WCAG 2.2 AA across the product. All functionality keyboard-operable. All imagery decorative or labeled. Language: `en`. Every screen has exactly one `h1` (the screen title); heading levels never skip.

## 11.2 Keyboard map (global)

| Keys | Action |
|---|---|
| Cmd/Ctrl-Z · Shift-Cmd/Ctrl-Z | Undo · Redo |
| Cmd/Ctrl-E | Go to Export |
| Esc | Close popover/sheet/slide-over; else deselect |
| ? | Keyboard-shortcut sheet |

## 11.3 Canvas keyboard model (frozen)

- Tab / Shift-Tab: cycle event selection chronologically (board is a `role="application"` region with an `aria-label` announcing "Timeline canvas, {n} events; use Tab to move between events").
- Selected event: ← / → move 1 month · Shift-← / Shift-→ adjust end −/+1 month · Alt-← / Alt-→ adjust start · ↑ / ↓ move lane (where legal) · Enter open Details sheet · Delete remove (undo toast).
- Every canvas mutation announces via a polite `aria-live` region, e.g. "Step 2 CK moved to June 2023".
- The contextual floating toolbar is focus-trapped while open via F2 (F2 moves focus into it from the selected element; Esc returns).

## 11.4 Motion & vestibular

`prefers-reduced-motion: reduce` disables: adaptive-width animation, arrow settle animation, popover rise, pulse highlights, GIF autoplay on canvas (GIFs show first frame with a play badge). No parallax anywhere. Nothing flashes above 3Hz.

## 11.5 Contrast & color

- Shell text: `ink.primary` on surfaces ≥ 12:1; `ink.secondary` ≥ 4.6:1; micro labels ≥ 4.5:1. Gold buttons: white on `#B98A2E` = 4.6:1 at 14px/600 — passes AA for its size/weight; the hover `#A67A26` raises it.
- Board labels: the §5.9 white-or-ink rule guarantees ≥ 4.5:1 in all five themes.
- Category is never the only signal: every event also carries its label text, and the category dot appears in lists. Failed attempts add the dot glyph, not color alone (§4.4.5).
- Focus ring (§3.1) on every focusable, including arrows and flags on the board.

## 11.6 Responsive behavior (frozen breakpoints)

| Range | Behavior |
|---|---|
| ≥1440px | Full layout as specified. Content max 1440px centered. |
| 1280–1439 | Wizard preview pane narrows (min 420px holds; form column compresses to 480px). |
| 1024–1279 | Wizard preview collapses to a top-right "Show preview" toggle (opens as overlay sheet). Home regions A/B stack vertically. Canvas fully functional. |
| 768–1023 (tablet) | Rail becomes bottom tab bar (4 items). Home, Builder, Intake fully functional. Canvas opens in **view-only** (pan/zoom, theme picker, no editing) with banner "Editing needs a larger screen." Export functional. |
| <768 (phone) | Home (stacked), Builder forms, and Intake work — capture-first philosophy. Canvas and Export render a preview + the banner above with "Email me a reminder" absent (frozen: no email feature; button is simply not present). |

Touch: all targets ≥ 44×44pt on touch devices; drag interactions gain a 8px touch slop; the contextual toolbar renders as a bottom sheet on touch screens narrower than 1024px.

---

# 12 · PROTOTYPE ACCEPTANCE CRITERIA (FROZEN)

The implementation passes this freeze when every item below is demonstrably true. Each is binary.

**Five-second contract**
1. Home renders the exact H1, subline, and 3-step strip of §3.2; "← Matrix" is visible top-left; "Start building" is the only gold element in Region A; Region B upload card is present with its assurance line.

**Navigation & chrome**
2. The rail contains exactly Home, Builder, Canvas, Export — no Review, Media, Advisor, Questions, Versions, Reference, Command items anywhere.
3. No XP bar, coins, level, or avatar hex exists. No engine-status chips or draft-telemetry panel exists. The rail has no footer text.
4. Header shows autosave state and an Export button disabled at 0 events with the specified tooltip.

**Wizard**
5. Builder shows a 264px vertical stepper with 7 steps titled exactly as §4.1; the current step renders one 28px title; no horizontal step chips exist.
6. Step 1 is titled "Core Info" and contains the medical-school fields (§4.3).
7. USMLE and COMLEX are independently selectable; both can be active; exams are added via chips, none pre-added.
8. Score/result render visually larger than and above dates in every exam card.
9. Setting a result to "Failed" instantly: adds the retake card, draws the hatched provisional study period with dashed outline and "Set retake date" chip; entering the retake date snaps the study period closed. Attempt numbering is automatic and only visible from the 2nd attempt.
10. Rotations: institution typeahead returns matches with city/state auto-fill; free-text fallback row works; unlimited rotations can be added one at a time; same for Work and Research entry models.
11. Research captures publication status, journal, year, and the six author positions of §4.7.
12. Steps 2–6 each have the "Nothing to add here" skip link; step 7 shows completeness rows and the three story-check types with working jump links.

**Intake**
13. The Upload → Extraction → Review → Done flow matches §6; the consent checkbox gates extraction; zero events reach the timeline before the Review footer primary is pressed; that press is a single undo step and creates the "Before CV import" version.
14. Candidate cards show confidence, source snippet, inline edits, Accept/Edit/Reject; "Accept all high-confidence" works; duplicate candidates offer Merge.

**Canvas**
15. No permanent side panels exist on Canvas. Selecting an element summons the floating contextual toolbar with exactly the §5.4 controls for its type; Esc dismisses.
16. Arrows render per §5.9: flat tapered Keynote arrows, labels inside-or-above with no plate/background behind arrow or label in any theme.
17. Drag body = move (month-snapped, live date tooltip); drag tip = duration; vertical drag = lane move; axis reflow runs only on drop.
18. Undo (50 steps) and the History slide-over with manual + the four automatic version types of §5.8 work; JSON import/export UI does not exist.

**Adaptive layout**
19. With events concentrated in 2 of 6 years, those year segments are measurably wider (and the sparse years narrower) per the §7.3 algorithm; widths sum exactly to innerWidth; transitions animate 240ms (instant under reduced motion).
20. >6 needed lanes triggers condensed row mode automatically; no manual condensed control exists.

**Themes & modes**
21. Exactly five themes exist with the §8.2 names and palettes, including Little Journeys (pediatric); the picker shows live miniatures of the student's own board.
22. Guided Mode exposes no background, media, typography, or free-placement controls. Advanced Studio exposes exactly the §8.5 tool set including preset + uploaded backgrounds, eyedropper, and Layout lock; the two mode-switch dialogs match §8.4 verbatim.
23. Background upload with dim slider exists only inside Advanced Studio.

**Export & advisor**
24. Export matches §3.6: audience segmented control with the danger copy on "Everything", four format options, filename pattern, and the collapsed "Printing for interviews" accordion containing the §3.6.4 copy verbatim (matte cardstock + matte lamination recommendations present).
25. Advisor session renders per §10: Advisor Paper forced, five-item tri-state checklist gating Approve, click-to-pin comments, computed questions with highlight-on-click; approval badge and "edited since" downgrade behave per §10.5.

**Accessibility & responsive**
26. Full keyboard operation of the canvas per §11.3 including live-region announcements; visible focus ring everywhere; reduced-motion kills all listed animations; tablet gets view-only canvas with the exact banner copy; phone gets Home/Builder/Intake.

**Language sweep**
27. A text sweep of the UI finds zero instances of: "fixture", "quarantine", "engine", "dupe", "command", "stress", "sprite", "OP D1", and zero ALL-CAPS sentences outside the micro-label style.

---

# 13 · CLAUDE OPUS / CLAUDE CODE IMPLEMENTATION HANDOFF

## 13.1 Standing orders

You are the implementation engineer. You are forbidden from redesigning. This document has already made every UX decision. Your job is fidelity.

1. Build exactly what §§1–12 specify. Quoted copy is verbatim — do not rephrase, do not title-case, do not "improve".
2. Numbers are exact: spacing, sizes, durations, clamps, breakpoints, algorithm constants.
3. If you meet a situation this document does not cover, **stop and ask**, citing the section you checked. Do not interpolate a design. An unasked question that becomes an invented UX decision is a defect.
4. Do not add features, screens, settings, toggles, empty states, or copy beyond what is specified. Absence is intentional (see §1.6 removals and the "nothing more, nothing less" clause of §8.5).
5. Matrix integration remains out of scope: implement the "← Matrix" link and advisor-session route as the specified local stubs.
6. Preserve the existing engineering strengths of D1-413R: keep the accessibility and test infrastructure, the timeline domain service, persistence, and export pipeline. This freeze changes the experience layer, not the architecture.

## 13.2 Where the code lives

- Package: `/Users/brianb/MissionMed_worktrees/D1-MacProTimeline-400/packages/mission-timeline` (service: `src/domain/timeline-service.ts`, export: `src/export/`, persistence: `src/persistence/`; UI in `web/`).
- Donor for board-rendering quality and the Keynote visual language: the 407F prototype (`D1MacProTimelineFable5DefinitiveFullProductPrototype407F.html`). Reuse its arrow/axis/flag rendering mathematics; discard its shell, rail, HUD, inspector, and label plates per this freeze.

## 13.3 Build order (frozen milestones — each independently reviewable)

| M | Deliverable | Freeze sections |
|---|---|---|
| M1 | Design tokens, type scale, shell (header, 4-item rail), buttons, toasts, date component | §3.1, §2.1, §4.12 |
| M2 | Home (3 regions, empty state, resume states) | §3.2 |
| M3 | Timeline data model + adaptive axis/lane engine (render-only board) | §2.4, §7 |
| M4 | Arrow/flag rendering to §5.9 (plate removal) in Keynote Classic | §5.9, §8.2-T1 |
| M5 | Wizard: stepper shell + steps 1–6 + live preview | §4.1–4.8, §4.10–4.12 |
| M6 | Exams automation (attempts, failure → study period) | §4.4 |
| M7 | Step 7 Review & finish + story checks | §4.9 |
| M8 | Canvas Guided Mode: selection, contextual toolbar, direct manipulation, add-event, undo, History | §5 |
| M9 | Document Intake flow end-to-end | §6 |
| M10 | Remaining four themes + theme picker | §8.2, §8.3 |
| M11 | Advanced Studio (gate, insert strip, backgrounds, media, text, color/eyedropper, layout lock) | §8.4–8.6 |
| M12 | Export (controls, preview, filename, printing guidance) | §3.6 |
| M13 | Advisor session + pins round-trip | §10 |
| M14 | Responsive + accessibility hardening + language sweep | §11, §12-26/27 |

Definition of done per milestone: its acceptance-criteria rows in §12 pass, plus existing package tests stay green.

## 13.4 Component inventory (build these; name them exactly)

`AppShell`, `RailNav`, `TopHeader`, `AutosaveIndicator`, `HomeRegionBuild`, `HomeRegionIntake`, `HomeRegionPreview`, `WizardStepper`, `WizardStepFrame`, `EntryCard` (shared one-at-a-time model for rotations/work/research/personal), `TypeaheadField` (institution/specialty/school), `MonthField` (the §4.12 component), `ExamSystemToggle`, `ExamCard`, `StudyPeriodBadge`, `BoardCanvas` (render engine), `AdaptiveAxis`, `EventArrow`, `MilestoneFlag`, `ContextToolbar`, `DetailsSheet`, `AddEventPopover`, `ThemePicker`, `HistorySlideOver`, `ModeSwitch`, `InsertStrip`, `BackgroundPanel`, `ColorPicker` (with eyedropper), `IntakeFlow` (4 stages), `CandidateCard`, `ExportScreen`, `PrintGuidance`, `AdvisorSession`, `CommentPin`, `ChecklistTriState`.

## 13.5 Known trap list (each of these was a 407F behavior you must NOT carry forward)

- Do not render label plates behind arrows (§5.9).
- Do not build a permanent Inspector, event-list panel, or add-elements panel on Canvas (§5.1).
- Do not surface JSON import/export, stress fixtures, demo-load buttons, or mode segments ("Blank/Demo/Reference") in the product UI (§5.8, §1.6).
- Do not pre-populate any exam, rotation, or event (§4.4.2).
- Do not add a manual "Condensed" toggle (§7.4) or a "Save draft" button (§4.2).
- Do not gate canvas or export behind wizard completion (§4.9).
- Do not let any intake content touch the timeline before the Review footer action (§6.4).
- Do not put background/media/typography tools anywhere in Guided Mode (§8.5-1, §8.6).

## 13.6 Asking protocol

When blocked, ask one question per blocking issue in this exact form: "Section {n} — situation: {one sentence}. The spec does not cover {gap}. Proposed literal reading: {one sentence}." Then wait. Never batch a design change with a question.

---

# 14 · COMPLETE COMBINED HANDOFF

## 14.1 One-paragraph brief

Rebuild Timeline Builder's experience layer on top of D1-413R: a calm, light, premium 4-destination shell (Home / Builder / Canvas / Export); a Home page of exactly three regions with frozen copy that satisfies the five-second contract; a 7-step vertical wizard (Core Info, Exams, US Clinical Rotations, Work Experience, Research, Personal, Review & finish) with unlimited one-at-a-time entries, typeahead institution/specialty search, and fully automatic exam-attempt and study-period behavior; a CV/MyERAS intake flow whose extractions are reviewed and approved before anything lands; a Keynote-faithful canvas with plate-free tapered arrows, adaptive year widths, contextual-only editing (no permanent inspector), 50-step undo, and versioned history; two modes — locked-safe Guided and Canva-class Advanced Studio (backgrounds, media, GIFs, logos, eyedropper, typography, layout lock); five frozen themes including the pediatric Little Journeys; an Export screen with audience filtering, four output formats, verbatim printing/lamination guidance, and an advisor review session with checklist, pins, computed questions, and an approval badge. Every decision is in this document; none remain for the implementer.

## 14.2 Founder directive traceability (all 18 — frozen resolution pointers)

| # | Directive | Resolved in |
|---|---|---|
| 1 | Home → three regions; Upload first-class; Build primary; no status noise | §3.2, §1.6 |
| 2 | Wizard rebuilt; one large title; no clipped tabs; Identity → Core Info incl. Medical School | §4.1–4.3, §3.3 |
| 3 | Exams workflow: USMLE/COMLEX independent, auto attempts, score/result primary, dates secondary, calendar + manual, failure → study period | §4.4, §4.12 |
| 4 | US Experience → US Clinical Rotations; one at a time; institution & specialty search; city/state auto-fill; unlimited | §4.5 |
| 5 | Work Experience: unlimited, international + US | §4.6 |
| 6 | Research: unlimited, publication details + author position | §4.7 |
| 7 | Personal Milestones → Personal; flexible user-defined events | §4.8 |
| 8 | Document Intake among first workflows; upload → AI extract → review → approve; nothing lands automatically | §3.2-B, §6 |
| 9 | Permanent Review removed; Review contextual | §2.3, §4.9, §6.4 |
| 10 | Canvas: direct edit, move, resize, images, GIFs, logos, undo, versions | §5.3–5.8, §8.5 |
| 11 | Permanent Inspector removed; contextual editing | §5.1, §5.3–5.4 |
| 12 | Arrows fixed: no rectangular backgrounds; clean Keynote appearance | §5.9 |
| 13 | Adaptive year widths (busy wide, sparse narrow) | §7.3 |
| 14 | Unnecessary navigation removed (11 → 4) | §2.1, §2.3 |
| 15 | Five genuinely different themes, one pediatric | §8.2 |
| 16 | Guided Mode + Advanced Studio as specified | §8.4–8.6 |
| 17 | Background upload OR curated presets — Advanced Studio only | §8.5-1 |
| 18 | Printing guidance inside Export: matte lamination + professional printing | §3.6.4 |

## 14.3 Supersession & change control

This document supersedes 407F's implied UX and all earlier direction. It is frozen: changes require an explicit founder decision, recorded as an addendum (D1-UXR-001-A1, A2, …) — never edited in place. The implementation model treats the latest addendum chain as authoritative and everything else here as immutable.

## 14.4 Final word to the implementation team

The founder's bar is a product that explains itself in five seconds, forgives every mistake, and outputs a timeline a program director wants to hold. Every pixel decision needed to reach that bar is written above. Build it exactly.

— *End of D1-UXR-001. Frozen.*
