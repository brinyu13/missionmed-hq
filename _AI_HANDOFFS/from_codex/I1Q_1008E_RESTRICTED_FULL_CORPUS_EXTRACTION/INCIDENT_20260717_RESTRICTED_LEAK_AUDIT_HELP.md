# Execution incident: leakage-audit help invocation

Status: contained and dispositioned

Recorded: 2026-07-17T18:08:42Z

## Event

During finalizer-gate verification, `restricted-leak-audit.mjs --help` was invoked with the expectation of usage output. The command-line entry point did not implement help handling and treated every mode other than `--dry-run` as a live read-only audit. The operator detected the unexpected behavior and terminated the process before completion.

## Scope and evidence

- The invocation was inside the already approved I1Q-1008E restricted boundary and performed read-only access.
- Source inspection confirmed that the live audit reads the acquisition state and protected raw corpus, scans the Git-safe handoff, and can write only the Git-safe leakage evidence file.
- No extraction, finalizer, rotation, or production mutation process was active after containment.
- No protected-boundary files were modified in the incident window.
- The existing Git-safe leakage evidence file retained its prior modification time of `2026-07-17T14:05:24-0400`; no temporary leakage-audit file remained.
- No raw content, locator, speaker identity, credential, or other protected value was emitted into this record.

## Root cause and repair

The CLI had an unsafe default argument parser: it recognized only `--dry-run` and silently interpreted `--help` as live mode. The entry point now implements explicit zero-I/O `--help`/`-h` handling, rejects unsupported or mixed arguments, and has a focused regression test proving the help response declares zero protected reads, network requests, and file writes.

## Supervisor disposition

The incident did not expand authority, alter protected state, or invalidate the existing acquisition/extraction evidence. It is therefore a contained, non-mutating verification incident rather than an external blocker. Live rotation remains prohibited until the independent finalizer and final dependency-closed rotation audits pass. Execution may resume from that verification gate.
