# StoryForge V5 Agent Contract

This worktree is scoped to B1-500.

## Product authority

- The only product, UI, UX, visual-design, interaction, navigation, and workflow authority is `_AI_HANDOFFS/from_cowork/B1-500_storyforge_v5_production_authority/storyforge-v5.html`.
- Its required SHA-256 is `3ac2871ff286552abe89a785ff43967df3315922e3718f67a136b83db1ba8db1`.
- Earlier StoryForge prototypes and existing V3 runtime assets may be inspected only to establish infrastructure ownership, locks, and compatibility. They must never determine V5 behavior.
- Preserve the twenty product invariants and the rejected-interpretation corrections in the combined engineering handoff.

## Engineering and safety

- Read the execution prompt, combined handoff, canonical HTML, and applicable `_SYSTEM` contracts before changes.
- Treat StoryForge Matrix JS/CSS/PHP as protected. Run `_SYSTEM/tools/matrix_runtime_guard.py preflight --assets all --verify-public` before protected edits. Never use its recovery-only override as deployment authority.
- Do not edit `wp-content/plugins/missionmed-hub` StoryForge assets unless the protected source exists in this exact worktree, its lock verifies, and the ticket has deployment authority.
- Keep StoryForge schema candidates outside root `supabase/migrations` until the exact StoryForge Supabase project and migration-history gate are pinned.
- Never add a client-side service-role key, role toggle, fake AI result, fake audio success, or UI-only authorization.
- Run authorization tests against real PostgreSQL. Private means inaccessible by direct ID as well as absent from lists.
- Use additive migrations, immutable originals/revisions, append-only audit events, transaction-bound notifications, and server-enforced state transitions.
- Do not deploy to staging or production without the founder gates named by the B1-500 authority.

## Records

Keep plans, evidence, work logs, gate packets, and the complete combined handoff under `_AI_HANDOFFS/from_codex/B1-500_storyforge_v5_production/`.
