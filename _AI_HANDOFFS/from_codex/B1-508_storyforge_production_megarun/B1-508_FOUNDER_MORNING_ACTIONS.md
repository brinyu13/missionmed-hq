# B1-508 Founder Morning Actions

## Current outcome

StoryForge is live for Founder-only text validation at:

`https://missionmedinstitute.com/storyforge/`

No action is required to keep that slice live and safe.

## Recommended check

1. Sign in with the existing Founder account.
2. Open StoryForge from Matrix.
3. Create a short synthetic text story, save it, reload, and archive it.
4. Confirm that no microphone or voice promise is visible.

## Human actions for the next release

### 1. Authorize the initial text cohort

- System: MissionMed WordPress/Matrix StoryForge access policy.
- Provide: exact WordPress user IDs or one bounded cohort and intended role.
- Why: B1-508 had authority for Founder-only validation, not broader access.
- Already complete: code, database, deployment, isolation tests, backup,
  rollback, and Founder canary.
- Afterward: Codex can enable only that scope and test one eligible and one
  ineligible identity.

### 2. Resolve voice-only gates, when voice work resumes

Provide or approve, in dependency order:

1. FG-1 recording language.
2. Private R2 bucket and scoped credentials.
3. Scoped StoryForge transcription-provider key/contract.
4. RP-7 governed human corpus results.
5. Founder-only voice activation and physical-device acceptance.

Only after those pass should production receive
`STORYFORGE_ASSEMBLY_EXECUTOR=concat`, provider traffic, R2 bindings, or
reconciliation dry-run.

## Continuation prompt

`Continue B1-508 from the Founder-only live receipt. Enable only the explicitly
approved text identities/cohort below, keep provider=none,
reconciliation=off, voice_force_off=1, and assembly executor absent, then run
eligible/ineligible production acceptance and update the combined handoff.`
