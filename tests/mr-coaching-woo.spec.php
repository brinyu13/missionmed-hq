<?php
/** Isolated source-contract tests. No WordPress database, payments, email or network. */
define('ABSPATH', __DIR__);
$options = $products = $metadata = $orders = $hooks = $actions = $requests = array();
$clock = strtotime('2026-10-30T12:00:00Z');
$reply = array('state' => 'reserved', 'order_id' => '12001');
$sink_ack = false; $events = array();
$wpdb = new class { public $usermeta = 'fixture_usermeta'; function prepare($q, ...$args) { return $q; } function get_col($query) { return array('filevault,calendar'); } };
function maybe_unserialize($value) { return $value; }
class MMED_Access_Gate { static function get_user_allowed_modules($id) { return array(); } }
$wc = (object) array('cart' => new class {
    public $lines = array(); public $coupons = array();
    function get_cart() { return $this->lines; }
    function get_applied_coupons() { return $this->coupons; }
});
function get_option($k, $d = false) { return $GLOBALS['options'][$k] ?? $d; }
function update_option($k, $v, $autoload = null) { $GLOBALS['options'][$k] = $v; return true; }
function get_post_meta($id, $key, $single) { return $GLOBALS['metadata'][$id][$key] ?? ''; }
function wc_get_product($id) { return $GLOBALS['products'][$id] ?? null; }
function wc_get_order($id) { return $GLOBALS['orders'][$id] ?? null; }
function wc_get_orders($args) { $GLOBALS['last_order_query'] = $args; return empty($args['paginate']) ? ($GLOBALS['matrix_orders'] ?? array()) : (object) array('orders' => $GLOBALS['sweep_pages'][$args['page']] ?? array(), 'max_num_pages' => $GLOBALS['sweep_page_count'] ?? 0); }
function WC() { return $GLOBALS['wc']; }
function current_time($kind, $utc) { return $GLOBALS['clock']; }
function wc_add_notice($text, $type) {}
function wp_json_encode($value) { return json_encode($value, JSON_UNESCAPED_SLASHES); }
function wp_parse_url($url) { return parse_url($url); }
function wp_safe_remote_post($url, $args) {
    $GLOBALS['requests'][] = array($url, $args);
    return array('code' => 200, 'body' => json_encode($GLOBALS['reply']));
}
function is_wp_error($value) { return false; }
function wp_remote_retrieve_response_code($r) { return $r['code']; }
function wp_remote_retrieve_body($r) { return $r['body']; }
function add_filter($name, $callback, $priority = 10, $arity = 1) { $GLOBALS['hooks'][$name][] = array($callback, $priority, $arity); }
function add_action($name, $callback, $priority = 10, $arity = 1) { add_filter($name, $callback, $priority, $arity); }
function do_action($name, ...$args) { $GLOBALS['actions'][] = array($name, $args); }
function apply_filters($name, $default, ...$args) { $GLOBALS['actions'][] = array($name, $args); return $GLOBALS['sink_ack']; }
function wp_next_scheduled($name, $args) { return $GLOBALS['events'][$name . json_encode($args)] ?? false; }
function wp_schedule_single_event($at, $name, $args) { $GLOBALS['events'][$name . json_encode($args)] = $at; }
class Product {
    public $id; public $price; public $virtual = true; public $status = 'publish';
    function __construct($id, $price) { $this->id = $id; $this->price = $price; }
    function get_id() { return $this->id; }
    function is_virtual() { return $this->virtual; }
    function get_status() { return $this->status; }
    function get_regular_price($context = null) { return $this->price; }
}
class Coupon { function __construct(public $code) {} function get_code() { return $this->code; } }
class Item {
    public $variation = 0; public $qty = 1;
    function __construct(public $product = 10001, public $total = '249.00') {}
    function get_product_id() { return $this->product; }
    function get_variation_id() { return $this->variation; }
    function get_quantity() { return $this->qty; }
    function get_total($context = null) { return $this->total; }
    function get_id() { return 33001; }
}
class Order {
    public $items; public $customer = 42; public $currency = 'USD'; public $gateway = 'stripe';
    public $coupons = array('MATCHREADY2026'); public $fees = '0.00'; public $tax = '0.00'; public $total = '249.00';
    public $meta = array(); public $paid = false; public $status = 'pending'; public $transaction = 'pi_fixtureOnly';
    public $refunded = '0.00';
    function __construct() { $this->items = array(new Item()); }
    function get_id() { return 12001; }
    function get_items($kind) { return $this->items; }
    function get_currency() { return $this->currency; }
    function get_customer_id() { return $this->customer; }
    function get_payment_method() { return $this->gateway; }
    function get_coupon_codes() { return $this->coupons; }
    function get_total_fees() { return $this->fees; }
    function get_total_refunded() { return $this->refunded; }
    function get_total_tax() { return $this->tax; }
    function get_total($context = null) { return $this->total; }
    function get_date_created() { return new DateTimeImmutable('2026-10-30T12:00:00Z'); }
    function get_date_paid() { return $this->paid ? new DateTimeImmutable('2026-10-30T12:02:00Z') : null; }
    function get_meta($k, $single) { return $this->meta[$k] ?? ''; }
    function update_meta_data($k, $v) { $this->meta[$k] = $v; }
    function is_paid() { return $this->paid; }
    function get_status() { return $this->status; }
    function get_transaction_id() { return $this->transaction; }
    function save() {}
}
require __DIR__ . '/../wp-content/mu-plugins/missionmed-mr-coaching.php';
$count = 0;
function check($condition, $name) { global $count; if (!$condition) { throw new RuntimeException('FAIL: ' . $name); } $count++; }
function rejects($fn, $name) { $rejected = false; try { $fn(); } catch (Throwable $e) { $rejected = true; } check($rejected, $name); }
function ready() {
    $GLOBALS['options'][MMED_MR_COACHING_OPTION] = array('enabled' => true,
        'product_ids' => array('single' => 10001, 'three' => 10002, 'five' => 10003, 'emergency' => 10004),
        'purchasable_skus' => array('single', 'three', 'five'),
        'native_allocation_verified' => true, 'native_scheduler_verified' => true,
        'refund_disclosure_verified' => true, 'independent_release_accepted' => true,
        'new_sku_zelle_compatibility_verified' => true,
        'bridge_url' => 'https://' . MMED_MR_COACHING_HOST . '/api/scheduler/coaching/service',
        'bridge_secret' => str_repeat('test-only-not-a-credential-', 2));
}
foreach (array('single' => array(10001, '399.00'), 'three' => array(10002, '1099.00'),
    'five' => array(10003, '1799.00'), 'emergency' => array(10004, '3999.00')) as $sku => [$id, $price]) {
    $products[$id] = new Product($id, $price); $metadata[$id]['_mmed_mr_coaching_sku'] = $sku;
}
check(!mmed_mr_coaching_release_ready('single'), 'default closed');
check(mmed_mr_coaching_is_purchasable(true, new Product(5504, '549.00')), 'Bootcamp unchanged');
ready();
foreach (array('single', 'three', 'five') as $sku) { check(mmed_mr_coaching_release_ready($sku), 'standard release ' . $sku); }
check(!mmed_mr_coaching_release_ready('emergency'), 'Emergency request first');
$options[MMED_MR_COACHING_OPTION]['product_ids']['single'] = 5504;
check(mmed_mr_coaching_sku(5504) === '', 'protected mapping never hijacked'); ready();
$products[10001]->virtual = false; check(!mmed_mr_coaching_release_ready('single'), 'virtual required'); $products[10001]->virtual = true;
check(mmed_mr_coaching_add_to_cart(true, 10001, 1), 'single cart admission');
check(!mmed_mr_coaching_add_to_cart(true, 10001, 2), 'quantity denied');
check(!mmed_mr_coaching_add_to_cart(true, 10001, 1, 12000), 'variation denied');
$wc->cart->lines = array(array('product_id' => 5504, 'quantity' => 1));
check(!mmed_mr_coaching_add_to_cart(true, 10001, 1), 'mixed existing denied');
$wc->cart->lines = array(array('product_id' => 10001, 'quantity' => 1));
check(!mmed_mr_coaching_add_to_cart(true, 5504, 1), 'mixed reverse denied');
$coupon = new Coupon('MATCHREADY2026');
check(mmed_mr_coaching_coupon_valid(true, $coupon), 'promo valid');
check(mmed_mr_coaching_coupon_discount(0, 399, $wc->cart->lines[0], true, $coupon) === 150, 'single promo arithmetic');
foreach (array(10002 => 350, 10003 => 600) as $id => $discount) {
    check(mmed_mr_coaching_coupon_discount(0, 1799, array('product_id' => $id), true, $coupon) === $discount, 'package arithmetic ' . $id);
}
$wc->cart->coupons = array('another'); rejects(fn() => mmed_mr_coaching_coupon_valid(true, $coupon), 'no stacking'); $wc->cart->coupons = array();
rejects(fn() => mmed_mr_coaching_coupon_valid(true, new Coupon('other')), 'other promo denied');
$clock = MMED_MR_COACHING_CUTOFF - 1; check(mmed_mr_coaching_coupon_valid(true, $coupon), 'last second valid');
$clock++; rejects(fn() => mmed_mr_coaching_coupon_valid(true, $coupon), 'exclusive deadline');
$clock = strtotime('2026-10-30T12:00:00Z');
$wc->cart->lines = array(array('product_id' => 5504, 'quantity' => 1));
rejects(fn() => mmed_mr_coaching_coupon_valid(true, $coupon), 'no unrelated discount');
check(mmed_mr_coaching_coupon_valid(true, new Coupon('existing-course-code')), 'unrelated code preserved');
foreach (array('1.00' => 100, '0.50' => 50, '249.9' => 24990, '2499' => 249900) as $input => $expected) { check(mmed_mr_coaching_cents($input) === $expected, 'integer money ' . $input); }
foreach (array('-1', '1e3', '1.001', '1,000', 'NaN') as $input) { rejects(fn() => mmed_mr_coaching_cents($input), 'invalid money ' . $input); }
$order = $orders[12001] = new Order();
$snapshot = mmed_mr_coaching_order_snapshot($order);
check($snapshot['wp_customer_id'] === 42 && $snapshot['tuition_cents'] === 24900, 'canonical identity and tuition');
check(strlen($snapshot['snapshot_digest']) === 64, 'snapshot digest');
$order->fees = '7.22'; $order->tax = '1.00'; $order->total = '257.22';
check(mmed_mr_coaching_order_snapshot($order)['total_cents'] === 25722, 'actual fee tax snapshot');
$order->total = '257.21'; rejects(fn() => mmed_mr_coaching_order_snapshot($order), 'total mismatch');
$order = $orders[12001] = new Order();
foreach (array('customer' => 0, 'currency' => 'CAD', 'gateway' => 'paypal', 'coupons' => array('other')) as $field => $bad) {
    $old = $order->$field; $order->$field = $bad; rejects(fn() => mmed_mr_coaching_order_snapshot($order), 'reject invalid ' . $field); $order->$field = $old;
}
foreach (array('http://127.0.0.1/', 'https://example.com/api/scheduler/coaching/service',
    'https://' . MMED_MR_COACHING_HOST . '/other', 'https://' . MMED_MR_COACHING_HOST . '/api/scheduler/coaching/service?q=1') as $url) {
    $options[MMED_MR_COACHING_OPTION]['bridge_url'] = $url;
    rejects(fn() => mmed_mr_coaching_bridge('admit_order', array()), 'SSRF deny');
} ready();
mmed_mr_coaching_admit_order(12001);
check($order->meta['_mmed_mr_coaching_admitted'] === 'yes' && !$order->paid, 'admission not payment');
[$url, $request] = end($requests); $h = $request['headers'];
check(hash_equals($h['X-MMed-Coaching-Signature'], hash_hmac('sha256', $h['X-MMed-Coaching-Timestamp'] . "\n" . $h['X-MMed-Coaching-Nonce'] . "\n" . $request['body'], $options[MMED_MR_COACHING_OPTION]['bridge_secret'])), 'exact byte HMAC');
check($request['sslverify'] && $request['redirection'] === 0, 'TLS no redirect');
$payload = json_decode($request['body'], true)['payload'];
mmed_mr_coaching_before_payment(12001);
check(json_decode(end($requests)[1]['body'], true)['payload']['idempotency_key'] === $payload['idempotency_key'], 'stable reservation recheck');
$reply['state'] = 'expired'; rejects(fn() => mmed_mr_coaching_before_payment(12001), 'expired reservation cannot pay'); $reply['state'] = 'reserved';
$before = count($actions); mmed_mr_coaching_payment_complete(12001);
check(count($actions) === $before && $order->meta['_mmed_mr_coaching_state'] === 'needs_review', 'unpaid callback cannot activate');
$order->paid = true; $order->status = 'processing'; $reply['activation_allowed'] = true; $reply['state'] = 'paid';
mmed_mr_coaching_payment_complete(12001);
check($order->meta['_mmed_mr_coaching_state'] === 'fulfillment_pending' && count($actions) === $before + 1 && $order->paid, 'paid accounting preserved while sink pending');
check(count($events) === 1 && empty($order->meta['_mmed_mr_coaching_fulfillment_ack']), 'durable pending and scheduled reconciliation');
$sink_ack = true; mmed_mr_coaching_payment_complete(12001);
check($order->meta['_mmed_mr_coaching_state'] === 'active' && count($actions) === $before + 2, 'missing fulfillment recovered on retry');
mmed_mr_coaching_payment_complete(12001); check(count($actions) === $before + 2, 'acknowledged fulfillment not repeated');
$order = $orders[12001] = new Order(); $order->gateway = 'bacs'; $reply = array('state' => 'reserved', 'order_id' => '12001'); mmed_mr_coaching_admit_order(12001);
$order->paid = true; $order->status = 'completed'; $before = count($actions);
mmed_mr_coaching_payment_complete(12001); check(count($actions) === $before, 'unverified bacs cannot activate');
$fp = str_repeat('a', 64); $order->meta['_mm_zelle_fingerprint'] = $fp; $order->meta['_mm_zelle_state'] = 'completing';
$options['mm_zelle_transaction_v2_' . $fp] = '99999';
mmed_mr_coaching_payment_complete(12001); check(count($actions) === $before, 'wrong owner evidence cannot activate');
$options['mm_zelle_transaction_v2_' . $fp] = '12001'; $reply = array('state' => 'paid', 'order_id' => '12001', 'activation_allowed' => true);
mmed_mr_coaching_payment_complete(12001); check(count($actions) === $before + 1, 'fixture verified bacs bridge only');
check(isset($hooks['woocommerce_rest_checkout_process_payment_with_context']) && $hooks['woocommerce_rest_checkout_process_payment_with_context'][0][1] === -100, 'Store API pre-gateway admission');
check(!isset($hooks['woocommerce_pre_payment_complete']) && isset($hooks['woocommerce_before_pay_action']), 'post capture accounting never blocked by remote admission');
check(isset($hooks['mmed_mr_coaching_reconcile_pending']), 'durable recovery sweep installed');
mmed_mr_coaching_reconcile_pending();
check($last_order_query['limit'] === 20 && $last_order_query['status'] === array('processing', 'completed'), 'bounded genuinely paid sweep');
$sweep_page_count = 2; $options['mmed_mr_coaching_sweep_page'] = 1;
$unresolved = new Order(); $unresolved->paid = false;
$sweep_pages = array(1 => array_fill(0, 20, $unresolved), 2 => array($order));
mmed_mr_coaching_reconcile_pending(); check($options['mmed_mr_coaching_sweep_page'] === 2, 'twenty unresolved records advance fair cursor');
mmed_mr_coaching_reconcile_pending(); check($last_order_query['page'] === 2 && $options['mmed_mr_coaching_sweep_page'] === 1, 'later recoverable page reached and cursor cycles');
$options[MMED_MR_COACHING_OPTION]['enabled'] = false; $last_order_query = null;
mmed_mr_coaching_reconcile_pending(); check($last_order_query === null, 'disabled release does not sweep orders');
ready();
$matrix_orders = array($order);
check(mmed_mr_coaching_matrix_modules(null, 42, 'unrelated_meta', true) === null, 'unrelated metadata unchanged');
check(mmed_mr_coaching_matrix_modules(array('prior'), 42, '_mmed_matrix_allowed_modules', true) === array('prior'), 'prior metadata filter preserved');
check(mmed_mr_coaching_matrix_modules(null, 42, '_mmed_matrix_allowed_modules', false) === null, 'multi-value metadata contract unchanged');
$projected = mmed_mr_coaching_matrix_modules(null, 42, '_mmed_matrix_allowed_modules', true);
check($projected === array(array('filevault', 'calendar', 'scheduler')), 'paid package adds only Scheduler and preserves old modules');
$options[MMED_MR_COACHING_OPTION]['enabled'] = false;
check(mmed_mr_coaching_matrix_modules(null, 42, '_mmed_matrix_allowed_modules', true) === $projected, 'admission rollback preserves acknowledged paid access'); ready();
check(mmed_mr_coaching_matrix_modules(null, 43, '_mmed_matrix_allowed_modules', true) === null, 'wrong account no grant');
$order->refunded = '1.00'; mmed_mr_coaching_clear_projection_cache(42); check(mmed_mr_coaching_matrix_modules(null, 42, '_mmed_matrix_allowed_modules', true) === null, 'refund blocks own coaching projection only'); $order->refunded = '0.00';
$order->meta['_mmed_mr_coaching_state'] = 'fulfillment_pending';
mmed_mr_coaching_clear_projection_cache(42); check(mmed_mr_coaching_matrix_modules(null, 42, '_mmed_matrix_allowed_modules', true) === null, 'unacknowledged package locked'); $order->meta['_mmed_mr_coaching_state'] = 'active';
$snapshot = mmed_mr_coaching_order_snapshot($order);
check(mmed_mr_coaching_acknowledge_matrix(false, $order, 'coaching-fulfillment:12001:' . $snapshot['snapshot_digest'], array('state' => 'paid', 'activation_allowed' => true)), 'canonical Matrix resolver acknowledgment');
check(!mmed_mr_coaching_acknowledge_matrix(false, $order, 'forged', array('state' => 'paid', 'activation_allowed' => true)), 'fulfillment key cannot be forged');
$order->paid = false; check(!mmed_mr_coaching_acknowledge_matrix(false, $order, 'forged', array('state' => 'reserved', 'activation_allowed' => false)), 'unpaid sink cannot acknowledge');
echo "PASS {$count} isolated Woo source assertions; no real payment or production activation proved.\n";
