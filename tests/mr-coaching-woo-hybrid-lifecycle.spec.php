<?php
declare(strict_types=1);
// Included by the isolated allocator batch. Every financial fact below is
// SIMULATED; only allocator persistence/locking uses real isolated MariaDB.
define('ABSPATH', __DIR__ . '/');
$canonicalAssets = dirname(__DIR__) . '/wp-content/mu-plugins/missionmed-mr-coaching-assets';
require_once $canonicalAssets . '/CoachingOfferPolicy.php';
require_once $canonicalAssets . '/CoachingServicePolicy.php';
require_once $canonicalAssets . '/CoachingAllowanceProjection.php';
require_once $canonicalAssets . '/CoachingEntitlementEndpoint.php';

$hybridHooks = []; $hybridOptions = []; $hybridOrders = []; $hybridPostMeta = [];
$hybridNow = FIXTURE_NOW; $hybridNotices = []; $hybridForbiddenWrites = [];
$hybridCart = new class {
    public array $lines = [];
    public function get_cart(): array { return $this->lines; }
    public function get_applied_coupons(): array { return ['matchready2026']; }
};
function add_filter($tag, $callback, $priority = 10, $accepted = 1): void { global $hybridHooks; $hybridHooks[$tag][$priority][] = [$callback, $accepted]; }
function add_action($tag, $callback, $priority = 10, $accepted = 1): void { add_filter($tag, $callback, $priority, $accepted); }
function do_action($tag, ...$args): void { global $hybridHooks; $groups = $hybridHooks[$tag] ?? []; ksort($groups); foreach ($groups as $callbacks) { foreach ($callbacks as [$call, $accepted]) { $call(...array_slice($args, 0, $accepted)); } } }
function apply_filters($tag, $value, ...$args) { global $hybridHooks; $groups = $hybridHooks[$tag] ?? []; ksort($groups); foreach ($groups as $callbacks) { foreach ($callbacks as [$call, $accepted]) { $value = $call(...array_slice([$value, ...$args], 0, $accepted)); } } return $value; }
function hybridStripeCreate($order, array $request): array { $tagged = apply_filters('wc_stripe_generate_create_intent_request', $request, $order, null, false); return apply_filters('wc_stripe_request_body', $tagged, 'payment_intents'); }
function get_option($key, $default = false) { global $hybridOptions; return $hybridOptions[$key] ?? $default; }
function update_option($key, $value, $autoload = null): void { global $hybridOptions; $hybridOptions[$key] = $value; }
function get_post_meta($id, $key, $single) { global $hybridPostMeta; return $hybridPostMeta[$id][$key] ?? ''; }
function current_time($kind, $utc): int { global $hybridNow; return $hybridNow; }
function wp_json_encode($value): string { return json_encode($value, JSON_THROW_ON_ERROR); }
function wp_unslash($value) { return $value; }
function maybe_unserialize($value) { return unserialize($value, ['allowed_classes' => false]); }
function WC(): object { global $hybridCart; return (object) ['cart' => $hybridCart]; }
function wc_add_notice($message, $type): void { global $hybridNotices; $hybridNotices[] = [$message, $type]; }
function wc_get_order($id) { global $hybridOrders; return $hybridOrders[(int)$id] ?? null; }
function wc_get_orders($args): object {
    global $hybridOrders;
    $orders = array_values(array_filter($hybridOrders, static function ($o) use ($args) {
        return $o instanceof HybridOrder && (!isset($args['customer_id']) || $o->owner === $args['customer_id'])
            && (!isset($args['status']) || in_array($o->status, $args['status'], true))
            && (!isset($args['meta_query']) || $o->get_meta('_mmed_mr_coaching_admitted', true) === 'yes');
    }));
    usort($orders, static fn($a, $b) => $a->id <=> $b->id);
    $limit = $args['limit']; $page = $args['page'];
    return (object) ['orders' => array_slice($orders, ($page - 1) * $limit, $limit), 'total' => count($orders), 'max_num_pages' => (int)ceil(count($orders) / $limit)];
}
function wc_get_product($id): object { return new class((int)$id) {
    public function __construct(public int $id) {}
    public function get_id(): int { return $this->id; }
    public function is_virtual(): bool { return true; }
    public function get_status(): string { return 'publish'; }
    public function get_regular_price($context): string { return [940001 => '399.00', 940002 => '1099.00', 940003 => '1799.00'][$this->id] ?? '0.00'; }
}; }
function get_current_user_id(): int { return 9; }
function current_user_can($capability): bool { return $capability === 'manage_woocommerce'; }
function rest_get_authenticated_app_password(): string { return 'SIMULATED_authenticated_app_principal'; }
function register_rest_route(...$args): void {}
function update_user_meta(...$args): void { global $hybridForbiddenWrites; $hybridForbiddenWrites[] = 'user_meta'; throw new RuntimeException('forbidden_direct_grant'); }
function update_post_meta(...$args): void { global $hybridForbiddenWrites; $hybridForbiddenWrites[] = 'post_meta'; throw new RuntimeException('forbidden_product_write'); }
function wp_set_object_terms(...$args): void { global $hybridForbiddenWrites; $hybridForbiddenWrites[] = 'terms'; throw new RuntimeException('forbidden_course_write'); }
class WP_Error { public function __construct(public string $code, public string $message, public array $data) {} }
class WP_REST_Response { public function __construct(public array $data, public int $status, public array $headers) {} }
final class HybridRequest {
    public function __construct(public int $owner = 42) {}
    public function get_json_params(): array { return ['request_id' => str_repeat('d', 48), 'subject_wp_user_id' => $this->owner, 'subject_user_id' => 'f0459c60-0b79-41e3-a2f4-bc7e080cba2a']; }
    public function get_body(): string { return json_encode($this->get_json_params(), JSON_THROW_ON_ERROR); }
}
final class HybridItem {
    public function __construct(public int $id, public int $product = 940001, public string $total = '249.00') {}
    public function get_id(): int { return $this->id; }
    public function get_product_id(): int { return $this->product; }
    public function get_variation_id(): int { return 0; }
    public function get_quantity(): int { return 1; }
    public function get_total($context): string { return $this->total; }
}
final class HybridOrder {
    public array $meta = []; public string $status = 'pending'; public bool $paid = false;
    public bool $captured = false; public string $intent; public ?DateTimeImmutable $paidAt = null;
    public string $refunded = '0.00'; public int $saves = 0; public HybridItem $item;
    public function __construct(public int $id, public string $gateway = 'stripe', public int $owner = 42, public int $created = FIXTURE_NOW) { $this->intent = 'pi_SIMULATED' . $id; $this->item = new HybridItem($id + 100000); }
    public function get_id(): int { return $this->id; }
    public function get_items($kind): array { return [$this->item->id => $this->item]; }
    public function get_order_key(): string { return 'wc_SIMULATED_key' . $this->id; }
    public function get_order_number(): string { return 'SIMULATED-' . $this->id; }
    public function get_currency(): string { return 'USD'; }
    public function get_customer_id(): int { return $this->owner; }
    public function get_payment_method(): string { return $this->gateway; }
    public function get_coupon_codes(): array { return ['matchready2026']; }
    public function get_total_fees(): string { return '0.00'; }
    public function get_total_tax(): string { return '0.00'; }
    public function get_total($context): string { return $this->item->total; }
    public function get_date_created(): DateTimeImmutable { return new DateTimeImmutable('@' . $this->created); }
    public function get_date_paid(): ?DateTimeImmutable { return $this->paidAt; }
    public function get_meta($key, $single) { return $this->meta[$key] ?? ''; }
    public function update_meta_data($key, $value): void { $this->meta[$key] = $value; }
    public function save(): void { ++$this->saves; }
    public function is_paid(): bool { return $this->paid; }
    public function get_status(): string { return $this->status; }
    public function get_total_refunded(): string { return $this->refunded; }
    public function get_transaction_id(): string { return $this->intent; }
    public function get_refunds(): array { return []; }
}
final class WC_Order_Refund {
    public function __construct(public int $parent) {}
    public function get_parent_id(): int { return $this->parent; }
    public function get_amount(): string { return '1.00'; }
}
final class WC_Stripe_Order_Helper {
    public static function get_instance(): self { static $instance; return $instance ??= new self; }
    public function is_stripe_charge_captured($order): bool { return $order->captured; }
    public function get_stripe_intent_id($order): string { return $order->intent; }
}

// Load the exact composed module body; only its six deployment-relative
// requires are removed, after their exact identities are independently checked.
require_once $canonicalAssets . '/CoachingStripeLifecycle.php';
$stripeLifecycleSha = hash_file('sha256', $canonicalAssets . '/CoachingStripeLifecycle.php');
$hybridModule = file_get_contents(dirname(__DIR__) . '/wp-content/mu-plugins/missionmed-mr-coaching.php');
$hybridModuleSha = hash('sha256', $hybridModule);
$expectedRequires = array_map(static fn($name) => "require_once __DIR__ . '/missionmed-mr-coaching-assets/{$name}.php';", ['CoachingOfferPolicy', 'CoachingServicePolicy', 'CoachingWooAllocator', 'CoachingAllowanceProjection', 'CoachingEntitlementEndpoint', 'CoachingStripeLifecycle']);
preg_match_all('/^require_once .*;$/m', $hybridModule, $foundRequires);
check($foundRequires[0] === $expectedRequires, 'hybrid exact six deployment requires');
eval('?>' . str_replace($expectedRequires, '', $hybridModule));
$wpdb = $db;
resetRows($pdo);
$hybridPostMeta = [940001 => ['_mmed_mr_coaching_sku' => 'single'], 940002 => ['_mmed_mr_coaching_sku' => 'three'], 940003 => ['_mmed_mr_coaching_sku' => 'five']];
check(mmed_mr_coaching_release_ready('single') === false && !mmed_mr_coaching_is_purchasable(true, wc_get_product(940001)), 'hybrid default closed');
$hybridOptions[MMED_MR_COACHING_OPTION] = ['architecture' => 'woo_hybrid_v2', 'enabled' => true, 'product_ids' => ['single' => 940001, 'three' => 940002, 'five' => 940003], 'purchasable_skus' => ['single', 'three', 'five'], 'scheduler_read_wp_user_id' => 9];
foreach (['woo_allocation_verified', 'native_scheduler_verified', 'refund_disclosure_verified', 'independent_release_accepted', 'new_sku_zelle_compatibility_verified'] as $gate) { $hybridOptions[MMED_MR_COACHING_OPTION][$gate] = true; }
check(mmed_mr_coaching_release_ready('single'), 'hybrid explicit complete fixture gates');
$hybridCart->lines = [['product_id' => 940001, 'quantity' => 1]];
$stripe = $hybridOrders[100001] = new HybridOrder(100001);
unset($_POST['mmed_coaching_terms']);
rejects(fn() => do_action('woocommerce_checkout_create_order', $stripe), 'hybrid prepurchase checkbox required');
check($stripe->meta === [], 'hybrid missing checkbox persists no terms');
$_POST['mmed_coaching_terms'] = 'wrong-version';
rejects(fn() => do_action('woocommerce_checkout_create_order', $stripe), 'hybrid exact terms version required');
$_POST['mmed_coaching_terms'] = '2026-10-20-v1';
do_action('woocommerce_checkout_create_order', $stripe);
check($stripe->meta['_mmed_mr_coaching_terms_accepted_at'] === FIXTURE_NOW, 'hybrid terms accepted before admission');
do_action('woocommerce_checkout_order_processed', $stripe->id, [], $stripe);
$stripeSnapshot = mmed_mr_coaching_order_snapshot($stripe, false);
check($allocator->readOwned($stripeSnapshot) === null && !$stripe->paid, 'hybrid unpaid Stripe admission has no reservation');
for ($i = 100100; $i < 100120; ++$i) {
    $abandoned = $hybridOrders[$i] = new HybridOrder($i);
    do_action('woocommerce_checkout_create_order', $abandoned); do_action('woocommerce_checkout_order_processed', $i, [], $abandoned);
}
check(scalar($pdo, 'SELECT COUNT(*) FROM `fixture_mmed_coaching_allocations` WHERE cap_claimed=1') === 0, 'hybrid twenty abandoned Stripe admissions zero occupancy');
check(mmed_mr_coaching_hybrid_allowance_authority($stripe) === null && CoachingEntitlementEndpoint::read(new HybridRequest())->data['packages'] === [], 'hybrid unpaid admission zero allowances');
check(apply_filters('get_user_metadata', null, 42, '_mmed_matrix_allowed_modules', true) === null, 'hybrid unpaid zero Matrix scope');
rejects(fn() => mmed_mr_coaching_financial_proof($stripe), 'hybrid uncaptured pending Stripe denied');
do_action('woocommerce_pre_payment_complete', $stripe->id, $stripe->intent);
check($allocator->readOwned($stripeSnapshot) === null && $stripe->meta['_mmed_mr_coaching_state'] === 'needs_review', 'hybrid uncaptured precomplete cannot settle');
$intentRequest = ['amount' => 24900, 'currency' => 'usd'];
$stripeTagged = apply_filters('wc_stripe_generate_create_intent_request', $intentRequest, $stripe, null, false);
check($stripeTagged['metadata'] === ['mmed_coaching_order'=>(string)$stripe->id,'mmed_coaching_snapshot'=>$stripeSnapshot['snapshot_digest']] && $allocator->readOwned($stripeSnapshot) === null, 'hybrid intent preparation tags exact server metadata without occupancy');
check(apply_filters('wc_stripe_request_body', $stripeTagged, 'payment_intents') === $stripeTagged && $allocator->readOwned($stripeSnapshot)['state'] === 'initializing', 'hybrid actual endpoint body filter initializes once');
rejects(fn() => apply_filters('wc_stripe_request_body', $stripeTagged, 'payment_intents'), 'hybrid repeat actual create denied while first intent uncertain');
check(apply_filters('wc_stripe_request_body', $stripeTagged, 'payment_intents/' . $stripe->intent . '/confirm') === $intentRequest, 'hybrid initializing exact stored PI confirm strips all metadata');
$unexpectedConfirmMetadata = $stripeTagged; $unexpectedConfirmMetadata['metadata']['unexpected'] = 'SIMULATED';
rejects(fn() => apply_filters('wc_stripe_request_body', $unexpectedConfirmMetadata, 'payment_intents/' . $stripe->intent . '/confirm'), 'hybrid confirm remaining unexpected metadata denied');
rejects(fn() => apply_filters('wc_stripe_request_body', $stripeTagged, 'payment_intents/pi_SIMULATEDwrong/confirm'), 'hybrid different PI confirmation denied');
rejects(fn() => apply_filters('wc_stripe_request_body', $stripeTagged, 'charges'), 'hybrid unrelated provider endpoint denied');
$stripe->captured = true;
do_action('woocommerce_pre_payment_complete', $stripe->id, $stripe->intent);
check($allocator->readOwned($stripeSnapshot)['state'] === 'settling' && mmed_mr_coaching_hybrid_allowance_authority($stripe) === null, 'hybrid SIMULATED captured before Woo paid zero rights');
$stripe->paid = true; $stripe->status = 'processing'; $stripe->paidAt = new DateTimeImmutable('@' . FIXTURE_NOW);
do_action('woocommerce_payment_complete', $stripe->id);
$stripeRow = $allocator->readOwned($stripeSnapshot); $stripeAuthority = mmed_mr_coaching_hybrid_allowance_authority($stripe);
check($stripeRow['state'] === 'paid' && $stripeAuthority !== null, 'hybrid SIMULATED captured Stripe canonical paid allocation');
$stripeResponse = CoachingEntitlementEndpoint::read(new HybridRequest());
check($stripeResponse instanceof WP_REST_Response && count($stripeResponse->data['packages']) === 1 && count($stripeResponse->data['packages'][0]['units']) === 1, 'hybrid actual endpoint exact single immutable unit');
check(!str_contains(json_encode($stripeResponse->data), 'pi_SIMULATED') && !str_contains(json_encode($stripeResponse->data), 'financial_fingerprint'), 'hybrid endpoint omits financial details');
check(apply_filters('get_user_metadata', null, 42, '_mmed_matrix_allowed_modules', true) === [['existing_fixture_module', 'scheduler']], 'hybrid only scheduler appended preserving existing scope');
check(apply_filters('get_user_metadata', null, 43, '_mmed_matrix_allowed_modules', true) === null && apply_filters('get_user_metadata', ['prior'], 42, '_mmed_matrix_allowed_modules', true) === ['prior'], 'hybrid owner and preexisting metadata short circuit');
do_action('woocommerce_payment_complete', $stripe->id);
check($allocator->readOwned($stripeSnapshot)['revision'] === $stripeRow['revision'] && CoachingEntitlementEndpoint::read(new HybridRequest())->data['packages'][0]['units'] === $stripeResponse->data['packages'][0]['units'], 'hybrid payment replay no fresh rights or revision');
$duplicate = $hybridOrders[100005] = new HybridOrder(100005);
do_action('woocommerce_checkout_create_order', $duplicate); do_action('woocommerce_checkout_order_processed', $duplicate->id, [], $duplicate);
hybridStripeCreate($duplicate, $intentRequest);
$duplicate->captured = true; $duplicate->intent = $stripe->intent;
$duplicate->paid = true; $duplicate->status = 'processing'; $duplicate->paidAt = new DateTimeImmutable('@' . FIXTURE_NOW);
do_action('woocommerce_pre_payment_complete', $duplicate->id, $duplicate->intent); do_action('woocommerce_payment_complete', $duplicate->id);
$duplicateRow = $allocator->readOwned(mmed_mr_coaching_order_snapshot($duplicate, false));
check($duplicateRow['state'] === 'initializing' && $duplicateRow['financial_fingerprint'] === null && mmed_mr_coaching_hybrid_allowance_authority($duplicate) === null, 'hybrid same Stripe evidence cannot fund another order');
foreach (['three' => [100006, 940002, '749.00', 6], 'five' => [100007, 940003, '1199.00', 9]] as $sku => [$id, $product, $amount, $unitCount]) {
    $package = $hybridOrders[$id] = new HybridOrder($id); $package->item->product = $product; $package->item->total = $amount;
    do_action('woocommerce_checkout_create_order', $package); do_action('woocommerce_checkout_order_processed', $package->id, [], $package);
    hybridStripeCreate($package, $intentRequest);
    $package->captured = true; do_action('woocommerce_pre_payment_complete', $package->id, $package->intent);
    $package->paid = true; $package->status = 'processing'; $package->paidAt = new DateTimeImmutable('@' . FIXTURE_NOW);
    do_action('woocommerce_payment_complete', $package->id);
    $packages = CoachingEntitlementEndpoint::read(new HybridRequest())->data['packages'];
    $matching = array_values(array_filter($packages, static fn($p) => $p['order_id'] === $id));
    check(count($matching) === 1 && count($matching[0]['units']) === $unitCount, 'hybrid SIMULATED paid ' . $sku . ' exact immutable package units');
    $ids = array_column($matching[0]['units'], 'unit_id');
    do_action('woocommerce_payment_complete', $package->id);
    $again = array_values(array_filter(CoachingEntitlementEndpoint::read(new HybridRequest())->data['packages'], static fn($p) => $p['order_id'] === $id));
    check(array_column($again[0]['units'], 'unit_id') === $ids && count(array_unique($ids)) === $unitCount, 'hybrid ' . $sku . ' replay unit identity stable');
}
$stripe->owner = 43;
rejects(fn() => mmed_mr_coaching_financial_proof($stripe), 'hybrid altered canonical owner denied');
$stripe->owner = 42; $stripe->meta['_mmed_mr_coaching_terms_version'] = 'changed';
rejects(fn() => mmed_mr_coaching_order_snapshot($stripe, false), 'hybrid immutable accepted terms version enforced');
$stripe->meta['_mmed_mr_coaching_terms_version'] = '2026-10-20-v1';

// Invoke only the gateway's post-authentication hook double. This verifies
// local order binding, not real provider authentication/signature validation.
$canceled = $hybridOrders[100008] = new HybridOrder(100008);
do_action('woocommerce_checkout_create_order', $canceled); do_action('woocommerce_checkout_order_processed', $canceled->id, [], $canceled);
$canceledTagged = hybridStripeCreate($canceled, $intentRequest);
$canceledSnapshot = mmed_mr_coaching_order_snapshot($canceled, false);
$canceledNotification = (object)['data'=>(object)['object'=>(object)[
    'id'=>$canceled->intent,'status'=>'canceled','amount'=>24900,'amount_received'=>0,'currency'=>'usd',
    'metadata'=>(object)['signature'=>$canceled->id . ':' . md5(implode('-', [$canceled->id, $canceled->get_order_key(), $canceled->owner, 24900])), 'order_key'=>$canceled->get_order_key(), 'order_id'=>$canceled->get_order_number()]]]];
foreach (['signature','order_key','order_number','intent_id','processing','nonzero_received'] as $case) {
    $badNotification = unserialize(serialize($canceledNotification), ['allowed_classes'=>['stdClass']]);
    $badIntent = $badNotification->data->object;
    if ($case === 'signature') { $badIntent->metadata->signature = $canceled->id . ':' . str_repeat('0',32); }
    if ($case === 'order_key') { $badIntent->metadata->order_key = 'wc_wrong_key'; }
    if ($case === 'order_number') { $badIntent->metadata->order_id = (string)$canceled->id; }
    if ($case === 'intent_id') { $badIntent->id = 'pi_SIMULATEDdifferent'; }
    if ($case === 'processing') { $badIntent->status = 'processing'; }
    if ($case === 'nonzero_received') { $badIntent->amount_received = 1; }
    do_action('wc_stripe_webhook_received', 'payment_intent.canceled', $badNotification, $canceled);
    check($allocator->readOwned($canceledSnapshot)['state'] === 'initializing' && (int)$allocator->readOwned($canceledSnapshot)['cap_claimed'] === 1, 'hybrid trusted-hook wrong ' . $case . ' cannot release');
}
do_action('wc_stripe_webhook_received', 'payment_intent.canceled', $canceledNotification, $canceled);
$canceledRow = $allocator->readOwned($canceledSnapshot);
check($canceledRow['state'] === 'released' && (int)$canceledRow['cap_claimed'] === 0 && $canceled->meta['_mmed_mr_coaching_state'] === 'canceled_unpaid', 'hybrid trusted-hook exact bound terminal canceled zero received releases');
do_action('wc_stripe_webhook_received', 'payment_intent.canceled', $canceledNotification, $canceled);
check($allocator->readOwned($canceledSnapshot)['revision'] === $canceledRow['revision'], 'hybrid trusted-hook canceled replay stable');
rejects(fn() => apply_filters('wc_stripe_request_body', $canceledTagged, 'payment_intents'), 'hybrid canceled order cannot create a new intent');
rejects(fn() => apply_filters('wc_stripe_request_body', $canceledTagged, 'payment_intents/' . $canceled->intent . '/confirm'), 'hybrid canceled same PI cannot confirm after terminal release');
foreach (['charge.dispute.created'=>100006, 'review.opened'=>100007] as $riskType=>$riskId) {
    $riskOrder = $hybridOrders[$riskId];
    do_action('wc_stripe_webhook_received', $riskType, (object)[], $riskOrder);
    check($riskOrder->is_paid() && $riskOrder->get_status() === 'processing' && mmed_mr_coaching_hybrid_allowance_authority($riskOrder) === null, 'hybrid trusted-hook ' . $riskType . ' denies paid Woo allowance');
    do_action('woocommerce_payment_complete', $riskId);
    $remainingPackages = CoachingEntitlementEndpoint::read(new HybridRequest())->data['packages'];
    check(!in_array($riskId, array_column($remainingPackages, 'order_id'), true) && $riskOrder->meta['_mmed_mr_coaching_risk_hold'] === $riskType, 'hybrid risk hold survives payment replay endpoint read');
}

$zelle = $hybridOrders[100002] = new HybridOrder(100002, 'bacs');
do_action('woocommerce_checkout_create_order', $zelle); do_action('woocommerce_checkout_order_processed', $zelle->id, [], $zelle);
$zelleSnapshot = mmed_mr_coaching_order_snapshot($zelle, false);
$_POST['payer_name'] = 'SIMULATED payer submission'; $_POST['verified'] = true;
check(apply_filters('mmed_mr_coaching_zelle_complete_allowed', true, $zelle, fingerprint($zelle->id)) === false && !$zelle->paid, 'hybrid payer submit without receipt cannot complete');
$zelle->meta['_mm_zelle_fingerprint'] = fingerprint($zelle->id); $zelle->meta['_mm_zelle_state'] = 'verified';
$hybridOptions['mm_zelle_transaction_v2_' . fingerprint($zelle->id)] = 'wrong-order';
check(apply_filters('mmed_mr_coaching_zelle_complete_allowed', true, $zelle, fingerprint($zelle->id)) === false, 'hybrid Zelle wrong ledger order denied');
$hybridOptions['mm_zelle_transaction_v2_' . fingerprint($zelle->id)] = (string)$zelle->id;
check(apply_filters('mmed_mr_coaching_zelle_complete_allowed', false, $zelle, fingerprint($zelle->id)) === false, 'hybrid prior Zelle denial cannot be overridden');
check(apply_filters('mmed_mr_coaching_zelle_complete_allowed', true, $zelle, fingerprint(999999)) === false, 'hybrid Zelle wrong fingerprint denied');
check(apply_filters('mmed_mr_coaching_zelle_complete_allowed', true, $zelle, fingerprint($zelle->id)) === true, 'hybrid SIMULATED accepted Zelle ledger owner match settles');
$zelle->paid = true; $zelle->status = 'completed'; $zelle->paidAt = new DateTimeImmutable('@' . FIXTURE_NOW);
do_action('woocommerce_payment_complete', $zelle->id);
check($allocator->readOwned($zelleSnapshot)['state'] === 'paid' && mmed_mr_coaching_hybrid_allowance_authority($zelle) !== null, 'hybrid SIMULATED Zelle paid allocation projects');

$expired = $hybridOrders[100003] = new HybridOrder(100003, 'bacs');
do_action('woocommerce_checkout_create_order', $expired); do_action('woocommerce_checkout_order_processed', $expired->id, [], $expired);
$expiredSnapshot = mmed_mr_coaching_order_snapshot($expired, false);
$expired->meta['_mm_zelle_fingerprint'] = fingerprint($expired->id); $expired->meta['_mm_zelle_state'] = 'completing';
$hybridOptions['mm_zelle_transaction_v2_' . fingerprint($expired->id)] = (string)$expired->id;
$hybridNow = FIXTURE_NOW + 86400; at($pdo, $hybridNow);
check(apply_filters('mmed_mr_coaching_zelle_complete_allowed', true, $expired, fingerprint($expired->id)) === false && !$expired->paid && $allocator->readOwned($expiredSnapshot)['state'] === 'review', 'hybrid exact expiry precomplete false keeps unpaid review');
check(mmed_mr_coaching_hybrid_allowance_authority($expired) === null, 'hybrid expired unpaid has no authority');

$capBeforeRefund = scalar($pdo, 'SELECT COUNT(*) FROM `fixture_mmed_coaching_allocations` WHERE promotional=1 AND cap_claimed=1');
$hybridOrders[200001] = new WC_Order_Refund($stripe->id);
$stripe->refunded = '1.00'; do_action('woocommerce_order_refunded', $stripe->id, 200001);
check($allocator->readOwned($stripeSnapshot)['state'] === 'revoked' && mmed_mr_coaching_hybrid_allowance_authority($stripe) === null, 'hybrid refund quarantine removes current authority');
do_action('woocommerce_order_refunded', $stripe->id, 200001); do_action('woocommerce_payment_complete', $stripe->id);
check(mmed_mr_coaching_hybrid_allowance_authority($stripe) === null && scalar($pdo, 'SELECT COUNT(*) FROM `fixture_mmed_coaching_allocations` WHERE promotional=1 AND cap_claimed=1') === $capBeforeRefund, 'hybrid refund and payment replay never refill cap or rights');
$old = $hybridOrders[100004] = new HybridOrder(100004); $old->item->product = 5504;
$oldBefore = serialize($old); $rowsBefore = scalar($pdo, 'SELECT COUNT(*) FROM `fixture_mmed_coaching_allocations`');
do_action('woocommerce_checkout_order_processed', $old->id, [], $old); do_action('woocommerce_pre_payment_complete', $old->id, 'pi_SIMULATED_old'); do_action('woocommerce_payment_complete', $old->id);
check(apply_filters('wc_stripe_generate_create_intent_request', $intentRequest, $old, null, false) === $intentRequest, 'hybrid old-product intent request passes through');
check(apply_filters('wc_stripe_request_body', $intentRequest, 'payment_intents') === $intentRequest, 'hybrid untagged old-product provider body passes through');
do_action('wc_stripe_webhook_received', 'review.opened', (object)[], $old);
check(serialize($old) === $oldBefore && scalar($pdo, 'SELECT COUNT(*) FROM `fixture_mmed_coaching_allocations`') === $rowsBefore && mmed_mr_coaching_is_purchasable(true, wc_get_product(5504)) === true, 'hybrid protected old product order untouched');
check($hybridForbiddenWrites === [], 'hybrid no direct course user metadata or product grants');
unset($_POST['payer_name'], $_POST['verified'], $_POST['mmed_coaching_terms']);
