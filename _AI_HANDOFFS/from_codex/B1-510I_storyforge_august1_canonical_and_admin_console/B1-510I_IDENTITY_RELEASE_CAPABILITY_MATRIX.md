# B1-510I Identity, Release, and Capability Matrix

Private WordPress and StoryForge identifiers remain in mode-0700 evidence rather than committed documentation.

| Identity | Session result | Voice | Admin console | Negative proof |
|---|---|---:|---:|---|
| Founder student | student, eligible | true | false | admin home 403 |
| Founder administrator (WP 107) | admin, eligible | false | true | admin home 200 |
| Ignacio | student, eligible | true | false | admin home 403 |
| second eligible 360 student | student, eligible | true | false | admin home 403 |
| ineligible WordPress account | entitlement bridge rejected | none | none | `eligibility_required` |
| anonymous | no session | none | none | session 401 |

All roles receive the same canonical index/app/auth/styles/logo bytes. Founder student live browser smoke showed the canonical dark UI, the correct first-name greeting, voice control, no Bootstrap Demo, `motion-enabled`, and the reduced-motion-safe static result required by the browser's active preference.

An Ignacio token requesting a Founder-owned direct story ID received HTTP 404 / PostgreSQL `P0002`. Students cannot reach admin routes. The Founder administrator remains excluded from student voice.
