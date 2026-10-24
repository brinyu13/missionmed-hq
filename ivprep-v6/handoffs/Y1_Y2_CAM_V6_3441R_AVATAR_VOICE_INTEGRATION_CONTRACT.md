# Y1-Y2-CAM-V6-3441R Avatar and Voice Integration Contract

Status: IMPLEMENTED LOCALLY; EXTERNAL PROVIDERS FROZEN

## Fixed identity and profile

- LemonSlice agent: agent_9bdfc50ec0086043 only
- LemonSlice avatar participant identity: ivprep-3441r-lemonslice-avatar
- LemonSlice API origin: https://lemonslice.com/api/liveai/sessions
- Initial product persona: Dr Kelly
- Rendering profile: PROFILE_B_OPENAI_NATIVE_AUDIO
- Model: gpt-realtime-2.1
- Voice: one of marin, coral, or shimmer, pinned before session start
- Cedar: rejected by both gate and adapter
- Duration: exactly one Test #1 session, no more than 45 seconds

No configuration value may substitute another LemonSlice agent. An unavailable
Dr Kelly agent fails closed. Provider portability remains in the adapter
boundary, but 3441R supplies no alternate live agent.

## Runtime ownership

The browser owns student microphone/camera publication and consumes exactly one
exact-participant avatar video track plus one audible avatar audio track. It
requires a decoded video frame, successful audio play/playing evidence, and
server-confirmed ACTIVE state; wrong participants, unsubscribe, disconnect,
autoplay failure, and reconnect fail closed. After readiness, exact-avatar
unsubscribe, reconnect, or disconnect invokes the server termination path
exactly once; duplicate transport events cannot create duplicate end calls.
The HQ process owns
admission, the one-shot Founder authorization, reservation, room/participant
credentials, dispatch, browser-media readiness, termination request, and
terminal projection. The LiveKit AgentServer child is the sole owner of the
OpenAI AgentSession and LemonSlice session.

The worker may create the LemonSlice session only after an exact durable claim
binds subject, interview, reservation, nonce, dispatch, room, agent name,
profile, voice, maximum seconds, and participant identity. Browser ACTIVE
requires worker join, LemonSlice join, decoded video, playable audio, and audio
authority avatar-livekit.

## Conversation and latency contract

OpenAI Realtime uses gpt-realtime-2.1 with semantic_vad and eagerness auto.
There is no fixed five-second silence timer in the 3441R path. Reasoning effort
is low. Retry intervals and retry counts are zero. Reconnect is terminal and
cannot create another provider session.

Latency milestones are explicit: authorization, dispatch, worker join,
provider join, decoded video, playable audio, and terminal reconciliation.
The browser and server both disable automatic reconnect; the pinned OpenAI
Realtime adapter makes an unexpected clean WebSocket close terminal. Paid
end-to-end latency and perceptual naturalness remain unmeasured until the
Founder-authorized live Test #1.

## Layout and audio

The native MissionMed room defaults to STUDENT LARGE PRIMARY and Dr Kelly SMALL
INSET. The swap button is keyboard-accessible and exposes aria-pressed state.
Only the student camera is mirrored. The avatar track is not mirrored. A second
avatar audio track is detached, preserving one audible interviewer authority.
The mute control awaits and verifies the actual published LiveKit microphone
state. The live route CSP permits only its sealed exact LiveKit WSS origin.

## Paid-test safety law

Session creation requires all of:

1. current Founder admission and video entitlement;
2. a one-shot authorization issued by an explicit POST;
3. exact agent, profile, pinned voice, and 45-second contract;
4. termination, reconciliation, single-session, zero-retry, zero-reconnect,
   and zero-recreation arms;
5. one durable reservation and nonce;
6. one named JRP_NEVER dispatch; and
7. no existing or terminal session for the gate.

GET, page load, health, startup, ordinary user, wrong/reused/expired
authorization, wrong agent, Cedar, duration drift, account/cookie/entitlement
switch, CSRF/origin failure, controller failure, reconnect, unknown create, or
uncertain termination produces NO SESSION or a terminal failed-closed result.

## Termination and cost

Every terminal trigger converges on one child-owned teardown promise. It stops
new output, terminates LemonSlice, reads terminal provider status, reconciles
cost evidence, closes the AgentSession again after any in-flight start settles,
and retains the sole LemonSlice SDK session handle across local close so an
in-flight start cannot erase its session ID before terminate/status. It then
allows LiveKit job shutdown. HQ waits for durable reconciliation before
deleting dispatch and room. Unknown create or unconfirmed termination trips
the kill switch and prevents another paid start.

Required server-side names are OPENAI_API_KEY, LEMONSLICE_API_KEY,
LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET,
IVPREP_FOUNDER_PROOF_GATE_URL, IVPREP_FOUNDER_PROOF_GATE_TOKEN, and the explicit
IVPREP_FOUNDER_TEST1_LIVE_ENABLED gate. This record names variables only; no
value was read, persisted, or exposed.

## Current boundary

The default durable worker gate remains deny-all and production wiring remains
absent. The loopback harness defaults to synthetic transports. Live mode is
unavailable unless the exact command flag and server-side live-enable gate are
both present. Even then, current authority still prohibits execution until the
Founder separately authorizes Test #1.
