# StoryForge Donor Contract

5014A used StoryForge only as a UX/security donor pattern: an administrator chooses a student, enters a clearly marked delegated view, and receives read-only visibility except for one explicitly authorized operation.

RISE did not copy StoryForge data or mutate StoryForge. The adapted contract is narrower:

- directory membership comes from current authorized RISE/360 identity truth;
- the delegated view reads the same canonical My Programs records used by the student;
- only list priority is writable by an administrator;
- all other student choices remain disabled and server-enforced;
- the UI always labels the target student and administrator context.

