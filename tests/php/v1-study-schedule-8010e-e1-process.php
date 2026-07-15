<?php
/** Independent-process E1 lock compatibility and SIGKILL restart proof. */

function v1_8010e_e1_process_expect( $condition, $message ) {
	if ( ! $condition ) {
		throw new RuntimeException( $message );
	}
}

function v1_8010e_e1_process_uuid( $counter, $lane ) {
	return sprintf( '%08x-%04x-4%03x-8%03x-%012x', $lane, $counter & 0xffff, $counter & 0xfff, $lane & 0xfff, $counter );
}

function v1_8010e_e1_process_start( $mode, $prefix, $store, $runner, $target = '' ) {
	$worker = __DIR__ . '/v1-study-schedule-8010e-e1-worker.php';
	$command = 'exec ' . implode(
		' ',
		array_map( 'escapeshellarg', array( PHP_BINARY, $worker, $mode, $prefix, $store, $runner, $target ) )
	);
	$spec = array(
		0 => array( 'pipe', 'r' ),
		1 => array( 'pipe', 'w' ),
		2 => array( 'pipe', 'w' ),
	);
	$pipes = array();
	$process = proc_open( $command, $spec, $pipes );
	if ( ! is_resource( $process ) ) {
		throw new RuntimeException( 'e1_worker_start_failed' );
	}
	return array( 'process' => $process, 'pipes' => $pipes );
}

function v1_8010e_e1_process_line( $pipe, $timeout_seconds = 30 ) {
	stream_set_blocking( $pipe, false );
	$buffer = '';
	$deadline = microtime( true ) + $timeout_seconds;
	while ( microtime( true ) < $deadline ) {
		$read = array( $pipe );
		$write = null;
		$except = null;
		$left = max( 0.0, $deadline - microtime( true ) );
		$seconds = (int) floor( $left );
		$microseconds = (int) ( ( $left - $seconds ) * 1000000 );
		$ready = stream_select( $read, $write, $except, $seconds, $microseconds );
		if ( false === $ready ) {
			throw new RuntimeException( 'e1_worker_select_failed' );
		}
		if ( 0 === $ready ) {
			continue;
		}
		$chunk = fgets( $pipe );
		if ( is_string( $chunk ) ) {
			$buffer .= $chunk;
			if ( false !== strpos( $buffer, "\n" ) ) {
				return trim( $buffer );
			}
		}
	}
	throw new RuntimeException( 'e1_worker_watchdog_timeout' );
}

function v1_8010e_e1_process_finish( $child, $send_go = false ) {
	if ( $send_go ) {
		fwrite( $child['pipes'][0], "GO\n" );
		fflush( $child['pipes'][0] );
	}
	fclose( $child['pipes'][0] );
	stream_set_blocking( $child['pipes'][1], true );
	stream_set_blocking( $child['pipes'][2], true );
	$out = stream_get_contents( $child['pipes'][1] );
	$err = stream_get_contents( $child['pipes'][2] );
	fclose( $child['pipes'][1] );
	fclose( $child['pipes'][2] );
	$code = proc_close( $child['process'] );
	return array( 'code' => $code, 'out' => trim( (string) $out ), 'err' => trim( (string) $err ) );
}

function v1_8010e_e1_process_run( $mode, $prefix, $store, $runner, $target = '' ) {
	return v1_8010e_e1_process_finish( v1_8010e_e1_process_start( $mode, $prefix, $store, $runner, $target ) );
}

function v1_8010e_e1_process_kill( $child ) {
	$terminated = proc_terminate( $child['process'], 9 );
	v1_8010e_e1_process_expect( true === $terminated, 'SIGKILL is delivered to the exact PHP worker' );
	foreach ( $child['pipes'] as $pipe ) {
		fclose( $pipe );
	}
	proc_close( $child['process'] );
}

/** Best-effort exact-child abort for a failed barrier assertion. */
function v1_8010e_e1_process_abort( $child ) {
	if ( ! is_array( $child ) ) {
		return;
	}
	if ( isset( $child['process'] ) && is_resource( $child['process'] ) ) {
		$status = proc_get_status( $child['process'] );
		if ( is_array( $status ) && ! empty( $status['running'] ) ) {
			@proc_terminate( $child['process'], 9 );
		}
	}
	foreach ( $child['pipes'] ?? array() as $pipe ) {
		if ( is_resource( $pipe ) ) {
			@fclose( $pipe );
		}
	}
	if ( isset( $child['process'] ) && is_resource( $child['process'] ) ) {
		@proc_close( $child['process'] );
	}
}

/** Decode one content-free worker result and preserve failure diagnostics. */
function v1_8010e_e1_process_json( $result, $expected_state, $message ) {
	$data = json_decode( $result['out'], true );
	v1_8010e_e1_process_expect(
		0 === $result['code']
		&& '' === $result['err']
		&& is_array( $data )
		&& $expected_state === ( $data['state'] ?? null ),
		$message . '; code=' . $result['code'] . ' out=' . $result['out'] . ' err=' . $result['err']
	);
	return $data;
}

function v1_8010e_e1_process_observe( $prefix ) {
	$result = v1_8010e_e1_process_run( 'observe-lock', $prefix, '', '' );
	$data = json_decode( $result['out'], true );
	v1_8010e_e1_process_expect( 0 === $result['code'] && is_array( $data ) && 'OBSERVED' === ( $data['state'] ?? null ), 'lock observer returns exact structured state' );
	return $data;
}

function v1_8010e_e1_process_wait_lock_clear( $prefix ) {
	$deadline = microtime( true ) + 10.0;
	do {
		$observed = v1_8010e_e1_process_observe( $prefix );
		if ( null === $observed['lock_owner'] ) {
			return;
		}
		usleep( 100000 );
	} while ( microtime( true ) < $deadline );
	throw new RuntimeException( 'killed installer advisory lock did not clear' );
}

function v1_8010e_e1_expect_ok( $result, $generation, $message ) {
	v1_8010e_e1_process_expect(
		0 === $result['code'] && 1 === preg_match( '/^OK connection=\d+ generation=' . $generation . '$/', $result['out'] ) && '' === $result['err'],
		$message . '; code=' . $result['code'] . ' out=' . $result['out'] . ' err=' . $result['err']
	);
}

// E1 versus E1 exclusion and independent lock observation.
$prefix = 'v1e1racea_';
$store = v1_8010e_e1_process_uuid( 1, 40 );
v1_8010e_e1_expect_ok( v1_8010e_e1_process_run( 'g1-run', $prefix, $store, v1_8010e_e1_process_uuid( 1, 41 ) ), 1, 'race A generation 1 commissions' );
$holder = v1_8010e_e1_process_start( 'g2-hold', $prefix, $store, v1_8010e_e1_process_uuid( 2, 41 ), 'after_lock' );
$ready = v1_8010e_e1_process_line( $holder['pipes'][1] );
v1_8010e_e1_process_expect( 1 === preg_match( '/^READY after_lock connection=(\d+)$/', $ready, $holder_match ), 'E1 holder reaches exact lock barrier' );
$observed = v1_8010e_e1_process_observe( $prefix );
v1_8010e_e1_process_expect( (int) $holder_match[1] === (int) $observed['lock_owner'] && (int) $holder_match[1] !== (int) $observed['connection_id'], 'independent observer proves E1 lock owner' );
$busy = v1_8010e_e1_process_run( 'g2-busy', $prefix, $store, v1_8010e_e1_process_uuid( 3, 41 ) );
v1_8010e_e1_process_expect( 0 === $busy['code'] && 1 === preg_match( '/^BUSY connection=\d+$/', $busy['out'] ), 'second E1 installer fails busy without waiting' );
v1_8010e_e1_expect_ok( v1_8010e_e1_process_finish( $holder, true ), 2, 'E1 holder completes after GO' );

// Old 8010D path excludes E1 while it owns the same namespace.
$prefix = 'v1e1raceb_';
$store = v1_8010e_e1_process_uuid( 2, 40 );
$holder = v1_8010e_e1_process_start( 'g1-hold', $prefix, $store, v1_8010e_e1_process_uuid( 4, 41 ), 'after_lock' );
v1_8010e_e1_process_expect( false !== strpos( v1_8010e_e1_process_line( $holder['pipes'][1] ), 'READY after_lock connection=' ), '8010D holder reaches shared lock barrier' );
$busy = v1_8010e_e1_process_run( 'g2-busy', $prefix, $store, v1_8010e_e1_process_uuid( 5, 41 ) );
v1_8010e_e1_process_expect( 0 === $busy['code'] && false !== strpos( $busy['out'], 'BUSY connection=' ), 'E1 is excluded by 8010D lock owner' );
v1_8010e_e1_expect_ok( v1_8010e_e1_process_finish( $holder, true ), 1, '8010D holder completes' );
v1_8010e_e1_expect_ok( v1_8010e_e1_process_run( 'g2-run', $prefix, $store, v1_8010e_e1_process_uuid( 6, 41 ) ), 2, 'E1 advances after old owner releases' );

// Reverse direction: E1 excludes the already-commissioned 8010D path.
$prefix = 'v1e1racec_';
$store = v1_8010e_e1_process_uuid( 3, 40 );
v1_8010e_e1_expect_ok( v1_8010e_e1_process_run( 'g1-run', $prefix, $store, v1_8010e_e1_process_uuid( 7, 41 ) ), 1, 'race C generation 1 commissions' );
$holder = v1_8010e_e1_process_start( 'g2-hold', $prefix, $store, v1_8010e_e1_process_uuid( 8, 41 ), 'after_lock' );
v1_8010e_e1_process_expect( false !== strpos( v1_8010e_e1_process_line( $holder['pipes'][1] ), 'READY after_lock connection=' ), 'E1 reverse holder reaches shared lock barrier' );
$busy = v1_8010e_e1_process_run( 'g1-busy', $prefix, $store, v1_8010e_e1_process_uuid( 9, 41 ) );
v1_8010e_e1_process_expect( 0 === $busy['code'] && false !== strpos( $busy['out'], 'BUSY connection=' ), '8010D path is excluded by E1 lock owner' );
v1_8010e_e1_expect_ok( v1_8010e_e1_process_finish( $holder, true ), 2, 'E1 reverse holder completes' );

$crash_points = array(
	'after_lock',
	'after_week_gate_migrating_update',
	'after_week_gate_migrating_commit',
	'after_migration_6_record',
	'after_migration_6_ddl',
	'after_migration_6_applied',
	'after_migration_7_record',
	'after_migration_7_ddl',
	'after_migration_7_applied',
	'after_generation_2_insert',
	'after_generation_2_gate_update',
	'after_generation_2_commit',
);
foreach ( $crash_points as $index => $point ) {
	$prefix = sprintf( 'v1e1k%02d_', $index + 1 );
	$store = v1_8010e_e1_process_uuid( $index + 10, 42 );
	v1_8010e_e1_expect_ok( v1_8010e_e1_process_run( 'g1-run', $prefix, $store, v1_8010e_e1_process_uuid( $index + 10, 43 ) ), 1, 'crash case parent commissions: ' . $point );
	$child = v1_8010e_e1_process_start( 'g2-hold', $prefix, $store, v1_8010e_e1_process_uuid( $index + 30, 43 ), $point );
	$line = v1_8010e_e1_process_line( $child['pipes'][1] );
	v1_8010e_e1_process_expect( false !== strpos( $line, 'READY ' . $point . ' connection=' ), 'worker reaches SIGKILL barrier: ' . $point );
	v1_8010e_e1_process_kill( $child );
	v1_8010e_e1_process_wait_lock_clear( $prefix );
	v1_8010e_e1_expect_ok( v1_8010e_e1_process_run( 'g2-run', $prefix, $store, v1_8010e_e1_process_uuid( $index + 50, 43 ) ), 2, 'fresh process reconciles SIGKILL boundary: ' . $point );
	v1_8010e_e1_expect_ok( v1_8010e_e1_process_run( 'g2-run', $prefix, $store, v1_8010e_e1_process_uuid( $index + 70, 43 ) ), 2, 'post-recovery generation 2 is idempotent: ' . $point );
}

// A held current reader must not tear when a different connection commits v3.
$tear_holder = null;
$tear_finished = false;
try {
	$owner_2_seed = v1_8010e_e1_process_json(
		v1_8010e_e1_process_run( 'seed-owner-2', 'v1e1_', '', '' ),
		'SEEDED',
		'second synthetic owner commits independent positive truth'
	);
	v1_8010e_e1_process_expect(
		(int) $owner_2_seed['connection_id'] > 0
		&& 8012 === (int) $owner_2_seed['owner_id']
		&& '1' === (string) $owner_2_seed['revision']
		&& 1 === preg_match( '/^[a-f0-9]{64}$/D', (string) $owner_2_seed['hash'] ),
		'second owner seed is exact and hash-bound'
	);

	$tear_holder = v1_8010e_e1_process_start( 'reader-hold', 'v1e1_', '', '', '8011' );
	$ready = v1_8010e_e1_process_line( $tear_holder['pipes'][1] );
	v1_8010e_e1_process_expect(
		1 === preg_match( '/^READY reader_after_plan connection=(\d+) revision=2 hash=([a-f0-9]{64})$/D', $ready, $tear_match ),
		'held reader reaches the exact post-Plan barrier inside its consistent snapshot; line=' . $ready
	);
	$held_connection = (int) $tear_match[1];
	$old_hash = (string) $tear_match[2];

	$writer = v1_8010e_e1_process_json(
		v1_8010e_e1_process_run( 'writer-v3', 'v1e1_', '', '' ),
		'WROTE',
		'independent writer atomically commits revision 3'
	);
	v1_8010e_e1_process_expect(
		(int) $writer['connection_id'] > 0
		&& (int) $writer['connection_id'] !== $held_connection
		&& '3' === (string) $writer['revision']
		&& hash_equals( $old_hash, (string) $writer['old_hash'] )
		&& 1 === preg_match( '/^[a-f0-9]{64}$/D', (string) $writer['new_hash'] )
		&& ! hash_equals( $old_hash, (string) $writer['new_hash'] ),
		'writer uses a distinct connection and publishes a different hash-bound revision'
	);

	$held = v1_8010e_e1_process_json(
		v1_8010e_e1_process_finish( $tear_holder, true ),
		'READ',
		'held reader completes after the writer commit'
	);
	$tear_finished = true;
	v1_8010e_e1_process_expect(
		(int) $held['connection_id'] === $held_connection
		&& 8011 === (int) $held['owner_id']
		&& true === $held['ok']
		&& 'ok' === (string) $held['reason_code']
		&& '2' === (string) $held['revision']
		&& hash_equals( $old_hash, (string) $held['hash'] )
		&& 'Retrieval practice' === (string) $held['title'],
		'held reader returns the complete old revision instead of mixing committed v3 rows'
	);

	$fresh = v1_8010e_e1_process_json(
		v1_8010e_e1_process_run( 'reader-run', 'v1e1_', '', '', '8011' ),
		'READ',
		'fresh reader observes the committed revision'
	);
	v1_8010e_e1_process_expect(
		(int) $fresh['connection_id'] > 0
		&& (int) $fresh['connection_id'] !== $held_connection
		&& true === $fresh['ok']
		&& 'ok' === (string) $fresh['reason_code']
		&& '3' === (string) $fresh['revision']
		&& hash_equals( (string) $writer['new_hash'], (string) $fresh['hash'] )
		&& 'Retrieval practice advanced' === (string) $fresh['title'],
		'fresh reader returns the complete new revision and exact new hash'
	);

	$other_owner = v1_8010e_e1_process_json(
		v1_8010e_e1_process_run( 'reader-run', 'v1e1_', '', '', '8012' ),
		'READ',
		'second owner reads its own independent positive truth'
	);
	v1_8010e_e1_process_expect(
		8012 === (int) $other_owner['owner_id']
		&& true === $other_owner['ok']
		&& 'ok' === (string) $other_owner['reason_code']
		&& '1' === (string) $other_owner['revision']
		&& hash_equals( (string) $owner_2_seed['hash'], (string) $other_owner['hash'] )
		&& ! hash_equals( (string) $writer['new_hash'], (string) $other_owner['hash'] )
		&& null === $other_owner['title'],
		'owner 8011 revision/title never crosses into distinguishable owner 8012 truth'
	);
} finally {
	if ( null !== $tear_holder && ! $tear_finished ) {
		v1_8010e_e1_process_abort( $tear_holder );
	}
}

echo "V1 Study Schedule 8010E E1 independent lock/SIGKILL/snapshot-tear proof: ok\n";
