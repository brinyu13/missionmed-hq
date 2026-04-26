# MissionMed Rules Engine

## Active Rules

### RULE-001
- Trigger: Before every task begins
- Required behavior: Load the last 10 entries from `/Users/brianb/MissionMed/_SYSTEM_LOGS/LEARNINGS_LOG.jsonl` with `/Users/brianb/MissionMed/_SYSTEM_LOGS/read_learnings.py` and review this rules file before execution.
- Source: MRP-700, MRP-706, MRP-707

### RULE-002
- Trigger: After every task completes verification
- Required behavior: Append one structured learning entry to `/Users/brianb/MissionMed/_SYSTEM_LOGS/LEARNINGS_LOG.jsonl` with `/Users/brianb/MissionMed/_SYSTEM_LOGS/append_learning.py`. Never overwrite or rewrite prior entries.
- Source: MRP-700, MRP-701, MRP-706, MRP-707

### RULE-003
- Trigger: When an audit or spec identifies a required production file that is missing
- Required behavior: Build the missing production file in the next execution cycle before running additional audits on the same gap.
- Source: MRP-700, MRP-706

### RULE-004
- Trigger: Editing student-facing MissionMed pages
- Required behavior: Remove internal architecture labels and build-note language before release. Student-facing copy must be user-facing copy only.
- Source: MRP-704, MRP-705

### RULE-005
- Trigger: Styling CTA buttons on MissionMed pages
- Required behavior: Gold is the action color. Red is reserved for warnings or errors and must not be used for primary CTA buttons.
- Source: MRP-704
