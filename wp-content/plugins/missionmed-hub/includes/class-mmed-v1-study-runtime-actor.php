<?php
/**
 * Direct, server-owned learner identity for the V1 Study Schedule runtime.
 *
 * @package MissionMed_Hub
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/** Resolve one learner without a global actor-kind filter. */
final class MMED_V1_Study_Runtime_Actor {

	/** @return array */
	public static function resolve( $now = null, $provider = null ) {
		$logged_in = function_exists( 'is_user_logged_in' ) && true === is_user_logged_in();
		$actor_id = function_exists( 'get_current_user_id' ) ? (int) get_current_user_id() : 0;
		if ( ! $logged_in || $actor_id <= 0 ) {
			return self::denied( 'unauthenticated' );
		}
		if ( function_exists( 'user_can' ) && user_can( $actor_id, 'manage_options' ) ) {
			return self::denied( 'actor_not_learner' );
		}

		$roles = self::roles( $actor_id );
		foreach ( array( 'administrator', 'instructor', 'group_leader', 'mentor', 'ld_instructor' ) as $forbidden_role ) {
			if ( in_array( $forbidden_role, $roles, true ) ) {
				return self::denied( 'actor_not_learner' );
			}
		}

		$entitlement = MMED_V1_Study_Entitlement::evaluate( $actor_id, $now, $provider );
		if ( empty( $entitlement['allowed'] ) ) {
			return self::denied( ! empty( $entitlement['dependency_error'] ) ? 'entitlement_unavailable' : 'not_found' );
		}
		$canonical = self::canonical_json( $entitlement );
		return array(
			'allowed'            => true,
			'actor_id'           => $actor_id,
			'actor_kind'         => 'learner',
			'owner_id'           => $actor_id,
			'entitlement'        => $entitlement,
			'entitlement_digest' => hash( 'sha256', $canonical ),
			'reason_code'        => 'learner_allowed',
		);
	}

	/** @return array */
	private static function roles( $actor_id ) {
		if ( ! function_exists( 'get_userdata' ) ) {
			return array();
		}
		$user = get_userdata( $actor_id );
		$roles = is_object( $user ) && isset( $user->roles ) && is_array( $user->roles ) ? $user->roles : array();
		$result = array();
		foreach ( $roles as $role ) {
			if ( is_string( $role ) && 1 === preg_match( '/^[a-z0-9_-]{1,64}$/D', $role ) ) {
				$result[] = $role;
			}
		}
		return array_values( array_unique( $result ) );
	}

	/** @return array */
	private static function denied( $reason_code ) {
		return array(
			'allowed'            => false,
			'actor_id'           => 0,
			'actor_kind'         => 'unknown',
			'owner_id'           => 0,
			'entitlement'        => null,
			'entitlement_digest' => null,
			'reason_code'        => $reason_code,
		);
	}

	/** @return string */
	private static function canonical_json( $value ) {
		$value = self::canonicalize( $value );
		$json = json_encode( $value, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRESERVE_ZERO_FRACTION );
		if ( ! is_string( $json ) ) {
			throw new RuntimeException( 'V1 actor evidence encoding failed.' );
		}
		return $json;
	}

	/** @return mixed */
	private static function canonicalize( $value ) {
		if ( ! is_array( $value ) ) {
			return $value;
		}
		$keys = array_keys( $value );
		$is_list = empty( $keys ) || $keys === range( 0, count( $keys ) - 1 );
		if ( ! $is_list ) {
			ksort( $value, SORT_STRING );
		}
		foreach ( $value as $key => $child ) {
			$value[ $key ] = self::canonicalize( $child );
		}
		return $value;
	}
}
