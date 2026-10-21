<?php
/** Concept 1 private-coaching fragment only. Main page hero and commerce stay outside this component. */
declare(strict_types=1);

function mmed_staff_coaching_ui_escape(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function mmed_staff_coaching_ui_enabled(): bool
{
    return function_exists('mmed_staff_coaching_config') && function_exists('mmed_staff_coaching_catalog')
        && (mmed_staff_coaching_config()['enabled'] ?? false) === true;
}

function mmed_staff_coaching_ui_promo_open(): bool
{
    return new DateTimeImmutable('now', new DateTimeZone('America/New_York'))
        < new DateTimeImmutable('2026-11-01 00:00:00', new DateTimeZone('America/New_York'));
}

function mmed_staff_coaching_ui_money(int $cents): string
{
    return '$' . number_format($cents / 100, $cents % 100 === 0 ? 0 : 2, '.', ',');
}

function mmed_staff_coaching_ui_price(array $offer, bool $promo): string
{
    return '<div class="mm-coaching-price"><p class="mm-alt-price">'
        . mmed_staff_coaching_ui_money($offer[$promo ? 'promo' : 'regular'])
        . '</p><p class="mm-coaching-price-note">'
        . ($promo ? 'with code <strong>MATCHREADY2026</strong>' : 'Standard tuition') . '</p></div>';
}

/** Product links retain server readiness, SKU mapping and native permalink checks. */
function mmed_staff_coaching_ui_cta(string $sku, array $config, string $label): string
{
    $escape = 'mmed_staff_coaching_ui_escape';
    if ($sku === 'emergency') {
        return '<a class="cl1403c-a-btn mm-coaching-request" href="/contact/#form_contact-form">'
            . $escape($label) . ' <span aria-hidden="true">→</span></a>';
    }
    $id = $config['product_ids'][$sku] ?? 0;
    if (is_int($id) && $id > 0 && function_exists('mmed_staff_coaching_ready')
        && mmed_staff_coaching_ready($sku) && function_exists('get_permalink')) {
        $url = get_permalink($id);
        if (is_string($url) && $url !== '') {
            return '<a class="cl1403c-a-btn" href="' . $escape($url) . '">' . $escape($label)
                . ' <span aria-hidden="true">→</span></a>';
        }
    }
    return '<p class="mm-coaching-unavailable">Online enrollment is currently unavailable. <a href="/contact/#form_contact-form">Contact admissions</a>.</p>';
}

function mmed_staff_coaching_ui_icon(string $kind): string
{
    $paths = [
        'single' => '<rect x="3" y="7" width="22" height="18" rx="1"/><path d="m25 12 8-5v18l-8-5"/>',
        'multiple' => '<path d="M3 31h32M7 27V18h4v9m8 0V11h4v16m8 0V3h4v24"/>',
        'emergency' => '<path d="M18 2 7 20h10l-3 14L31 13H20l6-11Z"/>',
    ];
    return '<svg class="mm-coaching-icon" viewBox="0 0 40 38" width="40" height="38" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true" focusable="false">' . ($paths[$kind] ?? '') . '</svg>';
}

/** Called by MR routing only; never inserted inside the visually locked page hero. */
function mmed_staff_coaching_announcement(): string
{
    if (!mmed_staff_coaching_ui_enabled()) { return ''; }
    $deadline = mmed_staff_coaching_ui_promo_open() ? ' Introductory pricing through October 31.' : '';
    return '<aside class="mm-staff-coaching-announcement" aria-label="Private interview coaching"><div><p><strong>Missed the live Bootcamp?</strong> Private interview coaching is now available.' . $deadline . '</p><a href="#private-coaching">Explore packages <span aria-hidden="true">→</span></a></div></aside>';
}

function mmed_staff_coaching_landing(): string
{
    if (!mmed_staff_coaching_ui_enabled()) { return ''; }
    $config = mmed_staff_coaching_config();
    $catalog = mmed_staff_coaching_catalog();
    foreach (['single', 'three', 'five', 'emergency'] as $sku) {
        $offer = $catalog[$sku] ?? null;
        if (!is_array($offer) || !is_string($offer['name'] ?? null) || !is_string($offer['services'] ?? null)
            || !is_int($offer['regular'] ?? null) || !is_int($offer['promo'] ?? null)
            || $offer['regular'] <= 0 || $offer['promo'] <= 0 || $offer['promo'] > $offer['regular']) { return ''; }
    }
    $escape = 'mmed_staff_coaching_ui_escape';
    $money = 'mmed_staff_coaching_ui_money';
    $promo = mmed_staff_coaching_ui_promo_open();
    $media = '/wp-content/mu-plugins/missionmed-mr-alternate-assets/media/';
    $h = '<section id="private-coaching" class="mm-alt-enroll mm-coaching mm-coaching-concept1" aria-labelledby="private-coaching-title">';
    $h .= '<div class="mm-coaching-cinema"><div class="mm-coaching-scene" data-coaching-depth aria-hidden="true"><img src="' . $media . 'coaching-virtual-desk-1600.webp" srcset="' . $media . 'coaching-virtual-desk-640.webp 640w, ' . $media . 'coaching-virtual-desk-960.webp 960w, ' . $media . 'coaching-virtual-desk-1600.webp 1600w" sizes="100vw" width="1600" height="1067" loading="lazy" decoding="async" alt=""></div>';
    $h .= '<div class="mm-coaching-cinema-inner"><header class="mm-coaching-opening"><p class="mm-alt-kicker">Private Interview Coaching</p><h2 id="private-coaching-title">Real Practice.<br>Real Feedback.<br>Real Results.</h2><p class="mm-coaching-support">Live, 1:1 online sessions built around your background, your specialty, and your goals.</p></header>';
    $h .= '<div id="coaching-comparison" class="mm-coaching-options" aria-label="Choose your private coaching">';
    $h .= '<article class="mm-coaching-card" aria-labelledby="staff-coaching-single">' . mmed_staff_coaching_ui_icon('single') . '<h3 id="staff-coaching-single">Single<br>Signature Mock</h3><p class="mm-coaching-card-copy">One 105-minute rehearsal: a 15-minute mock, then 90 minutes of personal evaluation and coaching.</p>';
    $h .= mmed_staff_coaching_ui_price($catalog['single'], $promo) . '<div class="mm-coaching-card-action">' . mmed_staff_coaching_ui_cta('single', $config, 'Choose single mock') . '</div></article>';
    $h .= '<article class="mm-coaching-card mm-coaching-featured" aria-labelledby="staff-coaching-multiple"><p class="mm-coaching-flexible">Most Flexible</p>' . mmed_staff_coaching_ui_icon('multiple') . '<h3 id="staff-coaching-multiple">Multiple<br>Mock Packages</h3><p class="mm-coaching-card-copy">Build on two-hour private strategy with three or five mocks and post-interview debriefs.</p><div class="mm-coaching-price"><p class="mm-alt-price mm-coaching-range">' . $money($catalog['three'][$promo ? 'promo' : 'regular']) . '<span aria-hidden="true"> – </span><span class="mm-coaching-sr"> to </span>' . $money($catalog['five'][$promo ? 'promo' : 'regular']) . '</p><p class="mm-coaching-price-note">' . ($promo ? 'with code <strong>MATCHREADY2026</strong>' : 'Standard tuition') . '</p></div><div class="mm-coaching-card-action"><a class="cl1403c-a-btn" href="#coaching-package-choices" data-coaching-choose>Choose your package <span aria-hidden="true">→</span></a></div></article>';
    $h .= '<article class="mm-coaching-card" aria-labelledby="staff-coaching-emergency">' . mmed_staff_coaching_ui_icon('emergency') . '<h3 id="staff-coaching-emergency">Emergency<br>Interview Intensive</h3><p class="mm-coaching-card-copy">An eight-hour online training day, three total mocks and one post-interview debrief.</p>';
    $h .= mmed_staff_coaching_ui_price($catalog['emergency'], $promo) . '<div class="mm-coaching-card-action">' . mmed_staff_coaching_ui_cta('emergency', $config, 'Request intensive') . '</div></article></div>';
    $h .= '<p class="mm-coaching-illustration">Illustrative virtual coaching scene; not an actual student session.</p></div></div>';
    $h .= '<div class="mm-coaching-after"><p class="mm-coaching-booking"><strong>Live online. Staff-assisted booking.</strong> After verified payment, staff confirms actual appointment availability. Purchase does not reserve an immediate slot. For the Emergency Intensive, staff confirms an actual eight-hour date before any binding appointment or nonrefundable charge. No payment is taken with a request.</p>';
    if ($promo) {
        $h .= '<div class="mm-coaching-offer"><div><strong>October introductory pricing</strong><p>Through <time datetime="2026-10-31T23:59:00-04:00">October 31, 2026, 11:59 PM America/New_York (EDT)</time>. Coaching offers only; cannot combine with other coupons.</p></div><div class="mm-coaching-coupon"><code data-coaching-code>MATCHREADY2026</code><button type="button" data-coaching-copy aria-describedby="staff-coaching-copy-status">Copy code</button><span id="staff-coaching-copy-status" data-coaching-copy-status role="status" aria-live="polite"></span></div></div>';
    }
    $h .= '<details id="coaching-package-choices" class="mm-coaching-package-choices"><summary>Choose three or five mocks</summary><div class="mm-coaching-explicit-choices">';
    foreach (['three' => 'Three Signature Mocks', 'five' => 'Five Signature Mocks'] as $sku => $title) {
        $count = $sku === 'three' ? '3' : '5';
        $debriefs = $sku === 'three' ? '2' : '3';
        $h .= '<article aria-labelledby="staff-coaching-choice-' . $sku . '"><h3 id="staff-coaching-choice-' . $sku . '">' . $title . '</h3>' . mmed_staff_coaching_ui_price($catalog[$sku], $promo) . '<ul><li>' . $count . ' × 105-minute mocks, each combining a 15-minute interview with 90 minutes of evaluation and coaching.</li><li>One two-hour private strategy session before your first mock.</li><li>' . $debriefs . ' × 45-minute post-real-interview debriefs.</li></ul>' . mmed_staff_coaching_ui_cta($sku, $config, 'Choose ' . ($sku === 'three' ? 'three' : 'five') . ' mocks') . '</article>';
    }
    $h .= '</div></details><details class="mm-coaching-full-details"><summary>Full package details, standard prices and savings</summary><p>Standard prices below are intended future standard prices, not previously charged prices.</p><dl class="mm-coaching-price-details">';
    foreach (['single', 'three', 'five', 'emergency'] as $sku) {
        $offer = $catalog[$sku];
        $h .= '<div><dt>' . $escape($offer['name']) . '</dt><dd>' . $escape($offer['services']) . '</dd><dd>Intended future standard price: ' . $money($offer['regular']) . '.</dd>';
        if ($promo) { $h .= '<dd>With MATCHREADY2026: ' . $money($offer['promo']) . '. Save ' . $money($offer['regular'] - $offer['promo']) . '.</dd>'; }
        $h .= '</div>';
    }
    $h .= '</dl></details><div class="mm-coaching-terms"><details><summary>Refunds and delivered services</summary><p>Request a refund for unused services within 14 days of verified payment, subject to applicable law. Deduct only actually delivered services: $399 per 105-minute mock, $299 per two-hour strategy session, $149 per 45-minute debrief, and $1,799 per eight-hour intensive day. The mock included in the intensive day is never deducted separately.</p><p>A refund cannot exceed the amount actually paid, less prior refunds and delivered-service deductions, and cannot be negative. Unused or merely scheduled services are not deducted. Partial delivery and requests outside this window require staff review; statutory consumer rights are preserved. <a href="/refund-cancellation-policy/">Read the refund and cancellation policy</a>.</p></details><details><summary>Scheduling, rescheduling and payment</summary><p>Staff confirms actual availability after verified payment. Existing 360 and Complete student appointments and priority are preserved. Three and Five packages include strategy before the first mock.</p><p>Reschedule without penalty with at least 24 hours’ notice. Less than 24 hours’ notice may forfeit the session; one documented-emergency courtesy exception is available. Card and accepted Zelle verification are supported. Pending or unverified Zelle payments receive no booking confirmation, Matrix or replay access, or protected meeting links. Coaching purchase does not grant automatic Matrix or replay access.</p></details></div><p class="mm-coaching-final-note">No interview or Match outcome is guaranteed. <a href="/contact/#form_contact-form">Ask admissions about your preparation</a>. For an intensive request, include your preferred dates, interview date and timezone.</p></div></section>';
    return $h;
}
