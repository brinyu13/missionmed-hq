# P1-RISE-5012A Executive Status

Date: 2026-09-09
Ticket: `P1-RISE-5012A-LIVE-PRODUCTION-BUILD-MODE`

The additive on-demand research control plane, durable queue/quota system, live admin controls, scoped student CTA, and isolated asynchronous worker are deployed in the real RISE production stack. The live canary used the Texas Child Neurology holdout with ACGME ID `1854831078`. It created one durable replay job, deduplicated repeats, completed as `NEEDS_REVIEW`, generated no canonical claims, used no network, and spent `$0.00`. The Florida holdout `1851113100` remains unused.

The system was restored to fail-closed after QA: global disabled, students disabled, emergency kill active. A real paid-provider run and its resulting shared hydration/filter proof remain pending explicit provider/model/budget authorization. No real provider was called.

- Final code commit: `4532feb5b1e1e698944f58f40a436d9de97ecc19`
- Branch: `codex/p1-rise-5007-private-beta-full-registry-student-intel`
- Remote divergence: `0 behind / 0 ahead`
- App deployment: `e12fed77-9e74-400b-ac7f-1b528d91ef0e`
- Worker deployment: `da51d547-fb40-4e69-b19d-6d0c8d82dede`
- Live web build: `rise_web_da1eaa04132e`
- Rollback deployment: `69049d35-9af9-451d-ada2-e9f864b8051f`
- Deployment status: `PARTIAL_LIVE` only because real-provider/shared-hydration acceptance is not authorized yet.

Founder action required: explicitly approve one provider/model and a bounded budget for Holdout A if the real research and shared hydration proof should proceed. No other Founder action is required.
