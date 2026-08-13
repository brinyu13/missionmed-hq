# D1-500 Founder and Administrator Canary Report

Result: PASS.

- Canary ran before general student activation.
- Founder-equivalent controlled persona reached the canonical route and exercised the production identity path.
- Approved real administrator reached the route under exact allowlist authority.
- Unapproved administrator was denied without an audited resource grant.
- Student access remained disabled during the initial canary stage.
- Create, save, reload, edit, export, logout/re-entry, stale-token rejection, and account-switch invalidation were exercised across the approved and controlled personas.
- Anonymous, second-user, and direct API denials passed.
- Production health named the correct static release and schema.
- Browser console critical errors: 0 in the recorded canary journeys.
- Protected visual authority remained materially unchanged.
- Kill switch and scoped rollback were available before student activation.

The controlled administrator was removed after testing. Final approved administrator allowlist: WordPress user ID `85` only.
