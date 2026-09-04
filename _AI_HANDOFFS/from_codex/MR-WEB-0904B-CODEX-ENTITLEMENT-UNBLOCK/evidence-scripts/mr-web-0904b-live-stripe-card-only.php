<?php
/**
 * MR-WEB-0904B: make the live Woo-connected Stripe default configuration card-only.
 * Stores an exact method-preference preimage on the production host first.
 */

if (!defined('ABSPATH')) {
    fwrite(STDERR, "Run through wp eval-file.\n");
    exit(2);
}

$mode = in_array('apply', $args ?? [], true) ? 'apply'
    : (in_array('rollback', $args ?? [], true) ? 'rollback' : 'verify');
$configurationId = 'pmc_1TClmnC5UTtLEXqwuzKkRaR0';
$privateDir = '/www/theresidencyacademy_209/private/mr-web-0904b';
$preimagePath = $privateDir . '/live-stripe-default-config-preimage.json';
$controlledMethods = ['card', 'link', 'klarna', 'affirm', 'us_bank_account'];

WC_Stripe_API::set_secret_key_for_mode('live');

function mr0904b_stripe_config(string $id) {
    return WC_Stripe_API::request([], 'payment_method_configurations/' . rawurlencode($id), 'GET');
}

function mr0904b_method_preferences($config, array $methods): array {
    $result = [];
    foreach ($methods as $method) {
        $entry = $config->{$method} ?? null;
        $result[$method] = [
            'available' => $entry->available ?? null,
            'preference' => $entry->display_preference->preference ?? null,
            'value' => $entry->display_preference->value ?? null,
        ];
    }
    return $result;
}

function mr0904b_stripe_update_config(string $id, array $preferences): void {
    $request = [];
    foreach ($preferences as $method => $preference) {
        $request[$method] = ['display_preference' => ['preference' => $preference]];
    }
    WC_Stripe_API::request($request, 'payment_method_configurations/' . rawurlencode($id), 'POST');
}

if ($mode === 'apply') {
    $before = mr0904b_stripe_config($configurationId);
    if (($before->livemode ?? false) !== true || ($before->is_default ?? false) !== true) {
        throw new RuntimeException('Target is not the expected live default payment method configuration.');
    }
    $preferences = mr0904b_method_preferences($before, $controlledMethods);
    if (($preferences['card']['value'] ?? null) !== 'on') {
        throw new RuntimeException('Card is not enabled in the target configuration.');
    }
    if (!is_dir($privateDir) && !mkdir($privateDir, 0700, true) && !is_dir($privateDir)) {
        throw new RuntimeException('Unable to create private preimage directory.');
    }
    if (file_exists($preimagePath)) {
        throw new RuntimeException('Preimage already exists; refusing to overwrite it.');
    }
    $preimage = [
        'timestamp_utc' => gmdate('c'),
        'configuration_id' => $configurationId,
        'livemode' => true,
        'is_default' => true,
        'methods' => $preferences,
    ];
    if (file_put_contents($preimagePath, wp_json_encode($preimage, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)) === false) {
        throw new RuntimeException('Unable to write private preimage.');
    }
    chmod($preimagePath, 0600);
    mr0904b_stripe_update_config($configurationId, [
        'card' => 'on',
        'link' => 'off',
        'klarna' => 'off',
        'affirm' => 'off',
        'us_bank_account' => 'off',
    ]);
}

if ($mode === 'rollback') {
    if (!file_exists($preimagePath)) throw new RuntimeException('Private preimage is missing.');
    $preimage = json_decode((string) file_get_contents($preimagePath), true);
    if (!is_array($preimage) || ($preimage['configuration_id'] ?? null) !== $configurationId) {
        throw new RuntimeException('Private preimage is invalid.');
    }
    $restore = [];
    foreach ($controlledMethods as $method) {
        $restore[$method] = $preimage['methods'][$method]['preference'] ?? null;
        if (!in_array($restore[$method], ['on', 'off', 'none'], true)) {
            throw new RuntimeException('Invalid stored preference for ' . $method . '.');
        }
    }
    mr0904b_stripe_update_config($configurationId, $restore);
}

$after = mr0904b_stripe_config($configurationId);
$methods = mr0904b_method_preferences($after, $controlledMethods);
$checks = [
    'live_default' => ($after->livemode ?? false) === true && ($after->is_default ?? false) === true,
    'card_on' => ($methods['card']['value'] ?? null) === 'on',
    'link_off' => ($methods['link']['value'] ?? null) === 'off',
    'klarna_off' => ($methods['klarna']['value'] ?? null) === 'off',
    'affirm_off' => ($methods['affirm']['value'] ?? null) === 'off',
    'us_bank_account_off' => ($methods['us_bank_account']['value'] ?? null) === 'off',
];
$result = [
    'timestamp_utc' => gmdate('c'),
    'mode' => $mode,
    'configuration_id' => $configurationId,
    'checks' => $checks,
    'pass_count' => count(array_filter($checks)),
    'check_count' => count($checks),
    'methods' => $methods,
    'preimage_path' => $preimagePath,
    'preimage_mode' => file_exists($preimagePath) ? substr(sprintf('%o', fileperms($preimagePath)), -4) : null,
];
echo wp_json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES), "\n";
if ($mode !== 'rollback' && $result['pass_count'] !== $result['check_count']) exit(1);
