# Authentication, privacy, Admin

Protected files to CONSUME, not recreate in presentation:
missionmed-hq/lib/auth/session-token.mjs
missionmed-hq/lib/auth/rise-current-eligibility.mjs
missionmed-hq/server.mjs
missionmed-hq/ivoc/routes.mjs, repository.mjs, storage.mjs
ivprep-v6/server/hq-auth-lifecycle.mjs, hq-mount.mjs.

Normal Matrix entry authenticates WordPress actor → HQ audience signed session/cookie → IVOC server admission/entitlement. Browser mode labels and view switches confer NO roles. Preserve expiry/CSRF/audience validation and current authoritative eligibility. HQ versus RISE isolation is deliberate; use sanctioned handoff, not cross-audience bypass. DR333 historical auth repair and DR361 current eligibility successor remain evidence/authority, not a prompt to replace auth.

Ordinary entitled360 student accesses own wp:<id> sessions/results/transcripts/private media. Founder/Admin permissions evaluated SERVER-side. brinyu/wp:1 genuine positive entry accepted. Genuine second Admin/wp:107 eligibility exists, but authenticated complete acceptance is pending. Entitled student/wp:142 entry was previously observed; complete private/media journey not accepted. IDs are orientation, not credentials or permission to impersonate.

Admin selection changes REVIEW SUBJECT, never ACTOR. Bootstrap actor remains authenticated Admin; server gates selected-student endpoints and verifies sanctioned review scope. Generation/selection changes clear stale rows/transcript/player/media; own student controls must not inherit selected subject. Use admin-student-library + account/own-scope adapters.

Private recordings: verify subject/session/recording ownership BEFORE signing R2 playback/upload. Signed TTL/path/owner isolation, no public bucket or persistent public link. Wrong subject/session IDs fail closed. Metadata visibility must not grant raw media, transcript or unrelated course access. RLS remains forced; privileged browser key prohibited.

Negative/wrong-owner/revoked role cases require genuine identities, not simulated view buttons. Mechanical tests remain valuable but not acceptance substitute. Never recreate DR340 temporary QA grants; they are revoked. No permanent synthetic entitlement, emergency RLS bypass, duplicate account or credential copying.

Required final matrix: Founder Admin; second authorized Admin; ordinary entitled360; genuine negative role; wrong-owner access and revoked access; Admin selection doesn't contaminate student state. Use authorized account sessions supplied normally. Do not log cookies/tokens/headers/private payloads or copy student raw content into handoff.

Sentinels: auth/session-token tests, HQ routes/storage/rise eligibility, test/8001/admin-student-library/review-scope, current Fable own-scope/saved-review. Failure returns to authoritative server/selection boundary, not UI-only hiding.
