<?php
declare(strict_types=1);
defined('ABSPATH') || exit;

/** Read-only presentation: existing Woo release checks own admission. */
function mmed_mr_coaching_landing_markup(): string {
    if (!function_exists('mmed_mr_coaching_config') || !function_exists('mmed_mr_coaching_release_ready')
        || !function_exists('wc_get_product') || !function_exists('home_url')) { return ''; }
    try {
        $config = mmed_mr_coaching_config();
        $display = $config['landing_release'] ?? array();
        if (($display['publication_enabled'] ?? false) !== true || ($display['public_copy_approved'] ?? false) !== true) { return ''; }
        $mapping = array(); $checkout = array();
        $origin = parse_url(home_url('/'));
        foreach (array('single', 'three', 'five') as $sku) {
            // Includes architecture, independent release, native Scheduler,
            // allocation, refund, Zelle, exact SKU and real product verification.
            if (mmed_mr_coaching_release_ready($sku) !== true) { return ''; }
            $id = $config['product_ids'][$sku] ?? null;
            if (!is_int($id) || $id <= 0) { return ''; }
            $product = wc_get_product($id);
            if (!$product) { return ''; }
            $url = parse_url($product->get_permalink());
            if (!$url || !$origin || ($url['scheme'] ?? '') !== ($origin['scheme'] ?? '')
                || ($url['host'] ?? '') !== ($origin['host'] ?? '') || ($url['port'] ?? null) !== ($origin['port'] ?? null)
                || isset($url['user']) || isset($url['pass']) || !str_starts_with($url['path'] ?? '', '/')
                || str_starts_with($url['path'], '//')) { return ''; }
            $path = $url['path'] . (isset($url['query']) ? '?' . $url['query'] : '');
            if (preg_match('~[\s<>"\x00-\x1f\\\\]~', $path)) { return ''; }
            $mapping[$sku] = $id;
            $checkout[$sku] = array('product_id' => $id, 'url' => $path, 'verified' => true);
        }
        if (count(array_unique($mapping)) !== 3) { return ''; }
        require_once dirname(__DIR__) . '/missionmed-mr-coaching-assets/CoachingLandingSection.php';
        $contract = json_decode(file_get_contents(dirname(__DIR__) . '/missionmed-mr-coaching-assets/CoachingPublicContract.json'), true, 512, JSON_THROW_ON_ERROR);
        // Static public contract is disabled. Actual gates above are the sole
        // reason this request may construct an activated presentation policy.
        $contract['activation_enabled'] = true;
        $policyRelease = array('enabled' => true, 'purchasable_skus' => array('single', 'three', 'five'),
            'product_ids' => $mapping, 'verified_coaching_product_ids' => array_values($mapping),
            'protected_course_product_ids' => MMED_MR_COACHING_PROTECTED_IDS,
            'canonical_matrix_scheduler_verified' => ($config['native_scheduler_verified'] ?? false) === true,
            'atomic_allocation_verified' => ($config['woo_allocation_verified'] ?? false) === true,
            'independently_verified_refund_terms' => ($config['refund_disclosure_verified'] ?? false) === true);
        $policy = new \MissionMed\Residency\Coaching\CoachingOfferPolicy($contract, $policyRelease);
        if (!$policy->readiness()['ready']) { return ''; }
        $now = new DateTimeImmutable('now', new DateTimeZone('America/New_York'));
        $release = array('publication_enabled' => true, 'public_copy_approved' => true, 'checkout' => $checkout,
            'native_cap_enforcement_verified' => ($config['woo_allocation_verified'] ?? false) === true
                && ($display['native_cap_enforcement_verified'] ?? false) === true,
            // Explicit current server release evidence, never a browser claim
            // or a fabricated remaining-enrollment counter. Checkout rechecks.
            'introductory_offer_currently_open' => ($display['introductory_offer_currently_open'] ?? false) === true,
            // Read-only inspection 2026-10-20: existing HTTPS /contact/ has
            // required Name/Email/Subject/Message, no payment or document fields.
            'emergency_request' => array('url' => '/contact/#form_contact-form', 'verified_nonpayment_path' => true));
        return \MissionMed\Residency\Coaching\CoachingLandingSection::render($contract, $release, $now, $policy);
    } catch (Throwable $error) { return ''; }
}
