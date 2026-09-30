# MR USCE-framework alternate / source custody

Founder authority: `FOUNDER_AUTHORITY.md`, SHA256 `47f2ef1cd7e8ec4fed0289398160e5c060622af3de1844262daf1221af633ef9`. New task; primary refinement complete and protected. Sole Foreman; no workers. This directive explicitly supersedes older photo-count/parallax restrictions for this alternate, not globally.

## Exact baseline and scope

Clean source worktree `/Users/brianb/.codex/worktrees/mm-home-mr-premium-hero/MissionMed`, baseline `f6257ed428181cdb14e7a7a8c348ab6e8078910f`. New branch `codex/mr-usce-alternate`. Origin `https://github.com/brinyu13/missionmed-hq.git`. Original MR worktree and shared HQ/OS dirty work untouched.

Only new runtime paths: `wp-content/mu-plugins/missionmed-mr-alternate.php` and `wp-content/mu-plugins/missionmed-mr-alternate-assets/`. Only evidence under this directory. No modifications to primary, USCE, shared rendering code, data, payments, users or entitlements.

The public alternate path returned HTTP 404 and both new runtime paths were absent before implementation. Exact route handler at template_redirect -999 makes no WordPress page or rewrite entry; therefore no sitemap object or navigation entry is created. Both slash variants serve 200 without redirecting primary. All other paths immediately return untouched. Alternate uses noindex, follow in HTTP and HTML and canonical primary URL. Non-GET/HEAD methods fail with 405.

Commerce is read-only: `mm_mr_p0_runtime_config()` supplies server-rendered prices and schedule, including automatic Complete early/standard logic. Links use the existing product-detail journey, which preserves current offer selection, checkout guards and activation. No alternative checkout implementation.

## Actual donor recovered

Live USCE Elementor page ID 5656 `_elementor_data` was read via WP CLI, not inferred from the screenshot. Snapshot: `donor/mr-alt-usce-elementor.json`. Header DOM and CSSOM: `donor/mr-alt-usce-shell.json`. Full-page Founder screenshot was inspected. Runtime donor at 1440 has a 95px header, 48px Georgia hero heading, 88vh hero, 80/100px section spacing, 1120/1100/1000/800px content containers, 4-column grids and native fixed-background photo sections. Computed body face is Poppins.

`usce-donor.css` is the complete unmodified stylesheet extracted from widget f95af0f (CL-1403D, cl1403c prefix). `usce-shell.css` is the observed live mm-l5 header CSS, copied into alternate custody. Neither is a shared dependency on future USCE edits. Only alternate.css adds narrow content and accessibility adaptations.

| Actual USCE source | MR use |
|---|---|
| cd1dd4f / cl1403c-a-hero | Exact hero nesting/overlay/label/type/CTA skeleton, authentic montage and Founder copy |
| Request tracker strip | Included early-interview protection, non-form navigation |
| 3023082 / stats | Verified NRMP ranking factors, explicit not Match rates |
| 04d73b9 / problem | Why deliberate interview training matters |
| 37eee69 / loseground grid | Verified question/content/delivery/program-fit training domains |
| f8b22c5 / image + types | What we train, authentic montage, four domain columns |
| e392637 / PD editorial split | NRMP evidence and authentic Dr Brian editorial section |
| e10be06 / pathway | Exact current Oct 8,11,13,15,17,18 schedule in donor step DOM |
| b5717e3 / specs | Native fixed-background montage break and learning loop |
| cl1403c-a-lg-grid | Complete season components and verified recurring rhythm |
| cl1403c-a-proof | Alumni editorial proof, exact Founder portraits and quotes |
| request-availability conversion purpose | Two existing product choices, no fake form or intake |
| 2deb9f2 / story CTA | Story/communication and qualified Matrix preview in donor editorial system |
| 0ff0161 / FAQ | Same spacing/borders/icons; native details/summary replaces mouse-only click divs |
| donor footer | MissionMed footer rhythm, canonical policy/account links |

Necessary adaptations: cap 88vh hero at 640px to satisfy the explicit non-viewport-filling/scrollable directive; second CTA; 6-date timeline (3/2 columns on tablet/mobile); dark full-season block; white final two-option enrollment; real portraits; visible mobile menu; WCAG AA color adjustments; reduce-motion/mobile fixed-background off. No scroll engine, animation dependency, moving text/pricing/chart or scroll hijacking. Fixed-background parallax is exactly the donor pattern.

## Content provenance

Current primary source `07dd87ac647d7571c3277799f52a173a4aaf10fe`, recorded at baseline f6257ed. `scripts/site.js` is authoritative for approved hero, schedule, domains, alumniProof, completeSched and FAQs. Current live config snapshot is `donor/mr-alt-commerce.json`: Bootcamp 5504/5867 ->3646, $549 card/$499 Zelle; Complete 3576/5865 ->5227, $3,099 early PIF through Oct7, $3,499 standard; installment5513/5873 ->5227, $1,000 +6x$400=$3,400. No original rail or product state changed.

NRMP official report independently read: https://www.nrmp.org/wp-content/uploads/2024/08/2024-PD-Survey-Report-narrative_Final.pdf pages2–3. 89% interpersonal skills,87% interview interactions,76% resident feedback are respondent ranking-factor endorsement, NOT Match probability. 1,150 respondents/18.0% overall response. Data chart is plain HTML/CSS with accessible labels and original source link; no invented claims.

Exact Marian PNG and Manasa AVIF copied byte-for-byte. Marian: Assistant Program Director, St Joseph's Paterson Family Medicine. Manasa: Associate Program Director, Internal Medicine Residency, University of Illinois College of Medicine Peoria. Exact current-source quotes. Montage original retained; cwebp quality82 image-size derivatives only (no crop/generation/face alterations): 1702px ~93KB,960px ~50KB,640px ~31KB. Hero srcset and preload match. Portraits and product screenshot lazy, explicit dimensions. Lower photographic backgrounds lazy via IntersectionObserver; native parallax itself needs zero JS.

## Recovery and governance

Universal BOOT passed at HQ origin/main `0feee579b0a9f2c90529220899f6cf6d21b8cd05`; canonical primer local prerequisites exist. Clean worktree preflight passes. Supabase coordination project brxqytrfdisrgakrxkhd active-lease readback empty before edits. Narrow PATH lease is required again at deploy, not GLOBAL. No Supabase product DB is used.

MyKinsta MissionMed Institute/Live manual backup freshly read in UI: Sep29 2026 8:35PM, note `Pre premium hero release 2026-09-29`, expires Oct13 2026 8:35PM, Restore to available. Daily Sep29 1:06PM also available. No backup created/deleted/restored. This older full-site backup is secondary: it precedes refinement, so never use it blindly to undo this additive release. Primary byte manifests freshly captured; rollback removes only this new route handler and leaves primary/current commerce intact.

Known stale Brain conflict: generated pack recorded rejected premium hero. Current live montage and f6257ed source supersede that presentation statement. End-of-run Brain correction must use final verified evidence.
