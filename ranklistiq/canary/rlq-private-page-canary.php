<?php
/**
 * Temporary protected transport for the RLQ-DUALMODE-0921A canary.
 *
 * Serves the candidate only on private page 9174 and only to administrators.
 * Remove this file after promotion or withdrawal.
 */

if (!defined('ABSPATH')) {
    exit;
}

add_action(
    'template_redirect',
    static function (): void {
        if ((int) get_queried_object_id() !== 9174) {
            return;
        }

        nocache_headers();
        header('Cache-Control: private, no-store, max-age=0');
        header('X-RLQ-Canary: RLQ-DUALMODE-0921A');

        if (!is_user_logged_in() || !current_user_can('manage_options')) {
            status_header(404);
            header('Content-Type: text/plain; charset=UTF-8');
            echo 'Not found';
            exit;
        }

        $artifact = '/www/theresidencyacademy_209/private/rlq-dualmode-0921a-20260921T133235Z/rank_list_engine.RLQ-DUALMODE-0921A.CANARY.html';
        if (!is_readable($artifact)) {
            status_header(503);
            header('Content-Type: text/plain; charset=UTF-8');
            echo 'Canary unavailable';
            exit;
        }

        status_header(200);
        header('Content-Type: text/html; charset=UTF-8');
        header('Content-Length: ' . (string) filesize($artifact));
        readfile($artifact);
        exit;
    },
    0
);

