<?php
/**
 * Plugin Name: Mission Residency USCE-framework presentation
 * Description: Isolated presentation at /missionresidency/. Indexing follows canonical promotion provider. No commerce writes.
 * Authority: Founder ASTRA6_MISSION_RESIDENCY_ALT_FOREMAN, 2026-09-30.
 */
defined('ABSPATH') || exit;

add_action('template_redirect', static function (): void {
    $path = parse_url((string) ($_SERVER['REQUEST_URI'] ?? ''), PHP_URL_PATH);
    if ($path !== '/missionresidency/' && $path !== '/missionresidency') return;
    if (!in_array($_SERVER['REQUEST_METHOD'] ?? 'GET', ['GET', 'HEAD'], true)) {
        status_header(405);
        header('Allow: GET, HEAD');
        exit;
    }
    $root = __DIR__ . '/missionmed-mr-alternate-assets';
    if (!is_readable($root . '/page.php') || !function_exists('mm_mr_p0_runtime_config')) {
        status_header(503);
        nocache_headers();
        header('X-Robots-Tag: noindex, follow');
        echo 'This page is temporarily unavailable. Please contact MissionMed through /contact/.';
        exit;
    }
    $promoted = function_exists('mm_mr_primary_route_enabled') && mm_mr_primary_route_enabled();
    $config = mm_mr_p0_runtime_config(); // Read existing canonical commerce; never set products/options.
    $iw = $config['offers']['interview_week'] ?? [];
    $complete = $config['offers']['complete'] ?? [];
    $money = static fn($value): string => is_numeric($value) ? '$' . number_format((float) $value, 0) : 'See current tuition';
    $iwPrice = $money($iw['runtime']['woo_price'] ?? null);
    $zellePrice = $money($iw['zelle_price'] ?? null);
    $completePrice = $money($complete['runtime']['woo_price'] ?? null);
    $early = ($complete['runtime']['woo_price'] ?? null) == 3099;
    $assetBase = content_url('/mu-plugins/missionmed-mr-alternate-assets/');
    $asset = static function (string $name) use ($assetBase, $root): string {
        return esc_url($assetBase . $name . '?v=' . substr(hash_file('sha256', $root . '/' . $name), 0, 12));
    };
    status_header(200);
    nocache_headers(); // Prices are current Woo truth, not a cached campaign snapshot.
    header('Content-Type: text/html; charset=UTF-8');
    header('X-Robots-Tag: ' . ($promoted ? 'index, follow' : 'noindex, follow'));
    header($promoted ? 'X-MissionMed-Primary: usce-framework-v1' : 'X-MissionMed-Alternate: usce-framework-v1');
    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'HEAD') exit;
    require $root . '/page.php';
    exit;
}, -999);
