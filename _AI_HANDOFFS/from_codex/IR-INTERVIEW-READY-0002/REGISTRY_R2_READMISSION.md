# R2 evidence correction and bounded read admission

Verdict: **APPROVE EXACT R2 CORRECTION AND ONE FRESH RETRIEVAL/PROBE ONLY**, independently reviewed by `phase1_registration_contract_review` (Sol6.1 High), base `46cb6379680fc933b72e9fc6df481c238caf3e5c`. No substantive defect was identified in the immutable-evidence correction. This review issues no normal R2 admission, staged approval or production approval.

Exact initial source custody after the master supersession was appended and Foreman confirmed the packet finalized:

| Source | SHA-256 |
| --- | --- |
| `lease_transport.py` | `6bab4c948b28202b7a803228f2123d5c95137030f16eb129c427b4ddcc487cad` |
| `register_phase1.py` | `6e0115270e35003ea2ddfca5086a292b5454d9c1b697a288630581fb8f5141e7` |
| `run_authenticated_registration.py` | `871e0f58ca6dcd96097b65d5a3ced880edf0fe0f68e6836c1e10abcd908bc396` |
| Final `PHASE1_INDEPENDENT_CONTRACT_REVIEW.md` | `7fd6f092879ca5b0fba04ecfb10e5a4972c131cf0d11f7ac99e69afe91e5bf80` |
| Final `PHASE1_REGISTRATION_REQUEST.md` | `5563d517e9d4cfced50357769dc6077773d937daab65233208d39a398351670a` |
| `MATRIX_LINEAGE_REVIEW.md` | `cc7252cbf7326de1ad9d1c734832ab1cfdc1bf93f39818db10bd5ce0a40c79d6` |

Read exact correction diff/code, `REGISTRY_EVIDENCE_SEALING_HANDOFF.md`, finalized packet, Matrix lineage, prior staged HOLD and independent abort provider-clear. Independently reproduced **nine fixture tests PASS**; test SHA-256 `165ffe8a770862ae24b99c0618d0be81586200b88a282430b14fed7ddca57611`. Tests use documentary/fake canonical fixtures, not actual credential/provider/OS transactions. Transport remains byte-identical to its accepted implementation; a broad transport rerun was unnecessary.

Accepted correction: wrapper freezes six source hashes before lookup and checks new R2 artifacts absent, revalidates before/after authentication and during its wait, and requires normal report/JSON modification times after actual authentication. The fresh JSON binds all six sources and the separate report digest. Registrar validates copied admission/evidence before canonical imports/acquisition; each snapshot's immutable bytes produce both its digest and copied text. Complete current master/packet/lineage plus fresh normal report/admission are copied with digests into both canonical annex and handoff. Source/evidence rechecks precede client/begin, guarded generation, receipt, each staged wait iteration and guarded custody. This resolves the prior stale-copy/hash race by failing on drift rather than recapturing changed authority. Direct registrar execution without the same-process evidence/client bindings stops before provider access.

Normal canonical allocation/keeper/fencing, exact nine paths, boot routing, staged-path/hash/base independent approval, final frozen stage assertion, non-force push/readback and finally release retain their existing semantics. New `_R2` control/receipt names and `/Users/brianb/MissionMed_worktrees/IR-PHASE1-REGISTRY-20261004-R2` root preserve the old rejected stage/artifacts. This reviewer observed R2 tracked-clean at `95a188b9cc30655b374f580775e7dc77be6d7f7a` and all five R2 artifact paths absent. Foreman reports fresh R2 universal BOOT PASS at HQ `0feee579b0a9f2c90529220899f6cf6d21b8cd05`. Prior independent provider-clear remains the bounded old-transaction evidence; no new provider read occurred here. Substantive accepted WP self-only account/storage and dedicated-only Matrix guard contracts remain unchanged.

Admit exactly one invocation of the reviewed R2 wrapper: existing no-UI identity lookup, one fixed Management reveal GET selecting only existing `missionmed_lease_runtime_v5` / type `secret` on `brxqytrfdisrgakrxkhd`, and one separate fixed apikey-only REST-root status probe. Preserve native 10-second budget, 60-second/256KiB retrieval bounds, separate 60-second probe bound, existing token/key guards, private memory/pipes, TLS, no proxy/redirect/retry, constant errors and absence-only custody fallback. No new key/token/grant, CLI change, UI grant acceptance, alternative selection or provider mutation. A failure stops. Earlier admissions and old code hashes do not authorize this attempt.

Actual HTTP 200 must precede the separate normal R2 review and approval JSON; none is written now. Retain a successful key only in the same private process during its bounded 600-second wait. The reviewer must publish that later report completely before its JSON, without changing any of the six initial sources. Fresh fenced allocation and exact new nine-file staged review remain mandatory before canonical custody. If a bound input changes, stop/release; do not renew or recapture in place.

Only this report and the master's current R2 supersession are committed. No credential/environment/Keychain/token-file/provider operation, approval JSON, canonical mutation or deployment occurred in this review. Concurrent dirty packet/checkpoint, receipts, CLI scratch and unrelated inputs were preserved. Stop after scoped local commit; no push or merge.
