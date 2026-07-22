# Partner Demo Rejection and CAM v2 Replacement

RESULT: `PARTNER_DEMO_DESIGN_AUTHORITY_REJECTED`

## Status

The existing `/mmc-partner-demo/` is:

`HISTORICAL · SYNTHETIC · FUNCTIONAL-CONCEPT REFERENCE ONLY · DESIGN REJECTED · NOT CAM V2.0 AUTHORITY`.

The file remains preserved as historical evidence. Its navigation, visual language, hierarchy, density, typography, spacing, card patterns, colors, responsive behavior, and interactions have zero authority over the redesigned MMC.

## Local browser audit evidence

The preserved surface was inspected locally at `1280×720` and `390×844`. The browser console contained no warning or error entries. The only network failure was an expected local fixture/API fetch returning `404`; no production or provider request was made. At desktop size, important content was cropped. At 390px, the fixed-width/min-width layout produced an unusable mobile experience rather than a meaningful responsive transformation. This directly confirmed the static source review instead of relying on screenshots alone.

The temporary static audit server was stopped and browser tabs were finalized after inspection. MegaRun 006 made no redesign, visual refresh, or production UI change.

## Why it is rejected

- Eleven peer destinations expose a feature inventory instead of Dr Brian’s operating jobs (`missionmed-hq/public/mmc-partner-demo/index.html:274-288`).
- KPI tiles and a safety panel occupy the first visual tier before the mentor’s actual decision.
- Uniform navy rectangles, rainbow accents, small labels, and repeated card grids create a generic dark SaaS dashboard rather than a focused MissionMed command center.
- Global navigation, student chips, risk labels, open loops, a brief, and demo controls compete at once, weakening attention hierarchy.
- Profile, memory, goals, timeline, and preview are presented as separate destinations even when they are projections of the same canonical objects.
- Student Preview appears inside the mentor product and obscures the required authentication/publication boundary.
- Pipeline and mentoring concepts are not separated by role or consequence.
- The fixed 980px narrow-screen floor (`index.html:258-259`) directly contradicts the 320/390px and 200% zoom requirements.
- Synthetic scripted outcomes can look complete without proving identity, persistence, evidence, review, accessibility, or student safety.

The demo feels dated because it applies a dashboard template to a longitudinal human workflow. It is cluttered because every possible capability receives a peer card or navigation label. It lacks CAM v2 hierarchy because there is no dominant work vessel, one-next-action law, evidence inspector, focus mode, or meaningful responsive transformation.

## Functional concepts retained independently

Only concepts supported by current MMC functionality and user jobs survive:

- prepare → conduct → capture → review → follow through continuity;
- goals, milestones, tasks, promises, open loops, sessions, memory, and timeline as product objects;
- a privacy-safe student benefit projection;
- a clearly synthetic public narrative surface, if it remains useful;
- a selected-student briefing and next-action concept.

These concepts would be selected if the Partner Demo had never existed. No demo-specific layout or interaction survives with them.

## Patterns that must not survive

- Feature-count navigation and KPI-first home.
- Horizontal chips as global student selection.
- Separate screens that duplicate the same student state.
- Equal-weight rectangular card wallpaper.
- One unexplained risk/readiness score.
- Safety text used as decorative wallpaper.
- Synthetic “live” completeness or fixture ambiguity.
- Static Student View inside mentor navigation.
- Fixed-width desktop canvas and horizontal mobile overflow.
- Tiny uppercase body labels, color-only state, and decorative AI styling.
- Pipeline administration embedded in mentor session review.

## CAM v2 replacement

CAM v2 replaces the demo with a job-centered mentor command system: Today, Students, Work, Reviews, plus a role-gated Operations workspace. Each screen has one dominant vessel and action, a route-scoped student identity, progressive detail, and a provenance inspector. The deep-ink family shell, ember action budget, human-gold/machine-cyan semantics, crafted geometry, causal motion, Focus mode, and responsive navigation make the product recognizably MissionMed. A separate authenticated student projection provides only versioned approved content.

| Partner Demo pattern | Problem | CAM v2 replacement | User benefit |
| --- | --- | --- | --- |
| Eleven-item feature rail | Requires subsystem choice before the job is understood | Today / Students / Work / Reviews | Faster orientation and stable mental model |
| KPI wall | Counts do not explain why or what next | Ranked attention queue with source age and action | Decision in under one minute |
| Horizontal student chips | Scales poorly and creates mutable selection ambiguity | Search plus route-scoped `/students/:id` context | Deep links and consistent identity |
| Separate Profile and Memory | Duplicates student truth | Student Overview plus private inspector | One coherent brief with detail on demand |
| Goals and Timeline as peers | Fragments longitudinal state | Plan and History tabs | Predictable homes for canonical objects |
| Pipeline inside Meeting | Mixes mentoring with privileged administration | Role-gated Operations and Reviews | Calmer mentoring and safer permissions |
| One risk badge | Hides evidence and can stigmatize | Deadline/follow-through/readiness/data-support dimensions | Explainable, fairer action |
| Uniform card grid | Makes everything equally important | Dominant work vessel, support region, inspector | Lower cognitive load |
| Static Student Preview | Has no auth or publication proof | Separate versioned student projection | Real privacy and agency |
| Fixed desktop rail/min-width | Breaks phone, tablet, and zoom | Compact rail, drawer, mobile bottom navigation | Usable everywhere |
| Global safety banners | Become background noise | Persistent environment/save indicator plus object trust cues | Truth stays visible at the point of decision |
| Synthetic outcomes | Can simulate success without contracts | Deterministic empty/partial/error/adversarial fixtures | Honest validation |
| Rainbow status accents | Creates decorative competition | Ember action, gold human, cyan machine, semantic exceptions | Faster visual parsing |
| Generic dashboard cards | Feels like SaaS/CRM skin | CAM continuity thread and evidence studio | Distinctive mentor command identity |

## Revalidation statement

Every architecture recommendation was reviewed after the steering correction. Unsupported Partner Demo inheritance was removed. The proposed UI/UX scores use mentor task speed, student comprehension, trust, CAM family coherence, accessibility, responsiveness, and implementation safety—never fidelity to the Partner Demo. The selected architecture would be identical if the demo had never existed.
