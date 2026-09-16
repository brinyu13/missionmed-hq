# Deployment Receipt

- Railway project: `c0113625-951e-46ab-939b-dd57acc0e87c`
- Environment: `549d6597-1962-44cb-b0f5-7d88bd025e31`
- RISE service: `9bce2090-ce45-4572-8291-e8da5d42acb6`
- Successful deployment: `7c8cf9a4-7ee0-4da6-ba47-db75dc5d4aaa`
- Image: `sha256:95503df6e8153d7848f0de80d6e1fa1123eb034e4ed3ffef16d08c77ca675a04`
- Build: `rise_web_cbdfb1514554`
- Asset manifest SHA-256: `22455534ce24a632e2488c1207b4f99378f95f3706e47e6363555b2fa5791f34`
- Source commit represented by the deployed functional implementation: `e332f06`
- Live health: `ok=true`, service `missionmed-rise`, environment `production`, source rights current.

Migration 015 was applied to the live RISE Postgres database. Final functional readback before custody showed 4 student-program rows, 3 subjects with programs, 0 gold rows after QA reversion, 1 populated session identity projection, and both required operator read policies.

Later CLI archive attempts for the test-only `6e80abb` hardening were not promoted: Railway did not produce an image. The healthy deployment above remained serving throughout. This does not change production behavior because the deployed Postgres adapter already omits notes; `6e80abb` aligns only the in-memory adapter and extends HTTP coverage.
