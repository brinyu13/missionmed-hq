# Shared Hydration and Second-User Proof

A separate short-lived WordPress session for the existing safe enrolled 360 identity (WP user ID 416) completed the normal live SSO path at `https://missionmedinstitute.com/rise/`. The temporary session was destroyed after QA; no cookie or token is retained.

Readback:

- role `student`; capabilities `rise:read`, `rise:premium`, `rise:private-beta`, `rise:contribute`;
- no `rise:operator`; operator route returned HTTP 403;
- Holdout A Program File HTTP 200 with 12 current facts;
- Enriched Research, ten approved domains;
- J-1 through ECFMG visible;
- 17 Sources & Freshness rows and 17 unique links;
- Holdout B retained zero current research facts;
- SOAP HTTP 200 / 883, My Programs HTTP 200 durable, Student Intel HTTP 200;
- request balance unchanged for this second user and no research job created.

This proves shared canonical hydration rather than requester-private output. RLS remained forced, identity projection joins stable canonical subject identity to the live release-specific Program File through ACGME identity, and normal 360 users could not reach admin controls.
