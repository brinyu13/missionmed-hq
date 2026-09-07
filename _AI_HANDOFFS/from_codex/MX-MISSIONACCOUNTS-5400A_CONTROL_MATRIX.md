# MissionAccounts 5400A — Functional control matrix

Status as of 2026-09-07T00:57:43.313120+00:00. This resumes the interrupted audit; it does not convert visible HTML or old test results into E2E PASS.

98 normalized variants cover all **2,265 visible control occurrences in 27 preserved DOM captures**. The separately recovered Home CTA adds one action case. **35/99 (35%)** have actual action/result evidence, including failures. This is an explicit lower bound over the captured surface, not full-app coverage. **0/6 core mutable workflows** completed API → database → reload → audit → role visibility → undo proof. Source-only controls below have no numeric interaction credit.

Normalization replaces student route identifiers and repeated record indices, keeps distinct cycles and disabled states, distinguishes disclosure labels and previous/next arrows, and counts repeated rows as occurrences. Private names, contact values, IDs and screenshots are excluded. The machine-readable inventory is `missionaccounts/evidence/MX-MISSIONACCOUNTS-5400A-CONT/control-inventory.sanitized.json` in the containment branch.

## Four broken actions

| Control | Expected | Actual | Recovered live JS error | Route | Severity | Repair location |
| --- | --- | --- | --- | --- | --- | --- |
| Start with the questions | Open June attention queue | Home remains after hash change | TypeError: Cannot read properties of undefined (reading 'label') | #/cycle/june#attention | P1 | index.production.html:1346,1410,1483; secondary hash becomes cycle key |
| Billing: Details | Open rule details in All cycles | Billing remains after hash change | TypeError: Cannot read properties of undefined (reading 'name') | #/billing?cycle=all#rule | P1 | index.production.html:1346,1750; anchor becomes part of cycle query |
| Data controls | Show source reconciliation controls | Previous Advanced view remains | TypeError: Cannot read properties of undefined (reading 'toLocaleString') | #/advanced/controls | P1 | index.production.html:1960–1961; canonical adapter controls shape is incomplete |
| Classes | Show canonical classes and source links | Previous Advanced view remains | TypeError: Cannot read properties of null (reading 'mid') | #/advanced/sessions | P1 | index.production.html:1959; adapter sets review_meeting=null |


Each has **no backend mutation**: a hash navigation throws before `main.innerHTML` is replaced. Recovered live click/error timestamps are 2026-09-06 22:30–22:43 UTC. The current direct Railway HTML and runtime assets match the committed source, so the errors remain relevant; a new Matrix reproduction is blocked by the deliberate route shutdown. Do not label the stale prior screen as successful navigation.

## Disabled controls: nine observed core families

| Family | Effective prerequisite | Acceptance effect |
| --- | --- | --- |
| Edit / correct record | student_contacts + attendance_corrections + billing_decisions all false | Record dialog cannot open |
| Confirm proposed per-day amount | billing_decisions=false | No approval/invoice readiness |
| UCC · no charge | billing_decisions=false | Separate no-charge treatment cannot be saved |
| MUL · no charge | billing_decisions=false | Separate no-charge treatment cannot be saved |
| More options | billing_decisions=false | Alternate billing decision cannot open |
| Enter exam plan | exam_plans=false | No exam workflow |
| Change comp | comp_days=false | No comp override |
| Save contact | student_contacts=false | Inputs accept typing but cannot save |
| Confirm full-cycle capped amount | billing_decisions=false | Historical ceiling case cannot be approved |


These total **41 observed occurrences**, across repeated students/cycles. They are incorrectly disabled relative to required Founder product behavior, although the application is accurately enforcing its current flags. Correct repair requires implementation/acceptance readiness; it is not permission to enable flags. Identity review is a **sixth disabled core workflow**, evidenced by `identity_review=false` and source gating, but is not added to the nine observed-control count because the live identity sheet was not captured.

Intentional disables: empty student cycles, cycle boundaries, Founder historical-rule controls locked read-only, admin attempts to change a student's payment authorization, and automatic Live billing. These have separate reasons and are excluded from the nine. Batch/group confirmation, undo decision and clear policy have an additional explicit source implementation lock; that is an engineering gap, not merely an environment flag.

## Captured inventory

OBSERVED means the indicated interaction was exercised, not persisted. INVENTORIED means its presence is established but its action is not proved. Every row inherits current Matrix availability **BLOCKED / 503**. No row has a persistence PASS.

| ID | Control | Occurrences | Evidence capture | Verdict | Effect / limit |
| --- | --- | --- | --- | --- | --- |
| C001 | Skip to content | 27 | 03-students, 04-filter-payment, 05-filter-email, 06-filter-decision, 07-search-name, 08-student-detail, 09-student-august, 10-missed-classes, 11-source-details, 12-exams, 13-billing, 14-billing-details, 15-billing-all, 16-rule-comparison, 17-original-view, 18-billing-july, 19-billing-august, 20-billing-current, 21-reports, 22-advanced-records, 23-admin-health, 24-data-controls, 25-working-history, 26-combined-names, 27-kept-separate, 28-classes, 29-june-high-attendance | INVENTORIED / NOT VERIFIED | Visible; individual activation, persistence or cross-role behavior not proved |
| C002 | Mission Residency | 27 | 03-students, 04-filter-payment, 05-filter-email, 06-filter-decision, 07-search-name, 08-student-detail, 09-student-august, 10-missed-classes, 11-source-details, 12-exams, 13-billing, 14-billing-details, 15-billing-all, 16-rule-comparison, 17-original-view, 18-billing-july, 19-billing-august, 20-billing-current, 21-reports, 22-advanced-records, 23-admin-health, 24-data-controls, 25-working-history, 26-combined-names, 27-kept-separate, 28-classes, 29-june-high-attendance | INVENTORIED / NOT VERIFIED | Visible; individual activation, persistence or cross-role behavior not proved |
| C003 | MissionAccounts | 27 | 03-students, 04-filter-payment, 05-filter-email, 06-filter-decision, 07-search-name, 08-student-detail, 09-student-august, 10-missed-classes, 11-source-details, 12-exams, 13-billing, 14-billing-details, 15-billing-all, 16-rule-comparison, 17-original-view, 18-billing-july, 19-billing-august, 20-billing-current, 21-reports, 22-advanced-records, 23-admin-health, 24-data-controls, 25-working-history, 26-combined-names, 27-kept-separate, 28-classes, 29-june-high-attendance | INVENTORIED / NOT VERIFIED | Visible; individual activation, persistence or cross-role behavior not proved |
| C004 | Find a student | 27 | 03-students, 04-filter-payment, 05-filter-email, 06-filter-decision, 07-search-name, 08-student-detail, 09-student-august, 10-missed-classes, 11-source-details, 12-exams, 13-billing, 14-billing-details, 15-billing-all, 16-rule-comparison, 17-original-view, 18-billing-july, 19-billing-august, 20-billing-current, 21-reports, 22-advanced-records, 23-admin-health, 24-data-controls, 25-working-history, 26-combined-names, 27-kept-separate, 28-classes, 29-june-high-attendance | OBSERVED interaction | Action/result evidence only; no persisted mutation PASS |
| C005 | Daylight theme | 27 | 03-students, 04-filter-payment, 05-filter-email, 06-filter-decision, 07-search-name, 08-student-detail, 09-student-august, 10-missed-classes, 11-source-details, 12-exams, 13-billing, 14-billing-details, 15-billing-all, 16-rule-comparison, 17-original-view, 18-billing-july, 19-billing-august, 20-billing-current, 21-reports, 22-advanced-records, 23-admin-health, 24-data-controls, 25-working-history, 26-combined-names, 27-kept-separate, 28-classes, 29-june-high-attendance | INVENTORIED / NOT VERIFIED | Visible; individual activation, persistence or cross-role behavior not proved |
| C006 | Dark theme | 27 | 03-students, 04-filter-payment, 05-filter-email, 06-filter-decision, 07-search-name, 08-student-detail, 09-student-august, 10-missed-classes, 11-source-details, 12-exams, 13-billing, 14-billing-details, 15-billing-all, 16-rule-comparison, 17-original-view, 18-billing-july, 19-billing-august, 20-billing-current, 21-reports, 22-advanced-records, 23-admin-health, 24-data-controls, 25-working-history, 26-combined-names, 27-kept-separate, 28-classes, 29-june-high-attendance | INVENTORIED / NOT VERIFIED | Visible; individual activation, persistence or cross-role behavior not proved |
| C007 | System theme | 27 | 03-students, 04-filter-payment, 05-filter-email, 06-filter-decision, 07-search-name, 08-student-detail, 09-student-august, 10-missed-classes, 11-source-details, 12-exams, 13-billing, 14-billing-details, 15-billing-all, 16-rule-comparison, 17-original-view, 18-billing-july, 19-billing-august, 20-billing-current, 21-reports, 22-advanced-records, 23-admin-health, 24-data-controls, 25-working-history, 26-combined-names, 27-kept-separate, 28-classes, 29-june-high-attendance | INVENTORIED / NOT VERIFIED | Visible; individual activation, persistence or cross-role behavior not proved |
| C008 | J Dr J | 27 | 03-students, 04-filter-payment, 05-filter-email, 06-filter-decision, 07-search-name, 08-student-detail, 09-student-august, 10-missed-classes, 11-source-details, 12-exams, 13-billing, 14-billing-details, 15-billing-all, 16-rule-comparison, 17-original-view, 18-billing-july, 19-billing-august, 20-billing-current, 21-reports, 22-advanced-records, 23-admin-health, 24-data-controls, 25-working-history, 26-combined-names, 27-kept-separate, 28-classes, 29-june-high-attendance | INVENTORIED / NOT VERIFIED | Visible; individual activation, persistence or cross-role behavior not proved |
| C009 | S Student | 27 | 03-students, 04-filter-payment, 05-filter-email, 06-filter-decision, 07-search-name, 08-student-detail, 09-student-august, 10-missed-classes, 11-source-details, 12-exams, 13-billing, 14-billing-details, 15-billing-all, 16-rule-comparison, 17-original-view, 18-billing-july, 19-billing-august, 20-billing-current, 21-reports, 22-advanced-records, 23-admin-health, 24-data-controls, 25-working-history, 26-combined-names, 27-kept-separate, 28-classes, 29-june-high-attendance | INVENTORIED / NOT VERIFIED | Admin presentation lens; cannot establish a real authenticated student journey |
| C010 | Home | 27 | 03-students, 04-filter-payment, 05-filter-email, 06-filter-decision, 07-search-name, 08-student-detail, 09-student-august, 10-missed-classes, 11-source-details, 12-exams, 13-billing, 14-billing-details, 15-billing-all, 16-rule-comparison, 17-original-view, 18-billing-july, 19-billing-august, 20-billing-current, 21-reports, 22-advanced-records, 23-admin-health, 24-data-controls, 25-working-history, 26-combined-names, 27-kept-separate, 28-classes, 29-june-high-attendance | INVENTORIED / NOT VERIFIED | Visible; individual activation, persistence or cross-role behavior not proved |
| C011 | STUDENTS | 27 | 03-students, 04-filter-payment, 05-filter-email, 06-filter-decision, 07-search-name, 08-student-detail, 09-student-august, 10-missed-classes, 11-source-details, 12-exams, 13-billing, 14-billing-details, 15-billing-all, 16-rule-comparison, 17-original-view, 18-billing-july, 19-billing-august, 20-billing-current, 21-reports, 22-advanced-records, 23-admin-health, 24-data-controls, 25-working-history, 26-combined-names, 27-kept-separate, 28-classes, 29-june-high-attendance | OBSERVED interaction | Action/result evidence only; no persisted mutation PASS |
| C012 | EXAM DATES | 27 | 03-students, 04-filter-payment, 05-filter-email, 06-filter-decision, 07-search-name, 08-student-detail, 09-student-august, 10-missed-classes, 11-source-details, 12-exams, 13-billing, 14-billing-details, 15-billing-all, 16-rule-comparison, 17-original-view, 18-billing-july, 19-billing-august, 20-billing-current, 21-reports, 22-advanced-records, 23-admin-health, 24-data-controls, 25-working-history, 26-combined-names, 27-kept-separate, 28-classes, 29-june-high-attendance | OBSERVED interaction | Action/result evidence only; no persisted mutation PASS |
| C013 | BILLING | 27 | 03-students, 04-filter-payment, 05-filter-email, 06-filter-decision, 07-search-name, 08-student-detail, 09-student-august, 10-missed-classes, 11-source-details, 12-exams, 13-billing, 14-billing-details, 15-billing-all, 16-rule-comparison, 17-original-view, 18-billing-july, 19-billing-august, 20-billing-current, 21-reports, 22-advanced-records, 23-admin-health, 24-data-controls, 25-working-history, 26-combined-names, 27-kept-separate, 28-classes, 29-june-high-attendance | OBSERVED interaction | Action/result evidence only; no persisted mutation PASS |
| C014 | REPORTS | 27 | 03-students, 04-filter-payment, 05-filter-email, 06-filter-decision, 07-search-name, 08-student-detail, 09-student-august, 10-missed-classes, 11-source-details, 12-exams, 13-billing, 14-billing-details, 15-billing-all, 16-rule-comparison, 17-original-view, 18-billing-july, 19-billing-august, 20-billing-current, 21-reports, 22-advanced-records, 23-admin-health, 24-data-controls, 25-working-history, 26-combined-names, 27-kept-separate, 28-classes, 29-june-high-attendance | OBSERVED interaction | Action/result evidence only; no persisted mutation PASS |
| C015 | ADVANCED TOOLS › | 27 | 03-students, 04-filter-payment, 05-filter-email, 06-filter-decision, 07-search-name, 08-student-detail, 09-student-august, 10-missed-classes, 11-source-details, 12-exams, 13-billing, 14-billing-details, 15-billing-all, 16-rule-comparison, 17-original-view, 18-billing-july, 19-billing-august, 20-billing-current, 21-reports, 22-advanced-records, 23-admin-health, 24-data-controls, 25-working-history, 26-combined-names, 27-kept-separate, 28-classes, 29-june-high-attendance | OBSERVED interaction | Action/result evidence only; no persisted mutation PASS |
| C016 | Find a student (directory) | 5 | 03-students, 04-filter-payment, 05-filter-email, 06-filter-decision, 07-search-name | OBSERVED interaction | Action/result evidence only; no persisted mutation PASS |
| C017 | Only people without an email | 5 | 03-students, 04-filter-payment, 05-filter-email, 06-filter-decision, 07-search-name | OBSERVED interaction | Action/result evidence only; no persisted mutation PASS |
| C018 | Only people needing a decision | 5 | 03-students, 04-filter-payment, 05-filter-email, 06-filter-decision, 07-search-name | OBSERVED interaction | Action/result evidence only; no persisted mutation PASS |
| C019 | Only people missing payment setup | 5 | 03-students, 04-filter-payment, 05-filter-email, 06-filter-decision, 07-search-name | OBSERVED interaction | Action/result evidence only; no persisted mutation PASS |
| C020 | Student record | 1012 | 03-students, 04-filter-payment, 05-filter-email, 06-filter-decision, 07-search-name | OBSERVED interaction | Action/result evidence only; no persisted mutation PASS |
| C021 | Similar names | 284 | 03-students, 04-filter-payment, 06-filter-decision, 23-admin-health, 24-data-controls | INVENTORIED / NOT VERIFIED | Visible; individual activation, persistence or cross-role behavior not proved |
| C022 | ← STUDENTS | 1 | 08-student-detail | INVENTORIED / NOT VERIFIED | Visible; individual activation, persistence or cross-role behavior not proved |
| C023 | June | 4 | 08-student-detail, 09-student-august, 10-missed-classes, 11-source-details | INTENTIONALLY DISABLED | No classes in this cycle |
| C024 | July | 5 | 08-student-detail, 09-student-august, 10-missed-classes, 11-source-details, 29-june-high-attendance | INVENTORIED / NOT VERIFIED | Visible; individual activation, persistence or cross-role behavior not proved |
| C025 | August | 5 | 08-student-detail, 09-student-august, 10-missed-classes, 11-source-details, 29-june-high-attendance | OBSERVED interaction | Action/result evidence only; no persisted mutation PASS |
| C026 | Current | 5 | 08-student-detail, 09-student-august, 10-missed-classes, 11-source-details, 29-june-high-attendance | INTENTIONALLY DISABLED | No classes yet |
| C027 | ✎ Edit / correct record | 1 | 08-student-detail | INCORRECTLY DISABLED / acceptance blocker | No submit possible; persistence and audit NOT VERIFIED |
| C028 | Confirm [amount] PER DAY | 1 | 08-student-detail | INCORRECTLY DISABLED / acceptance blocker | No submit possible; persistence and audit NOT VERIFIED |
| C029 | UCC · no charge | 1 | 08-student-detail | INCORRECTLY DISABLED / acceptance blocker | No submit possible; persistence and audit NOT VERIFIED |
| C030 | MUL · no charge | 1 | 08-student-detail | INCORRECTLY DISABLED / acceptance blocker | No submit possible; persistence and audit NOT VERIFIED |
| C031 | More options… | 1 | 08-student-detail | INCORRECTLY DISABLED / acceptance blocker | No submit possible; persistence and audit NOT VERIFIED |
| C032 | Enter exam plan | 5 | 08-student-detail, 09-student-august, 10-missed-classes, 11-source-details, 29-june-high-attendance | INCORRECTLY DISABLED / acceptance blocker | No submit possible; persistence and audit NOT VERIFIED |
| C033 | Show missed classes in the list | 5 | 08-student-detail, 09-student-august, 10-missed-classes, 11-source-details, 29-june-high-attendance | OBSERVED interaction | Action/result evidence only; no persisted mutation PASS |
| C034 | Source | 50 | 08-student-detail, 09-student-august, 10-missed-classes, 11-source-details, 29-june-high-attendance | INVENTORIED / NOT VERIFIED | Visible; individual activation, persistence or cross-role behavior not proved |
| C035 | Change | 5 | 08-student-detail, 09-student-august, 10-missed-classes, 11-source-details, 29-june-high-attendance | INCORRECTLY DISABLED / acceptance blocker | No submit possible; persistence and audit NOT VERIFIED |
| C036 | Email | 5 | 08-student-detail, 09-student-august, 10-missed-classes, 11-source-details, 29-june-high-attendance | INVENTORIED / NOT VERIFIED | Input enabled while Save contact is disabled; misleading editable affordance; submit NOT VERIFIED |
| C037 | Phone | 5 | 08-student-detail, 09-student-august, 10-missed-classes, 11-source-details, 29-june-high-attendance | INVENTORIED / NOT VERIFIED | Input enabled while Save contact is disabled; misleading editable affordance; submit NOT VERIFIED |
| C038 | Save contact | 5 | 08-student-detail, 09-student-august, 10-missed-classes, 11-source-details, 29-june-high-attendance | INCORRECTLY DISABLED / acceptance blocker | No submit possible; persistence and audit NOT VERIFIED |
| C039 | Add payment method | 5 | 08-student-detail, 09-student-august, 10-missed-classes, 11-source-details, 29-june-high-attendance | INTENTIONALLY DISABLED | Only the signed-in student may change payment setup or authorization. |
| C040 | Review billing authorization | 5 | 08-student-detail, 09-student-august, 10-missed-classes, 11-source-details, 29-june-high-attendance | INTENTIONALLY DISABLED | Only the signed-in student may change payment setup or authorization. |
| C041 | Recorded names & source details | 5 | 08-student-detail, 09-student-august, 10-missed-classes, 11-source-details, 29-june-high-attendance | OBSERVED interaction | Action/result evidence only; no persisted mutation PASS |
| C042 | ← AUGUST CYCLE | 3 | 09-student-august, 10-missed-classes, 11-source-details | INVENTORIED / NOT VERIFIED | Visible; individual activation, persistence or cross-role behavior not proved |
| C043 | ✎ Edit / correct record | 3 | 09-student-august, 10-missed-classes, 11-source-details | INCORRECTLY DISABLED / acceptance blocker | No submit possible; persistence and audit NOT VERIFIED |
| C044 | Confirm [amount] PER DAY | 3 | 09-student-august, 10-missed-classes, 11-source-details | INCORRECTLY DISABLED / acceptance blocker | No submit possible; persistence and audit NOT VERIFIED |
| C045 | UCC · no charge | 3 | 09-student-august, 10-missed-classes, 11-source-details | INCORRECTLY DISABLED / acceptance blocker | No submit possible; persistence and audit NOT VERIFIED |
| C046 | MUL · no charge | 3 | 09-student-august, 10-missed-classes, 11-source-details | INCORRECTLY DISABLED / acceptance blocker | No submit possible; persistence and audit NOT VERIFIED |
| C047 | More options… | 3 | 09-student-august, 10-missed-classes, 11-source-details | INCORRECTLY DISABLED / acceptance blocker | No submit possible; persistence and audit NOT VERIFIED |
| C048 | ← HOME | 1 | 12-exams | INVENTORIED / NOT VERIFIED | Visible; individual activation, persistence or cross-role behavior not proved |
| C049 | Previous cycle | 2 | 13-billing, 14-billing-details | INTENTIONALLY DISABLED | Previous/next cycle boundary has no destination. |
| C050 | June 2026 ▾ | 2 | 13-billing, 14-billing-details | OBSERVED interaction | Action/result evidence only; no persisted mutation PASS |
| C051 | Cycle selector: june | 10 | 13-billing, 14-billing-details, 15-billing-all, 16-rule-comparison, 17-original-view, 18-billing-july, 19-billing-august, 20-billing-current | INVENTORIED / NOT VERIFIED | Visible; individual activation, persistence or cross-role behavior not proved |
| C052 | Cycle selector: july | 11 | 13-billing, 14-billing-details, 15-billing-all, 16-rule-comparison, 17-original-view, 18-billing-july, 19-billing-august, 20-billing-current | OBSERVED interaction | Action/result evidence only; no persisted mutation PASS |
| C053 | Cycle selector: august | 11 | 13-billing, 14-billing-details, 15-billing-all, 16-rule-comparison, 17-original-view, 18-billing-july, 19-billing-august, 20-billing-current | INVENTORIED / NOT VERIFIED | Visible; individual activation, persistence or cross-role behavior not proved |
| C054 | Cycle selector: current | 11 | 13-billing, 14-billing-details, 15-billing-all, 16-rule-comparison, 17-original-view, 18-billing-july, 19-billing-august, 20-billing-current | INVENTORIED / NOT VERIFIED | Visible; individual activation, persistence or cross-role behavior not proved |
| C055 | Cycle selector: all | 8 | 13-billing, 14-billing-details, 15-billing-all, 16-rule-comparison, 17-original-view, 18-billing-july, 19-billing-august, 20-billing-current | OBSERVED interaction | Action/result evidence only; no persisted mutation PASS |
| C056 | Next cycle | 2 | 13-billing, 14-billing-details | OBSERVED interaction | Action/result evidence only; no persisted mutation PASS |
| C057 | Details | 4 | 13-billing, 14-billing-details, 18-billing-july, 19-billing-august | BROKEN | Navigation throws; prior view remains; no backend mutation |
| C058 | START WITH JUNE | 5 | 13-billing, 14-billing-details, 15-billing-all, 16-rule-comparison, 17-original-view | INVENTORIED / NOT VERIFIED | Visible; individual activation, persistence or cross-role behavior not proved |
| C059 | Previous cycle | 3 | 15-billing-all, 16-rule-comparison, 17-original-view | INVENTORIED / NOT VERIFIED | Visible; individual activation, persistence or cross-role behavior not proved |
| C060 | All cycles ▾ | 3 | 15-billing-all, 16-rule-comparison, 17-original-view | INVENTORIED / NOT VERIFIED | Visible; individual activation, persistence or cross-role behavior not proved |
| C061 | Next cycle | 3 | 15-billing-all, 16-rule-comparison, 17-original-view | INTENTIONALLY DISABLED | Previous/next cycle boundary has no destination. |
| C062 | Show the comparison — original per-class rule vs corrected per-day rule | 3 | 15-billing-all, 16-rule-comparison, 17-original-view | OBSERVED interaction | Action/result evidence only; no persisted mutation PASS |
| C063 | Applies to past cycles | 3 | 15-billing-all, 16-rule-comparison, 17-original-view | INTENTIONALLY DISABLED | The Founder rule decision is locked and read-only. |
| C064 | From the Current Cycle only | 3 | 15-billing-all, 16-rule-comparison, 17-original-view | INTENTIONALLY DISABLED | The Founder rule decision is locked and read-only. |
| C065 | Clear | 3 | 15-billing-all, 16-rule-comparison, 17-original-view | INTENTIONALLY DISABLED | The Founder rule decision is locked and read-only. |
| C066 | Corrected · per day | 3 | 15-billing-all, 16-rule-comparison, 17-original-view | OBSERVED interaction | Action/result evidence only; no persisted mutation PASS |
| C067 | Original · per class (comparison) | 3 | 15-billing-all, 16-rule-comparison, 17-original-view | OBSERVED interaction | Action/result evidence only; no persisted mutation PASS |
| C068 | Previous cycle | 1 | 18-billing-july | INVENTORIED / NOT VERIFIED | Visible; individual activation, persistence or cross-role behavior not proved |
| C069 | July 2026 ▾ | 1 | 18-billing-july | INVENTORIED / NOT VERIFIED | Visible; individual activation, persistence or cross-role behavior not proved |
| C070 | Next cycle | 1 | 18-billing-july | OBSERVED interaction | Action/result evidence only; no persisted mutation PASS |
| C071 | START WITH JULY | 1 | 18-billing-july | INVENTORIED / NOT VERIFIED | Visible; individual activation, persistence or cross-role behavior not proved |
| C072 | Previous cycle | 1 | 19-billing-august | OBSERVED interaction | Action/result evidence only; no persisted mutation PASS |
| C073 | August 2026 ▾ | 1 | 19-billing-august | INVENTORIED / NOT VERIFIED | Visible; individual activation, persistence or cross-role behavior not proved |
| C074 | Next cycle | 1 | 19-billing-august | OBSERVED interaction | Action/result evidence only; no persisted mutation PASS |
| C075 | START WITH AUGUST | 1 | 19-billing-august | INVENTORIED / NOT VERIFIED | Visible; individual activation, persistence or cross-role behavior not proved |
| C076 | Previous cycle | 1 | 20-billing-current | INVENTORIED / NOT VERIFIED | Visible; individual activation, persistence or cross-role behavior not proved |
| C077 | Current Cycle ▾ | 1 | 20-billing-current | INVENTORIED / NOT VERIFIED | Visible; individual activation, persistence or cross-role behavior not proved |
| C078 | Next cycle | 1 | 20-billing-current | OBSERVED interaction | Action/result evidence only; no persisted mutation PASS |
| C079 | All records | 7 | 22-advanced-records, 23-admin-health, 24-data-controls, 25-working-history, 26-combined-names, 27-kept-separate, 28-classes | OBSERVED interaction | Action/result evidence only; no persisted mutation PASS |
| C080 | Combined names | 7 | 22-advanced-records, 23-admin-health, 24-data-controls, 25-working-history, 26-combined-names, 27-kept-separate, 28-classes | OBSERVED interaction | Action/result evidence only; no persisted mutation PASS |
| C081 | Kept separate | 7 | 22-advanced-records, 23-admin-health, 24-data-controls, 25-working-history, 26-combined-names, 27-kept-separate, 28-classes | OBSERVED interaction | Action/result evidence only; no persisted mutation PASS |
| C082 | Classes | 7 | 22-advanced-records, 23-admin-health, 24-data-controls, 25-working-history, 26-combined-names, 27-kept-separate, 28-classes | BROKEN | Navigation throws; prior view remains; no backend mutation |
| C083 | Data controls | 7 | 22-advanced-records, 23-admin-health, 24-data-controls, 25-working-history, 26-combined-names, 27-kept-separate, 28-classes | BROKEN | Navigation throws; prior view remains; no backend mutation |
| C084 | Admin health | 7 | 22-advanced-records, 23-admin-health, 24-data-controls, 25-working-history, 26-combined-names, 27-kept-separate, 28-classes | OBSERVED interaction | Action/result evidence only; no persisted mutation PASS |
| C085 | Working history | 7 | 22-advanced-records, 23-admin-health, 24-data-controls, 25-working-history, 26-combined-names, 27-kept-separate, 28-classes | OBSERVED interaction | Action/result evidence only; no persisted mutation PASS |
| C086 | June | 1 | 22-advanced-records | INVENTORIED / NOT VERIFIED | Visible; individual activation, persistence or cross-role behavior not proved |
| C087 | July | 1 | 22-advanced-records | INVENTORIED / NOT VERIFIED | Visible; individual activation, persistence or cross-role behavior not proved |
| C088 | August | 1 | 22-advanced-records | INVENTORIED / NOT VERIFIED | Visible; individual activation, persistence or cross-role behavior not proved |
| C089 | Student record | 239 | 22-advanced-records | OBSERVED interaction | Action/result evidence only; no persisted mutation PASS |
| C090 | Adapter contract (for engineering) · ZoomAttendanceProvider | 2 | 23-admin-health, 24-data-controls | INVENTORIED / NOT VERIFIED | Visible; individual activation, persistence or cross-role behavior not proved |
| C091 | ← JUNE CYCLE | 1 | 29-june-high-attendance | INVENTORIED / NOT VERIFIED | Visible; individual activation, persistence or cross-role behavior not proved |
| C092 | June | 1 | 29-june-high-attendance | INVENTORIED / NOT VERIFIED | Visible; individual activation, persistence or cross-role behavior not proved |
| C093 | ✎ Edit / correct record | 1 | 29-june-high-attendance | INCORRECTLY DISABLED / acceptance blocker | No submit possible; persistence and audit NOT VERIFIED |
| C094 | Confirm [amount] FULL-CYCLE | 1 | 29-june-high-attendance | INCORRECTLY DISABLED / acceptance blocker | No submit possible; persistence and audit NOT VERIFIED |
| C095 | Confirm [amount] 14 × [amount] | 1 | 29-june-high-attendance | INCORRECTLY DISABLED / acceptance blocker | No submit possible; persistence and audit NOT VERIFIED |
| C096 | UCC · no charge | 1 | 29-june-high-attendance | INCORRECTLY DISABLED / acceptance blocker | No submit possible; persistence and audit NOT VERIFIED |
| C097 | MUL · no charge | 1 | 29-june-high-attendance | INCORRECTLY DISABLED / acceptance blocker | No submit possible; persistence and audit NOT VERIFIED |
| C098 | More options… | 1 | 29-june-high-attendance | INCORRECTLY DISABLED / acceptance blocker | No submit possible; persistence and audit NOT VERIFIED |


| ID | Control | Evidence | Verdict |
| --- | --- | --- | --- |
| H001 | Start with the questions | 02-primary-action-dead.png and recovered click/error | BROKEN; counted above |

## Additional source-backed / uncaptured controls

| Control family | Source | Verdict / test still required |
| --- | --- | --- |
| Home command input, GO, result rows and suggestion chips | Home screenshot + canonical command-home source | Only Matrix launcher no-match and in-app top student search were exercised; every in-app intent remains NOT VERIFIED |
| Home Open June Cycle, workflow cards, cycle cards and review shortcuts | index.production.html viewHome | Visible/source-backed; activation coverage incomplete; Home CTA failure is separately counted |
| Student-context switch / Mission Residency deep link / theme / opening skip, replay and keyboard affordances | 5300A contract §1; materialized shell | Inventoried in source or screenshots; current lifecycle and destination continuity NOT VERIFIED |
| Cycle attention rows, ready records, single/group/all confirmations, undo and clear | materialize-canon.mjs:196–217; runtime dispatch | Billing disabled; group/all/undo/clear also permanently disabled pending authoritative transactions; do not just flip flags |
| Identity same/different/unsure, canonical target, match device, no-class/device decisions, undo | materialize-canon.mjs:288–300 | identity_review=false; source-backed workflow unavailable; individual live controls not captured |
| Record dialog tabs, attendance add/remove/relabel, note/contact/billing save, report resolution and undo | materialize-canon.mjs capability rules; runtime dispatch | Blocked before dialog by core flags; NOT VERIFIED through API/DB/reload/audit |
| Exam submit/edit/withdraw; approve/another date/speak; passed/not passed/no result; follow-up/reopen | 5300A contract §§1,4; runtime exam dispatch | exam_plans=false; queue empty; full student/admin state machine NOT VERIFIED |
| Comp presets/custom, joined date, reason, prospective and optional prior-days choice; submit/cancel | 5300A contract §1.6; runtime comp dispatch | comp_days=false; Change visible but disabled; no mutation performed |
| Student attendance cycle/date/source expansion and Report a concern sheet/submit/cancel | 5300A contract; runtime report dispatch | Real student browser unavailable and attendance_corrections=false; self-only API is separate evidence |
| Student setup/add/update/remove card, accept/revoke consent, terms and hosted invoice link | materialize-canon.mjs:275; Stripe/runtime adapter | Live gate intentionally off; hosted Test invoices capability true; student payment UI appears tied to auto_billing. Do not enable auto_billing merely to expose Test setup |
| Dialogs: close/cancel/Escape/back, validation, duplicate submit, refresh mid-edit | Original audit §§16–18 | Blocked/unexercised in real roles; all remain NOT VERIFIED |
| Source contract expand, notification status, empty queue and error/retry controls | Admin health screenshot; runtime sources | Some disclosed controls inventoried; accurate provider schedule/errors and recovery remain incomplete |


This appendix prevents unvisited dialogs, genuine student surfaces, Home shortcuts and record actions from silently disappearing from scope. Their exact rendered instance count is unknown until a safe authenticated browser session and enabled test environment exist. Therefore this report does **not** claim an exhaustive whole-app click-through.

## Required persistence closure

For contacts, attendance corrections, billing decisions, identity adjudication, exams and comp: capture pre-state; submit once; inspect API/audit ID; read authoritative post-state; reload; inspect history; verify student/admin visibility; reverse if supported and verify reversal. All six are NOT VERIFIED here. Do not send invoices, consent, notifications or provider mutations during an audit-only continuation.
