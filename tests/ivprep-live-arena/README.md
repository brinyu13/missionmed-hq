# IV Prep Live Arena verification

Run from repository root:

```sh
php tests/ivprep-live-arena/state-test.php
node tests/ivprep-live-arena/recorder-test.mjs
php -S 127.0.0.1:8766 tests/ivprep-live-arena/router.php
# In another shell:
python3 tests/ivprep-live-arena/http-test.py
```

Open http://127.0.0.1:8766/ in Chrome and choose **Enter as test instructor**.
Only loopback requests and localhost/127.0.0.1 Host headers are accepted.
The fixture login is deliberately synthetic and provides NO production authentication.
Fixture state is private local JSON under the OS temporary directory's
`ivprep-arena-local-<uid>` folder; it is not a production storage guarantee.
Do not deploy the tests directory.

The PHP reducer and browser modules are the same code used by the dedicated
WordPress extension. The harness substitutes fixture auth/rosters and a locked,
atomic JSON store for WordPress auth/rosters/options CAS. The HTTP tests therefore
do not establish production WordPress acceptance.

Recorder tests use doubles for media and minimal DOM/network state. Their role is
failure handling and recovery, never audio/video proof. Real two-person recording
acceptance uses `/capture-proof` or the integrated UI, a selected Webex window with
**Also share app audio** enabled, the instructor microphone and headphones.
Play the final clip and hear each voice separately; save and reopen the file.
No upload, WebRTC connection, conferencing endpoint or virtual device is involved.

The frontend regression covers prior interview A selected, new recording B,
finish-save 409, reload, same-request retry, rejected historical-file substitution,
matching B reopened and next interview enabled. The backend tests cover separate
students/sessions, retry deduplication, stale writes, failures, role/nonce checks,
compensating undo and roster truncation rejection.

The corrected shell reuses the production-equal DrJ preview HTML/CSS and Team
Challenge style/markup; the original controllers are never loaded. Existing static
avatar assets are served read-only by a finite-name local allowlist. Team assignment
and passive HTTPS Webex meeting links are stored in the IVPrep session only.
Current acceptance counts:32PHP,15JS,19HTTP. Real Webex rehearsal is separate.
