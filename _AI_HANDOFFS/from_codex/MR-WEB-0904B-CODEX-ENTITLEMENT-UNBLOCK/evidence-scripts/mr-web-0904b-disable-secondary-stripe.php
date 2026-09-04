<?php
/**
 * MR-WEB-0904B: disable the unconfigured test-mode duplicate Stripe gateway.
 * The official live WooCommerce Stripe gateway remains enabled.
 */

if (!defined('ABSPATH')) {
    fwrite(STDERR, "Run through wp eval-file.\n");
    exit(2);
}

$mode = in_array('apply', $args ?? [], true) ? 'apply'
    : (in_array('rollback', $args ?? [], true) ? 'rollback' : 'verify');
$privateDir = '/www/theresidencyacademy_209/private/mr-web-0904b';
$preimagePath = $privateDir . '/secondary-stripe-gateway-preimage.json';
$optionKey = 'woocommerce_stripe_cc_settings';

if ($mode === 'apply') {
    if (!is_dir($privateDir) && !mkdir($privateDir, 0700, true) && !is_dir($privateDir)) {
        throw new RuntimeException('Unable to create private preimage directory.');
    }
    if (file_exists($preimagePath)) {
        throw new RuntimeException('Preimage already exists; refusing to overwrite it.');
    }
    $before = [
        'timestamp_utc' => gmdate('c'),
        'option_exists' => get_option($optionKey, null) !== null,
        'settings' => get_option($optionKey, []),
    ];
    if (file_put_contents($preimagePath, wp_json_encode($before, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)) === false) {
        throw new RuntimeException('Unable to write private preimage.');
    }
    chmod($preimagePath, 0600);
    $settings = is_array($before['settings']) ? $before['settings'] : [];
    $settings['enabled'] = 'no';
    update_option($optionKey, $settings, false);
}

if ($mode === 'rollback') {
    if (!file_exists($preimagePath)) throw new RuntimeException('Private preimage is missing.');
    $before = json_decode((string) file_get_contents($preimagePath), true);
    if (!is_array($before) || !array_key_exists('settings', $before)) {
        throw new RuntimeException('Private preimage is invalid.');
    }
    if (($before['option_exists'] ?? false) === false) delete_option($optionKey);
    else update_option($optionKey, $before['settings'], false);
}

$gateway = WC()->payment_gateways()->payment_gateways()['stripe_cc'] ?? null;
$result = [
    'timestamp_utc' => gmdate('c'),
    'mode' => $mode,
    'official_live_stripe_enabled' => (get_option('woocommerce_stripe_settings', [])['enabled'] ?? null) === 'yes',
    'secondary_gateway_class' => $gateway ? get_class($gateway) : null,
    'secondary_gateway_enabled' => $gateway ? $gateway->enabled : null,
    'secondary_gateway_disabled' => ($gateway ? $gateway->enabled : null) === 'no',
    'preimage_path' => $preimagePath,
    'preimage_mode' => file_exists($preimagePath) ? substr(sprintf('%o', fileperms($preimagePath)), -4) : null,
];
echo wp_json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES), "\n";
if ($mode !== 'rollback' && (!$result['official_live_stripe_enabled'] || !$result['secondary_gateway_disabled'])) exit(1);
