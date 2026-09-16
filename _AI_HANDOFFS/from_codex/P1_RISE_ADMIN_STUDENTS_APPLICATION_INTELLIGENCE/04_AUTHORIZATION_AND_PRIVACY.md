# Authorization and Privacy

- Operator routes require the existing `rise:operator` capability.
- Anonymous requests return 401.
- Authenticated non-operator requests return 403.
- Database access is protected by forced RLS and admin-read-only policies.
- Student owners retain their existing subject-isolated write contract.
- Admin responses exclude student notes and do not expose session or credential material.
- Identity rows contain only the bounded session-derived display projection required for discovery; absent identity remains a pseudonymous fallback.
- No bulk export, admin edit, impersonation, or cross-student mutation path exists.

The live public `/rise/` entry remains authentication-gated and redirects anonymous users to WordPress login. The direct operator API fails closed for anonymous access.
