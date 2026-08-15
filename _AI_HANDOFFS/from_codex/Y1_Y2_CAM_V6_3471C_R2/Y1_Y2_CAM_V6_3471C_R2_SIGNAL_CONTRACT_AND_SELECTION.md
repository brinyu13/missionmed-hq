# Y1-Y2-CAM-V6-3471C-R2 — Signal Contract and Founder Selection Sheet

Status: `ROUND-2 ARSENAL COMPLETE — FOUNDER SELECTION REQUIRED`

This sheet covers exactly 15 instrument families × 6 options = 90 permanent concept IDs. It is a design-selection contract, not a runtime or provider acceptance record.

## 1. Governing interpretation boundary

Every concept teaches only observable delivery behavior. None may claim or imply honesty, lying, deception, truth, memorization, personality, confidence, nervousness, hidden emotional state, intent, identity, demographics, psychometrics, diagnosis, knowledge, ability, or actual trustworthiness.

Permitted bounded labels include:

- warmth-cue profile;
- competence-cue profile;
- delivery congruence;
- over-regular or script-like delivery pattern;
- low expressive variation;
- personal-best similarity;
- baseline deviation.

The five permitted target references are `MissionMed Standard`, `Personal Baseline`, `Personal Best`, `Session Target`, and `Answer-Phase Target`. The active target must dominate SIMPLE. Targets are references, not ground truth about a person.

## 2. Evidence and failure law

Support classes are exact:

- `CURRENTLY SUPPORTABLE`: accepted evidence already supplies the necessary observable primitive.
- `SUPPORTABLE WITH DERIVATION`: accepted primitives exist, but the named aggregation, segmentation, synchronization, or display transform must still be engineered and validated.
- `NEW ENGINEERING`: a required primitive, classifier, phase contract, composite, or replay subsystem is not present in accepted current truth.
- `NOT DEFENSIBLE`: no permitted observable contract could support the proposed interpretation. No Round-2 option uses this class.

Current accepted primitives include answer duration; captured digital dBFS and clipping; experimental speech-active, pause, energy-variation, transcript-rate and filler estimates; left/right hand presence, centers, zones, and motion episodes; torso/body presence and lean/sway proxies; face box, head-orientation proxies, sustained turn, facial movement; framing center/size and centered fraction; face count, primary-lock ambiguity, gaps, coverage, sample counts, and inference timing.

Current truth does **not** supply pitch/F0 contour, cadence-regularity truth, semantic gesture meaning, gesture vocabulary, automatic answer-phase truth, or the composite profiles proposed here. Those remain `NEW ENGINEERING` unless a row explicitly depends only on an accepted derivation.

All lanes use one monotonic `SessionClock`. A missing, stale, low-coverage, ambiguous, or misaligned required input yields `UNAVAILABLE`, `SUPPRESSED`, `WARMING UP`, or a visible broken lane. No silent interpolation, stale carry-forward, imputation, or weight renormalization is allowed. Raw audio, frames, landmarks, pixels, and embeddings are not persisted.

## 3. Option-level contracts

### VV — Voice Volume

| ID | Mechanic | Support / context | Signal contract | Fail closed | Two-second action and interpretation |
|---|---|---|---|---|---|
| VV1 | Soundline Target Corridor | CURRENTLY SUPPORTABLE · LIVE/HUD | smoothed captured digital dBFS + clipping → signed position within target corridor | audio gap, stale clock, invalid calibration → UNAVAILABLE | “Raise level into the corridor.” Relative captured level only. |
| VV2 | Shield Charge Meter | CURRENTLY SUPPORTABLE · LIVE/HUD | captured dBFS + clipping → accumulated in-band dwell on shield arc | audio gap or clipping uncertainty → UNAVAILABLE | “Add clean level; stop short of overload.” Target-band dwell only. |
| VV3 | Volume Capture Zone | SUPPORTABLE WITH DERIVATION · LIVE/HUD | captured dBFS + monotonic time → continuous target-band dwell and exit direction | gap resets capture; never bridge missing samples | “Re-enter the zone and hold.” Continuous target adherence. |
| VV4 | Level Bounce Course | SUPPORTABLE WITH DERIVATION · HUD/FILM ROOM | captured level + speech-active runs → median level per phrase pad | speech activity unavailable → no pad scoring | “Land the next phrase on target.” Phrase-level consistency. |
| VV5 | Volume Lock Reticle | CURRENTLY SUPPORTABLE · LIVE/HUD | signed level error + clipping → reticle spread and lock | clipping or audio gap → lock broken | “Close the reticle; hold clean level.” Instant target error/headroom. |
| VV6 | Voice Rev Band | CURRENTLY SUPPORTABLE · LIVE/FILM ROOM | captured dBFS + clipping → target-relative tach band | invalid calibration → relative-only; never claim SPL | “Shift into the target band.” Digital level versus target. |

### VP — Pitch Variation

| ID | Mechanic | Support / context | Signal contract | Fail closed | Two-second action and interpretation |
|---|---|---|---|---|---|
| VP1 | Pitch Terrain Route | NEW ENGINEERING · FILM ROOM | future reliable F0 contour + voicing confidence → range/turn route per phrase | no reliable F0 → UNAVAILABLE | “Add one clear rise or fall.” Fundamental-frequency movement only. |
| VP2 | Pitch Range Ladder | NEW ENGINEERING · LIVE/HUD | future F0 + phase clock → occupancy of personal-range pitch rungs | low voicing coverage → UNAVAILABLE | “Use another pitch level.” Used relative pitch range. |
| VP3 | Pitch Safe Ring | NEW ENGINEERING · LIVE/HUD | future F0 + baseline → normalized excursion ring | absent baseline → explicitly session-relative | “Open the ring with a deliberate turn.” Relative pitch excursion. |
| VP4 | Pitch Combo Tiles | NEW ENGINEERING · HUD/FILM ROOM | future F0 + phrase boundaries → low/mid/high phrase tiers and transitions | uncertain phrase → neutral tile, no penalty | “Change tier on the next phrase.” Pitch-tier movement. |
| VP5 | Pitch Note Arc | NEW ENGINEERING · FILM ROOM | future F0 contour + clock → phase-aligned note events | no F0 confidence → visible gap | “Place a clear contour turn here.” Timed contour movement only. |
| VP6 | Pitch Orbit Control | NEW ENGINEERING · LIVE/HUD | future F0 distribution + baseline → floor/center/ceiling occupancy | insufficient voiced duration → UNAVAILABLE | “Move away from the crowded band.” Relative band occupancy. |

### VC — Speaking Pace

| ID | Mechanic | Support / context | Signal contract | Fail closed | Two-second action and interpretation |
|---|---|---|---|---|---|
| VC1 | Phrase Runway | SUPPORTABLE WITH DERIVATION · LIVE/HUD | transcript timing + speech activity → rolling WPM per bounded speech run | transcript latency/confidence gap → UNAVAILABLE | “Ease the next phrase into range.” Estimated word rate only. |
| VC2 | Pace Stamina Bar | SUPPORTABLE WITH DERIVATION · LIVE/HUD | word timing + speech/silence → integrated rolling pace error | missing timing → frozen and unavailable; silence cannot fake recharge | “Release the sprint; add space.” Pace sustainability. |
| VC3 | Pace Phase Gates | SUPPORTABLE WITH DERIVATION · HUD/FILM ROOM | word timing + answer-phase markers → WPM inside explicit phases | no phase marker → whole-answer view only | “Clear this phase gate more deliberately.” Phase-specific word rate. |
| VC4 | Pace Build Rhythm | SUPPORTABLE WITH DERIVATION · LIVE/HUD | transcript word events + clock → short-window word-density bins | late transcript → provisional bins, no silent backfill | “Leave a clean gap before the next build.” Short-window density. |
| VC5 | Pace Gearbox | SUPPORTABLE WITH DERIVATION · LIVE/FILM ROOM | transcript timing + active-speech time → target-relative pace gear | low transcript confidence → neutral gear | “Downshift one gear.” Active-speech estimated WPM. |
| VC6 | Pace Possession Clock | SUPPORTABLE WITH DERIVATION · FILM ROOM | word count + answer duration + phase → cumulative words versus elapsed phase | missing word timing → duration only, no pace judgment | “Use the remaining phase with more space.” Words per phase time. |

### VR — Cadence Variation / Regularity

| ID | Mechanic | Support / context | Signal contract | Fail closed | Two-second action and interpretation |
|---|---|---|---|---|---|
| VR1 | Cadence Break Tiles | NEW ENGINEERING · LIVE/HUD | speech runs + pauses + phrase timing → repeated duration tiles | segmentation uncertainty → UNAVAILABLE | “Break the repeated timing pattern.” Temporal regularity only. |
| VR2 | Cadence Pulse Trap | NEW ENGINEERING · HUD/FILM ROOM | speech/pause intervals → bounded regularity pulse | fewer than four valid intervals → insufficient evidence | “Vary one phrase or pause length.” Interval regularity. |
| VR3 | Cadence Combo Spacing | NEW ENGINEERING · LIVE/HUD | phrase onsets + pauses → adjacent spacing-variation chain | gap resets chain | “Change the spacing on the next beat.” Local temporal variation. |
| VR4 | Cadence Storm Pulse | NEW ENGINEERING · FILM ROOM | segmented event impulses → regularity envelope | unreliable speech activity → no envelope | “Open space between repeated pulses.” Patterned timing density. |
| VR5 | Cadence Beat Lanes | NEW ENGINEERING · FILM ROOM | speech starts + pauses + clock → aligned event lanes and intervals | missing monotonic time → UNAVAILABLE | “Repeat this varied beat pattern.” Event timing/spacing. |
| VR6 | Cadence Fight Spacing | NEW ENGINEERING · LIVE/HUD | phrase boundaries + pause history → bounded next-onset predictability | insufficient history → WARMING UP | “Delay or advance the next phrase slightly.” Timing predictability only. |

### VW — Audio Waveform

| ID | Mechanic | Support / context | Signal contract | Fail closed | Two-second action and interpretation |
|---|---|---|---|---|---|
| VW1 | Waveform Target Band | CURRENTLY SUPPORTABLE · LIVE/HUD | non-persistent amplitude envelope + clipping + clock → trace versus band | audio gap breaks trace; never interpolate | “Bring the waveform body into band.” Captured envelope only. |
| VW2 | Waveform Tunnel | CURRENTLY SUPPORTABLE · LIVE/HUD | amplitude envelope + target → time-local tunnel error | missing samples → open tunnel segment | “Steer the next phrase toward center.” Relative envelope trajectory. |
| VW3 | Waveform Shield Ripples | SUPPORTABLE WITH DERIVATION · HUD/FILM ROOM | envelope + speech-active runs → per-run energy ripple | no speech activity → raw envelope view only | “Make the next ripple match target.” Speech-run energy proxy. |
| VW4 | Waveform Terrain Ridge | CURRENTLY SUPPORTABLE · FILM ROOM | envelope + clipping + clock → bounded display bins/ridge | gaps stay blank; clipping explicit | “Return from this valley to the plateau.” Time-local amplitude shape. |
| VW5 | Waveform Sonar Sweep | CURRENTLY SUPPORTABLE · LIVE/HUD | rolling amplitude window → target-relative polar sweep | stale window stops and labels stale | “Fill the next sweep to the target arc.” Recent envelope. |
| VW6 | Waveform Telemetry Ribbon | CURRENTLY SUPPORTABLE · FILM ROOM | envelope bins + clipping + target error → three aligned derived lanes | gap breaks all aligned lanes | “Inspect the marked overage, then recover.” Derived amplitude telemetry. |

### GZ — Gesture Operating Zone

| ID | Mechanic | Support / context | Signal contract | Fail closed | Two-second action and interpretation |
|---|---|---|---|---|---|
| GZ1 | Gesture Operating Field | SUPPORTABLE WITH DERIVATION · LIVE/HUD | L/R hand centers + torso anchor → body-relative dead/useful/overflow zones | insufficient torso/hand coverage → UNAVAILABLE | “Bring the active hand into the useful field.” Hand location only. |
| GZ2 | Dual Hand Lanes | SUPPORTABLE WITH DERIVATION · LIVE/HUD | L/R presence and centers + anchor → independent hand lanes | unknown side → unassigned lane, never swap | “Recover the missing hand lane.” Per-hand position. |
| GZ3 | Gesture Capture Zones | SUPPORTABLE WITH DERIVATION · LIVE/HUD | hand centers + clock → zone dwell and transitions | tracking gap resets dwell | “Move to a new useful zone and hold.” Zone occupancy/relocation. |
| GZ4 | Gesture Build Grid | SUPPORTABLE WITH DERIVATION · HUD/FILM ROOM | hand centers + torso box → occupied body-grid cells | low coverage → incomplete-grid label | “Use one clear neighboring cell.” Spatial occupancy. |
| GZ5 | Gesture Court Map | SUPPORTABLE WITH DERIVATION · FILM ROOM | L/R body-relative centers → decaying per-hand position marks | multi-person ambiguity → suppress mapping | “Shift the next gesture into open space.” Spatial distribution. |
| GZ6 | Gesture Reach Arcs | SUPPORTABLE WITH DERIVATION · LIVE/HUD | hand centers + torso/shoulder scale → normalized radial distance | absent scale anchor → UNAVAILABLE | “Shorten the reach into the useful arc.” Body-relative reach only. |

### GH — Gesture Heatmap

| ID | Mechanic | Support / context | Signal contract | Fail closed | Two-second action and interpretation |
|---|---|---|---|---|---|
| GH1 | Left / Right Heat Field | SUPPORTABLE WITH DERIVATION · FILM ROOM | L/R hand centers + torso anchor → independent density fields | side or multi-person ambiguity → SUPPRESSED | “Open a cooler useful zone.” Per-hand spatial density. |
| GH2 | Gesture Decay Trail | SUPPORTABLE WITH DERIVATION · LIVE/HUD | timestamped hand centers → bounded time-decay trail | timestamp gap clears trail | “Move away from the repeated hotspot.” Recent location density. |
| GH3 | Gesture Safe-Zone Heatmap | SUPPORTABLE WITH DERIVATION · HUD/FILM ROOM | spatial density + body-relative safe zone → in/out density relation | body anchor absent → UNAVAILABLE | “Bring heat back inside the zone.” Density versus useful zone. |
| GH4 | Gesture Repetition Hotspot | SUPPORTABLE WITH DERIVATION · FILM ROOM | motion-episode centroids → recent spatial clusters/revisits | fewer than three episodes → WARMING UP | “Start the next episode elsewhere.” Spatial repetition only. |
| GH5 | Gesture Territory Map | SUPPORTABLE WITH DERIVATION · FILM ROOM | hand positions + body grid → occupancy/revisit counts | low coverage → unknown cells stay hatched | “Claim one unvisited useful cell.” Body-relative coverage. |
| GH6 | Gesture Shot Chart | SUPPORTABLE WITH DERIVATION · FILM ROOM | episode centroid + side + time → one replay-selectable event mark | uncertain side → neutral; uncertain time → omit | “Replay the cluster, then vary placement.” Event-location distribution. |

### GS — Gesture + Speech Synchrony

| ID | Mechanic | Support / context | Signal contract | Fail closed | Two-second action and interpretation |
|---|---|---|---|---|---|
| GS1 | Handstorm Impact Window | SUPPORTABLE WITH DERIVATION · LIVE/HUD | hand-motion peaks + non-semantic energy peaks + clock → signed timing offset | either stream absent → UNAVAILABLE | “Move the gesture onto the emphasized beat.” Temporal proximity only. |
| GS2 | Gesture Speech Combo | SUPPORTABLE WITH DERIVATION · LIVE/HUD | motion peaks + speech activity/energy → bounded co-occurrence chain | tracking/audio gap resets chain | “Hit the next spoken beat together.” Event co-occurrence. |
| GS3 | Synchrony Convergence Rings | SUPPORTABLE WITH DERIVATION · HUD/FILM ROOM | gesture event + energy event → nearest signed time offset | ambiguous matches → no forced pairing | “Bring the gesture earlier.” Nearest-event timing. |
| GS4 | Emphasis Hit Windows | NEW ENGINEERING · LIVE/HUD | future explicit emphasis markers + motion events → hit/miss windows | absent marker → separate motion/speech view | “Place one gesture inside this window.” Timing to explicit marker. |
| GS5 | Synchrony Rhythm Track | SUPPORTABLE WITH DERIVATION · FILM ROOM | energy envelope + motion magnitude + clock → aligned traces | skew or missing lane → visibly broken track | “Replay this offset and tighten it.” Aligned activity traces. |
| GS6 | Synchrony Telestrator | SUPPORTABLE WITH DERIVATION · FILM ROOM | motion events + energy peaks + mentor markers → selectable replay events | unpaired events stay visible | “Click the offset pair and review.” Event timing relationship. |

### FF — Camera / Framing

| ID | Mechanic | Support / context | Signal contract | Fail closed | Two-second action and interpretation |
|---|---|---|---|---|---|
| FF1 | Camera Dock | CURRENTLY SUPPORTABLE · LIVE/HUD | face center/size + face count → signed dock errors | face count ≠ 1 → SUPPRESSED | “Move slightly left and closer.” Framing proxies only. |
| FF2 | Framing Gravity Field | CURRENTLY SUPPORTABLE · LIVE/HUD | center + size + primary-lock coverage → directional correction | primary ambiguity → UNAVAILABLE | “Follow the pull toward center.” Frame position/size error. |
| FF3 | Squad Ready Frame | CURRENTLY SUPPORTABLE · LIVE/HUD | face count, center, scale, coverage → four exposed readiness contributors | unavailable contributor stays unknown, never green | “Clear the size check; others hold.” Observable readiness only. |
| FF4 | Framing Quest Arrow | CURRENTLY SUPPORTABLE · LIVE/HUD | explicit center/size errors → dominant signed correction | tie/ambiguity → multiple arrows, no guess | “Move up one step.” Dominant framing correction. |
| FF5 | Framing Pit Alignment | CURRENTLY SUPPORTABLE · LIVE/FILM ROOM | face-box stream + target box + clock → boundary error and centered fraction | gap breaks the segment | “Return to the pit box.” Time-local alignment. |
| FF6 | Framing Acquisition Reticle | CURRENTLY SUPPORTABLE · LIVE/HUD | count + primary lock + center + size → independent reticle brackets | extra face/ambiguity → lock broken | “Hold one clear centered frame.” Framing acquisition only. |

### CD — Delivery Congruence

| ID | Mechanic | Support / context | Signal contract | Fail closed | Two-second action and interpretation |
|---|---|---|---|---|---|
| CD1 | Congruence Lock Core | NEW ENGINEERING · LIVE/HUD | selected voice/timing/gesture/framing contributors → fixed exposed composite | any required shard absent → UNAVAILABLE | “Recover the timing shard.” Cross-channel alignment only. |
| CD2 | Congruence Gate Array | NEW ENGINEERING · HUD/FILM ROOM | phase-bounded contributor states → ordered transparent gates | missing contributor leaves named gate open | “Clear the gesture-timing gate next.” Co-occurring target states. |
| CD3 | Congruence Split Screen | NEW ENGINEERING · FILM ROOM | voice/timing and motion/framing deviations → shared-time comparison | clock misalignment → no comparison | “Bring both halves toward target together.” Simultaneous pattern deviation. |
| CD4 | Congruence Squad Bar | NEW ENGINEERING · LIVE/HUD | four named contributors → largest explicit target deviation | unavailable required member blocks team state | “Help the timing member recover.” Weak-link contributor state. |
| CD5 | Congruence Ability Orbit | NEW ENGINEERING · LIVE/HUD | normalized named contributors + phase → individual target-error orbits | missing orbit remains visible; no renormalization | “Tighten the outer gesture orbit.” Contributor alignment. |
| CD6 | Congruence Lineup Board | NEW ENGINEERING · FILM ROOM | phase states for voice/timing/gesture/framing → phase matrix | no phase marker → session-only lineup | “Review the explain-phase mismatch.” Phase-specific status. |

### CW — Warmth-Cue Profile

| ID | Mechanic | Support / context | Signal contract | Fail closed | Two-second action and interpretation |
|---|---|---|---|---|---|
| CW1 | Warmth-Cue Banner | NEW ENGINEERING · LIVE/HUD | approved named observable cues → fixed reviewable profile | any required cue absent → UNAVAILABLE | “Add the missing observable cue.” Warmth-cue profile, never actual warmth. |
| CW2 | Warmth-Cue Shard Core | NEW ENGINEERING · LIVE/HUD | facial movement, orientation, voice variation, synchrony → exposed shards | unsupported pitch shard stays unavailable | “Recover the orientation shard.” Observable associated cues only. |
| CW3 | Warmth-Cue Quest List | NEW ENGINEERING · HUD/FILM ROOM | phase-bounded approved cue events → literal cue checklist | absent phase/cue evidence → unknown checkbox | “Complete one more cue objective.” Presence of named cues. |
| CW4 | Warmth-Cue Balance Field | NEW ENGINEERING · LIVE/HUD | normalized named contributors → target-envelope radar | missing axis stays broken and blocks summary | “Open the underused gesture-timing axis.” Multi-cue profile only. |
| CW5 | Warmth-Cue Orbit | NEW ENGINEERING · LIVE/FILM ROOM | timestamped approved cue events + phase → timing/co-occurrence orbit | clock gap breaks orbit | “Bring a cue into the close phase.” Cue timing/co-occurrence. |
| CW6 | Warmth-Cue Stat Line | NEW ENGINEERING · FILM ROOM | cue events + coverage + phase duration → counts/timing/target relation | low coverage labels statistic unavailable | “Review the low-coverage cue.” Observable cue statistics, no grade. |

### CC — Competence-Cue Profile

| ID | Mechanic | Support / context | Signal contract | Fail closed | Two-second action and interpretation |
|---|---|---|---|---|---|
| CC1 | Competence-Cue Mission Stack | NEW ENGINEERING · LIVE/HUD | phase control, framing, pace, delivery structure → exposed cue modules | absent module → incomplete stack | “Stabilize the pace module.” Profile only, never actual competence. |
| CC2 | Competence-Cue Readiness Gates | NEW ENGINEERING · LIVE/HUD | named cue states/coverage → independent readiness gates | unknown gate stays open and blocks READY | “Clear the framing gate.” Observable cue readiness. |
| CC3 | Competence-Cue Tactical Board | NEW ENGINEERING · FILM ROOM | phase markers + delivery-only cue events → phase-node map | absent semantic phase → generic answer phases | “Strengthen the close-phase delivery cue.” Organization cues only. |
| CC4 | Competence-Cue Weak-Link Vector | NEW ENGINEERING · LIVE/HUD | approved normalized contributors → largest explicit deviation | required vector absent → composite blocked | “Correct the pace vector first.” Dominant cue deviation. |
| CC5 | Competence-Cue Skill Tree | NEW ENGINEERING · HUD/FILM ROOM | cue events/target relations → transparent phase prerequisites | missing evidence leaves node unknown | “Build the missing transition cue.” Delivery-cue coverage only. |
| CC6 | Competence-Cue Box Score | NEW ENGINEERING · FILM ROOM | phase cue measures + coverage → target-relative table | missing phase/contributor stays blank and labeled | “Review the explain-phase gap.” Observable cue statistics. |

### CM — Mechanical / Over-Regular Delivery

| ID | Mechanic | Support / context | Signal contract | Fail closed | Two-second action and interpretation |
|---|---|---|---|---|---|
| CM1 | Regularity Trap Breaker | NEW ENGINEERING · LIVE/HUD | phrase/pause durations + pace windows → repeated timing tiles | insufficient intervals → WARMING UP | “Break one repeated tile.” Over-regular timing only. |
| CM2 | Regularity Radar | NEW ENGINEERING · HUD/FILM ROOM | approved timing/pace/level/motion variation → named radar axes | unsupported axis stays broken; no renormalization | “Vary the dominant timing axis.” Regularity profile only. |
| CM3 | Script-Like Pattern Timeline | NEW ENGINEERING · FILM ROOM | phrase timing, pace, energy, motion → similar delivery-only window shapes | below coverage threshold → UNAVAILABLE | “Replay the repeated delivery shape.” Pattern, not memorization. |
| CM4 | Variation Combo Builder | NEW ENGINEERING · LIVE/HUD | target-aligned timing/pace/level/motion changes → distinct combo links | missing channel is neither zero nor bonus | “Add one timing variation link.” Controlled variation. |
| CM5 | Sameness Beat Lane | NEW ENGINEERING · FILM ROOM | delivery-only phrase feature vectors → adjacent shape similarity | feature gap breaks sequence; no imputation | “Mark the first useful break.” Phrase-shape similarity. |
| CM6 | Regularity Lap Delta | NEW ENGINEERING · FILM ROOM | phrase-bounded timing/energy features → phrase-to-phrase deltas | fewer than three phrases → insufficient evidence | “Make the next lap deliberately different.” Pattern repeatability. |

### CT — Storytelling Delivery

| ID | Mechanic | Support / context | Signal contract | Fail closed | Two-second action and interpretation |
|---|---|---|---|---|---|
| CT1 | Story Delivery Runway | NEW ENGINEERING · LIVE/HUD | explicit/derived phases + approved measures → phase-specific runway targets | absent phase truth → manual markers required | “Build energy into the turn.” Phase-shaped delivery only. |
| CT2 | Story Delivery Quest Map | NEW ENGINEERING · FILM ROOM | phase/mentor markers + delivery events → chronological path | no markers → generic chronological nodes | “Add a deliberate pause at the turn.” Event sequence only. |
| CT3 | Setup–Turn–Payoff Zones | NEW ENGINEERING · LIVE/HUD | phase markers + pace/level/pause/gesture → three transparent zone states | missing phase/signal → zone unknown | “Capture the payoff zone with a firmer close.” Phase targets only. |
| CT4 | Story Beat Combo | NEW ENGINEERING · LIVE/HUD | phase transitions + pause/energy/motion events → transition chain | no reliable phases → no combo scoring | “Make the next transition unmistakable.” Delivery transitions only. |
| CT5 | Story Decision Trail | NEW ENGINEERING · FILM ROOM | phase-bounded measures → dominant observable delivery shift per phase | ties stay multi-branch; no guessed intent | “Compare the two possible close shapes.” Delivery shift only. |
| CT6 | Story Momentum Board | NEW ENGINEERING · FILM ROOM | delivery events + phase clock → event density/target relation | missing lane stays blank and blocks total | “Review the flat middle phase.” Delivery-event momentum proxy. |

### TM — Master Flight Recorder

All TM options must present synchronized, clickable lanes for: question; answer phase; voice level; pitch; pace; speech/silence/pause; facial activity/smile cue; head; torso; left hand; right hand; gesture; gesture-speech synchrony; framing; mentor markers; `PERFECT`; `REMEMBER THIS`; coaching events; personal best; mission target; and system events. Every selected event must answer `WHEN`, `WHAT ELSE`, and `WHERE TO CLICK`. Unsupported lanes remain visibly unavailable.

| ID | Mechanic | Support / context | Signal contract | Fail closed | Two-second action and interpretation |
|---|---|---|---|---|---|
| TM1 | Threadline Flight Recorder | SUPPORTABLE WITH DERIVATION · FILM ROOM/ADMIN | all approved derived lanes + markers → one monotonic clickable playhead | lane gap stays visible; raw media not persisted | “Click the drift marker and inspect every lane.” Synchronized evidence. |
| TM2 | Replay Command Wheel | NEW ENGINEERING · FILM ROOM | phase/delivery/mentor/system events → selectable radial time sectors | missing lane marks sector incomplete | “Open the marked sector.” Event timing and lane availability. |
| TM3 | Delivery Filmstrip | SUPPORTABLE WITH DERIVATION · FILM ROOM | approved event/trace lanes → common display bins | gaps blank; cross-lane skew blocks alignment | “Scrub to the first recovery.” Time-aligned derived traces. |
| TM4 | Session Tactical Map | NEW ENGINEERING · FILM ROOM/ADMIN | phases + coaching/mentor/system/target events → immutable event graph | unresolved timestamp/source → unlinked evidence | “Open the weak-link node.” Session event topology. |
| TM5 | Replay Telestrator | SUPPORTABLE WITH DERIVATION · FILM ROOM | derived lanes + mentor/coaching/target events → shared playhead/markers | invalid-time marker stays in unplaced list | “Click REMEMBER THIS and compare lanes.” Annotated replay. |
| TM6 | Session Telemetry Stack | SUPPORTABLE WITH DERIVATION · FILM ROOM/ADMIN | approved summaries/events → shared-time lane stack with phase/target overlays | unavailable lane remains named and broken | “Jump to the personal-best event.” Derived session telemetry. |

## 4. Founder selection ledger

Use only: `LOCK`, `KEEP AS BASE`, `REFINE`, `REJECT`, `COMBINE`, `SHOW MORE LIKE`.

For `COMBINE`, use: `BASE <ID> + DONOR <ID> + TRANSPLANT <exact mechanic> + PRESERVE <exact mechanic>`.

| Family | Permanent IDs | Founder disposition / notes |
|---|---|---|
| Voice Volume | VV1 · VV2 · VV3 · VV4 · VV5 · VV6 | |
| Pitch Variation | VP1 · VP2 · VP3 · VP4 · VP5 · VP6 | |
| Speaking Pace | VC1 · VC2 · VC3 · VC4 · VC5 · VC6 | |
| Cadence Variation / Regularity | VR1 · VR2 · VR3 · VR4 · VR5 · VR6 | |
| Audio Waveform | VW1 · VW2 · VW3 · VW4 · VW5 · VW6 | |
| Gesture Operating Zone | GZ1 · GZ2 · GZ3 · GZ4 · GZ5 · GZ6 | |
| Gesture Heatmap | GH1 · GH2 · GH3 · GH4 · GH5 · GH6 | |
| Gesture + Speech Synchrony | GS1 · GS2 · GS3 · GS4 · GS5 · GS6 | |
| Camera / Framing | FF1 · FF2 · FF3 · FF4 · FF5 · FF6 | |
| Delivery Congruence | CD1 · CD2 · CD3 · CD4 · CD5 · CD6 | |
| Warmth-Cue Profile | CW1 · CW2 · CW3 · CW4 · CW5 · CW6 | |
| Competence-Cue Profile | CC1 · CC2 · CC3 · CC4 · CC5 · CC6 | |
| Mechanical / Over-Regular Delivery | CM1 · CM2 · CM3 · CM4 · CM5 · CM6 | |
| Storytelling Delivery | CT1 · CT2 · CT3 · CT4 · CT5 · CT6 | |
| Master Flight Recorder | TM1 · TM2 · TM3 · TM4 · TM5 · TM6 | |

## 5. Selection stop

No selected concept is approved for product integration until the Founder records a disposition against its permanent ID. This package stops at arsenal selection.
