<?php

if (!defined('ABSPATH')) {
    fwrite(STDERR, "Run with wp eval-file.\n");
    exit(1);
}

global $kinsta_muplugin;

$report = [
    'schema' => 'missionmed.mr_web_0904c.cache_purge.v1',
    'attempted_at_utc' => gmdate('c'),
    'elementor' => ['needed' => false, 'reason' => 'No Elementor document data or generated Elementor CSS was changed.'],
    'autoptimize' => ['cleared_by_cli' => true],
];

if (!is_object($kinsta_muplugin) || !isset($kinsta_muplugin->kinsta_cache_purge)) {
    $report['kinsta'] = ['available' => false];
} else {
    $purger = $kinsta_muplugin->kinsta_cache_purge;
    $object = $purger->purge_complete_object_cache();
    $site = $purger->purge_complete_site_cache();
    $cdn = $purger->purge_complete_cdn_cache();
    $summarize = static function ($response): array {
        if (is_wp_error($response)) {
            return ['ok' => false, 'error_code' => $response->get_error_code()];
        }
        return [
            'ok' => is_array($response) && wp_remote_retrieve_response_code($response) >= 200 && wp_remote_retrieve_response_code($response) < 300,
            'http_code' => is_array($response) ? wp_remote_retrieve_response_code($response) : null,
        ];
    };
    $report['kinsta'] = [
        'available' => true,
        'object_cache_flush' => (bool) $object,
        'site_cache' => $summarize($site),
        'cdn_cache' => $summarize($cdn),
    ];
}

echo wp_json_encode($report, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . PHP_EOL;
