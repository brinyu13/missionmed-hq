# B1-510I Identity, Release, and Capability Matrix

Private WordPress and StoryForge identifiers are retained in the mode-0700 backup/evidence root rather than committed. Identity labels below are sufficient to audit the authorization result without publishing account identifiers.

| Identity | Entitlement | Static bytes | App/API result during canary | Final production result |
|---|---:|---|---|---|
| Founder student | eligible | canonical exact hashes | student; recording UI present while allowlisted | Founder-only allowlist restored |
| Founder administrator (WP 107) | administrator | canonical exact hashes | admin HTTP 200; `voiceCapture=false` | unchanged |
| Ignacio eligible student | eligible | canonical exact hashes | HTTP 200; student eligible; `voiceCapture=true` during `eligible_all` canary | voice removed by rollback to allowlist |
| second eligible 360 student | eligible | canonical exact hashes and trusted mapping verified | same entitlement population boundary | voice removed by rollback to allowlist |
| ineligible account | ineligible | no broader authorization | denied | denied |
| anonymous | none | public shell only | session HTTP 401 | HTTP 401 |

## Entry-path evidence

- `/storyforge/` canonicalizes and serves the current release.
- Matrix launch and `/member-dashboard/#storyforge` route through the current signed WordPress bridge.
- Direct hashes, route ownership, and public asset fetches matched the current release during the canary.
- Hard refresh did not reveal a legacy application bundle.

## Scope conclusion

All eligible identities use one static application generation. Voice visibility is an authenticated capability response inside that app. No WordPress `360` role, alternate student bundle, manual permanent roster, or new identity authority was introduced.
