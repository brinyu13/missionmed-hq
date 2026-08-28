# RISE Fable 5002 UI Preservation Contract

Ticket: `P1-RISE-5003-PRODUCTION-WIRING-AND-LIVE-DEPLOY`

Status: BINDING ACCEPTANCE GATE

Approved HTML SHA-256: `1e1a16aa630449c9e763a04f6f720b51df0afa46822044de165687d7f8758987`

This contract is extracted from the executed founder-approved HTML, its locked package, and an independent browser walk. It is not a redesign brief. If production constraints create tension with an older artifact, the executed Fable 5002 shell controls visual and interaction behavior. `DATA_PROVENANCE.md` controls whether a displayed fact is real or representative.

## 1. Immutable authority and implementation boundary

- The frozen HTML and package under `_UI_LOCKS/RISE_FABLE_5002_FOUNDER_APPROVED/source/` must remain byte-identical to the canonical package.
- Production implementation must live in a separate source path.
- Components, frameworks, APIs, persistence layers, and build tooling may change behind the contract; rendered visual hierarchy, route semantics, state behavior, and interaction geometry may not materially change.
- Production must not ship the founder-shell banners, synthetic Ignacio identity, Brookdale representative depth, representative hash tiers, simulated CVs, simulated campaigns/costs, or representative change-review facts to ordinary students.
- Removing demo facts must yield honest unknown, not a collapsed or redesigned interface.
- Any non-permitted visual/interaction change sets `FOUNDER_REVIEW_REQUIRED = YES` and remains unshipped until approved.

## 2. Global visual chassis

### Desktop rail and header

- Left rail is 232px at full desktop width.
- Rail order is fixed: skewed ember `Tell me about…` CTA; Home; Find Programs; My Programs; Rank List; My Profile; admin group only in Admin preview; Back to Matrix; role; role switch; identity.
- Header is 64px and contains the MissionMed//RISE identity, division line, environment/status chip, Compare tray, Theme control, and slash-enabled lookup.
- The header lookup, home hero lookup, and rail CTA are one lookup system, not separate products.
- The StoryForge-derived chassis, depth, border treatments, ambient aurora/vignette, tactile press states, skew/parallelogram language, and ember/orange CTA geometry are preserved.
- No generic dashboard, enterprise SaaS, Bootstrap, WordPress-admin, or card-first replacement is permitted.

### Responsive states

- At widths at or below 1180px, the full rail collapses to the compact/icon treatment.
- At widths at or below 860px, navigation becomes the fixed bottom tab bar while the header remains compact.
- The approved 820x900 and 390x800 states keep the hero, fit hierarchy, route access, and bottom navigation usable.
- Minimum intended type hierarchy remains: body about 18px, secondary about 16px, metadata about 14px, nonessential labels no smaller than 11px.
- Reduced-motion preference disables ambient/idle animation without changing layout.

### Themes

- Three theme states remain available through the same header control and cycle in this order: Midnight Depth, Graphite Motion, Soft Daylight.
- Theme switching must not alter content, route state, entitlement state, or component geometry.

## 3. Visible route contract

| Route | Visible product state | Required behavior |
|---|---|---|
| `#/home` | Home | Fixed band order in section 4. |
| `#/find` | Find Programs | List-first library with optional Grid, modes, filters, sort, progressive loading, and preserved state. |
| `#/my` | My Programs | User-specific saved programs, lifecycle state, notes, compare membership, and Program File entry. |
| `#/rank` | Rank List seam | RankList IQ handoff/return surface; RISE does not independently reimplement RankList IQ scoring. |
| `#/profile` | My Profile | Canonical Matrix profile projection and CV proposal/confirmation seam. |
| `#/program/:program_id/overview` | Program File Overview | Routed immersive overlay over the originating page. |
| `#/program/:program_id/fit` | Program File Fit | Evidence-based comparison and five-state system. |
| `#/program/:program_id/residents` | Program File Residents | Denominator/completeness law plus entitlement-gated atomic depth. |
| `#/program/:program_id/people` | Program File People | Leadership roles, histories, photo availability, trained-here states. |
| `#/program/:program_id/next` | Program File Fellowships & Outcomes | Direct/advanced/uncertain/excluded distinctions; fellow origins; no fabricated retention. |
| `#/program/:program_id/details` | Program File Details | ABIM claim/verification distinction, salary/currentness, benefits, identity, conflicts. |
| `#/admin/research` | Research/Campaigns | Scoped builder and natural-language draft-before-confirm flow. |
| `#/admin/queue` | Research Queue | Operational task states and privacy holds. |
| `#/admin/review` | Research Review | Five-action conflict/change/identity review cards. |
| `#/admin/coverage` | Coverage | State/specialty/family coverage matrix; cell click pre-fills a campaign. |

Unknown routes fall back to Home in the shell. Production may use a real 404/auth boundary, but may not silently route a known RISE route into another product pattern.

## 4. Home acceptance contract

Band order is fixed:

1. Greeting and one-sentence orientation.
2. Dominant `Tell me about` hero lookup with placeholder `…a program, a hospital, a city` and ember `Open File` CTA.
3. Three `Try asking` chips.
4. Two-column content band: `Your fit` at the larger proportion; `My programs` above `Your profile` at the smaller proportion.
5. Four feature doors in order: SOAP 2026 Openings; Alumni Connections; Letter of Interest; Match Bridge.
6. `Updated this week` freshness strip.

Additional laws:

- `Your fit` displays programs, not scores, with Gold/Silver visual treatments, explanatory reasons, and an always-visible `not match odds` legend.
- `Dr Brian’s read` remains nested in the fit panel, not promoted into a separate dashboard module.
- My Programs shows saved/applied/interviewing/ranked counts and saved program previews.
- Profile shows completeness and missing-fact actions without becoming a second profile truth.
- The four feature doors stay clickable and informative even when their depth is locked or unavailable.

## 5. Lookup contract

- Lookup is closed-set program intelligence, not an open-ended chatbot.
- Autocomplete begins after two characters, searches names, institutions, cities, states, and aliases, and supports keyboard Up/Down/Enter/Escape.
- Supported intent classes are program open, state/profile-fit routing, program fact (visa/exams/deadline), similar programs, and SOAP routing.
- Program fact answers render as an evidence card with exact/current wording, state glyph, freshness, and `Open File → Fit`; they do not improvise an answer.
- An unrecognized or empty result renders an honest `I looked for programs matching…` message.
- `/` focuses the global lookup when focus is not already in an input.

## 6. Find Programs contract

### Default and modes

- Default presentation is List. Grid is an explicit toggle and never replaces the list-first default.
- Three search modes remain: Set criteria; Use my profile; Use my CV.
- Profile mode visibly shows the applicant facts contributing to filtering and identifies Matrix as their source.
- CV mode must present extracted facts as proposals for confirmation; it may not overwrite canonical profile facts automatically.

### Primary controls

- Specialty, State, IMG evidence, Visa published, More filters, Sort, showing count, List/Grid, removable filter pills, and coverage banner remain in the same hierarchy.
- Sort options remain: Best fit for me; Program name A-Z; State; ABIM pass rate (verified); Recently updated; SOAP openings.
- Progressive loading remains visible (`Showing n of total` and `Load 50 more`) or may become equivalent infinite loading without changing the initial list-first scan.

### Additional filter families

- SOAP 2026 openings with historical-evidence caveat.
- Evidence depth: any, Gold dossier, enriched/Tier A, registry.
- ABIM verified rate.
- IMG evidence on roster; DO/Caribbean evidence.
- Sponsorship published, explicitly distinguishing a listed status from sponsorship.
- Production implementation must also expose the ticket-required real filters—region, program type, COMLEX, YOG, USCE, fellowship, freshness, and other canonical fields—inside this existing control/drawer grammar, not by redesigning the library.

### Program row hierarchy

- Row order remains: Save star; specialty tag; name and institution/location; tier/fit line when applicable; IMG/DO signal; visa signal; SOAP signal; freshness; Compare; Open File.
- Tier stripe remains on the left edge.
- Registry-depth rows render honest unknowns such as `Requirements not yet published or verified — fit unknown`, `roster —`, and `visa not published`.
- Unknown must never be styled or worded as No.

### Compare

- Compare remains accessible per row and from the header tray.
- Maximum selection is four.
- Side-by-side comparison preserves unknown/conflicting states.
- No winner/crown appears when a compared program has not-published rows.
- Compare contains a persistent `not match odds` legend.

## 7. Program File overlay contract

- Program File is a routed overlay, not an inline expansion or replacement page.
- It occupies approximately 94% of the viewport and keeps the originating page visible/inert behind it.
- Opening stores origin route, filters, view mode, scroll position, and focus target.
- Close button, backdrop, Escape, and browser back return to the untouched origin state; focus returns to the previously opened row where possible.
- Program File header must answer within five seconds: what program, where, track/type, `For you`, why/fit line, key signals, and next actions.
- Header action order and placement remain Save; Add to Compare; Ask about this.
- Sources & Freshness remains in the header and assertion-level info controls.
- The six primary tabs and their order are immutable: Overview; Fit; Residents; People; Fellowships & Outcomes; Details.

## 8. Program File tab laws

### Overview

- `Why this program` assertions pair fact with `Why it may matter`, family, verified date, and source access.
- Mission/differentiators, curriculum, community/patient population, facilities, research, unknown footer, snapshot, people preview, notes when appropriate, and freshness-by-family retain their hierarchy.

### Fit

- No match probabilities, numerical fit scores, `safe`, `guaranteed`, or fake precision.
- The primary evidence states are Meets, Check, Issue, Not published, Conflicting. Policy/Info and N/A may be used for non-applicant comparisons.
- Glyph/visual system remains: Meets check; Check exclamation; Issue x; Not published dashed circle; Conflicting half-circle.
- Each row shows criterion, published classification, exact program wording, applicant fact, and state.
- Prior-cycle and undated material is labeled; absent policy remains Not published; listed visa status is not sponsorship.
- Gold/Silver treatment must be deterministic and evidence-based in production. Insufficient data yields Needs More Data/untiered, never a forced preview tier.
- Explanatory reasons are persisted/available; tiers are never called match odds.

### Residents

- Summary/completeness and denominator explanation remain visible without membership.
- Atomic roster detail may be gated, but the free state teaches what exists and why depth is locked.
- Names, PGY, degrees, schools, countries, US-MD/US-DO/IMG/UNKNOWN, Caribbean evidence, sources, and verified dates must remain evidence-bound.
- Composition percentages remain withheld when a complete/deduplicated denominator is unsafe.
- Roster privacy holds remain first-class.

### People

- PD/APD/leadership hierarchy, role, photo availability, training history, Residency Here, and Fellowship Here remain.
- Trained-here state is Yes/No/Unknown; current employment is not proof of internal training.
- Internal-continuity percentages require a defensible denominator and are otherwise omitted with explanation.

### Fellowships & Outcomes

- Fellowship inventory distinguishes direct in-house, advanced subtrack, affiliate when present, uncertain, and excluded/not accessible.
- Current fellows pair person, fellowship, residency origin, and same-system state.
- No internal-retention percentage without a complete defensible cohort.
- Graduate outcomes retain class year, destination/outcome type, provenance, and partial/unknown states.

### Details

- ABIM verified extract and program claim are visually/verbally distinct.
- Salary includes PGY level, amount, source label, cycle/currentness, and prior-cycle warning.
- Benefits, canonical identity (RISE_ID, ACGME_ID, NRMP when mapped), application service, official URL, structure, and conflicts remain scannable.

## 9. Sources & Freshness contract

- A slide-in utility panel is always reachable from the Program File header and assertion info controls.
- It shows freshness by family, verified/accessed dates, coverage summary, source name, source authority/tier, publisher/domain, URL where safe, current/stale state, conflicts, conflict treatment, and unresolved fields.
- Student presentation remains elegant; admin/review surfaces retain inspectable provenance.
- Research updates hydrate from the canonical store without requiring a frontend redeploy.

## 10. Membership contract

- Gate depth, not all value.
- At most one consolidated lock region per tab in the approved grammar.
- A lock includes a real summary of what exists, why it matters, and the named entitlement path.
- Real entitlements determine access; unknown entitlement fails closed without hiding free value.
- Founder-only `Preview as member` is a review affordance and must not appear in ordinary production student sessions.
- Alumni Connections, Letter of Interest, Match Bridge, and advanced Program File regions remain visible with honest locked/unavailable states when no production backend is bound.

## 11. My Programs, Profile, CV, and Rank List

### My Programs

- Save/star is user-specific and persistent across devices in production; localStorage-only or memory-only state is forbidden.
- Lifecycle advances through saved, applied, interviewing, ranked and includes notes/timestamps.
- Compare membership and Program File access remain visible per tracked row.

### Profile and CV

- My Profile is a projection of the canonical Matrix applicant profile, not a second truth.
- RISE writes through the canonical profile service with field validation; Matrix updates reflect back in RISE.
- `Use my profile to find programs` routes to profile mode.
- `Use my CV instead` opens the File Vault/select-or-upload seam where safe.
- CV extraction produces proposed, reviewable, confirmable facts before any canonical write or fit effect.

### Rank List

- Rank List remains explicitly powered by RankList IQ.
- RISE passes canonical program, user state, fit states, and evidence; RankList IQ returns its own priority surface.
- RISE must not independently recreate RankList IQ scoring or merge ranking priority into Gold/Silver tiers.

## 12. SOAP contract

- SOAP is historical accessibility evidence only, never an `easy`, `safe`, or friendliness label.
- Default SOAP route presents all joined programs with All Tracks/Categorical/Preliminary/Primary Care segments and a persistent caveat.
- Program rows and Files preserve year, track/position type, unfilled positions, source, and identity-review state.
- ACGME-first identity reconciliation and unresolved joins remain reviewable; they are not silently forced.

## 13. Admin Research Command Center contract

### Visibility and navigation

- Admin surfaces appear only in Admin role/preview and do not replace the five student destinations.
- Admin order is Research; Queue; Review; Coverage.
- Student users see only simple Updating/Verified recently freshness states, never internal task states.

### Research builder

- The four-step structure is fixed: Scope; Field families; Preview; Run.
- Scope supports specialty, state and production-required city/region/hospital/program/coverage/stale/missing/conflicting dimensions.
- Field families include resident rosters, resident schools/composition, leadership, leadership training, requirements, visa, ABIM, salary/benefits, fellowships, current fellows, fellow origins, and graduate outcomes.
- Preview displays program count, task count, processor/product/task class, estimated cost math, ETA, skips, holds, and budget caps.
- `Run research` is disabled until a valid bounded preview exists.
- Production processor choice must follow a validated cost-aware router when authorized; the founder shell's hard-coded `Parallel Ultra` wording is simulated, not production authority.

### Natural-language research

- Natural-language input resolves a bounded scope, canonical identity, fields, condition/task class, processor, and estimated cost.
- It produces a visible draft and requires explicit confirmation before any paid submission.
- Hearsay becomes a labeled hypothesis, not a fact.
- Ambiguous or unbounded language cannot directly spend money.

### Queue

- Supported operational states: Queued, Running, Returned, Normalizing/Normalized, QA, Ingested, Needs Review, Partial, Failed; privacy hold and cancelled/paused controls remain explicit.
- Cost to date, progress, task identity, field family, pause/stop, and review routing remain visible.

### Review

- Review cards show current value, proposed/new source value, program/canonical identity, evidence, and conflict/identity type.
- Five actions remain: Accept Update; Inspect Source; Keep Existing; Mark Conflict; Research Again.
- Higher-risk changes do not auto-overwrite canonical evidence.

### Coverage

- Coverage matrix preserves state/specialty by field-family scan, current/partial-stale/missing/privacy-hold legend, and click-to-prefill behavior.
- Coverage counts distinguish full identity coverage from enriched/deep research.

## 14. Loading, empty, error, auth, and safety additions permitted in production

Permitted production additions must use the existing visual grammar and smallest possible layout impact:

- Loading skeletons, retry/error cards, empty states, offline/auth-expired states, stale-data warnings, pagination/infinite-loading states.
- Anonymous auth redirect, non-entitled fail-closed state, admin authorization denial, and service-unavailable locks.
- Responsive, accessibility, security, and performance fixes that do not materially change the founder contract.
- Honest disabled states for File Vault, Alumni, Letter of Interest, Match Bridge, RankList IQ, or research when their canonical services are not safely bound.

## 15. Production demo-data exclusion gate

The ordinary student product fails release if any of the following render as medical/program/applicant truth:

- Brookdale representative depth or representative SOAP row.
- Hash-derived Gold/Silver preview tiers or violet representative tier dots.
- Ignacio demo profile or simulated Matrix/CV values.
- Simulated admin campaign/task/cost history.
- Representative Ascension Saint Agnes leadership change.
- Any `Demo`, `representative`, or founder-shell-only value outside a separately authenticated internal fixture/demo mode.

Where real data is absent, production must render Not Yet Verified, Research Pending, Not Published, Unknown, Conflicting, Partial, privacy hold, or honest unavailable/locked states as appropriate.

## 16. Material regression failure conditions

The build fails without explicit Founder approval if it materially changes:

- left navigation structure/order or StoryForge-derived chassis;
- orange/ember CTA geometry;
- Home band order or `Tell me about…` hero interaction;
- Your Fit/My Programs/Profile hierarchy or four feature doors;
- list-first default, List/Grid toggle, row hierarchy, filter/evidence caveats, or compare cap;
- Program File routed-overlay behavior, immersive size, origin-state restoration, six tabs, Sources/Freshness utility, or Save/Compare/Ask placement;
- five-state fit glyphs, Gold/Silver visual treatment, typography hierarchy, spacing, dimensionality, or tactile language;
- premium-depth gating philosophy;
- admin Research/Campaigns builder, preview-before-spend, Queue/Review/Coverage model, or natural-language confirmation law.

## 17. Acceptance checklist

Every production candidate must record PASS/FAIL for:

- UI-lock hash and byte identity.
- Desktop 1440x900, compact 820x900, and phone 390x800 screenshots against the approved shell.
- Global rail/header/order, theme states, reduced motion, keyboard focus, and no console errors.
- Home band order and all lookup intents.
- Find list default, Grid toggle, modes, filters, sort, progressive loading, rows, compare cap, and unknown rendering.
- Program File route, overlay size, origin restoration, Escape/backdrop/back, header hierarchy, six tabs, Sources/Freshness, locks, and member depth.
- Fit state semantics and zero probability/fake precision language.
- SOAP track segments and caveats.
- My Programs cross-device persistence and ownership isolation.
- Matrix profile read/write-through and CV confirmation boundary.
- Real entitlements and fail-closed behavior.
- Admin authorization, scoped preview, confirmation-before-spend, task states, conflict actions, and auto-ingest gates.
- Anonymous, non-entitled, entitled, and admin role journeys.
- Demo-data exclusion scan.
- No frontend secrets/service-role/Parallel keys.
- Rollback artifact and exact rollback rehearsal/readiness.

Any FAIL means `FABLE_5002_PRESERVED = NO` or `LIVE_QA_PASS = NO` as applicable. The candidate may not deploy or remain live.
