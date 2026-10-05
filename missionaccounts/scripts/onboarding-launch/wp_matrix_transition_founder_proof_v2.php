<?php
/** DR-341: one guarded Founder proof. No student send path. */
declare(strict_types=1);
if (PHP_SAPI !== 'cli' || $argc !== 2 || !in_array($argv[1], ['dry-run', 'send'], true)) {
    throw new RuntimeException('founder_proof_cli_only');
}
require '/www/theresidencyacademy_209/public/wp-load.php';
$private = '/www/theresidencyacademy_209/private/';
$files = [
    'html' => [$private . 'matrix-live-transition-v2.html', '75f1505c894a45b50dca936dcab1bfa0512c36c5af8bad6dbe6553f089cfb73d'],
    'text' => [$private . 'matrix-live-transition-v2.txt', 'a250d6943cc5921c4a08e025e7cd9a9ce9484bd2e425c68aea4f036d3df76352'],
    'logo' => [$private . 'matrix-live-transition-v2-logo.png', '4c456d99c49c40544e8d9487cf6c97b9624231eb42aea4c97ca3bec9a021e72f'],
    'hero' => [$private . 'matrix-live-transition-v2-hero.jpg', '8c05df28520fdfad6b50b2aa04e9ef949a75a262ba116eb18d3862e3088794a3'],
];
foreach ($files as [$path, $expected]) {
    if (!is_file($path) || !hash_equals($expected, hash_file('sha256', $path))) {
        throw new RuntimeException('founder_proof_asset_hash_mismatch');
    }
}
$user = get_user_by('id', 1368);
if (!$user || !hash_equals('brinyu2', (string)$user->user_login)
    || !hash_equals('info@missionmedinstitute.com', strtolower(trim((string)$user->user_email)))) {
    throw new RuntimeException('founder_proof_recipient_mismatch');
}
if (!function_exists('missionaccounts_send_email') || !get_option('_missionmed_gws_smtp_credential')) {
    throw new RuntimeException('google_campaign_sender_unavailable');
}
$claim_key = '_mmdrj_matrix_transition_founder_proof_v2';
if (get_option($claim_key, false) !== false) {
    throw new RuntimeException('founder_proof_already_claimed');
}
if ($argv[1] === 'dry-run') {
    echo wp_json_encode(['status' => 'ready', 'attempted' => false, 'recipient' => 'info@missionmedinstitute.com', 'student_recipients' => 0]) . "\n";
    exit(0);
}
$claim = ['state' => 'sending', 'version' => 'matrix-live-transition-v2', 'authority_commit' => 'dbcd9806d448e4fd51319209a186525c07f3224e', 'attempted_at' => gmdate('c')];
if (!add_option($claim_key, wp_json_encode($claim), '', false)) {
    throw new RuntimeException('founder_proof_claim_failed');
}
$html = (string)file_get_contents($files['html'][0]);
$text = (string)file_get_contents($files['text'][0]);
$onboarding_url = add_query_arg('missionmed_intent', 'missionaccounts_onboarding', home_url('/my-account/'));
$reset_url = wc_lostpassword_url();
$credential_html = 'Use your existing MissionMed password. Need to change it? <a href="' . esc_url($reset_url) . '" style="color:#e6c987;text-decoration:underline">Reset password →</a>';
$credential_text = 'Use your existing MissionMed password. Reset it if needed: ' . esc_url_raw($reset_url);
$html = strtr($html, [
    '{{first_name}}' => esc_html($user->first_name ?: 'Brian'),
    '{{username}}' => esc_html($user->user_login),
    '{{credential_block}}' => $credential_html,
    '{{onboarding_url}}' => esc_url($onboarding_url),
]);
$text = strtr($text, [
    '{{first_name}}' => sanitize_text_field($user->first_name ?: 'Brian'),
    '{{username}}' => sanitize_text_field($user->user_login),
    '{{credential_block}}' => $credential_text,
    '{{onboarding_url}}' => esc_url_raw($onboarding_url),
]);
if (preg_match('/\{\{[^}]+\}\}/', $html . $text)) {
    update_option($claim_key, wp_json_encode(array_merge($claim, ['state' => 'failed', 'reason' => 'unmerged_field'])), false);
    throw new RuntimeException('founder_proof_merge_failed');
}
add_action('phpmailer_init', static function ($m) use ($files, $text): void {
    if ($m->Mailer !== 'smtp' || $m->Host !== 'smtp.gmail.com'
        || $m->Username !== 'info@missionmedinstitute.com'
        || $m->From !== 'info@missionmedinstitute.com' || !$m->SMTPAuth) {
        throw new RuntimeException('google_smtp_identity_mismatch');
    }
    $m->AltBody = $text;
    $m->MessageID = '<mx5404e-r2-' . bin2hex(random_bytes(10)) . '@missionmedinstitute.com>';
    if (!$m->addEmbeddedImage($files['logo'][0], 'missionmed-logo', 'missionmed-logo.png', 'base64', 'image/png')
        || !$m->addEmbeddedImage($files['hero'][0], 'drj-hero', 'drj-hero.jpg', 'base64', 'image/jpeg')) {
        throw new RuntimeException('founder_proof_inline_image_failed');
    }
}, 100000);
$sent = missionaccounts_send_email('info@missionmedinstitute.com', 'Dr J ExamPrep: Complete your Matrix setup', $html, [
    'Content-Type: text/html; charset=UTF-8',
    'From: Dr J via MissionMed <info@missionmedinstitute.com>',
    'Reply-To: Dr J via MissionMed <info@missionmedinstitute.com>',
]);
$final = array_merge($claim, ['state' => $sent ? 'sent' : 'failed', 'sent_at' => $sent ? gmdate('c') : null, 'reason' => $sent ? null : 'wp_mail_failed']);
$recorded = update_option($claim_key, wp_json_encode($final), false);
echo wp_json_encode(['status' => $recorded ? ($sent ? 'sent' : 'failed') : 'uncertain_hold', 'attempted' => true, 'recipient' => 'info@missionmedinstitute.com', 'student_recipients' => 0]) . "\n";
if (!$sent || !$recorded) exit(2);
