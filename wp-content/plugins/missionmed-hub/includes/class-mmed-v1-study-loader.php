<?php
/**
 * Additive, default-hidden browser loader for V1 Study Schedule.
 *
 * @package MissionMed_Hub
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/** Enqueues immutable, inert assets only after every server gate passes. */
final class MMED_V1_Study_Loader {

	const SCRIPT_HANDLE = 'mmed-v1-study-loader';
	const STYLE_HANDLE  = 'mmed-v1-study-loader';
	const BOOTSTRAP_KEY = 'study_schedule_v1';

	/** @return void */
	public static function init() {
		add_action( 'wp_enqueue_scripts', array( __CLASS__, 'enqueue' ), 20 );
	}

	/**
	 * Do not emit an asset, nonce, or endpoint unless exposure is authorized and
	 * the complete local bytes match the immutable release descriptor.
	 *
	 * @return void
	 */
	public static function enqueue() {
		if (
			! function_exists( 'mmed_hub_is_student_os_enabled' )
			|| ! mmed_hub_is_student_os_enabled()
			|| ! class_exists( 'MMED_Hub_Page' )
			|| ! MMED_Hub_Page::is_hub_page()
			|| ! function_exists( 'wp_script_is' )
			|| ! wp_script_is( 'mmed-student-os-js', 'enqueued' )
		) {
			return;
		}

		$control  = MMED_V1_Study_Control::read();
		$decision = MMED_V1_Study_Access::bootstrap_decision( null, null, null, $control );
		$mode     = isset( $decision['mode']['mode'] ) ? $decision['mode']['mode'] : '';
		MMED_V1_Study_Observability::record(
			'bootstrap_decision',
			array(
				'route_id'       => 'matrix_bootstrap',
				'action'         => MMED_V1_Study_Domain::ACTION_PLAN_READ,
				'mode'           => $mode,
				'actor_kind'     => isset( $decision['actor_kind'] ) ? $decision['actor_kind'] : 'unknown',
				'outcome'        => ! empty( $decision['allowed'] ) ? 'allow' : 'deny',
				'reason_code'    => isset( $decision['reason_code'] ) ? $decision['reason_code'] : 'unknown',
				'http_status'    => isset( $decision['status'] ) ? $decision['status'] : 500,
				'release_digest' => MMED_V1_Study_Release::RELEASE_SHA256,
			)
		);

		if ( empty( $decision['allowed'] ) || ! self::assets_valid() || ! self::handles_available() ) {
			return;
		}

		wp_enqueue_style(
			self::STYLE_HANDLE,
			MMED_HUB_URL . 'assets/' . MMED_V1_Study_Release::STYLE_ASSET,
			array( 'mmed-student-os-css' ),
			null
		);
		wp_enqueue_script(
			self::SCRIPT_HANDLE,
			MMED_HUB_URL . 'assets/' . MMED_V1_Study_Release::LOADER_ASSET,
			array( 'mmed-student-os-js' ),
			null,
			true
		);
		wp_add_inline_script(
			self::SCRIPT_HANDLE,
			self::inline_bootstrap( self::client_payload( $decision ) ),
			'before'
		);
	}

	/**
	 * Verify both full hashes and their content-addressed filename prefixes.
	 *
	 * @return bool
	 */
	public static function assets_valid() {
		$assets = array(
			array( MMED_V1_Study_Release::MANIFEST_ASSET, MMED_V1_Study_Release::RELEASE_SHA256, '.json' ),
			array( MMED_V1_Study_Release::LOADER_ASSET, MMED_V1_Study_Release::LOADER_SHA256, '.js' ),
			array( MMED_V1_Study_Release::STYLE_ASSET, MMED_V1_Study_Release::STYLE_SHA256, '.css' ),
		);

		foreach ( $assets as $asset ) {
			$name   = $asset[0];
			$digest = $asset[1];
			$suffix = $asset[2];
			$path   = MMED_HUB_PATH . 'assets/' . $name;
			$marker = '.' . substr( $digest, 0, 16 ) . $suffix;
			if (
				! is_string( $digest )
				|| 1 !== preg_match( '/^[a-f0-9]{64}$/', $digest )
				|| strlen( $name ) > 128
				|| substr( $name, -strlen( $marker ) ) !== $marker
				|| ! is_file( $path )
				|| ! function_exists( 'hash_file' )
				|| $digest !== hash_file( 'sha256', $path )
			) {
				return false;
			}
		}

		$manifest_path = MMED_HUB_PATH . 'assets/' . MMED_V1_Study_Release::MANIFEST_ASSET;
		$manifest      = json_decode( (string) file_get_contents( $manifest_path ), true );
		return is_array( $manifest ) && MMED_V1_Study_Release::manifest_descriptor() === $manifest;
	}

	/**
	 * Refuse to attach trusted bootstrap data to a handle registered elsewhere.
	 *
	 * @return bool
	 */
	private static function handles_available() {
		if ( wp_script_is( self::SCRIPT_HANDLE, 'registered' ) ) {
			return false;
		}

		if ( function_exists( 'wp_style_is' ) && wp_style_is( self::STYLE_HANDLE, 'registered' ) ) {
			return false;
		}

		return true;
	}

	/**
	 * Client-safe display hints. REST and commands always recalculate authority.
	 *
	 * @param array $decision Authorized server decision.
	 * @return array
	 */
	public static function client_payload( $decision ) {
		$mode = isset( $decision['mode'] ) && is_array( $decision['mode'] ) ? $decision['mode'] : array();
		return array(
			'contract_version' => MMED_V1_Study_Domain::CONTRACT_VERSION,
			'mode'             => isset( $mode['mode'] ) ? $mode['mode'] : null,
			'entitlement'      => array( 'allowed' => true ),
			'exposure'         => array( 'allowed' => ! empty( $mode['exposure_allowed'] ) ),
			'reader'           => array(
				'allowed' => ! empty( $mode['reader_allowed'] ),
				'version' => isset( $mode['reader_version'] ) ? $mode['reader_version'] : null,
			),
			'writer'           => array( 'allowed' => ! empty( $mode['v1_writer_allowed'] ) ),
			'release'          => array(
				'id'     => MMED_V1_Study_Release::RELEASE_ID,
				'digest' => MMED_V1_Study_Release::RELEASE_SHA256,
			),
		);
	}

	/** @return array */
	public static function hidden_payload() {
		return array(
			'contract_version' => MMED_V1_Study_Domain::CONTRACT_VERSION,
			'mode'             => MMED_V1_Study_Domain::MODE_HIDDEN_NO_TRUTH,
			'entitlement'      => array( 'allowed' => false ),
			'exposure'         => array( 'allowed' => false ),
			'reader'           => array( 'allowed' => false, 'version' => null ),
			'writer'           => array( 'allowed' => false ),
			'release'          => array( 'id' => MMED_V1_Study_Release::RELEASE_ID, 'digest' => null ),
		);
	}

	/**
	 * Add one child to the established Matrix bootstrap carrier.
	 *
	 * @param array $payload Client-safe payload.
	 * @return string
	 */
	public static function inline_bootstrap( $payload ) {
		$json = function_exists( 'wp_json_encode' )
			? wp_json_encode( $payload, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT )
			: json_encode( $payload, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT );
		return 'window.MMED_OS=window.MMED_OS||{};window.MMED_OS.' . self::BOOTSTRAP_KEY . '=' . $json . ';';
	}
}
