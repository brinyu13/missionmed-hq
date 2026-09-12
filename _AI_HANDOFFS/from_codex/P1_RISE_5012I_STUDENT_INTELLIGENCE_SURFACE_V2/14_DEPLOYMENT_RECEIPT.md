# Deployment receipt

| Item | Value |
|---|---|
| Railway project | `c0113625-951e-46ab-939b-dd57acc0e87c` |
| Environment | `549d6597-1962-44cb-b0f5-7d88bd025e31` (`production`) |
| Service | `9bce2090-ce45-4572-8291-e8da5d42acb6` (`missionmed-rise`) |
| Deployment | `d038a968-03ba-4180-82c2-9202173fb7f0` |
| Status | `SUCCESS` |
| Build ID | `rise_web_0cc0c96e1630` |
| Asset manifest SHA-256 | `63b3430a287e157de2685a56811aaeeac5d92259f47df5c1f442f5860164cb62` |
| Image digest | `sha256:105179df4eccc3e4a9bb38e90fb553d1d46e7848fe4f32334256999fb13fb7cb` |
| Canonical API index SHA-256 | `f1cc59f0ae43bf2e54727871c66c07bca604a15ed4bafaf5d9f08de327d21282` |

Provider health readback: registry `rise_registry_2026-07-09_8fdb5afb84f6`, activation `active`, source rights current, production Postgres research storage, global/student research disabled, kill switch enabled.

Railway's upload gateway returned 524 on two earlier attempts after creating deployment records. The final package used Brotli only as a transport optimization; the decompressed API index hash matched the canonical file exactly. One unintended temporary Railway project (`cc897c0b-03ac-4aa8-bc6f-3b8cecf0552c`) was immediately scheduled for deletion; provider readback records `deletedAt=2026-09-14T17:30:42.297Z`.

Rollback targets: immediate prior deployment `fb46701d-38dc-48a1-a856-d6994b2c3350` / build `rise_web_1e77d82c2fc6`; protected 5012H deployment `27747095-6c4f-4973-b30b-9bf78a064350` / build `rise_web_30b01ba29e06`.
