# Deployment and Rollback Receipt

## Final production

- app deployment: `507178ef-7f15-4d01-901b-e7d1b76167ec`, SUCCESS, one RUNNING instance;
- worker deployment: `17af3214-8f51-483e-a82b-25a1efe330f1`, SUCCESS, one RUNNING instance;
- PostgreSQL deployment: `b55827d6-9df2-4ec5-a955-96362ca444d0`, SUCCESS, one RUNNING instance;
- live build: `rise_web_79b4dd0f59a8`;
- active registry: `rise_registry_2026-07-09_8fdb5afb84f6`;
- final code commit: `adf9f87df3ff47727e67a2eb86cca5349aed0545`;
- feature commit: `5216347ee04f41aa3afb8293ab1da0d0a246c99a`;
- remote divergence after each code push: ahead 0, behind 0.

Intermediate contained failures did not become the accepted final state: worker deployment `faf69359…` briefly used the wrong root and processed no jobs before replacement; app candidate `f14af159…` used an invalid path-as-root and never became live. These are recorded as deployment-path diagnostics, not successful releases.

## Rollback

The system is already operationally disabled by global pause, student pause, and emergency kill. For a full ticket rollback:

1. Keep those three controls in the current fail-safe state.
2. Redeploy pre-ticket app `b9955188-a221-4ea0-b785-6bc560b29a15`.
3. Redeploy pre-ticket worker `da51d547-fb40-4e69-b19d-6d0c8d82dede` or scale the current worker to zero.
4. Revert code commits `adf9f87df3ff47727e67a2eb86cca5349aed0545` and `5216347ee04f41aa3afb8293ab1da0d0a246c99a` with normal forward Git reverts if source rollback is required.
5. Leave migration 011 and append-only benchmark/spend/canonical evidence dormant. Do not destructively drop history. The down SQL is rehearsal-only.
6. Recheck direct health, 360/admin/anonymous access, 6,139 programs, 31 specialties, SOAP 883, My Programs, Student Intel, and zero active/reserved work.

For only the final search projection, redeploy app `52682143-a95a-47f4-ba5e-3afe56054a49` while retaining the rest of 5012E.

No rollback was required. Final control readback is already kill-safe and data-preserving.
