<?php
/** Dormant native synthetic-user provisioner. Passwords arrive only over stdin. */
function tl022_canary_require($condition, $code) {
    if (!$condition) { throw new RuntimeException($code); }
}
function tl022_canary_context() {
    $root = '/www/theresidencyacademy_209/public';
    $settings = get_option('missionmed_timeline_settings', []);
    return ['home' => untrailingslashit(home_url()), 'course_type' => get_post_type(3893),
        'plugin_sha256' => hash_file('sha256', $root . '/wp-content/plugins/missionmed-timeline-sso/missionmed-timeline-sso.php'),
        'pointer' => readlink($root . '/wp-content/mu-plugins/missionmed-timeline-runtime/current'),
        'settings_sha256' => hash('sha256', json_encode($settings, JSON_UNESCAPED_SLASHES)),
        'admission_off' => array_key_exists('timeline_enabled', $settings) && empty($settings['timeline_enabled']) && ($settings['rollout_stage'] ?? '') === 'off'];
}
function tl022_canary_snapshot($exclude = []) {
    global $wpdb;
    $ids = array_map('intval', $exclude);
    $userWhere = $ids ? ' WHERE ID NOT IN (' . implode(',', $ids) . ')' : '';
    // Deliberately omit password hashes, activation keys and session-token metadata.
    $users = $wpdb->get_results("SELECT ID,user_login,user_email,display_name FROM {$wpdb->users}{$userWhere} ORDER BY ID", ARRAY_A);
    $keys = ['_missionmed_timeline_synthetic_test','_missionmed_timeline_principal_id',
        '_missionmed_timeline_remote_sync_consent','_missionmed_timeline_remote_sync_consented_at',
        'course_3893_access_from','course_3893_access_expires',$wpdb->prefix . 'capabilities',$wpdb->prefix . 'user_level'];
    $query = "SELECT user_id,meta_key,meta_value FROM {$wpdb->usermeta} WHERE meta_key IN (" . implode(',', array_fill(0, count($keys), '%s')) . ')';
    if ($ids) { $query .= ' AND user_id NOT IN (' . implode(',', $ids) . ')'; }
    $query .= ' ORDER BY user_id,meta_key,umeta_id';
    $meta = $wpdb->get_results($wpdb->prepare($query, ...$keys), ARRAY_A);
    tl022_canary_require(is_array($users) && is_array($meta), 'PREEXISTING_SNAPSHOT_FAILED');
    return ['ids' => array_map(static fn($row) => (int)$row['ID'], $users),
        'sha256' => hash('sha256', json_encode([$users, $meta], JSON_UNESCAPED_SLASHES))];
}
function tl022_canary_run($plan, $passwords, $execute = false) {
    tl022_canary_require(($plan['schema_version'] ?? '') === 'd1-022-native-synthetic-canary.1'
        && ($plan['authority_sha256'] ?? '') === 'e27016edef2f722f1424a16d7246e5e1851d266b7825d832f7bbf62e84ec147c', 'AUTHORITY_DENIED');
    tl022_canary_require(preg_match('/^022-[a-f0-9]{16}$/D', $plan['run_id'] ?? ''), 'RUN_ID_DENIED');
    tl022_canary_require(array_keys($passwords) === ['a','b'], 'EXACT_TWO_PASSWORD_INPUTS_REQUIRED');
    foreach ($passwords as $value) { tl022_canary_require(is_string($value) && preg_match('/^[A-Za-z0-9_-]{64}$/D', $value), 'PRIVATE_PASSWORD_INPUT_DENIED'); }
    tl022_canary_require($passwords['a'] !== $passwords['b'], 'DISTINCT_PASSWORDS_REQUIRED');
    foreach (['wp_insert_user','learndash_update_course_access','sfwd_lms_has_access','mmtl_derived_principal_for_user'] as $function) {
        tl022_canary_require(function_exists($function), 'NATIVE_FUNCTION_REQUIRED');
    }
    $context = tl022_canary_context();
    tl022_canary_require($context['home'] === 'https://missionmedinstitute.com' && $context['course_type'] === 'sfwd-courses', 'SITE_OR_COURSE_IDENTITY_DENIED');
    foreach (['plugin_sha256','pointer','settings_sha256'] as $key) {
        tl022_canary_require(is_string($plan['expected_' . $key] ?? null) && $context[$key] === $plan['expected_' . $key], 'BASELINE_IDENTITY_CHANGED');
    }
    tl022_canary_require($context['admission_off'], 'ADMISSION_MUST_BE_OFF');
    $before = tl022_canary_snapshot();
    $accounts = [];
    foreach (['a','b'] as $suffix) {
        $login = 'timeline022synthetic_' . substr($plan['run_id'], 4) . '_' . $suffix;
        $email = $login . '@example.invalid';
        tl022_canary_require(!username_exists($login) && !email_exists($email), 'SYNTHETIC_IDENTITY_EXISTS_RECONCILE');
        $accounts[$suffix] = ['user_login' => $login, 'user_email' => $email,
            'display_name' => 'Timeline 022 Synthetic Student ' . strtoupper($suffix),
            'first_name' => 'Timeline 022', 'last_name' => 'Synthetic ' . strtoupper($suffix),
            'description' => 'Authorized Timeline 022 synthetic canary; not a real student.', 'role' => 'subscriber'];
    }
    tl022_canary_require($execute === true, 'EXPLICIT_EXECUTION_REQUIRED');
    $mailBlocked = 0;
    $mailFilter = static function($value) use (&$mailBlocked) { ++$mailBlocked; return true; };
    // Last-priority pre_wp_mail short-circuits native WordPress mail transport.
    add_filter('pre_wp_mail', $mailFilter, PHP_INT_MAX, 1);
    $noNotification = static fn() => false;
    add_filter('wp_send_new_user_notification_to_admin', $noNotification, PHP_INT_MAX);
    add_filter('wp_send_new_user_notification_to_user', $noNotification, PHP_INT_MAX);
    $created = [];
    try {
        foreach ($accounts as $suffix => $fields) {
            $fields['user_pass'] = $passwords[$suffix];
            $fields['meta_input'] = ['_missionmed_timeline_synthetic_test' => '1',
                '_missionmed_timeline_022_canary_run' => $plan['run_id'],
                '_missionmed_timeline_022_canary_created_at' => gmdate('c')];
            $id = wp_insert_user($fields);
            tl022_canary_require(!is_wp_error($id) && is_int($id) && $id > 0 && !in_array($id, $before['ids'], true), 'NEW_USER_INSERT_FAILED_RECONCILE');
            $created[] = ['wp_user_id' => $id, 'suffix' => $suffix, 'username' => $fields['user_login']];
            $user = get_userdata($id);
            tl022_canary_require($user && $user->roles === ['subscriber']
                && get_user_meta($id, '_missionmed_timeline_synthetic_test', true) === '1'
                && get_user_meta($id, '_missionmed_timeline_022_canary_run', true) === $plan['run_id'], 'NEW_USER_READBACK_FAILED');
            learndash_update_course_access($id, 3893, false);
            tl022_canary_require(sfwd_lms_has_access(3893, $id), 'NATIVE_ENROLLMENT_READBACK_FAILED');
            tl022_canary_require(get_user_meta($id, '_missionmed_timeline_remote_sync_consent', true) === '', 'CONSENT_MUST_REMAIN_UNSET');
            $principal = mmtl_derived_principal_for_user($id);
            tl022_canary_require(is_string($principal) && preg_match('/^[a-f0-9]{8}-[a-f0-9]{4}-5[a-f0-9]{3}-[a-f0-9]{4}-[a-f0-9]{12}$/D', $principal), 'PRINCIPAL_DERIVATION_FAILED');
            $created[count($created)-1] += ['principal_id' => $principal, 'course_id' => 3893,
                'synthetic_fixture' => true, 'native_course_access' => true, 'consent_granted' => false];
        }
        $after = tl022_canary_snapshot(array_column($created, 'wp_user_id'));
        tl022_canary_require($before === $after && $context === tl022_canary_context(), 'PREEXISTING_STATE_CHANGED_RECONCILE');
        return ['status' => 'CREATED_NATIVE_SYNTHETIC_CANARIES', 'run_id' => $plan['run_id'], 'users' => $created,
            'preexisting_accounts_and_scoped_meta_unchanged' => true, 'preexisting_snapshot_sha256' => $before['sha256'],
            'settings_and_runtime_unchanged' => true, 'wp_mail_calls_blocked' => $mailBlocked,
            'email_transport_used' => false, 'credentials_emitted' => false, 'admission_enabled' => false];
    } catch (Throwable $error) {
        // Preserve any partial new accounts for exact reconciliation; never delete
        // users or rewrite a preexisting profile to make a failed test disappear.
        return ['status' => 'PARTIAL_RECONCILE_BEFORE_CONTINUE', 'run_id' => $plan['run_id'], 'created_users' => $created,
            'reason' => 'NATIVE_CREATION_OR_READBACK_FAILED', 'wp_mail_calls_blocked' => $mailBlocked,
            'credentials_emitted' => false, 'automatic_cleanup' => false];
    } finally {
        remove_filter('pre_wp_mail', $mailFilter, PHP_INT_MAX);
        remove_filter('wp_send_new_user_notification_to_admin', $noNotification, PHP_INT_MAX);
        remove_filter('wp_send_new_user_notification_to_user', $noNotification, PHP_INT_MAX);
    }
}
if (!defined('D1_022_CANARY_LIBRARY_ONLY')) {
    try {
        tl022_canary_require(PHP_SAPI === 'cli', 'CLI_ONLY');
        $root = '/www/theresidencyacademy_209/public';
        tl022_canary_require(realpath($root) === $root, 'WORDPRESS_ROOT_IDENTITY_DENIED');
        require $root . '/wp-load.php';
        $raw = stream_get_contents(STDIN, 20000);
        $input = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
        $result = tl022_canary_run($input['plan'] ?? [], $input['passwords'] ?? [], ($argv[1] ?? '') === '--execute');
        echo json_encode($result, JSON_THROW_ON_ERROR);
    } catch (Throwable $error) { fwrite(STDERR, "SYNTHETIC_CANARY_OPERATION_DENIED_PRIVATE_DIAGNOSTICS_SUPPRESSED\n"); exit(1); }
}
