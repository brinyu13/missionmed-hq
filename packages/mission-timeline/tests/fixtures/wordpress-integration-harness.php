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
function sanitize_file_name($value) { return basename(trim((string) $value)); }
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
    'canary_wp_user_ids' => array(101, 104, 201),
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
$first_use_student = new WP_User(104, false);
$admin = new WP_User(201, true);
$denied = new WP_User(102, false);
$GLOBALS['mmtl_course_access'][104] = true;
$student_access = mmtl_access_state($student);
$first_use_access = mmtl_eligibility_state($first_use_student);
$admin_access = mmtl_access_state($admin);
$denied_access = mmtl_access_state($denied);
$first_use_principal = mmtl_principal_for_user(104);
$first_use_principal_repeat = mmtl_principal_for_user(104);

$checks = array(
    'student_canary' => !is_wp_error($student_access) && $student_access['role'] === 'STUDENT' && $student_access['remote_sync_consent'] === true,
    'first_use_principal_is_valid' => !is_wp_error($first_use_principal) && mmtl_valid_uuid($first_use_principal),
    'first_use_principal_is_stable' => $first_use_principal === $first_use_principal_repeat,
    'first_use_principal_does_not_write_meta' => get_user_meta(104, MMTL_PRINCIPAL_META, true) === '',
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
$first_use_issued = mmtl_issue_jwt($first_use_student, $first_use_access);
$checks['first_use_jwt_issued'] = !is_wp_error($first_use_issued) && $first_use_issued['principal_id'] === $first_use_principal;
$checks['first_use_jwt_is_local_only'] = !is_wp_error($first_use_issued) && json_decode((string) mmtl_base64url_decode(explode('.', $first_use_issued['token'])[1]), true)['timeline_remote_sync_allowed'] === false;
$changed_access = $student_access;
$changed_access['entitlement_version'] = 'revoked';
$checks['entitlement_change_rejects_token'] = is_wp_error(mmtl_verify_jwt($issued['token'], $issued['principal_id'], 101, $changed_access));

$vault_record = array(
    'id' => '11111111-1111-4111-8111-111111111111',
    'owner_id' => 101,
    'current_version_id' => '22222222-2222-4222-8222-222222222222',
    'document_type' => 'cv',
    'original_filename' => 'CV.pdf',
    'updated_at' => '2026-08-10T12:00:00Z',
    'r2_key' => 'must-not-escape',
    'versions' => array(array(
        'id' => '22222222-2222-4222-8222-222222222222',
        'mime_type' => 'application/pdf',
        'file_size' => 4096,
        'upload_confirmed' => true,
        'r2_key' => 'must-not-escape',
    )),
);
$vault_descriptor = mmtl_filevault_source_descriptor($vault_record, 101, true);
$checks['filevault_source_owner_bound'] = is_array($vault_descriptor)
    && $vault_descriptor['id'] === $vault_record['id']
    && $vault_descriptor['versionId'] === $vault_record['current_version_id'];
$checks['filevault_source_storage_opaque'] = is_array($vault_descriptor)
    && !isset($vault_descriptor['r2_key'])
    && !isset($vault_descriptor['url']);
$checks['filevault_source_cross_owner_denied'] = mmtl_filevault_source_descriptor($vault_record, 102, true) === null;
$checks['filevault_source_smart_fill_ready'] = mmtl_filevault_source_smart_fill_ready($vault_descriptor) === true;
$oversize = $vault_record;
$oversize['versions'][0]['file_size'] = MMTL_FILEVAULT_SMART_FILL_MAX_BYTES + 1;
$checks['filevault_source_oversize_not_listed'] = mmtl_filevault_source_smart_fill_ready(
    mmtl_filevault_source_descriptor($oversize, 101, true)
) === false;
$wrong_type = $vault_record;
$wrong_type['versions'][0]['mime_type'] = 'image/png';
$checks['filevault_source_wrong_type_not_listed'] = mmtl_filevault_source_smart_fill_ready(
    mmtl_filevault_source_descriptor($wrong_type, 101, true)
) === false;
$vault_record['versions'][0]['upload_confirmed'] = false;
$checks['filevault_source_unconfirmed_denied'] = mmtl_filevault_source_descriptor($vault_record, 101, true) === null;
$checks['filevault_source_unconfirmed_not_listed'] = mmtl_filevault_source_smart_fill_ready(
    mmtl_filevault_source_descriptor($vault_record, 101, true)
) === false;

$pass = !in_array(false, $checks, true);
echo json_encode(array('pass' => $pass, 'checks' => $checks)) . "\n";
exit($pass ? 0 : 1);
