# Filter contract before and after

| Contract | Before | After |
|---|---|---|
| Group order | Advanced/research controls could lead | Applicant Match, Exams & Attempts, Graduation & USCE, Visa, Resident Evidence, then Advanced |
| COMLEX accepted | Mapping existed but discovery was obscured | 3,555 live programs |
| J-1 published | Mapping existed | 4,420 live programs |
| H-1B published | Mapping existed | 1,304 live programs |
| J-1 or H-1B | Mapping existed | 4,464 live programs |
| Any visa evidence | Mapping existed | 4,470 live programs |
| IMG roster evidence | Mapping existed | 3,514 live programs |
| DO roster evidence | Mapping existed | 3,671 live programs |
| Caribbean roster evidence | Mapping existed | 122 live programs |
| US MD roster evidence | Mapping existed | 5,005 live programs |
| Resident-school aliases | Exact/variant strings could diverge after compact projection | Canonical aliases for SGU, Ross/RUSM, AUC and LECOM survive compact payload, typeahead and filtering |
| Profile exam controls | Generic score label could blur Step 2 CK and COMLEX Level 2 | Independent score labels, keys, shortcuts and compatibility reasons |
| Same-school ordering | Connection was filterable but not always strongest-first | Supported resident connection count sorts descending |

Filters remain derived from the canonical/live model. No frontend program allowlist was introduced. Clear, composition and result-count behavior are covered by automated and live QA.
The current Founder Matrix profile does not include a usable medical school or exam-score payload, so profile-specific one-click controls remain honestly disabled in live QA. Complete-profile fixtures cover those conditional paths without fabricating Founder data.
