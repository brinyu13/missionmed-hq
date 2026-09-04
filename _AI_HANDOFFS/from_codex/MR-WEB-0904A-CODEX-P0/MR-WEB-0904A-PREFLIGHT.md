# MR-WEB-0904A P0 preflight

Final verification timestamp: 2026-09-04T11:22Z (2026-09-04 07:22 EDT)

## Decision

Production mutation is stopped. A current encrypted local database/public-root recovery set and scoped Elementor/commerce exports now pass streaming restore checks. The hard gate is still unsatisfied because the MyKinsta session is logged out and no provider-native snapshot ID/timestamp or restore readback can be verified. The live purchase-to-entitlement path is also present but unsafe for guest checkout and refund/cancel behavior.

The work completed in this branch is therefore a bounded, non-production candidate correction plus an evidence package. It is not a live launch.

## Authority and custody

- Ticket: `MR-WEB-0904A-CODEX-P0-LAUNCH`
- Product worktree: `/Users/brianb/MissionMed_worktrees/mr-web-0904a-codex-p0`
- Product branch: `codex/mr-web-0904a-launch-p0`
- Product source commit: `676322509579e148691be5a5f959d7635c3fafe7`
- Canonical MissionMed OS registration commit: `c3e4eece19b5796f3e3a5bcc7abf070d8c027997`
- Authority record: `DR-180`
- Universal BOOT: PASS
- Mission BOOT (`MR-WEB-0904A`): PASS
- Registrar/BOOT tests: 13/13 PASS
- Registration release: PASS; provider readback showed no active registry lease
- Product PATH lease: acquired for the exact candidate, report, and screenshot paths used by this run
- GLOBAL lease: not used
- Supabase application/product-data writes: none; only bounded Lease V2 acquire, heartbeat, release, and readback operations were performed

The canonical registration used eight bounded files: `CURRENT.md`, `missions.json`, `authority_index.json`, `products_index.json`, `registry/boot_dependency_manifest.json`, DR-180, the Mission Residency Commerce passport, and its registration receipt.

## Required source reconciliation

The four named Cowork artifacts were absent from the product Git object but were recovered read-only from the dirty canonical checkout. They were treated as design/architecture input, not implementation authority:

- `MR-WEB-0903F-FABLE51-FINAL-FALL-OFFER-BOARD.md` — SHA-256 `85772b41c4aa3f83934193e94b5f241eb9b7ac776a3c03f90cd8f5f98afacd1`
- `MR-WEB-0903F-HANDOFF-CLAUDE-CODE.md` — SHA-256 `16c33c5f49b0360efc8a9bcf40a1becd6a0f4e792a509740e97aab8308005469`
- `MR-WEB-0902E-FABLE51-COMMERCIAL-ELEMENTOR-WOO-ARCHITECTURE.md` — SHA-256 `0678f73da7ca2156611ac65ed70ef1591d0317d3965b64a94027b8ba62bad235`
- `MR-WEB-0902E-HANDOFF-CLAUDE-CODE.md` — SHA-256 `52c674ea3551160d07be1283990e4458f7d3b10c626743a5923af9bc4bdb4c52`

The latest Claude/V3 candidate was inspected in place. It is a local static prototype, not a WordPress/Elementor/Woo deployment payload. The recovered `MR-1316` source was also rendered and visually checked across 18 pages; its v1.2 proof-density and anti-motion rules informed the bounded candidate cleanup.

## Worktree safety

The source worktree contained one unrelated tracked change before this implementation:

`supabase/.temp/cli-latest` (`v2.95.4` to `v2.116.0`)

It was not edited, reverted, staged, or committed by this task. The product changes do not overlap it.

The available preflight script correctly reported the worktree and branch, then crashed under macOS Bash 3.2 because it references an empty array with `set -u`. The run is not represented as a script PASS. Manual path, branch, status, lease, and no-overlap checks were performed instead.

## Live source and provider identity

- Public site: `https://missionmedinstitute.com`
- WordPress SSH root: `/www/theresidencyacademy_209/public`
- WordPress: 7.1
- Active theme: Astra 4.12.6
- Elementor: 3.35.9
- Elementor Pro: 3.35.1
- WooCommerce: 10.6.1
- LearnDash: 5.0.4
- LearnDash WooCommerce: 2.0.2
- WooCommerce Memberships: 1.27.5
- WooCommerce Subscriptions: 8.4.0
- WooCommerce Stripe gateway: 10.5.4
- WordPress timezone string: empty; GMT offset: 0
- Cache stack observed: Autoptimize, Async JavaScript, Flying Scripts, EWWW, and Kinsta MU cache components

Read-only access identified the live WordPress, Elementor, WooCommerce, LearnDash, Code Snippets, SSH, and R2 surfaces. No WordPress staging URL or current staging clone was found.

## Evidence correction and privacy containment

Three first-pass screenshots captured a private ChatGPT project instead of their labeled targets. They were invalidated immediately. The GitHub branch that briefly referenced them was deleted, the screenshots were replaced from clean isolated browser profiles, and the branch is rebuilt from source commit `676322509579e148691be5a5f959d7635c3fafe7` so the contaminated commit is absent from the published branch history. No screenshot in the final evidence set contains authenticated or private browser content.

## Hard-stop findings

1. The local encrypted recovery set passes restore-stream checks, but no current MyKinsta host snapshot or authenticated MyKinsta session was verified. DR-180 therefore remains FAIL.
2. The live MissionMed Hub has a custom Mission Residency product-to-course map, but it grants only on processing/completed, skips guest orders, has no refund/cancel/failed/subscription-expiry revocation, and does not use the official LearnDash Woo counter.
3. Official `_related_course` mapping exists only on product 3577; the active variable-product paths are not mapped per purchased variation.
4. A fresh controlled card purchase cannot be safely attempted before the snapshot and entitlement prerequisites are resolved.
5. Live BACS, Affirm, and Klarna are enabled without the proof required by the Founder directive.
6. The live 2.9% card surcharge/Zelle-waiver snippet conflicts with the approved P0 canon.
7. 360 and legacy installment products remain purchasable in code.

These findings trigger the explicit stop conditions before any production mutation.
