# PSV Application-Eve Guarded Deployment Report

Date: 2026-09-22

## Outcome

PSV v1.3.1 is live from exact pushed commit `dab3ec09fc3ae129649b7ad7b34d3763d441f408` under canonical DR-334. The Application-Eve release adds the governed ROOT-template, authenticated RISE bulk-personalization, approved-statement library/export and two-phase ERAS assignment preparation workflow. Stage A remains available. Stage B automatic return and broad RISE auto-admission remain off.

Production data was not changed by this deployment. Existing PSV roots, runs, library documents, prompts, research records and audit records were preserved exactly.

## Authority and source custody

- MissionMed OS: `7d454fce3dcb44bd7505cfb0f33b6b3a894dba42`
- Decision: `DR-334`
- Source branch: `codex/psv-prototype-foreman`
- Application-Eve source: `6e7ef4b3f19dcec51ff425c3fc1ebc5771293bf8`
- Production Guardian fix-forward: `dab3ec09fc3ae129649b7ad7b34d3763d441f408`
- Git source equals pushed origin: PASS
- Release ZIP SHA-256: `0b0f5160165063dfe8e3e2263bd7b14e570b57b24453083d146b7e3212fa23aa`
- Release manifest SHA-256: `2837bf2220efa5728680a994052d734565f20fd3aeaf1f29a5ab9f91495274e7`
- Private package: `/www/theresidencyacademy_209/private/psv-deploy-dab3ec0-1.3.1/`
- Live custody: exact 28/28 files, no missing or extra file
- Production PHP lint: 25/25 PASS on PHP 8.2.29

## Application-Eve capability

- One exact standalone `***` marker pair establishes one authorized Program Answer region. Marker paragraphs are removed before private ROOT storage; missing, multiple or ambiguous pairs fail closed.
- `[Program Paragraph Here]` creates a full-paragraph blank template. A semantic bracketed paragraph creates a slotted template whose authored architecture is preserved.
- Complete ROOT context is available to the writer, but only the authorized region may change. Finished output blocks marker/bracket leakage, em dashes, unsupported facts and configured AI-smell phrases.
- Authenticated RISE import is owner scoped. Gold, priority 1–25 Silver, missing and ambiguous program identities are excluded from unattended Bulk Rush. Full Paragraph defaults to one recommended candidate; five alternatives remain available on demand. Top 3 Reasons is deterministic and retains fact IDs/provenance without a provider call.
- Batch processing is durable, resumable and bounded to 150 programs, two concurrent workers, idempotent provider work, three attempts and a daily provider ceiling. Partial failure does not erase completed work; selective regeneration retains approved output.
- The library supports deterministic body-only DOCX/TXT, selected ZIP, Download All ZIP, version/status metadata and a canonical ERAS JSON manifest.
- ERAS assignment is `PREPARE_THEN_EXPLICIT_CONFIRMATION`. MyERAS identities remain unresolved until explicitly matched. Assignment missions prohibit Apply, Pay, Certify, Submit, Withdraw, Signal and Message.

## Production Guardian fix-forward

Authenticated live acceptance found that a ROOT change could leave a historical batch visually attached to stale client context, and a pre-DR-334 priority batch still displayed a bulk-approval control. v1.3.1:

- clears batch state whenever a ROOT is adopted;
- reopens every historical batch with its exact owner-scoped ROOT;
- suppresses unattended bulk approval unless a ready, unapproved item is non-Gold with an explicit priority greater than 25; and
- applies the same fail-closed rule server-side, including to historical rows.

The live historical batch now reopens with `SYNTHETIC TEST ROOT A`; priority #1–5 rows remain individually reviewable and approved history is preserved, while the bulk-approval control is absent.

## Verification

- All tracked PHP contract/runtime suites: PASS
- Disposable WordPress/API acceptance: 130/130 PASS
- Focused Application-Eve browser acceptance: 24/24 PASS
- Candidate-review browser acceptance: 41/41 PASS
- ROOT upload/session browser acceptance: 6/6 PASS
- PSV Admin browser acceptance: 10/10 PASS
- JavaScript syntax, PHP lint and `git diff --check`: PASS
- Authenticated production PSV home, batch and library: PASS
- Public home and PSV flag: HTTP 200
- Anonymous bootstrap and Stage B return: HTTP 404
- RISE: `ok=true`, `environment=production`, `sourceRightsCurrent=true`, registry `rise_registry_acgme_2026-09-20_50d08ea6f2da`
- Current File Vault hashes remain unchanged: controller `e60b2695…`, repository `a9784255…`, scanner `6b5cf0eb…`, JS `3f9f0152…`, CSS `87c932a3…`
- No new PSV fatal/inert production log entry was observed. The only browser-console errors were three pre-existing WooCommerce checkout dependency warnings timestamped before this release and unrelated to PSV.

## Privacy and state delta

Boolean-only production verification proved:

- dedicated PSV OpenAI credential: defined and nonempty;
- Stage A mission-signing key: defined and nonempty;
- Stage B return key: absent;
- Stage B auto-return: off;
- `MMED_PS_PROTO_ALLOW_REAL_ROOT_AI`: undefined;
- testing flags: undefined;
- PSV access: `members`;
- Deep Research Boost: `members`;
- schema: `8`.

No credential value was printed, inspected, hashed, copied or recorded.

Before and after counts match exactly: roots 8, runs 34, library 9, audit 98, jobs 1, job items 5, provider attempts 54, research artifacts 2, research missions 2, prompt versions 6, similarity fingerprints 9, similarity buckets 576 and edit revisions 2.

## Lease recovery and rollback truth

PATH epoch 3641 expired during private-package staging before the intended guarded window completed. The first exact swap therefore occurred after that lease expiry. The Foreman immediately treated the custody window as unsealed, acquired fresh exact-path epoch 3642, and atomically re-adopted the same exact v1.3.1 package at `2026-09-22T11:07:14Z`, inside epoch 3642's `2026-09-22T11:07:27Z` expiry. Release acknowledgement arrived after TTL and returned false; authoritative provider readback is zero active global and zero active PSV-path leases.

- Previous live v1.3.0 rollback: `/www/theresidencyacademy_209/private/psv-rollbacks/PSV-1.3.1-dab3ec0-20260922T110627Z/live-retired`
- Exact v1.3.1 pre-readoption image: `/www/theresidencyacademy_209/private/psv-rollbacks/PSV-1.3.1-dab3ec0-20260922T110714Z-readopt/unleased-preimage`

Fresh independent read-only verification returned **PASS** with no P0/P1 findings. It independently matched authority, pushed source, exact live custody, focused API/UI gates, all production counts, all five File Vault sentinels, current RISE health/source rights, public and anonymous route boundaries, severe/MMPS logs, rollback custody and authoritative zero active leases. It read back epochs 3641/3642 and confirmed the exact readoption rollback directory mtime `2026-09-22T11:07:14.116993552Z` falls inside epoch 3642's valid interval. One P2 remains outside PSV: an unrelated WordPress Core `user-profile.min.js` login-page error; all PSV UI assertions passed.

## MyERAS boundary

Read-only reconnaissance established the current 2027 Residency workflow: Saved Programs exposes program/accreditation identity and Assign Documents; Personal Statements supports title/editor/preview/save; the checklist and assignment report expose assignment state. No MyERAS statement, program, assignment, signal, application, message or payment was created or changed. PSV prepares the canonical manifest and guarded assignment mission only; execution still requires explicit confirmation in the actual MyERAS account.
