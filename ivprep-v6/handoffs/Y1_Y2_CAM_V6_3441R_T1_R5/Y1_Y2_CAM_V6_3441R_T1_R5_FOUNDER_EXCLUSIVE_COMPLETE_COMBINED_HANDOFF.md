# Y1-Y2-CAM-V6-3441R-T1-R5 Founder-exclusive implementation handoff

Status: `ZERO-PROVIDER IMPLEMENTATION READY - PHYSICAL TEST 1 PENDING`.

## Authority and custody

- Founder packet SHA-256:
  `837d18a6b55cd7da4a09672001d6a04d6460089e62aa20b39a7b8984bc293f73`
- Canonical MissionMed OS authority commit:
  `6b33d7c38cfa5b6e18988ab0e29f0f65da7f73c1`
- Product parent:
  `da3e5fec176b6d07ea0d7f01445a2297f5a156a6`
- Maintenance writer: GLOBAL lease
  `80fa9e8d-09b4-4666-9a70-57597af9e2f8`, epoch 40, binding SHA-256
  `abfdae9ef90e8e3af10fd4379c18ff76137ef6fd232d0ac0621c35e48d397e22`.
- Raw lease nonce and coordination credential remained process-memory-only;
  receipt nonce SHA-256:
  `f3058dfa40abf41e83697d2fe86542f8bbf7276d13d65df3be2263673b3b658b`.

## Root cause fixed

The exact Founder command deterministically exited 1 at
`PROVIDER_BINDINGS_UNAVAILABLE`. Four approved bindings existed in the
ignored, mode-0600 `ivprep-v6/.env.local`, while the process carried the
OpenAI binding, but the harness validated only `process.env` and never called
the repository's existing local environment loader.

The harness now loads only that fixed server-side file in live mode, rejects
non-files and group/other-readable permissions, preserves process-environment
precedence, and exposes only fixed failure codes. No credential value is
logged, written, committed, or sent to the browser.

The same command then remained alive and emitted the current verified URL
`http://127.0.0.1:53842/iv-prep-on-call/#room`, with
`PROVIDER_CALLS_AT_STARTUP=0`. Direct HTTP readiness passed before the URL was
printed. Chrome showed Dr Kelly, the exact agent ID, the 45-second limit,
`START LEASE KEEPER`, disabled Authorize/Start, and no provider activation.
The zero-provider acceptance process was then stopped cleanly.

## Worker readiness correction preserved

The direct Profile B worker initializes the pinned LiveKit logger before
constructing `AgentServer` and signals readiness only after the SDK emits
`worker_registered`. Live Start remains disabled and server-denied until that
event. The provider controller checks readiness immediately before dispatch
and before arming the 45-second clock.

## Verification

- focused changed-path matrix: 43/43 pass;
- complete bounded repository matrix excluding the unchanged hanging keeper
  test: 305/305 pass;
- `npm run check`: PASS;
- exact live command to current HTTP 200 and Chrome page: PASS;
- provider calls during debugging/startup: 0;
- LemonSlice sessions: 0;
- LemonSlice credits consumed: 0;
- Test 1 authorization consumed: no;
- Test 2 authorized: no.

The unchanged `test/3441r/t1-durable-lease-keeper.test.mjs` remains excluded
because its third test can subscribe to an already-emitted child `exit` after
observing `LOST`; this transaction does not mislabel `npm test` as green.

## Physical gate

After exact implementation publication and release of the maintenance GLOBAL
writer, relaunch the same command, acquire the visible product keeper to
`READY`, confirm worker-registration and pre-spend controls, and allow exactly
one Founder click sequence. Agent is fixed to
`agent_9bdfc50ec0086043`; model is `gpt-realtime-2.1`; Profile B native speech;
maximum 45 seconds; zero retry/reconnect/recreation. Test 2 remains prohibited.

This handoff is preparation evidence. It must be updated with actual physical
and terminal provider/cost evidence after the one Test 1 lifecycle.
