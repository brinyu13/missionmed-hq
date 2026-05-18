<?php
/**
 * LearnDash Matrix visual reskin controller.
 *
 * @package MissionMed_Hub
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Load Matrix-aligned styling on LearnDash student pages.
 */
class MMED_LearnDash_Reskin {

	/**
	 * Cached page detection result.
	 *
	 * @var bool|null
	 */
	private static $is_learndash_page = null;

	/**
	 * Initialize hooks.
	 *
	 * @return void
	 */
	public static function init() {
		add_action( 'wp_enqueue_scripts', array( __CLASS__, 'enqueue_assets' ), 999 );
		add_action( 'wp_footer', array( __CLASS__, 'render_back_to_matrix_button' ), 20 );
	}

	/**
	 * Enqueue the LearnDash reskin assets after LearnDash and theme styles.
	 *
	 * @return void
	 */
	public static function enqueue_assets() {
		if ( ! self::is_learndash_page() ) {
			return;
		}

		$css_path = MMED_HUB_PATH . 'assets/learndash-reskin.css';
		$deps     = self::get_learndash_style_dependencies();

		wp_enqueue_style(
			'mmed-learndash-fonts',
			'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700;800&family=Poppins:wght@400;500;600;700;800&display=swap',
			array(),
			null
		);

		$deps[] = 'mmed-learndash-fonts';

		wp_enqueue_style(
			'mmed-learndash-reskin',
			MMED_HUB_URL . 'assets/learndash-reskin.css',
			array_values( array_unique( $deps ) ),
			file_exists( $css_path ) ? (string) filemtime( $css_path ) : MMED_HUB_VERSION
		);
	}

	/**
	 * Print the persistent return link on LearnDash pages.
	 *
	 * @return void
	 */
	public static function render_back_to_matrix_button() {
		if ( ! self::is_learndash_page() ) {
			return;
		}

		printf(
			'<a href="%1$s" class="mmed-back-to-matrix" title="%2$s"><span class="mmed-btm-arrow" aria-hidden="true">&#8592;</span> %3$s</a>',
			esc_url( home_url( '/member-dashboard/#courses' ) ),
			esc_attr__( 'Return to your Matrix dashboard', 'missionmed-hub' ),
			esc_html__( 'Back to Matrix', 'missionmed-hub' )
		);
	}

	/**
	 * Detect supported LearnDash page types for logged-in users.
	 *
	 * @return bool
	 */
	private static function is_learndash_page() {
		if ( null !== self::$is_learndash_page ) {
			return self::$is_learndash_page;
		}

		if ( ! is_user_logged_in() ) {
			self::$is_learndash_page = false;
			return self::$is_learndash_page;
		}

		$post_types = array(
			'sfwd-courses',
			'sfwd-lessons',
			'sfwd-topic',
			'sfwd-quiz',
		);

		if ( is_singular( $post_types ) ) {
			self::$is_learndash_page = true;
			return self::$is_learndash_page;
		}

		$post_type = get_post_type();
		self::$is_learndash_page = in_array( $post_type, $post_types, true );

		return self::$is_learndash_page;
	}

	/**
	 * Return only registered LearnDash/Astra style handles so the reskin never
	 * depends on a missing handle.
	 *
	 * @return array
	 */
	private static function get_learndash_style_dependencies() {
		global $wp_styles;

		if ( ! $wp_styles || empty( $wp_styles->registered ) ) {
			return array();
		}

		$candidates = array(
			'learndash-front',
			'learndash-front-css',
			'learndash_style',
			'learndash',
			'learndash_quiz_front_css',
			'learndash-quiz-front-css',
			'sfwd_front_css',
			'astra-learndash',
			'astra-theme-css',
			'learndash-propanel-reports',
		);

		$deps = array();

		foreach ( $candidates as $handle ) {
			if ( isset( $wp_styles->registered[ $handle ] ) ) {
				$deps[] = $handle;
			}
		}

		return $deps;
	}
}
