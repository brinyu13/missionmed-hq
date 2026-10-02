<?php
/**
 * MissionMed protected account mail: Google Workspace only.
 * DR-342/343. No stored credentials or recipient data in this file.
 */

if (!defined('ABSPATH')) {
    exit;
}

function missionmed_protected_mail_log_hold($reason) {
    error_log('[missionmed-mail] protected message held: ' . $reason);
}

add_filter('pre_wp_mail', function ($pre, $atts) {
    $GLOBALS['missionmed_protected_mail_in_flight'] = false;
    $GLOBALS['missionmed_protected_mail_transport_preimage'] = null;

    $protected = !empty($GLOBALS['missionaccounts_smtp_active'])
        || !empty($GLOBALS['missionmed_system_smtp_active']);
    if (!$protected) {
        return $pre;
    }

    // An alternate sender short-circuit must never handle protected mail.
    if ($pre !== null) {
        missionmed_protected_mail_log_hold('alternate transport intercepted');
        return false;
    }

    $credential = get_option('_missionmed_gws_smtp_credential', '');
    if (!is_string($credential) || $credential === '') {
        missionmed_protected_mail_log_hold('Google credential unavailable');
        return false;
    }

    $GLOBALS['missionmed_protected_mail_in_flight'] = true;
    return null;
}, PHP_INT_MAX, 2);

// Capture the transport before the existing Snippet 133/97 Google router runs.
add_action('phpmailer_init', function ($mailer) {
    if (empty($GLOBALS['missionmed_protected_mail_in_flight'])) {
        return;
    }
    $fields = ['Mailer', 'Host', 'Port', 'SMTPSecure', 'SMTPAuth', 'Username', 'Password', 'SMTPKeepAlive'];
    $prior = [];
    foreach ($fields as $field) {
        $prior[$field] = $mailer->$field;
    }
    $GLOBALS['missionmed_protected_mail_transport_preimage'] = $prior;
}, 1);

// Last authorized router: no later default-mail fallback for this message.
add_action('phpmailer_init', function ($mailer) {
    if (empty($GLOBALS['missionmed_protected_mail_in_flight'])) {
        return;
    }
    $credential = get_option('_missionmed_gws_smtp_credential', '');
    if (!is_string($credential) || $credential === '') {
        // The pre-send filter must have blocked this; keep the transport non-default
        // if the credential disappears between hooks.
        $mailer->isSMTP();
        $mailer->Host = '127.0.0.1';
        $mailer->Port = 1;
        $mailer->SMTPAuth = false;
        missionmed_protected_mail_log_hold('Google credential changed before send');
        return;
    }
    $mailer->isSMTP();
    $mailer->Host = 'smtp.gmail.com';
    $mailer->Port = 587;
    $mailer->SMTPSecure = 'tls';
    $mailer->SMTPAuth = true;
    $mailer->Username = 'info@missionmedinstitute.com';
    $mailer->Password = $credential;
    $mailer->From = 'info@missionmedinstitute.com';
    $mailer->FromName = !empty($GLOBALS['missionaccounts_smtp_active'])
        ? 'Dr J via MissionMed' : 'MissionMed Institute';
}, PHP_INT_MAX);

function missionmed_protected_mail_restore_transport() {
    if (empty($GLOBALS['missionmed_protected_mail_in_flight'])) {
        return;
    }
    $prior = $GLOBALS['missionmed_protected_mail_transport_preimage'] ?? null;
    $mailer = $GLOBALS['phpmailer'] ?? null;
    if (is_array($prior) && is_object($mailer)) {
        foreach ($prior as $field => $value) {
            $mailer->$field = $value;
        }
    }
    $GLOBALS['missionmed_protected_mail_in_flight'] = false;
    $GLOBALS['missionmed_protected_mail_transport_preimage'] = null;
}

add_action('wp_mail_succeeded', 'missionmed_protected_mail_restore_transport', PHP_INT_MAX);
add_action('wp_mail_failed', function ($error) {
    if (!empty($GLOBALS['missionmed_protected_mail_in_flight'])) {
        missionmed_protected_mail_log_hold('Google transport failed');
    }
    missionmed_protected_mail_restore_transport();
}, PHP_INT_MAX);
