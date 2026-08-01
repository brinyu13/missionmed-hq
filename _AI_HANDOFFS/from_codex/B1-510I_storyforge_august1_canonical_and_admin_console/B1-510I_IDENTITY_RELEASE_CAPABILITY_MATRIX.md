# B1-510I Identity, Release, and Capability Matrix

Private WordPress and StoryForge identifiers are retained in the mode-0700 backup/evidence root rather than committed. Identity labels below are sufficient to audit the authorization result without publishing account identifiers.

| Identity | Entitlement | Static bytes | App/API result during canary | Final production result |
|---|---:|---|---|---|
| Founder student | eligible | canonical exact hashes | HTTP 200; student; `voiceCapture=true`; physical-mic canary PASS | voice active through `eligible_all` |
| Founder administrator (WP 107) | administrator | canonical exact hashes | admin HTTP 200; eligible admin; `voiceCapture=false` | unchanged; no unintended student voice |
| Ignacio eligible student | eligible | canonical exact hashes | HTTP 200; student eligible; `voiceCapture=true` | voice active through `eligible_all` |
| second eligible 360 student | eligible | canonical exact hashes and trusted mapping verified | HTTP 200; student eligible; `voiceCapture=true` | voice active through `eligible_all` |
| ineligible account | ineligible | no broader authorization | WordPress bridge rejected JWT issuance as `storyforge_identity_unmapped` | denied |
| anonymous | none | public shell only | session HTTP 401 | HTTP 401 |

## Entry-path evidence

- `/storyforge/` canonicalizes and serves the current release.
- Matrix launch and `/member-dashboard/#storyforge` route through the current signed WordPress bridge.
- Direct hashes, route ownership, and public asset fetches matched the current release during the canary.
- Hard refresh did not reveal a legacy application bundle.

## Scope conclusion

All eligible identities use one static application generation. The live index hash is `ffeb8b5f603d3c6113bca008cc2647fde8b7f17175ba268d6293d0c05349d93a`; the live active app alias is `/_asset/0dd4ed77dc52`, with SHA-256 `0dd4ed77dc52731cf49e95033c6962ad371cec2c3db3cc1248d5fa71c6b03176`. Voice visibility is an authenticated capability response inside that app. No WordPress `360` role, alternate student bundle, manual permanent roster, or new identity authority was introduced.

An Ignacio token requesting a Founder-owned direct story ID received HTTP `404` / PostgreSQL `P0002`, confirming cross-user denial after activation.
