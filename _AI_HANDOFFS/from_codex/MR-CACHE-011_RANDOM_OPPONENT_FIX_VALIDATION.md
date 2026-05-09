# MR-CACHE-002 Live State Evidence

Generated UTC: 2026-05-09T17:51:27.225Z
Overall live-state result: ATTENTION REQUIRED
Branch: mr/live-source-of-truth-reconcile-004
Commit: 11361903c3dc7b4d4e5d4ea990010f7099de49ff
Working tree status: M LIVE/stat_v3.html
?? _AI_HANDOFFS/from_codex/MR-CACHE-011_RANDOM_OPPONENT_FIX_VALIDATION.md

## Route Classification

| Route | Local SHA | CDN normal | CDN cache-busted | WordPress/Railway | Classification | Reason |
|---|---|---:|---:|---:|---|---|
| /arena | 1d82e0026d8b | 200 6994ede87299 | 200 6994ede87299 | /arena 200 | SOURCE/DEPLOY MISMATCH | Normal and cache-busted CDN bodies match each other but not local. Local SHA 1d82e0026d8b890080c3ec8cde523e7fb81f5890d55caecb9f0770bc843e37d0 is not the public CDN SHA. |
| /stat | e318ec6f0530 | 200 e318ec6f0530 | 200 e318ec6f0530 | /stat 200 | LIVE CURRENT | Local source SHA matches normal and cache-busted CDN bodies, and WordPress wrapper markers are current. |
| /stat-v3 | 9886eb27dfee | 200 2f7e17bdf363 | 200 2f7e17bdf363 | /stat-v3 200 | SOURCE/DEPLOY MISMATCH | Normal and cache-busted CDN bodies match each other but not local. Local SHA 9886eb27dfee0fc3968dcb384707a0034c4d8f52a0dfff6c5190388e077a223f is not the public CDN SHA. |
| /daily | a298e7ef47b8 | 200 a298e7ef47b8 | 200 a298e7ef47b8 | /daily 200, /drills?entry=daily_rounds 200 | LIVE CURRENT | Local source SHA matches normal and cache-busted CDN bodies, and WordPress wrapper markers are current. |
| /drills | a4c781758dee | 200 a4c781758dee | 200 a4c781758dee | /drills 200 | LIVE CURRENT | Local source SHA matches normal and cache-busted CDN bodies, and WordPress wrapper markers are current. |
| /daily-drills-v3 | 2c0638eb7732 | 200 2c0638eb7732 | 200 2c0638eb7732 | /daily-drills-v3 200 | LIVE CURRENT | Local source SHA matches normal and cache-busted CDN bodies, and WordPress wrapper markers are current. |
| /hq | n/a | n/a | n/a | 200 94c8fb14417b | UNKNOWN | Local route source is absent: missionmed-hq/public/index.html |
| /usce.html | a63a88afb23e | n/a | n/a | 200 a63a88afb23e | LIVE CURRENT | Route responded with expected status and local source evidence is present. |
| /usce-admin.html | f1ada3a18c6c | n/a | n/a | 200 f1ada3a18c6c | LIVE CURRENT | Route responded with expected status and local source evidence is present. |
| /usce-student.html | 849bdfc2547e | n/a | n/a | 200 849bdfc2547e | LIVE CURRENT | Route responded with expected status and local source evidence is present. |

## Canonical Runtime Details

### arena
- Local source: LIVE/arena.html
- Local SHA256: 1d82e0026d8b890080c3ec8cde523e7fb81f5890d55caecb9f0770bc843e37d0
- Local bytes: 890769
- Version marker: VERSION: MR-254_AVATAR_SYSTEM_FINAL -->
- CDN URL: https://cdn.missionmedinstitute.com/html-system/LIVE/arena.html
- CDN normal: status=200 sha=6994ede872996d3e5753d7072404b72387513d19a84f19056a862540dbc379eb bytes=890716 headers=(cache-control: no-cache, no-store, must-revalidate; last-modified: Fri, 08 May 2026 18:32:52 GMT; cf-cache-status: DYNAMIC; cf-ray: 9f928d2059bfd92a-EWR; content-type: text/html; charset=utf-8; server: cloudflare)
- CDN cache-busted: status=200 sha=6994ede872996d3e5753d7072404b72387513d19a84f19056a862540dbc379eb bytes=890716 headers=(cache-control: no-cache, no-store, must-revalidate; last-modified: Fri, 08 May 2026 18:32:52 GMT; cf-cache-status: DYNAMIC; cf-ray: 9f928d214c0dd92a-EWR; content-type: text/html; charset=utf-8; server: cloudflare)
- Wrapper /arena: normal status=200 sha=edc761fcf02f3dc04ba065e4519c322a7527dc20efe395b6852791824c8358fb bytes=896124 headers=(cache-control: public, max-age=0, s-maxage=86400; last-modified: Sat, 09 May 2026 01:06:24 GMT; age: 60292; cf-cache-status: HIT; cf-ray: 9f928d22ed76c46d-EWR; content-type: text/html; charset=UTF-8; server: cloudflare; x-missionmed-route: arena-proxy; x-missionmed-upstream-status: 200; x-missionmed-upstream-transport: curl; x-missionmed-arena-auth-mode: wp-proxy; x-missionmed-arena-auth-config: injected; x-kinsta-cache: HIT)
- Wrapper /arena cache-busted: status=200 sha=71d7c2fc676ea03d3b014a780f51443c63a68a77f12b2a8793d95302516e1d5e bytes=896241
- Classification: SOURCE/DEPLOY MISMATCH
- Reason: Normal and cache-busted CDN bodies match each other but not local. Local SHA 1d82e0026d8b890080c3ec8cde523e7fb81f5890d55caecb9f0770bc843e37d0 is not the public CDN SHA.
- Note: Arena wrapper injects WordPress auth config, so wrapper SHA is expected to differ from CDN/local even when current.

### stat
- Local source: LIVE/stat.html
- Local SHA256: e318ec6f05309eb77597268d20b69d5e2c5bbe27f31cc0d884b176fb0f6ba048
- Local bytes: 440189
- Version marker: VERSION: 2026-05-03 22:12 STAT_DUEL_PACK_HYDRATION_GUARD
- CDN URL: https://cdn.missionmedinstitute.com/html-system/LIVE/stat.html
- CDN normal: status=200 sha=e318ec6f05309eb77597268d20b69d5e2c5bbe27f31cc0d884b176fb0f6ba048 bytes=440189 headers=(cache-control: no-cache, no-store, must-revalidate; last-modified: Mon, 04 May 2026 02:15:07 GMT; cf-cache-status: DYNAMIC; cf-ray: 9f928d286e61d92a-EWR; content-type: text/html; charset=utf-8; server: cloudflare)
- CDN cache-busted: status=200 sha=e318ec6f05309eb77597268d20b69d5e2c5bbe27f31cc0d884b176fb0f6ba048 bytes=440189 headers=(cache-control: no-cache, no-store, must-revalidate; last-modified: Mon, 04 May 2026 02:15:07 GMT; cf-cache-status: DYNAMIC; cf-ray: 9f928d2978ced92a-EWR; content-type: text/html; charset=utf-8; server: cloudflare)
- Wrapper /stat: normal status=200 sha=e318ec6f05309eb77597268d20b69d5e2c5bbe27f31cc0d884b176fb0f6ba048 bytes=440189 headers=(cache-control: public, max-age=0, s-maxage=86400; last-modified: Sat, 09 May 2026 01:06:26 GMT; age: 60292; cf-cache-status: HIT; cf-ray: 9f928d2a0aa2c46d-EWR; content-type: text/html; charset=UTF-8; server: cloudflare; x-missionmed-route: stat-proxy; x-missionmed-stat-intercept: true; x-missionmed-stat-variant: legacy; x-missionmed-upstream-status: 200; x-missionmed-upstream-transport: curl; x-kinsta-cache: HIT)
- Wrapper /stat cache-busted: status=200 sha=e318ec6f05309eb77597268d20b69d5e2c5bbe27f31cc0d884b176fb0f6ba048 bytes=440189
- Classification: LIVE CURRENT
- Reason: Local source SHA matches normal and cache-busted CDN bodies, and WordPress wrapper markers are current.
- Note: STAT wrapper should proxy the CDN artifact without HTML mutation.

### stat-v3
- Local source: LIVE/stat_v3.html
- Local SHA256: 9886eb27dfee0fc3968dcb384707a0034c4d8f52a0dfff6c5190388e077a223f
- Local bytes: 163296
- Version marker: not found
- CDN URL: https://cdn.missionmedinstitute.com/html-system/LIVE/stat_v3.html
- CDN normal: status=200 sha=2f7e17bdf363967ddb52c105f07a91aea89276eab892bdfa742ac7292af7a79c bytes=137029 headers=(cache-control: no-cache, no-store, must-revalidate; last-modified: Fri, 08 May 2026 17:22:08 GMT; cf-cache-status: DYNAMIC; cf-ray: 9f928d2f3dfdd92a-EWR; content-type: text/html; charset=utf-8; server: cloudflare)
- CDN cache-busted: status=200 sha=2f7e17bdf363967ddb52c105f07a91aea89276eab892bdfa742ac7292af7a79c bytes=137029 headers=(cache-control: no-cache, no-store, must-revalidate; last-modified: Fri, 08 May 2026 17:22:08 GMT; cf-cache-status: DYNAMIC; cf-ray: 9f928d300f8ed92a-EWR; content-type: text/html; charset=utf-8; server: cloudflare)
- Wrapper /stat-v3: normal status=200 sha=2f7e17bdf363967ddb52c105f07a91aea89276eab892bdfa742ac7292af7a79c bytes=137029 headers=(cache-control: public, max-age=0, s-maxage=86400; last-modified: Sat, 09 May 2026 02:56:03 GMT; age: 53715; cf-cache-status: HIT; cf-ray: 9f928d306f7bc46d-EWR; content-type: text/html; charset=UTF-8; server: cloudflare; x-missionmed-route: stat-proxy; x-missionmed-stat-intercept: true; x-missionmed-stat-variant: v3; x-missionmed-upstream-status: 200; x-missionmed-upstream-transport: curl; x-kinsta-cache: HIT)
- Wrapper /stat-v3 cache-busted: status=200 sha=2f7e17bdf363967ddb52c105f07a91aea89276eab892bdfa742ac7292af7a79c bytes=137029
- Classification: SOURCE/DEPLOY MISMATCH
- Reason: Normal and cache-busted CDN bodies match each other but not local. Local SHA 9886eb27dfee0fc3968dcb384707a0034c4d8f52a0dfff6c5190388e077a223f is not the public CDN SHA.
- Note: STAT V3 is a separate side-route artifact and should not replace legacy /stat.

### daily
- Local source: LIVE/daily.html
- Local SHA256: a298e7ef47b83bc03344a2dbf9c1c4004e1e7622e1fd9d0a8686fb4e148c476e
- Local bytes: 177739
- Version marker: VERSION: 2026-04-14 10:25
- CDN URL: https://cdn.missionmedinstitute.com/html-system/LIVE/daily.html
- CDN normal: status=200 sha=a298e7ef47b83bc03344a2dbf9c1c4004e1e7622e1fd9d0a8686fb4e148c476e bytes=177739 headers=(cache-control: no-cache, no-store, must-revalidate; last-modified: Tue, 05 May 2026 22:56:03 GMT; cf-cache-status: DYNAMIC; cf-ray: 9f928d351b14d92a-EWR; content-type: text/html; charset=utf-8; server: cloudflare)
- CDN cache-busted: status=200 sha=a298e7ef47b83bc03344a2dbf9c1c4004e1e7622e1fd9d0a8686fb4e148c476e bytes=177739 headers=(cache-control: no-cache, no-store, must-revalidate; last-modified: Tue, 05 May 2026 22:56:03 GMT; cf-cache-status: DYNAMIC; cf-ray: 9f928d358c2ed92a-EWR; content-type: text/html; charset=utf-8; server: cloudflare)
- Wrapper /daily: normal status=200 sha=a298e7ef47b83bc03344a2dbf9c1c4004e1e7622e1fd9d0a8686fb4e148c476e bytes=177739 headers=(cache-control: public, max-age=0, s-maxage=86400; last-modified: Sat, 09 May 2026 01:06:27 GMT; age: 60293; cf-cache-status: HIT; cf-ray: 9f928d368c08c46d-EWR; content-type: text/html; charset=UTF-8; server: cloudflare; x-missionmed-route: drills-proxy; x-missionmed-upstream-status: 200; x-missionmed-upstream-transport: curl; x-missionmed-drills-intercept: true; x-missionmed-drills-mode: menu; x-missionmed-drills-signal: menu.daily_alias; x-missionmed-drills-v3: false; x-kinsta-cache: HIT)
- Wrapper /daily cache-busted: status=200 sha=a298e7ef47b83bc03344a2dbf9c1c4004e1e7622e1fd9d0a8686fb4e148c476e bytes=177739
- Wrapper /drills?entry=daily_rounds: normal status=200 sha=a298e7ef47b83bc03344a2dbf9c1c4004e1e7622e1fd9d0a8686fb4e148c476e bytes=177739 headers=(cache-control: no-cache, must-revalidate, max-age=0, no-store, private; cf-cache-status: DYNAMIC; cf-ray: 9f928d3b8f70c46d-EWR; content-type: text/html; charset=UTF-8; server: cloudflare; x-missionmed-route: drills-proxy; x-missionmed-upstream-status: 200; x-missionmed-upstream-transport: curl; x-missionmed-drills-intercept: true; x-missionmed-drills-mode: menu; x-missionmed-drills-signal: query.entry; x-missionmed-drills-v3: false; x-kinsta-cache: BYPASS)
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
- CDN normal: status=200 sha=a4c781758deeb01da17c0b9e9e850cc52105229a0a619f0f1e4522859162bd01 bytes=448251 headers=(cache-control: no-cache, no-store, must-revalidate; last-modified: Tue, 05 May 2026 22:56:03 GMT; cf-cache-status: DYNAMIC; cf-ray: 9f928d45387bd92a-EWR; content-type: text/html; charset=utf-8; server: cloudflare)
- CDN cache-busted: status=200 sha=a4c781758deeb01da17c0b9e9e850cc52105229a0a619f0f1e4522859162bd01 bytes=448251 headers=(cache-control: no-cache, no-store, must-revalidate; last-modified: Tue, 05 May 2026 22:56:03 GMT; cf-cache-status: DYNAMIC; cf-ray: 9f928d45b9aad92a-EWR; content-type: text/html; charset=utf-8; server: cloudflare)
- Wrapper /drills: normal status=200 sha=a4c781758deeb01da17c0b9e9e850cc52105229a0a619f0f1e4522859162bd01 bytes=448251 headers=(cache-control: public, max-age=0, s-maxage=86400; last-modified: Sat, 09 May 2026 01:06:29 GMT; age: 60292; cf-cache-status: HIT; cf-ray: 9f928d464809c46d-EWR; content-type: text/html; charset=UTF-8; server: cloudflare; x-missionmed-route: drills-proxy; x-missionmed-upstream-status: 200; x-missionmed-upstream-transport: curl; x-missionmed-drills-intercept: true; x-missionmed-drills-mode: engine; x-missionmed-drills-signal: engine.default; x-missionmed-drills-v3: false; x-kinsta-cache: HIT)
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
- CDN normal: status=200 sha=2c0638eb773237449bb265409911a29f447f693c08ec55315da9a628ab96b5da bytes=225909 headers=(cache-control: no-cache, no-store, must-revalidate; last-modified: Fri, 08 May 2026 16:17:55 GMT; cf-cache-status: DYNAMIC; cf-ray: 9f928d4b9fc9d92a-EWR; content-type: text/html; charset=utf-8; server: cloudflare)
- CDN cache-busted: status=200 sha=2c0638eb773237449bb265409911a29f447f693c08ec55315da9a628ab96b5da bytes=225909 headers=(cache-control: no-cache, no-store, must-revalidate; last-modified: Fri, 08 May 2026 16:17:55 GMT; cf-cache-status: DYNAMIC; cf-ray: 9f928d4c290dd92a-EWR; content-type: text/html; charset=utf-8; server: cloudflare)
- Wrapper /daily-drills-v3: normal status=200 sha=2c0638eb773237449bb265409911a29f447f693c08ec55315da9a628ab96b5da bytes=225909 headers=(cache-control: public, max-age=0, s-maxage=86400; last-modified: Sat, 09 May 2026 02:56:06 GMT; age: 53717; cf-cache-status: HIT; cf-ray: 9f928d4c9cccc46d-EWR; content-type: text/html; charset=UTF-8; server: cloudflare; x-missionmed-route: drills-proxy; x-missionmed-upstream-status: 200; x-missionmed-upstream-transport: curl; x-missionmed-drills-intercept: true; x-missionmed-drills-mode: v3; x-missionmed-drills-signal: v3.side_by_side; x-missionmed-drills-v3: true; x-kinsta-cache: HIT)
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
- Remote SHA256: 94c8fb14417b7c55530f91c190e96ab5fb8b85f913130311d26d7ddb07452973
- Headers: cache-control: no-cache, must-revalidate, max-age=0, private; cf-cache-status: DYNAMIC; cf-ray: 9f928d5add8343ab-EWR; content-type: text/html; charset=UTF-8; server: cloudflare; x-kinsta-cache: BYPASS
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

