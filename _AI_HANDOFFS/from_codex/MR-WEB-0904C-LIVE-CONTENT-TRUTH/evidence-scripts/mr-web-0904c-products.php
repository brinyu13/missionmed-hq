<?php
/** MR-WEB-0904C bounded Woo product truth mutation and exact rollback. */
if (!defined('ABSPATH')) {
    fwrite(STDERR, "Run through wp eval-file.\n");
    exit(2);
}

$mode = in_array('apply', $args ?? [], true) ? 'apply'
    : (in_array('rollback', $args ?? [], true) ? 'rollback' : 'verify');
$ids = [3576, 5865, 5504, 5867, 3575, 5862, 5863, 5864, 5866, 5511, 5512, 5513, 5868, 5869, 5870, 5871, 5872, 5873, 6319];
$privateDir = '/www/theresidencyacademy_209/private/mr-web-0904c';
$preimagePath = $privateDir . '/woo-product-truth-preimage.json';

function mr0904c_product_snapshot(int $id): array {
    $product = wc_get_product($id);
    if (!$product) throw new RuntimeException('Missing product ' . $id);
    return [
        'id' => $id,
        'type' => $product->get_type(),
        'name' => $product->get_name('edit'),
        'slug' => get_post_field('post_name', $id),
        'status' => $product->get_status('edit'),
        'catalog_visibility' => $product->get_catalog_visibility('edit'),
        'regular_price' => $product->get_regular_price('edit'),
        'sale_price' => $product->get_sale_price('edit'),
        'stock_status' => $product->get_stock_status('edit'),
        'manage_stock' => $product->get_manage_stock('edit'),
        'stock_quantity' => $product->get_stock_quantity('edit'),
        'backorders' => $product->get_backorders('edit'),
        'virtual' => $product->get_virtual('edit'),
        'sold_individually' => $product->get_sold_individually('edit'),
        'description' => $product->get_description('edit'),
        'short_description' => $product->get_short_description('edit'),
        'related_course_exists' => metadata_exists('post', $id, '_related_course'),
        'related_course' => get_post_meta($id, '_related_course', true),
        'exclude_discounts_exists' => metadata_exists('post', $id, '_wc_memberships_exclude_discounts'),
        'exclude_discounts' => get_post_meta($id, '_wc_memberships_exclude_discounts', true),
    ];
}

function mr0904c_all_product_snapshots(array $ids): array {
    $rows = [];
    foreach ($ids as $id) $rows[(string) $id] = mr0904c_product_snapshot((int) $id);
    return $rows;
}

function mr0904c_restore_meta(int $id, string $key, bool $exists, mixed $value): void {
    if ($exists) update_post_meta($id, $key, $value);
    else delete_post_meta($id, $key);
}

function mr0904c_restore_product(array $row): void {
    $product = wc_get_product((int) $row['id']);
    if (!$product || $product->get_type() !== $row['type']) throw new RuntimeException('Rollback type mismatch.');
    $product->set_name((string) $row['name']);
    $product->set_status((string) $row['status']);
    $product->set_catalog_visibility((string) $row['catalog_visibility']);
    $product->set_regular_price((string) $row['regular_price']);
    $product->set_sale_price((string) $row['sale_price']);
    $product->set_stock_status((string) $row['stock_status']);
    $product->set_manage_stock((bool) $row['manage_stock']);
    $product->set_stock_quantity($row['stock_quantity'] === null ? null : (int) $row['stock_quantity']);
    $product->set_backorders((string) $row['backorders']);
    $product->set_virtual((bool) $row['virtual']);
    $product->set_sold_individually((bool) $row['sold_individually']);
    $product->set_description((string) $row['description']);
    $product->set_short_description((string) $row['short_description']);
    $product->save();
    mr0904c_restore_meta((int) $row['id'], '_related_course', (bool) $row['related_course_exists'], $row['related_course']);
    mr0904c_restore_meta((int) $row['id'], '_wc_memberships_exclude_discounts', (bool) $row['exclude_discounts_exists'], $row['exclude_discounts']);
    clean_post_cache((int) $row['id']);
    wc_delete_product_transients((int) $row['id']);
}

function mr0904c_set_parent(int $id, string $name, string $short, string $description, string $stock): void {
    $product = wc_get_product($id);
    $product->set_name($name);
    $product->set_status('publish');
    $product->set_catalog_visibility('visible');
    $product->set_stock_status($stock);
    $product->set_short_description($short);
    $product->set_description($description);
    $product->save();
    clean_post_cache($id);
    wc_delete_product_transients($id);
}

function mr0904c_set_variation(int $id, string $price, string $stock, int $courseId): void {
    $product = wc_get_product($id);
    if (!$product instanceof WC_Product_Variation) throw new RuntimeException('Variation identity mismatch ' . $id);
    $product->set_status('publish');
    $product->set_regular_price($price);
    $product->set_sale_price('');
    $product->set_stock_status($stock);
    $product->set_manage_stock(false);
    $product->set_backorders('no');
    $product->save();
    update_post_meta($id, '_related_course', [$courseId]);
    update_post_meta($id, '_wc_memberships_exclude_discounts', 'yes');
    clean_post_cache($id);
    wc_delete_product_transients($id);
}

if ($mode === 'apply') {
    if (!is_dir($privateDir) && !mkdir($privateDir, 0700, true) && !is_dir($privateDir)) {
        throw new RuntimeException('Unable to create private preimage directory.');
    }
    if (file_exists($preimagePath)) throw new RuntimeException('Preimage already exists; refusing overwrite.');
    $before = ['timestamp_utc' => gmdate('c'), 'products' => mr0904c_all_product_snapshots($ids)];
    if (file_put_contents($preimagePath, wp_json_encode($before, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)) === false) {
        throw new RuntimeException('Unable to write product preimage.');
    }
    chmod($preimagePath, 0600);

    mr0904c_set_parent(
        3576,
        'IV Prep Complete',
        'Stay with me through interview season.',
        '<p><strong>Launch tuition: $2,799 through September 12, 2026 at 11:59 PM ET.</strong> Five new public seats are available.</p><ul><li>Full live Foundation/Essentials training</li><li>Advanced live curriculum</li><li>FOUR Signature Mock Interviews</li><li>Guaranteed monthly live hot-seat during eligible cohort months</li><li>Ongoing live practice</li><li>Sunday checkups and debrief support where scheduled</li><li>Program-specific strategy</li></ul><p>A Signature Mock Interview is a full live personalized interview followed by individualized analysis, assessment, debrief, and an action plan.</p><p>Pay in full by card: $2,799. A staffed four-payment option is $750 plus 3 payments of $683, totaling $2,799; contact Admissions to confirm the schedule and collection method. No autopay claim is made.</p>',
        'instock'
    );
    mr0904c_set_variation(5865, '2799', 'instock', 5227);
    update_post_meta(3576, '_wc_memberships_exclude_discounts', 'yes');

    mr0904c_set_parent(
        5504,
        'IV Prep Essentials',
        'Teach me how to interview.',
        '<p><strong>Launch tuition: $1,199 through September 12, 2026 at 11:59 PM ET.</strong> Later standard tuition is $1,399. Pay in full only for P0.</p><ul><li>Full live Foundation/core training</li><li>1 Signature Mock Interview</li><li>2 observer-only Complete practice nights where operationally supported</li><li>Communication and question strategy</li></ul><p>A Signature Mock Interview is a full live personalized interview followed by individualized analysis, assessment, debrief, and an action plan.</p>',
        'instock'
    );
    mr0904c_set_variation(5867, '1199', 'instock', 3646);
    update_post_meta(5504, '_wc_memberships_exclude_discounts', 'yes');

    mr0904c_set_parent(
        3575,
        '360 Match Mentorship',
        '2026-27 mentorship capacity reached. Enrollment closed.',
        '<p><strong>2026-27 MENTORSHIP CAPACITY REACHED — ENROLLMENT CLOSED.</strong></p><p>Reference tuition: $5,499. No checkout is available. Applications for 2027-28 priority interest open March 19, 2027; joining the interest path does not reserve a seat.</p>',
        'outofstock'
    );
    mr0904c_set_variation(5862, '5499', 'outofstock', 3893);
    mr0904c_set_variation(5863, '5499', 'outofstock', 3893);
}

if ($mode === 'rollback') {
    if (!file_exists($preimagePath)) throw new RuntimeException('Product preimage missing.');
    $before = json_decode((string) file_get_contents($preimagePath), true);
    if (!is_array($before) || !isset($before['products'])) throw new RuntimeException('Product preimage invalid.');
    foreach ($before['products'] as $row) mr0904c_restore_product($row);
}

$rows = mr0904c_all_product_snapshots($ids);
$checks = [
    'complete_name' => $rows['3576']['name'] === 'IV Prep Complete',
    'complete_price' => (float) $rows['5865']['regular_price'] === 2799.0 && $rows['5865']['sale_price'] === '',
    'complete_open' => $rows['3576']['status'] === 'publish' && $rows['5865']['status'] === 'publish' && $rows['5865']['stock_status'] === 'instock',
    'complete_mapping' => array_map('intval', (array) $rows['5865']['related_course']) === [5227],
    'essentials_name' => $rows['5504']['name'] === 'IV Prep Essentials',
    'essentials_price' => (float) $rows['5867']['regular_price'] === 1199.0 && $rows['5867']['sale_price'] === '',
    'essentials_open' => $rows['5504']['status'] === 'publish' && $rows['5867']['status'] === 'publish' && $rows['5867']['stock_status'] === 'instock',
    'essentials_mapping' => array_map('intval', (array) $rows['5867']['related_course']) === [3646],
    '360_closed' => $rows['3575']['name'] === '360 Match Mentorship' && $rows['3575']['stock_status'] === 'outofstock'
        && $rows['5862']['stock_status'] === 'outofstock' && $rows['5863']['stock_status'] === 'outofstock'
        && (float) $rows['5862']['regular_price'] === 5499.0 && (float) $rows['5863']['regular_price'] === 5499.0,
    'past_sessions_closed' => $rows['5864']['stock_status'] === 'outofstock' && $rows['5866']['stock_status'] === 'outofstock',
    'legacy_plans_closed' => !array_filter([5511, 5512, 5513, 5868, 5869, 5870, 5871, 5872, 5873], static fn($id) => $rows[(string) $id]['status'] === 'publish' || $rows[(string) $id]['stock_status'] !== 'outofstock'),
    'dollar_test_retired' => $rows['6319']['status'] === 'draft' && $rows['6319']['stock_status'] === 'outofstock' && $rows['6319']['catalog_visibility'] === 'hidden',
];

$safeRows = [];
foreach ($rows as $id => $row) {
    $safeRows[$id] = [
        'name' => $row['name'], 'slug' => $row['slug'], 'status' => $row['status'],
        'regular_price' => $row['regular_price'], 'sale_price' => $row['sale_price'],
        'stock_status' => $row['stock_status'], 'catalog_visibility' => $row['catalog_visibility'],
        'related_course' => $row['related_course'],
        'description_sha256' => hash('sha256', (string) $row['description']),
        'short_description_sha256' => hash('sha256', (string) $row['short_description']),
    ];
}
echo wp_json_encode([
    'schema' => 'missionmed.mr_web_0904c.woo_products.v1',
    'mode' => $mode,
    'verified_at_utc' => gmdate('c'),
    'preimage_path' => $preimagePath,
    'preimage_mode' => file_exists($preimagePath) ? substr(sprintf('%o', fileperms($preimagePath)), -4) : null,
    'products' => $safeRows,
    'checks' => $checks,
    'pass_count' => count(array_filter($checks)),
    'check_count' => count($checks),
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES), "\n";

if ($mode === 'rollback') exit(0);
exit(count(array_filter($checks)) === count($checks) ? 0 : 1);
