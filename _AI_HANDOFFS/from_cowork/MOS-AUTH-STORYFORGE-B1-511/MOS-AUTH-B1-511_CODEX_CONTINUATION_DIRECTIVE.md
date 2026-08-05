# B1-511 Codex Continuation Directive

Authority: DR-021 B1-511 StoryForge Founder-authorized bounded product enhancement
Issued by: Cowork (Verifier) authority packet MOS-AUTH-STORYFORGE-B1-511
Date: 2026-08-05

## Directive

### Resume Point

- Resume the existing B1-511 worktree at exact HEAD `0271dd7b232db58cda2a81a2132b6a508b7da48a`.
- Worktree path: `/Users/brianb/MissionMed_worktrees/B1-StoryForge-502`
- Branch: `b1-502-storyforge-production-deployment`
- Do not repeat completed discovery.
- Revalidate only facts that may have changed since the last session (runtime state, production deployment status, Railway health).

### Authority

- Treat B1-511 and B1-511A as executable authority.
- The governing decision record is DR-021 (once registered in MissionMed OS).
- Until DR-021 is registered, treat the authority packet at `_AI_HANDOFFS/from_cowork/MOS-AUTH-STORYFORGE-B1-511/` as the operative authority source.
- The limited supersession matrix in `MOS-AUTH-B1-511_LIMITED_SUPERSESSION_MATRIX.md` defines exactly which DR-014 provisions are superseded and which are preserved.
- The allowed and forbidden scope in `MOS-AUTH-B1-511_ALLOWED_AND_FORBIDDEN_SCOPE.md` is binding.

### Production Baseline

- Preserve the exact canonical production baseline unless a newer accepted release exists.
- Current verified production baseline:
  - Live release: `v-cf6c4b91bad6ac65`
  - Release commit: `4e9472bc21f0ceeaeb67f7f0276b0c7d8339e981`
  - Railway deployment: `0b64c2fc-9292-4d1a-9469-94f21b1a1ca4`
  - Railway status: SUCCESS
  - Critical Systems: 112 PASS / 2 accepted WARN / 0 FAIL

### Custody

- Follow the OPTION 2 custody ruling in `MOS-AUTH-B1-511_CUSTODY_RULING.md`.
- Before beginning B1-511 implementation:
  1. Create a deterministic source archive receipt: `git archive --format=tar HEAD | sha256sum`
  2. Store the receipt in `_AI_HANDOFFS/from_codex/B1-511_CUSTODY/B1-511_CUSTODY_ARCHIVE_RECEIPT.txt`
  3. Create a private backup (bare clone or bundle) and record its path and SHA-256.
- Do not force-push, rewrite history, or merge.
- Remote custody (push) must be completed before any production deployment.

### MissionMed OS Registration

- If this Codex session has sole-writer authority on the MissionMed OS `main` branch:
  1. Apply the proposed OS patch from `MOS-AUTH-B1-511_PROPOSED_OS_PATCH.diff` and `MOS-AUTH-B1-511_OS_REGISTRATION_PLAN.md`.
  2. Copy the decision record from `MOS-AUTH-B1-511_DECISION_RECORD.md` to `decisions/DR-021_storyforge_b1_511_founder_authorized_product_enhancement.md`.
  3. Update `missions.json`, `authority_index.json`, and `PRODUCT_PASSPORTS/storyforge.md` per the registration plan.
  4. Run `python3 tools/mmos_status.py` to regenerate `CURRENT.md`.
  5. Validate JSON, verify authority references resolve, verify B1-511 appears exactly once.
  6. Commit with the provided message. Push to origin/main.
- If sole-writer authority is not available, defer registration to a session that has it.

### Implementation

- Complete the original B1-511 implementation scope (items 1-14) within the allowed scope.
- Follow the B1-511A preservation, change-budget, staged-release, differential-proof, rollback, and stop-line requirements.
- Each feature must be independently rollbackable.
- Feature enablement must be independently controlled.
- Schema additions must be safely dormant when features are disabled.
- Mentor voice-note storage must be namespaced and isolated from student recordings.

### Staged Deployment

1. Staged local/restored-database proof for each B1-511 feature.
2. B1-511A differential proof demonstrating each feature change in isolation.
3. Founder-only production canary.
4. Existing authorized population only after canary acceptance.
5. Independent feature rollback proof for each feature.
6. Fresh restore points covering all B1-511 schema additions.

### Stop Lines

Stop only for:
- A genuinely new security vulnerability discovered during implementation.
- An identity or authorization conflict that cannot be resolved within B1-511 scope.
- A destructive operation that would affect existing production data.
- An MFA or authentication system change requirement.
- An authority conflict with a newer decision record.
- A B1-511A stop-line violation.
- A custody violation or remote-custody gate failure before production deployment.

Do NOT stop for:
- Previously completed discovery or investigation.
- Facts that were validated in prior sessions and have not changed.
- Authority questions that are resolved by DR-021 and this directive.
- Implementation decisions within the allowed scope that do not touch protected systems.

### Filing

- File implementation reports in `_AI_HANDOFFS/from_codex/B1-511_IMPLEMENTATION/`.
- File custody evidence in `_AI_HANDOFFS/from_codex/B1-511_CUSTODY/`.
- Update the B1-511 mission entry in `missions.json` with progress state.
- Follow the existing handoff protocol.
