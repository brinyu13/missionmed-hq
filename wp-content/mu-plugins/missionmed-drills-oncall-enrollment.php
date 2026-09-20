<?php
/**
 * Plugin Name: MissionMed Drills On-Call Enrollment Bridge
 * Description: Grants and reconciles the Dr J, Drills On-Call LearnDash course when the matching WooCommerce subscription product is active.
 * Version: 1.1.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! defined( 'MMDOC_ACCESS_META_GRANT_ORDER_IDS' ) ) {
	define( 'MMDOC_ACCESS_META_GRANT_ORDER_IDS', '_mmdoc_drills_oncall_grant_order_ids' );
}
if ( ! defined( 'MMDOC_ACCESS_META_LAST_GRANTED_AT' ) ) {
	define( 'MMDOC_ACCESS_META_LAST_GRANTED_AT', '_mmdoc_drills_oncall_last_granted_at' );
}
if ( ! defined( 'MMDOC_ACCESS_META_LAST_REVOKED_AT' ) ) {
	define( 'MMDOC_ACCESS_META_LAST_REVOKED_AT', '_mmdoc_drills_oncall_last_revoked_at' );
}

function mmdoc_get_option_id( $key ) {
	return absint( get_option( $key, 0 ) );
}

if ( ! function_exists( 'mmdoc_user_has_explicit_learndash_course_enrollment' ) ) {
	function mmdoc_user_has_explicit_learndash_course_enrollment( $user_id, $course_id ) {
		$user_id   = absint( $user_id );
		$course_id = absint( $course_id );
		if ( $user_id <= 0 || $course_id <= 0 ) {
			return false;
		}

		if ( get_user_meta( $user_id, 'course_' . $course_id . '_access_from', true ) ) {
			return true;
		}

		$access_list = get_post_meta( $course_id, '_sfwd-course_access_list', true );
		if ( is_array( $access_list ) ) {
			return in_array( $user_id, array_map( 'absint', $access_list ), true );
		}

		if ( is_string( $access_list ) && '' !== trim( $access_list ) ) {
			$ids = array_filter( array_map( 'absint', preg_split( '/[,\s]+/', $access_list ) ) );
			return in_array( $user_id, $ids, true );
		}

		return false;
	}
}

function mmdoc_access_log( $event, $context = array() ) {
	$safe_context = array();
	foreach ( (array) $context as $key => $value ) {
		if ( is_scalar( $value ) || null === $value ) {
			$safe_context[ sanitize_key( (string) $key ) ] = $value;
		}
	}

	error_log( 'MissionMed Drills On-Call access: ' . sanitize_key( (string) $event ) . ' ' . wp_json_encode( $safe_context ) );
}

function mmdoc_drills_oncall_course_id() {
	$configured = trim( (string) getenv( 'MMHQ_DRILLS_ON_CALL_COURSE_ID' ) );
	if ( '' !== $configured && absint( $configured ) > 0 ) {
		return absint( $configured );
	}
	if ( defined( 'MMHQ_DRILLS_ON_CALL_COURSE_ID' ) && absint( MMHQ_DRILLS_ON_CALL_COURSE_ID ) > 0 ) {
		return absint( MMHQ_DRILLS_ON_CALL_COURSE_ID );
	}

	$option_id = mmdoc_get_option_id( 'mmed_course_drills_on_call' );
	if ( $option_id > 0 ) {
		return $option_id;
	}

	$courses = get_posts(
		array(
			'post_type'              => 'sfwd-courses',
			'title'                  => 'Dr J, Drills On-Call',
			'post_status'            => array( 'publish', 'draft', 'private' ),
			'posts_per_page'         => 10,
			'fields'                 => 'ids',
			'no_found_rows'          => true,
			'update_post_meta_cache' => false,
			'update_post_term_cache' => false,
		)
	);
	foreach ( $courses as $course_id ) {
		if ( 0 === strcasecmp( (string) get_the_title( $course_id ), 'Dr J, Drills On-Call' ) ) {
			return absint( $course_id );
		}
	}

	return 0;
}

function mmdoc_drills_oncall_product_ids() {
	$ids = array();
	$primary = mmdoc_get_option_id( 'mmed_product_drills_on_call' );
	if ( $primary > 0 ) {
		$ids[] = $primary;
	}

	$aliases = get_option( 'mmed_product_drills_on_call_aliases', '' );
	foreach ( explode( ',', (string) $aliases ) as $raw_id ) {
		$product_id = absint( trim( $raw_id ) );
		if ( $product_id > 0 ) {
			$ids[] = $product_id;
		}
	}

	$product = get_page_by_path( 'dr-j-drills-on-call', OBJECT, 'product' );
	if ( $product && ! empty( $product->ID ) ) {
		$ids[] = absint( $product->ID );
	}

	$products = get_posts(
		array(
			'post_type'              => 'product',
			'title'                  => 'Dr J, Drills On-Call',
			'post_status'            => array( 'publish', 'draft', 'private' ),
			'posts_per_page'         => 10,
			'fields'                 => 'ids',
			'no_found_rows'          => true,
			'update_post_meta_cache' => false,
			'update_post_term_cache' => false,
		)
	);
	foreach ( $products as $product_id ) {
		if ( 0 === strcasecmp( (string) get_the_title( $product_id ), 'Dr J, Drills On-Call' ) ) {
			$ids[] = absint( $product_id );
		}
	}

	return apply_filters( 'mmdoc_drills_oncall_product_ids', array_values( array_unique( $ids ) ) );
}

function mmdoc_order_contains_drills_oncall_product( $order ) {
	if ( ! $order || ! is_object( $order ) || ! method_exists( $order, 'get_items' ) ) {
		return false;
	}

	$product_lookup = array_fill_keys( mmdoc_drills_oncall_product_ids(), true );
	if ( empty( $product_lookup ) ) {
		return false;
	}

	foreach ( $order->get_items() as $item ) {
		$product_ids = array();
		if ( is_object( $item ) && method_exists( $item, 'get_product_id' ) ) {
			$product_ids[] = absint( $item->get_product_id() );
		}
		if ( is_object( $item ) && method_exists( $item, 'get_variation_id' ) ) {
			$product_ids[] = absint( $item->get_variation_id() );
		}

		foreach ( array_unique( array_filter( $product_ids ) ) as $product_id ) {
			if ( isset( $product_lookup[ $product_id ] ) ) {
				return true;
			}
		}
	}

	return false;
}

function mmdoc_get_orderlike_id( $order ) {
	if ( is_numeric( $order ) ) {
		return absint( $order );
	}
	if ( is_object( $order ) && method_exists( $order, 'get_id' ) ) {
		return absint( $order->get_id() );
	}
	return 0;
}

function mmdoc_get_orderlike_user_id( $order ) {
	if ( is_numeric( $order ) && function_exists( 'wc_get_order' ) ) {
		$order = wc_get_order( absint( $order ) );
	}
	if ( is_object( $order ) && method_exists( $order, 'get_user_id' ) ) {
		return absint( $order->get_user_id() );
	}
	return 0;
}

function mmdoc_drills_oncall_access_status_allows_access( $status ) {
	return in_array( (string) $status, array( 'active', 'pending-cancel', 'processing', 'completed' ), true );
}

function mmdoc_user_has_active_drills_oncall_commerce_access( $user_id ) {
	$user_id = absint( $user_id );
	if ( $user_id <= 0 ) {
		return false;
	}

	if ( function_exists( 'wcs_get_users_subscriptions' ) ) {
		$subscriptions = wcs_get_users_subscriptions( $user_id );
		foreach ( (array) $subscriptions as $subscription ) {
			if ( ! is_object( $subscription ) || ! method_exists( $subscription, 'get_status' ) ) {
				continue;
			}
			if ( ! mmdoc_order_contains_drills_oncall_product( $subscription ) ) {
				continue;
			}
			if ( mmdoc_drills_oncall_access_status_allows_access( $subscription->get_status() ) ) {
				return true;
			}
		}

		return false;
	}

	if ( ! function_exists( 'wc_get_orders' ) ) {
		return false;
	}

	$orders = wc_get_orders(
		array(
			'customer_id' => $user_id,
			'status'      => array( 'processing', 'completed' ),
			'limit'       => 20,
			'orderby'     => 'date',
			'order'       => 'DESC',
			'return'      => 'objects',
		)
	);

	foreach ( (array) $orders as $order ) {
		if ( mmdoc_order_contains_drills_oncall_product( $order ) ) {
			return true;
		}
	}

	return false;
}

function mmdoc_record_drills_oncall_grant( $user_id, $order_id ) {
	$user_id  = absint( $user_id );
	$order_id = absint( $order_id );
	if ( $user_id <= 0 || $order_id <= 0 ) {
		return;
	}

	$grant_ids = get_user_meta( $user_id, MMDOC_ACCESS_META_GRANT_ORDER_IDS, true );
	if ( ! is_array( $grant_ids ) ) {
		$grant_ids = array();
	}
	$grant_ids[] = $order_id;
	$grant_ids = array_values( array_unique( array_map( 'absint', $grant_ids ) ) );

	update_user_meta( $user_id, MMDOC_ACCESS_META_GRANT_ORDER_IDS, $grant_ids );
	update_user_meta( $user_id, MMDOC_ACCESS_META_LAST_GRANTED_AT, gmdate( 'c' ) );
	delete_user_meta( $user_id, MMDOC_ACCESS_META_LAST_REVOKED_AT );
	update_post_meta( $order_id, '_mmdoc_drills_oncall_course_granted_at', gmdate( 'c' ) );
}

function mmdoc_grant_drills_oncall_from_order( $order_id ) {
	if ( ! function_exists( 'wc_get_order' ) || ! function_exists( 'ld_update_course_access' ) ) {
		return;
	}

	$order = is_numeric( $order_id ) ? wc_get_order( absint( $order_id ) ) : $order_id;
	if ( ! $order ) {
		return;
	}

	$user_id = absint( $order->get_user_id() );
	$course_id = mmdoc_drills_oncall_course_id();
	if ( $user_id <= 0 || $course_id <= 0 ) {
		return;
	}

	if ( ! mmdoc_order_contains_drills_oncall_product( $order ) ) {
		return;
	}

	ld_update_course_access( $user_id, $course_id );
	mmdoc_record_drills_oncall_grant( $user_id, mmdoc_get_orderlike_id( $order ) );
	mmdoc_access_log(
		'grant',
		array(
			'user_id'   => $user_id,
			'order_id'  => mmdoc_get_orderlike_id( $order ),
			'course_id' => $course_id,
		)
	);

	if ( function_exists( 'MMED_Access_Audit' ) && method_exists( 'MMED_Access_Audit', 'clear_cache' ) ) {
		MMED_Access_Audit::clear_cache();
	}
}

function mmdoc_revoke_drills_oncall_if_no_active_access( $order_id ) {
	if ( ! function_exists( 'wc_get_order' ) || ! function_exists( 'ld_update_course_access' ) ) {
		return;
	}

	$order = is_numeric( $order_id ) ? wc_get_order( absint( $order_id ) ) : $order_id;
	if ( ! $order || ! mmdoc_order_contains_drills_oncall_product( $order ) ) {
		return;
	}

	$user_id   = mmdoc_get_orderlike_user_id( $order );
	$course_id = mmdoc_drills_oncall_course_id();
	if ( $user_id <= 0 || $course_id <= 0 ) {
		return;
	}

	$grant_ids = get_user_meta( $user_id, MMDOC_ACCESS_META_GRANT_ORDER_IDS, true );
	if ( ! is_array( $grant_ids ) || empty( $grant_ids ) ) {
		mmdoc_access_log(
			'revoke_skip_no_plugin_grant',
			array(
				'user_id'   => $user_id,
				'order_id'  => mmdoc_get_orderlike_id( $order ),
				'course_id' => $course_id,
			)
		);
		return;
	}

	if ( mmdoc_user_has_active_drills_oncall_commerce_access( $user_id ) ) {
		mmdoc_access_log(
			'revoke_skip_active_commerce',
			array(
				'user_id'   => $user_id,
				'order_id'  => mmdoc_get_orderlike_id( $order ),
				'course_id' => $course_id,
			)
		);
		return;
	}

	ld_update_course_access( $user_id, $course_id, true );
	delete_user_meta( $user_id, MMDOC_ACCESS_META_GRANT_ORDER_IDS );
	update_user_meta( $user_id, MMDOC_ACCESS_META_LAST_REVOKED_AT, gmdate( 'c' ) );
	update_post_meta( mmdoc_get_orderlike_id( $order ), '_mmdoc_drills_oncall_course_revoked_at', gmdate( 'c' ) );

	mmdoc_access_log(
		'revoke',
		array(
			'user_id'   => $user_id,
			'order_id'  => mmdoc_get_orderlike_id( $order ),
			'course_id' => $course_id,
		)
	);

	if ( function_exists( 'MMED_Access_Audit' ) && method_exists( 'MMED_Access_Audit', 'clear_cache' ) ) {
		MMED_Access_Audit::clear_cache();
	}
}

add_action( 'woocommerce_order_status_completed', 'mmdoc_grant_drills_oncall_from_order', 20 );
add_action( 'woocommerce_order_status_processing', 'mmdoc_grant_drills_oncall_from_order', 20 );
add_action( 'woocommerce_order_status_cancelled', 'mmdoc_revoke_drills_oncall_if_no_active_access', 20 );
add_action( 'woocommerce_order_status_failed', 'mmdoc_revoke_drills_oncall_if_no_active_access', 20 );
add_action( 'woocommerce_order_status_refunded', 'mmdoc_revoke_drills_oncall_if_no_active_access', 20 );

add_action( 'woocommerce_subscription_status_active', 'mmdoc_grant_drills_oncall_from_order', 20 );
add_action( 'woocommerce_subscription_status_pending-cancel', 'mmdoc_grant_drills_oncall_from_order', 20 );
add_action( 'woocommerce_subscription_status_cancelled', 'mmdoc_revoke_drills_oncall_if_no_active_access', 20 );
add_action( 'woocommerce_subscription_status_expired', 'mmdoc_revoke_drills_oncall_if_no_active_access', 20 );
add_action( 'woocommerce_subscription_status_on-hold', 'mmdoc_revoke_drills_oncall_if_no_active_access', 20 );

if ( defined( 'WP_CLI' ) && WP_CLI ) {
	WP_CLI::add_command(
		'missionmed drills-oncall-status',
		function ( $args ) {
			$identifier = isset( $args[0] ) ? (string) $args[0] : '';
			if ( '' === $identifier ) {
				WP_CLI::error( 'Usage: wp missionmed drills-oncall-status <user-id|login|email>' );
			}

			if ( ctype_digit( $identifier ) ) {
				$user = get_user_by( 'id', absint( $identifier ) );
			} elseif ( false !== strpos( $identifier, '@' ) ) {
				$user = get_user_by( 'email', $identifier );
			} else {
				$user = get_user_by( 'login', $identifier );
			}

			if ( ! $user ) {
				WP_CLI::error( 'User not found.' );
			}

			$user_id   = absint( $user->ID );
			$course_id = mmdoc_drills_oncall_course_id();
			$product_ids = mmdoc_drills_oncall_product_ids();
			$explicit_enrollment = $course_id > 0 ? mmdoc_user_has_explicit_learndash_course_enrollment( $user_id, $course_id ) : false;

			$subscription_rows = array();
			if ( function_exists( 'wcs_get_users_subscriptions' ) ) {
				foreach ( (array) wcs_get_users_subscriptions( $user_id ) as $subscription ) {
					if ( ! is_object( $subscription ) || ! method_exists( $subscription, 'get_id' ) ) {
						continue;
					}
					if ( ! mmdoc_order_contains_drills_oncall_product( $subscription ) ) {
						continue;
					}
					$subscription_rows[] = array(
						'id'            => absint( $subscription->get_id() ),
						'status'        => method_exists( $subscription, 'get_status' ) ? (string) $subscription->get_status() : '',
						'allows_access' => method_exists( $subscription, 'get_status' ) ? mmdoc_drills_oncall_access_status_allows_access( $subscription->get_status() ) : false,
					);
				}
			}

			$out = array(
				'user_id'                => $user_id,
				'user_login'             => (string) $user->user_login,
				'course_id'              => $course_id,
				'course_title'           => $course_id > 0 ? (string) get_the_title( $course_id ) : null,
				'product_ids'            => $product_ids,
				'explicit_enrollment'    => $explicit_enrollment,
				'commerce_active_access' => mmdoc_user_has_active_drills_oncall_commerce_access( $user_id ),
				'plugin_grant_order_ids' => get_user_meta( $user_id, MMDOC_ACCESS_META_GRANT_ORDER_IDS, true ),
				'last_granted_at'        => get_user_meta( $user_id, MMDOC_ACCESS_META_LAST_GRANTED_AT, true ),
				'last_revoked_at'        => get_user_meta( $user_id, MMDOC_ACCESS_META_LAST_REVOKED_AT, true ),
				'subscriptions'          => $subscription_rows,
			);

			WP_CLI::line( wp_json_encode( $out, JSON_PRETTY_PRINT ) );
		}
	);
}
