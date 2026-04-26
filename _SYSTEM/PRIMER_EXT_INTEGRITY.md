# PRIMER EXTENSION: SYSTEM INTEGRITY CHECK

**Load this extension when risk level = HIGH.**

**Version:** 1.0 | **Date:** 2026-04-18 | **Authority:** MR-1367

**Source:** `_SYSTEM/SESSION_PRIMER_V2.md` Section 7 (System Integrity Check) extracted in full.

---

## 1. When This Extension Applies

Required when the task's deterministic risk classification resolves to HIGH. Execute ALL applicable checks below before reporting COMPLETE. If the task risk is MEDIUM or LOW, this extension is not required.

---

## 2. Frontend Checks

- Pages load without errors.
- Layout renders correctly: no broken elements, missing sections, or shifted components.
- Navigation functions correctly across all tabs / routes touched by the change.

---

## 3. Backend Checks

- `/wp-admin` is accessible and functional.
- No PHP errors and no white screens in admin or frontend.
- Database connections intact. No connection timeouts or schema mismatches.

---

## 4. Functional Checks

- Core user interactions work: forms submit, buttons fire, links resolve, payments process (if applicable).
- No regressions introduced by the change. Previously working flows still work identically.

---

## 5. Rules

- If ANY check fails, **FIX BEFORE REPORTING COMPLETE.**
- Document each check result in the execution report as **PASS / FAIL / NOT APPLICABLE.**
- If a fix introduces a new failure, re-run the full integrity check from the top.
- The task may not be marked COMPLETE until all applicable checks are PASS or N/A.

---

## 6. Reporting Format

In the execution report VERIFICATION section, record the check matrix using this shape:

```
Frontend:
  Pages load:        PASS | FAIL | N/A
  Layout renders:    PASS | FAIL | N/A
  Navigation:        PASS | FAIL | N/A

Backend:
  /wp-admin:         PASS | FAIL | N/A
  PHP errors:        PASS | FAIL | N/A
  DB connections:    PASS | FAIL | N/A

Functional:
  Core interactions: PASS | FAIL | N/A
  No regressions:    PASS | FAIL | N/A
```

Any FAIL row must be followed by the fix description and the re-run result.

---

END OF PRIMER EXTENSION: INTEGRITY
