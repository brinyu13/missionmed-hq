<?php
/** PROOF-INTEL-1300: isolated, read-only public presentation. No data writes. */
if (!defined('ABSPATH')) { exit; }
function mm_proof_1300_paths() {
    return array(
        'assets' => __DIR__ . '/missionmed-proof-intelligence-assets/',
        'private' => dirname(rtrim(ABSPATH, '/')) . '/deployments/proof-intelligence/PROOF-INTEL-1300-20261009-r3/',
        'url' => content_url('/mu-plugins/missionmed-proof-intelligence-assets/'),
    );
}
function mm_proof_1300_source_ready($data) {
    if (!is_array($data) || empty($data['stories'])) { return false; }
    foreach ($data['stories'] as $story) {
        if (($story['fullTextStatus'] ?? '') !== 'source-matched-complete' ||
            ($story['originalVerification'] ?? '') !== 'verified' ||
            ($story['fullOriginalVerified'] ?? false) !== true ||
            empty($story['full']) || empty($story['quote']) ||
            strpos($story['full'], $story['quote']) === false) { return false; }
        foreach (array_slice($story['fullSections'] ?? array(), 1) as $section) {
            if (($section['originalVerification'] ?? '') !== 'verified' ||
                ($section['fullOriginalVerified'] ?? false) !== true || empty($section['text'])) { return false; }
        }
        if (!empty($story['additional'])) {
            $answer = $story['additionalSource'] ?? array();
            if (($answer['fullTextStatus'] ?? '') !== 'source-matched-complete' ||
                ($answer['originalVerification'] ?? '') !== 'verified' ||
                ($answer['fullOriginalVerified'] ?? false) !== true ||
                empty($answer['full']) || strpos($answer['full'], $story['additional']) === false) { return false; }
        }
    }
    return true;
}
function mm_proof_1300_data() {
    $paths = mm_proof_1300_paths();
    $manifest = json_decode((string) @file_get_contents($paths['private'] . 'RELEASE_MANIFEST.json'), true);
    $data_path = $paths['private'] . 'archive.json';
    // A candidate cannot become public merely by copying the plugin into place.
    if (!is_array($manifest) || ($manifest['approved'] ?? false) !== true ||
        empty($manifest['sourceGatePassed']) || empty($manifest['independentVerdict']) ||
        !is_file($data_path) || !hash_equals((string) ($manifest['archiveSha256'] ?? ''), hash_file('sha256', $data_path))) {
        return null;
    }
    $data = json_decode((string) file_get_contents($data_path), true);
    return mm_proof_1300_source_ready($data) ? $data : null;
}
function mm_proof_1300_select($data, $query) {
    $value = function($key) use ($query) { return isset($query[$key]) && is_scalar($query[$key]) ? (string) $query[$key] : ''; };
    $offset = max(0, (int) $value('offset'));
    $limit = min(24, max(1, (int) ($value('limit') ?: 6)));
    $exclude = explode(',', $value('exclude'));
    $requested_id = $data['idAliases'][$value('id')] ?? $value('id');
    $tokens = preg_split('/\s+/u', strtolower(trim($value('q'))), -1, PREG_SPLIT_NO_EMPTY);
    $found = array_values(array_filter($data['stories'], function($story) use ($value, $exclude, $tokens, $requested_id) {
        if ($requested_id && $story['id'] !== $requested_id) { return false; }
        if (in_array($story['id'], $exclude, true)) { return false; }
        if ($value('theme') && !in_array($value('theme'), $story['themes'] ?? array(), true)) { return false; }
        if ($value('concern') && !in_array($value('concern'), $story['facts'] ?? array(), true)) { return false; }
        if ($value('specialty') && $value('specialty') !== ($story['specialty'] ?? '')) { return false; }
        if ($value('video') && empty($story['video'])) { return false; }
        $haystack = strtolower(implode(' ', array_map(function($key) use ($story) { return (string) ($story[$key] ?? ''); }, array('name', 'quote', 'full', 'specialty', 'program'))));
        foreach ($tokens as $token) { if (strpos($haystack, $token) === false) { return false; } }
        return true;
    }));
    $batch = array_map(function($story) { unset($story['personId'], $story['verification'], $story['factEvidence']); return $story; }, array_slice($found, $offset, $limit));
    return array('stories' => $batch, 'nextOffset' => $offset + count($batch), 'hasMore' => $offset + count($batch) < count($found));
}
add_action('template_redirect', function() {
    $path = parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH);
    if (!in_array($path, array('/testimonials/', '/testimonials', '/testimonials/api/stories', '/testimonials/api/catalog', '/testimonials/api/featured'), true)) { return; }
    if (!in_array($_SERVER['REQUEST_METHOD'] ?? 'GET', array('GET', 'HEAD'), true)) { status_header(405); header('Allow: GET, HEAD'); exit; }
    $data = mm_proof_1300_data();
    if (!$data) { status_header(503); header('Retry-After: 3600'); echo 'Student stories are temporarily unavailable.'; exit; }
    status_header(200); header('X-Content-Type-Options: nosniff'); header('Referrer-Policy: strict-origin-when-cross-origin');
    if (strpos($path, '/api/') !== false) {
        if (str_ends_with($path, '/featured')) {
            $featured_ids = $data['featuredStoryIds'] ?? array_column(array_slice($data['stories'], 0, 12), 'id');
            $featured = array_values(array_filter($data['stories'], function($story) use ($featured_ids) { return in_array($story['id'], $featured_ids, true); }));
            $featured = array_map(function($story) { unset($story['personId'], $story['verification'], $story['factEvidence']); return $story; }, $featured);
            $result = array('stories' => $featured, 'themes' => $data['themes'], 'facts' => $data['facts']);
        } elseif (str_ends_with($path, '/catalog')) {
            $specialties = array_values(array_unique(array_filter(array_column($data['stories'], 'specialty')))); sort($specialties);
            $result = array('specialties' => $specialties, 'concerns' => $data['facts']);
        } else { $result = mm_proof_1300_select($data, $_GET); }
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: public, max-age=60');
        if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'HEAD') { echo wp_json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); }
        exit;
    }
    if ($path === '/testimonials') { wp_safe_redirect(home_url('/testimonials/'), 301); exit; }
    header('Content-Type: text/html; charset=utf-8');
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'HEAD') { readfile(mm_proof_1300_paths()['assets'] . 'index.html'); }
    exit;
}, 1);
