# Founder test script

1. `cd /Users/brianb/MissionMed_worktrees/P1-PRIQ-M0-001`
2. `npm run priq:check`
3. Launch through the approved MissionMed runtime so PRIQ inherits `OPENAI_API_KEY`; do not copy or duplicate the credential into the repository. A local `.env` file is optional, development-only, and not the normal credential source.
4. Run `npm run priq:start` with `PRIQ_DEV_AUTH=true` in the inherited environment.
5. Open `http://127.0.0.1:4310`; inspect Today, Students, Programs, Live Copilot, Live Profile Lab, and Control Panel.
6. Inspect `/health`, `/api/research`, and `/api/profile/readiness`.
7. Confirm student report is unavailable and no AI output appears.
8. In a separately authorized run, provide only a private intake manifest and approved restricted-data provider posture; use the already inherited server credential and repeat all gates before any private-data model call.
