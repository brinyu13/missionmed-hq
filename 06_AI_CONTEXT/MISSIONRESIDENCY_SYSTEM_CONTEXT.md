# Mission Residency — System Context
**Version:** 1.0 | **Created:** 2026-03-05 | **Source:** Local files + public web research (missionresidency.com indexed pages)

> This file covers Mission Residency specifically — the flagship coaching and mentorship program. For the full parent brand overview, see `MISSIONMED_SYSTEM_CONTEXT.md`.

---

## What the Brand Is

Mission Residency is the flagship product of MissionMed Institute and the most recognized brand in the organization. It is a personalized residency match coaching and mentorship program specifically built for international medical graduates (IMGs) applying to U.S. residency programs through the NRMP Match. Founded by Dr. Brian — an IMG himself who trained in the Philippines and built this program for doctors like him — Mission Residency has operated since at least 2015, serving thousands of IMGs across virtually every specialty. The program is deliberately small and high-touch: class sizes are limited, Dr. Brian personally trains students at the top tiers, and the emphasis is always on real mentorship over templates and templates. The organization is headquartered in New York, NY (2470 8th Avenue), and operates as a family-owned business with a 40/40/20 partnership structure between Dr. Brian, Dr. J, and Phil.

---

## Divisions / Products

- **IV BootCamp (Level 1)** — Live online interactive interview training with Dr. Brian. Entry-level program for interview prep fundamentals.
- **IV Complete Masterclass (Level 2)** — Everything in Level 1 plus full-season guidance, unlimited mock interviews, and a Match Guarantee.
- **360 Elite Match Mentorship (Level 3)** — The most premium offering. Full 1-on-1 private training, personal statement assistance, full-day advanced training, smaller groups, extended advising sessions, and direct mobile access to Dr. Brian. Includes Match Guarantee.
- **MatchFirst™** — Deferred-payment track. Students start with a deposit and pay the remaining balance only after matching. If they don't match (and met participation requirements), the balance is waived. Available for doctors with red flags or limited funds.
- **Mission USCE** — U.S. Clinical Experience externship placements at teaching hospitals (New York, Chicago, Florida). Managed by Phil. Priority USCE access is a membership benefit.
- **Free Red Flag Consultation** — Free CV and match strategy evaluation for IMGs with low Step scores, old YOG, or failed attempts. Accessed at `/consultation-appointments`.
- **Match Insights Blog** — Content marketing arm at `/match-insights-blog`. Covers match strategy, red flags, USCE, IMG statistics, and Dr. Brian's perspective.
- **MatchChallenge** — A lead generation / engagement event (`/matchchallenge`) [Uncertain — current active status unknown].
- **Start Here: Match Essentials** — An entry-point resource page (`/start-here-match-essentials`) for new visitors.

---

## Core Offers & How They Work

- **Level 1 — IV BootCamp:** Live group interview training sessions with Dr. Brian. Focuses on interview communication, confidence, and fundamentals. Entry price point. [Uncertain — exact current pricing not confirmed].
- **Level 2 — IV Complete Masterclass:** Includes Level 1 + full season of guided preparation, unlimited mock interviews, and a conditional Match Guarantee ("Match the first year under our training, or next season's training is free"). [Uncertain — exact current pricing not confirmed].
- **Level 3 — 360 Elite Match Mentorship:** The most hands-on program. Includes Levels 1 & 2 benefits plus:
  - Full 1-on-1 private training with Dr. Brian
  - Personal statement writing assistance
  - Smaller group sessions
  - Full-Day Advanced Training (in-person or intensive)
  - Direct mobile access to Dr. Brian when needed
  - Extended personal advising sessions
  - Match Guarantee included
  - "360" refers to total wrap-around support across all aspects of the application
- **MatchFirst™:** Applicant pays deposit → receives full program access → pays remaining balance only if they match. If match conditions not met and participation requirements fulfilled, remaining balance is waived. Positioned as the only IMG program offering this model.
- **Free Consultation:** 15–30 min strategy call focused on red flag IMGs. Lead generation tool that converts into program enrollment. Accessed via `/consultation-appointments`.
- **USCE Referrals:** Dr. Brian provides a personal introduction to Phil's USCE placement network post-enrollment. Not a directly operated clinical service — it's a facilitated referral to a specialized partner.

---

## Audience Segments

- **Red-flag IMGs (primary):** Low USMLE scores (below national averages), long year-of-graduation gaps (5+ years), multiple failed attempts, limited or no U.S. clinical experience. The emotional hook: "You were told you have no chance. We've helped thousands like you."
- **Caribbean medical graduates:** U.S. citizens who attended Caribbean medical schools. Strong desire to match; often lack structured guidance and institutional support.
- **First-time applicants who are anxious:** IMGs applying for the first time who want a clear roadmap and someone in their corner.
- **Re-applicants (post-scramble or unmatched):** Doctors who went unmatched or entered SOAP in a prior season and need to rebuild their strategy.
- **IMGs who need USCE:** Doctors who don't yet have U.S. rotations on their CV and need them to be competitive.
- **Financially constrained applicants:** Doctors who want to enroll but can't pay full price upfront — MatchFirst™ is the solution.
- **Advanced applicants who want top-choice matches:** Even doctors with strong applications use 360 Elite to maximize first-choice placement efficiency.

---

## Tone / Voice Rules

- **Dr. Brian's voice is the brand voice.** When writing for Mission Residency, write as if Dr. Brian is speaking directly to the student — experienced, warm, direct, without condescension.
- **Lead with empathy, follow with confidence.** Acknowledge the student's fear or frustration first, then pivot to what's possible with the right preparation.
- **Speak to the underdog.** The core customer often feels overlooked or written off. The brand should feel like the one that believes in them when no one else does.
- **Results-backed confidence.** Always ground optimism in real data: "86–93% Match rate for students who complete training and receive at least one interview" (vs. ~50% national IMG average per NRMP).
- **Anti-corporate, pro-human.** Never sound like a university admissions department or a large coaching company. No "solutions," no "leverage," no "stakeholders."
- **Never generic.** Don't write copy that could apply to any residency prep company. Reference specifics: Dr. Brian's own IMG background, the personal mobile access in 360 Elite, the 15+ years of results.
- **Honest about limitations.** The program is deliberately small. Not everyone will get in. This is a selling point — position it as exclusive, not as a rejection.
- **Conversational but professional.** Contractions are fine. Direct address ("you") is preferred. Short sentences. No walls of text.

---

## Tech Stack & Deployment Reality

- **Main website:** `missionresidency.com` — WordPress + Elementor page builder. Mix of older WP-style pages (archive URLs) and newer Squarespace-style URL patterns suggesting potential platform migration in progress [Uncertain].
- **Enrollment portal:** `enroll.missionresidency.com` — Separate subdomain. Likely a LearnDash-powered install or third-party enrollment platform [Uncertain — confirm LMS].
- **Course delivery:** [Uncertain — live Zoom sessions confirmed for USMLE Drills; format for Mission Residency program delivery (Zoom, recorded video, LMS modules) needs confirmation].
- **Database / Software backend:** Supabase (confirmed for RankListIQ; integration with Mission Residency enrollment pipeline is unconfirmed).
- **Scheduling:** [Uncertain — Calendly, Acuity, or custom? Used for consultations and mock interview booking].
- **Payment processing:** [Uncertain — Stripe, PayPal, or other? MatchFirst™ requires deposit + conditional deferred payment logic].
- **Email / CRM:** [Uncertain — platform for student onboarding sequences, match season comms, alumni updates].
- **WordPress plugins in use:** Elementor (confirmed), likely WooCommerce or ThriveCart for transactions, possibly Gravity Forms for applications [Uncertain — confirm active plugin list].
- **Embedded tools:** RankListIQ appears to be embeddable or linked from within the site based on screenshot evidence of `missionmedinstitute.com/rank-list-engine`.

---

## File Naming Convention

Official MissionMed naming structure (source: `MissionMed_USMLE_Drills_File_Renaming_Guide_2026-02-13_PDF.pdf`):

```
DIVISION-Program_Step_Specialty-Topic_Subtopic_YYYY-MM-DD_Type.ext
```

**For Mission Residency content:**
```
MissionResidency_360Elite_InterviewPrep_MockInterview_2026-03-05_VIDEO.mp4
MissionResidency_Masterclass_PersonalStatement_Draft_2026-03-05_DOC.docx
MissionResidency_MatchFirst_Onboarding_Checklist_2026-03-05_PDF.pdf
```

**Rules:**
- Underscores `_` between major fields; hyphens `-` within multi-word values
- Date always `YYYY-MM-DD`
- No spaces in filenames
- Type suffix: `VIDEO`, `AUDIO`, `PDF`, `DOC`, `SLIDES`, `IMG`

---

## Do Not Do

- Do not write copy that promises a guaranteed match without clearly stating the program conditions (completed training + received at least one interview).
- Do not position Mission Residency as a large company with many advisors — the personal access to Dr. Brian is a key differentiator, not a liability.
- Do not use "international medical graduate" or "IMG" as pejorative framing — the audience self-identifies with these terms and they should be used respectfully and matter-of-factly.
- Do not suggest that low Step scores or long gaps are permanent disqualifiers — the entire program is built on overcoming these.
- Do not conflate the three program levels — each has specific inclusions, and blurring them creates customer service problems and misaligned expectations.
- Do not publish MatchFirst™ without clearly stating the participation requirements for the waiver clause — this is a legal/contractual term that must be stated accurately.
- Do not use USCE as a universal promise — placements depend on availability and the student meeting all onboarding requirements (background check, drug screen, vaccinations, ACLS/BLS/HIPAA).
- Do not reference Dr. J publicly without confirming current partnership status and preferred public introduction language.
- Do not write "since 2015" without confirmation — this is inferred from "10-year alumni network" claim seen in search results as of 2025.

---

## Open Questions / Missing Inputs

- [ ] What is the current (2025–2026 season) pricing for Level 1, Level 2, and Level 3 programs?
- [ ] What are the exact Match Guarantee conditions in writing (for legal accuracy in copy)?
- [ ] Is MatchFirst™ still actively offered in 2026? What is the deposit amount?
- [ ] What is the maximum class size per program tier per season?
- [ ] What is Dr. J's full name and how should he be introduced publicly?
- [ ] What platform powers `enroll.missionresidency.com`? (LearnDash, Kajabi, Teachable, custom?)
- [ ] What is the scheduling tool for consultations and mock interviews?
- [ ] What CRM / email platform is used for student lifecycle communications?
- [ ] Are there active YouTube, Instagram, or TikTok channels? URLs?
- [ ] What is the current Facebook group URL and approximate member count?
- [ ] Is the MatchChallenge (`/matchchallenge`) an active ongoing feature or a legacy campaign page?
- [ ] Are there any formal alumni testimonial / case study pages that should be referenced in copy?
- [ ] What is the 2026 application season timeline (enrollment open/close dates)?
