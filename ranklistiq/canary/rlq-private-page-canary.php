<?php
/**
 * Temporary protected transport for the RLQ-DUALMODE-0921A canary.
 *
 * Serves the candidate only on private page 9174 or one fixed unlinked path,
 * and only to administrators.
 * Remove this file after promotion or withdrawal.
 */

if (!defined('ABSPATH')) {
    exit;
}

add_action(
    'template_redirect',
    static function (): void {
        $page_id = (int) get_queried_object_id();
        $request_path = isset($_SERVER['REQUEST_URI'])
            ? (string) wp_parse_url(wp_unslash($_SERVER['REQUEST_URI']), PHP_URL_PATH)
            : '';
        $is_private_page = 9174 === $page_id;
        $is_path_route = '/qa-0921a' === untrailingslashit($request_path);

        if (!$is_private_page && !$is_path_route) {
            return;
        }

        nocache_headers();
        header('Cache-Control: private, no-store, max-age=0');
        header('X-RLQ-Preview: RLQ-DUALMODE-0921A');

        if (!is_user_logged_in() || !current_user_can('manage_options')) {
            status_header(404);
            header('Content-Type: text/plain; charset=UTF-8');
            echo 'Not found';
            exit;
        }

        $artifact = '/tmp/rlq-runtime-0921a/rank_list_engine.RLQ-DUALMODE-0921A.html';
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
