# DRJ-EXAMPREP-0920A — Entitlement Matrix

## Subscription lifecycle

| Condition | Daily Rounds course 6357 | Drills-only capability | Live Group course 3655 | Premium / unrelated access |
| --- | --- | --- | --- | --- |
| Product 6360 active or pending-cancel | Grant | Grant | No change | Never grant |
| Product 9109 active or pending-cancel with qualifying Live Group | Grant | Grant | Preserve independently owned access | Never grant |
| Product 3651 active or pending-cancel | No change | No change | Grant | Never grant |
| One of multiple qualifying subscriptions terminates while another remains active | Preserve | Preserve | Preserve when another Live Group subscription remains | No change |
| Final qualifying subscription becomes cancelled, expired, failed, refunded, or on-hold | Revoke only if managed by this lifecycle | Revoke only if managed by this lifecycle | Revoke only if managed by this lifecycle | No change |
| Course/capability existed before this lifecycle | Preserve | Preserve | Preserve | No change |

## Server route boundary

| User state | `/daily`, `/drills`, `/daily-drills-v3`, `/drills-v3` | `/stat` and premium/direct Arena routes |
| --- | --- | --- |
| Anonymous | Redirect to login | Existing Arena controls apply |
| Logged in without Daily Rounds entitlement | HTTP 403 | Existing Arena controls apply |
| Daily Rounds-only | HTTP 200 | HTTP 403 from the drills-only gate |
| Independently authorized full Arena user with canonical Arena course | Preserved | Preserved; Dr J drills-only layer does not block |

## Acceptance evidence

- Zero-money lifecycle simulation proved active grant, pending-cancel/multiple-subscription preservation, terminal revoke, pre-existing capability preservation, full-access override preservation, premium lock for Daily-only, Live Group grant/revoke, and add-on eligibility grant/revoke.
- Temporary acceptance users, subscriptions, and coupons were deleted in cleanup. Final cleanup counts: temporary users `0`, temporary coupons `0`, and scoped product subscriptions `0` for products 3651, 6360, 9017, and 9109.
- No historical order, customer subscription, unrelated course, or unrelated capability was altered.
