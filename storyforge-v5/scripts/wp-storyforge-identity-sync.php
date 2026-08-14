<?php
/**
 * Operator-only WordPress side of the StoryForge identity synchronizer.
 *
 * Run through WP-CLI so WordPress and the existing MissionMed entitlement
 * authority are loaded. This file does not create users or alter profiles,
 * roles, enrollment, or application data.
 *
 *   wp eval-file wp-storyforge-identity-sync.php export /private/snapshot.json
 *   wp eval-file wp-storyforge-identity-sync.php apply /private/plan.json
 *   wp eval-file wp-storyforge-identity-sync.php verify /private/plan.json
 */

if (!defined('ABSPATH') || !defined('WP_CLI')) {
    fwrite(STDERR, "This command must run through WP-CLI.\n");
    exit(2);
}

if (!function_exists('mmsf_entitlement_for_user') || !function_exists('mmsf_native_role_for_user')) {
    WP_CLI::error('The MissionMed StoryForge SSO plugin is not loaded.');
}

$command_args = isset($args) && is_array($args) ? array_values($args) : array();
$action = sanitize_key((string) ($command_args[0] ?? ''));
$path = (string) ($command_args[1] ?? '');
$uuid_meta_key = '_missionmed_storyforge_user_id';
$uuid_pattern = '/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/';

if (!in_array($action, array('export', 'apply', 'verify'), true) || $path === '') {
    WP_CLI::error('Usage: export|apply|verify /absolute/private/file.json');
}
if ($path[0] !== '/') {
    WP_CLI::error('The receipt path must be absolute.');
}

$is_current_student = static function ($user) {
    if (!($user instanceof WP_User) || !$user->exists()) {
        return array(false, array('status' => 'invalid_account', 'source' => 'wordpress'));
    }
    if (mmsf_native_role_for_user($user) !== 'student') {
        return array(false, array('status' => 'non_student', 'source' => 'wordpress'));
    }
    $entitlement = mmsf_entitlement_for_user($user);
    $eligible = is_array($entitlement)
        && !empty($entitlement['trusted'])
        && !empty($entitlement['verified'])
        && !empty($entitlement['active']);
    return array($eligible, is_array($entitlement) ? $entitlement : array());
};

$write_private_json = static function ($target, $value) {
    $directory = dirname($target);
    if (!is_dir($directory) || !is_writable($directory)) {
        WP_CLI::error('The private receipt directory is unavailable.');
    }
    $encoded = wp_json_encode($value, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    if (!is_string($encoded) || file_put_contents($target, $encoded . "\n", LOCK_EX) === false) {
        WP_CLI::error('Unable to write the private receipt.');
    }
    if (!chmod($target, 0600)) {
        WP_CLI::error('Unable to enforce private receipt mode 0600.');
    }
};

if ($action === 'export') {
    $generated_at = gmdate('c');
    $generation_id = strtolower((string) wp_generate_uuid4());
    if (!preg_match($uuid_pattern, $generation_id)) {
        WP_CLI::error('WordPress could not generate a population snapshot identifier.');
    }
    $rows = array();
    $eligible_count = 0;
    $users = get_users(array('fields' => 'all'));
    $user_states = array();
    $eligible_ids = array();
    foreach ($users as $user) {
        $state = $is_current_student($user);
        $user_states[(int) $user->ID] = $state;
        if (!empty($state[0])) {
            $eligible_ids[] = (int) $user->ID;
        }
    }
    $avatar_authority_available = function_exists('mmsf_arena_avatar_projections')
        && class_exists('MMED_Supabase_Bridge')
        && MMED_Supabase_Bridge::configured();
    $avatar_projections = $avatar_authority_available
        ? mmsf_arena_avatar_projections($eligible_ids)
        : array();
    foreach ($users as $user) {
        list($eligible, $entitlement) = $user_states[(int) $user->ID];
        if ($eligible) {
            $eligible_count++;
        }
        $arena_avatar = is_array($avatar_projections[(int) $user->ID] ?? null)
            ? $avatar_projections[(int) $user->ID]
            : null;
        $rows[] = array(
            'wp_user_id' => (int) $user->ID,
            'username' => (string) $user->user_login,
            'email' => (string) $user->user_email,
            'display_name' => (string) $user->display_name,
            'first_name' => (string) get_user_meta((int) $user->ID, 'first_name', true),
            'native_role' => (string) mmsf_native_role_for_user($user),
            'storyforge_uuid_raw' => strtolower(trim((string) get_user_meta(
                (int) $user->ID,
                $uuid_meta_key,
                true
            ))),
            'eligible' => (bool) $eligible,
            'arena_avatar' => $arena_avatar,
            'entitlement' => array(
                'trusted' => !empty($entitlement['trusted']),
                'verified' => !empty($entitlement['verified']),
                'active' => !empty($entitlement['active']),
                'status' => sanitize_key((string) ($entitlement['status'] ?? 'unknown')),
                'source' => sanitize_key((string) ($entitlement['source'] ?? 'unknown')),
            ),
        );
    }
    $snapshot = array(
        'version' => 1,
        'generated_at' => $generated_at,
        'authority' => 'mmhq_cam_build_entitlement',
        'course_id' => 3893,
        'population_authority' => array(
            'key' => 'match_mentorship_360',
            'authority' => 'mmhq_cam_build_entitlement',
            'course_id' => 3893,
            'generation_id' => $generation_id,
            'complete' => true,
            'observed_at' => $generated_at,
        ),
        'avatar_authority' => array(
            'source' => 'arena_lobby',
            'available' => $avatar_authority_available,
            'storage' => 'r2_cdn',
        ),
        'users' => $rows,
    );
    $write_private_json($path, $snapshot);
    WP_CLI::log(wp_json_encode(array(
        'ok' => true,
        'users_scanned' => count($rows),
        'eligible_students' => $eligible_count,
        'receipt_mode' => substr(sprintf('%o', fileperms($path)), -4),
    )));
    exit(0);
}

$plan = json_decode((string) file_get_contents($path), true);
if (!is_array($plan) || (int) ($plan['version'] ?? 0) !== 1 || !is_array($plan['entries'] ?? null)) {
    WP_CLI::error('The identity plan is invalid.');
}
if (
    (string) ($plan['authority'] ?? '') !== 'mmhq_cam_build_entitlement'
    || (int) ($plan['course_id'] ?? 0) !== 3893
    || (string) ($plan['population_authority']['key'] ?? '') !== 'match_mentorship_360'
    || (string) ($plan['population_authority']['authority'] ?? '') !== 'mmhq_cam_build_entitlement'
    || (int) ($plan['population_authority']['course_id'] ?? 0) !== 3893
    || empty($plan['population_authority']['complete'])
    || !preg_match(
        $uuid_pattern,
        strtolower((string) ($plan['population_authority']['generation_id'] ?? ''))
    )
    || substr(sprintf('%o', fileperms($path)), -4) !== '0600'
) {
    WP_CLI::error('The identity plan authority or private file mode is invalid.');
}
if (!empty($plan['summary']['blocking_conflicts'])) {
    WP_CLI::error('The identity plan contains blocking conflicts.');
}

$checked = 0;
$written = 0;
foreach ($plan['entries'] as $entry) {
    $verify_entry = $action === 'verify' && !empty($entry['eligible']);
    if (empty($entry['apply_wordpress']) && !$verify_entry) {
        continue;
    }
    $wp_user_id = absint($entry['wp_user_id'] ?? 0);
    $target_uuid = strtolower(trim((string) ($entry['storyforge_uuid'] ?? '')));
    $expected_username = (string) ($entry['username'] ?? '');
    if ($wp_user_id < 1 || !preg_match($uuid_pattern, $target_uuid) || $expected_username === '') {
        WP_CLI::error('The identity plan contains an invalid WordPress action.');
    }
    if (
        $action === 'apply'
        && !in_array((string) ($entry['status'] ?? ''), array('NEEDS_BOTH', 'NEEDS_WORDPRESS_UUID_ONLY'), true)
    ) {
        WP_CLI::error('The identity plan contains an unauthorized WordPress action.');
    }
    $user = get_user_by('id', $wp_user_id);
    list($eligible) = $is_current_student($user);
    if (!$eligible || !hash_equals($expected_username, (string) $user->user_login)) {
        WP_CLI::error('A planned account no longer matches its current entitled identity.');
    }
    $current = strtolower(trim((string) get_user_meta($wp_user_id, $uuid_meta_key, true)));
    if ($current !== '' && !hash_equals($target_uuid, $current)) {
        WP_CLI::error('A planned WordPress UUID conflicts with current metadata.');
    }
    $owners = array_map('absint', get_users(array(
        'meta_key' => $uuid_meta_key,
        'meta_value' => $target_uuid,
        'fields' => 'ids',
    )));
    if (array_diff($owners, array($wp_user_id))) {
        WP_CLI::error('A planned UUID is already owned by another WordPress account.');
    }
    if ($action === 'apply' && $current === '') {
        if (update_user_meta($wp_user_id, $uuid_meta_key, $target_uuid) === false) {
            WP_CLI::error('WordPress rejected an identity metadata write.');
        }
        $written++;
    }
    $verified = strtolower(trim((string) get_user_meta($wp_user_id, $uuid_meta_key, true)));
    if ($action === 'apply' && !hash_equals($target_uuid, $verified)) {
        WP_CLI::error('WordPress identity metadata verification failed.');
    }
    if ($action === 'verify' && !hash_equals($target_uuid, $current)) {
        WP_CLI::error('WordPress identity metadata verification failed.');
    }
    $checked++;
}

WP_CLI::log(wp_json_encode(array(
    'ok' => true,
    'action' => $action,
    'checked' => $checked,
    'written' => $written,
)));
