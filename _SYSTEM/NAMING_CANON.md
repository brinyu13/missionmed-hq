# NAMING CANON — MissionMed HQ

**Version:** 1.0 | **Date:** 2026-04-18
**Authority:** MR-SYS-001 + MR-HQ-001 + MR-HQ-003
**Status:** LOCKED — PERMANENT

This file defines the canonical naming, navigation, theme, system-mapping, and architecture model for MissionMed HQ. All AI-generated output, internal references, logs, architecture documents, and user-facing copy MUST conform. No exceptions.

---

## 1. SYSTEM NAMING CANON (MANDATORY — ENFORCED IN ALL PROMPTS)

**Effective:** 2026-03-29 | **Authority:** MR-SYS-001, MR-HQ-003 | **Status:** LOCKED — PERMANENT

All AI-generated output, internal references, logs, architecture documents, and user-facing copy MUST use the canonical names below. No exceptions.

### Platform Name

**MissionMed HQ**

### Module Names (Canonical)

| Module | Scope |
|--------|-------|
| **MedMail** | Email + communication engine |
| **Leads** | Lead tracking + conversion |
| **Payments** | Stripe + billing + enrollment |
| **Students** | Admin student management |
| **MissionMed Member Dashboard** | Student-facing portal |
| **Media Engine** | Video storage + tagging + scoring |
| **Studio** | Video editing |

### Internal System

| System | Note |
|--------|------|
| **Admin Engine** | Internal admin runtime — DO NOT expose publicly |

### Instructor Panel

The Instructor Panel has been fully absorbed into:
- **Payments** (instructor payment flows)
- **Students** (instructor-student management)
- **Settings** (instructor configuration)

It no longer exists as a standalone module.

### Deprecated Names — Auto-Correct Rules

If ANY of the following deprecated names appear in a prompt, internal reference, or output, they MUST be auto-corrected to the canonical name before execution:

| Deprecated Name | Correct Canonical Name |
|-----------------|----------------------|
| Admin HQ | MissionMed HQ |
| MissionMed ADMIN HQ | MissionMed HQ |
| MCC | Admin Engine (internal) / MissionMed HQ (platform) |
| MCC UI | MissionMed HQ |
| Pipeline | Leads |
| AI Dashboard | MissionMed HQ |
| MMVS | Media Engine |
| Instructor Panel | (absorbed — route to Payments / Students / Settings) |
| Command Center | Admin Engine |

### Enforcement

- This naming canon applies to ALL threads, ALL tasks, ALL outputs.
- Violation of naming canon = drift = must be corrected before task completion.
- If a prompt references a deprecated name, the AI must silently resolve to the canonical name and proceed.

---

## 2. NAVIGATION STRUCTURE (MANDATORY — ENFORCED IN ALL PROMPTS)

**Effective:** 2026-03-29 | **Authority:** MR-HQ-001 | **Status:** LOCKED — PERMANENT

The MissionMed HQ top navigation uses the following tab order. All implementations, wireframes, and architecture references MUST use this structure.

| Position | Tab | Module |
|----------|-----|--------|
| 1 | Home | HQ Dashboard |
| 2 | Payments | Payments |
| 3 | Students | Students |
| 4 | MedMail | MedMail |
| 5 | Leads | Leads |
| 6 | Media Engine | Media Engine |
| 7 | Studio | Studio |
| 8 | Settings | Settings |

### Enforcement

- This navigation order is LOCKED. No tabs may be added, removed, or reordered without a new MR-HQ-series prompt.
- The MissionMed Member Dashboard is a separate student-facing portal — it does NOT appear in the HQ navigation.
- The Admin Engine is internal runtime infrastructure — it does NOT appear as a visible tab.

---

## 3. THEME SYSTEM (MANDATORY — ENFORCED IN ALL PROMPTS)

**Effective:** 2026-03-29 | **Authority:** MR-HQ-001 | **Status:** LOCKED — PERMANENT

MissionMed HQ supports three visual themes. All themes share the SAME layout and navigation structure — only the visual layer (colors, typography, spacing, surface treatments) changes.

| # | Theme Name | Visual Reference | Default |
|---|-----------|-----------------|---------|
| 1 | **Classic** | RankListIQ style | YES (default) |
| 2 | **Operations** | Current Admin Engine (formerly MCC) style | No |
| 3 | **Media** | Media Engine (formerly MMVS) style | No |

### Rules

- Layout is IDENTICAL across all three themes. No theme may alter navigation structure, tab order, or module placement.
- Theme switching affects CSS/visual layer ONLY.
- Classic is always the default theme for new users.
- Theme preference is stored per-user.

---

## 4. SYSTEM MAPPING (MANDATORY REFERENCE)

**Effective:** 2026-03-29 | **Authority:** MR-HQ-001 | **Status:** LOCKED — PERMANENT

Each HQ tab maps to one or more existing backend systems. This mapping defines the data source and integration layer for each module.

| Tab | Backend System(s) | Notes |
|-----|-------------------|-------|
| **Home** | HQ Dashboard | Aggregated view — pulls summary data from all modules |
| **MedMail** | `AI_EMAIL_ENGINE/` | Email response engine + intelligence module |
| **Leads** | `LEAD_PIPELINE_UI/` | Lead pipeline management + scoring |
| **Payments** | Stripe Connect + MMI Instructor API + Admin Engine REST | Direct charges, enrollment, billing |
| **Students** | Admin Engine + Supabase student views | Student management, enrollment status, progress |
| **Media Engine** | MMVS / CIE unified endpoint | Video storage, tagging, scoring, MMVC bridge |
| **Studio** | Studio | Video editing workspace |
| **Member Dashboard** | LearnDash | Student-facing portal (separate from MissionMed HQ) |
| **Settings** | WordPress options + Supabase config | Platform settings, instructor config, theme selection |

### Integration Architecture

- **Admin Engine** is the internal runtime that powers the Admin HQ shell (formerly MCC / Command Center). It handles authentication, routing, REST proxy, and WordPress admin integration.
- **Supabase** is the operational data layer for Students, Leads, and system state.
- **Stripe Connect** uses direct charges with per-instructor application fees (MR-ARCH-003/004).
- **CIE** (Content Intelligence Engine) provides the unified read model for Media Engine (MR-1415/1416).
- **LearnDash** powers the Member Dashboard and course delivery — Admin HQ reads but does not directly modify LearnDash data.

---

## 5. ARCHITECTURE MODEL (MANDATORY — ENFORCED IN ALL PROMPTS)

**Effective:** 2026-03-29 | **Authority:** MR-HQ-003 | **Status:** LOCKED — PERMANENT

### Corrected Architecture

The previous architecture (MR-ARCH-001, MR-HQ-002) incorrectly implemented the MCC WordPress plugin as the PRIMARY UI shell with MASTER_STABLE_SYSTEM modules embedded inside it. **This is wrong and is hereby corrected.**

### PRIMARY SYSTEM

**MASTER_STABLE_SYSTEM = MissionMed HQ (MAIN APPLICATION)**

The MASTER_STABLE_SYSTEM is the primary UI shell and main application. It contains the full intelligence suite: the HQ Dashboard, Email Engine (MedMail), Lead Pipeline (Leads), Kanban task board, conversion analytics, student archetypes, and the shared state engine. This is the product.

### SECONDARY SYSTEM

**WordPress = Backend / API / Auth / Payments ONLY**

WordPress serves as the backend infrastructure layer. Its responsibilities are limited to:

| Responsibility | Details |
|---------------|---------|
| **Authentication** | WordPress admin roles and user session management |
| **REST API** | `missionmed-command-center/v1` namespace for data endpoints |
| **Payments** | Stripe Connect, WooCommerce, enrollment processing |
| **Data Proxy** | Supabase connectivity, CIE proxy bridge |
| **Course Delivery** | LearnDash integration for MissionMed Member Dashboard |

WordPress does NOT own the UI shell. It does NOT define the navigation structure. It does NOT render the primary admin interface.

### Implementation Implication

All future implementation threads must treat MASTER_STABLE_SYSTEM as the source of truth for:

- Navigation structure and tab order
- Module layout and visual hierarchy
- State management and cross-module coordination
- Admin UI rendering and interaction patterns

WordPress plugin code serves these modules by providing authenticated data endpoints and backend services — it does not wrap or contain them.

### Deprecated Architecture Pattern

The following pattern is DEPRECATED and must not be used:

```
WRONG: WordPress plugin (MCC) → embeds MASTER_STABLE modules as iframes/sub-views
```

The correct pattern is:

```
CORRECT: MissionMed HQ (MASTER_STABLE) → consumes WordPress REST API / Auth / Payments as backend services
```

---

END OF NAMING CANON
