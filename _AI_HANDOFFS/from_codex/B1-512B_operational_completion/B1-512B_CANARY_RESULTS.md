# B1-512B Canary Results

Status: **PARTIAL — safe live checks passed; the full role matrix cannot be truthfully claimed.**

| Scope | Result | Evidence |
| --- | --- | --- |
| Anonymous session denial | PASS | `GET /storyforge/api/session` returned HTTP 401 and `auth_required`. |
| Eligible-student launch | PASS | Existing authenticated student session opened canonical StoryForge in Student View. |
| Library, search/filter, categories, intended uses, priority | PASS | Visible in the existing Story Library without mutations. |
| Story detail and Learning Lesson | PASS | Existing private voice story opened with original/working separation and Learning Lesson. |
| Original-audio replay | PASS (mechanical) | Existing control changed Play → Pause → Resume, then returned to paused; browser console had no error/warn entries. |
| Mentor notes | OFF | No mentor-note action was activated or changed. |
| B1-512 private media | OFF / not deployed | Candidate media endpoints and force-off configuration are not live. |

Not performed or simulated: Founder, second eligible student, authenticated ineligible user, Administrator View/review workflow, new physical-microphone recording/transcription, and B1-512 private media. No story, identity, review, feature flag, or user data changed.
