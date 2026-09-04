<?php
declare(strict_types=1);

if ($argc !== 2 || !is_file($argv[1])) {
    fwrite(STDERR, "usage: php hub-harness.php patched-missionmed-hub.php\n");
    exit(2);
}

$GLOBALS['mr0904b_hub_orders'] = [];
$GLOBALS['mr0904b_hub_related'] = [5865 => [5227]];
$GLOBALS['mr0904b_hub_course_calls'] = [];
$GLOBALS['mr0904b_hub_group_calls'] = [];
$GLOBALS['mr0904b_hub_actions'] = [];

class MMED_Access_Audit {
    public static function clear_cache(): void {}
    public static function get_program_mappings(): array {
        return [
            [
                'product_id' => 3576,
                'product_ids' => [3576],
                'course_id' => 5227,
                'group_id' => 0,
                'template_slug' => '',
                'division' => 'residency',
            ],
            [
                'product_id' => 5504,
                'product_ids' => [5504],
                'course_id' => 3646,
                'group_id' => 0,
                'template_slug' => '',
                'division' => 'residency',
            ],
            [
                'product_id' => 3784,
                'product_ids' => [3784],
                'course_id' => 7001,
                'group_id' => 7002,
                'template_slug' => 'usce_onboarding',
                'division' => 'clinicals',
            ],
        ];
    }
    public static function get_mapping_product_ids(array $mapping): array {
        return array_values(array_unique(array_map('intval', array_merge(
            (array) ($mapping['product_ids'] ?? []),
            [(int) ($mapping['product_id'] ?? 0)]
        ))));
    }
}

class MR0904BHubItem {
    public function __construct(private int $productId, private int $variationId) {}
    public function get_product_id(): int { return $this->productId; }
    public function get_variation_id(): int { return $this->variationId; }
}

class MR0904BHubOrder {
    public function __construct(private int $userId, private array $items) {}
    public function get_user_id(): int { return $this->userId; }
    public function get_items(): array { return $this->items; }
}

function wc_get_order($orderId) { return $GLOBALS['mr0904b_hub_orders'][(int) $orderId] ?? false; }
function get_posts(array $args): array { return []; }
function get_post_meta($id, $key, $single = false) {
    return $key === '_related_course' ? ($GLOBALS['mr0904b_hub_related'][(int) $id] ?? []) : [];
}
function ld_update_course_access($userId, $courseId): void {
    $GLOBALS['mr0904b_hub_course_calls'][] = [(int) $userId, (int) $courseId];
}
function ld_update_group_access($userId, $groupId): void {
    $GLOBALS['mr0904b_hub_group_calls'][] = [(int) $userId, (int) $groupId];
}
function do_action($hook, ...$args): void { $GLOBALS['mr0904b_hub_actions'][] = [$hook, ...$args]; }
function absint($value): int { return abs((int) $value); }

$source = file_get_contents($argv[1]);
$start = strpos($source, 'function mmed_woo_order_complete');
$end = strpos($source, '/* ── Settings Page', $start ?: 0);
if ($start === false || $end === false) {
    fwrite(STDERR, "unable to extract entitlement function\n");
    exit(2);
}
eval(substr($source, $start, $end - $start));

$logPath = sys_get_temp_dir() . '/mr-web-0904b-hub-harness.log';
@unlink($logPath);
ini_set('log_errors', '1');
ini_set('error_log', $logPath);

$GLOBALS['mr0904b_hub_orders'][9101] = new MR0904BHubOrder(201, [new MR0904BHubItem(3576, 5865)]);
mmed_woo_order_complete(9101);
$mappedResidencyUsesNativeOnly = $GLOBALS['mr0904b_hub_course_calls'] === [] && $GLOBALS['mr0904b_hub_group_calls'] === [];

$GLOBALS['mr0904b_hub_orders'][9102] = new MR0904BHubOrder(202, [new MR0904BHubItem(5504, 5867)]);
mmed_woo_order_complete(9102);
$unmappedResidencyFailsClosed = $GLOBALS['mr0904b_hub_course_calls'] === [] && $GLOBALS['mr0904b_hub_group_calls'] === [];
$log = is_file($logPath) ? file_get_contents($logPath) : '';
$missingMappingLoggedSafely = str_contains($log, 'order=9102 products=5504,5867 expected_course=3646 native_courses=');

$GLOBALS['mr0904b_hub_orders'][9103] = new MR0904BHubOrder(203, [new MR0904BHubItem(3784, 0)]);
mmed_woo_order_complete(9103);
$nonResidencyFallbackPreserved = $GLOBALS['mr0904b_hub_course_calls'] === [[203, 7001]]
    && $GLOBALS['mr0904b_hub_group_calls'] === [[203, 7002]];
$nonResidencyTemplatePreserved = in_array(['mmed_enrollment_complete', 203, 'usce_onboarding'], $GLOBALS['mr0904b_hub_actions'], true);

$checks = [
    'mapped_residency_uses_native_only' => $mappedResidencyUsesNativeOnly,
    'unmapped_residency_fails_closed' => $unmappedResidencyFailsClosed,
    'missing_mapping_logged_support_safely' => $missingMappingLoggedSafely,
    'non_residency_fallback_preserved' => $nonResidencyFallbackPreserved,
    'non_residency_template_preserved' => $nonResidencyTemplatePreserved,
];
$failed = array_keys(array_filter($checks, static fn($value) => $value !== true));
echo json_encode([
    'schema' => 'missionmed.mr_web_0904b.hub_entitlement_harness.v1',
    'source_sha256' => hash_file('sha256', $argv[1]),
    'checks' => $checks,
    'passed' => count($checks) - count($failed),
    'total' => count($checks),
    'result' => $failed ? 'FAIL' : 'PASS',
    'failed' => $failed,
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES), "\n";
exit($failed ? 1 : 0);
