# 07 OLATHE DISPOSITION

## Accepted identity state

| Item | Value |
|---|---|
| Canonical `rise_program_id` | `rise_prg_31141a27-b249-5eae-8259-dd3fe679c4f2` |
| Active retained alias | `RISE-IM-0683` |
| Quarantined alias | `RISE-IM-0682` |
| Program-specialty ID | `rise_ps_54ba473a-9b30-5dc0-8f3f-0bd2bdb17d14` |
| Browse-membership ID | `rise_bm_17a10138-722d-51b0-baf8-52a67320ce7d` |
| Historical resolution ID | `rise_source_resolution_1401900001_2026-07-15` |

The normalized external-ID observation is `1401900001`; its namespace remains source-qualified as `ACGME_PROGRAM_ID_AS_REPORTED_BY_FREIDA`. It is an identity-disposition reference, not active program evidence.

## Why the disposition stands

The quarantined row has a trailing-space identifier and malformed URL and is an older, sparse duplicate. The retained observation and canonical identity are internally coherent. All alias, membership, external-ID, and orphan checks pass. Production commit `89d1fb4` removed the reviewed resolution because source-owner rights were unresolved; it supplied no contrary identity evidence.

The AAMC ERAS participating-program page was manually reviewed on 2026-08-10 and independently corroborates one Olathe Internal Medicine program entry associated with identifier `1401900001`: https://systems.aamc.org/eras/erasstats/par/display.cfm?spec_cd=140. This is a manual reference only and is not ingested as a dataset.

## Source separation

- Neither the retained nor quarantined FREIDA observation may populate research facts.
- `RISE-IM-0682` must never become active.
- The canonical program identity remains stable even if every inherited source field is blanked or reverified.
- Any current program fact must come from an authorized first-party replacement source.

The machine-readable disposition is `WAVE1_OLATHE_DISPOSITION.json`, SHA-256 `68742c07f25148b3e4eda37c53d8ca49acd55fb30bdcd7892970a21de309fc40`.
