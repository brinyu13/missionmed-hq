import { readFile, writeFile } from 'node:fs/promises';
import process from 'node:process';
import pg from 'pg';

const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  args.set(process.argv[index], process.argv[index + 1]);
}
const wpPath = args.get('--wp-json');
const outputPath = args.get('--output');
if (!wpPath || !process.env.STORYFORGE_DATABASE_URL) {
  throw new Error('--wp-json and STORYFORGE_DATABASE_URL are required');
}

const wpRows = JSON.parse(await readFile(wpPath, 'utf8'));
const client = new pg.Client({ connectionString: process.env.STORYFORGE_DATABASE_URL });
await client.connect();
const result = await client.query(
  `SELECT mentor_id::text, student_id::text, active
   FROM public.sf_mentor_assignments
   WHERE active
   ORDER BY mentor_id, student_id`,
);
await client.end();

const key = (row) => `${String(row.mentor_id).toLowerCase()}|${String(row.student_id).toLowerCase()}`;
const wp = new Set(wpRows.filter((row) => row.active).map(key));
const database = new Set(result.rows.map(key));
const report = {
  generated_at: new Date().toISOString(),
  source: 'wordpress_mentor_assignments',
  database: 'public.sf_mentor_assignments',
  wp_count: wp.size,
  database_count: database.size,
  missing_in_database: [...wp].filter((value) => !database.has(value)),
  missing_in_wordpress: [...database].filter((value) => !wp.has(value)),
};
report.clean = report.missing_in_database.length === 0 && report.missing_in_wordpress.length === 0;
const text = `${JSON.stringify(report, null, 2)}\n`;
if (outputPath) await writeFile(outputPath, text);
process.stdout.write(text);
if (!report.clean) process.exitCode = 1;
