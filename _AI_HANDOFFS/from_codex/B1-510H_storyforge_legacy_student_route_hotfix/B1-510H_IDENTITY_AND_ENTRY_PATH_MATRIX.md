# B1-510H Identity and Entry-Path Matrix

No private identifiers are reproduced. Labels correspond only to the supplied
acceptance roster.

## Production before candidate deployment

| Identity | Entitlement evidence | `/storyforge/` | Matrix `#storyforge` | Result |
|---|---|---|---|---|
| Founder student | exact pilot allowlist and mapped DB row | current release | adapter redirects | current app |
| Founder admin | exact pilot allowlist and mapped DB row | current release | adapter redirects | current app |
| S04 affected 360 student | trusted, verified, active course 3893 | current shell, then `user_not_enabled` | protected Bootstrap Demo | FAIL |
| Other current 360 students | 439 non-admin eligible; zero mapped | same gate by server evidence | same legacy branch | FAIL |
| Ineligible account | trusted entitlement inactive | denied | Matrix lock/no adapter | PASS fail-closed |
| Revoked/expired sample | course history/revocation logic inactive | denied | Matrix lock/no adapter | PASS fail-closed |
| Anonymous | no WordPress session | bootstrap HTTP 401 | dashboard login redirect | PASS fail-closed |

## Founder roster reconciliation

- supplied identities: 11;
- exact identifiers resolved: 8;
- resolved identities with current course 3893 access: 8;
- resolved identities with trusted/verified/active entitlement: 8;
- resolved identities already mapped: 0;
- exact supplied usernames not resolved: S03, S06, S10.

The unresolved usernames were not guessed or silently matched by display name.
Founder confirmation of the correct existing identifier is required.

## Local candidate behavior

The focused harness proves:

| Case | Expected candidate result | Test |
|---|---|---|
| unallowlisted trusted active 360 student | admitted as student | PASS |
| inactive/not eligible | `eligibility_required` | PASS |
| revoked | `eligibility_revoked` | PASS |
| unverified source | `eligibility_required` | PASS |
| unallowlisted administrator | `user_not_enabled` | PASS |
| unallowlisted mentor | `user_not_enabled` | PASS |
| Founder student override | unchanged/admitted | PASS |
| Founder administrator | unchanged/admitted | PASS |
| initial Matrix `#storyforge` load | immediate same-origin replace to `/storyforge/` | PASS |

This candidate is not sufficient for production until eligible users also have
the pre-existing WordPress UUID metadata and matching `sf_users` rows.
