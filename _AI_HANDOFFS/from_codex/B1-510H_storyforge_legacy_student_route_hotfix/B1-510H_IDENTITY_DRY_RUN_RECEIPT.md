# B1-510H Identity Dry-Run Receipt

## Pre-write result

| Measure | Count |
|---|---:|
| WordPress users scanned | 906 |
| Entitled non-admin students | 439 |
| Existing PostgreSQL `sf_users` | 2 |
| `NEEDS_BOTH` | 439 |
| `ALREADY_VALID` among the population set | 0 |
| All other needs classes | 0 |
| All conflict classes | 0 |
| `INVALID_ACCOUNT` | 0 |
| `INELIGIBLE` | 467 |
| Founder acceptance roster resolved | 11 / 11 |
| Founder acceptance roster entitled | 11 / 11 |

The zero-conflict gate passed before either database or WordPress metadata was
written. The two pre-existing Founder mappings were outside the 439-row
population set and remained unchanged.

## Post-write reconciliation

| Measure | Count |
|---|---:|
| PostgreSQL `sf_users` | 441 |
| Distinct WordPress IDs | 441 |
| Distinct StoryForge UUIDs | 441 |
| Entitled population `ALREADY_VALID` | 439 |
| Needs classes | 0 |
| Conflict classes | 0 |
| Invalid accounts | 0 |
| Acceptance roster resolved / entitled | 11 / 11 |

The final report uses summary counts only. The private per-user plan is stored
under the sealed recovery root with mode `0600`; it is not reproduced here.
