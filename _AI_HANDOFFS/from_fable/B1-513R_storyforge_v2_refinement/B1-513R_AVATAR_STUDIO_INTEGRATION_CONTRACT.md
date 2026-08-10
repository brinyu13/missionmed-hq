# B1-513R Avatar Studio Integration Contract

**Frontier pattern: StoryForge consumes the already-developed MissionMed Avatar Studio. StoryForge does not build, own, or copy avatar generation or universal identity infrastructure.**

## 1. Consumption model

- Avatar Studio remains the sole system of record for avatar assets (headshot renders, full-body renders, approval state). StoryForge persists **nothing** avatar-related: at read time, StoryForge payloads (session, directory, workspace, queue, review attribution, invitations) resolve the user's canonical headshot/full-body references from Avatar Studio's registry and pass short-lived URLs to the renderer.
- Precondition for the implementing release: pin the Avatar Studio asset-reference API from its authoritative handoff at Codex execution time (worktree evidence; the AVA-* lineage). If no stable read API exists yet, the `avatar_identity` flag stays off and StoryForge ships fallbacks only — StoryForge is never blocked on avatars, and no interim avatar store is built.
- The prototype uses clearly-synthetic flat-illustration stand-ins generated in the shim (documented in doc 16); they demonstrate the identity-frame pattern, not the art.

## 2. The identity frame

Wherever identity materially appears, the generic colored-initials circle is replaced by the **identity frame**: canonical headshot + first name (+ contextual sub-line), in the polished `b1513rHead`/`b1513rIdentity` treatment. V2 sites: signed-in identity (rail) · Home mentor panel · Students directory cards · student workspace header · Review Queue rows · Mentor Review rail attribution · Request-a-Story invitations · contributor-facing guest landing (student's headshot). Notifications keep text-first rows (no avatar noise in dense lists).

## 3. Full-body avatars — selectively

Full-body renders appear only in spacious, emotional contexts: the Inspiration welcome hero and the Request-a-Story hero (and, when those surfaces later exist, onboarding/milestones). Never in dense productivity surfaces (Library, queue, review, settings). Hidden below 900px width where space is dense.

## 4. Fallback ladder (never blocks StoryForge)

1. Canonical Avatar Studio headshot.
2. Approved profile image if Avatar Studio exposes one.
3. Tasteful neutral fallback: the existing initials chip (Maya demonstrates it throughout the prototype).
Plus a non-blocking invitation in Settings → Identity: **CREATE MY AVATAR / UPDATE MY AVATAR**, which links out to Avatar Studio (separate application) and returns; StoryForge functions identically without one.

## 5. Guest exposure boundary

The guest landing shows the inviting student's headshot/full-body and first name only — an asset the student chose to present, listed in the invitation payload review (doc 09 §1). No other user's avatar is ever resolvable through the guest surface.

## 6. Platform v1 observation

Avatar consumption is a textbook platform pattern: one identity-asset registry, many consuming applications. StoryForge's read-time-resolution contract (no local persistence, flagged, fallback ladder) is the candidate shape for Platform v1's universal identity assets; recorded for the Summit, not generalized here.
