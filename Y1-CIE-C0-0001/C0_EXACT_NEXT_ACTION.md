# Y1-CIE-C0-0001 Exact Next Action

## Product Continuation

Open `Y1-CIE-C1-0002` against the reviewed and pushed C0 branch. C1 may build only the governed Skill Library and priority-authoring layer on the immutable C0 contracts. Do not begin C2 Replay Studio or any AI, transcript, voice, scoring, inference, or learner-Opportunity activation in C1.

## Separate Release Integration

Before any C0 staging or production runtime claim, open a separate release-integration ticket to:

1. implement the reviewed MissionMed host-auth adapter;
2. implement the transactional PostgreSQL command/repository adapter without public/authenticated direct DML;
3. bind CIE lifecycle events to the adopted MissionMed operational audit boundary;
4. establish a separately trusted monotonic integrity anchor;
5. apply migrations only in an authorized staging target;
6. rerun cross-user, per-artifact mentor, consent, replay, deletion, rollback, and browser gates in that target;
7. obtain the normal MissionMed release approval.

These are release-integration prerequisites, not unfinished C0 product behavior.
