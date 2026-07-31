# B1-509 Final Complete Combined Handoff

## Final verdict

**STORYFORGE VOICE LIVE FOR THE FOUNDER STUDENT ONLY**

B1-509 is complete for its exact production scope. Recording, private transient
audio storage, near-live OpenAI transcription, editable transcript delivery,
and cancellation cleanup are active for the one Founder student account through
the existing Matrix/WordPress integration. The Founder administrator account is
separate and cannot record. No cohort or general student has voice access.

The canonical application URL is:

`https://missionmedinstitute.com/storyforge/`

## What changed

No product source, migration, UI, authentication algorithm, storage lifecycle
implementation, or assembly implementation changed.

Production-only changes were:

1. Created and scoped private production/staging R2 buckets and credentials.
2. Created a dedicated OpenAI StoryForge project and service credential.
3. Set bounded Railway provider, storage, model, Option A assembly, and force-off
   variables.
4. Added the confirmed Founder administrator as WordPress/StoryForge user 107
   and mapped it to one PostgreSQL admin identity.
5. Used the existing administrator-only E11 endpoint to allowlist exactly the
   Founder student identity.
6. Set `STORYFORGE_VOICE_FORCE_OFF=0` and deployed.
7. Exercised and cleaned up synthetic direct and integrated production probes.

Repository-only changes are these three B1-509 evidence documents.

## Authority

The Founder explicitly superseded the prior dormant-voice strategy, required
voice for the initial StoryForge release, confirmed both credential creations,
confirmed WordPress user 107 as the Founder administrator, and authorized Codex
to complete the activation and validation actions. B1-507/B1-508 product and
security decisions remain binding where B1-509 did not supersede them.

## Preserved product and infrastructure

- Canonical V5 HTML SHA-256:
  `3ac2871ff286552abe89a785ff43967df3315922e3718f67a136b83db1ba8db1`
- Deterministic live WordPress release: `v-a9a076957973d7d4`
- Immutable Kinsta release source:
  `releases/97ebf2433849343acd521547e558a9713c579eb0`
- Railway API service: `storyforge-v5-api`
- PostgreSQL RLS and least-privilege application identity: preserved.
- JWT and same-origin WordPress gateway: preserved.
- RP-8 binding executor: Option A, `concat`.
- Permanent-audio reconciliation: `off`.
- All student-facing AI flags: false.

## Production deployments

- Configuration/credential deployment with voice killed:
  `487eb6b1-39d2-4b8f-b88c-b8e4c9ac0189` — SUCCESS.
- Final Founder-only voice deployment:
  `d5b98049-e24e-45e7-8c1f-6c6dbaef0714` — SUCCESS and online.

Final bounded configuration:

- provider `openai`;
- primary `gpt-4o-transcribe`;
- fallback `whisper-1`;
- assembly `concat`;
- voice force-off `0`;
- reconciliation `off`;
- platform-wide non-voice force-off control `1`;
- production private R2 bucket configured;
- credentials present but never recorded in repository evidence.

The historical Railway metadata variable
`STORYFORGE_RELEASE_ID=v-4f40609482162cbd` remains. It is not consumed by the
API. The public immutable UI is independently pinned to and verified as
`v-a9a076957973d7d4`; therefore the legacy variable is disclosed metadata drift,
not runtime product drift.

## Identity and authorization result

| Identity | WordPress | StoryForge role | Eligible | Voice |
| --- | --- | --- | --- | --- |
| Founder student | ID 1 | student | yes | yes |
| Founder admin | ID 107 | admin | yes | no |

- Allowed WordPress IDs: exactly 1 and 107.
- Allowed cohorts: zero.
- E11 flag scope: `allowlist`.
- E11 allowlist count: one Founder student.
- E11 audit count after activation: one.
- Latest action: `feature_scope_changed`.
- Admin health endpoint: HTTP 200.
- No UUIDs are reproduced here.

## Backups and hashes

### PostgreSQL

- Path:
  `/Users/brianb/MissionMed_private_backups/B1-509/B1-509-RP-PG-PRE-YcpkCPpk/storyforge-b1-509-pre.dump`
- SHA-256:
  `20586ff59b7c0719faa5bba3f32013c59c1d2f90f40ffd5677a6456059632bcc`
- Size/mode: 291119 bytes, `0600`.
- Catalog validation: PASS.

### WordPress

- Settings recovery:
  `/www/theresidencyacademy_209/private/b1-509-wp107-admin-4XFWlzqg`
- Settings SHA-256:
  `c1e2835edbcd44b5f859394a7e99dfd67441f7a017bca27f93f09b477646bfe7`
- Identity recovery:
  `/www/theresidencyacademy_209/private/b1-509-wp107-identity-Tnawklzb`
- Prior-meta SHA-256:
  `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`
- Directories: `0700`; receipt files: `0600`.

## Verification totals

| Gate | Result |
| --- | --- |
| Unit | 219/219 |
| PostgreSQL | 12/12 |
| Acceptance contracts | 130/130 |
| Browser E2E | 59/59 |
| Conformance/accessibility | 72/72 |
| API-only build check | PASS |
| Deterministic provenance | PASS |
| Secret scan | PASS |
| npm audit | 0 vulnerabilities |

The release-provenance command requires an explicit full expected commit. One
invocation without that required input failed closed; the corrected invocation
using exact HEAD passed. This is expected release guard behavior, not a product
failure.

## Production validation

### Direct infrastructure

- Synthetic R2 PUT/HEAD/GET/type/size/DELETE: PASS.
- Synthetic repository-driver transcription: PASS in 1588 ms.
- No human audio or PII used.
- Direct-probe residual objects: zero.

### Integrated public path

Using synthetic speech and the real short-lived Founder student JWT:

- recording create: HTTP 201;
- multipart segment: HTTP 201;
- transcription poll: HTTP 200 and `transcribed`;
- expected synthetic keywords: PASS;
- cancel: HTTP 200 and `cancelled`;
- post-cancel segment count: zero;
- all R2 `storyforge-rec/` objects after cleanup: zero;
- HTTP 5xx during final validation window: zero;
- E13 content-bearing error categories: zero.

The strict WordPress gateway correctly rejected one diagnostic request that
contained an extra multipart field. A corrected request using the exact browser
contract passed. All diagnostic sessions were cancelled; no story or permanent
audio asset was created.

## Issues encountered and resolved

1. Railway CLI authentication expired. The Founder signed in; `railway whoami`
   then verified the intended account.
2. Railway CLI 5.26.1 hit a response-decode failure. Upgrade to official 5.30.1
   resolved it.
3. The initial OpenAI key could not be transferred before expiry. It showed zero
   usage, was revoked, and a replacement was created and transferred directly.
4. Kinsta WP-CLI intermittently emitted notices/segfaulted. Read-only retries and
   independent file/hash verification preserved exact evidence.
5. One first WordPress identity-meta write accidentally included the psql command
   tag. JWT issuance failed closed as `storyforge_identity_unmapped`. The value
   was replaced with the exact 36-character queried UUID and token issuance then
   passed before activation.
6. One diagnostic multipart upload added a disallowed extra field. The strict
   gateway rejected it; the corrected browser-contract request passed.
7. Railway's log classifier marks an npm notice and an AWS SDK future Node 22
   notice as error-level lines. There were zero HTTP 5xx responses and zero E13
   application error categories. Schedule Node 22 before the future AWS SDK
   support boundary.

No unresolved issue blocks the exact Founder-only voice scope.

## Rollback order

1. Restore `STORYFORGE_VOICE_FORCE_OFF=1` and redeploy the existing service.
2. Through the authenticated Founder admin endpoint, set `voice_capture` to
   `off`, empty allowlist, empty cohorts; verify the new audit row.
3. Confirm both Founder sessions report `voiceCapture=false` and no provider
   traffic occurs.
4. If an identity rollback is separately required, restore the WordPress
   settings/meta from the B1-509 private receipts, then reconcile the PostgreSQL
   administrator row under explicit rollback authority.
5. Use B1-508 provider/Kinsta/database recovery points only if the incident
   extends beyond voice configuration.

Immediate kill commands:

```bash
cd /Users/brianb/MissionMed_worktrees/B1-StoryForge-502
railway variable set STORYFORGE_VOICE_FORCE_OFF=1 \
  --service storyforge-v5-api --skip-deploys
railway redeploy --service storyforge-v5-api --yes
```

## Remaining gates

The exact Founder-only production activation is complete. Before broad student
release:

1. Founder performs a short real-microphone canary on each supported physical
   browser/device and verifies pause/resume, transcript editing, save, replay,
   discard/retry, and interruption recovery.
2. Complete the governed RP-7 human accent/medical terminology corpus gate.
3. Approve the final student-facing release copy (FG-1).
4. Expand access only through an explicit later Founder authorization and an
   audited E11 change.
5. Keep reconciliation off until its separate authority and dry-run/on gates are
   satisfied.

## Final claim boundary

StoryForge voice is production-active and technically validated for exactly the
Founder student. This handoff does not claim broad student readiness or permanent
audio reconciliation readiness. No push or pull request occurred.
