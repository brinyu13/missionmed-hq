# Timeline RC1 Production Failure Recovery 002

## Verdict

**PASS.** The Founder-reported post-consent failure is repaired in production. The prior PASS was reopened; this verdict is based on the real production journey in a clean browser plus independent security, persistence, and denial evidence.

## Causal trace

1. WordPress authentication and LearnDash 3893 eligibility succeeded.
2. Consent `d1-500-v1` was stored.
3. Gateway token issuance succeeded.
4. API principal resolution failed because the eligible user had no seeded Timeline principal.
5. The client converted the content-free auth failure into the branded safe-load state.
6. Deterministic first-use principal provisioning repaired that boundary.
7. The contextual replacement consent form then exposed `csrf_failed` in a real clean browser.
8. Authenticated same-origin WordPress AJAX repaired the submission seam without weakening consent policy.
9. Clean-profile grant, hydration, refresh, re-entry, and renewal now settle at `SAVED & SYNCED`.
10. Sanitized logs exposed one `pg` concurrency warning; sequential transaction reads repaired it, 644/644 tests passed, and the final API deployment logs contain no recurrence after live refresh.
11. Independent clean-profile verification found four font 404s; scoped inline-style packaging rewrote them to immutable Timeline asset aliases and a fresh Kinsta release was cut.

## Production release

- Source: `d43af9800ee49407a5cfe43bd2f44b131475867a`.
- Static: `timeline-f5f8ad51fd48010b`.
- WordPress: `timeline-wp-01b09664228a865a`.
- Railway: `b0c3401a-c482-4aac-9580-8e0067554289`.
- Railway image: `sha256:fb5493c8fc87b6764d202d84f13b7103fea3172552047e4bd0d4dab2b0c9dd22`.
- Live URL: `https://missionmedinstitute.com/timeline/`.

## Final truth

Premium onboarding is restored; consent is contextual; first-use identity is deterministic and audited; existing consent does not recur; withdrawal remains available; existing timelines hydrate; protected rendering, fail-soft media, editing, autosave, persistence, export, refresh, renewal, direct-API denial, entitlement denial, and two-owner isolation are covered by live evidence and the authoritative regression suite. No unrelated application impact was observed or introduced.
