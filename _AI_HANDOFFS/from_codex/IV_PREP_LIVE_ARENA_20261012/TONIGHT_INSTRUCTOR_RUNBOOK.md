# Tonight instructor runbook — corrected classroom candidate

## Readiness

LOCAL REHEARSAL READY. NOT DEPLOYED / NOT YET PRODUCTION READY. Corrected-shell real-call acceptance, roster definition, exact release approval and actual WordPress role/persistence acceptance remain gates. Do not run tonight's student class against the synthetic roster harness.

## Open the current local rehearsal

The server is already running at http://127.0.0.1:8766/. Open the “MissionMed IV Prep Live Arena” Chrome tab. If restarting the local server:

```sh
cd /Users/brianb/MissionMed_worktrees/matrix-ivprep-live-arena-20261012
php -S 127.0.0.1:8766 tests/ivprep-live-arena/router.php
```

Choose Enter as test instructor if shown. This grants no production access. Session → choose TEST SessionA/B → label → Create session, or resume an existing fixture.

## Rehearse the full workflow

1. Keep the actual meeting in Webex. Use headphones. Pin the student so the chosen Webex window shows the intended student video. Student does nothing extra.
2. In Arena choose the student's avatar; explicitly confirm presence if requested. Roster & Teams lets you mark attendance and assign Blue/Red. Do not infer attendance from enrollment.
3. Enter the question. Start Interview. In Chrome's picker select the WEBEX WINDOW and enable “Also share app audio”. Allow microphone capture. Missing incoming audio is a hard failure.
4. Inspect the central muted preview. If it shows Arena or another window, End Interview and redo capture. Have instructor and student speak separately, then conversationally. The preview has video only; recording receives both audio sources.
5. End Interview. Wait for local finalization. Play the clip in the central stage. Verify intended video, both distinct voices, synchronization, no echo and no conversation delay.
6. In Review / Playback, Save recording locally. Reopen that saved file for the selected interview. SHA256 must match before custody is considered safe for the next interview. Keep files on the instructor machine; there is no cloud backup/upload.
7. Check the explicit BOTH voices/video review confirmation and Confirm review. Close the review drawer, enter0–10points and Award points. Verify the student's total, team total and leaderboard. Undo points adds a compensating history event.
8. Reload and resume the same session. Verify scores and team assignment persist. Select the old interview and reopen its local file for later playback.

Maximum clip:20minutes or256MB. Browser memory/blob URLs are temporary. Do not close an unsaved clip. The app blocks a new interview until the previous clip is saved and reopened.

## Failure recovery

- Permission canceled / missing app audio: no successful recording claim; reselect Webex with audio.
- Capture track ends: interrupted clip, save it; it is not accepted as a finalized review.
- Save fails: preserve the clip, use Retry the same save. For409reload saved state, then retry the same finalization. Do not repeat the award under a new request ID.
- Browser closed during recording: no media recovery guarantee. Reopen session and Close interrupted attempt; preserve any saved local files.
- Playback error or mismatched file: review stays blocked. Choose the correctly associated saved file.
- Local End Interview remains usable during capture regardless of network status. Scoring/review are disabled until the active interview ends.

## Production launch after all gates

1. Resolve roster choice: broad MissionResidency360 eligibility with manual attendance, or IVPrepComplete5227-only. The current adapter uses the verified SessionA/B 360elite template and is a candidate, not confirmed class membership.
2. Complete corrected-shell real-call rehearsal and independent final-source review.
3. Approve exact6new runtime files in RELEASE_CANDIDATE.json. No protected DrJ/Matrix/provider files, tests or broad plugin deployment.
4. Acquire fresh exact production PATH lease; read current preimages and stop if any new destination already exists unexpectedly. Upload subfiles first and MU-plugin entry last. No cache purge or source override.
5. In actual WordPress verify anonymous/student denial, instructor nonce access, roster snapshot, isolated synthetic canary session create/reload, capture/review/award/undo/reload, and unchanged DrJ source/state. Independent acceptance required. Provider host-join is not part of this release.
6. Only then open https://missionmedinstitute.com/ivprep-live-arena/ as instructor, create tonight's actual session, confirm attendee identities and run class. Present classroom can be shared visually through Webex. No public student leaderboard or student account setup is introduced.

## Rollback

Before activation record SHA256/preimages for the6new files. Disable only `wp-content/mu-plugins/missionmed-ivprep-live-arena.php` by renaming it out of the MU-plugin PHP loader, then verify the IVPrep route is inactive. Preserve dedicated option records `mmed_ivprep_arena_session_*` and local recordings for recovery. Do not delete DrJ or Arena history, reset options, roll back unrelated Git commits, replace shared assets or purge caches. Restore only this extension's captured preimages if it already existed under an approved revision. Current local-only rollback is to stop the loopback server after saving all clips; leave fixture/history/source intact.
