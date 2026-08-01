# B1-510K Replay Root Cause

## Verdict

The saved audio, database attachment, private R2 object, authorization, signed
URL, Range response, MIME type, and Option A WebM/Opus output were healthy.
Replay failed because the WordPress response CSP allowed only `media-src
'self' blob:` while the signed media URL used the private R2 origin.

`MISSIONMED_STORYFORGE_R2_ENDPOINT` was absent on Kinsta. The existing route
already derives both `media-src` and `connect-src` from that exact configured
origin; no wildcard and no public-bucket change were needed.

## Reproduction

- Founder student opened Library story `gas station`.
- The player requested two bounded playback grants.
- The browser then showed `Playback unavailable. Try again.`
- Railway recorded the grants and no HTTP 5xx.
- The permanent asset was `verified`, WebM/Opus, 1,013,215 bytes, 62.639 seconds.
- Signed full GET: HTTP 200.
- Signed Range `0-65535`: HTTP 206 with `Accept-Ranges: bytes` and exact CORS.

## Repair

Kinsta now defines the existing `MISSIONMED_STORYFORGE_R2_ENDPOINT` constant to
the exact Railway R2 endpoint. Public CSP verification requires that same exact
origin in `media-src` and `connect-src`.

No R2 permission, object, API endpoint, JWT, RLS policy, database row, assembly
executor, or media format changed.

## Live result

After hard refresh, the same saved Library story played in the authenticated
Founder Chrome session. Play, pause, resume, progress, and keyboard seek passed.
The local browser suite also covers signed-URL refresh and truthfully unavailable
media. Safari app-level replay remains a Founder canary because the local Safari
session was logged out; no credential was entered or changed.
