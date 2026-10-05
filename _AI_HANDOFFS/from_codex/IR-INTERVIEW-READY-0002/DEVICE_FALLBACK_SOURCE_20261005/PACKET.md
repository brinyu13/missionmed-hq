# Device fallback SOURCE typed packet

Dormant with exact DR391 supplemental custody; independent controls required. No account/native/production acceptance.

<!-- DEVICE_SOURCE_PACKET_BEGIN -->
{
  "schema": "ir.device_fallback_source.packet.v1",
  "sourceBASE": "341c9ad88b0c00ea0b09a0e3bbf04eeb770b89e5",
  "writePaths": [
    "interview-ready/account.js",
    "interview-ready/build.py",
    "interview-ready/phase1.json",
    "interview-ready/phase1.js"
  ],
  "sourcePreimages": {
    "interview-ready/account.js": "018a0e2f3706f2f5cbe64ddb8b8fb2cf2b07b640730c7b3211cbc4397b17518a",
    "interview-ready/build.py": "fa3e73e912d9c0f8c114d04f64043ab33bc6d6e21ba8d07c7e8e5e3ca13a050c",
    "interview-ready/phase1.json": "c552cc20f09a7dce76c91a22bfd507e91c6d33b78b043df9f420fdf57d1351c0",
    "interview-ready/phase1.js": "bd575317e9eba2409ebb91a59034c0ecb4274eb2510b24cdef82a753c7690a47"
  },
  "plannedSourcePostimages": {
    "interview-ready/account.js": "cb7462428e0334b66cc789a668a03bfb5214497bfebd9d7cef459aef132a3651",
    "interview-ready/build.py": "286a289655ab8b2754eaf0cb8d265f2cc13eeb8a5d41609f7deec6dfcb91413b",
    "interview-ready/phase1.json": "84bf2ad8c3055bd8c3ab36b87377ba356b6c89e05ee707399a56e124b83bb732",
    "interview-ready/phase1.js": "efca9bcf2dc3aa48ccf01aed1033567056cc8cb2156f3f93fcf33662e39a5141"
  },
  "sharedDomains": [],
  "scope": "PATH:93cc7bada097a03b5163b83ecfc0d5f8fb2357c6f517b6c6f4a456acc7c155c6",
  "objective": "Apply explicit device-only fallback on integrated shopping; no account readiness or server authorization change.",
  "patchSequence": [
    {
      "patch": "FINISH_NOW_DEVICE_FALLBACK_20261005/PUBLIC_ONLY/device-fallback.patch",
      "sha256": "68b3a96527019d08ee5d95326025954de2160f7c4568a07dbf47a04ad6849374",
      "preimages": {
        "interview-ready/account.js": "018a0e2f3706f2f5cbe64ddb8b8fb2cf2b07b640730c7b3211cbc4397b17518a",
        "interview-ready/build.py": "fa3e73e912d9c0f8c114d04f64043ab33bc6d6e21ba8d07c7e8e5e3ca13a050c",
        "interview-ready/phase1.json": "c552cc20f09a7dce76c91a22bfd507e91c6d33b78b043df9f420fdf57d1351c0",
        "interview-ready/phase1.js": "bd575317e9eba2409ebb91a59034c0ecb4274eb2510b24cdef82a753c7690a47"
      },
      "postimages": {
        "interview-ready/account.js": "cb7462428e0334b66cc789a668a03bfb5214497bfebd9d7cef459aef132a3651",
        "interview-ready/build.py": "286a289655ab8b2754eaf0cb8d265f2cc13eeb8a5d41609f7deec6dfcb91413b",
        "interview-ready/phase1.json": "84bf2ad8c3055bd8c3ab36b87377ba356b6c89e05ee707399a56e124b83bb732",
        "interview-ready/phase1.js": "efca9bcf2dc3aa48ccf01aed1033567056cc8cb2156f3f93fcf33662e39a5141"
      }
    }
  ],
  "persistenceMode": "device-only",
  "publicPath": "/interview-ready/",
  "accountReady": false,
  "accountPersistenceReady": false,
  "releaseApproved": false,
  "releaseState": "public-commerce",
  "namespace": "mmed-ir-device-v1",
  "preserve": [
    "default account branch",
    "normal build production blockers",
    "server /app gate and API authorization",
    "engine/photo/credit/shopping custody"
  ],
  "excluded": [
    "provider/runtime/DB/OS mutations",
    "account/nonce/subject/network persistence",
    "media/names/free text/legacy keys",
    "generated dist/release promotion",
    "any other product paths"
  ],
  "workerProtocol": "Immediate unchanged healthy guard before every write/commit; exact pre/postimages and patch check; one four-path scoped commit; worker stop/drain observed before Root DONE/release.",
  "rollback": "Precommit only exact admitted four preimages under healthy guard after worker drain; postcommit separate reviewed recovery packet. No reset/clean/general checkout.",
  "authoritySupplement": {
    "osHead": "fe17a4ca5572aecdc2d2761e8c2d993f7aebb8bf",
    "decisionFile": "decisions/DR-391_ir_phase1_public_commerce_fallback.md",
    "decisionSha256": "0ac4eace2f96ccfbc10864d7a022cba1eb0c6f9c4eeb0bb668dd342e3c532982",
    "handoffFile": "handoffs/from_codex/IR_INTERVIEW_READY_0002/REGISTRATION_TO_CODEX.md",
    "handoffSha256": "2251e6798c0d117d56276f1bae637f9c6864209ce2f0e1f31a8a71af9b25e00a"
  }
}
<!-- DEVICE_SOURCE_PACKET_END -->
