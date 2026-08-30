# 3528C Matrix Deployment

## Live route

- Matrix tile/link: `IV Prep On-Call`
- Destination: `https://missionmed-hq-production.up.railway.app/iv-prep-analytics/#/home`
- MissionMed HQ service: `missionmed-hq`
- Final deployment: `646ac336-9afd-4db5-9ac1-cdaa20ab12a3` (`SUCCESS`)
- Image: `sha256:dba943d20cbfe2d99e9e22f4f773a1e926dea8af640f839a0c8fdca164f80979`
- Source: `7d7ff104b9a1d4a8897915672e35436901c7844c`

## Matrix guarded assets

| Asset | Production SHA-256 |
|---|---|
| `plugins/missionmed-hub/assets/student-os.373a4be9d77ebaf4.js` | `373a4be9d77ebaf4e8c55f664ffc481d300d24d0e78bf30e5aff94b993caac98` |
| `plugins/missionmed-hub/includes/class-mmed-student-os.php` | `af2eb5fd2177904ec1b3873787eed6b185a873119dc979f0846c237b466f2c3c` |
| `mu-plugins/missionmed-matrix-runtime-pin.php` | `73de44ad8effefa77df8fb02eda6ce96456900e9697d86bc9d7065b590835625` |

Backups:

- `/www/theresidencyacademy_209/private/matrix-runtime-guard-backups/Y1-Y2-CAM-V6-3528C/20260830T045016Z`
- `/www/theresidencyacademy_209/private/matrix-runtime-guard-backups/Y1-Y2-CAM-V6-3528C/20260830T045419Z-fix`

## Browser verification

Matrix sidebar navigation opened the live HQ IV Prep module in the existing authenticated Chrome session. The account rail identified Admin/founder entitlement and loaded the game shell. Anonymous direct access remained denied. This is a real production route, not localhost.

The newest analytics code is deployed. End-to-end launch acceptance remains blocked by recording storage and incomplete human physical/persona QA.
