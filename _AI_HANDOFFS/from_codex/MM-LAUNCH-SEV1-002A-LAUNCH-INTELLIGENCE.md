# MM-LAUNCH-SEV1-002A Launch Intelligence

Ticket: `MM-LAUNCH-SEV1-002A-INTEL`

Date: 2026-06-15

Scope: analysis only. No code, content, backups, deployment, WooCommerce, checkout, user/account, LearnDash, Matrix, Scheduler, or Arena backend changes were made.

## Executive Answer

We are close to deployment, but not close to launch until the deployment is validated live.

The current bottleneck is no longer "write more code." The current bottleneck is: deploy the already-packaged mu-plugin, clear caches, crawl the real site, visually verify the affected pages, and decide a small number of Woo/admin issues.

Best next move: **OPTION A - Deploy now and validate live**, assuming production deployment approval and legal/content owner approval for the policy pages.

## Section 1: What Is Actually Fixed?

### Source Fixed

| Issue | Resolution Method | Confidence |
| --- | --- | --- |
| SEV1-001 pricing interpretation was wrong | Reports and validation docs now state that `$1,499`, `$2,799`, and `$3,999` are intentional early-season prices; regular prices are presentation values only | High |
| Pricing architecture is mapped | `PRICING_ARCHITECTURE_REPORT.md` identifies Woo products, early prices, legacy product exposure, and regular/sale uncertainty | High |
| Launch deployment package exists | `_AI_HANDOFFS/from_codex/MM-LAUNCH-SEV1-002-DEPLOYMENT-PACKAGE.md` gives exact deploy scope and smoke test | High |
| Rollback path exists | `VALIDATION/SEV1-002_ROLLBACK_MANIFEST.md` documents restore/remove path for the mu-plugin | High |
| Validation matrix exists | `VALIDATION/SEV1-002_VALIDATION_MATRIX.md` separates live pre-deploy state from expected post-deploy state | High |
| Fix group audit exists | `VALIDATION/SEV1-002_FIX_GROUP_LOG.md` records what was completed, partial, or deferred | High |
| Legal page content exists | Legal Markdown files and matching mu-plugin HTML exist for Privacy, Terms, and Refund/Cancellation | Medium-High, pending legal approval |
| Speed queue exists | `_AI_HANDOFFS/from_codex/MM-LAUNCH-SPEED-HARDENING-QUEUE.md` defines safe performance work without risky optimization | High |

### MU-Plugin Fixed

These are fixed in source-controlled runtime code, but they are **not live until the mu-plugin is deployed and caches are cleared**.

| Issue | Resolution Method | Confidence |
| --- | --- | --- |
| `/privacy-policy/` 404 | Virtual policy renderer now includes Privacy Policy | High |
| `/terms-of-agreement/` 404 | Virtual policy renderer serves Terms page | High |
| `/refund-cancellation-policy/` 404 | Virtual policy renderer serves Refund/Cancellation page | High |
| Footer/privacy policy dead links | Runtime link repair maps `#` and `/?page_id=3` policy links to canonical policy URLs | High |
| Legacy program names in public copy | Runtime replacements map old names to `IV Prep Essentials`, `Match Prep Pro`, and `360 Match Mentorship` | Medium-High |
| Mission Residency stale price-increase copy | Runtime replacement preserves early prices and corrects stale regular values `$3,199` and `$4,499` to `$3,749` and `$5,499` | High |
| Conversion pricing presentation missing | Adds early enrollment price, regular strikethrough, savings, and July 1 reminder | High |
| Compare Programs lacks pricing/enrollment path | Adds pricing bridge and routes CTAs to `/mission-residency-courses/` | High |
| Generic/high-intent CTA dead ends | Compare, Red Flag, USCE, Arena, and policy CTAs get targeted runtime routing | Medium-High |
| Arena concept-demo trust leak | Replaces concept-demo/fake-account language and routes CTAs to `/arena/` | High |
| USCE raw code-fence artifacts | Removes visible code-fence strings at render time | High |
| ExamPrep `ismissing` artifact | Removes visible artifact at render time | Medium-High |
| ExamPrep design variant controls | Suppresses likely design-version controls if present in rendered DOM | Medium |
| MatchLab naming drift | Replaces visible `MatchLab` label with `Arena` where filterable | Medium-High |
| Legacy `info@missionresidency.com` | Replaces visible email with `info@missionmedinstitute.com` where filterable | High |
| Meta descriptions missing on launch pages | Yoast/Rank Math description filters provide launch-page descriptions | Medium-High |

### Documentation Only

| Issue | Resolution Method | Confidence |
| --- | --- | --- |
| Woo regular-vs-early architecture undecided | Documented as owner/admin decision required | High |
| Legacy Woo `Interview Prep Foundation` product exposed | Documented as Woo/admin decision required | High |
| IV product Woo title is legacy | Documented as Woo/admin decision required | High |
| Payment-plan and MatchFirst structure unclear | Documented as pricing/business decision required | Medium-High |
| Speed/performance risk | Documented queue only; no optimization performed | High |
| Production deployment not performed | Deployment package created; approval still required | High |

## Section 2: What Is Not Fixed?

### P0

| Issue | Why Unresolved | What Is Required |
| --- | --- | --- |
| Live legal pages still return 404 | The mu-plugin is committed but not deployed | Production deployment approval, deploy plugin, clear cache, crawl `/privacy-policy/`, `/terms-of-agreement/`, `/refund-cancellation-policy/` |
| Live site still shows pre-deploy blockers | Source changes are not live | Deploy, clear WordPress/Elementor/host/CDN cache, run post-deploy validation |
| Post-deploy visual/runtime validation has not happened | No production deployment was authorized | Browser crawl, screenshots, CTA click validation, policy page status checks, pricing presentation checks |
| Legal approval may still be required | Policy content is prepared, not counsel-approved | Dr Brian/legal owner decision if legal review is required before launch |

### P1

| Issue | Why Unresolved | What Is Required |
| --- | --- | --- |
| Legacy Woo product `Interview Prep Foundation` remains public at `$499` | Woo product data was intentionally not modified | Admin/business decision: hide, redirect, rename, or preserve for legacy workflow |
| Woo IV product title remains `IV Prep Complete Masterclass` | Woo product data was intentionally not modified | Admin decision on rename vs historical order/reporting impact |
| Woo regular/sale architecture does not model July 1 increase | Woo prices were not changed and appear equal for regular/sale | Pricing architecture decision before any Woo edits |
| Payment-plan pricing and MatchFirst architecture unclear | Could be tied to written terms, manual invoice, Zelle, or Woo products | Business/pricing decision and Woo/admin audit |
| Elementor DB remains stale source of truth | Mu-plugin masks visible output but does not clean database content | Later admin/Elementor content cleanup or accept launch-time shim |
| `/book/` still returns 404 | New mitigation avoids it as canonical CTA, but route itself remains dead | Decide whether to create redirect/page or remove all campaign references |
| ExamPrep courses design-variant issue only partially mitigated | Latest crawl did not detect it, prior audit did; mu-plugin DOM removal is pattern-based | Live post-deploy visual validation |
| My Account legacy labels may persist in Woo/account contexts | Filters may not catch every Woo/account-rendered label | Post-deploy account-page validation; possible Woo product title decision |
| Production cache may hide fixes after deployment | Cache behavior is unknown | Clear all relevant caches and verify uncached responses |

### P2

| Issue | Why Unresolved | What Is Required |
| --- | --- | --- |
| Speed/performance not optimized | Risky optimization was out of scope | GTmetrix/Lighthouse pass after deployment |
| `.mov`/large media risk on ExamPrep | Likely WordPress media-library asset, not source-controlled | Media-library audit and safe transcode/replace |
| Elementor bloat remains | No Elementor restructuring was performed | Performance audit and low-risk module/cache tuning |
| DB cleanup debt remains | Mu-plugin is faster and safer for launch | Post-launch or SEV1-003 admin cleanup plan |
| Social previews/meta need live confirmation | Meta filters are not live yet | Post-deploy crawl and social preview check |
| Hidden anchors/dead links may remain | Known critical CTAs are patched, but full JS-rendered link validation is not complete | Post-deploy crawler plus manual click pass |

## Section 3: What Requires Production Deployment?

Everything in `wp-content/mu-plugins/missionmed-launch-sev1-fixes.php` currently exists only inside the worktree.

### If The Mu-Plugin Is Deployed Today, What Immediately Improves?

- Legal pages should return HTTP 200 through virtual rendering.
- Footer/policy links should route to canonical policy URLs.
- Privacy `/?page_id=3` links should route to `/privacy-policy/`.
- Public launch-page copy should use canonical program names where WordPress filters apply.
- Mission Residency pricing should preserve early-season prices and show regular/high-season comparison.
- Compare Programs should gain a pricing/enrollment bridge.
- Compare, Red Flag, USCE, and Arena CTAs should route to stronger destinations.
- Arena marketing should stop saying `Concept demo only` and should point to `/arena/`.
- USCE raw code-fence artifacts should be hidden.
- ExamPrep `ismissing` artifact should be hidden.
- MatchLab naming should become Arena where filterable.
- Launch-page meta descriptions should appear through SEO plugin filters.

### What Does Not Improve From Deploying The Mu-Plugin?

- Woo product data, product titles, product visibility, prices, payment plans, and checkout totals do not change.
- The legacy `$499` `Interview Prep Foundation` product remains a Woo/admin issue.
- Elementor database content remains stale underneath the runtime filter.
- `/book/` may still return 404 unless separately redirected or created.
- Legal approval is not solved by deployment.
- Performance/media/Elementor bloat is not materially solved.
- Visual layout cannot be assumed good until live browser validation.
- Hidden or plugin-generated content outside WordPress content/title/menu hooks may still expose stale text.

## Section 4: MU-Plugin Risk Analysis

Answer: **A, appropriately using the launch mu-plugin, but close to the line.**

### Benefits

- Fastest reversible way to remove launch blockers from DB-owned Elementor pages.
- Avoids risky direct database, WooCommerce, checkout, payment, LearnDash, Matrix, Scheduler, or Arena backend edits.
- Provides a single rollback surface.
- Makes legal pages available even when WordPress pages are missing.
- Lets the team deploy one package and validate live before deeper admin cleanup.

### Risks

- It masks stale Elementor/Woo data rather than fixing source-of-truth records.
- Some replacements depend on exact rendered text or DOM patterns.
- It can create false confidence if nobody validates the live site after cache clear.
- It may not catch all Woo/account/product template contexts.
- It adds runtime behavior that future editors may not understand.
- If left long-term, it becomes a shadow content system.

### Recommendation

Use the mu-plugin as an emergency launch shield, not as the permanent content architecture.

Deploy it now, validate hard, then decide whether SEV1-003 should convert the highest-risk masked items into durable WordPress/Woo admin fixes. Do not stack more blind source fixes before seeing live post-deploy behavior.

## Section 5: Database vs Source Map

| Remaining Issue | Classification |
| --- | --- |
| Mu-plugin not live | SOURCE CONTROLLED + SERVER |
| Legal URLs returning 404 live | SOURCE CONTROLLED fix exists; WORDPRESS SETTINGS remain missing |
| Policy content legal approval | OTHER |
| Stale launch-page copy in Elementor | ELEMENTOR DATABASE |
| Legacy program names in page content | ELEMENTOR DATABASE |
| Legacy program names in product/account contexts | WOOCOMMERCE + WORDPRESS SETTINGS |
| Legacy Woo product `Interview Prep Foundation` | WOOCOMMERCE |
| IV Woo product title `IV Prep Complete Masterclass` | WOOCOMMERCE |
| Woo regular/sale early-season architecture | WOOCOMMERCE |
| Payment plans | WOOCOMMERCE + OTHER business rules |
| MatchFirst visibility/terms | WOOCOMMERCE + OTHER business rules |
| `/book/` 404 | WORDPRESS SETTINGS |
| Compare/Red Flag generic CTAs in source content | ELEMENTOR DATABASE |
| Footer policy links in menus/widgets | WORDPRESS SETTINGS + ELEMENTOR DATABASE |
| USCE code-fence artifacts | ELEMENTOR DATABASE |
| USCE rotation request flow | ELEMENTOR DATABASE + WORDPRESS SETTINGS |
| ExamPrep `ismissing` artifact | ELEMENTOR DATABASE |
| ExamPrep design variant controls | ELEMENTOR DATABASE |
| ExamPrep `.mov`/media risk | WORDPRESS SETTINGS + ELEMENTOR DATABASE |
| Elementor bloat | ELEMENTOR DATABASE + PLUGIN CONFIG |
| Cache risk after deployment | SERVER + PLUGIN CONFIG |
| Meta descriptions not live yet | SOURCE CONTROLLED fix exists; PLUGIN CONFIG/runtime validation needed |
| Visual regression unknown | OTHER |
| Checkout preview unknown | WOOCOMMERCE |
| Arena marketing page stale language | ELEMENTOR DATABASE; SOURCE CONTROLLED runtime fix exists |
| Arena backend state | SERVER/OTHER; not modified |

## Section 6: Deployment Readiness

Scores are practical launch-readiness estimates, not mathematical guarantees.

| State | Score | Meaning |
| --- | ---: | --- |
| Before SEV1-001 | 38/100 | Multiple critical public trust blockers: legal gaps, naming drift, pricing confusion, CTA dead ends, artifacts |
| After SEV1-002, not deployed | 58/100 | Worktree is much better, but live site is still pre-fix |
| After mu-plugin deployment and cache clear | 82/100 | Major public blockers should be mitigated if smoke tests pass |
| After SEV1-003, estimated | 90/100 | Achievable if SEV1-003 is deploy-and-validate plus targeted Woo/admin decisions, not another blind code run |

## Section 7: Next Best Move

Choice: **OPTION A - Deploy now and validate live.**

### Why

- The biggest remaining P0 blocker is not missing code. It is that the existing fix package is not live.
- Running SEV1-003 before deployment risks building on assumptions about runtime behavior.
- Legal 404s, pricing presentation, CTA routing, naming cleanup, USCE artifacts, and Arena trust copy all need live validation.
- The mu-plugin is reversible and has a rollback manifest.
- The next intelligence gained from deployment is more valuable than another pre-deploy source pass.

### Guardrail

Do not deploy without explicit production approval. If legal review is required for policy copy, get that approval first.

## Section 8: SEV1-003 Design

### Objective

Deploy the SEV1 mu-plugin package to production with approval, clear all relevant caches, validate the live public launch surface, and convert the remaining unknowns into a go/no-go launch decision with exact follow-up actions.

### Proposed Ticket Shape

`MM-LAUNCH-SEV1-003-LIVE-DEPLOY-VALIDATE`

### Scope

- Confirm production approval.
- Deploy only `wp-content/mu-plugins/missionmed-launch-sev1-fixes.php`.
- Clear WordPress, Elementor, host, CDN, and browser caches.
- Crawl required launch URLs after deployment.
- Browser-validate legal pages, Mission Residency, Courses, Compare, Red Flag, Arena, USCE, ExamPrep, Contact, My Account.
- Validate CTA targets by clicking high-intent buttons.
- Validate pricing presentation against early-season pricing lock.
- Validate Woo Store API still returns early-season prices.
- Identify any runtime misses where Elementor/Woo content bypasses filters.
- Produce launch go/no-go report.

### Dependencies

- Production deployment approval.
- Cache/CDN access or someone available to purge caches.
- WordPress/admin access if live validation reveals menu/widget/page-builder issues.
- Legal/content approval for policy pages if required.
- Woo/admin decision-maker for legacy product and regular/sale architecture.
- Browser validation capability.

### Risks

- Cache serves stale 404s after deploy.
- Virtual policy pages conflict with existing WordPress routing if pages are later created.
- Runtime text filters miss page-builder or Woo template content.
- CTA JS repair changes labels/links but visual styling needs validation.
- Woo/account pages may still expose old product names.
- Checkout preview requires explicit approval and should not create real transactions.

### Expected Impact

- Moves the project from source-ready to live-verified.
- Should raise launch readiness from roughly 58/100 live-predeploy to 82/100 after validated deployment.
- If SEV1-003 also resolves or formally accepts Woo legacy product/payment-plan decisions, readiness can approach 90/100.

## Bottom Line

What is really fixed: the launch mitigation package, pricing interpretation, legal content package, validation/rollback/deployment documentation, and multiple runtime repairs.

What is fake-fixed: anything relying on the mu-plugin is not fixed on the live site until deployment. Even after deployment, it is a runtime shield over stale Elementor/Woo data.

What still matters most: legal 404s, deployment validation, Woo legacy product exposure, payment-plan/MatchFirst decisions, cache behavior, and visual QA.

Recommendation: deploy the mu-plugin with approval, validate live immediately, then design SEV1-003 around the actual post-deploy evidence.

