# V3 additive migration ledger

Project: fglyvdykwgbuivikqoah. Source `supabase/migrations/20261009090305_usce_v3_communications.sql`, SHA256 `a5865fcafb82b379605fd5b3f5865e4010ee765c64f0a7497eb73942451eade8`. Actual provider version `20261009054154`, name `usce_v3_communications`. One exact statement; statement MD5 `d10a399f3c091692b599619da5b394e7`. Timestamp difference is provider-assigned identity; never replay or repair history.

75 preexisting migration versions/names/statement-array hashes remain exact; current total76. Existing98 intakes/75 offers/242 communications and0 outbox rows were fingerprint-identical immediately after DDL. See migration/PREIMAGE.json and live_qa/MIGRATION_POSTAPPLY.json. Subsequent controlled QA and authorized mailbox sync add legitimate records. Service-role-only RPC ACL, empty search_path, and RLS verified. Existing Offer claims, approvals and sender restrictions preserved.

Forward-only additive change. Retain private data and audit rows on runtime rollback. No destructive down migration.44 PostgreSQL rehearsal assertions and41 mail contract tests passed;5 root integration tests and55 actual-closure gateway boundary checks passed.
