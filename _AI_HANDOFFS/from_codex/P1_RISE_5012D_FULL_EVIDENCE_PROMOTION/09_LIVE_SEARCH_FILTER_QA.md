# Live Search and Filter QA

## Production counts

| Filter | Live count |
|---|---:|
| All canonical programs | 6,139 |
| J-1 sponsorship published | 4,417 |
| H-1B sponsorship published | 1,303 |
| J-1 or H-1B | 4,461 |
| Any visa evidence | 4,467 |
| IMG roster evidence | 3,506 |
| DO roster evidence | 3,667 |
| Caribbean roster evidence | 32 |
| US MD roster evidence | 5,000 |
| SOAP 2026 | 883 |

Central search for exact resident-school text `St. George's University School of Medicine` returned 65 programs. The UI headline and result counts updated with filters and returned to the 6,139 baseline after clearing. Approved structured current facts are consumed from the database projection; no frontend program allowlist was added.

The filter projection was repaired after live canary measurements exposed a statement timeout. The final materialized latest-review CTE preserves forced RLS and completed in 969.863 ms under provider `EXPLAIN ANALYZE`; live requests completed in approximately 1.28–1.61 s while catalog pages remained approximately 29–109 ms after bootstrap. No incorrect zero or provider-specific coupling remained.
