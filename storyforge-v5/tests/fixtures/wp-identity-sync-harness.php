<?php
/**
 * Minimal WordPress/WP-CLI harness that executes the real operator export path
 * in scripts/wp-storyforge-identity-sync.php against fixture accounts.
 *
 * Fixtures arrive as JSON on argv[1]; the resulting snapshot is printed as JSON.
 * Nothing here talks to WordPress, LearnDash, WooCommerce or Postgres.
 */

define('ABSPATH', __DIR__);
define('WP_CLI', true);

$fixtures = json_decode(file_get_contents($argv[1]), true);
if (!is_array($fixtures)) {
    fwrite(STDERR, "invalid fixtures\n");
    exit(2);
}

class WP_User {
    public $ID;
    public $user_login;
    public $user_email;
    public $display_name;
    public function __construct($row) {
        $this->ID = (int) $row['id'];
        $this->user_login = (string) $row['username'];
        $this->user_email = (string) ($row['email'] ?? ($row['username'] . '@example.test'));
        $this->display_name = (string) ($row['display_name'] ?? $row['username']);
    }
    public function exists() { return true; }
}

class WP_CLI {
    public static function log($message) { fwrite(STDOUT, $message . "\n"); }
    public static function error($message) {
        fwrite(STDERR, 'WP_CLI::error ' . $message . "\n");
        exit(3);
    }
}

$GLOBALS['fixture_users'] = array();
$GLOBALS['fixture_meta'] = array();
foreach ($fixtures['users'] as $row) {
    $GLOBALS['fixture_users'][(int) $row['id']] = $row;
    $GLOBALS['fixture_meta'][(int) $row['id']] = isset($row['meta']) && is_array($row['meta'])
        ? $row['meta']
        : array();
}

function sanitize_key($value) { return preg_replace('/[^a-z0-9_\-]/', '', strtolower((string) $value)); }
function absint($value) { return abs((int) $value); }
function trailingslashit($value) { return rtrim((string) $value, '/') . '/'; }
function wp_json_encode($value, $flags = 0) { return json_encode($value, $flags); }
function wp_generate_uuid4() { return '3f2504e0-4f89-41d3-9a0c-0305e82c3301'; }

function get_user_meta($user_id, $key, $single = false) {
    $meta = $GLOBALS['fixture_meta'][(int) $user_id] ?? array();
    return array_key_exists($key, $meta) ? $meta[$key] : '';
}

function metadata_exists($type, $object_id, $key) {
    $meta = $GLOBALS['fixture_meta'][(int) $object_id] ?? array();
    return array_key_exists($key, $meta);
}

function get_users($args = array()) {
    $users = array();
    foreach ($GLOBALS['fixture_users'] as $row) {
        $users[] = new WP_User($row);
    }
    return $users;
}

function get_user_by($field, $value) {
    $row = $GLOBALS['fixture_users'][(int) $value] ?? null;
    return $row ? new WP_User($row) : false;
}

function mmsf_native_role_for_user($user) {
    $row = $GLOBALS['fixture_users'][(int) $user->ID] ?? array();
    return (string) ($row['native_role'] ?? 'student');
}

function mmsf_entitlement_for_user($user) {
    $row = $GLOBALS['fixture_users'][(int) $user->ID] ?? array();
    return is_array($row['entitlement'] ?? null) ? $row['entitlement'] : array();
}

$args = array('export', $fixtures['path']);
require dirname(__DIR__, 2) . '/scripts/wp-storyforge-identity-sync.php';
