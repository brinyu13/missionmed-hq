# B1-511 Limited Supersession Matrix

Authority: DR-021 B1-511 StoryForge Founder-authorized bounded product enhancement
Date: 2026-08-05
Supersedes: DR-014 (limited scope only)
Preserves: DR-011, DR-012, DR-013, DR-014 (all non-superseded provisions)

## Supersession Detail

| Domain | DR-014 State | B1-511 Supersession | New B1-511 State |
|--------|-------------|---------------------|------------------|
| Product scope | Conformance recovery only | YES - extends to new features | Conformance recovery PLUS 14 bounded enhancements |
| Population access | Exact one-Founder student pilot; mentors denied | YES - limited | Expanded access per accepted B1-510 lineage; mentor review of submitted stories only |
| Administrator workflow | Not explicitly addressed | YES - new scope | Founder `brinyu` administrator-console access restored |
| Story submission | Not in scope | YES - new scope | Explicit student submission for mentor review; unsubmitted remain private |
| Categories | Not in scope | YES - new scope | Bounded StoryForge-owned categories and filters |
| Intended-use labels | Not in scope | YES - new scope | Six corrected/expanded labels |
| Priority sorting | Not in scope | YES - new scope | Default sort by student priority 5-1; inline editing |
| Library rerender | Not in scope | YES - new scope | Eliminate blinking/full-shell rerender on priority/star updates |
| Search input | Not in scope | YES - new scope | Repair one-char-at-a-time defect; add bounded autocomplete |
| Review workflow | Existing scope | YES - extends | Extended bounded review workflow |
| Mentor feedback | Not in scope | YES - new scope | Mentor text and voice notes with transcription |
| Internal notes | Not in scope | YES - new scope | Internal notes hidden from students |
| Mentor voice/audio | Not in scope | YES - new scope | StoryForge-owned, private, namespaced, access-controlled |
| Privacy: private-by-default | Active | NO | Preserved unchanged |
| Privacy: unsubmitted inaccessible | Active | NO | Preserved unchanged |
| Privacy: cross-student denied | Active | NO | Preserved unchanged |
| Privacy: internal notes hidden | N/A | N/A | New: hidden from students |
| Identity/JWT/auth | Active | NO | Preserved unchanged |
| RLS enforcement | Active | NO | Preserved unchanged |
| PostgreSQL identity binding | Active | NO | Preserved unchanged |
| Rollback/restore | Active | NO | Preserved unchanged; extended per-feature |
| Audit requirements | Active | NO | Preserved unchanged |
| Canonical-product protection | Active | NO | Preserved unchanged |
| Feature-off deployment | Active | NO | Preserved unchanged |
| Terminal gate | Active | NO | Preserved; second gate added |
| WordPress session ownership | Active (DR-011) | NO | Preserved unchanged |
| Kinsta MU route | Active (DR-012) | NO | Preserved unchanged |
| Execution-private PHP bundle | Active (DR-013) | NO | Preserved unchanged |
| Atomic current pointer | Active (DR-013) | NO | Preserved unchanged |
| Railway isolation | Active (DR-011) | NO | Preserved unchanged |
| Matrix integration | Active (DR-011) | NO | Preserved unchanged |
| Legacy fallback | Active (DR-011) | NO | Preserved unchanged |
| DNS/Cloudflare | No mutation (DR-014) | NO | No mutation preserved |
| Protected missionmed-hub | Read-only (DR-014) | NO | Read-only preserved |
| Database schema | Additive-only (DR-014) | NO | Additive-only preserved; new migrations must be minimal, RLS-protected, reversible |
| Broad admin RLS bypass | Denied (DR-014) | NO | Denied preserved |
| Platform infrastructure | Not authorized (DR-014) | NO | Not authorized; Platform Summit constraint binding |
| Synthetic WordPress roles | Not authorized | NO | Not authorized; no "360" role |
| Student recording keys | Student-owned | NO | Preserved; mentor audio must use separate keys |
| Shared media architecture | Not authorized | NO | Not authorized |

## Supersession Summary

B1-511 supersedes DR-014 in exactly 14 product-feature domains. It does NOT supersede any infrastructure, privacy, identity, authorization, rollback, audit, or canonical-product protection from DR-014 or its predecessor chain (DR-011 through DR-013).

The supersession is additive: B1-511 grants new bounded feature authority while preserving all existing protection boundaries.

## Chain of Authority

```
BRIAN (level 0, all scope)
  -> DR-011 (level 1, StoryForge production)
    -> DR-012 amends DR-011 (Kinsta gateway)
      -> DR-013 amends DR-012 (execution-private assets)
        -> DR-014 amends DR-013 (product-conformance recovery)
          -> DR-021 limited supersession of DR-014 (B1-511 bounded enhancement)
```

DR-021 is the active governing authority for B1-511 scope. DR-014 remains the active governing authority for everything outside B1-511's limited supersession.
