# I1Q 1006 Security, Privacy, and Accessibility

## Security results

VERIFIED local candidate checks:

- deny by default without identity adapter
- explicit role authorization
- immutable revision and promotion history
- append-only audit hash chain
- idempotency
- bounded pagination
- one-megabyte request body limit
- malformed JSON rejection
- path traversal rejection
- restrictive response headers
- answer-alias scan
- no answer fields in pre-answer artifact
- finalization gate for post-answer artifact
- student release flag defaults off

VERIFIED: Local candidate has zero known critical and zero known high findings from executed checks.

BLOCKED: Production IDOR, CSRF, rate limit, privilege escalation, RLS, dependency, and canonical session tests were not executed.

## Answer security

- VERIFIED: No `answer_map` is queried by I1Q candidate code.
- VERIFIED: Server artifact contains answer-bearing data only in internal storage.
- VERIFIED: Pre-answer channel omits answer and explanation.
- VERIFIED: Nested `answerKey`, `correctAnswer`, `correct_option`, `solution`, ID encoding, and order metadata are represented in adversarial audit cases.
- PROTECTED: Live STAT answer security remains unchanged.

## Privacy

- VERIFIED: Independent audit explicitly reports required classes and numeric patient-identifier recall.
- VERIFIED: Missing required class is a failure.
- VERIFIED: Synthetic runtime redaction includes student names, third-party names, patient identifiers, email, phone, and address patterns.
- VERIFIED: Raw transcript content is not written to candidate normalized-segment storage.
- VERIFIED: No real student speech, patient data, third-party names, or clinical anecdotes were accessed.
- BLOCKED: Real privacy recall, rights clearance, private object access, logging, and error-leak testing require an authorized corpus and staging identity.

## Accessibility

- VERIFIED: Automated structure and browser heuristics pass.
- VERIFIED: All twelve workflows render without page overflow at three widths.
- VERIFIED: Enter and Space navigation pass after an explicit keydown regression repair.
- VERIFIED: Visible focus, reduced motion, accessible names, live status regions, and non-color status signals exist.
- VERIFIED: Measured enabled-action and key navigation contrast exceed 4.5:1.
- OPEN: Human screen-reader, zoom, switch-control, and assistive-technology tests remain required.

## Evidence

- `evidence/security_results.json`
- `evidence/accessibility_results.json`
- `evidence/browser_results.json`
- `audit/results/adversarial_audit_report.json`
