<?php
/**
 * MissionMed Hub priority action scoring.
 *
 * @package MissionMed_Hub
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class MMED_Priority_Engine {

	/**
	 * Master method. Collects all action candidates, scores each, sorts descending, returns top 10.
	 *
	 * @param int    $user_id         User ID.
	 * @param array  $tasks           Task data.
	 * @param array  $course_data     Course data.
	 * @param array  $division_hubs   Division hub data.
	 * @param string $lifecycle_stage Lifecycle stage.
	 * @return array
	 */
	public static function get_priority_actions( $user_id, $tasks, $course_data, $division_hubs, $lifecycle_stage ) {
		$division_lookup  = self::build_division_lookup( $division_hubs );
		$primary_division = self::get_primary_division( $user_id, $division_hubs );
		$actions          = array();

		foreach ( self::get_overdue_tasks( $tasks ) as $task ) {
			$actions[] = self::build_task_action( $task, 'overdue_task', $division_lookup );
		}

		foreach ( self::get_upcoming_deadlines( $tasks, 7 ) as $task ) {
			$actions[] = self::build_task_action( $task, 'deadline', $division_lookup );
		}

		foreach ( $division_hubs as $division_id => $division ) {
			$active_phase_id    = $division['active_phase']['id'] ?? '';
			$active_phase_tasks = $division['active_phase']['task_objects'] ?? array();

			foreach ( self::get_incomplete_milestones( $active_phase_tasks, $active_phase_id ) as $task ) {
				if ( empty( $task['division'] ) ) {
					$task['division'] = $division_id;
				}

				$task['active_phase_id'] = $active_phase_id;
				$actions[]               = self::build_task_action( $task, 'milestone', $division_lookup );
			}
		}

		foreach ( self::get_low_progress_courses( $course_data, 25 ) as $course ) {
			$actions[] = self::build_course_action( $course, $division_lookup, $primary_division );
		}

		$session_actions = self::get_session_candidates( $division_hubs, $division_lookup );
		foreach ( $session_actions as $session_action ) {
			$actions[] = $session_action;
		}

		$booking_action = self::get_booking_action( $user_id );
		if ( ! empty( $booking_action ) ) {
			$actions[] = self::decorate_booking_action( $booking_action, $division_lookup, $primary_division );
		}

		if ( empty( $tasks ) ) {
			$actions[] = self::build_default_booking_action( $division_lookup, $primary_division );
		}

		if ( empty( $actions ) ) {
			$fallback_action = self::build_default_booking_action( $division_lookup, $primary_division );
			if ( ! empty( $fallback_action ) ) {
				$actions[] = $fallback_action;
			}
		}

		foreach ( $actions as $index => $action ) {
			$actions[ $index ]['score']   = self::score_action( $action, $lifecycle_stage );
			$actions[ $index ]['urgency'] = self::resolve_urgency( $actions[ $index ] );
		}

		$actions = self::dedupe_actions( $actions, $primary_division );

		usort(
			$actions,
			function ( $left, $right ) use ( $primary_division ) {
				if ( (int) $left['score'] !== (int) $right['score'] ) {
					return (int) $right['score'] <=> (int) $left['score'];
				}

				$left_due  = (int) ( $left['meta']['due_timestamp'] ?? PHP_INT_MAX );
				$right_due = (int) ( $right['meta']['due_timestamp'] ?? PHP_INT_MAX );
				if ( $left_due !== $right_due ) {
					return $left_due <=> $right_due;
				}

				$left_primary  = $left['division_id'] === $primary_division ? 1 : 0;
				$right_primary = $right['division_id'] === $primary_division ? 1 : 0;
				if ( $left_primary !== $right_primary ) {
					return $right_primary <=> $left_primary;
				}

				$left_sort  = (int) ( $left['meta']['sort_order'] ?? PHP_INT_MAX );
				$right_sort = (int) ( $right['meta']['sort_order'] ?? PHP_INT_MAX );
				if ( $left_sort !== $right_sort ) {
					return $left_sort <=> $right_sort;
				}

				return strcasecmp( $left['title'], $right['title'] );
			}
		);

		if ( empty( $tasks ) ) {
			$actions = self::promote_default_booking_action( $actions );
		}

		return array_slice( array_values( $actions ), 0, 10 );
	}

	/**
	 * Applies scoring formula to a single action candidate.
	 *
	 * @param array  $action          Action candidate.
	 * @param string $lifecycle_stage Lifecycle stage.
	 * @return int
	 */
	private static function score_action( $action, $lifecycle_stage ) {
		$type  = $action['type'] ?? '';
		$meta  = $action['meta'] ?? array();
		$score = 20;

		switch ( $type ) {
			case 'overdue_task':
				$days_overdue = max( 0, (int) ( $meta['days_overdue'] ?? 0 ) );
				$score        = min( 100, 90 + min( 10, $days_overdue * 5 ) );
				break;

			case 'session':
				$hours_until = (float) ( $meta['hours_until'] ?? 24 );
				$score       = $hours_until <= 2 ? 95 : 85;
				break;

			case 'deadline':
				$days_remaining = max( 0, (int) ( $meta['days_remaining'] ?? 0 ) );
				if ( $days_remaining <= 3 ) {
					$score = 80;
					if ( 0 === $days_remaining ) {
						$score += 10;
					} elseif ( 1 === $days_remaining ) {
						$score += 5;
					}
				} else {
					$score = 60 + min( 15, max( 0, ( 7 - $days_remaining ) * 5 ) );
				}
				break;

			case 'milestone':
				$score = 50;
				if ( self::stage_matches_phase( $lifecycle_stage, $meta['active_phase_id'] ?? '', $action['division_id'] ?? '' ) ) {
					$score += 10;
				}
				if ( 'revision_needed' === ( $meta['status'] ?? '' ) ) {
					$score += 5;
				}
				break;

			case 'course':
				$progress_pct = max( 0, (int) ( $meta['progress_pct'] ?? 0 ) );
				if ( 0 === $progress_pct ) {
					$score = 30;
					if ( ! empty( $meta['is_primary_division'] ) ) {
						$score += 5;
					}
				} else {
					$score = 40 + max( 0, (int) floor( ( 25 - $progress_pct ) / 10 ) * 5 );
				}
				break;

			case 'booking':
				$days_since_last_booking = max( 0, (int) ( $meta['days_since_last_booking'] ?? 0 ) );
				$score                   = 35 + min( 15, max( 0, (int) floor( ( $days_since_last_booking - 14 ) / 7 ) * 5 ) );
				break;

			case 'cta':
			default:
				$score = 20;
				break;
		}

		return max( 0, min( 100, (int) $score ) );
	}

	/**
	 * Filters tasks where due_date < today AND status not approved.
	 *
	 * @param array $tasks Task data.
	 * @return array
	 */
	private static function get_overdue_tasks( $tasks ) {
		$today = strtotime( current_time( 'Y-m-d' ) );

		return array_values(
			array_filter(
				$tasks,
				function ( $task ) use ( $today ) {
					if ( 'approved' === ( $task['status'] ?? '' ) || empty( $task['due_date'] ) ) {
						return false;
					}

					$due_timestamp = strtotime( $task['due_date'] );
					return false !== $due_timestamp && $due_timestamp < $today;
				}
			)
		);
	}

	/**
	 * Filters tasks where due_date is within $days from today.
	 *
	 * @param array $tasks Task data.
	 * @param int   $days  Day window.
	 * @return array
	 */
	private static function get_upcoming_deadlines( $tasks, $days = 7 ) {
		$today = strtotime( current_time( 'Y-m-d' ) );

		return array_values(
			array_filter(
				$tasks,
				function ( $task ) use ( $today, $days ) {
					if ( 'approved' === ( $task['status'] ?? '' ) || empty( $task['due_date'] ) ) {
						return false;
					}

					$due_timestamp = strtotime( $task['due_date'] );
					if ( false === $due_timestamp || $due_timestamp < $today ) {
						return false;
					}

					$days_remaining = (int) floor( ( $due_timestamp - $today ) / DAY_IN_SECONDS );
					return $days_remaining <= $days;
				}
			)
		);
	}

	/**
	 * Filters tasks in active phase with incomplete status.
	 *
	 * @param array  $tasks           Task data.
	 * @param string $active_phase_id Active phase ID.
	 * @return array
	 */
	private static function get_incomplete_milestones( $tasks, $active_phase_id ) {
		if ( empty( $active_phase_id ) ) {
			return array();
		}

		return array_values(
			array_filter(
				$tasks,
				function ( $task ) {
					return in_array( $task['status'] ?? '', array( 'not_started', 'in_progress', 'revision_needed' ), true );
				}
			)
		);
	}

	/**
	 * Courses with progress < threshold%.
	 *
	 * @param array $course_data Course data.
	 * @param int   $threshold   Progress threshold.
	 * @return array
	 */
	private static function get_low_progress_courses( $course_data, $threshold = 25 ) {
		return array_values(
			array_filter(
				$course_data,
				function ( $course ) use ( $threshold ) {
					return (int) ( $course['progress_pct'] ?? 0 ) < $threshold;
				}
			)
		);
	}

	/**
	 * Returns booking CTA if last_booking_date > 14 days ago.
	 *
	 * @param int $user_id User ID.
	 * @return array|null
	 */
	private static function get_booking_action( $user_id ) {
		$last_booking_date = get_user_meta( $user_id, '_mmed_last_booking_date', true );
		if ( empty( $last_booking_date ) ) {
			return null;
		}

		$booking_timestamp = strtotime( $last_booking_date );
		if ( false === $booking_timestamp ) {
			return null;
		}

		$days_since_last_booking = (int) floor( ( current_time( 'timestamp' ) - $booking_timestamp ) / DAY_IN_SECONDS );
		if ( $days_since_last_booking <= 14 ) {
			return null;
		}

		return array(
			'type'           => 'booking',
			'score'          => 0,
			'title'          => 'Book Your Next Strategy Session',
			'description'    => 'You have not had a strategy session in ' . $days_since_last_booking . ' days.',
			'action_url'     => get_option( 'mmed_calendly_url', function_exists( 'mmed_hub_default_option_value' ) ? mmed_hub_default_option_value( 'mmed_calendly_url' ) : '' ),
			'action_label'   => 'Book Session',
			'division_id'    => '',
			'division_label' => '',
			'urgency'        => 'low',
			'icon'           => 'mmed-icon-booking',
			'meta'           => array(
				'days_since_last_booking' => $days_since_last_booking,
				'entity_key'              => 'booking',
				'sort_order'              => 9998,
				'due_timestamp'           => PHP_INT_MAX,
			),
		);
	}

	/**
	 * Returns join-session action if session within 24 hours.
	 *
	 * @param array $division_hubs Division hub data.
	 * @return array|null
	 */
	private static function get_session_action( $division_hubs ) {
		$candidates = self::get_session_candidates( $division_hubs, self::build_division_lookup( $division_hubs ) );
		return ! empty( $candidates ) ? $candidates[0] : null;
	}

	/**
	 * Build action array for a task candidate.
	 *
	 * @param array  $task            Task data.
	 * @param string $type            Action type.
	 * @param array  $division_lookup Division metadata.
	 * @return array
	 */
	private static function build_task_action( $task, $type, $division_lookup ) {
		$division_id    = self::resolve_task_division( $task );
		$division_meta  = $division_lookup[ $division_id ] ?? self::get_default_division_meta( $division_id );
		$due_timestamp  = ! empty( $task['due_date'] ) ? strtotime( $task['due_date'] ) : false;
		$today          = strtotime( current_time( 'Y-m-d' ) );
		$days_overdue   = $due_timestamp ? max( 0, (int) floor( ( $today - $due_timestamp ) / DAY_IN_SECONDS ) ) : 0;
		$days_remaining = $due_timestamp ? max( 0, (int) floor( ( $due_timestamp - $today ) / DAY_IN_SECONDS ) ) : PHP_INT_MAX;
		$description    = '';

		if ( 'overdue_task' === $type ) {
			$description = ! empty( $task['due_label'] )
				? $task['due_label']
				: 'This milestone is overdue and needs attention now.';
		} elseif ( 'deadline' === $type ) {
			$description = ! empty( $task['due_label'] )
				? $task['due_label']
				: 'This milestone is due soon.';
		} else {
			$description = 'This milestone is part of your active phase.';
		}

		return array(
			'type'           => $type,
			'score'          => 0,
			'title'          => (string) ( $task['post_title'] ?? 'Open milestone' ),
			'description'    => $description,
			'action_url'     => self::build_task_route( $task, $division_id ),
			'action_label'   => self::task_action_label( $task ),
			'division_id'    => $division_id,
			'division_label' => $division_meta['label'],
			'urgency'        => 'normal',
			'icon'           => 'mmed-icon-task',
			'meta'           => array(
				'task_id'         => (int) ( $task['ID'] ?? 0 ),
				'due_date'        => $task['due_date'] ?? '',
				'due_timestamp'   => false !== $due_timestamp ? (int) $due_timestamp : PHP_INT_MAX,
				'days_overdue'    => $days_overdue,
				'days_remaining'  => $days_remaining,
				'sort_order'      => (int) ( $task['sort_order'] ?? PHP_INT_MAX ),
				'status'          => (string) ( $task['status'] ?? '' ),
				'active_phase_id' => (string) ( $task['active_phase_id'] ?? '' ),
				'entity_key'      => 'task:' . (int) ( $task['ID'] ?? 0 ),
			),
		);
	}

	/**
	 * Build action array for a course candidate.
	 *
	 * @param array  $course           Course data.
	 * @param array  $division_lookup  Division metadata.
	 * @param string $primary_division Primary division ID.
	 * @return array
	 */
	private static function build_course_action( $course, $division_lookup, $primary_division ) {
		$division_id   = sanitize_key( $course['division_guess'] ?? '' );
		$division_meta = $division_lookup[ $division_id ] ?? self::get_default_division_meta( $division_id );
		$progress_pct  = (int) ( $course['progress_pct'] ?? 0 );

		return array(
			'type'           => 'course',
			'score'          => 0,
			'title'          => (string) ( $course['title'] ?? 'Open course' ),
			'description'    => $progress_pct . '% complete in LearnDash.',
			'action_url'     => (string) ( $course['url'] ?? '#courses' ),
			'action_label'   => $progress_pct > 0 ? 'Resume Course' : 'Start Course',
			'division_id'    => $division_id,
			'division_label' => $division_meta['label'],
			'urgency'        => 'low',
			'icon'           => 'mmed-icon-course',
			'meta'           => array(
				'course_id'           => (int) ( $course['id'] ?? 0 ),
				'progress_pct'        => $progress_pct,
				'is_primary_division' => $division_id === $primary_division,
				'sort_order'          => 9000,
				'due_timestamp'       => PHP_INT_MAX,
				'entity_key'          => 'course:' . (int) ( $course['id'] ?? 0 ),
			),
		);
	}

	/**
	 * Apply division metadata to a booking action.
	 *
	 * @param array  $action           Booking action.
	 * @param array  $division_lookup  Division metadata.
	 * @param string $primary_division Primary division ID.
	 * @return array
	 */
	private static function decorate_booking_action( $action, $division_lookup, $primary_division ) {
		$division_meta = $division_lookup[ $primary_division ] ?? self::get_default_division_meta( $primary_division );

		$action['division_id']    = $primary_division;
		$action['division_label'] = $division_meta['label'];

		return $action;
	}

	/**
	 * Fallback booking action used when no other actions are available.
	 *
	 * @param array  $division_lookup  Division metadata.
	 * @param string $primary_division Primary division ID.
	 * @return array
	 */
	private static function build_default_booking_action( $division_lookup, $primary_division ) {
		$division_meta = $division_lookup[ $primary_division ] ?? self::get_default_division_meta( $primary_division );

		return array(
			'type'           => 'booking',
			'score'          => 0,
			'title'          => 'Book Introduction Call',
			'description'    => 'Start with a MissionMed strategy session while your milestones sync in.',
			'action_url'     => get_option( 'mmed_calendly_url', function_exists( 'mmed_hub_default_option_value' ) ? mmed_hub_default_option_value( 'mmed_calendly_url' ) : '' ),
			'action_label'   => 'Book Session',
			'division_id'    => $primary_division,
			'division_label' => $division_meta['label'],
			'urgency'        => 'normal',
			'icon'           => 'mmed-icon-booking',
			'meta'           => array(
				'days_since_last_booking' => 0,
				'entity_key'              => 'booking:fallback',
				'force_no_task_fallback'  => true,
				'sort_order'              => 9999,
				'due_timestamp'           => PHP_INT_MAX,
			),
		);
	}

	/**
	 * Build session candidates across divisions.
	 *
	 * @param array $division_hubs   Division hub data.
	 * @param array $division_lookup Division metadata.
	 * @return array
	 */
	private static function get_session_candidates( $division_hubs, $division_lookup ) {
		$candidates = array();
		$now        = current_time( 'timestamp' );

		foreach ( $division_hubs as $division_id => $division ) {
			$session = $division['next_session'] ?? null;
			if ( empty( $session['timestamp'] ) ) {
				continue;
			}

			$timestamp   = (int) $session['timestamp'];
			$hours_until = ( $timestamp - $now ) / HOUR_IN_SECONDS;
			if ( $hours_until < 0 || $hours_until > 24 ) {
				continue;
			}

			$division_meta = $division_lookup[ $division_id ] ?? self::get_default_division_meta( $division_id );

			$candidates[] = array(
				'type'           => 'session',
				'score'          => 0,
				'title'          => (string) ( $session['title'] ?? 'Upcoming Session' ),
				'description'    => (string) ( $session['display_date'] ?? 'Your next session is coming up.' ),
				'action_url'     => ! empty( $session['zoom_link'] ) ? $session['zoom_link'] : ( $division['booking_url'] ?? '#' ),
				'action_label'   => ! empty( $session['zoom_link'] ) ? 'Join Session' : 'View Session',
				'division_id'    => $division_id,
				'division_label' => $division_meta['label'],
				'urgency'        => 'high',
				'icon'           => 'mmed-icon-session',
				'meta'           => array(
					'due_timestamp' => $timestamp,
					'hours_until'   => $hours_until,
					'sort_order'    => 1,
					'entity_key'    => 'session:' . $division_id . ':' . sanitize_title( $session['title'] ?? 'session' ) . ':' . $timestamp,
				),
			);
		}

		usort(
			$candidates,
			function ( $left, $right ) {
				return (int) ( $left['meta']['due_timestamp'] ?? PHP_INT_MAX ) <=> (int) ( $right['meta']['due_timestamp'] ?? PHP_INT_MAX );
			}
		);

		return $candidates;
	}

	/**
	 * Remove lower-priority duplicates for the same underlying entity.
	 *
	 * @param array  $actions          Priority actions.
	 * @param string $primary_division Primary division ID.
	 * @return array
	 */
	private static function dedupe_actions( $actions, $primary_division ) {
		$deduped = array();

		foreach ( $actions as $action ) {
			$key = $action['meta']['entity_key'] ?? $action['type'] . ':' . $action['title'];
			if ( ! isset( $deduped[ $key ] ) ) {
				$deduped[ $key ] = $action;
				continue;
			}

			$current = $deduped[ $key ];
			if ( (int) $action['score'] > (int) $current['score'] ) {
				$deduped[ $key ] = $action;
				continue;
			}

			if ( (int) $action['score'] === (int) $current['score'] ) {
				$current_due = (int) ( $current['meta']['due_timestamp'] ?? PHP_INT_MAX );
				$next_due    = (int) ( $action['meta']['due_timestamp'] ?? PHP_INT_MAX );
				if ( $next_due < $current_due ) {
					$deduped[ $key ] = $action;
					continue;
				}

				$current_primary = $current['division_id'] === $primary_division ? 1 : 0;
				$next_primary    = $action['division_id'] === $primary_division ? 1 : 0;
				if ( $next_primary > $current_primary ) {
					$deduped[ $key ] = $action;
				}
			}
		}

		return array_values( $deduped );
	}

	/**
	 * Ensure the default no-task booking action remains first.
	 *
	 * @param array $actions Priority actions.
	 * @return array
	 */
	private static function promote_default_booking_action( $actions ) {
		foreach ( $actions as $index => $action ) {
			if ( ! empty( $action['meta']['force_no_task_fallback'] ) ) {
				unset( $actions[ $index ] );
				array_unshift( $actions, $action );
				break;
			}
		}

		return array_values( $actions );
	}

	/**
	 * Build division lookup metadata.
	 *
	 * @param array $division_hubs Division hub data.
	 * @return array
	 */
	private static function build_division_lookup( $division_hubs ) {
		$lookup = array();

		foreach ( $division_hubs as $division_id => $division ) {
			$lookup[ $division_id ] = array(
				'label'       => (string) ( $division['label'] ?? self::get_default_division_label( $division_id ) ),
				'booking_url' => (string) ( $division['booking_url'] ?? get_option( 'mmed_calendly_url', '' ) ),
			);
		}

		return $lookup;
	}

	/**
	 * Resolve the primary division for ordering.
	 *
	 * @param int   $user_id       User ID.
	 * @param array $division_hubs Division hub data.
	 * @return string
	 */
	private static function get_primary_division( $user_id, $division_hubs ) {
		$primary_division = sanitize_key( get_user_meta( $user_id, '_mmed_primary_division', true ) );
		if ( $primary_division ) {
			return $primary_division;
		}

		foreach ( $division_hubs as $division_id => $division ) {
			if ( ! empty( $division['available'] ) ) {
				return $division_id;
			}
		}

		return 'residency';
	}

	/**
	 * Infer a task action label from task status.
	 *
	 * @param array $task Task data.
	 * @return string
	 */
	private static function task_action_label( $task ) {
		if ( 'revision_needed' === ( $task['status'] ?? '' ) ) {
			return 'Revise Milestone';
		}

		if ( ! empty( $task['requires_file'] ) ) {
			return 'Upload File';
		}

		if ( 'in_progress' === ( $task['status'] ?? '' ) || 'pending_review' === ( $task['status'] ?? '' ) ) {
			return 'Open Milestone';
		}

		return 'Start Milestone';
	}

	/**
	 * Resolve a task route hash for hub.js.
	 *
	 * @param array  $task        Task data.
	 * @param string $division_id Division ID.
	 * @return string
	 */
	private static function build_task_route( $task, $division_id ) {
		return '#mmed-task-' . sanitize_key( $division_id ) . '-' . absint( $task['ID'] ?? 0 );
	}

	/**
	 * Determine action urgency class.
	 *
	 * @param array $action Action data.
	 * @return string
	 */
	private static function resolve_urgency( $action ) {
		$type = $action['type'] ?? '';
		$meta = $action['meta'] ?? array();

		if ( 'overdue_task' === $type || ( 'session' === $type && (float) ( $meta['hours_until'] ?? 24 ) <= 2 ) ) {
			return 'critical';
		}

		if ( 'deadline' === $type || 'session' === $type ) {
			return 'high';
		}

		if ( in_array( $type, array( 'booking', 'cta', 'course' ), true ) && (int) ( $action['score'] ?? 0 ) < 40 ) {
			return 'low';
		}

		return 'normal';
	}

	/**
	 * Determine if the current lifecycle stage aligns with the active phase.
	 *
	 * @param string $lifecycle_stage Lifecycle stage.
	 * @param string $phase_id        Active phase ID.
	 * @param string $division_id     Division ID.
	 * @return bool
	 */
	private static function stage_matches_phase( $lifecycle_stage, $phase_id, $division_id ) {
		$map = array(
			'PRE_APPLICATION' => 'foundation',
			'APPLICATION'     => 'applications',
			'INTERVIEW'       => 'interviews',
			'MATCH_STRATEGY'  => 'match_strategy',
		);

		if ( 'USCE_ONBOARDING' === $lifecycle_stage && 'clinicals' === $division_id ) {
			return true;
		}

		return ! empty( $map[ $lifecycle_stage ] ) && $map[ $lifecycle_stage ] === $phase_id;
	}

	/**
	 * Resolve a task's division.
	 *
	 * @param array $task Task data.
	 * @return string
	 */
	private static function resolve_task_division( $task ) {
		$division = sanitize_key( $task['division'] ?? '' );
		if ( $division ) {
			return $division;
		}

		$tier = sanitize_key( $task['program_tier'] ?? '' );
		$map  = array(
			'360elite'                 => 'residency',
			'360elite_onboarding'      => 'residency',
			'interview_prep_complete'  => 'residency',
			'interview_prep_foundation'=> 'residency',
			'usmle_prep'               => 'usmle',
			'usmle_exam_prep'          => 'usmle',
			'usce_onboarding'          => 'clinicals',
		);

		return $map[ $tier ] ?? 'residency';
	}

	/**
	 * Default division metadata.
	 *
	 * @param string $division_id Division ID.
	 * @return array
	 */
	private static function get_default_division_meta( $division_id ) {
		return array(
			'label'       => self::get_default_division_label( $division_id ),
			'booking_url' => get_option( 'mmed_calendly_url', function_exists( 'mmed_hub_default_option_value' ) ? mmed_hub_default_option_value( 'mmed_calendly_url' ) : '' ),
		);
	}

	/**
	 * Default division label fallback.
	 *
	 * @param string $division_id Division ID.
	 * @return string
	 */
	private static function get_default_division_label( $division_id ) {
		$labels = array(
			'residency' => 'Mission Residency',
			'usmle'     => 'USMLE Exam Prep',
			'clinicals' => 'Clinicals',
		);

		return $labels[ $division_id ] ?? 'MissionMed';
	}
}
