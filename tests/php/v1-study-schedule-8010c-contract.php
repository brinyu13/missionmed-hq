<?php
/**
 * Deterministic 8010C control, mode, entitlement, actor, and isolation proof.
 */

declare(strict_types=1);

define( 'ABSPATH', __DIR__ . '/' );

$GLOBALS['v1_test_logged_in'] = true;
$GLOBALS['v1_test_user_id']   = 10;
$GLOBALS['v1_test_admin_ids'] = array();
$GLOBALS['v1_test_filters']   = array();
$GLOBALS['v1_test_options']   = array();

function absint( $value ) {
	return abs( (int) $value );
}

function is_user_logged_in() {
	return true === $GLOBALS['v1_test_logged_in'];
}

function get_current_user_id() {
	return (int) $GLOBALS['v1_test_user_id'];
}

function user_can( $user_id, $capability ) {
	return 'manage_options' === $capability && in_array( (int) $user_id, $GLOBALS['v1_test_admin_ids'], true );
}

function get_option( $key, $default = false ) {
	return array_key_exists( $key, $GLOBALS['v1_test_options'] ) ? $GLOBALS['v1_test_options'][ $key ] : $default;
}

function apply_filters( $hook, $value ) {
	$args = func_get_args();
	if ( isset( $GLOBALS['v1_test_filters'][ $hook ] ) ) {
		return call_user_func_array( $GLOBALS['v1_test_filters'][ $hook ], array_slice( $args, 1 ) );
	}
	return $value;
}

function v1_expect_same( $expected, $actual, $label ) {
	if ( $expected !== $actual ) {
		throw new RuntimeException( $label . ': expected ' . var_export( $expected, true ) . ', got ' . var_export( $actual, true ) );
	}
}

function v1_expect_true( $actual, $label ) {
	v1_expect_same( true, true === $actual, $label );
}

$root = dirname( __DIR__, 2 );
require_once $root . '/wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-domain.php';
require_once $root . '/wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-release.php';
require_once $root . '/wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-repository.php';
require_once $root . '/wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-access.php';
require_once $root . '/wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-observability.php';

function v1_store_record( $state = 'never_commissioned' ) {
	$record = array(
		'contract_version' => 1,
		'state'            => $state,
		'generation'       => 1,
	);
	if ( 'commissioned' === $state ) {
		$record['store_id']        = 'v1_synthetic_store';
		$record['commissioned_at'] = '2026-07-15T00:00:00Z';
	}
	return $record;
}

function v1_release_record( $mode, $exposure, $decision_12, $stop, $current = '1', $previous = null ) {
	$record = array(
		'contract_version'        => 1,
		'generation'              => 1,
		'mode'                    => $mode,
		'exposure'                => (bool) $exposure,
		'decision_12_state'       => $decision_12,
		'stop'                    => (bool) $stop,
		'release_digest'          => MMED_V1_Study_Release::RELEASE_SHA256,
		'current_reader_version'  => $current,
		'previous_reader_version' => $previous,
		'effective_at'            => '2026-07-15T00:00:00Z',
		'reason'                  => 'synthetic_fixture',
	);
	if ( 'approved' === $decision_12 ) {
		$record['policy_version'] = 'synthetic-policy-v1';
	}
	return $record;
}

function v1_control( $store_state, $mode, $exposure, $decision_12, $stop = false, $current = '1', $previous = null ) {
	return MMED_V1_Study_Control::from_records(
		v1_store_record( $store_state ),
		v1_release_record( $mode, $exposure, $decision_12, $stop, $current, $previous )
	);
}

final class V1_Test_Repository implements MMED_V1_Study_Repository {
	public $calls = 0;
	private $provenance;
	private $readers;

	public function __construct( $provenance, $readers ) {
		$this->provenance = $provenance;
		$this->readers    = $readers;
	}

	public function binding_kind() {
		return MMED_V1_Study_Domain::BINDING_READY;
	}

	public function store_provenance() {
		return array( 'state' => 'commissioned', 'store_id' => 'v1_synthetic_store', 'generation' => 1 );
	}

	public function cutover_provenance( $owner_id ) {
		$this->calls++;
		return (int) $owner_id > 0
			? $this->provenance
			: array( 'state' => 'unknown', 'schema_version' => null, 'watermark_evidence' => false );
	}

	public function compatible_reader_versions() {
		return $this->readers;
	}

	public function load( $owner_id, $reader_version ) {
		return array( 'ok' => true, 'owner' => (int) $owner_id, 'reader' => $reader_version );
	}
}

final class V1_Test_Entitlement_Provider implements MMED_V1_Study_Entitlement_Provider {
	public $calls = 0;
	public $claim_value;
	public $throws = false;

	public function __construct( $claim_value ) {
		$this->claim_value = $claim_value;
	}

	public function claim( $user_id ) {
		$this->calls++;
		if ( $this->throws ) {
			throw new RuntimeException( 'synthetic provider failure' );
		}
		return $this->claim_value;
	}
}

final class V1_Test_Assignment_Provider implements MMED_V1_Study_Assignment_Provider {
	public $assigned = true;
	public $calls    = 0;

	public function is_assigned( $mentor_id, $owner_id ) {
		$this->calls++;
		return $this->assigned && 30 === (int) $mentor_id && 10 === (int) $owner_id;
	}
}

function v1_claim( $authority = 'woo' ) {
	$woo = 'woo' === $authority;
	return array(
		'product'                 => 'cam',
		'source'                  => 'wordpress_learndash_handoff',
		'verified'                => true,
		'trusted'                 => true,
		'active'                  => true,
		'status'                  => 'active',
		'course_ids'              => array( '3893' ),
		'restricted'              => false,
		'revoked'                 => false,
		'current_access_verified' => true,
		'purchase_verified'       => $woo,
		'purchase_match_found'    => $woo,
		'enrollment_verified'     => true,
		'authority_mode'          => $woo ? 'learndash_and_woocommerce' : 'learndash_current_access',
		'revocation_checked'      => true,
		'expires_at'              => '2026-07-16T00:00:00Z',
		'evaluated_at'            => '2026-07-15T00:00:00Z',
	);
}

$now = strtotime( '2026-07-15T00:00:30Z' );

// Missing or malformed control is unresolved and never implies no store.
$missing_control = MMED_V1_Study_Control::from_records( null, null );
v1_expect_same( false, $missing_control['resolved'], 'missing control is unresolved' );
$missing_repository = new MMED_V1_Study_Null_Repository( $missing_control );
v1_expect_same( MMED_V1_Study_Domain::BINDING_UNAVAILABLE, $missing_repository->binding_kind(), 'missing control binding unavailable' );
v1_expect_same( MMED_V1_Study_Domain::TRUTH_UNKNOWN, $missing_repository->cutover_provenance( 10 )['state'], 'missing control truth unknown' );
v1_expect_same( 'dependency_unavailable', $missing_repository->load( 10, '1' )['reason_code'], 'missing control null load fails closed' );

$torn_release = v1_release_record( MMED_V1_Study_Domain::MODE_HIDDEN_NO_TRUTH, false, 'hold', false );
$torn_release['generation'] = 2;
$torn_control = MMED_V1_Study_Control::from_records( v1_store_record(), $torn_release );
v1_expect_same( false, $torn_control['resolved'], 'torn control generations are unresolved' );
$wrong_digest = v1_release_record( MMED_V1_Study_Domain::MODE_HIDDEN_NO_TRUTH, false, 'hold', false );
$wrong_digest['release_digest'] = str_repeat( '0', 64 );
$wrong_digest_control = MMED_V1_Study_Control::from_records( v1_store_record(), $wrong_digest );
v1_expect_same( false, $wrong_digest_control['resolved'], 'unrecognized release digest is unresolved' );

// Explicit never-commissioned + hold is hidden, read-only for V1, and may keep legacy.
$hold_control = v1_control( 'never_commissioned', MMED_V1_Study_Domain::MODE_HIDDEN_NO_TRUTH, false, 'hold' );
v1_expect_same( true, $hold_control['resolved'], 'explicit hold control validates' );
$hold_repository = new MMED_V1_Study_Null_Repository( $hold_control );
$hold_mode       = MMED_V1_Study_Access::mode_decision( 10, $hold_repository, $hold_control );
v1_expect_same( MMED_V1_Study_Domain::MODE_HIDDEN_NO_TRUTH, $hold_mode['mode'], 'hold is hidden' );
v1_expect_same( false, $hold_mode['exposure_allowed'], 'hold denies exposure' );
v1_expect_same( false, $hold_mode['reader_allowed'], 'hold denies reader' );
v1_expect_same( false, $hold_mode['v1_writer_allowed'], 'hold denies V1 writer' );
v1_expect_same( true, $hold_mode['legacy_writer_allowed'], 'positive pre-watermark hold permits legacy writer' );
v1_expect_same( 'no_truth', $hold_repository->load( 10, '1' )['reason_code'], 'never-commissioned null load is no truth' );
v1_expect_same( false, method_exists( $hold_repository, 'commit' ), '8010C repository has no commit seam' );

// Post-watermark mode always degrades unless the exact current writer is approved.
$present = array( 'state' => 'present', 'schema_version' => '1', 'watermark_evidence' => true );
$present_repository = new V1_Test_Repository( $present, array( '1' ) );
foreach ( array( MMED_V1_Study_Domain::MODE_LEGACY_PRECUTOVER, MMED_V1_Study_Domain::MODE_HIDDEN_NO_TRUTH, MMED_V1_Study_Domain::MODE_DEGRADED_READ_ONLY ) as $requested_mode ) {
	$control = v1_control( 'commissioned', $requested_mode, false, 'hold', true );
	$mode    = MMED_V1_Study_Access::mode_decision( 10, $present_repository, $control );
	v1_expect_same( MMED_V1_Study_Domain::MODE_DEGRADED_READ_ONLY, $mode['mode'], 'watermark forces degraded mode for ' . $requested_mode );
	v1_expect_same( true, $mode['reader_allowed'], 'watermark retains compatible reader' );
	v1_expect_same( false, $mode['v1_writer_allowed'], 'watermark degraded denies V1 writer' );
	v1_expect_same( false, $mode['legacy_writer_allowed'], 'watermark degraded denies legacy writer' );
}

$reader_missing = new V1_Test_Repository( $present, array() );
$reader_failure = MMED_V1_Study_Access::mode_decision(
	10,
	$reader_missing,
	v1_control( 'commissioned', MMED_V1_Study_Domain::MODE_DEGRADED_READ_ONLY, true, 'approved' )
);
v1_expect_same( false, $reader_failure['resolved'], 'post-watermark missing reader unresolved' );
v1_expect_same( false, $reader_failure['legacy_writer_allowed'], 'missing reader cannot restore legacy writer' );

$n_minus_one_repository = new V1_Test_Repository( $present, array( '2', '1' ) );
$n_minus_one_mode = MMED_V1_Study_Access::mode_decision(
	10,
	$n_minus_one_repository,
	v1_control( 'commissioned', MMED_V1_Study_Domain::MODE_ACTIVE_READ_WRITE, true, 'approved', false, '2', '1' )
);
v1_expect_same( MMED_V1_Study_Domain::MODE_DEGRADED_READ_ONLY, $n_minus_one_mode['mode'], 'N-1 truth cannot use current writer' );
v1_expect_same( '1', $n_minus_one_mode['reader_version'], 'N-1 truth selects actual reader' );

$absent = array( 'state' => 'absent', 'schema_version' => null, 'watermark_evidence' => false );
$ready_repository = new V1_Test_Repository( $absent, array( '1' ) );
$active_control   = v1_control( 'commissioned', MMED_V1_Study_Domain::MODE_ACTIVE_READ_WRITE, true, 'approved' );
$active_mode      = MMED_V1_Study_Access::mode_decision( 10, $ready_repository, $active_control );
v1_expect_same( MMED_V1_Study_Domain::MODE_ACTIVE_READ_WRITE, $active_mode['mode'], 'approved current reader can start first operation' );
v1_expect_same( true, $active_mode['v1_writer_allowed'], 'active mode permits only V1 writer' );
v1_expect_same( false, $active_mode['legacy_writer_allowed'], 'active mode denies legacy writer' );

// A reverted never-commissioned record cannot hide a physically commissioned store.
$GLOBALS['v1_test_options'][ MMED_V1_Study_Release::STORE_OPTION ]   = v1_store_record( 'never_commissioned' );
$GLOBALS['v1_test_options'][ MMED_V1_Study_Release::RELEASE_OPTION ] = v1_release_record( MMED_V1_Study_Domain::MODE_LEGACY_PRECUTOVER, false, 'hold', false );
$GLOBALS['v1_test_filters']['mmed_v1_study_repository'] = static function () use ( $ready_repository ) {
	return $ready_repository;
};
$reverted_binding = MMED_V1_Study_Repository_Provider::get();
v1_expect_same( MMED_V1_Study_Domain::BINDING_UNAVAILABLE, $reverted_binding->binding_kind(), 'physical commissioning mismatch fails closed' );
$reverted_mode = MMED_V1_Study_Access::mode_decision( 10, $reverted_binding, v1_control( 'never_commissioned', MMED_V1_Study_Domain::MODE_LEGACY_PRECUTOVER, false, 'hold' ) );
v1_expect_same( false, $reverted_mode['resolved'], 'reverted commissioning record cannot reopen legacy mode' );
unset( $GLOBALS['v1_test_filters']['mmed_v1_study_repository'] );

// Exact claim normalization: both accepted authority tuples and no raw course data.
$normalized_keys = array( 'subject_id', 'product_scope', 'allowed', 'reason_code', 'authority_mode', 'evaluated_at', 'expires_at', 'contract_version', 'dependency_error' );
foreach ( array( 'woo', 'legacy' ) as $authority ) {
	$normalized = MMED_V1_Study_Entitlement::evaluate_claim( v1_claim( $authority ), 10, $now );
	v1_expect_same( true, $normalized['allowed'], $authority . ' authority is accepted' );
	v1_expect_same( $normalized_keys, array_keys( $normalized ), $authority . ' normalization has exact allowlist' );
	v1_expect_same( false, array_key_exists( 'course_ids', $normalized ), $authority . ' normalization omits raw course data' );
}

$mutations = array(
	array( 'product', 'wrong' ),
	array( 'source', 'wrong' ),
	array( 'active', false ),
	array( 'status', 'revoked' ),
	array( 'verified', false ),
	array( 'trusted', false ),
	array( 'current_access_verified', false ),
	array( 'revocation_checked', false ),
	array( 'enrollment_verified', false ),
	array( 'restricted', true ),
	array( 'revoked', true ),
	array( 'course_ids', array( 0 ) ),
	array( 'evaluated_at', '2026-07-15T00:00:31Z' ),
	array( 'expires_at', '2026-07-15T00:00:29Z' ),
);
foreach ( $mutations as $mutation ) {
	$claim = v1_claim();
	$claim[ $mutation[0] ] = $mutation[1];
	$result = MMED_V1_Study_Entitlement::evaluate_claim( $claim, 10, $now );
	v1_expect_same( false, $result['allowed'], 'claim mutation denies ' . $mutation[0] );
}
$stale_claim = v1_claim();
$stale_claim['evaluated_at'] = '2026-07-14T23:59:29Z';
v1_expect_same( false, MMED_V1_Study_Entitlement::evaluate_claim( $stale_claim, 10, $now )['allowed'], 'claim older than 60 seconds denied' );
$boundary_claim = v1_claim();
$boundary_claim['evaluated_at'] = '2026-07-14T23:59:30Z';
v1_expect_same( true, MMED_V1_Study_Entitlement::evaluate_claim( $boundary_claim, 10, $now )['allowed'], 'exact 60-second boundary accepted' );

$provider = new V1_Test_Entitlement_Provider( v1_claim() );
$provider->throws = true;
$provider_failure = MMED_V1_Study_Entitlement::evaluate( 10, $now, $provider );
v1_expect_same( true, $provider_failure['dependency_error'], 'provider exception is dependency failure' );

$admin_override_shape = array( 'active' => true, 'status' => 'admin_override' );
v1_expect_same( false, MMED_V1_Study_Entitlement::evaluate_claim( $admin_override_shape, 20, $now )['allowed'], 'admin override shape denied' );

// Actor/action/assignment matrix.
$provider   = new V1_Test_Entitlement_Provider( v1_claim() );
$assignment = new V1_Test_Assignment_Provider();
$GLOBALS['v1_test_user_id'] = 10;
$unknown_with_claim = MMED_V1_Study_Access::authorize_rest( MMED_V1_Study_Domain::ACTION_PLAN_READ, 10, array(), true, $ready_repository, $now, $provider, $assignment, $active_control );
v1_expect_same( 404, $unknown_with_claim['status'], 'entitlement alone cannot promote unknown actor to learner' );
$GLOBALS['v1_test_filters']['mmed_v1_study_actor_kind'] = static function ( $default, $actor_id ) {
	unset( $default );
	return 30 === (int) $actor_id ? 'mentor' : ( 10 === (int) $actor_id ? 'learner' : 'unknown' );
};

$learner_allowed = array(
	MMED_V1_Study_Domain::ACTION_PLAN_READ,
	MMED_V1_Study_Domain::ACTION_PLAN_COMMAND,
	MMED_V1_Study_Domain::ACTION_IMPORT_PREVIEW,
	MMED_V1_Study_Domain::ACTION_IMPORT_COMMIT,
	MMED_V1_Study_Domain::ACTION_COMPLETE,
	MMED_V1_Study_Domain::ACTION_PARTIALLY_RESOLVE,
	MMED_V1_Study_Domain::ACTION_MOVE,
	MMED_V1_Study_Domain::ACTION_RESERVE,
	MMED_V1_Study_Domain::ACTION_RELEASE,
	MMED_V1_Study_Domain::ACTION_RECOVER,
	MMED_V1_Study_Domain::ACTION_MENTOR_PROPOSAL_READ,
	MMED_V1_Study_Domain::ACTION_MENTOR_PROPOSAL_RESOLVE,
);
$all_actions = array_merge(
	$learner_allowed,
	array(
		MMED_V1_Study_Domain::ACTION_MENTOR_PROPOSAL_SUBMIT,
		MMED_V1_Study_Domain::ACTION_MENTOR_PROPOSAL_WITHDRAW,
		MMED_V1_Study_Domain::ACTION_AUDIT_READ,
	)
);

$GLOBALS['v1_test_user_id'] = 10;
foreach ( array_values( array_unique( $all_actions ) ) as $action ) {
	$fields = MMED_V1_Study_Domain::ACTION_PLAN_COMMAND === $action ? array( 'command' => 'move', 'payload' => array( 'block' => 'synthetic' ) ) : array();
	$decision = MMED_V1_Study_Access::authorize_rest( $action, 10, $fields, true, $ready_repository, $now, $provider, $assignment, $active_control );
	v1_expect_same( in_array( $action, $learner_allowed, true ), ! empty( $decision['allowed'] ), 'learner action matrix ' . $action );
}

$GLOBALS['v1_test_user_id']   = 20;
$GLOBALS['v1_test_admin_ids'] = array( 20 );
foreach ( array_values( array_unique( $all_actions ) ) as $action ) {
	$decision = MMED_V1_Study_Access::authorize_rest( $action, 10, array(), true, $ready_repository, $now, $provider, $assignment, $active_control );
	v1_expect_same( MMED_V1_Study_Domain::ACTION_AUDIT_READ === $action, ! empty( $decision['allowed'] ), 'administrator action matrix ' . $action );
}

$GLOBALS['v1_test_user_id']   = 30;
$GLOBALS['v1_test_admin_ids'] = array();
$mentor_allowed = array(
	MMED_V1_Study_Domain::ACTION_MENTOR_PROPOSAL_READ,
	MMED_V1_Study_Domain::ACTION_MENTOR_PROPOSAL_SUBMIT,
	MMED_V1_Study_Domain::ACTION_MENTOR_PROPOSAL_WITHDRAW,
);
foreach ( array_values( array_unique( $all_actions ) ) as $action ) {
	$decision = MMED_V1_Study_Access::authorize_rest( $action, 10, array(), true, $ready_repository, $now, $provider, $assignment, $active_control );
	v1_expect_same( in_array( $action, $mentor_allowed, true ), ! empty( $decision['allowed'] ), 'mentor action matrix ' . $action );
}
$assignment->assigned = false;
$unassigned = MMED_V1_Study_Access::authorize_rest( MMED_V1_Study_Domain::ACTION_MENTOR_PROPOSAL_READ, 10, array(), true, $ready_repository, $now, $provider, $assignment, $active_control );
v1_expect_same( 404, $unassigned['status'], 'unassigned mentor denied non-enumerating' );
$assignment->assigned = true;
$foreign_owner = MMED_V1_Study_Access::authorize_rest( MMED_V1_Study_Domain::ACTION_MENTOR_PROPOSAL_READ, 11, array(), true, $ready_repository, $now, $provider, $assignment, $active_control );
v1_expect_same( 404, $foreign_owner['status'], 'mentor foreign assignment denied non-enumerating' );

$GLOBALS['v1_test_user_id'] = 10;
$nested = MMED_V1_Study_Access::authorize_rest(
	MMED_V1_Study_Domain::ACTION_PLAN_COMMAND,
	10,
	array( 'command' => 'move', 'payload' => array( 'owner_id' => 11 ) ),
	true,
	$ready_repository,
	$now,
	$provider,
	$assignment,
	$active_control
);
v1_expect_same( 422, $nested['status'], 'nested owner mass assignment denied' );
$forbidden_field = MMED_V1_Study_Access::authorize_rest( MMED_V1_Study_Domain::ACTION_PLAN_COMMAND, 10, array( 'role' => 'administrator' ), true, $ready_repository, $now, $provider, $assignment, $active_control );
v1_expect_same( 422, $forbidden_field['status'], 'forbidden top-level field denied' );
$unknown_action = MMED_V1_Study_Access::authorize_rest( 'unknown_action', 10, array(), true, $ready_repository, $now, $provider, $assignment, $active_control );
v1_expect_same( 422, $unknown_action['status'], 'unknown action denied' );

$GLOBALS['v1_test_filters']['mmed_v1_study_actor_kind'] = static function () {
	return array( 'learner' );
};
$denied_provider = new V1_Test_Entitlement_Provider( array() );
$unknown_actor = MMED_V1_Study_Access::authorize_rest( MMED_V1_Study_Domain::ACTION_PLAN_READ, 10, array(), true, $ready_repository, $now, $denied_provider, $assignment, $active_control );
v1_expect_same( false, $unknown_actor['allowed'], 'non-scalar actor kind stays unknown' );

// Observability is structural, bounded, and resettable.
MMED_V1_Study_Observability::reset();
$event = MMED_V1_Study_Observability::record(
	'authorization_decision',
	array(
		'actor_kind' => 'learner',
		'reason_code' => 'allowed',
		'learner_content' => 'must-not-appear',
		'owner_id' => 10,
	)
);
v1_expect_same( false, array_key_exists( 'learner_content', $event ), 'observability drops arbitrary learner content' );
v1_expect_same( false, array_key_exists( 'owner_id', $event ), 'observability drops owner IDs' );
for ( $index = 0; $index < 25; $index++ ) {
	MMED_V1_Study_Observability::record( 'bootstrap_decision', array( 'reason_code' => 'fixture_' . $index ) );
}
v1_expect_same( 20, count( MMED_V1_Study_Observability::request_buffer() ), 'observability buffer is bounded' );
MMED_V1_Study_Observability::reset();
v1_expect_same( 0, count( MMED_V1_Study_Observability::request_buffer() ), 'observability reset clears request state' );

// Static writer and Calendar isolation. The E3 owner-arbiter is an explicitly
// unbound synthetic proof that must inspect the Calendar table; keep that
// narrow exception visible and prove that the plugin bootstrap cannot load it.
$v1_files = glob( $root . '/wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-*.php' );
$plugin_source = (string) file_get_contents( $root . '/wp-content/plugins/missionmed-hub/missionmed-hub.php' );
foreach ( $v1_files as $file ) {
	if ( 'class-mmed-v1-study-owner-arbiter.php' === basename( $file ) ) {
		v1_expect_same( false, false !== strpos( $plugin_source, basename( $file ) ), 'E3 owner arbiter remains absent from plugin bootstrap' );
		v1_expect_same( false, false !== strpos( $plugin_source, 'MMED_V1_Study_Owner_Arbiter' ), 'E3 owner arbiter remains uninstantiated by plugin bootstrap' );
		continue;
	}
	$source = (string) file_get_contents( $file );
	v1_expect_same( 0, preg_match( '/MMED_Calendar_Engine|(?:wp_)?mmed_events/', $source ), basename( $file ) . ' has no Calendar dependency' );
}
$repository_source = (string) file_get_contents( $root . '/wp-content/plugins/missionmed-hub/includes/class-mmed-v1-study-repository.php' );
v1_expect_same( 0, preg_match( '/function\s+commit\s*\(/', $repository_source ), '8010C repository source has no commit method' );

echo "V1 Study Schedule 8010C deterministic contract: ok\n";
