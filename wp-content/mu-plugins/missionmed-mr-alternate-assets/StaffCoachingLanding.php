<?php
/** MR-only additive conversion fragment. Existing hero and commerce remain owned elsewhere. */
declare(strict_types=1);

function mmed_staff_coaching_ui_escape(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function mmed_staff_coaching_ui_enabled(): bool
{
    return function_exists('mmed_staff_coaching_config')
        && function_exists('mmed_staff_coaching_catalog')
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
    $money = 'mmed_staff_coaching_ui_money';
    if (!$promo) {
        return '<div class="mm-coaching-price"><p class="mm-coaching-price-label">Standard tuition</p><p class="mm-alt-price">' . $money($offer['regular']) . '</p><p class="mm-coaching-price-note">Review the actual total before payment.</p></div>';
    }
    return '<div class="mm-coaching-price"><p class="mm-coaching-price-label">Introductory tuition</p><p class="mm-alt-price">' . $money($offer['promo']) . '</p><p class="mm-coaching-price-note">With <strong>MATCHREADY2026</strong></p><p class="mm-coaching-future">Intended future standard price <span>' . $money($offer['regular']) . '</span></p><p class="mm-coaching-saving">Save ' . $money($offer['regular'] - $offer['promo']) . '</p></div>';
}

/** Native verified product URL only. Emergency always uses the verified inquiry path. */
function mmed_staff_coaching_ui_cta(string $sku, array $config, string $label): string
{
    $escape = 'mmed_staff_coaching_ui_escape';
    if ($sku === 'emergency') {
        return '<a class="cl1403c-a-btn mm-coaching-request" href="/contact/#form_contact-form">Request an intensive date <span aria-hidden="true">→</span></a>';
    }
    $id = $config['product_ids'][$sku] ?? 0;
    if (is_int($id) && $id > 0 && function_exists('mmed_staff_coaching_ready')
        && mmed_staff_coaching_ready($sku) && function_exists('get_permalink')) {
        $url = get_permalink($id);
        if (is_string($url) && $url !== '') {
            return '<a class="cl1403c-a-btn" href="' . $escape($url) . '">' . $escape($label) . ' <span aria-hidden="true">→</span></a>';
        }
    }
    return '<p class="mm-coaching-unavailable">Online enrollment is currently unavailable. <a href="/contact/#form_contact-form">Contact admissions</a>.</p>';
}

/** Insert only on MR, outside the existing hero. */
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
        if (!is_array($offer) || !is_string($offer['name'] ?? null)
            || !is_string($offer['services'] ?? null) || !is_int($offer['regular'] ?? null)
            || !is_int($offer['promo'] ?? null) || $offer['regular'] <= 0
            || $offer['promo'] <= 0 || $offer['promo'] > $offer['regular']) { return ''; }
    }
    $escape = 'mmed_staff_coaching_ui_escape';
    $money = 'mmed_staff_coaching_ui_money';
    $promo = mmed_staff_coaching_ui_promo_open();
    // The same approved service facts populate cards and comparison; no bonus inference.
    $features = [
        'single' => [
            'eyebrow' => 'One focused rehearsal', 'lead' => 'Bring your answers into focus.',
            'benefit' => 'Practice a realistic interview, then work through your answers with Dr Brian.',
            'mocks' => '1 Signature Mock', 'strategy' => 'Not included', 'debrief' => 'Not included', 'day' => 'Not included',
            'list' => ['1 × 105-minute Signature Mock', '15-minute realistic interview', '90-minute individualized evaluation and correction'],
            'cta' => 'Choose one mock',
        ],
        'three' => [
            'eyebrow' => 'Recommended', 'lead' => 'Learn. Practice. Refine.',
            'benefit' => 'Start with strategy, build through three mocks, and reflect on real interviews.',
            'mocks' => '3 Signature Mocks', 'strategy' => '2 hours, before your first mock', 'debrief' => '2 × 45 minutes', 'day' => 'Not included',
            'list' => ['3 × 105-minute Signature Mocks', '2-hour private strategy session before your first mock', '2 × 45-minute post-real-interview debriefs'],
            'cta' => 'Choose three mocks',
        ],
        'five' => [
            'eyebrow' => 'More practice. More reflection.', 'lead' => 'Keep refining your interview.',
            'benefit' => 'Give yourself five opportunities to practice, with strategy and real-interview debriefs.',
            'mocks' => '5 Signature Mocks', 'strategy' => '2 hours, before your first mock', 'debrief' => '3 × 45 minutes', 'day' => 'Not included',
            'list' => ['5 × 105-minute Signature Mocks', '2-hour private strategy session before your first mock', '3 × 45-minute post-real-interview debriefs'],
            'cta' => 'Choose five mocks',
        ],
        'emergency' => [
            'eyebrow' => 'Private intensive · Request first', 'lead' => 'A dedicated day to prepare.',
            'benefit' => 'An eight-hour private training day, followed by separate mocks and a debrief.',
            'mocks' => '1 within the day + 2 separate follow-up mocks', 'strategy' => 'No separate strategy session', 'debrief' => '1 × 45 minutes', 'day' => '8-hour private day, including 1 mock',
            'list' => ['8-hour private day, including 1 Signature Mock', '2 separate 105-minute follow-up mocks', '1 × 45-minute post-real-interview debrief'],
            'cta' => 'Request an intensive date',
        ],
    ];
    $h = '<section id="private-coaching" class="mm-alt-enroll mm-coaching" aria-labelledby="private-coaching-title"><div class="mm-alt-enroll-inner">';
    $h .= '<div class="mm-coaching-editorial"><div class="mm-coaching-editorial-copy"><p class="mm-alt-kicker">Private residency interview coaching</p><h2 id="private-coaching-title">You earned the interview.<br><em>Let’s prepare for the conversation.</em></h2><p class="mm-coaching-deck">Your story deserves more than a rehearsed answer. Practice with Dr Brian, understand what to improve, and work on how you communicate your experience.</p><div class="mm-coaching-method" aria-label="Signature Mock format"><div><strong>15<span>min</span></strong><h3>A realistic interview</h3><p>Practice answering in the moment, in a focused simulated interview.</p></div><div><strong>90<span>min</span></strong><h3>Individualized correction</h3><p>Review your answers with Dr Brian and work on how to make them clearer and more personal.</p></div></div><p class="mm-coaching-method-note">One Signature Mock. <strong>105 minutes of individual preparation.</strong></p></div><figure class="mm-coaching-mentor"><img src="/wp-content/mu-plugins/missionmed-mr-alternate-assets/media/brian-studio-aaa.jpg" width="1310" height="1060" loading="lazy" decoding="async" alt="Dr Brian at MissionMed"><figcaption>Private preparation with Dr Brian<span>Realistic practice. Personal evaluation. Focused correction.</span></figcaption></figure></div>';
    $h .= '<div id="coaching-comparison" class="mm-coaching-purchase-intro"><div><p class="mm-alt-kicker">Choose your preparation</p><h3>One conversation.<br>Or a plan to keep improving.</h3></div><p><strong>Staff-assisted booking.</strong> After verified payment, our team confirms actual appointment availability and helps schedule your services. Purchase does not reserve an immediate slot. Emergency Intensive dates are confirmed before any binding commitment or nonrefundable charge.</p></div>';
    if ($promo) {
        $h .= '<div class="mm-coaching-offer"><div><p class="mm-coaching-offer-title">Your October introductory offer</p><p>Through <time datetime="2026-10-31T23:59:00-04:00">October 31, 2026, 11:59 PM America/New_York (EDT)</time>.</p></div><div class="mm-coaching-coupon"><code id="staff-coaching-coupon" data-coaching-code>MATCHREADY2026</code><button type="button" data-coaching-copy aria-describedby="staff-coaching-copy-status">Copy code</button><span id="staff-coaching-copy-status" data-coaching-copy-status class="mm-coaching-copy-status" role="status" aria-live="polite"></span></div><p class="mm-coaching-offer-note">For these coaching offers only. Cannot combine with other coupons. Standard prices shown below are intended future prices, not previously charged prices.</p></div>';
    }
    $h .= '<div class="mm-coaching-options">';
    foreach ($features as $sku => $feature) {
        $offer = $catalog[$sku];
        $class = $sku === 'three' ? ' mm-coaching-recommended' : ($sku === 'emergency' ? ' mm-coaching-intensive' : '');
        $h .= '<article class="mm-alt-option mm-coaching-card' . $class . '" aria-labelledby="staff-coaching-' . $sku . '"><p class="mm-coaching-card-eyebrow">' . $escape($feature['eyebrow']) . '</p><h3 id="staff-coaching-' . $sku . '">' . $escape($offer['name']) . '</h3><p class="mm-coaching-card-lead">' . $escape($feature['lead']) . '</p>';
        $h .= mmed_staff_coaching_ui_price($offer, $promo);
        $h .= '<ul class="mm-coaching-inclusions">';
        foreach ($feature['list'] as $item) { $h .= '<li>' . $escape($item) . '</li>'; }
        $h .= '</ul><div class="mm-coaching-card-action">' . mmed_staff_coaching_ui_cta($sku, $config, $feature['cta']);
        $h .= $sku === 'emergency'
            ? '<p>No payment with a request. Staff must confirm an actual eight-hour date first. A request does not reserve a date or promotional price.</p>'
            : '<p>Staff confirms appointments after verified payment.</p>';
        $h .= '</div></article>';
    }
    $h .= '</div><p class="mm-coaching-format-note">Every Signature Mock combines a 15-minute realistic interview with 90 minutes of individualized evaluation and correction. Emergency’s first mock is part of the eight-hour day; its two follow-up mocks are separate.</p>';
    // Desktop overview uses native table headers. Mobile cards above contain the same facts.
    $h .= '<div class="mm-coaching-comparison"><table><caption>Compare your private-coaching options</caption><thead><tr><th scope="col">Your preparation</th>';
    foreach ($features as $sku => $feature) {
        $offer = $catalog[$sku];
        $h .= '<th scope="col"' . ($sku === 'three' ? ' class="mm-coaching-table-recommended"' : '') . '>' . $escape($offer['name']) . ($sku === 'three' ? '<span>Recommended</span>' : '') . '</th>';
    }
    $h .= '</tr></thead><tbody>';
    foreach (['mocks' => '105-minute mocks', 'strategy' => 'Private pre-mock strategy', 'debrief' => 'Post-real-interview debriefs', 'day' => 'Private intensive day'] as $key => $label) {
        $h .= '<tr><th scope="row">' . $escape($label) . '</th>';
        foreach ($features as $feature) { $h .= '<td>' . $escape($feature[$key]) . '</td>'; }
        $h .= '</tr>';
    }
    $h .= '<tr><th scope="row">' . ($promo ? 'Tuition with MATCHREADY2026' : 'Standard tuition') . '</th>';
    foreach ($features as $sku => $feature) { $h .= '<td class="mm-coaching-table-price">' . $money($catalog[$sku][$promo ? 'promo' : 'regular']) . '</td>'; }
    $h .= '</tr>';
    if ($promo) {
        $h .= '<tr><th scope="row">Intended future standard price</th>';
        foreach ($features as $sku => $feature) { $h .= '<td>' . $money($catalog[$sku]['regular']) . '</td>'; }
        $h .= '</tr><tr><th scope="row">Your savings</th>';
        foreach ($features as $sku => $feature) { $h .= '<td>' . $money($catalog[$sku]['regular'] - $catalog[$sku]['promo']) . '</td>'; }
        $h .= '</tr>';
    }
    $h .= '<tr><th scope="row">Your next step</th>';
    foreach ($features as $sku => $feature) { $h .= '<td>' . mmed_staff_coaching_ui_cta($sku, $config, $feature['cta']) . '</td>'; }
    $h .= '</tr></tbody></table></div>';
    $h .= '<div class="mm-coaching-bottom"><div class="mm-coaching-questions"><p class="mm-alt-kicker">Not sure which path fits?</p><h3>Start with a conversation.</h3><p>Tell admissions your interview date, timezone and preferred preparation dates. For an intensive, use the subject “Emergency Interview Intensive request”.</p><a href="/contact/#form_contact-form">Ask admissions <span aria-hidden="true">→</span></a></div><div class="mm-coaching-terms"><h3>Clear terms before you enroll</h3><details><summary>Refunds and delivered services</summary><p>Request a refund for unused services within 14 days of verified payment, subject to applicable law. Only actually delivered services are deducted: $399 per 105-minute mock, $299 per two-hour strategy session, $149 per 45-minute debrief, and $1,799 per eight-hour intensive day. The mock included in the intensive day is never deducted separately.</p><p>A refund cannot exceed the amount actually paid, less prior refunds and delivered-service deductions, and cannot be negative. Unused or merely scheduled services are not deducted. Partial delivery and requests outside this window require staff review; statutory consumer rights are preserved. <a href="/refund-cancellation-policy/">Read the refund and cancellation policy</a>.</p></details><details><summary>Scheduling, rescheduling and payment</summary><p>Staff confirms actual appointment availability after verified payment. Existing 360 and Complete student appointments and priority are preserved. The strategy session in the Three and Five packages takes place before the first mock.</p><p>Reschedule without penalty with at least 24 hours’ notice. Less than 24 hours’ notice may forfeit the session; one documented-emergency courtesy exception is available. Card and accepted Zelle verification are supported. Pending or unverified Zelle payments receive no booking confirmation, Matrix or replay access, or protected meeting links. A coaching purchase does not grant automatic Matrix or replay access.</p></details><p class="mm-coaching-outcome-note">No interview or Match outcome is guaranteed.</p></div></div></div></section>';
    return $h;
}
