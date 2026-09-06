# I1Q-1007X Drills Adapter

## Verdict

`LOCAL_CONTRACT_PASS, CONSUMER INTEGRATION OFF`

The versioned Drills adapter now represents playback, nodes, transcript, and VTT availability independently and fails closed on rights, privacy, source lineage, or timestamp defects. It does not modify the Drills registry, Daily Rounds registry, ingestion pipeline, media objects, or protected runtime.

## Adapter Contract

Each projected row requires:

- contract version and release ID
- immutable Item Revision ID
- stable video and source-record IDs
- internal title, prompt, and concept ID
- playback availability plus URL or Stream ID when available
- nodes availability plus URL when available
- transcript availability plus URL only when available
- VTT availability plus URL only when available
- timestamp start and end
- cleared internal rights state
- passing privacy state
- source and working SHA-256 hashes

Availability values are explicit: `available`, `missing`, `restricted`, `invalid`, or `unknown`. A missing transcript or VTT may be represented explicitly. Playback and nodes are required for the current Drills remediation projection. An unavailable artifact may not hide a location.

## Consumer Compatibility

The existing Daily Rounds registry contract still requires nonempty `video_id`, `title`, `playback_url`, `nodes_url`, and `transcript_url`. The adapter validates that current five-field source contract separately.

The protected Drills runtime permits explicit transcript absence while requiring playback and nodes. This difference is preserved rather than silently normalized away. I1Q may eventually publish a read-only sidecar or versioned projection after the Drills owner resolves the canonical registry path.

No source availability is inferred. In particular, transcript JSON does not imply a VTT. The real inventory observed 97 transcript JSON files and 97 nodes JSON files, but zero separately verified VTT artifacts.

## Verification

The 34-test adapter suite includes:

- explicit missing transcript and unknown VTT success
- absent transcript or VTT state failure
- hidden location on unavailable asset failure
- unavailable playback failure
- unavailable nodes failure
- rights and privacy failure
- invalid source or working hash failure
- timestamp linkage checks
- current Daily required-field checks

All 34 tests passed, including every Drills transformation vector.

## Current Real-Corpus Gate

All 97 sources remain blocked from extraction. The adapter requires a privacy-safe working hash and passing privacy record, neither of which exists for the real corpus. Public excerpt and clip rights remain closed.

The adapter therefore cannot be used to move raw transcript data or unreviewed candidates into Drills.

## Protected Runtime Gates

| Gate | Status |
| --- | --- |
| Adapter contract tests | PASS |
| Explicit availability semantics | PASS |
| Source mutation | NONE |
| Drills ingestion mutation | NONE |
| Drills owner path ruling | OPEN |
| Real privacy-safe working source | NONE |
| Protected Drills checksum parity | BLOCKED, tracked and deployed sources diverge |
| Daily Rounds end-to-end contract | NOT RUN |
| Drills owner certification | NOT OBTAINED |
| `drills_adapter_enabled` | OFF |

## Files

- `i1q-question-platform/src/adapters/drills-v1.mjs`
- `i1q-question-platform/src/contracts.mjs`
- `i1q-question-platform/src/exports.mjs`
- `i1q-question-platform/tests/adapters-security.test.mjs`

## Conclusion

The local Drills boundary is explicit and fail-closed. Consumer activation remains prohibited until privacy, source ownership, runtime parity, and end-to-end protected-system gates pass.
