# PSV candidate-review mastering — guarded deployment report

Status: DEPLOYED; AUTHENTICATED LIVE UI ACCEPTANCE PENDING BRINYU SESSION.

## Outcome and exact custody

- Founder-approved Astra presentation implemented in the same PSV worktree under DR-326. No architecture, generator/prompt, RISE or File Vault changes.
- Source: `cbcda565d97492e02ac2c86bfb01f9c4e5dcb6ea`, pushed to `origin/codex/psv-prototype-foreman`.
- Live plugin: v0.5.9; isolated schema6; 25/25 deployed files match the exact package; 22/22 production PHP files lint.
- ZIP SHA256: `5e350af847952a057d0494b15dee097af477a220bd504c95b908bb3482c2acd6`.
- Manifest SHA256: `ed90701843b67629bf44dea3a9f7f8ba82dc4fe97f36a5425464169858473240`.
- Private package/manifest: `/www/theresidencyacademy_209/private/psv-deploy-cbcda56-0.5.9/`.
- Exact prior code: `/www/theresidencyacademy_209/private/psv-rollbacks/PSV-0.5.9-cbcda56-20260921/live-retired`; additional checked copy at sibling `preimage`.
- Canonical authority: DR-326, MissionMed OS `9c178bfd2bd78f25e11bbad61d0e1bfa2e3cb15f`; refreshed PSV BOOT PASS against HQ `0feee579b0a9f2c90529220899f6cf6d21b8cd05`.
- Production PATH lease epoch3530 covered staging, exact rollback, plugin promotion and native schema/synthetic revision verification. Keeper stopped; release performed; authoritative PSV active count0.

## Presentation and edit behavior

The Program Answer owns inline Previous/Next navigation. All five candidates swap locally without remounting protected ROOT paragraphs. The compact Writing Choices rail shares selection; Compare All and Evidence & Checks are secondary dialogs. Smaller widths use a native inline choice selector. Keyboard radio navigation, dialog Escape/focus return, reduced-motion and unsaved-edit guards are included.

Manual edits use a separate owner-scoped immutable revision API/table, not candidate-save. Original AI outputs and provenance remain immutable. Changed wording drops original grounding annotations and remains a private, unapproved draft. Only exact restored AI text can currently pass the deterministic grounding path; no semantic AI editor/provider call was added. Final library approval revalidates the exact current revision under an owner run/ROOT transaction lock. Canary library approval/save remains disabled.

## Acceptance evidence

| Check | Result / boundary |
|---|---|
| Existing disposable WordPress API regression | 126/126 PASS |
| Candidate-review browser suite | 41/41 PASS; synthetic harness, not live Founder session |
| Five choices, wrap, rail, Compare All | PASS locally; live replay pending |
| Navigation network behavior | Zero writes locally; no generation/save action in switching source |
| Viewport stability | <=2px anchor movement locally at1440/1024/820/390/320 CSS-pixel widths |
| Protected paragraphs and mounted DOM | PASS locally throughout switching, edit/discard/restore and resizing |
| Keyboard/responsive | Arrow/End, Escape, focus behavior and no horizontal overflow PASS locally; 720 CSS-pixel layout models200% at1440; actual browser zoom/physical mobile keyboard not claimed |
| Revision/security runtime | 51 assertions PASS |
| Transaction/concurrency runtime | 13 PASS, including two-process SQLite contention and MySQL engine/locking branch |
| Exact real-ROOT canary gate | 10 PASS |
| Sibling version collision/duplicate inclusion | PASS in dedicated bootstrap regression |
| Native production MySQL | 13 PASS: schema6, private write/idempotency/CAS, unverified approval denied, restore/history, immutable run, cross-owner denial, canary capabilities |
| Live authenticated interaction | BLOCKED: Chrome currently holds a non-admin account, not brinyu; PSV correctly hidden. Separate Founder session requested; no other live-test account logged out |
| Independent production verification | APPROVE WITH CONDITIONS: server verification PASS; authenticated live UX pending. Independently rechecked25/25 source, schema, revision/isolation, privacy, canary/protected output, sibling sentinels and logs |

Native synthetic smoke used existing run `b6b4cf46-d0ad-4184-9825-18ddaf03d44a`. It created private SAVE revision `89f758dd-7f1f-4e19-9455-cf27f7f07a1c` and RESTORE revision `36967421-f183-41bb-bdf9-0cc0751dc11d`. The restored text equals the immutable AI original. No new generation or library document was created.

## State delta and privacy

| State | Before | After |
|---|---:|---:|
| Plugin source | v0.5.8, externally made inert | v0.5.9, loads normally in native WordPress runtime |
| Schema | 5 /10 tables | 6 /11 InnoDB tables |
| ROOTs | 4 | 4 |
| Runs | 27 | 27 |
| Library | 8 | 8 |
| Audit | 66 | 68 |
| Provider attempts | 16 | 16 |
| Private edit revisions | table absent | 2 synthetic-only, original restored |

- Dedicated project key checked only for defined/nonempty; no value read into tool output, copied, logged, committed or changed.
- Broad `MMED_PS_PROTO_ALLOW_REAL_ROOT_AI` remains UNDEFINED. Production testing flags remain undefined; allowlist/admins0 unchanged; brinyu remains user1.
- Silma ROOT4 and run `9b7925e4-f2b3-45d2-90bd-7b0717527a50` unchanged. ROOT hash `8ff9e2bbf5249e75e476068ab0586b466821f6d9ab6165e24e9ed812673a72e0`; all nine paragraph hashes equal preflight, including protected1–7 and9. No Silma edit/save/approval occurred.
- Five-candidate output hash before/after: `91f7cf8f8341c359d338fe869fe070814b736c25731e910225161c7ac119b9de`.
- No new ROOT/provider transmission or RISE transport change. No wider real-student rollout.
- Existing library count unchanged; all eight stored text hashes valid and timestamps predate deployment, independently verified. Local byte-preservation tests PASS. A fresh pre-deploy aggregate library-byte hash was not captured, so that specific proof is not claimed.

## Regression sentinels and unexpected integration finding

Fresh preflight identified legitimate newer File Vault owner custody `9ba360b294436ef4860a25c07043fd512316eb61`. These exact fresh hashes were unchanged after promotion:

- Controller: `e60b2695e7bed4e04497d0122c7dc3a5b45daca2f415f5fbac55dabc9f7bb424`.
- Repository: `a97842553c9c1d997d80903cb367b9ffba5c80a9967b6b3a5a43c5143c0f4896`.
- Scanner: `6b5cf0ebc99227e14f63a2d034c03f5beac591451314b8d55d15c57428f78a5a`.
- JS: `0a3caa654d9b6724270133e89b7cf6e7c6201eef449ddf8ca8067e43f1f8bdd9`.
- CSS: `87c932a3b20b5e6b5351a5ee5bda08c0489bea5195df007cb0f70d6d21e9d9f2`.

Immediately before mutation, a new purchase-confirmation MU plugin was found defining the same global `MMPS_VERSION`, preventing old PSV loading. This was not caused by the UX deployment. The bounded PSV-only fix uses `MMED_PSV_VERSION`; the sibling remains byte-identical at SHA256 `621fe8131c8e9f86d63fd2da4b16dfc97f5b44344b101bc247b71a8ee260a7bd`. No cache reset, global WP-CLI repair or sibling alteration was performed.

Public home200, anonymous PSV bootstrap404 and unauthenticated RISE302 remain intact. Authenticated File Vault/RISE replays are not claimed from these public health checks.

Independent verifier examined290 timestamped debug-log lines from09:03UTC through09:07:49; zero PSV error lines. No production writes, provider calls or browser-session changes were performed by the verifier.

## Rollback and next action

Use the documented prototype disable ladder and exact private preimage on a PSV-caused regression. The prior v0.5.8 copy is a **safe inert baseline**, not functional restoration, while the sibling constant collision exists. Preserve all tables/history; no purge or sibling rollback is authorized.

Remaining action: regain a genuine brinyu browser session, replay the focused live acceptance criteria without saving or generating Silma content, obtain the independent final live verdict, leave Paragraph8 review open, then STOP for Founder acceptance. Do not declare the live UX fully accepted before those checks. No unrelated PSV continuation is authorized.

A separate visible in-app WordPress login is open at the official `wp-login.php` with a redirect to `/?mmed_ps_proto=1`, marked for handoff. The other Chrome account/session remains untouched. No password was inspected or supplied.
