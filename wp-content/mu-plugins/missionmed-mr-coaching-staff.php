<?php
/** Plugin Name: Mission Residency Staff-Assisted Coaching
 * Version: 2026.10.20.1
 * DR-520: native Woo sales only. No Scheduler/Webex/course/access writes.
 */
defined('ABSPATH') || exit;

function mmed_staff_coaching_config() {
    $c = get_option('mmed_staff_coaching_v1', []);
    return is_array($c) ? $c : [];
}
function mmed_staff_coaching_catalog() {
    return [
        'single'=>['name'=>'Single Signature Mock','regular'=>39900,'promo'=>24900,'services'=>'One 105-minute Signature Mock: 15 minutes of simulated interview followed by 90 minutes of individualized evaluation and correction.'],
        'three'=>['name'=>'Three Signature Mocks','regular'=>109900,'promo'=>74900,'services'=>'Three 105-minute Signature Mocks, one two-hour private strategy session before the first mock, and two 45-minute post-interview debriefs.'],
        'five'=>['name'=>'Five Signature Mocks','regular'=>179900,'promo'=>119900,'services'=>'Five 105-minute Signature Mocks, one two-hour private strategy session before the first mock, and three 45-minute post-interview debriefs.'],
        'emergency'=>['name'=>'Emergency Interview Intensive','regular'=>399900,'promo'=>249900,'services'=>'One eight-hour private training day with Dr Brian, including one 105-minute Signature Mock, plus two separate 105-minute follow-up mocks and one additional 45-minute post-interview debrief.'],
    ];
}
function mmed_staff_coaching_sku($id) {
    $c=mmed_staff_coaching_config();
    foreach (($c['product_ids'] ?? []) as $sku=>$mapped) {
        if (isset(mmed_staff_coaching_catalog()[$sku]) && is_int($mapped) && $mapped===(int)$id
            && !in_array($mapped, MMED_MR_COACHING_PROTECTED_IDS, true)
            && get_post_meta($mapped,'_mmed_staff_coaching_sku',true)===$sku) { return $sku; }
    }
    return '';
}
/** Deny-only recognition survives missing/corrupt configuration. Never grants rights. */
function mmed_staff_coaching_tagged($id) {
    return !in_array((int)$id,MMED_MR_COACHING_PROTECTED_IDS,true)
        && isset(mmed_staff_coaching_catalog()[(string)get_post_meta((int)$id,'_mmed_staff_coaching_sku',true)]);
}
function mmed_staff_coaching_ready($sku) {
    $c=mmed_staff_coaching_config(); $id=$c['product_ids'][$sku] ?? 0;
    if (($c['enabled'] ?? false)!==true || ($c['release_reviewed'] ?? false)!==true
        || !in_array($sku,['single','three','five'],true) || !is_int($id)
        || mmed_staff_coaching_sku($id)!==$sku) { return false; }
    $p=wc_get_product($id);
    return $p && $p->is_virtual() && $p->get_status()==='publish'
        && mmed_mr_coaching_cents($p->get_price('edit'))===mmed_staff_coaching_catalog()[$sku]['regular'];
}
function mmed_staff_coaching_lines() {
    return function_exists('WC') && WC()->cart ? WC()->cart->get_cart() : [];
}
function mmed_staff_coaching_cart() {
    foreach (mmed_staff_coaching_lines() as $line) { if (mmed_staff_coaching_sku($line['product_id'] ?? 0)) { return true; } }
    return false;
}
/** Approved coaching tuition has no card surcharge. Leave global fee settings intact. */
function mmed_staff_coaching_fees($cart) {
    if (!WC()->session || WC()->session->get('chosen_payment_method')!=='stripe') { return; }
    $lines=$cart->get_cart(); if (count($lines)!==1) { return; }
    $line=reset($lines); $sku=mmed_staff_coaching_sku($line['product_id'] ?? 0);
    if (!$sku || !mmed_staff_coaching_ready($sku) || (float)($line['quantity'] ?? 0)!==1.0) { return; }
    $keep=[]; $changed=false;
    foreach ($cart->fees_api()->get_fees() as $fee) {
        if ($fee->name==='Card processing fee (2.9%)') { $changed=true; continue; }
        $keep[]=(array)$fee;
    }
    if ($changed) { $cart->fees_api()->set_fees($keep); }
}
function mmed_staff_coaching_order($order) {
    if (!$order) { return false; }
    foreach ($order->get_items('line_item') as $item) { if (mmed_staff_coaching_sku($item->get_product_id())) { return true; } }
    return false;
}
function mmed_staff_coaching_coupon($valid,$coupon) {
    if (!mmed_staff_coaching_cart()) { return $valid; }
    if (!$valid) { return false; }
    $lines=mmed_staff_coaching_lines();
    if (strtolower($coupon->get_code())!=='matchready2026' || count($lines)!==1 || time()>=1793505600) {
        throw new Exception('This code cannot be used with this coaching selection.');
    }
    $line=reset($lines); $sku=mmed_staff_coaching_sku($line['product_id'] ?? 0);
    if (!$sku || !mmed_staff_coaching_ready($sku) || (float)($line['quantity'] ?? 0)!==1.0) {
        throw new Exception('Select one available coaching package for this code.');
    }
    foreach (WC()->cart->get_applied_coupons() as $code) {
        if (strtolower($code)!=='matchready2026') { throw new Exception('Coaching offers cannot be combined with another coupon.'); }
    }
    return $valid;
}
function mmed_staff_coaching_discount($amount,$base,$line,$single,$coupon) {
    if (strtolower($coupon->get_code())!=='matchready2026') { return $amount; }
    $sku=mmed_staff_coaching_sku($line['product_id'] ?? 0);
    if (!$sku || !mmed_staff_coaching_ready($sku) || time()>=1793505600) { return 0; }
    $p=mmed_staff_coaching_catalog()[$sku];
    return min((float)$base,($p['regular']-$p['promo'])/100);
}
function mmed_staff_coaching_snapshot($order) {
    if (!mmed_staff_coaching_order($order)) { return null; }
    $items=$order->get_items('line_item'); $item=reset($items);
    $sku=mmed_staff_coaching_sku($item->get_product_id());
    $codes=array_map('strtolower',$order->get_coupon_codes());
    if (count($items)!==1 || !$sku || $sku==='emergency' || $item->get_variation_id()
        || (float)$item->get_quantity()!==1.0 || $order->get_currency()!=='USD'
        || (int)$order->get_customer_id()<1 || !in_array($order->get_payment_method(),['stripe','bacs'],true)
        || ($codes && $codes!==['matchready2026']) || !$order->get_date_created()
        || $order->get_meta('_mmed_staff_coaching_terms',true)!=='2026-10-20-staff-v1') {
        throw new RuntimeException('Please return to the private-coaching checkout to review your selection.');
    }
    $offer=mmed_staff_coaching_catalog()[$sku];
    $expected=$codes ? $offer['promo'] : $offer['regular'];
    if (mmed_mr_coaching_cents($item->get_total('edit'))!==$expected
        || mmed_mr_coaching_cents($order->get_total('edit'))!==$expected
        || mmed_mr_coaching_cents($order->get_total_fees())!==0 || mmed_mr_coaching_cents($order->get_total_tax())!==0) {
        throw new RuntimeException('Coaching checkout total needs review before payment.');
    }
    $s=['order_id'=>(int)$order->get_id(),'item_id'=>(int)$item->get_id(),'customer_id'=>(int)$order->get_customer_id(),
        'product_id'=>(int)$item->get_product_id(),'sku'=>$sku,'gateway'=>$order->get_payment_method(),
        'amount_cents'=>$expected,'created_at'=>$order->get_date_created()->getTimestamp()];
    $s['digest']=hash('sha256',wp_json_encode($s)); return $s;
}
function mmed_staff_coaching_admit($id,$posted=[],$order=null) {
    $order=$order ?: wc_get_order($id); if (!mmed_staff_coaching_order($order)) { return; }
    $s=mmed_staff_coaching_snapshot($order);
    if (!mmed_staff_coaching_ready($s['sku'])) { throw new RuntimeException('This coaching selection is not available.'); }
    $order->update_meta_data('_mmed_mr_coaching_admitted','yes');
    $order->update_meta_data('_mmed_mr_coaching_snapshot',$s['digest']);
    $order->update_meta_data('_mmed_staff_coaching_state','awaiting_verified_payment');
    $order->save();
}
function mmed_staff_coaching_identity($prior,$order) {
    if ($prior!==false || !mmed_staff_coaching_order($order)) { return $prior; }
    try {
        $s=mmed_staff_coaching_snapshot($order);
        if ($s['gateway']!=='bacs' || $order->get_meta('_mmed_mr_coaching_admitted',true)!=='yes'
            || !hash_equals($s['digest'],(string)$order->get_meta('_mmed_mr_coaching_snapshot',true))) { return false; }
        return ['kind'=>'private_coaching','product_id'=>$s['product_id'],'variation_id'=>0,'snapshot_digest'=>$s['digest']];
    } catch (Throwable $e) { return false; }
}
function mmed_staff_coaching_zelle_allowed($order,$reference) {
    try {
        $s=mmed_staff_coaching_snapshot($order);
        return $s && $s['gateway']==='bacs' && $order->get_meta('_mmed_mr_coaching_admitted',true)==='yes'
            && hash_equals($s['digest'],(string)$order->get_meta('_mmed_mr_coaching_snapshot',true))
            && time()<$s['created_at']+86400 && preg_match('/^[a-f0-9]{64}$/D',(string)$reference)
            && hash_equals((string)$reference,(string)$order->get_meta('_mm_zelle_fingerprint',true))
            && $order->get_meta('_mm_zelle_state',true)==='completing'
            && (string)get_option('mm_zelle_transaction_v2_'.$reference,'')===(string)$order->get_id();
    } catch (Throwable $e) { return false; }
}
function mmed_staff_coaching_paid($order) {
    try {
        $s=mmed_staff_coaching_snapshot($order);
        if (!$s || !$order->is_paid() || !$order->has_status(['processing','completed']) || !$order->get_date_paid()
            || (float)$order->get_total_refunded()>0 || $order->get_meta('_mmed_mr_coaching_admitted',true)!=='yes'
            || !hash_equals($s['digest'],(string)$order->get_meta('_mmed_mr_coaching_snapshot',true))) { return false; }
        if ($s['gateway']==='bacs') {
            $f=(string)$order->get_meta('_mm_zelle_fingerprint',true);
            return preg_match('/^[a-f0-9]{64}$/D',$f) && in_array($order->get_meta('_mm_zelle_state',true),['completing','verified'],true)
                && (string)get_option('mm_zelle_transaction_v2_'.$f,'')===(string)$order->get_id();
        }
        return class_exists('WC_Stripe_Order_Helper') && WC_Stripe_Order_Helper::get_instance()->is_stripe_charge_captured($order)
            && preg_match('/^(pi|ch)_[-A-Za-z0-9]+$/D',(string)$order->get_transaction_id());
    } catch (Throwable $e) { return false; }
}
function mmed_staff_coaching_confirmation($order,$plain=false) {
    if (!mmed_staff_coaching_paid($order)) { return ''; }
    $s=mmed_staff_coaching_snapshot($order); $p=mmed_staff_coaching_catalog()[$s['sku']];
    $text="PAYMENT CONFIRMED - STAFF-ASSISTED BOOKING\n".$p['name']."\n".$p['services']."\nContact admissions at info@missionmedinstitute.com with order #".$order->get_order_number()." and your preferred dates, interview date and timezone. Staff will confirm actual availability and schedule your services. No appointment or automatic Matrix/replay access is confirmed by this payment. For Three/Five packages, strategy takes place before your first mock.\n";
    return $plain ? $text : '<style>.woocommerce-order-received .mmps-shell,.woocommerce-order-received a[href*="/member-dashboard/"]{display:none!important}.mmed-staff-booking{background:#fff;padding:24px;border:1px solid #718096}.mmed-staff-booking h2,.mmed-staff-booking p,.mmed-staff-booking a{color:#172438!important}.mmed-staff-booking a{text-decoration:underline}</style><section class="mmed-staff-booking"><h2>Payment confirmed. Let\'s arrange your coaching.</h2><p>'.esc_html($p['services']).'</p><p><a href="mailto:info@missionmedinstitute.com">Contact admissions</a> with order #'.esc_html($order->get_order_number()).', preferred dates, interview date and timezone. Staff confirms actual available appointments. No appointment or automatic Matrix/replay access is confirmed by payment.</p><p>For Three/Five packages, your strategy session comes before your first mock.</p></section>';
}
function mmed_staff_coaching_pay_guard($order,$submitted_gateway) {
    if (!mmed_staff_coaching_order($order)) { return; }
    $s=mmed_staff_coaching_snapshot($order);
    if (!$s || !mmed_staff_coaching_ready($s['sku']) || !is_string($submitted_gateway)
        || $submitted_gateway!==$s['gateway'] || $order->get_meta('_mmed_mr_coaching_admitted',true)!=='yes'
        || !hash_equals($s['digest'],(string)$order->get_meta('_mmed_mr_coaching_snapshot',true))) {
        throw new RuntimeException('Use the original payment method for this order. To change methods, contact admissions before paying.');
    }
    if ($s['gateway']==='bacs' && time()>=$s['created_at']+86400) {
        throw new RuntimeException('This Zelle payment window has expired. Contact admissions before sending payment.');
    }
}
function mmed_staff_coaching_fulfill($id) {
    $order=wc_get_order($id); if (!mmed_staff_coaching_order($order) || !mmed_staff_coaching_paid($order)) { return; }
    $order->update_meta_data('_mmed_staff_coaching_state','awaiting_staff_booking'); $order->save();
    // Atomic one-attempt claim. Unknown transport outcomes are never auto-retried.
    if (!add_option('mmed_staff_coaching_notice_'.$id,'attempted','','no')) { return; }
    $body=mmed_staff_coaching_confirmation($order,true)."\nSTAFF: Review canonical paid/refund state before scheduling. Protect current360/Complete appointments; new coaching max20hours/week. Use existing Matrix Scheduler only where supported. Record delivered services in order notes. No protected links before current verified eligibility.\nAuthenticated order review: ".admin_url('post.php?post='.$id.'&action=edit');
    $sent=wp_mail(get_option('admin_email'),'Private coaching booking handoff - order #'.$order->get_order_number(),$body);
    $order->update_meta_data('_mmed_staff_coaching_staff_notice',$sent ? 'transport_accepted' : 'transport_failed');
    $order->add_order_note('Staff-assisted coaching: payment verified; appointment availability must be confirmed. Staff handoff '.($sent?'accepted by mail transport':'failed; manual follow-up required').'. No course or Matrix grant performed.');
    $order->save();
}

add_filter('woocommerce_is_purchasable',function($ok,$p){
    $s=mmed_staff_coaching_sku($p->get_id());
    if (!$s && mmed_staff_coaching_tagged($p->get_id())) { return false; }
    return $s ? $ok && mmed_staff_coaching_ready($s) : $ok;
},200,2);
add_filter('woocommerce_add_to_cart_validation',function($ok,$id,$qty,$variation=0){
    if (!mmed_staff_coaching_sku($id) && !mmed_staff_coaching_tagged($id) && !mmed_staff_coaching_cart()) { return $ok; }
    $s=mmed_staff_coaching_sku($id);
    if (!$s || !mmed_staff_coaching_ready($s) || (float)$qty!==1.0 || $variation || mmed_staff_coaching_lines()) {
        wc_add_notice('Please select one private-coaching package per order. Emergency dates must be requested first.','error');return false;
    }return $ok;
},200,4);
add_filter('woocommerce_coupon_is_valid','mmed_staff_coaching_coupon',200,2);
// The installed gateway-fee plugin also uses PHP_INT_MAX. Register after init,
// before Woo loads the cart (wp_loaded:10), so our same-priority callback is last.
add_action('wp_loaded',function(){
    add_action('woocommerce_cart_calculate_fees','mmed_staff_coaching_fees',PHP_INT_MAX);
},1);
add_filter('woocommerce_coupon_get_discount_amount','mmed_staff_coaching_discount',200,5);
add_action('woocommerce_add_to_cart',function($key,$id){
    if (mmed_staff_coaching_sku($id) && time()<1793505600 && WC()->cart
        && !WC()->cart->get_applied_coupons()) { WC()->cart->apply_coupon('MATCHREADY2026'); }
},200,2);
add_action('woocommerce_check_cart_items',function(){
    if (!mmed_staff_coaching_cart()) { return; }
    $lines=mmed_staff_coaching_lines(); $line=reset($lines); $s=mmed_staff_coaching_sku($line['product_id'] ?? 0);
    if (count($lines)!==1 || !$s || !mmed_staff_coaching_ready($s) || (float)($line['quantity'] ?? 0)!==1.0) {
        wc_add_notice('Select one available private-coaching package per checkout.','error');
    }
});
add_filter('woocommerce_available_payment_gateways',function($g){
    if (function_exists('is_wc_endpoint_url') && is_wc_endpoint_url('order-pay')) {
        $o=wc_get_order(absint(get_query_var('order-pay')));
        if (mmed_staff_coaching_order($o)) { return array_intersect_key($g,[$o->get_payment_method()=>true]); }
    }
    return mmed_staff_coaching_cart()?array_intersect_key($g,['stripe'=>true,'bacs'=>true]):$g;
},200);
add_filter('woocommerce_checkout_registration_required',function($v){return mmed_staff_coaching_cart()?true:$v;},200);
add_filter('woocommerce_checkout_registration_enabled',function($v){return mmed_staff_coaching_cart()?true:$v;},200);
add_action('woocommerce_review_order_before_submit',function(){
    if (!mmed_staff_coaching_cart()) { return; }
    echo '<section style="background:#fff;color:#172438;padding:18px;border:1px solid #8b99a8"><h3 style="color:#172438">Private coaching - staff-assisted booking</h3><p>Payment does not reserve an immediate slot. Staff confirms actual availability; strategy precedes the first mock for Three/Five packages. No automatic Matrix/replay access.</p><p>Unused-service refund requests within 14 days of verified payment, subject to law. Deduct only delivered services: mock $399; strategy $299; debrief $149; intensive day $1,799 including its mock, never counted twice. No deduction above payment, negative refund or charge for unused bonus access.</p><p>Reschedule without penalty at least 24 hours ahead; shorter notice may forfeit. One documented-emergency courtesy exception. Unverified Zelle remains unpaid; send within 24 hours. Late payment requires secure staff review.</p><label style="color:#172438"><input type="checkbox" name="mmed_staff_coaching_terms" value="2026-10-20-staff-v1" required> I accept staff-assisted scheduling and these written coaching terms, which supplement the <a href="/refund-cancellation-policy/">refund policy</a>.</label></section>';
});
add_action('woocommerce_checkout_create_order',function($order){
    if (!mmed_staff_coaching_cart()) { return; }
    if (($_POST['mmed_staff_coaching_terms'] ?? '')!=='2026-10-20-staff-v1') { throw new RuntimeException('Please accept the private-coaching terms.'); }
    $order->update_meta_data('_mmed_staff_coaching_terms','2026-10-20-staff-v1');
},30);
add_action('woocommerce_checkout_order_processed','mmed_staff_coaching_admit',30,3);
add_action('woocommerce_before_pay_action',function($id){
    $o=wc_get_order($id); if (!mmed_staff_coaching_order($o)) { return; }
    mmed_staff_coaching_pay_guard($o,$_POST['payment_method'] ?? '');
},30);
add_filter('mmed_mr_coaching_zelle_identity','mmed_staff_coaching_identity',20,2);
add_action('woocommerce_payment_complete','mmed_staff_coaching_fulfill',30);
add_action('woocommerce_thankyou',function($id){$o=wc_get_order($id);if(mmed_staff_coaching_order($o)&&$o->get_payment_method()!=='bacs')echo mmed_staff_coaching_confirmation($o);},40);
add_action('woocommerce_email_order_details',function($o,$admin,$plain){if(mmed_staff_coaching_order($o)&&$o->get_payment_method()!=='bacs')echo mmed_staff_coaching_confirmation($o,$plain);},30,3);
