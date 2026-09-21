# PSV Silma Real-ROOT Canary Report

Updated: 2026-09-21T07:57:06Z

## Verdict

- Live technical canary: **PASS**
- Founder review state: **READY, not approved or saved**
- Independent verification: **PASS**, no P0/P1 findings
- Broad real-student generation: **CLOSED**

## Authority and exact scope

- Mission: `PSV-PROTOTYPE-0001`
- Canonical authority: `DR-324`
- MissionMed OS: `844ce736d66bf497aa74b00b5267c32394649965`
- WordPress user: `1` (`brinyu`)
- Student/specialty: Silma Raisa / Internal Medicine
- Normalized ROOT SHA-256: `8ff9e2bbf5249e75e476068ab0586b466821f6d9ab6165e24e9ed812673a72e0`
- Authorized region: `REPLACE_PARAGRAPH`, zero-based index `7` (Paragraph 8)
- Authorized program ID: `rise_ps_2cab0660-e696-5600-90a6-883aacd45b91`
- Verified program ID: ACGME `1401100940`
- `MMED_PS_PROTO_ALLOW_REAL_ROOT_AI`: undefined
- Runtime privacy authorization: `REAL_ROOT_CANARY`

## Source and ROOT proof

- Pages archive SHA-256: `684b3f310bc746e1108e10b80f049635566717454f5501cee7d01c4db6ee7bc3`
- Exported DOCX SHA-256: `8fbaabd3f5aa648c4d48b22c80269a1d0bb63c9a6165b657caf43fd242a784eb`
- Paragraph count: `9`
- Paragraph hashes, in order:
  1. `70eb68e76f2537fe4864aa9bdfaba478f115ac8f29f80efd6930795a1d6cc55b`
  2. `4710bc6e533d1b62d1619f0126e607308f2b80e752360fc5c630eb5aab381f2c`
  3. `b998fa4bed2480dc4018035bcd15393df88f8d26646bdc0191198b7f14120f21`
  4. `7064be1ad6914f94508d67eff697f3598bdd302430c901629cc1e21a4db998b3`
  5. `358f313491814614536fc53f4695480d8924b630262a50776f4928c2341a3f80`
  6. `ae1d2e8d3dd60974a0ea2f49144d15530c18b9b120cc1773fde8950c18673c5c`
  7. `1e42eaa09d218374006ee7d78f1674779c4994a5b0acf9d056c0077bffebc971`
  8. `623ae0f5e0ffe570f4c89bcb1ac3e297f38b5c798ce9d284f2d2da26d6aaf854` (authorized replacement only)
  9. `6d941b817abfc901b28d1b4ee23e38abfc44470bacefa29318d477fc5a34cc3e`
- Protected Paragraphs 1-7 aggregate: `fe2ace197191fbc81ad6706fea3bd0d501cfb22fd4a176029846a1e7a266ab84`
- Protected Paragraph 9 aggregate: `6d941b817abfc901b28d1b4ee23e38abfc44470bacefa29318d477fc5a34cc3e`

## Exact release custody

- Branch: `codex/psv-prototype-foreman`
- Live source commit: `c2cff9dd922f3632c59068a980e749100491df33`
- Plugin: `missionmed-file-vault-ps` version `0.5.8`
- ZIP: `/tmp/psv-silma-0.5.8-c2cff9d.e41Y2g/missionmed-file-vault-ps-0.5.8.zip`
- ZIP SHA-256: `1f9b11b1eeff4994f67f5a5f52985711125fba2acd953a01d2e887d2f6c39342`
- Manifest SHA-256: `90c0ba3668f77e3619dc5daf06fb7c035632b264538376e85b52d31fd9529edc`
- Live manifest: 24/24 files PASS, no mismatch; production PHP lint 21/21 PASS
- Deployment lease: epoch `3485`, released
- Prior v0.5.7 rollback: `/www/theresidencyacademy_209/private/psv-rollbacks/PSV-0.5.8-c2cff9d-20260921T074206Z/live-retired`
- Earlier v0.5.6 rollback: `/www/theresidencyacademy_209/private/psv-rollbacks/PSV-0.5.7-d6e3fe1-20260921T073522Z/live-retired`

## Provider run and five-candidate proof

- Run UUID: `9b7925e4-f2b3-45d2-90bd-7b0717527a50`
- Provider/model: `openai-responses` / `gpt-5.6-terra`
- Prompt version: `mmps-prompt.v2`
- Requested/effective tier: `DEEP` / `DEEP`
- Status: `OK`
- Provider-backed run count for the exact ROOT/program: `1`
- Provider network attempt: one `http_200`
- Top-level blocking validations: `0`
- Candidate count: `5`; distinct strategy IDs: `5`; distinct replacement hashes: `5`

| Strategy | Recommended | Replacement SHA-256 | Full reconstructed PS SHA-256 | Protected ROOT | Blocking checks |
|---|---:|---|---|---:|---:|
| `TRAINING_ENVIRONMENT` | No | `6eccd6f1fd3f44a432ad7a2285ef469fbb88fcd7cac33f4f15ed7d75637077be` | `00f166890a565ace2aac6842dee488b4c5b937f68a50a4baa5398f473fb497ed` | PASS | 0 |
| `STUDENT_GOAL_FORWARD` | No | `79a0c367d6a755b433d81f06dd0d735c34a7d8aff86cd8e60157370cf0e488b1` | `c53d688ae5516ee379a6413b7f812bb7de2091b89a87130d7072b60e84c54be9` | PASS | 0 |
| `RESEARCH_FELLOWSHIP` | No | `9a7224e2f912724ba627c4f491f21653570df2f80cc2b22d955a572cb2283b1f` | `e20a80d5743b9fd6debf102c4494a705ee22a3662412aa158726d78f89b2eed0` | PASS | 0 |
| `LOCATION_PROGRAM_TYPE` | No | `88416287a2a3838175109b1d9c7e9a0df4a3de3a6fbf0992ecadf87139b104a8` | `e0b7e38f7c995ae251d864acc9dc6918f5a26ddc93c072de486e1b75c1b0b7f8` | PASS | 0 |
| `BALANCED_QUIET_SPECIFIC` | Yes | `8f8e03a79fa77e4e5df4c044b589700b4685a5ebea845fbb4b2dfb0fa59765f3` | `a2a26e1aae86d883ca3b6725f253d1b36369a3acc63d277f797487cb0225ad0d` | PASS | 0 |

Every candidate used only fact IDs from the five-fact verified bundle. Every reconstruction contains nine paragraphs, one authorized replacement and eight protected paragraphs. `MMPS_Region::verify_protected` returned PASS for all five.

## Live Founder interface

- Fresh authenticated reload identifies ROOT ID `4` as `Review candidates`.
- Opening it restores run `9b7925e4-f2b3-45d2-90bd-7b0717527a50` without another provider call.
- The interface shows all five named strategies and marks `Balanced and quietly specific` recommended.
- Each of the five selection controls reconstructs a nine-paragraph preview with one editable region and eight protected paragraphs.
- UI ROOT check: `UNCHANGED 8 protected paragraphs match`.
- Founder review-only notice: visible.
- Save draft, approve/save and regenerate: disabled.
- The authenticated review tab remains open for Dr Brian.

## Privacy, ownership and regression proof

- No candidate was automatically approved or saved; no library document exists for this run; library count remains `8`.
- No batch, second program, second student, native File Vault write or RISE write occurred.
- RISE transport remains `FILE_VAULT_SESSION_FORWARDED_GET_V1`; its only canary paths are GETs for the signed-in user's program list/search/detail. ROOT/candidate prose is never part of a RISE request.
- Dedicated PSV key presence was checked only as a boolean; no secret was inspected, printed, hashed, logged, copied or committed.
- Anonymous home and flagged URL: HTTP `200`; anonymous PSV bootstrap: HTTP `404`.
- Recent severe log count: `0`.
- Protected File Vault hashes remain:
  - controller `e906c0a42aab3f7f6674e6c581be903b37ba04e792efc4e477f149c4e80fa265`
  - repository `d54e2d2ffc564785b5fc2023ba65544a198713a618aaeaca2ae202f9cce14c16`
  - scanner `9839b9a54a98e90fd92490af0d33dba0fde79488a3a35250a62f237ba263cf25`
  - JS `0a3caa654d9b6724270133e89b7cf6e7c6201eef449ddf8ca8067e43f1f8bdd9`
  - CSS `87c932a3b20b5e6b5351a5ee5bda08c0489bea5195df007cb0f70d6d21e9d9f2`
- Active PSV deployment lease count: `0`.

## Fresh independent verification

- Verdict: **PASS**; P0/P1 findings: none.
- Independently matched canonical DR-324, exact pushed source commit, ZIP/manifest/archive/deployed 24-file custody and production PHP lint 21/21.
- Independently confirmed the exact real-ROOT tuple, exactly one provider-backed run and provider attempt, five unequal replacement values and strategy IDs, five nine-paragraph reconstructions, eight protected paragraphs PASS for each candidate, zero blocking validations, and all used fact IDs within the supplied RISE bundle.
- Independently confirmed `REAL_ROOT_CANARY`, broad and testing gates undefined, one authorized program, no saved document, no canary batch, library total `8`, RISE GET-only/no ROOT payload path, unchanged File Vault hashes, public `200/404` gates, zero severe findings in the latest 5,000 log lines, and zero conflicting PSV leases.
- The verifier intentionally did not open the authenticated rendered UI to avoid student-prose exposure. The Foreman's separate live browser replay proved reload restoration, all five selectors, nine paragraphs with one editable/eight protected for each, the Founder-review-only notice, and disabled save/regenerate controls.

## Stop state

The canary is held in review-only state. Do not approve/save a candidate, run a batch, add another program/student, enable the broad real-ROOT gate, or change File Vault/RISE ownership surfaces before Founder review.
