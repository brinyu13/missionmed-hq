<?php
// Timeline-owned administrator directory and optional AI consent. No enrollment writes.
if (!defined('ABSPATH')) exit;

const MMTL_AI_CONSENT_META = '_missionmed_timeline_ai_consent_v022';
const MMTL_AI_CONSENT_HISTORY_META = '_missionmed_timeline_ai_consent_history_v022';

function mmtl_ai_consent($user_id, $settings) {
    $version = (string) ($settings['ai_consent_version'] ?? '');
    $record = get_user_meta(absint($user_id), MMTL_AI_CONSENT_META, true);
    $at = is_array($record) ? strtotime((string) ($record['recorded_at'] ?? '')) : false;
    $granted = $version !== '' && is_array($record) && ($record['decision'] ?? '') === 'grant'
        && hash_equals($version, (string) ($record['version'] ?? '')) && $at !== false && $at <= time();
    return array('granted' => $granted, 'version' => $version, 'recorded_at' => $granted ? gmdate('c', $at) : '');
}

function mmtl_ai_consent_endpoint($request) {
    $user = wp_get_current_user();
    $access = mmtl_eligibility_state($user);
    if (is_wp_error($access)) return $access;
    if (!empty($access['administrator'])) return new WP_Error('ai_consent_student_required', 'AI consent belongs to the student whose work is reviewed.', array('status' => 403));
    $settings = mmtl_settings();
    $decision = (string) $request->get_param('decision');
    $version = (string) $request->get_param('version');
    if (!in_array($decision, array('grant', 'withdraw'), true)) return new WP_Error('ai_consent_decision_invalid', 'Choose whether to allow AI review.', array('status' => 400));
    if ($decision === 'grant' && (empty($access['ai_processing_available']) || $request->get_param('confirmed') !== true
        || $version === '' || !hash_equals($settings['ai_consent_version'], $version))) {
        return new WP_Error('ai_consent_confirmation_required', 'Read and confirm the current AI review choice.', array('status' => 400));
    }
    $record = array('decision' => $decision, 'version' => $settings['ai_consent_version'], 'recorded_at' => gmdate('c'), 'policy' => 'D1-TIMELINE-STORYFORGE-LIVE-022', 'provider' => 'openai', 'responses_store' => false);
    // Retain the decision history independently of the current consent pointer.
    if (!add_user_meta((int) $user->ID, MMTL_AI_CONSENT_HISTORY_META, $record, false)) return new WP_Error('ai_consent_record_failed', 'Your choice could not be saved. Please try again.', array('status' => 503));
    update_user_meta((int) $user->ID, MMTL_AI_CONSENT_META, $record);
    $saved = get_user_meta((int) $user->ID, MMTL_AI_CONSENT_META, true);
    if ($saved !== $record) return new WP_Error('ai_consent_record_failed', 'Your choice could not be saved. Please try again.', array('status' => 503));
    return mmtl_filevault_source_response(array('consent' => mmtl_ai_consent((int) $user->ID, $settings)));
}

function mmtl_admin_permission($request) {
    $permission = mmtl_token_permission($request);
    if (is_wp_error($permission)) return $permission;
    $access = mmtl_eligibility_state(wp_get_current_user());
    if (is_wp_error($access)) return $access;
    if (empty($access['admin_workspace'])) return new WP_Error('admin_workspace_required', 'Timeline administrator access is required.', array('status' => 403));
    return true;
}

function mmtl_admin_subject($wp_user_id) {
    $student = get_user_by('id', absint($wp_user_id));
    if (!$student || mmtl_is_administrator($student) || !mmtl_has_course_access((int) $student->ID)) {
        return new WP_Error('admin_subject_unavailable', 'That eligible student workspace is not available.', array('status' => 403));
    }
    // Reading a roster must never provision a student or change their enrollment.
    $principal = mmtl_principal_for_user((int) $student->ID);
    if (is_wp_error($principal) || !mmtl_valid_uuid($principal)) return new WP_Error('admin_subject_unavailable', 'That student identity could not be verified.', array('status' => 403));
    return array('wp_user_id' => (int) $student->ID, 'principal_id' => $principal, 'display_name' => (string) $student->display_name);
}

function mmtl_admin_directory_bridge($path, $input) {
    $user = wp_get_current_user();
    $access = mmtl_eligibility_state($user);
    if (is_wp_error($access)) return $access;
    if (empty($access['admin_workspace'])) return new WP_Error('admin_workspace_required', 'Timeline administrator access is required.', array('status' => 403));
    $settings = mmtl_settings();
    if (!in_array($path, array('roster', 'open'), true) || !wp_http_validate_url($settings['api_origin'])) return new WP_Error('admin_service_unavailable', 'The Timeline roster is temporarily unavailable.', array('status' => 503));
    $issued = mmtl_issue_jwt($user, $access);
    if (is_wp_error($issued)) return $issued;
    $secret = mmtl_gateway_secret();
    if (strlen($secret) < 32) return new WP_Error('admin_service_unavailable', 'The Timeline roster is temporarily unavailable.', array('status' => 503));
    $response = wp_remote_post($settings['api_origin'] . '/v1/admin/' . $path, array(
        'timeout' => 30, 'redirection' => 0, 'reject_unsafe_urls' => true,
        'headers' => array('Content-Type' => 'application/json', 'Authorization' => 'Bearer ' . $issued['token'],
            'X-MissionMed-Timeline-Gateway' => 'wordpress', 'X-MissionMed-Timeline-Gateway-Secret' => $secret,
            'X-Timeline-Admin-Directory' => 'learndash-3893', 'X-Request-Id' => wp_generate_uuid4()),
        'body' => wp_json_encode($input),
    ));
    if (is_wp_error($response)) return new WP_Error('admin_service_unavailable', 'The Timeline roster is temporarily unavailable.', array('status' => 503));
    $code = (int) wp_remote_retrieve_response_code($response);
    $payload = json_decode((string) wp_remote_retrieve_body($response), true);
    if ($code < 200 || $code > 299 || !is_array($payload)) return new WP_Error('admin_service_unavailable', 'That Timeline workspace is not available. Refresh the roster and try again.', array('status' => $code === 404 ? 404 : 503));
    return $payload;
}

function mmtl_admin_eligible_students() {
    if (!function_exists('learndash_get_users_for_course') || !function_exists('sfwd_lms_has_access')) return new WP_Error('enrollment_source_unavailable', 'The current enrollment source is unavailable.', array('status' => 503));
    // Installed LearnDash 5.0.4 merges direct and group enrollments and excludes expired access.
    $query = learndash_get_users_for_course(MMTL_COURSE_ID, array('fields' => 'ID', 'number' => -1), true);
    $ids = is_object($query) && method_exists($query, 'get_results') ? $query->get_results() : (array) $query;
    $ids = array_values(array_unique(array_filter(array_map('absint', $ids))));
    if (count($ids) > 20000) return new WP_Error('roster_capacity_exceeded', 'This roster needs a larger server page. No partial population was returned.', array('status' => 503));
    $students = array();
    $course_groups = function_exists('learndash_get_course_groups') ? array_map('absint', (array) learndash_get_course_groups(MMTL_COURSE_ID, true)) : array();
    foreach ($ids as $id) {
        $user = get_user_by('id', $id);
        if (!$user || mmtl_is_administrator($user) || !mmtl_has_course_access($id)) continue;
        $groups = function_exists('learndash_get_users_group_ids') ? array_intersect($course_groups, array_map('absint', (array) learndash_get_users_group_ids($id, true))) : array();
        $students[] = array('wpUserId' => $id, 'displayName' => (string) $user->display_name,
            'email' => (string) $user->user_email, 'program' => 'MissionMed 360',
            'sessions' => array_values(array_map('get_the_title', $groups)), 'eligible' => true);
    }
    return $students;
}

function mmtl_admin_roster_endpoint($request) {
    $students = mmtl_admin_eligible_students();
    if (is_wp_error($students)) return $students;
    $checked_at = gmdate('c');
    $result = mmtl_admin_directory_bridge('roster', array('wpUserIds' => array_column($students, 'wpUserId'), 'verifiedAt' => $checked_at));
    if (is_wp_error($result)) return $result;
    $status_by_id = array();
    foreach ((array) ($result['students'] ?? array()) as $row) $status_by_id[(int) ($row['wpUserId'] ?? 0)] = $row;
    $metrics = array('eligible' => count($students), 'never_started' => 0, 'cv_imported' => 0, 'draft' => 0,
        'needs_review' => 0, 'guardian_issues' => 0, 'ready' => 0, 'recently_exported' => 0, 'recently_active' => 0);
    $rows = array();
    foreach ($students as $student) {
        $status = $status_by_id[$student['wpUserId']] ?? null;
        if (!is_array($status)) return new WP_Error('roster_status_incomplete', 'Some Timeline statuses could not be verified. Please refresh.', array('status' => 503));
        $row = array_merge($status, $student);
        foreach (array_keys($metrics) as $metric) if ($metric !== 'eligible' && !empty($status['filters'][$metric])) $metrics[$metric]++;
        $rows[] = $row;
    }
    $query = strtolower(trim((string) $request->get_param('query')));
    $filter = (string) $request->get_param('filter');
    $session = (string) $request->get_param('session');
    $sessions = array();
    foreach ($rows as $row) $sessions = array_merge($sessions, $row['sessions']);
    $sessions = array_values(array_unique($sessions)); sort($sessions, SORT_NATURAL | SORT_FLAG_CASE);
    $rows = array_values(array_filter($rows, function($row) use ($query, $filter, $session) {
        if ($query !== '' && strpos(strtolower($row['displayName'] . ' ' . $row['email']), $query) === false) return false;
        if ($filter !== '' && $filter !== 'all' && $filter !== 'eligible' && empty($row['filters'][$filter])) return false;
        return $session === '' || in_array($session, $row['sessions'], true);
    }));
    usort($rows, function($a, $b) { return strcasecmp($a['displayName'], $b['displayName']) ?: ($a['wpUserId'] <=> $b['wpUserId']); });
    $total = count($rows); $page_size = 25;
    $page = max(1, min(max(1, (int) ceil($total / $page_size)), absint($request->get_param('page') ?: 1)));
    return mmtl_filevault_source_response(array('source' => 'learndash-course-3893', 'verifiedAt' => $checked_at,
        'metrics' => $metrics, 'students' => array_slice($rows, ($page - 1) * $page_size, $page_size),
        'sessions' => $sessions, 'total' => $total, 'page' => $page, 'pageSize' => $page_size));
}

function mmtl_admin_open_endpoint($request) {
    $subject = mmtl_admin_subject(absint($request->get_param('id')));
    if (is_wp_error($subject)) return $subject;
    $result = mmtl_admin_directory_bridge('open', array('wpUserId' => $subject['wp_user_id'], 'verifiedAt' => gmdate('c')));
    if (is_wp_error($result)) return $result;
    // Identity and entitlement are read again after the API request, before returning private content.
    $confirmed = mmtl_admin_subject($subject['wp_user_id']);
    if (is_wp_error($confirmed)) return $confirmed;
    if (!hash_equals($subject['principal_id'], $confirmed['principal_id'])
        || !hash_equals($confirmed['principal_id'], (string) ($result['studentPrincipalId'] ?? ''))) {
        return new WP_Error('admin_subject_mismatch', 'That student identity changed. Refresh the roster before opening the Timeline.', array('status' => 403));
    }
    $result['subject'] = array('wpUserId' => $confirmed['wp_user_id'], 'displayName' => $confirmed['display_name'],
        'principalId' => $confirmed['principal_id'], 'canEdit' => !empty($result['canEdit']));
    return mmtl_filevault_source_response($result);
}

function mmtl_register_workspace_routes_022() {
    register_rest_route(MMTL_REST_NAMESPACE, '/ai-consent', array('methods' => 'POST', 'callback' => 'mmtl_ai_consent_endpoint', 'permission_callback' => 'mmtl_token_permission'));
    register_rest_route(MMTL_REST_NAMESPACE, '/admin/roster', array('methods' => 'GET', 'callback' => 'mmtl_admin_roster_endpoint', 'permission_callback' => 'mmtl_admin_permission'));
    register_rest_route(MMTL_REST_NAMESPACE, '/admin/students/(?P<id>[1-9][0-9]{0,18})/open', array('methods' => 'POST', 'callback' => 'mmtl_admin_open_endpoint', 'permission_callback' => 'mmtl_admin_permission'));
}
add_action('rest_api_init', 'mmtl_register_workspace_routes_022');
