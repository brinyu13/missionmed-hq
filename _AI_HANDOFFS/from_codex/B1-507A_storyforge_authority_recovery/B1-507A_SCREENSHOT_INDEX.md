# B1-507A Screenshot Index

Date: 2026-07-29
Capture method: authenticated Google Chrome through Computer Use. All captures are read-only and 1307×768 JPEGs. Secret values are not visible.

| # | UTC timestamp | System | File | Purpose / what it proves | Limit | Sensitive-information exclusion |
|---:|---|---|---|---|---|---|
| 1 | 2026-07-30T03:12:17Z | Live StoryForge / WordPress | `screenshots/01-live-storyforge-founder-voice-disabled.jpg` | Authenticated production V5 home as `brinyu` in student view proves the B1-503 Founder pilot is healthy, the current access outcome works, and the microphone control is disabled | API/config truth comes from separate read-only probes | PASS — no student record, token, cookie, secret, or private content |
| 2 | 2026-07-30T03:12:34Z | Railway | `screenshots/02-railway-production-one-replica.jpg` | Shows the production `missionmed-storyforge-v5` project, active successful B1-503 `storyforge-v5-api` deployment, US West, one replica, and online PostgreSQL | One replica is an observation, not the locked PROBE-C5 invariant | PASS — no environment-variable values, credentials, logs, or student data |
| 3 | 2026-07-30T03:12:34Z | MyKinsta | `screenshots/03-kinsta-live-site.jpg` | Proves the correct MissionMed Institute Live environment is accessible and identifiable for backup/release work | Fresh backup and release-pointer truth require receipts/CLI evidence | PASS — password is masked; no token, private key, or database credential |
| 4 | 2026-07-30T03:12:34Z | Cloudflare R2 | `screenshots/04-cloudflare-r2-no-storyforge-bucket.jpg` | Lists the three existing buckets and proves no StoryForge audio bucket exists in the authenticated account | Point-in-time inventory only | PASS — no API token, object content, signed URL, or student data |
| 5 | 2026-07-30T03:12:34Z | Cloudflare Worker Routes | `screenshots/05-cloudflare-no-storyforge-worker-route.jpg` | StoryForge-filtered route list has no results, proving the old Worker route is absent and the system manifest is stale | Does not enumerate unrelated routes | PASS — no DNS secret, token, or unrelated route detail |
| 6 | 2026-07-30T03:12:55Z | GitHub | `screenshots/06-github-upstream-storyforge-branch.jpg` | Shows the upstream StoryForge recovery branch at B1-503-era content, supporting the finding that the local V5.5 candidate is not in remote custody | GitHub’s branch-to-main comparison differs from local-to-upstream 18/0 divergence | PASS — no credential, token, private source, or private issue content |
| 7 | 2026-07-30T03:14:00Z | OpenAI platform | `screenshots/07-openai-data-controls-readiness.jpg` | Shows audit logging is not enabled and API call logging is “Enabled per call,” supporting the incomplete StoryForge provider/privacy posture | Does not prove BAA/ZDR contract or project-specific settings | PASS — no API key, usage content, prompt, audio, or billing detail |
| 8 | 2026-07-30T03:30:42Z | WordPress administration | `screenshots/08-wordpress-storyforge-sso-active.jpg` | The StoryForge-filtered Plugins page shows `MissionMed StoryForge SSO` v0.1.0 with `Deactivate`, proving the plugin is active | The plugin has no dedicated settings UI; sanitized option/source evidence and representative identity tests control entitlement claims | PASS — no student list, session token, credential, or option secret |

## Screenshot integrity rules

- Screenshots support, but do not replace, repository hashes, API probes, database queries, or deployment receipts.
- Account names, site identifiers, and infrastructure endpoints visible here are operational evidence. No passwords, tokens, API keys, database credentials, or signed URLs are present.
- The final production megarun must add before/after evidence for the exact launch SHA, migration ledger, R2 configuration, provider project, gateway upload/DELETE, voice state matrix, permanent audio/replay, reconciliation dry-run/on, and rollback rehearsal.
