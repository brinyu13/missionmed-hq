import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PINNED_ASSET_SHA256,
  PREIMAGE_SHA256,
  transformJavascript,
  transformPhp,
  transformRuntimePin,
} from '../../matrix-canary/3522c/build-matrix-canary.mjs';

const phpFixture = `\t/**
\t * Add the fail-closed administrator-only IV Prep On-Call launch data.
\t *
\t * The launch target is fixed in server-owned code. Students and anonymous
\t * visitors receive neither the module permission nor the handoff URL.
\t *
\t * @param array $access Matrix access payload.
\t * @param int   $user_id WordPress user ID.
\t * @return array
\t */
\tprivate static function add_ivprep_access_payload( $access, $user_id ) {
\t\tif ( ! is_array( $access ) ) {
\t\t\t$access = array();
\t\t}

\t\t$allowed    = $user_id > 0 && user_can( $user_id, 'manage_options' );
\t\t$launch_url = $allowed ? self::get_ivprep_launch_url() : '';
\t\t$unlocked   = $allowed && '' !== $launch_url;

\t\tif ( ! isset( $access['module_permissions'] ) || ! is_array( $access['module_permissions'] ) ) {
\t\t\t$access['module_permissions'] = array();
\t\t}

\t\t$access['module_permissions']['ivprep'] = $unlocked;
\t\t$access['ivprep'] = array(
\t\t\t'enabled'     => '' !== $launch_url,
\t\t\t'unlocked'    => $unlocked,
\t\t\t'status'      => $unlocked ? 'admin_only' : 'not_authorized',
\t\t\t'reason_code' => $unlocked ? 'ivprep_admin_access' : 'ivprep_admin_required',
\t\t\t'launch_url'  => $unlocked ? $launch_url : '',
\t\t);

\t\treturn $access;
\t}

\tprivate static function get_ivprep_launch_url() {
\t\t$origin   = 'https://missionmed-hq-production.up.railway.app';
\t\t$final    = $origin . '/iv-prep-on-call/';
\t\t$auth_url = $origin . '/api/auth/start';
\t}`;

test('PHP activation grants only administrators or exact course 3893 enrollment', () => {
  const result = transformPhp(phpFixture);
  assert.match(result, /function_exists\( 'learndash_user_get_enrolled_courses' \)/u);
  assert.match(result, /in_array\( 3893, \$enrolled, true \)/u);
  assert.match(result, /\$allowed    = \$is_admin \|\| \$course_entitled;/u);
  assert.match(result, /required_course_id' => 3893/u);
  assert.match(result, /ivprep_entitlement_required/u);
  assert.match(result, /'launch_url'\s+=> \$unlocked \? \$launch_url : ''/u);
  assert.match(result, /\$final\s+= \$origin \. '\/iv-prep-analytics\/'/u);
  assert.doesNotMatch(result, /\$origin \. '\/iv-prep-on-call\/'/u);
  assert.doesNotMatch(result, /\$allowed\s+= \$user_id > 0 && user_can/u);
});

test('PHP transformer rejects missing or repeated protected preimages', () => {
  assert.throws(() => transformPhp(''), /PHP_IVPREP_METHOD_PREIMAGE_MISMATCH:0/u);
  assert.throws(() => transformPhp(`${phpFixture}\n${phpFixture}`), /PHP_IVPREP_METHOD_PREIMAGE_MISMATCH:2/u);
});

test('Matrix presentation unlocks only IV Prep and preserves the server permission check', () => {
  const fixture = [
    '\t\t{ route: "storyforge",    label: "StoryForge",       icon: "SF", section: "MATCH TOOLS",     state: "unlocked" },',
    '\t\t{ route: "ivprep",        label: "IV Prep On-Call",  icon: "IV", section: "COMING / LOCKED", state: "locked" },',
    '\t\t{ route: "messages",      label: "Med Messenger",    icon: "Ms", section: "COMING / LOCKED", state: "locked" },',
    'if (route === "ivprep") return !hasModulePermission("ivprep");',
    'This hosted Founder/Admin surface requires a current administrator session.',
    'IV Prep On-Call is coming. Access will open when the module is released.',
  ].join('\n');
  const result = transformJavascript(fixture);
  assert.match(result, /route: "ivprep"[^\n]+section: "MATCH TOOLS"[^\n]+state: "unlocked"/u);
  assert.match(result, /if \(route === "ivprep"\) return !hasModulePermission\("ivprep"\);/u);
  assert.match(result, /route: "messages"[^\n]+COMING \/ LOCKED[^\n]+state: "locked"/u);
  assert.match(result, /requires current IV Prep On-Call access/u);
  assert.match(result, /requires current access through MissionMed/u);
});

test('runtime pin uses the content-addressed immutable candidate and exact full hash', () => {
  const nextHash = 'a'.repeat(64);
  const nextAsset = `student-os.${nextHash.slice(0, 16)}.js`;
  const fixture = `${PINNED_ASSET_SHA256}\nconst MMED_MATRIX_RUNTIME_PINNED_ASSET = 'student-os.809093d2b5b2bc05.js';`;
  const result = transformRuntimePin(fixture, { assetName: nextAsset, assetSha256: nextHash });
  assert.equal(result, `${nextHash}\nconst MMED_MATRIX_RUNTIME_PINNED_ASSET = '${nextAsset}';`);
});
