# Y1-CIE-C0-0001 Test and Stress Report

## One-Shot Runner

Command:

```text
node Y1-CIE-C0-0001/tests/run_remaining_execution_loop.mjs
```

Current result: PASS, 15 gates. The final completion timestamp is recorded in the machine evidence after handoff generation.

Machine evidence: `Y1-CIE-C0-0001/evidence/c0_remaining_execution_summary.json`.

## Gate Results

| Gate | Result |
|---|---|
| CIE syntax | PASS, 32 modules |
| Unit/integration | PASS, 46/46 |
| Stress/concurrency | PASS, 4/4 |
| Disposable PostgreSQL | PASS, 38 recorded checks |
| Combined handoff mirror | PASS, 15 reports byte-identical |
| Security/future-off/redaction | PASS, zero credential findings |
| Shared HQ syntax | PASS |
| Root regression | PASS, no discovered root tests |
| Git diff whitespace | PASS |
| CIE dependency surface | PASS, zero dependencies |
| RC1 before/after | PASS, exact protected hash |

The root `typecheck` command has no project configuration and prints compiler help. The runner records this as a pre-existing non-required baseline, not as a CIE pass. Root dependency audit reports three inherited advisories: one low and two high. CIE adds zero dependencies and does not expand that surface.

## Stress and Fault Coverage

- 10,000 versioned track items with deterministic range queries.
- 250 concurrent mutations with unique sequences and exact idempotent retries.
- File persistence failure with transaction rollback.
- Stale writers, stale locks, interrupted commits, state/anchor tampering, and rollback detection.
- Hash-valid semantic corruption, cross-owner restore, negative sequences, bad hashes, and unknown contract versions.
- Replay concurrent play, partial player failure, close during play, extra players, manifest tampering, and inverted ranges.
- Deletion wrong class, missing/extra class, proofless state, wrong authority, wrong job, expired attestation, arbitrary finalization, actor spoof, GUC bypass, replay, and sentinel retention.
- Cross-user, unshared mentor, revoked grant, withdrawn consent, guessed deep link, and future-feature write denials.
- Two mentors sharing one source Moment cannot read each other's Opportunities; reviewer/track-author drift fails restore.
- Coordinated reviewer/track-author hash rewrites, mentor-Moment author rewrites, missing historical grants, and principals minted by a different adapter instance fail closed.
- Lifecycle ordering remains monotonic across serialized repository/service restart; caller-controlled future expiry and nested context timestamps cannot poison the durable watermark.

## PostgreSQL

- PostgreSQL 16.13.
- Fourteen FORCE-RLS tables.
- Eight capability entries; seven inactive and non-writable.
- Two trusted attestations consumed.
- Terminal audit actor equals the synthetic worker, not the student owner.
- Zero sentinel matches after deletion.

## Browser and Accessibility Smoke

Authorized and denied review paths were exercised in the real local browser at desktop and 390 px mobile. Checks covered semantic heading structure, skip link, one main region, status region, keyboard-visible controls, horizontal overflow, clipped text, failed images, credential-free URL, and truthful no-playback state.

No production browser, physical media device, provider, or real-user validation was required or claimed for this isolated foundation.
