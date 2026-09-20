# P1-RISE-5015 Executive Status

Status: LIVE AND VERIFIED

- Defect confirmed: the protected RISE registry was a frozen 6,139-program artifact and omitted current ACGME programs.
- Authoritative ACGME ADS Public Report 1 scoped universe: 6,219 current programs.
- RISE before: 6,139 programs / 31 specialties.
- Exact ACGME IDs missing before repair: 106.
- Added: 106. Final additive release: 6,245 programs / 31 specialties.
- Newly Accredited window: AY 2025-2026 and AY 2026-2027; 326 current programs.
- Potential identity drift requiring human review: 1,405 rows; no ambiguous name/location overwrite was applied.
- RISE-only rows absent from current Report 1: 26; retained and marked review-required.
- Paid research launched: no. New research queue: 106. Spend: $0.00.
- Live release: rise_registry_acgme_2026-09-20_50d08ea6f2da.
- Live build: rise_web_a250aa9db9a6.
- Railway deployment: b9111ae6-269f-4823-9265-85552ddab11e.
- Source commit: 68f2a29.
- Rollback source: 72dc2f5d39e97ba444dd3908129786bb3d6d46da.
- Rollback deployment: d0defe18-7de5-4879-9d50-f2cb201e6859.

No blocker remains for student discovery. The 1,405 ambiguous identity-drift candidates and 26 not-current rows are explicitly deferred to review rather than guessed or deleted.
