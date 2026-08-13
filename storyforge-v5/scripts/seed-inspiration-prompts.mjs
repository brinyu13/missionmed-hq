#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';

const { Client } = pg;
const sourceUrl = new URL('../content/inspiration-prompts.json', import.meta.url);

function stableUuid(libraryKey) {
  const hex = createHash('sha256').update(`missionmed-storyforge-inspiration:${libraryKey}`, 'utf8').digest('hex').slice(0, 32).split('');
  hex[12] = '5';
  hex[16] = ['8', '9', 'a', 'b'][Number.parseInt(hex[16], 16) % 4];
  return `${hex.slice(0, 8).join('')}-${hex.slice(8, 12).join('')}-${hex.slice(12, 16).join('')}-${hex.slice(16, 20).join('')}-${hex.slice(20).join('')}`;
}

export function normalizePromptLibrary(library) {
  if (library?.version !== 'b1-513-draft-1' || !Array.isArray(library.prompts) || library.prompts.length !== 81) {
    throw new Error('The canonical 81-prompt StoryForge library is required.');
  }
  return library.prompts.map((prompt, index) => ({
    id: stableUuid(prompt.id),
    libraryKey: prompt.id,
    text: prompt.text,
    who: prompt.who || [],
    whoDetail: prompt.whoDetail || [],
    domain: prompt.domain || [],
    energy: prompt.energy || [],
    territory: prompt.territory,
    followUp: prompt.followUp,
    interviewUse: prompt.interviewUse,
    recommended: prompt.recommended === true,
    sortOrder: index + 1,
  }));
}

async function main() {
  const connectionString = String(process.env.STORYFORGE_DATABASE_URL || '').trim();
  if (!connectionString) throw new Error('STORYFORGE_DATABASE_URL is required.');
  const library = JSON.parse(await readFile(sourceUrl, 'utf8'));
  const prompts = normalizePromptLibrary(library);
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended('b1-514-inspiration-seed', 0))");
    const actor = await client.query("SELECT updated_by FROM public.sf_feature_flags WHERE key='admin_console'");
    if (!actor.rows[0]?.updated_by) throw new Error('The pinned StoryForge Founder attribution is unavailable.');
    for (const prompt of prompts) {
      const result = await client.query(
        `INSERT INTO public.sf_inspiration_prompts (
           id,library_key,text,who_ids,who_detail_ids,domain_ids,energy_ids,territory,
           follow_up,interview_use,state,recommended,imported,sort_order,row_version
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'active',$11,false,$12,0)
         ON CONFLICT (library_key) DO UPDATE SET library_key=EXCLUDED.library_key
         WHERE public.sf_inspiration_prompts.id=EXCLUDED.id
           AND public.sf_inspiration_prompts.text=EXCLUDED.text
           AND public.sf_inspiration_prompts.who_ids=EXCLUDED.who_ids
           AND public.sf_inspiration_prompts.who_detail_ids=EXCLUDED.who_detail_ids
           AND public.sf_inspiration_prompts.domain_ids=EXCLUDED.domain_ids
           AND public.sf_inspiration_prompts.energy_ids=EXCLUDED.energy_ids
           AND public.sf_inspiration_prompts.territory=EXCLUDED.territory
           AND public.sf_inspiration_prompts.follow_up=EXCLUDED.follow_up
           AND public.sf_inspiration_prompts.interview_use=EXCLUDED.interview_use
           AND public.sf_inspiration_prompts.imported=false
         RETURNING id,row_version`,
        [prompt.id, prompt.libraryKey, prompt.text, prompt.who, prompt.whoDetail, prompt.domain, prompt.energy, prompt.territory, prompt.followUp, prompt.interviewUse, prompt.recommended, prompt.sortOrder],
      );
      if (result.rowCount !== 1) throw new Error(`Canonical Inspiration prompt conflict: ${prompt.libraryKey}`);
      await client.query(
        `INSERT INTO public.sf_inspiration_prompt_history(prompt_id,row_version,snapshot,actor_id)
         VALUES($1,$2,$3::jsonb,$4)
         ON CONFLICT(prompt_id,row_version) DO NOTHING`,
        [prompt.id, result.rows[0].row_version, JSON.stringify(prompt), actor.rows[0].updated_by],
      );
    }
    const count = await client.query('SELECT count(*)::integer AS count FROM public.sf_inspiration_prompts WHERE imported=false');
    if (count.rows[0].count !== 81) throw new Error('Canonical Inspiration prompt count is not exactly 81.');
    await client.query('COMMIT');
    process.stdout.write('PASS STORYFORGE_INSPIRATION_PROMPTS count=81\n');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  main().catch((error) => {
    process.stderr.write(`StoryForge Inspiration seed failed: ${error.message}\n`);
    process.exitCode = 1;
  });
}
