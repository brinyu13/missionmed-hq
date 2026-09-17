# I1Q-1008A Darwin Refactor Plan

## Scope And Verdict

- Ticket: `I1Q-1008A`
- Candidate HEAD: `81273add2c0fe350d330902d229683662896a1b1`
- Final local candidate-code fingerprint: `cd41853a8dfd5d4dd034cbfeb45098e83d4aee63f6697d1d8a72d6b57270fc26`
- Evidence class: `VERIFIED_LOCAL_STATIC` and `VERIFIED_LOCAL_SYNTHETIC`
- Product changes applied by Darwin: none
- Staging or production performance claim: none

The candidate's executable tests are locally correct and it is intentionally blocked from staging. No refactor was applied because the highest-value changes depend on preview query plans, the canonical runtime adapter, or a security decision about caching. Refactoring those paths before their integration evidence exists would increase risk without proving a production benefit. A concurrent authorized update changed preview artifacts during this lane; root regenerated the evidence estate afterward, and final validation passes 20 of 20 with zero errors and claimed state `BLOCKED`. Darwin did not modify that evidence estate.

## Ranked Proposals

### P1: Make Collection Pagination Complete In The Browser

Evidence class: `VERIFIED_LOCAL_STATIC`

`public/app.js` requests a maximum of 200 records through `listResource()` and does not consume `next_cursor`. Several screens then join whole collections in the browser. The source screen requests four collections, while editorial, physician, and release screens each request five. A collection larger than 200 can therefore produce incomplete selection, joins, review queues, and release views even though the API reports another page.

Proposed default:

1. Preserve the existing generic cursor contract.
2. Add bounded, query-specific server reads for source detail, assigned review work, and release preparation.
3. Add explicit browser paging where a full queue is expected.
4. Test 199, 200, 201, and multi-page cases, including an exact target that appears after page one.
5. Keep source, answer, and assignment authorization at the server boundary.

Gate before implementation: canonical datastore adapter and RLS-backed integration tests must exist. Do not solve this by exposing unrestricted collections.

### P1: Certify And Bound The Reviewer Queue Query

Evidence class: `VERIFIED_LOCAL_STATIC`, production impact `UNKNOWN`

`PostgresTransaction.listMyReviewAssignments()` filters by `reviewer_actor_id` and `state`, orders by priority and time, and has no limit or cursor. The current index is led by `state, review_type, priority, due_at`, not `reviewer_actor_id`. This may scan and sort more rows as the reviewer population grows.

Proposed default:

1. Run `EXPLAIN (ANALYZE, BUFFERS)` against representative synthetic preview volumes.
2. Add cursor and limit arguments to the repository contract if the queue can exceed one page.
3. If the plan confirms the risk, evaluate an index beginning with `reviewer_actor_id, state`, followed by the stable order fields.
4. Preserve forced RLS and caller-bound identity in every plan test.

Gate before migration: preview database authority, representative synthetic data, query-plan evidence, rollback review, and the normal forward-only migration route.

### P2: Measure Static Asset Delivery At The Real Ingress

Evidence class: `VERIFIED_LOCAL_SYNTHETIC`, staging impact `UNKNOWN`

The three static assets total 139,559 raw bytes. Offline gzip level 9 produces 30,711 bytes. The local Node server returns `Cache-Control: no-store`, no `Content-Encoding`, no `ETag`, and no `Last-Modified` header. This is conservative and correct for sensitive API responses, but it also prevents reuse of unchanged JavaScript and CSS.

Proposed default:

1. Measure actual compression and cache behavior through the authorized staging ingress.
2. Keep HTML and API data `no-store` until security approves any narrower rule.
3. Consider private revalidation for static JavaScript and CSS only after content fingerprinting or ETag support exists.
4. Do not add a bundler solely for size. The current dependency-free delivery is a useful safety property.

### P2: Remove Small Drift-Prone Duplications

Evidence class: `VERIFIED_LOCAL_STATIC`

The normalized seven-line window scan found overlapping repetitions that collapse into four useful refactor candidates:

- Supabase user and role-profile request setup repeats timeout, URL configuration, key checks, headers, redirect policy, and error translation.
- Generic `list()` and `get()` repeat protected-resource role checks.
- Editorial and medical review submission repeat the immutable revision identity envelope.
- Closed-world object checks and canonical JSON normalization have similar implementations in separate modules.

Proposed default:

Extract only the first three after focused parity tests. Keep evidence-validator canonicalization independent unless a formal shared hashing contract proves that coupling is desirable. Independent validation code can be intentional defense in depth.

### P3: Split Large Modules Only After Runtime Closure

Evidence class: `VERIFIED_LOCAL_STATIC`

The largest maintainability surfaces are `public/app.js` at 2,192 lines, `src/validate-evidence.mjs` at 2,108 lines, and `src/platform.mjs` at 1,555 lines. They are test-covered and currently dependency-free.

Proposed default:

- Split browser screens by workflow while preserving one shared state and API boundary.
- Split platform policy, review, and release services behind unchanged public methods.
- Leave the evidence validator intact during staging certification unless a verified defect requires a change.

This is maintainability work, not a release blocker.

### P3: Keep MemoryRepository Optimization Out Of Production Scope

Evidence class: `VERIFIED_LOCAL_SYNTHETIC`

`MemoryRepository.list()` filters and sorts the full collection for every page. At 20,000 synthetic candidates, the local p95 was 1.132 ms for page one and 0.960 ms for a cursor near 80 percent. This is locally fast, but the algorithm remains `O(n log n)` and is suitable for tests and the synthetic demo, not evidence for a production datastore.

Proposed default: retain it as a simple deterministic fixture repository. Optimize only if authority later assigns it a persistent or high-volume role.

## Explicit Non-Proposals

- Do not redesign Architecture 1002.1.
- Do not weaken answer, source, identity, RLS, or sealed-pack boundaries for speed.
- Do not add dependencies or a frontend build chain during staging closure without a concrete requirement.
- Do not add an index from static inspection alone.
- Do not claim loopback latency as staging or production capacity.

## Reproducible Read-Only Commands

Run from `/Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1008A/i1q-question-platform`:

```bash
node --test --test-reporter=tap tests/*.test.mjs | tail -24
npm run validate
find src public -type f -print0 | xargs -0 wc -lc
for f in public/*; do printf '%s raw=%s gzip9=%s\n' "$f" "$(wc -c < "$f")" "$(gzip -c -9 "$f" | wc -c)"; done
rg -n 'listResource\(|next_cursor|cursor|limit' public/app.js src/server.mjs src/store.mjs
rg -n -i 'reviewer_actor_id|review_assignments_queue|ORDER BY priority|LIMIT' src/postgres-repository.mjs db/migrations/*.sql
```

The exact measured values are recorded in `performance_before_after.json`.
