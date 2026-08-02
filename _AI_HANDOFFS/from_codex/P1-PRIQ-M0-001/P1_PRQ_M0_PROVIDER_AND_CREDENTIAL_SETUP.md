# Provider and credential setup

Superseded by P1-PRIQ-M0-002A: the founder authorized inherited `process.env.OPENAI_API_KEY` as the local runtime credential source. Its value must never be recorded or copied into the repository. `MIR_OPENAI_RESTRICTED_DATA_APPROVED=true` remains a separate required record of the approved no-training/ZDR data posture before student-provided, founder-private, MissionMed-intel, or PHI inputs.

Optional/future: `MIR_ANTHROPIC_API_KEY`, `MIR_LOCAL_WORKER_URL`, `MIR_SEARCH_API_KEY`, and `MIR_DATABASE_URL`. See `.env.example`; never commit a populated env file.
