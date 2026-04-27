# MMOS-ARENA-INTEL: Production UI Copy + Micro UX

**Prompt ID:** (Z)-MMOS-ARENA-INTEL-claude-high-602
**Date:** 2026-04-27
**System:** MMOS-ARENA-INTEL-01
**Risk:** LOW (CONTENT)

---

## 1. TODAY FOCUS CARD

**Title:** Today's Focus

**Subtitle:** Your highest-priority topic right now.

**Explanation text:** Based on your recent sessions, this is where 10 minutes of practice will make the biggest difference.

**Low-confidence version:**
> Topic: {topic_name}
> You've answered {n} questions here so far. A few more sessions will sharpen this recommendation.

**High-confidence version:**
> Topic: {topic_name}
> {accuracy}% accuracy across {n} questions. {trend_sentence}.
> [Practice Now]

**Trend sentence variants:**
- Improving: "Up from {prev}% last week."
- Declining: "Down from {prev}% last week."
- Stable: "Holding steady over your last {n} sessions."

**Empty state (no qualifying topic):**
> Jump into any topic to get started. Your first focus recommendation appears after 10 questions.

---

## 2. TODAY PLAN CARD

**Title:** Today's Plan

**Empty state:**
> Complete 20 questions across 2+ topics to generate your first study plan. You're at {n}/20.

**Active plan (generated, not yet started):**
> {n} items based on your last {sessions} sessions.
> Estimated time: {minutes} min.
> [Start Plan]

**In-progress plan:**
> {completed}/{total} complete.
> Next: {next_item_topic} ({next_item_type}).

**Completion message:**
> Done for today. You covered {topics_touched} topics in {minutes} minutes. Check back tomorrow for an updated plan.

---

## 3. MISSION INTEL

**Strong performance (accuracy >80%, sample 20+):**
> {topic}: {accuracy}% across {n} questions. You're solid here. Maintain with occasional review, but your time is better spent on weaker areas.

**Weak performance (accuracy <50%, sample 10+):**
> {topic}: {correct}/{total} correct ({accuracy}%). This is your biggest opportunity to improve. A focused 10-question drill here moves the needle.

**Mixed performance (some topics strong, some weak):**
> Strengths: {strong_topic_1} ({accuracy_1}%), {strong_topic_2} ({accuracy_2}%).
> Gaps: {weak_topic_1} ({accuracy_1}%), {weak_topic_2} ({accuracy_2}%).
> Your plan targets the gaps. Your strengths hold on their own.

**Stale data (last activity >7 days):**
> Last session: {date}. Your insights are from {days} days ago. A quick 5-minute drill will refresh everything.

**Low data (total answers <20):**
> {n} questions answered so far. Full insights unlock at 20. Keep going.

---

## 4. TIMER INTERFACE

**Start button:** Start Timer

**During timer (session active):**
> {minutes}:{seconds} remaining
> {topic_name} focus session

**Paused:**
> Paused at {minutes}:{seconds}

**Completion:**
> Session complete. {minutes} min on {topic_name}.
> [Log & Continue] [Done for Today]

**Break suggestion (after 25+ min continuous):**
> Good stopping point. Take a break if you need one.
> [Take 5 Min Break] [Keep Going]

**Break active:**
> Break: {minutes}:{seconds}
> Back to it when you're ready.

---

## 5. ERROR / EDGE STATES

**No data (brand new user):**
> Welcome to Arena Intel. Start a practice session to see your performance data here.
> [Start Practicing]

**Low data (1-9 answers):**
> You've answered {n} questions. Your dashboard fills in after 10. Each session adds detail.

**Stale data (snapshot >6 hours old):**
> Last updated {hours} hours ago. Your latest session data is being processed.

**System updating (pipeline running):**
> Refreshing your insights. This usually takes a few seconds.

**Failure fallback (RPC error, CDN failure, unexpected state):**
> Something went wrong loading your data. This is on our end, not yours.
> [Try Again] [Back to Arena]

**Auth expired:**
> Your session timed out. Log in again to continue.
> [Log In]

**Enrollment sync in progress:**
> Verifying your enrollment status. One moment.

**Enrollment expired (grace period over):**
> Your enrolled access ended on {date}. Your data is still here. Contact admissions to reactivate.

---

## 6. TRUST ELEMENTS

### Sample Size Display

Format: "Based on {n} questions"

Placement: Bottom-right corner of each metric panel, small text, muted color.

Variants:
- n < 5: Do not show a percentage. Show "{correct} of {n} correct" instead.
- n = 5-9: Show percentage + "(small sample)" label.
- n = 10-19: Show percentage + "Based on {n} questions."
- n >= 20: Show percentage only. No qualifier needed.

### Confidence Level

Do not use the word "confidence." Instead, communicate it through specificity and qualifiers.

- High confidence (20+ answers, consistent trend): State the metric plainly. No hedging. "72% accuracy in Pharmacology."
- Medium confidence (10-19 answers): Add the count. "68% accuracy in Cardiology (14 questions)."
- Low confidence (5-9 answers): Use tentative framing. "Early signal: 3 of 7 correct in Anatomy. Needs more data."
- Insufficient (<5 answers): Do not compute or display a metric. Show only the raw count.

### Freshness Indicator

Format: "Updated {relative_time}"

Placement: Panel footer, inline with sample size.

Variants:
- < 1 min: "Just updated"
- 1-59 min: "Updated {n} min ago"
- 1-23 hours: "Updated {n} hours ago"
- 1-6 days: "Updated {n} days ago"
- 7+ days: "Last updated {date}. Practice to refresh."

Rule: If freshness > 6 hours, display in a muted warning color (amber). If > 24 hours, append the refresh CTA.

---

## 7. TONE RULES

### How the system sounds:

- Direct. Short sentences. Active voice.
- Like a coach checking in, not a report card.
- Calm. Never urgent unless something is actually broken.
- Specific. Every statement points to a number or an action.
- Honest about uncertainty. If the data is thin, say so plainly.

### What it NEVER says:

- "Great job!" or "Amazing work!" (empty praise without context)
- "You need to improve" (vague, anxiety-inducing)
- "Our AI analyzed..." or "Our algorithm detected..." (exposes the machinery)
- "Unlock your potential" / "Take your prep to the next level" (marketing speak)
- "Don't worry" (telling someone not to worry makes them worry)
- Any sentence that could apply identically to every user
- "Comprehensive" / "Robust" / "Streamlined" / "Leverage" / "Navigate"
- Em-dashes anywhere

### What builds trust:

- Showing the math. "4 of 10 correct" is more trustworthy than "40% accuracy."
- Timestamps on everything. Users trust data more when they know when it was captured.
- Admitting limits. "We need more data here" is more credible than a guess presented as fact.
- Being actionable. Every insight should end with something the user can do right now.
- Consistency. Same format, same tone, same placement every time. Predictability builds trust.

### What breaks trust:

- Showing a metric that contradicts what the user just experienced.
- Displaying a percentage from 2 data points.
- Recommending a topic the user already mastered.
- Showing "real-time" or "live" labels on data that is hours old.
- Changing the layout or structure between visits.
- Generic text that clearly was not computed from their data.
- Motivational language that sounds like a fitness app notification.

### Sentence structure rules:

- Lead with the fact. "Pharmacology: 62% accuracy."
- Follow with context. "13 questions over 3 sessions."
- End with the action. "A 10-question drill takes about 5 minutes."
- Maximum 2 sentences per recommendation line.
- Maximum 3 recommendations visible at any time.
- No bullet points in student-facing UI. Use line breaks and spacing instead.

---

## EXECUTION REPORT

**WHAT WAS DONE:**
- Produced complete production UI copy for 7 sections of the MMOS-ARENA-INTEL HUD
- Applied constraints: no em-dashes, no AI cliche language, no generic copy, no marketing speak
- Every text variant is specific, data-driven, and actionable
- Trust elements use graduated disclosure based on sample size

**RESULT:**
Production-ready UI copy delivered. All text is implementation-ready with variable placeholders matching the data model (qstat_answers_v1 fields, student_profiles fields, intel pipeline outputs).

**STATUS:** COMPLETE

---

## NEXT ACTION

Implement these strings in the Arena HUD frontend. Start with Section 5 (error states) as these are the most likely to be encountered during initial testing and define the system's character when things go wrong.
