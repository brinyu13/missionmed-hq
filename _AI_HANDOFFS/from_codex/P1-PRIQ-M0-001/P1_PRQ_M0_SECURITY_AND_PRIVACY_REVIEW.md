# Security and privacy review

Pass: loopback-only dev server; dev auth must be explicitly enabled; role gates; body-size cap; no-store API responses; CSP/nosniff/frame denial; path traversal guard; restricted-data provider denial; public-personal default exclusion; raw input/output omitted from audit/model-run metadata; source evidence required; founder approval before student projection; test-only mock enforcement; RLS candidate without open policies.

Open: production OIDC/session wiring, durable DB/storage, signed media, malware scanning, provider contractual approval, CSRF/rate limiting, secrets manager, deletion jobs, and an independent security verification session. The local server is not production-ready.
