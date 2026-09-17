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
    'DIRECT', 'true', 'true', 'not_sent', 'READY', '',
  ].join(','));
  await writeFile(csv, 'display_name,wp_user_id,username,email,student_id,sponsor_type,enrolled,onboarding_eligible,prior_send_state,pilot_status,hold_reason\n' + rows.join('\n') + '\n');
  const result = spawnSync('python3', [join(root, 'scripts/onboarding-launch/build_pilot_manifest.py'),
    '--cohort-csv', csv, '--html', join(root, 'emails/onboarding-launch-v2.html'),
    '--text', join(root, 'emails/onboarding-launch-v2.txt'), '--output', output], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const manifest = JSON.parse(await readFile(output, 'utf8'));
  assert.deepEqual(manifest.items.map(item => item.display_name), names);
  assert.equal(manifest.external_send_authorized, false);
  assert.equal(manifest.provider, 'wordpress_wp_mail');
  assert.equal(manifest.template_version, 'examprep-onboarding-email-2026-09-17-v2');
  assert.equal(JSON.stringify(manifest).includes('@example.invalid'), false);
  assert.ok(manifest.items.every(item => /^[0-9a-f]{64}$/.test(item.email_sha256)));
});

test('pilot manifest preserves held named students without credentials or substitution', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ma-onboarding-held-'));
  const csv = join(dir, 'cohort.csv'); const output = join(dir, 'manifest.json');
  const rows = [
    'Neidy,,,,,DIRECT,false,false,not_sent,HELD,canonical_identity_not_resolved',
    'Ana Torres,353,anat2,ana@example.invalid,b2a9e055-d55e-5bfc-8c0c-bd38f3b14b5c,DIRECT,true,true,not_sent,READY,',
    'Raghav Gupta,114,RaghavG,raghav@example.invalid,5171c2ec-5046-59e0-a22a-7362404bf9ec,DIRECT,true,true,not_sent,READY,',
    'Subani Dias,,,,,DIRECT,false,false,not_sent,HELD,account_link_not_resolved',
  ];
  await writeFile(csv, 'display_name,wp_user_id,username,email,student_id,sponsor_type,enrolled,onboarding_eligible,prior_send_state,pilot_status,hold_reason\n' + rows.join('\n') + '\n');
  const result = spawnSync('python3', [join(root, 'scripts/onboarding-launch/build_pilot_manifest.py'),
    '--cohort-csv', csv, '--html', join(root, 'emails/onboarding-launch-v2.html'),
    '--text', join(root, 'emails/onboarding-launch-v2.txt'), '--output', output], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const manifest = JSON.parse(await readFile(output, 'utf8'));
  assert.deepEqual(manifest.items.map(item => item.pilot_status), ['HELD', 'READY', 'READY', 'HELD']);
  assert.equal('username' in manifest.items[0], false);
  assert.equal(JSON.stringify(manifest).includes('substitute'), false);
});

test('WordPress pilot controller has authority, preflight, ledger, retry and MIME fallback gates', async () => {
  const source = await readFile(join(root, 'scripts/onboarding-launch/wp_onboarding_pilot.php'), 'utf8');
  for (const token of ['external_send_authorized','authority_commit','onboarding_pilot_exact_cohort_required',
    'sfwd_lms_has_access','_missionmed_onboarding_launch_v1','uncertain_hold','retry-failed',
    'pilot_status','hold_reason','wp_mail(','From: Dr J via MissionMed',
    'X-MissionMed-Send-Key','AltBody']) assert.ok(source.includes(token), token);
});
