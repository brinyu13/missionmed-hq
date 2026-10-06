# Registry reconciliation draft — IR-INTERVIEW-READY-0002 (not filed)

Status: DRAFT for the canonical registrar. Produced 2026-10-06 by the Claude Foreman session, which could not acquire REGISTRY (no Keychain/credential in the Cowork VM). No file under `/Users/brianb/MissionMed_OS` was modified. Fresh fetch/allocation/keeper/fence/staged review/push/readback/release remain mandatory.

## 1. Mission record delta (`missions.json`, id `IR-INTERVIEW-READY-0002`)

Current (stale): `gate: "DR-391: public-commerce release only; independent exact-byte/live acceptance pending. ACCOUNT VERIFICATION DEFERRED TO PHASE 1.1; no account LIVE claim."`, `next_action: "Release reviewed compact public commerce …"`, `updated_at: 2026-10-05T22:52Z`.

Proposed:

- `gate`: "PUBLIC COMMERCE LIVE + VERIFIED (independent live acceptance 2026-10-06, worktree FINISH_NOW_COMMERCE_CASE_INDEPENDENT_LIVE_ACCEPTANCE.md; runtime HTML d4439bb8…, package 3621ddb7…, layout 489deab9…). DR-391 expired at that closure. Founder curation delta (local commits 329f458 → cb05add) awaits DR-<new>; ACCOUNT VERIFICATION DEFERRED TO PHASE 1.1; no account LIVE claim."
- `next_action`: "Under DR-<new>: push cb05add, exact PATH lease on the six IR-owned curation paths, immutable package from full ref cb05add84198a79a3ef4c8654e9fa57592657d9c, independent package/media/recovery review, seven-step guarded release, non-builder live acceptance, provider-clear. Accounts/admin remain Phase 1.1."
- `packets` += `decisions/DR-<new>_ir_founder_curation_investment_classes.md`, `handoffs/from_claude/IR_INTERVIEW_READY_0002/CURATION_20261006.md` (copy of the worktree HANDOFF.md).
- `builder`: "claude-ir-foreman" (Founder froze Codex implementation 2026-10-06; record the model takeover explicitly).

Also update `PRODUCT_PASSPORTS/interview-ready.md` "Current status" paragraph: public commerce LIVE + VERIFIED (dated); "Three tiers" sentence → "Three investment classes (Business Class, First Class, Private Jet) as cost bands with multiple products per class; independent badges". `CURRENT.md` is generated; regenerate, do not hand-edit.

## 2. Decision draft — DR-<new> Interview Ready founder curation: investment classes and multiple products

```
---
decision: DR-<new> Interview Ready founder curation — investment classes and multiple products
date: 2026-10-06
decider: Brian
scope: IR-only catalog/presentation delta on the accepted public-commerce release; six IR-owned source paths; no gateway/account/Matrix/provider change.
evidence: Founder direction recorded in ANTHROPIC_TAKEOVER_MASTER.md / COMMERCE_CATALOG_STATE.md (2026-10-06); local commits 329f458, cb05add; independent review INDEPENDENT_REVIEW_20261006.md (APPROVE WITH CONDITIONS, conditions 1-3,5,6 closed; condition 4 = this decision).
rollback: IR code/pointer only to current layout 489deab9… / HTML d4439bb8…; preserve private state, identities, siblings, shared15.
expiry: Independent live acceptance of the curation release, revocation, or protected gate failure.
---
1. Supersede the one-primary-per-class constraint: CATEGORY → INVESTMENT CLASS → MULTIPLE PRODUCTS. Business Class, First Class, Private Jet are cost/investment bands, not quality scores. Independent badges (vocabulary in catalog.json → curation.badges) are assigned only by Founder statement.
2. Admit the ten verified products listed in HANDOFF.md, expressly including Logitech MX Brio (B0BFJ4CRKD) and Elgato Key Light Air MK.2 (B0GYDFGCCQ), whose 2026-10-04 rating-threshold holds are superseded by this dated Founder decision; the dated listing-read evidence in evidence/founder-curation-2026-10-06.json is the inclusion record. Shure MV7+ is retained and must not be substituted by SM7B/SM7dB. [Founder: SM7B keep / archive.] [Founder: EMEET S600 and NEEWER softbox keep with Amazon-only source / drop.]
3. Preserve: accepted cinematic design and row-0 primary cards, existing kit identifiers, any-two comparison, missionmatch-20 destinations, numeric Amazon content OFF, charity OFF, safe imagery fallbacks, device-only persistence, unchanged gateway/addon bytes (819dd734…, 238d9369…).
4. Exact paths: interview-ready/catalog.json, completion.js, completion.css, src.html, qa.py, evidence/founder-curation-2026-10-06.json. The MU-plugin KIT_KEYS allowlist is NOT admitted here (Phase 1.1).
5. Gates unchanged from DR-375/376: exact PATH lease, immutable package from the full 40-hex ref, independent exact-byte/media/recovery review, seven-step guarded release with readback and narrow refresh, non-builder dated live acceptance (desktop/mobile/reduced motion; row-0 unchanged; second-row kit save; comparison across rows; all Amazon links tagged), provider-clear release. No self-approval, no forced lease, no automatic retry.
```
