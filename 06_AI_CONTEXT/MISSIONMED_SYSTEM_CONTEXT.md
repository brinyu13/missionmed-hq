# MissionMed Institute — System Context
**Version:** 1.0 | **Created:** 2026-03-05 | **Source:** Local files + public web research

> This file is the master AI context document for MissionMed Institute as a whole. For the flagship program, see `MISSIONRESIDENCY_SYSTEM_CONTEXT.md`.

---

## What the Brand Is

MissionMed Institute is the parent umbrella organization behind a suite of programs and software tools designed to guide international medical graduates (IMGs) through every stage of their U.S. medical career — from USMLE preparation, to obtaining U.S. clinical experience, to matching into a residency program. Founded and led by Dr. Brian (Dr. Brian B., based in New York, NY), MissionMed operates as a small, family-owned institution that deliberately emphasizes quality, personalization, and long-term student relationships over volume and corporate scale. The flagship program, Mission Residency, has been operating since at least 2015 and has helped thousands of IMGs successfully match. MissionMed is not a corporate chain — it is a close-knit educator-led operation built around the expertise of Dr. Brian, Dr. J (USMLE specialist), and Phil (USCE clinical placement).

---

## Divisions / Products

- **Mission Residency** — The flagship coaching and mentorship program for IMGs preparing for U.S. residency match. Lives at `missionresidency.com`. See dedicated context file.
- **USMLE Drills** — Group live study sessions covering Step 1 and Step 2CK content. Delivered via Zoom. Active as of early 2026. Led primarily by Dr. J.
- **Mission USCE (Clinicals)** — U.S. Clinical Experience placements at teaching hospitals in New York, Chicago, and Florida. Managed through Phil's hospital partner network. Includes a full student onboarding checklist (HIPAA-OSHA, ACLS, BLS, background check, drug screen, immunizations, etc.).
- **RankListIQ** — A web-based software tool for building and optimizing a residency rank list strategy. Has a frontend, a backend engine, and a Supabase database. Screenshot evidence shows a "Strategy Saved" confirmation state. In active development.
- **Oracle** — A match prediction engine (in development). Separate frontend + prediction engine + Supabase stack.
- **FutureTools** — Placeholder division for future software products.
- **MissionMed Membership** — A tiered recurring membership model (Basic / Premium / Elite) under development as of late 2025, designed to provide ongoing USMLE tutoring, community, and residency prep support at predictable monthly pricing.

---

## Core Offers & How They Work

- **Mission Residency Programs (tiered coaching):** Students enroll in one of three levels of interview and match preparation (BootCamp → Masterclass → 360 Elite). Each level adds more personalization, 1-on-1 access, and strategic depth. Enrollment via `enroll.missionresidency.com`.
- **MatchFirst™:** A deferred-payment program for IMGs with limited funds. Student pays a deposit upfront and pays the balance only upon successfully matching. If they don't match (after fulfilling participation requirements), the balance is waived.
- **USMLE Drills (Group Sessions):** Recurring live Zoom sessions by topic (Step 1 and Step 2CK). Topics rotate through all major USMLE subject areas over a multi-week curriculum. Sessions are recorded and archived.
- **USCE Placements:** Students who qualify (after completing onboarding requirements) are placed into hands-on externships at U.S. teaching hospitals. Phil manages the hospital partnership pipeline.
- **Membership Tiers (planned/in development):**
  - Basic — $49/mo: Unlimited group sessions, audio library, 10% tutoring discount, community access
  - Premium — $99/mo: Everything in Basic + monthly live Q&A, priority USCE access, bundle discounts
  - Elite — $199/mo: Everything in Premium + 1 private session credit/month (use-it-or-lose-it, 7-day grace), priority scheduling, exclusive workshops
- **A La Carte Tutoring:** $150/hr (non-member), $135/hr (member). Tutor keeps 70–80%.
- **Tutoring Bundles (Dr. J standard rates):** 3-Pack $350 (~$117/hr) | 5-Pack $550 (~$110/hr) | 10-Pack $995 (~$99/hr)
- **RankListIQ (software tool):** Web app for rank list strategy and optimization. [Uncertain — pricing model, public launch status, and access method not yet confirmed]
- **Free Red Flag Consultation:** Free CV + match strategy evaluation session for IMGs with low Step scores, old year of graduation, or failed attempts. Offered via `missionresidency.com/consultation-appointments`.

---

## Audience Segments

- **Primary — IMGs with "red flags":** Doctors with low USMLE scores, long gaps post-graduation, multiple attempts, or limited U.S. clinical experience. Often told by others that they have "no chance."
- **Caribbean medical graduates:** U.S. and Caribbean grads who need structured guidance and confidence-building.
- **IMGs actively applying in the current season:** Doctors who have Step scores and are preparing for interviews, building rank lists, or writing personal statements.
- **Early-stage IMGs:** Doctors still completing USMLE exams who need Step 1/2CK support and a clear roadmap.
- **IMGs needing USCE:** Doctors who require U.S. clinical rotations at teaching hospitals as part of their application profile.
- **Financially constrained IMGs:** Doctors who need the MatchFirst™ option to start training before paying in full.
- **[Uncertain] Residency program directors / administrators:** Dr. Brian consults with residency programs on interview process design — this may be a secondary B2B audience not yet reflected in public messaging.

---

## Tone / Voice Rules

- **Mentor, not corporation.** Write and speak as a trusted advisor who has been through the process and helped thousands of others. Never use cold, generic, or corporate language.
- **Warm + direct.** Be conversational and real. Don't pad with filler. Say what you mean.
- **Data-backed confidence.** Lean on real results: "86–93% Match rate for students who complete training and receive at least one interview" (vs. national IMG average of ~50%).
- **Empathy first.** Acknowledge the fear, frustration, and isolation that many IMGs feel. Don't skip past it to sell.
- **No overpromising.** Never guarantee results beyond what the data actually supports. The Match Guarantee (on 360 Elite) has specific conditions — don't present it as unconditional.
- **Quality over quantity.** Reinforce that MissionMed deliberately limits class sizes. This is a selling point, not a weakness.
- **Human, not corporate.** Avoid phrases like "we are pleased to offer," "leverage our synergies," or "best-in-class solutions." Write like Dr. Brian talks.
- **Use "Dr. Brian" and "Dr. J" consistently.** Don't say "our instructors" or "our team" without naming them when possible.

---

## Tech Stack & Deployment Reality

- **Website:** WordPress + Elementor (primary site builder). Main site: `missionresidency.com`. Parent brand: `missionmedinstitute.com` [Uncertain — relationship and redirect behavior not fully confirmed].
- **LMS:** LearnDash (inferred from folder structure and industry standard for WordPress-based course platforms) [Uncertain — confirm actual LMS in use].
- **Enrollment Portal:** `enroll.missionresidency.com` — separate subdomain, likely a distinct platform or LearnDash install.
- **Database / Backend:** Supabase (confirmed via RankListIQ and Oracle folder structures and screenshot evidence of Supabase integration).
- **Video / Live Sessions:** Zoom (confirmed via USMLE Drills recording naming convention referencing Zoom recordings).
- **Software Tools:** RankListIQ and Oracle are custom-built web apps with separate frontend + backend + Supabase stack. Folders: `04_SOFTWARE/RankListIQ/` and `04_SOFTWARE/Oracle/`.
- **File Storage:** Local structured storage at `~/Documents/MissionMed/` with 8 major divisions.
- **Embedded HTML tools:** [Uncertain — confirm which tools are embedded directly into WordPress pages vs. hosted separately].

---

## File Naming Convention

All MissionMed Institute content files follow this official naming structure (sourced from `MissionMed_USMLE_Drills_File_Renaming_Guide_2026-02-13_PDF.pdf`):

```
DIVISION-Program_Step_Specialty-Topic_Subtopic_YYYY-MM-DD_Type.ext
```

**Example:**
```
USMLE-Drills_Step1_Cardiology_General_2026-02-24_VIDEO.mp4
```

**Rules:**
- Use underscores `_` between major fields
- Use hyphens `-` within a field to join multi-word values (e.g., `Microbiology-InfectiousDisease`)
- Date format is always `YYYY-MM-DD`
- `Type` values: `VIDEO`, `AUDIO`, `PDF`, `DOC`, `SLIDES`
- `DIVISION` should match the top-level program slug (e.g., `USMLE-Drills`, `MissionResidency`, `USCE`, `RankListIQ`)
- No spaces anywhere in filenames

---

## Do Not Do

- Do not position MissionMed as a large corporation or imply it has a large staff of anonymous employees.
- Do not use generic medical education marketing language ("comprehensive," "holistic," "innovative solutions").
- Do not publish or share internal revenue splits, partner percentages, or internal business model documents publicly.
- Do not guarantee match results without stating the specific conditions (completed training, received at least one interview, etc.).
- Do not conflate MissionMed Institute with Mission Residency in public-facing content — MissionMed is the umbrella; Mission Residency is the flagship product.
- Do not create content implying USCE placements are run entirely in-house — they are managed via Phil's external hospital partner network.
- Do not quote a la carte tutoring prices or membership prices without confirming the current published rate (pricing models were in iterative development as of late 2025).
- Do not store or publish any student PII (names, scores, visa status, personal details) in shared files or AI context documents.

---

## Open Questions / Missing Inputs

- [ ] What is the official relationship between `missionmedinstitute.com` and `missionresidency.com`? Are they the same WordPress install or separate sites?
- [ ] Is LearnDash the confirmed LMS, or is a different platform (Kajabi, Teachable, Thinkific) in use?
- [ ] What is the current public-facing pricing for the 2025–2026 Match season programs (Level 1, 2, 3, MatchFirst)?
- [ ] Has the new membership model (Basic/Premium/Elite) launched publicly? If so, at what URL?
- [ ] What is the official brand color palette (hex codes)? Only SVG membership icons and logos found locally — no style guide.
- [ ] What fonts are used on the website and in brand materials?
- [ ] Is Oracle publicly launched or still internal/in development?
- [ ] What is Phil's full name and official title for any public-facing references?
- [ ] Does Dr. J have a public profile page on the site?
- [ ] What email platform/CRM is used for student communication and onboarding (e.g., ActiveCampaign, ConvertKit, HubSpot)?
- [ ] Are there active social media channels beyond the Facebook group (Instagram, YouTube, TikTok)?
- [ ] What is the current class size cap per season?
