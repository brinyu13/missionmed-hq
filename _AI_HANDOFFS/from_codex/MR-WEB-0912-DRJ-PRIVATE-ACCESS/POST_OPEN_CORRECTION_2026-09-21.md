# MR-WEB-0912 DR-299 post-open correction

Status: `MR 2026-27 DR J PRIVATE EARLY ACCESS = LIVE AND VERIFIED`

Date: 2026-09-21 America/New_York

## Authority and BOOT

- Controlling authority: canonical `DR-299` at MissionMed OS tip
  `8f53f64d1769fd9653f96707e9ef992dfc936f04`.
- DR-299 public opening: `2026-09-19T12:00:00-04:00` in
  `America/New_York`.
- Canonical HQ guardrail SHA-256:
  `9638e67841e98b278244c0d4f9ecd0ccbdc7a9e17c50a67dd45d1d31895a0357`.
- Universal BOOT: PASS at HQ tip
  `0feee579b0a9f2c90529220899f6cf6d21b8cd05`.
- Exact `MR-WEB-0912` BOOT profile: PASS at the same HQ tip.
- Provider registry was clear for the two affected source paths. The only
  independently active lease observed was an unrelated IV Prep On-Call claim.

## Corrected drift

Production had been changed after the accepted DR-299 release to use a Monday,
September 21 private-access boundary. That did not match canonical DR-299 or the
Founder private-access UX steer. The correction restored only:

- server opening calculation: September 19 at noon Eastern;
- runtime `opens_at`: `2026-09-19T12:00:00-04:00`;
- dormant pre-open customer copy: Saturday at noon;
- private modal copy: Saturday at noon.

The landing page remains publicly browsable. Before the canonical opening,
enrollment intent was the gated surface, accepted access persisted through a
signed HttpOnly SameSite cookie, and signed resume tokens preserved the selected
offer/destination. After the canonical opening, the gate automatically returns
`public_open` and requires no code.

## Source custody

- Worktree: `/Users/brianb/MissionMed_worktrees/mr-web-0912-interview-week`
- Branch: `codex/mr-web-0912-interview-week`
- Correction commit: `e6e92a9201c07d745d59085a871c4d893f75eb68`
- Deployed PHP SHA-256:
  `4e481e2e0d62f386dad2e45ad9ef94fdd0e0b52782439f55bf37a8f6956c4d70`
- Deployed B script SHA-256:
  `51f56fd05ccaba2d21c72a8076ddee060102f1e0e477c17d128277d7a30457c8`

Only the DR-299 hunk in the already-dirty B script was staged and committed.
All pre-existing B report, alumni, calendar, schedule and untracked artifact
work remains unstaged and byte-preserved. The source branch is three commits
ahead of its remote branch and was deliberately not pushed because the two
preceding local commits contain broader commerce/schedule changes outside this
correction's canonical authority. This avoids silently publishing unrelated
history while preserving exact local/live custody.

## Recovery and leases

The same execution had already observed the current MyKinsta daily recovery
surface with a Restore control; no backup was created, renamed, deleted or
restored. The browser later returned to the MyKinsta sign-in screen, so that
earlier authenticated observation is not relabeled as a second readback.

Exact production preimages were captured before replacement at:

`/www/theresidencyacademy_209/private-backups/mr-dr299-public-open-e6e92a9/preimage/`

- PHP preimage:
  `0b6d8d731bf462a7eb99e7fa33c6d8b415b88ce120f089ec13b0f552df88343a`
- B script preimage:
  `5a4f10bde5640940cf630d44c15123fcc4ffbebce4023db8dfb02cff48f3e036`

The production replacement used `SHARED:ROUTING` lease epoch `3457` for the
two exact public paths and released it successfully. An earlier local-edit lease
epoch `3456` was also released successfully. Atomic same-directory replacements
preserved mode `0644` and the existing owner/group.

Rollback is the exact reverse replacement of only those two preimages, after a
fresh exact-path lease and hash readback. Do not restore the database or touch
products, orders, payments, users, courses or entitlements.

## Verification

- PHP syntax: PASS.
- JavaScript syntax: PASS.
- Diff check: PASS.
- Original private-access unit suite: `17/17 PASS`.
- Exact-boundary simulation: private one second before noon; public exactly at
  noon Eastern.
- Signed persistence cookie: PASS.
- Signed offer/destination resume token: PASS.
- Tampered cookie/token and off-site destination rejection: PASS.
- No raw `DRJ2026` value in deployed source: PASS.
- No backend seat/count gate in deployed source: PASS.

Live runtime readback:

- authority `DR-299`;
- mode `public_open`;
- required `false`;
- granted `true`;
- opening `2026-09-19T12:00:00-04:00`;
- public code disclosure `false`;
- price changes `false`;
- backend seat cap `false`.

Anonymous non-financial Woo verification:

- Interview Week `5504/5867 -> LearnDash 3646`, `$549`, checkout allowed;
- Complete `3576/5865 -> LearnDash 5227`, `$3,099`, checkout allowed;
- real Woo checkout rendered each correct product and amount;
- Stripe/card and terms links rendered;
- mixed IW + Complete cart was rejected with the existing inclusion guard;
- the post-open resume endpoint continued to the selected offer with
  `changes_price: false` and no code;
- no payment, order, refund, account or entitlement mutation occurred.

Rendered landing acceptance at 1440, 1024 and 390 target viewports:

- no private-access prompt;
- no `OUT OF STOCK` leakage;
- no mobile `use desktop` banner;
- no horizontal overflow;
- enrollment buttons enabled;
- mobile enrollment tap targets measured 54 px high;
- Complete visibly says Interview Week is included.

Analytics preservation:

- `GT-PJ7SPCWF` loader and inline `gtag` initialization are present;
- the landing URL preserved the QA UTM query;
- raw access-code values are not emitted by the bounded event source;
- no claim is made here about GA dashboard attribution or revenue events.

## Independent acceptance

Fresh independent read-only verdict: `APPROVE`.

At `2026-09-21T06:43Z`, the independent verifier repeated anonymous live
runtime reads and received identical `public_open` state with the exact DR-299
timestamp, no code disclosure, no backend cap and unchanged IW/Complete
identity, mapping, price and checkout-allowed values. Its logged-out rendered
readback found enabled IW and Complete controls, no private prompt, no
`OUT OF STOCK`, no `use desktop` leak, no horizontal overflow or console error,
and the explicit Complete-includes-IW/no-extra-charge copy. The verifier made no
cart, checkout, form, order or payment mutation. Its stated limitation is that
provider objects were confirmed through the live public runtime contract, not
an authenticated Woo database query.

## State delta and boundaries

Production delta: two exact source files, limited to the DR-299 opening boundary
and dormant pre-open copy. No Woo product, price, inventory, Stripe setting,
Zelle state, LearnDash mapping, order, user, payment or entitlement was changed.

`LIVE STRIPE FINANCIAL ACCEPTANCE = FOUNDER-WAIVED / NOT EXECUTED` remains
truthful. No live payment was submitted.

The current live page contains broader installment, schedule and testimonial
work that predates this correction and is not adjudicated or newly authorized by
this record. It was preserved rather than silently removed. Any later canonical
reconciliation of that broader state is a separate mission.
