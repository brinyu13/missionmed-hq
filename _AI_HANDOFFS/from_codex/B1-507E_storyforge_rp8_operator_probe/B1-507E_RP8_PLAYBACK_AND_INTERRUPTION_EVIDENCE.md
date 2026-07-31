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

**PENDING FOUNDER/OPERATOR CONFIRMATION.**

Codex cannot hear the Mac speaker output and therefore does not fabricate
“sounds clean” evidence. The Founder was asked once to play Option A at normal
speed in Chrome and Safari and confirm:

- continuous audible output;
- no obvious corruption;
- expected 15-second rising-tone transitions.

This is the only remaining input before the exact selection rule can be sealed.

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
- perceptual listening: PENDING.

### Option B

- both validations/manifests <= 60 seconds: PASS;
- identical manifests: PASS;
- Chrome 40-segment structural playback: PASS;
- Safari 40-segment structural playback: PASS;
- perceptual listening: PENDING.

### Binding result now

`pending_founder_perceptual_confirmation`

No executor has been selected or wired. When the one pending confirmation is
positive, both options pass and Fable's binding tie-break automatically selects
Option A (`concat`). A negative confirmation fails the affected browser/option
and must be recorded without forcing a selection.
