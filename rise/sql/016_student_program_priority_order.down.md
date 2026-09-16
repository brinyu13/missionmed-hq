# Migration 016 rollback

Migration 016 is intentionally additive and forward-only. If the 5014A runtime is rolled back, restore the prior Railway deployment and leave `priority_position` plus its audit table inert. Do not drop or rewrite either object: existing student-program rows and audit evidence must remain intact. A defect is corrected only with a new forward migration.
