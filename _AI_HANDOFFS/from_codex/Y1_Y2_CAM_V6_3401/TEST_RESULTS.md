# Y1-Y2-CAM-V6-3401 test results

## Current V6 candidate

- `npm run check`: PASS.
- `node --test test/*.test.mjs`: 33/33 PASS.
- `npm audit --omit=dev`: 0 vulnerabilities.
- `git diff --check`: PASS.
- Local host-boundary test: PASS; non-loopback startup is rejected.
- Browser secret-boundary tests: PASS; no server credential access or authorization material is delivered.

The focused suite covers the future AvatarProvider seam, exact model and voice
IDs, explicit provider failures, model discovery, interviewer-before-observer
ordering, continuous microphone state, five-second silence, natural pauses,
barge-in, mute behavior, single-entry turn completion, stale callback guards,
no-transcript typed recovery, evidence mapping, truthful replay labels,
observation-grounded safety copy, keyboard-operable selectors and question
ordering, and server-only key handling.

## Donor regression harness

The POC donor was copied to an isolated temporary directory and remained
unchanged. Its retained suites passed:

- focused: 15/15;
- retained contracts: 17/17;
- verifier probes: 27/27.

## Authenticated provider smokes

- Exact model discovery: 6/6 configured model IDs available; 0 failures.
- Responses + Speech: `gpt-5.6-terra` interviewer followed by separate
  `gpt-5.6-luna` observer; valid usage metadata and MP3 from
  `gpt-4o-mini-tts` voice `cedar`.
- Native Realtime: `gpt-realtime-2.1` returned PCM audio, converted to a WAV
  for the browser; the separate observer remained `gpt-5.6-luna`.
- Final-position smoke: professional closing, observer action `WRAP_UP`,
  `final=true`, `terminated=false`.
- Conduct smoke: professional boundary statement, observer action
  `TERMINATE_INTERVIEW`, `final=true`, `terminated=true`.

No credential value was printed or stored in this package.
