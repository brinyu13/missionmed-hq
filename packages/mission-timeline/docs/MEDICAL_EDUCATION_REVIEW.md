# Medical education review boundary

`reviewMedicalEducationTimeline` is a deterministic structural reviewer, not an autonomous credential judge. It can flag:

- a blank timeline;
- USCE entries missing a site/location;
- a Step 2 CK date appearing before Step 1;
- long chronology gaps that may deserve a student/advisor question;
- potentially sensitive context marked interviewer-safe;
- unusually dense date overlap.

It never changes event text, dates, colors, visibility, or chronology. All findings are prompts for student and advisor confirmation. It does not verify credentials, give immigration or legal advice, assess match eligibility, or replace medical-education review.

Before production, a qualified MissionMed medical-education reviewer should approve the finding taxonomy, wording, false-positive posture, and escalation rules. Brian's Q3 remains controlling for the canonical template: pixel-lock preserves the 2025 sample exactly, quirks included.
