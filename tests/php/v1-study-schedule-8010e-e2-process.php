<?php
/** Independent-process E2 command concurrency, crash, and replay proof. */

function v1_8010e_e2_process_expect( $condition, $message ) {
	if ( ! $condition ) {
		throw new RuntimeException( $message );
	}
}

/** Start one allowlisted worker without placing learner content in argv. */
function v1_8010e_e2_process_start( $mode, $scenario = '', $target_connection = '' ) {
	$worker = __DIR__ . '/v1-study-schedule-8010e-e2-worker.php';
	$command = 'exec ' . implode(
		' ',
		array_map( 'escapeshellarg', array( PHP_BINARY, $worker, $mode, $scenario, $target_connection ) )
	);
	$spec = array(
		0 => array( 'pipe', 'r' ),
		1 => array( 'pipe', 'w' ),
		2 => array( 'pipe', 'w' ),
	);
	$pipes = array();
	$process = proc_open( $command, $spec, $pipes );
	if ( ! is_resource( $process ) ) {
		throw new RuntimeException( 'e2_worker_start_failed' );
	}
	return array( 'process' => $process, 'pipes' => $pipes );
}

/** Read one barrier line with a hard watchdog. */
function v1_8010e_e2_process_line( $pipe, $timeout_seconds = 30 ) {
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
			throw new RuntimeException( 'e2_worker_select_failed' );
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
			throw new RuntimeException( 'e2_worker_premature_eof' );
		}
	}
	throw new RuntimeException( 'e2_worker_watchdog_timeout' );
}

/** Finish one worker with a hard deadline and bounded nonblocking drains. */
function v1_8010e_e2_process_finish( $child, $send_go = false, $timeout_seconds = 45 ) {
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
				v1_8010e_e2_process_abort( $child );
				throw new RuntimeException( 'e2_worker_finish_select_failed' );
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
			v1_8010e_e2_process_abort( $child );
			throw new RuntimeException( 'e2_worker_output_limit_exceeded' );
		}
		$status = proc_get_status( $child['process'] );
		if ( ! is_array( $status ) ) {
			v1_8010e_e2_process_abort( $child );
			throw new RuntimeException( 'e2_worker_status_invalid' );
		}
		if ( empty( $status['running'] ) ) {
			$exit_code = (int) $status['exitcode'];
			$out .= (string) stream_get_contents( $child['pipes'][1] );
			$err .= (string) stream_get_contents( $child['pipes'][2] );
			break;
		}
	}
	if ( null === $exit_code ) {
		v1_8010e_e2_process_abort( $child );
		throw new RuntimeException( 'e2_worker_finish_timeout' );
	}
	if ( strlen( $out ) > 16384 || strlen( $err ) > 4096 ) {
		v1_8010e_e2_process_abort( $child );
		throw new RuntimeException( 'e2_worker_output_limit_exceeded' );
	}
	fclose( $child['pipes'][1] );
	fclose( $child['pipes'][2] );
	$closed_code = proc_close( $child['process'] );
	$code = $closed_code >= 0 ? $closed_code : $exit_code;
	return array( 'code' => $code, 'out' => trim( (string) $out ), 'err' => trim( (string) $err ) );
}

function v1_8010e_e2_process_run( $mode, $scenario = '', $target_connection = '' ) {
	return v1_8010e_e2_process_finish( v1_8010e_e2_process_start( $mode, $scenario, $target_connection ) );
}

/** Kill exactly one PHP worker at a proven barrier. */
function v1_8010e_e2_process_sigkill( $child ) {
	$status = proc_get_status( $child['process'] );
	v1_8010e_e2_process_expect( is_array( $status ) && ! empty( $status['running'] ), 'target worker is live before SIGKILL' );
	v1_8010e_e2_process_expect( true === proc_terminate( $child['process'], 9 ), 'SIGKILL reaches the exact E2 worker' );
	$deadline = microtime( true ) + 10.0;
	do {
		$status = proc_get_status( $child['process'] );
		if ( is_array( $status ) && empty( $status['running'] ) ) {
			break;
		}
		usleep( 25000 );
	} while ( microtime( true ) < $deadline );
	v1_8010e_e2_process_expect(
		is_array( $status )
		&& empty( $status['running'] )
		&& ! empty( $status['signaled'] )
		&& 9 === (int) $status['termsig'],
		'exact E2 worker is reaped after signal 9'
	);
	foreach ( $child['pipes'] as $pipe ) {
		if ( is_resource( $pipe ) ) {
			stream_set_blocking( $pipe, false );
			@stream_get_contents( $pipe );
			fclose( $pipe );
		}
	}
	proc_close( $child['process'] );
}

/** Best-effort child cleanup for assertion failures. */
function v1_8010e_e2_process_abort( $child ) {
	if ( ! is_array( $child ) ) {
		return;
	}
	if ( isset( $child['process'] ) && is_resource( $child['process'] ) ) {
		$status = proc_get_status( $child['process'] );
		if ( is_array( $status ) && ! empty( $status['running'] ) ) {
			@proc_terminate( $child['process'], 9 );
			$deadline = microtime( true ) + 5.0;
			do {
				$status = proc_get_status( $child['process'] );
				if ( is_array( $status ) && empty( $status['running'] ) ) {
					break;
				}
				usleep( 25000 );
			} while ( microtime( true ) < $deadline );
		}
	}
	foreach ( $child['pipes'] ?? array() as $pipe ) {
		if ( is_resource( $pipe ) ) {
			@fclose( $pipe );
		}
	}
	if ( isset( $child['process'] ) && is_resource( $child['process'] ) && is_array( $status ?? null ) && empty( $status['running'] ) ) {
		@proc_close( $child['process'] );
	}
}

/** Decode one exact final JSON line. */
function v1_8010e_e2_process_json( $result, $expected_state, $message ) {
	$lines = preg_split( '/\r?\n/', trim( (string) $result['out'] ) );
	$line = is_array( $lines ) && 1 === count( $lines ) ? $lines[0] : '';
	$data = json_decode( (string) $line, true );
	$expected_keys = array(
		'RESULT' => array( 'state', 'connection_id', 'ok', 'reason_code', 'replayed', 'status', 'revision', 'result_hash', 'native_handle_preserved' ),
		'OBSERVED' => array( 'state', 'connection_id', 'counts', 'linkage_valid', 'revision', 'result_hash' ),
		'THREAD' => array( 'state', 'connection_id', 'target_connection', 'process_present', 'transaction_present' ),
		'KILLED' => array( 'state', 'connection_id', 'target_connection' ),
		'LOCK_WAIT' => array( 'state', 'connection_id', 'requester_connection', 'blocker_connection', 'waiting' ),
	);
	v1_8010e_e2_process_expect(
		0 === $result['code']
		&& '' === $result['err']
		&& is_array( $data )
		&& $expected_state === ( $data['state'] ?? null )
		&& isset( $expected_keys[ $expected_state ] )
		&& $expected_keys[ $expected_state ] === array_keys( $data ),
		$message . '; code=' . $result['code'] . ' out=' . $result['out'] . ' err=' . $result['err']
	);
	return $data;
}

function v1_8010e_e2_process_result( $child, $send_go, $message ) {
	return v1_8010e_e2_process_json( v1_8010e_e2_process_finish( $child, $send_go ), 'RESULT', $message );
}

function v1_8010e_e2_process_observe( $scenario ) {
	return v1_8010e_e2_process_json( v1_8010e_e2_process_run( 'observe', $scenario ), 'OBSERVED', 'observer reads committed E2 state' );
}

/** Poll until the killed database session and transaction are both absent. */
function v1_8010e_e2_process_wait_connection_gone( $connection_id ) {
	$deadline = microtime( true ) + 15.0;
	do {
		$observed = v1_8010e_e2_process_json( v1_8010e_e2_process_run( 'thread', '', (string) $connection_id ), 'THREAD', 'independent session observes killed writer state' );
		if ( false === ( $observed['process_present'] ?? null ) && false === ( $observed['transaction_present'] ?? null ) ) {
			return;
		}
		usleep( 100000 );
	} while ( microtime( true ) < $deadline );
	throw new RuntimeException( 'e2_killed_connection_did_not_clear' );
}

/** Require server-side evidence that one exact session waits on another. */
function v1_8010e_e2_process_wait_for_owner_lock( $requester_connection, $blocker_connection ) {
	$deadline = microtime( true ) + 15.0;
	do {
		$observed = v1_8010e_e2_process_json(
			v1_8010e_e2_process_run( 'lock-wait', (string) $blocker_connection, (string) $requester_connection ),
			'LOCK_WAIT',
			'independent session observes exact owner lock wait'
		);
		if (
			(int) $requester_connection === (int) $observed['requester_connection']
			&& (int) $blocker_connection === (int) $observed['blocker_connection']
			&& true === $observed['waiting']
		) {
			return;
		}
		usleep( 100000 );
	} while ( microtime( true ) < $deadline );
	throw new RuntimeException( 'e2_owner_lock_wait_not_observed' );
}

function v1_8010e_e2_process_expect_empty( $scenario, $message ) {
	$observed = v1_8010e_e2_process_observe( $scenario );
	v1_8010e_e2_process_expect(
		array( 'plans' => 0, 'operations' => 0, 'weeks' => 0, 'blocks' => 0 ) === ( $observed['counts'] ?? null )
		&& false === ( $observed['linkage_valid'] ?? null )
		&& null === ( $observed['revision'] ?? null )
		&& null === ( $observed['result_hash'] ?? null ),
		$message
	);
}

/** Independently bind a worker success to one complete committed row set. */
function v1_8010e_e2_process_expect_committed( $scenario, $result, $message ) {
	$observed = v1_8010e_e2_process_observe( $scenario );
	v1_8010e_e2_process_expect(
		array( 'plans' => 1, 'operations' => 1, 'weeks' => 1, 'blocks' => 1 ) === ( $observed['counts'] ?? null )
		&& true === ( $observed['linkage_valid'] ?? null )
		&& '1' === ( $observed['revision'] ?? null )
		&& is_string( $observed['result_hash'] ?? null )
		&& is_string( $result['result_hash'] ?? null )
		&& hash_equals( $result['result_hash'], $observed['result_hash'] ),
		$message
	);
}

/** Require one content-free successful command summary. */
function v1_8010e_e2_process_expect_success( $result, $replayed, $message ) {
	v1_8010e_e2_process_expect(
		true === ( $result['ok'] ?? null )
		&& 'ok' === ( $result['reason_code'] ?? null )
		&& $replayed === ( $result['replayed'] ?? null )
		&& 200 === ( $result['status'] ?? null )
		&& true === ( $result['native_handle_preserved'] ?? null )
		&& '1' === ( $result['revision'] ?? null )
		&& is_string( $result['result_hash'] ?? null )
		&& 1 === preg_match( '/^[a-f0-9]{64}$/D', $result['result_hash'] ),
		$message
	);
}

/** Require one content-free failure summary. */
function v1_8010e_e2_process_expect_failure( $result, $reason, $status, $message ) {
	v1_8010e_e2_process_expect(
		false === ( $result['ok'] ?? null )
		&& $reason === ( $result['reason_code'] ?? null )
		&& false === ( $result['replayed'] ?? null )
		&& $status === ( $result['status'] ?? null )
		&& true === ( $result['native_handle_preserved'] ?? null )
		&& null === ( $result['revision'] ?? null )
		&& null === ( $result['result_hash'] ?? null ),
		$message
	);
}

$active = array();
try {
	/* Same first-touch key: one commit, one exact replay, no duplicate rows. */
	$first = v1_8010e_e2_process_start( 'command', 'same-a' );
	$active[] = $first;
	$ready = v1_8010e_e2_process_line( $first['pipes'][1] );
	v1_8010e_e2_process_expect( 1 === preg_match( '/^READY after_plan_lock connection=(\d+)$/D', $ready, $first_match ), 'first same-key writer holds the owner Plan row' );
	$second = v1_8010e_e2_process_start( 'command', 'same-b' );
	$active[] = $second;
	$ready = v1_8010e_e2_process_line( $second['pipes'][1] );
	v1_8010e_e2_process_expect( 1 === preg_match( '/^READY control_before_plan connection=(\d+)$/D', $ready, $second_match ), 'second same-key writer reaches the control phase before waiting on the owner row' );
	v1_8010e_e2_process_expect( (int) $first_match[1] !== (int) $second_match[1], 'same-key race uses independent database sessions' );
	v1_8010e_e2_process_wait_for_owner_lock( (int) $second_match[1], (int) $first_match[1] );
	$first_result = v1_8010e_e2_process_result( $first, true, 'first same-key writer commits' );
	$second_result = v1_8010e_e2_process_result( $second, false, 'second same-key writer completes after the first commit' );
	$active = array();
	v1_8010e_e2_process_expect_success( $first_result, false, 'first same-key writer owns the single commit' );
	v1_8010e_e2_process_expect_success( $second_result, true, 'second same-key writer is an exact replay' );
	v1_8010e_e2_process_expect( hash_equals( $first_result['result_hash'], $second_result['result_hash'] ), 'concurrent same-key replay returns byte-equivalent result truth' );
	$same_observed = v1_8010e_e2_process_observe( 'same-a' );
	v1_8010e_e2_process_expect( array( 'plans' => 1, 'operations' => 1, 'weeks' => 1, 'blocks' => 1 ) === $same_observed['counts'], 'same-key race commits exactly one physical row set' );

	$changed = v1_8010e_e2_process_json( v1_8010e_e2_process_run( 'command', 'same-changed' ), 'RESULT', 'changed same-key worker completes' );
	v1_8010e_e2_process_expect_failure( $changed, 'idempotency_conflict', 409, 'changed body under a committed key conflicts before stale handling' );

	/* Different first-touch keys at revision zero: one success and one stale. */
	$race_a = v1_8010e_e2_process_start( 'command', 'race-a' );
	$active[] = $race_a;
	$race_a_ready = v1_8010e_e2_process_line( $race_a['pipes'][1] );
	v1_8010e_e2_process_expect( 1 === preg_match( '/^READY after_plan_lock connection=(\d+)$/D', $race_a_ready, $race_a_match ), 'first revision-race writer holds the owner Plan' );
	$race_b = v1_8010e_e2_process_start( 'command', 'race-b' );
	$active[] = $race_b;
	$race_b_ready = v1_8010e_e2_process_line( $race_b['pipes'][1] );
	v1_8010e_e2_process_expect( 1 === preg_match( '/^READY control_before_plan connection=(\d+)$/D', $race_b_ready, $race_b_match ), 'different-key contender reaches the ordered control phase' );
	v1_8010e_e2_process_wait_for_owner_lock( (int) $race_b_match[1], (int) $race_a_match[1] );
	$race_a_result = v1_8010e_e2_process_result( $race_a, true, 'first revision-race writer commits' );
	$race_b_result = v1_8010e_e2_process_result( $race_b, false, 'second revision-race writer completes' );
	$active = array();
	v1_8010e_e2_process_expect_success( $race_a_result, false, 'first different-key command commits revision one' );
	v1_8010e_e2_process_expect_failure( $race_b_result, 'stale_revision', 409, 'second different-key command fails stale under the locked revision' );
	$race_observed = v1_8010e_e2_process_observe( 'race-a' );
	v1_8010e_e2_process_expect( array( 'plans' => 1, 'operations' => 1, 'weeks' => 1, 'blocks' => 1 ) === $race_observed['counts'], 'revision race commits one and only one row set' );

	/* A held owner must not serialize an unrelated owner. */
	$owner_a = v1_8010e_e2_process_start( 'command', 'isolation-a' );
	$active[] = $owner_a;
	$ready = v1_8010e_e2_process_line( $owner_a['pipes'][1] );
	v1_8010e_e2_process_expect( false !== strpos( $ready, 'READY before_commit connection=' ), 'owner A reaches the final pre-commit barrier' );
	$owner_b = v1_8010e_e2_process_json( v1_8010e_e2_process_run( 'command', 'isolation-b' ), 'RESULT', 'owner B completes while owner A remains held' );
	v1_8010e_e2_process_expect_success( $owner_b, false, 'independent owner commits without waiting for owner A' );
	$owner_a_result = v1_8010e_e2_process_result( $owner_a, true, 'owner A commits after independent owner B' );
	$active = array();
	v1_8010e_e2_process_expect_success( $owner_a_result, false, 'held owner A commits after release' );

	/* Real process death at every material pre-commit write boundary rolls back. */
	$crash_cases = array(
		'crash-plan' => 'after_plan_publish',
		'crash-week' => 'after_week_write',
		'crash-block' => 'after_block_write',
		'crash-receipt' => 'after_receipt_write',
		'crash-commit' => 'before_commit',
	);
	foreach ( $crash_cases as $scenario => $barrier ) {
		$crashed = v1_8010e_e2_process_start( 'command', $scenario );
		$active[] = $crashed;
		$line = v1_8010e_e2_process_line( $crashed['pipes'][1] );
		v1_8010e_e2_process_expect( 1 === preg_match( '/^READY ' . preg_quote( $barrier, '/' ) . ' connection=(\d+)$/D', $line, $crash_match ), 'crash worker reaches exact barrier: ' . $barrier );
		v1_8010e_e2_process_sigkill( $crashed );
		$active = array();
		v1_8010e_e2_process_wait_connection_gone( (int) $crash_match[1] );
		v1_8010e_e2_process_expect_empty( $scenario, 'SIGKILL rolls back every owner row: ' . $barrier );
		$recovered = v1_8010e_e2_process_json( v1_8010e_e2_process_run( 'command-retry', $scenario ), 'RESULT', 'fresh worker retries after SIGKILL: ' . $barrier );
		v1_8010e_e2_process_expect_success( $recovered, false, 'fresh process commits exactly once after SIGKILL: ' . $barrier );
		v1_8010e_e2_process_expect_committed( $scenario, $recovered, 'independent observer proves durable recovery after SIGKILL: ' . $barrier );
	}

	/* Database-side KILL CONNECTION cannot reconnect-follow or partially publish. */
	$killed_holder = v1_8010e_e2_process_start( 'command', 'kill-before-commit' );
	$active[] = $killed_holder;
	$line = v1_8010e_e2_process_line( $killed_holder['pipes'][1] );
	v1_8010e_e2_process_expect( 1 === preg_match( '/^READY before_commit connection=(\d+)$/D', $line, $kill_match ), 'connection-kill worker reaches pre-commit barrier' );
	$killer = v1_8010e_e2_process_json( v1_8010e_e2_process_run( 'kill', '', $kill_match[1] ), 'KILLED', 'independent session kills the exact writer connection' );
	v1_8010e_e2_process_expect( (int) $killer['connection_id'] !== (int) $killer['target_connection'], 'killer and target are independent database sessions' );
	v1_8010e_e2_process_expect( (int) $kill_match[1] === (int) $killer['target_connection'], 'killer targets the exact barrier connection' );
	$killed_result = v1_8010e_e2_process_result( $killed_holder, true, 'killed writer exits through the content-free service boundary' );
	$active = array();
	v1_8010e_e2_process_expect( (int) $kill_match[1] === (int) $killed_result['connection_id'], 'failed result remains bound to the exact killed writer identity' );
	v1_8010e_e2_process_expect_failure( $killed_result, 'dependency_unavailable', 503, 'killed writer fails closed without following a reconnect' );
	v1_8010e_e2_process_wait_connection_gone( (int) $kill_match[1] );
	v1_8010e_e2_process_expect_empty( 'kill-before-commit', 'KILL CONNECTION leaves no committed owner rows' );
	$kill_retry = v1_8010e_e2_process_json( v1_8010e_e2_process_run( 'command', 'kill-retry' ), 'RESULT', 'fresh worker retries the killed transaction' );
	v1_8010e_e2_process_expect_success( $kill_retry, false, 'fresh process commits once after database-side connection loss' );
	v1_8010e_e2_process_expect_committed( 'kill-before-commit', $kill_retry, 'independent observer proves durable recovery after KILL CONNECTION' );

	/* Death at the repository's first post-commit instruction preserves durable truth and replays. */
	$commit_loss_holder = v1_8010e_e2_process_start( 'command', 'response-commit-loss' );
	$active[] = $commit_loss_holder;
	$line = v1_8010e_e2_process_line( $commit_loss_holder['pipes'][1] );
	v1_8010e_e2_process_expect( 1 === preg_match( '/^READY after_commit connection=(\d+)$/D', $line, $commit_loss_match ), 'post-commit worker reaches the first instruction after durable COMMIT' );
	v1_8010e_e2_process_sigkill( $commit_loss_holder );
	$active = array();
	v1_8010e_e2_process_wait_connection_gone( (int) $commit_loss_match[1] );
	$commit_loss_observed = v1_8010e_e2_process_observe( 'response-commit-loss' );
	v1_8010e_e2_process_expect(
		array( 'plans' => 1, 'operations' => 1, 'weeks' => 1, 'blocks' => 1 ) === $commit_loss_observed['counts']
		&& true === $commit_loss_observed['linkage_valid']
		&& '1' === $commit_loss_observed['revision']
		&& is_string( $commit_loss_observed['result_hash'] )
		&& 1 === preg_match( '/^[a-f0-9]{64}$/D', $commit_loss_observed['result_hash'] ),
		'immediate post-commit death preserves one linked immutable row set'
	);
	$commit_loss_retry = v1_8010e_e2_process_json( v1_8010e_e2_process_run( 'command-retry', 'response-commit-loss' ), 'RESULT', 'fresh process retries the immediate post-commit loss' );
	v1_8010e_e2_process_expect_success( $commit_loss_retry, true, 'immediate post-commit retry is an exact replay' );
	v1_8010e_e2_process_expect( hash_equals( $commit_loss_observed['result_hash'], $commit_loss_retry['result_hash'] ), 'immediate post-commit replay returns exact durable result bytes' );
	v1_8010e_e2_process_expect_committed( 'response-commit-loss', $commit_loss_retry, 'post-commit retry leaves one linked committed row set' );

	/* Service completion followed by process death is later response loss, then exact replay. */
	$response_holder = v1_8010e_e2_process_start( 'command', 'response-loss' );
	$active[] = $response_holder;
	$line = v1_8010e_e2_process_line( $response_holder['pipes'][1] );
	v1_8010e_e2_process_expect( 1 === preg_match( '/^READY response_lost connection=(\d+) revision=1 hash=([a-f0-9]{64})$/D', $line, $response_match ), 'response-loss worker proves the service completed before response emission' );
	v1_8010e_e2_process_sigkill( $response_holder );
	$active = array();
	v1_8010e_e2_process_wait_connection_gone( (int) $response_match[1] );
	$response_observed = v1_8010e_e2_process_observe( 'response-loss' );
	v1_8010e_e2_process_expect(
		array( 'plans' => 1, 'operations' => 1, 'weeks' => 1, 'blocks' => 1 ) === $response_observed['counts']
		&& true === $response_observed['linkage_valid']
		&& '1' === $response_observed['revision']
		&& is_string( $response_observed['result_hash'] )
		&& 1 === preg_match( '/^[a-f0-9]{64}$/D', $response_observed['result_hash'] )
		&& hash_equals( $response_match[2], $response_observed['result_hash'] ),
		'after-commit process death preserves one complete immutable result'
	);
	$response_retry = v1_8010e_e2_process_json( v1_8010e_e2_process_run( 'command', 'response-retry' ), 'RESULT', 'fresh process retries after response loss' );
	v1_8010e_e2_process_expect_success( $response_retry, true, 'response-loss retry is reported as replay' );
	v1_8010e_e2_process_expect( hash_equals( $response_observed['result_hash'], $response_retry['result_hash'] ), 'response-loss retry returns the exact durable result bytes' );
	v1_8010e_e2_process_expect_committed( 'response-loss', $response_retry, 'response-loss replay leaves the single committed row set unchanged' );
} finally {
	foreach ( $active as $child ) {
		v1_8010e_e2_process_abort( $child );
	}
}

echo "V1 Study Schedule 8010E E2 independent concurrency/SIGKILL/replay proof: ok\n";
