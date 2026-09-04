<?php
/** MR-WEB-0904C bounded live-route activation and exact option rollback. */
if (!defined('ABSPATH')) {
    fwrite(STDERR, "Run through wp eval-file.\n");
    exit(2);
}

$mode = in_array('apply', $args ?? [], true) ? 'apply'
    : (in_array('rollback', $args ?? [], true) ? 'rollback' : 'verify');
$privateDir = '/www/theresidencyacademy_209/private/mr-web-0904c';
$preimagePath = $privateDir . '/route-options-preimage.json';
$keys = ['mmed_mr_p0_enabled', 'mmed_mr_p0_verified_live_at'];

function mr0904c_route_snapshot(array $keys): array {
    $rows = [];
    foreach ($keys as $key) {
        $rows[$key] = [
            'exists' => get_option($key, '__MR0904C_MISSING__') !== '__MR0904C_MISSING__',
            'value' => get_option($key, null),
        ];
    }
    return $rows;
}

if ($mode === 'apply') {
    if (!is_dir($privateDir) && !mkdir($privateDir, 0700, true) && !is_dir($privateDir)) {
        throw new RuntimeException('Unable to create private preimage directory.');
    }
    if (file_exists($preimagePath)) throw new RuntimeException('Preimage already exists; refusing overwrite.');
    $before = ['timestamp_utc' => gmdate('c'), 'options' => mr0904c_route_snapshot($keys)];
    if (file_put_contents($preimagePath, wp_json_encode($before, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)) === false) {
        throw new RuntimeException('Unable to write route preimage.');
    }
    chmod($preimagePath, 0600);
    update_option('mmed_mr_p0_verified_live_at', gmdate('c'), false);
    update_option('mmed_mr_p0_enabled', 'yes', false);
}

if ($mode === 'rollback') {
    if (!file_exists($preimagePath)) throw new RuntimeException('Route preimage missing.');
    $before = json_decode((string) file_get_contents($preimagePath), true);
    if (!is_array($before) || !isset($before['options'])) throw new RuntimeException('Route preimage invalid.');
    foreach ($keys as $key) {
        $row = $before['options'][$key] ?? null;
        if (!is_array($row)) throw new RuntimeException('Route option preimage incomplete.');
        if (!empty($row['exists'])) update_option($key, $row['value'], false);
        else delete_option($key);
    }
}

$after = mr0904c_route_snapshot($keys);
$checks = [
    'route_enabled' => ($after['mmed_mr_p0_enabled']['value'] ?? null) === 'yes',
    'verified_live_timestamp' => is_string($after['mmed_mr_p0_verified_live_at']['value'] ?? null)
        && strtotime((string) $after['mmed_mr_p0_verified_live_at']['value']) !== false,
    'mu_plugin_present' => is_readable(WPMU_PLUGIN_DIR . '/missionmed-mr-p0.php'),
    'main_asset_present' => is_readable(WPMU_PLUGIN_DIR . '/missionmed-mr-p0-assets/pages/mission-residency.html'),
    'complete_asset_present' => is_readable(WPMU_PLUGIN_DIR . '/missionmed-mr-p0-assets/pages/program-complete.html'),
    'essentials_asset_present' => is_readable(WPMU_PLUGIN_DIR . '/missionmed-mr-p0-assets/pages/program-essentials.html'),
    'compare_asset_present' => is_readable(WPMU_PLUGIN_DIR . '/missionmed-mr-p0-assets/pages/compare.html'),
    '360_asset_present' => is_readable(WPMU_PLUGIN_DIR . '/missionmed-mr-p0-assets/pages/program-360.html'),
];

echo wp_json_encode([
    'schema' => 'missionmed.mr_web_0904c.route.v1',
    'mode' => $mode,
    'verified_at_utc' => gmdate('c'),
    'preimage_path' => $preimagePath,
    'preimage_mode' => file_exists($preimagePath) ? substr(sprintf('%o', fileperms($preimagePath)), -4) : null,
    'enabled' => $after['mmed_mr_p0_enabled']['value'] ?? null,
    'verified_live_at' => $after['mmed_mr_p0_verified_live_at']['value'] ?? null,
    'checks' => $checks,
    'pass_count' => count(array_filter($checks)),
    'check_count' => count($checks),
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES), "\n";

if ($mode === 'rollback') exit(0);
exit(count(array_filter($checks)) === count($checks) ? 0 : 1);
