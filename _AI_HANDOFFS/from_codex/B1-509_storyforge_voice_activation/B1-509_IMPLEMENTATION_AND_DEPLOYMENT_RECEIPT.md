# B1-509 Implementation and Deployment Receipt

## Verdict

**FOUNDER-ONLY VOICE ACTIVATION COMPLETE**

The Founder superseded the earlier dormant-voice release strategy and authorized
production voice activation. StoryForge voice is now available only to the
existing Founder student identity. The separate Founder administrator identity
remains administrator-only. No cohort or general-student activation occurred.

## Authority and scope

- New binding authority: B1-509 Founder decision requiring safe production
  activation of recording and transcription.
- Founder confirmed both credential creations and WordPress user 107 as the
  Founder administrator account.
- Founder explicitly authorized Codex to execute the remaining activation,
  validation, receipt, and local closeout actions.
- No product redesign, source change, migration, reconciliation activation,
  broad roster enablement, push, or pull request was authorized or performed.

## Starting repository state

- Worktree: `/Users/brianb/MissionMed_worktrees/B1-StoryForge-502`
- Branch: `codex/b1-503-storyforge-product-recovery`
- Starting HEAD: `77eabb6cf3f62b19f9b86523fd1987b1cab74eca`
- Starting worktree: clean
- Deterministic WordPress release: `v-a9a076957973d7d4`
- Canonical V5 HTML SHA-256:
  `3ac2871ff286552abe89a785ff43967df3315922e3718f67a136b83db1ba8db1`

## Recovery points

### PostgreSQL

- Dump:
  `/Users/brianb/MissionMed_private_backups/B1-509/B1-509-RP-PG-PRE-YcpkCPpk/storyforge-b1-509-pre.dump`
- SHA-256:
  `20586ff59b7c0719faa5bba3f32013c59c1d2f90f40ffd5677a6456059632bcc`
- Size: 291119 bytes
- Mode: `0600`
- `pg_restore` catalog validation: PASS

### WordPress

- Settings recovery directory:
  `/www/theresidencyacademy_209/private/b1-509-wp107-admin-4XFWlzqg`
- Directory mode: `0700`
- `settings-before.json` SHA-256:
  `c1e2835edbcd44b5f859394a7e99dfd67441f7a017bca27f93f09b477646bfe7`
- Founder-admin identity recovery directory:
  `/www/theresidencyacademy_209/private/b1-509-wp107-identity-Tnawklzb`
- Directory mode: `0700`
- `meta-before.txt` SHA-256:
  `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`

The B1-508 Kinsta and Railway recovery points remain available in addition to
these B1-509 pre-activation receipts.

## Credential and storage preparation

- Private R2 buckets:
  - `missionmed-storyforge-audio-prod`
  - `missionmed-storyforge-audio-staging`
- CORS is restricted to `https://missionmedinstitute.com`, methods GET and PUT,
  request header Content-Type, and max age 3600.
- Both buckets expire `storyforge-rec/` transient objects after seven days.
- One R2 object credential is scoped only to those two buckets with Object Read
  & Write permission.
- OpenAI project: `MissionMed StoryForge V5 Voice`.
- The unused initial OpenAI service key was confirmed at zero usage and revoked.
- Its replacement and the R2 credential were transferred directly into Railway;
  no credential value is present in this repository or receipt.

## Production configuration

Railway project `missionmed-storyforge-v5`, production environment, service
`storyforge-v5-api` now has:

| Variable | Value or state |
| --- | --- |
| `STORYFORGE_TRANSCRIBE_PROVIDER` | `openai` |
| `STORYFORGE_TRANSCRIBE_PRIMARY_MODEL` | `gpt-4o-transcribe` |
| `STORYFORGE_TRANSCRIBE_FALLBACK_MODEL` | `whisper-1` |
| `STORYFORGE_ASSEMBLY_EXECUTOR` | `concat` |
| `STORYFORGE_VOICE_FORCE_OFF` | `0` |
| `STORYFORGE_AUDIO_RECONCILIATION` | `off` |
| `STORYFORGE_PLATFORM_OFF` | `1` |
| R2 bucket | `missionmed-storyforge-audio-prod` |
| OpenAI key | present, value not recorded |
| R2 access key and secret | present, values not recorded |

All student-facing AI feature flags remain false. Reconciliation remains off.

## Deployment sequence

1. Credentials and configuration were set with deployment suppressed.
2. Deployment `487eb6b1-39d2-4b8f-b88c-b8e4c9ac0189` succeeded with the
   environment kill still on.
3. The audited E11 administrator endpoint set `voice_capture` to `allowlist`
   with exactly the Founder student identity, zero cohorts, and one audit row.
4. `STORYFORGE_VOICE_FORCE_OFF` was set to `0`.
5. Final deployment `d5b98049-e24e-45e7-8c1f-6c6dbaef0714` succeeded and is
   online in Railway US West.

The deployed WordPress release remains `v-a9a076957973d7d4`. Railway retains a
legacy informational `STORYFORGE_RELEASE_ID=v-4f40609482162cbd` variable from
the historical backend deployment. Repository search confirms the API does not
consume that variable; the immutable WordPress route and release bundle both
pin and verify `v-a9a076957973d7d4`.

## Exact two-account boundary

- WordPress StoryForge is enabled.
- Allowed WordPress IDs: 1 and 107 only.
- ID 1 is overridden to StoryForge role `student`.
- ID 107 is overridden to StoryForge role `admin`.
- Allowed roles: `student`, `admin`.
- Allowed cohorts: none.
- PostgreSQL has exactly one Founder student and one Founder administrator.
- User 107's WordPress identity mapping matches its PostgreSQL StoryForge UUID.
- Internal WordPress JWT issuance for user 107 succeeds with role `admin`.

Live capability proof after the final deployment:

- Founder student session: HTTP 200, student, eligible, `voiceCapture=true`.
- Founder admin session: HTTP 200, admin, eligible, `voiceCapture=false`.
- Admin feature read: HTTP 200, scope `allowlist`, allowlist count 1, cohort
  count 0, audit count 1, latest action `feature_scope_changed`.
- Admin voice-health read: HTTP 200, no content-bearing error categories.

No UUIDs are reproduced in this receipt.

## Rollback

Immediate containment is independent of provider, storage, or database health:

```bash
cd /Users/brianb/MissionMed_worktrees/B1-StoryForge-502
railway variable set STORYFORGE_VOICE_FORCE_OFF=1 \
  --service storyforge-v5-api --skip-deploys
railway redeploy --service storyforge-v5-api --yes
```

Then use the authenticated Founder administrator endpoint to set
`voice_capture` scope to `off`, an empty allowlist, and empty cohorts; verify the
new `feature_scope_changed` audit row. If identity rollback is required, restore
the exact WordPress settings/meta from the private receipts above and reconcile
the matching PostgreSQL user only under explicit rollback authority. The
environment kill is the first action and does not require destructive data
changes.
