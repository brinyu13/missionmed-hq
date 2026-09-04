<?php
eval('namespace LearnDash\\Core\\Models; class Product { public static function find($course_id) { return new \\MR0904BMockCourseProduct(); } }');

define('ABSPATH', '/');

$GLOBALS['mr0904b_orders'] = [];
$GLOBALS['mr0904b_related_course'] = [5865 => [5227], 5867 => [3646]];
$GLOBALS['mr0904b_access'] = [];
$GLOBALS['mr0904b_user_meta'] = [];
$GLOBALS['mr0904b_current_filter'] = 'woocommerce_order_status_processing';

class MR0904BMockCourseProduct {
    public function get_start_date($user_id) { return null; }
    public function get_setting($key) { return $key === 'expire_access_days' ? 0 : ''; }
}

class MR0904BMockDate {
    public function date($format) { return '2026-09-04 09:30:00'; }
}

class WC_Order_Item_Product implements \ArrayAccess {
    private int $product_id;
    private int $variation_id;
    public function __construct(int $product_id, int $variation_id) {
        $this->product_id = $product_id;
        $this->variation_id = $variation_id;
    }
    public function get_product_id(): int { return $this->product_id; }
    public function get_variation_id(): int { return $this->variation_id; }
    public function offsetExists($offset): bool { return in_array($offset, ['product_id', 'variation_id'], true); }
    public function offsetGet($offset): mixed { return $offset === 'variation_id' ? $this->variation_id : $this->product_id; }
    public function offsetSet($offset, $value): void {}
    public function offsetUnset($offset): void {}
}

class WC_Order_Refund {
    private array $items;
    public function __construct(array $items) { $this->items = $items; }
    public function get_items(): array { return $this->items; }
}

class WC_Order {
    private int $id;
    private int $user_id;
    private array $items;
    private string $status;
    private array $refunds = [];
    public function __construct(int $id, int $user_id, array $items, string $status = 'processing') {
        $this->id = $id;
        $this->user_id = $user_id;
        $this->items = $items;
        $this->status = $status;
    }
    public function get_id(): int { return $this->id; }
    public function get_user_id(): int { return $this->user_id; }
    public function get_items($type = null): array { return $this->items; }
    public function get_status(): string { return $this->status; }
    public function set_status(string $status): void { $this->status = $status; }
    public function get_refunds(): array { return $this->refunds; }
    public function set_refunds(array $refunds): void { $this->refunds = $refunds; }
    public function get_date_paid(): MR0904BMockDate { return new MR0904BMockDate(); }
}

class MR0904BMockCartProduct {
    private int $id;
    public function __construct(int $id) { $this->id = $id; }
    public function get_id(): int { return $this->id; }
}

class WC_Cart {
    public array $cart_contents;
    public function __construct(int $variation_id) {
        $this->cart_contents = [['data' => new MR0904BMockCartProduct($variation_id)]];
    }
}

function WC() {
    static $wc;
    if (!$wc) {
        $wc = (object) ['cart' => new WC_Cart(5865)];
    }
    return $wc;
}

function wc_get_order($order_id) { return $GLOBALS['mr0904b_orders'][(int) $order_id] ?? false; }
function get_user_by($field, $user_id) { return (int) $user_id > 0 ? (object) ['ID' => (int) $user_id] : false; }
function get_post_meta($id, $key, $single = false) {
    if ($key === '_related_course') return $GLOBALS['mr0904b_related_course'][(int) $id] ?? [];
    if ($key === '_related_group') return [];
    return '';
}
function get_post($id) {
    if (in_array((int) $id, [5227, 3646], true)) return (object) ['post_status' => 'publish', 'post_type' => 'sfwd-courses'];
    return null;
}
function get_user_meta($user_id, $key, $single = false) {
    return $GLOBALS['mr0904b_user_meta'][(int) $user_id][$key] ?? '';
}
function update_user_meta($user_id, $key, $value) {
    $GLOBALS['mr0904b_user_meta'][(int) $user_id][$key] = $value;
    return true;
}
function maybe_unserialize($value) { return $value; }
function learndash_user_get_enrolled_courses($user_id): array {
    return array_values(array_map('intval', array_keys(array_filter($GLOBALS['mr0904b_access'][(int) $user_id] ?? []))));
}
function ld_update_course_access($user_id, $course_id, $remove = false) {
    $GLOBALS['mr0904b_access'][(int) $user_id][(int) $course_id] = !$remove;
}
function ld_course_access_expired($course_id, $user_id): bool { return false; }
function ld_course_access_from_update($course_id, $user_id, $order_time): bool { return true; }
function apply_filters($hook, $value, ...$args) { return $value; }
function current_filter(): string { return $GLOBALS['mr0904b_current_filter']; }
function is_user_logged_in(): bool { return false; }
function do_action($hook, ...$args): void {}
function absint($value): int { return abs((int) $value); }
?>
