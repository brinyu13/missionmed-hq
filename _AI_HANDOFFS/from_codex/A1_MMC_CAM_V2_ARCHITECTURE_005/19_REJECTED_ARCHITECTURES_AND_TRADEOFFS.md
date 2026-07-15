# 19 Rejected Architectures and Tradeoffs

RESULT: `ALTERNATIVES_RESOLVED_TO_ONE_PATH`

## Rejected technical architectures

| Rejected option | Why rejected | Preserved value / tradeoff |
| --- | --- | --- |
| Make the current synchronous pipeline production | HTTP requests own filesystem scans, Webex download, AI, and sequential persistence; retry and failure boundaries are unsafe | Reuse domain intent and tests; move execution behind durable jobs. |
| Build MMC as a fully standalone app/auth stack | Duplicates mature HQ auth/session/CSRF and creates new ecosystem risk | Separate processing worker, while keeping a thin same-origin gateway. |
| Keep all work inside shared `server.mjs` | Expands protected blast radius and leaves request server as general media processor | Minimal route registration/security adapter only; bounded MMC modules. |
| Browser-direct Supabase/privileged access | Exposes authority and complicates CSRF/policy/audit | Same-origin queries/commands with short-lived scoped RLS principals. |
| Service role for convenience | Bypasses assignment RLS and magnifies leak risk | Scoped worker/database functions with explicit tenant/operation authority. |
| Full event sourcing rewrite | Excess complexity and migration risk for current scale | Canonical records + immutable audit/review/outbox + rebuildable projections. |
| Whole-state optimistic sync | Cannot represent deletes/empty truth, conflicts, or per-object failure | Versioned commands, idempotency, transactional aggregate updates. |
| One universal status/score | Conflates evidence, review, freshness, visibility, persistence, and identity | Orthogonal state dimensions and decomposed signals. |
| Composite student risk/readiness/trust | Current inputs are uncalibrated, stigmatizing, and non-predictive | Objective milestone/readiness, follow-through, deadline, data, support dimensions. |
| AI writes canonical objects | Unreviewed/hallucinated claims become operational | Immutable proposals → evidence check → human item review → new versions. |
| Client-authored identity evidence | Caller can fabricate authority; name/title/email are weak | Attested server adapter envelopes and conflict-safe decisions. |
| Boolean student visibility | Reuses private rows and cannot prove exact payload/version/withdrawal | Separate immutable publication projection and student-principal readback. |
| Reuse Daily Drills watcher/media registry | Couples unrelated protected systems and retention semantics | Dedicated MMC worker and source adapter; no watcher/registry touch. |
| Normalize media paths by moving/deleting | Creates irreversible data risk | Dual read-only alias adapter and opaque handles. |
| Rewrite historical migrations | Destroys lineage and may diverge applied state | Additive corrective migrations under explicit authority. |

## Rejected product and design architectures

| Rejected pattern | Reason | Selected replacement |
| --- | --- | --- |
| Partner Demo as target/reference | Brian explicitly rejects its design; generic card wall, feature IA, fixed width | CAM v2 first-principles mentor command system; dedicated rejection report. |
| Existing private UI as visual authority | Strong feature archaeology, weak semantic/mobile/state model | Preserve workflow evidence, replace shell/IA/state grammar. |
| Generic SaaS/CRM dashboard | Organizes database nouns rather than mentor decisions | Today / Students / Work / Reviews with dominant task vessel. |
| Eleven feature destinations | High choice cost and duplicated objects | Four mentor destinations; contextual tabs/inspectors. |
| KPI-first home | Counts do not explain what to do | Ranked, evidence-linked attention reasons. |
| One giant Student Profile | Long scroll and competing panels | Overview/Plan/History/Files with progressive disclosure. |
| Chat-first operating model | Hides provenance, object state, and repeatable workflows | Search/assistant is secondary to canonical objects and commands. |
| Student preview inside mentor DOM | Confuses a visual mock with authorization | Separate authenticated projection and exact-policy preview. |
| Dense desktop preserved on mobile | Causes overflow and missing operations | Responsive route transformations and mobile bottom navigation. |
| CAM gamification copied verbatim | XP/confetti/arcade language is wrong for sensitive mentoring | CAM depth/action/geometry/truth laws with calm MMC-specific continuity signature. |
| Decorative “AI dashboard” | Styling can imply authority without evidence | AI proposal/evidence/review inspector with restrained machine semantics. |

## Important tradeoffs

### HQ gateway versus independent service

Keeping HQ auth/gateway minimizes authentication risk but retains a shared registration dependency. The decision is to keep that dependency intentionally tiny; the worker may deploy separately. A future full service split requires a new identity/session authority decision, not gradual drift.

### Command records versus events

Canonical mutable records make queries and incremental migration practical. Immutable audit/review/outbox preserves accountability but is not a general event log capable of rebuilding every historical state. This is sufficient if before/after hashes, versions, and corrections are complete; if future regulatory needs demand full reconstruction, add domain events deliberately.

### Dense mentor desktop versus mobile universality

Desktop/laptop remain the fastest batch surfaces. Mobile uses sequential queue/detail/action rather than squeezing every column. Function stays complete, while batch throughput may be lower on a phone. No safety action becomes desktop-only.

### Automated prioritization versus explainability

An explainable rule may be less superficially “smart” than a composite model, but it supports correction, fairness, and action. AI may propose reasons; it cannot secretly rank students.

### Separate publication copies versus shared-row simplicity

Copying allowlisted fields introduces version/reconciliation work. It is selected because the privacy boundary, exact preview, withdrawal, and audit proof are materially stronger than a visibility flag on mentor objects.

### Strong identity gates versus throughput

Attested anchors and conflict review slow some imports. Wrong-subject coaching/media is a catastrophic error, so accuracy and reversible review outrank queue speed.

## No unresolved option fork

This package recommends one topology, one object/state model, one mentor IA, one student publication model, and one implementation sequence. Unknown production credentials, student auth authority, consent/retention policy, and platform deployment details are explicit future gates; they do not create incompatible architecture branches now.
