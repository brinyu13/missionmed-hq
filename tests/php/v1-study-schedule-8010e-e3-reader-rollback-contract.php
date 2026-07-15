<?php
/** Pure exact-reader selection and no-fallback contract for 8010E E3. */

define( 'ABSPATH', __DIR__ . '/' );

function v1_8010e_e3_reader_expect( $condition, $message ) {
	if ( ! $condition ) {
		throw new RuntimeException( $message );
	}
}

function v1_8010e_e3_reader_expect_same( $expected, $actual, $message ) {
	v1_8010e_e3_reader_expect( $expected === $actual, $message );
}

$root = dirname( __DIR__, 2 );
require_once $root . '/wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-domain.php';
require_once $root . '/wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-release.php';
require_once $root . '/wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-repository.php';
require_once $root . '/wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-access.php';
require_once $root . '/wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-schema.php';
require_once $root . '/wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-week-schema.php';

/** Build one control tuple through the production validator. */
function v1_8010e_e3_reader_control( $mode, $exposure, $decision_12, $stop, $current = '3', $previous = '2', $generation = 3 ) {
	$store = array(
		'contract_version' => MMED_V1_Study_Release::CONTROL_VERSION,
		'state'            => 'commissioned',
		'generation'       => (int) $generation,
		'store_id'         => 'v1_e3_reader_selector_store',
		'commissioned_at'  => '2026-07-15T00:00:00Z',
	);
	$release = array(
		'contract_version'        => MMED_V1_Study_Release::CONTROL_VERSION,
		'generation'              => (int) $generation,
		'mode'                    => $mode,
		'exposure'                => (bool) $exposure,
		'decision_12_state'       => $decision_12,
		'stop'                    => (bool) $stop,
		'release_digest'          => MMED_V1_Study_Release::RELEASE_SHA256,
		'current_reader_version'  => $current,
		'previous_reader_version' => $previous,
		'effective_at'            => '2026-07-15T00:00:00Z',
		'reason'                  => 'synthetic_reader_selector',
	);
	if ( 'approved' === $decision_12 ) {
		$release['policy_version'] = 'synthetic-policy-v1';
	}
	return MMED_V1_Study_Control::from_records( $store, $release );
}

/** Distinct test-only reader callbacks behind the production repository interface. */
final class V1_8010E_E3_Reader_Selector_Repository implements MMED_V1_Study_Repository {
	public $load_calls = array( '2' => 0, '3' => 0 );
	public $throw_stage = '';
	public $failed_reader = null;
	public $malformed_reader = null;
	public $private_result_reader = null;

	private $truth;
	private $readers;
	private $generation;

	public function __construct( $truth, $readers, $generation = 3 ) {
		$this->truth = $truth;
		$this->readers = $readers;
		$this->generation = (int) $generation;
	}

	public function binding_kind() {
		if ( 'binding' === $this->throw_stage ) {
			throw new RuntimeException( 'private_binding_failure' );
		}
		return MMED_V1_Study_Domain::BINDING_READY;
	}

	public function store_provenance() {
		if ( 'store' === $this->throw_stage ) {
			throw new RuntimeException( 'private_store_failure' );
		}
		return array(
			'state'      => 'commissioned',
			'store_id'   => 'v1_e3_reader_selector_store',
			'generation' => $this->generation,
		);
	}

	public function cutover_provenance( $owner_id ) {
		if ( 'truth' === $this->throw_stage ) {
			throw new RuntimeException( 'private_truth_failure' );
		}
		return (int) $owner_id > 0
			? $this->truth
			: array( 'state' => MMED_V1_Study_Domain::TRUTH_UNKNOWN, 'schema_version' => null, 'watermark_evidence' => false );
	}

	public function compatible_reader_versions() {
		if ( 'readers' === $this->throw_stage ) {
			throw new RuntimeException( 'private_registry_failure' );
		}
		return $this->readers;
	}

	public function load( $owner_id, $reader_version ) {
		unset( $owner_id );
		if ( isset( $this->load_calls[ $reader_version ] ) ) {
			++$this->load_calls[ $reader_version ];
		}
		if ( $this->failed_reader === $reader_version ) {
			throw new RuntimeException( 'private_reader_' . $reader_version . '_failure' );
		}
		if ( $this->malformed_reader === $reader_version ) {
			return array( 'private' => 'malformed_reader_result' );
		}
		if ( $this->private_result_reader === $reader_version ) {
			return array( 'ok' => false, 'reason_code' => 'private_reader_detail', 'plan' => null );
		}
		if ( MMED_V1_Study_Domain::TRUTH_ABSENT === ( $this->truth['state'] ?? null ) ) {
			if ( '3' !== $reader_version ) {
				throw new RuntimeException( 'private_absent_truth_cross_version' );
			}
			return array( 'ok' => false, 'reason_code' => 'no_truth', 'plan' => null );
		}
		if (
			MMED_V1_Study_Domain::TRUTH_PRESENT !== ( $this->truth['state'] ?? null )
			|| ( $this->truth['schema_version'] ?? null ) !== $reader_version
		) {
			throw new RuntimeException( 'private_cross_version_reader' );
		}
		return array(
			'ok'          => true,
			'reason_code' => 'ok',
			'plan'        => array(
				'contract' => 'synthetic_reader_' . $reader_version,
				'hash'     => hash( 'sha256', 'synthetic_reader_' . $reader_version ),
			),
		);
	}
}

/** Dispatch the exact selected reader once and collapse all private failure detail. */
function v1_8010e_e3_reader_dispatch( $owner_id, $repository, $control ) {
	$failure = array( 'ok' => false, 'reason_code' => 'dependency_unavailable', 'plan' => null );
	$mode = MMED_V1_Study_Access::mode_decision( $owner_id, $repository, $control );
	if ( empty( $mode['resolved'] ) || empty( $mode['reader_allowed'] ) || ! is_string( $mode['reader_version'] ?? null ) ) {
		return $failure;
	}
	try {
		$result = $repository->load( $owner_id, $mode['reader_version'] );
	} catch ( Throwable $error ) {
		unset( $error );
		return $failure;
	}
	if (
		! is_array( $result )
		|| array( 'ok', 'reason_code', 'plan' ) !== array_keys( $result )
		|| ! is_bool( $result['ok'] )
		|| ! is_string( $result['reason_code'] )
		|| (
			true === $result['ok']
			&& ( 'ok' !== $result['reason_code'] || ! is_array( $result['plan'] ) )
		)
		|| (
			false === $result['ok']
			&& (
				null !== $result['plan']
				|| ! in_array( $result['reason_code'], array( 'no_truth', 'plan_corrupt', 'dependency_unavailable' ), true )
			)
		)
	) {
		return $failure;
	}
	return $result;
}

function v1_8010e_e3_reader_present( $version ) {
	return array(
		'state'              => MMED_V1_Study_Domain::TRUTH_PRESENT,
		'schema_version'     => $version,
		'watermark_evidence' => true,
	);
}

$active_control = v1_8010e_e3_reader_control( MMED_V1_Study_Domain::MODE_ACTIVE_READ_WRITE, true, 'approved', false );
v1_8010e_e3_reader_expect( ! empty( $active_control['resolved'] ), 'test-only generation-3 control is valid' );

/* Exact current reader: schema-3 truth may select reader 3 and the V1 writer. */
$current_repository = new V1_8010E_E3_Reader_Selector_Repository( v1_8010e_e3_reader_present( '3' ), array( '3', '2' ) );
$current_mode = MMED_V1_Study_Access::mode_decision( 8103, $current_repository, $active_control );
v1_8010e_e3_reader_expect_same( MMED_V1_Study_Domain::MODE_ACTIVE_READ_WRITE, $current_mode['mode'], 'current truth selects active mode' );
v1_8010e_e3_reader_expect_same( '3', $current_mode['reader_version'], 'current truth selects only reader 3' );
v1_8010e_e3_reader_expect( true === $current_mode['v1_writer_allowed'] && false === $current_mode['legacy_writer_allowed'], 'current active truth permits only the V1 writer' );
$current_result = v1_8010e_e3_reader_dispatch( 8103, $current_repository, $active_control );
v1_8010e_e3_reader_expect( true === $current_result['ok'] && 'synthetic_reader_3' === $current_result['plan']['contract'], 'current dispatch returns reader-3 truth' );
v1_8010e_e3_reader_expect_same( array( '2' => 0, '3' => 1 ), $current_repository->load_calls, 'current dispatch calls reader 3 exactly once' );

/* Exact N-1 reader: schema-2 truth degrades and never invokes the current reader. */
$previous_repository = new V1_8010E_E3_Reader_Selector_Repository( v1_8010e_e3_reader_present( '2' ), array( '3', '2' ) );
$previous_mode = MMED_V1_Study_Access::mode_decision( 8102, $previous_repository, $active_control );
v1_8010e_e3_reader_expect_same( MMED_V1_Study_Domain::MODE_DEGRADED_READ_ONLY, $previous_mode['mode'], 'N-1 truth forces degraded read-only' );
v1_8010e_e3_reader_expect_same( '2', $previous_mode['reader_version'], 'N-1 truth selects only reader 2' );
v1_8010e_e3_reader_expect( false === $previous_mode['v1_writer_allowed'] && false === $previous_mode['legacy_writer_allowed'], 'N-1 truth denies both writers' );
$previous_result = v1_8010e_e3_reader_dispatch( 8102, $previous_repository, $active_control );
v1_8010e_e3_reader_expect( true === $previous_result['ok'] && 'synthetic_reader_2' === $previous_result['plan']['contract'], 'N-1 dispatch returns reader-2 truth' );
v1_8010e_e3_reader_expect_same( array( '2' => 1, '3' => 0 ), $previous_repository->load_calls, 'N-1 dispatch never calls reader 3' );

/* Stop/legacy/hidden requests cannot revive either writer after a watermark. */
foreach (
	array(
		array( MMED_V1_Study_Domain::MODE_LEGACY_PRECUTOVER, false ),
		array( MMED_V1_Study_Domain::MODE_HIDDEN_NO_TRUTH, false ),
		array( MMED_V1_Study_Domain::MODE_DEGRADED_READ_ONLY, true ),
	)
	as $rollback_case
) {
	$rollback_control = v1_8010e_e3_reader_control( $rollback_case[0], false, 'hold', $rollback_case[1] );
	$rollback_repository = new V1_8010E_E3_Reader_Selector_Repository( v1_8010e_e3_reader_present( '2' ), array( '3', '2' ) );
	$rollback_mode = MMED_V1_Study_Access::mode_decision( 8102, $rollback_repository, $rollback_control );
	v1_8010e_e3_reader_expect_same( MMED_V1_Study_Domain::MODE_DEGRADED_READ_ONLY, $rollback_mode['mode'], 'watermark forces degraded mode for rollback request' );
	v1_8010e_e3_reader_expect_same( '2', $rollback_mode['reader_version'], 'rollback request preserves exact N-1 reader' );
	v1_8010e_e3_reader_expect( false === $rollback_mode['v1_writer_allowed'] && false === $rollback_mode['legacy_writer_allowed'], 'rollback request denies both writers' );
}

/* Missing exact reader is unresolved; the alternate reader is never tried. */
$missing_repository = new V1_8010E_E3_Reader_Selector_Repository( v1_8010e_e3_reader_present( '2' ), array( '3' ) );
$missing_mode = MMED_V1_Study_Access::mode_decision( 8102, $missing_repository, $active_control );
v1_8010e_e3_reader_expect( false === $missing_mode['resolved'] && 'reader_unavailable' === $missing_mode['reason_code'], 'missing N-1 reader fails closed' );
v1_8010e_e3_reader_expect_same( array( 'ok' => false, 'reason_code' => 'dependency_unavailable', 'plan' => null ), v1_8010e_e3_reader_dispatch( 8102, $missing_repository, $active_control ), 'missing reader exposes only generic dependency failure' );
v1_8010e_e3_reader_expect_same( array( '2' => 0, '3' => 0 ), $missing_repository->load_calls, 'missing exact reader invokes no alternate' );

/* Reader-3 failure is irrelevant when N-1 is selected; reader-2 failure never falls forward. */
$isolated_previous = new V1_8010E_E3_Reader_Selector_Repository( v1_8010e_e3_reader_present( '2' ), array( '3', '2' ) );
$isolated_previous->failed_reader = '3';
v1_8010e_e3_reader_expect( true === v1_8010e_e3_reader_dispatch( 8102, $isolated_previous, $active_control )['ok'], 'unselected current-reader failure cannot poison N-1' );
v1_8010e_e3_reader_expect_same( array( '2' => 1, '3' => 0 ), $isolated_previous->load_calls, 'N-1 success invokes no current reader' );

$failed_previous = new V1_8010E_E3_Reader_Selector_Repository( v1_8010e_e3_reader_present( '2' ), array( '3', '2' ) );
$failed_previous->failed_reader = '2';
v1_8010e_e3_reader_expect_same( array( 'ok' => false, 'reason_code' => 'dependency_unavailable', 'plan' => null ), v1_8010e_e3_reader_dispatch( 8102, $failed_previous, $active_control ), 'selected N-1 failure is generic and fail closed' );
v1_8010e_e3_reader_expect_same( array( '2' => 1, '3' => 0 ), $failed_previous->load_calls, 'selected N-1 failure never falls forward' );

$malformed_previous = new V1_8010E_E3_Reader_Selector_Repository( v1_8010e_e3_reader_present( '2' ), array( '3', '2' ) );
$malformed_previous->malformed_reader = '2';
v1_8010e_e3_reader_expect_same( array( 'ok' => false, 'reason_code' => 'dependency_unavailable', 'plan' => null ), v1_8010e_e3_reader_dispatch( 8102, $malformed_previous, $active_control ), 'malformed N-1 result is generic and fail closed' );
v1_8010e_e3_reader_expect_same( array( '2' => 1, '3' => 0 ), $malformed_previous->load_calls, 'malformed N-1 result never falls forward' );

$private_previous = new V1_8010E_E3_Reader_Selector_Repository( v1_8010e_e3_reader_present( '2' ), array( '3', '2' ) );
$private_previous->private_result_reader = '2';
v1_8010e_e3_reader_expect_same( array( 'ok' => false, 'reason_code' => 'dependency_unavailable', 'plan' => null ), v1_8010e_e3_reader_dispatch( 8102, $private_previous, $active_control ), 'well-shaped private N-1 failure detail is collapsed' );
v1_8010e_e3_reader_expect_same( array( '2' => 1, '3' => 0 ), $private_previous->load_calls, 'private N-1 failure never falls forward' );

/* Selected current-reader failures never fall back to N-1. */
$missing_current = new V1_8010E_E3_Reader_Selector_Repository( v1_8010e_e3_reader_present( '3' ), array( '2' ) );
$missing_current_mode = MMED_V1_Study_Access::mode_decision( 8103, $missing_current, $active_control );
v1_8010e_e3_reader_expect( false === $missing_current_mode['resolved'] && 'reader_unavailable' === $missing_current_mode['reason_code'], 'missing current reader fails closed' );
v1_8010e_e3_reader_expect_same( array( 'ok' => false, 'reason_code' => 'dependency_unavailable', 'plan' => null ), v1_8010e_e3_reader_dispatch( 8103, $missing_current, $active_control ), 'missing current reader exposes only generic dependency failure' );
v1_8010e_e3_reader_expect_same( array( '2' => 0, '3' => 0 ), $missing_current->load_calls, 'missing current reader invokes no N-1 fallback' );

$failed_current = new V1_8010E_E3_Reader_Selector_Repository( v1_8010e_e3_reader_present( '3' ), array( '3', '2' ) );
$failed_current->failed_reader = '3';
v1_8010e_e3_reader_expect_same( array( 'ok' => false, 'reason_code' => 'dependency_unavailable', 'plan' => null ), v1_8010e_e3_reader_dispatch( 8103, $failed_current, $active_control ), 'selected current-reader failure is generic and fail closed' );
v1_8010e_e3_reader_expect_same( array( '2' => 0, '3' => 1 ), $failed_current->load_calls, 'selected current-reader failure never falls back to N-1' );

$malformed_current = new V1_8010E_E3_Reader_Selector_Repository( v1_8010e_e3_reader_present( '3' ), array( '3', '2' ) );
$malformed_current->malformed_reader = '3';
v1_8010e_e3_reader_expect_same( array( 'ok' => false, 'reason_code' => 'dependency_unavailable', 'plan' => null ), v1_8010e_e3_reader_dispatch( 8103, $malformed_current, $active_control ), 'malformed current-reader result is generic and fail closed' );
v1_8010e_e3_reader_expect_same( array( '2' => 0, '3' => 1 ), $malformed_current->load_calls, 'malformed current-reader result never falls back to N-1' );

/* Before the first operation, only the current reader may be selected. */
$absent = array( 'state' => MMED_V1_Study_Domain::TRUTH_ABSENT, 'schema_version' => null, 'watermark_evidence' => false );
$empty_repository = new V1_8010E_E3_Reader_Selector_Repository( $absent, array( '3', '2' ) );
$empty_mode = MMED_V1_Study_Access::mode_decision( 8104, $empty_repository, $active_control );
v1_8010e_e3_reader_expect_same( MMED_V1_Study_Domain::MODE_ACTIVE_READ_WRITE, $empty_mode['mode'], 'no-truth owner may enter active mode only on current control' );
v1_8010e_e3_reader_expect_same( '3', $empty_mode['reader_version'], 'no-truth owner selects only current reader 3' );
v1_8010e_e3_reader_expect_same( array( 'ok' => false, 'reason_code' => 'no_truth', 'plan' => null ), v1_8010e_e3_reader_dispatch( 8104, $empty_repository, $active_control ), 'current reader positively reports no truth' );
v1_8010e_e3_reader_expect_same( array( '2' => 0, '3' => 1 ), $empty_repository->load_calls, 'no-truth dispatch never calls N-1' );

/* Invalid control, physical mismatch, unknown truth, and repository exceptions deny all readers. */
$same_reader_control = v1_8010e_e3_reader_control( MMED_V1_Study_Domain::MODE_ACTIVE_READ_WRITE, true, 'approved', false, '2', '2' );
v1_8010e_e3_reader_expect( empty( $same_reader_control['resolved'] ), 'current and previous reader equality is rejected by production control validation' );
$invalid_reader_control = v1_8010e_e3_reader_control( MMED_V1_Study_Domain::MODE_ACTIVE_READ_WRITE, true, 'approved', false, '', '2' );
v1_8010e_e3_reader_expect( empty( $invalid_reader_control['resolved'] ), 'invalid reader identifier is rejected by production control validation' );

$mismatched_repository = new V1_8010E_E3_Reader_Selector_Repository( v1_8010e_e3_reader_present( '3' ), array( '3', '2' ), 4 );
$mismatched_mode = MMED_V1_Study_Access::mode_decision( 8103, $mismatched_repository, $active_control );
v1_8010e_e3_reader_expect( false === $mismatched_mode['resolved'] && 'store_provenance_mismatch' === $mismatched_mode['reason_code'], 'physical generation mismatch fails before reader selection' );

$unknown_repository = new V1_8010E_E3_Reader_Selector_Repository(
	array( 'state' => MMED_V1_Study_Domain::TRUTH_UNKNOWN, 'schema_version' => null, 'watermark_evidence' => false ),
	array( '3', '2' )
);
$unknown_mode = MMED_V1_Study_Access::mode_decision( 8103, $unknown_repository, $active_control );
v1_8010e_e3_reader_expect( false === $unknown_mode['resolved'] && 'truth_unknown' === $unknown_mode['reason_code'], 'unknown truth fails before reader selection' );

$throwing_repository = new V1_8010E_E3_Reader_Selector_Repository( v1_8010e_e3_reader_present( '3' ), array( '3', '2' ) );
$throwing_repository->throw_stage = 'truth';
$throwing_mode = MMED_V1_Study_Access::mode_decision( 8103, $throwing_repository, $active_control );
v1_8010e_e3_reader_expect( false === $throwing_mode['resolved'] && 'repository_exception' === $throwing_mode['reason_code'], 'repository exception fails before reader selection' );

/* Production remains honest: generation 2 has reader 2 and no fictional N-1. */
v1_8010e_e3_reader_expect_same( 2, MMED_V1_Study_Week_Schema::GENERATION, 'production Week store remains generation 2' );
v1_8010e_e3_reader_expect_same( '2', MMED_V1_Study_Week_Schema::SCHEMA_VERSION, 'production Week store remains schema 2' );
v1_8010e_e3_reader_expect_same( '2', MMED_V1_Study_Week_Schema::CURRENT_READER_VERSION, 'production current reader remains 2' );
v1_8010e_e3_reader_expect_same( null, MMED_V1_Study_Week_Schema::PREVIOUS_READER_VERSION, 'production previous reader remains null' );

$physical_source = file_get_contents( $root . '/wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-innodb-repository.php' );
$physical_start = is_string( $physical_source ) ? strpos( $physical_source, 'final class MMED_V1_Study_InnoDB_Repository' ) : false;
v1_8010e_e3_reader_expect( false !== $physical_start, 'physical repository source is readable and bounded' );
$physical_class = substr( $physical_source, $physical_start );
v1_8010e_e3_reader_expect( false !== strpos( $physical_class, "? array( '2' ) : array();" ), 'physical repository advertises only implemented reader 2' );
v1_8010e_e3_reader_expect( false !== strpos( $physical_class, "|| '2' !== \$reader_version" ), 'physical repository rejects every fictional reader' );
v1_8010e_e3_reader_expect( false === strpos( $physical_class, "array( '2', '1' )" ), 'physical repository does not claim reader 1' );

echo "V1 Study Schedule 8010E E3 exact-reader rollback contract: ok\n";
