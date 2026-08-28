# Matrix Profile Adapter

Fresh authenticated live discovery corrected the older 5003 unknown:

- Matrix currently loads `student-os.30068939fc54fb4a.js`.
- Canonical API base: `/wp-json/mmed/v1`.
- Canonical profile read: `GET /wp-json/mmed/v1/profile/me`.
- Canonical profile write: `POST /wp-json/mmed/v1/profile/me` with `{ profile, mark_complete }` and `X-WP-Nonce`.
- The same endpoint returns the canonical profile, progress, required fields, and prompt state after writes.
- Current Matrix UI uses this route for both draft and completed profile saves.

No user profile value was printed, persisted to Git, or modified during discovery. The authenticated browser probe was schema/contract inspection only.

RISE still lacks an approved server-side transport that preserves the same WordPress user/session/nonce boundary from its isolated Railway backend. The candidate `/api/rise/v1/me/profile` remains fail-closed. A second profile table was not created.

```text
CANONICAL_MATRIX_PROFILE_CONTRACT_FOUND = YES
MATRIX_TO_RISE_READ = NO
RISE_TO_MATRIX_WRITE = NO
WRITE_READBACK_PROOF = NO
SECOND_PROFILE_TRUTH_CREATED = NO
MATRIX_PROFILE_LIVE = NO
```
