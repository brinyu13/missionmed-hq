# Deployment pins

- Railway project: `c0113625-951e-46ab-939b-dd57acc0e87c`
- Environment: `549d6597-1962-44cb-b0f5-7d88bd025e31`
- RISE service: `9bce2090-ce45-4572-8291-e8da5d42acb6`
- Worker service: `a2cab443-b683-4a23-8f32-bf1351015f42`
- PostgreSQL service: `58236876-7616-4a6b-9792-bfdb114b51d8`
- Final application-source commit: `0c066adc08d9a3d07da6c06941688bc03bb81f80`
- Final deployment: `ae604e94-c690-4d2c-9508-7dd9877b3c39` (`SUCCESS`, instance `RUNNING`)
- Final build: `rise_web_8a55c2a73ee5`
- Final asset manifest SHA-256: `7f1b2f2326a239e4cd47b03e39cb04f4a171f291fce180056a54e0acd73d0c0f`
- Final image digest: `sha256:103c530d2a85964b957d699a907ffe6bdc386dafea11669743ec5255b87caa5b`
- Immediate previous successful deployment: `cba27071-3176-427f-8847-c2fd234f3920` / build `rise_web_448082ef03f2`.

Intermediate successful deployments were `79c7ae6b-d550-4f7c-99ee-edcd4d70a460` and `67020572-7ee4-4313-9512-f0d0011360d8`. Earlier failed/skipped Railway attempts never replaced the known-good baseline; their identifiers remain in provider history.

Final-deploy diagnostics: `cdce9e61-07bf-43ee-938e-2f6a43c34c56` failed closed on the stale manifest environment pin; after correcting that pin, `2d243d6f-6039-445e-8f43-ff5ac2345f29` failed closed on the stale build-ID pin. Both mismatches were repaired under bounded PATH leases, and `ae604e94-c690-4d2c-9508-7dd9877b3c39` passed health and became the sole active RISE deployment. Removed snapshot attempts `53a83560-87f2-41c9-9530-796d0954be95` and `1da5281f-3ac3-452d-be32-432f5b850198` never built or served traffic.
