# IR authentication timeout — bounded synthetic diagnosis

Date: 2026-10-04. Builder/debugger: `/root/lease_transport_implementation`.
Base: `71c5e5baa780f6af0848a4aabbd67d04fb3aab1f`. Report-only scope.

## Finding

Actual failing stage and cause remain UNPROVEN. No definite local deadline or
private-pipe defect reproduced. Foreman supplied the real command result:
`python3 -u run_authenticated_registration.py` returned
`AUTHENTICATION_STOP: transport deadline exceeded`, exit 1, without
`AUTHENTICATION_PASS`; approximately six seconds was estimated from tool
execution/poll timing. This debugger did not repeat that command or access any
credential/provider. Tool poll estimates do not establish the operation's measured
monotonic elapsed time.

The exact message is raised only by `lease_transport.py:43-46`, when the supplied
monotonic deadline has expired or is nonfinite. All production callers construct
finite deadlines. Its callers do not attach phase/elapsed information:

- `retrieve_existing_key()` sets sixty seconds for token lookup plus reveal.
- Each `_read_keychain()` worker sets the smaller of the remaining total budget
  and ten seconds. Its expiration propagates the same generic message and stops
  without fallback, even if the overall sixty seconds has not elapsed.
- `authentication_probe()` starts its own sixty-second deadline.
- `_private_worker()` uses the applicable deadline for pipe selection and final
  child wait. It explicitly closes stdin before reading the HTTPS child output,
  so the child stdin-to-EOF read has no reproduced parent-held-stdin deadlock.
- `run_authenticated_registration.py:20-25` puts both reveal and probe in one
  catch; no success checkpoint distinguishes reveal completion from probe start.
  Absence of AUTHENTICATION_PASS therefore establishes neither that a provider
  request occurred nor which operation timed out. Registration cannot start on
  this failure path.

A verified six-second monotonic duration would disagree with the current ten-
and sixty-second production deadlines; current evidence cannot reconcile it.
Unmeasured custody latency reaching the ten-second worker bound, overall lookup/
network/body latency reaching sixty seconds, or an incomplete elapsed estimate
remain possibilities. None establishes missing credentials, denial, provider
401, permission failure, successful reveal, successful probe or a masked-key cause.

## Focused reproduction (fictional data only)

Ran two `python3 -B` inline scripts importing the dormant helper, with no source
edits. Real subprocesses executed only fictional Python code; native keychain,
token-file/environment credential selection and actual HTTPS were not executed.

| Synthetic case through unchanged `_private_worker()` | Result |
| --- | --- |
| Empty child (`pass`), one-second deadline | code 0, zero bytes, 0.018s |
| Fictional stdout child | code 0, nine private bytes, 0.017s |
| Fictional stderr-only child | code 0, zero returned bytes, 0.017s |
| Child reading fictional stdin through EOF | code 0, nine private bytes, 0.016s |
| Child exiting 3 | code 3, zero bytes, 0.017s |
| Child sleeping one second, 0.15s parent deadline | expected constant timeout, 0.152s |
| `_read_keychain()` with worker mocked to absence | constructed 10.000s worker budget; confirmed-absence exception |
| HTTPS worker with connection class replaced by a fictional socket-timeout stub | exit 6, zero bytes, 0.045s; no network |

The simulated socket timeout becomes worker exit 6 and then
`private HTTPS transport failed closed`, a different classification from the real
reported deadline. Existing tests mock successful subprocess seams and deadline
expiry; they do not establish actual native custody or network responsiveness.

## Safe next change for separate approval

Add only value-free constant phase labels and monotonic elapsed duration at the
lookup/reveal/probe boundaries, and distinguish keychain-worker timeout from the
overall retrieval/probe timeout. Preserve every existing cap, no-UI rule,
confirmed-absence-only fallback, fixed endpoint/header boundary, no retry and
same-process secret custody. Do not print raw worker output, credential presence,
values, requests, responses or exception representations. Verify the changed
classification with a fictional delayed worker and injected failing reveal/probe;
the successful private stdin/EOF test above should become a small regression test.

No helper fix or timeout extension is justified as a proven repair yet. Submit any
changed exact helper/orchestration bytes for fresh independent review. The prior
single reveal/probe admission has already been attempted; obtain a newly bounded
admission before any real replay, even for instrumentation. No fallback credential,
provider change, registry acquisition or timeout-relaxation follows from this report.

Read-only source SHA-256:

| File | SHA-256 |
| --- | --- |
| `lease_transport.py` | `bfa43334e4065b33705b1c6192a60e28333c011587f4e421a34802e144111d79` |
| `lease_transport_tests.py` | `19bf5095385aa6ab6ef5c60f2c5e3fab81909b7d303ad0987b1e2898e1a20695` |
| `run_authenticated_registration.py` | `02eefb3348a39d7a6c0a748667d734709927f111b52e0ec754492bed359cb224` |

Scoped preflight passed with expected worktree-location warning. Concurrent dirty
registration packet, CLI scratch and `_AI_INPUTS/` preserved. Only this new report
is committed. No push, provider/OS mutation, helper edit or credential operation.
Stop after the report-only local commit.
