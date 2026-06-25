PROMPT NAME: ({PROJECT})-[System]_Deploy-claude-high-[MR#]
THREAD NAME: ({PROJECT}) — [System] Deployment
---
Load PRIMER_CORE.md
Load PRIMER_EXT_HTML_DEPLOY.md (if HTML app)
Load CRITICAL_SYSTEMS_CONTRACT.md (if protected route, auth, HQ/Railway, WordPress proxy/wrapper, CDN/R2 live asset, Supabase routing, Arena, USCE, or Matrix)
---
TASK TYPE: DEPLOY
RISK LEVEL: HIGH
---
DEPLOYMENT TARGET:
[System being deployed]

CHANGES TO DEPLOY:
[List of changes]

PRE-DEPLOYMENT:
- Backup current version
- Version header update
- Validation checklist
- Confirm protected systems have manifest entries
- Run `_SYSTEM/tools/critical_systems_gate.py --enforce` or document Brian-approved emergency bypass

POST-DEPLOYMENT:
- Verify deployment
- Clear cache
- Functional check
- Re-run critical route/CDN/browser smoke for affected protected systems
