# MR-CACHE-002 Live State Evidence

Generated UTC: 2026-05-09T02:58:55.297Z
Overall live-state result: PASS
Branch: mr/live-source-of-truth-reconcile-004
Commit: 27af5aa61fdce625ac9bcbe8bccd174e88cbefd8
Working tree status: M VALIDATION/live_state_report.mjs
?? LIVE/daily_drills_v3.html
?? LIVE/stat_v3.html
?? _AI_HANDOFFS/from_codex/MR-CACHE-008_POST_RECONCILIATION_VALIDATION.md
?? _AI_HANDOFFS/from_codex/MR-CACHE-008_live_captures/

## Route Classification

| Route | Local SHA | CDN normal | CDN cache-busted | WordPress/Railway | Classification | Reason |
|---|---|---:|---:|---:|---|---|
| /arena | 6994ede87299 | 200 6994ede87299 | 200 6994ede87299 | /arena 200 | LIVE CURRENT | Local source SHA matches normal and cache-busted CDN bodies, and WordPress wrapper markers are current. |
| /stat | e318ec6f0530 | 200 e318ec6f0530 | 200 e318ec6f0530 | /stat 200 | LIVE CURRENT | Local source SHA matches normal and cache-busted CDN bodies, and WordPress wrapper markers are current. |
| /stat-v3 | 2f7e17bdf363 | 200 2f7e17bdf363 | 200 2f7e17bdf363 | /stat-v3 200 | LIVE CURRENT | Local source SHA matches normal and cache-busted CDN bodies, and WordPress wrapper markers are current. |
| /daily | a298e7ef47b8 | 200 a298e7ef47b8 | 200 a298e7ef47b8 | /daily 200, /drills?entry=daily_rounds 200 | LIVE CURRENT | Local source SHA matches normal and cache-busted CDN bodies, and WordPress wrapper markers are current. |
| /drills | a4c781758dee | 200 a4c781758dee | 200 a4c781758dee | /drills 200 | LIVE CURRENT | Local source SHA matches normal and cache-busted CDN bodies, and WordPress wrapper markers are current. |
| /daily-drills-v3 | 2c0638eb7732 | 200 2c0638eb7732 | 200 2c0638eb7732 | /daily-drills-v3 200 | LIVE CURRENT | Local source SHA matches normal and cache-busted CDN bodies, and WordPress wrapper markers are current. |
| /hq | n/a | n/a | n/a | 200 8b16ee3d1b30 | UNKNOWN | Local route source is absent: missionmed-hq/public/index.html |
| /usce.html | a63a88afb23e | n/a | n/a | 200 a63a88afb23e | LIVE CURRENT | Route responded with expected status and local source evidence is present. |
| /usce-admin.html | f1ada3a18c6c | n/a | n/a | 200 f1ada3a18c6c | LIVE CURRENT | Route responded with expected status and local source evidence is present. |
| /usce-student.html | 849bdfc2547e | n/a | n/a | 200 849bdfc2547e | LIVE CURRENT | Route responded with expected status and local source evidence is present. |

## Canonical Runtime Details

### arena
- Local source: LIVE/arena.html
- Local SHA256: 6994ede872996d3e5753d7072404b72387513d19a84f19056a862540dbc379eb
- Local bytes: 890716
- Version marker: VERSION: MR-254_AVATAR_SYSTEM_FINAL -->
- CDN URL: https://cdn.missionmedinstitute.com/html-system/LIVE/arena.html
- CDN normal: status=200 sha=6994ede872996d3e5753d7072404b72387513d19a84f19056a862540dbc379eb bytes=890716 headers=(cache-control: no-cache, no-store, must-revalidate; last-modified: Fri, 08 May 2026 18:32:52 GMT; cf-cache-status: DYNAMIC; cf-ray: 9f8d71b83d01c152-EWR; content-type: text/html; charset=utf-8; server: cloudflare)
- CDN cache-busted: status=200 sha=6994ede872996d3e5753d7072404b72387513d19a84f19056a862540dbc379eb bytes=890716 headers=(cache-control: no-cache, no-store, must-revalidate; last-modified: Fri, 08 May 2026 18:32:52 GMT; cf-cache-status: DYNAMIC; cf-ray: 9f8d71b8fed4c152-EWR; content-type: text/html; charset=utf-8; server: cloudflare)
- Wrapper /arena: normal status=200 sha=edc761fcf02f3dc04ba065e4519c322a7527dc20efe395b6852791824c8358fb bytes=896124 headers=(cache-control: public, max-age=0, s-maxage=86400; last-modified: Sat, 09 May 2026 01:06:24 GMT; age: 6740; cf-cache-status: HIT; cf-ray: 9f8d71ba5ba8c698-EWR; content-type: text/html; charset=UTF-8; server: cloudflare; x-missionmed-route: arena-proxy; x-missionmed-upstream-status: 200; x-missionmed-upstream-transport: curl; x-missionmed-arena-auth-mode: wp-proxy; x-missionmed-arena-auth-config: injected; x-kinsta-cache: HIT)
- Wrapper /arena cache-busted: status=200 sha=b838e642e5f6275fc069e626240ef864d67a5b8bd89a3fe84c9e4f2e0d57a132 bytes=896244
- Classification: LIVE CURRENT
- Reason: Local source SHA matches normal and cache-busted CDN bodies, and WordPress wrapper markers are current.
- Note: Arena wrapper injects WordPress auth config, so wrapper SHA is expected to differ from CDN/local even when current.

### stat
- Local source: LIVE/stat.html
- Local SHA256: e318ec6f05309eb77597268d20b69d5e2c5bbe27f31cc0d884b176fb0f6ba048
- Local bytes: 440189
- Version marker: VERSION: 2026-05-03 22:12 STAT_DUEL_PACK_HYDRATION_GUARD
- CDN URL: https://cdn.missionmedinstitute.com/html-system/LIVE/stat.html
- CDN normal: status=200 sha=e318ec6f05309eb77597268d20b69d5e2c5bbe27f31cc0d884b176fb0f6ba048 bytes=440189 headers=(cache-control: no-cache, no-store, must-revalidate; last-modified: Mon, 04 May 2026 02:15:07 GMT; cf-cache-status: DYNAMIC; cf-ray: 9f8d71c18824c152-EWR; content-type: text/html; charset=utf-8; server: cloudflare)
- CDN cache-busted: status=200 sha=e318ec6f05309eb77597268d20b69d5e2c5bbe27f31cc0d884b176fb0f6ba048 bytes=440189 headers=(cache-control: no-cache, no-store, must-revalidate; last-modified: Mon, 04 May 2026 02:15:07 GMT; cf-cache-status: DYNAMIC; cf-ray: 9f8d71c2091fc152-EWR; content-type: text/html; charset=utf-8; server: cloudflare)
- Wrapper /stat: normal status=200 sha=e318ec6f05309eb77597268d20b69d5e2c5bbe27f31cc0d884b176fb0f6ba048 bytes=440189 headers=(cache-control: public, max-age=0, s-maxage=86400; last-modified: Sat, 09 May 2026 01:06:26 GMT; age: 6740; cf-cache-status: HIT; cf-ray: 9f8d71c2ab7cc698-EWR; content-type: text/html; charset=UTF-8; server: cloudflare; x-missionmed-route: stat-proxy; x-missionmed-stat-intercept: true; x-missionmed-stat-variant: legacy; x-missionmed-upstream-status: 200; x-missionmed-upstream-transport: curl; x-kinsta-cache: HIT)
- Wrapper /stat cache-busted: status=200 sha=e318ec6f05309eb77597268d20b69d5e2c5bbe27f31cc0d884b176fb0f6ba048 bytes=440189
- Classification: LIVE CURRENT
- Reason: Local source SHA matches normal and cache-busted CDN bodies, and WordPress wrapper markers are current.
- Note: STAT wrapper should proxy the CDN artifact without HTML mutation.

### stat-v3
- Local source: LIVE/stat_v3.html
- Local SHA256: 2f7e17bdf363967ddb52c105f07a91aea89276eab892bdfa742ac7292af7a79c
- Local bytes: 137029
- Version marker: not found
- CDN URL: https://cdn.missionmedinstitute.com/html-system/LIVE/stat_v3.html
- CDN normal: status=200 sha=2f7e17bdf363967ddb52c105f07a91aea89276eab892bdfa742ac7292af7a79c bytes=137029 headers=(cache-control: no-cache, no-store, must-revalidate; last-modified: Fri, 08 May 2026 17:22:08 GMT; cf-cache-status: DYNAMIC; cf-ray: 9f8d71c76c40c152-EWR; content-type: text/html; charset=utf-8; server: cloudflare)
- CDN cache-busted: status=200 sha=2f7e17bdf363967ddb52c105f07a91aea89276eab892bdfa742ac7292af7a79c bytes=137029 headers=(cache-control: no-cache, no-store, must-revalidate; last-modified: Fri, 08 May 2026 17:22:08 GMT; cf-cache-status: DYNAMIC; cf-ray: 9f8d71c7ed48c152-EWR; content-type: text/html; charset=utf-8; server: cloudflare)
- Wrapper /stat-v3: normal status=200 sha=2f7e17bdf363967ddb52c105f07a91aea89276eab892bdfa742ac7292af7a79c bytes=137029 headers=(cache-control: public, max-age=0, s-maxage=86400; last-modified: Sat, 09 May 2026 02:56:03 GMT; age: 163; cf-cache-status: HIT; cf-ray: 9f8d71c86e9ec698-EWR; content-type: text/html; charset=UTF-8; server: cloudflare; x-missionmed-route: stat-proxy; x-missionmed-stat-intercept: true; x-missionmed-stat-variant: v3; x-missionmed-upstream-status: 200; x-missionmed-upstream-transport: curl; x-kinsta-cache: HIT)
- Wrapper /stat-v3 cache-busted: status=200 sha=2f7e17bdf363967ddb52c105f07a91aea89276eab892bdfa742ac7292af7a79c bytes=137029
- Classification: LIVE CURRENT
- Reason: Local source SHA matches normal and cache-busted CDN bodies, and WordPress wrapper markers are current.
- Note: STAT V3 is a separate side-route artifact and should not replace legacy /stat.

### daily
- Local source: LIVE/daily.html
- Local SHA256: a298e7ef47b83bc03344a2dbf9c1c4004e1e7622e1fd9d0a8686fb4e148c476e
- Local bytes: 177739
- Version marker: VERSION: 2026-04-14 10:25
- CDN URL: https://cdn.missionmedinstitute.com/html-system/LIVE/daily.html
- CDN normal: status=200 sha=a298e7ef47b83bc03344a2dbf9c1c4004e1e7622e1fd9d0a8686fb4e148c476e bytes=177739 headers=(cache-control: no-cache, no-store, must-revalidate; last-modified: Tue, 05 May 2026 22:56:03 GMT; cf-cache-status: DYNAMIC; cf-ray: 9f8d71cdb904c152-EWR; content-type: text/html; charset=utf-8; server: cloudflare)
- CDN cache-busted: status=200 sha=a298e7ef47b83bc03344a2dbf9c1c4004e1e7622e1fd9d0a8686fb4e148c476e bytes=177739 headers=(cache-control: no-cache, no-store, must-revalidate; last-modified: Tue, 05 May 2026 22:56:03 GMT; cf-cache-status: DYNAMIC; cf-ray: 9f8d71ce29d9c152-EWR; content-type: text/html; charset=utf-8; server: cloudflare)
- Wrapper /daily: normal status=200 sha=a298e7ef47b83bc03344a2dbf9c1c4004e1e7622e1fd9d0a8686fb4e148c476e bytes=177739 headers=(cache-control: public, max-age=0, s-maxage=86400; last-modified: Sat, 09 May 2026 01:06:27 GMT; age: 6741; cf-cache-status: HIT; cf-ray: 9f8d71ce9a6ec698-EWR; content-type: text/html; charset=UTF-8; server: cloudflare; x-missionmed-route: drills-proxy; x-missionmed-upstream-status: 200; x-missionmed-upstream-transport: curl; x-missionmed-drills-intercept: true; x-missionmed-drills-mode: menu; x-missionmed-drills-signal: menu.daily_alias; x-missionmed-drills-v3: false; x-kinsta-cache: HIT)
- Wrapper /daily cache-busted: status=200 sha=a298e7ef47b83bc03344a2dbf9c1c4004e1e7622e1fd9d0a8686fb4e148c476e bytes=177739
- Wrapper /drills?entry=daily_rounds: normal status=200 sha=a298e7ef47b83bc03344a2dbf9c1c4004e1e7622e1fd9d0a8686fb4e148c476e bytes=177739 headers=(cache-control: no-cache, must-revalidate, max-age=0, no-store, private; cf-cache-status: DYNAMIC; cf-ray: 9f8d71d38c71c698-EWR; content-type: text/html; charset=UTF-8; server: cloudflare; x-missionmed-route: drills-proxy; x-missionmed-upstream-status: 200; x-missionmed-upstream-transport: curl; x-missionmed-drills-intercept: true; x-missionmed-drills-mode: menu; x-missionmed-drills-signal: query.entry; x-missionmed-drills-v3: false; x-kinsta-cache: BYPASS)
- Wrapper /drills?entry=daily_rounds cache-busted: status=200 sha=a298e7ef47b83bc03344a2dbf9c1c4004e1e7622e1fd9d0a8686fb4e148c476e bytes=177739
- Classification: LIVE CURRENT
- Reason: Local source SHA matches normal and cache-busted CDN bodies, and WordPress wrapper markers are current.
- Note: Daily can be reached directly at /daily or through the /drills?entry=daily_rounds menu alias.

### drills
- Local source: LIVE/drills.html
- Local SHA256: a4c781758deeb01da17c0b9e9e850cc52105229a0a619f0f1e4522859162bd01
- Local bytes: 448251
- Version marker: VERSION: 2026-04-22 15:00 MR-DRILLS-UI-STABILITY-PATCH
- CDN URL: https://cdn.missionmedinstitute.com/html-system/LIVE/drills.html
- CDN normal: status=200 sha=a4c781758deeb01da17c0b9e9e850cc52105229a0a619f0f1e4522859162bd01 bytes=448251 headers=(cache-control: no-cache, no-store, must-revalidate; last-modified: Tue, 05 May 2026 22:56:03 GMT; cf-cache-status: DYNAMIC; cf-ray: 9f8d71dc2f4bc152-EWR; content-type: text/html; charset=utf-8; server: cloudflare)
- CDN cache-busted: status=200 sha=a4c781758deeb01da17c0b9e9e850cc52105229a0a619f0f1e4522859162bd01 bytes=448251 headers=(cache-control: no-cache, no-store, must-revalidate; last-modified: Tue, 05 May 2026 22:56:03 GMT; cf-cache-status: DYNAMIC; cf-ray: 9f8d71dcb847c152-EWR; content-type: text/html; charset=utf-8; server: cloudflare)
- Wrapper /drills: normal status=200 sha=a4c781758deeb01da17c0b9e9e850cc52105229a0a619f0f1e4522859162bd01 bytes=448251 headers=(cache-control: public, max-age=0, s-maxage=86400; last-modified: Sat, 09 May 2026 01:06:29 GMT; age: 6741; cf-cache-status: HIT; cf-ray: 9f8d71dd4868c698-EWR; content-type: text/html; charset=UTF-8; server: cloudflare; x-missionmed-route: drills-proxy; x-missionmed-upstream-status: 200; x-missionmed-upstream-transport: curl; x-missionmed-drills-intercept: true; x-missionmed-drills-mode: engine; x-missionmed-drills-signal: engine.default; x-missionmed-drills-v3: false; x-kinsta-cache: HIT)
- Wrapper /drills cache-busted: status=200 sha=a4c781758deeb01da17c0b9e9e850cc52105229a0a619f0f1e4522859162bd01 bytes=448251
- Classification: LIVE CURRENT
- Reason: Local source SHA matches normal and cache-busted CDN bodies, and WordPress wrapper markers are current.
- Note: Direct /drills without a contract is allowed to show the contract guard.

### daily-drills-v3
- Local source: LIVE/daily_drills_v3.html
- Local SHA256: 2c0638eb773237449bb265409911a29f447f693c08ec55315da9a628ab96b5da
- Local bytes: 225909
- Version marker: not found
- CDN URL: https://cdn.missionmedinstitute.com/html-system/LIVE/daily_drills_v3.html
- CDN normal: status=200 sha=2c0638eb773237449bb265409911a29f447f693c08ec55315da9a628ab96b5da bytes=225909 headers=(cache-control: no-cache, no-store, must-revalidate; last-modified: Fri, 08 May 2026 16:17:55 GMT; cf-cache-status: DYNAMIC; cf-ray: 9f8d71e28cdcc152-EWR; content-type: text/html; charset=utf-8; server: cloudflare)
- CDN cache-busted: status=200 sha=2c0638eb773237449bb265409911a29f447f693c08ec55315da9a628ab96b5da bytes=225909 headers=(cache-control: no-cache, no-store, must-revalidate; last-modified: Fri, 08 May 2026 16:17:55 GMT; cf-cache-status: DYNAMIC; cf-ray: 9f8d71e30dc2c152-EWR; content-type: text/html; charset=utf-8; server: cloudflare)
- Wrapper /daily-drills-v3: normal status=200 sha=2c0638eb773237449bb265409911a29f447f693c08ec55315da9a628ab96b5da bytes=225909 headers=(cache-control: public, max-age=0, s-maxage=86400; last-modified: Sat, 09 May 2026 02:56:06 GMT; age: 166; cf-cache-status: HIT; cf-ray: 9f8d71e37dabc698-EWR; content-type: text/html; charset=UTF-8; server: cloudflare; x-missionmed-route: drills-proxy; x-missionmed-upstream-status: 200; x-missionmed-upstream-transport: curl; x-missionmed-drills-intercept: true; x-missionmed-drills-mode: v3; x-missionmed-drills-signal: v3.side_by_side; x-missionmed-drills-v3: true; x-kinsta-cache: HIT)
- Wrapper /daily-drills-v3 cache-busted: status=200 sha=2c0638eb773237449bb265409911a29f447f693c08ec55315da9a628ab96b5da bytes=225909
- Classification: LIVE CURRENT
- Reason: Local source SHA matches normal and cache-busted CDN bodies, and WordPress wrapper markers are current.
- Note: Daily/Drills V3 is a separate side-by-side artifact and should not replace legacy /daily or /drills.

## Optional Route Details

### hq
- Local source: missionmed-hq/public/index.html
- Local exists: no
- Local SHA256: missing
- Remote URL: https://missionmed-hq-production.up.railway.app/hq
- Remote status: 200
- Remote SHA256: 8b16ee3d1b3093f886957862e1f73faa5c5b0e8d830210360ea6a211fe1fab78
- Headers: cache-control: no-cache, must-revalidate, max-age=0, private; cf-cache-status: DYNAMIC; cf-ray: 9f8d71eec82e5e6e-EWR; content-type: text/html; charset=UTF-8; server: cloudflare; x-kinsta-cache: BYPASS
- Classification: UNKNOWN
- Reason: Local route source is absent: missionmed-hq/public/index.html
- Note: HQ is Railway-hosted and auth-gated. This worktree does not contain missionmed-hq/public/index.html.

### usce-request
- Local source: missionmed-hq/public/usce.html
- Local exists: yes
- Local SHA256: a63a88afb23ebcd4f4b90501dfcf84a9707c711e5f5c8aded454b3c0f3af75cb
- Remote URL: https://missionmed-hq-production.up.railway.app/usce.html
- Remote status: 200
- Remote SHA256: a63a88afb23ebcd4f4b90501dfcf84a9707c711e5f5c8aded454b3c0f3af75cb
- Headers: cache-control: no-store; content-type: text/html; charset=utf-8; server: railway-edge
- Classification: LIVE CURRENT
- Reason: Route responded with expected status and local source evidence is present.
- Note: USCE request/admin/tracker HTML is Railway static runtime, not R2/CDN LIVE manifest runtime.

### usce-admin
- Local source: missionmed-hq/public/usce-admin.html
- Local exists: yes
- Local SHA256: f1ada3a18c6cd18ca30ec85187cef121d5a1649ad29a2ba7f7149383a776a842
- Remote URL: https://missionmed-hq-production.up.railway.app/usce-admin.html
- Remote status: 200
- Remote SHA256: f1ada3a18c6cd18ca30ec85187cef121d5a1649ad29a2ba7f7149383a776a842
- Headers: cache-control: no-store; content-type: text/html; charset=utf-8; server: railway-edge
- Classification: LIVE CURRENT
- Reason: Route responded with expected status and local source evidence is present.
- Note: USCE admin shell is inspected for route truth only; no auth or data mutation is performed.

### usce-student
- Local source: missionmed-hq/public/usce-student.html
- Local exists: yes
- Local SHA256: 849bdfc2547e0ea080eaef8a3f9be55cb7f09a8748bd774722c0eded9f948cf8
- Remote URL: https://missionmed-hq-production.up.railway.app/usce-student.html
- Remote status: 200
- Remote SHA256: 849bdfc2547e0ea080eaef8a3f9be55cb7f09a8748bd774722c0eded9f948cf8
- Headers: cache-control: no-store; content-type: text/html; charset=utf-8; server: railway-edge
- Classification: LIVE CURRENT
- Reason: Route responded with expected status and local source evidence is present.
- Note: USCE student shell is inspected for route truth only; no portal token flow is exercised.

## Cache Layer Interpretation

- Local source current: determined by local file existence and SHA256.
- Git source current: determined by current branch, commit, and dirty status.
- Deployed public object: inferred from public CDN body SHA at the canonical LIVE URL.
- CDN stale: detected when cache-busted CDN content matches local but normal CDN content does not.
- Source/deploy mismatch: detected when neither normal nor cache-busted CDN content matches local.
- WordPress stale: detected when CDN is current but wrapper route misses expected markers or stale markers are present.
- Browser likely stale: detected when content is current but HTML cache headers are browser-cacheable.
- Signed R2 object state: not checked by this script because it does not read or print R2 credentials.

## Future Verification Command

```bash
bash VALIDATION/validate_live_state.sh --strict --output _AI_HANDOFFS/from_codex/MR-CACHE-002_LIVE_STATE_AFTER_DEPLOY.md
```
