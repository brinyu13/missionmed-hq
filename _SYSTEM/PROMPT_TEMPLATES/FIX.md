PROMPT NAME: ({PROJECT})-[Bug]_Fix-claude-medium-[MR#]
THREAD NAME: ({PROJECT}) — [Bug] Fix
---
Load PRIMER_CORE.md
Load CRITICAL_SYSTEMS_CONTRACT.md (if production/shared critical system)
---
TASK TYPE: FIX
RISK LEVEL: [MEDIUM or HIGH]
---
BUG DESCRIPTION:
[What is broken]

AFFECTED FILES:
[List known affected files]

RUNTIME OWNER:
[State the production runtime owner before editing. Example: Railway production is `missionmed-hq/server.mjs`; `app/api/**` is inactive unless deployment evidence proves otherwise.]

EXPECTED BEHAVIOR:
[What should happen]

ACTUAL BEHAVIOR:
[What happens instead]

CONSTRAINTS:
- Fix the specific bug only
- Do not refactor adjacent code
- Do not add features
- If protected, validate with the Critical Systems Contract gate before COMPLETE
