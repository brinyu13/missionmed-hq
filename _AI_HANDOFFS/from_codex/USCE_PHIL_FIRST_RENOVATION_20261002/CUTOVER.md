# USCE cutover

2026-10-02T16:44:34.301288+00:00
Exact isolated Railway service 643853a7-4a40-4418-86be-05807b5d80cc outbound flag set false, private configuration readback confirmed. Accepted current image redeploy requested without --from-source. Original4ea220b8 image sha256:f81beeb49654d20581e09909a5ae16284b27f84abcb9b10f4b7ef299196270d2 retained. Runtime deployment/readback and disabled-provider endpoint proof pending. No migration/CDN apply yet. Keep outbound disabled through cutover and legacy recovery.

Deployed flag-off release207c2721-74cd-4200-910a-fb074df3c419 SUCCESS; accepted commit8ca364b4162714d93f4835d3a6608b71fc47e5a7; image sha256:024c93e9cb5bb71df1aea861ce87178ca120c4c7fc4bcb31bfc5a499e953c93c. Existing authorized Brian Chrome session /api/auth/session200 admin_role true. Bounded send request to a random nonexistent synthetic offer returns503 postmark_live_send_not_configured / postmark_live_send_disabled before database or provider. No email sent. Active old-instance removal/drain independent check pending.

Safety migration applied once at provider version20261002131800; exactb532SQL. Real88intakes/66offers fingerprints unchanged. Outboundofferfalse, offerdrytrue, intakeforcedrytrue privatelyconfirmed. Exact17reviewedfilemanifest uploaded to isolatedservice only; deploymenthealth pending. Old4ea removed independently.

Firstupload339c1460 FAILED safely: CLIhonoredglobalJSONignores and Railpack sawonlymissionmed-hq/.207c remainedhealthy. Correctedexact17fileupload uses--path-as-root --no-gitignore, outboundheld. No bundle/source bytes changed. New health readback pending.

Brian normalentry Liveprotected. TwoCDNsource/R2/publicexacthashesCDN_RELEASE.md after contactfallbackfix. Independentlyapproved QAguard configuredwhileoutboundheld andexact18fileB uploaded; healthpending.

Guarded dry-run stage: accepted89ac image source redeploy requested without --from-source after isolated repo disconnect. Offer path enabled with offerdry-run true, intakeforcedry true, exacttestrecipient guard privately verified. No provider email can be sent in dry-run. New health/deployment readback pending.

ControlledQAtransportconfiguration setter timed out; freshprivate readback confirmed exactintendedstate and recipientguard, so setter was not replayed. Accepted7e79source redeploy thenrequestedunderfreshlease without --from-source. Temporarycontrolledrecipient/testlabel policy retained; intakeheld. Awaitnewdeployhealth beforeoneboundedtestsend.
# Controlled transport readback

Deployment9b004388-1217-45a0-941b-ce23be966ad1 SUCCESS, image sha256:d30302b8cf1b76f01bc04198e32e6e655f2030018f983f03f1f92bab960d5911, one RUNNING instance22fadca2-2493-4ae2-940f-03c7c8b644d8. Start node missionmed-hq/usce-gateway.mjs, repository source disconnected. Private correct flag-name readback confirms offerlive enabled/dryoff, intakeforcedry, exact QA alias allowlist. A first diagnostic used incorrect guessed variable names and is not configuration evidence; corrected source-defined names verified before the UI send. One controlled offer email delivered; no other recipient/provider write. Final normal-configuration cleanup remains pending acceptance.

## J8 cutover outbound hold

{
  "held_deployment": "e52fef2f-2d9b-48fe-ab8e-60687fa1b062",
  "status": "SUCCESS",
  "image": "sha256:5987081c57852566cc992734a5b5c5a64b59f80a0fbf560edb2ffadb4f632c31",
  "prior_deployment": "9b004388-1217-45a0-941b-ce23be966ad1",
  "time": "2026-10-02T20:07:35.289012+00:00",
  "outbound_held": true,
  "qa_alias_verified": true
}

## Reviewed C18 production cutover

```json
{
  "deployment": "b4fde0e2-5c0b-4589-9caf-fff5021e0b7c",
  "status": "SUCCESS",
  "image": "sha256:65e846c9c1ced5895b2d96c9be4adbf3c8f3d4ae344a11024d1639dced88ed7b",
  "source_commit": "2a7e1fc63f2ce158e07a185249a8da00150b6556",
  "closure_files": 18,
  "route_sha256": "c54d63a12cdbb6b3a307cc4131e551f20e5d73388835b155328d0181369091dc",
  "outbound_held": true,
  "time": "2026-10-02T20:28:26.137240+00:00"
}
```

Healthy HTTP200/statusok. Initial verification incorrectly expected an ok boolean after SUCCESS and stopped before receipt/pin writes; corrected readback without repeating upload/deploy. Previous e52 held release nowREMOVED. No unsafe send or data rollback. Shared default-branch Dependabot alerts4(form-data/ws/esbuild in root package-lock.json) were classified read-only; C18 contains neither package-lock nor external dependencies and imports only local/built-in Node modules. No shared dependency change.

C18 held exact-image recovery redeploy dispatched without from-source. No SQL/token/claims reversal. Provider status readback pending.

Recovery readback after image assertion: Railway redeploy rebuilds retained source and yielded new image1441a8; command not replayed. Deployment2b79c0c8 SUCCESS, oldb4fde REMOVED. All18 remote filesystem hashes equal qualified C18 closure via SSH, same file/service manifest/property mapping, routec54d63 and gatewayc45132 exact. Source recovery custody proved; no mutation until resolved.

Exact C18 held recovery: {"deployment": "2b79c0c8-c132-426f-84c4-ec53be288bdd", "image": "sha256:1441a8b39f2a37429a183df7999cca6529eee56d7c5e60e65f432718acb032ab", "health": "status:ok", "outbound_held": true}; compatible deployed additive schema untouched. This is current guarded artifact reinstallation, not a return to an unsafe historical sender.

Recovery completed: guarded C18 same-image reinstallation, exact compatible operations baseline frontend rollback and StoryForge reapply; all checks held, no SQL reversal, no email/payment/business write. Final normal production config restoration and independent accepted-case continuity remain separate.
