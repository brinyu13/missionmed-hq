PROMPT NAME: ({PROJECT})-[Feature]_Plan-claude-high-[MR#]
THREAD NAME: ({PROJECT}) — [Feature] Planning
---
Load PRIMER_CORE.md
Load KNOWLEDGE_INDEX.md
---
TASK TYPE: PLAN
RISK LEVEL: MEDIUM
---
OBJECTIVE:
[1-2 sentences: what you want to accomplish]

CONTEXT:
[What exists now. Reference specific files if known.]

CONSTRAINTS:
- Must read actual source files before producing plan
- Must cite file paths for every claim about current state
- Must include Codex Implementation Brief if code changes needed

NOT ALLOWED:
- Plans based on assumed state without reading files
- Generic recommendations without file references
- Proposing to build something that may already exist

EXPECTED OUTPUT:
1. Current State Assessment (with file-level evidence)
2. Proposed Changes (specific, not abstract)
3. Risk Analysis
4. Codex Implementation Brief (if code changes needed)
5. NEXT ACTION block
