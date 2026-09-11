# Admin Review Exceptions

Live admin readback showed:

- Provider claims: 10,079.
- Current canonical promoted values: 2,593.
- Conflicts requiring review: 181.
- Insufficient evidence: 1,181.
- Reviewed target programs with no approved-current fact: 138.
- Programs whose target outcomes are only unresolved: 98.

The queue is an exception surface, not a second truth store. Human actions append auditable review events and preserve the original claim and prior decision. Student endpoints cannot read this admin ledger under forced RLS. No admin decision button was exercised during QA.

The two protected canary IDs are explicitly rejected by the promotion factory and remain absent from the claim corpus. The unrelated dropped-line and Neurology taxonomy integrity finding remains a separate follow-up.
