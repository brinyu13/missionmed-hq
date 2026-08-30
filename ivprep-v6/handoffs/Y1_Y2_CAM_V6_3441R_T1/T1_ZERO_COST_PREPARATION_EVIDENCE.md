# Y1-Y2-CAM-V6-3441R-T1 Zero-Cost Preparation Evidence

Verdict: PASS for zero-cost physical-test preparation.

Terminal state:

`TEST #1 ARMED - WAITING FOR FOUNDER PAID-TEST AUTHORIZATION`

This evidence does not authorize a provider call and does not simulate the
Founder authorization phrase.

## Custody and authority

- Canonical MissionMed OS: `9a59ade563a5ad83c4f9912a42d45300bdc7b177`
- Decisions: DR-094 and DR-095
- Product base: `f030773e352237bc774459a8506041658c15620f`
- Branch: `codex/y1-y2-cam-v6-3440-aaa-unified-production-admin-canary`
- Universal and T1 BOOT dependency validation: PASS
- Product tracked base: clean before preparation
- Preserved unrelated untracked coordination packets: exactly 2
- Exact product lease: `917adf38-189c-424b-8772-71768450ae73`
- Fencing epoch: `23`
- Binding: `a10d6910fd55476a4dc70be5163a314a30dc150b3457498248aefbff7667231d`
- Nonce SHA-256: `d6f666a033e86a8476402ed21397c992c5bd7149bc64bf0f46bf9dfb0e24c628`
- Exact bound write paths: 6

The earlier four-evidence-file lease
`d64800c9-3519-4078-be91-76f96dea5139`, fencing epoch `20`, binding
`121c79bacfb356f35fe7ea5ecca2839505883de1d12d42a74659ba04dc908f65`,
was released with zero writes when the synthetic browser check exposed a
narrowly necessary harness correction. The epoch-21 lease was then acquired
against the two correction paths and the four evidence paths before any edit.
It expired fail-closed during pre-commit review, after all writes but before any
commit or push; its exact tuple was lease
`8b3ae934-e778-4cd7-8232-0e053d6f1943`, epoch `21`, binding
`a10d6910fd55476a4dc70be5163a314a30dc150b3457498248aefbff7667231d`,
nonce SHA-256
`780f5d316523af41da8e315d439db988f62fa221c0f804c7afee29b01c9419e5`.
No commit or push used it. Epoch 22 then re-fenced the same paths, but security
review found its raw nonce had been included in staged receipts. Its keeper was
stopped and the lease was explicitly released without commit or push. Its exact
lease ID was `5b82a9de-8b52-4530-965f-cbfbd5e0d2d0`, binding remained
`a10d6910fd55476a4dc70be5163a314a30dc150b3457498248aefbff7667231d`,
and nonce SHA-256 was
`cc5ce79126812f201d4bffc5433f637742483ec2811fc7640cb39c9e257e033e`.
The current epoch-23 lease was acquired over the same six paths. Only nonce
fingerprints, never raw nonces, are retained in this evidence.

## Narrow correction

The Founder harness previously built `issuedAt` and `expiresAt` from separate
clock reads. A millisecond of drift could make the session TTL exceed its exact
1800-second admission limit and return 401 for the local room. The harness now
uses one clock anchor for both timestamps.

- Harness SHA-256:
  `618ea86cb43742bde8bbf4f3e0e618eda5dce43f600f132bc107254b1a3ce61e`
- Regression test SHA-256:
  `782cfd195a7a8ef57fa672228bfa5052d78b8bf00ed48b8b3b9ca16568f0cf79`

The deterministic regression supplies distinguishable sequential clock values,
proves exactly one clock read, and proves an exact 1,800,000-millisecond TTL.
A separate smoke test starts the actual staged harness candidate with an empty
environment in synthetic mode, waits for its fixed startup evidence, loads the
Founder room over loopback, verifies HTTP 200 and CSP, checks the exact visible
controls, then terminates the harness cleanly. Neither test creates a provider
session.

## Automated result

Command:

`node --test --test-concurrency=1 ivprep-v6/test/3441r/*.test.mjs ivprep-v6/test/3440/*.test.mjs`

Result: 61 total, 53 passed, 0 failed, 8 expected dependency-only skips.

The eight skips are the existing pinned AgentServer/runtime tests that require
repository dependencies; repository `node_modules` remains absent. Syntax
checks and `git diff --check` pass.

Verified locally with fakes/synthetic transports:

- exact Founder-only one-shot issuance and separate authorize/start actions;
- exact Dr Kelly agent with no substitute or fallback;
- only `marin`, `coral`, and `shimmer`; Cedar rejected;
- exact 45-second ceiling;
- one reservation, dispatch, worker, provider-create attempt, and terminal
  record;
- zero automatic retry, reconnect, or recreation;
- exact-avatar decoded-video and audible-audio readiness;
- one audible interviewer audio surface;
- termination watcher armed before create;
- bounded terminate/status/cost reconciliation;
- unknown create or termination fails closed and trips the kill switch;
- page load, GET, health-shaped reads, and startup create no authorization or
  provider job; and
- post-readiness transport loss invokes cleanup exactly once.

## Browser observation

The synthetic Founder room was observed at:

`http://127.0.0.1:49700/iv-prep-on-call/#room`

Visible truth:

- agent `agent_9bdfc50ec0086043`;
- pipeline `gpt-realtime-2.1 native speech -> LiveKit -> LemonSlice`;
- `45s hard maximum`;
- state `NOT AUTHORIZED`;
- voice selector exactly `marin`, `coral`, `shimmer`;
- separate `AUTHORIZE TEST #1 ONCE` and `Start interview` controls; and
- exactly one interviewer audio element.

No control was clicked. Browser console warnings/errors: 0.

## Provider and spend truth

- Provider network attempted: no
- Provider sessions created: 0
- LemonSlice credits consumed: 0
- Current LemonSlice balance: NOT OBSERVED; DR-095 prohibits provider and
  credential access during preparation
- Maximum future exposure: one LemonSlice session of at most 45 seconds; the
  provider credit conversion remains unresolved without provider access

The future paid test remains closed until the Founder sends exactly:

`AUTHORIZE DR KELLY TEST #1`
