import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const packageDir = fileURLToPath(new URL('../..', import.meta.url));
const pluginFile = fileURLToPath(new URL(
  '../../../wp-content/plugins/missionmed-storyforge-sso/missionmed-storyforge-sso.php',
  import.meta.url,
));
const launchFile = fileURLToPath(new URL(
  '../../../wp-content/plugins/missionmed-storyforge-sso/assets/matrix-launch.js',
  import.meta.url,
));

test('StoryForge admits trusted active 360 students without broadening admin or mentor access', () => {
  const harness = String.raw`<?php
define('ABSPATH', __DIR__);
class WP_User {
    public $ID;
    public $roles;
    public $caps;
    public $display_name;
    public $first_name;
    public $user_login;
    public function __construct($id, $roles = array(), $caps = array()) {
        $this->ID = $id;
        $this->roles = $roles;
        $this->caps = $caps;
        $this->display_name = 'Fixture ' . $id;
        $this->first_name = 'Fixture';
        $this->user_login = 'fixture' . $id;
    }
    public function exists() { return $this->ID > 0; }
}
class WP_Error {
    private $code;
    private $message;
    private $data;
    public function __construct($code, $message, $data = array()) {
        $this->code = $code;
        $this->message = $message;
        $this->data = $data;
    }
    public function get_error_code() { return $this->code; }
    public function get_error_message() { return $this->message; }
    public function get_error_data() { return $this->data; }
}
function register_activation_hook() {}
function register_deactivation_hook() {}
function add_action() {}
function add_filter() {}
function add_shortcode() {}
function wp_parse_args($args, $defaults) { return array_merge($defaults, $args); }
function sanitize_key($value) { return strtolower(preg_replace('/[^a-z0-9_\-]/', '', (string) $value)); }
function absint($value) { return abs((int) $value); }
function sanitize_text_field($value) { return trim((string) $value); }
function apply_filters($tag, $value) { return $value; }
function wp_get_environment_type() { return 'production'; }
function get_option($name, $default = array()) { return $GLOBALS['settings'] ?? $default; }
function update_option() {}
function delete_option() {}
function delete_transient() {}
function user_can($user, $capability) { return !empty($user->caps[$capability]); }
function get_user_meta($user_id, $key) { return $GLOBALS['meta'][$user_id][$key] ?? ''; }
function home_url($path = '/') { return 'https://missionmed.test' . $path; }
function wp_parse_url($url, $component = -1) { return parse_url($url, $component); }
function mmhq_cam_build_entitlement($user_id) { return $GLOBALS['entitlements'][$user_id] ?? null; }
require $argv[1];

$GLOBALS['settings'] = array(
    'storyforge_enabled' => true,
    'allowed_user_ids' => array(1, 107),
    'app_role_overrides' => array(1 => 'student', 107 => 'admin'),
    'allowed_roles' => array('student', 'admin'),
    'allowed_cohorts' => array('obsolete-pilot-cohort'),
);
$GLOBALS['entitlements'] = array(
    201 => array('trusted' => true, 'verified' => true, 'active' => true, 'status' => 'active', 'source' => 'wordpress_learndash_handoff'),
    202 => array('trusted' => true, 'verified' => true, 'active' => false, 'status' => 'not_eligible', 'source' => 'wordpress_learndash_handoff'),
    203 => array('trusted' => true, 'verified' => true, 'active' => false, 'status' => 'revoked', 'source' => 'wordpress_learndash_handoff'),
    204 => array('trusted' => false, 'verified' => false, 'active' => false, 'status' => 'source_unavailable', 'source' => 'none'),
);

function result_for($user) {
    $result = mmsf_access_state($user);
    if ($result instanceof WP_Error) {
        return array('ok' => false, 'code' => $result->get_error_code());
    }
    return array(
        'ok' => true,
        'role' => $result['role'],
        'source' => $result['entitlement']['source'],
    );
}

$student = new WP_User(201, array('subscriber'));
$notEligible = new WP_User(202, array('subscriber'));
$revoked = new WP_User(203, array('subscriber'));
$unverified = new WP_User(204, array('subscriber'));
$unlistedAdmin = new WP_User(205, array('administrator'), array('manage_options' => true));
$unlistedMentor = new WP_User(206, array('mentor'));
$founder = new WP_User(1, array('administrator'), array('manage_options' => true));
$admin = new WP_User(107, array('administrator'), array('manage_options' => true));

// The live pilot has no cohort restriction. Keep that exact state for its two accounts.
$studentResult = result_for($student);
$notEligibleResult = result_for($notEligible);
$revokedResult = result_for($revoked);
$unverifiedResult = result_for($unverified);
$unlistedAdminResult = result_for($unlistedAdmin);
$unlistedMentorResult = result_for($unlistedMentor);
$GLOBALS['settings']['allowed_cohorts'] = array();
$founderResult = result_for($founder);
$adminResult = result_for($admin);

echo json_encode(compact(
    'studentResult',
    'notEligibleResult',
    'revokedResult',
    'unverifiedResult',
    'unlistedAdminResult',
    'unlistedMentorResult',
    'founderResult',
    'adminResult'
));
`;
  const result = spawnSync(
    process.env.STORYFORGE_TEST_PHP || 'php',
    ['-r', harness.replace(/^<\?php\n/, ''), pluginFile],
    { encoding: 'utf8' },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), {
    studentResult: {
      ok: true,
      role: 'student',
      source: 'wordpress_learndash_handoff',
    },
    notEligibleResult: { ok: false, code: 'eligibility_required' },
    revokedResult: { ok: false, code: 'eligibility_revoked' },
    unverifiedResult: { ok: false, code: 'eligibility_required' },
    unlistedAdminResult: { ok: false, code: 'user_not_enabled' },
    unlistedMentorResult: { ok: false, code: 'user_not_enabled' },
    founderResult: {
      ok: true,
      role: 'student',
      source: 'wordpress_exact_user_pilot_override',
    },
    adminResult: {
      ok: true,
      role: 'admin',
      source: 'wordpress_admin_capability',
    },
  });
});

test('Matrix direct-hash launch replaces the legacy route before DOM readiness', async () => {
  const source = await readFile(launchFile, 'utf8');
  const calls = [];
  class Element {}
  runInNewContext(source, {
    URL,
    Element,
    window: {
      MissionMedStoryForgeLaunch: {
        target: 'https://missionmed.test/storyforge/',
        matrixPath: '/member-dashboard/',
      },
      location: {
        origin: 'https://missionmed.test',
        pathname: '/member-dashboard/',
        hash: '#storyforge',
        replace(value) { calls.push(['replace', value]); },
        assign(value) { calls.push(['assign', value]); },
      },
      addEventListener() {},
    },
    document: {
      readyState: 'loading',
      addEventListener() {},
    },
  });
  assert.deepEqual(calls, [['replace', 'https://missionmed.test/storyforge/']]);
  assert.doesNotMatch(source, /DOMContentLoaded/);
});

test('the routing hotfix does not carry legacy demo or voice-scope behavior', async () => {
  const [plugin, launch] = await Promise.all([
    readFile(pluginFile, 'utf8'),
    readFile(launchFile, 'utf8'),
  ]);
  assert.match(plugin, /mmhq_cam_build_entitlement/);
  assert.match(plugin, /plugins_url\('assets\/matrix-launch\.js'/);
  assert.doesNotMatch(`${plugin}\n${launch}`, /Bootstrap demo|Static sample data\. Not persistent yet\./);
  assert.doesNotMatch(`${plugin}\n${launch}`, /voice_capture|STORYFORGE_VOICE|sf_feature_flags/);
  assert.equal(path.basename(packageDir), 'storyforge-v5');
});

test('the signed bootstrap carries native WordPress administrator authority independently of the ownership role', async () => {
  const plugin = await readFile(pluginFile, 'utf8');
  assert.match(plugin, /'app_role'\s*=>\s*\(string\) \$access\['role'\]/);
  assert.match(plugin, /'wordpress_admin'\s*=>\s*user_can\(\$user, 'manage_options'\)/);
});
