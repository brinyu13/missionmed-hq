import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));

test('pilot manifest builder seals exactly four DIRECT enrolled recipients without raw email addresses', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ma-onboarding-manifest-'));
  const csv = join(dir, 'cohort.csv'); const output = join(dir, 'manifest.json');
  const names = ['Neidy', 'Ana Torres', 'Raghav Gupta', 'Subani Dias'];
  const rows = names.map((name, index) => [
    name, 100 + index, 'pilot' + index, 'pilot' + index + '@example.invalid',
    String(index + 1).repeat(8) + '-1111-4111-8111-' + String(index + 1).repeat(12),
    'DIRECT', 'true', 'true', 'not_sent',
  ].join(','));
  await writeFile(csv, 'display_name,wp_user_id,username,email,student_id,sponsor_type,enrolled,onboarding_eligible,prior_send_state\n' + rows.join('\n') + '\n');
  const result = spawnSync('python3', [join(root, 'scripts/onboarding-launch/build_pilot_manifest.py'),
    '--cohort-csv', csv, '--html', join(root, 'emails/onboarding-launch-v1.html'),
    '--text', join(root, 'emails/onboarding-launch-v1.txt'), '--output', output], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const manifest = JSON.parse(await readFile(output, 'utf8'));
  assert.deepEqual(manifest.items.map(item => item.display_name), names);
  assert.equal(manifest.external_send_authorized, false);
  assert.equal(manifest.provider, 'wordpress_wp_mail');
  assert.equal(JSON.stringify(manifest).includes('@example.invalid'), false);
  assert.ok(manifest.items.every(item => /^[0-9a-f]{64}$/.test(item.email_sha256)));
});

test('WordPress pilot controller has authority, preflight, ledger, retry and MIME fallback gates', async () => {
  const source = await readFile(join(root, 'scripts/onboarding-launch/wp_onboarding_pilot.php'), 'utf8');
  for (const token of ['external_send_authorized','authority_commit','onboarding_pilot_exact_cohort_required',
    'sfwd_lms_has_access','_missionmed_onboarding_launch_v1','uncertain_hold','retry-failed',
    'wp_mail(','X-MissionMed-Send-Key','AltBody']) assert.ok(source.includes(token), token);
});
