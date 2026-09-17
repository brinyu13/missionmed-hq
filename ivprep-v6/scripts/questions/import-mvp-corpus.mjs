// Y1-Y2-CAM-V6-3500 / CC-25 — MVP question corpus importer.
//
// Parses the Fable 3494A MVP question import manifest and emits the seed corpus
// module. The manifest is the authoritative verbatim extraction of the two
// Founder-supplied source PDFs, so the question text is PARSED, never
// hand-transcribed: typographic characters (U+2010 hyphens, en dashes, curly
// apostrophes) and deliberate source typos flagged [sic] survive byte-exact.
//
// Implements the pipeline in _QUESTION_TAXONOMY_AND_IMPORT_MAP.md §2:
//   1 parse manifest   2 stable IDs + provenance   3 seed tags   4 pin CORE
//   5 behavioral flag  6 followup_eligible         7 asset status
//   8 import report    exclusions structurally skipped and asserted absent
//
// Re-run:  node scripts/questions/import-mvp-corpus.mjs
// Output:  public/questions/mission-residency-corpus.mjs   (generated, do not edit)

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const MANIFEST = new URL(
  '../../../_AI_HANDOFFS/from_cowork/Y1-Y2-CAM-V6-3494A_FABLE_PRODUCTION_AUTHORITY/'
  + '3494A_CONSOLIDATED/Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md',
  import.meta.url,
);
const OUT = new URL('../../public/questions/mission-residency-corpus.mjs', import.meta.url);

// Manifest short tag -> normalized taxonomy tag (taxonomy doc §1, 30 tags).
const TAG_MAP = Object.freeze({
  TRAD: 'TRADITIONAL', PERS: 'PERSONAL', BKGD: 'BACKGROUND', MOTIV: 'MOTIVATION',
  SPEC: 'SPECIALTY', FIT: 'PROGRAM_FIT', BEH: 'BEHAVIORAL', SIT: 'SITUATIONAL',
  CONF: 'CONFLICT', TEAM: 'TEAMWORK', LEAD: 'LEADERSHIP', FAIL: 'FAILURE',
  SAFETY: 'MISTAKE_SAFETY', ETH: 'ETHICS', STRESS: 'STRESS_PRESSURE', STR: 'STRENGTHS',
  WEAK: 'WEAKNESSES', HOBBY: 'HOBBIES', GOALS: 'CAREER_GOALS', CV: 'CV_BASED',
  RES: 'RESEARCH', CLIN: 'CLINICAL_EXPERIENCE', PT: 'PATIENT_INTERACTION',
  COMM: 'COMMUNICATION', ADV: 'ADVERSITY', REDFLAG: 'RED_FLAGS',
  POLICY: 'HEALTHCARE_POLICY', CREATIVE: 'CREATIVE_UNUSUAL', CLOSE: 'CLOSING',
});

export const TAXONOMY = Object.freeze(['CORE', ...new Set(Object.values(TAG_MAP))]);

// The three applicant-asked sections that must never enter the interviewer corpus.
const EXCLUDED_SECTIONS = Object.freeze([
  'Questions to Ask the Faculty',
  'Questions to Ask the Program Director',
  'Questions to Ask the Residents',
]);

const INTERVIEWERS = Object.freeze(['kelly', 'woods']);

// Difficulty is NOT specified by the Fable authority. It is an import-time seed
// heuristic so the required field is populated defensibly; it is curation-editable
// and carries no authority weight. Recorded in the generated header as such.
const DIFFICULTY_3 = Object.freeze(['RED_FLAGS', 'ETHICS', 'MISTAKE_SAFETY', 'FAILURE']);
const DIFFICULTY_2 = Object.freeze(['BEHAVIORAL', 'SITUATIONAL', 'CONFLICT', 'STRESS_PRESSURE', 'ADVERSITY', 'WEAKNESSES']);

function seedDifficulty(tags) {
  if (tags.some((tag) => DIFFICULTY_3.includes(tag))) return 3;
  if (tags.some((tag) => DIFFICULTY_2.includes(tag))) return 2;
  return 1;
}

function seedStyle(tags) {
  const style = [];
  if (tags.includes('BEHAVIORAL')) style.push('behavioral');
  if (tags.includes('SITUATIONAL')) style.push('situational');
  if (tags.includes('CREATIVE_UNUSUAL')) style.push('creative');
  if (tags.includes('TRADITIONAL') || style.length === 0) style.push('traditional');
  return style;
}

function normalizeTags(cell) {
  const raw = String(cell || '').split(',').map((part) => part.trim()).filter(Boolean);
  const mapped = [];
  for (const short of raw) {
    if (short === '—' || short === '-') continue;
    const tag = TAG_MAP[short];
    if (!tag) throw new Error(`Unmapped manifest tag "${short}" - refusing to silently drop taxonomy data.`);
    if (!mapped.includes(tag)) mapped.push(tag);
  }
  return mapped;
}

function sectionBody(markdown, startHeading, endHeading) {
  const start = markdown.indexOf(startHeading);
  if (start < 0) throw new Error(`Manifest section not found: ${startHeading}`);
  const from = start + startHeading.length;
  const end = endHeading ? markdown.indexOf(endHeading, from) : markdown.length;
  if (endHeading && end < 0) throw new Error(`Manifest section end not found: ${endHeading}`);
  return markdown.slice(from, end < 0 ? markdown.length : end);
}

// Table rows only: skip the header row and the |---|---| separator.
function tableRows(body) {
  return body.split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('|') && line.endsWith('|'))
    .map((line) => line.slice(1, -1).split('|').map((cell) => cell.trim()))
    .filter((cells) => cells.length >= 2 && !/^-+$/u.test(cells[0]) && cells[0] !== 'ID');
}

function assetsFor(corePriority) {
  const assets = {};
  for (const interviewer of INTERVIEWERS) assets[interviewer] = corePriority ? 'planned' : 'none';
  return assets;
}

function record({ questionId, canonicalText, source, sourceNumber, tags, corePriority, extraProvenance = {} }) {
  const sic = canonicalText.includes('[sic]');
  const allTags = corePriority ? ['CORE', ...tags] : tags;
  return {
    question_id: questionId,
    canonical_text: canonicalText,
    revision: 1,
    source,
    source_number: sourceNumber,
    tags: allTags,
    style: seedStyle(allTags),
    difficulty: seedDifficulty(allTags),
    difficulty_origin: 'import_seed_heuristic',
    core_priority: corePriority,
    specialties: [],
    cv_relevance: allTags.includes('CV_BASED'),
    behavioral: allTags.includes('BEHAVIORAL'),
    followup_eligible: !allTags.includes('CLOSING'),
    verbatim_sic: sic,
    assets: assetsFor(corePriority),
    links: [],
    provenance: { manifest: 'Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md', ...extraProvenance },
  };
}

export function parseManifest(markdown) {
  for (const heading of EXCLUDED_SECTIONS) {
    if (!markdown.includes(heading)) {
      throw new Error(`Exclusion "${heading}" is no longer named in the manifest; the parser can no longer prove it skipped it.`);
    }
  }

  const coreBody = sectionBody(markdown, '## 2. FOUNDER CORE COLLECTION', '## 3. MR142 CORPUS');
  const mrBody = sectionBody(markdown, '## 3. MR142 CORPUS', '## 4. BEHAVIORAL COLLECTION');
  const behBody = sectionBody(markdown, '## 4. BEHAVIORAL COLLECTION', '## 5. DUPLICATE-REVIEW PROCESS');

  const core = tableRows(coreBody)
    .filter((cells) => /^CORE-\d{2}$/u.test(cells[0]))
    .map((cells) => record({
      questionId: cells[0],
      canonicalText: cells[1],
      source: 'founder_core',
      sourceNumber: Number(cells[0].slice(5)),
      tags: [],
      corePriority: true,
      extraProvenance: { manifest_cross_refs: cells[2] && cells[2] !== '—' ? cells[2] : null },
    }));

  const mr142 = tableRows(mrBody)
    .filter((cells) => /^\d{3}$/u.test(cells[0]))
    .map((cells) => record({
      questionId: `MR142-${cells[0]}`,
      canonicalText: cells[1],
      source: 'mr142',
      sourceNumber: Number(cells[0]),
      tags: normalizeTags(cells[2]),
      corePriority: false,
    }));

  const behRows = tableRows(behBody).filter((cells) => /^\d{3}$/u.test(cells[0]));
  const behavioral = [];
  let collectionDescription = null;
  for (const cells of behRows) {
    const id = `BEH-${cells[0]}`;
    const text = cells[1];
    // BEH-042 is the retained behavioural premise, reserved as the collection
    // description record so downstream IDs stay stable (manifest section 4 note).
    if (/^\(Preamble text retained as collection description/u.test(text)) {
      collectionDescription = {
        question_id: id,
        collection: 'BEHAVIORAL',
        is_collection_description: true,
        canonical_text: text,
        revision: 1,
        source: 'mr_behavioral',
        source_number: Number(cells[0]),
        provenance: { manifest: 'Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md' },
      };
      continue;
    }
    const tags = normalizeTags(cells[2]);
    if (!tags.includes('BEHAVIORAL')) tags.unshift('BEHAVIORAL');
    behavioral.push(record({
      questionId: id,
      canonicalText: text,
      source: 'mr_behavioral',
      sourceNumber: Number(cells[0]),
      tags,
      corePriority: false,
    }));
  }

  return { core, mr142, behavioral, collectionDescription };
}

function assertCounts({ core, mr142, behavioral, collectionDescription }) {
  const problems = [];
  if (core.length !== 10) problems.push(`CORE expected 10, got ${core.length}`);
  if (mr142.length !== 142) problems.push(`MR142 expected 142, got ${mr142.length}`);
  if (behavioral.length !== 41) problems.push(`BEH expected 41, got ${behavioral.length}`);
  if (!collectionDescription) problems.push('BEHAVIORAL collection description record missing');

  const ids = new Set();
  for (const value of [...core, ...mr142, ...behavioral]) {
    if (ids.has(value.question_id)) problems.push(`duplicate id ${value.question_id}`);
    ids.add(value.question_id);
    if (!value.canonical_text) problems.push(`${value.question_id} has empty canonical_text`);
  }
  for (const heading of EXCLUDED_SECTIONS) {
    for (const value of [...core, ...mr142, ...behavioral]) {
      if (value.canonical_text.includes(heading)) problems.push(`${value.question_id} carries excluded section text`);
    }
  }
  if (problems.length) throw new Error(`Import refused:\n  - ${problems.join('\n  - ')}`);
}

async function main() {
  const markdown = await readFile(MANIFEST, 'utf8');
  const parsed = parseManifest(markdown);
  assertCounts(parsed);

  const manifestSha = createHash('sha256').update(markdown).digest('hex');
  const questions = [...parsed.core, ...parsed.mr142, ...parsed.behavioral];
  const sicCount = questions.filter((value) => value.verbatim_sic).length;

  const header = `// GENERATED FILE - DO NOT EDIT BY HAND.
//
// Regenerate with:  node scripts/questions/import-mvp-corpus.mjs
//
// Seed question corpus for IV Prep On-Call, imported from the Fable 3494A MVP
// question import manifest (Y1-Y2-CAM-V6-3494A), which is itself the authoritative
// verbatim extraction of the Founder-supplied source PDFs.
//
// Source manifest SHA-256: ${manifestSha}
//
// Counts: ${parsed.core.length} CORE + ${parsed.mr142.length} MR142 + ${parsed.behavioral.length} BEHAVIORAL
//         + 1 BEHAVIORAL collection description record.
//
// canonical_text is VERBATIM, including deliberate source typos flagged [sic]
// (${sicCount} records). Text is immutable per revision: MissionMed edits create a new
// revision with edited_from provenance, they never rewrite these strings in place.
//
// EXCLUDED BY LAW and structurally absent: "Questions to Ask the Faculty",
// "Questions to Ask the Program Director", "Questions to Ask the Residents".
// Those are applicant-asked questions, not interviewer questions.
//
// difficulty is an import-time seed heuristic (difficulty_origin:
// 'import_seed_heuristic'), NOT Fable-authored. It is curation-editable.
// links[] is intentionally empty: duplicate review is an explicit later,
// non-destructive process that only ever adds LINK relations.
`;

  const body = `${header}
export const CORPUS_MANIFEST_SHA256 = '${manifestSha}';

export const QUESTION_TAXONOMY = Object.freeze(${JSON.stringify(TAXONOMY)});

export const EXCLUDED_SOURCE_SECTIONS = Object.freeze(${JSON.stringify(EXCLUDED_SECTIONS)});

export const BEHAVIORAL_COLLECTION = Object.freeze(${JSON.stringify(parsed.collectionDescription, null, 2)});

export const SEED_QUESTIONS = Object.freeze(${JSON.stringify(questions, null, 2)}.map(Object.freeze));
`;

  await mkdir(new URL('.', OUT), { recursive: true });
  await writeFile(OUT, body, 'utf8');

  process.stdout.write([
    'MVP question corpus import PASS',
    `  CORE                    ${parsed.core.length}`,
    `  MR142                   ${parsed.mr142.length}`,
    `  BEHAVIORAL              ${parsed.behavioral.length}`,
    `  collection descriptions 1`,
    `  total question records  ${questions.length}`,
    `  verbatim [sic] retained ${sicCount}`,
    `  exclusions enforced     ${EXCLUDED_SECTIONS.length}`,
    `  manifest sha256         ${manifestSha.slice(0, 16)}...`,
    `  written                 public/questions/mission-residency-corpus.mjs`,
    '',
  ].join('\n'));
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('import-mvp-corpus.mjs')) {
  await main();
}
