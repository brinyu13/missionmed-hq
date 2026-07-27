# B1-500 Stage 5 — Staging and Founder UAT Packet

**Status:** `PREPARED / NOT EXECUTED`

## Entry gates

All must be verified before staging:

- protected StoryForge source recovered in a clean, ticket-scoped worktree;
- Matrix preflight green with current origin/public hashes;
- StoryForge Supabase project ref and complete migration history pinned;
- live/staging backup and rollback point created;
- WordPress staging issuer emits a server-signed StoryForge audience and verified eligibility claim;
- mentor assignment staging source contains at least two mentors for the test student;
- private StoryForge audio bucket/policy approved and credentials installed;
- retention/deletion/export/archive founder decision recorded;
- admin private-support-access founder decision recorded;
- production path decision recorded;
- legacy data source decision recorded.

If any entry gate fails, Stage 5 result is `BLOCKED`, never green.

## Staging sequence

1. **VERIFY LIVE FIRST. BACK UP LIVE FIRST. CREATE A PROVEN ROLLBACK POINT.**
2. Record current protected manifest, source/origin/public hashes, Railway deployment, Supabase project/ref, migration table, R2 policy, and WordPress issuer version.
3. Apply the reviewed additive migration through the canonical migration protocol.
4. Deploy the API behind default-OFF StoryForge route/feature flags.
5. Mount V5 through the protected Matrix owner and reseal the lock.
6. Seed only approved question-library content if no legacy source exists.
7. Run the 29-assertion Postgres matrix against staging identities and the raw staging API.
8. Run Student, Mentor One, Mentor Two, Unassigned Mentor, Admin, and Anonymous E2E suites.
9. Run audio interruption/resume/upload/download authorization tests if storage is approved.
10. Load-scale with at least 300 stories and 100 students.
11. Run complete axe/keyboard/screen-reader and mobile passes.
12. Run backup restore and application rollback drills.
13. Freeze the staging candidate hash; any change invalidates prior receipts.

## Founder UAT script

### Student persona

- enter from the approved MissionMed path;
- verify eligibility and identity copy;
- capture a private story;
- prove mentor cannot see it;
- save, score, and submit;
- inspect exact status language;
- receive mentor feedback notification;
- open deep link, compare original/current, revise and resubmit;
- inspect final approval and history;
- create a question workshop and manual follow-up;
- inspect truthful AI/audio availability.

### Mentor persona

- inspect Home and assigned roster;
- prove no private draft appears;
- open submitted story without reviewing;
- add score, feedback, classification, follow-up, and request revision;
- use second mentor to re-review and approve;
- verify both mentor names and no silent student-field edit;
- inspect queue buckets, history, Prep, import review, Teaching Mode, and 1:1 paths.

### Admin persona

- inspect assignment and governance surfaces;
- prove private story is unreadable by direct ID;
- import questions into draft review;
- approve/retire through ratified governance;
- exercise any founder-approved support path and inspect its visible audit event—or confirm no path exists.

## UAT founder gate

Stage 5 cannot pass until the founder signs the exact frozen staging candidate after the full student and mentor walkthrough.
