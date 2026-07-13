# A1 MMC File Authority Matrix

RESULT: FINAL_AUTHORITY_RESOLUTION_COMPLETE

| File / group | Source state and SHA-256 | Destination state / decision | Authority |
| --- | --- | --- | --- |
| private index.html | Air tracked-dirty 4ddee056… | exact hash integrated in bfb3968 | canonical branch UI candidate |
| private app.js | Air tracked-dirty b4815642… | exact hash integrated in bfb3968 | canonical branch UI candidate |
| private ownership layer | Air tracked-dirty 08c603a5… | exact hash integrated in bfb3968 | canonical branch ownership/UI candidate |
| private styles.css | Air tracked-dirty 4908d4ba… | exact hash integrated in bfb3968 | canonical branch UI candidate |
| private mount validator | Air tracked-dirty eb47fa77… | exact hash integrated in bfb3968 | canonical deterministic contract |
| private data adapter | ca52086b… on main, Air tracked base, and core fixture | unchanged exact copy from clean chain | IDENTICAL |
| server.mjs | Air reconstructed whole-file 4da68b04…; Pro protected baseline differs | five reviewed MMC hunks only; final SHA-256 0f48759f… in bbdcd96 | PROTECTED, semantic combined authority |
| coaching pipeline route | Air untracked c6b48e82… | byte-identical in 5c74060 | canonical staging implementation candidate |
| coaching import worker | Air untracked 5dcb440e… | byte-identical in 5c74060 | canonical worker candidate |
| student resolution engine | Air untracked 6f98b6c6… | byte-identical in 5c74060 | canonical identity-safe candidate |
| roster verification lane | Air untracked dbdecaa4… | byte-identical in 5c74060 | canonical review-lane candidate |
| Webex triggered pull | Air untracked 69c70ba0… | byte-identical in 5c74060 | guarded discovery/pull candidate |
| analysis prompt | Air untracked e76ebc32… | byte-identical in 5c74060 | evidence-bound prompt candidate |
| 14 exported tests | Air untracked; manifest hashes verified | byte-identical in 5c74060 | deterministic/staging evidence; only zero-external subset executed |
| mmc-v1-core | six Air-only files; index 45bb5768…, validator 47315d68… | preserved in 5c74060 as MMC-005A fixture/test oracle, not runtime | HISTORICAL_PRODUCT_AUTHORITY |
| two migrations + two snippets | 8dbb5991…, 00219bc3…, f60d3f4c…, 660e6b11… | preserved in 5c74060; never applied | PROTECTED STAGING EVIDENCE |
| three excluded tests | hashes recorded in Air matrix; bytes intentionally absent | not recreated or committed | SECRET_BEARING, DO NOT TOUCH |
| partner demo / bulk reports / logs / generated cache | verified inside quarantine archive | not committed | SAFE_TO_ARCHIVE_ONLY |
| CAM v2.0 authority | 407F HTML SHA-256 23b338d9… | read-only Fable reference | VERIFIED DESIGN AUTHORITY |

The integrated HQ-mounted implementation is validated as a staging engineering baseline, not as production deployment authorization. The earlier standalone-runtime architecture document remains preserved as a design constraint and unresolved production-architecture question.
