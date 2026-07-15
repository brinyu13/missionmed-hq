<?php
/** Independent-process E3 shared-owner lock, ordering, and crash proof. */

function v1_8010e_e3_arbiter_process_expect( $condition, $message ) {
	if ( ! $condition ) {
		throw new RuntimeException( $message );
	}
}

/** Start one allowlisted worker. */
function v1_8010e_e3_arbiter_process_start( $mode, $scenario = '', $argument_3 = '', $argument_4 = '' ) {
	$worker = __DIR__ . '/v1-study-schedule-8010e-e3-owner-arbiter-worker.php';
	$command = 'exec ' . implode(
		' ',
		array_map( 'escapeshellarg', array( PHP_BINARY, $worker, $mode, $scenario, $argument_3, $argument_4 ) )
	);
	$spec = array(
		0 => array( 'pipe', 'r' ),
		1 => array( 'pipe', 'w' ),
		2 => array( 'pipe', 'w' ),
	);
	$pipes = array();
	$process = proc_open( $command, $spec, $pipes );
	if ( ! is_resource( $process ) ) {
		throw new RuntimeException( 'e3_arbiter_worker_start_failed' );
	}
	return array( 'process' => $process, 'pipes' => $pipes );
}

/** Read one exact worker line with a hard watchdog. */
function v1_8010e_e3_arbiter_process_line( $pipe, $timeout_seconds = 30 ) {
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
			throw new RuntimeException( 'e3_arbiter_worker_select_failed' );
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
		if ( feof( $pipe ) ) {
			throw new RuntimeException( 'e3_arbiter_worker_premature_eof' );
		}
	}
	throw new RuntimeException( 'e3_arbiter_worker_watchdog_timeout' );
}

/** Best-effort exact child cleanup. */
function v1_8010e_e3_arbiter_process_abort( $child ) {
	if ( ! is_array( $child ) ) {
		return;
	}
	$status = null;
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

/** Finish one worker with bounded output and a hard deadline. */
function v1_8010e_e3_arbiter_process_finish( $child, $send_go = false, $timeout_seconds = 45 ) {
	if ( $send_go ) {
		fwrite( $child['pipes'][0], "GO\n" );
		fflush( $child['pipes'][0] );
	}
	fclose( $child['pipes'][0] );
	stream_set_blocking( $child['pipes'][1], false );
	stream_set_blocking( $child['pipes'][2], false );
	$out = '';
	$err = '';
	$exit_code = null;
	$deadline = microtime( true ) + $timeout_seconds;
	while ( microtime( true ) < $deadline ) {
		$read = array();
		if ( ! feof( $child['pipes'][1] ) ) {
			$read[] = $child['pipes'][1];
		}
		if ( ! feof( $child['pipes'][2] ) ) {
			$read[] = $child['pipes'][2];
		}
		if ( ! empty( $read ) ) {
			$write = null;
			$except = null;
			$ready = stream_select( $read, $write, $except, 0, 250000 );
			if ( false === $ready ) {
				v1_8010e_e3_arbiter_process_abort( $child );
				throw new RuntimeException( 'e3_arbiter_worker_finish_select_failed' );
			}
			foreach ( $read as $pipe ) {
				$chunk = stream_get_contents( $pipe );
				if ( is_string( $chunk ) && '' !== $chunk ) {
					if ( $pipe === $child['pipes'][1] ) {
						$out .= $chunk;
					} else {
						$err .= $chunk;
					}
				}
			}
		} else {
			usleep( 25000 );
		}
		if ( strlen( $out ) > 16384 || strlen( $err ) > 4096 ) {
			v1_8010e_e3_arbiter_process_abort( $child );
			throw new RuntimeException( 'e3_arbiter_worker_output_limit_exceeded' );
		}
		$status = proc_get_status( $child['process'] );
		if ( ! is_array( $status ) ) {
			v1_8010e_e3_arbiter_process_abort( $child );
			throw new RuntimeException( 'e3_arbiter_worker_status_invalid' );
		}
		if ( empty( $status['running'] ) ) {
			$exit_code = (int) $status['exitcode'];
			$out .= (string) stream_get_contents( $child['pipes'][1] );
			$err .= (string) stream_get_contents( $child['pipes'][2] );
			break;
		}
	}
	if ( null === $exit_code ) {
		v1_8010e_e3_arbiter_process_abort( $child );
		throw new RuntimeException( 'e3_arbiter_worker_finish_timeout' );
	}
	fclose( $child['pipes'][1] );
	fclose( $child['pipes'][2] );
	$closed = proc_close( $child['process'] );
	$code = $closed >= 0 ? $closed : $exit_code;
	return array( 'code' => $code, 'out' => trim( $out ), 'err' => trim( $err ) );
}

function v1_8010e_e3_arbiter_process_run( $mode, $scenario = '', $argument_3 = '', $argument_4 = '' ) {
	return v1_8010e_e3_arbiter_process_finish( v1_8010e_e3_arbiter_process_start( $mode, $scenario, $argument_3, $argument_4 ) );
}

/** Decode the final bounded RESULT line. */
function v1_8010e_e3_arbiter_process_payload( $result, $message ) {
	$lines = preg_split( '/\r?\n/', trim( (string) $result['out'] ) );
	$payload = null;
	foreach ( is_array( $lines ) ? $lines : array() as $line ) {
		if ( 0 === strpos( $line, 'RESULT ' ) ) {
			$payload = json_decode( substr( $line, 7 ), true );
		}
	}
	v1_8010e_e3_arbiter_process_expect(
		0 === $result['code']
		&& '' === $result['err']
		&& is_array( $payload )
		&& array( 'connection_id', 'result' ) === array_keys( $payload )
		&& (int) $payload['connection_id'] > 0
		&& is_array( $payload['result'] ),
		$message . '; code=' . $result['code'] . ' out=' . $result['out'] . ' err=' . $result['err']
	);
	return $payload;
}

/** Return one worker connection ID from its START line. */
function v1_8010e_e3_arbiter_process_start_id( $child, $message ) {
	$line = v1_8010e_e3_arbiter_process_line( $child['pipes'][1] );
	v1_8010e_e3_arbiter_process_expect( 1 === preg_match( '/^START connection=(\d+)$/D', $line, $match ), $message . '; line=' . $line );
	return (int) $match[1];
}

/** Replace controls through a separate autocommit process. */
function v1_8010e_e3_arbiter_process_set_control( $state ) {
	$payload = v1_8010e_e3_arbiter_process_payload( v1_8010e_e3_arbiter_process_run( 'set-control', $state ), 'control worker succeeds' );
	v1_8010e_e3_arbiter_process_expect( true === ( $payload['result']['ok'] ?? null ) && $state === ( $payload['result']['state'] ?? null ), 'control worker writes exact state' );
}

/** Read one committed owner state from an independent process. */
function v1_8010e_e3_arbiter_process_observe( $scenario ) {
	return v1_8010e_e3_arbiter_process_payload( v1_8010e_e3_arbiter_process_run( 'observe', $scenario ), 'observer succeeds' )['result'];
}

/** Poll server lock tables until requester is proven waiting on blocker. */
function v1_8010e_e3_arbiter_process_wait_for_lock( $requester, $blocker ) {
	$deadline = microtime( true ) + 15.0;
	do {
		$payload = v1_8010e_e3_arbiter_process_payload(
			v1_8010e_e3_arbiter_process_run( 'lock-wait', 'v1-first', (string) $requester, (string) $blocker ),
			'independent LOCK_WAIT observer succeeds'
		);
		if ( 'LOCK_WAIT' === ( $payload['result']['state'] ?? null ) && true === ( $payload['result']['waiting'] ?? null ) ) {
			return;
		}
		usleep( 100000 );
	} while ( microtime( true ) < $deadline );
	throw new RuntimeException( 'e3_arbiter_owner_lock_wait_not_observed' );
}

/** Deliver SIGKILL to exactly one live worker at a proven barrier. */
function v1_8010e_e3_arbiter_process_sigkill( $child ) {
	$status = proc_get_status( $child['process'] );
	v1_8010e_e3_arbiter_process_expect( is_array( $status ) && ! empty( $status['running'] ), 'crash worker is live before SIGKILL' );
	v1_8010e_e3_arbiter_process_expect( true === proc_terminate( $child['process'], 9 ), 'SIGKILL reaches exact E3 worker' );
	$deadline = microtime( true ) + 10.0;
	do {
		$status = proc_get_status( $child['process'] );
		if ( is_array( $status ) && empty( $status['running'] ) ) {
			break;
		}
		usleep( 25000 );
	} while ( microtime( true ) < $deadline );
	v1_8010e_e3_arbiter_process_expect( is_array( $status ) && empty( $status['running'] ) && 9 === (int) $status['termsig'], 'SIGKILLed E3 worker is reaped' );
	foreach ( $child['pipes'] as $pipe ) {
		if ( is_resource( $pipe ) ) {
			@fclose( $pipe );
		}
	}
	@proc_close( $child['process'] );
}

/** Wait until rollback of a killed worker is independently visible. */
function v1_8010e_e3_arbiter_process_wait_empty( $scenario ) {
	$deadline = microtime( true ) + 15.0;
	do {
		$state = v1_8010e_e3_arbiter_process_observe( $scenario );
		if (
			0 === ( $state['plan'] ?? null )
			&& 0 === ( $state['calendar'] ?? null )
			&& 0 === ( $state['operations'] ?? null )
			&& 0 === ( $state['weeks'] ?? null )
			&& 0 === ( $state['blocks'] ?? null )
		) {
			return;
		}
		usleep( 100000 );
	} while ( microtime( true ) < $deadline );
	throw new RuntimeException( 'e3_arbiter_killed_transaction_did_not_rollback' );
}

// V1-first: a stale legacy request reaches the permanent owner mutex, waits,
// revalidates after V1 commit, and performs zero Calendar DML.
v1_8010e_e3_arbiter_process_set_control( 'active' );
$v1_first = v1_8010e_e3_arbiter_process_start( 'v1', 'v1-first' );
$v1_connection = v1_8010e_e3_arbiter_process_start_id( $v1_first, 'V1-first writer starts' );
$v1_ready = v1_8010e_e3_arbiter_process_line( $v1_first['pipes'][1] );
v1_8010e_e3_arbiter_process_expect( 'READY before_commit connection=' . $v1_connection === $v1_ready, 'V1-first writer holds the owner mutex before commit' );
$legacy_waiter = v1_8010e_e3_arbiter_process_start( 'legacy', 'v1-first' );
$legacy_connection = v1_8010e_e3_arbiter_process_start_id( $legacy_waiter, 'stale legacy contender starts' );
v1_8010e_e3_arbiter_process_wait_for_lock( $legacy_connection, $v1_connection );
$v1_payload = v1_8010e_e3_arbiter_process_payload( v1_8010e_e3_arbiter_process_finish( $v1_first, true ), 'V1-first writer commits' )['result'];
v1_8010e_e3_arbiter_process_expect( true === ( $v1_payload['ok'] ?? null ) && '1' === ( $v1_payload['result']['revision'] ?? null ), 'V1-first path commits revision 1' );
$legacy_payload = v1_8010e_e3_arbiter_process_payload( v1_8010e_e3_arbiter_process_finish( $legacy_waiter ), 'legacy waiter finishes after V1' )['result'];
v1_8010e_e3_arbiter_process_expect( false === ( $legacy_payload['ok'] ?? null ) && 'legacy_write_disabled' === ( $legacy_payload['reason_code'] ?? null ), 'waiting legacy request revalidates and denies' );
$v1_first_state = v1_8010e_e3_arbiter_process_observe( 'v1-first' );
v1_8010e_e3_arbiter_process_expect(
	1 === $v1_first_state['plan'] && '1' === $v1_first_state['revision'] && 1 === $v1_first_state['watermark']
	&& 1 === $v1_first_state['operations'] && 1 === $v1_first_state['weeks'] && 1 === $v1_first_state['blocks']
	&& 0 === $v1_first_state['calendar'],
	'V1-first has exactly one V1 commit and zero Calendar DML'
);

// Legacy-first: legacy Calendar + revision-zero Plan commit atomically; after
// active controls, V1 sees the locked row and refuses fictional import.
v1_8010e_e3_arbiter_process_set_control( 'legacy' );
$legacy_first = v1_8010e_e3_arbiter_process_start( 'legacy', 'legacy-first' );
$legacy_first_connection = v1_8010e_e3_arbiter_process_start_id( $legacy_first, 'legacy-first worker starts' );
$legacy_ready = v1_8010e_e3_arbiter_process_line( $legacy_first['pipes'][1] );
v1_8010e_e3_arbiter_process_expect( 'READY after_calendar_write connection=' . $legacy_first_connection === $legacy_ready, 'legacy-first holds uncommitted Plan and Calendar row' );
$legacy_uncommitted = v1_8010e_e3_arbiter_process_observe( 'legacy-first' );
v1_8010e_e3_arbiter_process_expect( 0 === $legacy_uncommitted['plan'] && 0 === $legacy_uncommitted['calendar'], 'independent observer cannot see partial legacy transaction' );
$legacy_committed = v1_8010e_e3_arbiter_process_payload( v1_8010e_e3_arbiter_process_finish( $legacy_first, true ), 'legacy-first commits' )['result'];
v1_8010e_e3_arbiter_process_expect( true === ( $legacy_committed['ok'] ?? null ), 'legacy-first transaction commits exactly once' );
v1_8010e_e3_arbiter_process_set_control( 'active' );
$v1_after_legacy = v1_8010e_e3_arbiter_process_payload( v1_8010e_e3_arbiter_process_run( 'v1', 'legacy-first' ), 'V1 after legacy completes fail-closed' )['result'];
v1_8010e_e3_arbiter_process_expect( false === ( $v1_after_legacy['ok'] ?? null ) && 'dependency_unavailable' === ( $v1_after_legacy['reason_code'] ?? null ), 'legacy-first requires an importer and writes no watermark' );
$legacy_first_state = v1_8010e_e3_arbiter_process_observe( 'legacy-first' );
v1_8010e_e3_arbiter_process_expect(
	1 === $legacy_first_state['plan'] && '0' === $legacy_first_state['revision'] && 0 === $legacy_first_state['watermark']
	&& 0 === $legacy_first_state['operations'] && 0 === $legacy_first_state['weeks'] && 0 === $legacy_first_state['blocks']
	&& 1 === $legacy_first_state['calendar'],
	'legacy-first preserves only revision-zero Plan plus exact Calendar authority'
);

// Different owners do not share the permanent owner mutex.
v1_8010e_e3_arbiter_process_set_control( 'active' );
$owner_a = v1_8010e_e3_arbiter_process_start( 'v1', 'different-owner-a' );
$owner_a_connection = v1_8010e_e3_arbiter_process_start_id( $owner_a, 'owner A starts' );
$owner_a_ready = v1_8010e_e3_arbiter_process_line( $owner_a['pipes'][1] );
v1_8010e_e3_arbiter_process_expect( 'READY before_commit connection=' . $owner_a_connection === $owner_a_ready, 'owner A holds its mutex' );
$owner_b = v1_8010e_e3_arbiter_process_payload( v1_8010e_e3_arbiter_process_run( 'v1', 'different-owner-b' ), 'owner B completes independently' )['result'];
v1_8010e_e3_arbiter_process_expect( true === ( $owner_b['ok'] ?? null ), 'different owner commits while owner A remains held' );
$owner_a_result = v1_8010e_e3_arbiter_process_payload( v1_8010e_e3_arbiter_process_finish( $owner_a, true ), 'owner A completes' )['result'];
v1_8010e_e3_arbiter_process_expect( true === ( $owner_a_result['ok'] ?? null ), 'held owner completes after independent owner' );

// Crash before legacy commit rolls back both provisional Plan and Calendar row.
v1_8010e_e3_arbiter_process_set_control( 'legacy' );
$crash = v1_8010e_e3_arbiter_process_start( 'legacy', 'crash-before-commit' );
$crash_connection = v1_8010e_e3_arbiter_process_start_id( $crash, 'crash worker starts' );
$crash_ready = v1_8010e_e3_arbiter_process_line( $crash['pipes'][1] );
v1_8010e_e3_arbiter_process_expect( 'READY after_calendar_write connection=' . $crash_connection === $crash_ready, 'crash worker reaches post-DML pre-commit barrier' );
v1_8010e_e3_arbiter_process_sigkill( $crash );
v1_8010e_e3_arbiter_process_wait_empty( 'crash-before-commit' );
$retry = v1_8010e_e3_arbiter_process_payload( v1_8010e_e3_arbiter_process_run( 'legacy', 'crash-retry' ), 'fresh legacy retry succeeds after rollback' )['result'];
v1_8010e_e3_arbiter_process_expect( true === ( $retry['ok'] ?? null ), 'fresh process commits once after precommit crash' );
$retry_state = v1_8010e_e3_arbiter_process_observe( 'crash-retry' );
v1_8010e_e3_arbiter_process_expect( 1 === $retry_state['plan'] && '0' === $retry_state['revision'] && 1 === $retry_state['calendar'], 'retry leaves one revision-zero Plan and one Calendar row' );

echo "V1 Study Schedule 8010E E3 independent owner-arbiter lock/crash proof: ok\n";
