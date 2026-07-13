# A1 MMC Drive Download Report

RESULT: VERIFIED_LOCAL_ACQUISITION_COMPLETE

## Source and destination

- Google Drive account verified earlier: info@missionmedinstitute.com.
- Drive folder ID: 1A-HWJMHBEc614lvcW34EOGh6q2nTxeKD.
- Drive file ID: 1ltApiIWgdaahDT0ZZ4uRk6TkNZaCGy8D.
- User-downloaded source: /Users/brianb/MissionMed/A1_MMC_OLD_LAPTOP_EXPORT_003_20260710.tar.gz.
- Approved destination: /Users/brianb/MissionMed_Migration/Incoming/A1_MMC_OLD_LAPTOP_EXPORT_003_20260710.tar.gz.

The downloaded source was preserved untouched. A copy-on-write APFS clone was created under Incoming with a unique temporary name, validated, and atomically renamed only after all three outer gates passed. No existing target was overwritten.

## Exact verification

| Gate | Expected | Observed | Result |
| --- | ---: | ---: | --- |
| Bytes | 2335757222 | 2335757222 | PASS |
| Tar entries | 330 | 330 | PASS |
| SHA-256 | 58eb5962a1ce6cfdbb5f50763a8cea041b68d7e99cc87f8039ead9766e14e049 | exact match | PASS |

The prior Google Drive large-file warning is no longer a blocker because the user supplied the completed local download.
