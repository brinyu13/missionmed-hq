# MissionMed Founder Prototype Launch Standard

Status: `PROVISIONAL_LOCAL_STANDARD_CANDIDATE`
Ticket: `MMOS-LAUNCHER-001`
Primary platform: macOS
Adoption boundary: `NOT_CANONICAL`, `NOT_DEPLOYED`, `NOT_PRODUCTION-INTEGRATED`

## Founder contract

A prepared MissionMed Founder-review prototype presents this workflow:

```text
Double-click OPEN_IN_CHROME.command
                 ↓
See calm startup status
                 ↓
Launcher verifies the exact local runtime and dependencies
                 ↓
Launcher starts or safely reuses the one owned prototype server
                 ↓
Launcher waits for the expected application identity
                 ↓
Chrome opens the correct stable URL
```

The Founder is not required to install packages manually, type a terminal command, remember a port, or read technical setup before seeing the prototype.

## Required review-package surface

Every prepared macOS review package must expose these four files at its review root:

- `OPEN_IN_CHROME.command`
- `OPEN_IN_DEFAULT_BROWSER.command`
- `STOP_LOCAL_SERVER.command`
- `README_FIRST.txt`

`README_FIRST.txt` must contain exactly this sentence, with only an optional final newline:

```text
Double-click OPEN_IN_CHROME.command.
```

The three command files are executable, path-relative wrappers. They contain no prototype-specific lifecycle logic. Each delegates to the shared framework using one strict prototype configuration.

Each sealed review package also carries an internal `launcher-integrity.sh` and `LAUNCHER_FRAMEWORK_CHECKSUMS.sha256`. The visible wrappers enter through that small package-local gate, which first verifies the package's `CHECKSUMS.sha256` and then the exact external bootstrap and engine bytes before executing shared lifecycle logic.

## Configuration, not copied logic

A future prototype supplies configuration values for:

- stable unique prototype identity and display name;
- project directory relative to the configuration file;
- fixed loopback port and exact browser URL;
- health-check URL, expected HTTP status, and application identity marker;
- runtime mode and an argv array for the server process, or a static-content root;
- explicit allowed asset extensions for built-in static serving;
- minimum Node version where applicable;
- exact package manager and version;
- lockfile, frozen-install argv, and explicit dependency probes;
- startup, shutdown, and health timing bounds.

Configuration is data. It may not contain a shell command string, `eval`, `sudo`, a production endpoint, a secret, or an instruction to discover and execute an arbitrary repository script.

## Lifecycle standard

### 1. Resolve

The wrapper resolves itself and its configuration from its own filesystem location. Caller working directory is irrelevant. Spaces and ordinary punctuation in parent paths must work.

### 2. Verify the host runtime

The bootstrap uses an already approved local Node runtime. It may search explicit standard installation locations in addition to `PATH`; it does not download or globally install a system runtime. If no compatible runtime exists, it fails closed with one useful message.

This means “one double-click” is a prepared-review-package guarantee, not an unsupported claim that an unprepared clean Mac can bootstrap an unsigned runtime from the internet. A future signed and notarized application bundle may close that distribution gap.

### 3. Verify project dependencies

The launcher checks explicit configured dependency probes. When all probes exist, no install runs. When a probe is missing, the launcher resolves the configured, version-pinned package manager and runs only the configured frozen-lockfile install argv. It never chooses a different lockfile or package manager by inference.

Dependency restoration is registered as an owned process group just like the later server. Interruption, STOP, or timeout cleans up that manager and its descendants before the supervisor exits.

### 4. Establish exclusive ownership

Before starting a server, the launcher establishes one per-user local supervisor channel. Concurrent double-clicks serialize through that channel. An already running owned instance is reused; a second server is not launched.

Supervisor state and logs live in the operating system's per-user application-state directory, outside the prototype and its evidence seal. Directories and state are private to the current user. No bearer credential is written to disk.

On POSIX systems, the live control socket uses a short current-user-owned mode-`0700` directory under `/tmp` so long home paths cannot exceed Unix-socket limits. The socket itself is mode `0600`; state/logs remain in the per-user application-state location.

### 5. Protect the port and origin

The configured port and browser origin are fixed. This preserves origin-bound local review state and prevents a Founder from silently opening the wrong application.

- An owned healthy instance is reused.
- An unowned listener with the expected marker may be recognized for opening, but it is never claimed or stopped.
- Any foreign or ambiguous listener blocks startup with a useful error.
- The launcher never increments to another port and never kills a process merely because it occupies the configured port.

### 6. Start and prove identity

The server is launched with an explicit executable/tool selector and argv array. The launcher streams useful status, records a private local log, and waits until the configured URL returns the configured HTTP status and exact application marker. It opens no browser before that proof succeeds.

If the child exits, health times out, or the returned application identity is wrong, the launcher cleans up its owned child where possible and reports a deterministic failure with the log location.

### 7. Open the browser

`OPEN_IN_CHROME.command` requests Google Chrome. If Chrome is unavailable, it clearly reports the fallback and asks macOS to use the default browser. `OPEN_IN_DEFAULT_BROWSER.command` always asks macOS to use the default browser.

The original launcher remains attached while it owns the server and explains how to stop only that prototype. Duplicate launch invocations may exit after safely reusing the owned instance.

### 8. Stop only what is owned

`STOP_LOCAL_SERVER.command` connects to the same private supervisor channel and requests graceful termination. Only the supervisor that launched the configured prototype may terminate its child process group. A stored PID is diagnostic evidence, never stop authority.

The stop path must never use a port-wide kill, name-wide kill, `pkill`, or a PID from stale state. An external or ambiguous server is left untouched.

## Runtime coverage

| Prototype type | Standard adapter | Requirement |
| --- | --- | --- |
| Plain HTML / static files | Built-in loopback static server | Explicit static root and entry path |
| Vite, React, Vue | Process adapter | Explicit manager/tool and argv; fixed-port behavior |
| Next.js or vinext | Process adapter | Explicit manager/tool and argv; loopback hostname |
| Other Node runtimes | Process adapter | Explicit executable/tool, argv, probes, and health identity |
| Non-Node local runtimes | Process adapter | Approved executable already present; no runtime inference |

Framework names do not grant execution authority. A prototype configuration must name the exact start contract even when its framework is common.

The static adapter additionally requires an extension allowlist, denies dot/private/package/lock/config paths, rejects traversal and symlink escape, and adds local CSP/frame/resource hardening.

## Required validation before Founder handoff

Each integrated prototype must prove, at minimum:

- exact README bytes and executable macOS command modes;
- launch from the wrong working directory and from a path containing spaces;
- no-install path when dependencies exist;
- frozen-install invocation when a configured probe is absent, without uncontrolled network behavior in tests;
- health-before-browser and wrong-marker rejection;
- fixed-port behavior and foreign-listener isolation;
- concurrent launch serialization and owned-instance reuse;
- graceful owned stop without affecting an unrelated server;
- interrupted-launch cleanup where the operating system permits it;
- Chrome request and default-browser fallback behavior;
- private, out-of-package state/log placement;
- package-local digest binding of every external runtime file executed by the wrappers;
- no production endpoint, protected source, credential, or deployment mutation.

Validation must report the platforms actually exercised. Cross-platform-capable code is not the same as a platform validation result.

## Failure language

Messages shown to a Founder are calm, specific, and actionable. They state what did not become ready, confirm that no unrelated server was stopped, identify the local log path when useful, and provide a stable error code for engineering follow-up. Raw stack traces are reserved for the log or an explicitly requested diagnostic mode.

## Windows posture

The shared Node lifecycle may include best-effort Windows path, browser, and local-control behavior, and the template may include `.cmd` entry points. A prototype is not Windows-ready until its own configured server command and the end-to-end launcher have been exercised on Windows. I1Q-4000 remains `WINDOWS_UNVERIFIED` because its current development script contains POSIX inline environment syntax and this task has no Windows execution environment.

## Governance and adoption

This package implements the requested reusable standard candidate without mutating production or MMOS authority files. Organization-wide canonical adoption requires all of the following outside this local implementation ticket:

1. independent review of the final candidate;
2. Founder ratification;
3. an MMOS decision record naming the standard and owner;
4. mission, product, and authority-index integration through the governed MMOS workflow;
5. any separately required signed/notarized distribution decision.

Until those steps occur, the correct outcome is `PROVISIONAL_LOCAL_STANDARD_CANDIDATE`, not “canonical” or “permanent” in the governance sense.
