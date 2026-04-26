# MEGA PROMPT: E3 STAT PH5 SEQUENTIAL EXECUTION
# Copy everything below this line as a single prompt.

---

PROMPT NAME: (E3)-STAT-PH5-CLAUDE-HIGH-002 through 005
THREAD NAME: (E3) - E3 Stat Analytics + Rollout

Load PRIMER_CORE.md
SESSION_PRIMER_V2 is DEPRECATED. DO NOT USE.
AUTHORITY: MR-0004

Execute the following 4 tasks IN ORDER. Each task gets its own verification cycle, execution report, activity log entry, and learning entry. Do not begin Task N+1 until Task N is COMPLETE. If any task results in FAILED or triggers a STOP condition, halt the entire sequence and report.

---

## TASK 1 OF 4: FULL INTEGRATION + DUAL-WRITE + EDGE CASE TEST SUITE

TASK TYPE: AUDIT
RISK LEVEL: HIGH

Load STAT_CANON_SPEC.md

Begin your response with:
RESULT: COMPLETE / FAILED / PARTIAL
SUMMARY: [1-2 lines]

Run all tests.

DUAL-WRITE TEST RULES:
- Correct-count comparison: exact equality required.
- Match outcome comparison: exact equality required.
- Score comparison: numeric tolerance required (declare tolerance and compute delta); "directionally consistent" is not allowed.

REPLAY DETERMINISM RULE:
- Use recursive canonical JSON serialization before SHA-256.
- Output hash1/hash2/hash3 explicitly.

RATE-LIMIT RULE:
- Derive abuse simulation from configured bucket/refill parameters.
- Output expected throttle threshold math and observed throttle evidence.

CLEANUP (STRICT):
- Delete only fixture rows tied to explicit test identifiers.
- Report table-wise before/after counts.

Output table:
TEST | STATUS | EVIDENCE | NOTES

If any test fails: STOP and list root cause + fix.
End with NEXT ACTION block.

---

## TASK 2 OF 4: GO/NO-GO DEPLOYMENT GATE

TASK TYPE: AUDIT
RISK LEVEL: HIGH

Begin your response with:
RESULT: COMPLETE / FAILED / PARTIAL
SUMMARY: [1-2 lines]

All checks must pass with evidence.

GATE CHECK 8: Infrastructure
[ ] Schema: 3 tables + 6 constraints + 9 indexes + RLS
[ ] RPCs: 8 deployed and tested:
    - start_study_session
    - end_study_session
    - log_question_presented
    - log_question_answered
    - complete_match
    - get_match_state
    - duel_replay_payload
    - check_ghost_eligibility
[ ] Analytics: 3 views + 3 job specs
[ ] Outbox operational with diagnostics

Output:
CHECK | STATUS | EVIDENCE

Decision:
- ALL PASS => DEPLOYMENT GATE: GO
- ANY FAIL => DEPLOYMENT GATE: NO-GO

No override.
End with NEXT ACTION block.

---

## TASK 3 OF 4: R2/CDN DEPLOYMENT

TASK TYPE: DEPLOY
RISK LEVEL: HIGH

DEPENDENCY: Task 2 must result in DEPLOYMENT GATE: GO. If Task 2 = NO-GO, skip this task and STOP the sequence.

Begin your response with:
RESULT: COMPLETE / FAILED / PARTIAL
SUMMARY: [1-2 lines]

PREREQUISITES:
- Task 2 result = DEPLOYMENT GATE: GO
- Required explicit values present:
  R2_BUCKET
  R2_OBJECT_PATH (exact key)
  CDN_URL

If any missing => RESULT: FAILED and STOP.

STEP 1: Verify canonical rollback backup exists (stat_latest.html.pre-e3-canonical-backup).
STEP 2: Upload stat_latest.html to R2_BUCKET/R2_OBJECT_PATH.
STEP 3: Purge CDN for CDN_URL.
STEP 4: Verify live file content markers and checksum.
STEP 5: Verify WordPress wrapper loads CDN_URL and auth bridge headers.

ROLLBACK:
- Restore canonical backup artifact (stat_latest.html.pre-e3-canonical-backup)
- Re-upload to same R2 object path
- Purge CDN
- Re-verify live markers/checksum

Report:
ACTION | STATUS | EVIDENCE

End with NEXT ACTION block.

---

## TASK 4 OF 4: FIRST LIVE SESSION PROTOCOL

TASK TYPE: AUDIT
RISK LEVEL: HIGH

DEPENDENCY: Task 3 must be COMPLETE. If Task 3 = FAILED, skip this task and STOP the sequence.

Begin your response with:
RESULT: COMPLETE / FAILED / PARTIAL
SUMMARY: [1-2 lines]

Play ONE complete live bot duel through the deployed system. Monitor every step.

MONITOR 1: Page Load
- Open stat_latest.html via WordPress wrapper
- Console: NO errors on load
- Console: outbox ready message appears
- Network: exchange returns 200
- Network: bootstrap returns 200
- Auth: supabase.auth.setSession() succeeds
- Auth: supabase.auth.getUser() returns valid user
PASS/FAIL

MONITOR 2: Match Start
- Create bot duel
- get_duel_pack succeeds
- Content hash verification passes (no DUEL_PACK_HASH_MISMATCH)
- Questions render correctly (no visual changes from pre-E3)
PASS/FAIL

MONITOR 3: Gameplay
- Answer all questions
- For each question: check console for H4 (presented enqueued) and H5 (answered enqueued)
- Verify: no console errors during gameplay
- Verify: no UI freezing or lag (telemetry is non-blocking)
PASS/FAIL

MONITOR 4: Match Completion
- submit_attempt fires and succeeds (existing path)
- Results screen displays correctly
- Check outbox: getDiagnostics().queueLength should be 0 or draining
PASS/FAIL

MONITOR 5: Telemetry Verification
- Query Supabase: SELECT COUNT(*) FROM question_attempts WHERE match_id = [this match]
- Expected: row count equals number of questions in the match
- Query: SELECT * FROM match_attempts WHERE match_id = [this match]
- Expected: 1 row with result_state = 'completed' and score_normalized > 0
PASS/FAIL

MONITOR 6: Dual-Write Check
- Compare submit_attempt result (existing path) with match_attempts scores (new path)
- Correct counts must match
- If mismatch: STOP. ROLLBACK IMMEDIATELY.
PASS/FAIL

MONITOR 7: Replay Check
- Call duel_replay_payload for this match
- Verify: returns ordered question list with correct selected_index values
- Verify: deterministic (call twice, compare)
PASS/FAIL

MONITOR 8: Error Scan
- Check browser console: ZERO unhandled errors
- Check Supabase logs: ZERO RPC failures for this match
- Check outbox: getDiagnostics() shows no errors, no degraded state
PASS/FAIL

ALL 8 MONITORS PASS: Output "E3 STAT SYSTEM: OPERATIONAL"
ANY MONITOR FAILS: Output "E3 STAT SYSTEM: ROLLBACK REQUIRED" with exact failure

ROLLBACK (if needed):
1. cp stat_latest.html.pre-e3-canonical-backup stat_latest.html
2. Upload to R2
3. Purge CDN cache
4. Verify rollback live
5. Database changes remain (additive, safe)

UNHEALTHY SIGNS (trigger immediate rollback):
- Console errors during gameplay
- Questions not rendering
- submit_attempt failing
- UI visual changes
- Game freezing or hanging
- Dual-write count mismatch

End with NEXT ACTION block.
