<?php
/** Self-contained P1 search forwarding and identity projection checks. */
define( 'ABSPATH', __DIR__ );
class WP_Error {}
function is_wp_error( $value ) { return $value instanceof WP_Error; }
function wp_strip_all_tags( $value ) { return strip_tags( (string) $value ); }
class MMPS_Rise_Client {
	public static $path;
	public static $query;
	public static function get( $path, $query = array() ) {
		self::$path = $path;
		self::$query = $query;
		return array(
			'records' => array(
				array(
					'programSpecialtyId' => 'ps-im-1',
					'identifiers' => array( array( 'namespace' => 'ACGME_PROGRAM', 'value' => '1400000001' ) ),
					'display' => array( 'programName' => 'Example Internal Medicine Residency', 'institution' => 'Example University', 'hospital' => 'Example Hospital', 'city' => 'Albany', 'state' => 'NY' ),
					'designation' => 'Internal Medicine',
				),
				array(
					'programSpecialtyId' => 'ps-fm-1',
					'identifiers' => array( array( 'namespace' => 'ACGME_PROGRAM', 'value' => '1200000001' ) ),
					'display' => array( 'programName' => 'Wrong Specialty Program', 'institution' => 'Example University', 'city' => 'Albany', 'state' => 'NY' ),
					'designation' => 'Family Medicine',
				),
				array(
					'programSpecialtyId' => '',
					'identifiers' => array(),
					'display' => array( 'programName' => 'Missing Program ID', 'institution' => 'Example University', 'city' => 'Albany', 'state' => 'NY' ),
					'designation' => 'Internal Medicine',
				),
				array(
					'programSpecialtyId' => 'ps-missing-specialty',
					'identifiers' => array(),
					'display' => array( 'programName' => 'Missing Specialty', 'institution' => 'Example University', 'city' => 'Albany', 'state' => 'NY' ),
					'designation' => '',
				),
				array(
					'programSpecialtyId' => 'ps-wrong-state',
					'identifiers' => array(),
					'display' => array( 'programName' => 'Wrong State Program', 'institution' => 'Example University', 'city' => 'Boston', 'state' => 'MA' ),
					'designation' => 'Internal Medicine',
				),
			),
		);
	}
}
require dirname( __DIR__, 2 ) . '/wp-content/plugins/missionmed-file-vault-ps/includes/class-mmps-evidence-bundle.php';
$failed = 0;
function p1runtime( $ok, $label ) { global $failed; if ( ! $ok ) { $failed++; } echo ( $ok ? 'PASS: ' : 'FAIL: ' ) . $label . "\n"; }
$found = MMPS_Evidence_Bundle::search( 'example', 100, 'Internal Medicine', 'NY' );
p1runtime( '/api/rise/v1/programs' === MMPS_Rise_Client::$path, 'search uses the canonical read-only RISE programs route' );
p1runtime( 'Internal Medicine' === MMPS_Rise_Client::$query['specialty'], 'ROOT specialty is forwarded exactly' );
p1runtime( 'NY' === MMPS_Rise_Client::$query['jurisdiction'], 'state is forwarded as the RISE jurisdiction filter' );
p1runtime( 'false' === MMPS_Rise_Client::$query['includeCombined'], 'combined specialties are excluded from default results' );
p1runtime( 24 === MMPS_Rise_Client::$query['pageSize'], 'result size remains bounded' );
p1runtime( 1 === count( $found ) && 'ps-im-1' === $found[0]['programSpecialtyId'], 'verified program-specialty identity survives projection' );
p1runtime( 1 === count( $found ), 'wrong-specialty, wrong-state and incomplete identities are rejected even if RISE returns them' );
p1runtime( '1400000001' === $found[0]['acgmeId'] && 'Internal Medicine' === $found[0]['designation'], 'row exposes ACGME ID and specialty without display-name inference' );
MMPS_Evidence_Bundle::search( 'example', 12, 'Internal Medicine', 'New York' );
p1runtime( ! isset( MMPS_Rise_Client::$query['jurisdiction'] ), 'malformed state never reaches RISE as a filter' );
echo 'PSV P1 RUNTIME: ' . ( $failed ? 'FAIL' : 'PASS' ) . "\n";
exit( $failed ? 1 : 0 );
