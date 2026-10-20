<?php
declare(strict_types=1);
require __DIR__ . '/../wp-content/mu-plugins/missionmed-mr-coaching-assets/CoachingAllowanceProjection.php';
$count = 0;
function check(bool $ok, string $label): void { global $count; ++$count; if (!$ok) { throw new RuntimeException('FAIL: ' . $label); } }
function denies(callable $call, string $label): void { try { $call(); } catch (DomainException $e) { check(true, $label); return; } check(false, $label); }
// All IDs, transactions and receipts are synthetic, never financial evidence.
$products = ['single' => 900001, 'three' => 900002, 'five' => 900003, 'emergency' => 900004];
$helper = new CoachingAllowanceProjection($products);
$now = new DateTimeImmutable('2031-07-03T12:00:00Z');
function fixtures(string $sku, string $gateway = 'stripe'): array {
    global $products;
    $tuition = ['single' => 24900, 'three' => 74900, 'five' => 119900, 'emergency' => 249900][$sku];
    $snapshot = ['order_id' => '910001', 'order_item_id' => '920001', 'wp_customer_id' => 930001, 'product_id' => $products[$sku],
        'sku' => $sku, 'gateway' => $gateway, 'quantity' => 1, 'currency' => 'USD', 'tuition_cents' => $tuition,
        'total_cents' => $tuition, 'fee_cents' => 0, 'tax_cents' => 0, 'coupon' => 'MATCHREADY2026', 'order_created_at' => '2031-07-01T12:00:00Z'];
    $snapshot['snapshot_digest'] = hash('sha256', json_encode($snapshot, JSON_THROW_ON_ERROR));
    $proof = ['genuine_server_verified' => true, 'order_id' => 910001, 'owner_wp_user_id' => 930001, 'snapshot_digest' => $snapshot['snapshot_digest'],
        'gateway' => $gateway, 'amount_cents' => $tuition, 'currency' => 'USD', 'paid_at' => '2031-07-02T12:00:00Z',
        'kind' => $gateway === 'stripe' ? 'canonical_stripe_payment' : 'canonical_zelle_receipt'];
    if ($gateway === 'stripe') { $proof['transaction_id'] = 'pi_fixtureOnly'; }
    else { $proof += ['receipt_state' => 'verified', 'fingerprint' => str_repeat('a', 64), 'financial_ledger_order_id' => 910001]; }
    $evidence = ['server_owned_evidence_verified' => true, 'canonical_woo_is_paid' => true, 'woo_status' => 'processing',
        'refunded_cents' => 0, 'chargeback' => false, 'quarantined' => false,
        'order_id' => 910001, 'order_item_id' => 920001, 'owner_wp_user_id' => 930001, 'product_id' => $products[$sku],
        'canonical_snapshot_digest' => $snapshot['snapshot_digest'], 'admitted_snapshot_digest' => $snapshot['snapshot_digest'],
        'canonical_paid_at' => $proof['paid_at'], 'payment_proof' => $proof];
    $evidence += ['original_canonical_paid_verified'=>true,'eligibility_revision'=>1,
        'eligible_unit_ids'=>$sku==='emergency' ? [] : CoachingAllowanceProjection::unitIds($snapshot)];
    return [$snapshot, $evidence];
}
function rehash(array $snapshot, array $evidence): array {
    unset($snapshot['snapshot_digest']); $snapshot['snapshot_digest'] = hash('sha256', json_encode($snapshot, JSON_THROW_ON_ERROR));
    $evidence['canonical_snapshot_digest'] = $evidence['admitted_snapshot_digest'] = $evidence['payment_proof']['snapshot_digest'] = $snapshot['snapshot_digest'];
    return [$snapshot, $evidence];
}
foreach (['single' => ['mock' => 1], 'three' => ['strategy' => 1, 'mock' => 3, 'debrief' => 2], 'five' => ['strategy' => 1, 'mock' => 5, 'debrief' => 3]] as $sku => $expected) {
    foreach (['stripe', 'bacs'] as $gateway) {
        [$s, $e] = fixtures($sku, $gateway); $projection = $helper->project($s, $e, $now); $counts = [];
        foreach ($projection['units'] as $unit) {
            $counts[$unit['service']] = ($counts[$unit['service']] ?? 0) + 1;
            check($unit['unit_id'] === 'coaching-unit:v1:910001:920001:' . $unit['service'] . ':' . $unit['ordinal'], 'stable order/item/service/ordinal identity');
            check(is_int($unit['order_id']) && is_int($unit['order_item_id']) && $unit['owner_wp_user_id'] === 930001, 'strict integer owned output');
            check($unit['duration_minutes'] === ['mock' => 105, 'strategy' => 120, 'debrief' => 45][$unit['service']], 'exact service duration');
        }
        check($counts === $expected, $sku . ' package units ' . $gateway);
        check($projection === $helper->project($s, $e, $now), 'deterministic replay cannot add units');
        check(count(array_unique(array_column($projection['units'], 'unit_id'))) === count($projection['units']), 'no duplicate unit IDs');
        check(array_intersect(array_keys($projection), ['remaining', 'course_id', 'role', 'balance']) === [], 'no balance or fabricated course/role');
        $e['woo_status'] = 'completed'; check($helper->project($s, $e, $now) === $projection, 'completed status preserves immutable units');
    }
}
[$s, $e] = fixtures('single');
denies(fn() => (new CoachingAllowanceProjection())->project($s, $e, $now), 'no product mapping by default');
foreach (['pending', 'on-hold', 'failed', 'cancelled', 'refunded', 'chargeback', 'quarantined', 'unknown', ''] as $status) {
    $bad = $e; $bad['woo_status'] = $status; denies(fn() => $helper->project($s, $bad, $now), 'unpaid or unknown Woo state closed');
}
foreach (['server_owned_evidence_verified', 'canonical_woo_is_paid', 'original_canonical_paid_verified', 'eligible_unit_ids', 'eligibility_revision', 'refunded_cents', 'chargeback', 'quarantined', 'canonical_snapshot_digest', 'admitted_snapshot_digest', 'canonical_paid_at', 'payment_proof'] as $key) {
    $bad = $e; unset($bad[$key]); denies(fn() => $helper->project($s, $bad, $now), 'missing canonical evidence ' . $key);
}
foreach (['refunded_cents' => -1, 'chargeback' => true, 'quarantined' => true, 'canonical_woo_is_paid' => false, 'original_canonical_paid_verified'=>false] as $key => $value) {
    $bad = $e; $bad[$key] = $value; denies(fn() => $helper->project($s, $bad, $now), 'risk/refund/unpaid fails closed');
}
foreach (['order_id', 'order_item_id', 'owner_wp_user_id', 'product_id'] as $key) {
    foreach (['910001', 1.5, true, 0, -1] as $value) { $bad = $e; $bad[$key] = $value; denies(fn() => $helper->project($s, $bad, $now), 'identity coercion denied ' . $key); }
    $bad = $e; $bad[$key]++; denies(fn() => $helper->project($s, $bad, $now), 'different owned identity denied ' . $key);
}
foreach (['order_id' => '0910001', 'order_item_id' => 920001, 'wp_customer_id' => '930001', 'product_id' => '900001', 'quantity' => 2, 'currency' => 'EUR', 'gateway' => 'other', 'sku' => 'other', 'total_cents' => 24901, 'fee_cents' => -1, 'coupon' => 'DRJ', 'order_created_at' => 'next Sunday'] as $key => $value) {
    $bad = $s; $bad[$key] = $value; [$bad, $bound] = rehash($bad, $e);
    denies(fn() => $helper->project($bad, $bound, $now), 'invalid but freshly hashed snapshot rejected ' . $key);
}
$tampered = $s; $tampered['sku'] = 'five'; denies(fn() => $helper->project($tampered, $e, $now), 'snapshot tampering without hash denied');
$extra = $s; $extra['course_id'] = 3646; denies(fn() => $helper->project($extra, $e, $now), 'unknown snapshot identity fields rejected');
foreach (['order_id' => 910002, 'owner_wp_user_id' => 930002, 'snapshot_digest' => str_repeat('b', 64), 'amount_cents' => 24901, 'currency' => 'EUR', 'gateway' => 'bacs', 'genuine_server_verified' => false, 'transaction_id' => 'made_up', 'kind' => 'manual_assertion', 'paid_at' => '2031-07-03T13:00:00Z'] as $key => $value) {
    $bad = $e; $bad['payment_proof'][$key] = $value; denies(fn() => $helper->project($s, $bad, $now), 'payment proof identity/settlement mismatch ' . $key);
}
$bad = $e; $bad['canonical_paid_at'] = $bad['payment_proof']['paid_at'] = '2031-07-03T13:00:00Z'; denies(fn() => $helper->project($s, $bad, $now), 'future canonical payment denied');
[$z, $ze] = fixtures('single', 'bacs');
foreach (['receipt_state' => 'pending', 'fingerprint' => '', 'financial_ledger_order_id' => 910002, 'kind' => 'unverified_zelle'] as $key => $value) {
    $bad = $ze; $bad['payment_proof'][$key] = $value; denies(fn() => $helper->project($z, $bad, $now), 'unverified Zelle receipt/ledger binding rejected');
}
foreach ([5504, 5867, 3576, 5865, 5513, 5873, 3575, 5862, 5863] as $courseId) {
    $bad = $s; $bad['product_id'] = $courseId; $bound = $e; $bound['product_id'] = $courseId; [$bad, $bound] = rehash($bad, $bound);
    denies(fn() => (new CoachingAllowanceProjection(['single' => $courseId]))->project($bad, $bound, $now), 'existing course product never reclassified');
}
[$em, $eme] = fixtures('emergency');
denies(fn() => $helper->project($em, $eme, $now), 'Emergency request-first, no normal projection');
$eme['emergency_staff_date_approval_verified'] = $eme['emergency_native_hold_verified'] = true;
denies(fn() => $helper->project($em, $eme, $now), 'extra speculative Emergency flags cannot enable unsupported flow');
$different = $s; $different['order_item_id'] = '920002'; $differentEvidence = $e; $differentEvidence['order_item_id'] = 920002; [$different, $differentEvidence] = rehash($different, $differentEvidence);
$differentEvidence['eligible_unit_ids']=CoachingAllowanceProjection::unitIds($different);
check($helper->project($different, $differentEvidence, $now)['units'][0]['unit_id'] !== $helper->project($s, $e, $now)['units'][0]['unit_id'], 'different canonical item has distinct stable unit identity');
[$ps,$pe]=fixtures('three'); $original=$helper->project($ps,$pe,$now);
$pe['refunded_cents']=10000; $pe['eligible_unit_ids']=[$pe['eligible_unit_ids'][0],...array_slice($pe['eligible_unit_ids'],2)]; $pe['eligibility_revision']=2;
$partial=$helper->project($ps,$pe,$now);
check($partial['units']===$original['units'] && $partial['eligible_unit_ids']===$pe['eligible_unit_ids'] && $partial['eligibility_revision']===2,'SIMULATED server-approved partial refund preserves immutable units and exact retained subset');
$pe['refunded_cents']=$ps['total_cents']; $pe['eligible_unit_ids']=[]; $pe['eligibility_revision']=3; $pe['woo_status']='refunded'; $pe['canonical_woo_is_paid']=false;
check($helper->project($ps,$pe,$now)['units']===$original['units'] && $helper->project($ps,$pe,$now)['eligible_unit_ids']===[],'SIMULATED full refund preserves original paid units with zero eligibility');
foreach (['foreign','duplicate','nonlist','scalar','missingOriginalPaid'] as $case) {
    $bad=$e;
    if($case==='foreign'){$bad['eligible_unit_ids']=['coaching-unit:v1:999:999:mock:1'];}
    if($case==='duplicate'){$bad['eligible_unit_ids']=[$e['eligible_unit_ids'][0],$e['eligible_unit_ids'][0]];}
    if($case==='nonlist'){$bad['eligible_unit_ids']=[1=>$e['eligible_unit_ids'][0]];}
    if($case==='scalar'){$bad['eligible_unit_ids']='all';}
    if($case==='missingOriginalPaid'){unset($bad['original_canonical_paid_verified']);}
    denies(fn()=>$helper->project($s,$bad,$now),'exact eligible/original-paid contract denies '.$case);
}
echo 'PASS: ' . $count . " deterministic nonfinancial allowance-projection assertions\n";
