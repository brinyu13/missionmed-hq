# B1-510I Live Acceptance Evidence

## Canonical release

- `/storyforge/` index: HTTP 200, SHA-256 `8a28f5903fa985b8d7373c889f52fc4f25ccb43c0e4ed3763f429fe760dfbbd6`.
- App alias `c7d6d2e50f7b`: exact SHA and 320,050 bytes.
- Auth alias `d2cfc4e447d2`: exact SHA and 7,236 bytes.
- Styles alias `a12dfe83ee1d`: exact SHA and 112,234 bytes.
- Logo alias `f091d62ac584`: exact SHA and 65,897 bytes.
- Railway health: HTTP 200, `{"ok":true,"service":"storyforge-v5"}`.
- No Bootstrap Demo appeared.

## Authorization and capabilities

- Founder student: `voiceCapture=true`, `adminConsole=false`, admin route 403.
- Ignacio: `voiceCapture=true`, `adminConsole=false`, admin route 403.
- second eligible student: `voiceCapture=true`, `adminConsole=false`, admin route 403.
- Founder administrator: `voiceCapture=false`, `adminConsole=true`, admin route 200.
- ineligible WordPress identity: entitlement bridge returned `eligibility_required`.
- anonymous: session 401.
- Ignacio direct access to a Founder-owned story: 404 / `P0002`.

## Voice, storage, and reliability

The Founder supplied the human perceptual result: physical-microphone recording/transcription PASS, accurate and usable. The saved story and transcript persist. The Library replay issue is separately tracked.

- transient `storyforge-rec/`: 0 objects / 0 bytes;
- permanent `storyforge-audio/`: 3 objects / 1,958,270 bytes;
- database recording segments: 0;
- reconciliation: off;
- configured provider: OpenAI;
- primary/fallback: `gpt-4o-transcribe` / `whisper-1`;
- executor: `concat`;
- current deployment logs: zero HTTP 5xx and no application failure; only npm/AWS SDK advisory warnings.

## Visual evidence

The authenticated live Founder-student view showed the canonical dark StoryForge homepage, correct greeting, voice action, canonical navigation, and no demo UI. Local deterministic screenshots cover the Founder-admin story review, opening branding, active capture, recording-energy visual state, and reduced-motion frame. No private story title is added to new evidence.

## Critical protection

- Critical Systems enforced: 112 PASS / 2 WARN / 0 FAIL after clean manifest commit.
- Matrix public/origin lock hashes: exact matches for every protected asset.
- Matrix local source files are intentionally absent from this isolated worktree, so the guard cannot issue a full local-source PASS; none was edited or deployed.
