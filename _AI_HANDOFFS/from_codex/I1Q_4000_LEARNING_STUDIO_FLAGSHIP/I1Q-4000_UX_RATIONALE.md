# I1Q-4000 Learning Studio UX Rationale

## Status and decision boundary

This document explains the interaction decisions embodied in the I1Q-4000 Learning Studio flagship prototype. The result is a **local P4 functional prototype using bundled synthetic fixtures**. It is not deployed, production-integrated, medically validated, psychometrically validated, accessibility-certified, or adopted as product canon.

I1Q-3000 is used as design evidence, not as an authorization to wire protected systems. The prototype deliberately does not connect to Daily Drills, the Question Database, Dr. J source content, Zoom Notes, replay media, learner accounts, or production analytics.

## Experience thesis

The interface is organized around a simple proposition: a learner should be able to enter from a drill, a subject, a review signal, or a saved state, choose an explicit learning contract, and always understand what will happen next. The shell therefore combines a calm home surface, a three-step session builder, a consistent question workspace, and a debrief/analytics path without disguising prototype data as real evidence.

The visual hierarchy favors one primary action per state. Supporting actions—favorite, flag, replay, notes, explanation depth, question map, and pause—remain available without competing with the response task. Feedback appears below the question rather than replacing or covering it, preserving the relationship between prompt, response, confidence, and explanation.

## Information architecture

Six persistent destinations support the requested exploration without dead ends:

- **Home** provides direct entry, a simulated Daily Drills entry point, a resumable-session path, and transparent fixture status.
- **Learning Studio** exposes all four learning templates and a common session-building path.
- **Saved sessions** makes pause/resume visible and provides recovery when the list is empty.
- **Favorites** turns a question-level action into an explicit future-session scope.
- **Analytics** separates current browser-local activity from seeded demonstration history across eight views.
- **Founder review** keeps open prototype choices inspectable without presenting notes as ratification.

The same session model is used whether the learner enters directly or through the simulated Daily Drills path. This demonstrates continuity without claiming that a production handoff exists.

## Exact, inspectable session scope

The builder uses three steps—template, exact scope, and focus/length—so the learner can understand the session contract before starting. One or more drills and one or more subjects may be selected. The queue is the exact intersection of those choices; it is never silently widened.

The preview reports how many unique synthetic occurrences match. If the requested length exceeds the eligible set, the prototype supplies only the available unique prompts. It does not repeat a question, invent a substitute, or pull from an unselected drill or subject. An empty intersection produces a recoverable explanation rather than a broken or misleading session.

This constraint is intentionally stricter than a convenience-first builder. It keeps scope legible, makes multi-drill and mixed-subject behavior reviewable, and exposes the product decision that a future system must make when demand exceeds available content.

## Four templates, one interaction grammar

The templates have distinct learning contracts while sharing navigation, progress, persistence, source labeling, and recovery behavior:

- **Quick Review** foregrounds open recall, reveal, and learner self-report.
- **Board Review** requires an answer and confidence judgment before feedback.
- **Clinical Mastery** makes a three-stage session sequence visible and offers a separate, optional bounded Rounds panel.
- **Adaptive** preserves the question workspace while adding a plain-language “Why this item?” explanation for deterministic synthetic ranking.

This consistency lets Founder review compare the instructional differences rather than relearn the controls. Adaptive is presented as orchestration, not as a visually unrelated fourth question renderer.

The displayed durations are **design targets only**. They have not been measured or validated. Likewise, the prompt's goal that a Founder can explore for 30–60 minutes is an experience-design target, not a completed timed usability result.

## Progressive disclosure and truthful support surfaces

Concise feedback is visible first; deeper explanation and alternative analysis are available as explicit layers. This limits interruption while keeping depth available. Replay, Zoom Notes, question notes, and Rounds use side panels so the question remains the stable spatial anchor.

The support surfaces are intentionally differentiated:

- **Replay** displays a synthetic anchor and placeholder controls; it does not stream media.
- **Zoom Notes** displays a bundled prototype sidecar; it is not a Zoom export or production notes join.
- **Question notes** are browser-local user input and warn against entering PHI or sensitive data.
- **Rounds** is an optional bounded exploration branch, not an adjudicated or canonical interaction model.

Opening a placeholder is still useful for reviewing layout, focus behavior, copy, and event semantics. It does not prove media identity, availability, rights, privacy review, or source synchronization.

## Continuity, recovery, and local state

Favorites, flags, notes, Founder-review notes, active sessions, and paused sessions persist under one browser-local storage key. Quick Review's reveal state is part of the persisted session rather than transient decoration, so a reload does not erase the learner's place in the response contract. Pause, reload, resume, empty states, and local reset all have explicit paths.

Persisted data carries a schema version, a catalog digest, payload validation, and an FNV-1a integrity marker. The marker detects ordinary local corruption; it is **not cryptographic integrity or a security boundary**. A checksum-valid but malformed payload is rejected by structural validation. Future-schema and corrupted states fail visibly and offer a deliberate local reset. Cross-tab changes are reported rather than silently merged.

No account sync, server persistence, collaboration, or durable learner record is implied.

## Responsive and accessibility rationale

The desktop rail becomes a modal mobile navigation drawer. At narrow widths it is removed from the keyboard and pointer flow while closed; when open, focus is contained, the background is inert, Escape closes the drawer, and focus returns to the trigger. Session builder, side panels, and reset confirmation use corresponding modal focus and return behavior.

The prototype also includes:

- semantic landmarks, headings, dialogs, alert states, fieldsets, radio groups, tabs, tab panels, tables/ledgers, and labeled data graphics;
- roving keyboard focus for answer options and analytics tabs, including arrow, Home, and End keys where appropriate;
- visible two-tone focus treatment and text/icon correctness cues that do not rely on color alone;
- focus transfer to the active question after start, resume, and question-map navigation;
- 44-pixel mobile targets for primary compact controls;
- responsive reflow rather than a separate reduced-capability mobile experience.

These are implemented prototype behaviors, not an accessibility certification. Automated checks and viewport inspection cannot substitute for assistive-technology testing, actual 200% browser-zoom validation, screen-reader review, or review with disabled learners. Any high-zoom screenshot in this package is a narrow-viewport reflow proxy unless the validation report states otherwise.

## Analytics and truth in labeling

The analytics area keeps three categories distinct: browser-local interaction facts, derived values from the current synthetic session, and seeded demonstration fixtures. Headline copy and per-card labels disclose which category is shown. Mastery proxies, heatmaps, trends, replay/explanation history, confidence history, and prediction are presentation hypotheses—not validated learner analytics.

The prediction card exposes its deterministic fixture rule rather than implying an opaque model. It is explicitly not an exam score, mastery estimate, readiness judgment, medical inference, or calibrated prediction.

## UX hypotheses for Founder review

The prototype is evidence for evaluating, not ratifying, these hypotheses:

1. A single builder can serve direct, Daily Drills-shaped, multi-drill, mixed-subject, weak-concept, and favorites entry without losing scope clarity.
2. Template differentiation is strongest when the response contract changes but the surrounding workspace remains stable.
3. Exact intersections and honest shortfalls create more trust than silent scope expansion or repetition.
4. Concise-first feedback with optional depth can preserve pace while supporting remediation.
5. Source support tools are understandable even when their unavailable integrations are disclosed prominently.
6. Local pause/resume, favorites, and recovery states are sufficient to review continuity before selecting a production persistence architecture.

Founder review, learner usability research, physician review, privacy/rights review, accessibility certification, analytics validation, production architecture, and release authorization remain separate gates.
