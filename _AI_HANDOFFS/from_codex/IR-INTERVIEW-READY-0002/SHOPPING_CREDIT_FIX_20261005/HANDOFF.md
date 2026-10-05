# Shopping credit fit — bounded CSS follow-up

Prepared at HEAD `64c011e5c74a14412f8bd277dfbe419534457f0d`; canonical product35 unchanged. No commit, server, browser, provider, account, lease, deployment, or canonical source operation performed. Root controls independent CSS review and actual browser acceptance.

Root actual ChromeQA at 1280 CSS px found the Canon credit bottom 602.93 greater than figure bottom/title top 583.76, about 19px overlap; the badge was partly covered. Three fixed 190px photo grid-row declarations were the concrete constraint. This follow-up replaces only that row's `190px` with `minmax(190px,auto)` in the ordinary shopping grid, desktop subgrid parent, and mobile shopping grid. The 190px minimum remains, while intrinsic photo/credit content can grow the row. Desktop cards still inherit common parent subgrid rows. Typography, photograph size, credits/content, JS/account/actions/buttons/motion and other rows remain byte-identical to the original patched candidate.

Combined lineage: accepted product `8717ebd04ad1cd60e66ef197b55080d58492e2be` → approved original patch `04d6169e7debb4a082ea617f53dd84056c589b0e75c5f462a4b05c63a2de3bae` (fixed independent review `9594394c6f99a71a788f7a8ec55efb4a0629184a5441058db32d19f37301b3c3`) → `credit-fit.patch`. Follow-up applies AFTER the original patch and changes only interview-ready/completion.css, with three tiny substitutions. Neither old patch/review nor previous QA copy was edited.

New local entry: `/private/tmp/ir-shopping-credit-qa-20261005/output/interview-ready.html#online/webcam`.

Executed:

```text
python3 -B _AI_HANDOFFS/from_codex/IR-INTERVIEW-READY-0002/SHOPPING_CREDIT_FIX_20261005/prepare.py
```

The copied deterministic prep script retains the exact archive `a93cb2e0be061ca1a1558640f0db3030a6aab8e26c4bcb71f52504b7caf413c3` / release-manifest / immutable accepted Git and canonical35 before-after checks. No symlinks; independent regular copies to a previously absent scratch path. Both patch apply-checks PASS; follow-up changes exactly one scratch file. Actual unchanged build.py uses production asset allowlist (`--asset-profile production`, no release approval), preserves null account context and real personal-tool gate. Production image hashes/paths and all non-CSS source bytes retain original custody. Python compile and existing JS Node syntax checks PASS; actual build PASS. Original JS has no delta; no new synthetic suite run.

| Artifact | SHA-256 |
| --- | --- |
| credit-fit.patch | `1abbca995665d2ea9785a08bc8dac27c47ca1d9208a97f5e72794eb139dbd126` |
| prepare.py | `ab7ac0f520197a50661f0472d9fdf4e62fa85b82705a6b5872ca6339e38d7c31` |
| PREP_RECEIPT.json | `4364b0bbb8e0122f8f618501b9fbf81d4a50f0394309b1640b4301f4dcc07cee` |
| Follow-up completion.css | `a67582781c735c56769092149a4de47394402fac7e306d87f682623f24197fd4` |
| Original patched completion.css preimage | `cb0ea8d37ba1c6ad86d05aea0762459429369c8b312d0283afa29d73f0363ec6` |
| Output account-gate.html | `da79845723120e8e451b96121c5fe5d9ccd5c2a3ece6c20b5279e252fa6319ff` |
| Output build-manifest.json | `7751db232f4e6ffea8988033fd7ef03b24255dde937a51d417ccf65fa2105814` |
| Output interview-ready.html | `a84e8c2e0cf1dabc750e0a203e46c674d75229834ac1d912b2b8aa33015d0aab` |
| Output matrix-entry.js | `238d936904fce777174f22fb352e99fce118192ca9a469be392246c6a65366ad` |

PREP_RECEIPT.json carries exact combined lineage and all 35 scratch input hashes. Canonical35 unchanged before/after PASS; previous QA HTML remains `5789a79e2090e12b65ced713bd13148dead564c81a5e7655d7e505317a72a2d6`. Build releaseApproved remains false. No images or commerce facts were added or regenerated. Actual credit/badge overlap correction, equal desktop heights, responsive appearance and keyboard/browser acceptance remain for Root's new browser verification; successful compilation/build is not visual proof. No authenticated account persistence or SOURCE integration acceptance is claimed. STOP.
