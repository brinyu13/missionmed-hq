# Browser QA and screenshots

Authenticated Founder/admin live QA was performed through `https://missionmedinstitute.com/rise/`.

Verified URLs:

- Baylor: `https://missionmedinstitute.com/rise/?qa=5012k-leadership-final#/program/rise_ps_9409dcff-5112-5e90-a07e-d3f97a1a1a3b/overview`
- UTMB: `https://missionmedinstitute.com/rise/?qa=5012k-utmb-final#/program/rise_ps_a09d3b95-13e0-524c-8c8c-cc3df2f39ac9/overview`

Captured live views showed the applicant-first filter drawer; Baylor's proportional At-a-Glance layout and hierarchy; UTMB's PD and proportional layout; and UTMB's full-width 29-row resident experience with searchable/filterable controls. Images were emitted inline in the originating Codex task. The agent-controlled browser did not expose a durable local screenshot export, so this handoff records exact URLs and observed states rather than claiming nonexistent image files.

Final cache-busted acceptance used `https://missionmedinstitute.com/rise/?qa=5012k-live-final-v2`. A fresh load showed the intentional `Preparing your program intelligence` skeleton and then the complete 6,139-program view without the prior blank-page flash. Additional captured live views verified:

- the full-width all-program result layout and counts (IMG evidence 3,514; visa published 4,470);
- AdventHealth Florida Neurology long evidence constrained to compact, ellipsized result cells rather than vertical text towers;
- Baylor Residents showing published resident totals and a researched-but-unavailable composition estimate with `Unknown is not zero`, never a false zero;
- UTMB Application Fit performing applicant-fit work distinct from At a Glance and explicitly withholding personalization when the profile is incomplete;
- separate Step 2 minimum, Step 2 timing, COMLEX Level 2 minimum, DO-friendly and IMG-friendly controls before collapsed `Advanced / Research Coverage`;
- a 390 x 844 mobile viewport with responsive reflow and no visible clipping/overlap;
- Admin Command Center access with global/student research disabled and the emergency kill switch active;
- zero browser console warnings or errors after the final authenticated navigation sequence.

The authenticated control showed admin tools and 6,139 programs. No independent 360 test identity was available in this run; that acceptance is recorded as not independently verified rather than inferred from the admin's student-view mode.
