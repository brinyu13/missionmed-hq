# B1-511 Privacy, Role, and Media Boundaries

Authority: DR-021 B1-511 StoryForge Founder-authorized bounded product enhancement
Date: 2026-08-05

## Privacy Boundary

### Story Privacy

1. **Private by default**: Every new story is private to its author upon creation. This is unchanged from DR-014.
2. **Explicit submission required**: A story becomes visible to mentors and administrators ONLY when the student explicitly submits it for review. There is no automatic, time-based, or role-based exposure.
3. **Unsubmitted story protection**: Administrators and mentors MUST NOT be able to access, list, query, or infer the existence of unsubmitted private stories. The server MUST enforce this at the RLS and API levels, not merely at the UI level.
4. **Cross-student isolation**: No student may access another student's stories, reviews, notes, or metadata. RLS policies MUST enforce row-level isolation by student identity.
5. **Submission is not irrevocable**: The submission model must define whether and how a student can retract a submission. If retraction is supported, retracted stories must return to private state with the same protections as never-submitted stories.

### Internal Notes Privacy

6. **Internal notes are hidden from students**: Mentor and administrator internal notes on a story MUST NOT be visible, queryable, or inferable by the student author. The server MUST enforce this at the RLS level.
7. **Internal notes vs. published feedback**: There must be a clear, server-enforced distinction between internal notes (mentor/admin-only) and published feedback (student-visible). A note must never accidentally become published feedback.

### Audit Trail

8. **Access logging**: All access to submitted stories by mentors and administrators should be audit-logged.
9. **Submission state changes**: Submission, retraction (if supported), and review-status changes must be audit-logged.
10. **No audit data exposure**: Audit logs must not be visible to students beyond their own submission history.

## Role Boundary

### Founder Administrator

11. **WordPress username `brinyu`**: Must resolve to the existing bounded StoryForge administrator identity through the established WordPress session and JWT exchange. No new identity provider or authentication flow.
12. **Administrator capabilities**: Server-authorized capabilities granted through the existing role-resolution mechanism. The administrator sees the same canonical product release as students, with additional server-authorized features.
13. **No alternate admin build**: There must be one canonical StoryForge release. Role-specific features are conditionally rendered based on server-authorized capabilities, not compiled into separate builds.

### Student Role

14. **Unchanged entitlement**: Existing eligible-student access and entitlement remain unchanged. B1-511 does not modify who qualifies as an eligible student.
15. **Student capabilities**: Students can create, edit, prioritize, categorize, and submit their own stories. They can view published mentor feedback on their submitted stories. They cannot access internal notes, other students' stories, or administrative functions.

### Mentor Role

16. **Submitted-story access only**: Mentors may access only stories that have been explicitly submitted for review. They may not browse, search, or query unsubmitted stories.
17. **Feedback capabilities**: Mentors can create text feedback, voice notes with transcription, and internal notes on submitted stories. Only published feedback is visible to the student.
18. **No synthetic WordPress role**: Mentor identity must be resolved through the existing authentication and role system. No synthetic WordPress role such as "360" may be introduced.

### General Denial

19. **Other administrators denied**: Every WordPress administrator other than the exact Founder account is denied StoryForge access.
20. **Anonymous/logged-out denied**: Anonymous and logged-out users are denied all StoryForge access.
21. **General population prohibited**: No general population access is authorized by B1-511.

## Media Boundary

### Mentor Voice Notes

22. **StoryForge-owned storage**: Mentor voice-note audio files are stored in StoryForge-owned, namespaced storage. They are NOT stored in shared platform media infrastructure.
23. **Namespace isolation**: Mentor audio keys MUST be namespaced separately from student-owned recording keys. The key scheme must prevent any collision or confusion between mentor and student audio.
24. **Access control**: Mentor voice notes are access-controlled:
    - The mentor who created the note can play it back.
    - Administrators can play it back.
    - Students can play back only voice notes attached to published feedback on their own submitted stories.
    - All other access is denied.
25. **Transcription**: Voice-note transcription uses the existing transcription patterns. Transcription text follows the same access-control rules as the audio.
26. **Cleanup and retention**: Existing private R2 cleanup and retention patterns may be extended narrowly for mentor voice notes. No new cleanup infrastructure.
27. **Signed URLs**: Playback uses the existing signed-URL pattern for private audio. URLs are short-lived and audience-scoped.

### Existing Student Audio

28. **Unchanged**: Existing student recording, transcription, audio replay, and R2 storage patterns remain unchanged. B1-511 does not modify student audio in any way.
29. **No key reuse**: Mentor audio must not reuse, overwrite, or conflict with student-owned recording keys.

### Shared Platform Media

30. **Out of scope**: Shared platform media architecture is explicitly out of B1-511 scope. Mentor voice notes are StoryForge-owned infrastructure, not a platform service.
