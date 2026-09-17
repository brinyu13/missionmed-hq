<?php
define('ABSPATH', __DIR__);

$GLOBALS['mmtl_options'] = array();
$GLOBALS['mmtl_user_meta'] = array();
$GLOBALS['mmtl_course_access'] = array();

class WP_User {
    public $ID;
    public $administrator;
    public function __construct($id, $administrator = false) { $this->ID = $id; $this->administrator = $administrator; }
    public function exists() { return $this->ID > 0; }
}
class WP_Error {
    private $code;
    private $message;
    private $data;
    public function __construct($code, $message, $data = array()) { $this->code = $code; $this->message = $message; $this->data = $data; }
    public function get_error_code() { return $this->code; }
    public function get_error_message() { return $this->message; }
    public function get_error_data() { return $this->data; }
}
class WP_REST_Response {}
class WP_REST_Server { const CREATABLE = 'POST'; }

function add_action() {}
function add_filter() {}
function register_activation_hook() {}
function register_deactivation_hook() {}
function home_url($path = '/') { return 'https://missionmed.example' . $path; }
function get_option($key, $default = false) { return $GLOBALS['mmtl_options'][$key] ?? $default; }
function get_user_meta($id, $key) { return $GLOBALS['mmtl_user_meta'][$id][$key] ?? ''; }
function update_user_meta($id, $key, $value) { $GLOBALS['mmtl_user_meta'][$id][$key] = $value; return true; }
function delete_user_meta($id, $key, $value = null) {
    if ($value !== null && (($GLOBALS['mmtl_user_meta'][$id][$key] ?? null) !== $value)) return false;
    unset($GLOBALS['mmtl_user_meta'][$id][$key]);
    return true;
}
function wp_parse_args($args, $defaults) { return array_merge($defaults, $args); }
function absint($value) { return abs((int) $value); }
function sanitize_key($value) { return preg_replace('/[^a-z0-9_-]/', '', strtolower((string) $value)); }
function sanitize_text_field($value) { return trim((string) $value); }
function esc_url_raw($value) { return (string) $value; }
function untrailingslashit($value) { return rtrim((string) $value, '/'); }
function apply_filters($name, $value) { return $value; }
function user_can($user, $capability) { return $capability === 'manage_options' && $user->administrator; }
function sfwd_lms_has_access($course_id, $user_id) { return $course_id === 3893 && !empty($GLOBALS['mmtl_course_access'][$user_id]); }
function is_wp_error($value) { return $value instanceof WP_Error; }
function wp_generate_uuid4() { return '9d8d7a7a-c915-4d36-a657-910ad2221002'; }
function wp_json_encode($value) { return json_encode($value); }

require dirname(__DIR__, 4) . '/wp-content/plugins/missionmed-timeline-sso/missionmed-timeline-sso.php';

$GLOBALS['mmtl_options'][MMTL_OPTION] = array(
    'timeline_enabled' => true,
    'rollout_stage' => 'canary',
    'canary_wp_user_ids' => array(101, 201),
    'eligibility_verified' => true,
    'entitlement_version' => 'course-3893-live-1',
    'consent_version' => 'd1-500-v1',
    'active_key_id' => 'timeline-v1',
);
$GLOBALS['mmtl_course_access'][101] = true;
$GLOBALS['mmtl_user_meta'][101] = array(
    MMTL_PRINCIPAL_META => '9d8d7a7a-c915-4d36-a657-910ad2221001',
    MMTL_CONSENT_META => 'd1-500-v1',
    MMTL_CONSENT_AT_META => '2026-08-04T12:00:00Z',
);
$GLOBALS['mmtl_user_meta'][201] = array(
    MMTL_PRINCIPAL_META => '9d8d7a7a-c915-4d36-a657-910ad2221003',
);

$student = new WP_User(101, false);
$admin = new WP_User(201, true);
$denied = new WP_User(102, false);
$student_access = mmtl_access_state($student);
$admin_access = mmtl_access_state($admin);
$denied_access = mmtl_access_state($denied);

$checks = array(
    'student_canary' => !is_wp_error($student_access) && $student_access['role'] === 'STUDENT' && $student_access['remote_sync_consent'] === true,
    'admin_canary' => !is_wp_error($admin_access) && $admin_access['role'] === 'PROGRAM_ADMIN' && $admin_access['remote_sync_consent'] === false && $admin_access['remote_sync_allowed'] === true,
    'nonallowlisted_denied' => is_wp_error($denied_access) && $denied_access->get_error_code() === 'canary_access_required',
);

$saved_consent = $GLOBALS['mmtl_user_meta'][101][MMTL_CONSENT_META];
$GLOBALS['mmtl_user_meta'][101][MMTL_CONSENT_META] = '';
$consent_denied = mmtl_access_state($student);
$checks['consent_denied'] = is_wp_error($consent_denied) && $consent_denied->get_error_code() === 'remote_sync_consent_required';
$GLOBALS['mmtl_user_meta'][101][MMTL_CONSENT_META] = $saved_consent;

$GLOBALS['mmtl_user_meta'][103] = array(MMTL_PRINCIPAL_META => '9d8d7a7a-c915-4d36-a657-910ad2221004');
$GLOBALS['mmtl_course_access'][103] = true;
$recorded = mmtl_record_remote_sync_consent(103);
$checks['consent_recorded'] = !is_wp_error($recorded) && $recorded['granted'] === true && $recorded['version'] === 'd1-500-v1';
$checks['consent_withdrawn'] = mmtl_withdraw_remote_sync_consent(103) === true && is_wp_error(mmtl_access_state(new WP_User(103, false)));

putenv('MISSIONMED_TIMELINE_JWT_SECRET=local-integration-secret-at-least-32-bytes');
$issued = mmtl_issue_jwt($student, $student_access);
$verified = mmtl_verify_jwt($issued['token'], $issued['principal_id'], 101, $student_access);
$checks['jwt_round_trip'] = is_array($verified) && $verified['timeline_role'] === 'STUDENT' && $verified['timeline_remote_sync_consent'] === true;
$checks['jwt_remote_sync_allowed'] = is_array($verified) && $verified['timeline_remote_sync_allowed'] === true;
$changed_access = $student_access;
$changed_access['entitlement_version'] = 'revoked';
$checks['entitlement_change_rejects_token'] = is_wp_error(mmtl_verify_jwt($issued['token'], $issued['principal_id'], 101, $changed_access));

$pass = !in_array(false, $checks, true);
echo json_encode(array('pass' => $pass, 'checks' => $checks)) . "\n";
exit($pass ? 0 : 1);
