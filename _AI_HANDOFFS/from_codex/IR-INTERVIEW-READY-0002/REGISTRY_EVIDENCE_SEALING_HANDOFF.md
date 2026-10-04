# Registry evidence sealing handoff

Implemented a local R2 evidence correction only. Source HEAD on entry was `51457e6e73c73d9b9216c4b6f8cf4e4860e06e30`: the requested `53832d2` staged HOLD followed by the independent provider-clear report. Foreman confirmed that progression. No application, transport, canonical registrar/client or OS source was changed; no credential/provider operation, canonical staging, cleanup, commit/push or deployment was performed by this correction worker. Only the four authorized local files are included in the scoped local correction commit; no push is authorized here.

Foreman supplied fresh universal BOOT PASS at OS primary `1e8374664751ad911280d83d8c60e200a224245d` and HQ `0feee579b0a9f2c90529220899f6cf6d21b8cd05`, accepted immutable MR-079 SHA256 `9638e67841e98b278244c0d4f9ecd0ccbdc7a9e17c50a67dd45d1d31895a0357`; normal registrar later refreshed the old clone to `95a188b9cc30655b374f580775e7dc77be6d7f7a` and the staged IR mission profile independently passed. These are received custody/BOOT evidence, not repeated by this worker. The old process printed `REGISTRY_RELEASED_AFTER_STOP`, exit 1. Its independent provider-clear is a separate report, not a release assertion generated here.

## Immutable evidence correction

Before any actual retrieval/probe, the wrapper requires all five R2 control/receipt paths to be absent and captures hashes for the three existing code files plus the complete master review, current packet and Matrix lineage document. It rechecks those six sources before reading credentials, after the actual authentication probe, while waiting for independent normal admission, and before handing control to the registrar. No edit of any of those six files is admitted after initial capture in that process.

After `AUTHENTICATION_PASS`, the independent reviewer writes a new `NORMAL_REGISTRY_ADMISSION_REVIEW_R2.md`, then `REGISTRY_ADMISSION_APPROVAL_R2.json`. Both must have modification times after authentication completion, and neither may have existed before it. The JSON binds the six initial source hashes and the separate normal-report digest. The report need not bind its own hash, avoiding self-reference. Writing the report atomically before the JSON is the reviewer publication order; a missing/incomplete/mismatched file stops without Registry acquisition.

The wrapper and registrar validate snapshots from a single opened-file byte read per capture. `EvidenceSnapshot.data` is immutable bytes; both SHA256 and decoded copied text derive from those bytes. The registrar verifies the exact five evidence hashes supplied by the wrapper, the exact six initial hashes, independent verdict/identity/schema and the separate normal-report digest before canonical import/refresh/acquisition. It rechecks current source/evidence digests before client construction, immediately before normal `begin`, inside guarded candidate generation, after staging, on each staged wait iteration and inside guarded custody. Rechecks read files only to detect drift; canonical document bodies never reread the source text. Drift stops and the existing finally path releases the transaction if one exists.

The canonical annex and handoff both copy the complete frozen master review, packet, Matrix lineage, current R2 normal report and R2 admission JSON, each adjacent to its snapshot SHA256. This preserves the master's explicit historical transport supersession and includes the newly admitted normal staging approval. No stale copied approval is silently refreshed later. Stage and custody receipts also record `evidenceSha256`.

## R2 paths and JSON contract

Target root is `/Users/brianb/MissionMed_worktrees/IR-PHASE1-REGISTRY-20261004-R2`. Only Foreman creates/adopts that clean clone. The original `/Users/brianb/MissionMed_worktrees/IR-PHASE1-REGISTRY-20261004` and its frozen nine-file stage are excluded. This worker did not inspect/mutate its stage or replace its receipt.

New local artifact filenames are `REGISTRY_ADMISSION_APPROVAL_R2.json`, `NORMAL_REGISTRY_ADMISSION_REVIEW_R2.md`, `REGISTRY_STAGED_CANDIDATE_R2.json`, `REGISTRY_STAGED_APPROVAL_R2.json`, and `REGISTRY_CUSTODY_RECEIPT_R2.json`. Existing filenames are never written, removed or consumed by R2. Existing packet/checkpoint/metadata receipt, `supabase/.temp/cli-latest` and `_AI_INPUTS` remain outside this write set.

The independent admission JSON must have this exact field contract (hash values come from the initially frozen sources; report digest is measured only after the fresh report is written):

```json
{
  "schema": "missionmed.ir.registry.admission.r2.v1",
  "verdict": "APPROVE",
  "reviewer": "phase1_registration_contract_review",
  "sources": {
    "lease_transport.py": "<initial SHA256>",
    "register_phase1.py": "<initial SHA256>",
    "run_authenticated_registration.py": "<initial SHA256>",
    "PHASE1_INDEPENDENT_CONTRACT_REVIEW.md": "<initial SHA256>",
    "PHASE1_REGISTRATION_REQUEST.md": "<initial SHA256>",
    "MATRIX_LINEAGE_REVIEW.md": "<initial SHA256>"
  },
  "normalReviewSha256": "<fresh NORMAL_REGISTRY_ADMISSION_REVIEW_R2.md SHA256>"
}
```

The local code API is `register_phase1.main(expected_evidence_hashes=..., initial_sources=..., client_factory=...)` with `--execute` in the same wrapper process. `expected_evidence_hashes` has exactly the five names in `EVIDENCE_NAMES`; `initial_sources` has exactly the six names in `INITIAL_SOURCE_NAMES`. Both maps are copied at main entry. `client_factory` receives the unchanged canonical `SupabaseLeaseClient` type and constructs it using the same retained private key and accepted existing six-RPC opener. Direct CLI `--execute` without these bindings fails before provider access; no accidental second retrieval is used. Canonical imports are deferred so import and fixture validation remain purely local.

Normal RPC payloads/URLs, registrar/keeper, fresh decision allocation, exact nine-path set, mission-profile validation, 600-second staged wait, staged approval verdict/reviewer/path/base comparison, pre-custody fence, frozen exact stage hash/set assertions, non-force canonical push, remote byte readback and finally release remain unchanged. R2 never edits/rebinds an old frozen receipt, hotpatches an old process, reserves DR IDs or approves an old stage. Fresh hashes refer to a new candidate produced under a new normal transaction.

## Exact local source hashes

| File | SHA256 |
| --- | --- |
| `lease_transport.py` | `6bab4c948b28202b7a803228f2123d5c95137030f16eb129c427b4ddcc487cad` |
| `register_phase1.py` | `6e0115270e35003ea2ddfca5086a292b5454d9c1b697a288630581fb8f5141e7` |
| `run_authenticated_registration.py` | `871e0f58ca6dcd96097b65d5a3ced880edf0fe0f68e6836c1e10abcd908bc396` |
| `register_phase1_sealing_tests.py` | `165ffe8a770862ae24b99c0618d0be81586200b88a282430b14fed7ddca57611` |
| `PHASE1_INDEPENDENT_CONTRACT_REVIEW.md` | `1be5de81e47f03c77e0daa9f07a3c03d7627226693ef79637bad23e3730bf24f` |
| `PHASE1_REGISTRATION_REQUEST.md` | `b30d5f0ec7ec7149db30a19875f3fe4133ee9138f34a84fd2ef6bcb37af09d58` |
| `MATRIX_LINEAGE_REVIEW.md` | `cc7252cbf7326de1ad9d1c734832ab1cfdc1bf93f39818db10bd5ce0a40c79d6` |

The packet and master contain historical hashes and admission context. They are documentary inputs preserved here; their old source-hash approvals do not admit the changed R2 helper. The fresh independent review must explicitly accept the exact changed helper/wrapper and their immutable-evidence API before any separately authorized actual retrieval/probe. Any documentary supersession needed for that review must be finalized before wrapper initial capture.

## Validation and readmission

`python3 -B _AI_HANDOFFS/from_codex/IR-INTERVIEW-READY-0002/register_phase1_sealing_tests.py`: 9 fixture-only tests PASS. The tests use temporary documentary inputs and fake canonical modules; they perform no real credential, provider, Git/canonical or OS-clone operation. They check changes to each initially bound source document, initial-source admission mismatch, report digest mismatch, late normal-report change, late source change during fake refresh before acquisition/keeper, immutable hash/copied-byte agreement after source mutation, post-auth evidence validation, pre-auth report rejection and old artifact-path preservation. Focused `git diff --check` passes. No broad transport suite was rerun because transport bytes were unchanged.

Actual execution is pending. Require independent exact-byte R2 implementation/read admission first; fresh complete BOOT/clean canonical-root/provider-clear prerequisites remain Foreman's responsibility. Then exactly the separately admitted retrieval/probe in one private wrapper process; fresh after-auth R2 normal report/JSON bound to its initial sources; normal fenced transaction with fresh DR allocation; new exact nine-path staged receipt; independent complete fresh staged review and `REGISTRY_STAGED_APPROVAL_R2.json`; canonical custody/readback/release and independent provider-clear. Product work still requires subsequent scoped authority/leases/manifest/recovery/independent release/live acceptance. This local test result is no actual authentication, Registry acquisition, custody or production approval.

Stop after the scoped local correction commit; no push, deployment or provider execution by this worker.
