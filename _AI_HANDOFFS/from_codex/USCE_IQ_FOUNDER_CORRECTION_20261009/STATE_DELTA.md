# USCE IQ corrective release — state delta
Date: 2026-10-09, America/New_York
Mission: USCE-IQ-FOUNDER-CORRECTION-20261009 | Authority: DR413
Status: LIVE FOR DEMONSTRATION; final correction acceptance remains OPEN.

- Product source SHA: 9b7b44e006ef3135bfd634d3d4d263bb6ebd585b.
- Runtime deployment: 3fcfdde0-299e-49d9-8a97-2588af74ee86.
- Image: sha256:0011f640d27ea1327a03ccc874146e9d8199c681cc89c73dfb360f2d5c70437f.
- All21 runtime file hashes matched qualified candidate; only Offer HTML and Gmail normalizer changed from accepted runtime.
- Admin CDN SHA: f3ddeca644fcdbab4adae3e71682a225cb2668914645ff7125a7c95111a64919; guarded exact preimage/ETag publish, provider/public readback PASS.
- Applicant CDN unchanged: 335f76b0020dddf9f50d769f29d4a26d2e058a1a79b11af64d86292cadff45b5.
- Database migration: usce_iq_mail_relevance; provider history version20261009151557 maps to source20261009180230_usce_iq_mail_relevance.sql. Provider-generated version retained without history repair.
- All584 raw mail rows preserved byte-for-byte immediately after migration; all100 request IDs retained. RLS and existing service-only permissions unchanged.
- Current relevance:230 student,37 Needs Review,317 diagnostic; raw underlying messages retained.
- Focused91 tests PASS; private19 database assertions and compatible rollback PASS; isolated55 auth/runtime checks PASS.
- Independent source review APPROVE; independent public asset/health401/RLS/service ACL/relevance aggregate readback PASS. Reviewer:/root/v3_registry_review.
- Live Chrome Brian/brinyu session loaded real queue and Live protected status; demo tab left open at https://missionmedinstitute.com/usce-admin/.
- Photograph/nav correction is visibly live on Dashboard. Optional intro and password-free login/recovery modal are published; keyboard/expiry/reduced-motion behavior passed focused tests and private Chrome fixture.
- Email contrast fix is deployed, including narrowly verified recipient mailto styling and mobile layout. Corrected delivered Gmail desktop/mobile legibility remains UNVERIFIED; no new corrected test send is claimed.
- Phil actual supervised private login remains UNVERIFIED. No credentials attempted, stored or logged by implementation.
- Full live corrective end-to-end and final independent F/U/O acceptance remain OPEN; prior V3 acceptance stays protected.

Rollback: exact accepted admin preimage retained at release/rollback_usce_admin.html; accepted21-file runtime retained in prior V3 candidate_runtime_html_final and previous deployment282e00a2-df54-4b64-88a5-49185ee4d669; four original mail RPC preimages in mail-functions.preimage.sql. Private compatible rollback rehearsal PASS. No applied migration/history edit.

Interruption/lease: prior Railway renewal failed after upload initiation. Writes stopped; deployed candidate subsequently read back healthy with exact hashes. Expired ownership cleared (provider active_owned=0). CDN cutover used a fresh exact PATH+ROUTING lease and positively released. No repeated deployment or blind provider retry.

Next: supervised Phil private login; controlled fresh corrected Offer to info@missionmedinstitute.com and actual Gmail desktop/mobile proof; live Pipeline/Journey/Communications and final focused independent acceptance. Do not mark mission complete until these are satisfied. Do not touch the live demo tab while Founder presents.
