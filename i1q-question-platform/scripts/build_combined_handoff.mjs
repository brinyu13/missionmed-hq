import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const WORKTREE = dirname(APP_ROOT);
const ROOT = join(WORKTREE, '_AI_HANDOFFS/from_codex/I1Q_STATQUESTIONS_1007X_MULTIAGENT');
const COMBINED_NAME = 'I1Q_1007X_COMBINED_HANDOFF.md';
const COMBINED_PATH = join(ROOT, COMBINED_NAME);
const VALIDATION_PATH = join(ROOT, 'evidence/combined_handoff_validation.json');

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

async function markdownSources(root) {
  const files = [];
  const visit = async (current) => {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) {
        await visit(path);
      } else if (entry.isFile() && entry.name.endsWith('.md') && entry.name !== COMBINED_NAME) {
        files.push(path);
      }
    }
  };
  await visit(root);
  return files.sort((left, right) => relative(root, left).localeCompare(relative(root, right)));
}

const sources = await markdownSources(ROOT);
const sourceRecords = [];
const sections = [];

for (const path of sources) {
  const relativePath = relative(ROOT, path);
  const content = await readFile(path, 'utf8');
  const marker = `============================================================\nFILE: ${relativePath}\n============================================================\n`;
  sections.push(`${marker}${content}${content.endsWith('\n') ? '' : '\n'}`);
  sourceRecords.push({
    path: relativePath,
    bytes: Buffer.byteLength(content),
    lines: (content.match(/\n/gu) || []).length + (content.endsWith('\n') ? 0 : 1),
    sha256: sha256(content),
  });
}

const combined = `${sections.join('\n')}`;
await writeFile(COMBINED_PATH, combined, 'utf8');

const markers = [...combined.matchAll(/^FILE: (.+)$/gmu)].map((match) => match[1]);
const duplicateMarkers = [...new Set(markers.filter((path, index) => markers.indexOf(path) !== index))];
const missing = sourceRecords.filter((source) => !markers.includes(source.path)).map((source) => source.path);
const unexpected = markers.filter((path) => !sourceRecords.some((source) => source.path === path));
const sourceHashMismatches = [];

for (let index = 0; index < sourceRecords.length; index += 1) {
  const source = sourceRecords[index];
  const startMarker = `============================================================\nFILE: ${source.path}\n============================================================\n`;
  const start = combined.indexOf(startMarker);
  const contentStart = start + startMarker.length;
  const nextSource = sourceRecords[index + 1];
  const end = nextSource
    ? combined.indexOf(`\n============================================================\nFILE: ${nextSource.path}\n============================================================\n`, contentStart)
    : combined.length;
  const embedded = combined.slice(contentStart, end);
  const original = await readFile(join(ROOT, source.path), 'utf8');
  const expected = `${original}${original.endsWith('\n') ? '' : '\n'}`;
  if (embedded !== expected) {
    sourceHashMismatches.push(source.path);
  }
}

const validation = {
  generated_at: new Date().toISOString(),
  status: missing.length === 0
    && duplicateMarkers.length === 0
    && unexpected.length === 0
    && sourceHashMismatches.length === 0
    && !markers.includes(COMBINED_NAME)
    ? 'pass'
    : 'fail',
  combined_path: relative(WORKTREE, COMBINED_PATH),
  source_count: sourceRecords.length,
  source_list: sourceRecords,
  final_line_count: (combined.match(/\n/gu) || []).length,
  combined_bytes: Buffer.byteLength(combined),
  combined_sha256: sha256(combined),
  markers_found: markers.length,
  missing_sources: missing,
  duplicate_sources: duplicateMarkers,
  unexpected_sources: unexpected,
  exact_content_mismatches: sourceHashMismatches,
  self_embedding: markers.includes(COMBINED_NAME),
};

await writeFile(VALIDATION_PATH, `${JSON.stringify(validation, null, 2)}\n`, 'utf8');
await writeFile(join(APP_ROOT, 'evidence/combined_handoff_validation.json'), `${JSON.stringify(validation, null, 2)}\n`, 'utf8');

if (validation.status !== 'pass') {
  process.exitCode = 1;
}

process.stdout.write(`${JSON.stringify({
  status: validation.status,
  source_count: validation.source_count,
  final_line_count: validation.final_line_count,
  combined_sha256: validation.combined_sha256,
}, null, 2)}\n`);
