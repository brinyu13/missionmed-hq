<?php
/**
 * Plugin Name: MissionMed Site Icon
 * Description: Preserves the canonical WordPress site icon and supplies favicon metadata to custom HTML renderers that bypass wp_head().
 * Version: 1.0.0
 */

declare(strict_types=1);

if (!defined('ABSPATH')) {
    exit;
}

const MM_SITE_ICON_ASSET_PATH = '/mu-plugins/missionmed-site-icon-assets';

/**
 * Return the versioned favicon metadata used only when a custom renderer omitted
 * WordPress's canonical site-icon markup.
 */
function mm_site_icon_fallback_markup(): string
{
    $base = content_url(MM_SITE_ICON_ASSET_PATH);

    $icons = [
        ['rel' => 'icon', 'type' => 'image/x-icon', 'sizes' => 'any', 'file' => 'favicon.ico', 'version' => 'e6c3dc8c741c'],
        ['rel' => 'icon', 'type' => 'image/png', 'sizes' => '16x16', 'file' => 'missionmed-favicon-16.png', 'version' => '07f37890a744'],
        ['rel' => 'icon', 'type' => 'image/png', 'sizes' => '32x32', 'file' => 'missionmed-favicon-32.png', 'version' => 'fbb72a5a7a55'],
        ['rel' => 'icon', 'type' => 'image/png', 'sizes' => '48x48', 'file' => 'missionmed-favicon-48.png', 'version' => 'e3c64ee9f867'],
        ['rel' => 'icon', 'type' => 'image/png', 'sizes' => '192x192', 'file' => 'missionmed-favicon-192.png', 'version' => '892448047cdb'],
        ['rel' => 'icon', 'type' => 'image/png', 'sizes' => '512x512', 'file' => 'missionmed-favicon-512.png', 'version' => '1ab7df4a8162'],
        ['rel' => 'apple-touch-icon', 'type' => '', 'sizes' => '180x180', 'file' => 'missionmed-favicon-180.png', 'version' => '49809dc9afc5'],
    ];

    $markup = [];
    foreach ($icons as $icon) {
        $type = $icon['type'] !== '' ? ' type="' . esc_attr($icon['type']) . '"' : '';
        $href = add_query_arg('v', $icon['version'], $base . '/' . $icon['file']);
        $markup[] = sprintf(
            '<link rel="%s"%s href="%s" sizes="%s" />',
            esc_attr($icon['rel']),
            $type,
            esc_url($href),
            esc_attr($icon['sizes'])
        );
    }

    return implode("\n", $markup) . "\n";
}

/**
 * Add metadata only to HTML documents that do not already declare a browser
 * icon. This keeps normal WordPress pages on the built-in site-icon mechanism.
 */
function mm_site_icon_inject_when_missing(string $html): string
{
    $head_end = stripos($html, '</head>');
    if ($head_end === false) {
        return $html;
    }

    $head = substr($html, 0, $head_end);
    if (preg_match('~<link\b[^>]*\brel\s*=\s*(["\'])[^"\']*\b(?:shortcut\s+)?icon\b[^"\']*\1[^>]*>~i', $head) === 1) {
        return $html;
    }

    return substr($html, 0, $head_end)
        . mm_site_icon_fallback_markup()
        . substr($html, $head_end);
}

/**
 * Buffer only likely public HTML navigations. Binary assets, APIs, feeds,
 * administrative requests, and non-GET requests remain untouched.
 */
function mm_site_icon_should_buffer_request(): bool
{
    if (is_admin()) {
        return false;
    }

    $method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
    if (!in_array($method, ['GET', 'HEAD'], true)) {
        return false;
    }

    $accept = strtolower((string) ($_SERVER['HTTP_ACCEPT'] ?? ''));
    if ($accept !== '' && !str_contains($accept, 'text/html') && !str_contains($accept, '*/*')) {
        return false;
    }

    $path = (string) wp_parse_url((string) ($_SERVER['REQUEST_URI'] ?? '/'), PHP_URL_PATH);
    if ($path === '' || str_starts_with($path, '/wp-json/') || str_starts_with($path, '/wp-admin/')) {
        return false;
    }

    return preg_match('~\.(?:css|js|json|xml|txt|map|png|jpe?g|gif|webp|svg|ico|woff2?|ttf|eot|pdf|zip|mp4|webm|mp3|wav)$~i', $path) !== 1;
}

add_action(
    'parse_request',
    static function (): void {
        if (mm_site_icon_should_buffer_request()) {
            ob_start('mm_site_icon_inject_when_missing');
        }
    },
    -1000
);
