<?php
/** Exact-cohort onboarding pilot over the existing wp_mail stack. */
function mmdrj_launch_merge( $template, $values ) {
    return strtr( $template, array(
        '{{first_name}}' => esc_html( $values['first_name'] ),
        '{{username}}' => esc_html( $values['username'] ),
        '{{account_url}}' => esc_url( $values['account_url'] ),
        '{{password_setup_url}}' => esc_url( $values['password_setup_url'] ),
        '{{support_email}}' => esc_html( $values['support_email'] ),
    ) );
}

function mmdrj_launch_process( $payload, $html_template, $text_template, $mode ) {
    $cohort = array( 'Neidy', 'Ana Torres', 'Raghav Gupta', 'Subani Dias' );
    if ( ! in_array( $mode, array( 'dry-run', 'send', 'retry-failed' ), true )
        || ! is_array( $payload ) || ( $payload['schema_version'] ?? '' ) !== 'missionaccounts-onboarding-pilot-send-v1'
        || ( $payload['template_version'] ?? '' ) !== 'examprep-onboarding-email-2026-09-17-v2'
        || ( $payload['provider'] ?? '' ) !== 'wordpress_wp_mail'
        || ( $payload['cta_url'] ?? '' ) !== 'https://missionmedinstitute.com/missionaccounts/#/me/onboarding'
        || ! hash_equals( (string) ( $payload['template_html_sha256'] ?? '' ), hash( 'sha256', $html_template ) )
        || ! hash_equals( (string) ( $payload['template_text_sha256'] ?? '' ), hash( 'sha256', $text_template ) )
        || count( $payload['items'] ?? array() ) !== 4 ) {
        throw new RuntimeException( 'onboarding_pilot_manifest_invalid' );
    }
    if ( 'dry-run' !== $mode && ( true !== ( $payload['external_send_authorized'] ?? false )
        || ! preg_match( '/^[0-9a-f]{40}$/', (string) ( $payload['authority_commit'] ?? '' ) ) ) ) {
        throw new RuntimeException( 'onboarding_pilot_send_authority_required' );
    }
    $names = array_map( function( $row ) { return (string) ( $row['display_name'] ?? '' ); }, $payload['items'] );
    if ( $names !== $cohort ) throw new RuntimeException( 'onboarding_pilot_exact_cohort_required' );
    $resolved = array();
    $hold_reasons = array( 'canonical_identity_not_resolved', 'canonical_wordpress_account_not_resolved',
        'account_link_not_resolved', 'verified_email_not_resolved', 'enrollment_not_verified',
        'authoritative_exclusion', 'duplicate_prior_send' );
    foreach ( $payload['items'] as $item ) {
        if ( 'HELD' === ( $item['pilot_status'] ?? '' ) ) {
            if ( ! in_array( (string) ( $item['hold_reason'] ?? '' ), $hold_reasons, true ) ) {
                throw new RuntimeException( 'onboarding_pilot_hold_reason_invalid' );
            }
            $resolved[] = array( 'HELD', $item, null );
            continue;
        }
        if ( 'READY' !== ( $item['pilot_status'] ?? '' ) ) {
            throw new RuntimeException( 'onboarding_pilot_status_invalid' );
        }
        $user = get_user_by( 'id', absint( $item['wp_user_id'] ?? 0 ) );
        $student_id = strtolower( (string) ( $item['student_id'] ?? '' ) );
        $eligible = $user && ! user_can( $user, 'manage_options' )
            && hash_equals( (string) $item['email_sha256'], hash( 'sha256', strtolower( trim( $user->user_email ) ) ) )
            && $user->user_login === (string) $item['username']
            && strtolower( (string) get_user_meta( $user->ID, '_missionmed_missionaccounts_user_id', true ) ) === $student_id
            && ( $item['sponsor_type'] ?? '' ) === 'DIRECT'
            && true === ( $item['enrolled'] ?? false )
            && true === ( $item['onboarding_eligible'] ?? false )
            && function_exists( 'sfwd_lms_has_access' ) && sfwd_lms_has_access( 6357, $user->ID );
        if ( ! $eligible ) throw new RuntimeException( 'onboarding_pilot_recipient_preflight_failed' );
        $resolved[] = array( 'READY', $item, $user );
    }
    $results = array();
    foreach ( $resolved as list( $pilot_status, $item, $user ) ) {
        if ( 'HELD' === $pilot_status ) {
            $results[] = array( 'display_name'=>$item['display_name'], 'status'=>'held',
                'hold_reason'=>$item['hold_reason'], 'attempted'=>false );
            continue;
        }
        $ledger_key = '_missionmed_onboarding_launch_v1';
        $prior = json_decode( (string) get_user_meta( $user->ID, $ledger_key, true ), true );
        $prior_state = is_array( $prior ) ? (string) ( $prior['state'] ?? '' ) : '';
        if ( 'sent' === $prior_state ) { $results[] = array( 'wp_user_id'=>$user->ID, 'email_sha256'=>$item['email_sha256'], 'status'=>'already_sent', 'attempted'=>false ); continue; }
        if ( 'sending' === $prior_state ) { $results[] = array( 'wp_user_id'=>$user->ID, 'email_sha256'=>$item['email_sha256'], 'status'=>'uncertain_hold', 'attempted'=>false ); continue; }
        if ( ( 'retry-failed' === $mode && 'failed' !== $prior_state ) || ( 'send' === $mode && 'failed' === $prior_state ) ) {
            $results[] = array( 'wp_user_id'=>$user->ID, 'email_sha256'=>$item['email_sha256'], 'status'=>'mode_skipped', 'attempted'=>false ); continue;
        }
        if ( 'dry-run' === $mode ) { $results[] = array( 'wp_user_id'=>$user->ID, 'email_sha256'=>$item['email_sha256'], 'status'=>'ready', 'attempted'=>false ); continue; }
        $attempted_at = gmdate( 'c' );
        $send_key = hash( 'sha256', $payload['template_version'] . '|' . $user->ID . '|' . $item['email_sha256'] );
        update_user_meta( $user->ID, $ledger_key, wp_json_encode( array( 'state'=>'sending', 'attempted_at'=>$attempted_at, 'send_key'=>$send_key, 'authority_commit'=>$payload['authority_commit'] ) ) );
        $reset_key = get_password_reset_key( $user );
        if ( is_wp_error( $reset_key ) ) {
            update_user_meta( $user->ID, $ledger_key, wp_json_encode( array( 'state'=>'failed', 'attempted_at'=>$attempted_at, 'send_key'=>$send_key, 'reason'=>'password_recovery_failed' ) ) );
            $results[] = array( 'wp_user_id'=>$user->ID, 'email_sha256'=>$item['email_sha256'], 'status'=>'failed', 'attempted'=>true ); continue;
        }
        $setup_url = network_site_url( 'wp-login.php?action=rp&key=' . rawurlencode( $reset_key ) . '&login=' . rawurlencode( $user->user_login ), 'login' );
        $values = array( 'first_name'=>$user->first_name ?: $item['display_name'], 'username'=>$user->user_login,
            'account_url'=>$payload['cta_url'], 'password_setup_url'=>$setup_url, 'support_email'=>get_option( 'admin_email' ) );
        $html = mmdrj_launch_merge( $html_template, $values );
        $plain = wp_strip_all_tags( mmdrj_launch_merge( $text_template, $values ) );
        add_action( 'phpmailer_init', function( $mailer ) use ( $plain ) { $mailer->AltBody = $plain; } );
        $sent = wp_mail( $user->user_email, $payload['subject'], $html, array(
            'Content-Type: text/html; charset=UTF-8',
            'From: Dr J via MissionMed <' . sanitize_email( get_option( 'admin_email' ) ) . '>',
            'Reply-To: Dr J via MissionMed <' . sanitize_email( get_option( 'admin_email' ) ) . '>',
            'X-MissionMed-Send-Key: ' . $send_key,
        ) );
        $finished_at = gmdate( 'c' );
        update_user_meta( $user->ID, $ledger_key, wp_json_encode( array(
            'state'=>$sent?'sent':'failed', 'attempted_at'=>$attempted_at, 'sent_at'=>$sent?$finished_at:null,
            'send_key'=>$send_key, 'authority_commit'=>$payload['authority_commit'], 'reason'=>$sent?null:'wp_mail_failed' ) ) );
        $results[] = array( 'wp_user_id'=>$user->ID, 'email_sha256'=>$item['email_sha256'], 'status'=>$sent?'sent':'failed', 'attempted'=>true );
    }
    return array( 'schema_version'=>'missionaccounts-onboarding-pilot-results-v1', 'mode'=>$mode, 'population'=>4,
        'counts'=>array_count_values( array_column( $results, 'status' ) ), 'results'=>$results );
}

if ( ! defined( 'MMDRJ_ONBOARDING_LAUNCH_TEST' ) ) {
    if ( PHP_SAPI !== 'cli' || 5 !== count( $argv ) ) throw new RuntimeException( 'onboarding_pilot_cli_arguments_required' );
    $payload = json_decode( file_get_contents( $argv[1] ), true, 32, JSON_THROW_ON_ERROR );
    $result = mmdrj_launch_process( $payload, file_get_contents( $argv[2] ), file_get_contents( $argv[3] ), $argv[4] );
    echo wp_json_encode( $result, JSON_UNESCAPED_SLASHES ) . "\n";
}
