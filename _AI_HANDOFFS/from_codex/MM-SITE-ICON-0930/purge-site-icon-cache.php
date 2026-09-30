<?php

if (!defined('ABSPATH')) {
    require '/www/theresidencyacademy_209/public/wp-load.php';
}

$report = [
    'attempted_at_utc' => gmdate('c'),
    'wordpress_object_cache' => (bool) wp_cache_flush(),
    'kinsta' => ['available' => false],
];

global $kinsta_muplugin;
if (is_object($kinsta_muplugin) && isset($kinsta_muplugin->kinsta_cache_purge)) {
    $purger = $kinsta_muplugin->kinsta_cache_purge;
    $summarize = static function ($response): array {
        if (is_wp_error($response)) {
            return ['ok' => false, 'error' => $response->get_error_code()];
        }
        $status = is_array($response) ? wp_remote_retrieve_response_code($response) : null;
        return ['ok' => is_int($status) && $status >= 200 && $status < 300, 'http_code' => $status];
    };
    $report['kinsta'] = [
        'available' => true,
        'site_cache' => $summarize($purger->purge_complete_site_cache()),
        'cdn_cache' => $summarize($purger->purge_complete_cdn_cache()),
    ];
}

$report['pass'] = $report['wordpress_object_cache']
    && ($report['kinsta']['site_cache']['ok'] ?? false)
    && ($report['kinsta']['cdn_cache']['ok'] ?? false);

echo wp_json_encode($report, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . PHP_EOL;
exit($report['pass'] ? 0 : 1);
