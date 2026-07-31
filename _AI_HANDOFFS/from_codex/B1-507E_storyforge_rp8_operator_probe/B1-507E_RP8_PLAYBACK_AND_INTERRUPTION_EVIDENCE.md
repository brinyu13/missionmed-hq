# B1-507E Playback and Interruption Evidence

## Evidence boundary

Playback used only the downloaded synthetic artifacts through a local
`127.0.0.1` server. The probe token was not entered into Chrome or Safari.
No production URL, provider, database, R2 object, student recording, or
StoryForge production runtime participated.

The local evidence was opened in:

- current desktop Google Chrome 150;
- current desktop Safari.

## Automated structural playback

Playback ran at 16x to exercise every decoded media timestamp and every ordered
segment without skipping. The harness recorded browser `loadedmetadata`,
`timeupdate`, `ended`, duration, errors, stalls, and sequence transitions.

| Browser | Option A | Option B |
|---|---|---|
| Chrome | PASS — decoded and ended normally at `600.340 s` | PASS — `40/40` ordered segments ended, `600.320 s` total |
| Safari | PASS — decoded and ended normally at `600.332 s` | PASS — `40/40` ordered segments ended, `600.540 s` total |

Observed intermediate state proved that playback time advanced at the requested
16x rate in both browsers. Option B visibly advanced by contiguous filename
sequence; no gap, repeat, error, or out-of-order terminal count was reported.

## Container and duration evidence

Option A:

- Matroska/WebM container;
- Opus codec;
- mono;
- 48,000 Hz;
- `2,588,053` bytes;
- ffprobe duration `600.340 s`;
- SHA-256
  `0c915873a3b4fd94dfbb060e711939cb460beed83dde0ee9673136f86062d5de`.

Option B:

- forty WebM/Opus mono 48 kHz segments;
- first segment duration `15.008 s`;
- deterministic contiguous sequence `0..39`;
- manifest SHA-256
  `f2dfd5f99f70e2a11c04e30851302439f6db5836ff67929db5fefe88016bba5f`.

Structural evidence establishes:

- artifacts open;
- playback begins;
- full expected duration is reached;
- all forty segment slots are present and ordered;
- no browser decode error;
- no unrecoverable playback or seek failure;
- no browser-specific structural failure.

## Perceptual evidence

**PASS — FOUNDER CONFIRMED.**

On 2026-07-31 the Founder supplied the binding perceptual results after playing
Option A at normal speed:

- Chrome Option A: PASS — continuous, correctly ordered, and uncorrupted;
- Safari Option A: PASS — continuous, correctly ordered, and uncorrupted.

The Founder explicitly approved the RP-8 result and selected Option A. This
human evidence completes the perceptual criterion without attributing auditory
judgment to Codex.

## Interruption evidence

The temporary single-replica service was restarted. The operator polled the
protected manifest route until the prior instance stopped serving:

- unavailable status: HTTP 502;
- observed: `2026-07-31T04:50:06Z`.

A second restart was sent during that unavailable/generation window. Recovery
was then observed:

- recovered status: HTTP 200;
- observed: `2026-07-31T04:50:10Z`.

The regenerated manifest was captured separately and evaluated:

| Check | Result |
|---|---|
| Option A run 1 hash equals original | PASS |
| Option A run 2 hash equals original | PASS |
| Option B run 1 manifest hash equals original | PASS |
| Option B run 2 manifest hash equals original | PASS |
| All post-interruption timings <= 60 seconds | PASS |

Interruption rerun idempotence: **PASS**.

## Selection evaluation

### Option A

- ffmpeg executable in built runtime: PASS, proven by successful in-container
  fixture generation and concat execution;
- both 10-minute assemblies <= 60 seconds: PASS;
- identical output hashes: PASS;
- Chrome structural playback: PASS;
- Safari structural playback: PASS;
- interruption rerun idempotent: PASS;
- perceptual listening: PASS — Founder-confirmed in Chrome and Safari.

### Option B

- both validations/manifests <= 60 seconds: PASS;
- identical manifests: PASS;
- Chrome 40-segment structural playback: PASS;
- Safari 40-segment structural playback: PASS;
- perceptual criterion: PASS under the binding Founder-approved RP-8 result.

### Binding result now

`option_a_selected`

Both options satisfy the binding criteria. The binding tie-break and explicit
Founder approval select Option A (`concat`).

Later, separately authorized activation value:

`STORYFORGE_ASSEMBLY_EXECUTOR=concat`

This value was recorded in local evidence only. It was not set in production,
voice was not enabled, and no deployment occurred.
