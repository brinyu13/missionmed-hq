<?php
/**
 * Explicit default-off runtime boundary for V1 Study Schedule.
 *
 * @package MissionMed_Hub
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/** Load and register V1 runtime behavior only after the exact source gate. */
final class MMED_V1_Study_Runtime {

	/** @var bool */
	private static $initialized = false;

	/** @return bool */
	public static function enabled() {
		return defined( 'MMED_V1_STUDY_RUNTIME_BINDING' ) && true === MMED_V1_STUDY_RUNTIME_BINDING;
	}

	/** @return void */
	public static function init() {
		if ( self::$initialized || ! self::enabled() ) {
			return;
		}
		self::load_dependencies();
		self::$initialized = true;
		MMED_V1_Study_REST_API::init();
		MMED_V1_Study_Loader::init();
	}

	/** @return void */
	public static function load_dependencies() {
		$files = array(
			'class-mmed-v1-study-schema.php',
			'class-mmed-v1-study-schema-inspector.php',
			'class-mmed-v1-study-week-schema.php',
			'class-mmed-v1-study-week-schema-inspector.php',
			'class-mmed-v1-study-week-domain.php',
			'class-mmed-v1-study-week-command-state.php',
			'class-mmed-v1-study-innodb-repository.php',
			'class-mmed-v1-study-command-service.php',
			'class-mmed-v1-study-innodb-command-repository.php',
			'class-mmed-v1-study-runtime-schema.php',
			'class-mmed-v1-study-runtime-actor.php',
			'class-mmed-v1-study-runtime-repository.php',
			'class-mmed-v1-study-temporal-context.php',
			'class-mmed-v1-study-rest-api.php',
			'class-mmed-v1-study-loader.php',
		);
		foreach ( $files as $file ) {
			require_once MMED_HUB_PATH . 'includes/' . $file;
		}
	}

	/** Reset process-local state in deterministic fixtures only. @return void */
	public static function reset_for_tests() {
		self::$initialized = false;
	}
}
