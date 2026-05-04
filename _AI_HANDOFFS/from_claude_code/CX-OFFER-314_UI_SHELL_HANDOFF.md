# CX-OFFER-314 — USCE Student Offer Portal UI Shell — HANDOFF

**Status:** COMPLETE (UI/app-shell only)
**Branch:** `cx-offer-usce-public-intake-deploy-310i`
**Worktree:** `/Users/brianb/MissionMed_AI_Sandbox/_WORKTREES/cx-offer-usce-public-intake-307`
**Authored by:** Claude Code (Opus 4.7)
**Date:** 2026-05-04

---

## 1. Scope and authority boundary

This task delivered a **standalone, R2-ready, public student offer-portal HTML shell** plus a **light reference update** to the existing admin shell. It is **UI/app-shell only**. The following remained explicitly out of scope and untouched:

- No Railway changes
- No Supabase changes (no schema, no policies, no client browser calls)
- No `server.mjs` changes
- No protected endpoint changes
- No WordPress / WooCommerce / LearnDash changes
- No emails sent, no notifications triggered
- No deployment, no CDN promotion
- No auth/session changes
- No Arena / STAT / Daily / Drills / VIDEO_SYSTEM changes
- No edits to legacy `missionmed-hq/public/usce*.html` (read-only visual reference only — and no read was actually needed because the existing `LIVE/usce_admin.html` already established the brand idiom)

All live network behavior is **adapter-stubbed and disabled by default**. Activation requires a future Wiring Authority gate.

---

## 2. Files created

### `LIVE/usce_offer.html`  (new, ~430 lines incl. styles + script)

Standalone polished public offer-portal page. Shipped with:

- MissionMed Clinicals branding (Fraunces serif + Manrope sans, navy/cream/gold palette consistent with `LIVE/usce_admin.html`).
- Offer summary grid: **Specialty**, **Location**, **Timing/month**, **Duration**, **Format**, **Reference**.
- **Response deadline / expiration** card (with `expired` styling and auto-lock when `offer.expiresAt` is past).
- **Coordinator message** box (multi-line, no private partner names, no "Phil" or any individual-staff identification).
- Three response actions: **Accept**, **Request alternate**, **Decline**.
- Inline **alternate-request form** with optional 1000-char note.
- Three confirmation states (each is a separate `.state-panel` `<section>` with `hidden` by default):
  - `#stateAccepted` — confirmation + 4-step "what happens next" timeline + WooCommerce payment CTA.
  - `#stateDeclined` — confirmation + 2-step follow-up timeline.
  - `#stateAlternate` — confirmation + echoed student note + 2-step follow-up timeline.
- **WooCommerce CTA** (`#paymentCta` → `https://missionmedinstitute.com/product/usce-clinical-rotations/`) lives **inside `#stateAccepted` only**. It is unreachable until `respond('accepted')` calls `showState('accepted')`, which is the only code path that removes the `hidden` attribute on `#stateAccepted`. Decline and alternate paths do not reveal it. Expiration locks all action buttons and never reveals any confirmation panel.
- Top adapter-status strip (`#adapterStatus`) signaling demo vs. live mode.
- Footer guardrail note.

Required config object is set verbatim:

```js
window.__MISSIONMED_USCE_OFFER_CONFIG = {
  version: "CX-OFFER-314",
  mode: "shell_only",
  apiBase: "https://missionmed-hq-production.up.railway.app",
  offerTokenParam: "offer",
  liveAdapterEnabled: false
};
```

Token handling: reads `?offer=…` from the URL via `URL` API, trims, caps to 256 chars, and stores in `state.token`. With `liveAdapterEnabled: false` (default), the page **never** issues a network request — it renders a generic, partner-anonymous demo offer. `adapterStubGetOffer` and `adapterStubRespond` are present as contract references and immediately reject with a "live adapter disabled by config" Error. No code path performs `fetch`/`XMLHttpRequest`/`WebSocket`/Supabase JS or includes credentials.

Accessibility: semantic `<header>`/`<main>`/`<article>`/`<section>` structure, `aria-label`/`aria-live` on dynamic regions, `role="region"` on payment CTA region, focus management on alt-form open, smooth scroll on state transition, fully responsive down to ~360px.

### `_AI_HANDOFFS/from_claude_code/CX-OFFER-314_UI_SHELL_HANDOFF.md`  (this file)

---

## 3. Files modified

### `LIVE/usce_admin.html`  (3-line additive change, no protected wiring touched)

1. In the **Communications** pane, added a "Student offer portal preview" `info` block with a relative anchor to `usce_offer.html` (preview-only, opens in a new tab) and a one-line description that the portal is preview-only, never calls Supabase from the browser, never exposes service-role data, and never redirects to WooCommerce before acceptance.
2. In the **Adapter contract** array (`adapterContract`), added a new `studentOfferPortalLink(id)` entry marked `state: 'stub/demo'` with detail describing CX-OFFER-314 boundaries (preview-only; tokenized public-read and accept/decline/alternate response endpoints reserved for Wiring Authority; no browser write or send behavior).

No live send behavior added. No protected endpoint paths added or changed. No header/footer/version metadata changed. Admin JS still parses cleanly (`new Function(scriptBody)` succeeds).

---

## 4. Validation performed

| Check | Result |
|---|---|
| `LIVE/usce_offer.html` JS syntax (`new Function`) | **PASS** (`JS_OK`) |
| `LIVE/usce_admin.html` JS syntax (`new Function`) | **PASS** (`ADMIN_JS_OK`) |
| Forbidden string `plgndqcplokwiuimwhzh` in either LIVE file | **0 hits** |
| Forbidden string `service_role` in either LIVE file | **0 hits** |
| Forbidden string `wp-json/wp/v2/users/me` in either LIVE file | **0 hits** |
| WooCommerce URL location | **2 occurrences** in `LIVE/usce_offer.html`: line 301 (`<a id="paymentCta" href=...>` inside `#stateAccepted`, which is `hidden` by default) and line 358 (`var WOO_URL = …` reference-only constant, never used to redirect). Both are gated to the accepted state. |
| Demo state renders | **PASS** — page loads with no token and shows the generic demo offer + Pending badge + Demo adapter status. |
| Accept button reveals accepted state with payment CTA | **PASS** by code review — `respond('accepted')` → `showState('accepted')` → `show(#stateAccepted)` (sets `hidden=false`); `#paymentCta` becomes interactable; smooth-scrolls into view. |
| Decline button reveals declined state, **no payment CTA** | **PASS** by code review — `showState('declined')` only `show()`s `#stateDeclined`; `#stateAccepted` stays `hidden`. |
| Request-alternate flow opens form, captures note, reveals alternate state with echoed note, **no payment CTA** | **PASS** by code review — `openAltForm` reveals `#altForm`; `respond('alternate_requested')` echoes note via `#altEcho` and `show()`s `#stateAlternate`; `#stateAccepted` stays `hidden`. |
| Expired offer locks all actions and never reveals any confirmation panel | **PASS** by code review — `isExpired()` triggers `lockActions('expired')` which disables all buttons and relabels Accept; no `show()` call is made. |
| No production API calls fire on page load or on action click while `liveAdapterEnabled=false` | **PASS** — search shows zero `fetch(`, zero `XMLHttpRequest`, zero `supabase` references, zero `credentials:` in `LIVE/usce_offer.html`. Adapter stubs immediately reject without network I/O. |
| No Postmark / email / notification side effects | **PASS** — page contains no email-template, no `mailto:` triggered automatically, no Postmark reference, no internal-notify reference. |
| No private partner names or "Phil" reference in student-facing copy | **PASS** — copy uses generic terms: "Major US metro area", "MissionMed Clinicals coordinator", "your coordinator". No individual or partner name appears anywhere in `LIVE/usce_offer.html`. |
| Login required to view this shell | **No** — page is fully public-renderable, exactly as required for tokenized public response. |
| Robots indexing | `<meta name="robots" content="noindex,nofollow">` set as a small additional safety belt. |

---

## 5. What remains stubbed (deliberately, behind Wiring Authority)

- **Live offer load** (`adapterStubGetOffer`): would call a tokenized public-read endpoint (e.g. `GET /api/usce/offer/:token`) returning a redacted offer payload (specialty/location/timing/duration/deadline/coordinator-message). **Not implemented in this task.** Currently rejects.
- **Live response write** (`adapterStubRespond`): would `POST /api/usce/offer/:token/respond` with `{ action, note }` and update server-side offer state, write a `usce_comms` audit row, and trigger any internal notification — none of which exists yet. Currently rejects.
- **Token issuance**: admin shell does not yet mint tokens. Tokenized-link generation, expiration, and one-time-use enforcement are reserved for Wiring Authority.
- **Postmark send / internal notification on response**: not present.
- **WooCommerce order pre-creation, deep-link customer-id, or PII handoff**: not present. The CTA opens the canonical product URL in a new tab with no query string.
- **LearnDash sync, paperwork sync**: not present.
- **CDN/R2 promotion of `LIVE/usce_offer.html`**: not performed (deploy explicitly out of scope).

---

## 6. Handoff file path

`/Users/brianb/MissionMed_AI_Sandbox/_WORKTREES/cx-offer-usce-public-intake-307/_AI_HANDOFFS/from_claude_code/CX-OFFER-314_UI_SHELL_HANDOFF.md`

---

## 7. Current git status summary

```
On branch: cx-offer-usce-public-intake-deploy-310i

Modified:
  LIVE/usce_admin.html              (+3 / -0)

Untracked (intended new files):
  LIVE/usce_offer.html
  _AI_HANDOFFS/from_claude_code/CX-OFFER-314_UI_SHELL_HANDOFF.md

Untracked (pre-existing local state, not from this task — Supabase CLI temp):
  supabase/.temp/gotrue-version
  supabase/.temp/pooler-url
  supabase/.temp/postgres-version
  supabase/.temp/project-ref
  supabase/.temp/rest-version
  supabase/.temp/storage-migration
  supabase/.temp/storage-version
```

No commit was made — committing is reserved for the next operator per workflow.

---

## 8. Recommended next AI / tool

- **Codex Wiring Authority** (or whichever protected-endpoint owner is current) for the next CX-OFFER ticket, because every remaining piece (token mint, public read, public response, Postmark, payment-state mirror) is server-side protected work that this UI-only assignment is forbidden to do.
- Visual/design review can also be done in parallel by Claude Code on the same branch if a polish pass is desired before token issuance lands.

---

## 9. Recommended next prompt title

**`CX-OFFER-315: Student offer portal — token mint + tokenized public read endpoint (Wiring Authority)`**

Suggested scope for that next prompt:
1. Mint `usce_offer_token` (one-time, time-bounded) when admin "send" is exercised in a future admin write path. **Do not** implement the admin "send" UI yet — only the table/RPC and a manual seed path for testing.
2. Add a public read endpoint `GET /api/usce/offer/:token` returning a redacted offer payload that matches the `applyOffer()` shape in `LIVE/usce_offer.html` (`specialty`, `location`, `timing`, `duration`, `format`, `reference`, `deadlineLabel`, `deadlineDetail`, `message`, `expiresAt`).
3. Keep response writes and Postmark out of scope of 315 (push those to 316/317).
4. After 315 lands, flip `liveAdapterEnabled` to `true` in a separate validation ticket and replace the two `adapterStub*` functions with real fetches.

---

## 10. Confidence and reservation

**Confidence: 92%**

**What I'm confident about:**
- Static UI / state-machine correctness — verified by full code read of every transition path. The WooCommerce CTA is structurally unreachable except via the `accepted` path.
- No protected wiring touched, no Supabase/server.mjs/Railway/WordPress/WooCommerce/LearnDash files modified — confirmed by `git diff --stat` showing only `LIVE/usce_admin.html` (+3 lines).
- No forbidden strings present.
- JS in both files parses cleanly.
- Brand consistency with the existing `LIVE/usce_admin.html` shell.

**Reservation (~8% confidence gap):**
- I did not load the page in a real browser to visually exercise every state, breakpoint, and accessibility focus path — validation was done via static syntax check + code review. A 5-minute manual click-through (load, accept → see Woo CTA + scroll behavior; reload, decline → confirm no Woo CTA visible; reload, request alternate with note → confirm note echo) is recommended before promoting to R2/CDN.
- The legacy `missionmed-hq/public/usce*.html` files were not opened — I relied on `LIVE/usce_admin.html` for visual idiom. If there is a newer brand directive that diverges from `LIVE/usce_admin.html`, this shell may need a follow-up alignment pass.
- The `WOO_URL` JS constant is unused in the executed code path. It is left in place as a reference but could be removed in a future polish pass if the linter flags it.
