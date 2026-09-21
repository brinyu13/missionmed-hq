# Entitlement Matrix

| Condition | Daily course 6357 | Drills-only capability | Live course 3655 | Premium tools |
| --- | --- | --- | --- | --- |
| `6360` active or pending-cancel | Grant | Grant | No change | Never grant |
| `9109` active/pending-cancel with Live eligibility | Grant | Grant | Preserve independently | Never grant |
| `3651` active or pending-cancel | No change | No change | Grant | Never grant |
| One of multiple qualifying subscriptions ends | Preserve while another qualifies | Preserve | Preserve while another qualifies | No change |
| Final Daily qualifier ends | Revoke only lifecycle-managed grant | Revoke only lifecycle-managed grant | No change | No change |
| Final Live qualifier ends | Add-on subscription auto-cancels; Daily reconciles | Reconcile from remaining Daily products | Revoke only lifecycle-managed grant | No change |
| Course/capability pre-existed this lifecycle | Preserve | Preserve | Preserve | Preserve |

Route acceptance remains fail-closed: anonymous users are sent to login, non-entitled users receive no Daily access, Daily-only users cannot open STAT/premium/direct Arena paths, and independently authorized full-Arena users remain unaffected.
