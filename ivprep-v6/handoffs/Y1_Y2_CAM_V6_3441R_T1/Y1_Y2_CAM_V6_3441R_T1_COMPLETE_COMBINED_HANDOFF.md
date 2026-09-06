# Y1-Y2-CAM-V6-3441R-T1 Complete Combined Handoff

## Outcome

The accepted `f030773e352237bc774459a8506041658c15620f` product was resumed
under canonical MissionMed OS `9a59ade563a5ad83c4f9912a42d45300bdc7b177`
and DR-094/095. Zero-cost preparation is complete. One narrowly necessary
Founder-harness TTL correction was implemented and covered by a real harness
loopback regression. No provider session was created and no credit was spent.

Terminal state:

`TEST #1 ARMED - WAITING FOR FOUNDER PAID-TEST AUTHORIZATION`

This handoff is not `AUTHORIZE DR KELLY TEST #1`.

## Exact custody

- Product base: `f030773e352237bc774459a8506041658c15620f`
- Product parent: `864bb3eb64342f61e5bee30b9025674f1be175cf`
- Product tree: `a5dee1ab5b846c77926459f70b9501b039716bb7`
- Authority commit: `9a59ade563a5ad83c4f9912a42d45300bdc7b177`
- Product branch:
  `codex/y1-y2-cam-v6-3440-aaa-unified-production-admin-canary`
- Clean tracked base confirmed before work
- Two unrelated root coordination packets preserved untracked and excluded

Universal and `Y1-Y2-CAM-V6-3441R-T1` BOOT validation both passed against
canonical HQ tip `4c86e85c186c01561ded81e1927842cd2ce0e5fc`.

## Lease custody

The first exact four-file evidence lease was
`d64800c9-3519-4078-be91-76f96dea5139`, fencing epoch `20`, binding
`121c79bacfb356f35fe7ea5ecca2839505883de1d12d42a74659ba04dc908f65`.
It was released with zero writes after the browser exposed a harness TTL
defect. The transaction was rebound before editing to epoch 21. That lease
expired fail-closed during pre-commit review, after all writes but before any
commit or push:

- lease: `8b3ae934-e778-4cd7-8232-0e053d6f1943`
- fencing epoch: `21`
- binding:
  `a10d6910fd55476a4dc70be5163a314a30dc150b3457498248aefbff7667231d`
- nonce SHA-256:
  `780f5d316523af41da8e315d439db988f62fa221c0f804c7afee29b01c9419e5`
- disposition: expired; no commit or push; never reused

Epoch 22 re-fenced the same paths, but a pre-commit security review found its
raw nonce in staged evidence. The keeper was stopped and the lease was
explicitly released without commit or push:

- lease: `5b82a9de-8b52-4530-965f-cbfbd5e0d2d0`
- fencing epoch: `22`
- binding:
  `a10d6910fd55476a4dc70be5163a314a30dc150b3457498248aefbff7667231d`
- nonce SHA-256:
  `cc5ce79126812f201d4bffc5433f637742483ec2811fc7640cb39c9e257e033e`
- disposition: released; no commit or push; never reused

The exact same six-path transaction was then re-fenced under the current lease:

- resource: `PRODUCT:IV-PREP-ON-CALL`
- lease: `917adf38-189c-424b-8772-71768450ae73`
- fencing epoch: `23`
- binding:
  `a10d6910fd55476a4dc70be5163a314a30dc150b3457498248aefbff7667231d`
- nonce SHA-256:
  `d6f666a033e86a8476402ed21397c992c5bd7149bc64bf0f46bf9dfb0e24c628`
- exact write paths: 6

The lease covers only the harness, its runtime regression, and the four files
in this evidence directory. Its keeper is active at this freeze and must remain
active through commit, non-force push, and fresh post-push verification.
Release is required immediately afterward.

## Correction

`start-founder-proof-harness.mjs` previously evaluated `now()` separately for
session issue and expiry timestamps. If the reads crossed a millisecond, the
computed TTL exceeded the exact 1800-second admission maximum and the local
Founder room returned 401. The harness now derives both timestamps from one
clock anchor.

- Harness SHA-256:
  `618ea86cb43742bde8bbf4f3e0e618eda5dce43f600f132bc107254b1a3ce61e`
- Regression SHA-256:
  `782cfd195a7a8ef57fa672228bfa5052d78b8bf00ed48b8b3b9ca16568f0cf79`

One deterministic test forces sequential clock values and proves one clock
read plus an exact 1,800,000-millisecond TTL. A separate smoke test spawns the
actual staged harness candidate in synthetic mode with an empty environment,
requires fixed zero-provider startup evidence, loads the actual Founder room
over loopback, verifies the visible controls and CSP, and then requires clean
shutdown.

## Validation

Focused zero-cost matrix:

- total: 61
- passed: 53
- failed: 0
- skipped: 8
- skip reason: repository dependencies intentionally absent for the existing
  pinned AgentServer/runtime checks

Node syntax and `git diff --check` passed. The in-app browser loaded the
synthetic room with zero console warnings/errors. It showed Dr Kelly as inset,
the student as primary, one interviewer audio element, state `NOT AUTHORIZED`,
the exact 45-second limit, and only `marin`, `coral`, and `shimmer`. No button
was clicked.

## Exact future physical proof

- LemonSlice agent: `agent_9bdfc50ec0086043`
- Avatar: Dr Kelly only
- Model: `gpt-realtime-2.1`
- Profile: Profile B native Realtime speech
- Voice choice before authorization: `marin`, `coral`, or `shimmer`
- Duration ceiling: 45 seconds
- Maximum: one LemonSlice session, one OpenAI Realtime session, one LiveKit
  room/dispatch
- Automatic retry/reconnect/recreation: 0/0/0

The Founder-visible surface preserves separate authorization and start actions,
exact-avatar decoded media readiness, one audible interviewer stream,
microphone control, a hard deadline, single-session uniqueness, termination
before cleanup, provider status/cost reconciliation, and fail-closed unknown
state handling.

## Provider and spend facts

- Provider requests during preparation: 0
- Provider sessions created during preparation: 0
- LemonSlice credits consumed during preparation: 0
- LemonSlice balance: NOT OBSERVED because provider/credential access is closed
- Worst-case future exposure: one session, at most 45 seconds; exact credit
  conversion remains unresolved

All product database, Supabase product-data, Railway, deployment, production,
canary, student, analytics, Delivery Intelligence, and additional provider
actions remain closed.

## Resume condition

The next and only valid paid-test authorization phrase is:

`AUTHORIZE DR KELLY TEST #1`

Before that phrase is received in the task, do not launch live mode, authorize
the one-shot gate, start a provider, or consume credits.
