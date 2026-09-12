# Codex Hydration Handoff — TX + FL Adult Neurology

**Implementation-oriented. Claude Code, 2026-09-12. No promotion performed.**

Join key: **`acgme_id`** (string, always prefix `180` = adult Neurology).
`rise_program_id` travels alongside every row. `rise_program_id_uuid` is deliberately
`null` — Neurology has never been inducted into the 4102/4102B evidence corpus, so decide
before ingest whether to mint `rise_prg_*` UUIDs under an authority release or to key on
ACGME ID and back-fill.

---

## 1. Field mappings

### `01_PROGRAM_DOMAIN_FACTS.jsonl` → per-domain program facts
```
acgme_id, rise_program_id, program_name, city, state
domain            one of 26 fixed keys (1_identity_structure … 26_sources_freshness_completion)
status            9-value vocabulary, see §2
value             structured value, or NULL for every absence state
summary           short renderable statement
raw_finding       long evidence prose — NOT display copy
student_facing_absence_message   display copy when value is NULL
source_ids[]      resolve against 10_SOURCE_MANIFEST.csv
source_urls[]     may be non-empty on an absence (pages checked that came up empty)
source_type, source_date, retrieved_at, confidence, conflict_notes
adversarially_validated   NO | YES_WAVE1|2|3
```

### `03_RESIDENT_COMPOSITION_ESTIMATES.csv` → DO/IMG-friendly filters
```
resident_roster_total, resident_classified_total, resident_unclassified_total
us_md_count, do_count, img_count, caribbean_img_count, img_other_count
us_md_pct_of_classified, do_pct_of_classified, img_pct_of_classified,
caribbean_img_pct_of_classified
classified_coverage_pct_of_roster, roster_snapshot_date_or_cycle
composition_type = ROSTER_DERIVED_ESTIMATE      official_program_statistic = false
denominator_basis = CLASSIFIED_RESIDENTS        unknowns_excluded_from_percentage = true
estimate_method, estimate_confidence, disclaimer, percentages_available, source_urls
```
`img_count = caribbean_img_count + img_other_count`. Caribbean is an IMG **subtype** and
is not double-counted. `us_md_count + do_count + img_count = resident_classified_total`.
`classified + unclassified = roster_total`. All verified deterministically.

### `08_TRACKS_POSITION_TYPES.csv` → one row **per track**
```
nrmp_code, nrmp_institution_code, position_type, track_status,
prelim_dependency, senior_student_eligible, attribution_basis
```
Do not flatten to a program-wide value.

---

## 2. Status semantics — the part most likely to go wrong

| status | value | render |
|---|---|---|
| `VERIFIED` | populated | the value |
| `PARTIALLY_VERIFIED` | populated | the value, with its stated caveat |
| `RESEARCHED_NOT_PUBLIC` | **null** | the absence message. **Never "not yet researched."** |
| `RESEARCHED_NOT_FOUND` | **null** | the absence message. **Never an affirmative "No."** |
| `CONFLICT` | varies | both readings, or escalate. Do not pick a winner. |
| `UNAVAILABLE_DUE_TO_ACCESS_BOUNDARY` | **null** | the absence message. A lawful gap, not a failure. |
| `STALE_NEEDS_REFRESH` | populated | with a staleness marker, or suppress |
| `NOT_APPLICABLE` | **null** | suppress the field |
| `NOT_YET_RESEARCHED` | — | **zero occurrences in this package** |

Across 884 facts: 457 VERIFIED · 224 PARTIALLY_VERIFIED · 94 RESEARCHED_NOT_PUBLIC ·
47 CONFLICT · 44 RESEARCHED_NOT_FOUND · 16 NOT_APPLICABLE · 2 STALE_NEEDS_REFRESH.

### Step 2 timing — three-state flag, and `null` is not `false`

`07_APPLICATION_REQUIREMENTS.csv` → `step2_creates_barrier_mid_october`:

| value | meaning | render |
|---|---|---|
| `False` | published rule exists AND a mid-October result clears it | no timing obstacle |
| `True` | published rule exists AND a mid-October result arrives after it | a real obstacle |
| *(blank)* | **no published rule, or published sources conflict** | unknown — contact the coordinator |

Counts: **12 `False` · 4 `True` · 18 blank.** Blank must never render as "no barrier."

**FREIDA carries two Step-2 field families that disagree by design.**
`field_usmle_step2_req_int` / `field_usmle_step_2_required` are frequently false and
**render no visible row**. `field_usmle_us_md_pass_ck` / `field_usmle_img_pass_ck` are
frequently true and **produce the visible rows** under FREIDA's *"Medical Exam Licensing
Requirements for Interview Consideration"* heading. Reading only the first family yields
a benign answer contradicting the page an applicant sees. **Four Florida dossiers were
re-coded for exactly this.** If you reload from FREIDA, read both.

---

## 3. Composition estimate semantics

These are **estimates from published rosters, not official admissions statistics.**
Every row carries the disclaimer verbatim.

Classification is **institution-based only**: school string, plus degree suffix where the
roster publishes one. Never inferred from a person's name, ethnicity, language or
nationality; visa need is never inferred from IMG status. Both properties are enforced by
deterministic check.

- **Puerto Rico LCME schools classify as `US_MD`** — Universidad Central del Caribe, Ponce,
  University of Puerto Rico, San Juan Bautista. Puerto Rico is a US territory.
- **`IMG_CARIBBEAN` is an IMG subtype**, split into offshore-for-profit (Ross, SGU, AUC,
  Saba…) and Caribbean national universities, flagged in `caribbean_subtype`.
- **Universidad Central del *ESTE* (Dominican Republic) is kept strictly distinct from
  Universidad Central del *CARIBE* (Puerto Rico).** One word apart; confused at four
  programs during research, once on a **program director**. Their classifications differ:
  Este → `IMG_CARIBBEAN`, Caribe → `US_MD`.

Coverage is uneven and stated per row: **17 programs HIGH confidence, 4 MEDIUM, 6 LOW,
7 with no published roster at all** (`estimate_confidence = NONE_NO_ROSTER`, percentages
blank). Do not present a LOW-coverage estimate with the same weight as a HIGH one.

---

## 4. Known schema defects — capture, do not fix here

`09_REGISTRY_RECONCILIATION.csv` carries **785 rows**: 349 Texas, 434 Florida, 2
registry-wide. **Nothing in this package mutates the registry.**

1. **No `Current Residents PGY4` column exists in any of the 31 specialty tabs**, while
   `Salary PGY1–PGY4` all do. Every specialty longer than three years is structurally
   truncated by one class (~6,139 programs). **Never compute a census by summing
   PGY1+PGY2+PGY3.** Use `resident_roster_total` from file `03`.
2. **`Medical Spanish Curriculum` is unreliable** — wrong or unsupportable at 8 of 34
   programs, twice by contamination from a sibling program. **Do not project it.** Use the
   researched `spanish_latino` block in file `06`.
3. **`Program Director` is empty for all 16 Texas registry rows.** This package supplies a
   named PD for **34 of 34** programs (`04`, `role_category = PROGRAM_DIRECTOR`).
4. **Step 2 *timing* has no field in the 196-column schema** despite six distinct published
   regimes across these programs.
5. **The `State` column is unreliable** — validate geography against ACGME ID digits 4–5
   (TX = 48, FL = 11, NJ = 33). Two Florida rows carried the wrong state entirely.

---

## 5. Adversarial corrections supersede

Florida's three reviewers audited **294 claims: 248 confirmed, 22 downgraded, 7 retracted,
9 conflicts added, 6 source mismatches, 0 contamination of either kind.**

**The corrected states are the values in this package. Do not resurrect superseded
pre-review values.** `11_CONFLICTS_AND_EXCEPTIONS.csv` carries every one with
`kind = RETRACTED | DOWNGRADED | TIER_CHANGED | SOURCE_MISMATCH` and explicit handling.

**Texas received no equivalent adversarial layer.** `adversarially_validated = NO` on every
Texas row. That is a real asymmetry in evidentiary strength, not a formatting gap — Texas
is researched-but-unreviewed, and one fabricated designation was found there by the review
process that Texas itself never had.

---

## 6. Cross-program contamination guards already applied

Several dossiers deliberately cite **sibling programs' NRMP codes** to distinguish
themselves — the two Larkin programs, three HCA programs, two UT Austin programs, two UF
campuses. Track attribution therefore requires either a declared NRMP institution-code
prefix match, or absence of a disclaiming clause. **80 sibling-code mentions were excluded**
and are preserved in `.excluded_sibling_codes.json` for audit.

Six programs have no NRMP code in their own evidence and are marked
`RESEARCHED_NOT_PUBLIC` rather than being assigned a plausible neighbour's.

---

## 7. Next action

**Codex hydrates RISE from these files.** Nothing here has been promoted, ingested or
mutated. Ingestion of registry-conflicting fields should follow the reconciliation
decision in `09`, not precede it.
