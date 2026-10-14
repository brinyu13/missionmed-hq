# MX-GX-20261013-001 RankListIQ Return rollback receipt

- Receipt updated UTC: `2026-10-14T20:30:35Z`
- Live target: `/www/theresidencyacademy_209/public/wp-content/uploads/2026/03/rank_list_engine_WORKING.html`
- Accepted production SHA-256: `c7690c76cf89fa717ac19b82d0db409c60ab20e84b00fd906a752b1cebc05a1a`
- Accepted production owner/mode: `theresidencyacademy:www-data`, `0644`
- Cache-busted public readback: HTTP `200`, same SHA-256
- Authorized temporary file: absent
- Forbidden canaries: four of four `404`

## Candidate 1 — rejected pointer interception

- Build: `20261014T131513Z-ga17b7f0e`
- SHA-256: `3820389dfc8ea941086eeccc6220cd66a6e6ebe26ab299896c6337982bfe11ad`
- Result: rejected because the initial onboarding/mode overlay intercepted the pointer target
- Recovery: atomic restoration to exact accepted SHA `c7690c76...`; public readback matched

## Candidate 2 — rejected iframe-contained navigation

- Build: `20261014T135730Z-gb7ec70fe`
- SHA-256: `1d69f632a4c79628697f2d6b1a8056d30d8087263b599d163974c1caa474f2ed`
- Private custody: `/www/theresidencyacademy_209/private/20261014T140338Z-dr435-gb7ec70fe/`
- Result: rejected because native activation navigated Matrix inside the RankListIQ iframe
- Recovery: atomic restoration from `rank_list_engine_WORKING.pre-return.html` to exact accepted SHA; public readback matched

## Candidate 3 — corrected package, acceptance unavailable

- Build: `20261014T142400Z-gb11d7f7b`
- SHA-256: `af13d903134babe7246f0e0ac41edf7820ef7698611dd9690e54fb5371a45df3`
- Private custody: `/www/theresidencyacademy_209/private/20261014T142400Z-dr435-gb11d7f7b/`
- Preimage: `rank_list_engine_WORKING.pre-return.html`, SHA `c7690c76...`, mode `0600`
- Reviewed candidate: `rank_list_engine_WORKING.reviewed.html`, SHA `af13d903...`, mode `0600`
- Result: corrected desktop top-level behavior verified in admin-only diagnostics; mandatory genuine-student acceptance unavailable
- Recovery: atomic restoration from the exact preimage; current provider/public hashes match `c7690c76...`; temporary path absent

All three non-accepted candidate packages remain evidence only. None may be
treated as an accepted production release without a fresh fence and the full
genuine-student acceptance gate.
