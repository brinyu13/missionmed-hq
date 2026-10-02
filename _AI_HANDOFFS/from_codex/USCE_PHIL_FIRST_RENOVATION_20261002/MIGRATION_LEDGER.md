# USCE migration ledger

Reviewed local proposal: supabase/migrations/20261002160725_usce_phil_first_safety.sql
Frozen SQL SHA256: b5322488152cfb214ba1dca77f51a437ac411207c86d6c97e39a1eec65621778
Source commit: 2fa5b99bd5d374eed77614be3e68ae4c964bd72f
Actual provider version: 20261002131800
Actual provider name: usce_phil_first_safety
Statement count: 1
Single statement exact bytes match: true

Applied once through bounded MCP-managed deployment. Original proposed file remains immutable. Do not run ordinary db push or replay this checkout; provider timestamp mapping is the authoritative ledger. No history repair or direct schema_migrations write authorized. Post-apply catalog, grant, real-fingerprint and independent statement check pending.

Post-apply: four offer columns present, real88intakes/66offers fingerprints unchanged. Independent provider ledger SHA readback matches frozen SQL; catalog/grant review active.

## Independent-reviewed fix-forward applied once

CLI source supabase/migrations/20261002182503_usce_phil_first_fix_forward.sql; actual provider version20261002142841 nameusce_phil_first_fix_forward. One stored statement SHAf7cd9dce466e0d16453123e55bb451f2878c0ddecea6191ad31561bf5c1ecfee exactly matches3166 sourcebytes. Five USCE private tables ENABLE-onlyRLS and one admin_message clear assignment; no cron, policy, grants or business rows. Originalb532 safety SQL/20261002131800 unchanged. Preimage FIX_FORWARD_PREIMAGE.json captures73 priorversions/functions/ACL and non-QA rowhashes; after-state readback pending. Do not ordinarydbpush or replay/repair either source/provider timestamp mapping.

## Operations/payment forward correction applied once

```json
{
  "source": "supabase/migrations/20261002193404_usce_phil_first_operations_handoff.sql",
  "source_sha256": "97884ce076b591a93b67c799c775a0a920650e6968c246526676b5678440dfbf",
  "provider_version": "20261002162044",
  "provider_name": "usce_phil_first_operations_handoff",
  "stored_statement_sha256": "97884ce076b591a93b67c799c775a0a920650e6968c246526676b5678440dfbf",
  "history_count": 75,
  "prior_history_unchanged": true,
  "owner_acl_settings_unchanged": true,
  "exact_function_readback": true,
  "real_fingerprints_unchanged": true
}
```

Two existing USCE RPC replacements only. Preserved student DTO, service-only ACL, owners, search_path,74 prior versions/statements and non-QA88/66 fingerprints. Zero unresolved claims before apply and outbound-held healthy runtime. No business rows, grants, cron, replay/history repair or SQL rollback. Independent final post-apply review remains separate.
