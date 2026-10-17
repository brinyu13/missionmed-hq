# Dr Kelly Test 1 Founder Operator Card

Current gate:

`TEST #1 ARMED - WAITING FOR FOUNDER PAID-TEST AUTHORIZATION`

## Prepared test

- Avatar: Dr Kelly only
- LemonSlice agent: `agent_9bdfc50ec0086043`
- Conversation model: `gpt-realtime-2.1`
- Rendering profile: Profile B native Realtime speech
- Founder-selectable voices: `marin`, `coral`, `shimmer`
- Hard maximum: 45 seconds
- Maximum provider objects: 1 LemonSlice session, 1 OpenAI Realtime session,
  1 LiveKit room/dispatch
- Paid retry: 0
- Automatic reconnect: 0
- Avatar recreation: 0

## Zero-cost local surface

Preparation-run URL:

`http://127.0.0.1:49700/iv-prep-on-call/#room`

Zero-cost launch command from `ivprep-v6/`:

`npm run start:3441r-founder-proof`

The default command is synthetic. It prints
`LOCAL_FOUNDER_PROOF_MODE=SYNTHETIC_ZERO_COST` and
`PROVIDER_CALLS_AT_STARTUP=0`. Page load and GET do not authorize or create a
session.

The paid live flag must not be used before separate Founder authorization.

## Spend safeguards armed

- exact agent and session-pinned voice validation;
- Founder-only, single-use authorization;
- separate Authorize and Start actions;
- exact 45-second deadline;
- one active-session uniqueness guard;
- termination and reconciliation armed before create;
- explicit status/cost reconciliation;
- no paid retry, reconnect, or recreation;
- credentials remain server-only;
- unknown remote creation or cleanup fails closed;
- kill switch available; and
- terminal evidence retained without provider credentials.

Current LemonSlice balance is not observed because this zero-cost authority
forbids provider and credential access. Maximum bounded exposure is one
45-second session; the exact credit conversion is unresolved.

## Founder authorization

When ready to open the separately bounded paid gate, send exactly:

`AUTHORIZE DR KELLY TEST #1`

No other wording authorizes the call.
