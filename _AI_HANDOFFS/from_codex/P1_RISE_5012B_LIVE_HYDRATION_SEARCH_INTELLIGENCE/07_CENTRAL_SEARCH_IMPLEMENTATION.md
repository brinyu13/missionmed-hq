# Central Search Implementation

The live central Program Search now matches approved canonical data across program name, hospital, sponsoring institution, city and state, specialty, ACGME program ID, and approved registry intelligence fields in the current search contract.

| Query | Result count | Result |
|---|---:|---|
| Abington Memorial Hospital | 4 | PASS |
| Kendall Hospital | 5 | PASS |
| SUNY Upstate Medical University | 18 | PASS |
| Syracuse NY | 21 | PASS |
| ACGME 1404112358 | 1 | PASS |

Search and filters compose against current canonical data; no frontend program list is hard-coded.
