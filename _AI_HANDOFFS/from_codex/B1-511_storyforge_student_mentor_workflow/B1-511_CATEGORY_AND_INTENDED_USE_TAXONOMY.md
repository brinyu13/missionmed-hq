# B1-511 Category and Intended-Use Taxonomy

Categories and themes remain distinct. The exact additive categories are:

`Clinical`, `Personal`, `Research`, `Leadership`, `Teaching`,
`Volunteer / Service`, `Adversity / Challenge`, `Teamwork`, `Communication`,
`Ethics / Professionalism`, and `Other`.

The exact intended-use labels are:

`Personal Statement`, `Interview Set`, `Letter of Recommendation`,
`MyERAS Experiences`, `MyERAS Most Impactful`, and `Someday / Fellowship`.

Students may edit their own taxonomy through row-versioned RPCs. Authorized
administrators may update submitted-story taxonomy through bounded audited
functions. Existing records retain truthful empty values; the migration does
not infer or backfill categories or uses.

Authority and validation are pinned in
`storyforge-v5/public/app.js`,
`storyforge-v5/infra/postgres/migrations/20260805190000_b1_511_workflow_taxonomy_mentor_notes.sql`,
and `storyforge-v5/tests/unit/b1-511-frontend.test.mjs`.
