<?php
define( 'DB_NAME', 'wordpress' );
define( 'DB_USER', '' );
define( 'DB_PASSWORD', '' );
define( 'DB_HOST', 'localhost' );
define( 'DB_CHARSET', 'utf8mb4' );
define( 'DB_COLLATE', '' );

define( 'AUTH_KEY',         'mmps-local-auth-key' );
define( 'SECURE_AUTH_KEY',  'mmps-local-secure-auth-key' );
define( 'LOGGED_IN_KEY',    'mmps-local-logged-in-key' );
define( 'NONCE_KEY',        'mmps-local-nonce-key' );
define( 'AUTH_SALT',        'mmps-local-auth-salt' );
define( 'SECURE_AUTH_SALT', 'mmps-local-secure-auth-salt' );
define( 'LOGGED_IN_SALT',   'mmps-local-logged-in-salt' );
define( 'NONCE_SALT',       'mmps-local-nonce-salt' );

$table_prefix = 'wp_';
$harness_root = getenv( 'MMPS_HARNESS_ROOT' ) ?: '/home/claude/wpdev';
define( 'DB_DIR', $harness_root . '/site/wp-content/database' );
define( 'DB_FILE', 'test.sqlite' );
define( 'WP_HOME', 'http://127.0.0.1:8088' );
define( 'WP_SITEURL', 'http://127.0.0.1:8088' );
define( 'WP_DEBUG', true );
define( 'WP_DEBUG_LOG', true );
define( 'WP_DEBUG_DISPLAY', false );
define( 'MMED_RISE_ORIGIN', 'http://127.0.0.1:4011' );
define( 'MMED_PS_PROTO_TESTING', true );
define( 'MMED_PS_PROTO_TEST_RISE_ORIGIN', 'http://127.0.0.1:4011' );
define( 'MMED_PS_PROTO_TEST_OPENAI_BASE', 'http://127.0.0.1:4012' );
if ( is_readable( $harness_root . '/site/harness-flags.php' ) ) {
	require $harness_root . '/site/harness-flags.php';
}

if ( ! defined( 'ABSPATH' ) ) {
	define( 'ABSPATH', __DIR__ . '/' );
}
require_once ABSPATH . 'wp-settings.php';
