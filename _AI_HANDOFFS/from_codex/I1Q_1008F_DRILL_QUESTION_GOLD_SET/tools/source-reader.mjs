// Parser provenance: direct reuse of the validated I1Q-1008E parser module.
import { readFile } from 'node:fs/promises';
import { sha256 } from './canonical.mjs';
import { parseArtifactBuffer } from '../../I1Q_1008E_RESTRICTED_FULL_CORPUS_EXTRACTION/tools/parsers.mjs';

function toUs(seconds) {
  return seconds === null ? null : Math.round(seconds * 1_000_000);
}

function adapt(parsed) {
  return parsed.records.map((record) => ({
    record_ordinal: record.record_ordinal,
    start_us: toUs(record.segment_start_time),
    end_us: toUs(record.segment_end_time),
    speaker: record.speaker_label,
    text: record.text,
    raw_record_hash: record.raw_record_hash,
    text_hash: record.text_hash,
  }));
}

export async function readSourcePair(row) {
  const transcriptBuffer = await readFile(row.transcript_path);
  const nodesBuffer = await readFile(row.nodes_path);
  const transcript = parseArtifactBuffer(transcriptBuffer, 'transcript_json', row.transcript_sha256);
  const nodes = parseArtifactBuffer(nodesBuffer, 'nodes_json', row.nodes_sha256);
  return {
    row,
    transcript: adapt(transcript),
    nodes: adapt(nodes),
    observed: {
      transcript_sha256: sha256(transcriptBuffer),
      nodes_sha256: sha256(nodesBuffer),
    },
  };
}

// The generator never copies source files and retains at most one pair for its caller.
export async function* streamSourcePairs(orderedRoster) {
  for (const row of orderedRoster) yield await readSourcePair(row);
}
