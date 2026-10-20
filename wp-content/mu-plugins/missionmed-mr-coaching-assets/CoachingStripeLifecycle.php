<?php
/** Existing installed gateway hooks only. No new route, credential or service. */
function mmed_mr_coaching_stripe_initialization($request,$order,$prepared_source=null,$is_setup=false) {
    if ($is_setup || !is_object($order)) { return $request; }
    $s=mmed_mr_coaching_order_snapshot($order); if (!$s) { return $request; }
    if ($s['gateway']!=='stripe' || $order->is_paid() || !in_array($order->get_status(),['pending','failed'],true)
        || $order->get_meta('_mmed_mr_coaching_admitted',true)!=='yes'
        || !hash_equals($s['snapshot_digest'],(string)$order->get_meta('_mmed_mr_coaching_snapshot',true))) {
        throw new RuntimeException('coaching_stripe_initialization_denied');
    }
    if (!is_array($request)) { throw new RuntimeException('coaching_stripe_request_required'); }
    $request['metadata']['mmed_coaching_order']=$s['order_id'];
    $request['metadata']['mmed_coaching_snapshot']=$s['snapshot_digest'];
    return $request;
}

/** Installed API supplies the actual endpoint immediately before provider HTTP.
 * A second CREATE is denied, not mistaken for confirmation of the first intent.
 * Native transport/level3 retries may require staff review; they never authorize
 * another possibly chargeable intent under an existing uncertain allocation.
 */
function mmed_mr_coaching_stripe_request_body($request,$api) {
    $id=$request['metadata']['mmed_coaching_order'] ?? null;
    if ($id===null) { return $request; }
    if (!is_string($id) || !preg_match('/^[1-9][0-9]{0,14}$/D',$id)) { throw new RuntimeException('coaching_stripe_request_binding_required'); }
    $order=wc_get_order((int)$id);
    if (!$order) { throw new RuntimeException('coaching_stripe_owned_order_required'); }
    $s=mmed_mr_coaching_order_snapshot($order);
    if (!$s || $s['gateway']!=='stripe' || $order->is_paid()
        || !in_array($order->get_status(),['pending','failed'],true)
        || !hash_equals($s['snapshot_digest'],(string)($request['metadata']['mmed_coaching_snapshot'] ?? ''))
        || $order->get_meta('_mmed_mr_coaching_admitted',true)!=='yes'
        || !hash_equals($s['snapshot_digest'],(string)$order->get_meta('_mmed_mr_coaching_snapshot',true))) {
        throw new RuntimeException('coaching_stripe_request_binding_required');
    }
    $allocator=mmed_mr_coaching_allocator();
    if ($api==='payment_intents') {
        $allocator->reserve($s);
        $allocator->beginStripeInitialization($s);
    } elseif (is_string($api) && preg_match('~^payment_intents/(pi_[A-Za-z0-9]+)/confirm$~D',$api,$match)) {
        $row=$allocator->readOwned($s);
        if (!$row || $row['state']!=='initializing' || $row['paid_at']!==null || $row['financial_fingerprint']!==null
            || WC_Stripe_Order_Helper::get_instance()->get_stripe_intent_id($order)!==$match[1]) {
            throw new RuntimeException('coaching_stripe_confirmation_binding_required');
        }
        // /confirm does not support metadata. Consume internal server tags at
        // this boundary; never transmit an unsupported parameter to Stripe.
        unset($request['metadata']['mmed_coaching_order'],$request['metadata']['mmed_coaching_snapshot']);
        if ($request['metadata']!==[]) { throw new RuntimeException('coaching_stripe_confirmation_shape_required'); }
        unset($request['metadata']);
    } else { throw new RuntimeException('coaching_stripe_endpoint_not_admitted'); }
    return $request;
}

/** Called by the installed gateway after authenticated webhook dispatch.
 * Unknown/processing intents remain held; elapsed time never releases Stripe.
 */
function mmed_mr_coaching_stripe_event($type,$notification,$resolved_order=null) {
    if (!in_array($type,['payment_intent.canceled','charge.dispute.created','review.opened'],true)) { return; }
    if ($type!=='payment_intent.canceled') {
        if (!is_object($resolved_order)) { return; }
        try {
            $s=mmed_mr_coaching_order_snapshot($resolved_order,false);
            if (!$s || $s['gateway']!=='stripe') { return; }
            $resolved_order->update_meta_data('_mmed_mr_coaching_risk_hold',$type);
            $resolved_order->update_meta_data('_mmed_mr_coaching_state','needs_review');
            $resolved_order->save();
        } catch (Throwable $e) { /* Malformed coaching snapshots already deny. */ }
        return;
    }
    $intent=$notification->data->object ?? null;
    if (!is_object($intent) || !is_object($intent->metadata ?? null)
        || !is_string($intent->metadata->signature ?? null)
        || !preg_match('/^([1-9][0-9]{0,14}):[a-f0-9]{32}$/D',$intent->metadata->signature,$match)) { return; }
    $order=wc_get_order((int)$match[1]); if (!$order) { return; }
    try {
        $s=mmed_mr_coaching_order_snapshot($order,false); if (!$s || $s['gateway']!=='stripe' || $order->is_paid()) { return; }
        $expected=$s['order_id'].':'.md5(implode('-',[$order->get_id(),$order->get_order_key(),$order->get_customer_id(),$s['total_cents']]));
        $helper=WC_Stripe_Order_Helper::get_instance();
        if (!hash_equals($expected,$intent->metadata->signature)
            || !hash_equals((string)$order->get_order_key(),(string)($intent->metadata->order_key ?? ''))
            || (string)($intent->metadata->order_id ?? '')!==(string)$order->get_order_number()
            || $helper->get_stripe_intent_id($order)!==($intent->id ?? null)) { return; }
        $row=mmed_mr_coaching_allocator()->releaseCanceledStripe($s,[
            'id'=>$intent->id,'status'=>$intent->status ?? null,'amount'=>$intent->amount ?? null,
            'amount_received'=>$intent->amount_received ?? null,'currency'=>$intent->currency ?? null,'order_binding_verified'=>true]);
        if ($row['state']==='released') {
            $order->update_meta_data('_mmed_mr_coaching_state','canceled_unpaid');
            $order->save();
        }
    } catch (Throwable $e) { /* Uncertain financial state stays locked. */ }
}
add_filter('wc_stripe_generate_create_intent_request','mmed_mr_coaching_stripe_initialization',100,4);
add_filter('wc_stripe_request_body','mmed_mr_coaching_stripe_request_body',100,2);
add_action('wc_stripe_webhook_received','mmed_mr_coaching_stripe_event',100,3);
