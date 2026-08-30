# Canonical Evidence Schema

Migration 007 is additive and creates release source-rights, canonical evidence sources, append-only claims, canonical program identities, provider ingest receipts, and a security-invoker current-facts view.

SHA-256:

- up: `cabd229e98679ef5bd0b5d4a0e23c3177dfa11b3613fa6a15aa2ebfc2a44f771`
- recovery/down: `a2174b463341e0dcf67a6352c245d74462e41de78b5852d34d54cc8382fa366e`
- unchanged migration 006: `0de4f62a5c7db17d3d5bd1919bb8cf280289c001e0dcb1fcc8fa70bc3736a260`

All new tables force RLS. Canonical sources and claims reject update/delete. Runtime projection admits only approved private-beta/student-visible claims; review-required and internal-only evidence remains admin-only. Provider receipts enforce `new_spend_usd = 0`.

