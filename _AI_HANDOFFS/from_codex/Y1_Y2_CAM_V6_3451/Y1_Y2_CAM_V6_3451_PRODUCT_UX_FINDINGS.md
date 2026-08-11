# Y1-Y2-CAM-V6-3451 Product and UX Findings

## Verdict

The 3451 lane is a high-fidelity Founder prototype for the complete IV Prep On-Call journey. It is additive at `/aaa/index.html`; it does not replace or restyle the accepted continuous-conversation V6 at `/`.

The product direction is coherent and materially less cognitively overwhelming than the inherited room-first proof. It leads with the learner's next action, keeps technical diagnostics out of the student journey, and progressively discloses setup, practice, results, history, and debrief work.

## Authority and custody

- Worktree: `/Users/brianb/MissionMed_worktrees/Y1-Y2-CAM-V6-3451`
- Branch: `codex/y1-y2-cam-v6-3451-aaa-missionmed-ux-reconstruction`
- Accepted baseline: `75c7d1a2cf96568f6520e7ca9af281c11e402104`
- Rollback tag: `y1-y2-cam-v6-3451-inherited-3410`
- Product authority: MissionMed OS DR-044
- Execution amendment: MissionMed OS DR-045
- Deployment class: loopback-only Founder prototype; no production deployment

## Product findings

### 1. The home screen should answer one question

The prior proof exposed too many controls at once. The accepted direction makes the primary decision obvious: start today's focused assignment, start an Instant Interview, or build a custom interview. Model, voice, rail, telemetry, and provider configuration do not compete with that decision.

### 2. Continuous conversation is a capability, not a navigation concept

The learner should not have to understand Realtime, semantic VAD, Responses, Speech, or provider topology. The prototype presents a normal interview room and preserves the real 3410 rail separately until 3440 deliberately binds it to the new shell.

### 3. Explicit entry into the room is essential

The room now has an explicit `Start interview` control. Camera readiness and arrival in the room are not treated as permission to begin speaking automatically. This resolves the Founder confusion observed in the inherited experience.

### 4. Preparation should be progressive and application-aware

Instant Interview asks only specialty, duration, and pressure. Custom Interview exposes search, filters, drag/drop, keyboard reorder, profile-based draft creation, Surprise Me, and a final review/start action. Your File and Program Intel show where Matrix, File Vault, Timeline, StoryForge, and RISE can later hydrate the experience without pretending that the prototype has accessed those systems.

### 5. Results must point to evidence, not scores

Results emphasize specific observed moments, exact replay timestamps, next-rep actions, and truthful analysis boundaries. The prototype does not claim emotion, personality, deception, confidence, readiness, Match probability, or program fit.

### 6. History should be searchable by how learners remember

The Vault supports interview-level retrieval, question history, and transcript-word hits. A Founder browser pass confirmed retrieval using the word `home`. Synthetic transcript and replay states are disclosed as fixtures.

### 7. Debrief should elicit, not infer

The Real Interview Debrief asks one question at a time, keeps student recollection distinct from verified program intelligence, and exposes a local Founder/Admin playbook. It never fills in a missing answer. Voice transport remains owned by the 3410 rail and joins only during 3440 integration.

## Page-by-page behavior

| Surface | Primary behavior | Truth boundary |
|---|---|---|
| Intro | Explains value and enters the product | Presentation only |
| Home | Starts today's assignment or routes to a chosen workflow | Synthetic assignment |
| Instant Interview | Specialty, duration, pressure, assigned interviewer | Assignment is a fixture |
| Build an Interview | Search, filters, drag/drop, keyboard reorder, profile draft, Surprise Me | Browser-memory state only |
| Interview Room | Explicit start, mute, typed input, interrupt, end, live-rail link | Simulated room; `/` owns real AI/media |
| Your Results | Specific strengths, next work, moment timeline | Synthetic result evidence |
| Interview Vault | Interview/question/transcript-word retrieval and workspaces | Synthetic sessions; no real media |
| Mentor Review | Select one attempt and request targeted review | No request is delivered |
| Your File | Application-aware preparation priorities | Synthetic profile; no cross-app reads |
| Program Intel | Program-specific preparation | Synthetic content; RISE remains canonical |
| Real Interview Debrief | One-topic-at-a-time reconstruction | Local typed reducer only |
| Debrief Playbook | Add, reorder, enable, and version topics | Local memory only; no production prompt write |

## Real versus simulated

### Real in 3451

- Responsive semantic HTML/CSS/JavaScript application shell.
- Working navigation, forms, filters, search, drag/drop, keyboard reorder, dialogs, countdown, explicit room start, typed states, transcript-word search, debrief reducer, and playbook editing.
- Direct link to the preserved accepted V6 at `/`.
- The inherited 3410 Realtime implementation and its server-owned provider boundary remain intact.
- Loopback-only server and both local routes return HTTP 200.

### Simulated or not yet wired

- Interview intelligence, microphone, audio output, model follow-ups, and avatar inside `/aaa/index.html`.
- Results, media replay, transcript, mentor delivery, persistence, and analytics shown inside the AAA lane.
- Matrix, File Vault, Timeline, StoryForge, RISE, and identity hydration.
- LiveAvatar Dexter media and W. Clint provider voice acceptance.
- Any online, student, private-preview, or production deployment.

## Responsive and accessibility findings

- CSS contracts cover 1180px, 920px, 680px, and 380px breakpoints, with direct 320px, tall-phone, and short-landscape checks.
- Navigation changes from the persistent desktop rail to native bottom navigation plus an inert, focus-managed secondary drawer.
- The mobile room is a zero-document-scroll `100dvh` surface. Start, Mute, Type, Interrupt, End, and recovery remain in the visual viewport; global navigation and the development-only rail card are hidden there.
- Custom Interview exposes Questions and Your Interview as one pane at a time; filters, Vault filters, Debrief review, and typed recovery use viewport-anchored sheets rather than desktop sidebars.
- Results lead with plain-language guidance. Vault is search-first. Debrief keeps its composer immediately above mobile navigation.
- Closeout repaired mismatched dynamic classes for question cards, plan actions, workspaces, source options, transcript replay, student debrief messages, and playbook rows.
- Keyboard bypass, route focus target, semantic buttons/forms, native labelled countdown dialog, Escape/focus restoration, polite live regions, visible focus surrogates, 44px touch targets, 16px phone inputs, safe areas, and reduced-motion handling are implemented and regression-tested.
- Direct browser measurements passed at 390 × 844, 375 × 812, 320 × 568, 430 × 932, 844 × 390 landscape, and 1440 × 1000 desktop. Major 390px and 320px content screens had no horizontal overflow.

## Remaining defects and decisions

Founder accepted the reconstructed phone journey on 2026-08-11, with visual refinement deferred to full laptop polish.

1. 3440 must integrate the accepted 3410, 3420R, and 3430 lanes through explicit adapters; it must not copy their UI or reopen their provider decisions.
2. The prototype's fixtures must be removed or clearly marked when real stores are connected.
3. No replay control may survive integration unless real media exists.
4. Human-realism prompting for the Realtime interviewer remains an AI behavior task, separate from this UX prototype.
