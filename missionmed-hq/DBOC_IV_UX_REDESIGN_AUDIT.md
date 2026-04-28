# DBOC IV: FULL UX RED-TEAM AUDIT + FORTNITE-GRADE REDESIGN

**Authority:** UX-AUDIT-001  
**Date:** 2026-04-27  
**Risk Level:** HIGH (modifies existing production UI)  
**System:** Dr Brian On-Call - Residency Interview System  
**Files Analyzed:** `ivoncall.html`, `server.mjs`, `saf_analyzer.mjs`, `question_selector.mjs`, `worker_metrics.mjs`

---

## 1. BRUTAL UX RED-TEAM AUDIT

### 1.1 WHAT'S CONFUSING

| Issue | Location | Severity |
|-------|----------|----------|
| UUID input field as first interaction. Users see "uuid" placeholder with zero context on what to enter or where to find it. | `.topbar` | CRITICAL |
| "Phases 4+5: SAF(e), mode isolation, frontend flow integration" subtitle is developer jargon visible to end users | `.topbar p` | HIGH |
| Mode descriptions are cryptic. "One fast rep, immediate feedback" tells nothing about WHY this mode exists or what skill it builds | `MODE_CONFIG` descriptions | HIGH |
| SAF(e) acronym never explained on the main UI. Warmup modal mentions it once in passing but doesn't teach it | Across all feedback panels | HIGH |
| "Rep" terminology assumes user already knows the system. Zero onboarding language | Everywhere | MEDIUM |
| Streak ring is purely decorative. `transform: rotate` with a single border-top-color doesn't communicate progress accurately | `.ring` | MEDIUM |
| "Categories covered" is a number with no denominator. "3 categories covered" out of what? | `.kpi` | MEDIUM |
| Vault "Then vs Now" comparison loads videos that may not exist yet, showing empty black boxes | `renderThenVsNow` | MEDIUM |
| Timer badge position (top-right of video) conflicts with most browsers' native video controls | `.timer-badge` | LOW |

### 1.2 WHAT'S SLOW

| Issue | Impact |
|-------|--------|
| Dashboard requires manual "Load Dashboard" click after entering UUID. Should auto-load on session init or URL param | Extra friction on every session start |
| Camera enable is a separate manual step every single session. No persistence, no auto-detect | 2-3 extra clicks before EVERY rep |
| Polling loop for transcription (`pollResponse`) hits every 2s for up to 70s total. No progress indicator beyond "Awaiting analysis" | User stares at static text for 10-60 seconds |
| Vault timeline requires selecting a question from dropdown, then waiting for API call. No pre-loading | Extra click + wait on every vault check |
| Upload progress shows percentage but the chunked upload with retry can freeze at a percentage for 9+ seconds on retry | User thinks upload is stuck |

### 1.3 WHAT'S BORING

| Issue | Why it kills engagement |
|-------|------------------------|
| Color palette is navy-on-navy. `--bg: #091321`, `--panel: #11263c`. Zero contrast hierarchy between states | Everything looks the same. Nothing pops |
| No animation anywhere. Cards appear/disappear with `display:none`. Zero transitions, zero motion | Feels like a 2015 admin panel |
| No sound design. Record start, record stop, rep complete, streak achieved: all silent | Zero sensory feedback |
| No celebration on completion. Session ends with a text line: "Session complete: 8/8 questions" | Anti-climactic. Kills dopamine |
| Progress chart is raw SVG rectangles with no animation, no interactivity, no hover states | Dead data visualization |
| Streak display is a static CSS hack, not an animated ring | No feeling of progress |

### 1.4 WHAT FEELS GENERIC

| Issue | Root cause |
|-------|-----------|
| Layout is a standard sidebar + main content grid. Could be any SaaS dashboard | No brand identity in structure |
| Buttons are flat rectangles with no hover effects, no press states, no micro-interactions | Zero personality |
| Typography is system fonts with no size hierarchy creating visual rhythm | Reads like a form, not a training environment |
| Cards all share identical styling. Mode cards, question cards, feedback cards: same border, same radius, same background | No visual differentiation by function |
| Status messages are text-only with colored borders. No icons, no motion, no urgency | Forgettable |

---

## 2. FORTNITE-GRADE DESIGN SYSTEM

### 2.1 COLOR SYSTEM

```css
:root {
  /* Base */
  --bg-deep: #050a12;
  --bg-surface: #0b1526;
  --bg-elevated: #121f35;
  --bg-card: linear-gradient(135deg, #0f1d33 0%, #162847 100%);
  
  /* Neon Accent Stack */
  --neon-cyan: #00f0ff;
  --neon-cyan-glow: 0 0 20px rgba(0, 240, 255, 0.4), 0 0 60px rgba(0, 240, 255, 0.1);
  --neon-magenta: #ff2ecb;
  --neon-magenta-glow: 0 0 20px rgba(255, 46, 203, 0.4);
  --neon-gold: #ffd700;
  --neon-gold-glow: 0 0 20px rgba(255, 215, 0, 0.4);
  --neon-green: #00ff88;
  --neon-green-glow: 0 0 20px rgba(0, 255, 136, 0.4);
  
  /* Functional */
  --success: #00ff88;
  --warning: #ffaa00;
  --danger: #ff3355;
  --info: #00f0ff;
  
  /* Text */
  --text-primary: #f0f4ff;
  --text-secondary: #8ba3c7;
  --text-muted: #5a7090;
  
  /* Borders */
  --border-subtle: rgba(100, 160, 255, 0.12);
  --border-active: rgba(0, 240, 255, 0.5);
  --border-glow: rgba(0, 240, 255, 0.3);
  
  /* Gradients */
  --gradient-panel: linear-gradient(180deg, rgba(15, 30, 55, 0.95) 0%, rgba(8, 18, 35, 0.98) 100%);
  --gradient-cta: linear-gradient(135deg, #00c8ff 0%, #0080ff 100%);
  --gradient-danger: linear-gradient(135deg, #ff3355 0%, #cc1144 100%);
  --gradient-gold: linear-gradient(135deg, #ffd700 0%, #ff9500 100%);
}
```

### 2.2 MODE-SPECIFIC COLOR THEMES

Each mode gets a distinct neon identity so users always know where they are:

| Mode | Primary Neon | Accent | Glow |
|------|-------------|--------|------|
| Quick Rep | `--neon-cyan` | Electric blue | Cyan pulse |
| Guided Practice | `--neon-green` | Emerald | Green breathe |
| Delivery Training | `--neon-magenta` | Hot pink | Magenta wave |
| Simulation | `--neon-gold` | Championship gold | Gold shimmer |

### 2.3 TYPOGRAPHY

```css
/* Display (mode titles, session headers) */
font-family: 'Inter', 'SF Pro Display', system-ui;
font-weight: 900;
font-size: clamp(1.4rem, 3vw, 2.2rem);
letter-spacing: -0.02em;
text-transform: uppercase;

/* Body (questions, descriptions) */
font-family: 'Inter', system-ui;
font-weight: 400;
font-size: 1rem;
line-height: 1.6;

/* Mono (timers, metrics, status) */
font-family: 'JetBrains Mono', 'SF Mono', monospace;
font-weight: 600;
font-size: 0.88rem;
letter-spacing: 0.04em;

/* Labels (badges, categories) */
font-family: 'Inter', system-ui;
font-weight: 700;
font-size: 0.72rem;
text-transform: uppercase;
letter-spacing: 0.08em;
```

### 2.4 LAYOUT HIERARCHY

```
LEVEL 0: Immersive Background (particle field / gradient mesh)
LEVEL 1: Navigation Bar (glassmorphism, fixed top)
LEVEL 2: Primary Content Area (full-bleed, no sidebar in session)
LEVEL 3: Floating Panels (elevated cards with glow borders)
LEVEL 4: Modals + Overlays (blur backdrop, centered focus)
LEVEL 5: Toast Notifications (top-right stack, auto-dismiss)
```

Kill the sidebar layout during active sessions. The session view should be FULL-SCREEN IMMERSIVE. The sidebar/dashboard is the lobby. The session is the arena.

### 2.5 DEPTH + GLOW + GRADIENTS

```css
/* Card Depth */
.card-elevated {
  background: var(--gradient-panel);
  border: 1px solid var(--border-subtle);
  border-radius: 16px;
  box-shadow: 
    0 4px 24px rgba(0, 0, 0, 0.4),
    0 1px 0 rgba(255, 255, 255, 0.04) inset;
  backdrop-filter: blur(12px);
}

/* Active State Glow */
.card-active {
  border-color: var(--border-active);
  box-shadow: 
    var(--neon-cyan-glow),
    0 4px 24px rgba(0, 0, 0, 0.4);
}

/* Recording State */
.recording-pulse {
  animation: recording-glow 1.5s ease-in-out infinite;
}

@keyframes recording-glow {
  0%, 100% { box-shadow: 0 0 20px rgba(255, 51, 85, 0.3); }
  50% { box-shadow: 0 0 40px rgba(255, 51, 85, 0.6), 0 0 80px rgba(255, 51, 85, 0.2); }
}

/* Glass Panel */
.glass {
  background: rgba(15, 25, 45, 0.7);
  backdrop-filter: blur(20px) saturate(1.5);
  border: 1px solid rgba(255, 255, 255, 0.06);
}
```

### 2.6 ANIMATION / MOTION SYSTEM

| Trigger | Animation | Duration | Easing |
|---------|-----------|----------|--------|
| Card enter | Scale 0.95 > 1.0 + fade in | 300ms | `cubic-bezier(0.16, 1, 0.3, 1)` |
| Card exit | Scale 1.0 > 0.95 + fade out | 200ms | `ease-out` |
| Button hover | Scale 1.02 + border glow intensify | 150ms | `ease` |
| Button press | Scale 0.97 + brightness drop | 80ms | `ease` |
| Mode select | Border neon sweep (left to right) | 400ms | `linear` |
| Record start | Red pulse begins, timer scale-in | 300ms | `spring` |
| Rep complete | Confetti burst + score counter roll-up | 800ms | `spring(mass:1, stiffness:80)` |
| Streak increment | Ring arc animate clockwise + number tick | 600ms | `ease-out` |
| Page transition | Slide + crossfade between lobby/session | 400ms | `cubic-bezier(0.4, 0, 0.2, 1)` |
| Score reveal | Stagger children (50ms each) + scale in | 300ms per item | `spring` |
| Upload progress | Gradient sweep through bar | continuous | `linear` |

---

## 3. USER PSYCHOLOGY

### 3.1 DOPAMINE TRIGGERS

| Trigger | Implementation |
|---------|---------------|
| Immediate score reveal | SAF(e) scores animate in with number roll-up the INSTANT analysis completes. No waiting. |
| Sound cues | Short synth tones: success chord on rep complete, click on record, alert on timer warning |
| Visual burst | Particle effect on session complete. Intensity scales with SAF score |
| Streak visuals | Animated fire icon appears at 3+ day streak. Intensifies at 7, 14, 30 |
| XP counter | Visible "Total XP" that increments with every rep. Mode multipliers (Simulation = 3x) |

### 3.2 PROGRESSION SYSTEM

| Level | Unlock | Reps Required |
|-------|--------|---------------|
| RECRUIT | Basic modes, 1 category | 0 |
| INTERN | All categories, Quick Rep | 5 |
| RESIDENT | Guided Practice, Vault access | 15 |
| FELLOW | Delivery Training, Gold Answers | 30 |
| ATTENDING | Simulation mode, Full analytics | 50 |
| CHIEF | Leaderboard, peer review queue | 100 |

### 3.3 MASTERY SIGNALS

- Per-question mastery bars (0-3 stars based on best SAF score)
- Category completion percentage rings
- "Personal Best" badges that persist in vault timeline
- Improvement delta shown as `+12%` badges on re-attempted questions

### 3.4 CONFIDENCE BUILDERS

- Pre-question "You've practiced this category 4 times. Your opening scores improved 40%."
- Post-question "Your SAF(e) structure is stronger than 73% of attempts at this stage"
- Warmup mode shows a "predicted readiness" indicator before real sessions
- Gold answer reveals are framed as "See how Dr. Brian approaches this" not "Here's the right answer"

---

## 4. FLOW REDESIGN

### 4.1 ONBOARDING (Currently broken)

**Current:** UUID text field > "Load Dashboard" button > warmup modal with empty video > skip button

**Redesign:**

```
STEP 1: Welcome Screen (full-page)
  - Dr. Brian video intro (15s max)
  - "I'm going to teach you the SAF(e) system"
  - Single CTA: "Let's Go"

STEP 2: Camera Setup (full-page)
  - Auto-prompt permissions
  - Live preview with framing guide
  - "You look great. Ready to practice?"
  - Auto-advance on successful camera connect

STEP 3: SAF(e) Training Card (full-page)
  - 4 animated panels, one per letter
  - Each panel: 1 sentence + visual icon
  - "Got it" button per panel (gamified progress)

STEP 4: First Rep (guided, auto-starts Quick Rep)
  - Pre-selected easy question
  - Extra coaching overlays
  - Celebration on completion regardless of score
  - "You just did your first rep. Come back tomorrow."
```

### 4.2 MODE SELECTION (Currently a modal grid)

**Redesign:** Full-page "Arena Select" with:
- Large mode cards (min 280px wide)
- Each card has its neon color theme applied
- Animated icon per mode (not just text)
- "Recommended" badge on the mode the algorithm suggests based on user history
- Locked modes show progress bar to unlock (progression system)
- Hover state shows expanded description + session preview

### 4.3 ANSWER FLOW (Currently: enable camera > record > stop > wait)

**Redesign:**

```
PHASE 1: PREP (5 seconds)
  - Question appears with 3-2-1 countdown
  - SAF(e) reminder flashes briefly (if Guided mode)
  - Camera auto-enables (persisted permission)
  - Breathing indicator: "Take a breath"

PHASE 2: RECORD (auto-starts after countdown)
  - Full-screen video with minimal chrome
  - Timer is large, centered-bottom (not tiny top-right)
  - Volume indicator pulses in corner (all modes, not just Delivery)
  - 10-second warning: timer turns orange, subtle pulse

PHASE 3: SUBMIT (auto on stop or timer expiry)
  - Immediate transition to "Processing" animation
  - Animated SAF(e) loading skeleton (not static text)
  - Each score reveals with stagger animation
  - Overall assessment word animates in last (STRONG / DEVELOPING / NEEDS WORK)

PHASE 4: REVIEW (optional, skippable in simulation)
  - Side-by-side: your video + SAF breakdown
  - "Try Again" or "Next Rep" buttons prominent
  - Vault auto-saves (no manual action needed)
```

### 4.4 FEEDBACK LOOP (Currently: text summary + static grid)

**Redesign:**
- SAF(e) scores displayed as animated arc meters (not text boxes)
- Each SAF letter gets a color: S=cyan, A=green, F=magenta, E=gold
- Delivery metrics shown as a mini-dashboard: WPM gauge, filler counter, pitch range bar
- "Key Moment" highlight: timestamp in your recording where SAF scoring peaked/dipped
- One-line coaching tip generated from score pattern (not generic)

### 4.5 VAULT USAGE (Currently: dropdown > timeline > comparison)

**Redesign:**
- Grid of question cards with mastery indicators (stars/progress rings)
- Click a question card to expand inline (no page change)
- Timeline is a horizontal scroll with video thumbnails (not text list)
- "Then vs Now" auto-displays when 2+ attempts exist
- Gold answer is locked behind a visual lock icon that shakes when tapped pre-unlock
- Improvement delta prominently displayed as a large percentage badge

---

## 5. MODE UX REDESIGN

### 5.1 QUICK REP

**Identity:** Lightning bolt icon. Cyan neon. Speed-focused.

**Feel:** Sprint timer. In-and-out. Like hitting a quick match in a game.

**UX Changes:**
- One-tap start (skip mode select if already chosen)
- Question appears instantly with auto-recording countdown
- Feedback is condensed: one SAF sentence + one delivery stat
- "Again?" button appears immediately after feedback (loop tight)
- Session background has subtle speed-line particle effect

### 5.2 GUIDED PRACTICE

**Identity:** Compass icon. Green neon. Learning-focused.

**Feel:** Training academy. Coach is present. Safe to fail.

**UX Changes:**
- Category selector is a visual wheel (not button grid)
- Pre-answer guidance appears as floating coach tooltip near camera
- SAF(e) hints appear as ghost text overlay during recording (optional toggle)
- Feedback is detailed: full SAF breakdown + "Here's what to try next time"
- Teaching video suggestion appears BETWEEN reps (not in vault)
- Session feels like a structured lesson with numbered steps visible

### 5.3 DELIVERY TRAINING

**Identity:** Waveform icon. Magenta neon. Performance-focused.

**Feel:** Recording studio. Audio visualizers everywhere. Technical precision.

**UX Changes:**
- Pitch graph is LARGE (takes 40% of screen during recording)
- Volume meter is a proper VU meter with green/yellow/red zones
- Real-time coaching text: "Speak louder" / "Slow down" / "Good pace"
- Post-rep shows pitch contour replay synced with video playback
- Target zones drawn on pitch graph (ideal Hz range shaded green)
- Filler word counter shown LIVE during recording (number ticks up)
- WPM shown live as a speedometer gauge

### 5.4 SIMULATION

**Identity:** Trophy icon. Gold neon. Exam-focused.

**Feel:** Championship match. Pressure. No safety net. Timed.

**UX Changes:**
- Entry screen shows "8 QUESTIONS. NO COACHING. ARE YOU READY?" with dramatic treatment
- No UI chrome during recording. Black background. Timer only.
- Questions auto-advance with 3-second gap (no manual next)
- No feedback until ALL 8 complete (builds tension)
- End screen is a full performance report card with radar chart
- Compare to previous simulation scores
- "Rank" shown: percentile vs. your own history
- Unlock condition clearly shown: must be FELLOW level or above

---

## 6. FEEDBACK SYSTEM REDESIGN

### 6.1 SAF(e) VISUALIZATION

**Current:** 2x2 grid of text boxes with "Present/Needs Work/Missing"

**Redesign:**
```
Layout: Horizontal bar with 4 segmented arcs (like a split donut chart)

S ████████░░ 8/10  "Clean declarative opening"
A ██████░░░░ 6/10  "2 reasons given, could add specificity"  
F █████████░ 9/10  "Strong personal example with detail"
e ████░░░░░░ 4/10  "Ending trailed off - try a callback"

Overall: DEVELOPING → STRONG (improving!)
```

Each bar animates from 0 to score on reveal. Color follows mode theme.

### 6.2 DELIVERY METRICS UI

Replace text-only display with:
- **WPM Gauge:** Circular speedometer. Green zone 120-160. Yellow edges.
- **Filler Counter:** Large number with word list below (um x3, like x2)
- **Pitch Range:** Horizontal bar showing your min-max Hz with ideal zone marked
- **Volume Consistency:** Waveform mini-graph showing amplitude over time
- **Pause Analysis:** Timeline with pause markers (too long = red dots)

### 6.3 PROGRESS COMPARISON

Replace "Then vs Now" static cards with:
- Animated side-by-side score bars that grow simultaneously
- Delta badges: `+2.3` in green, `-0.5` in red
- Sparkline trend showing last 5 attempts at this question
- "Improvement velocity" metric: how fast scores are rising

### 6.4 VAULT UX

Replace dropdown-based vault with:
- Card grid organized by category (tabs across top)
- Each card shows: question text (truncated), attempt count, best score, last attempt date
- Mastery indicator: 0-3 stars based on best SAF overall
- Click expands to full timeline with video thumbnails
- "Challenge Again" button on each card
- Sort options: weakest first, most practiced, newest

---

## 7. RED TEAM: WHY USERS QUIT

### 7.1 QUIT TRIGGERS

| Trigger | Root Cause | Fix |
|---------|-----------|-----|
| "I don't know what to do first" | No onboarding flow, UUID-first design | Guided onboarding, auto-session-start |
| "Nothing happened when I finished" | No celebration, text-only completion | Particle effects, sound, XP increment |
| "I can't tell if I'm getting better" | Progress buried in vault, no trending | Dashboard shows improvement deltas prominently |
| "Recording myself is awkward" | No warmup, no framing help, cold start | Breathing exercise, framing overlay, countdown |
| "The feedback doesn't help me" | SAF text is abstract ("Needs Work") | Specific coaching tips, timestamped moments |
| "It's the same every time" | Visual monotony, no variety in flow | Mode-specific themes, varied question pacing |
| "I forgot to come back" | No notification, no streak consequence | Email/push reminders, streak-break warning |
| "I can't see my improvement over time" | Chart is last 7 days only, no long-term | Add weekly/monthly views, milestone markers |

### 7.2 ENGAGEMENT KILLERS

1. **Camera permission re-prompt every session.** Solution: persist stream, show "camera ready" indicator in nav.
2. **Polling-based feedback wait.** Solution: WebSocket or SSE for real-time status updates during processing.
3. **No reason to open Simulation mode.** Solution: weekly challenge, leaderboard, certification milestone.
4. **Vault requires too many clicks.** Solution: auto-show improvement after each rep for that question.
5. **No social proof.** Solution: aggregate stats ("412 students have practiced this week"), cohort badges.

### 7.3 IMMERSION BREAKERS

1. Developer terminology visible ("uuid", "Phases 4+5", "mode isolation")
2. Empty state shows "No data loaded" instead of encouraging first action
3. Broken video elements (empty `<source src="">` in warmup)
4. No loading state differentiation (same skeleton for everything)
5. Status bar language is technical ("Dashboard load failed: HTTP 401")

---

## 8. IMPLEMENTATION PLAN

### 8.1 COMPONENT CHANGES

| Component | Current File | Change |
|-----------|-------------|--------|
| App Shell | `ivoncall.html` | Split into: `lobby.html` (dashboard) + `arena.html` (session) OR use client-side routing |
| CSS Variables | `:root` block | Replace entire palette with Fortnite design system colors |
| Mode Cards | `.mode-card` + JS render | New component: `ModeSelector` with neon themes, lock states, recommendation badge |
| Video Recorder | `.video-wrap` + controls | New component: `RecordingArena` - full-screen, countdown, live metrics |
| SAF Display | `.saf-grid` | New component: `SafScorecard` - animated arcs, color-coded, coaching text |
| Timer | `.timer-badge` | New component: `SessionTimer` - large, centered, color-shift on warning |
| Progress Chart | `#progress-chart` SVG | Replace with animated bar chart (CSS transitions or lightweight lib) |
| Streak Ring | `.ring` CSS hack | New component: `StreakRing` - SVG arc animation, fire icon at thresholds |
| Vault | `.vault-grid` + dropdown | New component: `VaultGrid` - card layout, thumbnails, mastery indicators |
| Status Messages | `.status-line` | New component: `Toast` - animated, auto-dismiss, icon + text |
| Onboarding | `#warmup-modal` | New flow: `Onboarding` - multi-step, full-page, progressive |
| Delivery Panel | `.delivery-panel` | Expand: full recording-studio layout with VU meter, live WPM, filler counter |

### 8.2 LAYOUT CHANGES

**Dashboard (Lobby):**
```
[NAV BAR - glass, fixed]
[HERO: streak + XP + level badge - full width]
[MODE SELECTOR - 4 large cards, horizontal scroll on mobile]
[RECENT ACTIVITY - last 3 reps as mini-cards]
[VAULT PREVIEW - top 3 weakest questions as "challenge" cards]
[PROGRESS - 7-day chart, larger, with trend line]
```

**Session (Arena):**
```
[MINIMAL NAV - mode badge + timer + exit button only]
[QUESTION - large text, centered, SAF reminder below]
[VIDEO - full-width, 16:9, with overlays]
[CONTROLS - centered row: record/stop only]
[DELIVERY PANEL - below video, expandable in Delivery mode]
```

**Feedback (Post-Rep):**
```
[SCORE REVEAL - animated, staggered, centered]
[VIDEO REPLAY + SAF BREAKDOWN - side by side]
[COACHING TIP - single actionable sentence]
[ACTIONS - Next Rep / Try Again / Dashboard]
```

### 8.3 ANIMATION IMPLEMENTATION

Add to CSS:
```css
/* Page transitions */
.view-enter { animation: slideUp 400ms cubic-bezier(0.4, 0, 0.2, 1); }
.view-exit { animation: fadeOut 200ms ease-out; }

@keyframes slideUp {
  from { transform: translateY(20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

/* Score reveal stagger */
.score-item { animation: scoreIn 300ms cubic-bezier(0.16, 1, 0.3, 1) both; }
.score-item:nth-child(1) { animation-delay: 0ms; }
.score-item:nth-child(2) { animation-delay: 100ms; }
.score-item:nth-child(3) { animation-delay: 200ms; }
.score-item:nth-child(4) { animation-delay: 300ms; }

@keyframes scoreIn {
  from { transform: scale(0.8) translateY(10px); opacity: 0; }
  to { transform: scale(1) translateY(0); opacity: 1; }
}

/* Button interactions */
.btn-game {
  transition: transform 150ms ease, box-shadow 150ms ease;
}
.btn-game:hover {
  transform: scale(1.02);
  box-shadow: var(--neon-cyan-glow);
}
.btn-game:active {
  transform: scale(0.97);
}

/* Recording state */
.is-recording .video-wrap {
  border-color: var(--danger);
  animation: recording-glow 1.5s ease-in-out infinite;
}
```

### 8.4 SOUND DESIGN (Web Audio API)

| Event | Sound |
|-------|-------|
| Record start | Low synth tone, rising pitch (200ms) |
| Record stop | Reverse of start (falling, 200ms) |
| Rep complete | Major chord stab (C-E-G, 300ms) |
| Streak milestone | Ascending arpeggio (500ms) |
| Timer 10s warning | Soft click every second |
| Timer expired | Double beep (150ms) |
| Score reveal | Slot-machine tick per number digit |
| Achievement unlock | Fanfare snippet (800ms) |

Implementation: Generate using `OscillatorNode` + `GainNode` in Web Audio API. No external audio files needed. 2KB of JS total.

---

## 9. PRIORITY STACK

### TIER 1: HIGHEST ROI (Ship this week)

1. **Replace color palette** with neon design system. Single CSS variable swap. Immediate visual transformation.
2. **Add CSS transitions** to all card show/hide (replace `display:none` with opacity+transform).
3. **Auto-load dashboard** from URL param (already partially implemented, just remove the button requirement).
4. **Persist camera permission** across session (check on page load, auto-enable if previously granted).
5. **Replace status-line with toast system** (top-right, auto-dismiss, icon-prefixed).
6. **Remove developer jargon** from all visible UI text (UUID field > "Enter your student ID", subtitle > "Practice interview questions with real-time coaching").
7. **Add countdown before recording** (3-2-1 with visual animation).

### TIER 2: MEDIUM IMPROVEMENTS (Ship this sprint)

8. **SAF score animation** - replace static grid with animated arc meters.
9. **Mode-specific color themes** applied to session shell when mode is active.
10. **Full-screen session view** (hide sidebar during active recording).
11. **Sound design** implementation (Web Audio oscillator-based, no files).
12. **Vault card grid** replacing dropdown selector.
13. **Improvement deltas** shown prominently after each rep.
14. **Live delivery metrics in all modes** (subtle in non-Delivery, prominent in Delivery).
15. **Completion celebration** (CSS particle effect + sound on session complete).

### TIER 3: POLISH LAYER (Ship next sprint)

16. **Progression system** (levels, XP, unlocks) - requires backend additions.
17. **Full onboarding flow** (multi-step, video intro, SAF training).
18. **WebSocket/SSE for processing status** (replace polling).
19. **Simulation mode dramatic treatment** (countdown, no-chrome recording, end report card).
20. **Weekly challenge system** (curated question sets, time-limited).
21. **Background particle field** (canvas-based, performance-optimized, 60fps).
22. **Vault video thumbnails** (requires server-side screenshot generation).
23. **Push notification reminders** for streak maintenance.

---

## EXECUTION REPORT

**WHAT WAS DONE:**
- Full file discovery and analysis of DBOC IV system (HTML, server, SAF analyzer, question selector, worker metrics, database schema)
- Comprehensive UX red-team audit identifying 30+ specific issues across confusion, speed, boredom, and genericism
- Complete Fortnite-grade design system specification (colors, typography, layout, depth, animation)
- User psychology framework (dopamine, progression, mastery, confidence)
- Full flow redesign for all 5 user journeys (onboarding, mode select, answer, feedback, vault)
- Mode-specific UX redesign for all 4 modes with distinct identities
- Feedback system overhaul specification
- Red team analysis identifying 8 quit triggers, 5 engagement killers, 5 immersion breakers
- Component-level implementation plan with 12 specific component changes
- 23-item priority stack organized by ROI

**RESULT:**
- Complete redesign specification document ready for implementation

**ISSUES:**
- No issues encountered during analysis

**FIXES:**
- N/A

**VERIFICATION:**
- Cross-referenced all recommendations against actual source code to ensure feasibility
- Verified all referenced components exist in current codebase
- Confirmed mode configs, API endpoints, and rendering logic match audit findings

**STATUS:** COMPLETE
