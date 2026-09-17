<?php
declare(strict_types=1);

define('ABSPATH', __DIR__ . '/');
define('WPMU_PLUGIN_DIR', dirname(__DIR__, 4) . '/wp-content/mu-plugins');
define('WPMU_PLUGIN_URL', 'https://missionmedinstitute.com/wp-content/mu-plugins');
define('MINUTE_IN_SECONDS', 60);

$testNow = 0;
function apply_filters(string $name, $value) {
    global $testNow;
    return $name === 'mm_mr_0912_private_access_now' ? $testNow : $value;
}
function add_action(...$args): void {}
function add_filter(...$args): void {}
function get_option(string $name, $default = false) { return $name === 'mmed_mr_p0_enabled' ? 'yes' : $default; }
function is_user_logged_in(): bool { return false; }
function current_user_can(string $capability): bool { return false; }
function wp_salt(string $scheme = 'auth'): string { return 'unit-test-' . $scheme . '-salt'; }
function sanitize_text_field(string $value): string { return trim(strip_tags($value)); }
function sanitize_key(string $value): string { return preg_replace('/[^a-z0-9_-]/', '', strtolower($value)); }
function wp_unslash(string $value): string { return stripslashes($value); }
function is_ssl(): bool { return true; }
function wp_json_encode($value, int $flags = 0): string|false { return json_encode($value, $flags); }
function home_url(string $path = ''): string { return 'https://missionmedinstitute.com' . ($path === '' ? '' : '/' . ltrim($path, '/')); }
function wp_validate_redirect(string $location, string $fallback = ''): string {
    return str_starts_with($location, 'https://missionmedinstitute.com/') ? $location : $fallback;
}
function add_query_arg(array $args, string $url): string {
    return $url . (str_contains($url, '?') ? '&' : '?') . http_build_query($args);
}
function absint($value): int { return abs((int) $value); }
function wp_doing_ajax(): bool { return false; }

require dirname(__DIR__, 4) . '/wp-content/mu-plugins/missionmed-mr-p0.php';

function expect_true(bool $condition, string $label): void {
    if (!$condition) {
        fwrite(STDERR, "FAIL: {$label}\n");
        exit(1);
    }
    echo "PASS: {$label}\n";
}

expect_true(mm_mr_0912_private_open_timestamp() === 1789833600, 'open instant is 2026-09-19 12:00 America/New_York');

$testNow = 1789833599;
expect_true(mm_mr_0912_private_window_active(), 'private gate is active one second before public opening');
unset($_COOKIE[MM_MR_0912_PRIVATE_ACCESS_COOKIE]);
expect_true(!mm_mr_0912_private_access_granted(), 'no cookie does not grant private enrollment');

$expires = mm_mr_0912_private_open_timestamp();
$_COOKIE[MM_MR_0912_PRIVATE_ACCESS_COOKIE] = 'v1.' . $expires . '.' . mm_mr_0912_private_access_signature('v1.' . $expires);
expect_true(mm_mr_0912_private_access_granted(), 'signed browser access persists before opening');
$_COOKIE[MM_MR_0912_PRIVATE_ACCESS_COOKIE] .= 'tampered';
expect_true(!mm_mr_0912_private_access_granted(), 'tampered access cookie fails closed');

$resumePath = '/checkout/?add-to-cart=5504&variation_id=5867&attribute_pa_start-date=session-d-start-date';
$token = mm_mr_0912_private_resume_token($resumePath, 'interview_week');
$resume = mm_mr_0912_private_resume_from_token($token);
expect_true(is_array($resume) && $resume['offer'] === 'interview_week', 'signed resume token preserves Interview Week identity');
expect_true(is_array($resume) && str_contains($resume['url'], 'variation_id=5867'), 'signed resume token preserves direct destination');
expect_true(mm_mr_0912_private_resume_from_token($token . 'x') === null, 'tampered resume token fails closed');
expect_true(mm_mr_0912_private_resume_from_token(mm_mr_0912_private_resume_token('//example.com', 'complete')) === null, 'off-site destination fails closed');
expect_true(mm_mr_0912_private_offer_for_ids(5504, 5867) === 'interview_week', 'Interview Week identity resolves');
expect_true(mm_mr_0912_private_offer_for_ids(3576, 5865) === 'complete', 'Complete identity resolves');
expect_true(mm_mr_0912_private_offer_for_ids(999, 0) === null, 'unrelated product is not gated');

$testNow = 1789833600;
unset($_COOKIE[MM_MR_0912_PRIVATE_ACCESS_COOKIE]);
expect_true(!mm_mr_0912_private_window_active(), 'gate opens exactly at noon ET');
expect_true(mm_mr_0912_private_access_granted(), 'public enrollment requires no code at the opening instant');

$source = file_get_contents(dirname(__DIR__, 4) . '/wp-content/mu-plugins/missionmed-mr-p0.php');
expect_true(is_string($source) && !str_contains($source, 'DRJ' . '2026'), 'raw access code is absent from deployed PHP source');
expect_true(is_string($source) && preg_match('/20[- ]?(seat|student)|(seat|student)[^;\n]{0,40}\b20\b/i', $source) !== 1, 'no 20-seat or 20-student capacity gate exists');
expect_true(is_string($source) && str_contains($source, "'backend_seat_cap' => false"), 'runtime contract explicitly disables a backend seat cap');

echo "PRIVATE_ACCESS_UNIT_PASS assertions=17\n";
