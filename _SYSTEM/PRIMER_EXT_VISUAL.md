# PRIMER EXTENSION: VISUAL / FRONTEND QA

**Load this extension when task involves frontend/UI changes at MEDIUM or HIGH risk.**

**Version:** 1.0 | **Date:** 2026-04-18 | **Authority:** MR-1367

**Source:** `_SYSTEM/SESSION_PRIMER_V2.md` Section 8 (Screenshot Protocol) + Visual QA Checklist (this extension) + reference to MR-1316 Design Constraint System.

---

## 1. Screenshot Protocol (Conditional)

### When to Capture

Capture screenshots ONLY IF one of the following is true:

- Task involves visual/frontend changes, OR
- Risk level is HIGH.

### When Triggered

- Capture **before** state if modifying existing UI.
- Capture **after** state.
- Store in `_SYSTEM_LOGS/` or a task-specific output directory.
- Report filenames in the execution report.

### When NOT Triggered

- Backend-only changes at LOW or MEDIUM risk.
- Documentation-only tasks.
- Analysis/audit tasks with no visual output.

---

## 2. Visual QA Checklist

Run this checklist on every frontend/UI change at MEDIUM or HIGH risk before reporting COMPLETE. Every item must be PASS, FAIL, or N/A. Any FAIL must be fixed before the task is reported complete.

| # | Check | Expected Result |
|---|-------|-----------------|
| 1 | Layout renders correctly | No broken elements, missing sections, or shifted components |
| 2 | Spacing is consistent | No collapsed margins, no double gaps, no unintended stacking |
| 3 | Visual hierarchy is clear | Headings, body, meta, and CTAs are distinguishable; 3-tier hierarchy preserved |
| 4 | No regressions in existing UI | Previously working sections still render identically |
| 5 | Fonts and colors match brand | No fallback fonts rendering; no unexpected color drift |
| 6 | Interactive elements are hit-targetable | Buttons, links, form fields all respond correctly |
| 7 | Mobile / responsive behavior | Layout adapts at common breakpoints (360, 768, 1024) if applicable |
| 8 | Accessibility basics | Sufficient contrast, readable font sizes, focusable controls |

### Rules

- If ANY check fails, the task MUST NOT be reported COMPLETE until the issue is fixed and the checklist is re-run.
- If a fix introduces a new visual regression, re-run the full checklist from the top.
- Record the checklist pass/fail state in the execution report under VERIFICATION.

---

## 3. Design Constraint Compliance (MR-1316)

All visual outputs must pass the binding MissionMed Design Constraint System established in MR-1316 following the MR-1315 rejection. Load the constraint document before any UI output:

```
/Users/brianb/MissionMed/MR-1316_Design_Constraint_System.docx
```

Key constraints enforced by MR-1316:

- Maximum 2 photos per page.
- Maximum 8 social proof touchpoints.
- Banned elements: tickers, glow effects, parallax, highlight banners.
- Mandatory 3-tier visual hierarchy.
- 24-check Premium Filter validation checklist (BLOCKING and HIGH severity items) must pass before any UI is delivered.

If the task produces a UI output and the Premium Filter has not been run, the task is not COMPLETE.

---

## 4. Reporting

In the execution report VERIFICATION section, include:

- Screenshot filenames (before + after).
- Visual QA Checklist result for each of the 8 items above.
- MR-1316 Premium Filter result (PASS / FAIL / N/A).
- Any FAIL items and the fix applied.

---

END OF PRIMER EXTENSION: VISUAL
