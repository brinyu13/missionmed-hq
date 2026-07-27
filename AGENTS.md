# StoryForge V5 Agent Contract

This worktree is scoped to the B1-502M guarded StoryForge V5 production
release. It inherits the B1-500 product authority and the verified B1-501
Matrix integration foundation; neither may be reinterpreted during release
work.

## Product authority

- The only product, UI, UX, visual-design, interaction, navigation, and workflow authority is `_AI_HANDOFFS/from_cowork/B1-500_storyforge_v5_production_authority/storyforge-v5.html`.
- Its required SHA-256 is `3ac2871ff286552abe89a785ff43967df3315922e3718f67a136b83db1ba8db1`.
- Earlier StoryForge prototypes and existing V3 runtime assets may be inspected only to establish infrastructure ownership, locks, and compatibility. They must never determine V5 behavior.
- Preserve the twenty product invariants and the rejected-interpretation corrections in the combined engineering handoff.

## Engineering and safety

- Read the execution prompt, combined handoff, canonical HTML, and applicable `_SYSTEM` contracts before changes.
- Treat StoryForge Matrix JS/CSS/PHP as protected. Run `_SYSTEM/tools/matrix_runtime_guard.py preflight --assets all --verify-public` before protected edits. Never use its recovery-only override as deployment authority.
- Do not edit `wp-content/plugins/missionmed-hub` StoryForge assets unless the protected source exists in this exact worktree, its lock verifies, and the ticket has deployment authority.
- Keep StoryForge migrations outside root `supabase/migrations`. B1-502M pins an isolated Railway PostgreSQL target and its private migration ledger; apply it only through the guarded StoryForge production runner and verified restore boundary.
- Never add a client-side service-role key, role toggle, fake AI result, fake audio success, or UI-only authorization.
- Run authorization tests against real PostgreSQL. Private means inaccessible by direct ID as well as absent from lists.
- Use additive migrations, immutable originals/revisions, append-only audit events, transaction-bound notifications, and server-enforced state transitions.
- Do not deploy or enable StoryForge without the founder gates, forward MissionMed OS decisions, provider cache proof, exact-account binding, restore evidence, and rollback conditions required by B1-502M. B1-500 product and safety gates remain in force.

## Records

Keep B1-502M plans, evidence, work logs, gate packets, agent reports, and the
complete combined handoff under
`_AI_HANDOFFS/from_codex/B1-502M_storyforge_megarun/`.
