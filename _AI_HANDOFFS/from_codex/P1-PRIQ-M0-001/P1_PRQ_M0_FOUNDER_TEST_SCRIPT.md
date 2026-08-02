# Founder test script

1. `cd /Users/brianb/MissionMed_worktrees/P1-PRIQ-M0-001`
2. `npm run priq:check`
3. `cp .env.example .env` and keep `PRIQ_DEV_AUTH=true`; do not add credentials unless authorized.
4. Run `set -a; source .env; set +a; npm run priq:start`.
5. Open `http://127.0.0.1:4310`; inspect Today, Students, Programs, Live Copilot, Live Profile Lab, and Control Panel.
6. Inspect `/health`, `/api/research`, and `/api/profile/readiness`.
7. Confirm student report is unavailable and no AI output appears.
8. In a separately authorized run, provide only a private intake manifest, approved provider posture, and `MIR_OPENAI_API_KEY`; then repeat gates before any model call.
