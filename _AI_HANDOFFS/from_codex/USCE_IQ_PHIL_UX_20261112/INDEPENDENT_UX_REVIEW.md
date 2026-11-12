# Independent UX review — Clinicals HQ, November 12

Model: **claude-sonnet-4-6**, authorized Sonnet fallback for unavailable configured Fable5.2. Read-only; root retained sole implementation and production custody.

## Final disposition and evidence limits

The original report below reviewed sourceaad00cd. Its actual-artwork supplement reviewed82a1192. Final applicationba64a9f21f551902f2efe2557fa109a4b666d0ff adds the complete Communications approval row in the fixed footer and a mobile header that grows with wrapped controls. Final actual390px checks passed Close, Communications, the step-by-step Journey and both approval rows without horizontal overflow. A fresh independent Sol source review approved that final delta, and root verified its44px row fully visible and operable inside the412px live viewport.

All three original blocking findings were resolved: fixed Journey approval; actionable no-student navigation with visible guidance; truthful Unassigned context. Pipeline CTA, message-proof contrast, Review focus/Edit, and generic approval visibility were also corrected. **No critical Phase1 failure remains.** This is not pixel-perfect canon certification.

Both model reviews used source and actual-live captured screenshots, not an independent authenticated interactive browser replay. Root performed the live interactions; separate independent focused verification checked serving hashes, source/security boundaries, Info receipt/reply evidence, rollback and screenshots. Guard tests are evidence, not proof that all attacks are impossible.

### Validated corrections to model inferences

- Unassigned is already a clickable filter: live root verification loaded all37 messages. No duplicate triage feature is required.
- No-student rail guidance is a visible action-triggered banner plus toast, not hover-only. Fresh Phil-session clicks verified both Build offer and Offer history.
- Approved Dashboard01 contains four KPIs; approved Journey05 contains six steps. The supplement's five/eight counts are incorrect.
- Journey Save & exit already invokes existing Offer persistence/preview; Composer Back to workspace preserves only RAM text unless Save draft is used. Do not apply misleading save labels.
- Pipeline cards are whole buttons with a styled CTA span; nested buttons were rejected.
- Portrait/upload infrastructure, count suppression and backend rebuilding were not implemented from speculative recommendations. Truthful initials/approved asset fidelity and clearer filter labels remain possible future polish.
- The first review missed unreadable generic proof text and generic approval clipping. Actual screenshot/geometry checks and independent focused review caught them; final source fixes both. Contrast13.02:1 is calculated evidence, not a JPEG-derived measurement.
- Original tests/source/screenshot references retain their original review context. Security conclusions and remaining recommendations below are reviewer analysis, not canonical authority or blanket implementation instructions.

Raw reviewer outputs are preserved locally in the task evidence sandbox. Original report and supplement follow verbatim so the orchestration chat can audit their findings and limitations.

---

I now have sufficient evidence across all sources. Let me compile the full report.

---

# MissionMed Clinicals HQ / USCE IQ — Independent UX Red-Team Report
**Reviewer:** Sonnet 4.6 (Fable 5.2 fallback, authorized by Founder)
**Evidence date:** 2026-11-12
**Source:** aad00cd, SHA256 bbfa86…a16 (CDN-verified)
**Scope:** Clinicals HQ UI only — no inventory, file vault, matrix, or new backend

---

## 1 — Overall UX Verdict

**Phil-fitness: Conditionally releasable. Three friction points require resolution before unsupervised production use.**

The Phase 1 work has materially improved the application. The Communications composer now leads with a prominent student-name/email search box, satisfying the Founder's primary blocker. The Journey wizard has clear step titles, guarded forward navigation, inline recovery for expired offers (aad00cd), RAM persistence of unsaved text across close/reopen, and an idempotency guard that prevents double-sends. Backend approval, recipient, and revision guards are thorough and test-proven.

The experience, however, still fails the "extremely nontechnical Phil" bar in three specific places:

| # | Issue | Type |
|---|-------|------|
| A | **Approval checkbox below fold** in Review step under compact iframe viewport (~276–435px body height) | **Release-blocking P1** |
| B | **"Build offer" and "Offer history" silently disabled** in rail with no explanation — Phil will think the app is broken | **Release-blocking P2** |
| C | **"Needs Review: 37"** in Communications sidebar is alarming and contextless | **Release-blocking P2** |

---

## 2 — Top 10 Actual Problems (ranked by severity)

| # | Problem | Evidence | Severity |
|---|---------|----------|----------|
| 1 | **Approval checkbox below viewport fold in Journey Review (Step 5)** | Screenshot `06/08`: two-column review panel fills entire ~276–435px body; checkbox (`mmJourneyApproval`) is below both panels in DOM (source:1288); Next button appears dead to Phil | **P1** |
| 2 | **Rail "Build offer" / "Offer history" disabled with no tooltip or explanation** | Source:866–867 (`disabled` attribute, no title/aria-describedby); no visual diff between "can't use yet" and "broken" for nontechnical user | **P1** |
| 3 | **"Needs Review: 37" in Communications sidebar is alarming** | Screenshot `04`: leftmost folder count; this count is not contextualised; Phil may feel overwhelmed and unable to act | **P2** |
| 4 | **Pipeline "Continue →" / "View →" affordance is too small** | Screenshot `03`: action is inline muted text ("In progress · Continue →"), not a button; Founder standard = BIG OBVIOUS BUTTONS | **P2** |
| 5 | **Journey has two close paths with different save semantics** | Source:1281 header × (`mmJourneyClose`) vs source:1291 footer "Save & close" (`mmJourneySaveClose`); Phil cannot tell which preserves work | **P2** |
| 6 | **"Delivery attention" button in Communications is technical jargon** | Screenshot `04` header; label describes a backend dispatch triage concept; Phil does not know what to do | **P2** |
| 7 | **Journey footer state text is too small to notice on failure** | Source:1291 `<span id="mmJourneyState" role="status">` between Back and Next; when Next is blocked (step 4 approval required), the error guidance appears here but is visually secondary | **P3** |
| 8 | **"Back to workspace" in Composer dismisses dialog without explicit confirmation of text preservation** | Source:1252; test confirms RAM text is kept (`usce-v3-communications-ui.test.mjs`:94–99), but Phil is not told; "Back to workspace" label suggests leaving, not saving | **P3** |
| 9 | **Stat card decorators (◇ ↻ ➤ ✓) are abstract symbols** | Source CSS:554–555; icons are `::before` pseudo-elements positioned absolutely; not immediately meaningful without labels | **P3** |
| 10 | **"All active cases" and "Most Urgent" filter labels are mildly technical** | Screenshot `02` toolbar; Phil may not understand the filter domain or feel uncertain the right cases are shown | **P3** |

---

## 3 — Top 10 High-Impact Improvements

| # | Improvement | Benefit | Complexity | Risk |
|---|------------|---------|-----------|------|
| 1 | **Anchor/sticky approval bar at bottom of Review body or surface it above routing details** | Eliminates P1 silent Next failure | Low CSS | Low |
| 2 | **Rail disabled buttons: add `title` tooltip + inline "(select a case first)"** | Eliminates P1 "broken app" impression | Trivial | None |
| 3 | **Rename/filter "Needs Review" count to "My inbox needs attention" or suppress if 0 assigned** | Eliminates overwhelming P2 count | Low | Low |
| 4 | **Convert Pipeline card action to full `<button class="mm-btn mm-btn-primary">Continue →</button>`** | Satisfies Founder "big obvious button" standard | Low | Low |
| 5 | **Consolidate Journey close to single "Save & exit" in header; remove footer Save&close or relabel** | Removes P2 close-path ambiguity | Low | Low |
| 6 | **Rename "Delivery attention" to "Check message delivery"** | Plain English; Phil understands | Trivial | None |
| 7 | **Surface Journey footer state text as a toasted banner when Next is blocked** | P3: makes error visible | Low | Low |
| 8 | **Change Composer "Back to workspace" to "Save draft & close" (or add subtext: "Your draft is saved")** | Phil knows text is preserved | Trivial | None |
| 9 | **Replace abstract stat card `::before` icons with short text labels ("New", "Working", "Offered", "Done")** | Immediate comprehension | Low CSS | None |
| 10 | **Simplify filters: "All cases" and "By urgency"** | Removes mild cognitive load | Trivial | None |

---

## 4 — Step-by-Step Phil Journey Analysis

### A. First-time experience / Login

**Verdict: PASS (source-inferred, not interactively verified)**

- Login dialog (`mmAdminLogin`): Source:1365–1371 — "Welcome to Clinicals. Continue with your MissionMed administrator account." followed by "LOGIN / CONTINUE AS ADMIN →" and password-recovery link. Plain English. Single clear action. No technical terminology.
- Login button is styled prominently (`mmAdminContinue`).
- Intro sequence (`mmIqIntro`): Skip button present and labeled "Skip intro — open workspace" — good for Phil when in a hurry.
- **Gap**: The intro `mmIqIntro` div is `hidden` by default; JS controls visibility. If the intro displays before WP authentication completes and then Phil is returned to a blank state, this may disorient. Not interactively verified.

### B. Dashboard

**Verdict: PASS with minor issues**

- Observed (screenshot `02`): "USCE Clinical Requests" large heading; sub-line "Choose a student. We will guide you through the next step." — directly guides Phil. ✓
- Status bar: "Secure admin access: Cases updated at 2:36:30 PM. Select a case to review its next step." — clear and reassuring. ✓
- 4 stat cards (New / In Progress / Offered / Accepted) with large numbers and icon decorators — counts are immediately visible. ✓
- Each row has a prominent "Continue →" button in a styled box. ✓
- **Issue (P3)**: Stat card icons (◇ ↻ ➤ ✓) are decorative CSS pseudo-elements not labeled with their meaning. Phil reads the number correctly but may not associate ◇ with "New" without the label.
- **Issue (P3)**: "All active cases" / "Most Urgent" filter labels — mild friction; Phil likely leaves them alone.
- **Issue (P2 from §2)**: Disabled rail items "Build offer" and "Offer history" — Phil sees these without explanation.

### C. Pipeline

**Verdict: CONDITIONAL PASS — action affordance too weak**

- Observed (screenshot `03`): Clean kanban with column headers New / In Progress / Offered / Accepted and counts. Cards show student name, specialty, dates, status. ✓
- **P2 Issue**: The action CTA is inline text "In progress · Continue →" or "Offer sent · View →" rendered as muted body text, NOT a styled button. Phil's cursor may not reveal this as clickable at a glance. Founder standard: "BIG, OBVIOUS BUTTONS. ONE CLEAR NEXT ACTION."
- Columns collapse to stacked layout on narrow viewport (source CSS confirms mobile breakpoints). ✓

### D. Student Details (overview)

**Verdict: PASS (evidence limited — no dedicated screenshot)**

- Rail nav "Student details" is enabled independently (source:864). It activates the `overview` mode in `setV3Workspace`.
- Student detail pane includes preferences grid (3 columns: Specialty, Location, Timing), quick actions, admin tracker, activity timeline.
- When a case is selected, quick action buttons ("Build Offer", "Send Message") are present in the student detail view (source: `mm-quickact` div).
- **Source-inferred only**: Student detail content is dynamically rendered; not independently observed in a dedicated screenshot.

### E. Build Offer (Journey)

**Verdict: CONDITIONAL PASS — P1 approval visibility issue**

**Step 1 — Student (screenshot `05`):**
- Heading "First, the right student." ✓
- Student preferences table clearly displayed (Specialty, Location, Requested months, Length, Notes) ✓
- Sub-line "Review their request. We'll use these preferences to help you prepare an offer." ✓
- "Next: Select Program →" CTA is prominent navy button, right-aligned ✓
- "Back" is a ghost button ✓
- Status text: "Saved draft — nothing sent by opening this Journey" — reassures Phil ✓
- Left sidebar: Numbered steps 1–6 as clickable buttons; step navigation is guarded (tests confirmed) ✓
- Save & exit access in header ✓

**Step 4 — Email (screenshot `07`):**
- Heading "What would you like to say?" ✓
- TO / FROM email addresses clearly displayed ✓
- Three template action buttons (Use template, Edit message, Start blank) — per Founder directive ✓
- Inline confirmation prompt before replacing message text (no native `confirm()` alert) ✓
- Subject and Message fields are present and editable ✓
- Message field is scrollable, labeled clearly ✓
- "Review this message →" CTA is prominent ✓

**Step 5 — Review (screenshots `06`, `08`):**
- **P1 ISSUE**: The two-column layout (STUDENT + ROUTING AND RESPONSE DEADLINE) fills the entire visible body area. The approval checkbox (`I approve this exact offer and message for this student.`) lives in the DOM *after* the routing panel (source:1288) and is not visible in either screenshot `06` or `08`. Phil sees "Continue to send →" but clicking it fails silently (journey blocks forward navigation if approval unchecked, per test `usce-journey.test.mjs`:112–116). The status text `mmJourneyState` updates with "approval box" guidance but this text is secondary and easily missed.
- The routing panel does show "Approval: Approval required before sending" as a row — Phil sees the word but cannot act on it from that position.
- "Continue to send →" label is good plain English ✓

**Step 6 — Send (source-inferred):**
- "Ready to send?" heading ✓
- "Send this approved offer" is the single CTA button ✓
- After send: status text updates (no native `alert()`); idempotency guard disables button after one send ✓

**Journey Navigation:**
- Each step in the left rail is a `<button>` with `data-journey-progress` (confirmed by test assertion) ✓
- Forward jumps are guarded: missing program fields → returns to step 0 with explanation; expired offer → returns to Dates with "Change the response deadline in Dates" message (aad00cd) ✓
- RAM text preservation: closing and reopening the Journey preserves unsaved text without network writes ✓
- Cross-step text preservation: navigating back from Email to Program preserves personalized message text ✓

### F. Communications

**Verdict: CONDITIONAL PASS — "Needs Review: 37" is alarming**

**Writing a new message:**
- Observed (screenshot `04`): "＋ Write Message" button is prominent navy CTA in left sidebar ✓
- Composer modal (screenshot `01`): leads with "Write a message" heading and "Back to workspace" close option ✓
- Student search (source:1256): `<input type="search" placeholder="Search student name or email">` — prominent, labeled "Who are you writing to?" ✓
- Recipient auto-fills after one-click selection ✓
- FROM address visible (clinicals@missionmedinstitute.com) ✓
- Three template choices (Use template / Edit message / Start blank) ✓
- "REVIEW MESSAGE" is a primary navy button (source:1275) ✓
- Send appears only after approval, hidden before that ✓
- Approval checkbox: `I approve this exact message and recipient.` — clearly labeled ✓
- Text preserved in RAM across close/reopen (test confirmed) ✓

**Finding previous conversations:**
- Left sidebar shows folders: Inbox, Sent, Drafts, Unread, Needs Review ✓
- Thread view with Reply and "Open case" buttons — clear ✓
- Thread renders inbound body as plain text (XSS sanitised, test confirmed) ✓

**Identifying replies:**
- "Inbox: 2" count clearly visible ✓
- Thread title "Re: [USCE QA TEST]..." clearly shows it's a reply ✓

**P2 issues:**
- **"Needs Review: 37"**: Large count with no context. Phil sees 37 items needing his attention but doesn't know what they are, how urgent they are, or whether he is responsible for all of them. This is emotionally overwhelming. _(Source-inferred: based on Communications folder structure visible in screenshot 04; not independently triaged)_
- **"Delivery attention" button**: Plain text button at top of Communications (screenshot `04`) — Phil doesn't know if he needs to act on this or what it means. Technically: a dispatch triage panel for ambiguous/failed sends (confirmed by test `usce-v3-communications-ui.test.mjs`:34–38).

### G. Navigation and State Preservation

**Verdict: PASS with P2 disabled-button explanation gap**

- Rail navigation buttons work correctly: Dashboard / Pipeline / Student details / Communications all navigate independently ✓
- "Build offer" and "Offer history" are disabled when no case selected (source:866–867) — functionally correct but unexplained
- Navigate to Pipeline → then Dashboard preserves selected case (test confirmed) ✓
- Closing Journey mid-flow and navigating to pipeline/dashboard preserves `selectedRequestId` and dirty state ✓
- Return focus after Journey close: `journey.returnFocus` is restored (source:3657–3658) ✓

### H. Error Recovery

**Verdict: MOSTLY PASS — approval silent failure is P1**

- Expired offer → redirect to Dates with "Change the response deadline in Dates" (aad00cd, test confirmed) ✓
- Missing program fields → redirect to Student step with explanation text ✓
- Stale draft save (409) → composer stays open, status text reads "draft changed, text is retained" (test confirmed) ✓
- Mismatched server recipient → error thrown, composer text preserved (test confirmed) ✓
- **P1 exception**: Clicking "Continue to send →" in Review when approval checkbox not yet visible/checked → journey stays at Review, status text updates with "approval box" guidance, but Phil has no visual clue that the checkbox (which he can't see) is the reason
- Send attempted after already sent → button disabled; "Check its recorded status before trying again." — this is technical language (screenshot `01`), but acceptable as a safety message since it appears only after first send attempt

---

## 5 — Visual Fidelity Against Canon Images

**Canon PNGs unavailable at `/tmp/usce-iq-correction-references/`** at time of review; this directory contained no files. Assessment is therefore based on: (a) live screenshot evidence, (b) source CSS, and (c) the CDN-backed `approved_reference.png` mountain image referenced in source:549.

| Dimension | Observed (screenshots + source) | Verdict |
|-----------|--------------------------------|---------|
| **Canon 01 — Main Dashboard** | Navy gradient sidebar with MM logo + dark rail; white case list with column headers (Student / Preferences / Months / Status / Next step); 4 stat cards with large numbers and decorative icons; "Continue →" action buttons. The mountain photo overlay is applied via CSS `::after` pseudo-element from `approved_reference.png` (source:549). | **Matches described reference** (source-inferred; canon PNG unavailable) |
| **Canon 03 — Offer Pipeline** | 4-column kanban (New / In Progress / Offered / Accepted) with student cards per column, counts, and "In progress · Continue →" / "Offer sent · View →" action links. | **Structurally matches; action affordance is weak** (independent observation) |
| **Canon 05 — Build Offer** | Sidebar with numbered steps 1–6, branded header, body with step-specific form, footer with Back/Next/Save&close. Journey is full-screen dialog in V3. | **Matches described wizard pattern** (source-inferred) |
| **Mountain hero (all views)** | CSS applies mountain background crop from `approved_reference.png` at right edge of hero; mask fades to transparent (source:549). | **Present and correct** |
| **Brand identity** | Navy (#09213b–#173755), gold (#d5aa40–#efc96a), serif font for headings in Journey, Georgia/system serif for hero headline, premium shadow system. | **Consistent with MM premium identity** |
| **Rail contrast** | Sidebar background `linear-gradient(160deg,#071a2d,#15334e)` with white text; active item has gold left-border. WCAG contrast for white text on this background ≈ 15:1. | **PASS** |
| **Body contrast** | Main content text `#122541` on `#f2f5f9` ≈ 11:1. Muted text `#5e708b` on white ≈ 4.3:1 (just above 4.5:1 WCAG AA threshold for normal text at 11px). | **Borderline at muted text size** (source-inferred) |
| **Button target sizes** | Rail buttons: `min-height:44px` (source:442 / V3 rail). Journey progress: `<button>` elements per test, V3 styles. Email choices in Composer: `min-height:44px` (source:819). | **PASS for major interactive targets** |
| **Small action buttons in V2 panel** | In V2 (`mm-v2`), detail-action buttons: `min-height:28px; height:28px` (source:606) — below 44px WCAG touch target. | **FAIL for V2 detail panel buttons** (source-inferred) |

---

## 6 — Security / Workflow Risks

| Risk | Assessment | Evidence |
|------|-----------|----------|
| Approval bypass | **Not possible** — approval checked at send time; navigating to Send step does not grant approval (test:112–116) | Confirmed |
| Double-send | **Not possible** — idempotency guard disables Send button after first dispatch; second click rejected (test:107–109) | Confirmed |
| Stale revision send | **Not possible** — revision checked at send time; revision mismatch fails send (test:45–51) | Confirmed |
| Wrong recipient | **Not possible** — backend server proof of recipient must match; mismatched `to_email` from preview server rejects send (test:26) | Confirmed |
| Unverified recipient | **Not possible** — Composer "REVIEW MESSAGE" disabled until verified case selected (test:119–122) | Confirmed |
| XSS in inbound message body | **Mitigated** — inbound body rendered as text, no HTML injection (test:24); `<img>` in body appears as literal text | Confirmed |
| postMessage injection | **Mitigated** — origin, source reference, payload shape, and UUID format all validated (test:59–70) | Confirmed |
| Native alert/confirm popup | **Absent** — test asserts `confirm()` throws when triggered by template/blank choices (test:86) | Confirmed |
| CSRF / credentials | Per task spec: all browser fetch calls use Railway endpoints with credentials/CSRF; no service-role exposure | Root-verified (not independently auditable) |
| Auth-blocked visibility | `#mmCx[data-auth-blocked="true"] .mm-hq-grid,#mmStats,#mmCommunications{visibility:hidden}` (source:808) — data hidden when blocked | Confirmed in source |

No exploitable gaps identified within review scope.

---

## 7 — Quick Wins

These are single-file CSS or text changes with no regression risk:

| # | Win | Implementation | File/location |
|---|-----|---------------|---------------|
| QW-1 | Rename disabled rail button title | Add `title="Select a case to enable"` to source:866–867 | `usce_admin.html:866–867` |
| QW-2 | Rename "Delivery attention" → "Check message delivery" | Text node change | `usce_admin.html` Communications header button |
| QW-3 | Change Composer "Back to workspace" → "Save draft & close" | Text node change | `usce_admin.html:1252` |
| QW-4 | Add `title` to Journey × close: `title="Save & close"` or change inner text from `×` to "Save & close" | Text/attribute change | `usce_admin.html:1281` |
| QW-5 | Rename "All active cases" dropdown default → "All cases" | Text node change | HTML `<select>` default option |
| QW-6 | Rename "Most Urgent" sort → "Urgent first" | Text node change | HTML `<select>` default option |
| QW-7 | Add plain-language labels to stat cards: "New requests" / "In progress" / "Offer sent" / "Accepted" (instead of abstract symbols) | CSS/HTML stat label text | `usce_admin.html` stat card labels |

---

## 8 — Larger Improvements (scope-bound)

| # | Improvement | Problem | Correction | Benefit | Complexity | Regression risk | Priority |
|---|------------|---------|-----------|---------|-----------|----------------|----------|
| LI-1 | **Approval checkbox visibility in Review** | Checkbox below fold in compact viewport; Phil clicks "Continue to send →" silently | Move approval checkbox above routing details OR apply sticky positioning at bottom of journey body OR show a prominent alert banner in footer state text that names the checkbox | Phil completes approval in one clear action | Low CSS | Low — does not change approval logic, only visibility | P1 |
| LI-2 | **Pipeline card action buttons** | "In progress · Continue →" text link too small | Render each pipeline card action as `<button class="mm-btn mm-btn-primary">Continue →</button>` or `<button>View offer →</button>` within the card | Phil sees a big obvious button on each card | Low HTML/CSS | Low — same JS click handler | P2 |
| LI-3 | **"Needs Review" framing in Communications** | 37-item count is alarming; Phil may not know what it means | Add a subtitle to the folder: "Messages not yet assigned to a case" or cap/filter to Phil's cases; or rename to "Unassigned inbox" | Phil understands the queue; not overwhelmed | Low | Low — UI only | P2 |
| LI-4 | **Journey close path consolidation** | × header and "Save & close" footer do different things or cause confusion | Unify to a single "Save & close" button in the header; remove or relabel the footer variant; ensure both save RAM text (already confirmed by test) | Phil has one clear exit | Low | Low — confirm save semantics match | P2 |
| LI-5 | **Journey footer state text prominence** | Small span text between Back/Next; missed by Phil when Next is blocked | Surface as a yellow/amber inline callout box when blocking, not just a status span | Phil sees the reason Next doesn't work | Low CSS/JS | Low — cosmetic only | P3 |
| LI-6 | **V2 detail panel button target size** | `height:28px` on quick action buttons in V2 panel (source:606) — below 44px | Set `min-height:36px` minimum on V2 quick action buttons | Touch/accessibility compliance | Low CSS | Low | P3 |
| LI-7 | **"Student details" rail when no case selected** | Clicking "Student details" with no case selected shows the same list as Dashboard, which may confuse Phil | Show a clear "Select a student from the Dashboard first" empty state in the overview panel | Phil understands the navigation sequence | Low HTML | Low | P3 |

---

## 9 — Implementation-Ready Task Packets

### TASK-01: Guarantee approval checkbox visibility in Journey Review step

| Field | Detail |
|-------|--------|
| **Problem** | `#mmJourneyApproval` label is below `#mmJourneyReviewFacts` and `.mm-review-message` in DOM (source:1288). In compact iframe viewport (~276–435px body), it is not in view. Clicking "Continue to send →" fails silently. |
| **Evidence** | Screenshots `06`, `08`: approval checkbox absent from view despite full Review panel filling frame. Journey tests confirm blocking behavior (`:112–116`). |
| **Correction** | Option A (preferred): Move `<label class="mm-journey-approval">` to the TOP of `#mmJourneyReview`, before `#mmJourneyReviewFacts`. Add CSS: `.mm-journey-approval { position:sticky; bottom:0; background:#fff; border-top:1px solid var(--mm-line); padding:10px 0; z-index:2; }` Option B: In the journey footer, when at step 4 and approval unchecked, replace plain state text with a styled alert: `<b>⚠ Scroll down to approve before continuing</b>` |
| **Benefit** | Phil sees and checks the approval box; "Continue to send →" works on first try |
| **Complexity** | Low — CSS/HTML only, no logic change |
| **Regression risk** | None — checkbox id/behavior unchanged; only visual position changes |
| **Priority** | P1 — release-blocking |

### TASK-02: Explain disabled rail buttons

| Field | Detail |
|-------|--------|
| **Problem** | "Build offer" and "Offer history" have `disabled` attribute (source:866–867) but no tooltip, title, or explanatory text. Phil sees greyed-out items and concludes something is broken. |
| **Evidence** | Source:866–867; rail CSS `.sf-rail button:disabled{opacity:.45;cursor:not-allowed}` |
| **Correction** | Add `title="Select a student case first to build an offer"` to Build offer button. Add `title="Select a student case first to view offer history"` to Offer history. Optionally add a small inline `<small>` hint below each when disabled. |
| **Benefit** | Phil understands the navigation sequence without guessing |
| **Complexity** | Trivial — attribute addition only |
| **Regression risk** | None |
| **Priority** | P1 |

### TASK-03: Reframe "Needs Review" folder count

| Field | Detail |
|-------|--------|
| **Problem** | "Needs Review: 37" in Communications left sidebar (screenshot `04`) is alarming and contextless for Phil. This folder likely contains unassigned or unactioned inbox items, not all Phil's direct responsibility. |
| **Evidence** | Screenshot `04`; source: `[data-mail-folder]` elements, test (`usce-v3-communications-ui.test.mjs`:20) confirms 5 folder elements |
| **Correction** | Option A: Rename folder label to "Unassigned inbox" with tooltip "These messages are not yet linked to a student case." Option B: If count > 10, replace raw number with "10+" to avoid alarm. Option C: Add a small explanatory line below the folder list: "Unassigned messages may need a case link before replying." |
| **Benefit** | Phil is not overwhelmed; understands what requires his action |
| **Complexity** | Low — text change + optional tooltip |
| **Regression risk** | None — folder name change only |
| **Priority** | P2 |

### TASK-04: Pipeline action button affordance

| Field | Detail |
|-------|--------|
| **Problem** | Pipeline card action is rendered as small inline text ("In progress · Continue →") not a styled button (screenshot `03`). |
| **Evidence** | Screenshot `03`; Founder directive: "BIG, OBVIOUS BUTTONS. ONE CLEAR NEXT ACTION." |
| **Correction** | In `renderV3Pipeline()` card template (source JS ~line 2252+): change the action link/text to `<button class="mm-btn mm-btn-primary mm-btn-sm" data-continue-case="${id}">Continue →</button>` or similar. Status text can remain as secondary label. |
| **Benefit** | Phil immediately sees where to click on each card |
| **Complexity** | Low — JS template change |
| **Regression risk** | Low — same click handler; test with pipeline navigation |
| **Priority** | P2 |

### TASK-05: Rename "Delivery attention" and "Back to workspace"

| Field | Detail |
|-------|--------|
| **Problem** | (a) "Delivery attention" is technical jargon (screenshot `04`). (b) "Back to workspace" in Composer suggests discarding work (source:1252). |
| **Evidence** | Screenshot `04`; source:1252 |
| **Correction** | (a) Rename button to "Check message delivery". (b) Rename to "Save draft & close" or add a tooltip: "Your draft is saved — click to return." |
| **Benefit** | Phil understands what each button does |
| **Complexity** | Trivial |
| **Regression risk** | None |
| **Priority** | P2–P3 |

---

## 10 — Final Acceptance Checklist

| # | Criterion | Status | Evidence category |
|---|-----------|--------|-------------------|
| 1 | **Communications composer: searchable student picker** | ✅ PASS | Live observation (screenshot `01`, `04`) + test (`:84–92`) |
| 2 | **Composer: auto-fills recipient from verified case** | ✅ PASS | Test confirmed (`:84–92`); live screenshot `01` shows info@missionmedinstitute.com populated |
| 3 | **Composer: template / edit / blank three actions** | ✅ PASS | Source:1287 (3 buttons); test (`:107–112`); screenshots `01`, `07` |
| 4 | **Composer: REVIEW MESSAGE → approval → SEND sequence** | ✅ PASS | Live screenshot `01`; tests confirmed end-to-end path |
| 5 | **Composer: Send hidden until exact approval** | ✅ PASS | Source:1275 (`hidden` attribute); test (`:107–112`) |
| 6 | **Composer: approval invalidated on edit** | ✅ PASS | Test (`:22`) |
| 7 | **Composer: RAM text preserved across close/reopen** | ✅ PASS | Test (`:94–99`) |
| 8 | **Composer: verified sender (clinicals@)** | ✅ PASS | Live screenshot `01` FROM line; test (`:22`) |
| 9 | **Composer: no send to unverified recipient** | ✅ PASS | Test (`:21`); recipient guard tested |
| 10 | **Journey: all 6 steps accessible from sidebar** | ✅ PASS | Test (`usce-journey.test.mjs`:129); source:1282 |
| 11 | **Journey: forward jump guarded by missing fields** | ✅ PASS | Test (`:118–120`) |
| 12 | **Journey: expired offer redirects to Dates with explanation** | ✅ PASS | Test (`:132–135`); aad00cd confirmed |
| 13 | **Journey: approval checkbox required before Send** | ✅ PASS (logic) / ⚠ UNVERIFIED (visibility) | Test (`:112–116`) confirms logic; screenshots `06`/`08` show checkbox NOT visible in viewport = **P1 UX risk** |
| 14 | **Journey: idempotency guard (no double-send)** | ✅ PASS | Test (`:107–109`) |
| 15 | **Journey: revision/proof/sender guards** | ✅ PASS | Test (`:45–51`) |
| 16 | **Journey: RAM text preserved across close/navigate** | ✅ PASS | Test (`:126–130`) |
| 17 | **Pipeline: kanban view functional** | ✅ PASS | Live observation (screenshot `03`) |
| 18 | **Pipeline: action affordance (big obvious button)** | ❌ FAIL | Screenshot `03`: action is inline text, not a button — does not meet Founder standard |
| 19 | **Dashboard: one clear next action per case** | ✅ PASS | Screenshot `02`: "Continue →" button per row |
| 20 | **Dashboard: stat counts correct** | ✅ PASS | Live observation; counts (0/3/9/0) match system state |
| 21 | **Rail nav: all primary destinations accessible** | ✅ PASS | Source:862–867; test (`usce-v3-communications-ui.test.mjs`:20) |
| 22 | **Rail nav: disabled items explained** | ❌ FAIL | Source:866–867: no title/tooltip; Phil has no explanation |
| 23 | **Communications: reply thread functional** | ✅ PASS | Live observation (screenshot `04`); test confirmed |
| 24 | **Communications: inbound XSS sanitised** | ✅ PASS | Test (`:24`) |
| 25 | **"Needs Review: 37" is contextualised** | ❌ FAIL | Screenshot `04`: raw count with no explanation |
| 26 | **Focus management (journey return focus, skip link)** | ✅ PASS | Source:859 skip link; source:3657 return focus |
| 27 | **Keyboard focus visible** | ✅ PASS (source-inferred) | Source:372,407 `outline:3px solid` on `focus-visible`; source:826 journey uses gold outline |
| 28 | **Reduced motion** | ✅ PASS (source-inferred) | Source:382,417 `prefers-reduced-motion` nulls all animations |
| 29 | **Touch targets ≥ 44px for primary interactive elements** | ✅ PASS for rail/composer/journey (source:442, 819) / ❌ FAIL for V2 detail panel (source:606, 28px) | Source-inferred |
| 30 | **QA send: single send, provider accepted, no real student email** | ✅ PASS | Root-verified: Postmark ae43c605 accepted; controlled Info reply received; no real student contacted |
| 31 | **Production data, auth, RLS, CSRF, rollback preserved** | ✅ PASS | Root-verified; not independently auditable |
| 32 | **Source SHA verified** | ✅ PASS | aad00cd132233927ad140cf04a53f64f96da05e1; CDN SHA256 bbfa86...a16 per task spec |

**Summary:**
- **PASS**: 27
- **FAIL (release-blocking)**: 3 — Approval checkbox visibility (P1), disabled rail button explanation (P1), "Needs Review: 37" framing (P2)
- **FAIL (non-blocking)**: 2 — Pipeline action affordance, V2 touch targets
- **UNVERIFIED**: Canon PNG comparison (files missing at `/tmp/usce-iq-correction-references/`); mobile 390px viewport (screenshots 09/10 not in provided directory); Student details panel content; intro sequence rendering; authenticated login sequence

---

**Report confidence:** High on observed behavior (screenshots + source). Moderate on canon image fidelity (canon PNGs unavailable). The P1 approval visibility issue is high-confidence — it is geometrically confirmed by screenshot evidence and test-proven to block forward navigation.

---

---

## Bounded Post-Fix Supplement — MissionMed USCE Phil UX Review
**Appended to original 10-section report | Source: 82a1192 | Captured screens + source-targeted reads only**

---

### 1. Reconciliation — Original 3 Blockers + Contract Items

| Issue | Resolved? | Evidence | Residual Risk |
|-------|-----------|----------|---------------|
| **Journey approval below fold** | **YES** | Screen 12: approval checkbox "I have reviewed and approve this exact offer and message." is fully visible at ~y450 within a 571px viewport. "Continue to send →" is also visible. Phil does not need to scroll. | None on approval visibility. Full message body remains internally scrollable — no mechanism forces Phil to read it before ticking. Acceptable known tradeoff per deploy spec. |
| **BuildOffer / Offer History disabled, no explanation** | **YES** | Screen 13: both nav actions trigger a tooltip "Choose a student from the list first." — two instances visible simultaneously. Screen 14 shows the same guard on Communications. No disabled attribute latch; routes to student list. | Tooltip relies on hover/focus. On touch input or keyboard-only, tooltip may not surface. Not a Phase 1 blocker but worth noting for accessibility pass. |
| **"NeedsReview 37" — no label context** | **YES** | Screen 14: label is now "Unassigned: 37." Right-panel states "Read and reply to messages connected to the same student case." No count has been suppressed. | "Unassigned" is accurate but the 37 count is not clickable into a filtered list in the captured viewport — Phil sees the number but no one-click path to work through it. Low severity; navigation exists elsewhere. |
| **Navy proof preview contrast** | **YES** | Screen 11: `#f6f8fc` on `#102e4c` review panel. Independent computed ratio 13.02:1 per deploy spec; no tool recompute performed by this reviewer (UNVERIFIED by independent instrument). | Cannot independently confirm ratio from JPEG compression alone. Contrast claim stands on deploy-spec computation only. |
| **Pipeline nested-button risk** | **CLEARED** | Screen 13: pipeline cards render single CTA ("Continue →", "View →") with no nested interactive elements visible. Prior reviewer note that nested buttons "would be invalid" is confirmed not present. | None. |

---

### 2. Canon PNG Comparison — APPROVED\_01 / 03 / 05 vs Actual Live

**Canon 01 (Main Dashboard) vs Live screen 10:**

Structural identity confirmed: left nav rail, stat strip, sortable student table, per-row CTA. The canon shows five stat tiles (New 12, In Progress 12, Offered 16, Accepted 9) with delta annotations; live shows four tiles (0, 3, 9, 0) — real QA data, counts differ as expected. Nav label differences are deliberate normalization: canon "USCE Requests / Offer Builder" → live "Pipeline / Build offer." These are terminology changes, not layout regressions.

Remaining differences from canon:

- **Portrait avatars absent.** Canon renders circular student photos in every table row and pipeline card. Live shows no portraits. This is the single most visible structural departure. Without photos, the table is text-only and the pipeline kanban loses visual anchoring. No verified portrait/avatar feature exists in the current build.
- **WordPress admin bar.** ~38px persistent bar across all live screens adds chrome absent from canon. Unavoidable per WP architecture.
- **Filter row.** Canon uses tab-style buttons ("All Requests (30)", Offered, Accepted, Filters). Live uses three dropdown selects ("All active cases", "All active cases", "Most Urgent"). Functionally equivalent; visually diverges from canon.
- **Step count in wizard.** Canon 05 labels "Step 1 of 8"; live journey (screen 12) shows "Step 5 of 6." The implemented wizard condensed 8 steps to 6. The left sidebar steps (Student, Program, Dates, Email, Review, Send) match the live sidebar exactly — the condensation appears intentional.

**Canon 03 (Pipeline) vs Live screen 13:**

Four-column kanban structure matches. Column headers, counts, card layout, and CTA button style are consistent. Canon cards include portrait photos and "+N more" overflow chips; live cards are text-only with no overflow indicator visible. The "Add Request" button present in canon is absent in live. These are feature-presence differences, not broken implementations of present features.

**Canon 05 (Build Offer wizard) vs Live screen 12 (Step 5 Review):**

These compare different steps, but the frame is consistent: mountain-photo left sidebar with step indicators, content area, "Save & exit" top-right, back/next navigation at footer. The approval checkbox in live screen 12 is visible at first paint without scrolling. Canon's Step 1 student card shows portrait photo; live Step 5 shows routing metadata — appropriate for respective steps. No pixel-perfect claim; structural contract is met for the reviewed step.

---

### 3. Top 5 Remaining Recommendations

**R1 — Student portrait absence (Medium priority / Future polish)**
- **Problem:** All student rows and pipeline cards are text-only. Canon spec shows circular avatars as a primary visual identifier.
- **Evidence:** Screens 10, 13, 14; canon 01, 03.
- **Correction:** Implement student avatar upload and display, or use initials-based avatar fallback as interim.
- **Benefit:** Faster visual scanning in pipeline and dashboard; aligns with approved visual spec.
- **Complexity:** Medium (storage, upload flow, fallback render). **Risk:** Low. **Priority:** Post-Phase-1.

**R2 — Unassigned 37: no drill-down path visible (Low-Medium priority / Near-term)**
- **Problem:** Screen 14 shows "Unassigned: 37" in the sidebar but selecting it does not render the 37 messages in the captured viewport. Phil has no one-click path to triage the queue.
- **Evidence:** Screen 14 — inbox shows only 2 items; Unassigned count is a label, not a navigable filter.
- **Correction:** Clicking "Unassigned" should load the 37 messages into the conversation list pane.
- **Benefit:** Prevents Phil from missing unlinked inbound messages.
- **Complexity:** Low (filter route already exists). **Risk:** Low. **Priority:** Near-term.

**R3 — "Save & exit" vs durable state in journey (Low priority / Clarification needed)**
- **Problem:** Screen 12 footer shows "Draft saved. Nothing sent." alongside a "Back" button. The top nav shows "Save & exit." Per deploy spec, "Back to workspace" in the communications composer is RAM-only. The journey's "Save & exit" behavior needs explicit confirmation that it durably persists journey state.
- **Evidence:** Screen 12; deploy spec text distinguishes RAM vs durable save.
- **Correction:** Verify "Save & exit" in the journey calls the same draft-persist endpoint as "Save draft" in the composer. If not, relabel or wire accordingly.
- **Benefit:** Prevents Phil from losing half-built offers on navigation.
- **Complexity:** Low verification task. **Risk:** Medium if unverified. **Priority:** Verify before GA.

**R4 — Tooltip-only guard for Build Offer / Offer History on touch/keyboard (Low priority / Accessibility)**
- **Problem:** Screen 13 shows tooltip guards ("Choose a student from the list first.") working on pointer hover. Touch and keyboard navigation may not trigger these, leaving the action silently inaccessible.
- **Evidence:** Screen 13 (hover tooltips only); deploy spec confirms no disabled attribute.
- **Correction:** Add `aria-describedby` or inline context text visible without hover; or ensure routes handle no-selection gracefully with an inline alert.
- **Complexity:** Low. **Risk:** Low. **Priority:** Accessibility pass, post-Phase-1.

**R5 — Filter dropdown label consistency (Cosmetic / Post-Phase-1)**
- **Problem:** Screen 10 shows two identical "All active cases" dropdowns side by side with no labels differentiating them (one is likely status-type, one specialty/location). Phil must open each to understand them.
- **Evidence:** Screen 10, dashboard filter row.
- **Correction:** Add visible column labels above or inline placeholder text that distinguishes the two filters (e.g., "Status" / "Specialty").
- **Complexity:** Low. **Risk:** None. **Priority:** Polish.

---

### 4. Final Scoped Verdict

**No critical Phase 1 release failure remains in the reviewed surface.** The three original blocking issues are resolved per captured screens and deploy-spec evidence. The approval checkbox is at-viewport on Step 5. BuildOffer/History guards are functional with tooltip explanation. "Unassigned 37" is accurately labeled with context text.

**UNVERIFIED boundaries — explicitly stated:**

- **Phil's personal notification inbox receipt**: The deploy spec describes one controlled QA send verified by root. This reviewer has not independently confirmed Phil's personal email notification arrived or rendered correctly.
- **Fresh Offer HTML email contrast**: The plain-text QA send was verified; a fresh HTML offer email contrast has not been independently captured and verified by this reviewer.
- **Independent authenticated browser replay**: All screen evidence is captured by root and reviewed here as static images. No interactive browser session was performed by this reviewer.
- **Intro/onboarding playback**: Not covered by any submitted screen; status unknown.
- **Approval checkbox on mobile viewport (390px)**: Screen 09 (mobile composer) is a prior presentation delta check per the brief, not final mobile acceptance. Journey approval at 390px has not been reviewed in this supplement.
