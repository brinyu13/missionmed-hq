# Administrator vs 360 Differential

| State | Working administrator control | Authorized 360 control | First material difference |
|---|---|---|---|
| WordPress role | administrator / `manage_options` | subscriber plus student role | Expected role difference only |
| LearnDash | Admin policy bypass | `sfwd_lms_has_access(3893)` true | No failure |
| Matrix profile | Available | Available | No failure |
| HQ audience | `rise` | `rise` | No policy divergence |
| RISE role | Admin can switch between student/admin views | Student only | Expected privilege difference |
| Student capabilities | Includes operator/admin capability | `rise:read`, `rise:premium`, `rise:private-beta`, `rise:contribute` | Student least privilege preserved |
| Operator endpoint | HTTP 200 | HTTP 403 | Expected fail-closed behavior |
| Fresh pre-repair callback | Could be masked by an existing session | Missing `rise_session`, WordPress HTTP 503 | First failing seam: fresh HQ session return |
| Post-repair bootstrap/catalog | HTTP 200 / 6,139 | HTTP 200 / 6,139 | No divergence |

The production 360 mapping is current:

- LearnDash course ID `3893`
- status `publish`
- slug `mission-residency-360-match-mentorship`
- 441 currently eligible non-admin identities
- 3 course-entitled administrators, while administrators also retain the independent admin predicate
- the exercised 360 identity is active and has course access

No VIP/admin-only default had narrowed ordinary 360 access. The repair did not widen student privileges: the 360 browser had no Admin Tools control and the operator endpoint returned 403.
