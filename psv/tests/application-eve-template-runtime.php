<?php
/** Self-contained founder-template parsing, ROOT integrity and output-envelope checks. */
declare(strict_types=1);

define( 'ABSPATH', __DIR__ . '/' );
class WP_Error {
	private string $code;
	private string $message;
	public function __construct( string $code, string $message, array $data = array() ) { $this->code = $code; $this->message = $message; }
	public function get_error_code(): string { return $this->code; }
	public function get_error_message(): string { return $this->message; }
}
function is_wp_error( $value ): bool { return $value instanceof WP_Error; }
function wp_list_pluck( array $list, string $field ): array { return array_values( array_map( static fn( array $row ) => $row[ $field ] ?? null, $list ) ); }
function get_transient( string $key ) { return false; }
function get_userdata( int $id ) { return false; }

$plugin = dirname( __DIR__, 2 ) . '/wp-content/plugins/missionmed-file-vault-ps/includes/';
require $plugin . 'class-mmps-region.php';
require $plugin . 'class-mmps-generator.php';

$failed = 0;
function app_eve_check( bool $ok, string $label ): void {
	global $failed;
	$failed += $ok ? 0 : 1;
	echo ( $ok ? 'PASS: ' : 'FAIL: ' ) . $label . "\n";
}

$protected_before = 'My work taught me to listen closely before deciding what a patient needs.';
$protected_after  = 'I will carry that discipline into residency and the communities I serve.';
$blank = MMPS_Region::parse_template( array( $protected_before, '***', '[Program Paragraph Here]', '***', $protected_after ) );
app_eve_check( ! is_wp_error( $blank ) && true === $blank['found'], 'one exact marker pair is recognized' );
app_eve_check( array( $protected_before, '[Program Paragraph Here]', $protected_after ) === $blank['paragraphs'], 'marker paragraphs are stripped before ROOT storage' );
app_eve_check( 'BLANK' === $blank['region']['template']['kind'] && 1 === $blank['region']['paragraphIndex'], 'blank template authorizes only its bounded paragraph' );
app_eve_check( 'ROOT_TEMPLATE_MARKERS' === $blank['region']['authorization'], 'template authority is explicit and durable' );

$authored_text = 'Because [verified training feature] would deepen the careful teamwork I value, [program name] is where I hope to [supported goal].';
$slotted = MMPS_Region::parse_template( array( $protected_before, '***', $authored_text, '***', $protected_after ) );
app_eve_check( ! is_wp_error( $slotted ) && 'SLOTTED' === $slotted['region']['template']['kind'], 'semantic authored template is recognized' );
app_eve_check( 3 === count( $slotted['region']['template']['slots'] ), 'semantic slot plan is deterministic' );
app_eve_check( ! empty( $slotted['region']['template']['staticFragments'] ), 'authored non-slot architecture is retained' );

$ordinary = MMPS_Region::parse_template( array( $protected_before, 'I seek thoughtful teaching.', $protected_after ) );
app_eve_check( ! is_wp_error( $ordinary ) && false === $ordinary['found'], 'ROOT with no markers keeps explicit region confirmation' );
app_eve_check( is_wp_error( MMPS_Region::parse_template( array( $protected_before, '***', '[slot]', $protected_after ) ) ), 'unclosed marker fails closed' );
app_eve_check( is_wp_error( MMPS_Region::parse_template( array( $protected_before, '***', '[slot]', '***', '***', $protected_after ) ) ), 'multiple marker pairs fail closed' );
app_eve_check( is_wp_error( MMPS_Region::parse_template( array( $protected_before, '***', 'two', 'paragraphs', '***', $protected_after ) ) ), 'ambiguous multi-paragraph region fails closed' );

$replacement = 'Because teaching matters, Lakeview Internal Medicine Residency is where I hope to learn with care.';
$rebuilt = MMPS_Region::reconstruct( $blank['paragraphs'], $blank['region'], $replacement );
app_eve_check( true === MMPS_Region::verify_protected( $rebuilt, $blank['region'] ), 'reconstruction preserves every protected paragraph hash' );
$rebuilt[0] .= ' drift';
app_eve_check( is_wp_error( MMPS_Region::verify_protected( $rebuilt, $blank['region'] ) ), 'protected ROOT drift remains a hard failure' );

$fact = array( 'factId' => 'F-name', 'category' => 'identity', 'label' => 'Program name', 'text' => 'The program is Lakeview Internal Medicine Residency.' );
$plan = array( 'tierEffective' => 'ESSENTIAL', 'allowedFacts' => array( $fact ), 'studentFacts' => array() );
$bundle = array(
	'program' => array( 'programName' => 'Lakeview Internal Medicine Residency', 'institution' => 'Lakeview', 'city' => '', 'state' => '', 'programSpecialtyId' => 'p1' ),
	'nameForms' => array( 'Lakeview Internal Medicine Residency', 'Lakeview' ),
);
$root = array( 'specialtyLabel' => 'Internal Medicine', 'paragraphs' => $blank['paragraphs'], 'region' => $blank['region'] );
$codes = static function ( string $text ) use ( $fact, $plan, $bundle, $root ): array {
	$out = array(
		'replacement_region' => $text,
		'segments' => array( array( 'text' => $text, 'kind' => 'program_fact', 'fact_ids' => array( $fact['factId'] ) ) ),
		'facts_used' => array( $fact['factId'] ),
		'self_check' => array(),
	);
	$result = MMPS_Generator::validate( $out, $bundle, $plan, $root );
	return array_values( array_unique( wp_list_pluck( $result['blocking'], 'code' ) ) );
};
app_eve_check( in_array( 'TEMPLATE_MARKER_LEFT', $codes( 'Lakeview Internal Medicine Residency *** supports my goal.' ), true ), 'finished output cannot retain template markers' );
app_eve_check( in_array( 'TEMPLATE_SLOT_LEFT', $codes( 'Lakeview Internal Medicine Residency supports [my goal].' ), true ), 'finished output cannot retain bracket metadata' );
app_eve_check( in_array( 'EM_DASH', $codes( 'Lakeview Internal Medicine Residency supports my goal—careful clinical work.' ), true ), 'finished output cannot contain an em dash' );
app_eve_check( in_array( 'BANNED_PHRASE', $codes( 'Lakeview Internal Medicine Residency is my perfect fit.' ), true ), 'AI-smell phrase is blocking rather than advisory' );

$slotted_root = array( 'specialtyLabel' => 'Internal Medicine', 'paragraphs' => $slotted['paragraphs'], 'region' => $slotted['region'] );
$slotted_codes = static function ( string $text ) use ( $fact, $plan, $bundle, $slotted_root ): array {
	$out = array( 'replacement_region' => $text, 'segments' => array( array( 'text' => $text, 'kind' => 'program_fact', 'fact_ids' => array( $fact['factId'] ) ) ), 'facts_used' => array( $fact['factId'] ), 'self_check' => array() );
	$result = MMPS_Generator::validate( $out, $bundle, $plan, $slotted_root );
	return array_values( array_unique( wp_list_pluck( $result['blocking'], 'code' ) ) );
};
app_eve_check( in_array( 'TEMPLATE_ARCHITECTURE_DRIFT', $slotted_codes( 'Lakeview Internal Medicine Residency offers thoughtful teaching.' ), true ), 'authored template architecture cannot silently drift' );

echo 'PSV APPLICATION EVE TEMPLATE RUNTIME: ' . ( $failed ? 'FAIL' : 'PASS' ) . "\n";
exit( $failed ? 1 : 0 );
