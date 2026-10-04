# Canonical TTL INSTALL correction independent review

Verdict: **APPROVE WITH CONDITIONS — exact INSTALL wrapper correction only.** Reviewer `/root/phase1_matrix_release_implementation`, independent of wrapper builder `/root/phase1_native_qa_runner`. Source BASE/HEAD `6f1c2c8c8b61226258e0038974f4ead25056a7c9`, 2026-10-04. No self-approval of product implementation or production acceptance.

Reviewed exact changed bytes against frozen BASE:

| File | SHA-256 |
| --- | --- |
| runtime_native_runner.py | a0c89cd028d1dda1f94672a77f71465ec2c42e9a8c488871565b8f2c4e639956 |
| runtime_native_runner_tests.py | 3f142709db0177151ed1d2db8fee9d5c684ac7a373c3e2fe9445e43935b2e8cc |
| RUNTIME_NATIVE_RUNNER_HANDOFF.md | f4f872ed5d3f65a05d9ad595c87844dbd3f204b1393ddd518aa8f520d6e648d2 |

The previous 30-second server start margin was incompatible with the canonical client's validated TTL of at most 30.5 seconds once transport/source checks elapsed. The correction preserves `MANUAL_DISPATCH_MARGIN=30` against the stable admitted session deadline and requires `MANUAL_SERVER_MARGIN=20` against current server expiry. Both checks remain mandatory and reject insufficient budget; the correction does not lengthen canonical TTL, admit a new lease or expand the session deadline. The reviewed operation marker still limits each operation to at most 10 seconds. Canonical client SHA `36e37a487de0ec99191492c3ef286695bc4d8721cdac70f5c62863576e5c1431` and transport SHA `6bab4c948b28202b7a803228f2123d5c95137030f16eb129c427b4ddcc487cad` remain unchanged, including canonical heartbeat validation and RPC surface.

Owned ACTIVE drain now renews the existing handle immediately and subsequently five seconds after completed renewal, under the existing session lock. It requires dispatch closure, INSTALL phase, fresh exact sealed source, unchanged initial fence, unexpired handle before and after source sealing, and the same operation identity still ACTIVE. A same-identity COMPLETE discovered during sealing requires no heartbeat. Renewal writes STATUS STOP only; it cannot reopen dispatch or change the admitted deadline. Closing/joining the ordinary keeper precedes drain; the existing guard2 contract closes a late-registration race before remote dispatch.

Lost observed ACTIVE, foreign/changed identity, UNCERTAIN, malformed marker, expired/fence-drifted handle, source drift or failed renewal defer release without marker cleanup. Only initial absence after dispatch closure or same-identity COMPLETE, with current source/fence/expiry and terminated keeper, permits release. No new remote cancellation, completion or rollback inference was added. Source sealing and synchronous canonical heartbeat consume the finite poll budget and can delay return; this remains cooperative bounded polling, not a total wall-clock or remote rollback guarantee.

Independent focused replay: **16 tests PASS in 4.112 seconds**, exact current tests with `python3 -B runtime_native_runner_tests.py Fixtures.<selected-test> ...`. Selected tests cover the three new TTL/drain cases; actual delayed completion; UNCERTAIN/invalid/ACTIVE timeout; marker schema/identity drift; actual ACTIVE unlink; closing keeper; stable deadline/start margins; current guard/failure marker; expiry/fence/source renewal drift; receipt failures/privacy; both AUTH blocks; and actual unpatched 35-input fullref candidate snapshot. TTL fixtures use actual wrapper logic with mock canonical 30-second handles: 25 seconds server remaining passes, 19/9/expired fails, and 29 seconds session remaining fails. Delayed drain holds STOP throughout repeated same-fence renewals and releases only after COMPLETE. Five failed-renewal/drift modes defer without revival/release. These are local mocks/fixtures; no actual transport or runtime operation occurred. Both Python files compile without writing bytecode. No broad suite or product rebuild/repack was performed.

Required execution conditions:

- Separately qualified helper must use both named session/server margins and pin these exact runner bytes. The old helper's duplicated 30-second server check remains blocked; this wrapper review does not approve the forthcoming helper edit.
- Foreman must freeze new custody HEAD/spec with current helper, plan and independent qualification hashes, then obtain fresh distinct implementation/read controls and a new control directory for attempt 2. Consumed attempt-1 controls/read marker remain immutable and cannot authorize changed bytes or another claim.
- Use only exact INSTALL PATH ownership plus MATRIX-SHELL, fresh canonical readiness, current fences/preimages and guarded operations. Unknown completion/deferred release requires Foreman's actual reconciliation; no automatic new claim or cleanup is admitted.
- AUTH remains unconditionally blocked before controls or protected capabilities. Independent account/native acceptance, live readback and final production approval remain separate.

Foreman attributes attempt-1 independent release/clear evidence to report `f1c307...`: IR0/pending0/Matrix0, all 15 shared bytes equal and three activation paths ABSENT; unrelated IIQ AUTH claim remains a separate current condition, never borrowed or overridden. This reviewer made no new provider/SSH/readback observation and does not promote that abbreviated supplied report identifier into a verified full digest.

Only this review report was written, uncommitted. No provider, credentials, SSH, runtime, source change, stage, commit, HEAD, deployment or native identity operation. **STOP for Foreman custody and separately independent helper qualification.**
