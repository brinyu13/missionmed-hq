# MX-DASH-6000D Pre-Deployment Rollback Manifest

Captured: 2026-09-02T19:27:45Z
Source commit: `7dd779fb56100cb67dac57fdaa8000e09a189916`
Production plugin root: `/www/theresidencyacademy_209/public/wp-content/plugins/missionmed-hub`
Private backup root: `/www/theresidencyacademy_209/private/matrix-dashboard-backups/MX-DASH-6000D/20260902T192745Z`

## Production Preimages

| Path | Pre-deploy SHA-256 |
|---|---|
| `missionmed-hub.php` | `8fcad47436af43a359e69b8d9ebe741e92d02fcc96b1760d1a9e8347c091a850` |
| `includes/class-mmed-student-os.php` | `b7a65e6e7e9dac2fe24694284860c9f159d04b0bb28c527f57e5442b01f30f2c` |
| `includes/class-mmed-dashboard-experience.php` | absent |
| `assets/dashboard-v2/mmed-dashboard-v2.js` | absent |
| `assets/dashboard-v2/mmed-dashboard-v2-art.js` | absent |
| `assets/dashboard-v2/mmed-dashboard-v2.css` | absent |

The five approved-drift assets not touched by Dashboard 2.0 were also copied
to the private backup and must remain byte-identical:

| Asset | Required preserved SHA-256 |
|---|---|
| `assets/student-os.js` | `30068939fc54fb4a21209de4962977b9aa1a89a9557a046d367b1737624c570b` |
| `assets/student-os.css` | `707ab52f7157db618be307f83548b2410d5cdb82359fc6c0f47025996c275260` |
| `assets/student-os-calendar-v4.js` | `6a1ca3d7e4b955ea4cbea13f956b08f1533b638264d94c11ded5ead6703cb480` |
| `assets/student-os-calendar-v4.css` | `b6a858491aade89770383b498433578a657d87b71d738dc71b49c216f420598e` |
| `assets/student-os-storyforge.js` | `a4aa9665012206771fc8549c897cb5d22801899347c706626062dbafb29c81fa` |

## Pre-Deploy WordPress State

The read-only `wp option list --skip-plugins --skip-themes` and direct
`wp_options` query both returned no `mmed_dashboard_*` rows. Therefore:

- `mmed_dashboard_v2_enabled`: absent, resolves false
- `mmed_dashboard_experience_default`: absent, resolves `classic`
- `mmed_dashboard_force_classic`: absent, resolves false
- `mmed_dashboard_v2_invite`: absent
- `mmed_dashboard_featured_apps`: absent

## Intended Deployment Hashes

| Path | Intended SHA-256 |
|---|---|
| `missionmed-hub.php` | `69576a2e6676480253f1cbd6d4749985af6e2d03897bd0c26a0977096c2acabd` |
| `includes/class-mmed-student-os.php` | `b6565d9f0bff0b7b4ae21027818668bb632e8b90d80c992bb784840b1dd15406` |
| `includes/class-mmed-dashboard-experience.php` | `675f0cad1b99b2fcad621b818fb15e8f28902df2811c9b139d3b96e7cbfce477` |
| `assets/dashboard-v2/mmed-dashboard-v2.js` | `f984adcebff66ca320f9c75b0c405eb55e00f849de4195fad5067d6ccb5115c1` |
| `assets/dashboard-v2/mmed-dashboard-v2-art.js` | `ac77de458b893d38c20c622099b5996b5cb464de0e74cc1868f91ca3dabaffaf` |
| `assets/dashboard-v2/mmed-dashboard-v2.css` | `9d421dee6d4f98158281a48b5cfdf4b6dee6a395956206068bf58caf90b8c707` |

## Rollback Procedure

1. Immediately set `mmed_dashboard_force_classic=1`, or set
   `mmed_dashboard_v2_enabled=0`, using the authenticated Dashboard
   Experience settings flow.
2. Restore only `missionmed-hub.php` and
   `includes/class-mmed-student-os.php` from the private backup root.
3. Remove only the four Dashboard V2 files that were absent before deployment.
4. Verify the two restored SHA-256 values and the five preserved drift hashes
   against this manifest.
5. Verify Classic Dashboard loads and no Dashboard V2 asset request occurs.

The backup was read back by SHA-256. The two files required for restoration
were copied into a private restore-rehearsal directory and compared byte for
byte with `cmp`; the rehearsal passed. No production file was changed by the
backup or rehearsal.
