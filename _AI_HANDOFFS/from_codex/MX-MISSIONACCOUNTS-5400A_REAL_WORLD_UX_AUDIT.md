# MissionAccounts 5400A — Real-world UX audit

**Would Dr J voluntarily replace spreadsheets, Zoom reports and notes with the current product? No, on the observed evidence.** She can inspect and compare records but cannot complete the core decisions, edits, exams or comp work. This is an auditor judgment from actual preserved interactions, not a claim that Dr J personally participated. The logged-in Founder role rendered the Dr J presentation; a separate Dr J account remains unverified.

**Would a student understand what to do without contacting Dr J? Not established.** Direct student API privacy is positive, but a real student browser journey was not completed. The Matrix route is currently intentionally unavailable.

## Journey findings

| Journey | Intended work | Observed result | Verdict |
| --- | --- | --- | --- |
| Mentor A: morning command center | Matrix → MissionAccounts → next urgent item | Matrix no-match; prominent Home questions action throws | FAIL |
| Mentor B: find/understand student | Search → profile → cycle → source | Directory search and three filters work; August, missed classes and source details observed | PARTIAL: read-only useful |
| Mentor C: attendance/billing decision | Review source → correct/decide → saved outcome | Edit, Confirm/UCC/MUL/More options disabled | FAIL |
| Mentor D: batch exceptions | Process several records while preserving context | Identity false; core decisions false; batch/clear transactions explicitly locked | FAIL |
| Mentor E: exam dates | Review submitted plan → response → history | Exam section opens empty; lifecycle actions disabled | NOT VERIFIED / blocked |
| Mentor F: attendance report | Open concern → resolve → student sees outcome | Reports section opens empty; correction capability false | NOT VERIFIED / blocked |
| Mentor G: billing | Understand basis/ceiling → approve → intended invoice state | Per-day/original comparison works; Details throws; approval disabled | FAIL completion |
| Mentor H: provider confidence | Understand latest/next sync and exceptions without visiting provider | Admin health opens; duplicate classes, stale schedule and future-tense copy remain | FAIL |
| Mentor I: finish session | Know what changed, remains pending and can be undone | Working history opens, but no accepted mutation happened; history persistence cannot be proved | NOT VERIFIED |
| Student A: discover/open | Real authenticated student → Matrix launcher → own home | No real student browser; route contained; View As explicitly insufficient | NOT VERIFIED / current entry unavailable |
| Student B: attendance | Own days, same-day Steps, comp/grace and source → concern | Own-only API passes; screen and concern workflow unverified | PARTIAL API only |
| Student C: exam plan | Step/date → submit → response → outcome → history | Capability false; no student/admin round trip | NOT VERIFIED / blocked |
| Student D: payment/billing | Understand setup vs consent vs Live gate; no surprise action | Current admin/source state observed; genuine student screen and Test flow unverified | NOT VERIFIED |
| Student E: trust/privacy | No admin navigation, foreign rows or prototype controls; logout denial | Direct foreign-resource denial passes; role UI/logout/clean browser not verified | PARTIAL API only |


## Mentor scorecard — primary, twice the Student weight

| Dimension | Score / 100 | Evidence / interpretation |
| --- | --- | --- |
| Discoverability | 0 | Actual Matrix search found no app; entry now contained |
| 5-second comprehension | 45 | Clear identity and task vocabulary, but greeting/search dominate and core disables are not explained |
| Navigation | 40 | Main read-only sections open; four specific actions throw |
| Efficiency | 15 | Directory filters help; exception/decision batches cannot be completed |
| Decision workflow | 0 | Billing/identity/correction mutations disabled |
| Student understanding | 55 | Cycles, attendance and source details visible; identity subset/counts need explanation |
| Billing workflow | 10 | Comparison is useful; no approval-to-invoice workflow proved |
| Exam workflow | 0 | Empty queue and disabled plan capability |
| Provider confidence | 20 | Recent sync is visible; schedule/future copy conflict and duplicate classes undermine trust |
| Feedback/state clarity | 25 | Some honest disabled tooltips; stale screens, conflicting counts and editability |
| Error recovery | 5 | Broken routes leave prior screen without actionable recovery |
| StoryForge consistency | 65 | Recognizable donor shell; broken actions compromise behavior |
| Overall usefulness | 35 | Useful read-only inspection; cannot replace operating workflow |
| Overall delight/joy | 35 | Polished visual language; repeated dead ends interrupt use |


Equal weighting within these fourteen dimensions yields **25/100**. Scores describe the observed pre-containment product and known disabled workflows; they are provisional Founder-path review judgments, not measured timings or a human usability study. Current Matrix availability is zero because containment is intentional.

## Student scorecard

| Dimension | Actual experience score | Acceptance credit / 100 | Reason |
| --- | --- | --- | --- |
| Discoverability | NOT VERIFIED | 0 | Matrix route unavailable; no real student launch observed |
| 5-second comprehension | NOT VERIFIED | 0 | No genuine student browser session |
| Navigation | NOT VERIFIED | 0 | Role-specific rail and direct links not browser-verified |
| Attendance clarity | NOT VERIFIED | 0 | API own-record scope passes; visual day/Step/source comprehension not measured |
| Exam workflow | NOT VERIFIED | 0 | exam_plans=false; no submit/review/result journey |
| Billing/payment clarity | NOT VERIFIED | 0 | Live off; actual student Test setup/consent screen unverified |
| Privacy/trust | NOT VERIFIED | 0 | Direct student APIs isolate; Matrix contained; logout/incognito sequence unverified |
| Feedback/state clarity | NOT VERIFIED | 0 | No real-role mutation or reload proof |
| Mobile usability | NOT VERIFIED | 0 | No ~390 real-student functional run |
| Overall usefulness | NOT VERIFIED | 0 | No completed real-student task |
| Overall delight/joy | NOT VERIFIED | 0 | No actual student interaction evidence |


Student actual experience scores cannot be assigned honestly without the requested real authenticated browser. **0% demonstrated acceptance credit** records that gap and is used only for the conservative readiness summary. It is not an inference that every student screen is defective. The 2:1 Mentor/Student blend is approximately **17%** demonstrated experience readiness, not a replacement for the separate Founder FAIL verdict.

## Friction ledger

| ID | Task | Friction | Impact | Severity | Repair acceptance |
| --- | --- | --- | --- | --- | --- |
| F01 | Find the app | No direct Matrix match | Must know private route or ask for help | P1 | Registered app discoverable for each authorized role |
| F02 | Start urgent work | Prominent CTA throws | False expectation and repeated navigation | P1 | CTA opens correct attention anchor and queue |
| F03 | Save contact / correct attendance | Input or button suggests editing; save/edit disabled | Cannot complete routine update; typed text has no saved outcome | P1 | Honest editability and authoritative saved/audited result |
| F04 | Resolve billing/identity | Many records, disabled choices and batch locks | Cannot close a batch; spreadsheet remains necessary | P1 | Single and batch safe transactions with per-record outcomes |
| F05 | Understand cap | [amount] per-day confirmation competes with full-cycle ceiling | Risk of choosing wrong basis after activation | P2 | Ceiling/hold and allowable next action derive from authoritative eligibility |
| F06 | Inspect data provenance | Data controls and Classes throw | Source verification unavailable in product | P1 | Safe empty/model states and source-to-canonical explanation |
| F07 | Trust Zoom sync | Healthy/provider configured plus scheduler not registered/future copy | Requires engineering/provider interpretation | P2 | Actual last/next attempt, success, exceptions and source changes |
| F08 | Understand attendance counts | 102 confirmed vs canonical100; list254 vs identities347 | App appears inconsistent; extra review work | P1 | Source-preserving dedupe and labelled population counts |
| F09 | Recover from navigation | URL changes while content does not | User can mistake old information for requested view | P1 | Atomic route rendering and clear error recovery |
| F10 | Understand payment state | Global Safe production mode emphasizes payments, omits six core disables | User may blame Live Stripe for unrelated blocked work | P2 | Specific capability explanation; keep Test setup and Live consent/charges separate |
| F11 | Work on phone / keyboard | Current real-role workflows not exercised | Potential inaccessible task completion remains unknown | P2 | Functional width, focus, dialog and keyboard closure |


The primary issue is completion, not visual taste. The retained shell has strong identity, readable panels and a useful student directory. However, a clear-looking next action that throws, a visible Save that cannot save, and provider status requiring outside interpretation all move work back to spreadsheets and provider dashboards. Four navigation failures and nine disabled core families are directly evidenced; no unmeasured time-savings claim is made.

## Truthfulness and context

The Home estimate is distinguished from approved revenue, which is helpful. Live charging off is also correct. The same page does not plainly explain why contacts, exams, comp, corrections, identity and decisions are unavailable. The health card's “When connected” and “scheduler not registered” copy is inconsistent with the observed configured sync and the documented provider worker. The frontend should use real schedule state or say it is unavailable, never infer the schedule from a successful last run.

The `View As → Student` control is an admin presentation tool; it is not a separate identity. Real students must never inherit admin records/navigation or prototype controls. The separate actor/subject banner, real Dr J role and complete student rail remain unverified here.

URL/content divergence is a proven context failure: a thrown render leaves the previous screen under a different route. Broader back/filter/scroll retention is an outstanding test, not an established defect in every screen. Typing into a contact field while Save is disabled is a narrower proven misleading affordance.

## Responsive, persistence and edge cases

All requested workflows at **1440, 1024 and approximately 390 pixels** remain incomplete as a full current matrix: navigation, search, profile/cycle, history, decisions, exams, billing, reports, student actions, dialogs and app switching. Historical layout screenshots or source media queries are not a functional PASS. Opening timing, reduced motion, keyboard activation and dialog focus must be rechecked in the repair acceptance environment.

Observed/read-only edge cases: missing-email/payment/decision filters; an empty current cycle; empty exams/reports; alias/source disclosure; a historical high-attendance capped review case; provider duplicate classes; held identity/day aggregates. No new mutations were made to test invalid input, duplicate submit, exam pending/approved/passed, mid-edit reload, undo/reversal or provider failure. Those cases remain NOT VERIFIED. Same-day Step handling, comp/grace and historical holds have source/database evidence, but no new full real-role lifecycle proof in this audit.

No mutable workflow may receive a PASS until its action, authoritative response, post-state, reload, audit history, role propagation and safe reversal are evidenced. A passing old suite or a visible confirmation sheet is insufficient.
