# SYSTEM ARCHITECTURE: MissionMed AI Brain

**Version:** 1.0 | **Date:** 2026-04-18 | **Source:** MISSIONMED_MASTER_KNOWLEDGE.md Section 1 (1.1, 1.2, 1.3, 1.6) | **Authority:** MR-1367

**Excluded from this file:**
- Section 1.4 (Session Start Protocol) is superseded by `_SYSTEM/PRIMER_CORE.md`.
- Section 1.5 (AI Task Router) is maintained in `08_AI_SYSTEM/MissionMed_AI_Brain/KNOWLEDGE_INDEX.md`.

---

## 1. AI Brain Architecture

The MissionMed AI Knowledge System is a persistent structured knowledge base located at:

```
/Users/brianb/MissionMed/08_AI_SYSTEM/MissionMed_AI_Brain
```

### Purpose

Provide persistent structured knowledge that multiple AI tools can reference without reprocessing raw archives.

### AI Tools Expected to Use This System

- Claude
- ChatGPT
- Codex

---

## 2. System Layers (Query Priority Order)

All AI systems must query knowledge in the following priority order. Lower-numbered layers are consulted first.

| Order | Layer | Scope |
|-------|-------|-------|
| 1 | `topic_indexes` | Master navigation and routing |
| 2 | `decisions_log` | Authoritative record of all decisions made |
| 3 | `structured_knowledge` | Codified frameworks and analysis |
| 4 | `architecture_maps` | System diagrams and technical specs |
| 5 | `raw_history` | Last resort only |

### Rationale

- Topic indexes route the AI to the correct asset without full-file reads.
- The decisions log supersedes all other sources when conflicts appear.
- Raw history is expensive to process and noisy. Avoid unless no structured source exists.

---

## 3. Conflict Resolution Precedence

When multiple sources disagree on the same fact, the AI must resolve conflicts using the following precedence. Higher-priority sources override lower-priority ones, always.

| Priority | Source | Notes |
|----------|--------|-------|
| 1 | `decisions_log` | Authoritative. Overrides everything. |
| 2 | `structured_knowledge` | Codified institutional reasoning. |
| 3 | `architecture_maps` | Technical specifications and diagrams. |
| 4 | `raw_history` | Historical transcripts and archives. Lowest trust. |

### Enforcement

- If `decisions_log` states a value, no other source may override it.
- If the AI encounters a conflict and the higher-priority source is silent, it must escalate rather than guess.

---

## 4. Protected Systems

The following systems must NEVER be modified through AI-assisted operations. Any request that would alter these systems must be refused and escalated.

| System | Location | Risk |
|--------|----------|------|
| RankListIQ | `04_SOFTWARE/RankListIQ/` | User-facing web app |
| Oracle | `04_SOFTWARE/Oracle/` | Match prediction engine in development |
| Dr J Notes Engine | WordPress Post 4188 | Development prototype |
| Dr J Question Bank | `03_PROGRAMS/USMLE/DrJ-QuestionBank/` | Educational content database |
| LearnDash | WordPress plugin | Student course access |
| WooCommerce | WordPress plugin | Payment processing |
| Formidable Forms | WordPress plugin | Enrollment and lead capture |
| Elementor Pages | WordPress page builder | Blog operations must not touch page builder content |
| Embedded HTML Apps | Custom tools in WordPress pages | Custom rendered applications |

### Allowed WordPress Operations

Only the following WordPress operations are permitted through AI-assisted workflows:

- Blog posts (except Post 4188)
- Categories and tags
- Media uploads
- Post metadata

All other WordPress operations, including page builder content, plugin configuration, theme edits, and protected post types, require human action.

---

## 5. Integration Points

This section is pulled from the LOCKED naming canon for cross-reference. For the authoritative version see `_SYSTEM/NAMING_CANON.md`.

| Tab | Backend System(s) |
|-----|-------------------|
| **Home** | HQ Dashboard (aggregated) |
| **MedMail** | `AI_EMAIL_ENGINE/` |
| **Leads** | `LEAD_PIPELINE_UI/` |
| **Payments** | Stripe Connect + MMI Instructor API + Admin Engine REST |
| **Students** | Admin Engine + Supabase student views |
| **Media Engine** | MMVS / CIE unified endpoint |
| **Studio** | Studio workspace |
| **Member Dashboard** | LearnDash (separate portal) |
| **Settings** | WordPress options + Supabase config |

### Primary / Secondary Architecture

- **MASTER_STABLE_SYSTEM = MissionMed HQ** is the primary UI shell and main application.
- **WordPress** is the secondary layer, limited to authentication, REST API, payments, data proxy, and LearnDash course delivery.

For the full architecture model, see `_SYSTEM/NAMING_CANON.md` Section 5.

---

END OF SYSTEM ARCHITECTURE
