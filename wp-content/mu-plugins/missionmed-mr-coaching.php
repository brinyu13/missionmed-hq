<?php
/**
 * Plugin Name: Mission Residency Private Coaching
 * Description: Default-closed, order-bound coaching admission and Woo-owned allocations and request-fresh purchased allowances.
 * Version: 2026.10.20.2-candidate
 */
defined('ABSPATH') || exit;

require_once __DIR__ . '/missionmed-mr-coaching-assets/CoachingOfferPolicy.php';
require_once __DIR__ . '/missionmed-mr-coaching-assets/CoachingServicePolicy.php';
require_once __DIR__ . '/missionmed-mr-coaching-assets/CoachingWooAllocator.php';
require_once __DIR__ . '/missionmed-mr-coaching-assets/CoachingAllowanceProjection.php';
require_once __DIR__ . '/missionmed-mr-coaching-assets/CoachingEntitlementEndpoint.php';
require_once __DIR__ . '/missionmed-mr-coaching-assets/CoachingStripeLifecycle.php';
require_once __DIR__ . '/missionmed-mr-coaching-assets/CoachingRefundDisposition.php';
require_once __DIR__ . '/missionmed-mr-coaching-assets/CoachingProviderContainment.php';
require_once __DIR__ . '/missionmed-mr-coaching-assets/CoachingWebexBroker.php';

add_action('rest_api_init','mmed_coaching_webex_register');
add_action('rest_api_init','mmed_coaching_webex_register_oauth',PHP_INT_MAX);
add_filter('mmed_scheduler_webex_oauth_scopes','mmed_coaching_webex_scope');

const MMED_MR_COACHING_OPTION = 'mmed_mr_coaching_v1';
const MMED_MR_COACHING_CUTOFF = 1793505600; // Exclusive 2026-11-01T04:00:00Z.
const MMED_MR_COACHING_PROTECTED_IDS = array(5504, 5867, 3576, 5865, 5513, 5873, 3575, 5862, 5863);

function mmed_mr_coaching_now() { return (int) current_time('timestamp', true); }

function mmed_mr_coaching_catalog() {
    return array(
        'single' => array('name' => 'Single Signature Mock', 'regular' => 39900, 'promo' => 24900),
        'three' => array('name' => 'Three Signature Mocks', 'regular' => 109900, 'promo' => 74900),
        'five' => array('name' => 'Five Signature Mocks', 'regular' => 179900, 'promo' => 119900),
        'emergency' => array('name' => 'Emergency Interview Intensive', 'regular' => 399900, 'promo' => 249900),
    );
}

function mmed_mr_coaching_config() {
    $value = get_option(MMED_MR_COACHING_OPTION, array());
    return is_array($value) ? $value : array();
}

function mmed_mr_coaching_cents($value) {
    $value = (string) $value;
    if (!preg_match('/^(0|[1-9][0-9]{0,7})(?:\.([0-9]{1,2}))?$/D', $value, $m)) {
        throw new RuntimeException('Invalid coaching amount.');
    }
    return ((int) $m[1]) * 100 + (int) str_pad($m[2] ?? '', 2, '0');
}

function mmed_mr_coaching_sku($product_id) {
    if (in_array((int) $product_id, MMED_MR_COACHING_PROTECTED_IDS, true)) { return ''; }
    $catalog = mmed_mr_coaching_catalog();
    $config = mmed_mr_coaching_config();
    foreach (($config['product_ids'] ?? array()) as $sku => $id) {
        if (isset($catalog[$sku]) && is_int($id) && $id === (int) $product_id) {
            return $sku;
        }
    }
    $meta = (string) get_post_meta((int) $product_id, '_mmed_mr_coaching_sku', true);
    return isset($catalog[$meta]) ? $meta : '';
}

function mmed_mr_coaching_release_ready($sku) {
    $c = mmed_mr_coaching_config();
    $id = $c['product_ids'][$sku] ?? null;
    if (($c['architecture'] ?? '') !== 'woo_hybrid_v2' || ($c['enabled'] ?? false) !== true || !in_array($sku, array('single', 'three', 'five'), true)
        || !in_array($sku, $c['purchasable_skus'] ?? array(), true) || !is_int($id) || $id <= 0
        || in_array($id, MMED_MR_COACHING_PROTECTED_IDS, true)
        || count(array_keys($c['product_ids'] ?? array(), $id, true)) !== 1
        || (string) get_post_meta($id, '_mmed_mr_coaching_sku', true) !== $sku) {
        return false;
    }
    foreach (array('woo_allocation_verified', 'native_scheduler_verified', 'refund_disclosure_verified', 'independent_release_accepted', 'new_sku_zelle_compatibility_verified') as $gate) {
        if (($c[$gate] ?? false) !== true) { return false; }
    }
    $product = wc_get_product($id);
    return $product && $product->is_virtual() && $product->get_status() === 'publish'
        && mmed_mr_coaching_cents($product->get_regular_price('edit')) === mmed_mr_coaching_catalog()[$sku]['regular'];
}

function mmed_mr_coaching_cart_lines() {
    return function_exists('WC') && WC()->cart ? WC()->cart->get_cart() : array();
}

function mmed_mr_coaching_cart_contains() {
    foreach (mmed_mr_coaching_cart_lines() as $line) {
        if (mmed_mr_coaching_sku((int) ($line['product_id'] ?? 0))) { return true; }
    }
    return false;
}

function mmed_mr_coaching_unavailable() {
    return 'This coaching selection is not currently available. Please return to Mission Residency or contact MissionMed.';
}

function mmed_mr_coaching_is_purchasable($allowed, $product) {
    $sku = mmed_mr_coaching_sku($product->get_id());
    if (!$sku) { return $allowed; }
    try { return $allowed && mmed_mr_coaching_release_ready($sku); }
    catch (Throwable $e) { return false; }
}

function mmed_mr_coaching_add_to_cart($allowed, $product_id, $quantity, $variation_id = 0) {
    $sku = mmed_mr_coaching_sku($product_id);
    $lines = mmed_mr_coaching_cart_lines();
    if (!$sku && !mmed_mr_coaching_cart_contains()) { return $allowed; }
    try {
        if (!$sku || (float) $quantity !== 1.0 || $variation_id || $lines || !mmed_mr_coaching_release_ready($sku)) {
            wc_add_notice(mmed_mr_coaching_unavailable(), 'error');
            return false;
        }
    } catch (Throwable $e) {
        wc_add_notice(mmed_mr_coaching_unavailable(), 'error');
        return false;
    }
    return $allowed;
}

function mmed_mr_coaching_coupon_valid($valid, $coupon) {
    if (function_exists('mmed_staff_coaching_cart') && mmed_staff_coaching_cart()) { return $valid; }
    $is_match = strtolower($coupon->get_code()) === 'matchready2026';
    $has_coaching = mmed_mr_coaching_cart_contains();
    if (!$is_match && !$has_coaching) { return $valid; }
    $lines = mmed_mr_coaching_cart_lines();
    if (!$is_match || !$has_coaching || count($lines) !== 1 || mmed_mr_coaching_now() >= MMED_MR_COACHING_CUTOFF) {
        throw new Exception('This introductory code is not available for this selection.');
    }
    $line = reset($lines);
    $sku = mmed_mr_coaching_sku((int) $line['product_id']);
    foreach ((array) WC()->cart->get_applied_coupons() as $applied) {
        if (strtolower((string) $applied) !== 'matchready2026') {
            throw new Exception('This introductory code cannot be combined with another promotion.');
        }
    }
    if ((float) $line['quantity'] !== 1.0 || !mmed_mr_coaching_release_ready($sku)) {
        throw new Exception('This introductory code is not available for this selection.');
    }
    return $valid;
}

function mmed_mr_coaching_coupon_discount($discount, $discounting_amount, $cart_item, $single, $coupon) {
    if (strtolower($coupon->get_code()) !== 'matchready2026') { return $discount; }
    $sku = mmed_mr_coaching_sku((int) ($cart_item['product_id'] ?? 0));
    if (!$sku || !mmed_mr_coaching_release_ready($sku) || mmed_mr_coaching_now() >= MMED_MR_COACHING_CUTOFF) { return 0; }
    $offer = mmed_mr_coaching_catalog()[$sku];
    return min((float) $discounting_amount, ($offer['regular'] - $offer['promo']) / 100);
}

/** All inputs are derived from the current canonical Woo order, never HTTP fields. */
function mmed_mr_coaching_order_snapshot($order, $require_release = true) {
    $items = $order->get_items('line_item');
    $has_coaching = false;
    foreach ($items as $item) { $has_coaching = $has_coaching || (bool) mmed_mr_coaching_sku($item->get_product_id()); }
    if (!$has_coaching) { return null; }
    if (count($items) !== 1 || $order->get_currency() !== 'USD' || (int) $order->get_customer_id() < 1) {
        throw new RuntimeException(mmed_mr_coaching_unavailable());
    }
    $item = reset($items);
    $sku = mmed_mr_coaching_sku($item->get_product_id());
    if (!$sku || $item->get_variation_id() || (float) $item->get_quantity() !== 1.0
        || ($require_release && !mmed_mr_coaching_release_ready($sku))) {
        throw new RuntimeException(mmed_mr_coaching_unavailable());
    }
    $gateway = (string) $order->get_payment_method();
    $coupons = array_values(array_map('strtolower', $order->get_coupon_codes()));
    if (!in_array($gateway, array('stripe', 'bacs'), true) || ($coupons && $coupons !== array('matchready2026'))) {
        throw new RuntimeException(mmed_mr_coaching_unavailable());
    }
    $offer = mmed_mr_coaching_catalog()[$sku];
    $tuition = mmed_mr_coaching_cents($item->get_total('edit'));
    $fee = mmed_mr_coaching_cents($order->get_total_fees());
    $tax = mmed_mr_coaching_cents($order->get_total_tax());
    $total = mmed_mr_coaching_cents($order->get_total('edit'));
    if ($tuition !== ($coupons ? $offer['promo'] : $offer['regular']) || $total !== $tuition + $fee + $tax) {
        throw new RuntimeException(mmed_mr_coaching_unavailable());
    }
    $created = $order->get_date_created();
    if (!$created) { throw new RuntimeException(mmed_mr_coaching_unavailable()); }
    if ((string)$order->get_meta('_mmed_mr_coaching_terms_version',true)!=='2026-10-20-v1') { throw new RuntimeException('Please accept the coaching terms at checkout.'); }
    $snapshot = array(
        'order_id' => (string) $order->get_id(), 'order_item_id' => (string) $item->get_id(),
        'wp_customer_id' => (int) $order->get_customer_id(), 'product_id' => (int) $item->get_product_id(),
        'sku' => $sku, 'gateway' => $gateway, 'quantity' => 1, 'currency' => 'USD',
        'tuition_cents' => $tuition, 'total_cents' => $total, 'fee_cents' => $fee, 'tax_cents' => $tax,
        'coupon' => $coupons ? 'MATCHREADY2026' : '', 'order_created_at' => gmdate('Y-m-d\TH:i:s\Z', $created->getTimestamp()),
    );
    $snapshot['snapshot_digest'] = hash('sha256', wp_json_encode($snapshot));
    return $snapshot;
}

/** Accepted Zelle verifier asks only for otherwise unknown product identities.
 * Admission binds the new product/order; no surrogate course ID or direct grant. */
function mmed_mr_coaching_zelle_identity($prior, $order) {
    if ($prior !== false) { return $prior; }
    try {
        $snapshot = mmed_mr_coaching_order_snapshot($order, false);
        if (!$snapshot || $snapshot['gateway'] !== 'bacs'
            || $order->get_meta('_mmed_mr_coaching_admitted', true) !== 'yes'
            || !hash_equals($snapshot['snapshot_digest'], (string) $order->get_meta('_mmed_mr_coaching_snapshot', true))) { return false; }
        return array('kind' => 'private_coaching', 'product_id' => $snapshot['product_id'],
            'variation_id' => 0, 'snapshot_digest' => $snapshot['snapshot_digest']);
    } catch (Throwable $e) { return false; }
}
add_filter('mmed_mr_coaching_zelle_identity', 'mmed_mr_coaching_zelle_identity', 10, 2);

function mmed_mr_coaching_allocator() {
    global $wpdb;
    return new CoachingWooAllocator($wpdb);
}

function mmed_mr_coaching_financial_proof($order, $transaction_id = '') {
    $s = mmed_mr_coaching_order_snapshot($order, false);
    if (!$s || $order->get_meta('_mmed_mr_coaching_admitted', true) !== 'yes'
        || !hash_equals($s['snapshot_digest'], (string)$order->get_meta('_mmed_mr_coaching_snapshot', true))) {
        throw new RuntimeException('coaching_admitted_owned_order_required');
    }
    if ($s['gateway'] === 'bacs') {
        $fingerprint = (string)$order->get_meta('_mm_zelle_fingerprint', true);
        if (!preg_match('/^[a-f0-9]{64}$/D', $fingerprint)
            || !in_array($order->get_meta('_mm_zelle_state', true), ['completing','verified'], true)
            || (string)get_option('mm_zelle_transaction_v2_' . $fingerprint, '') !== $s['order_id']) {
            throw new RuntimeException('coaching_genuine_zelle_evidence_required');
        }
        return ['snapshot'=>$s,'fingerprint'=>$fingerprint,'kind'=>'canonical_zelle_receipt'];
    }
    $helper=class_exists('WC_Stripe_Order_Helper') ? WC_Stripe_Order_Helper::get_instance() : null;
    $intent=$helper ? (string)$helper->get_stripe_intent_id($order) : '';
    $transaction = $intent !== '' ? $intent : ($transaction_id !== '' ? $transaction_id : (string)$order->get_transaction_id());
    if (!preg_match('/^(pi|ch)_[-A-Za-z0-9]+$/D', $transaction) || !class_exists('WC_Stripe_Order_Helper')
        || !WC_Stripe_Order_Helper::get_instance()->is_stripe_charge_captured($order)) {
        throw new RuntimeException('coaching_captured_stripe_evidence_required');
    }
    return ['snapshot'=>$s,'fingerprint'=>hash('sha256','stripe:' . $transaction),'kind'=>'canonical_stripe_payment','transaction_id'=>$transaction];
}

function mmed_mr_coaching_admit_order($order_id, $posted = [], $order = null) {
    $order = $order ?: wc_get_order($order_id);
    if (!$order) { return; }
    $s = mmed_mr_coaching_order_snapshot($order);
    if (!$s) { return; }
    if ($s['gateway']==='bacs') {
        $row = mmed_mr_coaching_allocator()->reserve($s);
        if ($row['state']==='paid' && $order->is_paid()) { return; }
        if (!in_array($row['state'], ['reserved','settling'], true)) { throw new RuntimeException('This coaching reservation needs staff review.'); }
    }
    $order->update_meta_data('_mmed_mr_coaching_admitted','yes');
    $order->update_meta_data('_mmed_mr_coaching_snapshot',$s['snapshot_digest']);
    $order->update_meta_data('_mmed_mr_coaching_state','awaiting_verified_payment');
    $order->save();
}

function mmed_mr_coaching_before_payment($order_id) {
    $order = wc_get_order($order_id);
    if (!$order) { return; }
    $s = mmed_mr_coaching_order_snapshot($order);
    if (!$s) { return; }
    if ($order->get_meta('_mmed_mr_coaching_admitted',true) !== 'yes'
        || !hash_equals($s['snapshot_digest'],(string)$order->get_meta('_mmed_mr_coaching_snapshot',true))) {
        throw new RuntimeException('Please return to coaching checkout to prepare this enrollment.');
    }
    if ($s['gateway']==='bacs') {
        $row=mmed_mr_coaching_allocator()->reserve($s);
        if ($row['state'] !== 'reserved') { throw new RuntimeException('This coaching reservation needs staff review.'); }
    }
}

/** Observe trusted canonical completion BEFORE it changes status. Never throw
 * a downstream error from a gateway that may already have captured real money.
 * Failure preserves accounting and locks coaching fulfillment for review.
 */
function mmed_mr_coaching_before_canonical_payment($order_id, $transaction_id = '') {
    $order=wc_get_order($order_id);
    if (!$order) { return; }
    try {
        if (!mmed_mr_coaching_order_snapshot($order,false)) { return; }
        $proof=mmed_mr_coaching_financial_proof($order,(string)$transaction_id);
        $row=mmed_mr_coaching_allocator()->beginSettlement($proof['snapshot'],$proof['fingerprint']);
        if (!in_array($row['state'],['settling','paid'],true)) { throw new RuntimeException('coaching_settlement_review_required'); }
    } catch (Throwable $e) {
        $order->update_meta_data('_mmed_mr_coaching_state','needs_review'); $order->save();
    }
}

/** Called by the accepted verifier only AFTER it permanently claims genuine
 * financial evidence. Expired reservations stay unpaid/review; evidence is
 * never erased or reused. Existing Bootcamp/Complete never use this filter.
 */
function mmed_mr_coaching_zelle_complete_allowed($prior,$order,$reference) {
    if ($prior !== true) { return false; }
    if (function_exists('mmed_staff_coaching_order') && mmed_staff_coaching_order($order)) {
        return mmed_staff_coaching_zelle_allowed($order,$reference);
    }
    try {
        $proof=mmed_mr_coaching_financial_proof($order);
        if ($proof['snapshot']['gateway']!=='bacs' || !hash_equals($proof['fingerprint'],(string)$reference)) { return false; }
        $row=mmed_mr_coaching_allocator()->beginSettlement($proof['snapshot'],$proof['fingerprint']);
        return in_array($row['state'],['settling','paid'],true);
    } catch (Throwable $e) { return false; }
}

function mmed_mr_coaching_payment_complete($order_id) {
    $order=wc_get_order($order_id);
    if (!$order) { return; }
    try {
        $s=mmed_mr_coaching_order_snapshot($order,false); if (!$s) { return; }
        if (mmed_mr_coaching_cents($order->get_total_refunded()) > 0) {
            if (mmed_mr_coaching_hybrid_allowance_authority($order) !== null) { return; }
            throw new RuntimeException('coaching_refund_review_required');
        }
        if ($order->get_meta('_mmed_mr_coaching_risk_hold',true)!=='' || !$order->is_paid() || !in_array($order->get_status(),['processing','completed'],true)
            || mmed_mr_coaching_cents($order->get_total_refunded()) !== 0 || !$order->get_date_paid()) {
            throw new RuntimeException('coaching_canonical_paid_state_required');
        }
        $proof=mmed_mr_coaching_financial_proof($order);
        // Idempotent recovery of an interrupted pre-completion observation.
        // Original Zelle deadline still applies; an expired row cannot revive.
        $allocator=mmed_mr_coaching_allocator();
        $allocator->beginSettlement($s,$proof['fingerprint']);
        $row=$allocator->confirmCanonicalPaid($s,$proof['fingerprint'],$order->get_date_paid()->getTimestamp());
        if ($row['state'] !== 'paid') { throw new RuntimeException('coaching_canonical_paid_allocation_required'); }
        $order->update_meta_data('_mmed_mr_coaching_state','active');
        $order->update_meta_data('_mmed_mr_coaching_fulfillment_ack',$s['snapshot_digest']);
        $order->save();
    } catch (Throwable $e) {
        $order->update_meta_data('_mmed_mr_coaching_state','needs_review'); $order->save();
    }
}

/** Server-only current authority, not an HTTP 'verified' flag. No financial
 * fingerprint leaves this boundary in the public allowance response.
 */
function mmed_mr_coaching_hybrid_allowance_authority($order) {
    if (!in_array($order->get_status(),['processing','completed','refunded'],true)
        || $order->get_meta('_mmed_mr_coaching_state',true) !== 'active' || !$order->get_date_paid()
        || $order->get_meta('_mmed_mr_coaching_risk_hold',true)!=='') { return null; }
    $proof=mmed_mr_coaching_financial_proof($order);
    $s=$proof['snapshot']; $row=mmed_mr_coaching_allocator()->readOwned($s);
    if (!$row || $row['state'] !== 'paid' || $row['financial_fingerprint'] !== $proof['fingerprint']
        || (int)$row['paid_at'] !== $order->get_date_paid()->getTimestamp()
        || !hash_equals($s['snapshot_digest'],(string)$order->get_meta('_mmed_mr_coaching_fulfillment_ack',true))) { return null; }
    try { $current=CoachingRefundDisposition::current($order,$s,(int)$row['revision']); }
    catch (Throwable $e) { return null; }
    if ((!$order->is_paid() && !($order->get_status()==='refunded' && $current['refunded_cents']===$s['total_cents']))
        || ($order->get_status()==='refunded' && $current['refunded_cents']!==$s['total_cents'])) { return null; }
    $paid=gmdate('Y-m-d\TH:i:s\Z',$order->get_date_paid()->getTimestamp());
    $payment=['genuine_server_verified'=>true,'order_id'=>(int)$s['order_id'],'owner_wp_user_id'=>$s['wp_customer_id'],
        'snapshot_digest'=>$s['snapshot_digest'],'gateway'=>$s['gateway'],'amount_cents'=>$s['total_cents'],'currency'=>'USD',
        'paid_at'=>$paid,'kind'=>$proof['kind']];
    if ($s['gateway']==='stripe') { $payment['transaction_id']=$proof['transaction_id']; }
    else { $payment+=['receipt_state'=>$order->get_meta('_mm_zelle_state',true),'fingerprint'=>$proof['fingerprint'],'financial_ledger_order_id'=>(int)$s['order_id']]; }
    return ['eligibility_revision'=>$current['eligibility_revision'],'eligible_unit_ids'=>$current['eligible_unit_ids'],'evidence'=>[
        'server_owned_evidence_verified'=>true,'original_canonical_paid_verified'=>true,'canonical_woo_is_paid'=>$order->is_paid(),'woo_status'=>$order->get_status(),
        'refunded_cents'=>$current['refunded_cents'],'eligible_unit_ids'=>$current['eligible_unit_ids'],'eligibility_revision'=>$current['eligibility_revision'],
        'chargeback'=>false,'quarantined'=>false,'order_id'=>(int)$s['order_id'],
        'order_item_id'=>(int)$s['order_item_id'],'owner_wp_user_id'=>$s['wp_customer_id'],'product_id'=>$s['product_id'],
        'canonical_snapshot_digest'=>$s['snapshot_digest'],'admitted_snapshot_digest'=>$s['snapshot_digest'],
        'canonical_paid_at'=>$paid,'payment_proof'=>$payment]];
}

function mmed_mr_coaching_refund_observed($order_id,$refund_id) {
    $order=wc_get_order($order_id); $refund=wc_get_order($refund_id);
    if (!$order || !$refund || !is_a($refund,'WC_Order_Refund') || (int)$refund->get_parent_id() !== (int)$order_id) { return; }
    try {
        $s=mmed_mr_coaching_order_snapshot($order,false); if (!$s) { return; }
        if (mmed_mr_coaching_cents($refund->get_amount()) <= 0 || mmed_mr_coaching_cents($order->get_total_refunded()) <= 0) { return; }
        mmed_mr_coaching_refund_original_authority($order);
        CoachingRefundDisposition::finalize($refund);
        // Risk holds and existing quarantine are never cleared by a refund.
        if ($order->get_meta('_mmed_mr_coaching_risk_hold',true)==='' && $order->get_meta('_mmed_mr_coaching_state',true)==='active') { $order->save(); }
    } catch (Throwable $e) {
        $order->update_meta_data('_mmed_mr_coaching_state','refund_review_required'); $order->save();
        try { if (isset($s) && $s) { mmed_mr_coaching_allocator()->quarantineRefund($s); } } catch (Throwable $ignored) {}
    }
}

/** Refund-only evidence boundary. Access can be revoked/cancelled while the
 * original genuine payment remains refundable. This never authorizes access. */
function mmed_mr_coaching_refund_original_authority($order) {
    $proof=mmed_mr_coaching_financial_proof($order); $s=$proof['snapshot'];
    $row=mmed_mr_coaching_allocator()->readOwned($s);
    if (!$row || !in_array($row['state'],['paid','revoked','review'],true) || $row['paid_at']===null || !$order->get_date_paid()
        || $row['financial_fingerprint']!==$proof['fingerprint'] || (int)$row['paid_at']!==$order->get_date_paid()->getTimestamp()
        || !hash_equals($s['snapshot_digest'],(string)$order->get_meta('_mmed_mr_coaching_fulfillment_ack',true))) { throw new RuntimeException('coaching_original_paid_allocation_required'); }
    $current=CoachingRefundDisposition::current($order,$s,(int)$row['revision']);
    $mustRetainNone=$row['state']!=='paid' || !$order->is_paid() || !in_array($order->get_status(),['processing','completed'],true)
        || $order->get_meta('_mmed_mr_coaching_state',true)!=='active' || $order->get_meta('_mmed_mr_coaching_risk_hold',true)!=='';
    return ['snapshot'=>$s,'row'=>$row,'current'=>$current,'must_retain_none'=>$mustRetainNone];
}

/** No financial call occurs here. Woo invokes this before refund save and the
 * gateway request; missing/stale entitlement decisions reject that operation. */
function mmed_mr_coaching_refund_before_create($refund,$args) {
    $order=wc_get_order((int)($args['order_id'] ?? 0)); if (!$order) { return; }
    $s=mmed_mr_coaching_order_snapshot($order,false); if (!$s) { return; }
    $authority=mmed_mr_coaching_refund_original_authority($order);
    CoachingRefundDisposition::bindBeforeRefund($refund,$order,$s,(int)$authority['row']['revision'],$args,mmed_mr_coaching_now(),$authority['must_retain_none']);
}

function mmed_mr_coaching_refund_approve($order_id,$amount,$retained,$nonce) {
    if (!current_user_can('manage_woocommerce') || !is_int($order_id) || $order_id<1 || !is_string($nonce)
        || !wp_verify_nonce($nonce,'mmed_coaching_refund_'.$order_id) || !is_array($retained)) { throw new RuntimeException('coaching_refund_admin_nonce_required'); }
    $order=wc_get_order($order_id); if (!$order) { throw new RuntimeException('coaching_owned_order_required'); }
    $s=mmed_mr_coaching_order_snapshot($order,false);
    if (!$s) { throw new RuntimeException('coaching_original_paid_authority_required'); }
    $authority=mmed_mr_coaching_refund_original_authority($order);
    if ($authority['must_retain_none'] && $retained!==[]) { throw new RuntimeException('coaching_revoked_refund_must_retain_none'); }
    return CoachingRefundDisposition::approve($order,$s,(int)$authority['row']['revision'],mmed_mr_coaching_cents($amount),$retained,mmed_mr_coaching_now());
}

function mmed_mr_coaching_refund_admin_page() {
    if (!current_user_can('manage_woocommerce')) { wp_die('Coaching refund administrator access required.'); }
    $id=isset($_GET['order_id']) && is_string($_GET['order_id']) && ctype_digit($_GET['order_id']) ? (int)$_GET['order_id'] : 0;
    echo '<div class="wrap"><h1>Coaching refund disposition</h1><p>Approve which purchased units remain eligible before creating the matching Woo refund. This page does not issue money or change delivered-service history. Review service delivery and bookings separately; no deduction is calculated here.</p><form method="get"><input type="hidden" name="page" value="mmed-coaching-refund-disposition"><label>Woo order ID <input name="order_id" type="number" min="1" required value="'.esc_attr((string)$id).'"></label><button class="button">Load order</button></form>';
    if ($id>0) {
        try {
            $order=wc_get_order($id); if (!$order) { throw new RuntimeException('Order unavailable.'); }
            $a=mmed_mr_coaching_refund_original_authority($order);
            echo '<form method="post" action="'.esc_url(admin_url('admin-post.php')).'"><input type="hidden" name="action" value="mmed_coaching_refund_disposition"><input type="hidden" name="order_id" value="'.esc_attr((string)$id).'">';
            wp_nonce_field('mmed_coaching_refund_'.$id,'_wpnonce');
            echo '<p>Already refunded: '.esc_html(number_format($a['current']['refunded_cents']/100,2,'.','')).' USD. Eligibility revision: '.esc_html((string)$a['current']['eligibility_revision']).'.</p><label>Exact next refund amount USD <input name="refund_amount" inputmode="decimal" required></label><p>Check only units to retain. A full refund must retain none. Previously removed rights cannot be restored.</p>';
            if ($a['must_retain_none']) { echo '<p>This order has no current access authority. Its refund must retain zero eligible units and will not clear its existing hold.</p>'; }
            foreach ($a['must_retain_none'] ? [] : $a['current']['eligible_unit_ids'] as $unit) { echo '<p><label><input type="checkbox" name="retained[]" value="'.esc_attr($unit).'" checked> '.esc_html($unit).'</label></p>'; }
            echo '<button class="button button-primary">Approve one matching refund for 15 minutes</button></form>';
        } catch (Throwable $e) { echo '<p>'.esc_html($e->getMessage()).'</p>'; }
    }
    echo '</div>';
}

add_action('woocommerce_create_refund','mmed_mr_coaching_refund_before_create',1,2);
add_action('admin_menu',function(){ add_submenu_page('woocommerce','Coaching refund disposition','Coaching refund disposition','manage_woocommerce','mmed-coaching-refund-disposition','mmed_mr_coaching_refund_admin_page'); });
add_action('admin_post_mmed_coaching_refund_disposition',function(){
    try {
        $id=$_POST['order_id'] ?? null;
        if (!is_string($id) || !preg_match('/^[1-9][0-9]{0,14}$/D',$id)) { throw new RuntimeException('Exact Woo order required.'); }
        mmed_mr_coaching_refund_approve((int)$id,wp_unslash($_POST['refund_amount'] ?? ''),wp_unslash($_POST['retained'] ?? []),wp_unslash($_POST['_wpnonce'] ?? ''));
        wp_safe_redirect(admin_url('admin.php?page=mmed-coaching-refund-disposition&order_id='.(int)$id)); exit;
    } catch (Throwable $e) { wp_die('Coaching refund disposition was not approved. Reload the order and review its current payment, refund and unit history.'); }
});

/** Only an independently paid new package contributes Scheduler visibility.
 * Preserve exact pre-existing modules; no user-meta/course/role write occurs.
 */
function mmed_mr_coaching_matrix_modules($value,$user_id,$key,$single) {
    if ($value !== null || !$single || $key !== '_mmed_matrix_allowed_modules' || (int)$user_id < 1) { return $value; }
    try {
        $eligible=false;
        for ($page=1;$page<=20;++$page) {
            $result=wc_get_orders(['customer_id'=>(int)$user_id,'status'=>['processing','completed'],'paginate'=>true,'page'=>$page,'limit'=>50,
                'meta_query'=>[['key'=>'_mmed_mr_coaching_admitted','value'=>'yes']]]);
            if (!is_object($result) || !is_array($result->orders ?? null) || !is_numeric($result->max_num_pages ?? null)
                || (int)$result->max_num_pages>20) { return $value; }
            foreach ($result->orders as $order) {
                $authority=mmed_mr_coaching_hybrid_allowance_authority($order);
                if ((int)$order->get_customer_id()===(int)$user_id && $authority!==null && $authority['eligible_unit_ids']!==[]) { $eligible=true; break; }
            }
            if ($eligible || $page >= (int)$result->max_num_pages) { break; }
        }
        if (!$eligible) { return $value; }
        global $wpdb;
        $raw=$wpdb->get_col($wpdb->prepare("SELECT meta_value FROM {$wpdb->usermeta} WHERE user_id=%d AND meta_key=%s ORDER BY umeta_id LIMIT 1",(int)$user_id,$key));
        $modules=[];
        foreach ($raw as $entry) { $entry=maybe_unserialize($entry); $modules=array_merge($modules,is_string($entry)?explode(',',$entry):(array)$entry); }
        return [array_values(array_unique(array_merge($modules,['scheduler'])))];
    } catch (Throwable $e) { return $value; }
}

function mmed_mr_coaching_reconcile_pending() {
    $page=max(1,(int)get_option('mmed_mr_coaching_sweep_page',1));
    $result=wc_get_orders(['status'=>['processing','completed'],'paginate'=>true,'page'=>$page,'limit'=>20,
        'meta_query'=>[['key'=>'_mmed_mr_coaching_admitted','value'=>'yes']]]);
    if (!is_object($result) || !is_array($result->orders ?? null) || !is_numeric($result->max_num_pages ?? null)) { return; }
    update_option('mmed_mr_coaching_sweep_page',$page<(int)$result->max_num_pages?$page+1:1,false);
    foreach ($result->orders as $order) {
        if (mmed_mr_coaching_cents($order->get_total_refunded())>0) {
            foreach ($order->get_refunds() as $refund) { mmed_mr_coaching_refund_observed($order->get_id(),$refund->get_id()); }
        } else { mmed_mr_coaching_payment_complete($order->get_id()); }
    }
}


add_filter('mmed_mr_coaching_zelle_complete_allowed','mmed_mr_coaching_zelle_complete_allowed',10,3);
add_action('woocommerce_pre_payment_complete','mmed_mr_coaching_before_canonical_payment',5,2);
add_action('woocommerce_order_refunded','mmed_mr_coaching_refund_observed',10,2);
add_filter('get_user_metadata','mmed_mr_coaching_matrix_modules',30,4);
add_action('rest_api_init',[CoachingEntitlementEndpoint::class,'register']);
add_action('mmed_mr_coaching_reconcile_pending','mmed_mr_coaching_reconcile_pending');
add_action('init',function(){
    if (!empty(mmed_mr_coaching_config()['product_ids']) && !wp_next_scheduled('mmed_mr_coaching_reconcile_pending')) {
        wp_schedule_event(mmed_mr_coaching_now()+60,'hourly','mmed_mr_coaching_reconcile_pending');
    }
});
add_action('woocommerce_review_order_before_submit',function(){
    if (!mmed_mr_coaching_cart_contains()) { return; }
    echo '<section class="mmed-coaching-checkout-terms"><h3>Private coaching: your purchase terms</h3><p>Refund requests for unused services: within 14 days of verified payment, subject to statutory rights. Only actually delivered services are deducted: 105-minute Signature Mock $399; 120-minute strategy $299; 45-minute debrief $149; intensive day $1,799. Deductions cannot exceed payment; no charge for unused bonus access or double-counting the mock inside the intensive day.</p><p>Reschedule at least 24 hours before a session without penalty; shorter notice may forfeit that session. One documented-emergency courtesy exception is available. Three/Five packages require strategy before the first mock. Availability is shown in Matrix; existing student appointments are protected.</p><p>Zelle reservations last 24 hours from original order creation. Sending payment or entering a payer name does not activate access. Late payments require staff review; an expired reservation does not restart.</p><label><input type="checkbox" name="mmed_coaching_terms" value="2026-10-20-v1" required> I have read these coaching terms and the <a href="/refund-cancellation-policy/" target="_blank" rel="noopener">refund policy</a>.</label></section>';
});
add_action('woocommerce_checkout_create_order',function($order){
    if (!mmed_mr_coaching_cart_contains()) { return; }
    if (!isset($_POST['mmed_coaching_terms']) || !is_string($_POST['mmed_coaching_terms']) || wp_unslash($_POST['mmed_coaching_terms'])!=='2026-10-20-v1') {
        throw new RuntimeException('Please review and accept the private coaching purchase terms.');
    }
    $order->update_meta_data('_mmed_mr_coaching_terms_version','2026-10-20-v1');
    $order->update_meta_data('_mmed_mr_coaching_terms_accepted_at',mmed_mr_coaching_now());
},20);

add_filter('woocommerce_is_purchasable', 'mmed_mr_coaching_is_purchasable', 100, 2);
add_filter('woocommerce_add_to_cart_validation', 'mmed_mr_coaching_add_to_cart', 100, 4);
add_filter('woocommerce_coupon_is_valid', 'mmed_mr_coaching_coupon_valid', 100, 2);
add_filter('woocommerce_coupon_get_discount_amount', 'mmed_mr_coaching_coupon_discount', 100, 5);
add_filter('woocommerce_coupon_is_valid_for_product', function ($valid, $product, $coupon) {
    if (strtolower($coupon->get_code()) !== 'matchready2026') { return $valid; }
    if (function_exists('mmed_staff_coaching_sku') && ($staff_sku=mmed_staff_coaching_sku($product->get_id()))) { return $valid && mmed_staff_coaching_ready($staff_sku); }
    $sku = mmed_mr_coaching_sku($product->get_id());
    return $valid && $sku && mmed_mr_coaching_release_ready($sku);
}, 100, 3);
add_filter('woocommerce_available_payment_gateways', function ($gateways) {
    return mmed_mr_coaching_cart_contains() ? array_intersect_key($gateways, array('stripe' => true, 'bacs' => true)) : $gateways;
}, 100);
add_filter('woocommerce_checkout_registration_required', function ($required) { return mmed_mr_coaching_cart_contains() ? true : $required; });
add_filter('woocommerce_checkout_registration_enabled', function ($enabled) { return mmed_mr_coaching_cart_contains() ? true : $enabled; });
add_action('woocommerce_checkout_order_processed', 'mmed_mr_coaching_admit_order', 20, 3);
add_action('woocommerce_before_pay_action', 'mmed_mr_coaching_before_payment', 20);
// Never throw a downstream admission failure from pre_payment_complete:
// the gateway may already have captured funds. Preserve canonical accounting.
add_action('woocommerce_payment_complete', 'mmed_mr_coaching_payment_complete', 20);
add_action('mmed_mr_coaching_reconcile_order', 'mmed_mr_coaching_payment_complete', 10);
add_action('woocommerce_rest_checkout_process_payment_with_context', function ($context, $result) {
    if (is_object($context) && isset($context->order) && is_object($context->order)) {
        mmed_mr_coaching_admit_order($context->order->get_id(), array(), $context->order);
    }
}, -100, 2);
