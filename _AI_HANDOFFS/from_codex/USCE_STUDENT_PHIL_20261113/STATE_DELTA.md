# Clinicals HQ student-to-Phil recovery · November 13

Status: partial release. Sole integrator chat 01a1d596-3ca2-7753-a455-e453cd232461. Founder explicitly corrected the earlier selection and authorized Option 1. DR-545 was independently reviewed, filed, and verified on MissionMed OS main at 6c6f6534762660ad1f251bd14e6c8ea673dda0ea. The universal and new mission BOOT profiles passed using the registered USCE registrar. Predecessor checkout and November 12 acceptance were preserved. The generated USCE Brain context pack was absent.

## Release evidence

| Surface | Application source | Serving SHA-256 / provider evidence |
|---|---|---|
| Student tracker | c6111d6489fdcf6dadbc5771a7ffd8e3eeedc958 | 953ec8fcaa63d4394542b5f37492ab9d005dcd4a8316dcc78176c3adf33764e1 |
| Student request form in WordPress | d6af12dd7e98283e193ba717760bf5a8b271296c | 114598cf319c89938eb77788a61b88fd5510ac4becb01c6d8daeb2cba20875e2 incl. exact versioned iframe URL |
| Clinicals HQ admin | 3bfbf8a0815f2acae1fb0bb11a56db25017feb35 | bb57f5db637f3063ab21b925d3a4519243c4d3c8fcda0cc83360823197124f1e |
| Dedicated gateway | 4723a0a30718348f58cddf53d3b9516c8496a57a | Deployment 30833832-c8dd-4720-835a-444da734624d SUCCESS. All 21 module/config hashes verified on service. Only routes/usce-public-intake.mjs changed, now 2ca1661977ecf1e5acb03ec23aeb659c661213f2d4bdad074d071f551ce10549. Health 200, preflight 204 with correct origin/headers, protected anonymous config 401. |
| Existing Offer page | November 12 baseline | 335f76b0020dddf9f50d769f29d4a26d2e058a1a79b11af64d86292cadff45b5 |

CDN publication required a reviewed source hash, immutable Git rollback bytes, matching R2 preimage and ETag, fresh routing fence, and provider plus public byte comparison. The first tracker upload exposed an edge transformation of a literal contact email. Read-only diff reconciled the encoded contact link and injected Cloudflare script. The independently reviewed correction used the existing runtime contact helper. Final provider and public contents matched exactly. No shared Railway deployment, database migration or mailbox authorization change.

Rollback for the complete frontend tranche: admin HTML from d578f06b555c84951c886e83ea21ef5e0df59c99, SHA 28aa37856e9293b434dd5eff620ea037f157782e5616a0eb237ed188083940f2. Student form and tracker from 358629fcec5b33331ca2f2420659222c405df80f, SHAs 96b3ac63bc70e9da57b2a2aaa6f1275d49d785c11cf3e618fb0822a4a673006e and e7008f9ae292cb120cad136ba7dfe0850ba725df08b7657063105d5d2b1efd86. Immediate pre-switch form at b12dbfa7671d8c4b52a196505629d1eee17670ec. Prior dedicated runtime 3fcfdde0-299e-49d9-8a97-2588af74ee86 and complete 21-file rollback source/manifest checked before deployment. Reverting the form routing alone restores the old intake-notification recipient defect. Require new fences, exact current preimages and routing review before rollback. No live rollback performed.

## Outcomes

1. Student tracker truth: PASS for public/negative-state correction. Live fresh visitor saw account and contact choices without receipt, timestamp, store or progress board. Removal of the one-hour review clock, no false success on empty/error, and distinction between provider acceptance and delivery verified on exact source with fixtures. Authenticated student acceptance is open.
2. Student request experience: BLOCKED for complete live acceptance. Fields, step and preferences recover in tab-scoped session storage for 30 minutes. A confirmed stored response shows the student’s email and real request ID and stays visible. Unsupported/bare/dry-run success does not produce a receipt. Protected retries preserve key and payload. Storage-denied restore after refresh is unavailable. Live normal WordPress entry preserved an unsent synthetic name through refresh. Synthetic receipt/reload, validation and retry exercised in browser fixtures only.
3. Student Offer access: BLOCKED. Secure email portal is established. Direct signed-in tracker-to-Offer access and the currently serving student session handoff require repair and genuine student-role verification. Bare shared-host student relay returns 401 JSON. Opening My Account alone does not establish tracker authentication.
4. Phil message triage: PASS for current queue. The authenticated WordPress admin screen displayed “Possible student replies (3)” above “Intake notices (34)”. Underlying 37 retained. Three external replies lack verified case linkage even after following available RFC parents and comparing recorded dispatch references. Do not attach by subject, Gmail thread or student email alone. No mail, assignment, or read-status write during that check. This admin session was not Phil.
5. Phil admin usability: BLOCKED for full scope. The context-bound composer and saved-vs-unsaved copy are released. Tests verified no prior-student carryover, same-case draft recovery and exact preview/recipient approval. Remaining native dialogs, field error recovery, typography and full mobile walkthrough remain open.
6. Task-first home: BLOCKED. Approved Dashboard, Pipeline and six-step Journey retained. Administration shell requires remaining association work and a separate verified visual comparison before material visual departure.
7. Clinicals Gmail to website: PASS for existing verified incoming-reference path. Runtime's delegated profile confirmed exact primary address and system SENT label. Mail-sync state current after deployment, backfill complete, no recovery/error, 100 request records retained. Two verified incoming messages and 361 distinct stored Gmail identities were observed before release. No new Gmail-to-website synthetic replay in this tranche.
8. Website to Clinicals Gmail Sent: BLOCKED. Existing reader scope is gmail.readonly. Postmark is the accepted transactional provider. A restricted provider query found zero Sent matches for the checked historical QA outbound RFC ID. Real Gmail copy insertion, readback and thread proof require an authorized write grant. Google documents non-sending messages.insert and automatic SENT for an insert with the mailbox owner as From. No scope expansion or insert was performed.
9–10. Phil personal Gmail in both directions: PENDING AUTHORIZATION. Requires his explicit OAuth consent and a narrowly defined Clinicals-only ingestion filter. No personal-mailbox access.
11. Complete synthetic journey: PARTIAL. Public and administrator observations described above; no new synthetic intake/Offer delivery/response loop or placement was performed. The Founder-supplied misspelled identity remains unverified. The known Info mailbox is a historical controlled recipient, not evidence of a currently authenticated student browser.
12. Independent Fable review: BLOCKED. Current Claude Code catalog did not list claude-fable-5-2. Independent non-builder source reviews and synthetic checks were obtained for the released slices. The November 12 review used Sonnet 4.6. The separate November 13 original review was not located; the attached Founder summary was available.

## Original findings and evidence

| Finding | Classification before repair | Disposition |
|---|---|---|
| A false tracker receipt | LIVE REPRODUCED | Anonymous live retest passed. |
| B buried replies | LIVE REPRODUCED | 34 notices and 3 candidates visually separated in production. |
| C form refresh | LIVE REPRODUCED | Normal WordPress entry recovered the unsent value. |
| D vanishing confirmation | SOURCE CONFIRMED | Timed navigation removed, positive browser fixture verifies receipt survives reload. |
| E direct Offer action | SOURCE CONFIRMED | Still open. |
| F inferred review timer | SOURCE CONFIRMED | Timer removed; actual status/events determine display. |
| G confusing account requirement | EXPERT JUDGMENT | Shared relay 401 live; role journey pending. |
| H errors difficult to notice | EXPERT JUDGMENT with SOURCE CONFIRMED transient paths | Journey validation can persist; remaining field-level work open. |
| I recipient carryover | SOURCE CONFIRMED | Corrected and regression-tested. |
| J front-door consistency | EXPERT JUDGMENT | Student and Phil role walkthrough pending. |
| K task-first navigation | EXPERT JUDGMENT | Current dashboard already has actions; default task view outstanding. |
| L disappearing errors | SOURCE CONFIRMED for toast-only paths | Some error regions already persist; broader work open. |
| M small typography | SOURCE CONFIRMED for secondary controls | Composer status enlarged; full review outstanding. |

Request backend replay treatment: only successful durable writes return confirmed receipt; the DB cold-cache replay path verifies the exact ID and normalized email, suppresses repeat notifications, and avoids resending after ambiguous provider acceptance. The corrected Phil notice uses generic text and the admin entry, without applicant details. No test sends were made. The old shared service still contains the mismatched address, but the actual WordPress request form now uses the dedicated corrected route. Old open browser tabs may retain the previous asset until refreshed. The deployed change does not add a durable per-recipient notification outbox for crash recovery.

Verification: 136 related admin/mail/Journey tests, 3 student browser regression tests, and 34 intake/recipient tests. Focused independent non-builder review preceded each publication. Live source/role/provider limits are reported above. Future controlled submissions need scoped QA recipients, exact synthetic account identity, and guarded cleanup. Remaining next action is to verify the authorized student sign-in/handoff path with a MissionMed-controlled synthetic student before running a complete synthetic journey.
