// Shared helpers for the Application Intelligence test suites (synthetic data only).
import { readFile } from 'node:fs/promises';
import { assembleContextPack } from './pack/assemble.mjs';
import { resolvePressureProfile } from './contracts/pressure-profile.mjs';

export async function fixture(name) {
  return JSON.parse(await readFile(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'));
}

export async function scenario(name) {
  const scen = await fixture(`scenario.${name}.v1.json`);
  const projections = await Promise.all(scen.projections.map(fixture));
  const pool = await fixture('question-pool.v1.json');
  return { scen, projections, pool };
}

export function buildPack({ scen, projections, pool }, overrides = {}) {
  return assembleContextPack({
    subject_id: scen.subject_id,
    projections,
    pool_snapshot_ref: pool.snapshot_id,
    practice_goal: scen.practice_goal,
    now: scen.now,
    ...overrides,
  });
}

export function profileFor(scen, overrides = {}) {
  return resolvePressureProfile({
    style: scen.style,
    pressure_modifier: scen.pressure_modifier ?? false,
    follow_up_intensity: scen.follow_up_intensity,
    practice_goal: scen.practice_goal,
    ...overrides,
  });
}

/** Deep clone then mutate a projection's source version and payload marker. */
export function bumpVersion(projection, version) {
  const copy = structuredClone(projection);
  copy.source_version = version;
  copy.source_receipt = { ...copy.source_receipt, hash: `${copy.source_receipt.hash.slice(0, 56)}${version.padStart(8, '0').slice(-8)}` };
  return copy;
}

export const ACCUSATION = /\b(lie|lied|lying|liar|dishonest\w*|fraud\w*|fabricat\w*|misrepresent\w*|red[\s_-]?flags?|suspicious\w*|decept\w*|deceiv\w*|cheat\w*|falsif\w*)\b/iu;
