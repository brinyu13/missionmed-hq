<?php
/**
 * Matrix-native WooCommerce My Account entry portal.
 *
 * @package MissionMed
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

add_action( 'wp_enqueue_scripts', 'mmed_matrix_account_entry_enqueue', 40 );
add_filter( 'body_class', 'mmed_matrix_account_entry_body_class' );
add_filter( 'woocommerce_account_menu_items', 'mmed_matrix_account_entry_prune_menu_items', 80 );
add_filter( 'woocommerce_get_endpoint_url', 'mmed_matrix_account_entry_custom_menu_urls', 80, 4 );
add_action( 'woocommerce_account_dashboard', 'mmed_matrix_account_entry_render', 4 );
add_action( 'plugins_loaded', 'mmed_matrix_account_entry_bootstrap_learndash_reskin', 30 );

/**
 * Remove low-value account menu links while keeping the endpoints available.
 *
 * @param array<string,string> $items Account menu items keyed by endpoint.
 * @return array<string,string>
 */
function mmed_matrix_account_entry_prune_menu_items( $items ) {
	if ( ! is_array( $items ) ) {
		return $items;
	}

	foreach ( array( 'dashboard', 'downloads', 'edit-address', 'payment-methods' ) as $endpoint ) {
		unset( $items[ $endpoint ] );
	}

	return array_merge(
		array(
			'med-matrix-dashboard' => __( 'Med Matrix Dashboard', 'missionmed' ),
			'access-arena'         => __( 'Access Arena', 'missionmed' ),
		),
		$items
	);
}

/**
 * Point custom My Account menu links to their canonical app destinations.
 *
 * @param string $url Account endpoint URL.
 * @param string $endpoint Account endpoint key.
 * @param string $value Endpoint value.
 * @param string $permalink Account permalink.
 * @return string
 */
function mmed_matrix_account_entry_custom_menu_urls( $url, $endpoint, $value, $permalink ) {
	unset( $value, $permalink );

	if ( 'med-matrix-dashboard' === $endpoint ) {
		return home_url( '/member-dashboard/#dashboard' );
	}

	if ( 'access-arena' === $endpoint ) {
		return home_url( '/arena' );
	}

	return $url;
}

/**
 * Determine whether the current request is the logged-in My Account dashboard.
 *
 * @return bool
 */
function mmed_matrix_account_entry_is_dashboard() {
	if ( ! function_exists( 'is_account_page' ) || ! is_account_page() || ! is_user_logged_in() ) {
		return false;
	}

	return ! function_exists( 'is_wc_endpoint_url' ) || ! is_wc_endpoint_url();
}

/**
 * Bootstrap the scoped MissionMed LearnDash reskin controller if the hub has
 * not already loaded it. This keeps the Phase 0 launch hooks code-based and
 * avoids DB/template edits.
 *
 * @return void
 */
function mmed_matrix_account_entry_bootstrap_learndash_reskin() {
	if ( ! class_exists( 'MMED_LearnDash_Reskin' ) ) {
		$reskin_file = WP_PLUGIN_DIR . '/missionmed-hub/includes/class-mmed-learndash-reskin.php';
		if ( ! file_exists( $reskin_file ) ) {
			return;
		}

		require_once $reskin_file;
	}

	if ( class_exists( 'MMED_LearnDash_Reskin' ) && ! has_action( 'wp_enqueue_scripts', array( 'MMED_LearnDash_Reskin', 'enqueue_assets' ) ) ) {
		MMED_LearnDash_Reskin::init();
	}
}

/**
 * Add a scoped body class for the dashboard-only visual treatment.
 *
 * @param array $classes Body classes.
 * @return array
 */
function mmed_matrix_account_entry_body_class( $classes ) {
	if ( mmed_matrix_account_entry_is_dashboard() ) {
		$classes[] = 'mmed-matrix-account-dashboard';
	}

	return $classes;
}

/**
 * Enqueue dashboard-only inline CSS without touching global Astra/Woo styles.
 *
 * @return void
 */
function mmed_matrix_account_entry_enqueue() {
	if ( ! mmed_matrix_account_entry_is_dashboard() ) {
		return;
	}

	wp_register_style( 'mmed-matrix-account-entry', false, array(), '20260528' );
	wp_enqueue_style( 'mmed-matrix-account-entry' );
	wp_add_inline_style( 'mmed-matrix-account-entry', mmed_matrix_account_entry_css() );
}

/**
 * Render the Matrix portal card inside the WooCommerce dashboard endpoint.
 *
 * @return void
 */
function mmed_matrix_account_entry_render() {
	if ( ! mmed_matrix_account_entry_is_dashboard() ) {
		return;
	}

	$dashboard_url = home_url( '/member-dashboard/#dashboard' );
	?>
	<section class="mmed-matrix-account-entry" aria-label="<?php esc_attr_e( 'MissionMed Matrix Dashboard entry', 'missionmed' ); ?>">
		<div class="mmed-matrix-account-entry__shell">
			<div class="mmed-matrix-account-entry__signal" aria-hidden="true"></div>
			<p class="mmed-matrix-account-entry__eyebrow"><?php esc_html_e( 'MissionMed Matrix', 'missionmed' ); ?></p>
			<h2><?php esc_html_e( 'Enter Your MissionMed Matrix Dashboard', 'missionmed' ); ?></h2>
			<p class="mmed-matrix-account-entry__copy"><?php esc_html_e( 'Your courses, calendar, messages, files, and live-session links live inside Matrix.', 'missionmed' ); ?></p>
			<a class="mmed-matrix-account-entry__cta" href="<?php echo esc_url( $dashboard_url ); ?>">
				<?php esc_html_e( 'Open Matrix Dashboard', 'missionmed' ); ?>
			</a>
		</div>
	</section>
	<?php
}

/**
 * Return scoped account dashboard CSS.
 *
 * @return string
 */
function mmed_matrix_account_entry_css() {
	return <<<'CSS'
body.mmed-matrix-account-dashboard {
	position: relative;
	isolation: isolate;
	background: #020712;
	color: #eef6ff;
}

body.mmed-matrix-account-dashboard::before {
	content: "";
	position: fixed;
	inset: 0;
	z-index: 0;
	pointer-events: none;
	background-image:
		linear-gradient(90deg, rgba(2, 7, 18, 0.96) 0%, rgba(7, 16, 29, 0.78) 46%, rgba(2, 7, 18, 0.94) 100%),
		url('https://missionmedinstitute.com/wp-content/uploads/2026/04/realresults.realredemption.real_.residency1.webp');
	background-attachment: fixed;
	background-position: center 34%;
	background-size: cover;
	transform: scale(1.02);
}

body.mmed-matrix-account-dashboard::after {
	content: "";
	position: fixed;
	inset: 0;
	z-index: 0;
	pointer-events: none;
	background-image:
		linear-gradient(rgba(255, 255, 255, 0.035) 1px, transparent 1px),
		linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
	background-size: 56px 56px;
	mask-image: linear-gradient(180deg, transparent 0%, #000 18%, #000 78%, transparent 100%);
	opacity: 0.34;
}

body.mmed-matrix-account-dashboard #page {
	position: relative;
	z-index: 1;
	background: transparent;
}

body.mmed-matrix-account-dashboard .site-below-footer-wrap {
	background: #040f1a !important;
	border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.mmed-matrix-account-dashboard .site-content,
.mmed-matrix-account-dashboard .ast-container,
.mmed-matrix-account-dashboard .entry-content {
	background: transparent !important;
	color: #eef6ff;
}

.mmed-matrix-account-dashboard .site-content {
	position: relative;
	overflow: hidden;
}

	.mmed-matrix-account-dashboard .ast-container {
		max-width: none;
		padding: 0;
	}

.mmed-matrix-account-dashboard .woocommerce {
	position: relative;
	display: grid;
		grid-template-columns: 252px minmax(0, 1fr);
		gap: 0;
		width: 100%;
		min-height: calc(100vh - 122px);
		margin: 0;
		padding: 0;
		overflow: hidden;
		border: 0;
		border-radius: 0;
		background:
			linear-gradient(135deg, rgba(41, 116, 156, 0.7), rgba(6, 23, 39, 0.96) 58%, rgba(2, 7, 18, 0.98)),
			#061727;
		box-shadow: none;
		backdrop-filter: none;
		-webkit-backdrop-filter: none;
	color: #eef6ff;
}

.mmed-matrix-account-dashboard .woocommerce::before {
	content: "";
	position: absolute;
	inset: 0;
		pointer-events: none;
		background:
			linear-gradient(90deg, rgba(5, 12, 22, 0.96) 0, rgba(5, 12, 22, 0.96) 252px, rgba(18, 77, 110, 0.5) 253px, transparent 58%),
			linear-gradient(180deg, rgba(255, 255, 255, 0.07), transparent 22%, rgba(2, 7, 18, 0.22) 100%);
		opacity: 1;
	}

	.mmed-matrix-account-dashboard .woocommerce::after {
		content: "";
		position: absolute;
		inset: 0;
		background-image:
			linear-gradient(rgba(255, 255, 255, 0.035) 1px, transparent 1px),
			linear-gradient(90deg, rgba(255, 255, 255, 0.028) 1px, transparent 1px);
		background-size: 48px 48px;
		mask-image: linear-gradient(90deg, transparent 0, transparent 252px, #000 253px, #000 100%);
		opacity: 0.3;
		pointer-events: none;
	}

.mmed-matrix-account-dashboard .woocommerce-MyAccount-navigation,
.mmed-matrix-account-dashboard .woocommerce-MyAccount-content {
	position: relative;
	z-index: 1;
	float: none !important;
	width: auto !important;
}

	.mmed-matrix-account-dashboard .woocommerce-MyAccount-navigation {
		align-self: stretch;
		overflow: hidden;
		border: 0;
		border-right: 1px solid rgba(126, 223, 255, 0.12);
		border-radius: 0;
		background:
			linear-gradient(180deg, rgba(7, 19, 34, 0.98), rgba(3, 9, 17, 0.99)),
			#071322;
		box-shadow: inset -1px 0 0 rgba(255, 255, 255, 0.04);
		backdrop-filter: none;
		-webkit-backdrop-filter: none;
	}

	body.woocommerce-account.mmed-matrix-account-dashboard .woocommerce-MyAccount-navigation::before {
		content: "MM  Matrix\A MissionMed Account";
	display: block;
	white-space: pre-line;
	margin: 0;
		padding: 28px 22px 24px;
	border-bottom: 1px solid rgba(255, 255, 255, 0.08);
	border-radius: 0;
		background:
			linear-gradient(135deg, rgba(23, 163, 207, 0.12), rgba(200, 148, 32, 0.08)),
			rgba(255, 255, 255, 0.02);
	color: #ffffff;
		font-size: 18px;
		font-weight: 950;
		line-height: 1.35;
		letter-spacing: 0.02em;
		text-transform: uppercase;
		text-shadow: none;
	}

	.mmed-matrix-account-dashboard .woocommerce-MyAccount-navigation ul {
		margin: 0;
		padding: 0 0 24px;
	}

.mmed-matrix-account-dashboard .woocommerce-MyAccount-navigation li {
	border: 0;
}

	.mmed-matrix-account-dashboard .woocommerce-MyAccount-navigation a {
		position: relative;
		display: flex;
		min-height: 48px;
		align-items: center;
		gap: 12px;
		padding: 12px 18px 12px 20px;
		border: 0;
		border-left: 3px solid transparent;
		border-radius: 0;
		color: rgba(238, 246, 255, 0.78);
		font-weight: 820;
	letter-spacing: 0.01em;
	text-decoration: none;
	transition: transform 0.2s ease, color 0.2s ease, background 0.2s ease, border-color 0.2s ease;
}

	.mmed-matrix-account-dashboard .woocommerce-MyAccount-navigation a::before {
		content: "";
		display: grid;
		width: 24px;
		height: 24px;
		flex: 0 0 24px;
		place-items: center;
		border-radius: 99px;
		background: rgba(255, 255, 255, 0.06);
		box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.06);
		color: rgba(238, 246, 255, 0.76);
		font-size: 9px;
		font-weight: 950;
		letter-spacing: 0;
	}

	.mmed-matrix-account-dashboard .woocommerce-MyAccount-navigation-link--med-matrix-dashboard a::before { content: "MX" !important; display: grid !important; }
	.mmed-matrix-account-dashboard .woocommerce-MyAccount-navigation-link--access-arena a::before { content: "AR" !important; display: grid !important; }
	.mmed-matrix-account-dashboard .woocommerce-MyAccount-navigation-link--orders a::before { content: "OR" !important; display: grid !important; }
	.mmed-matrix-account-dashboard .woocommerce-MyAccount-navigation-link--members-area a::before { content: "MM" !important; display: grid !important; }
	.mmed-matrix-account-dashboard .woocommerce-MyAccount-navigation-link--subscriptions a::before { content: "SU" !important; display: grid !important; }
	.mmed-matrix-account-dashboard .woocommerce-MyAccount-navigation-link--edit-account a::before { content: "AC" !important; display: grid !important; }
	.mmed-matrix-account-dashboard .woocommerce-MyAccount-navigation-link--customer-logout a::before { content: "LO" !important; display: grid !important; }

.mmed-matrix-account-dashboard .woocommerce-MyAccount-navigation .is-active a,
.mmed-matrix-account-dashboard .woocommerce-MyAccount-navigation a:hover,
.mmed-matrix-account-dashboard .woocommerce-MyAccount-navigation a:focus-visible {
		border-left-color: #f3d576;
		background:
			linear-gradient(90deg, rgba(200, 148, 32, 0.2), rgba(255, 255, 255, 0.03)),
			rgba(255, 255, 255, 0.04);
	color: #ffffff;
	outline: none;
		transform: none;
	}

.mmed-matrix-account-dashboard .woocommerce-MyAccount-navigation .is-active a::before,
.mmed-matrix-account-dashboard .woocommerce-MyAccount-navigation a:hover::before,
.mmed-matrix-account-dashboard .woocommerce-MyAccount-navigation a:focus-visible::before {
	background: #f3d576;
	box-shadow: 0 0 20px rgba(243, 213, 118, 0.48);
}

	.mmed-matrix-account-dashboard .woocommerce-MyAccount-content {
		min-height: calc(100vh - 122px);
		padding: clamp(34px, 5vw, 58px) clamp(30px, 5vw, 64px) clamp(48px, 6vw, 76px);
		border: 0;
		border-radius: 0;
		background:
			radial-gradient(circle at 15% 6%, rgba(126, 223, 255, 0.18), transparent 28%),
			linear-gradient(180deg, rgba(18, 67, 96, 0.42), rgba(6, 23, 39, 0.58) 52%, rgba(3, 9, 17, 0.86));
		box-shadow: inset 1px 0 0 rgba(255, 255, 255, 0.04);
		backdrop-filter: none;
		-webkit-backdrop-filter: none;
		color: rgba(238, 246, 255, 0.78);
	}

	.mmed-matrix-account-dashboard .woocommerce-MyAccount-content::before {
		content: "Student account";
		display: inline-flex;
		min-height: 26px;
		align-items: center;
		margin: 0 0 18px;
		padding: 0 14px;
		border-radius: 999px;
		background: linear-gradient(180deg, #f3d576, #c89420);
		color: #07111f;
		font-size: 11px;
		font-weight: 950;
		letter-spacing: 0.09em;
		text-transform: uppercase;
	}

.mmed-matrix-account-dashboard .woocommerce-MyAccount-content > p {
		max-width: 900px;
	margin: 0 0 16px;
	color: rgba(238, 246, 255, 0.74);
	font-size: clamp(16px, 1.35vw, 19px);
	line-height: 1.7;
}

	.mmed-matrix-account-dashboard .woocommerce-MyAccount-content > p:first-child {
		display: block;
		max-width: 960px;
		padding: 0;
		border: 0;
		border-radius: 0;
		background: transparent;
		color: #ffffff;
		font-size: clamp(34px, 5vw, 58px);
		font-weight: 950;
		line-height: 1.02;
		letter-spacing: 0;
	}

	.mmed-matrix-account-dashboard .woocommerce-MyAccount-content > p:first-child a {
		font-size: clamp(15px, 1.3vw, 18px);
		vertical-align: middle;
	}

.mmed-matrix-account-dashboard .woocommerce-MyAccount-content a {
	color: #f3d576;
	font-weight: 800;
}

.mmed-matrix-account-entry {
	display: block;
	margin: 34px 0 0;
	padding: 0;
}

	.mmed-matrix-account-entry__shell {
		position: relative;
		width: 100%;
		min-height: 360px;
		overflow: hidden;
		padding: clamp(30px, 4vw, 48px) clamp(28px, 4vw, 50px) clamp(30px, 4vw, 48px) min(43%, 390px);
		border: 1px solid rgba(23, 163, 207, 0.28);
		border-radius: 8px;
		background:
			linear-gradient(135deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.02)),
			linear-gradient(180deg, rgba(13, 52, 78, 0.94), rgba(5, 17, 31, 0.98));
		box-shadow:
			0 18px 48px rgba(0, 0, 0, 0.38),
			inset 0 1px 0 rgba(255, 255, 255, 0.14);
		text-align: left;
	}

.mmed-matrix-account-entry__shell::before {
	content: "";
	position: absolute;
	top: 0;
	bottom: 0;
	left: 0;
	width: 36%;
	background-image:
		linear-gradient(180deg, rgba(2, 7, 18, 0.06), rgba(2, 7, 18, 0.76)),
		linear-gradient(90deg, transparent 0%, rgba(2, 7, 18, 0.82) 100%),
		url('https://missionmedinstitute.com/wp-content/uploads/2026/04/realresults.realredemption.real_.residency1.webp');
	background-position: center;
	background-size: cover;
	pointer-events: none;
}

.mmed-matrix-account-entry__shell::after {
	content: "Courses / Calendar / Messages / Files";
	position: absolute;
	left: 28px;
	bottom: 28px;
	width: min(250px, 30%);
	padding: 12px 14px;
	border: 1px solid rgba(255, 255, 255, 0.16);
		border-radius: 8px;
	background: rgba(2, 7, 18, 0.58);
	color: rgba(255, 255, 255, 0.82);
	font-size: 11px;
	font-weight: 900;
	letter-spacing: 0.12em;
	line-height: 1.4;
	text-transform: uppercase;
	pointer-events: none;
}

.mmed-matrix-account-entry__signal {
	position: relative;
	z-index: 1;
	width: 74px;
	height: 74px;
	margin: 0 0 22px;
	border: 1px solid rgba(243, 213, 118, 0.45);
		border-radius: 8px;
	background:
		linear-gradient(135deg, rgba(255, 255, 255, 0.55), rgba(255, 255, 255, 0)),
		linear-gradient(135deg, #c89420, #f3d576 58%, #9f6b17);
	box-shadow:
		0 18px 48px rgba(217, 184, 91, 0.33),
		inset 0 1px 0 rgba(255, 255, 255, 0.42);
}

.mmed-matrix-account-entry__signal::after {
	content: "MM";
	display: grid;
	width: 100%;
	height: 100%;
	place-items: center;
	color: #07111f;
	font-size: 22px;
	font-weight: 950;
	letter-spacing: 0;
}

.mmed-matrix-account-entry__eyebrow,
.mmed-matrix-account-entry h2,
.mmed-matrix-account-entry__copy,
.mmed-matrix-account-entry__cta {
	position: relative;
	z-index: 1;
}

.mmed-matrix-account-entry__eyebrow {
	margin: 0 0 12px;
	color: #7fdfff;
	font-size: 12px;
	font-weight: 950;
	letter-spacing: 0.18em;
	text-transform: uppercase;
}

.mmed-matrix-account-entry h2 {
	max-width: 610px;
	margin: 0 0 16px;
	color: #ffffff;
		font-size: clamp(30px, 4.2vw, 48px);
	font-weight: 950;
	letter-spacing: 0;
	line-height: 0.96;
	text-wrap: balance;
}

.mmed-matrix-account-entry__copy {
	max-width: 560px;
	margin: 0 0 28px;
	color: rgba(238, 246, 255, 0.75);
	font-size: clamp(16px, 1.4vw, 18px);
	line-height: 1.65;
}

body.mmed-matrix-account-dashboard .woocommerce-MyAccount-content a.mmed-matrix-account-entry__cta {
	display: inline-flex;
	min-height: 56px;
	align-items: center;
	justify-content: center;
	padding: 15px 28px;
	border: 1px solid rgba(255, 255, 255, 0.28);
		border-radius: 8px;
	background:
		linear-gradient(180deg, rgba(255, 255, 255, 0.24), rgba(255, 255, 255, 0.04)),
		linear-gradient(135deg, #9f6b17, #c89420 44%, #efc756 100%);
	box-shadow:
		0 18px 46px rgba(0, 0, 0, 0.44),
		0 0 34px rgba(217, 184, 91, 0.26),
		inset 0 1px 0 rgba(255, 255, 255, 0.42),
		inset 0 -6px 16px rgba(80, 50, 0, 0.32);
	color: #ffffff !important;
	-webkit-text-fill-color: #ffffff !important;
	font-size: 15px;
	font-weight: 950 !important;
	letter-spacing: 0.04em;
	text-decoration: none !important;
	text-shadow: 0 1px 2px rgba(0, 0, 0, 0.42);
	text-transform: uppercase;
	transition: transform 0.22s ease, box-shadow 0.22s ease, filter 0.22s ease;
}

body.mmed-matrix-account-dashboard .woocommerce-MyAccount-content a.mmed-matrix-account-entry__cta:hover,
body.mmed-matrix-account-dashboard .woocommerce-MyAccount-content a.mmed-matrix-account-entry__cta:focus-visible {
	filter: brightness(1.1);
	transform: translateY(-2px);
	outline: none;
	box-shadow:
		0 24px 58px rgba(0, 0, 0, 0.48),
		0 0 42px rgba(243, 213, 118, 0.34),
		inset 0 1px 0 rgba(255, 255, 255, 0.48);
}

	@media (max-width: 921px) {
		.mmed-matrix-account-dashboard .woocommerce {
			grid-template-columns: 1fr;
			width: 100%;
			padding: 0;
		}

		.mmed-matrix-account-dashboard .woocommerce::before {
			background:
				linear-gradient(180deg, rgba(5, 12, 22, 0.96) 0, rgba(5, 12, 22, 0.96) 250px, rgba(18, 77, 110, 0.42) 251px, transparent 58%),
				linear-gradient(180deg, rgba(255, 255, 255, 0.06), transparent 22%, rgba(2, 7, 18, 0.22) 100%);
		}

		.mmed-matrix-account-dashboard .woocommerce::after {
			display: none;
		}

		.mmed-matrix-account-dashboard .woocommerce-MyAccount-navigation {
			border-right: 0;
			border-bottom: 1px solid rgba(126, 223, 255, 0.12);
		}

		body.woocommerce-account.mmed-matrix-account-dashboard .woocommerce-MyAccount-navigation::before {
			font-size: 15px;
		}

		.mmed-matrix-account-dashboard .woocommerce-MyAccount-navigation ul {
			display: grid;
			grid-template-columns: repeat(3, minmax(0, 1fr));
			padding: 8px;
		}

		.mmed-matrix-account-entry__shell {
			padding: 220px 24px 30px;
		}

	.mmed-matrix-account-entry__shell::before {
		right: 0;
		bottom: auto;
		width: 100%;
		height: 190px;
		background-image:
			linear-gradient(180deg, rgba(2, 7, 18, 0.08), rgba(2, 7, 18, 0.88)),
			url('https://missionmedinstitute.com/wp-content/uploads/2026/04/realresults.realredemption.real_.residency1.webp');
	}

	.mmed-matrix-account-entry__shell::after {
		top: 128px;
		bottom: auto;
		left: 20px;
		width: calc(100% - 40px);
	}
}

	@media (max-width: 640px) {
		body.mmed-matrix-account-dashboard::before {
			background-attachment: scroll;
		}

		.mmed-matrix-account-dashboard .ast-container {
			padding: 0;
		}

		.mmed-matrix-account-dashboard .woocommerce {
			width: 100%;
			gap: 0;
			padding: 0;
			border-radius: 0;
		}

	.mmed-matrix-account-dashboard .woocommerce-MyAccount-navigation,
	.mmed-matrix-account-dashboard .woocommerce-MyAccount-content,
	.mmed-matrix-account-entry__shell {
		border-radius: 8px;
	}

		.mmed-matrix-account-dashboard .woocommerce-MyAccount-navigation ul {
			display: grid;
			grid-template-columns: 1fr 1fr;
			gap: 0;
			padding: 8px;
		}

	.mmed-matrix-account-dashboard .woocommerce-MyAccount-navigation a {
			min-height: 44px;
			padding: 10px;
			font-size: 13px;
		}

		.mmed-matrix-account-dashboard .woocommerce-MyAccount-navigation a::before {
			width: 22px;
			height: 22px;
			flex-basis: 22px;
		}

	.mmed-matrix-account-dashboard .woocommerce-MyAccount-content {
			min-height: 0;
			padding: 20px;
		}

		.mmed-matrix-account-dashboard .woocommerce-MyAccount-content > p:first-child {
			font-size: clamp(28px, 10vw, 42px);
		}

	.mmed-matrix-account-entry {
		margin-top: 24px;
	}

	.mmed-matrix-account-entry h2 {
		font-size: clamp(31px, 11vw, 44px);
	}

	body.mmed-matrix-account-dashboard .woocommerce-MyAccount-content a.mmed-matrix-account-entry__cta {
		width: 100%;
		padding-inline: 18px;
	}
}
CSS;
}
