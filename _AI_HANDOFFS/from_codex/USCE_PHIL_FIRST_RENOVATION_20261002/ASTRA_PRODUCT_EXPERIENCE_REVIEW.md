# USCE Phil-first product experience review

Date: 2026-10-02. Verdict: **PARTIAL REVIEW — RELEASE ACCEPTANCE NOT ESTABLISHED**.

## Identity, scope, and evidence

- Worker: `/root/astra_usce_experience`. Requested model/reasoning: GPT-6 Astra / High. Foreman reports the accepted native spawn call explicitly selected `gpt-6-astra` and `high`; the returned worker record and this worker's inventory expose identity/status only. Tool-selected model is recorded; independent runtime model introspection is unavailable.
- Role: independent read-only experience specialist. Foreman `/root` is sole production integrator. No code, production, provider, authority, lease, business-state, or account mutations performed.
- Assigned worktree: `/Users/brianb/MissionMed_worktrees/usce-phil-first-renovation-20261002`, branch `codex/usce-phil-first-renovation-20261002`, HEAD `0feee579b0a9f2c90529220899f6cf6d21b8cd05`. Initial Git state clean.
- BOOT/current authority reviewed. No registered USCE mission/authority entry in inspected OS; `products_index.json` routes USCE to a missing OS passport (Foreman verified absence). The passport in product source does not repair current OS authority. Protected writes remain CLOSED. Foreman supplied fresh universal-validator PASS. Canonical `origin/main:_SYSTEM/CODEX_EXECUTION_GUARDRAILS.md` independently hash-verified as `9638e67841e98b278244c0d4f9ecd0ccbdc7a9e17c50a67dd45d1d31895a0357`.
- Risk: LOW read-only review; bounded new Markdown artifact only. Primer, knowledge routing, rules, naming, learning read, and Git hygiene inspected. Pre-edit preflight PASS on clean non-main branch; scoped preflight repeats expected noncanonical-root warning. The Founder explicitly assigned this exact worktree and artifact path, so no workspace ambiguity or dirty overlap remains. No learning-log or other ancillary write is authorized for this worker.
- Evidence levels: **V** = actual visible browser observation; **S** = inspected source; **R** = Foreman-reported custody evidence; **U** = unreviewed. F/U/O means Functional / Usability / Operational, not these evidence letters.
- Source is not live acceptance. Initial assigned `LIVE/usce_admin.html` is an older 1,862-line demo-first implementation. Recommendations below target the later 2,931-line donor unless explicitly stated otherwise.
- Donor `D`: `/Users/brianb/MissionMed_worktrees/usce-phil-auth-20260928`, independently verified HEAD `85c8351e8d8c978dac28d28325140734cafc432c`, clean status. `D/LIVE/usce_admin.html` SHA-256: `52c71149dd0ce8bb5d44d0974de2c590e8bf5bd125880447c9d155759a156e31`.
- Foreman reports served implementation `8ca364b4162714d93f4835d3a6608b71fc47e5a7` and the same CDN hash from custody evidence. Fresh anonymous CDN fetch returned 403 for Foreman. The donor/hash match establishes file custody, not current served bytes.
- Historical memory was used only to locate the auth-recovery donor and preserve the distinction between previous browser acceptance and current evidence. Historical acceptance was not carried forward.

## Uncoached first pass: actual browser evidence

Actor: this worker using the shared Codex in-app Browser. No confirmed Phil session and no approved synthetic applicant/test inbox were available. Root exclusively delegated browser control, then received handback before the source pass.

1. Attempted documented `createBrowserTab("iab", normalEntry, {visible:true})`; tool rejected visibility because subagent threads do not support visible IAB. No product observation resulted.
2. Created a hidden IAB tab at `https://missionmedinstitute.com/usce-admin/`. Initial AX state showed the public MissionMed shell, top navigation, `LOG IN`, and an initially blank embedded admin area.
3. Read the loaded AX state. Embedded WordPress sign-in panel said **“Please log in again.”** It exposed username/email, password, Remember Me, Log In, Register, Lost your password, and site-return controls.
4. Inspected one rendered screenshot in the tool only; no image was saved to disk. Browser autofill had populated the username and masked password after the initial AX observation. No credential value was copied or extracted, no password revealed, no login submitted. The initial report to Foreman that fields were empty was corrected immediately.
5. No UI clicks, form entry, logout, applicant opening, preview, link generation, approval, send, note save, status change, payment, or other business action occurred. Browser control was explicitly handed back to Foreman.

Visible usability finding **V-U1, P2**: normal USCE entry provides a generic WordPress “Please log in again” recovery panel within the public site; the visible content does not explain that signing in returns to the coordinator workspace or distinguish an expired session from missing coordinator permission. This is not proof of broken auth. Smallest correction: product-scoped explanation, “Sign in to continue to Clinicals,” and preservation of the requested case across normal reauthentication, without altering global WordPress auth. Register/password recovery are observed generic login links, not recommended coordinator onboarding actions.

| Intended task | Actual control path / clicks | Result and ambiguity | F / U / O evidence | Smallest next step |
|---|---|---|---|---|
| Normal coordinator entry | Navigate normal entry; no click | Login panel visible; authenticated role unknown | F: entry observed only; U: V-U1; O: U | Approved authenticated actor through normal route |
| Logged-out / expired recovery | Observed “Please log in again”; no submit | Recovery outcome unknown; did not invalidate active user session | U / partial V / U | Controlled session-recovery fixture |
| Triage and case resumption | No queue or case opened | No safe fixture; cannot determine attention, owner, next action, or reload behavior | U / U / U | Designated synthetic case and read/write contract |
| Preferences, clarification, availability, notes/calls | No business control used | Persistence and distinction between log/send untested | U / U / U | Synthetic case, authorized note/call saves |
| Draft, review, approval, link, send | No control used | Preview can write according to later source inspection | U / U / U | Dry-run or approved inbox plus complete action contract |
| Applicant offer, accept/decline/alternate, expiry/revision | No controlled applicant link | Actual applicant page unavailable for review | U / U / U | Current exact source plus controlled links and responses |
| Delivery, payment, paperwork, course readiness | No control used | Provider truth and cross-state consistency unknown | U / U / U | Read-only authoritative evidence and synthetic lifecycle |
| Keyboard, zoom, mobile, dialog focus, failure/retry | No interaction tests | Screenshot establishes only one desktop login appearance | U / partial V / U | Responsive and keyboard run after safe login |

## Highest-value source findings

All entries below are **S**, not observed live defects. Line numbers refer to the donor version identified above. Rebind to production before implementation.

| ID / severity | Exact source evidence | Consequence for Phil | Smallest useful correction |
|---|---|---|---|
| S1 / P1 | `D/LIVE/usce_admin.html:1918` call handler pushes into `r.comms`; `:1952` compose-send and `:1963` reminder handlers also only push local events and show sent/logged success. Internal note at `:1927` separately uses a protected PATCH. | “Call logged,” “Message sent,” and “Reminder sent” may describe volatile local state. A covering coordinator can lose the history or assume a communication happened. | Keep capability only with durable event/transport acknowledgment. Until that contract is wired, disable production action with precise reason. Do not relabel a send as a log without preserving intent and clear semantics. |
| S2 / P1 | `:1693` computeAdminTracker advances review after one hour; any offer implies “Availability confirmed”; a portal URL/token/READY status implies “Offer sent”; `:1766–1797` operational values can override prior disposition and mark completion. Assigned-source backend `missionmed-hq/routes/usce-status-tracker.mjs:390–475` similarly uses time, token/dry-run, and OR readiness signals. | Time, draft existence, link generation, dry run, and manually recorded readiness can imply real progress or commitments. Admin and applicant projections can disagree. | Derive independent facts from explicit authoritative events. Show “Request received — awaiting review,” “Draft saved,” “Link prepared — not sent,” “Test recorded — not sent,” and separate readiness facts. Do not announce reservation/completion without owning-system evidence. |
| S3 / P1 | `:874–914` maps `ACCEPTED` to `offer_ready`, `DECLINED` to `archived`, `RETAINED` to `reviewed`; `:1568–1607` queue dropdown PATCHes directly; `:1874–1899` locally renders chosen value rather than authoritative returned state. | Broad dropdowns permit contradictory representation; a status label may change after reload or conflict with the applicant's actual response. | Remove state editing from queue. Expose allowed intent actions within case, preserve existing enums/server rules, and render authoritative response/reload. Route conflicts to “Needs review”; never manufacture an applicant response through a generic coordinator selector. |
| S4 / P1 | `:2250–2300` “Preview Email” persists draft, may mint token, and writes message-preview event. `:2508–2596` approval is local Boolean; send persists again, may append a link after approval, then sets sent UI after endpoint success. | “Preview” is not read-only; final transmitted content can differ from reviewed content. Backend success alone needs interpretation by mode/provider outcome. | Label current write behavior “Save draft and review message”; explicitly state link/event side effects. Seal approval to case, offer revision, recipient, terms, expiration, and exact final rendered content. Editing invalidates approval. Interpret send result before displaying queued/accepted/delivered/test labels. |
| S5 / P2 | `:1592` button says “Delete” but title says Archive; `:1900–1912` confirms and PATCHes ARCHIVED. | Unnecessary fear of data destruction; a destructive-looking control competes with daily work. | “Archive case” in case overflow. Confirmation: “Hide this case from the active queue? Its history will be kept.” Provide archived view and only an existing authorized restore transition. |
| S6 / P1 | `:707–740` mutable payment/paperwork/course dropdowns; source tracker treats readiness values as completion. | Recording “Paid” or “Enabled” may look equivalent to payment or enrollment proof. | Separate “Recorded by coordinator” from verified provider fact. Show source, checked time, and evidence/reference. Manual-review is unresolved, never paid. Approved paperwork, payment, access, and placement are independent gates. |
| S7 / P2 | `:645–688` hardcoded programs, durations, 48h expiry, template options; `:930–931` fixed location/month catalogs; `:2596` token TTL fixed at 14 days. | Preferences can look like inventory; response deadline and access-link lifetime are conflated. | Retain catalog values as choices only. Label requested vs offered vs confirmed. Render an absolute response deadline and timezone; treat link access separately. Source policy defaults from approved business rules, not design assumptions. No change in terms without owner resolution. |
| S8 / P2 | `:529–542` duplicate technical status filter; `:1666` next-action tracker; `:1308–1345` queue load selects first case; `:1618` case selection is local state. | Interruption recovery, attention rationale, and consistent deep-link resumption need proof. | Keep next-action concept but use evidence-based task reasons, no auto-selected applicant on entry, durable case route, queue/filter restoration, and explicit selected-case identity. |
| S9 / P2 | Mixed intake/HQ/portal templates remain; simulation control `:619`, handler `:1974`; `:1348` demo restoration; `:2909` seed then live load. | Production can retain demonstration affordances or briefly render misleading example state. | Production starts in loading/blocked/empty state with no seeded case. Keep demos in a separate fixture surface. Remove simulation controls from production access, not their test coverage. Fail closed on auth/read error. |
| S10 / P2 | Queue items `:1579–1600` are clickable divs; fields shown at `:645–735` lack explicit label associations in inspected markup. | Keyboard and assistive-technology navigation may not expose the same case-open intent or field names. | Native case-open link/button plus accessible field labels, named tabs, visible focus, modal focus/return behavior. Confirm rendered behavior; source alone is insufficient for an accessibility verdict. |

The donor CONFIG points to `LIVE/usce_offer.html` (`:868`), but that file is absent in this donor. Applicant-source exploration stopped at this custody gap. Do not substitute the older mixed `LIVE/usce_student.html` or infer applicant acceptance from inline demo portal code.

## Case-centered information architecture

Keep the existing admin route and secure boundaries. Within the USCE product, use one coordinator workspace titled **“Clinicals cases”**. No change to global MissionMed HQ navigation is proposed.

**Queue:** search; attention filters; readable case cards; counts; last refresh; explicit retry. Each card contains applicant identity (only within authorized product), requested specialty/location/time, last durable event, waiting-on party, next action and its reason. Queue cards open a case; no business mutation on cards. “All active” is the neutral default until an attention projection is verified. Move the legacy status taxonomy to an advanced filter with user-facing aliases.

Candidate groups are computed views, not new database enums:

| Group / exact label | Inclusion rule | Unknown/conflicting evidence |
|---|---|---|
| Needs attention | New request lacking review event; alternate request; explicit failure; expired response deadline; unresolved conflict; due follow-up | Include with precise reason, not a guessed stage |
| Preparing an offer | Current unsent draft with next task assigned to coordinator | Draft is not confirmed availability |
| Ready to send | Persisted current-version approval plus valid recipient, terms, policy checks, and send permission; no successful send | Do not introduce group as authoritative until durable approval contract exists |
| Waiting for applicant | Current offer actually submitted/accepted by authorized sender, or a real clarification message sent; response pending | Delivery failure returns to attention; prepared link stays with coordinator |
| Waiting for program | Explicit program-outreach event plus durable waiting-on/next-follow-up evidence | Existing call text is insufficient for automatic classification; defer group until structured evidence exists |
| Accepted — next steps | Authoritative current offer acceptance; separate payment/paperwork/access/placement checks | No single manual flag makes rotation secured |
| Closed / Archived | Confirmed declined or archived disposition, preserving future-notification choice independently | Closed is not deleted; conflicts need review |

**Case header:** case identity and short reference; factual summary; “Waiting on …”; primary next-action button; last saved/refreshed time. No “Build offer” primary when there is an unresolved response, missing information, or a draft to resume. Secondary actions: Add internal note, Log program call, Refresh, More → Archive case.

**Case sections:**

1. **Summary** — applicant request, ranked preferences and original notes; separate proposed/confirmed availability; blockers; next action. Preserve rank order and history.
2. **Offer** — current draft/revision and prior versions. Compact summary first, editable details on “Edit draft.” Group rotation details, response deadline/terms, applicant message, internal notes. Show mismatches next to the affected field. “Save draft” and “Save draft and review message.”
3. **Activity** — durable chronological history with event type, actor, timestamp, direction, recipients when appropriate, and outcome. Filters for All / Notes & calls / Messages / Offer changes. Source, provider status, and delivery diagnostics use disclosure. Never synthesize today's timestamp as the event time for historical readiness.
4. **Next steps** — distinct payment, paperwork, course access, and placement cards after acceptance (readable before then as unavailable, with reason). Manual recorded state visibly distinct from verified fact.

This retains audit evidence inside Activity's **“Technical details”** disclosure; it does not remove audit. Communication history remains central instead of splitting local events from provider events without explanation.

## Retained capability / current seam / proposed home

| Capability | Existing donor seam | New home / disposition |
|---|---|---|
| Secure entry, queue, status read | `loadLiveQueue`, `normalizeLiveRequest`, `CONFIG.adminReadEndpoint` | Queue; retain normal relay and protected API |
| Preferences and request history | Request view model, `renderRankedList`, `offerHistory` | Summary + Activity; retain original ranks and prior offers |
| Internal note | PATCH `adminNoteEndpoint`, current scalar `admin_note` | Add internal note; establish append-only history before promising multiple durable notes |
| Program call, clarification, reminder | Current local handlers and protected offer comms path | Activity composer; retain only behind real durable/log/send contract, disable unsupported production paths |
| Draft save and resume | POST `offerDraftEndpoint`; GET/PATCH `offerReadEndpoint`; `persistLiveOfferDraft` | Offer; preserve server ID/revision and confirm authoritative saved state |
| Message review | POST `offerMessagePreviewEndpoint`; `recordLiveMessagePreview` | Review screen; acknowledge save/log side effect |
| Approval and send | Local `approveOfferEmail`; POST `offerSendEndpoint`; existing send idempotency | Review → approved current revision → explicitly authorized send; durable approval/revision gap requires engineering decision |
| Applicant link | POST `offerTokenEndpoint`; `mintLiveOfferToken` | Review advanced action “Prepare applicant link”; never equate link creation with send |
| Communications and provider records | GET `offerCommsEndpoint`; `loadLiveComms`; offer send route | Activity; separate logged/draft/test/queued/provider-accepted/delivered/opened/replied/bounced/failed/complaint |
| Applicant accept/decline/alternate | `D/missionmed-hq/routes/usce-offer-portal.mjs:50` action mapping and public read/respond handlers `:498–515` | Applicant-only current offer; preserve semantics, pending exact served UI custody and test |
| Payment / paperwork / course | `offerPaymentEndpoint`, `offerPaperworkEndpoint`, `offerLearndashEndpoint` | Next steps; recorded metadata is not transaction/enrollment execution |
| Gmail metadata preview | `gmailSyncPreviewEndpoint` | Activity diagnostics with mailbox/permission boundaries unchanged |
| Archive and audit | `archiveRequest`, `updateRequestStatus`, `renderAudit` | More → Archive; archived list; durable audit retained |
| Intake and demo/simulation | Public intake route; mixed inline views and seed | Separate applicant intake / isolated synthetic test surface; no coordinator mode-switch to simulated applicant business actions |

RPC-level changes are not prescribed here. Reuse the named route contracts first; the integrator must reconcile their owning RPCs/current schemas under registered authority before adding persistence seams. This review did not query or mutate the database.

## Action transitions and exact state language

- Entry → **“Loading cases…”**. A load error becomes **“Cases could not be loaded. Try again.”** with retry and last successful refresh. An empty authorized list says **“No active cases”**; filtered zero says **“No cases match these filters”** with Clear filters. Neither is an auth error.
- Authentication: **“Sign in to continue to Clinicals.”** A verified denial says **“This account does not have access to Clinicals cases.”** No fake empty queue. Preserve safe case destination through normal auth; do not persist raw token material.
- Unsaved draft: **“Unsaved changes.”** Saving: **“Saving draft…”**. Success only after acknowledged readback: **“Draft saved [time]. No message has been sent.”** Failure keeps entered text and says **“Draft was not saved. Try again.”** Do not cache applicant details in an unapproved local store.
- Stale draft/approval: **“This case changed since you opened it. Review the latest version before continuing.”** Reconcile versions and invalidate approval; never silently apply a stale operation to another selected case.
- Review: show recipient, case reference, offer revision, exact applicant content, deadline/timezone, mismatches and commitments before **“Approve this version”**. Send button: **“Send offer to [applicant]”**. Confirmation includes exact recipient and communication purpose; authorized test runs remain conspicuously test mode.
- Send outcomes: **“Test recorded — no email sent”**, **“Queued for sending”**, **“Email accepted by provider”**, **“Delivered”**, **“Delivery failed — review before retrying.”** Retry uses the same logical action identity; a revised offer uses a version-specific identity. Do not claim delivery on an HTTP success or provider acceptance alone.
- Applicant: current offer summary, known/unknown availability, exact deadline, what each response does, and expected next step. Retain existing approved acceptance/decline/alternate semantics. Old/expired/revised links must state why action is unavailable and provide safe contact/current-offer navigation without revealing another case. Do not claim “reserved” from a draft, token, or acceptance alone.
- Responsive/accessibility: at 390px, queue and case are sequential views with “Back to cases”; no horizontally clipped primary action. At 200% zoom preserve reading/action order. Native links/buttons for case entry, labeled fields, keyboard-operable tabs, modal focus containment/return, visible focus, text errors associated to fields, live announcements for save/failure; avoid color-only urgency.

## Before / after journeys and acceptance contract

| Journey | Source-supported current risk | Required acceptance in an authorized synthetic case |
|---|---|---|
| Interrupted Phil resumes work | First case auto-selection, local selection/state, ambiguous progress | Open case A from queue, refresh/reauthenticate, return to A and original queue context; clear last durable event and next action; no accidental selection/mutation of B |
| Program needs clarification | Local call/message/reminder can report success | Distinguish “Save internal call note” from “Send clarification”; after authorized save/send and reload, correct durable record appears for same case to covering coordinator; no send from a log action |
| Prepare an offer | Dense form, default policy, preview saves/mints, link suggests sent | Preferences remain separate; draft and exact offered terms persist; preview's writes are explicit; no sent/confirmed/reserved claim until corresponding evidence |
| Review and send | Boolean approval then later content changes | Change recipient/terms/expiry/content after approval → approval invalidated; double-click/retry → one logical send; fail/timeout → honest recoverable state; safe inbox and provider readback required |
| Applicant responds | Exact UI absent; backend actions present | Current synthetic link shows exact terms; authorized accept/decline/alternate only affects its case; repeated/stale/expired/revised links safe; response readback survives reload |
| Operational follow-through | Independent manual flags can produce complete stage | Paid-only, paperwork-only, course-ready-only, manual-review, declined+paid, and archived+enabled fixtures never falsely satisfy overall placement/completion; source and checked time visible |
| Auth/denial/reliability | Only login panel observed | Logged out, expired session, unauthorized role, delayed load, save failure, provider failure, stale case and refresh recover truthfully; no demo data or wrong-case fallback |
| Accessibility | Clickable divs and sparse label association | Keyboard-only queue→case→edit→review→cancel, proper focus return; 390px and 200% zoom; error announcements; contrast measured on actual runtime |

All cases above are **NOT RUN** in this review. An independent final reviewer must exercise changed workflows on the deployed artifact with approved fixtures and report Functional, Usability, and Operational verdicts separately. A healthy endpoint, local source inspection, or this document is insufficient for APPROVE.

## Handback

Browser ownership returned to Foreman. No applicant record was opened, no credentials were submitted, and no business action was performed. No protected file or production resource was changed. Only this sanitized artifact is written; commit/push and canonical filing remain Foreman responsibilities.

Next action: Foreman resolves registered mission authority, binds exact production source (including applicant page), and obtains one approved synthetic case plus inbox/action contract. Implement the smallest evidence-truth corrections first (S1–S4), then verify complete case journeys before final acceptance.
