<?php
/** One Founder proof for the DR-339 Matrix live-session email. No student send path. */
declare(strict_types=1);
if (PHP_SAPI !== 'cli' || $argc !== 2 || !in_array($argv[1], array('dry-run', 'send'), true)) {
    throw new RuntimeException('founder_proof_cli_only');
}
require '/www/theresidencyacademy_209/public/wp-load.php';
$html_path = '/www/theresidencyacademy_209/private/matrix-live-transition-v1.html';
$text_path = '/www/theresidencyacademy_209/private/matrix-live-transition-v1.txt';
$html = file_get_contents($html_path);
$text = file_get_contents($text_path);
if (!is_string($html) || !is_string($text)
    || !hash_equals('e3a58567146ee0dc8919a698f389aa0bc155d1ecbf55ab1ef422172fbcdc98ec', hash('sha256', $html))
    || !hash_equals('6336d4e7fe61ae9ebde652b3e674ccacebc5e4fb66d3d1deb5849d09531ff699', hash('sha256', $text))) {
    throw new RuntimeException('founder_proof_template_hash_mismatch');
}
$user = get_user_by('id', 1368);
if (!$user || !hash_equals('brinyu2', (string)$user->user_login)
    || !hash_equals('info@missionmedinstitute.com', strtolower(trim((string)$user->user_email)))) {
    throw new RuntimeException('founder_proof_recipient_mismatch');
}
$claim_key = '_mmdrj_matrix_transition_founder_proof_v1';
if (get_option($claim_key, false) !== false) {
    echo wp_json_encode(array('status'=>'already_claimed','attempted'=>false)) . "\n";
    exit(3);
}
if ($argv[1] === 'dry-run') {
    echo wp_json_encode(array('status'=>'ready','attempted'=>false,'wp_user_id'=>1368,'email_sha256'=>hash('sha256', strtolower(trim((string)$user->user_email))))) . "\n";
    exit(0);
}
$claim = array('state'=>'sending','version'=>'matrix-live-transition-v1','authority_commit'=>'aca13496e86a2eae13ee67000449592841a4083c','attempted_at'=>gmdate('c'));
if (!add_option($claim_key, wp_json_encode($claim), '', false)) {
    throw new RuntimeException('founder_proof_claim_failed');
}
$reset_url = wc_lostpassword_url();
$first_name = $user->first_name ?: 'Brian';
$support_email = sanitize_email((string)get_option('admin_email'));
$credential_html = 'Use your existing MissionMed password. If needed, <a href="' . esc_url($reset_url) . '" style="color:#e6c987;text-decoration:underline">reset it here</a>.';
$credential_text = 'Use your existing MissionMed password. If needed, reset it here: ' . esc_url_raw($reset_url);
$html = strtr($html, array(
    '{{first_name}}'=>esc_html($first_name),
    '{{username}}'=>esc_html($user->user_login),
    '{{credential_block}}'=>$credential_html,
    '{{support_email}}'=>esc_html($support_email),
));
$text = strtr($text, array(
    '{{first_name}}'=>sanitize_text_field($first_name),
    '{{username}}'=>sanitize_text_field($user->user_login),
    '{{credential_block}}'=>$credential_text,
    '{{support_email}}'=>$support_email,
));
if (preg_match('/\{\{[^}]+\}\}/', $html . $text)) {
    update_option($claim_key, wp_json_encode(array_merge($claim,array('state'=>'failed','reason'=>'unmerged_field'))), false);
    throw new RuntimeException('founder_proof_merge_failed');
}
add_action('phpmailer_init', static function ($mailer) use ($text): void { $mailer->AltBody = $text; });
$sent = missionaccounts_send_email($user->user_email, 'Your Dr J live sessions are moving into Matrix', $html, array(
    'Content-Type: text/html; charset=UTF-8',
    'From: Dr J via MissionMed <' . $support_email . '>',
    'Reply-To: Dr J via MissionMed <' . $support_email . '>',
    'X-MissionMed-Send-Key: ' . hash('sha256',$claim_key . '|info@missionmedinstitute.com'),
));
$final = array_merge($claim,array('state'=>$sent?'sent':'failed','sent_at'=>$sent?gmdate('c'):null,'reason'=>$sent?null:'wp_mail_failed'));
$recorded = update_option($claim_key, wp_json_encode($final), false);
echo wp_json_encode(array('status'=>$recorded?($sent?'sent':'failed'):'uncertain_hold','attempted'=>true,'wp_user_id'=>1368,'email_sha256'=>hash('sha256',strtolower(trim((string)$user->user_email))))) . "\n";
if (!$sent || !$recorded) exit(2);
