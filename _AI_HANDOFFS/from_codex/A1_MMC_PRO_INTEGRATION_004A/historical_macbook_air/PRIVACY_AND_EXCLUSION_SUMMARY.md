# Privacy and Exclusion Summary

RESULT: COMMIT_SAFE_METADATA_ONLY

## Public-repository decision

The destination remote is public. The raw historical report corpus therefore remains local-only. Committing raw reports would publish personal or operational metadata that is not needed to prove migration completeness.

The committed evidence is limited to SHA-256 values and archive-relative filenames. No report body, absolute machine path, direct email value, UUID value, operational URL value, credential value, transcript, media, or private coaching detail is included.

## Selected corpus

| Category | Count | Treatment |
| --- | ---: | --- |
| MMC product-history documents | 178 | Hash and archive-relative path only |
| Export-provenance documents | 10 | Hash and archive-relative path only |
| Total manifest entries | 188 | Commit-safe metadata only |
| Duplicate hashes in selected set | 0 | Every selected entry is byte-unique |

The product-history group comprises 174 Codex MMC reports, one master architecture document, two Cowork architecture/UX documents, and one Claude prototype report.

## Redacted scan findings

No values are reproduced here.

| Signal category | Result |
| --- | ---: |
| High-confidence API token, JWT, private-key, or provider-key patterns in archive Markdown | 0 files |
| Environment credential assignments in archive Markdown | 0 files |
| Database/Redis credential-bearing connection strings in archive Markdown | 0 files |
| Basic-auth or bearer credential values in archive Markdown | 0 files |
| Product-history documents with direct-email patterns | 8 files / 3 distinct values |
| Product-history documents with UUID patterns | 23 files / 22 distinct values |
| Product-history documents with operational-domain references | 16 files |
| Product-history documents with an identified-subject reference | 21 files |
| Product-history documents in the union of those metadata categories | 46 files |

The metadata signals are not classified as credentials, but they are inappropriate for wholesale publication. The archive exporter also recorded three source tests excluded for API-key assignments; those tests remain excluded and are not represented as import candidates.

## Explicit exclusions

- Raw content of all 188 manifest-listed documents
- Five unrelated ACTN gate reports
- The stale global AI knowledge index
- System activity and learning logs or helper scripts
- Unrelated Arena, Scheduler, Calendar, WordPress, and deployment artifacts
- Secret-excluded source tests
- Generated cache, transient state, credentials, transcripts, media, and local-only machine data
- Redundant package copies and the earlier superseded combined export handoff

## Safe preservation conclusion

The MacBook Pro retains the verified raw evidence locally, while the branch records exact content hashes and relative provenance without increasing public exposure. Current Prompt 004A reports synthesize the engineering value needed for future work and are the only current handoff authority.
