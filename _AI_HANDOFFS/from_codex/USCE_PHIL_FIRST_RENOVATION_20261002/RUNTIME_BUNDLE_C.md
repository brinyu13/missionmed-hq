# Qualified USCE runtime C18

Independent-approved J8 route and recipient/claim guard. Exact18-file closure; no qualification overlay, credentials, applicant data, new dependency or symlink. Retain outbound hold through migration/cutover. Source is deliberately manual for this isolated service. Full root qualification pending below.

```json
{
  "files": {
    ".railwayignore": "684ccd061ac098eb43848fe959a8176ce5e280d123c9ea76097222e2048e33cf",
    "missionmed-hq/lib/usce-postmark-qa-guard.mjs": "95f4a47724b8ea7aaa87d8b74c54749821db4643d2290d016f809e45d6bd5241",
    "missionmed-hq/lib/usce-session-token.mjs": "91adfa7643e261b5b3784a384216040e4ddae62999e257d1c7316308f895f416",
    "missionmed-hq/package.json": "246e2764046a9415dcc38bab868e0aa4742e8887370f9926d8e636e6c978b047",
    "missionmed-hq/question_selector.mjs": "79c41d6f234c12044212cb500a18c89233165e61560dd0cde0bc28c07165b914",
    "missionmed-hq/routes/gmail-comms-review-write.mjs": "e268a673caa001e683dbb60cb13f576778fc4d1e7b9cd44cdf66b75a398bd9ef",
    "missionmed-hq/routes/gmail-metadata-proof.mjs": "8217cd08349f5987df89e7322c249a33b3ec321b10fb268b1011c31c1bd5661b",
    "missionmed-hq/routes/gmail-sync-preview.mjs": "ec94d2a2a905bce9da6625d1a0cc282955c73c481fb815b55af4da944580870c",
    "missionmed-hq/routes/usce-offer-portal.mjs": "c54d63a12cdbb6b3a307cc4131e551f20e5d73388835b155328d0181369091dc",
    "missionmed-hq/routes/usce-public-intake.mjs": "18f90794817828026f420d002d99a4d8ed94618428b6e6238c044901ec0cab67",
    "missionmed-hq/routes/usce-status-tracker.mjs": "e899c7c414ffbd83d10a9ed0d648f569fa8ab32022b80db35e276b35b8187429",
    "missionmed-hq/saf_analyzer.mjs": "1006b8a7c6152b357600d01181abc90dd70815da7673eae8aedf6ca4baaca6b6",
    "missionmed-hq/server.mjs": "3fa4021958fb6a12f0191c9f6a34de72ce23ea08855efbafed0e1b1a0c192619",
    "missionmed-hq/usce-gateway-policy.mjs": "180e77fcd06807efcb6654285447973a844d71a88fd85aa88ad4af113a9824af",
    "missionmed-hq/usce-gateway.mjs": "c45132fde2d0b881fa40bbe7906eda4ffc4b1130761fd2e5d0dee1aedfef99d8",
    "missionmed-hq/worker_metrics.mjs": "01764dfbed60b50bd4925285dfb7aa5ebf2b7d06126c6be3d05c5a8b78e68672",
    "package.json": "8d7286c4622ac2d34c71526180667b45e7f482279dcb31847e1508112ee18991",
    "railway.json": "28d35b936c695cebadcc0d0a2f2a40f76b5cc872e87da91fc6ef597eaa394564"
  },
  "start": "node missionmed-hq/usce-gateway.mjs",
  "scope": {
    "project": "29afe885-b9b1-425d-8fd8-8611cd275409",
    "service": "643853a7-4a40-4418-86be-05807b5d80cc",
    "environment": "ed3353f7-bcc7-4e25-a000-3c9fc628a9a7"
  },
  "upload_flags": [
    "--no-gitignore",
    "--path-as-root"
  ]
}
```

Root integrated qualification: 130 substantive assertions passed (27operations+31recipient+10send+12sender+50runtime); Node counts81 tests because runtime50 assertions run as one suite. Exact C18 source-root qualification50/50 passed independently of the canonical source invocation. Network intercepted; no provider send. J8 real PostgreSQL81 checks independently passed earlier. An earlier cwd-only repeat still imported canonical source and is not counted as bundle proof.

Held production deployment b4fde0e2-5c0b-4589-9caf-fff5021e0b7c SUCCESS; sha256:65e846c9c1ced5895b2d96c9be4adbf3c8f3d4ae344a11024d1639dced88ed7b. /health200/statusok. Current source2a7e1fc63f2ce158e07a185249a8da00150b6556. Live correction/recovery acceptance pending.

Exact C18 held recovery: {"deployment": "2b79c0c8-c132-426f-84c4-ec53be288bdd", "image": "sha256:1441a8b39f2a37429a183df7999cca6529eee56d7c5e60e65f432718acb032ab", "health": "status:ok", "outbound_held": true}; compatible deployed additive schema untouched. This is current guarded artifact reinstallation, not a return to an unsafe historical sender.

Controlled independent QA transport ready 2026-10-02T21:24:24.945333+00:00: {"deployment": "98875fa0-499f-412a-a596-b2dc2fd72200", "image": "sha256:06a5aa2c13fa1a401fe8354f3be31965aa31f23a831a6c2858bf39025293a1bf", "health": "status:ok", "source_files_verified": 18, "recipient_guard_exact": true, "intake_held": true, "offer_qa_live_enabled": true}; root sends none, reviewer may send exactly one labeled synthetic offer to approved inbox. Normal safe configuration restoration remains required.
