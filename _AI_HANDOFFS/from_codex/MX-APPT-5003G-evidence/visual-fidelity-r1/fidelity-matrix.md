# MX-APPT-5003G-R1 Visual Fidelity Matrix

Visual authority: `/Users/brianb/MissionMed_worktrees/APPOINTMENTS_FABLE_5003F_PACKAGE/OUTPUT/MX-APPT-5003F_APPOINTMENTS_V1_V2_PROTOTYPE.html` and its `OUTPUT/evidence/` R1 screenshots.

| COMPONENT | APPROVED R1 | CANDIDATE | MATCH | DIFFERENCE/CORRECTION |
|---|---|---|---|---|
| Desktop shell | 64px header, 200px left app rail, bounded content canvas | Same grid geometry and sticky shell | YES | Replaced rejected horizontal navigation with the literal rail/header model. |
| Brand and typography | Archivo body, Rajdhani labels, italic 900 editorial titles | Same font roles and hierarchy | YES | Removed generic cyan-gradient typography and restored ember editorial emphasis. |
| Navigation | Ember skewed active rail item and Book CTA | Same five routes, CTA, Matrix return, identity and count badge | YES | Desktop route controls now occupy the approved left rail; responsive mode becomes bottom navigation. |
| Home | Context eyebrow, greeting, booking question, discovery, chips, How This Works, schedule | Same order and composition over live Scheduler data | YES | Rebuilt the page around the approved R1 discovery-led composition. |
| Search closed/open/typed/prefilled | Large Book capture, ember Browse, grouped results, real eligibility | Same keyboard combobox over real catalogue and entitlement state | YES | Replaced the generic listbox; invalid/unconfigured results remain truthful and non-selectable. |
| Book Details | Details/Time/Review, program/type/provider choices, cyan selected state | Same hierarchy and action progression | YES | Shared booking selections and provider contracts are reused; no fixture-only choices were added. |
| Book Time | Choose day, then time; week nav, open counts, time groups, action bar | Same workflow and responsive week grid | YES | Classic keeps its repaired grid; StoryForge uses the approved day-first model. |
| Book Review | Grouped appointment facts, real reminders/notes, ember confirm | Same two-column review and sticky action bar | YES | Only contract-backed fields render. |
| Upcoming | Date tiles, booking status, legitimate actions | Same date-tile rows, booked badge and capability-gated actions | YES | Corrected the earlier generic flat row; Join appears only when the backend supplies a URL. |
| History | Separate completed/canceled ledger with date tiles | Same distinct history route and status composition | YES | No replay/recording behavior invented. |
| Settings | Experience ledger, time zone, signed identity, Matrix return | Same four-row settings composition and account-backed toggle | YES | Replaced the generic notice-card layout with the approved R1 settings ledger. |
| 1440 | Full rail and wide content | Verified on all seven required routes | YES | No horizontal overflow observed. |
| 1024 | Full rail with compact content | Verified Home at exact CSS width 1024 | YES | Schedule cards collapse to one column as designed. |
| 768 | Bottom navigation and readable booking grid | Verified Book Time at exact CSS width 768 | YES | Rail converts to five-item fixed bottom navigation. |
| 390 | Stacked header, bottom navigation, mobile content | Exact-width deterministic Chrome captures created for all five required states | YES | Mobile breakpoint preserves touch targets and removes desktop rail. |

Functional fidelity is deliberately separate: these visual captures use a deterministic localhost fixture. Authenticated live V2 QA remains gated until founder approval and deployment.
