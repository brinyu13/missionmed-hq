<?php
declare(strict_types=1);

$root = dirname(__DIR__, 4);
$assetRoot = $root . '/wp-content/mu-plugins/missionmed-mr-0912-assets';
$plugin = $root . '/wp-content/mu-plugins/missionmed-mr-p0.php';

final class MR0912FakeProduct {
    public function __construct(private float $price, private int $parentId, private bool $soldIndividually) {}
    public function get_price(): string { return (string) $this->price; }
    public function get_parent_id(): int { return $this->parentId; }
    public function is_purchasable(): bool { return true; }
    public function is_in_stock(): bool { return true; }
    public function is_sold_individually(): bool { return $this->soldIndividually; }
}

final class MR0912FakeCart {
    public array $items = [];
    public function get_cart(): array { return $this->items; }
}

final class MR0912FakeWoo {
    public MR0912FakeCart $cart;
    public function __construct() { $this->cart = new MR0912FakeCart(); }
}

$GLOBALS['mr0912_options'] = [
    'mmed_mr_p0_verified_live_at' => '2026-09-04T18:02:20Z',
    'mmed_mr_0912_interview_week_verified_live_at' => '',
    'mmed_mr_0912_interview_week_acceptance_binding_sha256' => '',
    'mmed_mr_0912_complete_verified_live_at' => '',
    'mmed_mr_0912_complete_acceptance_binding_sha256' => '',
    'mmed_mr_0912_financial_test_status' => '',
    'mmed_mr_0912_financial_test_authority' => '',
];
$GLOBALS['mr0912_prices'] = [5867 => 1199.0, 5865 => 2799.0];
$GLOBALS['mr0912_parents'] = [5867 => 5504, 5865 => 3576];
$GLOBALS['mr0912_courses'] = [5867 => [3646], 5865 => [5227]];
$GLOBALS['mr0912_sold_individually'] = [5867 => true, 5865 => true];
$GLOBALS['mr0912_woo'] = new MR0912FakeWoo();
$GLOBALS['mr0912_notices'] = [];

function add_action(...$args): void {}
function add_filter(...$args): void {}
function get_option(string $key, mixed $default = null): mixed {
    return $GLOBALS['mr0912_options'][$key] ?? $default;
}
function wc_get_product(int $id): ?MR0912FakeProduct {
    return isset($GLOBALS['mr0912_prices'][$id])
        ? new MR0912FakeProduct(
            $GLOBALS['mr0912_prices'][$id],
            $GLOBALS['mr0912_parents'][$id] ?? 0,
            $GLOBALS['mr0912_sold_individually'][$id] ?? false
        )
        : null;
}
function WC(): MR0912FakeWoo { return $GLOBALS['mr0912_woo']; }
function wc_add_notice(string $message, string $type): void { $GLOBALS['mr0912_notices'][] = [$type, $message]; }
function get_post_meta(int $id, string $key, bool $single = false): mixed {
    return $key === '_related_course' ? ($GLOBALS['mr0912_courses'][$id] ?? []) : '';
}
function wc_get_checkout_url(): string { return 'https://missionmedinstitute.com/checkout/'; }
function add_query_arg(array $args, string $url): string { return $url . '?' . http_build_query($args); }
function wp_json_encode(mixed $value, int $flags = 0): string|false { return json_encode($value, $flags); }

define('ABSPATH', $root . '/');
define('WPMU_PLUGIN_DIR', $root . '/wp-content/mu-plugins');
define('WPMU_PLUGIN_URL', 'https://missionmedinstitute.com/wp-content/mu-plugins');
require $plugin;

$failures = [];
$assertions = 0;
$check = static function (bool $condition, string $label) use (&$failures, &$assertions): void {
    $assertions++;
    if (!$condition) $failures[] = $label;
};

$configPath = $assetRoot . '/config/campaign-state.json';
$config = json_decode((string) file_get_contents($configPath), true, flags: JSON_THROW_ON_ERROR);
$javascript = (string) file_get_contents($assetRoot . '/js/mr-0912.js');
$pluginSource = (string) file_get_contents($plugin);
$check($config['mission'] === 'MR-WEB-0912', 'mission');
$check($config['authority'] === ['DR-246', 'DR-247', 'DR-251'], 'authority');
$check($config['offers']['interview_week']['price'] === 500, 'interview-week-price');
$check($config['offers']['complete']['standard_price'] === 3499, 'complete-standard-price');
$check($config['offers']['complete']['includes_interview_week'] === true, 'complete-includes-interview-week');
$check($config['offers']['complete']['mock_count'] === null, 'mock-count-omitted');
$check($config['payment_options']['early_zelle_paid_in_full']['public_verified'] === false, 'zelle-fail-closed');
$check($config['payment_options']['early_card_paid_in_full']['public_verified'] === false, 'card-fail-closed');
$check($config['payment_options']['early_installments_total']['public_verified'] === false, 'installments-fail-closed');
$check($config['payment_options']['standard']['public_verified'] === false, 'standard-checkout-fail-closed');
$check($config['upgrade_credit']['public_verified'] === false, 'upgrade-fail-closed');
$check($config['alumni']['public_verified'] === false, 'alumni-fail-closed');
$check(array_column($config['schedule'], 'time') === ['Evening', '11 AM-4 PM ET', '11 AM-4 PM ET', 'Evening', 'Evening', '11 AM-4 PM ET'], 'schedule-precision');
$check(!str_contains($javascript, 'verificationNote'), 'no-customer-visible-verification-note');
$check(!str_contains($javascript, 'Current operational limits'), 'no-customer-visible-operational-qa');
$check(str_contains($pluginSource, 'refund-cancellation-policy'), 'checkout-policy-links');
$check(str_contains($pluginSource, 'mission-residency-waitlist'), 'legacy-waitlist-containment');
$check(str_contains($pluginSource, 'mm_mr_0912_output_boundary'), 'earliest-output-boundary');
$check(str_contains($pluginSource, 'GT-PJ7SPCWF'), 'campaign-google-tag-preserved');
$check(str_contains($pluginSource, "../js/mr-0912.js?v="), 'content-hashed-campaign-javascript');

$runtime = mm_mr_p0_runtime_config();
$check($runtime['campaign']['go_live_gate']['verified_live_at'] === null, 'old-acceptance-not-inherited');
$check($runtime['offers']['interview_week']['runtime']['mapping_verified'] === true, 'interview-week-map');
$check($runtime['offers']['complete']['runtime']['mapping_verified'] === true, 'complete-map');
$check($runtime['offers']['interview_week']['runtime']['parent_verified'] === true, 'interview-week-parent');
$check($runtime['offers']['complete']['runtime']['parent_verified'] === true, 'complete-parent');
$check($runtime['offers']['interview_week']['runtime']['sold_individually'] === true, 'interview-week-single-quantity');
$check($runtime['offers']['complete']['runtime']['sold_individually'] === true, 'complete-single-quantity');
$check($runtime['offers']['interview_week']['runtime']['product_eligible'] === false, 'old-interview-week-price-rejected');
$check($runtime['offers']['complete']['runtime']['product_eligible'] === false, 'old-complete-price-rejected');
$check($runtime['offers']['interview_week']['runtime']['checkout_allowed'] === false, 'old-interview-week-checkout-blocked');
$check($runtime['offers']['complete']['runtime']['checkout_allowed'] === false, 'old-complete-checkout-blocked');
$check(!isset($runtime['payment_options']['early_zelle_paid_in_full']['amount']), 'unverified-zelle-amount-not-public');
$check(!isset($runtime['payment_options']['early_card_paid_in_full']['amount']), 'unverified-card-amount-not-public');
$check(!isset($runtime['payment_options']['early_installments_total']['amount']), 'unverified-installment-amount-not-public');
$check(!isset($runtime['upgrade_credit']['amount']), 'unverified-upgrade-amount-not-public');
$check(!isset($runtime['alumni']['discount']), 'unverified-alumni-discount-not-public');

$GLOBALS['mr0912_prices'] = [5867 => 500.0, 5865 => 3099.0];
$runtime = mm_mr_p0_runtime_config();
$check($runtime['offers']['interview_week']['runtime']['product_eligible'] === true, 'interview-week-price-ready');
$check($runtime['offers']['complete']['runtime']['product_eligible'] === true, 'complete-price-ready');
$check($runtime['offers']['interview_week']['runtime']['checkout_allowed'] === false, 'gate-blocks-interview-week');
$check($runtime['offers']['complete']['runtime']['checkout_allowed'] === false, 'gate-blocks-complete');
$check(mm_mr_0912_validate_add_to_cart(true, 5504, 1, 5867) === false, 'direct-interview-week-add-blocked');
$check(mm_mr_0912_validate_add_to_cart(true, 3576, 1, 5865) === false, 'direct-complete-add-blocked');

$GLOBALS['mr0912_options']['mmed_mr_0912_interview_week_verified_live_at'] = '2026-09-13T17:00:00Z';
$runtime = mm_mr_p0_runtime_config();
$check($runtime['campaign']['go_live_gate']['verified_live_at'] === null, 'timestamp-without-binding-rejected');
$check($runtime['offers']['interview_week']['runtime']['checkout_allowed'] === false, 'unbound-interview-week-blocked');
$check(mm_mr_0912_acceptance_binding('interview_week', '2026-09-13T17:00:00Z', $runtime['offers']['interview_week']['runtime']) === '', 'binding-requires-founder-waiver');
$GLOBALS['mr0912_options']['mmed_mr_0912_financial_test_status'] = 'waived_by_founder_not_executed';
$GLOBALS['mr0912_options']['mmed_mr_0912_financial_test_authority'] = 'DR-251';
$GLOBALS['mr0912_options']['mmed_mr_0912_interview_week_acceptance_binding_sha256'] = mm_mr_0912_acceptance_binding(
    'interview_week',
    $GLOBALS['mr0912_options']['mmed_mr_0912_interview_week_verified_live_at'],
    $runtime['offers']['interview_week']['runtime']
);
$runtime = mm_mr_p0_runtime_config();
$check($runtime['offers']['interview_week']['runtime']['checkout_allowed'] === true, 'accepted-interview-week-enabled');
$check($runtime['offers']['complete']['runtime']['checkout_allowed'] === false, 'complete-remains-independently-blocked');
$check($runtime['production']['acceptance_binding_valid'] === false, 'partial-acceptance-not-global');
$check(mm_mr_0912_validate_add_to_cart(true, 5504, 1, 5867) === true, 'accepted-direct-interview-week-add-enabled');
$check(mm_mr_0912_validate_add_to_cart(true, 3576, 1, 5865) === false, 'unaccepted-direct-complete-add-blocked');
$check(mm_mr_0912_validate_add_to_cart(true, 5504, 1, 5866) === false, 'interview-week-sibling-variation-blocked');
$check(mm_mr_0912_validate_add_to_cart(true, 3576, 1, 5864) === false, 'complete-sibling-variation-blocked');
$check(mm_mr_0912_validate_add_to_cart(true, 5504, 1, 0) === false, 'missing-interview-week-variation-blocked');
$check(mm_mr_0912_validate_add_to_cart(true, 5504, 2, 5867) === false, 'interview-week-quantity-two-blocked');
$GLOBALS['mr0912_options']['mmed_mr_0912_complete_verified_live_at'] = '2026-09-13T17:05:00Z';
$GLOBALS['mr0912_options']['mmed_mr_0912_complete_acceptance_binding_sha256'] = mm_mr_0912_acceptance_binding(
    'complete',
    $GLOBALS['mr0912_options']['mmed_mr_0912_complete_verified_live_at'],
    $runtime['offers']['complete']['runtime']
);
$runtime = mm_mr_p0_runtime_config();
$check($runtime['offers']['complete']['runtime']['checkout_allowed'] === true, 'accepted-complete-enabled');
$check($runtime['payment_options']['early_card_paid_in_full']['public_verified'] === true, 'accepted-card-rail-published');
$check($runtime['payment_options']['early_card_paid_in_full']['amount'] === 3099, 'accepted-card-amount-published');
$check($runtime['production']['acceptance_binding_valid'] === true, 'acceptance-binding-valid');
$check($runtime['production']['live_stripe_financial_acceptance'] === 'WAIVED BY FOUNDER / NOT EXECUTED', 'waiver-reported-not-pass');
$check($runtime['campaign']['go_live_gate']['financial_acceptance']['passed'] === false, 'financial-acceptance-not-pass');
$check(str_contains((string) $runtime['offers']['interview_week']['runtime']['checkout_url'], 'add-to-cart=5504'), 'interview-week-checkout-identity');
$check(str_contains((string) $runtime['offers']['complete']['runtime']['checkout_url'], 'add-to-cart=3576'), 'complete-checkout-identity');

$GLOBALS['mr0912_woo']->cart->items = [['product_id' => 5504, 'variation_id' => 5867, 'quantity' => 1]];
$check(array_keys(mm_mr_0912_card_only_gateways(['stripe' => 'card', 'bacs' => 'manual'])) === ['stripe'], 'mission-residency-card-only');
$check(mm_mr_0912_cart_is_checkout_safe() === true, 'single-item-cart-safe');
$check(mm_mr_0912_validate_add_to_cart(true, 3576, 1, 5865) === false, 'double-purchase-add-blocked');
$GLOBALS['mr0912_woo']->cart->items[] = ['product_id' => 3576, 'variation_id' => 5865, 'quantity' => 1];
$GLOBALS['mr0912_notices'] = [];
mm_mr_0912_validate_cart();
$check(count($GLOBALS['mr0912_notices']) === 1, 'double-product-cart-blocked');
$GLOBALS['mr0912_woo']->cart->items = [['product_id' => 3576, 'variation_id' => 5865, 'quantity' => 2]];
$GLOBALS['mr0912_notices'] = [];
$check(mm_mr_0912_cart_is_checkout_safe() === false, 'stale-quantity-two-cart-unsafe');
mm_mr_0912_validate_cart();
$check(count($GLOBALS['mr0912_notices']) === 1 && str_contains($GLOBALS['mr0912_notices'][0][1], 'one seat'), 'stale-quantity-two-cart-blocked');
$GLOBALS['mr0912_woo']->cart->items = [];

$GLOBALS['mr0912_courses'][5867] = [3646, 5227];
$runtime = mm_mr_p0_runtime_config();
$check($runtime['offers']['interview_week']['runtime']['mapping_verified'] === false, 'extra-course-mapping-rejected');
$check($runtime['offers']['interview_week']['runtime']['checkout_allowed'] === false, 'extra-course-checkout-blocked');
$GLOBALS['mr0912_courses'][5867] = [3646];
$GLOBALS['mr0912_parents'][5867] = 3576;
$runtime = mm_mr_p0_runtime_config();
$check($runtime['offers']['interview_week']['runtime']['parent_verified'] === false, 'wrong-parent-rejected');
$check($runtime['offers']['interview_week']['runtime']['checkout_allowed'] === false, 'wrong-parent-checkout-blocked');

$publicCandidate = implode("\n", [
    (string) file_get_contents($configPath),
    (string) file_get_contents($assetRoot . '/pages/offer.html'),
    (string) file_get_contents($assetRoot . '/js/mr-0912.js'),
]);
foreach (['142 alumni', 'alumni matched and counting', 'matched hundreds', 'four Signature Mock Interviews', '89.1%', '3,000+', 'MatchFirst', 'September 12', 'Sept 12'] as $needle) {
    $check(stripos($publicCandidate, $needle) === false, 'public-candidate-omits-' . $needle);
}

if ($failures) {
    fwrite(STDERR, 'MR-WEB-0912 release validation FAIL: ' . implode(', ', $failures) . PHP_EOL);
    exit(1);
}
echo 'MR-WEB-0912 release validation PASS (' . $assertions . ' assertions)' . PHP_EOL;
