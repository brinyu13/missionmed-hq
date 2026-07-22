<?php
/** Pure default-off runtime, actor, temporal, and schema contract. */

define( 'ABSPATH', __DIR__ . '/' );

$root = dirname( __DIR__, 2 );
$includes = $root . '/wp-content/plugins/missionmed-hub/includes/';
$GLOBALS['v1_rc_hooks'] = array();
$GLOBALS['v1_rc_actor'] = 44;
$GLOBALS['v1_rc_logged_in'] = true;
$GLOBALS['v1_rc_roles'] = array( 'subscriber' );
$GLOBALS['v1_rc_entitlement_filters'] = 0;
$GLOBALS['v1_rc_user_timezone'] = '';

function add_action( $hook, $callback ) {
	$GLOBALS['v1_rc_hooks'][] = array( 'action', $hook, $callback );
}
function add_filter( $hook, $callback ) {
	$GLOBALS['v1_rc_hooks'][] = array( 'filter', $hook, $callback );
}
function apply_filters( $hook, $value ) {
	if ( 'mmed_v1_study_entitlement_provider' === $hook ) {
		$GLOBALS['v1_rc_entitlement_filters']++;
	}
	return $value;
}
function is_user_logged_in() {
	return $GLOBALS['v1_rc_logged_in'];
}
function get_current_user_id() {
	return $GLOBALS['v1_rc_actor'];
}
function user_can( $actor_id, $capability ) {
	return 'manage_options' === $capability && in_array( 'administrator', $GLOBALS['v1_rc_roles'], true );
}
function get_userdata( $actor_id ) {
	unset( $actor_id );
	return (object) array( 'roles' => $GLOBALS['v1_rc_roles'] );
}
function get_user_meta( $owner_id, $key, $single ) {
	unset( $owner_id, $key, $single );
	return $GLOBALS['v1_rc_user_timezone'];
}
function wp_timezone_string() {
	return 'America/New_York';
}
function mmhq_cam_build_entitlement( $user_id ) {
	return array(
		'product'                 => 'cam',
		'source'                  => 'wordpress_learndash_handoff',
		'active'                  => true,
		'status'                  => 'active',
		'verified'                => true,
		'trusted'                 => true,
		'current_access_verified' => true,
		'revocation_checked'      => true,
		'enrollment_verified'     => true,
		'restricted'              => false,
		'revoked'                 => false,
		'authority_mode'          => 'learndash_current_access',
		'purchase_verified'       => false,
		'purchase_match_found'    => false,
		'course_ids'              => array( 360 ),
		'evaluated_at'            => '2026-07-22T12:00:00Z',
		'expires_at'              => '2026-07-23T12:00:00Z',
	);
}

function v1_rc_expect( $condition, $message ) {
	if ( ! $condition ) {
		throw new RuntimeException( $message );
	}
}

require_once $includes . 'class-mmed-v1-study-runtime.php';
v1_rc_expect( false === MMED_V1_Study_Runtime::enabled(), 'runtime is disabled when the binding constant is absent' );
MMED_V1_Study_Runtime::init();
v1_rc_expect( array() === $GLOBALS['v1_rc_hooks'], 'absent binding registers zero hooks' );
v1_rc_expect( ! class_exists( 'MMED_V1_Study_REST_API', false ), 'absent binding does not load REST runtime' );
v1_rc_expect( ! class_exists( 'MMED_V1_Study_Loader', false ), 'absent binding does not load browser runtime' );

require_once $includes . 'class-mmed-v1-study-domain.php';
require_once $includes . 'class-mmed-v1-study-release.php';
require_once $includes . 'class-mmed-v1-study-repository.php';
require_once $includes . 'class-mmed-v1-study-access.php';
require_once $includes . 'class-mmed-v1-study-week-schema.php';
require_once $includes . 'class-mmed-v1-study-week-domain.php';
require_once $includes . 'class-mmed-v1-study-runtime-schema.php';
require_once $includes . 'class-mmed-v1-study-runtime-actor.php';
require_once $includes . 'class-mmed-v1-study-temporal-context.php';

final class V1_RC_Entitlement_Provider implements MMED_V1_Study_Entitlement_Provider {
	public function claim( $user_id ) {
		return array(
			'product'                 => 'cam',
			'source'                  => 'wordpress_learndash_handoff',
			'active'                  => true,
			'status'                  => 'active',
			'verified'                => true,
			'trusted'                 => true,
			'current_access_verified' => true,
			'revocation_checked'      => true,
			'enrollment_verified'      => true,
			'restricted'              => false,
			'revoked'                 => false,
			'authority_mode'          => 'learndash_current_access',
			'purchase_verified'        => false,
			'purchase_match_found'     => false,
			'course_ids'               => array( 360 ),
			'evaluated_at'             => '2026-07-22T12:00:00Z',
			'expires_at'               => '2026-07-23T12:00:00Z',
		);
	}
}

$actor = MMED_V1_Study_Runtime_Actor::resolve( strtotime( '2026-07-22T12:00:30Z' ), new V1_RC_Entitlement_Provider() );
v1_rc_expect( true === $actor['allowed'] && 44 === $actor['owner_id'] && 'learner' === $actor['actor_kind'], 'direct actor resolver binds entitled learner to self' );
v1_rc_expect( 1 === preg_match( '/^[a-f0-9]{64}$/D', $actor['entitlement_digest'] ), 'actor resolver emits only a normalized entitlement digest' );
$actor = MMED_V1_Study_Runtime_Actor::resolve( strtotime( '2026-07-22T12:00:30Z' ) );
v1_rc_expect( true === $actor['allowed'], 'runtime actor uses the direct WordPress entitlement adapter' );
v1_rc_expect( 0 === $GLOBALS['v1_rc_entitlement_filters'], 'runtime actor never consults the legacy entitlement filter' );
$GLOBALS['v1_rc_roles'] = array( 'mentor' );
v1_rc_expect( false === MMED_V1_Study_Runtime_Actor::resolve( strtotime( '2026-07-22T12:00:30Z' ), new V1_RC_Entitlement_Provider() )['allowed'], 'mentor role cannot enter learner runtime' );
$GLOBALS['v1_rc_roles'] = array( 'subscriber' );

$temporal = MMED_V1_Study_Temporal_Context::for_week( '2026-07-20' );
v1_rc_expect( 'America/New_York' === $temporal['timezone'] && '2026-07-20' === $temporal['week_start'], 'temporal envelope is server-owned and Monday-bound' );
v1_rc_expect( 1 === preg_match( '/^[a-f0-9]{64}$/D', $temporal['context'] ), 'temporal envelope has an exact context digest' );
$GLOBALS['v1_rc_user_timezone'] = '+05:30';
$temporal = MMED_V1_Study_Temporal_Context::for_week( '2026-07-20', 44 );
v1_rc_expect( '+05:30' === $temporal['timezone'], 'learner profile overrides the site timezone with a valid fixed offset' );
$slot = MMED_V1_Study_Week_Domain::resolve_slot_from_envelope( '2026-07-20', '06:00', 30, null, $temporal );
v1_rc_expect( '2026-07-20 00:30:00.000000' === $slot['start_at_utc'], 'fixed-offset civil time resolves to exact UTC' );
v1_rc_expect( 'UTC' === MMED_V1_Study_Temporal_Context::normalize_timezone( '+00:00' ), 'zero offset canonicalizes to UTC' );

$database = (object) array( 'prefix' => 'wp_' );
$migrations = MMED_V1_Study_Runtime_Schema::migrations( $database );
v1_rc_expect( 3 === count( $migrations ), 'runtime schema exposes exactly three additive descriptors' );
foreach ( $migrations as $index => $migration ) {
	v1_rc_expect( $index + 1 === $migration['version'], 'runtime migration ordering is stable' );
	v1_rc_expect( 1 === preg_match( '/^[a-f0-9]{64}$/D', $migration['checksum_hex'] ), 'runtime migration has an exact checksum' );
}
v1_rc_expect( false !== strpos( $migrations[0]['sql'], 'mmed_v1ss_runtime_permits' ), 'permit schema is explicit' );
v1_rc_expect( false !== strpos( $migrations[2]['sql'], '( `user_id`, `event_type`, `id`)' ) || false !== strpos( $migrations[2]['sql'], '(`user_id`, `event_type`, `id`)' ), 'Calendar owner/type/id index is explicit' );

$plugin = (string) file_get_contents( $root . '/wp-content/plugins/missionmed-hub/missionmed-hub.php' );
v1_rc_expect( 1 === substr_count( $plugin, 'MMED_V1_Study_Runtime::init();' ), 'plugin has one V1 runtime initializer' );
v1_rc_expect( false === strpos( $plugin, 'MMED_V1_Study_REST_API::init();' ), 'plugin does not directly initialize V1 REST' );
v1_rc_expect( false === strpos( $plugin, 'MMED_V1_Study_Loader::init();' ), 'plugin does not directly initialize V1 loader' );
v1_rc_expect( false === strpos( $plugin, 'MMED_V1_Study_Migrator' ), 'plugin boot cannot invoke the V1 migrator' );

echo "V1 Study Schedule RC runtime foundation: ok\n";
