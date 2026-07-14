# 12 Current UX and Product Debt

RESULT: `CURRENT_DEBT_EVIDENCE_CAPTURED_FOR_CAM_V2`

## Readiness distinction

The reconciled branch is ready to serve as the canonical engineering and Fable 5 input baseline. It is **not** ready for production rollout. The highest-risk debt is not cosmetic: the private product still relies heavily on approved fixtures, persistence is disabled, migrations are unapplied, real identity/assignment authority is unproved, and the Student View is not a dynamic role-scoped projection.

This report records current reality without performing the CAM v2 redesign.

## Priority debt register

| Priority | Debt | Evidence and risk | Required future outcome |
| --- | --- | --- | --- |
| P0 | Live authority is not established | Local UI shows fixture fallback; staging persistence and production data were not enabled or tested. | Prove environment, principal, assignment, RLS, source provenance, and rollback in authorized staging before any live-data claim. |
| P0 | Private Student View is static and default-student-specific | `screen-studentview` contains hard-coded Amara fixture tasks, goals, summaries, and files and does not follow the selected student. | Replace with an object-level, server-authorized student projection; never expose mentor memory, sensitive context, unapproved AI, or another student's fixture/state. |
| P0 | Production topology/schema remain undecided and unapplied | Historical standalone and current HQ-mounted architectures conflict; migrations are evidence only. | Make an explicit architecture decision, apply only through authorized staging gates, validate RLS, and preserve rollback. |
| P1 | Private mobile experience internally overflows | At 390 x 844, the document itself is 390 px, but the post-sidebar content is 144 px client versus 470 px scroll, with a 240 px fixed sidebar and 150 px topbar. | Introduce a true mobile navigation model, responsive topbar/actions, single-column content, and touch-safe controls without losing trust state. |
| P1 | Partner demo is desktop/laptop only | At 390 x 844 the document scroll width is 980 px because of a hard minimum width. | Either label it explicitly desktop-only or rebuild a responsive partner presentation before external mobile review. |
| P1 | Form labeling and semantic navigation are insufficient | Private: 23 of 28 fields lack an associated label/ARIA label/placeholder; Partner: 19 fields unlabelled. Private nav/filter interactions frequently use clickable `div` elements. | Use native buttons/links, programmatic labels, logical landmarks/headings, visible focus, and tested keyboard/screen-reader behavior. |
| P1 | Empty Meeting Intelligence state is visually blank | The no-meeting screenshot shows the selected filter over a large empty content region with no meaningful next action. | Add an explicit empty-state explanation, expected source state, safe next action, and distinction between no meeting, loading, error, and filtered-out data. |
| P1 | Pipeline and review lifecycle is too dense | Worker, Webex, imported assets, identity resolution, roster verification, and analysis approval share one long Meeting Intelligence panel. | Expose a legible lifecycle: discovered -> paired -> resolved -> verified -> analyzed -> reviewed -> persisted -> student-published, with a dedicated queue/inspector model. |
| P1 | Fixture/live/save authority remains ambiguous | UI shows statuses such as Fixture Fallback, Saving, Saved in demo, Local Only, or persistence disabled across different screens. | Establish a persistent environment banner and object-level source/save state so users cannot mistake fixture, local, staging, or live data. |
| P1 | Evidence/confidence review is not consistently visible | Pipeline schemas carry evidence and confidence, but high-level cards and next-best-move language can look definitive. | Show source, confidence, deterministic/AI distinction, prompt/model version, review state, and last-approved time next to every consequential inference. |
| P1 | Large/failed data behavior is unproved | Long transcripts, repeated meetings, large action/review queues, timeouts, retries, and 500s were not stress-tested. | Add deterministic fixture generators and browser tests for scale, latency, error recovery, deduplication, and partial data. |
| P2 | Information density obscures the operating loop | Today, Profile, Meeting, Memory, and Session repeat student facts, next moves, tasks, and promises across many cards. | Define canonical objects and a progressive pre-call -> live-call -> post-call spine; keep drill-down context available without duplicating authority. |
| P2 | Goals, Timeline, Open Loops, and review queues are discoverability-poor | They exist as sections inside Profile/Memory/Meeting rather than stable destinations or inspectors. | Clarify whether each is a primary workspace, tab, inspector, or contextual panel and provide stable navigation/deep-link behavior. |
| P2 | Small typography and contrast require formal audit | Many operational labels use 10–12 px muted text on dark surfaces. | Test contrast, zoom, density modes, and minimum readable type with real users and accessibility tooling. |
| P2 | Modal/focus behavior is under-tested | Quick Capture, system-status popover, and dynamic screens have no full focus-order/trap/return audit in this run. | Add focus entry/return, Escape handling, announcement regions, and keyboard-only regression tests. |
| P2 | Root quality scripts overstate coverage | Root test discovers zero tests; build is a placeholder; typecheck has no project input. | Make CI explicitly run the MMC validators and real build/type inputs so green status cannot be mistaken for coverage. |
| P2 | Webex drop-zone naming diverges | One observed legacy default uses `MissionWebexVidoes`; the worker prefers `MissionWebexVideos`. | Normalize under a separately tested migration/config ticket while preserving legacy discovery and never moving files blindly. |
| P2 | Static document metadata is stale | The private HTML header still describes a no-backend/demo lineage even though a guarded same-origin persistence candidate now exists. | Replace lineage comments/copy with explicit current-mode terminology without implying live production readiness. |

## Accessibility debt detail

The browser audit found named buttons on both surfaces and a visible partner-demo keyboard focus outline. That is useful baseline evidence, but not sufficient accessibility proof.

Private-console gaps:

- no `<main>` landmark;
- sidebar items and several filter chips are pointer-oriented `div` elements without native keyboard semantics;
- most form controls lack programmatic labels;
- dynamic save/persistence/analysis state is not proven to be announced;
- focus order, focus trapping, modal return, and screen-change announcements are untested;
- no screen-reader, contrast, zoom, reduced-motion, or touch-target certification.

Partner-demo gaps:

- no top-level `h1` despite a main landmark;
- unlabelled fields;
- a desktop minimum-width layout that prevents usable mobile access;
- no complete keyboard or screen-reader walkthrough.

## Workflow debt detail

### Mentor operating loop

The product contains the intended ingredients—attention ranking, longitudinal profile, promises, goals, risk, next best move, call prep, live capture, meeting intelligence, and post-session review—but the mentor must mentally reconcile repeated cards and status vocabularies. Fable should preserve the depth while making the next decision unmistakable.

### Student benefit and visibility

The current Student View communicates the right principle (mentor-only memory and internal AI are hidden), but implementation is a static preview. Student benefit cannot be measured or trusted until approved summaries, goals, tasks, deadlines, and files are projected from canonical objects under student authorization and tested for cross-student isolation.

### Meeting/media/identity lifecycle

The code correctly separates worker, Webex policy, deterministic identity resolution, roster verification, analysis, and persistence. The UI exposes nearly all of that at once. Users need clear queues, review reasons, confidence thresholds, provenance, and safe recovery, especially for unresolved or low-confidence identity.

### Empty, loading, and error states

The current audit exercised safe empty states and disabled integration states. It did not establish a coherent state system across all screens. Loading, no data, no permission, offline, timeout, source missing, parse failure, unresolved identity, approval required, and persistence failure must be visually and semantically distinct.

## Product debt beyond UI

- No authorized staging proof that real mentor assignments produce only the intended student scope.
- No production-ready object-level student-visibility policy/readback proof.
- No end-to-end real recording/transcript pair -> identity -> analysis -> review -> persisted briefing proof.
- No real prompt/model-version rollback exercise.
- No operational SLO, queue-aging, retry, audit-review, or incident workflow evidenced for MMC.
- No outcome instrumentation showing whether mentor preparation, promise follow-through, student response, or match-readiness improves.
- No final decision on partner-demo lifecycle: preserved historical demo, maintained sales artifact, or superseded by a future Fable surface.

## Fable 5 constraints

Fable may redesign hierarchy, density, navigation, responsiveness, and trust presentation. It must not weaken:

- private authentication, role/capability authorization, or CSRF;
- RLS and same-origin persistence ownership;
- the dedicated Coaching Import Worker boundary;
- deterministic identity and roster verification;
- media provenance and source identity;
- mentor-only/sensitive/student-visible separation;
- Matrix, Daily Drills, Scheduler, Calendar, Webex, R2, Stream, and File Vault protections;
- human review of consequential AI output.

## Debt conclusion

The current console is a credible, locally inspectable mentor-intelligence foundation. The next architecture run should focus on one coherent mentor operating loop, canonical object ownership, visible trust/provenance, dynamic role-scoped student benefit, responsive navigation, accessibility, and explicit pipeline/review states. It should redesign from this evidence, not from assumptions or an obsolete laptop copy.
