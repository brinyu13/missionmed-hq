# B1-507 Final Production Status

## STORYFORGE REMAINS AT SAFE ROLLOUT RUNG 0

The B1-507 release is live as a hidden, dormant, default-off, one-Founder text
pilot at:

`https://missionmedinstitute.com/storyforge/`

Production identity:

- implementation commit
  `e94a305c82c35d492ceb68f13667200b83e6d2dd`;
- exact deployed source
  `09878514fff39b2d1f2ba3ee40c4c3de55ffc473`;
- release ID `v-4f40609482162cbd`;
- Railway deployment
  `2fe2f8e9-9f24-47c4-b0bd-3a7a0a26a82d`;
- Kinsta pointer
  `releases/09878514fff39b2d1f2ba3ee40c4c3de55ffc473`.

Safety posture:

```text
database voice_capture scope = off
STORYFORGE_VOICE_FORCE_OFF=1
STORYFORGE_TRANSCRIBE_PROVIDER=none
STORYFORGE_AUDIO_RECONCILIATION=off
STORYFORGE_PLATFORM_OFF=1
R2 credentials absent
OpenAI key absent
```

Verified:

- 192/192 unit;
- PostgreSQL 67/67 + 71/71 + 12/12 = 150/150;
- 46/46 browser E2E;
- 72/72 conformance/accessibility;
- fresh Kinsta, Railway, and PostgreSQL recovery points;
- fresh isolated PostgreSQL 18 restore;
- exact eight-row production migration ledger;
- one Railway API replica and healthy origin;
- exact Kinsta route/release/index hashes;
- Founder Home, Library, Interview Prep, Notifications, Settings, Quick
  Capture, and question workshop;
- E1/presign/confirm each deny 403 `voice_disabled`;
- unauthenticated WordPress/API denials;
- protected-system post-deploy gate 0 FAIL;
- guarded Kinsta rollback preflight PASS.

The dormant scope is complete. Production recording/transcription is not
enabled and is not claimed. RP-8, R2, scoped OpenAI/privacy evidence, RP-7,
FG-1, physical device testing, broader 360 entitlement authority, and
FABLE-C1–C4/PROBE-C5 remain the external gates to rollout rungs 1–8.

Draft PR #19 remains conflicting with unrelated current-main platform history.
That repository integration issue does not change the exact deployed product
source or current production safety.
