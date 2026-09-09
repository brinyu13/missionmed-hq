# Filter Data Audit

The audit traced canonical source data through the production projection, authenticated filter endpoint, browser predicate, and rendered count. The pre-repair UI discarded every server-side visa and resident-composition field by assigning `rich: null`; the affected predicates therefore returned zero despite populated canonical registry fields.

## Table A - Existing and broken filters

| Filter | Programs with underlying data | Live matches before | Live matches after | Status |
|---|---:|---:|---:|---|
| SOAP 2026 history | 883 | 883 | 883 | Preserved |
| Gold dossier / Deep Research | 285 current deep programs | 0 | 285 | Replaced with deterministic Deep Research |
| Enriched / Tier A | 256 current enriched programs | 0 | 256 | Repaired and relabeled |
| Registry / Basic | 5,145 current basic programs | 6,139 under the old registry placeholder | 5,145 | Semantics repaired |
| ABIM verified | 0 approved current facts | 0 | hidden | Deferred; no approved live facts |
| IMG evidence on roster | 3,498 | 0 | 3,498 | Repaired |
| DO / Caribbean evidence | DO 3,654; Caribbean 0 | no executable predicate | DO 3,654; Caribbean 0 disabled | Concepts separated |
| Visa sponsorship published | 4,472 programs with visa data | 0 | 4,461 any published visa evidence | Repaired and expanded |
| Verified recently | 0 | 0 | hidden | Removed as non-useful |
| Current cycle | 6,139 | 6,139 | hidden | Removed as non-discriminating |
| Needs refresh | 0 | 0 | hidden | Removed as non-useful |
| Top-level IMG Evidence | 3,498 | 0 | dynamic count | Repaired |
| Top-level Visa Published | 4,461 | 0 | dynamic count | Repaired |

## Production counts

The provider-native projection returned 6,139 records and exactly one research-depth classification per record. Visa counts are 4,411 J-1, 1,294 H-1B, 4,455 J-1-or-H-1B, and 4,461 any explicit published visa evidence. Resident/graduate observation counts are 3,498 IMG, 3,654 DO, 4,988 US MD, and zero approved Caribbean roster facts.

Only explicit boolean J-1/H-1B publication fields, explicit visa-status text in the canonical Visa Sponsorship field, positive program-reported resident/graduate composition, or approved structured canonical current facts affect filters. Vague IMG, eligibility, or ECFMG wording is not promoted into sponsorship.

