<?php
/*PROVISION03_PAYLOAD*/
if (!isset($provision03_payload) || !is_array($provision03_payload) || ((int) ($provision03_payload['course_id'] ?? 0)) !== 6357) {
    throw new RuntimeException('p03_payload_invalid');
}
$course_id = 6357;
if (get_post_type($course_id) !== 'sfwd-courses' || !function_exists('sfwd_lms_has_access') || !function_exists('ld_update_course_access')) {
    throw new RuntimeException('p03_course_or_api_invalid');
}
$mode = (string) ($provision03_payload['mode'] ?? '');
if (!in_array($mode, ['apply-auth', 'apply-entitlement'], true)) {
    throw new RuntimeException('p03_mode_invalid');
}
$operations = (array) ($provision03_payload['operations'] ?? []);
add_filter('wp_send_new_user_notification_to_user', '__return_false', 999);
add_filter('wp_send_new_user_notification_to_admin', '__return_false', 999);
add_filter('pre_wp_mail', '__return_false', 999);

foreach ($operations as $operation) {
    $student_id = strtolower((string) ($operation['student_id'] ?? ''));
    if (!preg_match('/^[0-9a-f-]{36}$/', $student_id)) {
        throw new RuntimeException('p03_student_id_invalid');
    }
    $allowed = array_map('strtolower', array_map('strval', (array) ($operation['allowed_current_links'] ?? [])));
    if (!in_array($student_id, $allowed, true)) {
        $allowed[] = $student_id;
    }
    $linked = get_users(['meta_key' => '_missionmed_missionaccounts_user_id', 'meta_value' => $student_id, 'fields' => ['ID']]);
    if (count($linked) > 1) {
        throw new RuntimeException('p03_duplicate_canonical_link');
    }
    $action = (string) ($operation['action'] ?? '');
    if ($mode === 'apply-auth' && $action === 'CREATE_WP_LINK_AND_ENROLL') {
        if (get_user_by('email', (string) $operation['email']) || username_exists((string) $operation['proposed_username'])) {
            throw new RuntimeException('p03_create_preimage_drift');
        }
    } else {
        $user_id = (int) ($operation['expected_wp_user_id'] ?? 0);
        $user = get_user_by('id', $user_id);
        if (!$user || in_array('administrator', (array) $user->roles, true)) {
            throw new RuntimeException('p03_existing_user_preimage_drift');
        }
        $current = strtolower((string) get_user_meta($user_id, '_missionmed_missionaccounts_user_id', true));
        if (($mode === 'apply-auth' && $current !== '' && !in_array($current, $allowed, true)) || ($mode === 'apply-entitlement' && $current !== $student_id)) {
            throw new RuntimeException('p03_link_conflict');
        }
    }
}

$result = ['course_id' => $course_id, 'mode' => $mode, 'operations' => []];
foreach ($operations as $operation) {
    $student_id = strtolower((string) $operation['student_id']);
    $created = false;
    if ($mode === 'apply-auth' && (string) $operation['action'] === 'CREATE_WP_LINK_AND_ENROLL') {
        $user_id = wp_insert_user([
            'user_login' => (string) $operation['proposed_username'],
            'user_email' => strtolower((string) $operation['email']),
            'user_pass' => wp_generate_password(32, true, true),
            'display_name' => (string) $operation['display_name'],
            'first_name' => (string) $operation['first'],
            'last_name' => (string) $operation['last'],
            'role' => 'subscriber',
        ]);
        if (is_wp_error($user_id)) {
            throw new RuntimeException('p03_user_create_failed');
        }
        $user_id = (int) $user_id;
        $created = true;
    } else {
        $user_id = (int) $operation['expected_wp_user_id'];
    }
    if ($mode === 'apply-auth' && strtolower((string) get_user_meta($user_id, '_missionmed_missionaccounts_user_id', true)) !== $student_id) {
        update_user_meta($user_id, '_missionmed_missionaccounts_user_id', $student_id);
    }
    if ($mode === 'apply-entitlement' && !sfwd_lms_has_access($course_id, $user_id)) {
        ld_update_course_access($user_id, $course_id, false);
    }
    $verified = get_user_by('id', $user_id);
    $result['operations'][] = [
        'student_id' => $student_id,
        'wp_user_id' => $user_id,
        'created' => $created,
        'missionaccounts_link' => (string) get_user_meta($user_id, '_missionmed_missionaccounts_user_id', true),
        'course_access' => (bool) sfwd_lms_has_access($course_id, $user_id),
        'email' => strtolower((string) $verified->user_email),
        'login' => (string) $verified->user_login,
    ];
}
echo wp_json_encode($result, JSON_UNESCAPED_SLASHES);
