# IV Prep classroom correction — October 12, 2026

Founder rejected the generic administrative dashboard. This correction continues the same mission, worktree and branch. Recording/state engines were retained; the rejected presentation was replaced with verified source-derived Dr J classroom components.

## Exact source reuse

All paths below are under `wp-content/plugins/missionmed-hub/` and were rechecked against production. Full hashes: CLASSROOM_SOURCE_PROVENANCE.json.

| Component | Verified source | Reuse in isolated extension |
| --- | --- | --- |
| Classroom shell and base CSS | assets/daily-drills-live-webex-preview.html, style block and legacyShell at line1063 | arena.css base rules; view.php mm-drill/app/header/center-column/playerShell/player-topbar/live-stage |
| Full-screen classroom, team panels, avatar pills, instructor controls | assets/daily-drills-team-challenge.js, injectStyles402–563, mountChallengeFrame565+, panelMarkup683 | Inert extracted CSS with mmed-team-challenge→ivprep-classroom namespace; adapted panel/adminbar markup |
| Avatar assets and deterministic selection | same JS professionalAvatarFiles/hashString/initialsFromName; assets/team-challenge-avatars/*.webp | Existing10staticimages reused read-only; no student photo lookup or copied DrJ roster |
| Route/bootstrap ownership | includes/class-mmed-live-drills-preview.php278,1526,1568 | Inspected only. Dedicated MU-plugin route/auth and isolated option prefix retained |
| Webex browser joining | assets/daily-drills-live-webex-embed.js | Inspected only; not executed or represented as connected |

The original HTML alone does not represent the production classroom: the team controller injects its actual appearance. The copied source blocks preserve those layers. Original controller IIFEs are not imported. They poll/mutate Dr J state and perform provider calls.

## Adaptations

Header now MISSIONMED IV PREP LIVE ARENA. Blue/red panels contain the existing avatar art, selection glow, interview counts and individual/team totals. Team membership is saved in the isolated session; old sessions use stable roster-order fallback until assignment. Instructor explicitly confirms attendance. Session/roster dialogs keep the video stage dominant. Recording preview and finalized playback occupy the same stage. Review controls form a compact drawer. Leaderboard/history are available from the instructor bar. Future IVOC overlay exists but is hidden and has no analytics implementation.

## Exact Webex limitation

The original embedded host flow calls POST `/wp-json/mmed/v1/webex/start-meeting`; guest flow requests `/webex/guest-token`. Existing backend OAuth can refresh stored credentials. The embed controller also patches getUserMedia and uses the DrJ bootstrap meeting. Executing it wholesale would cross the current local-only provider/auth boundary and could couple meeting state to DrJ.

Current compatible adapter: MediaRecorder captures the instructor-selected Webex desktop window plus app audio and instructor microphone. The central preview is VIDEO ONLY to prevent unmuting it from creating feedback. The capture mixer remains unchanged. This is a local window preview, not an embedded Webex meeting or an individual participant media stream. Pin the interviewee in Webex manually. The passive meeting link is validated and saved only in the IVPrep session; clicking opens Webex normally. No scheduled meeting/provider list is fetched.

## Evidence and limits

Screenshots saved on the instructor desktop:
- `/Users/brianb/Desktop/DrJ-classroom-baseline-20261012.jpg`
- `/Users/brianb/Desktop/IVPrep-classroom-source-reuse-20261012.jpg`

Local browser verified session creation, avatar loading, explicit attendance and student selection. Independent reviewer confirmed matching classroom visual architecture. Tests:32PHP state/adapter assertions,15JS recorder/frontend checks,19HTTP checks. The latter use synthetic metadata and do not prove real recorded voices.

Founder previously reported BOTH voices and video from the capture proof;1818597bytes,3ms browser finalization,VP8video/Opusaudio and successful full decode. Agent did not independently listen. A later integrated recording showed the Arena window; target Webex student video was not established. A fresh corrected-shell rehearsal has been requested. Do not upgrade this to end-to-end human acceptance without that response.

All14 donor files match production. All130preexisting tracked source files match their initial preimages. No production source/state/provider/config mutations were performed. Global Matrix guard remains42 for unrelated stale/missing shared assets; no override used, no protected shared asset is in the extension write set.
