# B1-507 Access and Entitlement Receipt

Status: PASS FOR FOUNDER TEXT PILOT; BROADER 360 ACTIVATION DEFERRED.

Current WordPress settings preserve:

- one allowlisted account;
- one `student` role override;
- allowed roles exactly `student`;
- zero allowed cohorts;
- token TTL 60 seconds;
- StoryForge text route enabled on the B1-507 dormant release.

Fresh production checks:

- authenticated Founder session opened the live V5 shell;
- Home, Library, Interview Prep, Notifications, Settings, Quick Capture, and
  one question workshop opened without data mutation;
- no microphone, voice dock, recording control, or replay surface was exposed;
- unauthenticated bootstrap returned 401 `session_required`;
- unauthenticated WordPress token route returned 403 `csrf_failed`;
- direct unauthenticated API access returned 401 `auth_required`;
- authenticated Founder E1/presign/confirm attempts each returned 403
  `voice_disabled`.

The live WordPress source delegates eligibility to the shared MissionMed entitlement handoff and contains current repository logic for LearnDash course 3893, products 3575/5511, and recognized 360 tiers. A final B1-505 360-eligibility authority/representative identity receipt was not found.

This does not block the deployed dormant/default-off Founder-only text pilot.
It blocks non-Founder activation. No second account, WordPress administrator,
or enrolled-360 identity was added or tested in this bounded rung.
