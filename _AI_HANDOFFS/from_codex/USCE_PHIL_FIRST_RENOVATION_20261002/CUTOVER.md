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
