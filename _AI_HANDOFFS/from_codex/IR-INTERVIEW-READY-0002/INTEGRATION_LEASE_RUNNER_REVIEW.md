# Independent integration source runner review

Verdict: **APPROVE WITH CONDITIONS — exact dormant integration source runner**, reviewer `phase1_registration_contract_review` (Sol6.1 High), 2026-10-04, input HEAD `46b8388b598100227b76a7bd70dcc17ec95c9112`. Actual bounded credential read/probe and exact source claim require the separate fresh read-admission control. This approves orchestration for local implementation only, not runtime installation, production, or implementation acceptance.

Exact independently verified SHA256 inputs:

| Input | SHA256 |
| --- | --- |
| `integration_lease_runner.py` | `c17acd9595945573582c12680537849879fc17854a9512639c520ab7a4a06e81` |
| `integration_lease_runner_tests.py` | `299b87f0b277ce729051e21c8fdd0c141c3716355bb58257e74fe618c89ff24b` |
| Unchanged `lease_transport.py` | `6bab4c948b28202b7a803228f2123d5c95137030f16eb129c427b4ddcc487cad` |
| Final `MATRIX_RELEASE_WORKER_PACKET.md` | `c3a6e15b98938220f10406014e992cdc9cbd4359451187c737a4a0c3d8813cbc` |
| Canonical lease client | `36e37a487de0ec99191492c3ef286695bc4d8721cdac70f5c62863576e5c1431` |
| Filed DR-376 | `32ad43957a4b9a245e5eb715c998692bf0ad8ed13d0766d88ab0e9955b7513bd` |

The focused diff against accepted runner `32635e61c3d5eeb4ed09635656e7723cbfb40526` changes only integration source base/preimages, ten exact paths, tests/packet dependency, distinct approval/read-admission schemas, consumption marker and session/keeper identities. Orchestration, bounded transport, canonical client/RPCs, report/code digest checks, normalized ref and pre-credential pure scope construction remain unchanged. Old account read admissions are not reused.

**Nine fixtures independently PASS.** The actual pinned dormant canonical `path_scope()` accepts `refs/heads/codex/ir-interview-ready-0002-storyforge` and rejects bare refs before credential capability. An additional pure local canonical writer validation accepted all ten distinct paths with no shared-domain/global claim: scope `PATH:93cc7bada097a03b5163b83ecfc0d5f8fb2357c6f517b6c6f4a456acc7c155c6`. No client/provider operation occurred. Independent snapshot confirmed every current source preimage equals the fixed `a7adc5eb4107dc26d3dce38cae7195ad8b9868f3` preimage map: five absent new paths and five exactly hashed existing files. Canonical OS HEAD remains `84754150b8c834ac25466860ab98600b5d5c1b9e`; Foreman supplied fresh profile BOOT PASS with no pin drift.

DR-376 expressly names `_SYSTEM/CRITICAL_SYSTEMS_MANIFEST.json` for new IR owner registration, with exact preimage/owner/key/smoke/rollback independently reviewed before write. The bound packet admits only the dedicated `interview_ready` record and its precise new owner/protected route/asset/smoke entries against manifest preimage `41a35e9d3fd5dee394ceee2a66d0cfd4fe1959bca5535f1c58bf36ee764c33ec`. Preserve every existing value, runtime owner, pin, lock and known-good root; no broad reconciliation or false production flag. Inclusion in the explicit ten-path writer claim is lawful despite its being outside the packet's `interview-ready` source directory; exact provider collision fencing still applies. Dedicated Matrix implementation remains bound to DR-376 and the qualified baseline, including fresh shared byte/selection preservation before any later runtime operation. Existing account source acceptance and native/cache/live release conditions remain unchanged.

Source account epoch4667 was independently observed released with zero active IR source claims/applicable live pending waiters in `ACCOUNT_SOURCE_PROVIDER_CLEAR.md` at review commit `d3d34fc`. This is prior clearance evidence, not new integration lease health. No new acquisition is claimed here.

Controls will be published only after these two reports are committed, using `snapshot()` at the resulting actual source HEAD. Exact separate report hashes, contract/approval-byte bindings, future expiry at most3600 seconds and `maxSeconds=3600` are mandatory. The new `SOURCE_INTEGRATION_LEASE_20261004_1` directory must remain absent before invocation. One-use admission consumption precedes retrieval; an actual HTTP200 is required, then the same private key enters the unchanged canonical client. Immediate heartbeat precedes READY, a five-second keeper renews, and a fresh cooperative guard checks HEAD/binding/status/update age/expiry before each worker write and commit. Finally releases through the canonical client and distinguishes release failure; independent provider-clear follows later. A retained READY file alone is never health proof.

No material new code defect or unresolved owner gate was found. Foreman must inspect independent control authorship, observe actual READY/current HEALTHY and assign that sourceHead/binding. Changed HEAD, input bytes, exact paths, authority, stale status or failed provider admission stops. Only two local reports are committed by this reviewer, followed by separate ignored atomic control files; no actual credentials/provider/OS/product operation, deployment or push.
