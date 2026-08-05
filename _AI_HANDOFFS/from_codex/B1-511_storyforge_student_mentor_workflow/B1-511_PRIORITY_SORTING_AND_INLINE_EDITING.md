# B1-511 Priority Sorting and Inline Editing

The existing `student_score` is the StoryForge priority value; no duplicate
priority model was created. Library rows sort stably by priority `5 -> 1`, with
unrated stories last and deterministic tie ordering.

Inline priority changes:

- are visible only to an eligible owning student;
- use the existing row version for optimistic concurrency;
- update only the affected row;
- preserve search text, focus, filters, and scroll context;
- do not change mentor/admin score.

The implementation is in `storyforge-v5/public/app.js` and the bounded database
function in the B1-511 migration. Unit and PostgreSQL tests prove ownership,
version conflicts, and the separation between student priority and reviewer
score. The focused browser run passed 2/2 and produced desktop, tablet, and
mobile evidence under `screenshots/`.
