<?php
// Run only with: wp eval-file wp_send_secure_invites.php <sealed-payload.json> <dry-run|send|retry-failed>
if (!defined('WP_CLI') || !WP_CLI) { throw new RuntimeException('wp_cli_required'); }
if (count($args) !== 2) { throw new InvalidArgumentException('payload_and_mode_required'); }
$payload_path = $args[0];
$mode = $args[1];
if (!in_array($mode, array('dry-run', 'send', 'retry-failed'), true)) { throw new InvalidArgumentException('invalid_mode'); }
$raw = file_get_contents($payload_path);
$payload = json_decode($raw, true, 64, JSON_THROW_ON_ERROR);
$expected_commit = 'e4c9ff1497788588986e659ccd344920d8615398';
$expected_manifest = '709632b3527c3138e30ea6eac4b068872841a50c00b076d6265dc2f0140b529c';
if (($payload['schema_version'] ?? '') !== 'missionaccounts-secure-invites-v1'
    || ($payload['authority_commit'] ?? '') !== $expected_commit
    || ($payload['manifest_sha256'] ?? '') !== $expected_manifest
    || ($payload['authority'] ?? array()) !== array('DR-226', 'DR-227')
    || !is_array($payload['items'] ?? null)
    || count($payload['items']) !== 40) {
    throw new RuntimeException('sealed_payload_contract_failed');
}

$seen_ids = array(); $seen_logins = array(); $preflight_results = array(); $preflight_failed = false;
foreach ($payload['items'] as $item) {
    $wp_id = intval($item['wp_user_id'] ?? 0);
    $username = strval($item['username'] ?? '');
    $email_sha = strval($item['expected_email_sha256'] ?? '');
    $student_id = strval($item['expected_student_id'] ?? '');
    $sponsor = strval($item['sponsor'] ?? '');
    if ($wp_id < 1 || isset($seen_ids[$wp_id]) || isset($seen_logins[strtolower($username)])
        || !preg_match('/^[0-9a-f]{8}-[0-9a-f-]{27}$/', $student_id)
        || !preg_match('/^[0-9a-f]{64}$/', $email_sha)
        || !in_array($sponsor, array('DIRECT','UCC','MUL'), true)) {
        throw new RuntimeException('invalid_or_duplicate_invite_item');
    }
    $seen_ids[$wp_id] = true; $seen_logins[strtolower($username)] = true;
    $user = get_user_by('id', $wp_id);
    if (!$user || $user->user_login !== $username
        || !hash_equals($email_sha, hash('sha256', strtolower(trim($user->user_email))))
        || user_can($user, 'manage_options')
        || strtolower(strval(get_user_meta($wp_id, '_missionmed_missionaccounts_user_id', true))) !== $student_id
        || !function_exists('sfwd_lms_has_access') || !sfwd_lms_has_access(6357, $wp_id)) {
        $preflight_failed = true;
        $preflight_results[] = array('wp_user_id'=>$wp_id,'username'=>$username,'email_sha256'=>$email_sha,'attempted'=>false,'succeeded'=>false,'status'=>'preflight_failed','timestamp'=>gmdate('c'));
    } else {
        $preflight_results[] = array('wp_user_id'=>$wp_id,'username'=>$username,'email_sha256'=>$email_sha,'attempted'=>false,'succeeded'=>false,'status'=>'preflight_ready','timestamp'=>gmdate('c'));
    }
}
if ($preflight_failed) {
    echo wp_json_encode(array('schema_version'=>'missionaccounts-secure-invite-results-v1','mode'=>$mode,'population'=>40,'counts'=>array_count_values(array_column($preflight_results,'status')),'results'=>$preflight_results), JSON_UNESCAPED_SLASHES) . "\n";
    return;
}

$seen_ids = array(); $seen_logins = array(); $results = array();
foreach ($payload['items'] as $item) {
    $wp_id = intval($item['wp_user_id']);
    $username = strval($item['username']);
    $email_sha = strval($item['expected_email_sha256']);
    $student_id = strval($item['expected_student_id']);
    $seen_ids[$wp_id] = true; $seen_logins[strtolower($username)] = true;
    $user = get_user_by('id', $wp_id);
    $meta_key = '_missionmed_missionaccounts_invite_v1';
    $prior = json_decode(strval(get_user_meta($wp_id, $meta_key, true)), true);
    $prior_state = is_array($prior) ? strval($prior['state'] ?? '') : '';
    if ($prior_state === 'sent') {
        $results[] = array('wp_user_id'=>$wp_id,'username'=>$username,'email_sha256'=>$email_sha,'attempted'=>false,'succeeded'=>true,'status'=>'already_sent','timestamp'=>strval($prior['sent_at'] ?? ''));
        continue;
    }
    if ($prior_state === 'sending') {
        $results[] = array('wp_user_id'=>$wp_id,'username'=>$username,'email_sha256'=>$email_sha,'attempted'=>false,'succeeded'=>false,'status'=>'uncertain_hold','timestamp'=>strval($prior['attempted_at'] ?? ''));
        continue;
    }
    if (($mode === 'retry-failed' && $prior_state !== 'failed') || ($mode === 'send' && $prior_state === 'failed')) {
        $results[] = array('wp_user_id'=>$wp_id,'username'=>$username,'email_sha256'=>$email_sha,'attempted'=>false,'succeeded'=>false,'status'=>'mode_skipped','timestamp'=>gmdate('c'));
        continue;
    }
    if ($mode === 'dry-run') {
        $results[] = array('wp_user_id'=>$wp_id,'username'=>$username,'email_sha256'=>$email_sha,'attempted'=>false,'succeeded'=>false,'status'=>'ready','timestamp'=>gmdate('c'));
        continue;
    }

    $attempted_at = gmdate('c');
    update_user_meta($wp_id, $meta_key, wp_json_encode(array(
        'state'=>'sending','attempted_at'=>$attempted_at,'request_id'=>$payload['request_id'],'manifest_sha256'=>$expected_manifest
    )));
    $key = get_password_reset_key($user);
    if (is_wp_error($key)) {
        update_user_meta($wp_id, $meta_key, wp_json_encode(array('state'=>'failed','attempted_at'=>$attempted_at,'request_id'=>$payload['request_id'],'reason'=>'password_reset_key_failed')));
        $results[] = array('wp_user_id'=>$wp_id,'username'=>$username,'email_sha256'=>$email_sha,'attempted'=>true,'succeeded'=>false,'status'=>'failed','timestamp'=>$attempted_at);
        continue;
    }
    $url = network_site_url('wp-login.php?action=rp&key=' . rawurlencode($key) . '&login=' . rawurlencode($user->user_login), 'login');
    $subject = 'Set your password for MyMissionMed Account';
    $message = "Your MyMissionMed Account is ready.\n\nUsername: " . $user->user_login
        . "\nYou may also use your registered email address to log in.\n\nSet your own password securely:\n" . $url
        . "\n\nAfter setting it, open Matrix at https://missionmedinstitute.com/member-dashboard/ and choose MyMissionMed Account, or go directly to https://missionmedinstitute.com/missionaccounts/.\n";
    $sent = wp_mail($user->user_email, $subject, $message);
    $finished_at = gmdate('c');
    update_user_meta($wp_id, $meta_key, wp_json_encode(array(
        'state'=>$sent?'sent':'failed','attempted_at'=>$attempted_at,'sent_at'=>$sent?$finished_at:null,
        'request_id'=>$payload['request_id'],'manifest_sha256'=>$expected_manifest,'reason'=>$sent?null:'wp_mail_failed'
    )));
    $results[] = array('wp_user_id'=>$wp_id,'username'=>$username,'email_sha256'=>$email_sha,'attempted'=>true,'succeeded'=>boolval($sent),'status'=>$sent?'sent':'failed','timestamp'=>$finished_at);
}

$counts = array_count_values(array_map(function($row){ return $row['status']; }, $results));
echo wp_json_encode(array('schema_version'=>'missionaccounts-secure-invite-results-v1','mode'=>$mode,'population'=>40,'counts'=>$counts,'results'=>$results), JSON_UNESCAPED_SLASHES) . "\n";
