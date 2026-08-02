# Provider and credential setup

Required runtime key: `MIR_OPENAI_API_KEY`. A generic `OPENAI_API_KEY` was present but intentionally ignored because it is not scoped authority for MIR. `MIR_OPENAI_RESTRICTED_DATA_APPROVED=true` must separately record the approved no-training/ZDR data posture before student-provided, founder-private, MissionMed-intel, or PHI inputs.

Optional/future: `MIR_ANTHROPIC_API_KEY`, `MIR_LOCAL_WORKER_URL`, `MIR_SEARCH_API_KEY`, and `MIR_DATABASE_URL`. See `.env.example`; never commit a populated env file.
