# V1 Study Schedule — UI/UX Expert Board Rubric

## Scoring law

Ten independent reviewer seats score 0–10. “Independent” means the evaluator did
not author the implementation, this reconciliation, or the evidence package,
and discloses conflicts before assignment. At least one seat is a real intended
learner and one is an assistive-technology specialist. A dimension passes only
at >=9.0 with
rendered evidence and representative real interactions. The product gate passes
only when:

- every dimension is >=9.0;
- median overall score is >=9.0;
- no unresolved P0/P1 and no accessibility blocker remains;
- production implementation, not a standalone prototype, is evaluated;
- scores include desktop, tablet, mobile, keyboard, reduced-motion, loading,
  empty, error, offline/retry, dense, and long-horizon states.

DOM structure and self-authored assertions are insufficient.

Each seat follows a frozen task script and retains its raw score, observations,
recording, and conflict disclosure. A score disagreement >=1.5 points receives
an additional independent adjudicator. Implementation authors may answer factual
questions but cannot score or close the gate. Reviewers receive no V1-8000
prototype baseline scores before submitting their first score, preventing
anchoring.

## Board and criteria

| Reviewer lens | 9/10 acceptance criterion | Prototype baseline | Legacy implementation |
|---|---|---:|---:|
| Medical student workflow/study science | Mission-to-execution loop, realistic fixed load, partials, review, spaced work, no magical replanning | 8.2 | Not scoreable |
| Exhausted/overloaded learner | Now/next/later clarity, safe defaults, reserve/recovery, no shame, low decision burden | 8.0 | Not scoreable |
| High-performing power user | Fast keyboard/pointer operation, recurrence, precision, dense views, predictable shortcuts | 8.1 | Not scoreable |
| Mentor operations/privacy | Reasons, assignment scope, ghosts, accept/reject/negotiation, audit, no direct edits | 7.5 | Not scoreable |
| Cognitive load/HCI | Stable hierarchy, progressive disclosure, reversibility, feedback, silence rules | 8.2 | Not scoreable |
| Visual design/CAM fidelity | D9-300 CAM Timeline language, hierarchy, craft, state clarity across all views | 8.4 | Not scoreable |
| Accessibility/assistive tech | WCAG 2.2 AA, SR model, focus, drag alternatives, zoom, contrast, reduced motion | 6.8 | Not scoreable |
| Mobile/touch | No obstruction, all six destinations/actions, >=44px targets, one-hand execution | 6.5 | Not scoreable |
| Frontend performance/motion | Budgets met on realistic devices/data; motion purposeful and optional | 7.5 | Not scoreable |
| Trust/motivation/durability | Learner control, honest capacity, humane streaks, no hidden writes or manipulative pressure | 8.3 | Not scoreable |
| **Unweighted diagnostic mean** | Not a release gate by itself | **7.75** | **Not scored** |

The prototype values are V1-8000 supervisor baselines, not signed expert-board
results. The legacy implementation receives no interaction score because an
authenticated production route was not available; static source inspection only
sets a below-4/10 ceiling and gives no release credit.

## Rendered findings behind the baseline

D9-300 strongly establishes the desired Mission/Week canvas, Today Mission,
Focus, Reserve, mentor, closeout, 15-minute timeline, and CAM-family identity.
D9-360 demonstrates six views and richer settings/refinement behavior.

Manual D9-360 checks found:

- a focus-within streak popover clipped/overlapping the header and content;
- fixed bottom navigation overlaying content at narrow widths;
- only a subset of destinations visibly reachable in the mobile capture;
- prototype-local state and simulated adapters rather than trustworthy
  production behavior.

The legacy source exposes a coarse daily interface, limited semantics, a small
resize affordance, no complete edit/delete flow, no intended execution model, and
no mentor/recovery product.

## Mandatory sub-9 acceptance criteria for V1-8020

1. Validate the complete learner workflow with at least overloaded, first-time,
   and power-user scenarios.
2. Demonstrate learner-controlled recovery after a missed and partial block.
3. Demonstrate mentor ghost privacy, reason, negotiation, and audit.
4. Render every view with D9-300 hierarchy across target widths and dense states.
5. Eliminate clipping, overlay, focus, and destination-reachability defects.
6. Complete keyboard-only and screen-reader task flows, including drag
   alternatives and Focus/closeout announcements.
7. Meet touch-target, zoom, contrast, reduced-motion, and orientation criteria.
8. Meet bundle, interaction, layout-shift, API, and large-data budgets.
9. Prove streaks, reserve, and capacity are honest, deterministic, and humane.
10. Repeat independent review after fixes; self-scoring cannot close the gate.

## Evidence package each reviewer receives

- production/staging URL and cohort;
- source/version/runtime hashes;
- task scripts and seeded representative data;
- desktop/tablet/mobile captures;
- screen-reader and keyboard recordings;
- performance traces;
- accessibility report;
- known-issue register;
- before/after decisions tied to D9-300 and D9-350;
- anonymized telemetry and failure-state evidence.

The evidence package excludes the self-authored 7.75 diagnostic baseline until
all first-pass reviewer scores are locked.
