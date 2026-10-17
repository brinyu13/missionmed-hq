# I1Q-1007X Answer Isolation Report

Verdict: FAIL, SECURITY VETO

Date: 2026-07-15

## Authority Context

DR-006 and MissionMed OS PR #12 now settle the protected integration boundary: exact nine-field server storage, class A pre-answer output, server-only `answer_map`, unchanged sealed packs, and no reveal before finalization. The first audit's authority blockers were snapshot-time root-recovery findings. The answer-disclosure defects below remain current.

## Data Classes

| Class | Examples | Delivery rule |
| --- | --- | --- |
| A | Prompt, projected opaque ID, sealed choice text/order, approved rendering metadata | Pre-answer allowed by channel policy |
| B | Answer, correct key, `answer_map`, `is_correct`, correctness aliases, scoring internals | Server-only before authorized reveal |
| C | Explanation, correct and wrong rationales, teaching point, approved remediation | Post-answer only at channel reveal point |
| D | Internal IDs, source/evidence/reviewer records, assignments, policies, psychometrics | Internal/server-only by RBAC |

Unknown fields fail closed. A field's placement in the nine-column server table does not make it client-safe.

## Candidate Channel Review

| Channel | Declared phase | Intended content | Assessment |
| --- | --- | --- | --- |
| `stat_dataset_questions` | server-only | Exact nine-field rows | Shape PASS; storage/RLS unproved |
| `stat_pre_answer` | pre-answer | Dataset version, question ID, prompt, choices | Generated fixture is answer-free; validator incomplete |
| `stat_post_answer_debrief` | post-answer | Answer, explanation, rationales | Authorization FAIL; caller controls phase |
| `stat_indexes` / `stat_lookup` | pre-answer | Lookup/index data | Bare-ID collision and class policy gaps |
| `question_metadata` | server-only | Composite metadata and internal links | Version field present; mapping incomplete |
| Generic `item_revisions` resource | internal | Full revision | P0 answer disclosure to read-only roles |
| Generic channel artifact endpoint | mixed | Artifact payload | P0 post-answer reveal bypass |

## Confirmed P0 Findings

### AIR-001: generic revision disclosure

`QuestionPlatform.list` and `get` accept every read role for `item_revisions`. `#sanitizeResource` removes some private source fields but not answer-bearing revision fields. A synthetic probe confirmed that `read_only` receives both answer and explanation.

### AIR-002: caller-authorized reveal

The API forwards a query parameter to `artifactForPhase`. The service treats the literal string `post_answer_finalized` as sufficient authorization. No duel state or participant is checked.

### AIR-003: leak scanner omissions

The scanner catches several aliases but omits the architecture-mandated `answer_map` and `is_correct`. A probe confirmed both aliases pass undetected. The scanner also lacks:

- Closed-world channel field membership.
- Answer-value scans inside strings and metadata.
- Choice-order correlation/shuffle invariance.
- Class D field detection.
- Log, error, cache, and filename scans.

## `answer_map` Assessment

Candidate code does not query live `answer_map`; this is a narrow pass. It does not prove isolation because:

- The scanner fails to recognize the field name.
- Full Item Revisions expose equivalent answers directly.
- The post-answer endpoint lacks finalization and participant authorization.
- Candidate SQL broadly exposes channel artifacts and Item Revisions to any asserted actor.

The canonical Data Flow rule remains: `answer_map` is returned only by the existing authorized result path after server finalization and participant verification.

## Required Isolation Architecture

1. Separate answer-bearing storage or use an equivalent base-table boundary that ordinary roles cannot select.
2. Remove generic answer-bearing resource access.
3. Add explicit purpose-scoped answer endpoints for assigned author/reviewer/release workflows.
4. Audit every answer read with actor, purpose, exact revision, and release/duel context.
5. Derive reveal authorization from authoritative server state and participant identity.
6. Generate every channel from one immutable release membership set.
7. Enforce a versioned closed-world Channel Security Policy.
8. Scan names, values, nested strings, ordering correlations, D metadata, logs, errors, caches, and filenames.
9. Deny base answer-table grants to browser-facing roles.
10. Test old attempts and sealed-pack scoring to prove no behavior change.

## Required Negative Tests

- Read-only list/get of Item Revisions.
- Author reading an unassigned revision.
- Reviewer reading another reviewer's assignment.
- Release manager reading without a recorded purpose.
- `answer_map`, `is_correct`, `correct`, `solution`, answer values, and nested aliases in pre-answer data.
- Active, pending, void, and nonexistent duel reveal attempts.
- Finalized duel requested by nonparticipant.
- Direct base-table and artifact-table SELECT.
- Error, log, cache, source map, and static-bundle secret scan.
- Choice shuffle and identifier-correlation tests.

## Final Assessment

The pre-answer fixture happens to omit answers, but the application does not enforce answer isolation as a system invariant. All answer-bearing API and RLS paths remain release blockers.
