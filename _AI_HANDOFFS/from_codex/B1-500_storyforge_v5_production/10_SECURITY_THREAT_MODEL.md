# StoryForge V5 Security and Authorization Review

**Review outcome:** `LOCAL CONTROLS PASS / PRODUCTION ASSURANCE BLOCKED`

## Protected assets

- student identity and verified 360 eligibility;
- private story text and immutable original;
- revisions, scores, classifications, question mappings, coaching history;
- private audio objects and metadata;
- mentor assignment graph;
- notifications and append-only audit trail;
- question import provenance;
- AI prompts/outputs and provider credentials.

## Trust boundaries

1. WordPress/LearnDash/WooCommerce eligibility issuer.
2. MissionMed HQ handoff/JWT issuer.
3. Matrix client.
4. StoryForge API.
5. PostgreSQL/RLS.
6. private R2 object store.
7. future AI provider.

Production is blocked because boundaries 2, 5, and 6 do not yet have StoryForge-specific ownership/configuration.

## Threats and implemented mitigations

| Threat | Mitigation and evidence |
|---|---|
| Client role toggle/forged role | No production role switch. Signed `app_role`; forged service role unit test denied. |
| Forged/expired token | JOSE signature, issuer, audience, expiry, UUID subject, and eligibility checks; tests green. |
| Revoked eligibility | Claim and current database profile must both be eligible; false claim closes reads and RPCs. |
| Private story enumeration | RLS returns zero rows by direct ID for all non-owner personas, including assigned mentor and admin. |
| Unassigned mentor access | Assignment is server/RLS enforced; list, direct ID, and crafted review probe denied. |
| Silent mentor edit | Base story DML revoked; mentor RPC never writes student text. |
| Original overwrite | Database trigger makes owner/original/created timestamp immutable; revision test green. |
| Duplicate RPC side effects | API uses `SELECT * FROM function(...)`; avoids volatile composite re-evaluation found during E2E. |
| Fake notification | Review mutation and notification insert occur in one transaction. |
| False mentor attribution | Actor comes from verified subject; two-mentor and co-mentor tests green. |
| Audit tampering | Authenticated update/delete not granted; trigger rejects owner-level update/delete. |
| Public storage/guessable URL | Only private S3-compatible presigned PUT adapter; no bucket means truthful 503. |
| Oversized/malicious import | Size/row caps, data-only parsing, malformed CSV error, formula warning, duplicate review, no embedded rendering. |
| Vulnerable parser | Two unsafe dependency choices removed; final complete npm audit reports zero advisories. |
| Client AI key/fake output | No client key; closed server endpoint; independent flags; unavailable returns an error, never canned data. |
| Error leakage | Unknown server faults return generic 500 copy; known gated/validation states are explicit. |
| Clickjacking/content injection | Same-origin CSP, frame-ancestor allowlist, no inline script/style dependency, nosniff, referrer and permissions policies. |
| Dev identity exposure | Fixture signer requires explicit flag, 24+ character secret, loopback request, and loopback bind. |

## Unresolved production risks

- The active HQ bridge drops the real `cam_entitlement`; production claim issuance is not implemented.
- No StoryForge Supabase project, current migration history, PITR, backup receipt, or credential is available.
- Mentor assignment synchronization has no verified owner.
- No private StoryForge audio bucket, lifecycle, CORS, retention, or malware policy is approved.
- Admin support access and retention/deletion/export/archive policy are founder gates.
- No staging identity/authorization test has run.
- No protected Matrix source integration or new runtime lock exists.

## Security verdict

`PASS` for the isolated authorization design and tested code paths.
`BLOCKED` for production security authorization and deployment.
