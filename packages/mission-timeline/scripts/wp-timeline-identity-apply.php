<?php
/**
 * Apply a post-database WordPress identity plan.
 * Usage: wp eval-file scripts/wp-timeline-identity-apply.php -- <plan.json> <expected-sha256>
 */

if (!defined('ABSPATH') || !defined('WP_CLI') || !WP_CLI) {
    fwrite(STDERR, "WP_CLI_REQUIRED\n");
    exit(1);
}

$plan_path = (string) (($args ?? array())[0] ?? '');
$expected_sha256 = strtolower((string) (($args ?? array())[1] ?? ''));
if ($plan_path === '' || !preg_match('/^[a-f0-9]{64}$/', $expected_sha256) || !is_readable($plan_path)) {
    WP_CLI::error('A readable plan path and exact SHA-256 are required.');
}
$bytes = file_get_contents($plan_path);
if (!hash_equals($expected_sha256, hash('sha256', $bytes))) {
    WP_CLI::error('Identity plan SHA-256 does not match.');
}
$plan = json_decode($bytes, true);
if (!is_array($plan) || ($plan['schema_version'] ?? '') !== 'd1-411c-wp-meta-plan.1' || empty($plan['database_applied'])) {
    WP_CLI::error('Identity plan is not an applied D1-411C database receipt.');
}

$assignments = array();
foreach ((array) ($plan['records'] ?? array()) as $record) {
    $user_id = absint($record['wp_user_id'] ?? 0);
    $principal_id = strtolower(trim((string) ($record['timeline_principal_id'] ?? '')));
    $user = get_user_by('id', $user_id);
    $eligible = $user instanceof WP_User && (
        user_can($user, 'manage_options')
        || (function_exists('sfwd_lms_has_access') && sfwd_lms_has_access(3893, $user_id) === true)
    );
    $existing = strtolower(trim((string) get_user_meta($user_id, '_missionmed_timeline_principal_id', true)));
    if (!$eligible || !preg_match('/^[a-f0-9-]{36}$/', $principal_id) || ($existing !== '' && !hash_equals($principal_id, $existing))) {
        WP_CLI::error('Identity plan conflicts with current WordPress state for user ' . $user_id . '.');
    }
    if ($existing === '') {
        $assignments[] = array($user_id, $principal_id);
    }
}

$applied = array();
foreach ($assignments as $assignment) {
    list($user_id, $principal_id) = $assignment;
    if (!add_user_meta($user_id, '_missionmed_timeline_principal_id', $principal_id, true)) {
        foreach ($applied as $prior) {
            delete_user_meta($prior[0], '_missionmed_timeline_principal_id', $prior[1]);
        }
        WP_CLI::error('Identity metadata apply failed and newly written metadata was rolled back.');
    }
    $applied[] = $assignment;
}

foreach ((array) ($plan['records'] ?? array()) as $record) {
    $actual = strtolower(trim((string) get_user_meta(absint($record['wp_user_id']), '_missionmed_timeline_principal_id', true)));
    if (!hash_equals((string) $record['timeline_principal_id'], $actual)) {
        WP_CLI::error('Identity metadata verification failed.');
    }
}
echo wp_json_encode(array(
    'schema_version' => 'd1-411c-wp-meta-apply-receipt.1',
    'plan_sha256' => $expected_sha256,
    'assigned' => count($applied),
    'verified' => count((array) ($plan['records'] ?? array())),
), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . "\n";
