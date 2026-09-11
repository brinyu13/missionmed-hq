# P1-RISE-5012D Executive Status

Status: **LIVE — accepted**

The provider-neutral review factory has assigned a current final disposition to all 10,079 existing Parallel, Claude Opus, and Claude Sonnet claims. It promoted 2,820 approved-current source claims through immutable lineage into 2,593 current canonical facts without deleting or concealing provenance. Live RISE now exposes the approved facts in Program Files, central search, filter intelligence, research depth, and Sources & Freshness.

## Final production truth

- Canonical registry: 6,139 programs, 31 specialty tabs.
- Provider claims reviewed: 10,079; without a disposition: 0.
- Approved current: 2,820; approved historical: 48; researched not found: 597; superseded: 5,252; conflict: 181; insufficient evidence: 1,181; stale: 0; identity ambiguity: 0.
- Approved-current source claims linked and student-visible: 2,820; approved-current claims stranded: 0.
- Current canonical promoted facts: 2,593 across 939 programs.
- Research depth: Deep 341; Enriched 596; Basic 5,201; Pending 1; mutually exclusive sum 6,139.
- Live deployment: `b9955188-a221-4ea0-b785-6bc560b29a15` (`SUCCESS`).
- Live build: `rise_web_b8abd476daab`; active release: `rise_registry_2026-07-09_8fdb5afb84f6`.
- Final code commit: `64ccad6411c4d307887904646828f06cf6d44a7e`.
- Rollback target: Railway deployment `7343c8cc-476a-4c0a-a6c9-675a43a03348`.
- Tests: 174 passed, 0 failed.
- New provider spend: `$0.00`.

## Safety and acceptance

Anonymous access still redirects to WordPress login; direct catalog and operator-review APIs return 401. Forced RLS returns zero review/lineage rows to a non-admin runtime subject and allows the admin projection. The P1-RISE-5010 auth seam was not modified. Live WordPress confirms the safe test identity (user ID 416) remains a Subscriber enrolled in the 360 course (course ID 3893); authenticated student-experience preview passed Home, Find Programs, Program File, SOAP Explorer, My Programs persistence, and mobile/readability checks. No credential was reset or exposed to mint an unnecessary fresh student session.

The only observed non-attributable condition was the pre-existing optional Matrix profile endpoint intermittently returning 503 after its timeout. RISE degraded safely and all core features remained usable; this ticket did not touch that seam.

The two Child Neurology TX/FL on-demand canary holdouts (`1854831078`, `1851113100`) remain untouched and have no provider claims. The separate dropped-line/taxonomy finding was not broadened into this mission.
