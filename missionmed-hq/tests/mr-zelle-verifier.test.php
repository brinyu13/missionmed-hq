<?php
/** Isolated synthetic state-machine tests. No WordPress, network or real payment.
 * These prove code boundaries only, NOT live Woo/LearnDash/Matrix acceptance.
 * Run: php missionmed-hq/tests/mr-zelle-verifier.test.php
 */
define('ABSPATH', __DIR__);
define('MINUTE_IN_SECONDS', 60);
function add_action(...$args) {}
function absint($v) { return abs((int)$v); }
function sanitize_key($v) { return preg_replace('/[^a-z0-9_\-]/', '', strtolower($v)); }
function sanitize_text_field($v) { return trim(strip_tags($v)); }
function wp_unslash($v) { return $v; }
function wp_json_encode($v) { return json_encode($v); }
function get_option($k, $default = false) { return $GLOBALS['options'][$k] ?? $default; }
function add_option($k, $v, ...$rest) {
    if (array_key_exists($k, $GLOBALS['options'])) return false;
    $GLOBALS['options'][$k] = $v;
    return true;
}
function current_user_can($cap) { return $cap === 'manage_woocommerce' && $GLOBALS['admin']; }
function get_current_user_id() { return $GLOBALS['user']; }
function is_user_logged_in() { return get_current_user_id() > 0; }
function get_query_var($k) { return 0; }
function esc_html__($s, ...$args) { return $s; }
function esc_html($s) { return htmlspecialchars($s); }
function esc_url($s) { return $s; }
function home_url($s) { return 'https://missionmedinstitute.com' . $s; }
function get_permalink($id) { return 'https://missionmedinstitute.com/course/' . $id; }
function wp_verify_nonce($nonce, $action) { return $nonce === 'synthetic-valid-' . $action; }
class RequestDenied extends Exception {}
function wp_die($message, $title, $args) { throw new RequestDenied((string)$args['response']); }
function mmhq_handoff_secret() { return 'synthetic-test-secret-not-a-credential'; }
function wc_get_order($id) { return isset($GLOBALS['orders'][$id]) ? clone $GLOBALS['orders'][$id] : false; }
function wc_get_orders($query) {
    $orders = array_values(array_filter($GLOBALS['orders'], fn($o) => $o->payment === 'bacs' && in_array($o->status, ['pending', 'on-hold'], true)));
    return (object)['orders' => array_map(fn($o) => clone $o, array_slice($orders, 0, 101)), 'total' => count($orders)];
}
function wp_next_scheduled($hook, $args) { return $GLOBALS['cron'][$args[0]] ?? false; }
function wp_schedule_single_event($when, $hook, $args) { $GLOBALS['cron'][$args[0]] = $when; }
function wp_clear_scheduled_hook($hook, $args) { unset($GLOBALS['cron'][$args[0]]); }
function sfwd_lms_has_access($course, $user) { return in_array($course, $GLOBALS['access'][$user] ?? [], true); }
function is_wp_error($v) { return false; }
function wp_remote_retrieve_response_code($v) { return $v['code']; }
function wp_remote_retrieve_body($v) { return json_encode($v['body']); }
function wp_remote_post($url, $args) {
    ++$GLOBALS['http_calls'];
    $p = json_decode($args['body'], true);
    $h = $args['headers'];
    $canonical = implode("\n", [$h['X-MMED-Zelle-Timestamp'], $h['X-MMED-Zelle-Nonce'], $p['order_id'], $p['expected_amount'], $p['payer_name'], $p['order_created_epoch'], '2', 'USD', json_encode($p['eligible_order_ids']), '[]']);
    check(hash_equals(hash_hmac('sha256', $canonical, mmhq_handoff_secret()), $h['X-MMED-Zelle-Signature']), 'all protocol dimensions signed');
    if ($GLOBALS['lose_lock']) $GLOBALS['wpdb']->locked = false;
    if ($GLOBALS['during_http']) ($GLOBALS['during_http'])();
    return $GLOBALS['http'];
}
class FakeDB {
    public $prefix = 'synthetic_';
    public $locked = false;
    public $busy = false;
    function prepare($sql, ...$args) { return $sql; }
    function get_var($sql) {
        if (str_contains($sql, 'IS_USED_LOCK')) return $this->locked ? '1' : null;
        if (str_contains($sql, 'RELEASE_LOCK')) { $this->locked = false; return '1'; }
        if (str_contains($sql, 'GET_LOCK')) { if ($this->busy) return '0'; $this->locked = true; return '1'; }
        throw new Exception('Unexpected SQL');
    }
}
class FakeItem {
    function __construct(public $parent = 5504, public $variation = 5867, public $quantity = 1) {}
    function get_product_id() { return $this->parent; }
    function get_variation_id() { return $this->variation; }
    function get_quantity() { return $this->quantity; }
}
class FakeOrder {
    public $payment = 'bacs';
    public $currency = 'USD';
    public $user = 999001;
    public $total = '1.00';
    public $status = 'on-hold';
    public $meta = [];
    public $items;
    public $created;
    public $billing = 'Test Payer';
    function __construct(public $id) { $this->items = [new FakeItem]; $this->created = new DateTimeImmutable('-10 minutes'); }
    function get_id() { return $this->id; }
    function get_payment_method() { return $this->payment; }
    function get_currency() { return $this->currency; }
    function get_user_id() { return $this->user; }
    function get_items(...$args) { return $this->items; }
    function get_total() { return $this->total; }
    function get_meta($k, ...$args) { return $this->meta[$k] ?? ''; }
    function update_meta_data($k, $v) { $this->meta[$k] = $v; }
    function is_paid() { return in_array($this->status, ['processing', 'completed'], true); }
    function has_status($s) { return in_array($this->status, (array)$s, true); }
    function get_order_key() { return 'synthetic-order-key-' . $this->id; }
    function get_date_created() { return $this->created; }
    function get_formatted_billing_full_name() { return $this->billing; }
    function save() { $GLOBALS['orders'][$this->id] = clone $this; }
    function add_order_note($v) { $GLOBALS['notes'][] = $v; }
    function payment_complete(...$args) {
        check($args === [], 'no invented transaction ID supplied');
        ++$GLOBALS['completions'];
        if ($GLOBALS['completion_failure']) throw new Exception('synthetic completion failure');
        $this->status = 'completed';
        $this->save();
        // Test double only. Actual installed entitlement hooks require live proof.
        $GLOBALS['access'][$this->user][] = $this->items[0]->parent === 5504 ? 3646 : 5227;
    }
}
require dirname(__DIR__, 2) . '/wp-content/mu-plugins/missionmed-mr-zelle-verifier.php';
function check($truth, $message) { if (!$truth) throw new Exception('FAIL: ' . $message); ++$GLOBALS['assertions']; }
function reset_case() {
    $GLOBALS['options'] = [MM_MR_ZELLE_MODE_OPTION => MM_MR_ZELLE_MODE_AUTOMATED];
    $GLOBALS['orders'] = $GLOBALS['cron'] = $GLOBALS['notes'] = $GLOBALS['access'] = [];
    $GLOBALS['wpdb'] = new FakeDB;
    $GLOBALS['admin'] = $GLOBALS['lose_lock'] = $GLOBALS['completion_failure'] = false;
    $GLOBALS['during_http'] = null;
    $GLOBALS['user'] = $GLOBALS['completions'] = $GLOBALS['http_calls'] = 0;
    $GLOBALS['http'] = ['code' => 200, 'body' => ['ok' => true, 'state' => 'verified', 'protocol_version' => 2, 'match_count' => 1,
        'authentication' => 'gmail_chase_dkim_dmarc_pass', 'fingerprint' => mm_mr_zelle_reference_fingerprint('TEST-REFERENCE-1004'),
        'message_fingerprint' => hash('sha256', 'synthetic-message'), 'received_epoch' => time(), 'reference_masked' => '...1004']];
    $_REQUEST = $_POST = $_SERVER = [];
}
function order($id = 1001) { $o = new FakeOrder($id); $o->save(); return $o; }
function claim($o) { check(mm_mr_zelle_record_claim($o, 'Test Payer'), 'claim recorded'); return wc_get_order($o->id); }
function run($o) { return mm_mr_zelle_run_verification($o, 'test payer'); }
function test($name, $fn) { reset_case(); $fn(); ++$GLOBALS['cases']; echo "PASS $name\n"; }
$GLOBALS['assertions'] = $GLOBALS['cases'] = 0;

test('customer email next steps are scoped to paid target orders', function() {
    $o=order(); $email=(object)['id'=>'customer_processing_order'];
    ob_start(); mm_mr_zelle_email_next_steps($o,false,false,$email); check(ob_get_clean()==='', 'pending has no activation next steps');
    $o->status='processing';
    ob_start(); mm_mr_zelle_email_next_steps($o,false,false,$email); $body=ob_get_clean();
    check(str_contains($body,'Interview Bootcamp Week') && str_contains($body,'Open your Matrix') && str_contains($body,'3646'), 'Bootcamp program and next steps');
    $o->items=[new FakeItem(3576,5865)];
    ob_start(); mm_mr_zelle_email_next_steps($o,false,true,$email); $body=ob_get_clean();
    check(str_contains($body,'IV Prep Complete') && str_contains($body,'opening phase') && str_contains($body,'February') && str_contains($body,'5227') && !str_contains($body,'360'), 'Complete program-specific plain text');
    foreach ([['admin'=>true,'id'=>'customer_processing_order'],['admin'=>false,'id'=>'customer_on_hold_order'],['admin'=>false,'id'=>'new_order']] as $case) {
        ob_start(); mm_mr_zelle_email_next_steps($o,$case['admin'],false,(object)['id'=>$case['id']]); check(ob_get_clean()==='', 'non-activation email excluded');
    }
    $o->payment='stripe'; ob_start(); mm_mr_zelle_email_next_steps($o,false,false,$email); check(ob_get_clean()==='', 'Stripe email unchanged');
});

test('strict amount parsing', function() {
    foreach (['1'=>'1.00', '1.2'=>'1.20', '1.23'=>'1.23', '0'=>'0.00'] as $in=>$expected) check(mm_mr_zelle_amount($in) === $expected, 'exact decimals');
    foreach (['1.001','01.00','1e2','-1','NaN','1,000.00'] as $in) check(mm_mr_zelle_amount($in) === '', 'reject noncanonical amount');
});
test('exact supported identities', function() {
    $o = order(); check(mm_mr_zelle_order_identity($o)['course_id'] === 3646, 'Bootcamp mapping');
    $o->items = [new FakeItem(3576,5865)]; check(mm_mr_zelle_order_identity($o)['course_id'] === 5227, 'Complete mapping');
    foreach ([[5504,5865,1],[3576,5867,1],[5504,5867,2],[3575,5862,1]] as $ids) { $o->items=[new FakeItem(...$ids)]; check(!mm_mr_zelle_order_identity($o), 'wrong identity excluded'); }
    $o->items=[new FakeItem]; $o->currency='CAD'; check(!mm_mr_zelle_order_identity($o), 'currency excluded');
    $o->currency='USD'; $o->user=0; check(!mm_mr_zelle_order_identity($o), 'guest excluded');
    $o->user=999001; $o->payment='stripe'; check(!mm_mr_zelle_order_identity($o), 'Stripe excluded');
});
test('claim alone never pays; duplicate is idempotent', function() {
    $o=claim(order()); $at=$o->get_meta('_mm_zelle_requested_at');
    check(!$o->is_paid() && $GLOBALS['completions']===0 && !$GLOBALS['access'], 'no claim entitlement');
    claim($o); check(wc_get_order($o->id)->get_meta('_mm_zelle_requested_at')===$at && $GLOBALS['http_calls']===0, 'claim not payment authority');
});
test('automatic canonical completion and replay', function() {
    $o=claim(order()); check(run($o)==='verified', 'positive synthetic flow');
    check($GLOBALS['completions']===1 && wc_get_order($o->id)->is_paid(), 'one canonical call');
    check($GLOBALS['access'][999001]===[3646], 'test-double target only');
    check(run($o)==='locked' && $GLOBALS['completions']===1, 'retry cannot complete twice');
});
test('Complete identity uses same canonical pathway', function() {
    $o=order(); $o->items=[new FakeItem(3576,5865)]; $o->save(); claim($o);
    check(run($o)==='verified' && $GLOBALS['access'][999001]===[5227], 'test-double Complete only');
});
test('payer change permanently holds automation but permits secure fallback', function() {
    $o=claim(order()); check(!mm_mr_zelle_record_claim($o,'Different Payer'), 'change held');
    claim($o); check(run($o)==='locked' && $GLOBALS['http_calls']===0, 'duplicate cannot clear hold');
    $GLOBALS['admin']=true; check(mm_mr_zelle_admin_confirm($o,'TEST-REFERENCE-1004',true), 'attested fallback works');
});
test('claimed and unclaimed same-name ambiguity', function() {
    $o=claim(order()); order(1002); check(run($o)==='needs_review' && $GLOBALS['http_calls']===0, 'unclaimed matching identity prevents uniqueness');
    $other=wc_get_order(1002); $other->status='cancelled'; $other->save();
    check(run($o)==='locked', 'ambiguity hold survives candidate disappearance');
});
test('different payer does not create false ambiguity', function() {
    $o=claim(order()); $other=order(1002); $other->billing='Other Person'; $other->save();
    check(run($o)==='verified', 'only exact name matches');
});
test('incomplete candidate scan fails closed', function() {
    $o=claim(order()); for($i=1002;$i<=1102;$i++) order($i);
    check(run($o)==='needs_review' && $GLOBALS['completions']===0, 'never infer uniqueness from first page');
});
foreach(['cancelled','refunded','failed','completed'] as $status) test("$status cannot activate", function() use($status) {
    $o=claim(order()); $fresh=wc_get_order($o->id); $fresh->status=$status; $fresh->save();
    check(run($o)==='locked' && $GLOBALS['completions']===0, 'fresh terminal state wins');
});
test('cancellation during provider call cannot activate', function() {
    $o=claim(order()); $GLOBALS['during_http']=function(){ $x=wc_get_order(1001);$x->status='cancelled';$x->save(); };
    check(run($o)==='locked' && $GLOBALS['completions']===0, 'fresh post-provider validation');
});
test('amount changed after claim blocks completion', function() {
    $o=claim(order()); $x=wc_get_order($o->id); $x->total='2.00'; $x->save();
    check(run($o)==='needs_review' && $GLOBALS['completions']===0, 'claim amount immutable');
});
test('cross-provider and post-cancellation replay blocked', function() {
    $o=claim(order()); check(run($o)==='verified','first receipt accepted');
    $x=wc_get_order($o->id); $x->status='refunded'; $x->save();
    $other=claim(order(1002)); $GLOBALS['admin']=true;
    check(!mm_mr_zelle_admin_confirm($other,'TEST-REFERENCE-1004',true), 'admin cannot reuse automated receipt');
    check($GLOBALS['completions']===1 && !wc_get_order(1002)->is_paid(), 'second order remains locked');
});
test('fallback requires capability, attestation and actual reference', function() {
    $o=claim(order()); check(!mm_mr_zelle_admin_confirm($o,'TEST-REFERENCE-1004',true),'customer cannot approve');
    $GLOBALS['admin']=true;
    check(!mm_mr_zelle_admin_confirm($o,'TEST-REFERENCE-1004',false),'attestation mandatory');
    check(!mm_mr_zelle_admin_confirm($o,'',true),'reference mandatory');
    check(mm_mr_zelle_admin_confirm($o,'TEST-REFERENCE-1004',true),'fallback without Gmail candidate');
    check(mm_mr_zelle_admin_confirm($o,'TEST-REFERENCE-1004',true) && $GLOBALS['completions']===1,'admin repeat idempotent');
});
foreach(['not_found','provider_unavailable'] as $state) test("$state retries bounded then fallback", function() use($state) {
    $o=claim(order()); $GLOBALS['http']['body']=['ok'=>true,'state'=>$state];
    for($i=0;$i<13;$i++) run($o);
    check($GLOBALS['http_calls']===12 && $GLOBALS['completions']===0,'bounded and unpaid');
    $GLOBALS['admin']=true; check(mm_mr_zelle_admin_confirm($o,'FALLBACK-1004',true),'fallback after outage');
});
test('malformed provider proof held', function() {
    $o=claim(order()); $GLOBALS['http']['body']['authentication']='forged';
    check(run($o)==='needs_review' && $GLOBALS['completions']===0,'untrusted proof rejected');
});
test('lock unavailable and lock lost fail closed', function() {
    $o=claim(order()); $GLOBALS['wpdb']->busy=true;
    check(run($o)==='checking' && $GLOBALS['http_calls']===0,'busy cannot activate');
    $GLOBALS['wpdb']->busy=false; $GLOBALS['lose_lock']=true;
    check(run($o)==='locked' && $GLOBALS['completions']===0,'reconnect cannot activate');
});
test('failed canonical completion is not verified', function() {
    $o=claim(order()); $GLOBALS['completion_failure']=true;
    check(run($o)==='needs_review' && !wc_get_order($o->id)->is_paid(),'exception unpaid');
    check(wc_get_order($o->id)->get_meta('_mm_zelle_state')==='needs_review','truthful failure');
});
test('authorization binds order owner or exact key', function() {
    $o=order(); $_REQUEST=['order_id'=>$o->id]; check(!mm_mr_zelle_authorized_order(),'anonymous blocked');
    $GLOBALS['user']=999002; check(!mm_mr_zelle_authorized_order(),'other customer blocked');
    $GLOBALS['user']=$o->user; check(mm_mr_zelle_authorized_order()->id===$o->id,'owner accepted');
    $GLOBALS['user']=0; $_REQUEST['key']='wrong'; check(!mm_mr_zelle_authorized_order(),'wrong key rejected');
    $_REQUEST['key']=$o->get_order_key(); check(mm_mr_zelle_authorized_order()->id===$o->id,'exact key accepted');
});
test('global admin mode stays dormant except exact canary', function() {
    $GLOBALS['options'][MM_MR_ZELLE_MODE_OPTION]=MM_MR_ZELLE_MODE_ADMIN;
    $o=claim(order()); check(run($o)==='locked','public automation dormant');
    $GLOBALS['options']['mmed_mr_zelle_canary_order']=$o->id;
    check(mm_mr_zelle_mode(order(1002))===MM_MR_ZELLE_MODE_ADMIN,'other order not canary');
    $x=wc_get_order(1002); $x->status='cancelled';$x->save();
    check(run($o)==='verified','exact controlled canary only');
});
test('customer HTTP handler denies wrong method, nonce and ownership', function() {
    $o=order(); $_REQUEST=['order_id'=>$o->id, 'key'=>$o->get_order_key()];
    foreach (['GET','POST'] as $method) {
        $_SERVER['REQUEST_METHOD']=$method; $_POST=[];
        try { mm_mr_zelle_handle_request(); throw new Exception('handler did not deny'); }
        catch(RequestDenied $e) { check($e->getMessage()==='403','nonce/method denied'); }
    }
    $_POST=['_mm_zelle_nonce'=>'synthetic-valid-mm_zelle_' . $o->id];
    $_REQUEST['key']='wrong';
    try { mm_mr_zelle_handle_request(); throw new Exception('handler did not deny'); }
    catch(RequestDenied $e) { check($e->getMessage()==='403','valid nonce not ownership'); }
    check($GLOBALS['completions']===0 && !wc_get_order($o->id)->get_meta('_mm_zelle_requested_at'), 'denials have no claim/payment side effects');
});
test('admin HTTP handler denies customer, GET, invalid nonce and missing attestation', function() {
    $o=claim(order()); $_SERVER['REQUEST_METHOD']='POST';
    $_POST=['order_id'=>$o->id,'decision'=>'verify_activate','bank_reference'=>'TEST-REFERENCE-1004','receipt_confirmed'=>'1','_mm_zelle_admin_nonce'=>'synthetic-valid-mm_zelle_admin_' . $o->id];
    try { mm_mr_zelle_handle_admin_review(); throw new Exception('handler did not deny'); }
    catch(RequestDenied $e) { check($e->getMessage()==='403','customer forbidden'); }
    $GLOBALS['admin']=true; $_SERVER['REQUEST_METHOD']='GET';
    try { mm_mr_zelle_handle_admin_review(); throw new Exception('handler did not deny'); }
    catch(RequestDenied $e) { check($e->getMessage()==='403','GET forbidden'); }
    $_SERVER['REQUEST_METHOD']='POST'; $_POST['_mm_zelle_admin_nonce']='wrong';
    try { mm_mr_zelle_handle_admin_review(); throw new Exception('handler did not deny'); }
    catch(RequestDenied $e) { check($e->getMessage()==='403','CSRF denied'); }
    $_POST['_mm_zelle_admin_nonce']='synthetic-valid-mm_zelle_admin_' . $o->id; unset($_POST['receipt_confirmed']);
    try { mm_mr_zelle_handle_admin_review(); throw new Exception('handler did not deny'); }
    catch(RequestDenied $e) { check($e->getMessage()==='409','no attestation cannot approve'); }
    check($GLOBALS['completions']===0,'no unauthorized canonical call');
});
test('bounded no-match retries enter review on final attempt', function() {
    $o=claim(order()); $GLOBALS['http']['body']=['ok'=>true,'state'=>'not_found'];
    for ($i=1; $i<=MM_MR_ZELLE_MAX_RETRIES; ++$i) {
        unset($GLOBALS['cron'][$o->id]); // A scheduled callback consumes its event.
        $state=run(wc_get_order($o->id));
        $current=wc_get_order($o->id);
        check($current->get_meta('_mm_zelle_retry_count')===$i,'exact bounded attempt count');
        check(!$current->is_paid() && $GLOBALS['completions']===0,'waiting never activates');
        if ($i<MM_MR_ZELLE_MAX_RETRIES) {
            check($state==='not_found' && isset($GLOBALS['cron'][$o->id]),'early miss schedules retry');
        } else {
            check($state==='needs_review','final miss enters review immediately');
            check($current->get_meta('_mm_zelle_review_hold')==='retry_limit','durable review hold');
            check(!isset($GLOBALS['cron'][$o->id]),'no further scheduled attempt');
            check($current->get_meta('_mm_zelle_requested_at')!=='','claim retained');
        }
    }
    $calls=$GLOBALS['http_calls'];
    check(run(wc_get_order($o->id))==='locked','review replay locked');
    check($GLOBALS['http_calls']===$calls,'no extra provider call after exhaustion');
    check(count(array_filter($GLOBALS['options'],fn($v,$k)=>str_starts_with($k,'mm_zelle_transaction_v2_'),ARRAY_FILTER_USE_BOTH))===0,'no financial ledger written');
});
test('late valid match on final allowed attempt completes once', function() {
    $o=claim(order()); $o->update_meta_data('_mm_zelle_retry_count',MM_MR_ZELLE_MAX_RETRIES-1); $o->save();
    check(run($o)==='verified','last permitted match accepted');
    check($GLOBALS['completions']===1 && wc_get_order($o->id)->is_paid(),'canonical test-double completion');
    check(!isset($GLOBALS['cron'][$o->id]),'successful match clears retry');
    check(run(wc_get_order($o->id))==='locked' && $GLOBALS['completions']===1,'paid replay idempotent');
});
test('final provider failure enters review and stops scheduling', function() {
    $o=claim(order()); $o->update_meta_data('_mm_zelle_retry_count',MM_MR_ZELLE_MAX_RETRIES-1); $o->save();
    $GLOBALS['http']=['code'=>503,'body'=>[]];
    check(run($o)==='needs_review','provider exhaustion reviewed');
    check(!wc_get_order($o->id)->is_paid() && $GLOBALS['completions']===0,'failure stays unpaid');
    check(!isset($GLOBALS['cron'][$o->id]),'failure retries bounded');
});
echo "SYNTHETIC ONLY: {$GLOBALS['cases']} cases, {$GLOBALS['assertions']} assertions passed. Live financial and entitlement acceptance NOT established.\n";
