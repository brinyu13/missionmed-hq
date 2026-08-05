# Timeline RC1 Regression Report

Final local certification:

- TypeScript and Node tests: **636/636 passed** (`135` TypeScript + `501` JavaScript).
- Focused R2 presigning/storage tests: **5/5 passed**.
- Production browser workflows: **39/39 passed** across administrator, eligible-360, and removed/ineligible journeys.
- Release verification: **62/62 files passed**.
- Package verification: **23/23 passed**.
- Typecheck: PASS.
- API build: PASS, 145,401 bytes after the final repair.
- API-only boundary: PASS, `forbiddenMatches: 0`.
- Matrix App Mode: PASS.
- Exact fail-soft browser proof: PASS, two events retained, one valid media item retained, invalid item omitted with warning, zero off-origin requests.
- Protected presentation hashes: three of three unchanged.

Final production certification:

- Health: `200`, `service=mission-timeline`, `version=timeline-c9eda9eeb7d6cf98`, `schemaVersion=d1-timeline-db-500.1`.
- Direct API without gateway: `403 GATEWAY_REQUIRED`.
- Approved administrator: PASS.
- Active 360 student with live LearnDash 3893 entitlement and consent: PASS.
- Non-360 user: `eligibility_required`.
- Token renewal: two distinct tokens, both API `200`.
- Private media: sign `201`, PUT `200`, confirm `200`, download grant `200`, download `200`, SHA-256 match true, delete `204`, post-delete `404 OBJECT_NOT_FOUND`.
- Foreign principal media download/delete: both `404 OBJECT_NOT_FOUND`.
- Fixture cleanup: owner `204`; R2 object count zero.
- Approved administrator custody: production runtime retains `remotePersistenceAllowed=false`, queues zero remote writes, and direct server media signing returns `OBJECT_UPLOAD_ROLE_DENIED` before repository access.

The production page's authenticated visual re-navigation could not be repeated through the browser-control extension after it began returning a local client-side block, and the Founder was actively using Chrome. The shipped WordPress payload was hash-verified, the exact same static RC1 payload passed the local browser suite and screenshot verification, and authenticated server/API canaries passed. No product or origin error was inferred from the local extension condition.
