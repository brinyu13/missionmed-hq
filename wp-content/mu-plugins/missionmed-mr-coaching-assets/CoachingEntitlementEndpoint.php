<?php
declare(strict_types=1);
defined('ABSPATH') || exit;

/** Existing app-password principal only. Cookies/nonces/customer-supplied proof
 * cannot authorize this read. The allocator supplies canonical paid evidence;
 * absent that server-only integration, no allowance is published.
 */
final class CoachingEntitlementEndpoint
{
    public static function permission()
    {
        $config = mmed_mr_coaching_config();
        $principal = $config['scheduler_read_wp_user_id'] ?? null;
        if (!is_int($principal) || $principal <= 0 || get_current_user_id() !== $principal
            || !current_user_can('manage_woocommerce') || !function_exists('rest_get_authenticated_app_password')
            || !is_string(rest_get_authenticated_app_password()) || rest_get_authenticated_app_password() === '') {
            return new WP_Error('coaching_server_auth_required', 'Coaching access could not be verified.', ['status' => 403]);
        }
        return true;
    }

    public static function read($request)
    {
        $denied = static fn() => new WP_Error('coaching_allowances_unavailable', 'Coaching access could not be verified.', ['status' => 503]);
        if (self::permission() !== true || strlen((string) $request->get_body()) > 1024) { return $denied(); }
        $data = $request->get_json_params();
        if (!is_array($data) || count($data) !== 3 || !is_int($data['subject_wp_user_id'] ?? null) || $data['subject_wp_user_id'] <= 0
            || !is_string($data['request_id'] ?? null) || !preg_match('/^[a-f0-9]{48}$/D', $data['request_id'])
            || !is_string($data['subject_user_id'] ?? null) || !preg_match('/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/iD', $data['subject_user_id'])
            || !function_exists('mmed_mr_coaching_hybrid_allowance_authority')) { return $denied(); }
        try {
            $owner = $data['subject_wp_user_id']; $packages = []; $seen = []; $expectedTotal = null; $expectedPages = null;
            $projection = new CoachingAllowanceProjection(mmed_mr_coaching_config()['product_ids'] ?? []);
            $checked = mmed_mr_coaching_now();
            for ($page = 1; $page <= 21; ++$page) {
                // Complete bounded pagination, never pretend first20 orders is all.
                $result = wc_get_orders(['customer_id' => $owner, 'limit' => 50, 'page' => $page,
                    'paginate' => true, 'orderby' => 'ID', 'order' => 'ASC', 'return' => 'objects']);
                if (!is_object($result) || !is_array($result->orders ?? null)) { return $denied(); }
                foreach (['total', 'max_num_pages'] as $key) {
                    $v = $result->$key ?? null;
                    if (!(is_int($v) || (is_string($v) && preg_match('/^(0|[1-9][0-9]{0,3})$/D', $v)))
                        || (int) $v < 0) { return $denied(); }
                }
                $total = (int) $result->total; $pages = (int) $result->max_num_pages;
                if ($total > 1000 || $pages !== (int) ceil($total / 50)
                    || count($result->orders) !== min(50, max(0, $total - ($page - 1) * 50))
                    || ($expectedTotal !== null && ($total !== $expectedTotal || $pages !== $expectedPages))) { return $denied(); }
                $expectedTotal = $total; $expectedPages = $pages;
                foreach ($result->orders as $order) {
                    $id = (int) $order->get_id();
                    if ($id <= 0 || isset($seen[$id]) || (int) $order->get_customer_id() !== $owner) { return $denied(); }
                    $seen[$id] = true;
                    $snapshot = mmed_mr_coaching_order_snapshot($order, false);
                    if (!$snapshot) { continue; }
                    $authority = mmed_mr_coaching_hybrid_allowance_authority($order);
                    if ($authority === null) { continue; } // Explicitly ineligible; no rights emitted.
                    if (!is_array($authority) || !is_array($authority['evidence'] ?? null)
                        || !is_array($authority['eligible_unit_ids'] ?? null)
                        || !is_int($authority['eligibility_revision'] ?? null) || $authority['eligibility_revision'] <= 0
                        || $authority['eligibility_revision'] > 9007199254740991) { return $denied(); }
                    $p = $projection->project($snapshot, $authority['evidence'], new DateTimeImmutable('@' . $checked));
                    if ($authority['eligible_unit_ids'] !== $p['eligible_unit_ids'] || $authority['eligibility_revision'] !== $p['eligibility_revision']) { return $denied(); }
                    $packages[] = ['order_id' => $id, 'order_item_id' => $authority['evidence']['order_item_id'],
                        'product_id' => $authority['evidence']['product_id'], 'sku' => $snapshot['sku'],
                        'snapshot_digest' => $p['snapshot_digest'], 'eligibility_revision' => $authority['eligibility_revision'], 'units' => $p['units'], 'eligible_unit_ids'=>$p['eligible_unit_ids']];
                    if (count($packages) > 100) { return $denied(); }
                }
                if ($page >= (int) $result->max_num_pages) { break; }
            }
            // A long/uncertain read is not a fresh financial assertion.
            $finished = mmed_mr_coaching_now();
            if (count($seen) !== $expectedTotal || $checked <= 0 || $finished < $checked || $finished - $checked > 5) { return $denied(); }
            return new WP_REST_Response(['schema' => 'missionmed.coaching.allowances.v1', 'request_id' => $data['request_id'],
                'subject_wp_user_id' => $owner, 'subject_user_id' => $data['subject_user_id'], 'checked_at' => $checked,
                'valid_until' => $checked + 15, 'complete' => true, 'packages' => $packages], 200,
                ['Cache-Control' => 'no-store, private, max-age=0', 'Pragma' => 'no-cache']);
        } catch (Throwable $e) { return $denied(); }
    }

    public static function register(): void
    {
        register_rest_route('mmed-coaching/v1', '/allowances', ['methods' => 'POST',
            'permission_callback' => [self::class, 'permission'], 'callback' => [self::class, 'read']]);
    }
}
