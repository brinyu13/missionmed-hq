# I1Q-3000 Complete Combined Handoff

## Verdict

**COMPLETE FOR ACCESSIBLE LOCAL DESIGN ARCHAEOLOGY, WITH EXPLICIT NON-LAUNCHABLE AND EXTERNAL-EVIDENCE EXCEPTIONS.**

The package preserves 46 evidence records across the direct Dr. J lineage, Daily Drills ancestors, Question Platform requirements/runtime evidence, and adjacent design donors. Forty-one working or inspectable local shells have a representative screenshot and a launch path. Five records are deliberately non-launchable: one APFS-dataless legacy reference, one restricted Zoom Notes export family, and three Markdown requirements packets.

This is a read-only comparison package. It does not select a final design, create a new application, merge prototypes, mutate production, authorize medical content, or establish product canon.

## Deliverables

| Deliverable | Purpose |
|---|---|
| [Prototype Gallery](./I1Q-3000_PROTOTYPE_GALLERY.html) | Searchable, sortable, paginated local museum with one evidence-backed card per record |
| [Design Comparison](./I1Q-3000_DESIGN_COMPARISON.md) | 46-row, 21-dimension comparison plus category leaders, preservation ideas, and discard findings |
| [Design Evolution Report](./I1Q-3000_DESIGN_EVOLUTION_REPORT.md) | Four-stream chronology, regressions, improvements, lost ideas, anti-patterns, and architecture reality |
| [Canonical Design Inventory](./I1Q-3000_CANONICAL_DESIGN_INVENTORY.md) | Idea-level archaeology index; “canonical” here means normalized evidence, not product adoption |
| [Screenshot Book](./I1Q-3000_SCREENSHOT_BOOK/README.md) | 41/41 representative working-shell captures plus deep-state and responsive evidence |
| [Curated Prototype Inventory](./evidence/curated_prototype_inventory.json) | Exact paths, SHA-256 values, aliases, metadata, per-field findings, and score projections |
| [Discovery Convergence Summary](./evidence/discovery_convergence_summary.json) | Search coverage, methods, privacy minimization, and explicit evidence gaps |
| [Screenshot Provenance](./evidence/screenshot_provenance.json) | Per-image digest and source/capture lineage |
| [Validation Report](./I1Q-3000_VALIDATION_REPORT.md) | Deterministic structural, provenance, source, screenshot, and cross-artifact checks |

## What was recovered

### Direct Dr. J question lineage

1. Three allocated legacy Immunology/JBank iterations plus one dataless preserved reference.
2. Two VDRL-090 video/node-synchronized drill revisions.
3. I1Q-2000, **The Ladder**.
4. I1Q-2001, **The Ladder inside Daily Drills**.
5. I1Q-2002, **Ladder vs Rounds Interaction Bakeoff**.
6. The current internal Question Platform operator studio as governance/runtime evidence, not a learner prototype.

### Daily Drills lineage

Daily Rounds launcher snapshots and T-12 through T-16 show the progression from an incorrect server-graded MCQ assumption to truthful spoken/open recall, learner self-report, simplified mobile controls, component studies, and a Browse/Sessions/runtime/summary synthesis.

### Question-platform lineage

I1Q-1002, I1Q-1004C, I1Q-1008B, and the current local operator studio show the evolution of source identity, revision/release lineage, answer isolation, rights/privacy review, audit, and consumer boundaries. These artifacts do not prove protected learner-runtime adoption.

### Adjacent pattern donors

QBANK, STAT, Grand Rounds, Timeline Builder, and CAM contribute explanation, replay, debrief, provenance, motion, responsive-QA, and visual-system patterns. They are labeled adjacent or donor evidence and are not presented as direct Learning Studio ancestors.

## Critical archaeological corrections

### The I1Q-2002 verdict does not reject the strongest Ladder

I1Q-2002 compared Rounds against a shortened, mostly passive Ladder. It omitted I1Q-2000’s repeated answer, confidence, per-rung feedback, explanation depth, replay, and convergence interaction. Its historical P3 Rounds verdict therefore applies to the comparator it implemented, not to the full I1Q-2000 Ladder. Founder and physician gates remain unresolved.

### “Production,” “canonical,” “live,” and “definitive” filenames are not authority

Every such artifact remains labeled by observed status. Local execution, a historical verdict, or a filename does not establish production readiness, product canon, deployment, or medical approval.

### Replay and notes are contracts, not labels

Real replay requires a verified media join: `video_id`, time anchor, source/revision hash, rights/privacy state, and available playback source. Zoom Notes registry data and locally authored Question Notes are distinct interfaces and were not merged by inference.

## Screenshot coverage

- 41 of 41 launchable or inspectable shells have one representative capture.
- The book contains 69 JPEG files in total: 41 primary captures and 28 additional state/responsive captures.
- Deep-state evidence includes home/entry, question/runtime, replay, explanation/verdict, analytics, results/debrief, and unique interactions.
- Direct I1Q deep states cover Ladder question/verdict/replay, Daily Drills Arena/hub/quiz, the Rounds demonstration, and mobile views.
- Existing synthetic QA evidence adds QBANK question/explanation/report/reviewer/mobile, STAT runtime/replay/debrief/mobile, and Grand Rounds podium/ruling/readiness/career states.
- Gallery responsiveness was inspected at 1440×900, 768×1024, and 390×844 with no horizontal document overflow.
- Restricted question/transcript content and learner-style labels were redacted for documentary captures. Synthetic QA files are named `_synthetic` and retain source hashes in the provenance ledger.
- No public screenshot was made for the APFS-dataless reference, restricted Zoom Notes export, or non-runnable Markdown requirements.

Representative capture means the strongest safe entry or state view available for that shell; it does not claim exhaustive state-machine coverage for all 41 historical artifacts.

## How to use the gallery

### Direct local use

Open `I1Q-3000_PROTOTYPE_GALLERY.html`. Each card supports:

- `Launch Prototype` when a standalone HTML source is safely launchable;
- `Open Source Folder`;
- `Open Handoff` when a specific handoff exists;
- `Copy path`;
- full metadata, strengths, weaknesses, innovations, dependencies, and digest.

The gallery sorts by approximate chronology, ticket, authoring AI, interaction model, educational quality, visual quality, and status. It filters all six lineages and searches concept fields, replay, notes, strengths, weaknesses, and innovations. Only three cards are displayed per page to keep the comparison readable.

### Allowlist-only localhost server

From this package directory:

```sh
python3 tools/safe_static_server.py --manifest evidence/launch_allowlist.json --port 8765
```

Then open:

```text
http://127.0.0.1:8765/t/i1q-3000-gallery/I1Q-3000_PROTOTYPE_GALLERY.html
```

The helper binds only to `127.0.0.1`, serves only allowlisted sources, blocks external connections through CSP, and can inject screenshot-only redaction with `?redact=1`. In localhost mode the gallery rewrites `Launch Prototype` controls to allowlisted HTTP routes, avoiding the browser prohibition on HTTP-to-`file:` navigation. `Open Source Folder` and `Open Handoff` remain local-file controls; if the browser blocks those from localhost, open the gallery directly as a file or use `Copy path`. The helper does not modify a source artifact.

### Current Question Platform local demo

The operator studio is server-backed and intentionally has no direct gallery launch link. Use the card’s `Copy launch command` control or run:

```sh
cd /Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1008B-SourceFactory/i1q-question-platform
I1Q_LOCAL_DEMO=1 /Users/brianb/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node src/server.mjs
```

Then open `http://127.0.0.1:4176/`. This is an in-memory local demo, not a production service.

### Launch limitations

- VDRL and several historical launchers open as shells but depend on historical media, registry, auth, or API contracts for full behavior.
- The APFS-dataless JBank reference was not hydrated. Its prior authenticated digest and aliases are retained.
- The Zoom Notes export family is restricted supporting evidence and has no launch control or public capture.
- Requirements packets are non-runnable Markdown evidence.
- CAM uses a tree route so its relative assets resolve.
- Unmounted, offline, restricted, or otherwise inaccessible archives cannot be claimed as searched bytes.

## Search coverage and convergence

The bounded census inspected the requested accessible roots:

- `MissionMed_AI_Sandbox`;
- `MissionMed_worktrees`;
- `MissionMed`;
- `MissionMed_OS`;
- `Downloads`;
- `Desktop`;
- `Documents`;
- the requested top-level `CLAUDE_FILES` location, which was absent.

Methods included semantic path/content terms, HTML/Markdown/image/document discovery, byte-hash duplicate grouping, handoff and ticket-lineage inspection, Git history, branch comparison, connected GitHub repository context, dependency review, manual HTML/CSS/interaction inspection, and privacy-safe browser launches.

The broad census found 17,968 candidate files before curation. The permanent evidence intentionally reduces unrelated local paths to aggregates and retains only curated paths. Search converged at 46 meaningful records for currently accessible local evidence. This is not a claim about offline drives, unmounted archives, cloud content not placed in scope, or dataless bytes that were deliberately not hydrated.

## Most durable ideas, without choosing a product

The reports preserve these as separate review candidates rather than merging them:

- occurrence/source identity and authentic-versus-authored labels;
- paired recall and clinical transfer;
- the full interactive Ladder and confidence-before-verdict;
- bounded Rounds clinical threads with physician-gated authored links;
- full-breadth recall plus selective depth;
- truthful spoken/open recall self-report;
- concise-first, progressively expandable explanations;
- exact-moment replay with verified rights/privacy/media identity;
- clear Learning, Exam, Review, Practice, and Test contracts;
- error-classified debrief and one defensible next action;
- separate game score, mastery evidence, and readiness claims;
- source-to-revision-to-release provenance, quarantine, and version compare;
- motion that carries state and has a reduced-motion equivalent;
- responsive and keyboard-operable question navigation.

No single visual language, interaction model, or prototype is selected.

## Validation and no-touch result

- Source artifacts were read, hashed, launched, or visually inspected without modification.
- No production, auth, database, deployment, protected runtime, learner release, or shared-system mutation occurred.
- No source files were overwritten, normalized, staged, or merged.
- Broad discovery evidence was privacy-minimized before permanent handoff.
- Source hashes are recomputed for allocated files; the dataless legacy digest is explicitly labeled as prior authenticated evidence and was not reread.
- All screenshot extensions match JPEG/JFIF bytes.
- Gallery structure, JavaScript syntax, record counts, lineage filters, search, pagination/focus transfer, and responsive overflow were checked.
- Specialist reviews covered repository archaeology, prototype inspection, design regression, architecture boundaries, UX, accessibility, stress testing, truth audit, educational quality, and safety.

Independent product certification, Founder review, physician review, accessibility certification, protected-runtime adoption, and production release are outside this mission.

## Repository filing

- Repository: `brinyu13/missionmed-hq`
- Branch: `codex/i1q-3000-prototype-archaeology`
- Starting commit: `e542d61a591bb96bf7db930a224c9baa8561c4dc`
- Output boundary: `_AI_HANDOFFS/from_codex/I1Q_3000_PROTOTYPE_ARCHAEOLOGY/`

The final commit, push, and seal digests are recorded after validation in the package manifest and final task handoff.

## Next action

Founder inspects the gallery and comparison package; only after that review should a separately authorized decision mission select what, if anything, proceeds toward implementation.
