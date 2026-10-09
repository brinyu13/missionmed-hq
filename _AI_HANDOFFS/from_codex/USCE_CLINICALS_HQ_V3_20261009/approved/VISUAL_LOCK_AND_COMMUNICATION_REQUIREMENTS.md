# MISSIONMED CLINICALS HQ V3 — EXACT FOUNDER VISUAL LOCK

**Status:** Founder-approved visual canon. **Corrects and supersedes** the earlier `CLINICALS_HQ_V3_DESIGN_AND_COMMS_LOCK.md` where the assistant mistakenly presented unrelated images as visual examples. **Do not use those unrelated images.**

## The only approved visual reference

`SOURCE_APPROVED_FIVE_CONCEPT_BOARD.png` is the original, unmodified five-concept image provided by the Founder. Three faithful crops are supplied for direct side-by-side inspection; all crop pixels come directly from the original source. The *other two concepts* on the source board, #2 and #4, are not approved base screens.

| Active screen | Exact original reference | Position in source board | Direction |
|---|---|---|---|
| Main Dashboard | `APPROVED_01_MAIN_DASHBOARD_ORIGINAL.png` | Top left, #1 “MODERN DASHBOARD” | Adopt the exact visual identity, navy left rail, mountain hero, compact KPI tiles, request table with direct next-step buttons, spacing, typographic hierarchy and color language |
| Offer Pipeline | `APPROVED_03_OFFER_PIPELINE_ORIGINAL.png` | Top right, #3 “VISUAL PIPELINE” | Adopt the exact light four-lane Kanban board, column colors (new blue / in-progress warm gold / offered lilac / accepted mint), compact student cards and top controls |
| Build Offer | `APPROVED_05_BUILD_OFFER_ORIGINAL.png` | Bottom right, #5 “FULL-SCREEN FOCUSED EXPERIENCE” | Adopt the exact immersive, single-step-at-a-time wizard visual direction: navy/photographic mountain journey rail, spacious white working area, obvious single primary action |

**Critical:** Don't replace the reference with other images, lookalikes, search results, stock imagery or AI interpretations. Don't convert all three into one generic design system that erases their distinct visual layouts. These are different, intentional screens within one connected application.

## Single coherent product

- Main screen = #1, the primary operational landing page for Phil.
- “Pipeline” menu = #3, the overview of clinical requests/offers by stage. Its cards open the same real case records, not a second database or independent status system.
- “Build Offer” / “Continue Offer” = #5, a full-screen step-by-step guided journey. It should replace confusing long forms, not open an unrelated generic admin panel.
- Keep normal desktop work at near-zero *page-level* scrolling; permit controlled internal list scroll and unavoidable accessible small-screen scroll. Keep next action visible.
- Existing accepted USCE auth, request data, offer/approval, email sending, status, and student communication contracts must be reused and protected. Do not fake capability or invent production metrics from mockup data.

## Communication experience — Founder-required functionality

The communications addition is mandatory for the new communication release, but should be staged without risking the accepted core base:

1. A prominent “Communications” navigation item opens a Gmail-like unified message workspace: Inbox, Sent, Drafts, Needs Review/Unassigned, search and conversation view. Conversations link back to the actual USCE student/case and offer.
2. From a student record or the full-screen Offer wizard, Phil can click “Write Message” or an appropriate communication action. Offer **Use personalized template**, **Edit message**, or **Write from scratch**. Prefill only verified student, program, specialty, dates, offer/approval and other permitted fields. Preview the exact subject/body and allow full editing without changing the global template by accident.
3. Student-facing sending identity must be the properly configured/authorized `clinicals@missionmedinstitute.com` address. Replies route back to that address. Verify real sender domain/alias, send service/provider capabilities and mailbox delivery before claiming this works. Reuse existing approved email infrastructure instead of building a parallel sender.
4. Capture inbound replies to that mailbox through an authorized provider integration, deduplicate by provider message ID and attach to the correct student/case via message threading and trustworthy metadata. Never guess or attach an ambiguous message to a student. Ambiguities go to Needs Review.
5. Every inbound student reply produces a separate notification to `philaperri@gmail.com`: simple subject “New USCE student reply”, student/case identification only as privacy permits, authenticated deep link to the relevant conversation, and a link to `https://mail.google.com/` so Phil can open the Clinicals inbox while signed into the correct account. Minimize student data in personal notifications.
6. Distinguish `draft`, `sending`, `sent`/provider accepted, `delivered` if genuinely verified, `failed`, and `replied`. Provide retry/idempotence/audit protection, no duplicate-send loops, no silently dropped inbound replies. An app activity event must not itself trigger a student-facing message.
7. Existing coordinator approval and offer/send preconditions must continue to be enforced server side.

## Execution guardrails

- This is a **visual approval + requirements lock**, not a claim that the above new communications functions have been implemented or deployed.
- Existing current USCE renovation code, the real product repo, current branch/dirty state, runtime deployment, MissionMed OS protected ownership and leases must be verified by the implementing Foreman before changes. Do not derive a live SHA from this document.
- `missionmed-brain/AGENTS.md` and only USCE's current generated pack (if one exists) should be consulted; source/runtime authority supersedes history.
- Keep one sole production integrator. Use Sol 6.1 Medium for approved visual/CSS work; Sol 6.1 High for mailbox provider integration, message association, auth/privacy, and release. Astra only for a proven unresolved, consequential architecture decision.
- Preserve the working base and rollback. Check end-to-end with synthetic test cases and controlled mailboxes first. Do not email real students or coordinators as part of QA.
- Verify screen accuracy against the exact crops at the same measured viewport before Founder visual acceptance. Treat proportions/adaptive constraints honestly when WordPress chrome changes available height.
- Program Inventory, File Vault and Matrix Divisions are separately deferred; do not include them in this visual correction.

## Acceptance gates

**Visual:** Founder recognizes the exact #1 dashboard, exact #3 Kanban, exact #5 immersive Offer wizard with no substitute designs or obstructive scrolling.

**Functional:** A real authorized admin can open a case from either dashboard/pipeline and continue the same Offer in the full-screen wizard; state persists and approvals remain intact.

**Communications:** Under a sanctioned synthetic test, custom/template email is sent from verified Clinicals identity, student's controlled reply arrives in Clinicals mailbox, appears exactly once on the correct USCE case and unified inbox, and triggers exactly one personal notification to Phil with both requested links.

**Security/release:** Unauthorized access denied; provider verification and reply-correlation proven; focused and independent release tests; production readback and reversible rollback evidence.
