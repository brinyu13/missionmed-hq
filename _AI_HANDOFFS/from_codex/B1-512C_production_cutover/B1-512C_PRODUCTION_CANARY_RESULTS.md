# B1-512C Production Canary Results

## Verified live checks

| Scope | Result | Evidence |
|---|---|---|
| Anonymous StoryForge session | PASS | `GET /storyforge/api/session` returned `401 auth_required`. |
| Bad direct API origin | PASS | StoryForge API returned `403 origin_not_allowed`; no permissive origin header was returned. |
| Eligible Student #1 | PASS | Existing authenticated student session loaded canonical `/storyforge/`, Home, Library, Story Detail, search, categories, intended uses, priority, Learning Lesson, voice control, and original-audio replay. |
| B1-512 Settings | PASS | Student session showed Standard/Large/Extra Large controls; text preview/cancel restored saved state. Deep Tide environment preview visibly changed the selected environment and Cancel restored Aurora. Reduced-motion status remained safe. |
| Interview Prep | PASS | No Interview Prep navigation item appeared in the signed-in student navigation; database configuration is `false`. |
| Private story media | PASS | No photo/video media control appeared in the signed-in student workspace; production force-off remains `1`; database contains zero media rows and zero unresolved deletion intents. |
| Controlled submission/reversal | PASS | A pre-existing synthetic voice-note draft submitted to Awaiting review and was immediately returned to Private; reviewer access was removed. No meaningful student story was changed. |
| Original audio replay | PASS | The controlled draft's existing original audio advanced to completion with no browser errors. |
| Browser console | PASS | No browser warnings or errors were recorded during the signed student smoke. |

## Role-session boundary

The available authenticated Chrome session for this cutover was the existing eligible student. No founder/admin, second eligible-student, or authenticated ineligible browser session was available in that session, and no account, role, identity, password, or entitlement was created or altered to manufacture one. Those role-specific interactive canaries are therefore **not claimed as rerun in B1-512C**.

This is not a source or authorization regression claim: B1-512 did not modify authentication, entitlement, WordPress roles, Matrix routing, or existing StoryForge identity mapping. The previously sealed B1-511A evidence remains the current Founder Administrator View and mentor-note authority evidence. A later session-based role-matrix smoke should use actual authenticated accounts before relying on this receipt as a replacement for a Founder UI review.

## No regressions observed

- Live canonical index/app/auth/styles hashes matched the immutable B1-512 release.
- Railway `/healthz` returned HTTP 200 with `{"ok":true,"service":"storyforge-v5"}`.
- The route remained same-origin WordPress gateway delivery; protected anonymous access stayed denied.
- Student audio replay and existing voice capture UI remained present. No new provider call or private story-media upload was made.
