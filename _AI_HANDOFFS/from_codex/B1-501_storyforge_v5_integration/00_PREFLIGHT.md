# B1-501 Preflight

Status: **PASS for the authorized local integration scope; PROTECTED Matrix source edits remain blocked and were not attempted.**

Recorded: 2026-07-26 23:18 EDT

Branch: `b1-501-storyforge-v5-production-integration`

Starting commit: `be43c6d0a4520ed761a3d112a25452f26683f9ca`

## Authority and protected-runtime boundary

- Canonical V5 authority: `_AI_HANDOFFS/from_cowork/B1-500_storyforge_v5_production_authority/storyforge-v5.html`
- Required and observed SHA-256: `3ac2871ff286552abe89a785ff43967df3315922e3718f67a136b83db1ba8db1`
- The Matrix guard verified that origin/public hashes match the protected manifest, then exited `42` because the protected `missionmed-hub` source files are absent from this exact worktree.
- Result: **DO NOT TOUCH** `wp-content/plugins/missionmed-hub`. No recovery override was used. The integration uses a new isolated plugin, new edge configuration, and the authorized SPA auth/base-path seam only.

Guard command:

```bash
python3 _SYSTEM/tools/matrix_runtime_guard.py preflight \
  --worktree /Users/brianb/MissionMed_worktrees/B1-StoryForge-501 \
  --assets all \
  --verify-public
```

## Repository mappings

| Authority assumption | Repository fact | Adaptation |
|---|---|---|
| Token bridge path | No production WP bridge existed in this worktree. The B1-500 API already verifies a purpose-bound JWT. | Added `POST /wp-json/missionmed/v1/storyforge/token` in the isolated SSO plugin. |
| Claim shape | B1-500 consumes `sub`, `app_role`, and `storyforge_eligible`; identity display also uses `wp_user_id` and `name`. Allowed application roles are `student`, `mentor`, and `admin`. | Issuer emits those exact claims plus standard `iss`, `aud`, `iat`, `nbf`, `exp`, and `jti`. |
| SPA environment configuration | B1-500 reads server environment in `server/config.mjs` and exposes a public `/api/config` response. | Extended that existing seam with base path, Matrix URL, WP bootstrap/token paths, origin list, and refresh skew. No secret is exposed. |
| Edge convention | B1-500 had a Node runtime and no deployable edge route configuration. | Added a minimal Cloudflare Worker static-assets route and a local precedence proxy. The production account/project binding remains a B1-502 input. |
| WP development container | None existed for this package. | Added a disposable, isolated WordPress + MariaDB Compose project mounting only the new plugin. |
| Mentor assignment source | B1-500 stores enforcement rows in `public.sf_mentor_assignments` but had no production WP export/sync implementation. | Added `mmsf_assignment_rows()` with a default WP mentor-meta adapter and a filter for the real production owner; local reconciliation compares it to `sf_mentor_assignments`. Production ownership remains unresolved. |
| Live 360 entitlement | The repository already contains the trusted `mmhq_cam_build_entitlement()` integration point, but that protected owner is not present in this worktree. | Production student issuance fails closed unless that function exists. A constant-gated local fixture is available only when `WP_ENVIRONMENT_TYPE=local`. |

## Scope conclusion

No invariant conflict was found. The absent protected sources prevent editing Matrix runtime assets, not the three isolated seams authorized by B1-501. No remote system, deployment, DNS record, or production configuration was touched.
