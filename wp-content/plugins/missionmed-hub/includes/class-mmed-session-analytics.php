<?php
/**
 * MissionMed session analytics.
 *
 * @package MissionMed_Hub
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Builds engagement dashboard data from attendance and Matrix stats.
 */
class MMED_Session_Analytics {

	/**
	 * Initialize hooks.
	 *
	 * @return void
	 */
	public static function init() {
		self::maybe_install();
	}

	/**
	 * No custom table is needed.
	 *
	 * @return void
	 */
	public static function maybe_install() {
		return;
	}

	/**
	 * Dashboard data.
	 *
	 * @param string $from     Start date.
	 * @param string $to       End date.
	 * @param string $template Template slug.
	 * @return array
	 */
	public static function get_dashboard_data( $from = '', $to = '', $template = '' ) {
		$from     = self::sanitize_date( $from ) ?: date_i18n( 'Y-m-d', strtotime( '-90 days' ) );
		$to       = self::sanitize_date( $to ) ?: current_time( 'Y-m-d' );
		$template = sanitize_key( $template );

		$attendance_by_session = class_exists( 'MMED_Attendance' ) ? MMED_Attendance::get_template_report( $template, $from, $to ) : array();
		$students              = self::students_for_template( $template );

		return array(
			'attendance_by_session'       => $attendance_by_session,
			'attendance_trend'            => self::attendance_trend( $attendance_by_session ),
			'top_attenders'               => self::ranked_students( $students, $template, true ),
			'at_risk_students'            => self::at_risk_students( $students, $template ),
			'session_popularity'          => self::session_popularity( $attendance_by_session ),
			'engagement_score_distribution' => self::engagement_distribution( $students ),
		);
	}

	/**
	 * REST: dashboard.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response
	 */
	public static function rest_dashboard( $request ) {
		return new WP_REST_Response(
			self::get_dashboard_data(
				$request->get_param( 'from' ),
				$request->get_param( 'to' ),
				$request->get_param( 'template' )
			),
			200
		);
	}

	/**
	 * REST: student analytics.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response
	 */
	public static function rest_student( $request ) {
		$user_id = absint( $request['user_id'] );

		return new WP_REST_Response(
			array(
				'user_id'     => $user_id,
				'user'        => self::student_identity( $user_id ),
				'attendance'  => class_exists( 'MMED_Attendance' ) ? MMED_Attendance::get_stats_for_user( $user_id ) : array(),
				'history'     => class_exists( 'MMED_Attendance' ) ? MMED_Attendance::get_student_attendance( $user_id, '', '' ) : array(),
			),
			200
		);
	}

	/**
	 * Build weekly trend data.
	 *
	 * @param array $rows Attendance rows.
	 * @return array
	 */
	private static function attendance_trend( $rows ) {
		$weeks = array();

		foreach ( $rows as $row ) {
			$ts = strtotime( $row['date'] ?? '' );
			if ( ! $ts ) {
				continue;
			}

			$key = date( 'o-\WW', $ts );
			if ( ! isset( $weeks[ $key ] ) ) {
				$weeks[ $key ] = array( 'attended' => 0, 'total' => 0 );
			}

			$weeks[ $key ]['attended'] += (int) ( $row['attended'] ?? 0 );
			$weeks[ $key ]['total']    += (int) ( $row['total_enrolled'] ?? 0 );
		}

		$output = array();
		foreach ( $weeks as $week => $data ) {
			$output[] = array(
				'week'         => $week,
				'average_rate' => $data['total'] ? (int) round( ( $data['attended'] / $data['total'] ) * 100 ) : 0,
			);
		}

		return $output;
	}

	/**
	 * Return top or all ranked students.
	 *
	 * @param array  $students Students.
	 * @param string $template Template slug.
	 * @param bool   $limit    Whether to limit to top 10.
	 * @return array
	 */
	private static function ranked_students( $students, $template, $limit ) {
		$rows = array();

		foreach ( $students as $student ) {
			$stats  = class_exists( 'MMED_Attendance' ) ? MMED_Attendance::get_stats_for_user( $student->ID, $template ) : array();
			$rows[] = array(
				'user_id'           => (int) $student->ID,
				'name'              => $student->display_name,
				'email'             => $student->user_email,
				'attendance_rate'   => (int) ( $stats['attendance_rate'] ?? 0 ),
				'sessions_attended' => (int) ( $stats['sessions_attended'] ?? 0 ),
				'sessions_total'    => (int) ( $stats['sessions_total'] ?? 0 ),
			);
		}

		usort(
			$rows,
			static function ( $a, $b ) {
				return $b['attendance_rate'] <=> $a['attendance_rate'];
			}
		);

		return $limit ? array_slice( $rows, 0, 10 ) : $rows;
	}

	/**
	 * At risk students.
	 *
	 * @param array  $students Students.
	 * @param string $template Template slug.
	 * @return array
	 */
	private static function at_risk_students( $students, $template ) {
		return array_values(
			array_filter(
				self::ranked_students( $students, $template, false ),
				static function ( $row ) {
					return (int) $row['sessions_total'] > 0 && (int) $row['attendance_rate'] < 50;
				}
			)
		);
	}

	/**
	 * Highest and lowest session groups.
	 *
	 * @param array $rows Attendance rows.
	 * @return array
	 */
	private static function session_popularity( $rows ) {
		$sorted = $rows;
		usort(
			$sorted,
			static function ( $a, $b ) {
				return (int) $b['attendance_rate'] <=> (int) $a['attendance_rate'];
			}
		);

		return array(
			'highest' => array_slice( $sorted, 0, 5 ),
			'lowest'  => array_slice( array_reverse( $sorted ), 0, 5 ),
		);
	}

	/**
	 * Match readiness histogram.
	 *
	 * @param array $students Students.
	 * @return array
	 */
	private static function engagement_distribution( $students ) {
		$buckets = array(
			'0-19'   => 0,
			'20-39'  => 0,
			'40-59'  => 0,
			'60-79'  => 0,
			'80-100' => 0,
		);

		foreach ( $students as $student ) {
			$score = self::match_readiness_for_user( $student->ID );
			if ( $score < 20 ) {
				$buckets['0-19']++;
			} elseif ( $score < 40 ) {
				$buckets['20-39']++;
			} elseif ( $score < 60 ) {
				$buckets['40-59']++;
			} elseif ( $score < 80 ) {
				$buckets['60-79']++;
			} else {
				$buckets['80-100']++;
			}
		}

		$output = array();
		foreach ( $buckets as $bucket => $count ) {
			$output[] = array(
				'bucket' => $bucket,
				'count'  => $count,
			);
		}

		return $output;
	}

	/**
	 * Load students for a template.
	 *
	 * @param string $template Template slug.
	 * @return WP_User[]
	 */
	private static function students_for_template( $template ) {
		if ( class_exists( 'MMED_Session_Manager' ) && $template ) {
			return MMED_Session_Manager::get_enrolled_students( $template );
		}

		return get_users(
			array(
				'fields' => 'all',
				'number' => 200,
			)
		);
	}

	/**
	 * Lightweight match readiness approximation.
	 *
	 * @param int $user_id User ID.
	 * @return int
	 */
	private static function match_readiness_for_user( $user_id ) {
		if ( ! class_exists( 'MMED_Attendance' ) ) {
			return 0;
		}

		$stats = MMED_Attendance::get_stats_for_user( $user_id );
		return (int) $stats['attendance_rate'];
	}

	/**
	 * Student identity.
	 *
	 * @param int $user_id User ID.
	 * @return array
	 */
	private static function student_identity( $user_id ) {
		$user = get_user_by( 'id', absint( $user_id ) );

		return array(
			'id'    => absint( $user_id ),
			'name'  => $user ? $user->display_name : '',
			'email' => $user ? $user->user_email : '',
		);
	}

	/**
	 * Sanitize date.
	 *
	 * @param mixed $value Raw date.
	 * @return string
	 */
	private static function sanitize_date( $value ) {
		$value = sanitize_text_field( (string) $value );
		return preg_match( '/^\d{4}-\d{2}-\d{2}$/', $value ) ? $value : '';
	}
}
