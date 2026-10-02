# Qualified guarded USCE runtime release B

Integratedsource50/50; exact18filebundle50/50; send10 andQAguard31 PASS. Everyexternalnetworkintercepted. No overlay/env/PII/symlinks. Upload--no-gitignore --path-as-root exactpinsbelow. Preserveoutboundholdthroughcutover.

```json
{
  "qualification_overlay": false,
  "files": {
    ".railwayignore": "684ccd061ac098eb43848fe959a8176ce5e280d123c9ea76097222e2048e33cf",
    "missionmed-hq/lib/usce-postmark-qa-guard.mjs": "95f4a47724b8ea7aaa87d8b74c54749821db4643d2290d016f809e45d6bd5241",
    "missionmed-hq/lib/usce-session-token.mjs": "91adfa7643e261b5b3784a384216040e4ddae62999e257d1c7316308f895f416",
    "missionmed-hq/package.json": "246e2764046a9415dcc38bab868e0aa4742e8887370f9926d8e636e6c978b047",
    "missionmed-hq/question_selector.mjs": "79c41d6f234c12044212cb500a18c89233165e61560dd0cde0bc28c07165b914",
    "missionmed-hq/routes/gmail-comms-review-write.mjs": "e268a673caa001e683dbb60cb13f576778fc4d1e7b9cd44cdf66b75a398bd9ef",
    "missionmed-hq/routes/gmail-metadata-proof.mjs": "8217cd08349f5987df89e7322c249a33b3ec321b10fb268b1011c31c1bd5661b",
    "missionmed-hq/routes/gmail-sync-preview.mjs": "ec94d2a2a905bce9da6625d1a0cc282955c73c481fb815b55af4da944580870c",
    "missionmed-hq/routes/usce-offer-portal.mjs": "3c2a7bfb96f6e6b4332961cc43c6f4544b4068e17910b0e2f3134ce96acf6d69",
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
  "upload_flags": [
    "--no-gitignore",
    "--path-as-root"
  ],
  "scope": {
    "project": "29afe885-b9b1-425d-8fd8-8611cd275409",
    "service": "643853a7-4a40-4418-86be-05807b5d80cc",
    "environment": "ed3353f7-bcc7-4e25-a000-3c9fc628a9a7"
  },
  "safe_recovery_requires": [
    "disable live offer sending before cutover or rollback",
    "keep public-intake force-dry-run active through synthetic QA",
    "retain exact controlled recipient policy during live QA",
    "never restore the preclaim legacy sender after the safety migration",
    "review exact closure hashes before --no-gitignore upload"
  ]
}
```

[
  {
    "label": "integrated",
    "passed": 50,
    "total": 50
  },
  {
    "label": "bundle",
    "passed": 50,
    "total": 50
  },
  {
    "label": "send and guard",
    "passed": 41,
    "exit": 0
  }
]
