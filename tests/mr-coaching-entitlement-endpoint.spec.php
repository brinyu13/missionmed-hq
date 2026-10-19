<?php
declare(strict_types=1);
// Native-boundary fixtures only: no WordPress bootstrap, database or network.
define('ABSPATH', __DIR__ . '/');
$root = __DIR__ . '/../wp-content/mu-plugins/missionmed-mr-coaching-assets';
require $root . '/CoachingAllowanceProjection.php';
require $root . '/CoachingEntitlementEndpoint.php';
class WP_Error { public function __construct(public string $code, public string $message, public array $data) {} }
class WP_REST_Response { public function __construct(public array $data, public int $status, public array $headers) {} }
class RequestFixture {
    public function __construct(public array $data, public ?string $raw = null) {}
    public function get_body(): string { return $this->raw ?? json_encode($this->data, JSON_THROW_ON_ERROR); }
    public function get_json_params(): array { return $this->data; }
}
class OrderFixture {
    public function __construct(public int $id, public int $owner, public ?array $snapshot, public $authority) {}
    public function get_id(): int { return $this->id; }
    public function get_customer_id(): int { return $this->owner; }
}
$config = []; $currentId = 9; $capability = true; $applicationPassword = 'fixture-authenticated-app-uuid'; $pages = []; $queryCalls = []; $ticks = []; $routes = [];
function mmed_mr_coaching_config(): array { global $config; return $config; }
function get_current_user_id(): int { global $currentId; return $currentId; }
function current_user_can(string $cap): bool { global $capability; return $capability && $cap === 'manage_woocommerce'; }
function rest_get_authenticated_app_password() { global $applicationPassword; return $applicationPassword; }
function mmed_mr_coaching_now(): int { global $ticks; return count($ticks) > 1 ? array_shift($ticks) : $ticks[0]; }
function wc_get_orders(array $args) { global $pages, $queryCalls; $queryCalls[] = $args; if (($args['customer_id'] ?? null) !== 42) { throw new RuntimeException('owner query binding'); } $page = $pages[$args['page']] ?? null; if ($page instanceof Throwable) { throw $page; } return $page; }
function mmed_mr_coaching_order_snapshot($order, $require_release): ?array { if ($require_release !== false) { throw new RuntimeException('do not re-admit paid order'); } return $order->snapshot; }
function mmed_mr_coaching_hybrid_allowance_authority($order) { if ($order->authority instanceof Throwable) { throw $order->authority; } return $order->authority; }
function register_rest_route($namespace, $route, $args): void { global $routes; $routes[] = [$namespace, $route, $args]; }
$count = 0; $failures = [];
function check(bool $ok, string $label): void { global $count, $failures; ++$count; if (!$ok) { $failures[] = $label; } }
function request(): RequestFixture { return new RequestFixture(['request_id' => str_repeat('b', 48), 'subject_wp_user_id' => 42, 'subject_user_id' => 'f0459c60-0b79-41e3-a2f4-bc7e080cba2a']); }
function orderFixture(string $sku = 'single', int $id = 1001): OrderFixture {
    $product = ['single' => 940001, 'three' => 940002, 'five' => 940003][$sku];
    $amount = ['single' => 24900, 'three' => 74900, 'five' => 119900][$sku];
    $snapshot = ['order_id' => (string) $id, 'order_item_id' => (string) ($id + 1000), 'wp_customer_id' => 42, 'product_id' => $product, 'sku' => $sku, 'gateway' => 'stripe', 'quantity' => 1, 'currency' => 'USD', 'tuition_cents' => $amount, 'total_cents' => $amount, 'fee_cents' => 0, 'tax_cents' => 0, 'coupon' => 'MATCHREADY2026', 'order_created_at' => '2027-01-14T08:00:00Z'];
    $snapshot['snapshot_digest'] = hash('sha256', json_encode($snapshot, JSON_THROW_ON_ERROR));
    $proof = ['genuine_server_verified' => true, 'order_id' => $id, 'owner_wp_user_id' => 42, 'snapshot_digest' => $snapshot['snapshot_digest'], 'gateway' => 'stripe', 'amount_cents' => $amount, 'currency' => 'USD', 'paid_at' => '2027-01-14T09:00:00Z', 'kind' => 'canonical_stripe_payment', 'transaction_id' => 'pi_fixtureOnly'];
    $evidence = ['server_owned_evidence_verified' => true, 'canonical_woo_is_paid' => true, 'woo_status' => 'processing', 'refunded_cents' => 0, 'chargeback' => false, 'quarantined' => false, 'order_id' => $id, 'order_item_id' => $id + 1000, 'owner_wp_user_id' => 42, 'product_id' => $product, 'canonical_snapshot_digest' => $snapshot['snapshot_digest'], 'admitted_snapshot_digest' => $snapshot['snapshot_digest'], 'canonical_paid_at' => $proof['paid_at'], 'payment_proof' => $proof];
    return new OrderFixture($id, 42, $snapshot, ['evidence' => $evidence, 'eligibility_revision' => 1]);
}
function resetFixture(): void {
    global $config, $currentId, $capability, $applicationPassword, $pages, $queryCalls, $ticks;
    $config = ['scheduler_read_wp_user_id' => 9, 'product_ids' => ['single' => 940001, 'three' => 940002, 'five' => 940003]];
    $currentId = 9; $capability = true; $applicationPassword = 'fixture-authenticated-app-uuid'; $queryCalls = [];
    $ticks = [1800000000, 1800000000]; $pages = [1 => (object) ['orders' => [orderFixture()], 'total' => 1, 'max_num_pages' => 1]];
}
function errorResult($result): bool { return $result instanceof WP_Error && $result->data['status'] >= 400 && !str_contains($result->message, 'fixture-authenticated'); }

resetFixture(); check(CoachingEntitlementEndpoint::permission() === true, 'exact server app-password principal authorized');
foreach (['wrongPrincipal', 'cookieOnly', 'noCapability', 'unconfigured', 'stringPrincipal', 'guest'] as $case) {
    resetFixture();
    if ($case === 'wrongPrincipal') { $currentId = 10; }
    if ($case === 'cookieOnly') { $applicationPassword = null; $_COOKIE['wordpress_logged_in'] = 'fixture-cookie'; }
    if ($case === 'noCapability') { $capability = false; }
    if ($case === 'unconfigured') { unset($config['scheduler_read_wp_user_id']); }
    if ($case === 'stringPrincipal') { $config['scheduler_read_wp_user_id'] = '9'; }
    if ($case === 'guest') { $currentId = 0; }
    check(errorResult(CoachingEntitlementEndpoint::permission()), 'auth denied ' . $case);
    check(errorResult(CoachingEntitlementEndpoint::read(request())) && $queryCalls === [], 'denied auth cannot query orders ' . $case);
}
resetFixture(); $result = CoachingEntitlementEndpoint::read(request());
check($result instanceof WP_REST_Response, 'valid fresh canonical package returned');
if ($result instanceof WP_REST_Response) {
    check($result->status === 200 && $result->data['complete'] === true && count($result->data['packages'][0]['units']) === 1, 'exact single package count');
    check($result->data['packages'][0]['eligibility_revision'] === 1, 'positive monotonic integer revision protocol');
    check($result->data['request_id'] === request()->data['request_id'] && $result->data['subject_wp_user_id'] === 42, 'challenge and subject bound');
    check($result->data['valid_until'] - $result->data['checked_at'] === 15 && str_contains($result->headers['Cache-Control'], 'no-store'), 'fresh no-store bounded response');
    check(!str_contains(json_encode($result->data), 'pi_fixture') && !str_contains(json_encode($result->data), 'payment_proof'), 'no financial proof or credential exposed');
}
check($queryCalls[0]['customer_id'] === 42 && $queryCalls[0]['limit'] === 50 && $queryCalls[0]['paginate'] === true, 'server-owned bounded owner query');
foreach (['extraBrowserOwner', 'stringOwner', 'invalidUuid', 'invalidNonce', 'oversizeBody'] as $case) {
    resetFixture(); $r = request();
    if ($case === 'extraBrowserOwner') { $r->data['actor_wp_id'] = 999; }
    if ($case === 'stringOwner') { $r->data['subject_wp_user_id'] = '42'; }
    if ($case === 'invalidUuid') { $r->data['subject_user_id'] = 'browser-user'; }
    if ($case === 'invalidNonce') { $r->data['request_id'] = 'forged'; }
    if ($case === 'oversizeBody') { $r->raw = str_repeat('x', 1025); }
    check(errorResult(CoachingEntitlementEndpoint::read($r)) && $queryCalls === [], 'browser request schema denied ' . $case);
}
resetFixture(); $pages[1]->orders = [orderFixture('single', 1001), orderFixture('three', 1002), orderFixture('five', 1003)]; $pages[1]->total = 3;
$result = CoachingEntitlementEndpoint::read(request());
check($result instanceof WP_REST_Response && array_map(fn($p) => count($p['units']), $result->data['packages']) === [1, 6, 9], 'all standard package counts exact');
foreach ([0, -1, 1.5, '1', str_repeat('a', 64), null] as $revision) {
    resetFixture(); $pages[1]->orders[0]->authority['eligibility_revision'] = $revision;
    check(errorResult(CoachingEntitlementEndpoint::read(request())), 'revision must be positive native integer');
}
foreach (['wrongOrderOwner', 'duplicateOrder', 'proofWrongOwner', 'proofUnknown', 'snapshotUnknown', 'refund', 'authorityException', 'queryException', 'incompleteResult', 'tooManyPages', 'longRead'] as $case) {
    resetFixture();
    if ($case === 'wrongOrderOwner') { $pages[1]->orders[0]->owner = 99; }
    if ($case === 'duplicateOrder') { $pages[1]->orders[] = $pages[1]->orders[0]; $pages[1]->total = 2; }
    if ($case === 'proofWrongOwner') { $pages[1]->orders[0]->authority['evidence']['owner_wp_user_id'] = 99; }
    if ($case === 'proofUnknown') { $pages[1]->orders[0]->authority = false; }
    if ($case === 'snapshotUnknown') { $pages[1]->orders[0]->snapshot['snapshot_digest'] = str_repeat('0', 64); }
    if ($case === 'refund') { $pages[1]->orders[0]->authority['evidence']['refunded_cents'] = 1; }
    if ($case === 'authorityException') { $pages[1]->orders[0]->authority = new RuntimeException('private financial detail'); }
    if ($case === 'queryException') { $pages[1] = new RuntimeException('database uncertain'); }
    if ($case === 'incompleteResult') { $pages[1] = false; }
    if ($case === 'tooManyPages') { $pages[1]->max_num_pages = 21; }
    if ($case === 'longRead') { $ticks = [1800000000, 1800000006]; }
    check(errorResult(CoachingEntitlementEndpoint::read(request())), 'uncertainty denied ' . $case);
}
resetFixture(); $pages[1]->orders = []; $pages[1]->total = 0; $pages[1]->max_num_pages = 0;
$result = CoachingEntitlementEndpoint::read(request()); check($result instanceof WP_REST_Response && $result->data['packages'] === [] && $result->data['complete'], 'explicit verified empty catalog permitted');
foreach (['missingTotal', 'negativePages', 'fractionalPages', 'numericStringPages', 'emptyWithPositiveTotal', 'nonemptyWithZeroTotal', 'missingSecondPage', 'changingTotal', 'changingPageCount'] as $case) {
    resetFixture();
    if ($case === 'missingTotal') { unset($pages[1]->total); $pages[1]->orders = []; }
    if ($case === 'negativePages') { $pages[1]->max_num_pages = -1; $pages[1]->orders = []; $pages[1]->total = 0; }
    if ($case === 'fractionalPages') { $pages[1]->max_num_pages = 1.5; $pages[1]->orders = []; $pages[1]->total = 0; }
    if ($case === 'numericStringPages') { $pages[1]->max_num_pages = 'not-a-number'; }
    if ($case === 'emptyWithPositiveTotal') { $pages[1]->orders = []; }
    if ($case === 'nonemptyWithZeroTotal') { $pages[1]->total = 0; $pages[1]->max_num_pages = 0; }
    if (in_array($case, ['missingSecondPage', 'changingTotal', 'changingPageCount'], true)) {
        $orders = []; for ($i = 1; $i <= 50; ++$i) { $orders[] = new OrderFixture(2000 + $i, 42, null, null); }
        $pages[1] = (object) ['orders' => $orders, 'total' => 51, 'max_num_pages' => 2];
        $pages[2] = (object) ['orders' => [], 'total' => $case === 'changingTotal' ? 50 : 51, 'max_num_pages' => $case === 'changingPageCount' ? 1 : 2];
    }
    check(errorResult(CoachingEntitlementEndpoint::read(request())), 'uncertain pagination never false-zero ' . $case);
}
resetFixture(); $pages[1]->orders[0]->authority = null;
$result = CoachingEntitlementEndpoint::read(request()); check($result instanceof WP_REST_Response && $result->data['packages'] === [], 'explicit authoritative ineligibility distinct from query failure');
CoachingEntitlementEndpoint::register(); check($routes[0][0] === 'mmed-coaching/v1' && $routes[0][2]['methods'] === 'POST' && $routes[0][2]['permission_callback'] === [CoachingEntitlementEndpoint::class, 'permission'], 'native route uses explicit authenticated read boundary');
if ($failures) { echo 'FAIL: ' . count($failures) . ' / ' . $count . " assertions\n" . implode("\n", $failures) . "\n"; exit(1); }
echo 'PASS: ' . $count . " isolated entitlement endpoint assertions; no real connection or financial operation\n";
