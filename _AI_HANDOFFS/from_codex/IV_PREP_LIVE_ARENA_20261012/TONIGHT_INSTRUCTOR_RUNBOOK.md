# Tonight's instructor runbook — launch gate closed

**Current verdict: do not launch the requested IV Prep Arena yet.** No isolated IV Prep score session has been created or functionally proved. Do not use Reset, Select Session, scoring or lifecycle controls in the existing Dr J room to improvise an IV Prep session; its persistent state is shared.

## If implementation is unblocked and verified before class

The following is the required acceptance sequence, not a claim that these controls exist today. Final route/button names must be replaced with actual UI evidence after implementation.

1. Open Matrix as the verified instructor/admin, then the dedicated IV Prep Live Arena entry.
2. Select October 12 IV Prep class/session. Confirm date, class identity and a separate empty score ledger. Confirm this is not the Dr J room.
3. Compare roster with people visibly present in Webex. Toggle only those students to Present. Label attendance “Instructor-confirmed.” Match by verified Matrix student ID; resolve duplicate names explicitly. Leave uncertain matches unconfirmed.
4. Select a present student; read the highlighted name before scoring. Choose/type the mock question or strategy, choose points, and press the explicit Award action once.
5. Wait for Saved and the confirmed total. Reload and verify the same total before proceeding to another student. Undo must create an auditable correction.
6. Open the large leaderboard display. In Webex desktop use Share content, select that browser window, inspect the preview, then Share. Keep private roster/admin controls out of the shared window. Students can stay in Webex.
7. If a save fails or times out, pause scoring and reconnect/read back. Retry only via a verified idempotent retry control retaining the original event ID. Do not blindly submit a new award.

## Five-minute preflight after release

- Minute 1: verify instructor login, actual production route, correct class/session and attendance label.
- Minute 2: synthetic test Student A +2, reload, confirm +2.
- Minute 3: synthetic Student B +3, confirm separate totals; verify retry does not add again and a failed save stays pending/error.
- Minute 4: verify unauthorized window denied; verify test session is independent of both tonight's session and Dr J.
- Minute 5: Webex window-share preview, readable names/totals, reconnect and recovery control.

Do not put synthetic students in the real class or delete real records. Launch requires the receipt to show all eight task acceptance cases, release authority, backup/rollback and independent acceptance.

## If the gate remains closed at class time

Conduct the mock interviews in the already scheduled Webex class. Confirm attendance manually from Webex. If points are needed, record them in a private instructor-owned local sheet with one row per award: class/session, student identifier, question, points, timestamp and correction reference. Save after each round and share only a names-and-totals view. This is an operational manual fallback, not Matrix integration, not automatic Webex attendance, and not a delivered persistent Arena. Do not promise later automated import until a mapping/import path is separately verified.
