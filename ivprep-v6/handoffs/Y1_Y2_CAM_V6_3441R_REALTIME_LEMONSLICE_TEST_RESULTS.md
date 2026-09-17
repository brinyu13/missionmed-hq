# Y1-Y2-CAM-V6-3441R Realtime and LemonSlice Test Results

Status: ZERO-COST LOCAL PASS; PAID TEST #1 NOT RUN

## Custody and authority

- Product base: 864bb3eb64342f61e5bee30b9025674f1be175cf
- Authority: DR-081, DR-082, and DR-085 at MissionMed OS commit 893cb86e9aede4e3be4485781807b90c3e53f9b4
- Exact authorized product paths: 31
- Exact agent: agent_9bdfc50ec0086043
- Exact profile: PROFILE_B_OPENAI_NATIVE_AUDIO
- Exact model: gpt-realtime-2.1
- Session-pinned voice candidates: marin, coral, shimmer
- Cedar: prohibited
- Maximum future Founder Test #1 duration: 45 seconds

No OpenAI, LiveKit cloud, LemonSlice, ElevenLabs, product Supabase, Railway,
deployment, canary, production, or student call was made. LemonSlice credits
consumed: 0. Founder Test #1 authorizations consumed: 0.

## Automated evidence

Current repository focused 3440/3441R matrix:

- 59 total
- 51 pass
- 0 fail
- 8 dependency-only pinned-SDK/AgentServer skips because repository
  node_modules is absent

Post-correction browser-readiness matrix:

- 7 total
- 7 pass
- 0 fail
- 0 skip

Prior correct-layout disposable install:

- npm ci --ignore-scripts installed 172 packages
- npm audit result from install: 0 vulnerabilities
- npm run check: PASS, including 28 analytics modules
- npm test: 290 total, 287 pass, 0 fail, 3 expected isolated-copy skips
- skipped boundaries: actual HQ logout seam, repository migration file, and HQ source-boundary file
- disposable directory was removed after validation

The final dependency-free browser corrections replace a rethrown readiness
rejection with one contained fail-closed outcome, check
`room.canPlaybackAudio` directly, and route post-readiness avatar-track loss,
reconnect, or disconnect to one idempotent server cleanup call. They are
covered by the current 7/7 focused matrix. The earlier 290-test disposable
result is not misrepresented as a rerun after these narrow corrections.

The LemonSlice adapter also retains its sole SDK session object after local
close, so an in-flight start or failed join cannot erase the only provider
session identifier before terminate/status reconciliation. A dependency-free
actual-adapter race test closes during join, observes the retained identifier,
forces join failure, and proves the exact control endpoint remains callable.

The first disposable attempt copied the package at the temporary root rather
than temporary-root/ivprep-v6. That setup error produced path-structure noise
and exposed one real browser-source boundary issue. The browser property was
renamed from founderAuthorization to founderTestPermit, the package was copied
at the correct repository-relative location, and the complete second run above
passed. The failed setup run is not counted as acceptance evidence.

## Synthetic browser proof

The in-app browser directly observed the loopback synthetic harness at
127.0.0.1:54941:

- startup reported SYNTHETIC_ZERO_COST and PROVIDER_CALLS_AT_STARTUP=0;
- the room rendered student video as the large primary surface and Dr Kelly as
  the small interviewer inset;
- authorization and start were separate explicit user actions;
- authorization changed the visible state to AUTHORIZED ONCE without creating
  a provider session;
- synthetic start reached worker ACTIVE and Synthetic ready;
- the accessible swap control changed to its active state;
- one interviewer audio surface was present; and
- the 45-second hard deadline reached the terminal server state.

That observation exposed a local UI defect: after server-side closure, the room
could remain visually active. The correction now maps provider CLOSED to
interview ended, clears connection state, and makes browser polling reset the
local room without issuing a duplicate end request. Focused and disposable
tests cover both the server mapping and the browser-source terminal branches.

A fresh second in-app-browser navigation to the new ephemeral loopback port was
blocked by the Browser tool with net::ERR_BLOCKED_BY_CLIENT even though the
harness remained healthy. No product workaround was added for that tool
limitation. Therefore the corrected terminal reset is supported by automated
evidence, not a second direct browser observation.

## Provider and voice conclusion

Profile B is wired as OpenAI Realtime native speech to LiveKit to the exact
LemonSlice agent. Realtime uses semantic VAD with automatic eagerness and no
fixed five-second silence wait. All provider contract tests use fakes.

No provider-native voice audition occurred in this zero-cost tranche. The
naturalness ranking among marin, coral, and shimmer remains a Founder
perceptual decision during a separately authorized Test #1. Profile A and
ElevenLabs were not activated or installed.

## Lease truth

Earlier connector-backed leases expired fail closed and the omitted
coordinator edit is not represented as retroactively compliant. DR-085 was
canonically filed and freshly dual-verified. Fresh exact 31-path product lease
`df977b5b-5299-4381-b2f3-4594bd5f6865`, fencing epoch 14, binding
`8c6d99a3d0656cb4d24a6a3e1ee26fbc123f7bc1897a802a1c99fabe02c4ee2f`,
then stayed live under a 10-second connector keeper.

The complete candidate was reverted to the sealed product base and reapplied
under that lease. The exact HEAD-to-worktree patch SHA-256 before and after was
`fe457df6126a53ed478929c9b88627fb9b94025aa98d5ae505026919eadeca02`;
the intermediate reverted diff was empty. No credential value was read or
printed. This handoff records the deviations and their forward custody
reconciliation instead of erasing them.

The epoch-14 keeper was later found completed. The final post-readiness
transport correction and DR-085 manifest-provenance correction therefore
remain disclosed as occurring before a fresh heartbeat was proven. Connected
acquisitions at fencing epochs 15 through 18 were not successfully maintained
because early response handles were discarded by the local wrapper parser and
the epoch-18 keeper attached after its safe heartbeat window; no later product
write relied on those handles, and they expired fail closed. Exact 31-path
lease `9cd2c3b1-6a0c-47e8-81b3-83ac0ff6ad28`, fencing epoch 19, binding
`8c6d99a3d0656cb4d24a6a3e1ee26fbc123f7bc1897a802a1c99fabe02c4ee2f`,
is the live 5-second keeper-backed lease for final evidence, staging, commit,
and post-push review. No credential value was inspected or printed.

## Gate

READY is not an authorization to spend by itself. Future paid Test #1 requires
a fresh Founder instruction for that exact test after this candidate is
committed, pushed, independently accepted, and the one-shot termination and
reconciliation path is armed. Test #2 and Founder Test #3 remain closed.
