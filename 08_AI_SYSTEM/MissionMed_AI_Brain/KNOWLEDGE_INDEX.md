# MissionMed AI Brain — Master Knowledge Index

**Created:** 2026-03-06 | **Last Updated:** 2026-04-18 | **Version:** 3.28
**Maintained by:** AI System (update this file whenever new knowledge assets are added)
**Purpose:** Central navigation map for all knowledge resources inside the MissionMed ecosystem. Use this file to locate reference material for any task — content creation, website editing, tool development, strategy planning, audits, or system architecture work.

---

## MAINTENANCE PROTOCOL

> **This file is the master navigation router for the MissionMed AI knowledge system.**
>
> Whenever a new knowledge asset is created (protocol, report, framework, dataset, or architecture document), an entry must be added to this index.
>
> The "Last Updated" field above must reflect the most recent update.
>
> Failure to update this file will create knowledge routing gaps that cause AI sessions to miss critical context files.
>
> **Update triggers:** Any new MR-series report, any new knowledge file in 08_AI_SYSTEM, any new strategic document, any new data asset in 05_DATA, any new brand/marketing asset in 01_BRAND.

---

## AUTOMATION MANAGED REGISTRY

Only the block below may be written by the MAC-5 knowledge automation system. All other sections in this file are read-only unless a human intentionally edits them.

<!-- BEGIN AUTO-KNOWLEDGE-REGISTRY -->
- 2026-03-27 | SYSTEM / KNOWLEDGE OPS | `08_AI_SYSTEM/RUNNER/README_KNOWLEDGE_AUTOMATION.md` | MAC-5 Knowledge Automation System | Operational guide for the config-driven MissionMed knowledge updater, validator, retry policy, and activity log system.
<!-- END AUTO-KNOWLEDGE-REGISTRY -->

---

## How to Use This Index

This is the starting point for any AI session working within the MissionMed ecosystem. Before answering questions or generating content:

1. **Identify your task type** in the AI TASK ROUTER section below and load all required knowledge files
2. Follow the query priority defined in `PRIMER_CORE.md` (in `_SYSTEM/`): topic_indexes → decisions_log → structured_knowledge → architecture_maps → raw_history
3. If sources disagree, `decisions_log` is authoritative
4. Use the Quick Reference table at the bottom for additional lookups by topic

All paths below are relative to the MissionMed root folder.

---

## AI TASK ROUTER

> **Before executing any task, the AI must consult this router to determine which knowledge assets must be loaded. Tasks must not begin until the required knowledge sources have been consulted.**
>
> Identify your task type below, then load ALL listed files before producing any output. Files marked **P0** are always required regardless of task type.

### P0 - Universal (Load for EVERY Task)

| File | Location |
|------|----------|
| PRIMER_CORE.md | `_SYSTEM/` |
| KNOWLEDGE_INDEX.md | `08_AI_SYSTEM/MissionMed_AI_Brain/` (this file) |

---

### Task Type 1: Website Copywriting

**Trigger:** Writing or rewriting any text that will appear on missionmedinstitute.com — hero sections, landing pages, section copy, CTAs, product descriptions, bio sections, FAQ answers.

> **Also load:** `cu-GBL-1_Global_Design_Conversion_System.docx` (Root) — for conversion framework and component library context.

| Required Knowledge Source | File | Location |
|--------------------------|------|----------|
| Brand identity, tone rules, differentiators | `BRAND_CONTEXT.md` | `_KNOWLEDGE/` |
| Dr. Brian voice & tone patterns | `missionmed_dr_brian_voice.md` | `08_AI_SYSTEM/MissionMed_AI_Brain/` |
| Student psychology & pain points | `missionmed_student_psychology.md` | `08_AI_SYSTEM/MissionMed_AI_Brain/` |
| Testimonial database (4-tier) | `MISSIONMED_TESTIMONIAL_DATABASE.md` | `08_AI_SYSTEM/MissionMed_AI_Brain/` |
| Persuasion language (105 sentences) | `MISSIONMED_PERSUASION_LANGUAGE_LIBRARY.md` | `08_AI_SYSTEM/PHASE1_CONVERSION_INTELLIGENCE/` |
| Conversion playbook (301 threads) | `MISSIONMED_CONVERSION_PLAYBOOK.md` | `08_AI_SYSTEM/PHASE1_CONVERSION_INTELLIGENCE/` |
| Legacy proven copy | `MISSIONRESIDENCY_PAGES.md` | `06_AI_CONTEXT/LEGACY_CONTENT/MISSIONRESIDENCY/` |
| Knowledge philosophy (5-layer value prop) | `MISSIONMED_KNOWLEDGE_PHILOSOPHY_CORE_MASTER.md` | `06_AI_CONTEXT/KNOWLEDGE_PHILOSOPHY_CORE/` |
| Conversion signal model (33 signals) | `MISSIONMED_CONVERSION_SIGNAL_MODEL.md` | `08_AI_SYSTEM/` |
| MissionMed system context (full ecosystem) | `MISSIONMED_SYSTEM_CONTEXT.md` | `06_AI_CONTEXT/` |
| MissionResidency legacy system context | `MISSIONRESIDENCY_SYSTEM_CONTEXT.md` | `06_AI_CONTEXT/` |

**Verification before delivery:** Does the copy sound like Dr. Brian? Are warmth markers preserved? Are persuasion patterns sourced from the library? Zero placeholders? Is the conversion flow present (hook → credibility → proof → objection handling → CTA)?

---

### Task Type 2: Website Architecture / Page Layout

**Trigger:** Modifying page structure, adding/removing sections, changing navigation, redesigning page flow, Elementor structural changes.

| Required Knowledge Source | File | Location |
|--------------------------|------|----------|
| Website architecture blueprint | `MissionMed_Final_Website_Architecture.docx` | `08_AI_SYSTEM/STRATEGIC_REVIEWS/` |
| Blueprint reconciliation | `MissionMed_Website_Blueprint_Reconciliation.docx` | `08_AI_SYSTEM/STRATEGIC_REVIEWS/` |
| Conversion signal model (33 signals) | `MISSIONMED_CONVERSION_SIGNAL_MODEL.md` | `08_AI_SYSTEM/` |
| Student intent model | `MISSIONMED_STUDENT_INTENT_MODEL.md` | `08_AI_SYSTEM/PHASE1_CONVERSION_INTELLIGENCE/` |
| Website conversion strategy | `MissionMed_Website_Conversion_Strategy_2026.docx` | `02_WEBSITES/missionmedinstitute/strategy/` |
| Homepage blueprint | `MissionMed_Homepage_Blueprint_2026.docx` | `02_WEBSITES/missionmedinstitute/homepage/` |
| Mission Residency page blueprint (CURRENT) | `MR-833_Mission_Residency_Blueprint.html` | Root MissionMed folder |
| Mission Residency page blueprint (MR-832 base) | `MR-832_Mission_Residency_Blueprint.html` | Root MissionMed folder |
| Mission Residency page blueprint (MR-827 original) | `MR-827_Mission_Residency_Blueprint.html` | Root MissionMed folder |
| Mission Residency Elementor implementation map | `MR-827_Elementor_Implementation_Map.md` | Root MissionMed folder |
| Mission Residency UI/UX audit (MR-800) | `MR-800_UI_UX_Visual_System_Audit_Narrative_Architecture_2026-03-21.docx` | Root MissionMed folder |
| Mission Residency red team audit (MR-832) | `MR-832_RedTeam_Audit.md` | Root MissionMed folder |
| Design constraint system (active version) | `MR-1316_Design_Constraint_System.docx` | Root MissionMed folder |
| Global Design + Conversion System (cu-GBL-1) | `cu-GBL-1_Global_Design_Conversion_System.docx` | Root MissionMed folder |
| HTML deployment lock (CONDITIONAL: load only if task touches `arena.html`, `drills.html`, or `ranklistiq.html`) | `PRIMER_EXT_HTML_DEPLOY.md` | `_SYSTEM/` |

**Verification before delivery:** Does the structure match the documented architecture? Are conversion elements placed per the signal model? Does the output pass MR-1316 Premium Filter (BLOCKING items at minimum)? Has the section registry been updated? Does the output follow cu-GBL-1 component library and page blueprints? If the task modified `arena.html`, `drills.html`, or `ranklistiq.html`, was `PRIMER_EXT_HTML_DEPLOY.md` loaded and its protocol followed?

---

### Task Type 3: Conversion Strategy / Optimization

**Trigger:** Funnel analysis, CRO work, A/B test planning, lead scoring adjustments, enrollment flow optimization, CTA strategy.

| Required Knowledge Source | File | Location |
|--------------------------|------|----------|
| Conversion intelligence pointer index | `CONVERSION_INTEL.md` | `_KNOWLEDGE/` |
| Conversion playbook (301 threads) | `MISSIONMED_CONVERSION_PLAYBOOK.md` | `08_AI_SYSTEM/PHASE1_CONVERSION_INTELLIGENCE/` |
| Persuasion language (105 sentences) | `MISSIONMED_PERSUASION_LANGUAGE_LIBRARY.md` | `08_AI_SYSTEM/PHASE1_CONVERSION_INTELLIGENCE/` |
| Student intent model | `MISSIONMED_STUDENT_INTENT_MODEL.md` | `08_AI_SYSTEM/PHASE1_CONVERSION_INTELLIGENCE/` |
| Student archetype model (8 types) | `MISSIONMED_STUDENT_ARCHETYPE_MODEL.md` | `08_AI_SYSTEM/PHASE1_CONVERSION_INTELLIGENCE/` |
| Testimonial database | `MISSIONMED_TESTIMONIAL_DATABASE.md` | `08_AI_SYSTEM/MissionMed_AI_Brain/` |
| Conversion signal model | `MISSIONMED_CONVERSION_SIGNAL_MODEL.md` | `08_AI_SYSTEM/` |
| Sales patterns & objection handling | `missionmed_sales_patterns.md` | `08_AI_SYSTEM/MissionMed_AI_Brain/` |
| Red flag match framework (taxonomy + proof routing) | `RED_FLAG_MATCH_FRAMEWORK.md` | `08_AI_SYSTEM/MissionMed_AI_Brain/` |
| Red flag match cases (35 structured entries) | `RED_FLAG_MATCH_CASES.md` | `04_PROOF/TESTIMONIALS/` |

**Verification before delivery:** Are recommendations grounded in empirical conversion data (not generic CRO)? Do they reference specific archetype conversion rates? Are proposed CTAs sourced from the persuasion library?

---

### Task Type 4: Advising / Program Content

**Trigger:** Creating advising materials, program descriptions, curriculum content, student-facing educational resources, match strategy guides.

| Required Knowledge Source | File | Location |
|--------------------------|------|----------|
| Advising frameworks (10 methods) | `missionmed_advising_frameworks.md` | `08_AI_SYSTEM/MissionMed_AI_Brain/` |
| Match strategy (10 domains) | `missionmed_match_strategy.md` | `08_AI_SYSTEM/MissionMed_AI_Brain/` |
| Student archetype model | `MISSIONMED_STUDENT_ARCHETYPE_MODEL.md` | `08_AI_SYSTEM/PHASE1_CONVERSION_INTELLIGENCE/` |
| Student psychology & pain points | `missionmed_student_psychology.md` | `08_AI_SYSTEM/MissionMed_AI_Brain/` |
| Red flag classification & recovery | `missionmed_common_red_flags.md` | `08_AI_SYSTEM/MissionMed_AI_Brain/` |
| Red flag match framework (taxonomy + conversion intel) | `RED_FLAG_MATCH_FRAMEWORK.md` | `08_AI_SYSTEM/MissionMed_AI_Brain/` |
| Knowledge philosophy core | `MISSIONMED_KNOWLEDGE_PHILOSOPHY_CORE_MASTER.md` | `06_AI_CONTEXT/KNOWLEDGE_PHILOSOPHY_CORE/` |
| Legacy match guides | `MISSIONRESIDENCY_MATCH_GUIDES.md` | `06_AI_CONTEXT/LEGACY_CONTENT/MISSIONRESIDENCY/` |
| MissionMed system context (full ecosystem) | `MISSIONMED_SYSTEM_CONTEXT.md` | `06_AI_CONTEXT/` |
| MissionResidency legacy system context | `MISSIONRESIDENCY_SYSTEM_CONTEXT.md` | `06_AI_CONTEXT/` |

**Verification before delivery:** Does the content reflect Dr. Brian's advising methodology? Is archetype-specific language used? Are red flag recovery frameworks applied where relevant?

---

### Task Type 5: Email Messaging / Funnels

**Trigger:** Writing email sequences, enrollment follow-ups, lead nurture emails, student communications, drip campaigns, response templates.

| Required Knowledge Source | File | Location |
|--------------------------|------|----------|
| Email conversion insights | `MISSIONMED_EMAIL_CONVERSION_INSIGHTS.md` | `08_AI_SYSTEM/PHASE1_CONVERSION_INTELLIGENCE/` |
| Top conversion emails | `MISSIONMED_TOP_CONVERSION_EMAILS.md` | `08_AI_SYSTEM/PHASE1_CONVERSION_INTELLIGENCE/` |
| Persuasion language library | `MISSIONMED_PERSUASION_LANGUAGE_LIBRARY.md` | `08_AI_SYSTEM/PHASE1_CONVERSION_INTELLIGENCE/` |
| Student psychology model | `missionmed_student_psychology.md` | `08_AI_SYSTEM/MissionMed_AI_Brain/` |
| Dr. Brian voice patterns | `missionmed_dr_brian_voice.md` | `08_AI_SYSTEM/MissionMed_AI_Brain/` |
| Email response engine spec | `MISSIONMED_EMAIL_RESPONSE_ENGINE.md` | `08_AI_SYSTEM/` |
| Sales patterns & objections | `missionmed_sales_patterns.md` | `08_AI_SYSTEM/MissionMed_AI_Brain/` |
| Response timing optimization | `MISSIONMED_RESPONSE_TIMING_OPTIMIZATION.md` | `08_AI_SYSTEM/PHASE1_CONVERSION_INTELLIGENCE/` |
| MissionMed system context (full ecosystem) | `MISSIONMED_SYSTEM_CONTEXT.md` | `06_AI_CONTEXT/` |
| MissionResidency legacy system context | `MISSIONRESIDENCY_SYSTEM_CONTEXT.md` | `06_AI_CONTEXT/` |

**Verification before delivery:** Does the email follow Dr. Brian's documented structure (personal opener → value → CTA → warm close)? Are signature phrases used naturally? Is urgency calibrated to the student's intent score?

---

### Task Type 6: Technical / System Work

**Trigger:** WordPress/Elementor changes, API integrations, MCP connector work, database changes, infrastructure, codebase modifications, AI system architecture.

| Required Knowledge Source | File | Location |
|--------------------------|------|----------|
| AI Brain architecture summary (layers, conflict precedence, protected systems) | `SYSTEM_ARCHITECTURE.md` | `_KNOWLEDGE/` |
| AI Brain architecture | `MissionMed_AI_Brain_Architecture_2026.docx` | `08_AI_SYSTEM/MissionMed_AI_Brain/` |
| System context (full ecosystem) | `MISSIONMED_SYSTEM_CONTEXT.md` | `06_AI_CONTEXT/` |
| Master Prompt Protocol | `MR-034_MissionMed_Master_Prompt_Protocol_2026-03-14.docx` | `08_AI_SYSTEM/` |
| Command Center core infrastructure package | `MAC-6_Command_Center_Core_Infrastructure.md` | `08_AI_SYSTEM/COMMAND_CENTER_CORE/` |
| WP MCP connector architecture | `missionmed-wp-connector-architecture.md` | `02_WEBSITES/wordpress-snippets/` |
| System Intelligence Audit | `MissionMed_System_Intelligence_Audit_2026-03-14.docx` | `08_AI_SYSTEM/` |
| Most recent MR-series report for the affected system | `06_AI_CONTEXT/MR-*` | Check for latest report touching this system |
| MissionResidency legacy system context | `MISSIONRESIDENCY_SYSTEM_CONTEXT.md` | `06_AI_CONTEXT/` |
| Decisions log (authoritative) | `DECISIONS_INDEX.md` | `08_AI_SYSTEM/MissionMed_AI_Brain/decisions_log/` |

**Verification before delivery:** Is the current system state documented before changes? Are protected systems untouched? Has the decisions log been updated? Has cache been cleared (if WordPress)?

---

### Task Type 7: Audit / Red Team Review

**Trigger:** Page audits, funnel audits, conversion audits, red team analysis, competitive benchmarks, system reviews.

| Required Knowledge Source | File | Location |
|--------------------------|------|----------|
| All P0 files | See Universal section above | |
| Current operational state, gaps, known blockers | `OPERATIONAL_STATE.md` | `_KNOWLEDGE/` |
| MissionMed system context (full ecosystem) | `MISSIONMED_SYSTEM_CONTEXT.md` | `06_AI_CONTEXT/` |
| MissionResidency legacy system context | `MISSIONRESIDENCY_SYSTEM_CONTEXT.md` | `06_AI_CONTEXT/` |
| Decisions log (authoritative) | `DECISIONS_INDEX.md` | `08_AI_SYSTEM/MissionMed_AI_Brain/decisions_log/` |
| Positioning extraction | `MissionMed_Positioning_Extraction_2026.docx` | `01_BRAND/marketing-assets/` |
| Conversion playbook | `MISSIONMED_CONVERSION_PLAYBOOK.md` | `08_AI_SYSTEM/PHASE1_CONVERSION_INTELLIGENCE/` |
| Student archetype model | `MISSIONMED_STUDENT_ARCHETYPE_MODEL.md` | `08_AI_SYSTEM/PHASE1_CONVERSION_INTELLIGENCE/` |
| Legacy site audit (baseline) | `MISSIONRESIDENCY_SITE_AUDIT.md` | `06_AI_CONTEXT/` |
| Previous audit/red team reports | `MR-040_Red_Team_Audit_Mission_Residency_2026-03-13.docx` | `06_AI_CONTEXT/` |
| Revenue intelligence review | `MissionMed_Revenue_Intelligence_Strategic_Review.docx` | `08_AI_SYSTEM/STRATEGIC_REVIEWS/` |

**Verification before delivery:** Are all findings classified HIGH/MEDIUM/LOW? Are HIGH findings converted into proposed MR-XXX action items? Does the audit reference empirical data (not generic observations)?

---

### Task Type 8: Strategic Planning / Architecture

**Trigger:** Business strategy, product planning, pricing decisions, roadmap development, partnership strategy, competitive positioning.

| Required Knowledge Source | File | Location |
|--------------------------|------|----------|
| Knowledge philosophy core | `MISSIONMED_KNOWLEDGE_PHILOSOPHY_CORE_MASTER.md` | `06_AI_CONTEXT/KNOWLEDGE_PHILOSOPHY_CORE/` |
| Program tiers, pricing, audience segments, key stats, refund policy | `PROGRAM_DETAILS.md` | `_KNOWLEDGE/` |
| Positioning extraction | `MissionMed_Positioning_Extraction_2026.docx` | `01_BRAND/marketing-assets/` |
| Revenue intelligence review | `MissionMed_Revenue_Intelligence_Strategic_Review.docx` | `08_AI_SYSTEM/STRATEGIC_REVIEWS/` |
| Website architecture | `MissionMed_Final_Website_Architecture.docx` | `08_AI_SYSTEM/STRATEGIC_REVIEWS/` |
| Sales patterns & pricing | `missionmed_sales_patterns.md` | `08_AI_SYSTEM/MissionMed_AI_Brain/` |
| Student archetype model | `MISSIONMED_STUDENT_ARCHETYPE_MODEL.md` | `08_AI_SYSTEM/PHASE1_CONVERSION_INTELLIGENCE/` |
| Strategic positioning review | `MissionMed_Strategic_Positioning_Review.docx` | `00_ADMIN/` |
| Decisions log (all prior decisions) | `DECISIONS_INDEX.md` | `08_AI_SYSTEM/MissionMed_AI_Brain/decisions_log/` |

**Verification before delivery:** Are recommendations grounded in existing institutional data? Have prior decisions been respected or explicitly overridden with rationale? Has DECISIONS_INDEX.md been updated?

---

### Task Type 9: Report / Document Generation

**Trigger:** Creating MR-series completion reports, audit reports, system documentation, strategic deliverables as .docx files.

| Required Knowledge Source | File | Location |
|--------------------------|------|----------|
| Master Prompt Protocol | `MR-034_MissionMed_Master_Prompt_Protocol_2026-03-14.docx` | `08_AI_SYSTEM/` |
| Most recent report for context | Check `06_AI_CONTEXT/MR-*` | Latest report in the series |
| System context | `MISSIONMED_SYSTEM_CONTEXT.md` | `06_AI_CONTEXT/` |

**Verification before delivery:** Is the document complete (no truncation)? Has it been validated (if .docx, run validate.py)? Does the filename follow MR-XXX_Title_YYYY-MM-DD.docx convention? Is it saved to the correct folder (06_AI_CONTEXT for task reports, 08_AI_SYSTEM for system documents)?

---

### Multi-Type Tasks

Many tasks span multiple types. When a task involves more than one type (e.g., a website edit that requires both copywriting and architecture changes), load the union of ALL required files from each applicable task type. When in doubt, load more files rather than fewer — the cost of loading an unnecessary file is negligible; the cost of missing a critical file is a failed output.

---

## Complete Folder Architecture Map

```
MissionMed/
├── 00_ADMIN/              Business docs, audits, changelog, project management
│   ├── business-docs/     CHANGELOG.md, cleanup reports, project audits
│   └── inbox/             Temporary processing scripts
├── 01_BRAND/              Logos, fonts, color palette, marketing assets
│   └── marketing-assets/  Positioning extraction, brand strategy documents
├── 02_WEBSITES/           Website content, audits, blueprints, build files
│   ├── landing-pages/     Standalone landing page designs (e.g., Didn't Match page)
│   ├── missionmedinstitute/
│   │   ├── audits/        Blog audit, homepage audit, UX/CRO audit
│   │   ├── blog/          Blog architecture, deployment plan
│   │   ├── homepage/      Homepage blueprints, copy packages, implementation reports
│   │   ├── seo/           SEO authority map
│   │   └── strategy/      Website conversion strategy
│   ├── missionresidency/  Legacy site files
│   └── wordpress-snippets/ WP connector architecture docs
├── 03_PROGRAMS/           Program content and curriculum
│   └── MissionResidency/
│       └── videos/        Training session recordings (Session C, Session D, PASS Workshop)
├── 04_PROOF/              Social proof, testimonials, alumni outcomes
│   ├── ALUMNI_OUTCOMES/   Alumni research, outcomes reports, outcomes tables (.xlsx)
│   ├── TESTIMONIALS/      Facebook testimonial archives, testimonial libraries, master CSVs
│   └── _raw/              Raw/unprocessed testimonial data and alumni research logs
├── 04_SOFTWARE/           Application codebases (PROTECTED)
│   ├── RankListIQ/        Rank list optimizer (frontend, engine, supabase)
│   ├── Oracle/            Match prediction engine (frontend, engine, supabase)
│   └── FutureTools/       Placeholder for future products
├── 05_DATA/               Analytics, exports, databases
│   ├── email_exports/     Sent.mbox (7,180 emails — source for Phase 2 intelligence)
│   └── exports/           Student database batches (BATCH_01–12.csv), alumni seed datasets
├── 06_AI_CONTEXT/         AI reference material, task reports, system context
│   ├── KNOWLEDGE_PHILOSOPHY_CORE/  Founder transcripts, 5-layer value proposition
│   ├── LEGACY_CONTENT/MISSIONRESIDENCY/  Extracted Squarespace site archive (7 files)
│   └── MR-series reports  Task completion reports (MR-021B through MR-041)
├── 07_BACKUPS/            System backups
│   └── BACKUPS/MASTER_STABLE_SYSTEM/  Baseline system snapshot
├── 08_AI_SYSTEM/          AI Brain, operational systems, strategic reviews
│   ├── AI_BRAIN/          System state engine (JSON + JS)
│   ├── AI_DASHBOARD/      Advising dashboard (HTML/JS/CSS + intelligence panels)
│   ├── AI_EMAIL_ENGINE/   Email response engine (HTML/JS/CSS + intelligence module)
│   ├── COMMAND_CENTER_CORE/  Locked Command Center infrastructure specs and build package
│   ├── LEAD_PIPELINE_UI/  Lead pipeline management interface (HTML/JS/CSS)
│   ├── MissionMed_AI_Brain/  Core knowledge files, session primer, decisions log
│   ├── PHASE1_CONVERSION_INTELLIGENCE/  Admissions email analysis (301 threads, 71 conversions)
│   ├── STRATEGIC_REVIEWS/  Website architecture, revenue intelligence, blueprint reconciliation
│   └── missionmed-wp-mcp/ WordPress MCP connector (Node.js)
├── 09_BACKUPS/            Additional backup storage
└── [Root-level files]     MR-series early reports, USMLE build packages, protocol files
```

---

## 1. Legacy Content

Verbatim content extracted from the legacy MissionResidency.com Squarespace site (March 2026). This archive preserves all written content for reuse during migration to MissionMed Institute.

**Location:** `06_AI_CONTEXT/LEGACY_CONTENT/MISSIONRESIDENCY/`

| File | Description | Knowledge Type | Recommended Use |
|------|-------------|----------------|-----------------|
| `MISSIONRESIDENCY_PAGES.md` | Full text of all 11 site pages: homepage, MatchFirst™, Meet Dr. Brian, reviews, events, contact, waitlist, consultation, refund policy, MatchGear | Website copy, brand messaging, CTAs, social proof stats | Source material when building MissionMed site pages, homepage copy, and about sections |
| `MISSIONRESIDENCY_BLOG.md` | Full text of all 9 blog articles from Match Insights & Updates (Day 1 intern tips, Couples Match, limited license guide, growth vs. scores, visa alert, interview count, USCE, personal statement, Step 3) | Educational articles, SEO content, Dr. Brian's voice | Primary source for MissionMed blog article creation — rewrite, expand, or adapt per Knowledge Index reuse strategies |
| `MISSIONRESIDENCY_FAQS.md` | All 9 FAQ Q&A pairs from the training FAQs page (timing, course selection, red flags, pricing, financing, risk, USCE, scheduling) | Product Q&A, objection handling, pricing rationale | Reference for MissionMed FAQ pages, sales pages, and enrollment support content |
| `MISSIONRESIDENCY_MATCH_GUIDES.md` | 6 strategy guides: MatchGUIDE entry point, MatchStrategy hub (with LOR guide), Red Flags & Recovery, Types of USCE comparison, Low Step 2 CK guidance, Personal Statement red flags (with speeding ticket analogy) | Deep educational content, NRMP data citations, decision frameworks | Highest-value content for pillar article development on MissionMed blog |
| `MISSIONRESIDENCY_PRODUCTS.md` | 3 program tiers with pricing, MatchFirst™ deferred payment, financing options, discounts, MatchGear affiliate page, USCE referral service | Product definitions, pricing models, competitive positioning | Reference for MissionMed course page design, pricing decisions, and product architecture |
| `MISSIONRESIDENCY_CONTENT_INDEX.md` | Master catalog of all extracted content with page inventories, article lists, FAQ lists, site architecture notes, and basic reuse recommendations | Structural overview, navigation reference | Quick lookup to find which archive file contains a specific piece of content |
| `MISSIONRESIDENCY_KNOWLEDGE_INDEX.md` | Enhanced index with per-asset reuse strategies (migrate verbatim / rewrite for SEO / expand into pillar / reference only), downloadable asset candidates, NRMP data citations, frameworks, marketing copy inventory, and 10 identified content gaps | Content strategy, editorial planning, SEO roadmap | Primary planning document for MissionMed blog content calendar and article development |

### Additional Legacy Context Files

**Location:** `06_AI_CONTEXT/`

| File | Description | Knowledge Type | Recommended Use |
|------|-------------|----------------|-----------------|
| `MISSIONRESIDENCY_SITE_AUDIT.md` | Full page-by-page audit of missionresidency.com (2026-03-05). Contains site map, navigation structure, conversion funnel analysis, pricing tables, FAQ summaries. Notes: consultation scheduling is DISABLED (primary lead path broken). | Site architecture, UX audit, conversion analysis | Reference when redesigning the MissionMed website or fixing broken conversion paths |
| `MISSIONRESIDENCY_SYSTEM_CONTEXT.md` | Brand identity document: program tiers (BootCamp/Masterclass/360 Elite), audience segments, tone rules, tech stack, file naming conventions, "Do Not Do" guardrails. Key rule: "Dr. Brian's voice is the brand voice." | Brand guidelines, voice/tone, guardrails | Must-read before writing any content in Dr. Brian's voice or making brand decisions |
| `MISSIONRESIDENCY_FB_GROUP_SUMMARY.md` | Audit of 14,100-member Facebook group. Currently DORMANT since mid-2025. Seasonal activity pattern tied to NRMP calendar. 7 response templates for common group scenarios. Match Day success stories = highest engagement. | Community analysis, engagement patterns, templates | Reference for social media strategy and community reactivation planning |

---

## 2. Blog Content

### Current State (MissionMed WordPress — missionmedinstitute.com)

As of 2026-03-06, the MissionMed WordPress blog contains **zero educational content**. All 12 existing posts are demo, placeholder, or test content. A full audit was completed and delivered as `MissionMed_Blog_Audit_Report.docx`.

| Asset | Location | Description |
|-------|----------|-------------|
| Blog Audit Report | `02_WEBSITES/missionmedinstitute/audits/MissionMed_Blog_Audit_Report.docx` | Comprehensive Word document with current state analysis, proposed 9-category taxonomy, 40+ SEO tag strategy, 30-article content calendar, competitive gap analysis, and 4-phase implementation roadmap |
| Blog Architecture | `02_WEBSITES/missionmedinstitute/blog/MissionMed_Blog_Architecture_2026.docx` | Structural plan for blog system on WordPress |
| Blog Deployment Plan | `02_WEBSITES/missionmedinstitute/blog/MissionMed_Blog_Deployment_Plan_2026.docx` | Step-by-step deployment guide for blog launch |

### Proposed Blog Taxonomy (from Audit Report)

**Categories:** Match Strategy, Interview Prep, Application Strategy, USMLE & Licensing, Clinical Experience, Red Flags & Recovery, Residency Life, IMG News & Updates, MissionMed Programs

**Content Calendar:** 30 priority articles in 3 tiers mapped to proposed categories and primary keywords. See audit report for full details.

### Content Pipeline Sources

When creating new MissionMed blog articles, draw from these knowledge sources in order:

1. `MISSIONRESIDENCY_KNOWLEDGE_INDEX.md` — Check reuse strategy for each legacy asset
2. `MISSIONRESIDENCY_MATCH_GUIDES.md` — Deepest educational content (pillar article candidates)
3. `MISSIONRESIDENCY_BLOG.md` — Existing articles ready for rewrite/expansion
4. `MISSIONRESIDENCY_FAQS.md` — Objection handling and common questions
5. Content gaps identified in Knowledge Index (SOAP, specialty guides, ERAS, visa deep-dives, etc.)

---

## 3. Tools and Applications

These are **protected application assets** — software products in various stages of development. They are NOT blog content and must not be modified, deleted, or exposed through the WordPress blog system.

### 3.1 RankListIQ

| Field | Value |
|-------|-------|
| **Type** | Web application (SaaS) |
| **Location** | `04_SOFTWARE/RankListIQ/` |
| **Subdirectories** | `backups/`, `docs/`, `engine/`, `frontend/`, `supabase/` |
| **Description** | Web-based tool for building and optimizing residency rank list strategy. Users input their interview results, program preferences, and match priorities to generate an optimized rank order. Features a "Strategy Saved" confirmation state. |
| **Tech Stack** | Frontend + backend engine + Supabase database |
| **Status** | In active development |
| **Protection Level** | PROTECTED — Do not modify through WordPress or blog operations. Do not expose internal architecture in public content. |
| **Knowledge Sources** | `conversations-020.json` and `conversations-021.json` in ChatGPT archive contain extensive RankListIQ development history |

### 3.2 Dr J Notes Engine

| Field | Value |
|-------|-------|
| **Type** | Educational content engine |
| **Location** | `03_PROGRAMS/USMLE/DrJ-Notes/` |
| **Description** | USMLE study notes system created by Dr. J. Part of the USMLE prep division. WordPress post 4188 ("Dr J Notes Mock Up Test") is a development prototype for this engine. |
| **Status** | In development |
| **Protection Level** | PROTECTED — WordPress post 4188 is flagged as protected infrastructure. Do not trash, edit, or republish. Do not modify the Dr J Notes Engine through blog operations. |

### 3.3 Dr J Question Bank

| Field | Value |
|-------|-------|
| **Type** | Practice question database |
| **Location** | `03_PROGRAMS/USMLE/DrJ-QuestionBank/` |
| **Description** | USMLE practice question bank for Step 1 and Step 2 CK preparation. Part of the USMLE prep division under Dr. J's leadership. |
| **Status** | In development |
| **Protection Level** | PROTECTED — Do not modify through WordPress or blog operations. |

### 3.4 Oracle (Match Prediction Engine)

| Field | Value |
|-------|-------|
| **Type** | Predictive analytics tool |
| **Location** | `04_SOFTWARE/Oracle/` |
| **Subdirectories** | `docs/`, `frontend/`, `prediction-engine/`, `supabase/` |
| **Description** | Match prediction engine that estimates an IMG's probability of matching based on their application profile. Separate frontend, prediction engine, and Supabase stack. |
| **Status** | In development |
| **Protection Level** | PROTECTED — Do not modify through WordPress or blog operations. |

### 3.5 MissionMed WordPress MCP Connector

| Field | Value |
|-------|-------|
| **Type** | Integration tool |
| **Location** | `08_AI_SYSTEM/missionmed-wp-mcp/` |
| **Description** | Custom MCP (Model Context Protocol) server for managing the MissionMed WordPress blog. Provides tools for listing, creating, updating, and publishing blog posts. Blog-only scope — cannot modify Elementor pages, themes, or other WordPress systems. |
| **Status** | Active |
| **Protection Level** | Operational tool — use for blog management only |

---

## 4. Strategy Documentation

### Brand & Identity

| File | Location | Description |
|------|----------|-------------|
| `MISSIONMED_SYSTEM_CONTEXT.md` | `06_AI_CONTEXT/` | Master context document for MissionMed Institute. Defines all divisions (Mission Residency, USMLE Drills, Mission USCE, RankListIQ, Oracle, Membership), core offers with pricing, audience segments, team members (Dr. Brian, Dr. J, Phil), enrollment platforms, and competitive positioning. |
| `MISSIONRESIDENCY_SYSTEM_CONTEXT.md` | `06_AI_CONTEXT/` | Brand identity for the Mission Residency flagship program. Program tiers, tone rules, tech stack, naming conventions. Key rule: "Dr. Brian's voice is the brand voice." |
| `MissionMed_Positioning_Extraction_2026.docx` | `01_BRAND/marketing-assets/` | Strategic positioning extraction: 5 overlapping deficits before MissionMed, transformation narrative (identity fracture → narrative ownership), competitive differentiation framework. |

### Knowledge Philosophy

| File | Location | Description |
|------|----------|-------------|
| `MISSIONMED_KNOWLEDGE_PHILOSOPHY_CORE_MASTER.md` | `06_AI_CONTEXT/KNOWLEDGE_PHILOSOPHY_CORE/` | Persistent strategic knowledge base extracted from founder transcripts, student testimonials, marketing materials, and class recordings. Contains: 10 most common student problems, 5-layer value proposition, Dr. Brian's teaching philosophy, competitive differentiation framework, student transformation narratives. Primary reference for all content that touches MissionMed's core identity. |

### Decisions Log

| File | Location | Description |
|------|----------|-------------|
| `DECISIONS_INDEX.md` | `08_AI_SYSTEM/MissionMed_AI_Brain/decisions_log/` | Index of all recorded architectural, product, and strategic decisions. Format: DATE — DECISION — DOMAIN — FILE. This is the highest-authority source in the AI Brain — overrides all other sources when conflicts exist. |

### Strategic Reviews

| File | Location | Description |
|------|----------|-------------|
| `MissionMed_Final_Website_Architecture.docx` | `08_AI_SYSTEM/STRATEGIC_REVIEWS/` | 17-page website site map and architecture plan. Covers 3-phase build plan, 9-section program page template, navigation structure, and page hierarchy for missionmedinstitute.com. Essential reference for any website structural changes. |
| `MissionMed_Revenue_Intelligence_Strategic_Review.docx` | `08_AI_SYSTEM/STRATEGIC_REVIEWS/` | Revenue analysis and strategic review across all MissionMed divisions. Financial modeling, pricing strategy, and growth projections. |
| `MissionMed_Website_Blueprint_Reconciliation.docx` | `08_AI_SYSTEM/STRATEGIC_REVIEWS/` | Reconciliation between planned website architecture and current implementation. Gap analysis and remediation priorities. |
| `MissionMed_AI_System_Strategic_Audit.docx` | `08_AI_SYSTEM/` | Strategic audit of the AI system architecture and capabilities. |

### Blog Strategy

| File | Location | Description |
|------|----------|-------------|
| `MissionMed_Blog_Audit_Report.docx` | `02_WEBSITES/missionmedinstitute/audits/` | Full blog audit with proposed taxonomy, SEO tag strategy, 30-article content calendar, competitive analysis (6 competitors identified), and 4-phase implementation roadmap |
| `MissionMed_Blog_Architecture_2026.docx` | `02_WEBSITES/missionmedinstitute/blog/` | Blog system structure and category architecture |
| `MissionMed_Blog_Deployment_Plan_2026.docx` | `02_WEBSITES/missionmedinstitute/blog/` | Step-by-step blog launch deployment guide |
| `MissionMed_SEO_Authority_Map_2026.docx` | `02_WEBSITES/missionmedinstitute/seo/` | SEO authority mapping and keyword strategy for missionmedinstitute.com |
| `missionmed-wp-connector-architecture.md` | `02_WEBSITES/wordpress-snippets/` | Technical architecture documentation for the WordPress MCP connector |

### Homepage Strategy

| File | Location | Description |
|------|----------|-------------|
| `MissionMed_Homepage_Blueprint_2026.docx` | `02_WEBSITES/missionmedinstitute/homepage/` | Homepage structural blueprint and section architecture |
| `MissionMed_Homepage_Copy_Final_2026.docx` | `02_WEBSITES/missionmedinstitute/homepage/` | Final approved homepage copy package |
| `MissionMed_Homepage_Copy_Revised_Final_2026.docx` | `02_WEBSITES/missionmedinstitute/homepage/` | Revised final homepage copy after red team review |
| `MissionMed_Homepage_Implementation_Plan_2026.docx` | `02_WEBSITES/missionmedinstitute/homepage/` | Implementation plan for homepage build |
| `MissionMed_Homepage_Audit_2026.docx` | `02_WEBSITES/missionmedinstitute/audits/` | Homepage-specific audit report |
| `MissionMed_Homepage_UX_CRO_Audit_Report.md` | `02_WEBSITES/missionmedinstitute/audits/` | UX and conversion rate optimization audit of homepage |
| `MissionMed_Website_Conversion_Strategy_2026.docx` | `02_WEBSITES/missionmedinstitute/strategy/` | Full-funnel conversion strategy for the website |

### Landing Pages

| File | Location | Description |
|------|----------|-------------|
| `MissionMed_Didnt_Match_Landing_Page_Structure_2026-03-08.md` | `02_WEBSITES/landing-pages/` | Structure and copy plan for "Didn't Match" targeted landing page |
| `didnt-match.html` / `didnt-match.css` | `02_WEBSITES/missionmedinstitute/` | Built HTML/CSS for the Didn't Match landing page |
| `strategy-session.html` / `.css` / `.js` | `02_WEBSITES/missionmedinstitute/` | Built strategy session booking page |

### Enrollment & Gated Access (MR-210)

| File | Location | Description |
|------|----------|-------------|
| `MR-210_Waitlist_Gate_Secret_Enrollment_System.docx` | Root folder | Full 7-phase system blueprint: UX design (5 banner variants), gate logic, funnel map, checkout optimization, payment UX, red team analysis (23 issues), implementation guide |
| `mr210-waitlist-gate.html` | `02_WEBSITES/missionmedinstitute/mission-residency/` | Elementor HTML widget: access code gate (code: mission1) with cookie + localStorage persistence, URL bypass (?access=mission1), GA4 tracking, waitlist email capture, noscript fallback |
| `mr210-comparison-page.html` | `02_WEBSITES/missionmedinstitute/mission-residency/` | Course comparison page: 3-tier layout (Emergency Prep / IV Prep Complete / 360 Match Mentorship), 360 Elite highlighted, Zelle discount, Calendly CTA, access verification redirect |

### Testimonials & Social Proof

| File | Location | Description |
|------|----------|-------------|
| `MISSIONMED_TESTIMONIAL_DATABASE.md` | `08_AI_SYSTEM/MissionMed_AI_Brain/` | Complete testimonial database: 15 verbatim reviews extracted from Facebook Group, 20 video testimonials catalogued from /reviews page, categorized by theme (IMG success, red flag recovery, coaching quality, mentorship, referral, value), website-ready quote library (4 tiers), and curated unmatched-student messaging section. |
| `MISSIONRESIDENCY_FB_GROUP_SUMMARY.md` | `06_AI_CONTEXT/` | Full audit of the Mission Residency Facebook Group (14.1K members). Activity patterns, post type taxonomy, engagement data, content performance rankings, and response templates. |
| `TESTIMONIAL_LIBRARY.md` | `04_PROOF/TESTIMONIALS/` | Processed testimonial library ready for website use |
| `TESTIMONIAL_MASTER.csv` | `04_PROOF/TESTIMONIALS/` | Master CSV of all testimonials with metadata |
| `MISSIONRESIDENCY_FACEBOOK_TESTIMONIAL_LIBRARY.md` | `04_PROOF/TESTIMONIALS/` | Facebook-sourced testimonial library |
| `MISSIONRESIDENCY_FACEBOOK_TESTIMONIAL_ARCHIVE_MASTER.csv` | `04_PROOF/TESTIMONIALS/` | Complete Facebook testimonial archive (master CSV) |
| `MISSIONRESIDENCY_TESTIMONIAL_ALUMNI_MASTER.csv` | `04_PROOF/TESTIMONIALS/` | Alumni testimonials master dataset |
| Batch files (02–05) | `04_PROOF/TESTIMONIALS/` | Incremental testimonial extraction batches |
| `RED_FLAG_MATCH_CASES.md` | `04_PROOF/TESTIMONIALS/` | Structured database of 35 red flag match cases with classification codes, severity tiers, scores, and testimonial excerpts. Includes 13 verified match outcomes from Dr. Brian's reference image with exact Step scores. (MR-048) |
| `RED_FLAG_MATCH_STORIES_SECTION.html` | `04_PROOF/TESTIMONIALS/` | Website-ready HTML section "Real Match Stories: Overcoming Red Flags" with filterable case cards, score table, and CTA. Ready for Elementor deployment. (MR-048) |

### Red Flag Match Intelligence

| File | Location | Description |
|------|----------|-------------|
| `RED_FLAG_MATCH_FRAMEWORK.md` | `08_AI_SYSTEM/MissionMed_AI_Brain/` | Canonical AI knowledge file: red flag taxonomy (10 categories, 4 severity tiers), verified match outcomes by category, conversion intelligence routing (prospect red flag → proof point), objection-handling scripts, service recommendation matrix, and AI system usage rules. Load for any task involving testimonial routing, objection handling, or prospect profiling. (MR-048) |

### Alumni Outcomes & Research

| File | Location | Description |
|------|----------|-------------|
| `ALUMNI_OUTCOMES_REPORT.md` | `04_PROOF/ALUMNI_OUTCOMES/` | Compiled alumni outcomes report |
| `ALUMNI_OUTCOMES_TABLE.xlsx` | `04_PROOF/ALUMNI_OUTCOMES/` | Alumni outcomes data in spreadsheet format |
| `MISSIONMED_ALUMNI_OUTCOMES_REPORT.md` | `04_PROOF/ALUMNI_OUTCOMES/` | MissionMed-branded alumni outcomes report |
| `MISSIONMED_ALUMNI_OUTCOMES_TABLE.xlsx` | `04_PROOF/ALUMNI_OUTCOMES/` | MissionMed-branded alumni outcomes spreadsheet |
| `ALUMNI_RESEARCH_FIRST25.md` | `04_PROOF/ALUMNI_OUTCOMES/` | First 25 alumni research findings |
| `MISSIONRESIDENCY_ALUMNI_RESEARCH_LOG.md` | `04_PROOF/ALUMNI_OUTCOMES/` | Research log tracking alumni outcome verification |

---

## 5. Operational Protocols

### Master Prompt Protocol (MR-034)

| File | Location | Description |
|------|----------|-------------|
| `MR-034_MissionMed_Master_Prompt_Protocol_2026-03-14.docx` | `08_AI_SYSTEM/` | **The permanent operational constitution for all MissionMed AI work.** 8 phases: (1) Self-audit of 12 documented failure modes, (2) 10 non-negotiable rules, (3) Master Prompt Header (copy-paste block), (4) Master Prompt Body Template, (5) 8 task-type mini-checklists, (6) Website consistency enforcement system, (7) "Before you start any task" 8-step initialization sequence, (8) Usage recommendation for Dr. Brian. |

### System Intelligence Audit

| File | Location | Description |
|------|----------|-------------|
| `MissionMed_System_Intelligence_Audit_2026-03-14.docx` | `08_AI_SYSTEM/` | Deep knowledge architecture reconstruction. 7 phases: full system mapping, knowledge graph, website intelligence requirements, mandatory prompt protocol, standard prompt template, website consistency safeguards, and final output summary. |

### AI Protocol Files

| File | Location | Description |
|------|----------|-------------|
| `MISSIONMED_PROTOCOL_COPYBLOCK.txt` | Root folder | Reusable prompt protocol initialization block: anti-yes-man rule, red team requirement, collaborative intelligence model, knowledge utilization requirement, quality standards, default analysis process. Paste at the top of ChatGPT sessions. |
| `MISSIONMED_AI_PROTOCOL_MASTER_TEMPLATE.docx` | Root folder | Word document version of the AI protocol template for reference and sharing. |

### Session Initialization

| File | Location | Description |
|------|----------|-------------|
| `PRIMER_CORE.md` | `_SYSTEM/` | Session initialization file (canonical). Control layer for routing, enforcement, risk classification, learning capture, and anti-drift. Authority MR-1367. Read this first in every session. |

---

## 6. AI Brain Core Knowledge (Phase 2 — Sent Email Intelligence)

**Location:** `08_AI_SYSTEM/MissionMed_AI_Brain/`
**Source:** Sent.mbox (7,180 emails, 7,022 MissionMed-relevant)
**Version:** 1.0 | **Created:** 2026-03-08

Comprehensive analysis of Dr. Brian's outbound email history. Extracts student psychology, match strategy frameworks, sales/conversion patterns, and authentic voice patterns. Complements Phase 1 inbound conversion intelligence.

| If you need... | Go to... |
|----------------|----------|
| Student pain points & psychological barriers | `missionmed_student_psychology.md` |
| Match strategy & 10 advising domain frameworks | `missionmed_match_strategy.md` |
| Sales language, pricing, objection handling | `missionmed_sales_patterns.md` |
| Dr. Brian's voice, phrases, tone patterns | `missionmed_dr_brian_voice.md` |
| Red flag classification & recovery frameworks | `missionmed_common_red_flags.md` |
| Codified advising methodologies (10 frameworks) | `missionmed_advising_frameworks.md` |
| Phase 2 summary report (Word document) | `MissionMed_Sent_Email_Intelligence_Report.docx` |
| AI Brain architecture documentation | `MissionMed_AI_Brain_Architecture_2026.docx` |
| Phase 2 integration report | `MissionMed_Phase2_Integration_Report.docx` |
| Testimonial database (4-tier quote library) | `MISSIONMED_TESTIMONIAL_DATABASE.md` |

---

## 7. Conversion Intelligence (Phase 1 — Admissions Email Analysis)

**Location:** `08_AI_SYSTEM/PHASE1_CONVERSION_INTELLIGENCE/`
**Source:** 301 admissions email threads, 71 confirmed conversions
**Purpose:** Empirical conversion data extracted from real student enrollment threads

### Core Intelligence Files

| File | Description | Recommended Use |
|------|-------------|-----------------|
| `MISSIONMED_CONVERSION_PLAYBOOK.md` | 301 threads analyzed, 71 conversions documented, emotional arc model, conversion triggers, timing patterns | Primary reference for understanding how students convert. Load before writing any sales/enrollment content. |
| `MISSIONMED_STUDENT_ARCHETYPE_MODEL.md` | 8 behavioral archetypes with conversion rates: Fast Decisive (100%), Late-Cycle Panic (33.3%), Price-Sensitive (5.7%), etc. | Load before writing student-facing content. Identify target archetype and speak to their specific pain points. |
| `MISSIONMED_PERSUASION_LANGUAGE_LIBRARY.md` | 105 proven persuasion sentences extracted from successful conversion threads | Source for all CTA copy, enrollment messaging, and sales page language. Never use generic CRO language. |
| `MISSIONMED_STUDENT_INTENT_MODEL.md` | Intent classification system with scoring (7 categories, 0–100 scale) | Use to classify incoming leads and match response strategy to intent level. |
| `MISSIONMED_ADMISSIONS_INTELLIGENCE_REPORT.md` | Executive summary of the entire Phase 1 analysis | Quick overview of conversion intelligence findings |
| `MISSIONMED_EMAIL_CONVERSION_INSIGHTS.md` | Detailed conversion pattern insights | Deep dive into what triggers enrollment decisions |
| `MISSIONMED_TOP_CONVERSION_EMAILS.md` | Top-performing emails that drove conversions | Templates and patterns for high-converting email responses |
| `MISSIONMED_FASTEST_CONVERSION_EMAILS.md` | Emails that converted fastest (shortest thread-to-enrollment time) | Reference for urgency messaging and fast-track conversion patterns |
| `MISSIONMED_DECISION_LATENCY_ANALYSIS.md` | Analysis of time between first contact and enrollment decision | Understand decision timelines by archetype for follow-up strategy |
| `MISSIONMED_STALLED_THREAD_ANALYSIS.md` | Analysis of threads that stalled or failed to convert | Identify drop-off patterns and re-engagement opportunities |
| `MISSIONMED_RESPONSE_TIME_ANALYSIS.md` | Impact of response time on conversion outcomes | Optimal response timing windows |
| `MISSIONMED_RESPONSE_TIMING_OPTIMIZATION.md` | Actionable response timing recommendations | Staff scheduling and response SLA targets |
| `MISSIONMED_CONVERSION_VALIDATION_REPORT.md` | Validation of conversion classification accuracy | Data quality verification for the conversion model |

### Conversion Scoring & Prediction

**Location:** `08_AI_SYSTEM/`

| File | Description | Recommended Use |
|------|-------------|-----------------|
| `MISSIONMED_CONVERSION_SIGNAL_MODEL.md` | 33 weighted signals across 6 categories (commitment, intent, objection, behavioral, timing, strategy). Replaces V1 heuristic readiness scoring. | Signal weights and lift values for lead scoring |
| `MISSIONMED_LEAD_SCORING_ENGINE.md` | 9-step scoring algorithm for conversion probability calculation | Technical reference for the scoring pipeline |
| `MISSIONMED_CONVERSION_MODEL_VALIDATION.md` | Model accuracy metrics: 100% retrospective accuracy on confirmed threads, 2.3x discrimination on Possible threads | Model performance verification |

---

## 8. Operational Systems (AI-Powered Tools)

### Email Response Engine

**Location:** `08_AI_SYSTEM/AI_EMAIL_ENGINE/`
**Spec Document:** `08_AI_SYSTEM/MISSIONMED_EMAIL_RESPONSE_ENGINE.md`
**Version:** 1.0 | **Status:** Operational (Draft-Only Mode)

AI-assisted admissions email response system. Pipeline: detect → classify (7 intent categories) → score readiness (0–100) → select conversion strategy (6 archetypes) → generate Michelle-voice draft → create Gmail draft. Never auto-sends. Uses Phase 1 intelligence (301 threads, 71 conversions) for strategy recommendations.

| If you need... | Go to... |
|----------------|----------|
| Engine overview and pipeline | `MISSIONMED_EMAIL_RESPONSE_ENGINE.md` § 1 |
| Intent classification keywords | `MISSIONMED_EMAIL_RESPONSE_ENGINE.md` § 2 |
| Readiness scoring model | `MISSIONMED_EMAIL_RESPONSE_ENGINE.md` § 3 |
| Strategy-to-intent mapping | `MISSIONMED_EMAIL_RESPONSE_ENGINE.md` § 4 |
| Michelle's voice rules | `MISSIONMED_EMAIL_RESPONSE_ENGINE.md` § 5 |
| Response timing targets | `MISSIONMED_EMAIL_RESPONSE_ENGINE.md` § 6 |
| Follow-up protocol | `MISSIONMED_EMAIL_RESPONSE_ENGINE.md` § 7 |
| Email UI (inbox interface) | `AI_EMAIL_ENGINE/email_inbox.html` |
| Email engine logic | `AI_EMAIL_ENGINE/email_engine.js` |
| Email intelligence module | `AI_EMAIL_ENGINE/email_intelligence_module.js` |
| Email styles | `AI_EMAIL_ENGINE/email_styles.css` |
| Supabase write integration | `AI_EMAIL_ENGINE/supabase_writer.js` |

### Lead Intelligence System

**Location:** `08_AI_SYSTEM/MISSIONMED_LEAD_INTELLIGENCE_SYSTEM.md`
**Data File:** `05_DATA/MISSIONMED_LEAD_PIPELINE.csv` (20 columns)
**Version:** 1.1 | **Status:** Operational

Division-aware CRM tracking students from first contact through enrollment. 6 pipeline stages, 6 student journey stages, 6 service need categories, probability scoring (0–100), automatic routing to division owners (Dr J / Phil / Brian / Michelle). Integrated with Email Response Engine.

| If you need... | Go to... |
|----------------|----------|
| System overview and divisions | `MISSIONMED_LEAD_INTELLIGENCE_SYSTEM.md` § 1 |
| Pipeline stage definitions | `MISSIONMED_LEAD_INTELLIGENCE_SYSTEM.md` § 2 |
| Student stages and service needs | `MISSIONMED_LEAD_INTELLIGENCE_SYSTEM.md` § 3 |
| Lead scoring signals and weights | `MISSIONMED_LEAD_INTELLIGENCE_SYSTEM.md` § 4 |
| Division routing rules | `MISSIONMED_LEAD_INTELLIGENCE_SYSTEM.md` § 5 |
| Lead detection integration flow | `MISSIONMED_LEAD_INTELLIGENCE_SYSTEM.md` § 6 |
| Follow-up automation triggers | `MISSIONMED_LEAD_INTELLIGENCE_SYSTEM.md` § 10 |
| Active lead data | `05_DATA/MISSIONMED_LEAD_PIPELINE.csv` |
| Lead pipeline UI | `LEAD_PIPELINE_UI/pipeline.html` |
| Pipeline logic | `LEAD_PIPELINE_UI/pipeline.js` |
| Pipeline styles | `LEAD_PIPELINE_UI/pipeline_styles.css` |

### Advising Dashboard

**Location:** `08_AI_SYSTEM/AI_DASHBOARD/`
**Version:** 2.0 | **Status:** Operational

| If you need... | Go to... |
|----------------|----------|
| Dashboard main page | `AI_DASHBOARD/index.html` |
| Dashboard logic | `AI_DASHBOARD/dashboard.js` |
| Dashboard styles | `AI_DASHBOARD/dashboard.css` |
| Dashboard data | `AI_DASHBOARD/dashboard_data.json` |
| Intelligence panels (student psychology, red flags, advising, match strategy, sales) | `AI_DASHBOARD/advising_panels.js` |
| Lead data bridge | `AI_DASHBOARD/lead_data_bridge.js` |
| Opportunity radar | `AI_DASHBOARD/opportunity_radar.js` |
| Supabase reader | `AI_DASHBOARD/supabase_reader.js` |
| Dashboard data updater | `AI_DASHBOARD/update_dashboard_data.js` |

### System State Engine

**Location:** `08_AI_SYSTEM/AI_BRAIN/`

| File | Description |
|------|-------------|
| `system_state.json` | Central data store for system state |
| `system_state_engine.js` | State management engine |

---

## 9. Data Assets

### Student Database

| File | Location | Description |
|------|----------|-------------|
| `MISSIONMED_MASTER_STUDENT_DATABASE.csv` | `05_DATA/` | Master student database (also exists in `05_DATA/exports/`) |
| `BATCH_01.csv` through `BATCH_12.csv` | `05_DATA/exports/` | Incremental student data extraction batches |
| `MISSIONMED_ALUMNI_SEED_DATASET.md` | `05_DATA/exports/` | Initial alumni research dataset |
| `MISSIONMED_ALUMNI_DATASET_2014_2016.md` | `05_DATA/exports/` | Historical alumni data (2014–2016 cohorts) |

### Email Data

| File | Location | Description |
|------|----------|-------------|
| `Sent.mbox` | `05_DATA/email_exports/` | Raw email export (7,180 emails) — source for Phase 2 intelligence extraction |
| `MISSIONMED_EMAIL_THREAD_INDEX.csv` | `08_AI_SYSTEM/PHASE1_CONVERSION_INTELLIGENCE/output/` | Thread-level index of all analyzed admissions emails |

### Lead Pipeline

| File | Location | Description |
|------|----------|-------------|
| `MISSIONMED_LEAD_PIPELINE.csv` | `05_DATA/` | Active lead tracking data (20 columns including conversion_probability, confidence_level, signals_detected, last_activity_timestamp) |

---

## 10. MR-Series Task Reports

Completion reports from the MR (Mission Review) task series. These document every website edit, audit, and system change with before/after states, verification results, and implementation details.

**Location:** `06_AI_CONTEXT/` (recent reports) and root folder (early reports)

### Reports in 06_AI_CONTEXT (March 13–14, 2026)

| Report | Description |
|--------|-------------|
| `MR-021B_FAQ_Verification_Analysis_2026-03-13.md` | FAQ content verification and accuracy analysis |
| `MR-022_Funnel_Audit_Legacy_Analysis_Phase_Plan_2026-03-13.md` | Conversion funnel audit with legacy site analysis and phase plan |
| `MR-023_Funnel_Emergency_Repair_PhaseA_2026-03-13.md` | Emergency funnel repair: fixed broken Calendly embed, CTA links, consultation paths |
| `MR-024_Optimized_FAQ_Implementation_2026-03-13.md` | FAQ page optimization and implementation |
| `MR-026_Homepage_Copy_Audit_RedTeam_Rewrite_2026-03-13.md` | Homepage copy audit with red team review and rewrite recommendations |
| `MR-027_Consultation_Booking_CopyCompliance_2026-03-13.md` | Consultation booking page copy compliance review |
| `MR-031_Homepage_API_Production_Workflow_2026-03-13.md` | Homepage production workflow via WordPress REST API |
| `MR-032_Homepage_Copy_Fix_Implementation_2026-03-13.md` | Homepage copy fix implementation and deployment |
| `MR-033_Homepage_Render_Verification_2026-03-13.md` | Homepage render verification (post-deploy content checks) |
| `MR-034_Funnel_Conversion_Audit_2026-03-13.docx` | Full funnel conversion audit with prioritized recommendations |
| `MR-035A_Calendly_Routing_Match_Strategy_Session_2026-03-13.docx` | Calendly routing form setup + Match Strategy Session event creation + Webex integration |
| `MR-036_Repair_CTA_Links_2026-03-13.docx` | Repair of broken consultation CTA links across the site |
| `MR-040_Red_Team_Audit_Mission_Residency_2026-03-13.docx` | Red Team audit of Mission Residency page: funnel, conversion friction, trust signals, messaging, UX, competitor benchmark, prioritized fix list |
| `MR-041_High_Priority_Conversion_Fixes_2026-03-13.docx` | Implementation of 5 HIGH-priority fixes: pricing placeholder, Dr. Brian authority section, Calendly embed, CTA standardization, consultation section consolidation |
| `MR-066_Mission_Residency_Enrollment_Funnel_Repair_2026-03-15.docx` | Complete enrollment pathway design for Mission Residency homepage: programs section (3 cards), CTA architecture (hero/mid/final), navigation restructure, WooCommerce integration, Elementor implementation guide |
| `MR-068_Payment_Gateway_Recovery_Report_2026-03-15.docx` | Payment gateway recovery investigation: Maverick Payments account CLOSED (DBA #237454), old DreamHost site (enroll.missionresidency.com) returns 403, WooPayments/Stripe identified as replacement gateway, full plugin audit, implementation roadmap |
| `MR-069_Payment_Architecture_Strategy_Review_2026-03-15.docx` | Multi-instructor payment architecture: 5-way comparison (Dokan vs WC Vendors vs Product Vendors vs Split Pay vs Multi-Gateway). DECISION: Split Pay + Stripe Connect recommended. Preserves existing stack, 2/10 difficulty, $99/yr. Dokan/marketplace plugins rejected as overkill for curated 5–20 instructor model |
| `MR-070_Payment_Architecture_Finalization_Red_Team_2026-03-15.docx` | Red team review of finalized architecture: Stripe Connect Standard Accounts + Direct Charges confirmed. Corrects MR-069 charge type from destination to direct. 9 risks identified (4 HIGH, 3 MEDIUM, 2 LOW), all mitigated. Critical: mixed-cart restriction required, statement descriptor configuration, refund SLA process. Implementation: 3/10 difficulty, 2-4 hours setup |
| `MR-071_Instructor_Panel_Command_Dashboard_Architecture_2026-03-15.docx` | Instructor Panel architecture for multi-instructor model: standalone HTML/JS panel + custom WordPress REST plugin (/mmi/v1/) + LearnDash Group Leader roles + Stripe deep-link-only payment visibility. Mixed-cart restriction PHP implementation included (~25 lines). 8 red-team findings (3 HIGH, 3 MEDIUM, 2 LOW), all mitigated. Implementation: 4/10 difficulty, 3-5 days build time |
| `MR-072_Role_Permission_Security_Architecture_2026-03-15.docx` | Platform security architecture: custom mmi_instructor role (NOT default Group Leader) with explicit capability whitelist, 4-layer defense-in-depth (WP role + LearnDash group + API scoping + frontend), JWT auth with httpOnly cookies, REST API hardening (user enumeration block, LearnDash API blocking), WooCommerce complete data isolation, mixed-cart MU-plugin. 12 red-team findings (2 CRITICAL, 4 HIGH, 4 MEDIUM, 2 LOW), all mitigated. Includes onboarding/offboarding checklists and quarterly security audit checklist. Implementation: 3/10 difficulty, ~3 days |
| `MR-073_Stripe_Connect_Onboarding_Account_Linking_2026-03-15.docx` | Stripe Connect onboarding & instructor account linking: Standard Accounts via Account Links API (not OAuth), 6-state onboarding state machine, direct charges with per-instructor application fees (3-tier resolution: product → instructor → platform default, founders = 0%), webhook pipeline (8 event handlers, idempotent processing via event_id UNIQUE constraint), refund coordination (instructor-controlled, 3 scenarios), failure state management (6 failure types with recovery flows). 10 red-team findings (1 CRITICAL, 4 HIGH, 3 MEDIUM, 2 LOW), all mitigated. Implementation: 4/10 difficulty, ~3 days |
| `MR-074_Mixed_Cart_Enforcement_Checkout_Guardrails_2026-03-15.docx` | Mixed-cart enforcement for Stripe Connect direct charges: hybrid MU-plugin with 4 WooCommerce hooks (add_to_cart_validation primary gate, check_cart_items safety net, is_purchasable ownership gate, cart_loaded_from_session restore guard). Product ownership via _mmi_instructor_id meta field with fail-closed default. 11 edge cases handled (variable products, bundles, subscriptions, memberships, admin orders, AJAX/Buy Now, cart restoration, abandoned cart recovery, mobile). Admin bypass for manual orders. Complete ~120-line PHP implementation included. 8 red-team findings (3 HIGH, 3 MEDIUM, 2 LOW), all mitigated or accepted. Implementation: 2/10 difficulty, 6-9 hours |
| `MR-075_Stripe_Webhook_Infrastructure_2026-03-15.docx` | Stripe webhook infrastructure for Connect direct charges: single endpoint (/wp-json/mmi/v1/stripe/webhook), HMAC-SHA256 signature verification via Stripe PHP SDK, 12 event subscriptions (4 CRITICAL, 6 HIGH, 2 MEDIUM) covering payment lifecycle + refunds + disputes + subscriptions + instructor onboarding. Idempotent processing via event_id UNIQUE constraint in wp_mmi_stripe_events table (11-column schema). Event handlers for student enrollment, access revocation, dispute management, subscription lifecycle, instructor deauthorization. Daily reconciliation WP-Cron. 90-day retention policy. Signing secret in wp-config.php. HTTP 200 on handler failure (prevents Stripe endpoint disabling). 10 red-team findings (1 CRITICAL, 4 HIGH, 3 MEDIUM, 2 LOW), all mitigated. Implementation: 3/10 difficulty, 3-4 working days |
| `MR-076_Instructor_Panel_Implementation_Plan_2026-03-15.docx` | Build-ready Instructor Panel implementation: 7-module SPA (My Students, My Courses, Enrollment Actions, Stripe Connection, Export Tools, Notifications, Support) with 10 custom REST endpoints (/me, /students, /courses, /enroll, /unenroll, /stripe-status, /stripe-link, /export/students, /notifications, /notifications/dismiss). Revenue Summary module rejected (Stripe dashboard is authoritative). Enrollment upgraded from request+approval to direct self-service with server-side group validation. Stripe Login Link API for safe dashboard access (no raw account IDs exposed). CSV export with formula injection sanitization. 10 panel states designed (Stripe disconnected/pending/restricted/active/deauthorized, empty data, suspended, API error). Enrollment audit log. 12 red-team findings (2 CRITICAL, 4 HIGH, 4 MEDIUM, 2 LOW). Vanilla HTML/CSS/JS matching existing Command Dashboard. Implementation: 3/10 difficulty, 4-5 working days |
| `MR-077_Instructor_API_Implementation_2026-03-15.docx` | Production-ready WordPress plugin (mmi-instructor-api): 15 PHP files implementing 10 REST endpoints under /mmi/v1/ namespace. Four-layer defense-in-depth (MR-072): role validation, LearnDash group scoping, API query filtering, frontend boundaries. IDOR protection on enrollment endpoints via group membership validation. Transient-based rate limiting (20 enrollments/hour, 10 exports/hour). CSV injection sanitization (OWASP CWE-1236). Enrollment audit logging to custom wp_mmi_enrollment_log table. Stripe Login Link generation without exposing account IDs. Notification system with ownership-verified dismissal. 2 custom database tables created via dbDelta(). Graceful LearnDash dependency handling. 14 red-team findings (2 CRITICAL, 4 HIGH, 4 MEDIUM, 4 LOW), all mitigated or accepted. Plugin code delivered alongside report. Implementation: 3/10 difficulty, standard plugin activation |
| `MR-078_Instructor_Panel_Frontend_Implementation_2026-03-15.docx` | Production-ready Instructor Panel frontend: 12-file vanilla HTML/CSS/JS SPA (2,498 lines) matching Command Dashboard dark theme. 7 modules: My Students (paginated/searchable roster), My Courses (enrollment counts/pricing), Enrollment Actions (enroll/unenroll with confirmation modal), Stripe Connection (5 status states + Login Link dashboard access), Export Tools (server-side CSV download with course filter), Notifications (list/dismiss with unread badge), Support (static cards with refund guidance/FAQ). All 10 MR-077 REST endpoints consumed. 10 panel states handled (Stripe 5 states, no students, no courses, suspended overlay, API unavailable, unauthenticated redirect). Global XSS defense via esc() HTML escaping. Double-submit prevention. Toast notification system. WordPress nonce integration. 12 red-team findings (2 CRITICAL, 4 HIGH, 4 MEDIUM, 2 LOW), all mitigated or accepted. Implementation: 2/10 difficulty, file copy deployment |
| `MR-079_Command_Dashboard_Integration_Deployment_Sequence_2026-03-15.docx` | Complete integration and deployment plan wiring Instructor Panel (MR-078) and API (MR-077) into live WordPress environment. WordPress MU-plugin direct-serve architecture: mmi-instructor-panel-loader.php (168 lines, 4 functions) intercepts /instructor-panel/ at template_redirect, injects wpApiSettings (wp_rest nonce + REST URL + login URL), fixes asset paths, serves with security headers (X-Frame-Options: DENY, X-Content-Type-Options: nosniff, no-cache). wp-admin blocking for mmi_instructor role, login redirect, admin bar hiding. Command Dashboard navigation patch (Instructors link in topnav). File placement map (15 files across 3 WordPress directories). Staging deployment (15 steps) and production deployment (12 steps) sequences. Full rollback plan (full, frontend-only, API-only) with <5 minute recovery. QA/UAT test matrix: 4 test personas (admin, instructor, student, guest), 35 functional test cases across auth, panel functionality, security, and cross-browser. Error handling matrix (10 failure modes with UX and recovery). 16 red-team findings (2 CRITICAL, 4 HIGH, 6 MEDIUM, 4 LOW) focused on integration attack surface, all mitigated. Operational monitoring guidance. Implementation: 1/10 difficulty, zero-downtime deployment |

| `MR-080_Staging_Deployment_Validation_Runbook_2026-03-15.docx` | Operator-executable staging deployment runbook converting MR-079 plan into exact commands. Security fixes applied: RT-3 realpath() path traversal canonicalization (rejects requests resolving outside MMI_PANEL_DIR), RT-4 Content-Security-Policy header (default-src 'self', script-src 'self' 'unsafe-inline', connect-src 'self', frame-ancestors 'none'). MU-plugin updated to 193 lines (from 168). Post-fix security: 0 Critical (down from 2), 2 High (accepted), 6 Medium, 6 Low, 2 Resolved. 20-step deployment runbook across 6 phases (backup, API plugin, frontend, MU-plugin, cache/smoke, verification) with exact SSH/SCP/WP-CLI commands. 48-test validation checklist: 8 auth, 5 role enforcement, 9 enrollment, 5 Stripe, 5 export, 10 security (including path traversal, CSP, IDOR, XSS, nonce replay, rate limit, iframe), 6 responsive/cross-browser. Automated verification script (PASS/FAIL output for plugin, endpoints, file counts, nonce, headers, database). Staging sign-off checklist with system health, log monitoring commands, rollback readiness verification, and dual sign-off form. Full 16-finding red-team re-evaluation table showing before/after severity. Implementation: 1/10 difficulty, 30-45 minute deployment |

| `MR-081_Staging_Deployment_Report_2026-03-15.docx` | Staging deployment execution report for the MissionMed Instructor Panel system. Full pre-deployment validation of all 28 files across 3 deployment targets: API plugin (15 PHP files, 1,434 lines, 10 REST endpoints under /mmi/v1/), frontend SPA (12 files, 2,498 lines, 7 IIFE modules), MU-plugin integration layer (193 lines with RT-3 path traversal + RT-4 CSP fixes). Deployment simulation executed: directory structure creation, file copy, permission setting (644/755), security fix verification. 10 REST endpoint registrations verified against register_rest_route() calls. 5 security headers confirmed (CSP, X-Frame-Options: DENY, X-Content-Type-Options: nosniff, Cache-Control: no-cache, Content-Type). 4 MU-plugin hooks verified (template_redirect @5, admin_init @1, login_redirect @10, init). Database migration schema documented (wp_mmi_enrollment_log, 8 columns, InnoDB). 15 smoke tests: 10/10 pre-deploy PASS, 5 live tests PENDING server execution. Zero deployment anomalies. 5 concerns investigated and cleared. Complete server-side execution commands provided (SCP upload + WP-CLI activation + migration + cache flush + verification). System status: all 7 components READY. |

| `MR-084_Instructor_Panel_Auth_Fix_Report_2026-03-15.docx` | Authentication failure diagnosis and fix for the Instructor Panel. Root cause: Kinsta Nginx serves /instructor-panel/index.html as a static file via try_files, bypassing WordPress entirely — MU-plugin never executes, no wp_rest nonce injected, REST API returns 401 (cookie auth requires nonce). Network trace captured 14 requests proving static serving (all 200 from Nginx, API call 401). Two-part fix: (1) Primary — rename index.html to app.html so Nginx falls through to WordPress, MU-plugin intercepts and injects nonce; (2) Resilience — new /mmi/v1/nonce bootstrap endpoint validates logged_in cookie without existing nonce, returns fresh wp_rest nonce for role-verified users (mmi_instructor or administrator). Frontend api.js updated with ensureNonce() that auto-bootstraps if wpApiSettings not server-injected. WPCode snippet provided as alternative quick-deploy mechanism. v2 deployment packages: mmi-instructor-api-v2.zip (22,497 bytes, 16 PHP files including nonce endpoint), instructor-panel-frontend-v2.zip (28,477 bytes, app.html + updated api.js), mmi-instructor-panel-loader-v2.php (8,369 bytes, app.html reference). 10 verification tests defined. Total code delta: +67 lines nonce endpoint, +36 lines api.js bootstrap, 1 line MU-plugin. |

| `MR-082_Live_Staging_Deployment_Validation_Report_2026-03-15.docx` | Live staging deployment execution report — STATUS: BLOCKED. Comprehensive reconnaissance of missionmedinstitute.com staging environment on Kinsta managed hosting. Three automated deployment approaches attempted and failed: (1) Chrome file_upload tool blocked by sandbox/browser boundary, (2) base64 ZIP injection exceeded JS tool character limits (29,384 chars), (3) chunked base64 assembly truncated to ~2,236 chars per chunk. All 3 deployment packages validated and saved to deployment-packages/ folder: mmi-instructor-api.zip (22,038 bytes, 15 PHP files), instructor-panel-frontend.zip (28,673 bytes, 12 files), mmi-instructor-panel-loader.php (8,069 bytes, 193 lines). Complete manual deployment instructions across 3 components with exact paths: API plugin via WP Plugin Upload UI, MU-plugin via Kinsta SFTP to /public/wp-content/mu-plugins/, frontend SPA via Kinsta SFTP to /public/instructor-panel/. Security verification checklist (RT-3 path traversal, RT-4 CSP, 5 headers). Full MR-080 48-test validation checklist (8 auth, 5 role, 9 enrollment, 5 Stripe, 5 export, 10 security, 6 responsive). Risk assessment (5 risks, all mitigated). Next step: Dr. Brian manual deployment (~15-20 min), then validation to update status to APPROVED or FAILED. |

### Early Reports (Root Folder)

| Report | Description |
|--------|-------------|
| `MR-003_Conversion_Architecture_Blueprint.docx` | Conversion architecture blueprint for the MissionMed funnel |
| `MR-005_Strategic_Intelligence_Extraction.docx` | Strategic intelligence extraction from MissionMed knowledge base |
| `MR-007_Website_Target_Environment_Alignment.docx` | Website-target environment alignment analysis |
| `MR-009_Elementor_Build_Blueprint.docx` | Elementor page builder blueprint for MissionMed site |
| `MR-010_Testimonial_Language_Extraction.docx` | Testimonial language extraction and categorization |
| `MR-011_Final_Messaging_Integration.docx` | Final messaging integration across all site touchpoints |
| `MR-028_WordPress_REST_API_Setup.docx` | WordPress REST API setup and configuration guide |
| `MR-029_REST_API_Test_Results.docx` | REST API endpoint testing results and validation |

### Implementation Reports (02_WEBSITES)

| Report | Location | Description |
|--------|----------|-------------|
| `Prompt-511-Implementation-Report.docx` | `02_WEBSITES/missionmedinstitute/homepage/` | Homepage implementation report |
| `Prompt-519-Implementation-Report.docx` | `02_WEBSITES/missionmedinstitute/homepage/` | Homepage iteration implementation |
| `Prompt-525-Implementation-Report.docx` | `02_WEBSITES/missionmedinstitute/homepage/` | Homepage iteration implementation |
| `Prompt-526-Implementation-Report.docx` | `02_WEBSITES/missionmedinstitute/homepage/` | Homepage iteration implementation |
| `Prompt-527-Implementation-Report.docx` | `02_WEBSITES/missionmedinstitute/homepage/` | Homepage iteration implementation |
| `Prompt-535-Implementation-Report.docx` | `02_WEBSITES/missionmedinstitute/homepage/` | Homepage iteration implementation |
| `Prompt-545-Implementation-Report.docx` | Root folder | Implementation report |
| `NRMP_Chart_Section_Analysis_Report.docx` | `02_WEBSITES/missionmedinstitute/homepage/` | NRMP chart section analysis for homepage |

---

## 11. USMLE / ExamPrep Division Assets

**Location:** Root folder (build packages) and `03_PROGRAMS/`

| File | Location | Description |
|------|----------|-------------|
| `MissionMed_USMLE_Master_Conversion_Plan.docx` | Root | Master conversion plan for USMLE prep division |
| `MissionMed_USMLE_Page_Architecture_Blueprint.docx` | Root | Page architecture blueprint for ExamPrep/USMLE page |
| `MissionMed_USMLE_Homepage_Content_Package.docx` | Root | Content package for USMLE homepage |
| `MissionMed_USMLE_Elementor_Build_Guide.docx` | Root | Elementor build guide for USMLE page |
| `MissionMed_USMLE_Build_Execution_Checklist.docx` | Root | Build execution checklist for USMLE page |
| `MissionMed_USMLE_Final_Build_Package.docx` | Root | Final build package with all components |
| `MissionMed_USMLE_Rapid_Elementor_Construction_Guide.docx` | Root | Rapid construction guide for Elementor |
| `MissionMed_USMLE_WordPress_Site_Audit.docx` | Root | WordPress site audit for USMLE pages |
| `MissionMed_USMLE_Elementor_Components.html` | Root | HTML component library for USMLE page |
| `MissionMed_USMLE_Elementor_Section_Templates.html` | Root | Section template library for Elementor |
| `MissionMed_USMLE_Final_Elementor_Components.html` | Root | Final component library |
| `USMLEPrep-Homepage-Conversion-Blueprint-v2.md` | Root | Conversion blueprint for USMLE prep homepage |
| `RED-TEAM-Review-USMLE-Hero-Redesign.md` | Root | Red team review of USMLE hero section redesign |

---

## 12. USCE Division Assets

| File | Location | Description |
|------|----------|-------------|
| `USCE-Division-Strategy-Placement-Workflow-Architecture.docx` | Root | USCE division strategy and placement workflow architecture |
| `USCE-Refined-Positioning-Messaging-Guide.docx` | Root | Refined positioning and messaging guide for USCE |
| `USCE-Homepage-Implementation-Report-Prompt546.docx` | Root | USCE homepage implementation report |
| `USCE-URL-Correction-Report-Prompt547.docx` | Root | USCE URL correction report |

---

## 13. Admin & Project Management

**Location:** `00_ADMIN/`

| File | Location | Description |
|------|----------|-------------|
| `CHANGELOG.md` | `00_ADMIN/business-docs/` | System-wide changelog tracking all major milestones |
| `MissionMed_Directory_Cleanup_Report_2026-03-08.md` | `00_ADMIN/business-docs/` | Directory cleanup and reorganization report |
| `MissionMed_Project_Audit_2026.docx` | `00_ADMIN/business-docs/` | Project-wide audit report |
| `MissionMed_Prompt_Audit_March8_2026.docx` | `00_ADMIN/` | Prompt audit assessing AI collaboration quality |
| `MissionMed_Strategic_Positioning_Review.docx` | `00_ADMIN/` | Strategic positioning review document |
| `MissionMed_AI_Brain_Audit_Report.docx` | Root folder | AI Brain structure and completeness audit |

---

## Educational Resources

Educational content lives across multiple locations depending on its stage:

### Published Content
- **WordPress Blog:** Currently empty (zero educational posts). Pending first article creation.
- **Legacy Blog Archive:** 9 articles in `MISSIONRESIDENCY_BLOG.md` — ready for migration/adaptation

### Educational Knowledge Base (Legacy)

| Topic | Archive File | Key Assets |
|-------|-------------|------------|
| USCE Types & Comparison | `MISSIONRESIDENCY_MATCH_GUIDES.md` | 7-type comparison table (observership through limited license), cost/value/pay data |
| Letter of Recommendation Strategy | `MISSIONRESIDENCY_MATCH_GUIDES.md` | LOR guide, ChatGPT prompt for LOR writing, sample LOR |
| Personal Statement Strategy | `MISSIONRESIDENCY_MATCH_GUIDES.md` | Red flag disclosure framework, speeding ticket analogy, real-world example |
| Limited Medical License Guide | `MISSIONRESIDENCY_BLOG.md` | 9-state guide with salary ranges, application checklist |
| Couples Match Strategy | `MISSIONRESIDENCY_BLOG.md` | NRMP data, real success stories, myth-busting, geographic clustering tips |
| Interview Performance vs. Scores | `MISSIONRESIDENCY_BLOG.md` | NRMP PD Survey citations, 4 common mistakes analysis |
| Low Step 2 CK Score Guidance | `MISSIONRESIDENCY_MATCH_GUIDES.md` | Compensation strategies, real matching example (210 CK → IM match) |
| Step 3 Timing Strategy | `MISSIONRESIDENCY_BLOG.md` | H-1B requirement analysis, competitive advantage argument |

### Training Session Recordings

**Location:** `03_PROGRAMS/MissionResidency/videos/`

| File | Description |
|------|-------------|
| `IV Prep Complete, Season C Orientation & Match Primer-20230810 0137-1.mp4` | Session C orientation and match primer (source for Knowledge Philosophy Core) |
| `Mission Residency Session D 2021, Match Primer-20211003 0117-2.mp4` | Session D 2021 match primer |
| `Exclusive PASS Bonus Workshop Match-Ready with Dr Brian-20250428 0026-2.mp4` | PASS program bonus workshop (source for Knowledge Philosophy Core) |

### NRMP Data Citations (Reusable Across Content)

| Data Point | Source |
|------------|--------|
| Personal statement ranks #5/40 in PD interview decisions | 2024 NRMP PD Survey |
| 81% of programs consider personal statement | 2024 NRMP PD Survey |
| Interview performance = #1 ranking factor | 2024 NRMP PD Survey |
| 2025 Couples Match: 93.2% at least one partner matched | 2025 NRMP data |
| US-IMGs need 12+ programs ranked for 70–80% probability | 2024 NRMP data |

### Identified Content Gaps (No Existing Material)

1. SOAP/Scramble strategy
2. Specialty-specific guides (IM, FM, Psychiatry, Pediatrics)
3. ERAS application walkthrough
4. IMG timeline/monthly checklist
5. Research for IMGs
6. J-1 vs H-1B visa comparison
7. Program selection methodology
8. Residency life series (beyond Day 1)
9. USMLE study guides (Step 1/2/3)
10. IMG success story series

---

## System Architecture

### AI Brain Query Priority

Per `PRIMER_CORE.md`, always query in this order:

1. **topic_indexes** — Structured indexes (like this file)
2. **decisions_log** — Authoritative decision records
3. **structured_knowledge** — Context files in `06_AI_CONTEXT/`
4. **architecture_maps** — System architecture documents
5. **raw_history** — ChatGPT archive (last resort)

### ChatGPT Archive

**Location:** `06_AI_CONTEXT/chatgpt-history/`
**Manifest:** `08_AI_SYSTEM/MissionMed_AI_Brain/raw_history/ARCHIVE_MANIFEST.md`

2,653 conversations across 27 batch files (~407 MB). High-priority files for future processing:

| Priority | File | Reason |
|----------|------|--------|
| High | `conversations-020.json` (90.9 MB) | RankListIQ development, Supabase architecture |
| High | `conversations-021.json` (47.7 MB) | RankListIQ, Supabase, MissionMed |
| High | `conversations-013.json` (14.1 MB) | 15 MissionMed-relevant conversations |
| Medium | `conversations-008.json` through `conversations-012.json` | Strong MissionMed signals (9–14 relevant titles each) |

### Phase 2 Email Intelligence Integration Map

```
Intelligence Files (AI Brain)          Operational Systems
─────────────────────────────          ──────────────────
missionmed_student_psychology.md  ──→  Email Intelligence Module
                                  ──→  Student Psychology Panel
                                  ──→  Student Type Classification

missionmed_match_strategy.md      ──→  Match Strategy Panel
                                  ──→  Advising Framework Panel
                                  ──→  Interview Strategy Reference

missionmed_sales_patterns.md      ──→  Objection Handling Engine
                                  ──→  Sales Intelligence Panel
                                  ──→  Conversion Response Templates

missionmed_dr_brian_voice.md      ──→  Voice Pattern Library
                                  ──→  Email Template Voice
                                  ──→  Response Tone Calibration

missionmed_common_red_flags.md    ──→  Red Flag Assessment Panel
                                  ──→  Red Flag Classification Tool
                                  ──→  Compound Risk Matrix

missionmed_advising_frameworks.md ──→  Advising Framework Panel
                                  ──→  Diagnostic-Strategic Method
                                  ──→  Domain-Specific Frameworks
```

### Protected WordPress Systems

These WordPress-integrated systems must NEVER be modified through blog operations:

| System | Risk |
|--------|------|
| RankListIQ | Embedded app — modifying could break user-facing tool |
| LearnDash | LMS — modifying could affect student course access |
| Dr J Notes Engine | Post 4188 is a development prototype |
| Dr J Question Bank | Educational content database |
| WooCommerce | Payment processing — modifying could break transactions |
| Formidable Forms | Lead capture — modifying could break enrollment |
| Embedded HTML apps | Custom tools rendered in WordPress pages |
| Elementor pages | Site design — blog operations must not touch page builder content |

### Rollback Safety Protocol

**Rule: Before any major structural modification, create a snapshot and changelog entry first.**

1. Create snapshot in `BACKUPS/` using format: `YYYY-MM-DD_PROMPT-NNN_DESCRIPTION`
2. Add entry to `CHANGELOG.md` with: timestamp, prompt #, description, files affected, snapshot name, verification
3. Then proceed with modification

| If you need... | Go to... |
|----------------|----------|
| Changelog (all milestones) | `00_ADMIN/business-docs/CHANGELOG.md` |
| Backup snapshots | `07_BACKUPS/BACKUPS/` |
| Master stable baseline | `07_BACKUPS/BACKUPS/MASTER_STABLE_SYSTEM/` |

---

## MissionMed System Naming Canon

**Authority:** MR-SYS-001, MR-HQ-003 | **Effective:** 2026-03-29 | **Status:** LOCKED — PERMANENT

All AI output must use canonical names. Full enforcement rules are in `_SYSTEM/NAMING_CANON.md` (canonical) and referenced from `_SYSTEM/PRIMER_CORE.md` Section 4.

| Canonical Name | Scope |
|---------------|-------|
| **MissionMed HQ** | Platform name |
| **MedMail** | Email + communication engine |
| **Leads** | Lead tracking + conversion |
| **Payments** | Stripe + billing + enrollment |
| **Students** | Admin student management |
| **MissionMed Member Dashboard** | Student-facing portal |
| **Media Engine** | Video storage + tagging + scoring (formerly MMVS) |
| **Studio** | Video editing |
| **Admin Engine** | Internal admin runtime (formerly MCC — never expose publicly) |

**Deprecated → Canonical:** Admin HQ → MissionMed HQ | MCC → Admin Engine | MCC UI → MissionMed HQ | Pipeline → Leads | AI Dashboard → MissionMed HQ | MMVS → Media Engine | Command Center → Admin Engine

**Instructor Panel** has been absorbed into Payments, Students, and Settings.

### MissionMed HQ Architecture Lock (MR-HQ-001, MR-HQ-003)

**Architecture Model (MR-HQ-003 — LOCKED):**
- **PRIMARY:** MASTER_STABLE_SYSTEM = MissionMed HQ (main application shell)
- **SECONDARY:** WordPress = Backend / API / Auth / Payments ONLY

WordPress does not own the UI shell. MASTER_STABLE is the source of truth for navigation, layout, state management, and admin rendering. WordPress provides authenticated data endpoints and backend services.

**Navigation (LOCKED):** Home → Payments → Students → MedMail → Leads → Media Engine → Studio → Settings

**Theme System (LOCKED):** Classic (default, RankListIQ style) | Operations (Admin Engine style) | Media (Media Engine style). Same layout across all themes — only visual layer changes.

**System Mapping:**

| Tab | Backend System(s) |
|-----|-------------------|
| Home | HQ Dashboard (aggregated) |
| MedMail | `AI_EMAIL_ENGINE/` |
| Leads | `LEAD_PIPELINE_UI/` |
| Payments | Stripe Connect + MMI Instructor API + Admin Engine REST |
| Students | Admin Engine + Supabase student views |
| Media Engine | MMVS / CIE unified endpoint |
| Studio | Studio |
| Settings | WordPress options + Supabase config |

**Member Dashboard** (LearnDash) is student-facing — separate from MissionMed HQ. Full details in `_SYSTEM/NAMING_CANON.md` (canonical) and referenced from `_SYSTEM/PRIMER_CORE.md` Section 4.

### Video System Architecture Lock (MR-VS-1100, MR-VS-1101)

**Authority Model (MR-VS-1101 — LOCKED):**
- **CANONICAL MMVS SOURCE:** `VIDEO_SYSTEM/`
- **CANONICAL REGISTRY AUTHORITY:** `VIDEO_SYSTEM/video_registry.json`
- **DERIVED REGISTRY ONLY:** `VIDEO_SYSTEM/mmvs_unified_registry.json`
- **HQ READ MODEL:** CIE `/api/unified*` via `10_CONTENT_INTELLIGENCE_ENGINE/backend/unified_api.py`
- **HQ ROLE:** Consumer only, not owner of video logic

**Primary governance files:**

| Need | File |
|------|------|
| Prior full audit | `MR-VS-1100_VIDEO_SYSTEM_MASTER_AUDIT.md` |
| Canonical architecture lock | `VIDEO_SYSTEM_ARCHITECTURE_LOCK.md` |
| Deploy prep boundary | `MR-VS-1101_MMVS_DEPLOY_PREP.md` |
| Protected file list | `PROTECTED_SYSTEM_BOUNDARIES.md` |

**Legacy / non-canonical path markers:**
- `mmvs-deploy/` = non-canonical deploy copy / to be retired
- `MatchDayVideoSystem/` = legacy archive only
- `MatchDayVideoSystem_LITE/` = legacy archive only
- `09_VIDEO_PIPELINE/` = separate montage concern, not core MMVS/CIE runtime ownership

### Auth Architecture Lock (MM-AUTH-ARCH-001)

**Authority:** Validated 2026-04-23 | **Status:** LOCKED

| Required Knowledge Source | File | Location |
|--------------------------|------|----------|
| Auth system specification | `MM-AUTH-ARCH-001.md` | `08_AI_SYSTEM/MissionMed_AI_Brain/` |

**Trigger:** Any task touching auth flow, session management, CORS configuration, Arena authentication, HQ authentication, Supabase bootstrap, WordPress proxy, or `/api/auth/*` endpoints.

**Scope:** Covers WordPress same-origin proxy, Railway session backend, Supabase bootstrap, Arena full auth chain (exchange -> bootstrap -> setSession -> getUser), HQ Bearer token auth, CORS constraints, cookie configuration, and failure modes. Two distinct auth models (Arena vs HQ) are documented separately.

---

## Drill System Layer Additions (2026-04-10)

- Legacy System Isolation Layer: `drills.html` now preserves the full legacy drill engine behind `const USE_LEGACY_SYSTEM = false;` so legacy can be re-enabled without code deletion.
- API Scaffold Layer: `drills.html` now includes isolated placeholders `fetchDrillData()` and `startAPIDrill()` that are inactive and not wired to UI/DOM.

---

## Quick Reference: Where to Find What

| If you need... | Go to... |
|----------------|----------|
| **Voice / Tone Alignment** | |
| Dr. Brian's voice, phrases, tone patterns | `08_AI_SYSTEM/MissionMed_AI_Brain/missionmed_dr_brian_voice.md` |
| Dr. Brian's voice rules (brand-level) | `06_AI_CONTEXT/MISSIONRESIDENCY_SYSTEM_CONTEXT.md` |
| Proven persuasion sentences (105) | `08_AI_SYSTEM/PHASE1_CONVERSION_INTELLIGENCE/MISSIONMED_PERSUASION_LANGUAGE_LIBRARY.md` |
| **Student Psychology** | |
| Student pain points & psychological barriers | `08_AI_SYSTEM/MissionMed_AI_Brain/missionmed_student_psychology.md` |
| Student behavioral archetypes (8 types) | `08_AI_SYSTEM/PHASE1_CONVERSION_INTELLIGENCE/MISSIONMED_STUDENT_ARCHETYPE_MODEL.md` |
| Student intent classification & scoring | `08_AI_SYSTEM/PHASE1_CONVERSION_INTELLIGENCE/MISSIONMED_STUDENT_INTENT_MODEL.md` |
| Common student problems (10 categories) | `06_AI_CONTEXT/KNOWLEDGE_PHILOSOPHY_CORE/MISSIONMED_KNOWLEDGE_PHILOSOPHY_CORE_MASTER.md` |
| **Testimonials & Proof** | |
| Testimonial database (4-tier quote library) | `08_AI_SYSTEM/MissionMed_AI_Brain/MISSIONMED_TESTIMONIAL_DATABASE.md` |
| Testimonial master CSV | `04_PROOF/TESTIMONIALS/TESTIMONIAL_MASTER.csv` |
| Facebook testimonial library | `04_PROOF/TESTIMONIALS/MISSIONRESIDENCY_FACEBOOK_TESTIMONIAL_LIBRARY.md` |
| Alumni outcomes report | `04_PROOF/ALUMNI_OUTCOMES/MISSIONMED_ALUMNI_OUTCOMES_REPORT.md` |
| Alumni outcomes data (spreadsheet) | `04_PROOF/ALUMNI_OUTCOMES/MISSIONMED_ALUMNI_OUTCOMES_TABLE.xlsx` |
| **Conversion Models** | |
| Conversion playbook (301 threads, 71 conversions) | `08_AI_SYSTEM/PHASE1_CONVERSION_INTELLIGENCE/MISSIONMED_CONVERSION_PLAYBOOK.md` |
| Conversion signal weights (33 signals) | `08_AI_SYSTEM/MISSIONMED_CONVERSION_SIGNAL_MODEL.md` |
| Lead scoring algorithm (9-step) | `08_AI_SYSTEM/MISSIONMED_LEAD_SCORING_ENGINE.md` |
| Model validation metrics | `08_AI_SYSTEM/MISSIONMED_CONVERSION_MODEL_VALIDATION.md` |
| **Advising Frameworks** | |
| 10 advising domain frameworks | `08_AI_SYSTEM/MissionMed_AI_Brain/missionmed_advising_frameworks.md` |
| Match strategy (10 domains) | `08_AI_SYSTEM/MissionMed_AI_Brain/missionmed_match_strategy.md` |
| Red flag classification & recovery | `08_AI_SYSTEM/MissionMed_AI_Brain/missionmed_common_red_flags.md` |
| Red flag match framework (taxonomy + conversion intel) | `08_AI_SYSTEM/MissionMed_AI_Brain/RED_FLAG_MATCH_FRAMEWORK.md` |
| Red flag match cases (35 structured entries) | `04_PROOF/TESTIMONIALS/RED_FLAG_MATCH_CASES.md` |
| Sales language, pricing, objections | `08_AI_SYSTEM/MissionMed_AI_Brain/missionmed_sales_patterns.md` |
| **Website Architecture** | |
| Website site map (17 pages, 3 phases) | `08_AI_SYSTEM/STRATEGIC_REVIEWS/MissionMed_Final_Website_Architecture.docx` |
| Website conversion strategy | `02_WEBSITES/missionmedinstitute/strategy/MissionMed_Website_Conversion_Strategy_2026.docx` |
| Homepage blueprint | `02_WEBSITES/missionmedinstitute/homepage/MissionMed_Homepage_Blueprint_2026.docx` |
| Homepage final copy | `02_WEBSITES/missionmedinstitute/homepage/MissionMed_Homepage_Copy_Revised_Final_2026.docx` |
| Visual rules (MR-919) | `02_WEBSITES/missionmedinstitute/governance/MR-919_VISUAL_RULES.md` |
| Visual enforcement CSS (MR-919) | `02_WEBSITES/missionmedinstitute/governance/MR-919_VISUAL_ENFORCEMENT.css` |
| Visual audit checklist (MR-919) | `02_WEBSITES/missionmedinstitute/governance/MR-919_VISUAL_AUDIT_CHECKLIST.md` |
| WP/Elementor implementation guide (MR-919) | `02_WEBSITES/missionmedinstitute/governance/MR-919_WORDPRESS_ELEMENTOR_IMPLEMENTATION.md` |
| Visual audit scanner (MR-919) | `02_WEBSITES/missionmedinstitute/governance/MR-919_visual_audit.sh` |
| Blueprint reconciliation | `08_AI_SYSTEM/STRATEGIC_REVIEWS/MissionMed_Website_Blueprint_Reconciliation.docx` |
| **Strategic Positioning** | |
| Positioning extraction (transformation narrative) | `01_BRAND/marketing-assets/MissionMed_Positioning_Extraction_2026.docx` |
| Knowledge philosophy (5-layer value prop) | `06_AI_CONTEXT/KNOWLEDGE_PHILOSOPHY_CORE/MISSIONMED_KNOWLEDGE_PHILOSOPHY_CORE_MASTER.md` |
| Strategic positioning review | `00_ADMIN/MissionMed_Strategic_Positioning_Review.docx` |
| Revenue intelligence review | `08_AI_SYSTEM/STRATEGIC_REVIEWS/MissionMed_Revenue_Intelligence_Strategic_Review.docx` |
| **Mission Residency Program** | |
| Program tiers, audience, tone rules | `06_AI_CONTEXT/MISSIONRESIDENCY_SYSTEM_CONTEXT.md` |
| Full MissionMed ecosystem context | `06_AI_CONTEXT/MISSIONMED_SYSTEM_CONTEXT.md` |
| Legacy site content (11 pages) | `06_AI_CONTEXT/LEGACY_CONTENT/MISSIONRESIDENCY/MISSIONRESIDENCY_PAGES.md` |
| Legacy products & pricing | `06_AI_CONTEXT/LEGACY_CONTENT/MISSIONRESIDENCY/MISSIONRESIDENCY_PRODUCTS.md` |
| Legacy FAQ answers | `06_AI_CONTEXT/LEGACY_CONTENT/MISSIONRESIDENCY/MISSIONRESIDENCY_FAQS.md` |
| Legacy match strategy guides | `06_AI_CONTEXT/LEGACY_CONTENT/MISSIONRESIDENCY/MISSIONRESIDENCY_MATCH_GUIDES.md` |
| Facebook group audit | `06_AI_CONTEXT/MISSIONRESIDENCY_FB_GROUP_SUMMARY.md` |
| Legacy site audit | `06_AI_CONTEXT/MISSIONRESIDENCY_SITE_AUDIT.md` |
| **Operational Protocol** | |
| Master Prompt Protocol (constitution) | `08_AI_SYSTEM/MR-034_MissionMed_Master_Prompt_Protocol_2026-03-14.docx` |
| System Intelligence Audit | `08_AI_SYSTEM/MissionMed_System_Intelligence_Audit_2026-03-14.docx` |
| AI protocol copyblock (paste in sessions) | `MISSIONMED_PROTOCOL_COPYBLOCK.txt` (root) |
| AI protocol master template | `MISSIONMED_AI_PROTOCOL_MASTER_TEMPLATE.docx` (root) |
| Session initialization primer (canonical) | `_SYSTEM/PRIMER_CORE.md` |
| Decision log (authoritative) | `08_AI_SYSTEM/MissionMed_AI_Brain/decisions_log/DECISIONS_INDEX.md` |
| Command Center core package | `08_AI_SYSTEM/COMMAND_CENTER_CORE/MAC-6_Command_Center_Core_Infrastructure.md` |
| Video system authority lock | `VIDEO_SYSTEM_ARCHITECTURE_LOCK.md` |
| Video system deploy prep | `MR-VS-1101_MMVS_DEPLOY_PREP.md` |
| Drill API contract LOCK (SYSTEM LAW) | `(A)-API-Claude-High-003_Drill_API_Contract_LOCK_2026-04-10.md` — canonical `/api/drills` shape; Python `app.py:2185` = source of truth; Node `server.mjs:2204` deprecated |
| Drill API contract forensic audit | `MASTER-A_Drill_API_Contract_Production_Endpoint_System_Audit_2026-04-10.md` — evidence that produced the lock |
| API discovery state (Drill API) | `MM_ACTIVITY_LOG.md` (entry: `(A)-API-Codex-High-002`) |
| Active Drill API Endpoint | `https://mmvs-backend-production.up.railway.app/api/drills` (live on 2026-04-10; returns non-empty JSON array) |
| Stream ID Source Discovery | `MM_ACTIVITY_LOG.md` (entry: `(A)-API-Codex-High-007`) + `_KNOWLEDGE/OPERATIONAL_STATE.md` (Drill Engine API subsystem state) |
| Cloudflare Stream Mapping Status | `MM_ACTIVITY_LOG.md` (entry: `(A)-API-Codex-High-007`) — status PARTIAL: local registry rows unmapped, one legacy Supabase mapped row verified, Cloudflare API token invalid/malformed |
| Protected system boundaries | `PROTECTED_SYSTEM_BOUNDARIES.md` |
| **Email System** | |
| Email response engine spec | `08_AI_SYSTEM/MISSIONMED_EMAIL_RESPONSE_ENGINE.md` |
| Email engine UI | `08_AI_SYSTEM/AI_EMAIL_ENGINE/email_inbox.html` |
| Email intelligence module | `08_AI_SYSTEM/AI_EMAIL_ENGINE/email_intelligence_module.js` |
| **Lead Management** | |
| Lead intelligence system spec | `08_AI_SYSTEM/MISSIONMED_LEAD_INTELLIGENCE_SYSTEM.md` |
| Active lead data | `05_DATA/MISSIONMED_LEAD_PIPELINE.csv` |
| Lead pipeline UI | `08_AI_SYSTEM/LEAD_PIPELINE_UI/pipeline.html` |
| **Data Assets** | |
| Master student database | `05_DATA/MISSIONMED_MASTER_STUDENT_DATABASE.csv` |
| Raw email archive | `05_DATA/email_exports/Sent.mbox` |
| Email thread index | `08_AI_SYSTEM/PHASE1_CONVERSION_INTELLIGENCE/output/MISSIONMED_EMAIL_THREAD_INDEX.csv` |
| System changelog | `00_ADMIN/business-docs/CHANGELOG.md` |
| **SEO & Blog** | |
| Blog audit report | `02_WEBSITES/missionmedinstitute/audits/MissionMed_Blog_Audit_Report.docx` |
| SEO authority map | `02_WEBSITES/missionmedinstitute/seo/MissionMed_SEO_Authority_Map_2026.docx` |
| Blog architecture | `02_WEBSITES/missionmedinstitute/blog/MissionMed_Blog_Architecture_2026.docx` |
| Content reuse strategies | `06_AI_CONTEXT/LEGACY_CONTENT/MISSIONRESIDENCY/MISSIONRESIDENCY_KNOWLEDGE_INDEX.md` |

---

*This index should be updated whenever new knowledge assets are added to the MissionMed ecosystem. Last verified: 2026-04-18.*
