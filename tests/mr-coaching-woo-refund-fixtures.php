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
function current_user_can($capability): bool { global $refundAdmin; return $refundAdmin && $capability === 'manage_woocommerce'; }
function wp_verify_nonce($nonce,$action): bool { return $nonce === 'fixture-nonce-' . $action; }
function add_option($key,$value,$deprecated='',$autoload=false): bool { global $hybridOptions; if (array_key_exists($key,$hybridOptions)) { return false; } $hybridOptions[$key]=$value; return true; }
function delete_option($key): bool { global $hybridOptions; unset($hybridOptions[$key]); return true; }
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
    public array $refunds = []; public array $deliveredHistory = []; public string $refunded = '0.00'; public int $saves = 0; public HybridItem $item;
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
    public function get_refunds(): array { return $this->refunds; }
}
final class WC_Order_Refund {
    public array $meta=[];
    public function __construct(public int $parent, public int $id=0, public string $amount='1.00') {}
    public function get_id(): int { return $this->id; }
    public function get_parent_id(): int { return $this->parent; }
    public function get_amount(): string { return $this->amount; }
    public function get_meta($key,$single) { return $this->meta[$key] ?? ''; }
    public function add_meta_data($key,$value,$unique): void { $this->meta[$key]=$value; }
}
final class WC_Stripe_Order_Helper {
    public static function get_instance(): self { static $instance; return $instance ??= new self; }
    public function is_stripe_charge_captured($order): bool { return $order->captured; }
    public function get_stripe_intent_id($order): string { return $order->intent; }
}


require_once $canonicalAssets . '/CoachingStripeLifecycle.php';
require_once $canonicalAssets . '/CoachingRefundDisposition.php';
$providerAssets=getenv('MM_TEST_PROVIDER_ASSETS') ?: $canonicalAssets;
require_once $providerAssets . '/CoachingProviderContainment.php';
require_once $providerAssets . '/CoachingWebexBroker.php';
$refundAdmin=true; $wpdb=$db; $refundProviderAttempts=0; $refundNextId=700000;
$moduleFile=dirname(__DIR__) . '/wp-content/mu-plugins/missionmed-mr-coaching.php';
$body=file_get_contents($moduleFile); $refundModuleSha=hash('sha256',$body);
$expectedRequires=array_map(static fn($n)=>"require_once __DIR__ . '/missionmed-mr-coaching-assets/{$n}.php';",['CoachingOfferPolicy','CoachingServicePolicy','CoachingWooAllocator','CoachingAllowanceProjection','CoachingEntitlementEndpoint','CoachingStripeLifecycle','CoachingRefundDisposition','CoachingProviderContainment','CoachingWebexBroker']);
preg_match_all('/^require_once .*;$/m',$body,$requires);
check($requires[0]===$expectedRequires,'refund exact nine module asset imports');
eval('?>'.str_replace($expectedRequires,'',$body));
$hybridPostMeta=[940001=>['_mmed_mr_coaching_sku'=>'single'],940002=>['_mmed_mr_coaching_sku'=>'three'],940003=>['_mmed_mr_coaching_sku'=>'five']];
$hybridOptions[MMED_MR_COACHING_OPTION]=['architecture'=>'woo_hybrid_v2','enabled'=>true,'product_ids'=>['single'=>940001,'three'=>940002,'five'=>940003],'purchasable_skus'=>['single','three','five'],'scheduler_read_wp_user_id'=>9];
foreach(['woo_allocation_verified','native_scheduler_verified','refund_disclosure_verified','independent_release_accepted','new_sku_zelle_compatibility_verified'] as $gate){$hybridOptions[MMED_MR_COACHING_OPTION][$gate]=true;}
$hybridCart->lines=[['product_id'=>940001,'quantity'=>1]];
$_POST['mmed_coaching_terms']='2026-10-20-v1';
function refundPaidPackage(int $id,string $sku='three'): HybridOrder {
    global $hybridOrders;
    $o=$hybridOrders[$id]=new HybridOrder($id);
    [$o->item->product,$o->item->total]=['single'=>[940001,'249.00'],'three'=>[940002,'749.00'],'five'=>[940003,'1199.00']][$sku];
    do_action('woocommerce_checkout_create_order',$o); do_action('woocommerce_checkout_order_processed',$id,[],$o);
    hybridStripeCreate($o,['amount'=>mmed_mr_coaching_cents($o->item->total),'currency'=>'usd']);
    $o->captured=true; do_action('woocommerce_pre_payment_complete',$id,$o->intent);
    $o->paid=true; $o->status='processing'; $o->paidAt=new DateTimeImmutable('@'.FIXTURE_NOW);
    do_action('woocommerce_payment_complete',$id);
    check(mmed_mr_coaching_hybrid_allowance_authority($o)!==null,'refund fixture SIMULATED original paid authority '.$id);
    return $o;
}
function refundPackage(HybridOrder $o): array {
    $response=CoachingEntitlementEndpoint::read(new HybridRequest($o->owner));
    check($response instanceof WP_REST_Response,'refund actual endpoint readable '.$o->id);
    $p=array_values(array_filter($response->data['packages'],static fn($p)=>$p['order_id']===$o->id));
    check(count($p)===1,'refund immutable original package present '.$o->id);
    return $p[0];
}
function refundApprove(HybridOrder $o,string $amount,array $retained): array {
    return mmed_mr_coaching_refund_approve($o->id,$amount,$retained,'fixture-nonce-mmed_coaching_refund_'.$o->id);
}
function refundBefore(HybridOrder $o,string $amount): WC_Order_Refund {
    $r=new WC_Order_Refund($o->id,0,$amount);
    do_action('woocommerce_create_refund',$r,['order_id'=>$o->id,'amount'=>$amount,'refund_id'=>0,'refund_payment'=>true]);
    return $r;
}
function refundPersistSynthetic(HybridOrder $o,WC_Order_Refund $r,bool $observe=true): void {
    global $hybridOrders,$refundNextId,$refundProviderAttempts;
    ++$refundProviderAttempts; // SIMULATED provider boundary, never a real call.
    $r->id=++$refundNextId; $hybridOrders[$r->id]=$r; $o->refunds[]=$r;
    $total=mmed_mr_coaching_cents($o->refunded)+mmed_mr_coaching_cents($r->amount);
    $o->refunded=number_format($total/100,2,'.','');
    if ($total===mmed_mr_coaching_cents($o->item->total)){ $o->status='refunded'; $o->paid=false; }
    if($observe){do_action('woocommerce_order_refunded',$o->id,$r->id);}
}
function refundSynthetic(HybridOrder $o,string $amount): WC_Order_Refund {$r=refundBefore($o,$amount);refundPersistSynthetic($o,$r);return $r;}

$full=refundPaidPackage(110001,'single'); $before=refundPackage($full); $n=$refundProviderAttempts;
rejects(fn()=>refundSynthetic($full,'249.00'),'refund missing disposition blocks before SIMULATED provider');
check($refundProviderAttempts===$n && $full->refunds===[],'refund missing disposition no financial/history mutation');
$refundAdmin=false;
rejects(fn()=>refundApprove($full,'249.00',[]),'refund wrong role cannot approve');
$refundAdmin=true;
rejects(fn()=>mmed_mr_coaching_refund_approve($full->id,'249.00',[],'forged'),'refund invalid admin nonce denied');
rejects(fn()=>mmed_mr_coaching_refund_approve($full->id,'249.00',[],'fixture-nonce-mmed_coaching_refund_999'),'refund nonce bound exact order');
rejects(fn()=>refundApprove($full,'249.00',$before['eligible_unit_ids']),'refund full must retain empty subset');
refundApprove($full,'249.00',[]); $fullRefund=refundSynthetic($full,'249.00'); $after=refundPackage($full);
check($after['units']===$before['units'] && $after['eligible_unit_ids']===[] && $after['eligibility_revision']===$before['eligibility_revision']+1,'refund full before booking retains immutable units and removes eligibility');
check($full->status==='refunded' && !$full->paid && count($full->refunds)===1 && $fullRefund->amount==='249.00','refund full preserves genuine SIMULATED financial facts');
do_action('woocommerce_payment_complete',$full->id);
check(refundPackage($full)===$after,'refund full paid callback replay cannot restore rights');
rejects(fn()=>refundSynthetic($full,'1.00'),'refund reused consumed full disposition denied');

$booked=refundPaidPackage(110002,'three'); $bookedBefore=refundPackage($booked);
$booked->deliveredHistory=[['unit_id'=>$bookedBefore['units'][0]['unit_id'],'status'=>'delivered','minutes'=>120],['unit_id'=>$bookedBefore['units'][1]['unit_id'],'status'=>'booked']];
$delivery=serialize($booked->deliveredHistory);
refundApprove($booked,'749.00',[]); refundSynthetic($booked,'749.00');
check(refundPackage($booked)['units']===$bookedBefore['units'] && refundPackage($booked)['eligible_unit_ids']===[] && serialize($booked->deliveredHistory)===$delivery,'refund full after delivery or booking does not rewrite delivered/booking history');

$partial=refundPaidPackage(110003,'three'); $p0=refundPackage($partial);
$partial->deliveredHistory=[['unit_id'=>$p0['units'][0]['unit_id'],'status'=>'delivered','minutes'=>120]]; $delivery=serialize($partial->deliveredHistory);
$retained=[$p0['eligible_unit_ids'][0],...array_slice($p0['eligible_unit_ids'],2)];
$attempts=$refundProviderAttempts; $historyBefore=serialize($partial->refunds);
rejects(fn()=>refundApprove($partial,'100.00',array_slice($p0['eligible_unit_ids'],2)),'refund Three partial cannot retain mocks while removing strategy history');
check($refundProviderAttempts===$attempts && serialize($partial->refunds)===$historyBefore,'refund missing-strategy rejection occurs before provider or accounting mutation');
refundApprove($partial,'100.00',$retained); $r1=refundSynthetic($partial,'100.00'); $p1=refundPackage($partial);
check($p1['units']===$p0['units'] && $p1['eligible_unit_ids']===$retained && $p1['eligibility_revision']===$p0['eligibility_revision']+1,'refund partial keeps exact retained subset with higher revision');
check(mmed_mr_coaching_hybrid_allowance_authority($partial)!==null && serialize($partial->deliveredHistory)===$delivery,'refund partial retains legitimate rights and delivered history');
$claim=$allocator->readOwned(mmed_mr_coaching_order_snapshot($partial,false));
check($claim['state']==='paid' && (int)$claim['cap_claimed']===1 && $claim['paid_at']!==null && $claim['financial_fingerprint']!==null,'refund validated partial keeps original paid evidence and never refills promotion');
do_action('woocommerce_order_refunded',$partial->id,$r1->id); do_action('woocommerce_payment_complete',$partial->id);
check(refundPackage($partial)===$p1,'refund partial observer/payment replay keeps exact rights and revision');
rejects(fn()=>refundApprove($partial,'50.00',$p0['eligible_unit_ids']),'refund later disposition cannot reintroduce removed rights');
rejects(fn()=>refundApprove($partial,'50.00',[$retained[0],$retained[0]]),'refund duplicate retained unit denied');
rejects(fn()=>refundApprove($partial,'50.00',['coaching-unit:v1:999:999:mock:1']),'refund foreign retained unit denied');
$nextRetained=[$retained[0],...array_slice($retained,2)];
refundApprove($partial,'50.00',$nextRetained); refundSynthetic($partial,'50.00'); $p2=refundPackage($partial);
check($p2['units']===$p0['units'] && $p2['eligible_unit_ids']===$nextRetained && $p2['eligibility_revision']===$p1['eligibility_revision']+1,'refund second partial strictly shrinks subset while retaining delivered strategy history');
refundApprove($partial,'599.00',[]); refundSynthetic($partial,'599.00'); $p3=refundPackage($partial);
check($p3['eligible_unit_ids']===[] && $p3['units']===$p0['units'] && $p3['eligibility_revision']===$p2['eligibility_revision']+1 && count($partial->refunds)===3,'refund final remainder empties eligibility without deleting history');

$stale=refundPaidPackage(110004,'single'); refundApprove($stale,'10.00',[]); $n=$refundProviderAttempts;
rejects(fn()=>refundSynthetic($stale,'11.00'),'refund approved amount mismatch denied before provider');
check($refundProviderAttempts===$n && $stale->refunds===[],'refund amount mismatch no accounting changes');
$hybridNow=FIXTURE_NOW+900; at($pdo,$hybridNow);
rejects(fn()=>refundSynthetic($stale,'10.00'),'refund expired approval denied');
$hybridNow=FIXTURE_NOW; at($pdo,$hybridNow);
$stale->owner=43;
rejects(fn()=>refundSynthetic($stale,'10.00'),'refund changed owner snapshot denied');
$stale->owner=42;
refundApprove($stale,'10.00',CoachingAllowanceProjection::unitIds(mmed_mr_coaching_order_snapshot($stale,false)));
$stale->meta['_mmed_mr_coaching_risk_hold']='review.opened';
rejects(fn()=>refundSynthetic($stale,'10.00'),'refund newly risk-held order cannot use prior retained-rights disposition');
check($stale->meta['_mmed_mr_coaching_risk_hold']==='review.opened','refund original risk hold persists');

$inflight=refundPaidPackage(110005,'single'); refundApprove($inflight,'10.00',[]); $pending=refundBefore($inflight,'10.00'); $n=$refundProviderAttempts;
check(mmed_mr_coaching_hybrid_allowance_authority($inflight)===null,'refund consumed inflight approval denies fresh authority before actual history');
rejects(fn()=>refundApprove($inflight,'10.00',[]),'refund inflight decision cannot be replaced to permit another refund');
rejects(fn()=>refundSynthetic($inflight,'10.00'),'refund inflight replay cannot reach provider');
check($refundProviderAttempts===$n,'refund inflight no automatic financial retry');

$external=refundPaidPackage(110006,'single'); $externalBefore=refundPackage($external);
$bypass=new WC_Order_Refund($external->id,0,'10.00'); refundPersistSynthetic($external,$bypass);
check(mmed_mr_coaching_hybrid_allowance_authority($external)===null && $external->meta['_mmed_mr_coaching_state']==='refund_review_required','refund external dashboard bypass quarantines fresh rights');
check(count($external->refunds)===1 && $external->refunded==='10.00' && $bypass->meta===[],'refund external bypass retains actual history and never fabricates disposition');
check($allocator->readOwned(mmed_mr_coaching_order_snapshot($external,false))['state']==='revoked','refund external bypass quarantines allocator without cap refill');
$forged=refundPaidPackage(110007,'single'); $approval=refundApprove($forged,'10.00',[]);
$forgedRefund=new WC_Order_Refund($forged->id,0,'10.00'); $forgedEnvelope=$approval; unset($forgedEnvelope['status'],$forgedEnvelope['refund_id']); $forgedRefund->meta['_mmed_coaching_refund_disposition']=$forgedEnvelope;
refundPersistSynthetic($forged,$forgedRefund);
check(mmed_mr_coaching_hybrid_allowance_authority($forged)===null,'refund forged metadata without consumed server approval denied');

$reused=refundPaidPackage(110008,'single'); refundApprove($reused,'10.00',[]); $used=refundSynthetic($reused,'10.00');
$copy=new WC_Order_Refund($reused->id,0,'10.00'); $copy->meta=$used->meta; refundPersistSynthetic($reused,$copy);
check(mmed_mr_coaching_hybrid_allowance_authority($reused)===null && count($reused->refunds)===2,'refund reused disposition on another actual refund quarantines without erasing accounting');

$old=$hybridOrders[110009]=new HybridOrder(110009); $old->item->product=5504;
$oldBefore=serialize($old); $oldRefund=new WC_Order_Refund($old->id,0,'1.00');
do_action('woocommerce_create_refund',$oldRefund,['order_id'=>$old->id,'amount'=>'1.00','refund_id'=>0,'refund_payment'=>true]);
check(serialize($old)===$oldBefore && $oldRefund->meta===[],'refund unrelated protected product pre-provider hook untouched');
check($hybridForbiddenWrites===[],'refund no user/course/product rights writes');

$projection=new CoachingAllowanceProjection(mmed_mr_coaching_config()['product_ids']);
$validOrder=refundPaidPackage(110010,'single'); $validAuthority=mmed_mr_coaching_hybrid_allowance_authority($validOrder); $s=mmed_mr_coaching_order_snapshot($validOrder,false);
$e=$validAuthority['evidence']; unset($e['eligible_unit_ids']);
rejects(fn()=>$projection->project($s,$e,new DateTimeImmutable('@'.FIXTURE_NOW)),'refund projection requires eligible IDs explicitly');
$e=$validAuthority['evidence']; $e['eligible_unit_ids']=['coaching-unit:v1:999:999:mock:1'];
rejects(fn()=>$projection->project($s,$e,new DateTimeImmutable('@'.FIXTURE_NOW)),'refund projection rejects foreign eligibility');

$cancelled=refundPaidPackage(110011,'single'); $cancelled->status='cancelled'; $cancelled->paid=false;
check(mmed_mr_coaching_hybrid_allowance_authority($cancelled)===null,'refund cancelled genuine-paid order has no public access authority');
$cancelledIds=CoachingAllowanceProjection::unitIds(mmed_mr_coaching_order_snapshot($cancelled,false));
rejects(fn()=>refundApprove($cancelled,'10.00',$cancelledIds),'refund cancelled order cannot retain or restore units');
$ack=$cancelled->meta['_mmed_mr_coaching_fulfillment_ack']; $cancelled->meta['_mmed_mr_coaching_fulfillment_ack']=str_repeat('0',64);
rejects(fn()=>refundApprove($cancelled,'249.00',[]),'refund-only boundary still requires exact original fulfillment ack');
$cancelled->meta['_mmed_mr_coaching_fulfillment_ack']=$ack;
refundApprove($cancelled,'249.00',[]); refundSynthetic($cancelled,'249.00');
check(refundPackage($cancelled)['eligible_unit_ids']===[] && $cancelled->refunded==='249.00','refund cancelled genuine-paid full refund succeeds with zero access');

$risk=refundPaidPackage(110012,'single');
do_action('wc_stripe_webhook_received','charge.dispute.created',(object)[],$risk);
check(mmed_mr_coaching_hybrid_allowance_authority($risk)===null,'refund risk-held original payment is not current access authority');
rejects(fn()=>refundApprove($risk,'10.00',CoachingAllowanceProjection::unitIds(mmed_mr_coaching_order_snapshot($risk,false))),'refund risk-held paid order must retain zero units');
refundApprove($risk,'249.00',[]); refundSynthetic($risk,'249.00');
check(mmed_mr_coaching_hybrid_allowance_authority($risk)===null && $risk->meta['_mmed_mr_coaching_risk_hold']==='charge.dispute.created' && $risk->meta['_mmed_mr_coaching_state']==='needs_review','refund risk-held genuine-paid full refund preserves hold and denies access');

$revoked=refundPaidPackage(110013,'three'); $revokedS=mmed_mr_coaching_order_snapshot($revoked,false);
$initialIds=CoachingAllowanceProjection::unitIds($revokedS);
refundApprove($revoked,'100.00',[$initialIds[0],...array_slice($initialIds,2)]); refundSynthetic($revoked,'100.00');
$preRevocation=mmed_mr_coaching_hybrid_allowance_authority($revoked);
$allocator->quarantineRefund($revokedS); $revoked->meta['_mmed_mr_coaching_state']='needs_review';
refundApprove($revoked,'649.00',[]); refundSynthetic($revoked,'649.00');
$revokedCurrent=mmed_mr_coaching_refund_original_authority($revoked)['current'];
check($revokedCurrent['eligible_unit_ids']===[] && $revokedCurrent['eligibility_revision']===$preRevocation['eligibility_revision']+1 && count($revoked->refunds)===2,'refund original paid chain survives later allocator quarantine with monotonic revision');
check(mmed_mr_coaching_hybrid_allowance_authority($revoked)===null && $allocator->readOwned($revokedS)['state']==='revoked' && $revoked->meta['_mmed_mr_coaching_state']==='needs_review','refund revoked paid remainder can refund without restoring allocator/access state');

$unpaid=$hybridOrders[110014]=new HybridOrder(110014);
do_action('woocommerce_checkout_create_order',$unpaid); do_action('woocommerce_checkout_order_processed',$unpaid->id,[],$unpaid);
$attempts=$refundProviderAttempts;
rejects(fn()=>refundApprove($unpaid,'249.00',[]),'refund-only boundary denies unpaid approval');
rejects(fn()=>refundSynthetic($unpaid,'249.00'),'refund-only boundary denies unpaid before provider');
check($refundProviderAttempts===$attempts && $unpaid->refunds===[],'refund-only unpaid denial leaves financial history unchanged');
$five=refundPaidPackage(110015,'five'); $fiveIds=CoachingAllowanceProjection::unitIds(mmed_mr_coaching_order_snapshot($five,false));
rejects(fn()=>refundApprove($five,'100.00',array_slice($fiveIds,1)),'refund Five partial cannot retain mocks while removing strategy history');
$fiveApproval=refundApprove($five,'100.00',$fiveIds);
// A pre-existing server record with invalid prerequisite semantics must also
// fail at the final binding boundary, before the financial request begins.
$fiveApproval['eligible_unit_ids']=array_slice($fiveIds,1);
$hybridOptions['mmed_coaching_refund_disposition_'.$fiveApproval['id']]=$fiveApproval;
$attempts=$refundProviderAttempts;
rejects(fn()=>refundSynthetic($five,'100.00'),'refund pre-provider binding rejects legacy invalid strategy disposition');
check($refundProviderAttempts===$attempts && $five->refunds===[],'refund legacy missing-strategy disposition never reaches provider');
unset($_POST['mmed_coaching_terms']);
