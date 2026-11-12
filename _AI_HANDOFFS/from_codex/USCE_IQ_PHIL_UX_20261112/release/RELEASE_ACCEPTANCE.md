# Clinicals HQ / USCE IQ — November 12 release acceptance

The November 12 Communications, navigation and next-action correction is LIVE and independently accepted with the limits below. The accepted V3 backend and dedicated runtime were preserved. This closes the bounded DR-543 implementation/review deliverable; it does not silently close older DR-413 verification limits.

## 1. Communications fix — PASS

Prominent verified-student name/email search replaces the giant dropdown. One click fills the recipient. Clinicals sender, template/edit/blank choices and editable subject/body remain explicit. Review focuses the checked message; readable navy proof has 13.02:1 measured text contrast. The complete approval row stays in the fixed footer. Send appears only after exact approval; Edit invalidates approval without losing text.

Unsaved text is retained in this workspace's memory across close/navigation. **Save draft** persists through the existing backend. Unsaved memory is not a durable save and does not survive reload.

## 2. Workflow navigation — PASS

Dashboard, Pipeline, Student details, Communications, Build offer and Offer history retain case context. With no selected student, Build offer/History lead to the list with a visible instruction. Journey supports guarded forward jumps and backward steps. Expired offers route to Dates with explicit recovery. Approval and revision checks remain mandatory.

Different-student unsaved Offer changes still require an explicit discard choice; this is not a new multi-case draft engine.

## 3. Next-action clarity — PASS for this bounded release

Journey approval and Continue remain visible together in the compact desktop iframe. A mobile-only fixed-row obstruction was found and corrected by allowing the wrapped wizard header to grow; actual Close and Communications interactions then passed. Pipeline cards have a clear navy CTA within one accessible card button. Unassigned retains its truthful count and explains the case-link prerequisite; its existing filter opens all 37 messages. Delivery controls use plain wording. Remaining polish is in the independent review.

## 4. Exact application source

- Source SHA: `ba64a9f21f551902f2efe2557fa109a4b666d0ff`
- Branch: `codex/usce-phil-first-renovation-20261002`
- Admin SHA-256: `28aa37856e9293b434dd5eff620ea037f157782e5616a0eb237ed188083940f2`
- Canonical authority: DR-543; registration commit `b61b2b36c7ff7f0c12eb6468a9cc772d0a3643dc`

Subsequent evidence-only commits do not change the deployed application SHA.

## 5. Deployment — LIVE

[Open Clinicals HQ](https://missionmedinstitute.com/usce-admin/).

Guarded admin-CDN publication used an immutable candidate, exact live preimage/ETag, fresh scoped ROUTING custody, and provider/public byte readback. Final asset is 416,925 bytes.

Dedicated Railway deployment `3fcfdde0-299e-49d9-8a97-2588af74ee86`, serving source `9b7b44e006ef3135bfd634d3d4d263bb6ebd585b`, was retained; no Railway rollout or backend/schema/provider configuration change occurred. Applicant asset remains SHA `335f76b0020dddf9f50d769f29d4a26d2e058a1a79b11af64d86292cadff45b5`.

## 6. Live acceptance and QA

| Boundary | Result / evidence |
|---|---|
| Phil personal login | PASS: human private sign-in, WordPress Phil Perri identity, protected app access. No credentials handled. |
| Desktop | PASS: 1,256 × 412 app viewport; document 412px, full-height rail; list/modal internal scrolling. |
| Journey approval | PASS: approval y302.5–346.5 and Continue y354.5–400.5, both inside 412px. Unapproved Send jump blocked. |
| Communications approval | PASS: complete 44px row y293.5–337.5 inside footer y282.5–401.5; actual check shows Send, uncheck hides it. No additional send. |
| Navigation/drafts | PASS: search/select, saved draft reopen, RAM resume, valid Review jump, backward steps, Pipeline return, no-student guidance. |
| Controlled mail | PASS: one labeled test to info@missionmedinstitute.com; Postmark accepted `ae43c605-9c24-43bc-aadb-c8d23de99e4f`; Info Gmail receipt `1a1d14405a07db82`. |
| Incoming reply | PASS: controlled Info reply hydrated the same QA case using verified references; message `123e444a-e911-4d32-bc3a-57421f3a8c0a`. |
| Phil notification | Provider accepted ONCE, ID `f854e714-7690-4cf7-868f-f8810a291148`. Personal-inbox receipt/read UNVERIFIED. Secure conversation link opened the correct reply through authenticated WordPress. |
| Security | Anonymous Communications config401; existing recipient/revision/approval/idempotency/XSS guards pass. Mail/sync/outbox RLS enabled. No new live cross-role RLS isolation replay was claimed. |
| Preservation | 100 requests retained. Synthetic case `fced8fdd-3c3c-4825-b7d4-f77aaedb2d90` restored to archived. Original active counts 0/3/9/0. Test correspondence retained, no underlying mail deleted. |
| Mobile | PASS final390px live composer and Journey: both approval rows and Continue fit within708px; mobile header grows to112px, Close is operable, and Communications navigation works. No horizontal overflow. |
| Tests | 117 affected tests passed (70 UI +47 mail/send/sender contracts). Final footer's updated27 Communications tests reran and passed. |
| Independent F/U/O | APPROVE WITH LIMITS: non-builder source, live hash, rollback, Info receipt/reply and screenshot verification. Authenticated interaction was performed by root, not independently replayed. |

Only the explicitly authorized controlled Info test correspondence/reply and Clinicals notification to Phil were sent. No unsolicited real-applicant correspondence, unsanctioned coordinator message, charge, placement reservation, enrollment, or business obligation was created. The controlled Offer was previewed, not newly sent in this mission.

## 7. Independent review — DELIVERED

Configured Fable5.2 was unavailable. Founder-authorized Claude Code fallback resolved to **claude-sonnet-4-6**. The read-only review and bounded exact-artwork supplement are in [INDEPENDENT_UX_REVIEW.md](../INDEPENDENT_UX_REVIEW.md).

The reviewer inspected actual-live captured screens and source; it did not perform an independent interactive authenticated browser replay. It initially could not read stale temporary reference paths; the exact ZIP images were restored and explicitly reviewed in the supplement. No substitute artwork was used.

Three original release-blocking UX findings were implemented and verified. Independent source review also caught a busy-navigation latch, which was fixed and regression-tested. Final compact approval clipping was corrected after screenshot review. No critical scoped release failure remains.

## 8. Recommendations / deferred work

Keep the approved three-screen architecture. Useful next work: distinguish the two filter labels, explain memory versus durable-save exit semantics, review secondary target sizes, and improve portrait/photographic fidelity using truthful existing data and approved assets. These are future work, not permission to build storage/upload infrastructure or invent student photos.

Some model inferences were incorrect: Unassigned already is a working filter, navigation guidance is action-triggered inline text, the canon has four KPIs and six Journey steps, and Save & exit uses the existing Offer persistence contract. Those corrections are explicit in the review disposition. Do not apply suggestions that would hide truthful counts, introduce nested buttons, or label a RAM-only exit as saved.

Inventory, availability polling, File Vault, paperwork, Matrix, analytics expansion, provider rebuilds and unrelated products remain deferred. IVOC untouched.

## 9. Rollback / custody

Hash-verified original admin rollback: `f3ddeca644fcdbab4adae3e71682a225cb2668914645ff7125a7c95111a64919`. Exact intervening preimages, including the immediately preceding `3f93ed721a5028aab2a424ab87db058f14003bfe73bef2c3cbd3f97d39d3685e`, are retained in this release directory.

Use the existing conditional admin-only publisher with fresh BOOT/authority/native custody and a new healthy fence. No database/runtime rollback or destructive operation is needed. No rollback was executed. The local writer fence is disabled after release; native lease release is the custody proof.

## 10. Remaining limits

No human-only blocker remains for the November 12 scoped deliverable. Broader prior DR-413 closure is kept separate: fresh delivered **Offer HTML** contrast and intro playback were not newly accepted by this plaintext correspondence QA; independent authenticated browser replay is also unverified. Phil's notification is provider-accepted, not proof of personal-inbox delivery or reading.

Application source, live byte hashes, test and QA IDs are recorded in RELEASE.json. Root remains sole integrator; independent reviewers made no production changes.
