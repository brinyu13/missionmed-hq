<?php
/**
 * Temporary, admin-only RankListIQ canary transport for RLQ-DUALMODE-0921A.
 *
 * This endpoint deliberately narrows access to manage_options. It does not
 * alter the production RankListIQ entitlement guard or any sibling product.
 */

declare(strict_types=1);

define('WP_USE_THEMES', false);
require_once __DIR__ . '/wp-load.php';

nocache_headers();
header('Cache-Control: private, no-store, max-age=0');
header('X-Frame-Options: SAMEORIGIN');
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

header('Content-Type: text/html; charset=UTF-8');
header('Content-Length: ' . (string) filesize($artifact));
readfile($artifact);
