# PSV administrator / current-360 access and Matrix menu deployment

Date: 2026-09-21
Mission: `PSV-PROTOTYPE-0001`
Authority: DR-311 through DR-315, DR-324, DR-326 and DR-327
Verdict: **PASS — LIVE**

## Live state

- Source: `6e156d25ea732e4e02241e369dd51a7a1bd47ff4`, pushed to `origin/codex/psv-prototype-foreman`.
- Canonical authority: MissionMed OS `dbb4578377d59069943aa3f5bb7a194742a40d8e`, including DR-327; universal and exact PSV BOOT both passed.
- Plugin: v0.6.1, schema 6, 25/25 deployed files, 22/22 production PHP lint.
- ZIP SHA-256: `3dfd140908de7b7acbde0e0472276a3bc54c92adf8c2bc0d25d76ec467d2f6f5`.
- Manifest SHA-256: `88bccc71bbe02af613c7b6eb0c7b72b1d8529bbdcb5d566388cc89c274575936`.
- Private package: `/www/theresidencyacademy_209/private/psv-deploy-6e156d2-0.6.1/`.
- Immediate preimage: exact v0.6.0 at `/www/theresidencyacademy_209/private/psv-rollbacks/PSV-0.6.1-6e156d2-20260921/live-retired`.
- Earlier v0.5.9 preimage: `/www/theresidencyacademy_209/private/psv-rollbacks/PSV-0.6.0-aa6df58-20260921/live-retired`.
- Access mode: `members`.
- Matrix menu: exactly one accessible `Program-Specific PS` link in the Match Tools list, immediately after File Vault and before RankList IQ; direct target `https://missionmedinstitute.com/?mmed_ps_proto=1`.

## Access contract and acceptance

- Administrators are authorized only by server-side `manage_options`.
- Non-admin MissionMed 360 students are authorized only by the canonical `mmhq_cam_build_entitlement()` claim when active, verified, trusted, current-access and revocation checked, unrestricted, unrevoked, unexpired and backed by verified LearnDash plus WooCommerce or the accepted verified current-LearnDash legacy mode.
- Roles, browser flags and stale historical enrollment do not grant access. Missing, malformed or throwing entitlement sources fail closed.
- Local access suite: 24/24. It covers off mode, explicit canary allowlist continuity, administrator, purchase-backed current member, verified legacy-current member, anonymous, inactive, refunded/wrong-status, unverified, untrusted, not-current, not-enrollment-backed, wrong authority, not-revocation-checked, restricted, revoked, expired, malformed expiry and provider exception cases.
- Disposable WordPress browser: current-360 member and administrator each saw one menu item; non-entitled user saw no menu, no entry script and no private app; direct navigation produced no provider call.
- Production server: administrator user 1 allowed; verified-current non-admin user 89 allowed; non-entitled user 43 denied; anonymous page/REST remain undisclosed and bootstrap returns 404 `rest_no_route`.
- Production population truth at preflight: 8 administrators, 444 verified-current non-admin 360 members and 513 non-entitled accounts.
- Live Chrome as `brinyu`: exactly one menu item appeared in the correct File Vault group; clicking it opened the live PSV app successfully. The page remains open for Founder use.

## Privacy and regression

- `MMED_PS_PROTO_ALLOW_REAL_ROOT_AI` remains undefined. Production testing constants remain undefined. DR-324 remains the only exact real-ROOT provider exception.
- Navigation caused no save or provider call. Provider attempts remain 16; latest attempt remains `2026-09-21 07:25:09`.
- Counts remain roots 4 / runs 27 / library 8 / audit 68 / edit revisions 2.
- Silma ROOT 4 remains `8ff9e2bbf5249e75e476068ab0586b466821f6d9ab6165e24e9ed812673a72e0`; independent verification also reconfirmed its nine paragraph hashes, five candidates and output hash.
- File Vault sentinels remain controller `e60b2695e7bed4e04497d0122c7dc3a5b45daca2f415f5fbac55dabc9f7bb424`, repository `a97842553c9c1d997d80903cb367b9ffba5c80a9967b6b3a5a43c5143c0f4896`, scanner `6b5cf0ebc99227e14f63a2d034c03f5beac591451314b8d55d15c57428f78a5a`, JavaScript `0a3caa654d9b6724270133e89b7cf6e7c6201eef449ddf8ca8067e43f1f8bdd9`, CSS `87c932a3b20b5e6b5351a5ee5bda08c0489bea5195df007cb0f70d6d21e9d9f2`; purchase MU plugin remains `621fe8131c8e9f86d63fd2da4b16dfc97f5b44344b101bc247b71a8ee260a7bd`.
- Public home/flagged route remain 200; anonymous bootstrap remains 404; unauthenticated RISE remains the expected 302. No new PSV or severe post-deploy log line was found.
- No Matrix Hub, File Vault, RISE, LearnDash, WooCommerce, membership record, shared runtime or provider configuration file changed.

## Guarded release and verification

- v0.6.0 was first promoted under released PATH lease epoch 3562. Live browser inspection detected correct access but placement in Matrix's first grouped list. Production Guardian used bounded fix-forward; no rollback was necessary because access and siblings remained healthy.
- v0.6.1 corrected only list placement by deriving the group from the existing File Vault anchor. Independent source review approved the exact delta.
- v0.6.1 was promoted under released PATH lease epoch 3565. Authoritative active PSV lease count is zero. One unrelated ExamPrep lease seen by the independent verifier was non-conflicting.
- Fresh independent production/server verdict: PASS, no P0/P1/P2 in verified scope. The verifier deliberately did not touch the shared browser; live placement/click is Foreman-observed evidence. The RISE probe is public-route regression evidence, not a new authenticated RISE acceptance claim.

## State delta

Production changes are limited to:

1. exact replacement of `wp-content/plugins/missionmed-file-vault-ps/` with v0.6.1;
2. PSV-owned option `mmed_ps_proto_mode`: `allowlist` → `members`.

Everything else is unchanged. The broad real-student AI privacy gate remains closed. STOP after this accepted access/menu release; do not begin unrelated PSV work.
