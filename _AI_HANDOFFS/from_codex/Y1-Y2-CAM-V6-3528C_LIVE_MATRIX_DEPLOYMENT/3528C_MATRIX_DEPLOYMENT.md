# 3528C Matrix Deployment

## Live route

- Matrix tile/link: `IV Prep On-Call`
- Destination: `https://missionmed-hq-production.up.railway.app/iv-prep-analytics/#/home`
- MissionMed HQ service: `missionmed-hq`
- Railway project: `missionmed-hq-fix005`
- Production deployment: `33ed7dcd-41cb-410d-a309-29e3d019065c` (`SUCCESS`)
- Image: `sha256:8fb93c570ed5fef6c98115851466be2cf86ae7981000bc1b40d9a4f5d62159d6`
- Deployed source: `a9a3e41e771e95c346cb74ee40468e1c1177348c`
- Deploy source was a clean git archive of that exact commit; unrelated worktree state was excluded.

## Matrix guarded assets

| Asset | Production SHA-256 |
|---|---|
| `plugins/missionmed-hub/assets/student-os.373a4be9d77ebaf4.js` | `373a4be9d77ebaf4e8c55f664ffc481d300d24d0e78bf30e5aff94b993caac98` |
| `plugins/missionmed-hub/includes/class-mmed-student-os.php` | `af2eb5fd2177904ec1b3873787eed6b185a873119dc979f0846c237b466f2c3c` |
| `mu-plugins/missionmed-matrix-runtime-pin.php` | `73de44ad8effefa77df8fb02eda6ce96456900e9697d86bc9d7065b590835625` |

Guarded backups:

- `/www/theresidencyacademy_209/private/matrix-runtime-guard-backups/Y1-Y2-CAM-V6-3528C/20260830T045016Z`
- `/www/theresidencyacademy_209/private/matrix-runtime-guard-backups/Y1-Y2-CAM-V6-3528C/20260830T045419Z-fix`

## Production verification

- `/health`: `200 {"status":"ok"}`
- Anonymous `/iv-prep-analytics/`: `401 ivprep_authentication_required`
- Authenticated Matrix entry: PASS as `brinyu`, Admin, `ENTITLED · IV PREP 360`
- Real camera/microphone capture: PASS
- Private R2 recording write/seal/library/replay: PASS
- Production error-log matches after deployment: `0`
- Production HTTP 5xx in the observed 15-minute window: `0`

Separate student/non-entitled personas and the full human metric-action matrix remain pending.
