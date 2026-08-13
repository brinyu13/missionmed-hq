<?php
/**
 * Read-only WordPress identity candidate export.
 * Usage: wp eval-file scripts/wp-timeline-identity-export.php -- <wp-user-id> [...]
 */

if (!defined('ABSPATH') || !defined('WP_CLI') || !WP_CLI) {
    fwrite(STDERR, "WP_CLI_REQUIRED\n");
    exit(1);
}

$user_ids = array_values(array_unique(array_filter(array_map('absint', (array) ($args ?? array())))));
if (empty($user_ids)) {
    WP_CLI::error('At least one explicit WordPress user ID is required.');
}

$records = array();
foreach ($user_ids as $user_id) {
    $user = get_user_by('id', $user_id);
    if (!($user instanceof WP_User)) {
        WP_CLI::error('WordPress user does not exist: ' . $user_id);
    }
    $administrator = user_can($user, 'manage_options');
    $course_access = function_exists('sfwd_lms_has_access')
        && sfwd_lms_has_access(3893, $user_id) === true;
    if (!$administrator && !$course_access) {
        WP_CLI::error('WordPress user is not Timeline-eligible: ' . $user_id);
    }
    $existing = strtolower(trim((string) get_user_meta($user_id, '_missionmed_timeline_principal_id', true)));
    if ($existing !== '' && !preg_match('/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/', $existing)) {
        WP_CLI::error('Existing Timeline principal metadata is invalid: ' . $user_id);
    }
    $records[] = array(
        'wp_user_id' => $user_id,
        'timeline_principal_id' => $existing !== '' ? $existing : strtolower(wp_generate_uuid4()),
        'mapping_state' => $existing !== '' ? 'EXISTING' : 'CANDIDATE',
        'role' => $administrator ? 'PROGRAM_ADMIN' : 'STUDENT',
        'is_wordpress_administrator' => $administrator,
        'has_learndash_3893_access' => $course_access,
        'program_ids' => $administrator ? array() : array('missionmed-360:3893'),
    );
}

$payload = array(
    'schema_version' => 'd1-411c-wp-identity-export.1',
    'course_id' => 3893,
    'generated_at' => gmdate('c'),
    'records' => $records,
);
echo wp_json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n";
