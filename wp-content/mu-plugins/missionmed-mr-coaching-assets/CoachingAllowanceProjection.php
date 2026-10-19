<?php
declare(strict_types=1);

/** Pure immutable allowance description, not remaining balance or access grant. */
final class CoachingAllowanceProjection
{
    private const PACKAGES = [
        'single' => ['mock' => 1],
        'three' => ['strategy' => 1, 'mock' => 3, 'debrief' => 2],
        'five' => ['strategy' => 1, 'mock' => 5, 'debrief' => 3],
    ];
    private const MINUTES = ['mock' => 105, 'strategy' => 120, 'debrief' => 45];
    private const PROTECTED_IDS = [5504, 5867, 3576, 5865, 5513, 5873, 3575, 5862, 5863];
    private const SNAPSHOT_KEYS = ['order_id', 'order_item_id', 'wp_customer_id', 'product_id', 'sku', 'gateway', 'quantity', 'currency', 'tuition_cents', 'total_cents', 'fee_cents', 'tax_cents', 'coupon', 'order_created_at'];

    /** Product IDs must be immutable, server-verified coaching bindings. */
    public function __construct(private array $approvedProductIds = []) {}

    /**
     * Input is current canonical Woo snapshot plus separately server-owned paid
     * evidence. Canonical module f230742 serializes order/item IDs as decimal
     * strings; their expected bindings below MUST be PHP integers. No casts of
     * browser identities. Preserve exact ordered JSON for its snapshot hash.
     * Calling code must establish evidence provenance and recheck refund/risk
     * state before use. No persistence, payments, activation or consumption here.
     */
    public function project(array $snapshot, array $evidence, DateTimeImmutable $serverNow): array
    {
        if (($evidence['server_owned_evidence_verified'] ?? false) !== true
            || ($evidence['canonical_woo_is_paid'] ?? false) !== true
            || !in_array($evidence['woo_status'] ?? null, ['processing', 'completed'], true)
            || ($evidence['refunded_cents'] ?? null) !== 0
            || ($evidence['chargeback'] ?? null) !== false || ($evidence['quarantined'] ?? null) !== false) {
            throw new DomainException('canonical_paid_evidence_required');
        }
        foreach (['order_id', 'order_item_id', 'owner_wp_user_id', 'product_id'] as $key) {
            if (!is_int($evidence[$key] ?? null) || $evidence[$key] <= 0) { throw new DomainException('integer_order_identity_required'); }
        }
        $digest = $snapshot['snapshot_digest'] ?? null;
        $body = $snapshot; unset($body['snapshot_digest']);
        if (array_keys($body) !== self::SNAPSHOT_KEYS || !self::digest($digest)
            || !hash_equals($digest, hash('sha256', json_encode($body, JSON_THROW_ON_ERROR)))
            || !self::digest($evidence['canonical_snapshot_digest'] ?? null)
            || !hash_equals($digest, $evidence['canonical_snapshot_digest'])
            || !self::digest($evidence['admitted_snapshot_digest'] ?? null)
            || !hash_equals($digest, $evidence['admitted_snapshot_digest'])) {
            throw new DomainException('exact_canonical_snapshot_required');
        }
        if ($snapshot['order_id'] !== (string) $evidence['order_id']
            || $snapshot['order_item_id'] !== (string) $evidence['order_item_id']
            || $snapshot['wp_customer_id'] !== $evidence['owner_wp_user_id']
            || $snapshot['product_id'] !== $evidence['product_id']
            || $snapshot['quantity'] !== 1 || $snapshot['currency'] !== 'USD'
            || !in_array($snapshot['gateway'], ['stripe', 'bacs'], true)) {
            throw new DomainException('order_item_owner_binding_mismatch');
        }
        $sku = $snapshot['sku'];
        if ($sku === 'emergency') { throw new DomainException('emergency_request_first_projection_unsupported'); }
        if (!is_string($sku) || !isset(self::PACKAGES[$sku])
            || !is_int($this->approvedProductIds[$sku] ?? null)
            || $this->approvedProductIds[$sku] !== $snapshot['product_id']
            || in_array($snapshot['product_id'], self::PROTECTED_IDS, true)
            || count(array_keys($this->approvedProductIds, $snapshot['product_id'], true)) !== 1) {
            throw new DomainException('exact_coaching_product_binding_required');
        }
        foreach (['tuition_cents', 'total_cents', 'fee_cents', 'tax_cents'] as $key) {
            if (!is_int($snapshot[$key]) || $snapshot[$key] < 0) { throw new DomainException('integer_cents_required'); }
        }
        if ($snapshot['tuition_cents'] <= 0 || $snapshot['fee_cents'] > PHP_INT_MAX - $snapshot['tuition_cents']
            || $snapshot['tax_cents'] > PHP_INT_MAX - $snapshot['tuition_cents'] - $snapshot['fee_cents']
            || $snapshot['total_cents'] !== $snapshot['tuition_cents'] + $snapshot['fee_cents'] + $snapshot['tax_cents']
            || !in_array($snapshot['coupon'], ['', 'MATCHREADY2026'], true)) {
            throw new DomainException('canonical_amount_snapshot_inconsistent');
        }
        $proof = $evidence['payment_proof'] ?? null;
        $created = self::instant($snapshot['order_created_at']);
        $paidAt = self::instant($evidence['canonical_paid_at'] ?? null);
        if (!is_array($proof) || ($proof['genuine_server_verified'] ?? false) !== true
            || ($proof['order_id'] ?? null) !== $evidence['order_id']
            || ($proof['owner_wp_user_id'] ?? null) !== $evidence['owner_wp_user_id']
            || ($proof['snapshot_digest'] ?? null) !== $digest
            || ($proof['gateway'] ?? null) !== $snapshot['gateway']
            || ($proof['amount_cents'] ?? null) !== $snapshot['total_cents']
            || ($proof['currency'] ?? null) !== 'USD'
            || ($proof['paid_at'] ?? null) !== ($evidence['canonical_paid_at'] ?? null)
            || $created === null || $paidAt === null || $paidAt < $created || $paidAt > $serverNow) {
            throw new DomainException('genuine_owned_payment_proof_required');
        }
        if ($snapshot['gateway'] === 'stripe') {
            if (($proof['kind'] ?? null) !== 'canonical_stripe_payment'
                || !is_string($proof['transaction_id'] ?? null)
                || !preg_match('/^(pi|ch)_[-A-Za-z0-9]+$/D', $proof['transaction_id'])) {
                throw new DomainException('canonical_stripe_proof_required');
            }
        } elseif (($proof['kind'] ?? null) !== 'canonical_zelle_receipt'
            || !in_array($proof['receipt_state'] ?? null, ['completing', 'verified'], true)
            || !self::digest($proof['fingerprint'] ?? null)
            || ($proof['financial_ledger_order_id'] ?? null) !== $evidence['order_id']) {
            throw new DomainException('canonical_zelle_ledger_proof_required');
        }
        $units = [];
        foreach (self::PACKAGES[$sku] as $service => $count) {
            for ($ordinal = 1; $ordinal <= $count; ++$ordinal) {
                $units[] = ['unit_id' => 'coaching-unit:v1:' . $evidence['order_id'] . ':' . $evidence['order_item_id'] . ':' . $service . ':' . $ordinal,
                    'order_id' => $evidence['order_id'], 'order_item_id' => $evidence['order_item_id'],
                    'owner_wp_user_id' => $evidence['owner_wp_user_id'], 'product_id' => $evidence['product_id'],
                    'sku' => $sku, 'service' => $service, 'ordinal' => $ordinal,
                    'duration_minutes' => self::MINUTES[$service], 'snapshot_digest' => $digest];
            }
        }
        return ['projection_version' => 1, 'kind' => 'immutable_service_allowance',
            'order_id' => $evidence['order_id'], 'owner_wp_user_id' => $evidence['owner_wp_user_id'],
            'snapshot_digest' => $digest, 'units' => $units];
    }

    private static function digest($value): bool { return is_string($value) && preg_match('/^[a-f0-9]{64}$/D', $value) === 1; }
    private static function instant($value): ?DateTimeImmutable
    {
        if (!is_string($value)) { return null; }
        $date = DateTimeImmutable::createFromFormat('!Y-m-d\TH:i:s\Z', $value, new DateTimeZone('UTC'));
        return $date !== false && $date->format('Y-m-d\TH:i:s\Z') === $value ? $date : null;
    }
}
