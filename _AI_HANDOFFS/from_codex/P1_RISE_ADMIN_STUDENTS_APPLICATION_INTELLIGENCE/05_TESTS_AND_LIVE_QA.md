# Tests and Live QA

## Automated

- Full Node test suite: 233 passed, 0 failed.
- Browser regression suite: 19 passed, 0 failed.
- Actual HTTP authorization test: anonymous 401, student session 403, operator list/detail 200.
- Response privacy test: program context present; private notes absent.
- Migration/source contract: additive schema, forced RLS, operator read-only.

## Live authenticated browser

- Admin Students navigation rendered.
- Three existing student subjects were discoverable without exporting sensitive identifiers.
- Search and selection worked.
- Student detail showed the canonical saved program and controls.
- Program File navigation opened the correct canonical program.
- A student gold-star change persisted through reload and appeared in administrator gold-only filtering.
- The QA gold-star mutation was cleared and provider readback returned the original zero-gold state.
- Fable shell and existing admin research controls remained intact.

## Negative controls

- Live anonymous direct operator endpoint: 401.
- Live public RISE entry: 302 to authentication.
- Authenticated ordinary-student operator access: deterministic real-server integration 403. No separate safe live non-admin browser identity was available, so this control is not misreported as browser evidence.
