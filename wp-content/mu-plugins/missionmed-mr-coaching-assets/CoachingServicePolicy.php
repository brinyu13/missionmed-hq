<?php
declare(strict_types=1);
namespace MissionMed\Residency\Coaching;
use DateTimeImmutable;
use DomainException;

/** Source-only calculations; no banking, refunds, access, inventory or locks. */
final class CoachingServicePolicy
{
    public function __construct(private array $contract) {}

    /**
     * All evidence must come from server-owned canonical ledgers. This class
     * checks consistency, not provenance. now is an injected SERVER clock.
     * Each service record binds a stable service_id to one package entitlement
     * key (for example signature_mock:1), status and complete delivered_minutes.
     * A complete ledger assertion and pre-purchase disclosure are mandatory.
     */
    public function refund(array $evidence, DateTimeImmutable $now): array
    {
        $paid = $evidence['actual_paid_cents'] ?? null;
        $paidAt = self::instant($evidence['paid_at'] ?? null);
        $sku = $evidence['sku'] ?? null;
        $offer = is_string($sku) ? ($this->contract['offers'][$sku] ?? null) : null;
        if (($evidence['server_evidence_verified'] ?? false) !== true
            || ($evidence['payment_verified'] ?? false) !== true
            || ($evidence['deduction_schedule_disclosed_before_purchase'] ?? false) !== true
            || ($evidence['complete_service_ledger'] ?? false) !== true
            || !is_int($paid) || $paid <= 0 || $paidAt === null || $now < $paidAt
            || !is_array($offer) || !is_array($evidence['services'] ?? null)
            || !is_array($evidence['prior_refunds'] ?? null)) {
            return self::review('incomplete_or_invalid_refund_evidence');
        }
        $window = $this->contract['refund']['unused_service_window_days'] ?? null;
        if ($window !== 14) { return self::review('refund_window_unverified'); }
        if ($now->getTimestamp() - $paidAt->getTimestamp() >= $window * 86400) {
            return self::review('outside_standard_window_statutory_rights_preserved')
                + ['window_anchor' => 'verified_paid_at', 'advisory_only' => true];
        }
        $prior = 0; $refundIds = [];
        foreach ($evidence['prior_refunds'] as $refund) {
            if (!is_array($refund) || !self::id($refund['refund_id'] ?? null)
                || isset($refundIds[$refund['refund_id']]) || ($refund['genuine_verified'] ?? false) !== true
                || !is_int($refund['amount_cents'] ?? null) || $refund['amount_cents'] <= 0
                || $refund['amount_cents'] > $paid - $prior) {
                return self::review('prior_refund_evidence_invalid');
            }
            $refundIds[$refund['refund_id']] = true;
            $prior += $refund['amount_cents'];
        }
        $slots = [];
        $mockCount = $evidence['sku'] === 'emergency' ? ($offer['followup_mock_count'] ?? 0) : ($offer['mock_count'] ?? 0);
        foreach (['signature_mock' => [$mockCount, 105], 'private_strategy' => [($offer['strategy_minutes'] ?? 0) > 0 ? 1 : 0, 120], 'post_interview_debrief' => [$offer['post_interview_debrief_count'] ?? 0, 45], 'intensive_training_day' => [($offer['training_day_minutes'] ?? 0) === 480 ? 1 : 0, 480]] as $type => [$count, $minutes]) {
            for ($i = 1; $i <= $count; ++$i) { $slots[$type . ':' . $i] = [$type, $minutes]; }
        }
        if ($evidence['sku'] === 'emergency') { $slots['included_day_mock:1'] = ['included_day_mock', 105]; }
        $seenIds = []; $seenSlots = []; $records = []; $deduction = 0;
        foreach ($evidence['services'] as $record) {
            if (!is_array($record) || !self::id($record['service_id'] ?? null)
                || !is_string($record['entitlement'] ?? null)
                || isset($seenIds[$record['service_id']]) || isset($seenSlots[$record['entitlement']])
                || !in_array($record['status'] ?? null, ['delivered', 'scheduled', 'unused', 'partial'], true)) {
                return self::review('duplicate_or_invalid_service_record');
            }
            $key = $record['entitlement'];
            $seenIds[$record['service_id']] = true; $seenSlots[$key] = true;
            $records[$record['service_id']] = $record;
            // Bonus metadata never creates a paid service deduction or access.
            if (in_array($key, ['bonus_bootcamp_replay', 'bonus_matrix_access'], true)) { continue; }
            if (!isset($slots[$key])) { return self::review('service_outside_package_entitlement'); }
            if (in_array($record['status'], ['scheduled', 'unused'], true)) { continue; }
            [$type, $minutes] = $slots[$key];
            $deliveredAt = self::instant($record['delivered_at'] ?? null);
            if ($record['status'] === 'partial' || ($record['delivered_minutes'] ?? null) !== $minutes
                || $deliveredAt === null || $deliveredAt < $paidAt || $deliveredAt > $now) {
                return self::review('partial_or_incomplete_delivery_requires_undefined_proration');
            }
            if ($type === 'included_day_mock') { continue; }
            $rate = $this->contract['refund']['standalone_rates_cents'][$type] ?? null;
            if (!is_int($rate) || $rate <= 0) { return self::review('standalone_rate_missing'); }
            // Saturate at actual payment, avoiding overflow and negative refunds.
            $deduction += min($rate, $paid - $deduction);
        }
        foreach ($records as $record) {
            if ($record['entitlement'] !== 'included_day_mock:1' || $record['status'] !== 'delivered') { continue; }
            $parentId = $record['parent_service_id'] ?? null;
            $parent = is_string($parentId) ? ($records[$parentId] ?? null) : null;
            if (!is_array($parent) || $parent['entitlement'] !== 'intensive_training_day:1' || $parent['status'] !== 'delivered') {
                return self::review('included_mock_requires_complete_parent_day_no_separate_deduction');
            }
        }
        return ['status' => 'calculated_candidate', 'refund_cents' => max(0, $paid - $deduction - $prior),
            'delivered_deduction_cents' => $deduction, 'prior_genuine_refunds_cents' => $prior,
            'actual_paid_cents' => $paid, 'executes_refund' => false, 'statutory_rights_preserved' => true,
            'window_anchor' => 'verified_paid_at', 'advisory_only' => true];
    }

    /**
     * Use original immutable order/hold creation and persisted expiration history;
     * never refreshed UI timestamps. Native atomic ownership/capacity and banking
     * remain external. This method NEVER activates access or confirms a booking.
     * allocation_state is a trusted persisted ledger snapshot. Any release is a
     * candidate instruction requiring atomic native recheck against conversion.
     */
    public function hold(array $evidence, DateTimeImmutable $serverNow): array
    {
        $orderAt = self::instant($evidence['original_order_created_at'] ?? null);
        $kind = $evidence['kind'] ?? null;
        $gateway = $evidence['gateway'] ?? null;
        $state = $evidence['allocation_state'] ?? null;
        if (($evidence['server_evidence_verified'] ?? false) !== true
            || !self::id($evidence['order_id'] ?? null) || !self::id($evidence['hold_id'] ?? null)
            || !is_bool($evidence['previously_expired'] ?? null) || !is_bool($evidence['payment_verified'] ?? null)
            || !in_array($state, ['unpaid_hold', 'released', 'converted_paid'], true)
            || !in_array($kind, ['zelle', 'emergency'], true) || !in_array($gateway, ['bacs', 'stripe'], true)
            || ($kind === 'zelle' && $gateway !== 'bacs') || $orderAt === null || $orderAt > $serverNow
            || ($this->contract['reservations']['zelle_unpaid_seconds_from_order_creation'] ?? null) !== 86400
            || ($this->contract['reservations']['emergency_date_seconds_from_reservation_creation'] ?? null) !== 7200) {
            return self::review('invalid_or_unverified_original_hold_evidence');
        }
        $expiry = $orderAt->getTimestamp() + 86400;
        if ($kind === 'emergency') {
            $holdAt = self::instant($evidence['original_hold_created_at'] ?? null);
            if ($holdAt === null || $holdAt > $serverNow) {
                return self::review('invalid_original_emergency_hold_creation');
            }
            $expiry = $holdAt->getTimestamp() + 7200;
            if ($gateway === 'bacs') { $expiry = min($expiry, $orderAt->getTimestamp() + 86400); }
        }
        $expired = $evidence['previously_expired'] || $state === 'released' || $serverNow->getTimestamp() >= $expiry;
        $base = ['expires_at_utc' => gmdate('Y-m-d\TH:i:s\Z', $expiry), 'activation_allowed' => false,
            'booking_confirmed' => false, 'restore_hold' => false, 'preserve_payment_evidence' => true,
            'native_atomic_controls_required' => true, 'release_requires_native_atomic_recheck' => true];
        if ($state !== 'converted_paid' && (isset($evidence['conversion_evidence_id']) || isset($evidence['converted_at']))) {
            return self::review('contradictory_conversion_evidence_no_blind_release');
        }
        if ($state === 'converted_paid' && !$evidence['payment_verified']) {
            return self::review('conversion_without_verified_payment_no_blind_release');
        }
        if ($evidence['payment_verified']) {
            $paymentAt = self::instant($evidence['verified_payment_at'] ?? null);
            if (!self::id($evidence['payment_evidence_id'] ?? null) || $paymentAt === null || $paymentAt < $orderAt || $paymentAt > $serverNow) {
                return self::review('verified_payment_evidence_incomplete');
            }
            if ($state === 'converted_paid') {
                $convertedAt = self::instant($evidence['converted_at'] ?? null);
                if (!self::id($evidence['conversion_evidence_id'] ?? null) || $convertedAt === null
                    || $convertedAt < $paymentAt || $convertedAt > $serverNow
                    || $convertedAt->getTimestamp() >= $expiry || $evidence['previously_expired']) {
                    return self::review('conversion_evidence_invalid_no_blind_release');
                }
                return $base + ['status' => 'paid_allocation_preserved', 'release_capacity' => false];
            }
            if ($expired || $paymentAt->getTimestamp() >= $expiry) {
                return $base + ['status' => 'staff_review', 'reason' => 'payment_after_or_reconciled_after_hold_expiry', 'release_capacity' => $state === 'unpaid_hold'];
            }
            return $base + ['status' => 'verified_payment_pending_native_checks', 'release_capacity' => false];
        }
        return $base + ['status' => $expired ? 'expired_unpaid' : 'unpaid_hold', 'release_capacity' => $expired && $state === 'unpaid_hold'];
    }

    private static function review(string $reason): array
    {
        return ['status' => 'staff_review', 'reason' => $reason, 'refund_cents' => null,
            'activation_allowed' => false, 'restore_hold' => false, 'release_capacity' => false,
            'preserve_payment_evidence' => true, 'statutory_rights_preserved' => true];
    }

    private static function id($value): bool { return is_string($value) && trim($value) !== ''; }

    private static function instant($raw): ?DateTimeImmutable
    {
        if (!is_string($raw) || !preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$/D', $raw)) { return null; }
        if (substr($raw, -1) !== 'Z') {
            $h = (int) substr($raw, -5, 2); $m = (int) substr($raw, -2);
            if ($h > 14 || $m > 59 || ($h === 14 && $m !== 0)) { return null; }
        }
        $date = DateTimeImmutable::createFromFormat('!Y-m-d\TH:i:sP', $raw);
        $errors = DateTimeImmutable::getLastErrors();
        return $date !== false && ($errors === false || (!$errors['warning_count'] && !$errors['error_count'])) ? $date : null;
    }
}
