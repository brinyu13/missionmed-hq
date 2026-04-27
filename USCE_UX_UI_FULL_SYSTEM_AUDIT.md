# USCE UX/UI FULL SYSTEM AUDIT
### Red Team Review + Product Design Analysis
**Date:** 2026-04-27
**Authority:** (W)-USCE-UX-UI-AUDIT-REDTEAM
**Status:** COMPLETE

---

## EXECUTIVE SUMMARY

The USCE system has strong backend engineering. The API layer, state machines, payment capture logic, auth chain, and data contracts are all built with real rigor. That is not the problem.

The problem is that the student-facing experience does not exist yet, and the pieces that do exist (email template, auth flow, API response shape) telegraph a system that was designed backend-out, not student-in. If shipped as-is with a minimal frontend bolted on, this system will feel like an enterprise invoice portal. Students will hesitate. Conversion will suffer. Trust will be low. The premium, Arena-DNA feel that MissionMed requires will be completely absent.

This audit identifies every friction point, trust gap, and design failure across the full offer-to-enrollment flow, then provides a concrete rebuild plan.

---

## 1. CURRENT UX DIAGNOSIS

### What Feels Generic

**The offer email is the worst offender.** The `OfferEmailTemplate` is 27 lines of bare HTML. Arial font. A heading that says "USCE Offer Ready." A raw portal URL dumped as text. No brand mark. No program imagery. No social proof. No urgency design. No visual hierarchy beyond a single `<strong>` tag. This is the first thing a student sees after expressing interest in a clinical experience that costs potentially thousands of dollars. It looks like an automated invoice notification from a billing system.

**The API response shape leaks internal machinery.** The portal GET endpoint returns raw fields like `payment_intent_id`, `payment_intent_created_at`, `retry_count`, `failed_at`, `invalidated_reason`. These are database column names. A student-facing API should return a curated view model, not a database dump. This signals that the frontend was an afterthought.

**Error messages are developer-facing.** "No Supabase session found. Student must complete bootstrap chain." That is an error code message. A student who sees anything resembling this will immediately lose trust. The error-codes.ts file has 21 error definitions and zero of them are written for human consumption.

**The auth flow is a Rube Goldberg machine from the student's perspective.** WordPress cookie to Railway validation to encrypted Bearer token to Supabase session bootstrap. Three hops before a student can view their offer. If any hop fails (and they will, on mobile, on Safari, with ad blockers), the student gets a cryptic error and no recovery path.

### What Feels Confusing

**"Portal" is not a word students use.** The URL structure `/usce/portal/{token}` means nothing to a student. They don't know what a "portal" is in this context. They clicked a link in an email. They want to see their offer. The word "portal" signals enterprise software.

**The state machine has states students can't interpret.** `INVALIDATED`, `REVOKED`, `RETRY_EXHAUSTED` are internal system concepts. A student whose offer was invalidated because a sibling offer was paid doesn't understand "sibling offers." They understand "this placement is no longer available."

**Payment window timeout is invisible.** There's a 5-minute cron that enforces payment timeouts, but there is no visible countdown or urgency signal in the UI state. A student who accepts an offer, gets distracted, and comes back finds their offer expired with no explanation of what happened or what to do next.

### Where Users Hesitate

**The accept/decline decision point.** The respond endpoint takes `{ action: 'ACCEPT' | 'DECLINE' }`. Binary. No "I need more time." No "I have questions." No ability to save progress or bookmark. Accept means immediately entering a payment flow. That is a high-commitment action with no intermediate state. Students will freeze.

**Payment after acceptance.** The respond route returns a `stripe_client_secret` stub and a redirect URL. There is no confirmation screen between "I accept" and "enter your credit card." No summary of what you're paying for. No breakdown. No cancellation policy. No refund terms. Just: you clicked accept, now pay.

### Where Trust Is Lost

**No institutional branding anywhere in the flow.** The email has no logo. The portal URL is a token hash. There is no program detail page with hospital names, faculty photos, or accreditation badges. A student receiving an email that says "pay us $X for a clinical experience" with a cryptic link looks identical to a phishing attempt.

**No confirmation of who sent this.** The offer email doesn't identify the sender institution, the coordinator who created the offer, or any verifiable institutional contact. It says "USCE Offer Ready" like a subject line from an automated system.

**Stub payment intents.** The respond route generates `pi_stub_` prefixed payment intent IDs. This means Stripe integration is not complete. If a student somehow reaches the payment step, it will fail silently or produce an error. Shipping with stubs is a trust-destroying event.

### Where Friction Exists

**Token-based access requires authentication.** The portal route requires a valid Supabase session. But students arrive via email link. They may not be logged in. They may not have an account. The auth chain (WordPress to Railway to Supabase) must complete before they can see their offer. On mobile, this is 3-5 redirects before content appears.

**No mobile optimization evidence.** No viewport meta tags in the email template. No responsive design tokens. No mobile-specific UI states. The Arena system has detailed responsive breakpoints (620px, 900px, 1200px). The USCE portal has none.

**Retry limit is 2, with no warning.** Students get 2 payment retries before `RETRY_EXHAUSTED`. There is no progressive warning ("this is your last attempt"). After exhaustion, there is no recovery path in the UI, no "contact support" flow, nothing. The student is simply stuck.

### Where Drop-off Likely Occurs

1. **Email open to portal click:** The email looks like spam. Low click-through.
2. **Portal click to authenticated view:** Auth chain failures on mobile. High bounce.
3. **Offer view to accept:** No trust signals, no urgency, no social proof. Hesitation.
4. **Accept to payment completion:** No confirmation screen, stub payment intents, no price breakdown. Abandonment.
5. **Payment failure to retry:** No clear error explanation, no guidance. Permanent loss.

---

## 2. RED TEAM (BRUTAL)

### Why Would I NOT Trust This?

**It looks like a scam.** I received an email with no logo, no institutional letterhead, no sender photo, no physical address, and a link to a URL with a random token. The email asks me to pay thousands of dollars for a "clinical experience." This is indistinguishable from phishing. If I forward this to a friend or parent for advice, they will tell me not to click it.

**There is no way to verify the offer independently.** I can't call a phone number listed in the email. I can't visit a program page on a recognizable website. I can't google the portal URL to confirm it's legitimate. The token URL is unique to me and won't appear in any search results.

**The payment flow has no legal scaffolding.** No terms of service link. No cancellation policy. No refund policy (even though the system has refund logic in the backend). No HIPAA notice even though this involves clinical placements. No privacy policy. A legitimate institution would never ask for payment without these.

**The amount comes from nowhere.** The email says "Amount due: $X." How was this calculated? Is it tuition? A placement fee? An application fee? Is it refundable? What does it cover? No breakdown, no explanation.

### Why Would I NOT Complete Payment?

**I just clicked "accept" and now you want my credit card.** There was no intermediate step. No "here's what you're paying for" summary. No "you can still cancel within 24 hours." The transition from decision to payment is jarring and pressured in a way that feels predatory rather than premium.

**I don't know what happens after I pay.** The ENROLLED state exists in the state machine, but there's no description of what enrollment means. When do I start? Where do I go? Who contacts me? What documents do I need? The post-payment experience is a black hole.

**My card was declined and I don't know why.** The payment failure email template exists but the UI state `PAYMENT_FAILED` has no associated guidance. "Your payment failed" is not actionable. Was it my bank? Was the card expired? Is there a hold? Should I try a different card? Should I call someone?

**I'm on my phone and the experience is broken.** No evidence of mobile-optimized payment forms. Stripe Elements can work on mobile, but only if the container page is responsive. Nothing in this system ensures that.

### Where Would I Abandon?

**At the auth wall.** I clicked the link in the email. I'm being asked to log in. Into what? I don't remember creating a MissionMed account. I don't have my password. There's no "magic link" option. I close the tab.

**At the accept button.** The offer shows me a price but nothing else. No program photos. No testimonials. No "what's included." No FAQ. I'm not ready to commit. I close the tab and think "I'll come back later." I never do.

**At the payment timeout.** I accepted, went to grab my wallet, got distracted. When I come back, the offer has expired. There is no notification that this was about to happen. There is no way to re-activate it without coordinator intervention.

### What Feels Fake / Templated?

**Everything.** The email template is 5 lines of text with no design. The heading "USCE Offer Ready" sounds like a system notification. The portal URL as plaintext (not a styled CTA button) looks like it was generated by a script. The `amount_formatted` field with no context looks like a billing line item. The expiration date with no urgency framing looks like a utility bill due date.

**Compare this to what the Arena system looks like.** The Arena has Fortnite-grade lobby design, avatar staging with glow effects, responsive breakpoints to the pixel, audio systems, progression modules. The USCE portal has `<h2>USCE Offer Ready</h2>` in Arial. The quality gap is so extreme that a student who has experienced the Arena will not believe the USCE email came from the same organization.

### What Feels Like a Scam Risk?

**Asking for payment through a tokenized URL with no institutional verification is the number one red flag.** Banks train customers to never enter card details on pages they reached via email links. This system requires exactly that. Even if the system is perfectly secure (and the crypto implementation is solid), the UX pattern itself triggers fraud alerts in users' minds.

**The lack of a recognizable domain.** If the portal lives at something like `api.missionmedinstitute.com/usce/portal/abc123`, that's marginally better than a random domain, but still not great. The student needs to see the MissionMed brand, logo, and institutional identity the moment the page loads, before any content appears.

---

## 3. VISUAL DESIGN AUDIT

### Why This Looks Like SaaS

**Color system:** The email uses `#0f2a44` (dark navy) as the sole color. No accent colors. No gradients. No brand palette. Navy + white + Arial = every B2B SaaS invoice ever made.

**Typography:** Arial is the default system font. It communicates "I didn't choose a font." Premium brands use intentional typography. The Arena uses custom treatments. The USCE system uses the font that ships with Windows 95.

**Spacing:** The email template has zero explicit spacing control. Default browser margins on `<h2>`, `<p>`, `<strong>`. No design tokens. No rhythm. No intentional whitespace.

**Hierarchy:** The email has one level of hierarchy: heading, then body text. No visual weight system. No information architecture. The subject line, program name, amount, expiration, and CTA all have roughly equal visual weight.

**Motion:** None. Zero. No transitions, no loading states, no micro-interactions. The Arena has glow effects, pulse animations, rotating rings, and backdrop blur. The USCE portal has static HTML.

**Emotional tone:** Clinical. Bureaucratic. Transactional. This should feel like receiving an exclusive invitation. Instead it feels like receiving a parking ticket.

### The SaaS Problem, Specifically

SaaS design is optimized for efficiency and information density. It assumes the user is already committed (they're paying monthly) and just needs to complete tasks. USCE is the opposite: the student is not yet committed. They are evaluating. They are deciding. The design must persuade, build trust, and create emotional momentum. SaaS design does none of these things.

---

## 4. UX FLOW BREAKDOWN

### Current Flow Map

```
REQUEST                  OFFER                    PORTAL                   PAYMENT              CONFIRMATION
                                                                           
Student submits    ->    Coordinator creates  ->  Student receives    ->  Student clicks   ->  Student sees
clinical request         offer in admin            email with link         accept               payment form
                         |                         |                       |                    |
                         v                         v                       v                    v
                    Offer approved           Auth chain fires        Binary ACCEPT/       Stripe charges
                    Offer sent               (WP->Railway->Supa)    DECLINE only          card
                                             |                       |                    |
                                             v                       v                    v
                                        Portal loads             Payment intent        Confirmation
                                        (if auth succeeds)      created (STUB)        + enrollment
```

### Friction Points Identified

| Step | Friction | Severity |
|------|----------|----------|
| Email received | No brand recognition, looks like spam | CRITICAL |
| Click portal link | Auth chain must complete (3 hops) | HIGH |
| Auth failure | Cryptic error messages, no recovery | CRITICAL |
| View offer | No program details, no trust signals | HIGH |
| Accept decision | Binary choice, no intermediate states | MEDIUM |
| Accept to payment | No confirmation screen, immediate payment | HIGH |
| Payment execution | Stub payment intents, not implemented | CRITICAL |
| Payment failure | No guidance, 2 retry limit, no warning | HIGH |
| Post-payment | No onboarding, no next steps, black hole | HIGH |
| Expiration | Silent timeout, no countdown, no warning | MEDIUM |

### Unnecessary Steps

**The three-hop auth chain is unnecessary for offer viewing.** The portal token itself is a 32-byte cryptographic secret. It is sufficient to authenticate the request for read-only access. Requiring a full Supabase session to VIEW an offer adds friction with no security benefit. Write operations (accept/decline/pay) should require full auth. Read should not.

**The separate respond endpoint is unnecessary.** Accept and pay should be a single atomic flow, not separate API calls. The current design creates a gap between "I clicked accept" and "I completed payment" where the system is in limbo.

### Confusion Moments

**"USCE" is never defined for the student.** The system uses the acronym everywhere. Students see "USCE Offer Ready." What is USCE? If they don't already know, they won't find out from the email or portal.

**The offer `html_body` and `text_body` are coordinator-authored freeform content.** This means every offer looks different. There is no standardized offer layout. One coordinator might write a paragraph. Another might paste a spreadsheet. The student experience is completely inconsistent.

**Multiple offers for the same request.** The system supports up to 3 offers per request, with sibling invalidation. But the student receives separate emails for each. They have no way to compare offers side-by-side. They don't know other offers exist. If they accept one and another gets invalidated, they receive no notification explaining why.

### Cognitive Overload

The portal dumps all offer data in a single API response: amount, status, HTML body, text body, payment intent details, retry counts, failure timestamps, expiration dates, creation dates. There is no progressive disclosure. A well-designed portal would show the student only what they need at each stage and reveal additional information contextually.

---

## 5. CONVERSION INTELLIGENCE

### Where Urgency Is Missing

**The expiration date is stated but not felt.** "Offer expires: April 30, 2026" is information. A countdown timer, a color change as deadline approaches, a reminder notification at 24h and 4h before expiration: that is urgency. The current system has the SLA cron to send reminders, but the portal itself has no temporal pressure.

**No limited-seat visibility.** The backend tracks seats (total, soft hold, hard hold, filled). This data is never exposed to the student. "Only 3 seats remaining" is one of the most powerful conversion drivers in education and travel. The system has the data. It doesn't use it.

### Where Scarcity Is Missing

**Programs have finite seats but students don't know.** The `usce_program_seats` table tracks exact availability. The offer response includes none of this. The student has no idea whether they're one of 50 applicants or one of 3.

**No waitlist signal.** If all seats are held but not yet paid, the system could show "seats filling fast" or "you're next in line." Instead: silence.

### Where Trust Proof Is Missing

**Zero social proof anywhere in the flow.** No testimonials from past participants. No completion statistics. No hospital partner logos. No faculty endorsements. No "X students placed this year." The Arena has avatar systems and progression modules. The USCE portal has nothing that says "other real humans have done this and it was good."

**No institutional authority markers.** No accreditation badges. No medical education association affiliations. No physical address. No phone number. No "about us" link. For a product that costs thousands of dollars and involves medical training, this is disqualifying.

**No coordinator identity.** The offer is sent by "the system." The student doesn't know who created their offer, who reviewed their request, or who they can contact with questions. Adding a coordinator name, photo, and title would dramatically increase trust.

### Where Emotional Momentum Breaks

**The offer email is transactional, not aspirational.** The student just took a step toward a clinical experience in the United States. This should feel like an achievement. Instead, the email communicates "you have a bill to pay." The emotional framing is completely wrong.

**Accept is a dead end emotionally.** After accepting, the student enters a payment form. No congratulations. No "great choice, here's what's coming." No preview of their upcoming experience. The emotional reward for making a big decision is: enter your credit card number.

**Post-payment silence.** After paying, the student enters ACCEPTED_PROCESSING or ENROLLED with no ceremony. No welcome message. No "what happens next" guide. No community access. The Arena has lobby systems, squad formations, progression displays. The USCE enrollment has a database status change.

---

## 6. REBUILD PLAN

### Exact UX Changes

**1. Split the portal into distinct screens, not one JSON blob.**
- Screen 1: OFFER VIEW (program details, trust signals, offer terms)
- Screen 2: DECISION (accept with confirmation, or decline with optional reason)
- Screen 3: PAYMENT (Stripe Elements with full order summary)
- Screen 4: CONFIRMATION (welcome, next steps, timeline)
- Screen 5: ERROR/RECOVERY (human-readable, with clear actions)

**2. Allow offer viewing without full auth.**
- Portal token alone grants read-only access to the offer
- Full Supabase session required only for accept/decline/pay
- Add a "Log in to respond" CTA that initiates auth only when needed
- Implement magic link auth as a fallback for students who forgot credentials

**3. Redesign the offer email as a branded invitation.**
- MissionMed logo header
- Program photo or hospital image
- Coordinator name and photo
- Clear CTA button (not raw URL)
- Summary: program, dates, location
- Amount as part of a structured breakdown
- Mobile-responsive HTML email template
- Preheader text for inbox preview

**4. Add a confirmation screen between accept and payment.**
- Show: what you're accepting (program name, dates, location)
- Show: what you're paying (amount, breakdown, what's included)
- Show: cancellation/refund policy
- Show: terms of service checkbox
- Then: proceed to payment

**5. Implement real Stripe payment, not stubs.**
- Replace `pi_stub_` with actual Stripe Payment Intent creation
- Use Stripe Elements for PCI-compliant card collection
- Add Apple Pay and Google Pay for mobile
- Show real-time payment status with loading states

**6. Build a post-payment onboarding flow.**
- Immediate: confirmation screen with "what happens next"
- Email: welcome email with timeline, documents needed, contact info
- Portal: transform the offer view into an enrollment dashboard
- Show: countdown to program start, preparation checklist, coordinator contact

**7. Add progressive urgency signals.**
- Seat availability counter on offer view
- Countdown timer when offer expiration is within 72 hours
- Color/tone shift in portal as deadline approaches
- Reminder emails at 72h, 24h, and 4h before expiration

**8. Humanize error states.**
- Replace all error code messages with student-friendly language
- PAYMENT_FAILED: "Your payment didn't go through. Here's what to try." + specific guidance
- RETRY_EXHAUSTED: "We couldn't process your payment. Contact [coordinator name] at [email] for help."
- EXPIRED: "This offer has expired. Contact us to request a new one." + direct action
- AUTH failures: "We're having trouble verifying your identity. Try [specific steps]."

### Exact UI Direction

See Section 7 (Design Direction) below.

### Interaction Improvements

- Add skeleton loading states during auth chain resolution
- Add micro-animations on state transitions (offer viewed, accepted, paid)
- Add haptic feedback on mobile for key actions
- Add confetti or celebration animation on successful enrollment
- Add real-time seat counter updates via Supabase realtime subscriptions

### Layout Restructuring

- Move from single-endpoint JSON dump to multi-screen progressive flow
- Each screen has one primary action and one secondary action (max)
- Information density decreases as commitment increases (more whitespace on payment screen)
- Mobile-first layout with desktop enhancement, not the reverse

### Simplification Opportunities

- Eliminate the three-hop auth for offer viewing (token-only read access)
- Merge accept + payment into a single flow (accept is implied by paying)
- Remove the PENDING_PAYMENT intermediate state visible to students (internal only)
- Collapse REMINDED into SENT for student-facing display (they don't need to know they were reminded)
- Hide all internal timestamps from the student view (responded_at, failed_at, paid_at are admin data)

---

## 7. DESIGN DIRECTION

### Aesthetic Direction

**The MissionMed USCE portal should feel like a premium admissions experience, not software.**

Reference class: Think Masterclass enrollment flow meets Apple checkout. Clean, spacious, confident. Every element earns its space. No clutter. No generic icons. No stock photography. Real program imagery or none at all.

The Arena already established MissionMed's visual DNA: dark backgrounds, cyan/gold accents, glow effects, glass-morphism, progressive disclosure. The USCE portal should share this DNA but apply it to a formal, high-trust context. The Arena is the game. The USCE portal is the deal room.

### Inspiration References

| Reference | What to Take |
|-----------|-------------|
| Masterclass.com enrollment | Premium feel, aspirational imagery, clean CTAs |
| Apple Checkout | Minimal fields, progressive disclosure, trust through simplicity |
| Stripe Checkout | Payment form UX, loading states, error handling |
| Superhuman onboarding | Step-by-step flow, one thing at a time, celebration moments |
| Notion's pricing page | Clean comparison, clear value communication |
| Arena (MissionMed's own) | Dark palette, cyan/gold, glass panels, glow accents |

### UI Patterns to Adopt

- **Glass-morphism panels** on dark backgrounds (consistent with Arena DNA)
- **Single-action screens** (one primary CTA per view, never competing buttons)
- **Progressive disclosure** (show only what's needed at each step)
- **Trust badges** (accreditation, security, payment processor logos)
- **Countdown elements** (for time-sensitive offers)
- **Coordinator cards** (photo, name, title, contact for human connection)
- **Step indicators** (1 of 4, 2 of 4, etc. for multi-screen flows)
- **Skeleton screens** (during loading, never empty/blank states)
- **Celebration moments** (after payment, after enrollment)
- **Status pills** (color-coded, with plain-language labels)

### UI Patterns to Eliminate

- Raw URLs in emails or UI (always use styled buttons)
- Database column names in the frontend (always use human labels)
- Binary choices without context (always provide information before asking for decisions)
- Silent state changes (always notify the user of what happened and why)
- Unbranded screens (every screen must have the MissionMed mark)
- Developer error messages (every error must be human-readable with a clear next action)
- Freeform coordinator content without layout constraints (standardize offer presentation)
- Bare payment forms without order summaries (always show what they're paying for)

### Color System

```
Primary Background:    #0A0F1A (deep space, from Arena DNA)
Card Surface:          rgba(255, 255, 255, 0.05) with backdrop-blur
Primary Text:          #F0F4F8 (off-white, not pure white)
Secondary Text:        #8B9DB7 (muted blue-gray)
Primary Accent:        #00D4FF (cyan, from Arena)
Secondary Accent:      #FFB800 (gold, from Arena)
Success:               #00E676 (bright green)
Warning:               #FF9100 (amber)
Error:                 #FF5252 (red)
CTA Button:            linear-gradient(135deg, #00D4FF, #0088CC)
CTA Button Hover:      linear-gradient(135deg, #33DDFF, #00AAEE)
Trust Badge BG:        rgba(0, 212, 255, 0.08)
```

### Typography

```
Headings:    Inter or equivalent geometric sans (NOT Arial)
Body:        Inter or System UI stack
Mono:        JetBrains Mono (for amounts, codes)
Scale:       Hero: 48/56 | H1: 32/40 | H2: 24/32 | H3: 20/28 | Body: 16/24 | Small: 14/20 | Caption: 12/16
Weight:      700 for headings, 500 for emphasis, 400 for body
```

---

## 8. WIREFRAME-LEVEL RECOMMENDATIONS

### Portal Screen (Offer View)

```
+------------------------------------------------------------------+
|  [MM Logo]                                    [? Help] [Profile] |
+------------------------------------------------------------------+
|                                                                  |
|  STEP 1 OF 3: REVIEW YOUR OFFER                                 |
|  ─────────────── ○ ─────────────── ○ ───────────────             |
|                                                                  |
|  ┌──────────────────────────────────────────────────────────┐    |
|  │                                                          │    |
|  │  [Program Hero Image / Hospital Photo]                   │    |
|  │                                                          │    |
|  │  INTERNAL MEDICINE ROTATION                              │    |
|  │  Mount Sinai Health System, New York                     │    |
|  │                                                          │    |
|  │  12-week program  •  Starting July 2026                  │    |
|  │                                                          │    |
|  │  ┌────────────────────────────────────────────┐          │    |
|  │  │  Your Coordinator                          │          │    |
|  │  │  [Photo] Dr. Sarah Chen                    │          │    |
|  │  │          Clinical Placement Director       │          │    |
|  │  │          sarah.chen@missionmed.com         │          │    |
|  │  └────────────────────────────────────────────┘          │    |
|  │                                                          │    |
|  │  OFFER DETAILS                                           │    |
|  │  ──────────────────────────────────────                  │    |
|  │  [Formatted offer content from coordinator]              │    |
|  │  [Standardized layout, not freeform HTML dump]           │    |
|  │                                                          │    |
|  │  INVESTMENT                                              │    |
|  │  ──────────────────────────────────────                  │    |
|  │  Program Fee ........................... $X,XXX          │    |
|  │  [What's included: supervision, housing info, etc.]      │    |
|  │                                                          │    |
|  │  ⏱ Offer expires in 6 days, 14 hours                    │    |
|  │  🔒 Only 3 seats remaining                              │    |
|  │                                                          │    |
|  └──────────────────────────────────────────────────────────┘    |
|                                                                  |
|  ┌─────────────────────┐  ┌──────────────────────────────────┐   |
|  │   I Need More Time  │  │   ★ ACCEPT & CONTINUE TO PAY    │   |
|  │   (secondary)       │  │   (primary CTA, gradient)        │   |
|  └─────────────────────┘  └──────────────────────────────────┘   |
|                                                                  |
|  ┌──────────────────────────────────────────────────────────┐    |
|  │  ★★★★★ "MissionMed placed me at NYU Langone.             │    |
|  │  The process was seamless." - Dr. A. Patel, 2025 cohort  │    |
|  └──────────────────────────────────────────────────────────┘    |
|                                                                  |
|  [Accreditation badges] [Secure payment badge] [HIPAA badge]     |
|                                                                  |
+------------------------------------------------------------------+
```

**Key elements:**
- Step indicator (1 of 3) sets expectations
- Program hero image creates emotional connection
- Coordinator card builds human trust
- Structured offer content (not freeform HTML dump)
- Price breakdown with "what's included"
- Countdown timer for urgency
- Seat counter for scarcity
- Testimonial for social proof
- Trust badges for credibility
- Two CTAs: primary (accept) and secondary (need more time, not decline)
- "Need More Time" allows the student to snooze without declining

### Payment Screen

```
+------------------------------------------------------------------+
|  [MM Logo]                                    [? Help] [Back]    |
+------------------------------------------------------------------+
|                                                                  |
|  STEP 2 OF 3: COMPLETE PAYMENT                                  |
|  ──────────── ● ─────────────── ○ ───────────────                |
|                                                                  |
|  ┌──────────────────────┐  ┌─────────────────────────────────┐   |
|  │                      │  │                                 │   |
|  │  ORDER SUMMARY       │  │  PAYMENT                        │   |
|  │                      │  │                                 │   |
|  │  Internal Medicine   │  │  ┌─────────────────────────┐   │   |
|  │  Mount Sinai, NY     │  │  │  Card Number            │   │   |
|  │  July 2026           │  │  │  ________________________│   │   |
|  │                      │  │  └─────────────────────────┘   │   |
|  │  Program Fee  $X,XXX │  │                                 │   |
|  │  ─────────────────── │  │  ┌────────────┐ ┌──────────┐   │   |
|  │  Total        $X,XXX │  │  │  MM / YY   │ │  CVC     │   │   |
|  │                      │  │  └────────────┘ └──────────┘   │   |
|  │  ┌────────────────┐  │  │                                 │   |
|  │  │ Refund Policy  │  │  │  [Apple Pay] [Google Pay]       │   |
|  │  │ > Full refund  │  │  │                                 │   |
|  │  │   within 48h   │  │  │  ┌─────────────────────────┐   │   |
|  │  └────────────────┘  │  │  │  ★ PAY $X,XXX NOW       │   │   |
|  │                      │  │  └─────────────────────────┘   │   |
|  │  □ I agree to the    │  │                                 │   |
|  │    Terms of Service  │  │  🔒 Secured by Stripe           │   |
|  │    and Refund Policy │  │  Your card details are never    │   |
|  │                      │  │  stored on our servers.         │   |
|  └──────────────────────┘  └─────────────────────────────────┘   |
|                                                                  |
+------------------------------------------------------------------+
```

**Key elements:**
- Step indicator (2 of 3) shows progress
- Left: order summary with program details (not just an amount)
- Right: Stripe Elements card form
- Apple Pay / Google Pay for one-tap mobile payment
- Refund policy visible before payment (trust)
- Terms of service checkbox (legal compliance)
- Security badge and Stripe branding (payment trust)
- Back button allows return to offer view
- CTA shows exact amount ("Pay $4,500 Now" not just "Pay")

### Confirmation Screen

```
+------------------------------------------------------------------+
|  [MM Logo]                                    [? Help] [Profile] |
+------------------------------------------------------------------+
|                                                                  |
|  STEP 3 OF 3: YOU'RE ENROLLED                                   |
|  ──────────── ● ─────────────── ● ──────────── ●                |
|                                                                  |
|                    ✓                                             |
|              [celebration animation]                             |
|                                                                  |
|         Welcome to your clinical experience.                     |
|                                                                  |
|  ┌──────────────────────────────────────────────────────────┐    |
|  │                                                          │    |
|  │  INTERNAL MEDICINE ROTATION                              │    |
|  │  Mount Sinai Health System, New York                     │    |
|  │  Starting: July 6, 2026                                  │    |
|  │                                                          │    |
|  │  Confirmation #: USCE-2026-0847                          │    |
|  │  Payment: $X,XXX (receipt emailed)                       │    |
|  │                                                          │    |
|  └──────────────────────────────────────────────────────────┘    |
|                                                                  |
|  WHAT HAPPENS NEXT                                               |
|  ──────────────────                                              |
|                                                                  |
|  ┌──────┐  Within 24 hours                                      |
|  │  1   │  You'll receive a welcome email with your              |
|  └──────┘  enrollment packet and required documents.             |
|                                                                  |
|  ┌──────┐  Within 1 week                                        |
|  │  2   │  Your coordinator Dr. Chen will schedule               |
|  └──────┘  an orientation call.                                  |
|                                                                  |
|  ┌──────┐  2 weeks before start                                 |
|  │  3   │  You'll receive site access credentials                |
|  └──────┘  and reporting instructions.                           |
|                                                                  |
|  ┌──────────────────────────────────────────────────────────┐    |
|  │  Questions? Contact Dr. Sarah Chen                        │    |
|  │  sarah.chen@missionmed.com | (555) 123-4567              │    |
|  └──────────────────────────────────────────────────────────┘    |
|                                                                  |
|  [Download Confirmation PDF]  [Return to Dashboard]              |
|                                                                  |
+------------------------------------------------------------------+
```

**Key elements:**
- Step indicator complete (3 of 3, all green)
- Celebration animation (confetti, checkmark, etc.)
- Warm congratulatory language (not transactional)
- Clear confirmation number
- "What happens next" timeline (eliminates post-payment anxiety)
- Coordinator contact information (human connection)
- Download PDF option (for records)
- Dashboard link (ongoing relationship, not dead end)

---

## 9. QUICK WINS (5 Changes, Immediate High ROI)

### 1. Redesign the Offer Email (1-2 hours)
Replace the 27-line plaintext email with a branded, responsive HTML template. Add: MissionMed logo, program name as headline, coordinator name, styled CTA button (not raw URL), mobile-responsive layout. This is the single highest-impact change because it determines whether students even enter the funnel.

### 2. Allow Token-Only Read Access to Offers (2-3 hours)
Modify the portal GET endpoint to accept the portal token alone for read-only access, bypassing the full auth chain. Keep auth required for respond/pay. This eliminates the biggest drop-off point (auth wall on first visit) and lets students see their offer immediately.

### 3. Replace Error Messages with Student-Friendly Copy (1 hour)
Create a `student-error-messages.ts` mapping that translates every error code into plain language with a specific next action. Wire this into the portal API responses. Example: `AUTH_SESSION_EXPIRED` becomes "Your session timed out. Click here to log in again."

### 4. Add Seat Count to Portal Response (30 minutes)
The offer GET endpoint already queries the offer. Add a join to `usce_program_seats` and include `seats_remaining` (calculated as `seats_total - seats_filled - seats_held_hard`) in the response. The frontend can then display "X seats remaining" as a scarcity signal.

### 5. Add Countdown Timer Data to Portal Response (30 minutes)
Include `expires_in_seconds` in the portal GET response (computed from `portal_token_expires_at - now()`). The frontend can render a live countdown. Also add an `urgency_level` field: `'normal'` (>72h), `'approaching'` (24-72h), `'urgent'` (<24h), `'critical'` (<4h).

---

## 10. STRATEGIC UPGRADE PATH

### Next 24 Hours

1. **Redesign the offer email template** using the wireframe above. Brand it. Make it mobile-responsive. Replace the raw URL with a styled CTA button. This is the funnel entry point and it's currently broken.

2. **Add seat count and countdown data to the portal API response.** Two small changes that give the future frontend critical conversion data.

3. **Create the student-friendly error message mapping.** One file. Map every error code to human language. Ship it.

4. **Decide on the frontend framework.** Is the portal a Next.js page in this app? A separate SPA? A WordPress-rendered page that calls the API? This decision blocks everything else. Recommendation: Next.js pages in this app, under `/app/usce/portal/[token]/page.tsx`, using the existing API routes as server actions or client-side fetches.

### Next 7 Days

5. **Build the portal frontend.** Four screens: offer view, payment, confirmation, error/recovery. Use the wireframes above. Apply the design system from Section 7. Mobile-first.

6. **Implement real Stripe integration.** Replace `pi_stub_` with actual Payment Intent creation. Wire up Stripe Elements on the payment screen. Test with Stripe test mode.

7. **Add magic link auth as a fallback.** For students who can't complete the WordPress-Railway-Supabase chain (mobile, Safari, ad blockers), offer a magic link sent to their email that creates a Supabase session directly.

8. **Standardize offer content layout.** Create a structured template for coordinator-authored offer content instead of freeform HTML. Define required fields: program description, dates, location, what's included, requirements. Render consistently regardless of coordinator input.

9. **Build the post-payment onboarding email.** The welcome-enrollment template exists but needs the same branded treatment as the offer email. Include the "what happens next" timeline.

### Next 30 Days

10. **Add social proof system.** Collect testimonials from past participants. Build a testimonial component that displays on the offer view. Rotate testimonials based on program type.

11. **Build the enrollment dashboard.** After payment, the portal should transform into an ongoing relationship tool. Show: program countdown, preparation checklist, document upload, coordinator messaging, orientation scheduling.

12. **Implement real-time seat updates.** Use Supabase Realtime to push seat count changes to the portal. When a seat is claimed while a student is viewing, update the counter live.

13. **Add offer comparison.** For students with multiple offers, build a comparison view showing programs side-by-side. Currently, sibling offers are invisible to students.

14. **Analytics instrumentation.** Add event tracking at every step: email opened, portal viewed, offer viewed duration, accept clicked, payment started, payment completed, payment failed. Without analytics, you can't measure whether any of these changes work.

15. **A/B test the email.** Once the new template is built, run the old vs. new on a subset to quantify the impact on click-through rate.

---

## CRITICAL FAILURES

1. **No student-facing frontend exists.** The portal is API-only. There is no page students can see.
2. **Stripe integration is stubbed.** Payment intents are fake. Students cannot actually pay.
3. **The offer email looks like a phishing attempt.** No branding, no trust signals, raw URLs.
4. **Auth chain has no fallback.** If any hop fails, students are permanently locked out with cryptic errors.
5. **Post-payment experience is empty.** Students pay thousands of dollars and receive nothing visible in return.
6. **Error messages are developer-facing.** Students will see Supabase and Railway internals.
7. **No mobile optimization.** Zero responsive design evidence in the USCE flow.

## HIGH IMPACT FIXES

1. Build the portal frontend (4 screens)
2. Implement real Stripe payment
3. Redesign the offer email
4. Add token-only read access
5. Add seat counts and countdown timers
6. Replace all error messages with student-friendly copy
7. Build post-payment onboarding flow

## DESIGN DIRECTION

MissionMed USCE should feel like a premium admissions experience built on Arena DNA. Dark backgrounds, cyan/gold accents, glass-morphism panels, intentional typography (Inter, not Arial), single-action screens, progressive disclosure. Reference class: Masterclass enrollment meets Apple Checkout meets the MissionMed Arena aesthetic. Never SaaS. Never corporate. Never templated.

## NEXT ACTION

Build the portal frontend. Start with `/app/usce/portal/[token]/page.tsx`. Apply the offer view wireframe. Wire it to the existing API. Ship a branded, mobile-responsive, trust-building offer experience that is worthy of a $4,000+ clinical placement decision.

---

**END OF AUDIT**

**Prompt ID:** (W)-USCE-UX-UI-AUDIT-REDTEAM
**Auditor:** Senior Product Design + UX Architecture + Conversion Strategy + Red Team
**Verdict:** The backend is strong. The frontend doesn't exist. The email is a liability. Fix the student experience or the engineering investment is wasted.
