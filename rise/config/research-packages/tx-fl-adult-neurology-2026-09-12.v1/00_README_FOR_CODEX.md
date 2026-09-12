# TX + FL Adult Neurology — Hydration Package

**For the active Codex RISE hydration thread. Claude Code, 2026-09-12.**

## What this is

A machine-readable package covering **34 Adult Neurology residency programs** —
16 Texas, 18 Florida — researched to a 26-domain contract, with Florida additionally
passed through an adversarial second-reader layer.

**884 domain facts · 566 residents · 212 leadership · 636 faculty · 785 registry
discrepancies · 4,032 source records (1,002 unique URLs) · 477 conflicts/exceptions.**

## Where it came from

| Source | Path |
|---|---|
| Texas raw dossiers | `P1_RISE_ALEJANDRA_NEURO_TX_OPUS5_BENCH_006A/dossiers/` (6) · `…STAGEB_007/dossiers/` (10) |
| Texas normalized | `P1_RISE_RESEARCH_DOSSIER_CONTRACT_009/normalized/` (16) |
| Florida raw dossiers | `P1_RISE_ALEJANDRA_NEURO_FL_OPUS5_008/dossiers/` (18) |
| Florida adversarial validation | `…FL_OPUS5_008/` → `validation_wave{1,2,3}.json` |
| Texas registry reconciliation | `…STAGEB_007/11_ALL16_REGISTRY_RECONCILIATION.csv` |

Schema and status semantics: `P1_RISE_RESEARCH_DOSSIER_CONTRACT_009/01_DOSSIER_SCHEMA.md`
and `02_DOMAIN_STATUS_DICTIONARY.md`.

## No production mutation

```
PRODUCTION_MUTATION_PERFORMED = NO      LIVE_RISE_INGESTION_PERFORMED = NO
CANONICAL_REGISTRY_MUTATED    = NO      PRODUCTION_IDS_MINTED         = 0
ALEJANDRA_RESEARCH_REQUESTS   = 0       NEW_PARALLEL_SPEND            = $0.00
```

Nothing here is a promoted fact. Every record is evidence pending review.

## Files to ingest

| File | Rows | Contents |
|---|---|---|
| `01_PROGRAM_DOMAIN_FACTS.jsonl` | 884 | One normalized program/domain fact per line — status, value, summary, sources, confidence, conflicts |
| `02_RESIDENTS_NORMALIZED.csv` | 566 | Every resident with normalized school, country, classification and evidence |
| `03_RESIDENT_COMPOSITION_ESTIMATES.csv` | 34 | Roster-derived MD/DO/IMG estimates with coverage and disclaimer |
| `04_LEADERSHIP_NORMALIZED.csv` | 212 | PD / APD / other leadership, with `role_category` for deterministic filtering |
| `05_FACULTY_NORMALIZED.csv` | 636 | Core faculty, training lineage, Puerto Rico ties typed by evidence class |
| `06_FELLOWSHIPS_OUTCOMES_NORMALIZED.jsonl` | 34 | Fellowships (in-house / affiliated / aspirational), outcomes, subspecialties, differentiators |
| `07_APPLICATION_REQUIREMENTS.csv` | 34 | Step 1/2, COMLEX, attempts, YOG, USCE, ECFMG, visa, deadline, eligibility barriers |
| `08_TRACKS_POSITION_TYPES.csv` | 56 | One row **per track**, not per program |
| `09_REGISTRY_RECONCILIATION.csv` | 785 | TX 349 + FL 434 + 2 registry-wide systemic defects |
| `10_SOURCE_MANIFEST.csv` | 4,032 | Every source ID → URL → domain |
| `11_CONFLICTS_AND_EXCEPTIONS.csv` | 477 | Only unresolved / conflicted / retracted / special-handling cases |
| `12_CODEX_HYDRATION_HANDOFF.md` | — | Field mappings, semantics, schema defects, next action |
| `13_CHECKSUMS.txt` | — | SHA-256 for every file above |

Join key throughout: **`acgme_id`**, with `rise_program_id` alongside.

## Five caveats that change how you ingest

1. **Status governs rendering; never read `value` without `status`.** `value` is null for
   every absence state, and `student_facing_absence_message` is the display copy. A
   researched absence must never render as "not yet researched."

2. **`step2_creates_barrier_mid_october` has three states and `null` is not `false`.**
   `null` means no published rule exists, or published sources conflict. **It must never
   render as "no barrier."** Across 34 programs: 19 `false`, 4 `true`, 11 `null`/blank.

3. **Composition percentages are over CLASSIFIED residents, not the whole roster.**
   Every row carries `classified_coverage_pct_of_roster` and a disclaimer.
   `composition_type = ROSTER_DERIVED_ESTIMATE` and `official_program_statistic = false`.
   Where `resident_classified_total == 0`, percentages are blank — not zero.

4. **Never compute a census by summing PGY1+PGY2+PGY3.** No `Current Residents PGY4`
   column exists in any of the 31 registry specialty tabs, so any specialty longer than
   three years is structurally truncated. Use `resident_roster_total` here instead.

5. **Do not project the registry's `Medical Spanish Curriculum` field.** It is wrong or
   unsupportable at 8 of 34 programs, twice by contamination from a sibling program. Use
   the researched `spanish_latino` block in file `06`.

## Adversarial corrections win

Florida's review audited **294 claims: 248 confirmed, 22 downgraded, 7 retracted.**
Those corrected states are the values in this package. **Do not resurrect superseded
pre-review values.** Retractions are carried in `11_CONFLICTS_AND_EXCEPTIONS.csv` with
`kind = RETRACTED` and explicit handling instructions.

**Texas did not receive an equivalent adversarial layer.** Its `adversarially_validated`
column reads `NO` throughout. Treat Texas confidence as researched-but-unreviewed rather
than Florida-equivalent — this is a real asymmetry, not a formatting gap.

## Next action

Codex hydrates RISE from these files. Nothing here promotes, ingests or mutates.
