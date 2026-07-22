# MissionMed Prototype Launcher Framework

Version: `1.0.0`
Status: `PROVISIONAL_LOCAL_STANDARD_CANDIDATE`

This directory contains the one shared lifecycle engine. Prototype packages contribute only a strict `prototype.launch.json` and the thin entry-point files from `templates/`.

## Candidate package layout

```text
from_codex/
├── MMOS_LAUNCHER_001/
│   └── framework/
└── MY_PROTOTYPE/
    ├── OPEN_IN_CHROME.command
    ├── OPEN_IN_DEFAULT_BROWSER.command
    ├── STOP_LOCAL_SERVER.command
    ├── README_FIRST.txt
    ├── prototype.launch.json
    └── prototype/
```

The macOS templates locate the framework through this sibling convention and resolve all other paths from their own location. When this candidate is ratified, MMOS must assign and version the canonical shared installation location before packages outside this layout claim conformance.

Each package also carries the tiny `launcher-integrity.sh` gate and `LAUNCHER_FRAMEWORK_CHECKSUMS.sha256`. The gate verifies the package's own `CHECKSUMS.sha256`, then verifies the external bootstrap and engine before executing them. Lifecycle logic remains solely in the shared engine.

## Commands

The wrappers call `bootstrap.sh`; engineering validation can call it directly:

```text
bootstrap.sh validate-config --config /absolute/path/prototype.launch.json
bootstrap.sh launch --config /absolute/path/prototype.launch.json --browser none
bootstrap.sh status --config /absolute/path/prototype.launch.json
bootstrap.sh stop --config /absolute/path/prototype.launch.json
```

`--browser chrome`, `--browser default`, and `--browser none` are accepted only for `launch`. Founder wrappers use Chrome or the default browser. `none` exists for controlled validation.

## Configuration fields

The parser rejects unknown fields, duplicate JSON keys, non-loopback URLs, project-root escapes, unsupported manager/runtime combinations, credential-like environment keys, and non-frozen dependency restoration.

| Field | Contract |
| --- | --- |
| `schema` | Exactly `missionmed.prototype-launcher` |
| `schemaVersion` | Exactly `1` |
| `frameworkVersion` | Exactly `1.0.0` |
| `prototypeId` | Stable lowercase ID; unique within MissionMed |
| `displayName` | Calm Founder-visible name |
| `projectDirectory` | Existing directory beneath the config directory |
| `port` | Fixed unprivileged loopback port; no fallback |
| `openUrl` | Stable `http://localhost`, `127.0.0.1`, or IPv6-loopback URL on that port |
| `node.minimumVersion` | Complete minimum semantic version |
| `health` | Loopback URL, exact status, body identity marker, and bounded timing |
| `dependencies` | `none`, or a pinned manager/lockfile/probe/frozen-install contract |
| `server` | Built-in `static`, or explicit `process` tool plus argv array |

`server.environment` is an optional map of non-secret, uppercase settings. Credential-like keys are rejected. The child inherits only a small host allowlist such as `PATH`, `HOME`, locale, and temporary-directory settings.

## Runtime recipes

### Vite, React, or Vue

Use `templates/prototype.launch.json`. Keep the Vite command explicit and include `--host 127.0.0.1`, the configured `--port`, and `--strictPort`. Point the probe at the exact local Vite binary.

### Next.js

Use process mode with the pinned project manager. A typical argv is `exec`, `next`, `dev`, `--hostname`, `127.0.0.1`, `--port`, and the fixed port. Select an HTML identity marker that is present only after the intended app is ready.

### vinext

Use process mode with `exec`, `vinext`, `dev`, `--hostname`, `127.0.0.1`, `--port`, and the fixed port. vinext may not expose a strict-port flag; the launcher independently preflights the port, refuses foreign ownership, checks only the configured origin, and cleans up if that origin never proves the expected identity.

### Plain HTML or static assets

Use `templates/static.prototype.launch.json`. The built-in server binds `127.0.0.1`, serves only real files contained by the configured static root, rejects traversal/symlink escape, and uses no dependency manager.

Static configuration must list the exact allowed asset extensions. Dot-path segments, package/lock/config files, and credential-like filenames are denied even when an extension is otherwise allowed. Responses add no-store, no-referrer, same-origin resource policy, MIME sniffing protection, frame denial, and a local-only content policy.

### Other local runtimes

Use process mode with `server.tool` set to `executable` and supply a command name, approved absolute path, or project-contained relative executable plus an argv array. Shell strings, shell interpolation, and runtime discovery are not supported.

## Dependency behavior

- pnpm: `pnpm-lock.yaml` plus `install --frozen-lockfile`
- npm: `package-lock.json` or `npm-shrinkwrap.json` plus `ci`
- Yarn: `yarn.lock` plus an immutable/frozen install

Every configured probe is checked first. No install occurs when all probes exist. A missing probe triggers only the pinned manager and configured frozen argv; the probe must exist afterward or launch fails.

Dependency restoration is itself a registered owned process group. STOP, signal interruption, and timeout target that live in-memory owner and its descendants before the supervisor exits.

## State and stop ownership

macOS state and logs live below `~/Library/Application Support/MissionMed/Launcher/<identity>/`. The identity binds the stable prototype ID to the real project path. The leaf directory is mode `0700`; state and log are mode `0600`.

To stay safely below macOS Unix-socket path limits, the live socket uses `/tmp/missionmed-launcher-<uid>/<identity>.sock`. That per-user control directory is verified as a real current-user-owned directory and forced to mode `0700`; the socket is mode `0600`.

The supervisor generates a one-time stop challenge in memory over the protected live socket. That challenge is returned on the same connection and is never written to state, log, config, or output. The child PID recorded in state is diagnostic only. POSIX termination targets only the in-memory child process group created by that supervisor.

## Distribution limit

The framework searches an approved existing Node runtime; it does not download or globally install Node. Therefore a prepared Founder Mac is validated, while a clean-machine zero-runtime promise requires a later signed/notarized app bundle decision. Windows entry points are best-effort templates and remain unverified in this package.
