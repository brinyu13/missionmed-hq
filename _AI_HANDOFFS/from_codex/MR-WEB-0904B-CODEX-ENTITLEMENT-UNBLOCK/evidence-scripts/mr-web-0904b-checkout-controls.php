<?php
/**
 * MR-WEB-0904B bounded checkout controls.
 *
 * Usage: wp eval-file mr-web-0904b-checkout-controls.php -- apply|verify|rollback
 * The apply mode writes a private on-host preimage before making four exact,
 * reversible controls: card-only Stripe fallback, no express checkout, and
 * Woo Memberships discount exclusions for the two launch products.
 */

if (!defined('ABSPATH')) {
    fwrite(STDERR, "Run through wp eval-file.\n");
    exit(2);
}

$mode = in_array('apply', $args ?? [], true) ? 'apply'
    : (in_array('rollback', $args ?? [], true) ? 'rollback' : 'verify');
$privateDir = '/www/theresidencyacademy_209/private/mr-web-0904b';
$preimagePath = $privateDir . '/checkout-controls-preimage.json';
$productIds = [3576, 5504];

function mr0904b_checkout_snapshot(array $productIds): array {
    $stripe = get_option('woocommerce_stripe_settings', []);
    $products = [];
    foreach ($productIds as $productId) {
        $product = function_exists('wc_get_product') ? wc_get_product($productId) : null;
        $products[(string) $productId] = [
            'exclude_discounts_meta' => get_post_meta($productId, '_wc_memberships_exclude_discounts', true),
            'is_excluded' => function_exists('wc_memberships') && $product
                ? wc_memberships()->get_member_discounts_instance()->is_product_excluded_from_member_discounts($product)
                : null,
        ];
    }
    return [
        'timestamp_utc' => gmdate('c'),
        'stripe' => $stripe,
        'products' => $products,
    ];
}

function mr0904b_checkout_safe_view(array $snapshot): array {
    $keys = [
        'enabled',
        'express_checkout',
        'optimized_checkout_element',
        'pmc_enabled',
        'stripe_upe_payment_method_order',
        'upe_checkout_experience_accepted_payments',
        'upe_checkout_experience_enabled',
    ];
    $view = [];
    foreach ($keys as $key) {
        $view[$key] = $snapshot['stripe'][$key] ?? null;
    }
    return [
        'timestamp_utc' => $snapshot['timestamp_utc'],
        'stripe' => $view,
        'products' => $snapshot['products'],
    ];
}

if ($mode === 'apply') {
    if (!is_dir($privateDir) && !mkdir($privateDir, 0700, true) && !is_dir($privateDir)) {
        throw new RuntimeException('Unable to create private preimage directory.');
    }
    if (file_exists($preimagePath)) {
        throw new RuntimeException('Preimage already exists; refusing to overwrite it.');
    }
    $before = mr0904b_checkout_snapshot($productIds);
    if (file_put_contents($preimagePath, wp_json_encode($before, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)) === false) {
        throw new RuntimeException('Unable to write private preimage.');
    }
    chmod($preimagePath, 0600);

    $stripe = $before['stripe'];
    $stripe['enabled'] = 'yes';
    $stripe['express_checkout'] = 'no';
    $stripe['optimized_checkout_element'] = 'no';
    $stripe['pmc_enabled'] = 'no';
    $stripe['stripe_upe_payment_method_order'] = ['card'];
    $stripe['upe_checkout_experience_accepted_payments'] = ['card'];
    $stripe['upe_checkout_experience_enabled'] = 'yes';
    update_option('woocommerce_stripe_settings', $stripe, false);

    if (!function_exists('wc_memberships')) {
        throw new RuntimeException('WooCommerce Memberships is unavailable.');
    }
    $discounts = wc_memberships()->get_member_discounts_instance();
    foreach ($productIds as $productId) {
        if ($discounts->set_product_excluded_from_member_discounts($productId) !== 1) {
            throw new RuntimeException('Unable to exclude launch product ' . $productId . ' from member discounts.');
        }
    }
    if (function_exists('wc_delete_product_transients')) {
        foreach ($productIds as $productId) wc_delete_product_transients($productId);
    }
}

if ($mode === 'rollback') {
    if (!file_exists($preimagePath)) {
        throw new RuntimeException('Private preimage is missing.');
    }
    $before = json_decode((string) file_get_contents($preimagePath), true);
    if (!is_array($before) || !isset($before['stripe'], $before['products'])) {
        throw new RuntimeException('Private preimage is invalid.');
    }
    update_option('woocommerce_stripe_settings', $before['stripe'], false);
    foreach ($productIds as $productId) {
        $meta = $before['products'][(string) $productId]['exclude_discounts_meta'] ?? '';
        if ($meta === '') delete_post_meta($productId, '_wc_memberships_exclude_discounts');
        else update_post_meta($productId, '_wc_memberships_exclude_discounts', $meta);
    }
    if (function_exists('wc_memberships')) {
        wc_memberships()->get_member_discounts_instance()->update_excluded_member_discounts_products_cache();
    }
}

$after = mr0904b_checkout_snapshot($productIds);
$safe = mr0904b_checkout_safe_view($after);
$safe['mode'] = $mode;
$safe['preimage_path'] = $preimagePath;
$safe['preimage_mode'] = file_exists($preimagePath) ? substr(sprintf('%o', fileperms($preimagePath)), -4) : null;
$safe['checks'] = [
    'stripe_enabled' => ($safe['stripe']['enabled'] ?? null) === 'yes',
    'card_only_local_fallback' => ($safe['stripe']['pmc_enabled'] ?? null) === 'no'
        && ($safe['stripe']['stripe_upe_payment_method_order'] ?? null) === ['card']
        && ($safe['stripe']['upe_checkout_experience_accepted_payments'] ?? null) === ['card'],
    'express_checkout_disabled' => ($safe['stripe']['express_checkout'] ?? null) === 'no',
    'complete_discount_excluded' => ($safe['products']['3576']['exclude_discounts_meta'] ?? null) === 'yes'
        && ($safe['products']['3576']['is_excluded'] ?? null) === true,
    'essentials_discount_excluded' => ($safe['products']['5504']['exclude_discounts_meta'] ?? null) === 'yes'
        && ($safe['products']['5504']['is_excluded'] ?? null) === true,
];
$safe['pass_count'] = count(array_filter($safe['checks']));
$safe['check_count'] = count($safe['checks']);
echo wp_json_encode($safe, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES), "\n";

if ($mode !== 'rollback' && $safe['pass_count'] !== $safe['check_count']) exit(1);
