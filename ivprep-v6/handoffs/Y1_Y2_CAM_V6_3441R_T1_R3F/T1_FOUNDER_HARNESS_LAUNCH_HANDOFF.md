# Y1-Y2-CAM-V6-3441R-T1-R3F Founder harness launch handoff

Status at evidence freeze: `ZERO_PROVIDER LAUNCH ACCEPTANCE PASS - PUBLICATION PENDING`.

## Outcome

The exact Founder launch path now survives startup, emits one authoritative
loopback URL, serves HTTP 200 in Chrome, and reaches the durable keeper's
`READY` state without Authorize or Start. No provider session or paid action
occurred.

## Root cause and correction

The accepted R3 launcher reached LiveKit coordinator initialization while the
repository had no `node_modules`, so pinned `livekit-server-sdk@2.17.0` could
not resolve. The launcher then caught and suppressed the startup error and
exited 1 without a URL or explanation.

R3F adds one bounded locked-graph bootstrap when that exact dependency is
absent. It runs `npm ci --ignore-scripts --no-audit --no-fund --loglevel=error`
from the product root with a minimal environment, ignores child output, and
excludes all provider and lease bindings. An initial repair used both npm
`userconfig` and `globalconfig` at `/dev/null`; npm rejects that combination.
The final code retains only isolated `userconfig=/dev/null` and the exact
public npm registry. Package and lockfile bytes are unchanged.

All startup failures now emit only:

```text
FOUNDER HARNESS START FAILED
REASON:
<fixed non-secret classification>
```

The live Profile B worker is no longer spawned at page startup. It remains
behind the explicit authenticated Founder Authorize POST. Page load, HTTP
verification, and keeper stabilization therefore create zero provider calls.

## Exact changed paths

1. `ivprep-v6/ALLOWED_PATHS_3440.txt`
2. `ivprep-v6/ALLOWED_PATHS_3441R.txt`
3. `ivprep-v6/scripts/3441r/start-founder-proof-harness.mjs`
4. `ivprep-v6/test/3441r/founder-proof-runtime.test.mjs`
5. `ivprep-v6/handoffs/Y1_Y2_CAM_V6_3441R_T1_R3F/T1_FOUNDER_HARNESS_LAUNCH_HANDOFF.md`
6. `ivprep-v6/handoffs/Y1_Y2_CAM_V6_3441R_T1_R3F/T1_FOUNDER_HARNESS_LAUNCH_EVIDENCE.json`

## Validation

- Syntax: PASS.
- Focused runtime/UI/keeper matrix: 22 total, 22 pass, 0 fail, 0 cancelled,
  0 skipped; 42.068 seconds.
- Full synthetic stability case: 40 seconds and at least 8 heartbeats: PASS.
- Dependency-absent one-command bootstrap: PASS.
- Exact page HTTP response: 200.
- Chrome target: Dr Kelly, `START LEASE KEEPER`, and disabled paid controls
  were visible before keeper acquisition.
- Real product keeper: `READY` at receipt with 11 heartbeats and 60 seconds
  stable.
- Authorization state: `NOT AUTHORIZED`; Authorize not clicked; Start not
  clicked.
- Harness shutdown: exit 0 and runtime lease released.

The accepted prior Founder-shell checkpoint established presence of all five
provider bindings. This zero-provider acceptance did not reopen credential
provisioning: it used inert non-secret presence bindings because the fresh
Codex process did not retain four bindings. No credential value was read,
printed, persisted, or sent to the browser.

## Founder launch command after publication

```bash
cd /Users/brianb/MissionMed_worktrees/Y1-Y2-CAM-V6-3440/ivprep-v6

IVPREP_FOUNDER_TEST1_LIVE_ENABLED=true \
npm run start:3441r-t1-r3 -- --live-test-1
```

Expected URL shape:

```text
LOCAL_FOUNDER_PROOF_URL=http://127.0.0.1:<CURRENT_PORT>/iv-prep-on-call/#room
```

The current port is authoritative only for the running process. The launcher
must remain open while Chrome uses that URL.

## Spend and authorization truth

- Provider sessions created: 0.
- LemonSlice sessions created: 0.
- OpenAI Realtime sessions created: 0.
- LiveKit paid test rooms created: 0.
- LemonSlice credits consumed: 0.
- Existing Founder Test #1 authorization: unconsumed.

This transaction does not authorize the paid test, any deployment, production,
database, canary, student, model, agent, or voice change.
