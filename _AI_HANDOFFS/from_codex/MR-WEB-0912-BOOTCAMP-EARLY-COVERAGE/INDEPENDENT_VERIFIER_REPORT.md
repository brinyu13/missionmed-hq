# MR-WEB-0912 Interview Bootcamp Week + Early-Interview Coverage

## Fresh independent verifier report

**Verdict: BLOCK**

**Reason:** nine scoped controls were either independently verified or, for rollback custody, explicitly left UNVERIFIED; however, the mandatory stale-terminology condition fails. The live landing-page upsell/intercept modal still displays the customer-facing label **`INTERVIEW WEEK`**. This is not an internal key, URL slug, or historical record. It is visible after a customer chooses the Bootcamp path. Therefore the release does not satisfy “no current customer-facing old `Interview Week` remains.”

Date: 2026-09-28 America/New_York  
Verifier role: fresh read-only independent verifier  
Verified source commit: `20de32367cc9a653a5916050f9023831f396632c`  
Branch/HEAD at verification: `codex/mr-web-0912-interview-week` / `20de32367cc9a653a5916050f9023831f396632c`

## Scope and non-mutation statement

This verification was read-only. I did not change production, source, WooCommerce, LearnDash, Supabase, Git, caches, orders, users, entitlements, products, prices, mappings, or analytics configuration. I did not submit a checkout or payment.

**No live payment was required or submitted in this terminology/benefit-only release.** DR-337 expressly says that no payment submission is required or authorized, and DR-336 permits reuse of the accepted September 21 controlled lifecycle evidence because this release does not change payment, account, or entitlement mechanics.

The pre-existing unrelated dirty/untracked worktree state was observed and left untouched. The only file created by this verifier is this report.

## Evidence independently examined

- Canonical DR-337 and its registration at remote MissionMed OS commit `92e64210ce49eb12d08c39263b073cea17bca731`; remote `main` resolved to that commit. DR-337 SHA-256 as recorded by the builder: `1a9de53ad2f908b84f3be72710ded0a11976d2c2d503c9b305eaaaab6f6e7b94`.
- Canonical DR-336 at the same remote commit for the preserved commercial, schedule, analytics, and no-new-payment boundary.
- Exact product source commit `20de32367cc9a653a5916050f9023831f396632c`, its eight-file delta, and current local hashes.
- Live public pages and live `wp-json/missionmed/v1/mr-0912-config` runtime readback.
- Independent anonymous browser checks at `1440x1000`, `1024x900`, and `390x844` across the landing, Bootcamp product, Complete product, comparison page, and homepage.
- The live landing-page Bootcamp-choice intercept modal, opened without entering checkout.
- Live GA4 request construction and dataLayer contents while blocking the outbound GA collection request.
- Builder evidence JSON `evidence/BOOTCAMP_PRODUCTION_QA.json` (SHA-256 `dd946a59d44566b8f83b6c45cb75e3f2aae71a042041183d3597b99a844ddf58`), its QA harness, Woo-copy script, and all supplied screenshots.
- `MR_BOOTCAMP_EARLY_COVERAGE_FINAL_REPORT.md`, `PRODUCTION_QA.md`, `ROLLBACK_PREIMAGES.md`, `STALE_STRING_CLASSIFICATION.md`, and `STATE_DELTA.md`.
- Live public bytes for the seven web-addressable release assets. Their SHA-256 values exactly matched the local commit and the deployment ledger:
  - `campaign-state.json` — `97ee646a66e16ed3ae52af82557f0cf30ad5ab095d43a0fe3786ea63304f41ed`
  - `mr-0912.js` — `a5cd519b2c7535ff8f86cdab2ba15f0fe4a34ea16b59d5b23fda8bdefb10fb09`
  - `offer.html` — `2ec612b0481a0c331ca33102b339560cc53af859f8fe1cd7137a031a50682ccb`
  - `b-immersive/index.html` — `f935daa237683d15bc1c0d2ca4af9061e4298a691190426bbc7cc629f599ba00`
  - `guarantee.html` — `332959816fa2676ef9bb697ea50f9be42e61daaab2f62ac5215d37d648498c7b`
  - `site.css` — `77984099cd2f5c3a6b1f558801977f8352f6ab55819d74adb7aa8f8ae4be9964`
  - `site.js` — `62e6568466f99be0cd6ba8984a0775cdd2fc9bb6a9273d036e3f8dec436f295a`

## Acceptance grades

| # | Acceptance item | Grade | Independent finding |
|---:|---|---|---|
| 1 | Terminology consistency | **FAIL** | Initial route renders consistently use `Interview Bootcamp Week`, but the current live landing-page intercept modal contains a visible all-caps `INTERVIEW WEEK` label above the $549 option. The same stale literal exists in active `b-immersive/scripts/site.js` in the `intercept()` markup. The builder harness checked only the initial visible page body and did not open this modal, so its “no stale current Interview Week” assertion is a false negative. |
| 2 | Early-interview benefit accuracy | **PASS** | DR-337 authorizes the included benefit for enrolled Bootcamp and Complete students with a residency interview scheduled on or before October 18, 2026: Dr Brian personally provides individualized emergency interview preparation before that interview. Live landing, Bootcamp, Complete, and comparison surfaces carry that bounded promise without adding hours, 24/7 availability, a scheduling SLA, a standalone product, or an outcome guarantee. |
| 3 | Inclusive October 18 cutoff | **PASS** | Live copy uses `on or before Oct 18` / `on or before October 18`; runtime config records `cutoff_inclusive: 2026-10-18`. This matches DR-337 exactly. |
| 4 | Schedule: Oct 8/11/13/15/17/18; no invented evening times | **PASS** | Live schedule is Oct 8 `Evening*`, Oct 11 `11 AM–4 PM ET`, Oct 13 `Evening*`, Oct 15 `Evening*`, Oct 17 `11 AM–4 PM ET`, and Oct 18 `Full day`. The page states that exact evening times are confirmed with enrollment. The terminology-only commit did not alter the schedule array, and no unsupported evening clock time was added. |
| 5 | Pricing | **PASS** | Live pages/runtime show Bootcamp `$549` card and `$499` Zelle; Complete `$3,099` paid in full through October 7 and `$3,499` standard; installments `$1,000` today plus six monthly `$400` payments, `$3,400` total. The non-submitting checkout evidence shows the corresponding totals. |
| 6 | Complete includes Bootcamp with no separate charge | **PASS** | Live landing and both rich product journeys repeatedly state that Complete includes Interview Bootcamp Week and there is no separate Bootcamp charge. Runtime flags `includes_interview_week: true` for Complete and installments. |
| 7 | Woo/LearnDash identity | **PASS** | Independent live runtime readback reports Bootcamp `5504/5867 -> 3646`, Complete PIF `3576/5865 -> 5227`, and installments `5513/5873 -> 5227`; each reports `mapping_verified: true`, `parent_verified: true`, and the expected checkout eligibility. Source mappings at the verified commit match. No payment or order was used to prove this. |
| 8 | Analytics continuity, stable IDs, GA4, and UTM | **PASS** | Independent live readback preserved item IDs `5867`, `5865`, `5873` and internal variants `interview_week`, `complete`, `complete_installment`. `view_item_list` contained the new Bootcamp display name while retaining stable IDs and received `utm_source=independent_verifier`. A GA4 `page_view` request for measurement ID `G-B4B4E26HMW` was observed and blocked before collection; a rendered contact link preserved source/medium/campaign UTMs. Builder evidence additionally records `view_item`, `add_to_cart`, `begin_checkout`, and payment-method events on its non-submitting checkout paths. |
| 9 | Responsive presentation at 1440/1024/390, no overflow, persistent cart | **PASS** | Independent live checks across five routes at all three requested widths returned HTTP 200, showed no horizontal overflow, and retained the fixed CART control with at least a 44px target. The live desktop browser render and supplied responsive screenshots were also inspected. |
| 10 | Rollback readiness | **UNVERIFIED** | The package is specific and plausibly adequate: MyKinsta daily backup `Sep 28, 2026, 9:28 AM ET`, 14-day retention, private path `/www/theresidencyacademy_209/private-backups/MR-WEB-0912-BOOTCAMP-20260928T235400Z`, manifest SHA-256 `b7a8876727fdf2797b83c868cc7d68b1ea394a4a1dcb75066c921b5589710a80`, eight source preimages, Woo object snapshots, and a bounded restore procedure. However, the server-only directory, its final manifest verification, and the provider restore control were not independently readable in this verifier context. I therefore do not inherit the builder's PASS. No rollback drill was required or performed. |

## Legacy-string classification

The following old forms are intentionally preserved and are acceptable because they are durable technical identity rather than display copy:

- internal offer/analytics key `interview_week`;
- campaign ID `fall_2026_interview_week`;
- internal page selector `interview-week`;
- legacy Woo URLs/slugs such as `/product/iv-prep-masterclass/` and the existing variation slug;
- stable Woo IDs `5504`, `5867`, `3576`, `5865`, `5513`, `5873`;
- stable LearnDash IDs `3646`, `5227`.

Historical reports, prior screenshots, archived campaign evidence, orders, emails, handoffs, and worktree/directory names were also correctly left unchanged as historical evidence.

The live modal label `INTERVIEW WEEK` is different: it is current customer-facing text, so it cannot be classified as TECHNICAL or HISTORICAL. This invalidates the builder's stale-string classification result.

## Live URLs verified

- `https://missionmedinstitute.com/mission-residency/`
- `https://missionmedinstitute.com/product/iv-prep-masterclass/`
- `https://missionmedinstitute.com/product/match-prep-pro/`
- `https://missionmedinstitute.com/mission-residency-courses/`
- `https://missionmedinstitute.com/`
- `https://missionmedinstitute.com/wp-json/missionmed/v1/mr-0912-config`

## Blocking correction and re-verification boundary

Replace the one active modal label `INTERVIEW WEEK` with `INTERVIEW BOOTCAMP WEEK` (or the DR-337-permitted compact `BOOTCAMP WEEK` only if space genuinely constrains it), deploy under normal authority/custody, and rerun a stale-string check that opens all interactive states, especially the Bootcamp-choice intercept modal. A fresh independent verifier must then confirm the corrected live modal and re-establish rollback evidence before acceptance.

