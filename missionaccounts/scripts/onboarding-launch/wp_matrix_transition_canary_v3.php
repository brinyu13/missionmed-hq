<?php
/** DR-342/343: private five-student Matrix-transition canary; no current send authority. */
declare(strict_types=1);
if (PHP_SAPI !== 'cli' || !in_array($argv[1] ?? '', ['dry-run', 'send', 'record-hard-bounce', 'record-deferral'], true)) {
    throw new RuntimeException('canary_cli_mode_required');
}
require '/www/theresidencyacademy_209/public/wp-load.php';
const MMDRJ_MATRIX_MANIFEST_PATH = '/www/theresidencyacademy_209/private/dr342-matrix-transition-manifest-v3.json';
const MMDRJ_MATRIX_MANIFEST_SHA = 'b5e82013bb2ed38ef4e1446d6b196573da8f349ce3b8520f48dffe4ba140cbe2';
const MMDRJ_MATRIX_HTML_SHA = 'ff3436f2bfde3c5c42e7cb872277e5be4a64b9a53fb528fd16a4a00c67bdbb5d';
const MMDRJ_MATRIX_TEXT_SHA = 'a250d6943cc5921c4a08e025e7cd9a9ce9484bd2e425c68aea4f036d3df76352';
const MMDRJ_MATRIX_CAMPAIGN = 'matrix-live-transition-v3';
const MMDRJ_MATRIX_LIVE_PREFLIGHT = '/www/theresidencyacademy_209/private/dr342-canary-live-preflight-v3.json';
const MMDRJ_MATRIX_LIVE_CAPTURE = '/www/theresidencyacademy_209/private/dr342-canary-supabase-capture-v3.json';
const MMDRJ_MATRIX_QUERY_SHA = '38d20452a1f8c0dd576a8db8cb19869c3343a356b729c1681132af2b0579eb27';
function mmdrj_matrix_manifest(): array {
    if (!is_file(MMDRJ_MATRIX_MANIFEST_PATH) || !hash_equals(MMDRJ_MATRIX_MANIFEST_SHA, hash_file('sha256', MMDRJ_MATRIX_MANIFEST_PATH))) throw new RuntimeException('manifest_hash_mismatch');
    $m = json_decode((string)file_get_contents(MMDRJ_MATRIX_MANIFEST_PATH), true, 24, JSON_THROW_ON_ERROR);
    if (($m['schema'] ?? '') !== 'missionmed.dr342.matrix-transition-manifest.v1' || ($m['campaign'] ?? '') !== MMDRJ_MATRIX_CAMPAIGN || ($m['source_course_id'] ?? 0) !== 6357 || count($m['records'] ?? []) !== 133) throw new RuntimeException('manifest_contract_mismatch');
    $eligible = array_values(array_filter($m['records'], static fn($r) => ($r['disposition'] ?? '') === 'ELIGIBLE'));
    usort($eligible, static function ($a, $b): int {
        $ka = hash('sha256', MMDRJ_MATRIX_CAMPAIGN . '|' . $a['wp_user_id'] . '|' . $a['student_id']);
        $kb = hash('sha256', MMDRJ_MATRIX_CAMPAIGN . '|' . $b['wp_user_id'] . '|' . $b['student_id']);
        return strcmp($ka, $kb) ?: ($a['wp_user_id'] <=> $b['wp_user_id']);
    });
    $expected = array_map(static fn($r) => (int)$r['wp_user_id'], array_slice($eligible, 0, 5));
    if (count($expected) !== 5 || $expected !== ($m['canary_selection']['wp_user_ids'] ?? null) || ($m['canary_selection']['executed'] ?? true) !== false) throw new RuntimeException('canary_selection_mismatch');
    return $m;
}
function mmdrj_matrix_record(array $m, int $id): array {
    foreach ($m['records'] as $r) if ((int)$r['wp_user_id'] === $id) return $r;
    throw new RuntimeException('recipient_not_in_manifest');
}
function mmdrj_matrix_preflight(array $record): WP_User {
    if (($record['disposition'] ?? '') !== 'ELIGIBLE' || !in_array($record['onboarding_status'] ?? '', ['NOT_STARTED', 'IN_PROGRESS'], true)) throw new RuntimeException('recipient_not_eligible');
    $id = (int)$record['wp_user_id']; $u = get_user_by('id', $id);
    if (!$u || user_can($u, 'manage_options') || !function_exists('sfwd_lms_has_access') || !sfwd_lms_has_access(6357, $id)) throw new RuntimeException('course_or_role_changed');
    if (!is_email($u->user_email) || !hash_equals($record['email_sha256'], hash('sha256', strtolower(trim((string)$u->user_email)))) || !hash_equals($record['username_sha256'], hash('sha256', (string)$u->user_login)) || !hash_equals($record['student_id'], strtolower((string)get_user_meta($id, '_missionmed_missionaccounts_user_id', true)))) throw new RuntimeException('recipient_binding_changed');
    $suppress = get_option('_mmdrj_mail_suppress_' . $record['email_sha256'], false);
    if ($suppress !== false) {
        $state = json_decode((string)$suppress, true);
        if (!is_array($state) || ($state['state'] ?? '') !== 'temporary_deferral'
            || (int)($state['retry_count'] ?? 0) >= 2
            || strtotime((string)($state['retry_after'] ?? '')) > time()) {
            throw new RuntimeException('recipient_suppressed_or_deferred');
        }
    }
    return $u;
}
function mmdrj_matrix_ledger_key(array $r): string { return '_mmdrj_matrix_v3_' . hash('sha256', $r['wp_user_id'] . '|' . $r['email_sha256']); }
function mmdrj_matrix_live_preflight(array $m, array $ids): void {
    // Created immediately before a release by a privileged operator from a
    // fresh read of the canonical MissionAccounts Supabase authority. The
    // canary remains disabled until that separately reviewed artifact exists.
    if (!is_file(MMDRJ_MATRIX_LIVE_PREFLIGHT)) throw new RuntimeException('live_authority_preflight_missing');
    $a = json_decode((string)file_get_contents(MMDRJ_MATRIX_LIVE_PREFLIGHT), true, 16, JSON_THROW_ON_ERROR);
    if (!is_file(MMDRJ_MATRIX_LIVE_CAPTURE)
        || !hash_equals((string)($a['source_result_sha256'] ?? ''), hash_file('sha256', MMDRJ_MATRIX_LIVE_CAPTURE))) {
        throw new RuntimeException('live_authority_capture_mismatch');
    }
    $capture = json_decode((string)file_get_contents(MMDRJ_MATRIX_LIVE_CAPTURE), true, 16, JSON_THROW_ON_ERROR);
    if (($capture['project_id'] ?? '') !== 'dwwsahpzblgrgducxtzw'
        || hash('sha256', (string)($capture['query'] ?? '')) !== MMDRJ_MATRIX_QUERY_SHA
        || count($capture['rows'] ?? []) !== 5) throw new RuntimeException('live_authority_query_mismatch');
    if (($a['schema'] ?? '') !== 'missionmed.dr342.canary-live-preflight.v1'
        || ($a['manifest_sha256'] ?? '') !== MMDRJ_MATRIX_MANIFEST_SHA
        || ($a['source_query_sha256'] ?? '') !== MMDRJ_MATRIX_QUERY_SHA
        || ($a['project_id'] ?? '') !== 'dwwsahpzblgrgducxtzw'
        || (int)($a['course_id'] ?? 0) !== 6357
        || abs(time() - strtotime((string)($a['fetched_at'] ?? ''))) > 120
        || count($a['records'] ?? []) !== 5) throw new RuntimeException('live_authority_preflight_stale_or_invalid');
    foreach ($ids as $id) {
        $r = mmdrj_matrix_record($m, (int)$id);
        $current = $a['records'][(string)$id] ?? null;
        $source = null;
        foreach ($capture['rows'] as $row) if (($row['student_id'] ?? '') === $r['student_id']) { $source = $row; break; }
        if (!is_array($current) || ($current['student_id'] ?? '') !== $r['student_id']
            || !is_array($source)
            || ($source['fetched_at'] ?? '') !== ($current['fetched_at'] ?? '')
            || ($source['onboarding_status'] ?? '') !== ($current['onboarding_status'] ?? '')
            || ($source['sponsor_type'] ?? '') !== ($current['sponsor_type'] ?? '')
            || ($source['identity_state'] ?? '') !== ($current['identity_state'] ?? '')
            || ($source['canonical_student_id'] ?? '') !== ($current['canonical_student_id'] ?? '')
            || ($source['absorbed'] ?? true) !== ($current['absorbed'] ?? true)
            || ($source['excluded'] ?? true) !== ($current['excluded'] ?? true)
            || ($source['workspace_resolved'] ?? false) !== ($current['workspace_resolved'] ?? false)
            || ($current['email_sha256'] ?? '') !== $r['email_sha256']
            || ($current['sponsor_type'] ?? '') !== 'DIRECT'
            || ($current['identity_state'] ?? '') !== 'verified'
            || ($current['canonical_student_id'] ?? '') !== $r['student_id']
            || ($current['absorbed'] ?? true) !== false
            || ($current['excluded'] ?? true) !== false
            || ($current['workspace_resolved'] ?? false) !== true
            || !in_array($current['onboarding_status'] ?? '', ['NOT_STARTED','IN_PROGRESS'], true)) {
            throw new RuntimeException('live_authority_preflight_recipient_changed');
        }
        if (abs(time() - strtotime((string)$source['fetched_at'] . ' UTC')) > 120) {
            throw new RuntimeException('live_authority_capture_stale');
        }
    }
}
$m = mmdrj_matrix_manifest(); $mode = $argv[1]; $ids = $m['canary_selection']['wp_user_ids'];
if (str_starts_with($mode, 'record-')) {
    if (count($argv) !== 4 || !ctype_digit($argv[2]) || !preg_match('/^[0-9a-f]{64}$/', $argv[3])) throw new RuntimeException('outcome_evidence_required');
    $r = mmdrj_matrix_record($m, (int)$argv[2]); $key = '_mmdrj_mail_suppress_' . $r['email_sha256'];
    $state = $mode === 'record-hard-bounce' ? 'hard_bounce' : 'temporary_deferral';
    $ledger_key = mmdrj_matrix_ledger_key($r);
    $prior = json_decode((string)get_option($ledger_key, ''), true);
    if (!is_array($prior) || ($prior['state'] ?? '') !== 'provider_accepted') throw new RuntimeException('outcome_requires_accepted_attempt');
    // A privileged operator must first verify the provider's specific DSN
    // and supply its evidence digest. No ambiguous result can be retried.
    $entry = ['state'=>$state,'evidence_sha256'=>$argv[3],'recorded_at'=>gmdate('c'),
      'retry_after'=>$state === 'temporary_deferral' ? gmdate('c', time()+86400) : null,
      'retry_count'=>(int)($prior['retry_count'] ?? 0)];
    if (!add_option($key, wp_json_encode($entry), '', false)) throw new RuntimeException('outcome_already_recorded_hold');
    if (!update_option($ledger_key, wp_json_encode(array_merge($prior, ['state'=>$state,'outcome_evidence_sha256'=>$argv[3]])), false)) throw new RuntimeException('outcome_ledger_update_failed_hold');
    echo wp_json_encode(['state'=>$state,'wp_user_id'=>(int)$r['wp_user_id'],'send_attempted'=>false]) . "\n"; exit(0);
}
if ($mode === 'send') {
    // A future exact-head DR must amend the frozen private manifest. DR-342/343
    // explicitly do not authorize a student send, so this manifest cannot pass.
    if (($m['canary_release']['founder_approved'] ?? false) !== true || !preg_match('/^[0-9a-f]{40}$/', (string)($m['canary_release']['authority_commit'] ?? '')) || in_array($m['canary_release']['authority_commit'], ['3c0a3515b928142e6721fa223875f37c29f6437b','8e6b103c328d2e41b311d67dd962e408d0ac3733'], true)) throw new RuntimeException('student_canary_release_not_authorized');
    mmdrj_matrix_live_preflight($m, $ids);
    if (!function_exists('missionaccounts_send_email') || !function_exists('missionmed_protected_mail_restore_transport') || !get_option('_missionmed_gws_smtp_credential')) throw new RuntimeException('google_transport_unavailable');
}
$html_path = '/www/theresidencyacademy_209/private/matrix-live-transition-v3.html';
$text_path = '/www/theresidencyacademy_209/private/matrix-live-transition-v3.txt';
if (!is_file($html_path) || !is_file($text_path) || !hash_equals(MMDRJ_MATRIX_HTML_SHA, hash_file('sha256', $html_path)) || !hash_equals(MMDRJ_MATRIX_TEXT_SHA, hash_file('sha256', $text_path))) throw new RuntimeException('template_hash_mismatch');
$html_template = (string)file_get_contents($html_path); $text_template = (string)file_get_contents($text_path);
$results = [];
foreach ($ids as $id) {
    $r = mmdrj_matrix_record($m, (int)$id);
    try { $u = mmdrj_matrix_preflight($r); }
    catch (Throwable $e) { $results[]=['wp_user_id'=>(int)$id,'status'=>'hold','reason'=>$e->getMessage()]; continue; }
    $key = mmdrj_matrix_ledger_key($r); $prior_raw = get_option($key, false);
    $prior = $prior_raw === false ? null : json_decode((string)$prior_raw, true);
    $retry = is_array($prior) && ($prior['state'] ?? '') === 'temporary_deferral'
        && (int)($prior['retry_count'] ?? 0) < 2;
    if ($prior_raw !== false && !$retry) { $results[]=['wp_user_id'=>(int)$id,'status'=>'prior_or_ambiguous_hold']; continue; }
    if ($mode === 'dry-run') { $results[]=['wp_user_id'=>(int)$id,'status'=>'ready_wp_only_live_authority_required']; continue; }
    $claim=['state'=>'sending','attempted_at'=>gmdate('c'),'manifest_sha256'=>MMDRJ_MATRIX_MANIFEST_SHA,
      'retry_count'=>$retry ? (int)$prior['retry_count']+1 : 0,
      'message_id'=>'<mx5404e-canary-'.bin2hex(random_bytes(12)).'@missionmedinstitute.com>'];
    if ($retry) {
        global $wpdb;
        $claimed = $wpdb->query($wpdb->prepare(
            "UPDATE {$wpdb->options} SET option_value=%s WHERE option_name=%s AND option_value=%s",
            wp_json_encode($claim), $key, (string)$prior_raw
        )) === 1;
        if ($claimed) {
            wp_cache_delete($key, 'options');
            wp_cache_delete('alloptions', 'options');
        }
    } else {
        $claimed = add_option($key, wp_json_encode($claim), '', false);
    }
    if (!$claimed) { $results[]=['wp_user_id'=>(int)$id,'status'=>'ambiguous_hold']; continue; }
    $first = $u->first_name ?: $u->display_name;
    $onboarding = add_query_arg('missionmed_intent', 'missionaccounts_onboarding', home_url('/my-account/'));
    $reset = wc_lostpassword_url();
    $html = strtr($html_template, ['{{first_name}}'=>esc_html($first),'{{username}}'=>esc_html($u->user_login),'{{credential_block}}'=>'Use your existing MissionMed password. Need to change it? <a href="'.esc_url($reset).'" style="color:#e6c987;text-decoration:underline">Reset password →</a>','{{onboarding_url}}'=>esc_url($onboarding)]);
    $text = strtr($text_template, ['{{first_name}}'=>sanitize_text_field($first),'{{username}}'=>sanitize_text_field($u->user_login),'{{credential_block}}'=>'Use your existing MissionMed password. Reset it if needed: '.esc_url_raw($reset),'{{onboarding_url}}'=>esc_url_raw($onboarding)]);
    if (preg_match('/\{\{[^}]+\}\}/', $html.$text)) { update_option($key, wp_json_encode(array_merge($claim, ['state'=>'ambiguous_hold'])), false); $results[]=['wp_user_id'=>(int)$id,'status'=>'ambiguous_hold']; break; }
    $message_hook = static function ($mail) use ($claim, $text): void {
        if ($mail->Mailer !== 'smtp' || $mail->Host !== 'smtp.gmail.com' || !$mail->SMTPAuth || $mail->From !== 'info@missionmedinstitute.com') throw new RuntimeException('google_transport_mismatch');
        $mail->AltBody=$text; $mail->MessageID=$claim['message_id'];
    };
    add_action('phpmailer_init', $message_hook, 100000);
    $sent = missionaccounts_send_email($u->user_email, 'Dr J ExamPrep: Complete your Matrix setup', $html, ['Content-Type: text/html; charset=UTF-8','From: Dr J via MissionMed <info@missionmedinstitute.com>','Reply-To: Dr J via MissionMed <info@missionmedinstitute.com>']);
    remove_action('phpmailer_init', $message_hook, 100000);
    $final=array_merge($claim,['state'=>$sent?'provider_accepted':'ambiguous_hold','finished_at'=>gmdate('c')]);
    if (!update_option($key, wp_json_encode($final), false)) { $results[]=['wp_user_id'=>(int)$id,'status'=>'ambiguous_hold']; break; }
    if ($sent && $retry) delete_option('_mmdrj_mail_suppress_' . $r['email_sha256']);
    $results[]=['wp_user_id'=>(int)$id,'status'=>$final['state']];
    if (!$sent) break; // systemic transport/auth failure: stop the entire canary.
}
echo wp_json_encode(['campaign'=>MMDRJ_MATRIX_CAMPAIGN,'mode'=>$mode,'results'=>$results,'student_messages_attempted'=>$mode==='send' ? count(array_filter($results,static fn($r)=>in_array($r['status'],['provider_accepted','ambiguous_hold'],true))) : 0]) . "\n";
