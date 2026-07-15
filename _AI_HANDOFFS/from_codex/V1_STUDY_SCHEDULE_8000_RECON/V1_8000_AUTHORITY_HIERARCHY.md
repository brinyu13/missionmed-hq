# V1 Study Schedule — Authority Hierarchy

Authority is selected by scope and evidence, not filename date or self-declared
completeness.

| Rank | Scope | Authority | Binding decision |
|---:|---|---|---|
| 1 | Active identity and run scope | Brian's explicit V1 Study Schedule correction and resume directives | New work uses V1 Study Schedule; D9 names are historical; appointment/Calendar/Webex products are excluded |
| 2 | Visual and interaction foundation | D9-300 HTML plus design and interaction reports | Preserve CAM Timeline language, information hierarchy, canvas behavior, hard geometry, ink/ember palette, and low-cognitive-load interaction model |
| 3 | Behavioral law | D9-350 behavioral constitution, decision tables, streak and temporal specifications | Preserve Mission-first execution, learner control, reserve provenance, recovery conservation, mentor ghosts, closeout, humane streak behavior, and silence rules where consistent |
| 4 | Later refinement evidence | D9-360 artifact, specifications, screenshots, and 209-test prototype suite | Use as requirements/refinement evidence only after revalidation; it does not supersede D9-300 and does not close G-D9-4 |
| 5 | Domain and ecosystem intent | D9-100 and D9-200 definitions, integration maps, Mission/Focus/recovery specifications | Supplies approved breadth and historical intent where later authority does not conflict |
| 6 | Source implementation | `d4455bf4ee401eaa8b074603497eb9fcd6eb04a0`, based on the D9-415 observed-production recovery | Canonical source foundation and base for V1 implementation |
| 7 | Runtime fact | Live HTTP responses, served asset hashes, D9-415 production map, runtime lock evidence | Establishes what is served, accessible anonymously, and hash-identical; cannot decide product or data ownership |
| 8 | Data/deployment decision | No complete authority exists | Must be established by V1 decision records before schema or rollout |

## Conflict resolutions

### D9-300 versus D9-360

The founder explicitly identified D9-300 as the canonical visual and interaction
foundation. Any earlier report calling D9-360 the final product authority is
superseded for this run. D9-360 remains useful later evidence, subject to
rendered, accessibility, responsive, and behavioral revalidation.

### Student completion ownership

D9-100 allows an interpretation in which external systems can complete work.
D9-350's later behavioral constitution makes completion a learner action. The
later specific law controls: Arena/course outcomes may attach evidence or propose
completion, but must not silently set a learner block to done.

### Physical data store

No source, MissionMed_OS document, Supabase project map, or applied schema
establishes a canonical V1 Plan store. Existing Calendar events and unrelated
`study_plans`/`tasks` candidates do not acquire authority by resemblance. A
Plan-owned WordPress repository is the lowest-risk recommendation because
WordPress identity is established, but it remains a decision gate until recorded.

### Product passport and mission registry

Two repositories must not be conflated:

- The active V1 product worktree and product repository `origin/main` both track
  `PRODUCT_PASSPORTS/matrix.md`, blob
  `85c4b293896a0554c9fa4122329d106bb9cefe0b`, introduced by
  `7ce4aeec74a82fe540e7f1f4af1cca75edd9c2b9`. It is current recovered-source
  governance evidence but stale/incomplete: it points to older worktrees, omits
  `#study` and its API/storage owner, and still protects shared Matrix app-mode
  paths.
- Fetched MissionMed_OS `origin/main` has `products_index.json` pointing to
  `PRODUCT_PASSPORTS/matrix.md` but does not contain that file.

Fetched MissionMed_OS `CURRENT.md` contains a different active mission and
`missions.json` contains no V1 mission. These are authority/path drift findings,
not authorization to modify either passport or MissionMed_OS in V1-8000.

## Evidence rules for V1-8010

- A prototype proves intended behavior only, never production persistence.
- A passing jsdom suite proves prototype logic only, never authenticated browser
  integration.
- Exact source/runtime bytes prove provenance, never entitlement or data
  correctness.
- A route label or client lock is not server authorization.
- A flag is rollout control, not entitlement.
- A shared table name is not write ownership.
- Every protected-source change requires the runtime-lock protocol, Brian's
  recorded override where applicable, compatibility tests, immutable assets, and
  rollback hashes.
