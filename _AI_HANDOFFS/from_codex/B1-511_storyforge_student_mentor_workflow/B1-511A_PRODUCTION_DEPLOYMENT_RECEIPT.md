# B1-511A Production Deployment Receipt

## Verdict

**WORDPRESS FOUNDER AUTHORITY CORRECTED IN PRODUCTION**

WordPress user `1`, username `brinyu`, retains its `student` StoryForge base
role and all seven owned stories while receiving the bounded administrator
capability signed from WordPress `manage_options`. WordPress user `107`,
username `Brian_test`, remains an additional administrator.

## Exact release

- deployed source: `4876212cbcb874fb3769e97b969a6b627ba3a6ab`
- release ID: `v-f31264f9b7bbcb93`
- Kinsta pointer:
  `releases/4876212cbcb874fb3769e97b969a6b627ba3a6ab`
- Railway deployment: `3b9b72c2-6e5f-4f85-8bb6-413d08100306`
- Railway image:
  `sha256:9e42868c225ba90d1bd893bb21015876768ba27b8af371e2de699f3e7e7c7e71`
- Railway health: `{"ok":true,"service":"storyforge-v5"}`
- one US West replica

Live public hashes:

| Asset | SHA-256 | Bytes |
|---|---|---:|
| index | `82f1657c39e3fcfc6da0c3acbe0ae8d4cb586ce2110f45fc4793d7faaa1daab0` | 1,669 |
| app | `539dc28b543d3e87226eaab575957d8932f1f4ee60f51a61deb7644045836ec2` | 360,910 |
| styles | `dddc33507fd06073e5063f81c678e10f977a9dcd07d397b194f3222f3000f518` | 116,340 |
| auth | `d2cfc4e447d23c2e6c164978221417a333764b33fd1dfea7cb1ae415b99118e6` | 7,236 |
| WordPress route | `a1818bd2d36b54e4c9bba9529cfddeef405dece3b800e3272bf9c58133e329bb` | 37,659 |
| WordPress release PHP | `864589774a7146975903dc2f9e9adf4884620c6b293c97efc31734b98443321b` | 1,073,554 |
| WordPress SSO plugin | `7e382120e81870baf41c1ddfa72ac9b35d1a41b541270103b4e28abd8a81aa7f` | 25,205 |

Canonical route returned HTTP `200`; anonymous session returned HTTP `401`.

## Database

- migration: `20260806130000_b1_511a_wordpress_admin_authority.sql`
- SHA-256:
  `4dfcea71718cfb268bb3b8716b6968df5f678690d0465f941ec2e0501c32f5c1`
- ledger commit: `4876212cbcb874fb3769e97b969a6b627ba3a6ab`
- ledger backup ID: `db528b0d-3770-44fc-9534-bff8970196a7`
- production user/story counts after migration: `441` / `22`
- WP1 StoryForge row:
  `09c3b822-75e7-4f3f-bd3f-58afc0865a78`, role `student`, eligible
- WP107 StoryForge row:
  `56bb6d8a-4957-4ba6-abe1-7f77046061c8`, role `admin`, eligible
- `admin_console` scope: `allowlist`
- allowlist: the two UUIDs above, no cohorts
- feature-scope mutation used the existing audited administrator function

No user row, StoryForge role, story row, or story owner was changed.

## Production identity proof

The real Kinsta WordPress runtime issued a short-lived token for exact
WordPress user `1`; the token was used in memory and was neither printed nor
retained. Sanitized result:

```json
{"wp_user_id":1,"username":"brinyu","wordpress_manage_options":true,"signed_base_role":"student","session_status":200,"session_role":"student","session_wordpress_admin":true,"admin_console_capability":true,"admin_home_status":200,"stories_status":200,"owned_story_count":7}
```

This proves dual access for `brinyu` without converting or duplicating the
student identity. The browser's current WordPress user `107` independently
loaded Administrator View from the same canonical release.

## Tests and safety

- unit suite: `277/277` pass after the final build
- focused security/unit subset: `47/47` pass
- PostgreSQL suites: `17/17` and `130/130` pass, plus new authority test pass
- browser E2E: `68/68` pass
- deterministic release build: pass at deployed source
- npm audit: 0 vulnerabilities for `storyforge-v5`
- secret scan: pass
- public/API logs queried after final deployment: zero HTTP 5xx results
- mentor-note force-off remained `1`
- no protected `missionmed-hub` file changed

## Backups and rollback

Fresh PostgreSQL 18 custom dump:

- private path:
  `/Users/brianb/MissionMed_private_backups/B1-511A/DB-20260806T152400Z/storyforge-production.pg18.dump`
- SHA-256:
  `ced4e0557870e67e3ac738d17b862b2af0dd40999f8df21e4a4583af5c930613`
- isolated restore: PASS (`441` users, `22` stories, `11` migrations)

Fresh Kinsta pre-write snapshot:

- `/www/theresidencyacademy_209/private/b1-511a/B1-511A-PRE-20260806T153013Z`
- manifest SHA-256:
  `4438b98961ee3c13788dc34386c1ddb183c5045206f666c249cacae29c821ae6`
- exact prior pointer:
  `releases/ea401e2eac10775c3e0cc3c05265171fd1aba838`

The known Kinsta WP-CLI exit-139 defect recurred while reading one optional
option export. It did not change production. Route, release, SSO, settings, and
pointer files are retained; the affected optional role-override export is
zero bytes and is not claimed as a backup input. This release changes no
WordPress option or profile, so rollback does not depend on that file.

Rollback order:

1. Restore the prior Kinsta pointer, route, and SSO bytes from the snapshot.
2. Deploy the prior exact StoryForge API package if backend rollback is needed.
3. Preserve the additive migration dormant; the old backend remains compatible
   because absent `wordpress_admin` and `admin_mode` claims default false.
4. Restore the database only under separate incident authority.

## Deployment incident disclosure

The first Railway CLI upload omitted `--path-as-root` and indexed the repository
root. It built the unrelated HQ server as deployment
`1b954ca2-b180-4713-b072-5275e61dd5fd`; `/healthz` returned 404. The incorrect
deployment briefly became active and caused a bounded API interruption. No
database or Kinsta frontend mutation depended on it. The exact StoryForge
package was immediately uploaded with `--path-as-root`, passed its API-only
build and `/healthz`, became deployment
`3b9b72c2-6e5f-4f85-8bb6-413d08100306`, and the incorrect deployment is now
`REMOVED`.

The first Kinsta immutable-release publication attempt created an empty,
unreferenced release directory with mode `0555`, then failed before pointer,
route, or plugin mutation. The empty directory was positively verified,
removed, and the corrected publication succeeded. No live byte changed during
that failed attempt.
