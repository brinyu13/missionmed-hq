import { readdir } from 'node:fs/promises';
import { basename, extname, join, relative, sep } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { sha256 } from '../hash.mjs';

const AS_OF_DATE = '2026-07-16';
const HASH = /^[a-f0-9]{64}$/u;
const RAW_TRANSCRIPT_EXTENSIONS = new Set([
  '.ass', '.dfxp', '.sbv', '.srt', '.ssa', '.ttml', '.vtt', '.webvtt',
]);
const NAMED_DATA_EXTENSIONS = new Set([
  '.csv', '.docx', '.json', '.jsonl', '.md', '.ndjson', '.pdf', '.tsv', '.txt', '.xml',
]);
const TRANSCRIPT_NAME = /(?:^|[._-])(?:transcripts?|captions?|subtitles?|stream[._-]?vtt)(?:[._-]|$)/iu;
const NODES_NAME = /(?:^|[._-])(?:nodes?|media[._-]?registry)(?:[._-]|$)/iu;
const SKIPPED_DIRECTORY_NAMES = new Set(['.git', 'node_modules']);
const NONCORPUS_PREFIXES = Object.freeze([
  '_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1008C_SOURCE_FACTORY/',
  'i1q-question-platform/fixtures/',
]);
const PROBE_QUALIFICATION = 'This live worktree probe detects obvious transcript/caption and Nodes/media-registry filenames or extensions. It prevents silent reuse of a zero-access manifest when such files appear, but it cannot prove corpus completeness or discover opaque external sources.';

function normalizedRelative(root, path) {
  return relative(root, path).split(sep).join('/');
}

function contentHashMatches(value) {
  if (!value || !HASH.test(value.content_hash || '')) return false;
  const payload = structuredClone(value);
  delete payload.content_hash;
  return value.content_hash === sha256(payload);
}

export function classifyWorkspaceCorpusPath(path) {
  const name = basename(path).toLowerCase();
  const extension = extname(name);
  const rawTranscriptExtension = RAW_TRANSCRIPT_EXTENSIONS.has(extension);
  const dataLikeName = extension === '' || NAMED_DATA_EXTENSIONS.has(extension);
  const namedTranscriptData = dataLikeName && TRANSCRIPT_NAME.test(name);
  const namedNodesData = dataLikeName && NODES_NAME.test(name);
  return {
    transcript_or_caption_candidate: rawTranscriptExtension || namedTranscriptData,
    nodes_or_media_registry_candidate: namedNodesData,
    raw_transcript_extension: rawTranscriptExtension,
    named_transcript_data: namedTranscriptData,
    named_nodes_data: namedNodesData,
  };
}

export function workspaceCorpusProbeValid(probe) {
  if (!contentHashMatches(probe)) return false;
  const topLevelKeys = [
    'schema_version', 'as_of_date', 'status', 'scope', 'qualification',
    'corpus_completeness_proof', 'current_corpus_access_proof', 'contains_paths',
    'scanned_file_count', 'excluded_paths', 'excluded_prefixes', 'skipped_directory_names',
    'detectors', 'counts', 'candidate_path_hashes', 'content_hash',
  ];
  return isDeepStrictEqual(Object.keys(probe).sort(), topLevelKeys.sort())
    && probe.schema_version === 'missionmed.i1q.workspace_corpus_access_probe.v1'
    && probe.as_of_date === AS_OF_DATE
    && probe.status === 'COMPLETED_HEURISTIC_NO_OBVIOUS_CORPUS_ARTIFACTS'
    && probe.scope === 'CURRENT_WORKTREE_FILENAME_AND_EXTENSION_HEURISTIC'
    && probe.qualification === PROBE_QUALIFICATION
    && probe.corpus_completeness_proof === false
    && probe.current_corpus_access_proof === false
    && probe.contains_paths === false
    && Number.isInteger(probe.scanned_file_count)
    && probe.scanned_file_count > 0
    && Array.isArray(probe.excluded_paths)
    && new Set(probe.excluded_paths).size === probe.excluded_paths.length
    && isDeepStrictEqual(probe.excluded_prefixes, [...NONCORPUS_PREFIXES])
    && isDeepStrictEqual(probe.skipped_directory_names, [...SKIPPED_DIRECTORY_NAMES].sort())
    && isDeepStrictEqual(probe.detectors, {
      raw_transcript_extensions: [...RAW_TRANSCRIPT_EXTENSIONS].sort(),
      named_data_extensions: [...NAMED_DATA_EXTENSIONS].sort(),
      transcript_name_pattern: TRANSCRIPT_NAME.source,
      nodes_name_pattern: NODES_NAME.source,
    })
    && probe.counts?.transcript_or_caption_candidates === 0
    && probe.counts?.nodes_or_media_registry_candidates === 0
    && probe.counts?.raw_transcript_extension_files === 0
    && probe.counts?.named_transcript_data_files === 0
    && probe.counts?.named_nodes_data_files === 0
    && Array.isArray(probe.candidate_path_hashes?.transcript_or_caption)
    && probe.candidate_path_hashes.transcript_or_caption.length === 0
    && Array.isArray(probe.candidate_path_hashes?.nodes_or_media_registry)
    && probe.candidate_path_hashes.nodes_or_media_registry.length === 0;
}

export async function probeWorkspaceCorpusAccess(worktree, { excludedPaths = [] } = {}) {
  const excluded = new Set(excludedPaths);
  const transcriptPaths = new Set();
  const nodesPaths = new Set();
  let scannedFileCount = 0;
  let rawTranscriptExtensionFiles = 0;
  let namedTranscriptDataFiles = 0;
  let namedNodesDataFiles = 0;

  async function visit(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name, 'en'));
    for (const entry of entries) {
      if (entry.isDirectory() && SKIPPED_DIRECTORY_NAMES.has(entry.name)) continue;
      const absolute = join(directory, entry.name);
      const path = normalizedRelative(worktree, absolute);
      if (NONCORPUS_PREFIXES.some((prefix) => path.startsWith(prefix))) continue;
      if (entry.isDirectory()) {
        await visit(absolute);
        continue;
      }
      if ((!entry.isFile() && !entry.isSymbolicLink()) || excluded.has(path)) continue;
      scannedFileCount += 1;
      const classification = classifyWorkspaceCorpusPath(path);
      if (classification.raw_transcript_extension) rawTranscriptExtensionFiles += 1;
      if (classification.named_transcript_data) namedTranscriptDataFiles += 1;
      if (classification.named_nodes_data) namedNodesDataFiles += 1;
      if (classification.transcript_or_caption_candidate) transcriptPaths.add(path);
      if (classification.nodes_or_media_registry_candidate) nodesPaths.add(path);
    }
  }

  await visit(worktree);
  const transcriptHashes = [...transcriptPaths].sort().map((path) => sha256(path));
  const nodesHashes = [...nodesPaths].sort().map((path) => sha256(path));
  const status = transcriptHashes.length === 0 && nodesHashes.length === 0
    ? 'COMPLETED_HEURISTIC_NO_OBVIOUS_CORPUS_ARTIFACTS'
    : 'REPROBE_REQUIRED_CORPUS_LIKE_ARTIFACTS_DETECTED';
  const probe = {
    schema_version: 'missionmed.i1q.workspace_corpus_access_probe.v1',
    as_of_date: AS_OF_DATE,
    status,
    scope: 'CURRENT_WORKTREE_FILENAME_AND_EXTENSION_HEURISTIC',
    qualification: PROBE_QUALIFICATION,
    corpus_completeness_proof: false,
    current_corpus_access_proof: false,
    contains_paths: false,
    scanned_file_count: scannedFileCount,
    excluded_paths: [...excluded].sort(),
    excluded_prefixes: [...NONCORPUS_PREFIXES],
    skipped_directory_names: [...SKIPPED_DIRECTORY_NAMES].sort(),
    detectors: {
      raw_transcript_extensions: [...RAW_TRANSCRIPT_EXTENSIONS].sort(),
      named_data_extensions: [...NAMED_DATA_EXTENSIONS].sort(),
      transcript_name_pattern: TRANSCRIPT_NAME.source,
      nodes_name_pattern: NODES_NAME.source,
    },
    counts: {
      transcript_or_caption_candidates: transcriptHashes.length,
      nodes_or_media_registry_candidates: nodesHashes.length,
      raw_transcript_extension_files: rawTranscriptExtensionFiles,
      named_transcript_data_files: namedTranscriptDataFiles,
      named_nodes_data_files: namedNodesDataFiles,
    },
    candidate_path_hashes: {
      transcript_or_caption: transcriptHashes,
      nodes_or_media_registry: nodesHashes,
    },
  };
  probe.content_hash = sha256(probe);
  return probe;
}
