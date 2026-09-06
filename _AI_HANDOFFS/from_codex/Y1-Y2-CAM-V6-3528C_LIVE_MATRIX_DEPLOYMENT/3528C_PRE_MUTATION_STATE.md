# 3528C Pre-Mutation State

- Ticket: `Y1-Y2-CAM-V6-3528C`
- Worktree: `/Users/brianb/MissionMed_worktrees/Y1-Y2-CAM-V6-3521`
- Branch: `codex/y1-y2-cam-v6-3521-live-analytics-runtime`
- Frozen frontend checkpoint: `83265dfe9777c9bccc06ec65dc6d972bc4eac777`
- Upstream checkpoint: `83265dfe9777c9bccc06ec65dc6d972bc4eac777`
- Production HQ revision observed before mutation: Railway deployment `73d6ee8e-f0b4-4b24-9c7d-88babe4bbbd3`, source message `F2-LOR-1012 DR-133 e2c40ce8f3a6f4771895fa407681b0527af35f03`.
- Authoritative 3528B frontend source: `_AI_HANDOFFS/from_claude_code/Y1-Y2-CAM-V6-3528B_AAA_GAME_EXPERIENCE_VISUAL_REBUILD/PROTOTYPE/`.
- Existing real measurement engines: `ivprep-v6/public/analytics/` and `ivprep-v6/public/live-analytics/`.
- Existing hosted route before mutation: `/iv-prep-on-call/`; new 3528C route `/iv-prep-analytics/` was not mounted.
- Existing IV Prep Supabase project: `tufzqxeucfugdovtjyqk` (`missionmed-cam-dev`).
- Existing media gateway: same-origin HQ signing over `CONFIG.mediaUploadBase` / `MMHQ_CIE_BASE`; raw storage keys are not exposed to browsers.
- Existing unrelated worktree state was preserved: staged 3524 Fable documents and untracked 3523/3524B/3525/3527/3528A evidence packages plus `ivprep-v6/scripts/3441r/__pycache__/`.
- Automatic Supabase CLI side effect `supabase/.temp/cli-latest` was restored byte-identically to `v2.95.4`; exact PATH epoch 482 was released and provider readback reported released=true, expired=true, active=false, active lease count 0.
- Donor `/Users/brianb/MissionMed_worktrees/Y1-Y2-CAM-V6-3440` was not modified.
- Provider sessions created: 0.

Only the registered DR-149/DR-150 additive write set may change in this mission.
