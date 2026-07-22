# MMOS-LAUNCHER-001 Complete Combined Handoff

## Executive outcome

The reusable MissionMed Founder Prototype Launcher and its immediate I1Q-4000 integration are complete and locally validated on the prepared Founder Mac.

Engineering verdict: `PASS — PREPARED-MAC LOCAL STANDARD CANDIDATE`
Governance verdict: `PROVISIONAL_LOCAL_STANDARD_CANDIDATE`, `NOT_CANONICAL`
Runtime verdict: `NOT_DEPLOYED`, `NOT_PRODUCTION-INTEGRATED`
Windows verdict: `WINDOWS_UNVERIFIED`

The requested permanent behavior is implemented as one shared, versioned engine plus strict per-prototype configuration. Permanent/canonical organization-wide status cannot be manufactured by this code change; it still requires the MMOS adoption gates below.

## Founder start

For I1Q-4000, double-click:

```text
OPEN_IN_CHROME.command
```

The review sequence is now:

```text
Double-click → wait for identity check → Chrome opens → prototype is running
```

Use `STOP_LOCAL_SERVER.command` when finished. It stops only a server owned by this launcher's live private supervisor.

## Deliverables

- standard candidate: `MISSIONMED_PROTOTYPE_LAUNCH_STANDARD.md`
- authority/boundary receipt: `MMOS-LAUNCHER-001_AUTHORITY_AND_BOUNDARY_RECEIPT.md`
- shared implementation and technical guide: `framework/missionmed-prototype-launcher.mjs` and `framework/README.md`
- macOS and best-effort Windows entry-point templates: `framework/templates/`
- Vite/process and static configuration templates: `framework/templates/prototype.launch.json` and `framework/templates/static.prototype.launch.json`
- deterministic tests: `framework/tests/launcher.test.mjs`
- validation: `MMOS-LAUNCHER-001_VALIDATION_REPORT.md`
- artifact inventory and integrity ledger: `ARTIFACT_MANIFEST.json` and `CHECKSUMS.sha256`
- package seal/validator: `tools/seal-package.mjs` and `tools/validate-package.mjs`

I1Q-4000 now contains:

- `OPEN_IN_CHROME.command`
- `OPEN_IN_DEFAULT_BROWSER.command`
- `STOP_LOCAL_SERVER.command`
- `README_FIRST.txt`, with exactly the one required sentence
- `prototype.launch.json`
- `launcher-integrity.sh` and `LAUNCHER_FRAMEWORK_CHECKSUMS.sha256`, sealed locally to verify the I1Q package ledger and hash-bind the shared executable bytes
- updated combined handoff, prototype README, seal roles, and package validation.

## Architecture delivered

One Node standard-library engine owns dependency probing, frozen restoration, fixed-port protection, process/static serving, health proof, browser opening, duplicate reuse, private state/logs, and graceful owned stop. Thin platform entry points hold no lifecycle implementation.

The configuration parser is fail-closed:

- exact schema/framework version;
- duplicate and unknown key rejection;
- package-contained paths;
- loopback-only URLs;
- fixed port and exact health identity;
- explicit executable/tool and argv, never a shell command string;
- pinned package manager, lockfile, probes, and frozen/immutable install;
- credential-like environment-key rejection.

On macOS, each real project path plus stable prototype ID derives a private runtime identity. State/logs use the mode-`0700` MissionMed application-state leaf. A short mode-`0700` current-user control directory under `/tmp` avoids Unix-socket path limits; its socket is mode `0600` and carries a live one-time stop challenge. The challenge never enters a file or log. A PID is diagnostic only; it is never sufficient stop authority.

## I1Q-4000 binding

| Value | Final contract |
| --- | --- |
| Project | `prototype/` |
| Browser origin | `http://localhost:3000/` |
| Bind target | `127.0.0.1:3000` |
| Identity marker | `MissionMed Learning Studio · P4 Prototype` |
| Node | `>=22.13.0` |
| Manager | exact `pnpm 11.9.0` |
| Lock | `pnpm-lock.yaml` |
| Install | only if probe absent; `install --frozen-lockfile` |
| Probe | `node_modules/.bin/vinext` |
| Server argv | explicit `pnpm exec vinext dev --port 3000 --hostname 127.0.0.1` |

The `localhost` browser origin is intentionally preserved because Founder notes and synthetic review state are browser-origin scoped.

## Validation summary

- framework syntax: PASS;
- deterministic launcher suite: PASS, 8/8;
- I1Q real-process double-click flow: PASS;
- Chrome exact-page opening: PASS;
- duplicate owned reuse: PASS;
- default-browser wrapper: PASS on the configured Mac default handler;
- state directory/file/socket/log modes: PASS (`0700`/`0600`);
- owned process-group stop and port release: PASS;
- I1Q optimized build: PASS;
- I1Q application tests: PASS, 9/9;
- I1Q ESLint and TypeScript: PASS;
- package seals and validators: PASS;
- reusable-standard seal: 25 artifacts; I1Q reseal: 67 artifacts;
- deployment/production mutation: none;
- Windows validation: not performed.

See `MMOS-LAUNCHER-001_VALIDATION_REPORT.md` for the exercised matrix and explicit limits.

## Safety outcome

The launcher does not auto-detect a repository framework or run a repository-root script by inference. It does not use `eval`, `sudo`, a shell command string, a global install, a port-wide kill, `pkill`, or `killall`. It never stops a marker-matching external service; marker match permits opening only. It carries no production endpoint, protected data, authentication material, deployment action, or learner-facing mutation.

The Sites-compatible files already present in I1Q remain local build scaffolding. In accordance with the Sites hosting boundary, this task created no deployment or hosting version.

## Platform posture

The exercised result is a prepared Apple-silicon Mac. The framework can fail usefully when Node is absent and includes best-effort Windows entry points/control paths, but no clean-machine, Intel, Gatekeeper, notarization, or Windows certification is claimed. I1Q's preexisting package script also contains POSIX inline environment syntax, reinforcing the `WINDOWS_UNVERIFIED` classification.

## Canonical adoption gate

To make this candidate the permanent MissionMed standard in the governance sense, a separate authorized workflow must:

1. independently accept the final package;
2. record Founder ratification;
3. create or ratify the MMOS decision record and standard owner;
4. integrate the decision through missions, product routing, and the authority index;
5. establish the canonical shared installation/distribution location;
6. decide whether a signed/notarized app bundle with a bundled runtime is required for clean-Mac zero setup.

Until then, future local prototypes in this repository may reuse the candidate by configuration, but must not label it canonical or production-authorized.

## Rollback

Run the I1Q `STOP_LOCAL_SERVER.command` if its owner is active, then revert the MMOS-LAUNCHER-001 commit. The prior technical `pnpm` workflow remains available inside I1Q's `prototype/` directory, and no production or remote runtime requires rollback.
