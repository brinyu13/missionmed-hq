# Agent decision ledger

Hash-based Message Authentication Code is abbreviated as HMAC below.

| Decision | Challenge or disagreement | Resolution | Reversibility |
|---|---|---|---|
| Treat 105 as candidate envelope | 97 consumer rows looked canonical | 97 is a strict filtered subset; 105 remains unratified | Owner may ratify a different roster |
| Runtime outranks local | Local registry documented as canonical baseline | Live has 10 additional rows; local is reconciliation input | Snapshot can be refreshed |
| Use keyed aliases | Deterministic SHA hashes were simpler | Per-run HMAC prevents low-entropy dictionary attacks | Stable aliases require approved boundary key later |
| Bind body identity | Locator alone appeared sufficient | Declared top-level, nested-wrapper, and record IDs must match | Locator-only remains explicit when no ID declared |
| Never follow malformed metadata | Two transcript references were invalid | Probe only trusted documented location; retain warning class | Registry owner can repair metadata |
| Do not call media detail | Detail route could improve coverage | Code indicates possible backfill; discovery must remain non-mutating | Reconsider only with proven read-only route |
| Do not query Supabase directly | Schema/index evidence could help | Project owner conflict is unresolved | Resume after written project pin and scope grant |
| Historical speaker labels are non-authoritative | All historical segments have speaker strings | Labels lack identity adjudication/global consistency | Owner/adjudicator may supply mapping |
| Report zero question metrics | Corpus artifacts became partially accessible | Scope/speaker/privacy/rights gates still block extraction | Extraction begins only after all gates pass |
| Grade completeness C1 | Stable set and 97 complete pairs are strong | No owner denominator or upstream listing exists | Raise grade only with named receipts |
