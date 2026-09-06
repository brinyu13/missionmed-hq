<?php
/** MR-WEB-0906A selective Elementor, Autoptimize, object, Kinsta page, and CDN cache purge. */
declare(strict_types=1);

if (!defined('ABSPATH')) require '/www/theresidencyacademy_209/public/wp-load.php';

$report = [
    'schema' => 'missionmed.mr_web_0906a.cache_purge.v1',
    'attempted_at_utc' => gmdate('c'),
];

$report['elementor'] = ['available' => false, 'cleared' => false];
if (class_exists('Elementor\\Plugin') && isset(\Elementor\Plugin::$instance->files_manager)) {
    \Elementor\Plugin::$instance->files_manager->clear_cache();
    $report['elementor'] = ['available' => true, 'cleared' => true];
}

$report['autoptimize'] = ['available' => false, 'cleared' => false];
if (class_exists('autoptimizeCache') && method_exists('autoptimizeCache', 'clearall')) {
    autoptimizeCache::clearall();
    $report['autoptimize'] = ['available' => true, 'cleared' => true];
}

$report['wordpress_object_cache'] = ['cleared' => (bool) wp_cache_flush()];

global $kinsta_muplugin;
if (!is_object($kinsta_muplugin) || !isset($kinsta_muplugin->kinsta_cache_purge)) {
    $report['kinsta'] = ['available' => false];
} else {
    $purger = $kinsta_muplugin->kinsta_cache_purge;
    $summarize = static function ($response): array {
        if (is_wp_error($response)) return ['ok' => false, 'error_code' => $response->get_error_code()];
        $httpCode = is_array($response) ? wp_remote_retrieve_response_code($response) : null;
        return ['ok' => is_int($httpCode) && $httpCode >= 200 && $httpCode < 300, 'http_code' => $httpCode];
    };
    $report['kinsta'] = [
        'available' => true,
        'object_cache_flush' => (bool) $purger->purge_complete_object_cache(),
        'site_cache' => $summarize($purger->purge_complete_site_cache()),
        'cdn_cache' => $summarize($purger->purge_complete_cdn_cache()),
    ];
}

$checks = [
    'elementor_cache_cleared' => ($report['elementor']['cleared'] ?? false) === true,
    'autoptimize_cache_cleared' => ($report['autoptimize']['cleared'] ?? false) === true,
    'wordpress_object_cache_cleared' => ($report['wordpress_object_cache']['cleared'] ?? false) === true,
    'kinsta_object_cache_cleared' => ($report['kinsta']['object_cache_flush'] ?? false) === true,
    'kinsta_site_cache_cleared' => ($report['kinsta']['site_cache']['ok'] ?? false) === true,
    'kinsta_cdn_cache_cleared' => ($report['kinsta']['cdn_cache']['ok'] ?? false) === true,
];
$report['checks'] = $checks;
$report['pass_count'] = count(array_filter($checks));
$report['check_count'] = count($checks);

echo wp_json_encode($report, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES), "\n";
exit(count(array_filter($checks)) === count($checks) ? 0 : 1);
