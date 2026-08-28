# Data Provenance — P1-RISE-5002 Founder Shell

Rule followed: **no unsupported residency facts were invented.** Where a field is absent it renders as "Not published by the program", "Not yet verified by RISE", "Deep research pending", a privacy hold, or a labeled representative value. Everything representative is marked in the UI (violet `Demo` tags, violet dots on tier chips, "(representative)" strings).

## REAL (from the RISE corpus, unaltered)

| Data | Source | In the shell |
|---|---|---|
| 150 IM programs: names, institutions, cities/states, ACGME IDs, legacy RISE IDs, official URLs, research tiers, official-fact counts | `P1_RISE_SOL56_150_PROGRAM_MATRIX.csv` | Find Programs list, autocomplete, Files (registry depth), coverage matrix |
| ABIM state / examinees / pass rates (115 verified, 34 verified-absent, 1 title-ambiguous) | same matrix | rows sort "ABIM pass rate (verified)", Details tab, snapshot rail |
| Per-family research states (roster privacy hold, requirements/visa/salary/fellowship/outcomes states) | same matrix | freshness-by-family, Unknown footers, admin coverage & campaign math |
| SOAP 2026: 25 of the 150 joined by ACGME code, with unfilled positions and track (Categorical / Preliminary / Primary Care) | `NRMP_SOAP_Unfilled_Programs_2026_complete.csv` | SOAP door, SOAP filter + track segments, row/File SOAP signals, one identity-review item (Garnet Health) |
| **SUNY Upstate — everything in its File**: Dec 1 2026 deadline; 220+/500+ preferences; first-attempt rules; ECFMG; letters incl. Chair-letter wording; prior-cycle YOG-4yr and USCE preferences; signaling (undated); visa statuses J-1/H-1B/EAD/PR with the sponsorship distinction; NY licensure; PD Knohl + 7 APDs; Kaul residency-here-YES/fellowship-NO; 11 identity-safe roster examples incl. Saba (Caribbean YES) and 3 DO schools; roster completeness gate (65/46/46, PARTIAL, % withheld); 10 direct in-house fellowships + CCM subtrack + neurocritical UNCERTAIN + exclusions; 8 fellows with origins (Doolittle/Kc/Poudyal/Saleh internal; Aomreore/Alqudah/Irfan/Zafar external); 8 outcome class-years located (PARTIAL); salary $68,788/$73,509/$76,643 + $900 allowance (prior-cycle label); benefits rows; 97% ABIM as *program claim*; 6 conflicts; 12 unresolved fields; source ledger | `SUNY Upstate Internal Medicine: Evidence for Applicant Decisions.md` (267-ref gold dossier) | the gold-dossier File, two real review-queue items, the fact card |
| Coverage stats (1,504 IM/FM identities, 18 Tier-A, wave dates) | SOL56 final report / 4102 | banners, coverage strip |

## REPRESENTATIVE / DEMO (labeled in the UI)

| Data | Why it exists | Labeling |
|---|---|---|
| **Brookdale University Hospital IM** — mission, values, curriculum, PD Conrad Fischer + APDs, IMG 61%/28, visa published, MissionMed Notes, Dr Brian's read | Inherited from P1-RISE-4001 so one File renders fully lit; the founder screenshot program | `Demo` tag on rows/autocomplete/File eyebrow ("Representative demo data"), every domain state `DEMO`, "(representative)" in strings |
| **Gold/Silver tier previews on Tier-A programs** (deterministic by ACGME hash) | Verified requirements exist for only 2 programs; a fit panel with 2 rows can't be judged | violet dot on the chip, "Representative preview" reason line, coverage note under Your fit, tooltip |
| Demo profile "Ignacio" (non-US IMG, Step 2 CK 245 first attempt, YOG 2022, USCE 6 mo, J-1) | fit needs an applicant | "Demo profile" in the rail + profile page banner |
| Admin seed campaign history, task-state progression, cost figures ($0.30/task per the founder example; $45.00 SOL56 ≈ 150 × $0.30), ETA | demonstrates doc-12 mechanics | "Simulated" banners on every admin surface |
| Review item 1 (Rivera → Okafor leadership change, "Ascension Saint Agnes (representative)") | your requested change-review interaction; the program is not in the corpus | labeled "representative example" on the card |
| File-Vault CV list and extraction rows | demonstrates doc-10 CV mode | "Founder shell: simulated" on the sheet |
| SUNY Upstate fit states in the You/State columns | real published wording × demo profile — the computation is real, the applicant is the demo | "For you" card; profile labeled demo |

## Not present anywhere
Numeric fit scores, match probabilities, "safe/guaranteed/likely match", invented rosters or leadership for registry programs, retention percentages, composition percentages without denominators, resident names for any privacy-held program, real student data (the demo profile is synthetic).
