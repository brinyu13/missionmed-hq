<?php
/** MR-WEB-0906A narrow retry for the Kinsta CDN cache layer. */
declare(strict_types=1);

if (!defined('ABSPATH')) require '/www/theresidencyacademy_209/public/wp-load.php';

$report = [
    'schema' => 'missionmed.mr_web_0906a.kinsta_cdn_purge.v1',
    'attempted_at_utc' => gmdate('c'),
    'available' => false,
    'ok' => false,
];

global $kinsta_muplugin;
if (is_object($kinsta_muplugin) && isset($kinsta_muplugin->kinsta_cache_purge)) {
    $report['available'] = true;
    $response = $kinsta_muplugin->kinsta_cache_purge->purge_complete_cdn_cache();
    if (is_wp_error($response)) {
        $report['error_code'] = $response->get_error_code();
    } else {
        $httpCode = is_array($response) ? wp_remote_retrieve_response_code($response) : null;
        $report['http_code'] = $httpCode;
        $report['ok'] = is_int($httpCode) && $httpCode >= 200 && $httpCode < 300;
    }
}

echo wp_json_encode($report, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES), "\n";
exit($report['ok'] ? 0 : 1);
