# MR-WEB-0904B Provider Snapshot Evidence

Status: **PASS**

## Provider-native recovery point

- Provider: Kinsta / MyKinsta
- Site: MissionMed Institute
- Environment: Live
- Provider site locator: `abb6097b-9884-4b75-a9c7-d247728395cc`
- Provider environment locator: `a23bbbca-55af-4d03-9447-1015a1e18dc8`
- Backup type: manual environment backup
- Created: September 4, 2026, 9:10 AM EDT
- Expires: September 18, 2026, 9:10 AM EDT
- Provider label: `MR-WEB-0904B pre-production P0 entitlement + launchBack`
- Restore mechanism: MyKinsta **Restore to** control
- Visible confirmation: backup row and restore control were re-read from the authenticated provider UI.

MyKinsta does not expose a per-backup object ID in this manual-backup table. The recovery point is unambiguously identified in the provider by the site/environment locators, creation time, and label above; the provider-native restore control is visible in the captured evidence.

A second, newer manual recovery point was visible after the entitlement work and before the content-truth activation:

- Created: September 4, 2026, 1:19 PM EDT
- Expires: September 18, 2026, 1:19 PM EDT
- Provider label: `pre mission res update`
- Restore mechanism: MyKinsta **Restore to** control

Screenshot: [MyKinsta manual backups](screenshots/mykinsta-manual-backups-2026-09-04.png)

The existing encrypted local recovery set was retained as secondary recovery evidence and intentionally remains outside Git. No production database was replaced from staging.
