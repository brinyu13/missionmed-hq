# PSV Production Unlock — Guarded Deployment Report

Date: 2026-09-21  
Mission: PSV normal production graduation  
Authority: DR-331  
Worktree: `/Users/brianb/MissionMed_worktrees/program-specific-ps-engine`  
Branch: `codex/psv-prototype-foreman`

## Outcome

PSV is live as a normal production product for authenticated administrators and current MissionMed 360 members. The obsolete canary/hash-tuple/synthetic-only restrictions are retired from the normal path. An entitled owner may intentionally select, upload or paste a ROOT, confirm the Program Answer region, and use the dedicated PSV OpenAI provider with the complete ROOT as read context. Only the confirmed region is writable.

The protected security model remains intact: owner isolation, entitlement, nonce/session checks, ROOT hash/version integrity, exact region snapshots, protected-paragraph equality, evidence grounding/provenance, unsupported-claim blocking, audit-without-prose, provider limits, retry/idempotency, similarity protection and rollback.

## Authority and source custody

- Canonical MissionMed OS: `255b5ec0fe1ad9de0cb3b23fe1176579adcc7d8c`
- MissionMed HQ dependency: `0feee579b0a9f2c90529220899f6cf6d21b8cd05`
- Authority: DR-331; universal and exact PSV boot validation PASS
- Exact pushed source: `d9e2085915b35e81587bc42541d46b4bf33fcbf7`
- Plugin: `missionmed-file-vault-ps` v1.0.0
- Release ZIP SHA-256: `62def8e6677a5673ba1a940c566d45853310ce26d2f133e0f3bfa653628b674f`
- Release manifest SHA-256: `ebf00225f14fc8fc4ea5bfe1186d5b90528583325aa13951965680ba86d58dec`
- Exact deployed main-file SHA-256: `023b3ae939b5cd2ef18bd695a314c618c4e711b5f2cdfcad976ceee8f2ea76be`
- Exact deployed file count: 25; production PHP lint: 22/22 PASS

## Production configuration

- Access mode: `members`
- Administrator path: allowed through `manage_options`
- Student path: strict canonical current MissionMed 360 entitlement
- Anonymous PSV REST: HTTP 404
- Dedicated OpenAI key: defined and nonempty by boolean-only inspection; value never inspected, printed, copied or recorded
- `MMED_PS_PROTO_ALLOW_REAL_ROOT_AI`: UNDEFINED
- Production testing flags: UNDEFINED
- Synthetic ROOT: internal diagnostic path only, not normal student UX

## Verification

Local release gates passed:

- PHP lint 22/22
- PHP contract/runtime files 14/14
- Disposable WordPress API 131/131
- Candidate-review browser 41/41
- Upload/session browser 6/6
- JavaScript syntax, JSON validation and `git diff --check`

Live owner-scoped acceptance passed:

- Existing real ROOT and confirmed region restored without a canary warning
- Real RISE program selected
- Deep correctly failed closed to Research Needed when evidence was insufficient
- Essential generated five valid grounded candidates through `openai-responses`
- One initial transport failure remained auditable; a bounded retry succeeded as run `ac52f1a3-f6c6-4a50-8555-cb6cc7a1439a`
- Inline Previous/Next cycled all five candidates without a save or provider call
- Right-rail selection and Compare All stayed synchronized
- Hydrated inline switching preserved the viewport
- Direct edit affected one region only; changed prose disabled approval and removed inherited grounding until revalidation; discard restored the immutable AI candidate
- ROOT integrity proof: 13 parsed paragraphs, one authorized region, 12 protected paragraphs unchanged
- Approved document `fe3504e4-2390-4ea9-b0cf-2e252ce46320` matches its stored document hash and the ROOT hash recorded in its metadata
- Library advanced from 8 to 9 only after explicit approval
- Owner-scoped DOCX generation succeeded at 5,105 bytes; individual download control was exercised
- Selected and Download All paths remain covered by the unchanged production export implementation and release suites

No student prose appears in this report.

## Regression sentinels

- File Vault code/data: no mutation
- RISE code/data: no mutation
- RISE production health: HTTP 200, service `missionmed-rise`, registry `rise_registry_acgme_2026-09-20_50d08ea6f2da`, source rights current
- Protected File Vault controller SHA-256: `e60b2695e7bed4e04497d0122c7dc3a5b45daca2f415f5fbac55dabc9f7bb424`
- Protected File Vault repository SHA-256: `a97842553c9c1d997d80903cb367b9ffba5c80a9967b6b3a5a43c5143c0f4896`
- Protected File Vault scanner SHA-256: `6b5cf0ebc99227e14f63a2d034c03f5beac591451314b8d55d15c57428f78a5a`
- Recent production logs: no PSV fatal, parse, uncaught or inert line
- Public home/login: HTTP 200; logged-out private PSV namespace: HTTP 404

## Lease and rollback

- Deployment PATH lease: epoch 3602, ID `bb86a812-82f3-48e8-bc0f-e08b02804c63`
- Lease released; fresh active PSV-path and registry lease count: zero
- Exact rollback preimage: `/www/theresidencyacademy_209/private/psv-rollbacks/PSV-1.0.0-d9e2085-20260921T1440Z/live-retired`
- Rollback remains scoped to the PSV plugin directory; File Vault and RISE are excluded

## Independent verification

Fresh post-deployment independent read-only verification is dispatched. Its final verdict is the remaining sealing record; no further production mutation is authorized or required by this report.
