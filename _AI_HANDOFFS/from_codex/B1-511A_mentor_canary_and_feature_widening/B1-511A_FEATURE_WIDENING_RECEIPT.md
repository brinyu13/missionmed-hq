# B1-511A Feature-Widening Receipt

## Final production scopes

The following existing student workflows were widened atomically to `eligible_all`:

| Feature key | Scope | Allowlist | Cohorts | Audit ID |
|---|---|---:|---:|---:|
| `story_workflow` | `eligible_all` | 0 | 0 | 779 |
| `story_taxonomy` | `eligible_all` | 0 | 0 | 780 |
| `inline_priority` | `eligible_all` | 0 | 0 | 781 |
| `story_search` | `eligible_all` | 0 | 0 | 782 |

`mentor_notes` was not widened. It remains the exact controlled two-identity pilot for Founder `brinyu` and Ignacio, with zero cohorts and runtime `STORYFORGE_MENTOR_NOTES_FORCE_OFF=0`.

## Transaction behavior

The first widening transaction failed closed because a proposed audit payload contained the disallowed property `key` (`voice audit payload not permitted`). The transaction rolled back, and all flags were verified unchanged. The retry used the repository’s existing allowed audit-payload shape—scope, allowlist, and cohorts only—and the authenticated append-only audit function. The successful transaction preserved the canonical entitlement authority.

## Live identity matrix

| Identity | Expected / observed result |
|---|---|
| Founder student / WordPress administrator (`brinyu`) | HTTP 200; four widened student workflows enabled; mentor-note read enabled; Administrator View enabled |
| Ignacio | HTTP 200; four widened workflows enabled; mentor-note creation disabled; mentor-note read enabled |
| Additional eligible student | HTTP 200; four widened workflows enabled; mentor-note creation and read disabled |
| Ineligible user | HTTP 403 `eligibility_required` |
| Anonymous | HTTP 401 |

No WordPress role, LearnDash enrollment, StoryForge UUID, story owner, or profile field was modified.
