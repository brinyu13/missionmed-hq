# Transcript and Nodes Reconciliation

The predecessor roster contains 97 validated transcripts and 99 validated Nodes artifacts. All 97 transcript positions have a paired Nodes artifact; the two additional Nodes-only positions remain accounted secondary evidence and are not silently converted into drills.

Accepted 071 diagnostics established that current `.nodes` payloads are transcript-segment mirrors using the raw/default schema rather than curated question-boundary manifests. The live 070B runtime fetches Nodes only and applies a lossy Dr-to-non-Dr turn detector plus a five-second gap and text-score filter. Consequently, Nodes agreement is useful evidence but cannot establish Gold truth or replace transcript provenance.

For every Gold question:

- Transcript evidence is mandatory.
- Nodes evidence, when present, is bound to the exact paired Nodes hash and classified as boundary, question, call, answer-boundary, or runtime-comparison confirmation.
- Missing or malformed Nodes cannot authorize invented wording, timing, or a question record.
- Transcript and Nodes positions are compared without merging their raw records or double-counting mirrored detections.

All 16,690 final questions have transcript provenance. Nodes corroborate 15,034 of them; the remaining 1,656 are transcript-only. No question is Nodes-only. Accepted-runtime comparison agreement is 900,778 ppm. A question can be Gold-valid without passing the live runtime's lossy filter; disagreement is documented rather than forced to match.
