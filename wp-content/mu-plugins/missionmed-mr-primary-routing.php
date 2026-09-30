<?php
/**
 * Plugin Name: Mission Residency canonical presentation routing
 * Description: Founder-approved /missionresidency/ promotion; public URL migration only.
 * Authority: Founder promotion directive, 2026-09-30 (MR-PRIMARY-PROMOTION-0930).
 * Rollback: remove this exact new plugin; no stored route, commerce or content mutations.
 */
defined('ABSPATH') || exit;

function mm_mr_primary_route_enabled(): bool { return true; }

/** Change only this site's exact legacy landing path. Keep query and fragment bytes. */
function mm_mr_primary_public_url($url) {
    if (!is_string($url)) return $url;
    return preg_replace(
        '~^((?:https?:)?//(?:www\\.)?missionmedinstitute\\.com)?/mission-residency/?(?=[?#]|$)~i',
        '$1/missionresidency/',
        $url
    );
}

// Existing canonical URL builders (including homepage rotating hero frame data).
add_filter('home_url', 'mm_mr_primary_public_url', 99);
add_filter('page_link', 'mm_mr_primary_public_url', 99);
add_filter('nav_menu_link_attributes', static function ($attrs) {
    if (isset($attrs['href'])) $attrs['href'] = mm_mr_primary_public_url($attrs['href']);
    return $attrs;
}, 99);

// Retain the existing published WordPress page/sitemap record; migrate only its URL.
add_filter('wpseo_sitemap_entry', static function ($entry) {
    if (is_array($entry) && isset($entry['loc'])) $entry['loc'] = mm_mr_primary_public_url($entry['loc']);
    return $entry;
}, 99);
add_filter('wp_sitemaps_posts_entry', static function ($entry) {
    if (is_array($entry) && isset($entry['loc'])) $entry['loc'] = mm_mr_primary_public_url($entry['loc']);
    return $entry;
}, 99);

// True one-hop 301, before either presentation renderer. Never touch POST/payment requests.
add_action('template_redirect', static function (): void {
    if (!in_array($_SERVER['REQUEST_METHOD'] ?? 'GET', ['GET', 'HEAD'], true)) return;
    $path = parse_url((string) ($_SERVER['REQUEST_URI'] ?? ''), PHP_URL_PATH);
    if (!in_array($path, ['/mission-residency', '/mission-residency/'], true)) return;
    $query = (string) ($_SERVER['QUERY_STRING'] ?? '');
    $target = 'https://missionmedinstitute.com/missionresidency/' . ($query !== '' ? '?' . $query : '');
    // No fragment in Location: browsers retain incoming anchors. Matching legacy anchors exist.
    wp_safe_redirect($target, 301, 'MissionMed canonical Mission Residency');
    exit;
}, -1100);

// Hardcoded Elementor/current marketing navigation: parse only HTML anchor hrefs.
// Do not rewrite scripts, text, historical records, REST/admin data, or stored page content.
add_action('template_redirect', static function (): void {
    if (is_admin() || wp_doing_ajax() || (defined('REST_REQUEST') && REST_REQUEST)
        || !in_array($_SERVER['REQUEST_METHOD'] ?? 'GET', ['GET', 'HEAD'], true)
        || is_feed() || !class_exists('WP_HTML_Tag_Processor')) return;
    ob_start(static function (string $html): string {
        if (!preg_match('/<html(?:\\s|>)/i', $html) || strpos($html, 'mission-residency') === false) return $html;
        $tags = new WP_HTML_Tag_Processor($html);
        while ($tags->next_tag('A')) {
            $href = $tags->get_attribute('href');
            if (!is_string($href)) continue;
            $next = mm_mr_primary_public_url($href);
            // Current homepage legacy-waitlist CTAs are later normalized by existing JS.
            // Send them directly to the canonical page before that script runs.
            if (preg_match('~^(?:https?://(?:www\\.)?missionmedinstitute\\.com)?/mission-residency-waitlist/?(?=[?#]|$)~i', $href)) {
                $next = preg_replace('~/mission-residency-waitlist/?(?=[?#]|$)~', '/missionresidency/', $href);
            }
            if ($next !== $href) $tags->set_attribute('href', $next);
            // The inherited shared header restores href from this exact data attribute.
            $source = $tags->get_attribute('data-mm-href');
            if (is_string($source)) $tags->set_attribute('data-mm-href', mm_mr_primary_public_url($source));
        }
        return $tags->get_updated_html();
    });
}, -2000);
