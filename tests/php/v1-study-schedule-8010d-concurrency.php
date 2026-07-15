<?php
/** Deterministic process/connection migration exclusion and crash controller. */

function v1_8010d_process_expect( $condition, $message ) {
	if ( ! $condition ) {
		throw new RuntimeException( $message );
	}
}

function v1_8010d_process_uuid( $counter, $lane ) {
	return sprintf( '%08x-%04x-4%03x-8%03x-%012x', $lane, $counter & 0xffff, $counter & 0xfff, $lane & 0xfff, $counter );
}

function v1_8010d_process_start( $mode, $prefix, $store_id, $runner_id, $target = '' ) {
	$worker  = __DIR__ . '/v1-study-schedule-8010d-worker.php';
	$command = implode(
		' ',
		array_map(
			'escapeshellarg',
			array( PHP_BINARY, $worker, $mode, $prefix, $store_id, $runner_id, $target )
		)
	);
	$spec = array(
		0 => array( 'pipe', 'r' ),
		1 => array( 'pipe', 'w' ),
		2 => array( 'pipe', 'w' ),
	);
	$pipes   = array();
	$process = proc_open( $command, $spec, $pipes );
	if ( ! is_resource( $process ) ) {
		throw new RuntimeException( 'worker_start_failed' );
	}
	return array( 'process' => $process, 'pipes' => $pipes );
}

function v1_8010d_process_line( $pipe, $timeout_seconds = 20 ) {
	stream_set_blocking( $pipe, false );
	$buffer   = '';
	$deadline = microtime( true ) + $timeout_seconds;
	while ( microtime( true ) < $deadline ) {
		$read   = array( $pipe );
		$write  = null;
		$except = null;
		$left   = max( 0.0, $deadline - microtime( true ) );
		$sec    = (int) floor( $left );
		$usec   = (int) ( ( $left - $sec ) * 1000000 );
		$ready  = stream_select( $read, $write, $except, $sec, $usec );
		if ( false === $ready ) {
			throw new RuntimeException( 'worker_select_failed' );
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
	throw new RuntimeException( 'worker_watchdog_timeout' );
}

function v1_8010d_process_finish( $child, $send_go = false ) {
	if ( $send_go ) {
		fwrite( $child['pipes'][0], "GO\n" );
		fflush( $child['pipes'][0] );
	}
	fclose( $child['pipes'][0] );
	$out = stream_get_contents( $child['pipes'][1] );
	$err = stream_get_contents( $child['pipes'][2] );
	fclose( $child['pipes'][1] );
	fclose( $child['pipes'][2] );
	$code = proc_close( $child['process'] );
	return array( 'code' => $code, 'out' => trim( (string) $out ), 'err' => trim( (string) $err ) );
}

function v1_8010d_process_run( $mode, $prefix, $store, $runner, $target = '' ) {
	return v1_8010d_process_finish( v1_8010d_process_start( $mode, $prefix, $store, $runner, $target ) );
}

$prefix = 'v1dconcurrent_';
$store  = '55555555-5555-4555-8555-555555555555';
$first  = v1_8010d_process_start( 'hold', $prefix, $store, '66666666-6666-4666-8666-666666666666', 'after_lock' );
$ready  = v1_8010d_process_line( $first['pipes'][1] );
v1_8010d_process_expect( 1 === preg_match( '/^READY after_lock connection=(\d+)$/', $ready, $match ), 'first installer reaches deterministic lock barrier' );
$first_connection = (int) $match[1];

$observer = v1_8010d_process_run( 'observe', $prefix, $store, '77777777-7777-4777-8777-777777777777' );
v1_8010d_process_expect( 0 === $observer['code'], 'independent observer exits cleanly' );
$observed = json_decode( $observer['out'], true );
v1_8010d_process_expect( is_array( $observed ) && 'OBSERVED' === $observed['state'], 'observer reports structured state' );
v1_8010d_process_expect( $first_connection === (int) $observed['lock_owner'], 'observer sees first connection as advisory-lock owner' );
v1_8010d_process_expect( $first_connection !== (int) $observed['connection_id'], 'observer uses an independent connection' );

$second = v1_8010d_process_run( 'busy', $prefix, $store, '88888888-8888-4888-8888-888888888888' );
v1_8010d_process_expect( 0 === $second['code'] && 1 === preg_match( '/^BUSY connection=(\d+)$/', $second['out'], $busy_match ), 'second installer is rejected without waiting' );
v1_8010d_process_expect( $first_connection !== (int) $busy_match[1] && (int) $observed['connection_id'] !== (int) $busy_match[1], 'installer, contender, and observer are independent sessions' );

$first_done = v1_8010d_process_finish( $first, true );
v1_8010d_process_expect( 0 === $first_done['code'] && false !== strpos( $first_done['out'], 'OK connection=' ), 'first installer completes after explicit GO' );
$repeat = v1_8010d_process_run( 'run', $prefix, $store, '99999999-9999-4999-8999-999999999999' );
v1_8010d_process_expect( 0 === $repeat['code'] && false !== strpos( $repeat['out'], 'OK connection=' ), 'post-race idempotent rerun succeeds' );

$crash_points = array(
	'after_migration_1_ddl',
	'after_migration_2_record',
	'after_migration_2_ddl',
	'after_migration_3_record',
	'after_migration_3_ddl',
	'after_migration_4_record',
	'after_migration_4_ddl',
	'after_migration_5_record',
	'after_migration_5_ddl',
	'after_generation_insert',
	'after_gate_insert',
	'after_commission_commit',
);
foreach ( $crash_points as $index => $point ) {
	$case_prefix = sprintf( 'v1dc%02d_', $index + 1 );
	$case_store  = v1_8010d_process_uuid( $index + 1, 30 );
	$child       = v1_8010d_process_start( 'hold', $case_prefix, $case_store, v1_8010d_process_uuid( $index + 1, 31 ), $point );
	$line        = v1_8010d_process_line( $child['pipes'][1] );
	v1_8010d_process_expect( false !== strpos( $line, 'READY ' . $point . ' connection=' ), 'crash worker reaches exact barrier: ' . $point );
	proc_terminate( $child['process'], 15 );
	foreach ( $child['pipes'] as $pipe ) {
		fclose( $pipe );
	}
	proc_close( $child['process'] );

	$recovered = v1_8010d_process_run( 'run', $case_prefix, $case_store, v1_8010d_process_uuid( $index + 101, 31 ) );
	v1_8010d_process_expect( 0 === $recovered['code'] && false !== strpos( $recovered['out'], 'OK connection=' ), 'new connection reconciles crash boundary: ' . $point );
}

echo "V1 Study Schedule 8010D deterministic migration concurrency/crash: ok\n";
