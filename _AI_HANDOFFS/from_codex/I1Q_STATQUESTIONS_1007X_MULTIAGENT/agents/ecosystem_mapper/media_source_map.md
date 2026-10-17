# I1Q-1007X Media Source Map

## Authority Boundary

DR-006 authorizes read-only inventory and privacy-safe internal derivation from MissionMed-owned Dr. J sources. Authorized classes include current media, Drills and Daily Rounds registries, Stream, R2/CDN metadata, transcript, VTT, nodes, transcript JSON, nodes JSON, authorized transcript chunks, authorized static exports, and authorized MissionMed Drive corpus files.

Source mutation is prohibited. Raw sources remain restricted. Student speech, patient identifiers, and third-party identities are removed by default. Only privacy-safe working transcripts may enter extraction.

Assignment-time label: DR-006 REVIEWED CANDIDATE, CANONICAL MERGE PENDING. A clean unchanged merge into main was later observed; Root retains final authority acceptance.

## Source Zones

| Zone | Permitted content | Permitted operation | I1Q destination |
| --- | --- | --- | --- |
| Z0 restricted source | Registry metadata, playback references, raw transcript/VTT/nodes, transcript chunks, source objects | Read, hash, classify, redact in restricted process | Only source hash, rights, privacy state, availability, and lineage |
| Z1 privacy-safe working | Redacted text with student, patient, and third-party identity removed; speaker policy applied | Normalize, segment, concept extraction | i1q.normalized_transcript_segments and derived lineage |
| Z2 candidate quarantine | Source-linked candidate questions and evidence | Internal generation and review only | I1Q candidate and review records |
| Z3 release artifact | Approved immutable revisions | Server-safe channel projection | STAT/Drills adapters while flags remain owner-controlled |
| Z4 public/student | Physician-approved, rights/privacy-cleared release | Not authorized in this wave | Student release remains off |

## Current Registry Route

| Layer | Route/source | Owner | Access | Consumers |
| --- | --- | --- | --- | --- |
| WordPress first-party proxy | https://missionmedinstitute.com/api/drills | WordPress plus Drills/MMVS | GET only | Browser and authorized inventory |
| Proxy implementation | /Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/wp-content/mu-plugins/mmvs-drills-proxy.php | WordPress/Drills | Proxies only exact /api/drills | Daily, external first-party path |
| Upstream registry | https://mmvs-backend-production.up.railway.app/api/drills | MMVS/Drills ingestion owner | GET | Arena, Daily, Drills |
| Daily source | LIVE/daily.html | Daily/Drills | Direct GET with credentials omitted | Daily Rounds |
| Drills source | LIVE/drills.html | Drills | GET with credentials included | Drills runtime |

The named human owner for MMVS ingestion was not found in the inspected authority set. System ownership is clear: Drills/MMVS ingestion remains unchanged. Root must obtain the current human owner before adapter certification.

## Real Corpus Evidence

Sanitized evidence:

    /Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/I1Q_1007X_CORPUS_INVENTORY.md

    /Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/evidence/corpus_inventory_summary.json

    /Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT/agents/privacy_rights/privacy_release_verdict.md

| Measure | Observation |
| --- | ---: |
| Registry rows | 97 |
| DRJ_DRILLS rows | 97 |
| Rows with playback | 97 |
| Rows with nodes | 97 |
| Rows with transcript | 97 |
| Rows with all three | 97 |
| Empty video IDs | 0 |
| Duplicate video ID groups | 0 |
| Transcript requests / HTTP 200 | 97 / 97 |
| Nodes requests / HTTP 200 | 97 / 97 |
| Transcript records | 81,604 |
| Nodes records | 81,604 |
| Multi-speaker sources | 97 |
| Explicit Dr. J label | 96 |
| Generic-only Dr. J evidence | 1 |
| Source-level verified_drj classification | 97 |
| Potential restricted exact-match segment allowlist after all privacy gates | 96 |
| Generic source requiring zero segment retention | 1 |
| Sources with potential identity labels | 97 |
| Privacy-safe working transcripts | 0 |
| Extraction-ready sources | 0 |

All observed transcript and nodes artifacts were application/json. Transcript records expose segment_id, speaker, start_time, end_time, and text. Nodes add node_id. No source text, title, filename, URL, or personal name was retained in the sanitized inventory.

The Privacy Owner classified all 97 sources as source-level verified_drj because the authoritative registry category satisfies DR-006. That does not classify individual speakers. Ninety-six sources are only potential restricted exact-match allowlist candidates after all privacy controls pass; the generic source must retain zero segments until authoritative speaker mapping exists.

Current state: REAL_CORPUS_INVENTORIED; PRIVACY VERDICT BLOCKS ALL 97 FROM EXTRACTION, CANDIDATE GENERATION, AND DOWNSTREAM CONTENT USE.

## Consumer Field Contracts

### Daily Rounds

Daily rejects rows missing any of:

| Required field |
| --- |
| video_id |
| title |
| playback_url |
| nodes_url |
| transcript_url |

Daily also derives or accepts stream_id, reads public.drill_registry_control for active state, and launches /drills?video_id=<id>. The current direct Supabase client is pinned to RANKLISTIQ.

Sources:

    /Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/LIVE/daily.html
    /Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/wp-content/mu-plugins/drills-route-proxy.php

### Drills

Drills requires:

- playback_url or stream_id
- nodes_url

Drills treats a missing transcript_url as explicit and non-blocking. An invalid supplied transcript URL produces a warning. Supported nodes shapes include a flat array, drill_nodes, drillNodes, and nodes. Raw nodes segments are normalized and merged into turns for pause behavior.

Supported transcript collections include arrays and wrappers named nodes, segments, transcript_chunks, chunks, transcript, and nested data variants.

Sources:

    /Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/LIVE/drills.html
    /Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/wp-content/mu-plugins/drills-route-proxy.php

### Exact 5ae58b0 I1Q Drills Artifact

The exact source-target baseline artifact contains only:

- item_revision_id
- prompt
- concept_id
- source_ids
- review_status

It does not expose video_id, playback, transcript, VTT, or nodes availability and is not compatible with either protected consumer.

Source:

    /Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/i1q-question-platform/src/exports.mjs

Post-baseline observation: commit 4724a24 added src/adapters/drills-v1.mjs plus contract/export changes. It represents playback, nodes, transcript, and VTT independently, requires playback and nodes, carries source and working hashes, and directly validates the five-field Daily row. The tracked test set passed 34 of 34 at that snapshot. This is repair evidence only: no protected runtime integration, real-corpus projection, Drills/Daily owner certification, fixed integrated security/privacy candidate, or flag decision was observed. Both consumer flags must remain off.

## VTT Map

| Evidence | Result |
| --- | --- |
| DR-006 | VTT is an authorized read-only source class |
| Legacy root drill registry schema | public.drill_registry contains vtt_path and nodes_path |
| Seed evidence | One historical seeded row references a transcript VTT and nodes JSON |
| Current 97-row MMVS inventory | Registry exposes transcript_url and nodes_url; fetched artifacts were JSON |
| Local I1Q inventory evidence | local_vtt_files = 0 |
| Drive search | Zero VTT filename matches |

Conclusion: VTT support is authorized and must be represented explicitly by an adapter, but no separate VTT artifact was observed in the current real 97-row inventory. transcript_available does not prove vtt_available. The adapter must represent each availability independently and must not infer VTT from transcript JSON.

## Nodes And Transcript Source Paths

| Artifact | Current source | Shape | Required privacy treatment |
| --- | --- | --- | --- |
| Transcript JSON | transcript_url in MMVS row | Array of timestamped speaker text records | Restricted fetch, speaker classification, redaction |
| Nodes JSON | nodes_url in MMVS row | Timestamped speaker text records with node_id | Same; do not treat nodes as already privacy-safe |
| VTT | Legacy vtt_path or a future explicit URL | Not observed in current inventory | Same; parse cues through structured parser |
| Supabase transcript chunks | Growth Engine media_transcript_chunks through HQ/CIE | chunk_text, start_time, end_time | Owner-approved authenticated read only |
| Playback | playback_url or Stream stream_id | Cloudflare Stream iframe, HLS, or direct hosted reference | Metadata only for extraction unless clip rights exist |

## HQ Media And CIE Path

HQ exposes authenticated routes after the shared session gate:

| Route | Operation | I1Q treatment |
| --- | --- | --- |
| /api/media/health | CIE health | Read-only diagnostic |
| /api/media/search | Search | Optional read-only owner adapter |
| /api/media/unified | List | Optional read-only owner adapter |
| /api/media/unified/<id> | Detail plus transcript backfill | Optional restricted read |
| /api/media/list | List alias | Optional restricted read |

Mutation routes for favorite, rating, tags, playlists, clips, and upload are outside I1Q corpus authority and must not be called.

HQ configuration names read for routing only:

- MMHQ_CIE_BASE
- MMHQ_MEDIA_UPLOAD_BASE
- MMHQ_MEDIA_SEMANTIC_RPC
- MMHQ_STUDIO_BASE

No values, secrets, tokens, or keys were read or recorded.

Source:

    /Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/missionmed-hq/server.mjs
    /Users/brianb/MissionMed_worktrees/I1Q-STATQuestions-1000/supabase/migrations/20260402021500_vrs9d_media_system_schema.sql

## Stream And R2/CDN

| System | Current role | I1Q permission | Safest adapter |
| --- | --- | --- | --- |
| Cloudflare Stream | Video playback via stream_id/playback_url | Metadata and read-only playback reference | Preserve owner URL; never change object or settings |
| Cloudflare R2 | Static objects and protected runtime HTML | Read objects and metadata for corpus; deployment only through Root route | GET/head/hash for corpus |
| CDN | Serves LIVE arena, stat, drills, daily and source artifacts | Read and verify | No cache purge or replacement during corpus processing |
| WordPress | Routes/wraps protected CDN HTML | Read route behavior | No HTML/media upload target |

Runtime HTML is delivered from:

| WordPress route | CDN target |
| --- | --- |
| /arena | /html-system/LIVE/arena.html |
| /stat | /html-system/LIVE/stat.html |
| /drills | /html-system/LIVE/drills.html |
| /daily or /drills?entry=daily_rounds | /html-system/LIVE/daily.html |

I1Q has no CDN key, runtime route, deployment URL, or authorized ad hoc upload.

## Drive

The current connected Drive inventory reported no filename matches for VTT, transcript, drill, Dr. J, or Daily Rounds and no additional corpus source. This does not prove absence because indexing, access scope, naming, and shared-drive boundaries may differ.

Safest future Drive adapter:

1. Root and source owner approve exact file IDs.
2. Record Drive file ID, owner, rights status, MIME, length, modified time, and SHA-256.
3. Fetch read-only into the restricted privacy process.
4. Persist no raw text or path in general repository evidence.
5. Promote only privacy-safe normalized segments.

## Ownership And Safest Adapters

| Boundary | Proposed owner | Adapter file ownership |
| --- | --- | --- |
| MMVS/Drills read adapter | Adapter and Identity Implementer after Drills owner contract | New i1q-question-platform/src/adapters files only |
| Availability projection | Adapter and Identity Implementer | contracts.mjs, exports.mjs, adapter tests |
| Privacy normalization | Privacy Normalization Implementer | privacy.mjs, pipeline.mjs, privacy tests |
| Restricted source policy | Privacy and Rights owner plus Root | Reports/policy only; no runtime source mutation |
| Media owner endpoint | Root plus HQ/Media owner | Shared HQ paths remain root-only |
| Registry ingestion | Existing Drills/MMVS owner | No I1Q writes |
| Stream/R2/CDN | Existing media/deployment owner | Root-only |
| Drive allowlist | Root plus file owner | Root authority/evidence only |

## Baseline Tests

| Test family | Required result |
| --- | --- |
| Registry | Stable video IDs, no duplicates, fields explicit, GET only |
| Artifacts | Allowed hosts, HTTP success, MIME, length, SHA-256, shape, timestamps |
| Availability | playback, transcript, VTT, nodes represented independently |
| Speaker | 0.95 or better attribution accuracy under DR-006 threshold |
| Privacy | patient recall at least 0.995; student-name recall at least 0.99 |
| Rights | Internal derivation allowed; public excerpt/clip disabled unless explicit current record |
| Provenance | Source hash and exact timestamp range on every derived claim |
| Consumer | Drills and Daily contract tests against read-only sidecar |
| Mutation | No POST, PUT, PATCH, DELETE, SQL write, upload, cache purge, or registry change |

## Blockers

- All 97 real sources contain multiple speakers and potential identity labels.
- All sources are source-level verified_drj, but the generic source lacks authoritative segment-level Dr. J mapping and must remain zero-retention.
- No privacy-safe working transcript has been created.
- Student speech, patient identifiers, and third-party identities have not been removed from the real corpus.
- No real source is extraction-ready.
- VTT is not observed for the real inventory and must not be inferred.
- MMVS human ownership and the Supabase project ownership of drill tables need Root confirmation.
- The 5ae58b0 Drills projection is incompatible; the 4724a24 adapter repair remains unintegrated and uncertified by Drills/Daily owners.
- Public quotation, excerpt, clip, and student publication rights remain closed.
