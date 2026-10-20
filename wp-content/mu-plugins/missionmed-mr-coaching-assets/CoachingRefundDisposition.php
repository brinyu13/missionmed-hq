<?php
declare(strict_types=1);

/** Server-owned entitlement decisions, never a refund/payment executor. */
final class CoachingRefundDisposition
{
    private const META = '_mmed_coaching_refund_disposition';
    private static function key(string $id): string { return 'mmed_coaching_refund_disposition_' . $id; }
    private static function pending(int $orderId): string { return 'mmed_coaching_refund_pending_' . $orderId; }
    private static function record(string $id): array {
        if (!preg_match('/^[a-f0-9]{32}$/D', $id)) { throw new RuntimeException('coaching_refund_disposition_required'); }
        $r = get_option(self::key($id), null);
        if (!is_array($r) || ($r['id'] ?? null) !== $id) { throw new RuntimeException('coaching_refund_disposition_required'); }
        return $r;
    }
    private static function envelope(array $r): array { unset($r['status'], $r['refund_id']); return $r; }
    private static function save(array $r): void {
        update_option(self::key($r['id']), $r, false);
        if (get_option(self::key($r['id']), null) !== $r) { throw new RuntimeException('coaching_refund_storage_unavailable'); }
    }
    private static function locked(int $id, callable $work) {
        $key = 'mmed_coaching_refund_lock_' . $id;
        if (!add_option($key, 'locked', '', false)) { throw new RuntimeException('coaching_refund_busy'); }
        try { return $work(); } finally { delete_option($key); }
    }
    public static function subset(array $requested, array $available): array {
        return CoachingAllowanceProjection::eligibleSubset($requested,$available);
    }
    private static function strategyPrerequisite(array $s,array $retained): void {
        if (!in_array($s['sku'],['three','five'],true)) { return; }
        $prefix='coaching-unit:v1:'.$s['order_id'].':'.$s['order_item_id'].':';
        foreach ($retained as $id) {
            if (str_starts_with($id,$prefix.'mock:') && !in_array($prefix.'strategy:1',$retained,true)) {
                throw new RuntimeException('coaching_retained_mock_requires_strategy_history');
            }
        }
    }
    /** Rebuild from current genuine Woo refund objects and approved immutable
     * decisions. Unknown financial history is never guessed or overwritten. */
    public static function current($order, array $s, int $baseRevision): array {
        $eligible = CoachingAllowanceProjection::unitIds($s); $revision = $baseRevision;
        if ($revision < 1) { throw new RuntimeException('coaching_refund_revision_required'); }
        $total = 0; $rows = []; $seen = []; $seenDispositions = [];
        $refunds = $order->get_refunds();
        if (!is_array($refunds)) { throw new RuntimeException('coaching_refund_history_unavailable'); }
        foreach ($refunds as $refund) {
            if (!is_a($refund, 'WC_Order_Refund') || (int)$refund->get_parent_id() !== (int)$s['order_id'] || (int)$refund->get_id() < 1 || isset($seen[$refund->get_id()])) { throw new RuntimeException('coaching_refund_history_unavailable'); }
            $seen[$refund->get_id()] = true;
            $meta = $refund->get_meta(self::META, true);
            if (!is_array($meta) || !is_string($meta['id'] ?? null)) { throw new RuntimeException('coaching_external_refund_review_required'); }
            $r = self::record($meta['id']);
            if ($meta !== self::envelope($r) || isset($seenDispositions[$r['id']])
                || !in_array($r['status'] ?? null, ['consumed','finalized'], true)
                || ($r['refund_id'] !== 0 && $r['refund_id'] !== (int)$refund->get_id())
                || $r['order_id'] !== (int)$s['order_id'] || $r['owner_wp_user_id'] !== $s['wp_customer_id']
                || $r['snapshot_digest'] !== $s['snapshot_digest'] || $r['refund_cents'] !== mmed_mr_coaching_cents($refund->get_amount())) { throw new RuntimeException('coaching_refund_binding_mismatch'); }
            $seenDispositions[$r['id']] = true; $rows[] = $r;
        }
        usort($rows, static fn($a,$b) => $a['expected_refunded_cents'] <=> $b['expected_refunded_cents']);
        // Quarantine may advance the allocator audit revision without changing
        // the original paid fact. An existing approved chain keeps its own
        // immutable starting revision; it cannot be reset by a later hold.
        if ($rows !== []) {
            $start=$rows[0]['previous_revision'];
            if (!is_int($start) || $start<1 || $start>$baseRevision) { throw new RuntimeException('coaching_refund_revision_required'); }
            $revision=$start;
        }
        foreach ($rows as $r) {
            if ($r['expected_refunded_cents'] !== $total || $r['previous_revision'] !== $revision
                || $r['eligibility_revision'] !== $revision + 1 || $r['previous_eligible_unit_ids'] !== $eligible
                || !is_int($r['refund_cents']) || $r['refund_cents'] < 1 || $r['refund_cents'] > $s['total_cents'] - $total) { throw new RuntimeException('coaching_refund_chain_mismatch'); }
            $eligible = self::subset($r['eligible_unit_ids'], $eligible); $revision = $r['eligibility_revision']; $total += $r['refund_cents'];
            if ($total === $s['total_cents'] && $eligible !== []) { throw new RuntimeException('coaching_full_refund_zero_eligibility_required'); }
        }
        if ($total !== mmed_mr_coaching_cents($order->get_total_refunded())) { throw new RuntimeException('coaching_external_refund_review_required'); }
        $pending = get_option(self::pending((int)$s['order_id']), '');
        if ($pending !== '') {
            $r = self::record($pending);
            if ($r['status'] === 'consumed' && !isset($seenDispositions[$pending])) { throw new RuntimeException('coaching_refund_inflight_review_required'); }
        }
        return ['eligible_unit_ids'=>$eligible, 'eligibility_revision'=>$revision, 'refunded_cents'=>$total];
    }
    public static function approve($order, array $s, int $baseRevision, int $amount, array $retained, int $now): array {
        if (!current_user_can('manage_woocommerce') || get_current_user_id() < 1) { throw new RuntimeException('coaching_refund_admin_required'); }
        return self::locked((int)$s['order_id'], static function () use ($order,$s,$baseRevision,$amount,$retained,$now) {
            $current = self::current($order,$s,$baseRevision);
            if ($amount < 1 || $amount > $s['total_cents'] - $current['refunded_cents']) { throw new RuntimeException('coaching_refund_exact_amount_required'); }
            self::subset($retained,$current['eligible_unit_ids']);
            self::strategyPrerequisite($s,$retained);
            if ($amount === $s['total_cents'] - $current['refunded_cents'] && $retained !== []) { throw new RuntimeException('coaching_full_refund_zero_eligibility_required'); }
            $id = bin2hex(random_bytes(16));
            $r = ['id'=>$id,'order_id'=>(int)$s['order_id'],'owner_wp_user_id'=>$s['wp_customer_id'],'snapshot_digest'=>$s['snapshot_digest'],
                'expected_refunded_cents'=>$current['refunded_cents'],'refund_cents'=>$amount,'previous_eligible_unit_ids'=>$current['eligible_unit_ids'],
                'eligible_unit_ids'=>$retained,'previous_revision'=>$current['eligibility_revision'],'eligibility_revision'=>$current['eligibility_revision']+1,
                'approved_by'=>get_current_user_id(),'approved_at'=>$now,'expires_at'=>$now+900,'status'=>'approved','refund_id'=>0];
            if (!add_option(self::key($id),$r,'',false)) { throw new RuntimeException('coaching_refund_storage_unavailable'); }
            update_option(self::pending((int)$s['order_id']),$id,false);
            if (get_option(self::pending((int)$s['order_id']),null) !== $id) { throw new RuntimeException('coaching_refund_storage_unavailable'); }
            return $r;
        });
    }
    /** Runs at woocommerce_create_refund before refund save/provider mutation.
     * Consume first; any failed/interrupted refund stays held for staff review. */
    public static function bindBeforeRefund($refund, $order, array $s, int $baseRevision, array $args, int $now, bool $mustRetainNone=false): void {
        self::locked((int)$s['order_id'], static function () use ($refund,$order,$s,$baseRevision,$args,$now,$mustRetainNone) {
            if ((int)$refund->get_id() !== 0 || (int)($args['refund_id'] ?? 0) !== 0 || (int)$refund->get_parent_id() !== (int)$s['order_id']
                || (int)($args['order_id'] ?? 0) !== (int)$s['order_id'] || $refund->get_meta(self::META,true) !== '') { throw new RuntimeException('coaching_new_refund_required'); }
            $current = self::current($order,$s,$baseRevision);
            $r = self::record((string)get_option(self::pending((int)$s['order_id']),''));
            if ($r['status'] !== 'approved' || $now < $r['approved_at'] || $now >= $r['expires_at'] || $r['approved_by'] < 1
                || $r['order_id'] !== (int)$s['order_id'] || $r['owner_wp_user_id'] !== $s['wp_customer_id'] || $r['snapshot_digest'] !== $s['snapshot_digest']
                || $r['expected_refunded_cents'] !== $current['refunded_cents'] || $r['previous_revision'] !== $current['eligibility_revision']
                || $r['previous_eligible_unit_ids'] !== $current['eligible_unit_ids'] || $r['refund_cents'] !== mmed_mr_coaching_cents($args['amount'] ?? '')
                || $r['refund_cents'] !== mmed_mr_coaching_cents($refund->get_amount())
                || ($mustRetainNone && $r['eligible_unit_ids']!==[])) { throw new RuntimeException('coaching_refund_approval_stale_or_mismatched'); }
            self::subset($r['eligible_unit_ids'],$current['eligible_unit_ids']);
            self::strategyPrerequisite($s,$r['eligible_unit_ids']);
            $r['status']='consumed'; self::save($r);
            $refund->add_meta_data(self::META,self::envelope($r),true);
            if ($refund->get_meta(self::META,true) !== self::envelope($r)) { throw new RuntimeException('coaching_refund_metadata_unavailable'); }
        });
    }
    public static function finalize($refund): void {
        $meta=$refund->get_meta(self::META,true); $r=self::record($meta['id'] ?? '');
        if ($meta !== self::envelope($r) || !in_array($r['status'],['consumed','finalized'],true)
            || ($r['refund_id']!==0 && $r['refund_id']!==(int)$refund->get_id())) { throw new RuntimeException('coaching_refund_binding_mismatch'); }
        $r['status']='finalized'; $r['refund_id']=(int)$refund->get_id(); self::save($r);
    }
}
