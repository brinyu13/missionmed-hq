<?php
/**
 * The prototype's own page and its File Vault entry point.
 *
 *  - Page: /?mmed_ps_proto=1. No rewrite rule, no flush, no post, no menu item.
 *    Anyone outside the allowlist gets the normal site response for that URL.
 *  - Entry: a small launcher shown to allowlisted users while File Vault is on
 *    screen. It is appended to <body>, outside File Vault's DOM, so File
 *    Vault's own observers and renderers never see it.
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class MMPS_Page {

	public static function init() {
		add_action( 'template_redirect', array( __CLASS__, 'maybe_render' ), 0 );
		add_action( 'wp_enqueue_scripts', array( __CLASS__, 'maybe_enqueue_entry' ), 99 );
	}

	public static function url() {
		return add_query_arg( MMPS_QUERY_VAR, '1', home_url( '/' ) );
	}

	protected static function asset( $file ) {
		$path = MMPS_PATH . 'assets/' . $file;
		return MMPS_URL . 'assets/' . $file . '?v=' . ( file_exists( $path ) ? substr( md5_file( $path ), 0, 12 ) : MMED_PSV_VERSION );
	}

	protected static function back_url() {
		return apply_filters( 'mmps_file_vault_url', home_url( '/member-dashboard/#filevault' ) );
	}

	/* ---------------- File Vault entry ---------------- */

	public static function maybe_enqueue_entry() {
		try {
			if ( ! MMPS_Gate::user_allowed() ) {
				return;
			}
			if ( ! class_exists( 'MMED_Hub_Page' ) || ! is_callable( array( 'MMED_Hub_Page', 'is_hub_page' ) ) || ! MMED_Hub_Page::is_hub_page() ) {
				return;
			}
			wp_enqueue_script( 'mmps-entry', self::asset( 'mmps-entry.js' ), array(), null, true );
			wp_add_inline_script( 'mmps-entry', 'window.mmpsEntry=' . wp_json_encode( array( 'url' => self::url() ) ) . ';', 'before' );
		} catch ( \Throwable $e ) {
			return; // The Hub page must never be affected by the prototype.
		}
	}

	/* ---------------- standalone page ---------------- */

	public static function maybe_render() {
		if ( ! isset( $_GET[ MMPS_QUERY_VAR ] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- read-only route switch.
			return;
		}
		if ( ! is_user_logged_in() || ! MMPS_Gate::user_allowed() ) {
			return; // Not disclosed: the site answers exactly as it would without the prototype.
		}
		MMPS_Install::maybe_install();

		$config = array(
			'restUrl'  => esc_url_raw( rest_url( MMPS_REST_NS ) ),
			'nonce'    => wp_create_nonce( 'wp_rest' ),
			'backUrl'  => self::back_url(),
			'riseUrl'  => home_url( '/rise/' ),
			'version'  => MMED_PSV_VERSION,
		);

		$asset_origin = wp_parse_url( MMPS_URL, PHP_URL_SCHEME ) . '://' . wp_parse_url( MMPS_URL, PHP_URL_HOST ) . ( wp_parse_url( MMPS_URL, PHP_URL_PORT ) ? ':' . wp_parse_url( MMPS_URL, PHP_URL_PORT ) : '' );
		$csp          = "default-src 'none'; script-src 'self' {$asset_origin}; style-src 'self' {$asset_origin}; img-src 'self' data:; font-src 'self' {$asset_origin}; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'";

		status_header( 200 );
		nocache_headers();
		header( 'Content-Type: text/html; charset=utf-8' );
		header( 'Cache-Control: no-store, private, max-age=0' );
		header( 'X-Robots-Tag: noindex, nofollow' );
		header( 'X-Content-Type-Options: nosniff' );
		header( 'Referrer-Policy: same-origin' );
		header( 'X-Frame-Options: SAMEORIGIN' );
		header( 'Content-Security-Policy: ' . $csp );
		if ( ! defined( 'DONOTCACHEPAGE' ) ) {
			define( 'DONOTCACHEPAGE', true );
		}
		?>
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Program-Specific PS · File Vault · MissionMed</title>
<link rel="stylesheet" href="<?php echo esc_url( self::asset( 'mmps-app.css' ) ); ?>">
</head>
<body>
<div class="aur a" aria-hidden="true"></div><div class="aur b" aria-hidden="true"></div>
<div id="mmps-app" class="app" data-state="loading">
	<div class="boot"><span class="bootMark">MissionMed</span><span class="bootLine">Opening Program-Specific PS…</span></div>
</div>
<noscript><p class="noscript">This page needs JavaScript.</p></noscript>
<script type="application/json" id="mmps-config"><?php echo wp_json_encode( $config, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT ); ?></script>
<script src="<?php echo esc_url( self::asset( 'mmps-app.js' ) ); ?>" defer></script>
</body>
</html>
		<?php
		exit;
	}
}
