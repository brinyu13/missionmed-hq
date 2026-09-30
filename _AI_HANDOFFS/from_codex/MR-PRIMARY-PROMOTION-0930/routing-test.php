<?php
define('ABSPATH', __DIR__);
function add_filter(...$args) {}
function add_action(...$args) {}
require __DIR__ . '/../../../wp-content/mu-plugins/missionmed-mr-primary-routing.php';
$cases = [
 ['/mission-residency/', '/missionresidency/'],
 ['/mission-residency', '/missionresidency/'],
 ['/mission-residency/?utm_source=facebook&utm_content=a%2Bb#dates', '/missionresidency/?utm_source=facebook&utm_content=a%2Bb#dates'],
 ['https://missionmedinstitute.com/mission-residency/#emergency-prep', 'https://missionmedinstitute.com/missionresidency/#emergency-prep'],
 ['//missionmedinstitute.com/mission-residency/', '//missionmedinstitute.com/missionresidency/'],
 ['/missionresidency/', '/missionresidency/'],
 ['/mission-residency/child/', '/mission-residency/child/'],
 ['/product/mission-residency/', '/product/mission-residency/'],
 ['https://other.example/mission-residency/', 'https://other.example/mission-residency/'],
 ['https://missionmedinstitute.com.evil.example/mission-residency/', 'https://missionmedinstitute.com.evil.example/mission-residency/'],
 ['mailto:info@missionmedinstitute.com', 'mailto:info@missionmedinstitute.com'],
 [null, null],
];
foreach ($cases as [$in, $expected]) {
 if (mm_mr_primary_public_url($in) !== $expected) throw new Exception('URL migration mismatch: ' . (string)$in);
}
echo 'PASS: ' . count($cases) . " exact URL/query/fragment/exclusion cases\n";
