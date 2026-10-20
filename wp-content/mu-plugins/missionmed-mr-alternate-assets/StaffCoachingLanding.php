<?php
/** Additive Mission Residency fragment; load CSS after the existing page CSS. */
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

function mmed_staff_coaching_ui_price(array $offer, bool $promo): string
{
    $money = static function (int $cents): string {
        return '$' . number_format($cents / 100, $cents % 100 === 0 ? 0 : 2, '.', ',');
    };
    if ($promo) {
        return '<p class="mm-alt-price">' . $money($offer['promo']) . '</p><p class="mm-alt-payment">With code <strong>MATCHREADY2026</strong>.<br>Intended future standard price: ' . $money($offer['regular']) . '.</p>';
    }
    return '<p class="mm-alt-price">' . $money($offer['regular']) . '</p><p class="mm-alt-payment">Standard price. Review the actual total before payment.</p>';
}

/** Place once inside the MR page only; does not alter or replace its hero. */
function mmed_staff_coaching_announcement(): string
{
    if (!mmed_staff_coaching_ui_enabled()) { return ''; }
    return '<aside class="mm-staff-coaching-announcement" aria-label="Private interview coaching"><div><p><strong>Private residency interview coaching</strong><span>Focused individual preparation with Dr Brian.</span></p><a href="#private-coaching">Explore private coaching <span aria-hidden="true">→</span></a></div></aside>';
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
            || !is_int($offer['promo'] ?? null) || $offer['regular'] <= 0 || $offer['promo'] <= 0) {
            return '';
        }
    }
    $promo = mmed_staff_coaching_ui_promo_open();
    $escape = 'mmed_staff_coaching_ui_escape';
    $h = '<section id="private-coaching" class="mm-alt-enroll mm-coaching" aria-labelledby="private-coaching-title"><div class="mm-alt-enroll-inner">';
    $h .= '<header class="mm-coaching-intro"><p class="mm-alt-kicker">Private residency interview coaching</p><h2 id="private-coaching-title">Your experience. Your answers.<br>Focused preparation with Dr Brian.</h2><p>Build confidence in the interview with individual practice, personal feedback and a plan for your next conversation.</p></header>';
    if ($promo) {
        $h .= '<p class="mm-coaching-offer"><strong>October introductory pricing</strong><br>Use <code>MATCHREADY2026</code> through <time datetime="2026-10-31T23:59:00-04:00">October 31, 2026 at 11:59 PM America/New_York (EDT)</time>. Limited to these private-coaching offers; cannot be combined with other coupons. Listed standard prices are intended future prices.</p>';
    }
    $h .= '<div class="mm-coaching-status"><strong>Staff-assisted booking</strong><p>After verified payment, staff confirms actual available appointments and helps schedule your purchased services. Purchase does not reserve an immediate appointment. Existing 360 and Complete student appointments and priority are preserved.</p><p>Pending or unverified Zelle payments receive no booking confirmation, Matrix or replay access, or protected meeting links. Private-coaching purchase does not include automatic Matrix or replay access.</p></div>';
    $h .= '<div class="mm-alt-options mm-coaching-options">';
    foreach (['single', 'three', 'five'] as $sku) {
        $offer = $catalog[$sku];
        $h .= '<article class="mm-alt-option" aria-labelledby="staff-coaching-' . $sku . '"><p class="mm-alt-kicker">Private sessions with Dr Brian</p><h3 id="staff-coaching-' . $sku . '">' . $escape($offer['name']) . '</h3><p class="mm-coaching-services">' . $escape($offer['services']) . '</p>';
        $h .= mmed_staff_coaching_ui_price($offer, $promo);
        $productId = $config['product_ids'][$sku] ?? 0;
        $url = '';
        if (is_int($productId) && $productId > 0 && function_exists('mmed_staff_coaching_ready')
            && mmed_staff_coaching_ready($sku) && function_exists('get_permalink')) {
            $candidateUrl = get_permalink($productId);
            if (is_string($candidateUrl) && $candidateUrl !== '') { $url = $candidateUrl; }
        }
        if ($url !== '') {
            $h .= '<a class="cl1403c-a-btn" href="' . $escape($url) . '">Choose ' . $escape($offer['name']) . ' <span aria-hidden="true">→</span></a>';
        } else {
            $h .= '<p class="mm-coaching-unavailable">Online enrollment is currently unavailable. <a href="/contact/#form_contact-form">Contact admissions</a>.</p>';
        }
        $h .= '<p class="mm-alt-payment mm-coaching-booking-note">Staff confirms appointment availability after verified payment. Review services, total and terms before paying.</p></article>';
    }
    $h .= '</div><p class="mm-alt-note mm-alt-center">Every mock is 105 minutes: a 15-minute interview followed by 90 minutes of individual coaching. No interview or Match outcome is guaranteed.</p>';
    $emergency = $catalog['emergency'];
    $h .= '<article class="mm-coaching-emergency" aria-labelledby="staff-coaching-emergency"><div><p class="mm-alt-kicker">Request first</p><h3 id="staff-coaching-emergency">' . $escape($emergency['name']) . '</h3><p>' . $escape($emergency['services']) . '</p><p>Staff must confirm an actual eight-hour date before any binding commitment or nonrefundable charge. A request does not reserve a date or promotional price.</p></div><div>';
    $h .= mmed_staff_coaching_ui_price($emergency, $promo);
    $h .= '<a class="cl1403c-a-btn" href="/contact/#form_contact-form">Request an intensive date <span aria-hidden="true">→</span></a><p class="mm-alt-payment">Use the subject “Emergency Interview Intensive request”. Include preferred dates, your interview date and timezone. No payment is taken with this request.</p></div></article>';
    $h .= '<div class="mm-coaching-terms"><h3>Clear terms before you enroll</h3><details open><summary>Refunds and delivered services</summary><p>Request a refund for unused services within 14 days of verified payment, subject to applicable law. Actually delivered services are deducted at these disclosed standalone rates: $399 per 105-minute mock, $299 per two-hour strategy session, $149 per 45-minute debrief, and $1,799 per eight-hour intensive day. The mock included in the intensive day is never deducted separately.</p><p>A refund cannot exceed the amount actually paid, less prior refunds and delivered-service deductions, and cannot be negative. Unused or merely scheduled services are not deducted. Partial delivery and requests outside this window require staff review; statutory consumer rights are preserved. <a href="/refund-cancellation-policy/">Read the refund and cancellation policy</a>.</p></details><details><summary>Rescheduling and payment</summary><p>Reschedule without penalty with at least 24 hours’ notice. Less than 24 hours’ notice may forfeit the session; one documented-emergency courtesy exception is available. Card and accepted Zelle verification are supported. Staff confirms booking only after verified payment.</p></details><p class="mm-alt-note">Questions before purchase? <a href="/contact/#form_contact-form">Contact admissions</a>.</p></div></div></section>';
    return $h;
}
