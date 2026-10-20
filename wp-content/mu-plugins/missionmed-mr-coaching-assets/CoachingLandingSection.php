<?php
declare(strict_types=1);
namespace MissionMed\Residency\Coaching;
use DateTimeImmutable;
use DomainException;
if (!class_exists(CoachingOfferPolicy::class)) { require_once __DIR__ . '/CoachingOfferPolicy.php'; }

/**
 * Additive fragment only: echo render(...) once inside existing MR <main>, load
 * CoachingLandingSection.css after alternate.css. Do not replace the page/hero.
 * Read-only production component readback 2026-10-19:
 * page.php 1f97918da753f76100bc3db00d7be61a81c0480722eaf319ab3a5ca6d1c4d1b4
 * alternate.css d8ab47c3b716627a14cc04724c9d62f9030ee2ccaa92323f600786fd9fb3cd36
 * Historical donor CSS matches; historical page differs and is not live truth.
 * All release/link booleans are trusted server integration evidence, never form
 * inputs. Displaying prices cannot reserve a first-20 allocation or date.
 */
final class CoachingLandingSection
{
    public static function render(array $contract, array $release, DateTimeImmutable $now, ?CoachingOfferPolicy $policy = null): string
    {
        $policy ??= new CoachingOfferPolicy($contract);
        $ready = ($release['publication_enabled'] ?? false) === true
            && ($release['public_copy_approved'] ?? false) === true && $policy->readiness()['ready'];
        if (!$ready) { return ''; }
        $raw = $contract['coupon']['expires_at'] ?? null;
        $deadline = is_string($raw) ? DateTimeImmutable::createFromFormat('!Y-m-d\TH:i:sP', $raw) : false;
        $deadlineValid = $deadline !== false && $deadline->format('Y-m-d\TH:i:sP') === $raw;
        $promo = $ready && ($release['native_cap_enforcement_verified'] ?? false) === true
            && ($release['introductory_offer_currently_open'] ?? false) === true
            && $deadlineValid && $now < $deadline;
        $h = '<section id="private-coaching" class="mm-alt-enroll mm-coaching" aria-labelledby="private-coaching-title"><div class="mm-alt-enroll-inner">';
        $h .= '<header class="mm-coaching-intro"><p class="mm-alt-kicker mm-alt-center">Private residency interview coaching</p><h2 id="private-coaching-title">Your experience. Your answers.<br>Focused preparation with Dr Brian.</h2><p class="mm-alt-intro">Learn the methodology. Practice it privately. Improve the answers that matter.</p><p class="mm-coaching-complete"><a href="#complete">IV Prep Complete remains open</a> for the full-season pathway. Private coaching offers focused individual preparation.</p></header>';
        if ($promo) {
            $h .= '<p class="mm-coaching-offer"><strong>Introductory enrollment pricing</strong><br>Use <code>MATCHREADY2026</code> through <time datetime="2026-10-31T23:59:00-04:00">October 31, 2026, 11:59 PM America/New_York (EDT)</time>, or for the first 20 qualifying verified paid enrollments, whichever comes first. Eligibility is checked at checkout. One coupon per order; cannot combine with other offers, including Dr J offers.</p>';
        }
        $h .= '<div class="mm-alt-options mm-coaching-options">';
        foreach (['single', 'three', 'five'] as $sku) {
            $offer = self::offer($contract, $sku);
            $h .= '<article class="mm-alt-option" aria-labelledby="coaching-' . $sku . '-title"><p class="mm-alt-kicker">Private sessions with Dr Brian</p><h3 id="coaching-' . $sku . '-title">' . self::escape($offer['name']) . '</h3><ul>';
            $h .= '<li>' . $offer['mock_count'] . ' Signature Mock' . ($offer['mock_count'] === 1 ? '' : 's') . ': each combines a 15-minute realistic interview with 90 minutes of personal evaluation and reconstruction — 105 minutes total.</li>';
            if ($offer['strategy_minutes'] > 0) { $h .= '<li>One 120-minute private intake and strategy session before your first mock.</li>'; }
            if ($offer['post_interview_debrief_count'] > 0) { $h .= '<li>' . $offer['post_interview_debrief_count'] . ' post-real-interview debrief credits, 45 minutes each.</li>'; }
            $h .= '<li>' . $offer['total_live_minutes'] . ' total live minutes.</li></ul>' . self::price($offer, $promo);
            $h .= self::checkout($sku, $offer, $release['checkout'][$sku] ?? null, $ready, $policy, $now);
            $h .= '</article>';
        }
        $h .= '</div><p class="mm-alt-note mm-alt-center">Book only against actual availability in the existing Matrix Scheduler after verified payment. Existing student appointments retain priority. No interview or Match outcome is guaranteed.</p>';
        $intensive = self::offer($contract, 'emergency');
        $h .= '<article class="mm-coaching-emergency" aria-labelledby="coaching-emergency-title"><div><p class="mm-alt-kicker">Request first · No payment with a request</p><h3 id="coaching-emergency-title">Emergency Interview Intensive</h3><p>One 480-minute (8-hour) private training day, including one Signature Mock; two additional 105-minute follow-up mocks; and one 45-minute post-interview debrief. 255 follow-up minutes; 735 total live minutes.</p><details><summary>View the 8-hour training day</summary><ul>';
        foreach ($intensive['training_day_breakdown'] as $part) { $h .= '<li>' . self::escape($part['service']) . ' — ' . $part['minutes'] . ' minutes</li>'; }
        $h .= '</ul></details><p>Staff must verify an actual eight-hour date before any binding booking or payment invitation. A request does not reserve a date or promotional enrollment.</p></div><div>' . self::price($intensive, $promo);
        $request = $release['emergency_request'] ?? null;
        if (is_array($request) && ($request['verified_nonpayment_path'] ?? false) === true && self::path($request['url'] ?? null)) {
            $h .= '<a class="cl1403c-a-btn mm-alt-secondary" href="' . self::escape($request['url']) . '">Request an intensive date →</a>';
        } else { $h .= '<button class="cl1403c-a-btn mm-alt-secondary" type="button" disabled aria-describedby="coaching-request-status">Request availability through MissionMed</button>'; }
        $h .= '<p id="coaching-request-status" class="mm-alt-payment">On the contact form, use the subject “Emergency Interview Intensive request”. In Message, include preferred dates, your upcoming interview date, timezone and contact information. Provide scheduling details only; do not include application documents, bank details or health information. No checkout or payment is taken with a request.</p></div></article>';
        $h .= '<div class="mm-coaching-terms"><h3>Clear terms before you enroll</h3><details open><summary>Refund requests and delivered services</summary><p>For an unused-services refund request within 14 days of verified payment, only actually delivered services are deducted at the disclosed standalone rates below. The remaining refund cannot exceed the actual amount paid less genuine prior refunds and delivered-service deductions, and cannot be negative. Scheduled or unused services and unused bonus access are not deducted.</p><ul>';
        foreach (['signature_mock' => 'Completed Signature Mock (105 minutes)', 'private_strategy' => 'Completed private strategy session (120 minutes)', 'post_interview_debrief' => 'Completed debrief (45 minutes)', 'intensive_training_day' => 'Completed intensive day (480 minutes, including its mock)'] as $key => $label) {
            $rate = $contract['refund']['standalone_rates_cents'][$key] ?? null;
            $h .= '<li>' . $label . ': ' . (is_int($rate) ? self::money($rate) : 'Rate requires confirmation before enrollment') . '.</li>';
        }
        $h .= '</ul><p>The mock included in the intensive day is never deducted separately from that day. Partial delivery and requests outside the standard window require staff review; statutory consumer rights are preserved. <a href="/refund-cancellation-policy/">Read the refund and cancellation policy</a>.</p></details><details><summary>Rescheduling and payment</summary><p>Reschedule without penalty with at least 24 hours’ notice. Shorter notice may forfeit the session; one documented-emergency courtesy exception is available. Card and Zelle are the supported payment choices. Unverified Zelle does not unlock booking or service access. Applicable totals and any separately disclosed fees are shown before payment.</p></details></div></div></section>';
        return $h;
    }

    private static function checkout(string $sku, array $offer, $link, bool $ready, CoachingOfferPolicy $policy, DateTimeImmutable $now): string
    {
        if ($ready && is_array($link) && ($link['verified'] ?? false) === true && self::path($link['url'] ?? null)) {
            try {
                $quote = $policy->quote([['sku' => $sku, 'product_id' => $link['product_id'] ?? null, 'quantity' => 1]], 'stripe', [], 0, $now);
                if ($quote['subtotal_cents'] === $offer['regular_cents']) {
                    return '<a class="cl1403c-a-btn" href="' . self::escape($link['url']) . '">Choose ' . self::escape($offer['name']) . ' →</a><p class="mm-alt-payment">Review the actual total and terms before payment.</p>';
                }
            } catch (DomainException $e) { /* Unmapped or disabled release stays inert. */ }
        }
        return '<button class="cl1403c-a-btn" type="button" disabled>Enrollment currently unavailable</button>';
    }

    private static function price(array $offer, bool $promo): string
    {
        return $promo
            ? '<p class="mm-alt-price">' . self::money($offer['promotional_cents']) . '</p><p class="mm-alt-payment">Introductory tuition with MATCHREADY2026.<br>Future standard tuition: ' . self::money($offer['regular_cents']) . '.</p>'
            : '<p class="mm-alt-price">' . self::money($offer['regular_cents']) . '</p><p class="mm-alt-payment">Standard tuition.</p>';
    }

    private static function offer(array $contract, string $sku): array
    {
        $offer = $contract['offers'][$sku] ?? null;
        if (!is_array($offer) || !is_string($offer['name'] ?? null) || !is_int($offer['regular_cents'] ?? null) || !is_int($offer['promotional_cents'] ?? null) || !is_int($offer['discount_cents'] ?? null) || $offer['regular_cents'] < 0 || $offer['promotional_cents'] < 0 || $offer['regular_cents'] - $offer['discount_cents'] !== $offer['promotional_cents']) { throw new DomainException('approved_offer_missing_or_invalid'); }
        return $offer;
    }
    private static function money(int $cents): string { return '$' . number_format(intdiv($cents, 100), 0, '.', ',') . ($cents % 100 ? '.' . str_pad((string) ($cents % 100), 2, '0', STR_PAD_LEFT) : ''); }
    private static function path($url): bool { return is_string($url) && preg_match('~^/(?!/)[^\s<>"\x00-\x1f]*$~D', $url) === 1 && !str_contains($url, '\\'); }
    private static function escape(string $text): string { return htmlspecialchars($text, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }
}
