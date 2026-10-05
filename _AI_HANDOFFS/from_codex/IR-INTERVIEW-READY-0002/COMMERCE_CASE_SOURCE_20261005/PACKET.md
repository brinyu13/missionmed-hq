# Commerce case SOURCE packet

Dormant; distinct independent approvals/read/recovery reports required. No account or release acceptance.

<!-- CASE_SOURCE_PACKET_BEGIN -->
{
  "schema": "ir.commerce_case_source.packet.v1",
  "sourceBASE": "b2460b1bd20b7746b2c8a3513186c0e9002f313e",
  "writePaths": [
    "interview-ready/completion.js"
  ],
  "sourcePreimages": {
    "interview-ready/completion.js": "4e1c8edc975c3f907c65b2db30a110f0137e3953d8a692f6d54f192bb3eb921b"
  },
  "plannedSourcePostimages": {
    "interview-ready/completion.js": "d8d805b3a54fa8f2631059598b195f56f39cf6a28a53244709f0d268b968dfb5"
  },
  "sharedDomains": [],
  "scope": "PATH:93cc7bada097a03b5163b83ecfc0d5f8fb2357c6f517b6c6f4a456acc7c155c6",
  "objective": "Make shopping comparison identifier invariant under HTML attribute-template lowercasing; one completion.js identifier only.",
  "patchSequence": [
    {
      "patch": "COMMERCE_CASE_FIX_20261005/case-fix.patch",
      "sha256": "b361a671c156a0d56290a618c7e66fd5c95be4027210b33e638953747473be5b",
      "preimages": {
        "interview-ready/completion.js": "4e1c8edc975c3f907c65b2db30a110f0137e3953d8a692f6d54f192bb3eb921b"
      },
      "postimages": {
        "interview-ready/completion.js": "d8d805b3a54fa8f2631059598b195f56f39cf6a28a53244709f0d268b968dfb5"
      }
    }
  ],
  "publicPath": "/interview-ready/",
  "accountReady": false,
  "accountPersistenceReady": false,
  "releaseApproved": false,
  "releaseState": "public-commerce",
  "preserve": [
    "all engine/photo/credit facts",
    "device-only/public account boundaries",
    "all other source bytes"
  ],
  "excluded": [
    "provider/runtime/DB/OS mutations",
    "all other product paths",
    "release promotion"
  ],
  "workerProtocol": "Unchanged healthy guard immediately before every write/commit; exact one-file pre/postimages; worker stop/drain before Root DONE/release.",
  "rollback": "Precommit only exact admitted one-file preimage under healthy guard after worker drain; postcommit separate reviewed recovery packet. No reset/clean/general checkout.",
  "authoritySupplement": {
    "osHead": "fe17a4ca5572aecdc2d2761e8c2d993f7aebb8bf",
    "decisionFile": "decisions/DR-391_ir_phase1_public_commerce_fallback.md",
    "decisionSha256": "0ac4eace2f96ccfbc10864d7a022cba1eb0c6f9c4eeb0bb668dd342e3c532982",
    "handoffFile": "handoffs/from_codex/IR_INTERVIEW_READY_0002/REGISTRATION_TO_CODEX.md",
    "handoffSha256": "2251e6798c0d117d56276f1bae637f9c6864209ce2f0e1f31a8a71af9b25e00a"
  }
}
<!-- CASE_SOURCE_PACKET_END -->
