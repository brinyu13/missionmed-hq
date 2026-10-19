<?php
/**
 * Plugin Name: Mission Residency Private Coaching
 * Description: Default-closed, order-bound coaching admission and canonical paid-order bridge.
 * Version: 2026.10.19.1-candidate
 */
defined('ABSPATH') || exit;

require_once __DIR__ . '/missionmed-mr-coaching-assets/CoachingOfferPolicy.php';
require_once __DIR__ . '/missionmed-mr-coaching-assets/CoachingServicePolicy.php';

const MMED_MR_COACHING_OPTION = 'mmed_mr_coaching_v1';
const MMED_MR_COACHING_CUTOFF = 1793505600; // Exclusive 2026-11-01T04:00:00Z.
const MMED_MR_COACHING_HOST = 'missionmed-hq-production.up.railway.app';
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
    if (($c['enabled'] ?? false) !== true || !in_array($sku, array('single', 'three', 'five'), true)
        || !in_array($sku, $c['purchasable_skus'] ?? array(), true) || !is_int($id) || $id <= 0
        || in_array($id, MMED_MR_COACHING_PROTECTED_IDS, true)
        || count(array_keys($c['product_ids'] ?? array(), $id, true)) !== 1
        || (string) get_post_meta($id, '_mmed_mr_coaching_sku', true) !== $sku) {
        return false;
    }
    foreach (array('native_allocation_verified', 'native_scheduler_verified', 'refund_disclosure_verified', 'independent_release_accepted', 'new_sku_zelle_compatibility_verified') as $gate) {
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

/** Scoped service capability only. No database, Stripe or Gmail credential enters WordPress. */
function mmed_mr_coaching_bridge($action, array $payload) {
    $config = mmed_mr_coaching_config();
    $url = (string) ($config['bridge_url'] ?? '');
    $secret = (string) ($config['bridge_secret'] ?? '');
    $parts = wp_parse_url($url);
    if (!is_array($parts) || ($parts['scheme'] ?? '') !== 'https' || ($parts['host'] ?? '') !== MMED_MR_COACHING_HOST
        || ($parts['path'] ?? '') !== '/api/scheduler/coaching/service' || isset($parts['user']) || isset($parts['pass'])
        || isset($parts['query']) || isset($parts['fragment']) || (isset($parts['port']) && $parts['port'] !== 443) || strlen($secret) < 32) {
        throw new RuntimeException('Coaching checkout is temporarily unavailable. Please contact MissionMed.');
    }
    $body = wp_json_encode(array('action' => $action, 'payload' => $payload));
    if (!is_string($body)) { throw new RuntimeException('Coaching request could not be prepared.'); }
    $timestamp = (string) mmed_mr_coaching_now();
    $nonce = bin2hex(random_bytes(16));
    $signature = hash_hmac('sha256', $timestamp . "\n" . $nonce . "\n" . $body, $secret);
    $response = wp_safe_remote_post($url, array('timeout' => 7, 'redirection' => 0, 'sslverify' => true,
        'headers' => array('Content-Type' => 'application/json', 'X-MMed-Coaching-Timestamp' => $timestamp,
            'X-MMed-Coaching-Nonce' => $nonce, 'X-MMed-Coaching-Signature' => $signature), 'body' => $body));
    if (is_wp_error($response) || wp_remote_retrieve_response_code($response) !== 200) {
        throw new RuntimeException('Coaching checkout is temporarily unavailable. Please contact MissionMed.');
    }
    $result = json_decode(wp_remote_retrieve_body($response), true);
    if (!is_array($result) || isset($result['error']) || !isset($result['state'])) {
        throw new RuntimeException('Coaching verification is temporarily unavailable. Please contact MissionMed.');
    }
    return $result;
}

function mmed_mr_coaching_admit_order($order_id, $posted = array(), $order = null) {
    $order = $order ?: wc_get_order($order_id);
    if (!$order) { return; }
    $snapshot = mmed_mr_coaching_order_snapshot($order);
    if (!$snapshot) { return; }
    if ($snapshot['coupon'] && mmed_mr_coaching_now() >= MMED_MR_COACHING_CUTOFF) {
        throw new RuntimeException('This introductory enrollment period has ended.');
    }
    $snapshot['idempotency_key'] = 'woo-admit:' . $order->get_id() . ':' . $snapshot['snapshot_digest'];
    $result = mmed_mr_coaching_bridge('admit_order', $snapshot);
    if ((string) ($result['order_id'] ?? '') !== (string) $order->get_id() || ($result['state'] ?? '') !== 'reserved') {
        throw new RuntimeException('This coaching selection could not be reserved. Please return to checkout or contact MissionMed.');
    }
    $order->update_meta_data('_mmed_mr_coaching_snapshot', $snapshot['snapshot_digest']);
    $order->update_meta_data('_mmed_mr_coaching_admitted', 'yes');
    $order->save();
}

function mmed_mr_coaching_before_payment($order_id) {
    $order = wc_get_order($order_id);
    if (!$order) { return; }
    $snapshot = mmed_mr_coaching_order_snapshot($order);
    if (!$snapshot) { return; }
    if ($order->get_meta('_mmed_mr_coaching_admitted', true) !== 'yes'
        || !hash_equals((string) $order->get_meta('_mmed_mr_coaching_snapshot', true), $snapshot['snapshot_digest'])) {
        throw new RuntimeException('Please return to coaching checkout to prepare this enrollment.');
    }
    // This is a reservation check, not payment verification or entitlement.
    $snapshot['idempotency_key'] = 'woo-admit:' . $order->get_id() . ':' . $snapshot['snapshot_digest'];
    $result = mmed_mr_coaching_bridge('admit_order', $snapshot);
    if (($result['state'] ?? '') !== 'reserved'
        && !($order->is_paid() && ($result['activation_allowed'] ?? false) === true)) {
        throw new RuntimeException('This reservation needs staff review. Your payment evidence will be preserved; please contact MissionMed.');
    }
}

function mmed_mr_coaching_payment_complete($order_id) {
    $order = wc_get_order($order_id);
    if (!$order) { return; }
    mmed_mr_coaching_clear_projection_cache($order->get_customer_id());
    try {
        $snapshot = mmed_mr_coaching_order_snapshot($order, false);
        if (!$snapshot) { return; }
        if (mmed_mr_coaching_cents($order->get_total_refunded()) > 0) {
            // Never turn a payment replay into renewed access after any refund.
            $order->update_meta_data('_mmed_mr_coaching_state', 'refund_review_required');
            $order->save();
            mmed_mr_coaching_reconcile_refunds($order_id);
            return;
        }
        if (!$order->is_paid() || !in_array($order->get_status(), array('processing', 'completed'), true)
            || $order->get_meta('_mmed_mr_coaching_admitted', true) !== 'yes'
            || !hash_equals((string) $order->get_meta('_mmed_mr_coaching_snapshot', true), $snapshot['snapshot_digest'])) {
            throw new RuntimeException('Canonical paid-order evidence is incomplete.');
        }
        if ($snapshot['gateway'] === 'bacs') {
            $fingerprint = (string) $order->get_meta('_mm_zelle_fingerprint', true);
            if (!preg_match('/^[a-f0-9]{64}$/D', $fingerprint)
                || !in_array($order->get_meta('_mm_zelle_state', true), array('completing', 'verified'), true)
                || (string) get_option('mm_zelle_transaction_v2_' . $fingerprint, '') !== (string) $order_id) {
                throw new RuntimeException('Verified Zelle evidence is incomplete.');
            }
        } else {
            $transaction = (string) $order->get_transaction_id();
            if (!$transaction || !preg_match('/^(pi|ch)_[-A-Za-z0-9]+$/D', $transaction)) {
                throw new RuntimeException('Canonical Stripe evidence is incomplete.');
            }
            $fingerprint = hash('sha256', 'stripe:' . $transaction);
        }
        $paid_at = $order->get_date_paid();
        if (!$paid_at) { throw new RuntimeException('Paid timestamp is missing.'); }
        if ($order->get_meta('_mmed_mr_coaching_state', true) === 'active'
            && $order->get_meta('_mmed_mr_coaching_fulfillment_ack', true) === $snapshot['snapshot_digest']) { return; }
        // Persist intent and queue BEFORE the remote commit/response boundary.
        // The bounded sweep below also recovers a crash between local writes.
        $order->update_meta_data('_mmed_mr_coaching_state', 'fulfillment_pending');
        $order->save();
        if (!wp_next_scheduled('mmed_mr_coaching_reconcile_order', array((int) $order_id))) {
            wp_schedule_single_event(mmed_mr_coaching_now() + 60, 'mmed_mr_coaching_reconcile_order', array((int) $order_id));
        }
        $result = mmed_mr_coaching_bridge('verified_payment', array_merge($snapshot, array(
            'source' => 'canonical_woo_verified', 'event_type' => 'payment_complete',
            'event_id' => 'woo-payment-complete:' . $order_id . ':v1', 'financial_fingerprint' => $fingerprint,
            'payment_verified_at' => gmdate('Y-m-d\TH:i:s\Z', $paid_at->getTimestamp()),
            'is_paid' => true, 'woo_status' => $order->get_status(),
        )));
        if ((string) ($result['order_id'] ?? '') !== (string) $order_id || ($result['activation_allowed'] ?? false) !== true) {
            throw new RuntimeException('Coaching activation requires review.');
        }
        // Durable pending state precedes delivery. A crash never acknowledges a
        // missing Matrix sink. The sink must upsert by this immutable order key.
        $order->update_meta_data('_mmed_mr_coaching_state', 'fulfillment_pending');
        $order->save();
        // No direct course grant. Only an acknowledged, idempotent canonical
        // Matrix integration may complete fulfillment. No listener = locked.
        $ack = apply_filters('mmed_mr_coaching_fulfill_verified_order', false, $order,
            'coaching-fulfillment:' . $order_id . ':' . $snapshot['snapshot_digest'], $result);
        if ($ack === true) {
            $order->update_meta_data('_mmed_mr_coaching_fulfillment_ack', $snapshot['snapshot_digest']);
            $order->update_meta_data('_mmed_mr_coaching_state', 'active');
            $order->save();
        }
    } catch (Throwable $e) {
        // Money/order history remains truthful if downstream activation is unavailable.
        $order->update_meta_data('_mmed_mr_coaching_state', 'needs_review');
        $order->save();
    }
}

/** Paid-order projection only: Scheduler, not a full-access tier or another
 * LearnDash course. Existing independent grants remain unchanged in storage. */
function mmed_mr_coaching_matrix_modules($value, $user_id, $key, $single) {
    if ($value !== null || !$single || $key !== '_mmed_matrix_allowed_modules' || (int) $user_id < 1
        || !function_exists('wc_get_orders')) { return $value; }
    $cache = $GLOBALS['mmed_coaching_projection_cache'] ?? array();
    if (array_key_exists((int) $user_id, $cache)) { return $cache[(int) $user_id]; }
    // Request-local only. Never persist cached payment/access across requests.
    $GLOBALS['mmed_coaching_projection_cache'][(int) $user_id] = null;
    try {
        $orders = wc_get_orders(array('customer_id' => (int) $user_id, 'status' => array('processing', 'completed'),
            'limit' => 20, 'meta_query' => array(array('key' => '_mmed_mr_coaching_state', 'value' => 'active'))));
    } catch (Throwable $e) { return $value; }
    if (!is_array($orders)) { return $value; }
    $verified = false;
    foreach ($orders as $order) {
        try {
            if (!$order->is_paid() || (int) $order->get_customer_id() !== (int) $user_id
                || mmed_mr_coaching_cents($order->get_total_refunded()) !== 0
                || $order->get_meta('_mmed_mr_coaching_state', true) !== 'active') { continue; }
            // Disabling new admission must not revoke an already paid package.
            $snapshot = mmed_mr_coaching_order_snapshot($order, false);
            if ($snapshot && hash_equals($snapshot['snapshot_digest'], (string) $order->get_meta('_mmed_mr_coaching_snapshot', true))
                && hash_equals($snapshot['snapshot_digest'], (string) $order->get_meta('_mmed_mr_coaching_fulfillment_ack', true))) {
                $verified = true; break;
            }
        } catch (Throwable $e) { continue; }
    }
    if (!$verified) { return $value; }
    global $wpdb;
    // Exact existing values, without recursively entering the metadata filter.
    $raw = $wpdb->get_col($wpdb->prepare("SELECT meta_value FROM {$wpdb->usermeta} WHERE user_id = %d AND meta_key = %s ORDER BY umeta_id LIMIT 1", (int) $user_id, $key));
    $modules = array();
    foreach ($raw as $entry) {
        $entry = maybe_unserialize($entry);
        $modules = array_merge($modules, is_string($entry) ? explode(',', $entry) : (array) $entry);
    }
    $modules = array_values(array_unique(array_merge($modules, array('scheduler'))));
    // get_metadata_raw unwraps [0] for single-value requests.
    return $GLOBALS['mmed_coaching_projection_cache'][(int) $user_id] = array($modules);
}

function mmed_mr_coaching_clear_projection_cache($user_id) {
    unset($GLOBALS['mmed_coaching_projection_cache'][(int) $user_id]);
}
/** Observe actual persisted Woo refund records, never issue a refund or claim
 * bank settlement. Immutable event bodies survive bridge failure/retries. */
function mmed_mr_coaching_refund_observed($order_id, $refund_id) {
    $order = wc_get_order($order_id);
    $refund = wc_get_order($refund_id);
    if (!$order || !$refund || !is_a($refund, 'WC_Order_Refund')
        || (int) $refund->get_parent_id() !== (int) $order_id) { return; }
    try {
        $snapshot = mmed_mr_coaching_order_snapshot($order, false);
        if (!$snapshot || $order->get_meta('_mmed_mr_coaching_admitted', true) !== 'yes'
            || !hash_equals((string) $order->get_meta('_mmed_mr_coaching_snapshot', true), $snapshot['snapshot_digest'])
            || mmed_mr_coaching_cents($refund->get_amount()) <= 0) { return; }
        mmed_mr_coaching_clear_projection_cache($order->get_customer_id());
        $order->update_meta_data('_mmed_mr_coaching_state', 'refund_review_required');
        $pending = $order->get_meta('_mmed_mr_coaching_refund_events', true);
        $pending = is_array($pending) ? $pending : array();
        $key = 'woo-refund:' . $order_id . ':' . $refund_id . ':v1';
        if (!isset($pending[$key])) {
            $cumulative = mmed_mr_coaching_cents($order->get_total_refunded());
            if ($cumulative <= 0 || $cumulative > $snapshot['total_cents']) { throw new RuntimeException('Refund requires staff review.'); }
            $pending[$key] = array('state' => 'pending', 'payload' => array_merge($snapshot, array(
                'source' => 'canonical_woo_verified', 'event_type' => 'refund_observed', 'event_id' => $key,
                'refund_id' => (string) $refund_id, 'refund_record_verified' => true,
                'cumulative_refund_cents' => $cumulative,
            )));
        }
        $order->update_meta_data('_mmed_mr_coaching_refund_events', $pending);
        $order->save();
        if (!wp_next_scheduled('mmed_mr_coaching_reconcile_refunds', array((int) $order_id))) {
            wp_schedule_single_event(mmed_mr_coaching_now() + 60, 'mmed_mr_coaching_reconcile_refunds', array((int) $order_id));
        }
        mmed_mr_coaching_reconcile_refunds($order_id);
    } catch (Throwable $e) {
        // Actual refund/accounting is not rolled back by an integration outage.
        $order->update_meta_data('_mmed_mr_coaching_state', 'refund_review_required');
        $order->save();
    }
}
function mmed_mr_coaching_reconcile_refunds($order_id) {
    $order = wc_get_order($order_id);
    if (!$order) { return; }
    $pending = $order->get_meta('_mmed_mr_coaching_refund_events', true);
    if (!is_array($pending)) { return; }
    foreach ($pending as $key => $event) {
        if (($event['state'] ?? '') === 'acknowledged') { continue; }
        try {
            $result = mmed_mr_coaching_bridge('observe_refund', $event['payload']);
            if ((string) ($result['order_id'] ?? '') !== (string) $order_id
                || ($result['refund_review_required'] ?? false) !== true
                || ($result['activation_allowed'] ?? true) !== false) { throw new RuntimeException('Refund observation requires review.'); }
            $pending[$key]['state'] = 'acknowledged';
            $order->update_meta_data('_mmed_mr_coaching_refund_events', $pending);
            $order->save();
        } catch (Throwable $e) { /* Keep durable intent and truthful accounting. */ }
    }
}
add_action('woocommerce_order_refunded', 'mmed_mr_coaching_refund_observed', 10, 2);
add_action('mmed_mr_coaching_reconcile_refunds', 'mmed_mr_coaching_reconcile_refunds', 10);
add_action('woocommerce_order_status_changed', function ($order_id) {
    $order = wc_get_order($order_id);
    if ($order) { mmed_mr_coaching_clear_projection_cache($order->get_customer_id()); }
});

/** Read-only server capability. No customer cookie or payer submission can
 * authorize it. Only exact owned order/digest bindings are returned; no PII or
 * financial evidence. Domain separation prevents reusing a Woo mutation HMAC. */
function mmed_mr_coaching_access_status($request) {
    $secret = (string) (mmed_mr_coaching_config()['bridge_secret'] ?? '');
    $raw = (string) $request->get_body();
    $timestamp = (string) $request->get_header('x-mmed-coaching-timestamp');
    $nonce = (string) $request->get_header('x-mmed-coaching-nonce');
    $signature = (string) $request->get_header('x-mmed-coaching-signature');
    $denied = function () { return new WP_Error('coaching_status_unavailable', 'Coaching access could not be verified.', array('status' => 403)); };
    if (strlen($secret) < 32 || strlen($raw) > 32768 || !preg_match('/^[0-9]{10}$/D', $timestamp)
        || abs(mmed_mr_coaching_now() - (int) $timestamp) > 60 || !preg_match('/^[A-Za-z0-9_-]{16,128}$/D', $nonce)
        || !preg_match('/^[a-f0-9]{64}$/D', $signature)
        || !hash_equals(hash_hmac('sha256', "mmed-coaching-access-request-v1\n" . $timestamp . "\n" . $nonce . "\n" . $raw, $secret), $signature)) { return $denied(); }
    $data = json_decode($raw, true);
    if (!is_array($data) || !is_int($data['actor_wp_user_id'] ?? null) || $data['actor_wp_user_id'] <= 0
        || !is_string($data['actor_user_id'] ?? null)
        || !preg_match('/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/iD', $data['actor_user_id'])
        || !is_array($data['bindings'] ?? null) || count($data['bindings']) > 100) { return $denied(); }
    $bindings = array(); $seen = array();
    foreach ($data['bindings'] as $binding) {
        if (!is_array($binding) || !is_string($binding['order_id'] ?? null)
            || !preg_match('/^[1-9][0-9]{0,17}$/D', $binding['order_id'])
            || !is_string($binding['snapshot_digest'] ?? null) || !preg_match('/^[a-f0-9]{64}$/D', $binding['snapshot_digest'])
            || isset($seen[$binding['order_id']])) { return $denied(); }
        $seen[$binding['order_id']] = true;
        $active = false;
        try {
            $order = wc_get_order($binding['order_id']);
            if ($order && (int) $order->get_customer_id() === $data['actor_wp_user_id']
                && $order->is_paid() && in_array($order->get_status(), array('processing', 'completed'), true)
                && mmed_mr_coaching_cents($order->get_total_refunded()) === 0
                && $order->get_meta('_mmed_mr_coaching_state', true) === 'active') {
                $snapshot = mmed_mr_coaching_order_snapshot($order, false);
                $active = $snapshot && hash_equals($binding['snapshot_digest'], $snapshot['snapshot_digest'])
                    && hash_equals($binding['snapshot_digest'], (string) $order->get_meta('_mmed_mr_coaching_snapshot', true))
                    && hash_equals($binding['snapshot_digest'], (string) $order->get_meta('_mmed_mr_coaching_fulfillment_ack', true));
            }
        } catch (Throwable $e) { $active = false; }
        $bindings[] = array('order_id' => $binding['order_id'], 'snapshot_digest' => $binding['snapshot_digest'], 'active' => (bool) $active);
    }
    $reply = wp_json_encode(array('nonce' => $nonce, 'request_digest' => hash('sha256', $raw),
        'actor_user_id' => $data['actor_user_id'], 'actor_wp_user_id' => $data['actor_wp_user_id'],
        'checked_at' => mmed_mr_coaching_now(), 'bindings' => $bindings));
    return new WP_REST_Response(array('payload' => base64_encode($reply),
        'signature' => hash_hmac('sha256', "mmed-coaching-access-response-v1\n" . $reply, $secret)), 200,
        array('Cache-Control' => 'no-store, private'));
}
add_action('rest_api_init', function () {
    register_rest_route('mmed-coaching/v1', '/access-status', array('methods' => 'POST',
        'permission_callback' => '__return_true', 'callback' => 'mmed_mr_coaching_access_status'));
});

function mmed_mr_coaching_acknowledge_matrix($prior, $order, $key, $result) {
    if (!class_exists('MMED_Access_Gate') || !method_exists('MMED_Access_Gate', 'get_user_allowed_modules')
        || !$order->is_paid() || ($result['state'] ?? '') !== 'paid'
        || ($result['activation_allowed'] ?? false) !== true || mmed_mr_coaching_cents($order->get_total_refunded()) !== 0) { return false; }
    $snapshot = mmed_mr_coaching_order_snapshot($order, false);
    return $snapshot && hash_equals('coaching-fulfillment:' . $order->get_id() . ':' . $snapshot['snapshot_digest'], $key)
        && hash_equals((string) $order->get_meta('_mmed_mr_coaching_snapshot', true), $snapshot['snapshot_digest']);
}
add_filter('get_user_metadata', 'mmed_mr_coaching_matrix_modules', 30, 4);
add_filter('mmed_mr_coaching_fulfill_verified_order', 'mmed_mr_coaching_acknowledge_matrix', 20, 4);

/** Reconcile only admitted, genuinely paid new coaching orders. Never capture
 * money, change Woo paid status or touch an unrelated product/order. Cron's
 * liveness is a production acceptance gate, not assumed from this source. */
function mmed_mr_coaching_reconcile_pending() {
    $page = max(1, min(1000000, (int) get_option('mmed_mr_coaching_sweep_page', 1)));
    $pending = wc_get_orders(array('limit' => 20, 'paginate' => true, 'page' => $page,
        'status' => array('processing', 'completed', 'refunded'),
        'orderby' => 'date', 'order' => 'ASC', 'meta_query' => array('relation' => 'AND',
            array('key' => '_mmed_mr_coaching_admitted', 'value' => 'yes'),
            array('relation' => 'OR', array('key' => '_mmed_mr_coaching_state', 'compare' => 'NOT EXISTS'),
                // Include acknowledged active packages: a refund may commit
                // before its hook can persist the local review/event marker.
                array('key' => '_mmed_mr_coaching_state', 'value' => array('active', 'fulfillment_pending', 'needs_review', 'refund_review_required'), 'compare' => 'IN')))));
    if (!is_object($pending) || !isset($pending->orders, $pending->max_num_pages) || !is_array($pending->orders)) { return; }
    // Advance before processing: one permanently unresolved page cannot starve
    // later paid orders. A subsequent cycle still revisits an interrupted page.
    update_option('mmed_mr_coaching_sweep_page', $page < (int) $pending->max_num_pages ? $page + 1 : 1, false);
    foreach ($pending->orders as $order) {
        if (mmed_mr_coaching_cents($order->get_total_refunded()) > 0) {
            // Recover a crash before the refund hook persisted its event body.
            foreach ($order->get_refunds() as $refund) { mmed_mr_coaching_refund_observed($order->get_id(), $refund->get_id()); }
        } else { mmed_mr_coaching_payment_complete($order->get_id()); }
    }
}
add_filter('cron_schedules', function ($schedules) {
    $schedules['mmed_coaching_five_minutes'] = array('interval' => 300, 'display' => 'Coaching reconciliation');
    return $schedules;
});
add_action('init', function () {
    if (!empty(mmed_mr_coaching_config()['product_ids']) && !wp_next_scheduled('mmed_mr_coaching_reconcile_pending')) {
        wp_schedule_event(mmed_mr_coaching_now() + 60, 'mmed_coaching_five_minutes', 'mmed_mr_coaching_reconcile_pending');
    }
});
add_action('mmed_mr_coaching_reconcile_pending', 'mmed_mr_coaching_reconcile_pending');

add_filter('woocommerce_is_purchasable', 'mmed_mr_coaching_is_purchasable', 100, 2);
add_filter('woocommerce_add_to_cart_validation', 'mmed_mr_coaching_add_to_cart', 100, 4);
add_filter('woocommerce_coupon_is_valid', 'mmed_mr_coaching_coupon_valid', 100, 2);
add_filter('woocommerce_coupon_get_discount_amount', 'mmed_mr_coaching_coupon_discount', 100, 5);
add_filter('woocommerce_coupon_is_valid_for_product', function ($valid, $product, $coupon) {
    if (strtolower($coupon->get_code()) !== 'matchready2026') { return $valid; }
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
