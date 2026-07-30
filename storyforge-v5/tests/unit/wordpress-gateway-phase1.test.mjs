import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const packageDir = fileURLToPath(new URL('../..', import.meta.url));
const routeFile = path.join(
  packageDir,
  'infra',
  'wordpress',
  'missionmed-storyforge-route.php',
);

test('WordPress gateway narrowly admits Phase 1 multipart upload and audio DELETE', async (t) => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'storyforge-gateway-phase1.'));
  t.after(async () => {
    await rm(temporary, { recursive: true, force: true });
  });
  const probeFile = path.join(temporary, 'probe.php');
  await writeFile(probeFile, [
    '<?php',
    "define( 'ABSPATH', __DIR__ );",
    'function add_action() {}',
    'require $argv[1];',
    '$uuid = "11111111-1111-4111-8111-111111111111";',
    'echo json_encode(array(',
    "  'upload_exact' => mmsfr_is_recording_segment_upload_path('/storyforge/api/recordings/' . $uuid . '/segments'),",
    "  'upload_near_miss' => mmsfr_is_recording_segment_upload_path('/storyforge/api/recordings/' . $uuid . '/finish'),",
    "  'upload_bad_uuid' => mmsfr_is_recording_segment_upload_path('/storyforge/api/recordings/not-a-uuid/segments'),",
    "  'delete_exact' => mmsfr_is_audio_delete_path('/storyforge/api/audio/' . $uuid),",
    "  'delete_near_miss' => mmsfr_is_audio_delete_path('/storyforge/api/audio/' . $uuid . '/playback'),",
    "  'multipart_webkit' => mmsfr_is_bounded_multipart_content_type('multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW'),",
    "  'multipart_quoted' => mmsfr_is_bounded_multipart_content_type('multipart/form-data; boundary=\"safe-boundary.123\"'),",
    "  'multipart_missing_boundary' => mmsfr_is_bounded_multipart_content_type('multipart/form-data'),",
    "  'multipart_extra_parameter' => mmsfr_is_bounded_multipart_content_type('multipart/form-data; boundary=safe; charset=utf-8'),",
    "  'multipart_overlong' => mmsfr_is_bounded_multipart_content_type('multipart/form-data; boundary=' . str_repeat('a', 71)),",
    '));',
    '',
  ].join('\n'));

  const result = spawnSync(
    process.env.STORYFORGE_TEST_PHP || 'php',
    [probeFile, routeFile],
    { encoding: 'utf8' },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), {
    upload_exact: true,
    upload_near_miss: false,
    upload_bad_uuid: false,
    delete_exact: true,
    delete_near_miss: false,
    multipart_webkit: true,
    multipart_quoted: true,
    multipart_missing_boundary: false,
    multipart_extra_parameter: false,
    multipart_overlong: false,
  });
});

test('WordPress gateway source preserves the bounded body and fail-closed controls', async () => {
  const source = await import('node:fs/promises').then(({ readFile }) => (
    readFile(routeFile, 'utf8')
  ));
  assert.match(source, /MMSFR_MAX_BODY_BYTES', 6291456/);
  assert.match(source, /mmsfr_is_recording_segment_upload_path/);
  assert.match(source, /mmsfr_is_audio_delete_path/);
  assert.match(source, /mmsfr_is_bounded_multipart_content_type/);
  assert.match(source, /is_uploaded_file/);
  assert.match(source, /mmsfr_segment_multipart_request/);
  assert.match(source, /accepts multipart audio only on this route/);
  assert.match(source, /'redirection'\s*=>\s*0/);
  assert.match(source, /'reject_unsafe_urls'/);
  assert.match(source, /mmsfr_feature_enabled\(\)/);
  assert.match(source, /mmsfr_wordpress_origin\(\)/);
  assert.doesNotMatch(source, /array\(\s*'GET',\s*'POST',\s*'PATCH',\s*'DELETE'\s*\)/);
});

test('WordPress gateway reconstructs a binary-safe multipart body without client metadata', async (t) => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'storyforge-gateway-body.'));
  t.after(async () => {
    await rm(temporary, { recursive: true, force: true });
  });
  const probeFile = path.join(temporary, 'probe.php');
  await writeFile(probeFile, [
    '<?php',
    "define( 'ABSPATH', __DIR__ );",
    'function add_action() {}',
    'require $argv[1];',
    '$bytes = "voice\\x00bytes\\r\\n--not-the-boundary";',
    "$body = mmsfr_build_segment_multipart_body(array('seq' => '7', 'durationMs' => '4000'), $bytes, 'audio/webm;codecs=opus', 'fixed-boundary');",
    'echo base64_encode($body);',
    '',
  ].join('\n'));
  const result = spawnSync(
    process.env.STORYFORGE_TEST_PHP || 'php',
    [probeFile, routeFile],
    { encoding: 'utf8' },
  );
  assert.equal(result.status, 0, result.stderr);
  const body = Buffer.from(result.stdout, 'base64');
  assert.ok(body.includes(Buffer.from('name="seq"\r\n\r\n7\r\n')));
  assert.ok(body.includes(Buffer.from('name="durationMs"\r\n\r\n4000\r\n')));
  assert.ok(body.includes(Buffer.from('name="segment"; filename="segment"\r\n')));
  assert.ok(body.includes(Buffer.from('Content-Type: audio/webm;codecs=opus\r\n\r\n')));
  assert.ok(body.includes(Buffer.from('voice\x00bytes\r\n--not-the-boundary')));
  const closing = Buffer.from('--fixed-boundary--\r\n');
  assert.deepEqual(body.subarray(-closing.length), closing);
  assert.equal(body.includes(Buffer.from('client-file-name')), false);
});
