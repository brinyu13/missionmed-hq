# MMOS-LAUNCHER-001 Validation Report

Date: 2026-07-22
Environment exercised: macOS 26.4.1, Apple silicon (`arm64`), Node 24.14.0
Engineering result: `PASS — PREPARED-MAC LOCAL STANDARD CANDIDATE`
Adoption result: `PROVISIONAL_LOCAL_STANDARD_CANDIDATE`, `NOT_CANONICAL`
Release result: `NOT_DEPLOYED`, `NOT_PRODUCTION-INTEGRATED`

## Deterministic framework suite

Executed from the repository root against the shared engine:

```text
node --check framework/missionmed-prototype-launcher.mjs
node --test framework/tests/*.test.mjs
```

Result: PASS, 8/8.

The suite proves:

- duplicate JSON-key rejection and unknown-field/path-escape rejection;
- launch from the wrong working directory with a configuration path containing spaces;
- private supervisor claim, owned-instance status, duplicate launch reuse, and authenticated owned stop;
- foreign fixed-port refusal without terminating or altering the foreign HTTP server;
- wrong health marker timeout followed by cleanup of the launcher-owned server;
- one exact fake `pnpm 11.9.0 install --frozen-lockfile` invocation when a configured probe is absent;
- `SIGTERM` interruption cleanup and release of the owned static listener.
- `SIGTERM` during a deliberately slow dependency restoration, proving both the fake manager and its descendant process are gone before supervisor exit.

The deterministic dependency test uses an isolated fake manager and temporary lockfile. It does not contact a registry or mutate a real project dependency tree.

## Live I1Q-4000 integration

The final I1Q configuration was validated as identity `92daa27f472b24231757106b` and exercised against the actual vinext application.

Observed sequence:

1. launcher resolved the project from its configuration rather than caller cwd;
2. Node minimum `22.13.0` and exact `pnpm 11.9.0` passed;
3. configured `node_modules/.bin/vinext` probe existed, so no install ran;
4. launcher started its own process group and vinext bound `127.0.0.1:3000`;
5. `http://localhost:3000/` returned HTTP 200 and the exact marker `MissionMed Learning Studio · P4 Prototype`;
6. `OPEN_IN_CHROME.command`, invoked from `/tmp`, reused the active owner without starting a second server and made `http://localhost:3000/` the active Chrome tab;
7. `OPEN_IN_DEFAULT_BROWSER.command`, also invoked from `/tmp`, returned success with the correct stable page active under the configured macOS default handler;
8. `STOP_LOCAL_SERVER.command` completed the in-memory challenge handshake, terminated only the owned process group, removed state/control artifacts, and released port 3000.

No listener or launcher process remained on port 3000 after stop. The private diagnostic log remained outside the package.

## Runtime-state permissions

Observed while I1Q was ready:

```text
drwx------  ~/Library/Application Support/MissionMed/Launcher/92daa27f472b24231757106b
-rw-------  state.json
-rw-------  launcher.log
drwx------  /tmp/missionmed-launcher-501
srw-------  /tmp/missionmed-launcher-501/92daa27f472b24231757106b.sock
```

The state file contains identity, path, phase, timestamps, and diagnostic PIDs. It contains no stop challenge, bearer credential, environment map, or protected value. The one-time challenge exists only in supervisor memory and on the already protected live socket connection.

After owned stop, `state.json` and the short-path control socket were absent; only the mode-`0600` diagnostic log remained.

## I1Q regression validation

Executed from the unchanged prototype source directory after launcher integration:

```text
pnpm run test
pnpm run lint
pnpm exec tsc --noEmit --incremental false
```

Results:

- optimized vinext build: PASS;
- application tests: PASS, 9/9;
- ESLint: PASS;
- TypeScript no-emit: PASS.

The launcher integration changes review entry points, configuration, documentation, and seal validation; it does not change the Learning Studio application source or synthetic fixtures.

## Safety and isolation checks

- strict config accepts loopback HTTP only;
- project, static-root, and relative executable containment are enforced;
- process execution uses explicit argv arrays with `shell: false`;
- child environment is allowlisted and credential-like configured keys are rejected;
- package-local SHA-256 binding verifies the exact sibling bootstrap and engine before I1Q executes either file;
- pnpm requires `pnpm-lock.yaml` plus `install --frozen-lockfile`; npm requires a lock plus `ci`; Yarn requires a lock plus immutable/frozen install;
- fixed ports never auto-migrate at launcher level;
- health-marker match can recognize an external instance but never grants stop ownership;
- state PID and port presence never grant stop authority;
- POSIX TERM/KILL can target only the in-memory process group created by the live supervisor;
- no server binds `0.0.0.0` through the built-in adapter;
- static serving requires explicit asset extensions, denies dot/private/package/lock/config paths, and applies CSP/frame/resource hardening;
- no deployment, production endpoint, protected source, learner data, telemetry, secret, or global package install is introduced.

## Founder-experience checks

- I1Q and template `README_FIRST.txt` bytes equal `Double-click OPEN_IN_CHROME.command.\n`;
- all macOS `.command` files have executable mode;
- wrappers resolve their own location and work from a different cwd;
- startup status is plain-language and browser opening follows health proof;
- duplicate launch says no duplicate server was launched;
- STOP says no unrelated development server was affected;
- failures expose stable `MMPL-*` codes and preserve a private log path where available.

## Independent review status

- Herschel: existing launch patterns mapped; no prior `.command` standard existed, and repository-root script inference was rejected as unsafe.
- Lorentz/Turing: ownership/control architecture and failure matrix informed the protected socket, fixed-port, exact-health, and never-kill-by-port design.
- Miyamoto/Vitruvius: Founder/cross-platform acceptance checklist applied; macOS prepared-review path accepted, Windows and clean-machine distribution claims withheld.
- Sentinel/Sagan: initial PARTIAL identified unowned dependency-install interruption, unbound sibling runtime bytes, unsafe static disclosure scope, Node selection, socket-path, bounded-close, socket-error, and probe-coverage gaps. After repair, the independent delta review returned PASS with 8/8 isolated tests, 67-artifact I1Q validation, matching framework ledgers, and no remaining macOS release-significant issue. Windows remains explicitly unverified.

## Final integrity validation

- reusable-standard seal: PASS, 25 artifacts and 25 matching SHA-256 entries;
- reusable-standard validator: PASS, including syntax, 8/8 isolated tests, template binding, and I1Q configuration/binding;
- I1Q reseal: PASS, 67 artifacts and 67 matching SHA-256 entries;
- I1Q package validator: PASS, including all 21 distinct PNG scenarios and five available lineage hashes;
- package-root integrity gate: PASS for both the local I1Q ledger and the two exact external runtime bytes.

## Explicit limitations

- a clean Mac with no compatible Node runtime is not zero-setup; the bootstrap fails closed instead of downloading or globally installing a runtime;
- Chrome-unavailable fallback is implemented but was not live-tested by removing Chrome from this Mac;
- Gatekeeper/quarantine behavior, Intel macOS, signed/notarized distribution, power-loss/SIGKILL orphan recovery, and a clean-machine dependency download were not exercised;
- Windows `.cmd`, named-pipe, package-manager, process-tree shutdown, and I1Q runtime behavior are `WINDOWS_UNVERIFIED`;
- shell syntax passed `sh -n`; `shellcheck` was unavailable in the current environment;
- canonical/permanent governance adoption is not established by local code or green tests.

Validation verdict: the candidate meets the requested one-double-click Founder workflow on the prepared Apple-silicon Mac exercised here and preserves strict local ownership/safety boundaries. Wider distribution and canonical adoption remain separate gates.
