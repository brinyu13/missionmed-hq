<?php
/**
 * Executable proof that a missing V1 access boundary fails closed for Study
 * mutations without changing non-Study Calendar behavior.
 */

declare(strict_types=1);

define( 'ABSPATH', __DIR__ . '/' );

final class WP_Error {
	public string $code;
	public string $message;
	public array $data;

	public function __construct( string $code, string $message, array $data = array() ) {
		$this->code    = $code;
		$this->message = $message;
		$this->data    = $data;
	}
}

function is_wp_error( $value ): bool {
	return $value instanceof WP_Error;
}

require_once dirname( __DIR__, 2 ) . '/wp-content/plugins/missionmed-hub/includes/class-mmed-calendar-engine.php';
require_once dirname( __DIR__, 2 ) . '/wp-content/plugins/missionmed-hub/includes/class-mmed-study-schedule.php';

final class V1_Access_Missing_Study_Probe extends MMED_Study_Schedule {
	public static function gate() {
		return parent::v1_legacy_writer_gate();
	}
}

function v1_access_missing_calendar_gate( string $event_type, int $owner_id ) {
	$gate = new ReflectionMethod( 'MMED_Calendar_Engine', 'v1_study_writer_gate' );
	$gate->setAccessible( true );
	return $gate->invoke( null, $event_type, $owner_id );
}

function v1_access_missing_expect( bool $condition, string $label ): void {
	if ( ! $condition ) {
		throw new RuntimeException( $label );
	}
}

v1_access_missing_expect(
	true === v1_access_missing_calendar_gate( 'appointment', 42 ),
	'non-Study Calendar mutation remains outside the V1 access gate'
);

$calendar = v1_access_missing_calendar_gate( 'study_block', 42 );
v1_access_missing_expect(
	is_wp_error( $calendar )
	&& 'mmed_study_dependency_unavailable' === $calendar->code
	&& 503 === ( $calendar->data['status'] ?? null ),
	'missing access boundary denies generic Calendar Study mutation'
);

$study = V1_Access_Missing_Study_Probe::gate();
v1_access_missing_expect(
	is_wp_error( $study )
	&& 'mmed_study_dependency_unavailable' === $study->code
	&& 503 === ( $study->data['status'] ?? null ),
	'missing access boundary denies legacy Study adapter mutation'
);

echo "V1 Study Schedule missing-access fail-closed seam: ok\n";
