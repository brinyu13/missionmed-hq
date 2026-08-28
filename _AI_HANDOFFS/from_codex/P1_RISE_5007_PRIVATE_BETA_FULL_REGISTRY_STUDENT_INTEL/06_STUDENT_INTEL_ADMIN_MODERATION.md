# Student Intel Admin Moderation

The founder-approved admin rail gains an additive `Student Intel` view with:

- all submissions, verification queue, high-priority, and hidden/rejected filters;
- admin-only contributor identity;
- immutable original claim beside student-facing display text;
- source access and private context;
- edit display, annotate, clarification, feature, hide/unhide, reject/delete, outdated/conflicting/verified/partial/could-not-verify states;
- send-to-verification and audit-trail controls;
- counts for total, new, pending, verified, partial, conflicting, outdated, rejected, and high priority;
- top programs, top categories, cost, and yield.

Every moderation action records actor, action, timestamp, reason, before state, and after state. Database triggers reject UPDATE or DELETE against moderation and promotion ledgers.

Canonical promotion is intentionally disabled in the production adapter until a real canonical evidence sink is connected. The local test store proves the verified-only promotion contract without allowing the staging table to masquerade as a live canonical fact update.

Visual evidence: `artifacts/browser/student-intel-admin.png`.

Status: **local browser/API verified; canonical promotion not live**.

