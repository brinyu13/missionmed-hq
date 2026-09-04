<?php
declare(strict_types=1);
require '/www/theresidencyacademy_209/public/wp-load.php';

function staged_product(int $id, array $fields) {
    $product = clone wc_get_product($id);
    foreach ($fields as $field => $value) {
        $method = 'set_' . $field;
        $product->{$method}($value);
    }
    return $product;
}

$complete = staged_product(5865, ['status' => 'publish', 'regular_price' => '2799', 'sale_price' => '', 'stock_status' => 'instock']);
$essentials = staged_product(5867, ['status' => 'publish', 'regular_price' => '1199', 'sale_price' => '', 'stock_status' => 'instock']);
$pastComplete = staged_product(5864, ['status' => 'draft', 'stock_status' => 'outofstock']);
$pastEssentials = staged_product(5866, ['status' => 'draft', 'stock_status' => 'outofstock']);
$closed = [];
foreach ([3575,5862,5863] as $id) $closed[$id] = staged_product($id, ['stock_status' => 'outofstock']);
foreach ([5511,5512,5513,5868,5869,5870,5871,5872,5873] as $id) $closed[$id] = staged_product($id, ['status' => 'draft', 'stock_status' => 'outofstock']);

$mapping = [
    3575 => 3893, 5862 => 3893, 5863 => 3893, 5511 => 3893, 5868 => 3893, 5869 => 3893,
    3576 => 5227, 5864 => 5227, 5865 => 5227, 5512 => 5227, 5870 => 5227, 5871 => 5227,
    5504 => 3646, 5866 => 3646, 5867 => 3646, 3577 => 3646, 5513 => 3646, 5872 => 3646, 5873 => 3646,
];
$checks = [
    'complete_price_truth' => $complete->get_regular_price('edit') === '2799',
    'complete_active_sellable' => $complete->is_purchasable() && $complete->is_in_stock(),
    'complete_past_variation_closed' => !$pastComplete->is_purchasable() || !$pastComplete->is_in_stock(),
    'complete_exact_mapping' => $mapping[5865] === 5227,
    'essentials_price_truth' => $essentials->get_regular_price('edit') === '1199',
    'essentials_active_sellable' => $essentials->is_purchasable() && $essentials->is_in_stock(),
    'essentials_past_variation_closed' => !$pastEssentials->is_purchasable() || !$pastEssentials->is_in_stock(),
    'essentials_exact_mapping' => $mapping[5867] === 3646,
    '360_parent_and_variations_closed' => count(array_filter([3575,5862,5863], static fn($id) => $closed[$id]->is_purchasable() && $closed[$id]->is_in_stock())) === 0,
    'legacy_parents_closed' => count(array_filter([5511,5512,5513], static fn($id) => $closed[$id]->is_purchasable() && $closed[$id]->is_in_stock())) === 0,
    'legacy_variations_closed' => count(array_filter([5868,5869,5870,5871,5872,5873], static fn($id) => $closed[$id]->is_purchasable() && $closed[$id]->is_in_stock())) === 0,
    'no_product_id_recreation' => array_keys($mapping) === [3575,5862,5863,5511,5868,5869,3576,5864,5865,5512,5870,5871,5504,5866,5867,3577,5513,5872,5873],
];
$failed = array_keys(array_filter($checks, static fn($value) => $value !== true));
echo json_encode([
    'schema' => 'missionmed.mr_web_0904b.product_stage_dry_run.v1',
    'checks' => $checks,
    'passed' => count($checks) - count($failed),
    'total' => count($checks),
    'result' => $failed ? 'FAIL' : 'PASS',
    'failed' => $failed,
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES), "\n";
exit($failed ? 1 : 0);
