# B1-510H Identity and Entry-Path Matrix

No private identifiers are reproduced.

| Identity class | Entitlement | Identity mapping | Direct route | Matrix route | Voice |
|---|---|---|---|---|---|
| Founder student | valid | preserved | current app | current app | existing separate grant |
| Founder admin | valid admin gate | preserved | current app | current app | existing separate grant |
| Current 360 student | trusted, verified, active course 3893 | present | current app | immediate redirect to current app | false unless separately authorized |
| Ineligible student | inactive/fails authority | irrelevant | denied | denied/no adapter | false |
| Anonymous | none | none | HTTP 401 | login boundary | false |

Population and live evidence:

- 439/439 current eligible non-admin students are mapped;
- 11/11 Founder acceptance identities resolved, passed entitlement, mapped, and
  issued valid StoryForge student tokens;
- 441 total PostgreSQL identities have 441 distinct WordPress IDs and UUIDs;
- an ordinary eligible student's story list exposed no Founder data;
- one live ineligible account and anonymous requests remained denied.

The initial-hash redirect, refresh stability, entitlement-negative cases,
administrator/mentor boundary, and Founder overrides pass focused automated
coverage. The authenticated Founder browser session also confirmed the current
Matrix-to-StoryForge route after deployment.
