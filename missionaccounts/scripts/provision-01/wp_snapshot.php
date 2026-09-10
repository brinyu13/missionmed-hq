<?php

/*PROVISION01_PAYLOAD*/

if (!isset($provision01_payload) || !is_array($provision01_payload)) {
    throw new RuntimeException('provision01_payload_missing');
}
$course_id = (int) ($provision01_payload['course_id'] ?? 0);
if ($course_id !== 6357 || get_post_type($course_id) !== 'sfwd-courses') {
    throw new RuntimeException('provision01_course_mismatch');
}
if (!function_exists('sfwd_lms_has_access') || !function_exists('ld_update_course_access')) {
    throw new RuntimeException('provision01_learndash_api_missing');
}

function provision01_user_row($user, int $course_id): array {
    return [
        'id' => (int) $user->ID,
        'login' => (string) $user->user_login,
        'email' => strtolower((string) $user->user_email),
        'display_name' => (string) $user->display_name,
        'roles' => array_values((array) $user->roles),
        'missionaccounts_student_id' => (string) get_user_meta($user->ID, '_missionmed_missionaccounts_user_id', true),
        'course_access' => (bool) sfwd_lms_has_access($course_id, $user->ID),
    ];
}

$all_users = get_users(['fields' => ['ID', 'user_login', 'user_email', 'display_name']]);
$by_email = [];
$by_link = [];
$by_name = [];
$usernames = [];
foreach ($all_users as $user) {
    $usernames[] = (string) $user->user_login;
    $email = strtolower((string) $user->user_email);
    if ($email !== '') {
        $by_email[$email][] = $user;
    }
    $link = (string) get_user_meta($user->ID, '_missionmed_missionaccounts_user_id', true);
    if ($link !== '') {
        $by_link[strtolower($link)][] = $user;
    }
    $name = strtolower((string) preg_replace('/[^\pL\pN]+/u', '', remove_accents((string) $user->display_name)));
    if ($name !== '') {
        $by_name[$name][] = $user;
    }
}

if (($provision01_payload['mode'] ?? '') === 'snapshot') {
    $out = ['course_id' => $course_id, 'usernames' => $usernames, 'candidates' => []];
    foreach ((array) ($provision01_payload['candidates'] ?? []) as $candidate) {
        $sid = strtolower((string) $candidate['student_id']);
        $email_users = [];
        foreach ((array) ($candidate['emails'] ?? []) as $email) {
            foreach (($by_email[strtolower((string) $email)] ?? []) as $user) {
                $email_users[(int) $user->ID] = $user;
            }
        }
        $name_users = [];
        foreach ((array) ($candidate['normalized_names'] ?? []) as $name) {
            foreach (($by_name[strtolower((string) $name)] ?? []) as $user) {
                $name_users[(int) $user->ID] = $user;
            }
        }
        $out['candidates'][$sid] = [
            'link_matches' => array_values(array_map(fn($u) => provision01_user_row($u, $course_id), $by_link[$sid] ?? [])),
            'email_matches' => array_values(array_map(fn($u) => provision01_user_row($u, $course_id), $email_users)),
            'name_matches' => array_values(array_map(fn($u) => provision01_user_row($u, $course_id), $name_users)),
        ];
    }
    echo wp_json_encode($out, JSON_UNESCAPED_SLASHES);
    return;
}

$mode = (string) ($provision01_payload['mode'] ?? '');
if (!in_array($mode, ['apply-auth', 'apply-entitlements'], true)) {
    throw new RuntimeException('provision01_mode_invalid');
}
add_filter('wp_send_new_user_notification_to_user', '__return_false', 999);
add_filter('wp_send_new_user_notification_to_admin', '__return_false', 999);
add_filter('pre_wp_mail', '__return_false', 999);
$operations = (array) ($provision01_payload['operations'] ?? []);

foreach ($operations as $operation) {
    $sid = strtolower((string) $operation['student_id']);
    $action = (string) $operation['action'];
    if (!preg_match('/^[0-9a-f-]{36}$/', $sid)) {
        throw new RuntimeException('provision01_student_id_invalid');
    }
    if (count($by_link[$sid] ?? []) > 1) {
        throw new RuntimeException('provision01_duplicate_link');
    }
    if ($mode === 'apply-auth' && $action === 'CREATE_WP_LINK_AND_ENROLL') {
        if (get_user_by('email', (string) $operation['email']) || username_exists((string) $operation['proposed_username'])) {
            throw new RuntimeException('provision01_create_preimage_drift');
        }
    } else {
        $uid = (int) ($operation['expected_wp_user_id'] ?? 0);
        $user = get_user_by('id', $uid);
        if (!$user || in_array('administrator', (array) $user->roles, true)) {
            throw new RuntimeException('provision01_existing_user_preimage_drift');
        }
        $current = (string) get_user_meta($uid, '_missionmed_missionaccounts_user_id', true);
        if (($mode === 'apply-auth' && $current !== '' && strtolower($current) !== $sid)
            || ($mode === 'apply-entitlements' && strtolower($current) !== $sid)) {
            throw new RuntimeException('provision01_link_conflict');
        }
    }
}

$result = ['course_id' => $course_id, 'operations' => []];
foreach ($operations as $operation) {
    $sid = strtolower((string) $operation['student_id']);
    $created = false;
    if ($mode === 'apply-auth' && (string) $operation['action'] === 'CREATE_WP_LINK_AND_ENROLL') {
        $uid = wp_insert_user([
            'user_login' => (string) $operation['proposed_username'],
            'user_email' => strtolower((string) $operation['email']),
            'user_pass' => wp_generate_password(32, true, true),
            'display_name' => (string) $operation['display_name'],
            'first_name' => (string) $operation['first'],
            'last_name' => (string) $operation['last'],
            'role' => 'subscriber',
        ]);
        if (is_wp_error($uid)) {
            throw new RuntimeException('provision01_user_create_failed');
        }
        $uid = (int) $uid;
        $created = true;
    } else {
        $uid = (int) $operation['expected_wp_user_id'];
    }
    $current = (string) get_user_meta($uid, '_missionmed_missionaccounts_user_id', true);
    if ($mode === 'apply-auth' && $current === '') {
        update_user_meta($uid, '_missionmed_missionaccounts_user_id', $sid);
    }
    if ($mode === 'apply-entitlements' && !sfwd_lms_has_access($course_id, $uid)) {
        ld_update_course_access($uid, $course_id, false);
    }
    $verified = get_user_by('id', $uid);
    $result['operations'][] = [
        'student_id' => $sid,
        'wp_user_id' => $uid,
        'created' => $created,
        'missionaccounts_link' => (string) get_user_meta($uid, '_missionmed_missionaccounts_user_id', true),
        'course_access' => (bool) sfwd_lms_has_access($course_id, $uid),
        'email' => strtolower((string) $verified->user_email),
        'login' => (string) $verified->user_login,
    ];
}
echo wp_json_encode($result, JSON_UNESCAPED_SLASHES);
