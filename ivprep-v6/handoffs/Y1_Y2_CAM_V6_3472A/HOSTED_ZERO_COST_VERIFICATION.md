# Y1-Y2-CAM-V6-3472A Hosted Zero-Cost Verification

Terminal state: `HOSTED DR KELLY PATH READY - WAITING FOR FOUNDER PHYSICAL TEST`

## Verified

- Canonical product implementation `c7aa071a05af4dbc89a6320bfbdb3bba1b42e772` is published on the 3440 feature branch.
- The exact IV Prep migration is applied to Supabase project `tufzqxeucfugdovtjyqk` as live version `20260816012608`.
- All six IV Prep tables have RLS enabled and forced. No anon/authenticated DML or runtime-RPC execution is granted. Service-role access is present.
- Railway HQ deployment `1e3be267-0a5a-4a2f-a197-baf78e48189b` and worker deployment `c99c2196-a63c-429b-a0fa-5df3ec9c3094` are `SUCCESS`.
- The isolated worker reports registered, Profile B, exact Dr Kelly agent `agent_9bdfc50ec0086043`, and `providerSessionsCreated: 0`.
- A freshly generated, short-lived signed WordPress handoff proved WordPress administrator `wp:1` can authenticate to hosted HQ and is admitted to IV Prep.
- The hosted IV Prep session reports `voiceEnabled: true`, `videoEnabled: false`, `founderPaidTest.enabled: false`, worker `READY`, and paid provider creation disabled.
- Anonymous requests to the IV Prep product and API receive HTTP `401`.
- The hosted HTML contains Delivery Intelligence and the hosted-runtime readiness surface.
- Focused repository validation is `218/218/0/0`.

## Zero-cost boundary

- Provider sessions created: **0**.
- LemonSlice credits consumed: **0**.
- OpenAI/LiveKit/LemonSlice session creation was not invoked.
- The durable database contains zero provider reservations and zero interview bindings.
- `paid_tests_enabled` remains `false`; the kill switch remains tripped with reason `not_activated`.

## Informational advisor findings

- Supabase reports six `rls_enabled_no_policy` INFO findings. This is the intended deny-all state for the closed canary gate. See <https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy>.
- Supabase reports one unindexed composite foreign-key INFO finding and three unused/new-index INFO findings. No IV Prep performance WARN was reported. See <https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys> and <https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index>.

## Next gate

The engineering path is hosted and ready. Video and paid creation stay fail-closed until the Founder separately authorizes the hosted physical test.
