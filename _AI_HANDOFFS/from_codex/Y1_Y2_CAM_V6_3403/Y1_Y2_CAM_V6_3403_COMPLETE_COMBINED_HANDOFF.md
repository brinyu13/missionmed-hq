FOUNDER ALPHA READY — LOCAL

# Y1-Y2-CAM-V6-3403 complete combined handoff

Generated: 2026-08-02T19:51:39Z

## Release verdict

Beta decision: **NO-GO — PROVIDER/AUTH BLOCKER**.

The integrated V6 application is a working, hardened, one-command local Founder Alpha. It was not deployed online because no authorized private-preview target, identity contract, release passport, or LiveAvatar server authorization exists. A public tunnel, direct Kinsta mutation, or unreviewed mount into the shared Railway production service would violate the ticket's access and architecture laws.

## Inherited authority

- 3401 AI/voice foundation: commit `9b5f99006f4d2d089e381b13101e30928ba86c00`, tag `y1-y2-cam-v6-3401-ai-voice-ready-v2`.
- 3402 avatar/roster/persistence adapter: commit `7005d0aaa9c964acb64cdf69af806669d939f5fc`, tag `y1-y2-cam-v6-3402-adapter-ready-provider-blocked`.
- 3403 worktree: `/Users/brianb/MissionMed_worktrees/Y1-Y2-CAM-V6-3403`.
- 3403 branch: `codex/y1-y2-cam-v6-3403-private-preview-hardening`.
- Release-candidate code SHA: `aa9feffd7a2933aad33b347348c7503dd556b25e`.
- Immutable 3402 rollback tag: `y1-y2-cam-v6-3403-inherited-3402`.
- The final handoff-only documentation successor is sealed by tag `y1-y2-cam-v6-3403-founder-alpha-local`.
- Accepted Fable baseline SHA-256 remains `3053cf7747a1c27c3ca77ec669849b437f4e2d2d00a754c4cff89ecd5dffd5d4`.
- Integrated V6 HTML SHA-256 remains `9e14af9de830437ebcce80ecc75087c3ae2d7e8c0d549aec3e88f0e27743b7bf`.

## Deployment and authority audit

MissionMed OS was inspected read-only through the required chain: `BOOT.md -> CURRENT.md -> missions.json -> products_index.json -> authority_index.json`.

- `CURRENT.md` was generated 2026-07-31 and is stale relative to this 2026-08-02 run.
- There is no Y1-Y2-CAM-V6-3401, 3402, or 3403 mission record.
- `IV Prep On-Call` is `draft_with_prior_artifacts` and has `passport_path: null`.
- The authority index has no matching deploy, preview, or auth route.
- The product repository contains no IV Prep deployment manifest or IV Prep deployment workflow.
- GitHub reports four environments, all named production; none is a founder/private/staging IV Prep environment.
- Recent repository deployments are production-class shared Railway deployments.
- The only repository Railway manifest starts the shared `missionmed-hq/server.mjs`; V6 has no accepted mount or auth contract there.
- The existing V6 local role chooser and founder request header are presentation/capability gates, not identity authentication.

Deployment URL: none.

Deployment class: loopback-only local Founder Alpha, `noindex, nofollow, noarchive`.

Access: only a user on the local Mac process boundary. There is no authorized remote identity.

## Hardening changes in 3403

- Hard-cap expiry now records the exact durable usage ledger entry, final timestamp, avatar end timestamp, termination state, and estimated minutes.
- Concurrent synthetic identities can each hold one session; a duplicate active session for the same identity remains rejected.
- Fifteen-minute default and twenty-minute maximum are verified across restart.
- Server close independently closes the avatar provider even when the browser did not complete cleanup.
- SIGINT/SIGTERM shutdown awaits provider cleanup and server close.
- All responses include `X-Robots-Tag: noindex, nofollow, noarchive`.
- Existing CSP, same-origin, JSON-only POST, loopback, rate, concurrency, permissions, framing, no-store, and secret boundaries remain intact.

Files changed in 3403:

- `ivprep-v6/ALLOWED_PATHS.txt`
- `ivprep-v6/README.md`
- `ivprep-v6/persistence/alpha-store.mjs`
- `ivprep-v6/server/serve.mjs`
- `ivprep-v6/test/faculty-persistence.test.mjs`
- `ivprep-v6/test/server-alpha-control.test.mjs`
- `ivprep-v6/test/server-secret-boundary.test.mjs`
- this handoff

## Exact provider truth

- Default architecture: Responses + OpenAI Speech.
- Interviewer model: `gpt-5.6-terra`.
- Observer model: `gpt-5.6-luna`.
- Speech model: `gpt-4o-mini-tts`.
- Active canonical voice: OpenAI `cedar`.
- Verified visual provider: LiveAvatar LITE.
- Verified stock visual: `Dexter Doctor Sitting`.
- Exact visual avatar ID: `bd43ce31-7425-4379-8407-60f029548e61`.
- Verified LiveAvatar voice: `W. Clint Oxley`, ID `a33a57ab-8388-49fc-a069-dbcfd1bc5405`; this is not an OpenAI voice ID and is not presented as cedar.
- Dr Bastos is a LiveAvatar Voice Agent, ID `dfa595da-e6a8-4a84-b155-a2da830c4e67`, not a custom visual avatar and not used as the canonical intelligence pipeline.
- `LIVEAVATAR_API_KEY`: absent.
- A genuinely live synchronized avatar was not observed and is not claimed.

## Persistence and usage truth

- Local durable alpha adapter: ignored atomic JSON file at `ivprep-v6/.alpha-data/sessions.json`, mode 0600.
- Transcript, observer evidence, exact selections, timestamps, termination state, usage, and only genuine media references persist.
- Real 3402 browser sessions survived a server stop/start with both transcripts and both instructor records intact.
- 3403 synthetic persistence verifies 15- and 20-minute hard-cap sessions, two concurrent distinct identities, usage ledger recovery, restart recovery, and subsequent reuse of an expired identity.
- One active interview per test identity remains enforced.
- Emergency disable fails closed.
- No billing, paid top-ups, or automatic purchases exist.

## Test and browser evidence

- Syntax/check suite: PASS.
- Current automated suite: **51/51 PASS, 0 failed**.
- Inherited donor suites: 15/15 focused, 17/17 retained contracts, 27/27 verifier probes.
- Production dependency audit: 0 known vulnerabilities.
- Secret scan: no real secret in source, browser assets, Git diff, or handoffs; only clearly fake unit-test fixtures matched token-shaped patterns.
- Allowed-path check: PASS.
- Protected baseline hash: PASS.
- Rollback rehearsal: detached worktree restored exactly to 3402 commit `7005d0aaa9c964acb64cdf69af806669d939f5fc`; the baseline hash matched, and the rehearsal worktree was cleanly removed.
- Local release health: HTTP 200; OpenAI configured; avatar unavailable/configuration false; 15-minute default; 20-minute maximum.
- Security headers observed: `Cache-Control: no-store`, exact CSP, self-only camera/microphone permissions, `X-Frame-Options: DENY`, and noindex/noarchive robots policy.
- Fresh 3403 browser load: primary action unique and visible; zero console errors.
- Responsive smoke at 390 x 844: document width 390, scroll width 390, all four splash actions visible; viewport reset afterward.
- 3402 accepted browser journey remains applicable byte-for-byte to the unchanged client: Instant Interview, truthful permission failure, typed fallback, spoken OpenAI response, contextual follow-up, separate observer, results, transcript, instructor evidence, and NO MEDIA replay truth.
- Chrome continuous-microphone proof and Safari typed fallback are inherited from sealed 3401.
- Avatar live smoke, avatar synchronization, avatar reconnect against the real provider, and provider billing-minute truth remain blocked by missing provider authorization.

## Specialist verdicts

- Herschel: no registered private IV Prep deployment route or safe accepted mount exists.
- Sentinel: secrets remain server-side; local gates are not authentication; online exposure is denied.
- Lorentz: OpenAI, LiveAvatar LITE, LiveKit, persistence, and usage boundaries remain replaceable and normalized.
- Darwin: cleanup and hard-cap fixes are bounded; the accepted V6 presentation is unchanged.
- Avicenna: server-exit provider leak and hard-cap ledger omission are repaired.
- Turing: 51 automated release checks pass, including cap, concurrency, cleanup, failure, secret, and restart contracts.
- Miyamoto: no redesign; five-second primary action and V6 visual continuity remain intact.
- Vitruvius: responsive width, keyboard contracts, permission recovery, Chrome microphone inheritance, and Safari typed fallback are acceptable for local alpha.
- Sagan: no fake avatar, fake replay, secret exposure, or online/deployment claim.
- Osler: interviewer roles remain professional; no accent, personality, emotion, readiness, Match, or program-fit scoring was introduced.
- Fresh Verifier: local Founder Alpha journey passes; online/avatar acceptance is blocked and therefore not claimed.

## Local fallback

```bash
cd /Users/brianb/MissionMed_worktrees/Y1-Y2-CAM-V6-3403/ivprep-v6
npm ci
npm start
```

Open `http://127.0.0.1:8343/`.

## Remaining defects and exact next action

1. Human-only provider authorization: the founder must create a LiveAvatar API key in the already authenticated provider dashboard, save it directly to ignored `ivprep-v6/.env.local` as `LIVEAVATAR_API_KEY`, and never paste it into chat. Then run `npm run probe:liveavatar-origin`, save only the returned exact origin as `LIVEAVATAR_LIVEKIT_ORIGIN`, restart, and run the real synchronized smoke.
2. Online authority: create/register an IV Prep mission, product passport, authenticated founder/private-preview route, secret owner, retention/consent policy, deployment target, allowlist, and rollback owner. This is a release-authority task, not permission to improvise a host.
3. Only after both gates pass: deploy the sealed tag to that private target, verify direct-link denial/logout/revocation/no indexing, run the full provider smoke, and reissue the beta decision.

Do not expose localhost through a tunnel, deploy to live student routes, mutate Kinsta production, or mount V6 into the shared Railway HQ server until those authorities exist.
