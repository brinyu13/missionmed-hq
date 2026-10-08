<?php
/**
 * Plugin Name: MissionMed Global Discretionary Mail Suppression
 * Description: Permanent Founder DNC at WordPress and MedMail send boundaries. DR-401.
 * Version: 2026.10.08.1
 */
if (!defined('ABSPATH')) { exit; }

final class MissionMed_Global_Mail_Suppression {
    const OPTION = '_missionmed_global_discretionary_suppression_v1';
    private static $required = [];

    public static function addresses($value) {
        $out = [];
        foreach ((array) $value as $part) {
            if (!is_string($part)) { continue; }
            preg_match_all('/[A-Z0-9.!#$%&\x27*+\/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9.-]*[A-Z0-9])?/i', $part, $matches);
            foreach ($matches[0] as $email) {
                $email = strtolower(trim($email));
                if (is_email($email)) { $out[$email] = true; }
            }
        }
        return array_keys($out);
    }

    public static function suppressed($email) {
        $entries = get_option(self::OPTION, []);
        return is_array($entries) && isset($entries[hash('sha256', strtolower(trim($email)))])
            && ($entries[hash('sha256', strtolower(trim($email)))]['state'] ?? '') === 'permanent_dnc';
    }

    public static function denied_recipients($to, $headers = []) {
        $values = (array) $to;
        foreach ((array) $headers as $header) {
            foreach (preg_split('/\r?\n/', (string) $header) as $line) {
                if (preg_match('/^\s*(?:Cc|Bcc):\s*(.*)$/i', $line, $m)) { $values[] = $m[1]; }
            }
        }
        return array_values(array_filter(self::addresses($values), [__CLASS__, 'suppressed']));
    }

    private static function fingerprint($atts) {
        return hash('sha256', serialize([
            $atts['to'] ?? '', $atts['subject'] ?? '',
            $atts['message'] ?? '', $atts['headers'] ?? '',
        ]));
    }

    // Only trusted server-side core/Woo hooks may register an exact one-use
    // transactional/security envelope. Public headers/REST flags are ignored.
    public static function required_envelope($atts) {
        self::$required[self::fingerprint($atts)] = true;
        return $atts;
    }

    public static function guard_wp_mail($pre, $atts) {
        $key = self::fingerprint($atts);
        $required = !empty(self::$required[$key]) || self::trusted_core_frames(debug_backtrace(DEBUG_BACKTRACE_IGNORE_ARGS, 16));
        unset(self::$required[$key]);
        if (!$required && self::denied_recipients($atts['to'] ?? [], $atts['headers'] ?? [])) {
            // No address, body or private student data in application logs.
            error_log('[missionmed-mail] discretionary message blocked by permanent Founder DNC');
            return false;
        }
        return $pre;
    }

    public static function trusted_core_frames($frames) {
        $caller = null;
        $functions = [];
        foreach ($frames as $frame) {
            $functions[] = $frame['function'] ?? '';
            if (($frame['function'] ?? '') === 'wp_mail') { $caller = $frame['file'] ?? ''; }
        }
        // Core applies substitutions AFTER password/email-change filters.
        // Classify only a direct core wp_mail call, not client-supplied content
        // or a plugin's mail nested somewhere inside a core request.
        $core = rtrim(ABSPATH, '/').'/'.(defined('WPINC') ? WPINC : 'wp-includes');
        if ($caller === $core.'/user.php') {
            return (bool) array_intersect($functions, ['wp_update_user', 'retrieve_password', 'wp_send_user_request', '_wp_privacy_send_erasure_fulfillment_notification']);
        }
        if ($caller === $core.'/pluggable.php') {
            return (bool) array_intersect($functions, ['wp_new_user_notification', 'wp_password_change_notification']);
        }
        return false;
    }

    public static function guard_medmail($response, $handler, $request) {
        if (strcasecmp(rtrim($request->get_route(), '/'), '/missionmed-command-center/v1/email/send') !== 0) { return $response; }
        $params = $request->get_params();
        // Match the actual MedMail callback's final recipient normalization.
        $final_to = sanitize_email((string) $request->get_param('to'));
        if (self::denied_recipients($final_to)) {
            return new WP_Error('missionmed_permanent_dnc', 'This recipient cannot receive discretionary communications.', ['status' => 403]);
        }
        foreach (['to', 'cc', 'bcc'] as $field) {
            if (self::denied_recipients($params[$field] ?? [])) {
                return new WP_Error('missionmed_permanent_dnc', 'This recipient cannot receive discretionary communications.', ['status' => 403]);
            }
        }
        // No client-supplied "transactional" parameter can bypass this guard.
        return $response;
    }

    public static function woo_required($params, $email) {
        $allowed = ['customer_on_hold_order', 'customer_processing_order', 'customer_completed_order',
            'customer_refunded_order', 'customer_invoice', 'customer_failed_order', 'customer_cancelled_order'];
        if ($email instanceof WC_Email && in_array($email->id, $allowed, true)
            && $email->object instanceof WC_Order && $email->object->get_id() > 0) {
            self::required_envelope(['to' => $params[0], 'subject' => $params[1], 'message' => $params[2], 'headers' => $params[3]]);
        }
        return $params;
    }

    public static function privacy_required($headers, $subject, $content, $request_id, $data) {
        if ($request_id > 0 && !empty($data['email'])) {
            self::required_envelope(['to' => $data['email'], 'subject' => $subject, 'message' => $content, 'headers' => $headers]);
        }
        return $headers;
    }
}

add_filter('pre_wp_mail', ['MissionMed_Global_Mail_Suppression', 'guard_wp_mail'], -1000000, 2);
add_filter('rest_request_before_callbacks', ['MissionMed_Global_Mail_Suppression', 'guard_medmail'], PHP_INT_MAX, 3);
foreach (['retrieve_password_notification_email'] as $hook) {
    add_filter($hook, ['MissionMed_Global_Mail_Suppression', 'required_envelope'], PHP_INT_MAX);
}
add_filter('woocommerce_mail_callback_params', ['MissionMed_Global_Mail_Suppression', 'woo_required'], PHP_INT_MAX, 2);
foreach (['user_request_action_email_headers', 'user_erasure_fulfillment_email_headers'] as $hook) {
    add_filter($hook, ['MissionMed_Global_Mail_Suppression', 'privacy_required'], PHP_INT_MAX, 5);
}
