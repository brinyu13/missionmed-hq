<?php
declare(strict_types=1);
namespace MissionMed\Residency\Coaching;
use DateTimeImmutable;
use DomainException;

/** Pure candidate policy. No WooCommerce, payment, booking or access side effects. */
final class CoachingOfferPolicy
{
    private const PROTECTED_COURSE_IDS = [5504, 5867, 3576, 5865, 5513, 5873, 3575, 5862, 5863];
    private array $contract;
    private array $release;

    /**
     * The integrating owner must verify mapping evidence against actual products.
     * release: enabled, product_ids[sku => ID], verified_coaching_product_ids,
     * protected_course_product_ids. No IDs or deadline are supplied by default.
     * purchasable_skus is an explicit server-owned allowlist, default NONE.
     * Emergency is request-only unless separately enabled by server release and
     * admitted against staff-approved actual date and a verified native hold.
     * Also requires independently_verified_refund_terms and verified scheduling
     * and allocation gates. expected_order_id / expected_customer_id must come
     * from the current authenticated server checkout, never HTTP form inputs.
     */
    public function __construct(array $contract, array $release = [])
    {
        $this->contract = $contract;
        $this->release = $release;
    }

    public function readiness(): array
    {
        $reasons = [];
        if (($this->contract['activation_enabled'] ?? false) !== true || ($this->release['enabled'] ?? false) !== true) {
            $reasons[] = 'release_disabled';
        }
        if (($this->release['canonical_matrix_scheduler_verified'] ?? false) !== true) {
            $reasons[] = 'canonical_matrix_scheduler_unverified';
        }
        if (($this->release['atomic_allocation_verified'] ?? false) !== true) {
            $reasons[] = 'needs_atomic_allocation';
        }
        if (($this->release['independently_verified_refund_terms'] ?? false) !== true) {
            $reasons[] = 'refund_terms_independent_verification_required';
        }
        $purchasable = $this->release['purchasable_skus'] ?? [];
        $validAllowlist = is_array($purchasable) && array_is_list($purchasable) && $purchasable !== [];
        $seenSkus = [];
        if ($validAllowlist) {
            foreach ($purchasable as $sku) {
                if (!is_string($sku) || !in_array($sku, ['single', 'three', 'five', 'emergency'], true) || in_array($sku, $seenSkus, true)) {
                    $validAllowlist = false;
                    break;
                }
                $seenSkus[] = $sku;
            }
        }
        if (!$validAllowlist) {
            $reasons[] = 'invalid_or_empty_purchasable_skus';
        } elseif (in_array('emergency', $purchasable, true) && ($this->release['emergency_date_admission_enabled'] ?? false) !== true) {
            $reasons[] = 'emergency_request_only';
        }
        $mapping = $this->release['product_ids'] ?? [];
        $verified = $this->release['verified_coaching_product_ids'] ?? [];
        $protected = $this->release['protected_course_product_ids'] ?? [];
        if (!is_array($mapping) || !is_array($verified) || !is_array($protected) || $protected === []) {
            $reasons[] = 'mapping_evidence_missing';
        } elseif ($validAllowlist) {
            $seen = [];
            foreach ($purchasable as $sku) {
                $id = $mapping[$sku] ?? null;
                if (!is_int($id) || $id <= 0 || !in_array($id, $verified, true) || in_array($id, array_merge(self::PROTECTED_COURSE_IDS, $protected), true) || in_array($id, $seen, true)) {
                    $reasons[] = 'invalid_product_mapping';
                }
                $seen[] = $id;
            }
        }
        return ['ready' => $reasons === [], 'reasons' => array_values(array_unique($reasons))];
    }

    /**
     * Evaluate the whole order once; coupons is the complete applied-coupon list.
     * Each line is {sku, product_id, quantity}; integer fees are passed through,
     * never inferred from the gateway. Tax, if any, belongs to the Woo tax layer.
     * The deadline is an exclusive instant: now >= expires_at is expired.
     * Atomic admission is an external server-owned allocation, bound to the
     * expected current order/customer plus SKU/product/tuition/currency/gateway
     * and actual total. Matching these fields cannot establish provenance or
     * lock inventory: the integrating adapter must enforce ownership, locking,
     * payment verification, idempotency and atomic consumption itself.
     */
    public function quote(array $lines, string $gateway, array $coupons, int $feeCents, DateTimeImmutable $now, array $admission = []): array
    {
        if (!$this->readiness()['ready']) {
            throw new DomainException('release_not_ready');
        }
        if (!in_array($gateway, ['stripe', 'bacs'], true)) {
            throw new DomainException('gateway_not_approved');
        }
        if ($feeCents < 0 || count($lines) !== 1) {
            throw new DomainException('invalid_order');
        }
        $promo = $coupons !== [];
        if ($promo && (count($coupons) !== 1 || !is_string(array_values($coupons)[0]) || strcasecmp(array_values($coupons)[0], 'MATCHREADY2026') !== 0)) {
            throw new DomainException('coupon_stacking_or_unapproved');
        }
        if ($promo) {
            $deadline = $this->deadline();
            if ($deadline === null || $now >= $deadline) {
                throw new DomainException('promotion_deadline_missing_invalid_or_expired');
            }
        }
        $subtotal = 0;
        $discount = 0;
        $units = 0;
        foreach ($lines as $line) {
            if (!is_array($line)) {
                throw new DomainException('invalid_line');
            }
            $sku = $line['sku'] ?? null;
            $offer = is_string($sku) ? ($this->contract['offers'][$sku] ?? null) : null;
            $quantity = $line['quantity'] ?? null;
            if (!is_array($offer) || !in_array($sku, $this->release['purchasable_skus'], true) || !isset($this->release['product_ids'][$sku]) || ($line['product_id'] ?? null) !== $this->release['product_ids'][$sku] || $quantity !== 1) {
                throw new DomainException('unapproved_product_or_quantity');
            }
            $regular = $offer['regular_cents'] ?? null;
            $reduction = $offer['discount_cents'] ?? null;
            $promotional = $offer['promotional_cents'] ?? null;
            if (!is_int($regular) || !is_int($reduction) || !is_int($promotional) || $regular < 0 || $reduction < 0 || $reduction > $regular || $regular - $reduction !== $promotional) {
                throw new DomainException('invalid_contract_pricing');
            }
            $subtotal = self::add($subtotal, self::multiply($regular, $quantity));
            $discount = self::add($discount, $promo ? self::multiply($reduction, $quantity) : 0);
            $units = self::add($units, $quantity);
            if ($sku === 'emergency' && (($admission['intensive_single_date_480_minutes_verified'] ?? false) !== true
                || ($admission['staff_verified_date_approval'] ?? false) !== true
                || ($admission['native_emergency_hold_verified'] ?? false) !== true)) {
                throw new DomainException('intensive_available_eight_hour_date_required');
            }
        }
        $total = self::add($subtotal - $discount, $feeCents);
        // Trusted server adapter input only, never request/client assertions. This
        // pure policy cannot lock inventory, verify receipts, or consume a slot.
        if ($promo) {
            $paid = $admission['verified_paid_before'] ?? null;
            $cap = $this->contract['coupon']['maximum_verified_paid_enrollments'] ?? null;
            $validUntil = self::parseInstant($admission['valid_until'] ?? null);
            if (($admission['trusted_atomic_admission'] ?? false) !== true
                || !is_string($admission['order_id'] ?? null) || $admission['order_id'] === ''
                || ($this->release['expected_order_id'] ?? null) !== $admission['order_id']
                || !is_int($admission['customer_id'] ?? null) || $admission['customer_id'] <= 0
                || ($this->release['expected_customer_id'] ?? null) !== $admission['customer_id']
                || !is_string($admission['allocation_id'] ?? null) || $admission['allocation_id'] === ''
                || ($admission['cart_lines'] ?? null) !== $lines
                || ($admission['sku'] ?? null) !== $sku
                || ($admission['tuition_cents'] ?? null) !== $subtotal - $discount
                || ($admission['total_cents'] ?? null) !== $total
                || ($admission['currency'] ?? null) !== 'USD'
                || ($admission['gateway'] ?? null) !== $gateway
                || ($admission['reserved_units'] ?? null) !== $units
                || !is_int($paid) || $paid < 0 || $cap !== 20 || $paid > $cap || $units > $cap - $paid
                || $validUntil === null || $now >= $validUntil) {
                throw new DomainException('needs_atomic_allocation');
            }
        }
        return [
            'currency' => 'USD', 'subtotal_cents' => $subtotal,
            'discount_cents' => $discount, 'fee_cents' => $feeCents,
            'total_cents' => $total, 'total_display' => self::dollars($total),
            'coupon_application_count' => $promo ? 1 : 0,
            'allocation_enforcement' => 'external_atomic_adapter_required',
            'bonus_grants' => [], 'refund_status' => 'requires_verified_prepurchase_disclosure',
        ];
    }

    public function deliveryAllowed(string $gateway, string $orderStatus, bool $paymentVerified): bool
    {
        return $this->readiness()['ready'] && $paymentVerified
            && in_array($gateway, ['stripe', 'bacs'], true)
            && in_array($orderStatus, ['processing', 'completed'], true);
    }

    private function deadline(): ?DateTimeImmutable
    {
        return self::parseInstant($this->contract['coupon']['expires_at'] ?? null);
    }

    private static function parseInstant($raw): ?DateTimeImmutable
    {
        if (!is_string($raw) || !preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$/D', $raw)) {
            return null;
        }
        $date = DateTimeImmutable::createFromFormat('!Y-m-d\TH:i:sP', $raw);
        $errors = DateTimeImmutable::getLastErrors();
        if ($date === false || ($errors !== false && ($errors['warning_count'] || $errors['error_count']))) {
            return null;
        }
        // PHP accepts out-of-range numeric offsets; prohibit these explicitly.
        if (substr($raw, -1) !== 'Z') {
            $hour = (int) substr($raw, -5, 2);
            $minute = (int) substr($raw, -2);
            if ($hour > 14 || $minute > 59 || ($hour === 14 && $minute !== 0)) {
                return null;
            }
        }
        return $date;
    }

    private static function add(int $a, int $b): int
    {
        if ($b > PHP_INT_MAX - $a) {
            throw new DomainException('amount_overflow');
        }
        return $a + $b;
    }

    private static function multiply(int $a, int $b): int
    {
        if ($a !== 0 && $b > intdiv(PHP_INT_MAX, $a)) {
            throw new DomainException('amount_overflow');
        }
        return $a * $b;
    }

    private static function dollars(int $cents): string
    {
        $dollars = preg_replace('/\B(?=(\d{3})+(?!\d))/', ',', (string) intdiv($cents, 100));
        return '$' . $dollars . '.' . str_pad((string) ($cents % 100), 2, '0', STR_PAD_LEFT);
    }
}
