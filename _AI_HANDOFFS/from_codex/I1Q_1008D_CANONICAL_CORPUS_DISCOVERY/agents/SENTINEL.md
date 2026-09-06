# Sentinel — ecosystem safety

Verdict: **SIGNOFF WITH CONDITIONS**.

Cloudflare R2 object storage is abbreviated as R2 below.

Authorized: rate-limited GET/HEAD inventory; zero-retention JSON structure/hash analysis;
immutable query-only local database counts; new safe files inside this handoff.

Prohibited: raw transcript/title/identifier/location/speaker retention; credentials, cookies,
headers, tokens, or environment inspection; mutation/backfill-capable detail routes; direct
Supabase access before owner resolution; R2 listing without mediated authority; extraction
before scope, artifact, privacy, rights, and speaker gates.

Result: all live operations remained read-only; shared/runtime mutations were zero. The first
live attempt was stopped after a red-team edge case, before any receipt write, then rerun only
after repair and validation.
