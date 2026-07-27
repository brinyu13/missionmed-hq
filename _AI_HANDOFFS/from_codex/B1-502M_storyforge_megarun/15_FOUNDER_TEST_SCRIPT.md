# B1-502M Founder Test Script

Production URL:
`https://missionmedinstitute.com/storyforge/`

Initial cohort:
exact founder account `B1-502M-FOUNDER-01` only.

Do not use an incognito window for the founder acceptance pass; use the
authenticated MissionMed Matrix browser session requested by the Supervisor.

1. Sign into MissionMed normally.
2. Open the Matrix member dashboard.
3. Select StoryForge from the approved Matrix location.
4. Confirm the browser opens
   `https://missionmedinstitute.com/storyforge/` without a second login.
5. Confirm the dark StoryForge V5 Home view appears promptly and does not remain
   on “Opening your story workspace.”
6. Confirm the founder is presented as a student workflow, not an application
   administrator or mentor.
7. Open Quick Capture, enter nonpatient test text, and save one private story.
8. Refresh the story deep link and confirm it remains private and editable.
9. Confirm submission for mentor review is unavailable and truthfully explains
   that no mentor is assigned.
10. Open Story Library, Interview Prep, Notifications, and Settings.
11. In Settings, select a different background, reload, and confirm the
    server-owned choice persists.
12. Confirm Back to Matrix is visible and works.
13. Return to StoryForge through Matrix and confirm no second login.
14. Log out of WordPress/Matrix and confirm StoryForge no longer opens.

Do not enter patient-identifying information, real student information, or
production credentials during this founder test.

Supervisor-only negative checks, not founder actions:

- a second administrator is denied;
- a nonallowlisted student is denied;
- mentors/advisors/coaches are denied;
- direct unauthenticated access is denied;
- expired, revoked, malformed, and mismatched tokens are denied;
- private story direct-ID access by another identity is denied;
- zero demo records and zero mentor assignments are present;
- bundles, logs, responses, and browser storage contain no secret.
