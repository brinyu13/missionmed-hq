<?php
/**
 * Exact, read-only information_schema verifier for 8010E Week tables.
 *
 * The accepted 8010D inspector owns the shared comparison engine. This class
 * narrows it to additive tables 6-7 while retaining parent table identities for
 * exact foreign-key comparison. It registers no hooks and performs no writes.
 *
 * @package MissionMed_Hub
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/** Reject missing, partial, drifted, extra, or trigger-bearing Week schema. */
final class MMED_V1_Study_Week_Schema_Inspector extends MMED_V1_Study_Schema_Inspector {

	/** @return array{state:string,ok:bool,errors:array,tables:array} */
	public function inspect() {
		$week_names = MMED_V1_Study_Week_Schema::table_names( $this->database_for_week_inspection() );
		$all_names  = array_merge( MMED_V1_Study_Schema::table_names( $this->database_for_week_inspection() ), $week_names );
		$expected   = MMED_V1_Study_Week_Schema::expected_shapes( $this->database_for_week_inspection() );
		$tables     = $this->read_tables( array_values( $week_names ) );

		if ( empty( $tables ) ) {
			return $this->result( self::STATE_ABSENT, true, array(), array() );
		}
		if ( count( $tables ) !== count( $week_names ) ) {
			return $this->result( self::STATE_PARTIAL, false, array( 'week_table_set_partial' ), array_keys( $tables ) );
		}

		$errors = array();
		foreach ( $week_names as $key => $name ) {
			if ( ! isset( $tables[ $name ], $expected[ $key ] ) ) {
				$errors[] = 'week_table_mapping_invalid:' . $key;
				continue;
			}
			$errors = array_merge( $errors, $this->compare_table( $name, $tables[ $name ], $expected[ $key ], $all_names ) );
		}

		return $this->result(
			empty( $errors ) ? self::STATE_COMPATIBLE : self::STATE_INCOMPATIBLE,
			empty( $errors ),
			$errors,
			array_keys( $tables )
		);
	}

	/** Inspect one additive table against its complete descriptor. */
	public function inspect_table( $table_key ) {
		$database   = $this->database_for_week_inspection();
		$week_names = MMED_V1_Study_Week_Schema::table_names( $database );
		$all_names  = array_merge( MMED_V1_Study_Schema::table_names( $database ), $week_names );
		$expected   = MMED_V1_Study_Week_Schema::expected_shapes( $database );
		if ( ! is_string( $table_key ) || ! isset( $week_names[ $table_key ], $expected[ $table_key ] ) ) {
			throw new InvalidArgumentException( 'V1 Week table key is invalid.' );
		}
		$tables = $this->read_tables( array( $week_names[ $table_key ] ) );
		if ( empty( $tables ) ) {
			return array( 'exists' => false, 'ok' => false, 'errors' => array( 'table_absent:' . $table_key ) );
		}
		$errors = $this->compare_table( $week_names[ $table_key ], $tables[ $week_names[ $table_key ] ], $expected[ $table_key ], $all_names );
		return array( 'exists' => true, 'ok' => empty( $errors ), 'errors' => $errors );
	}

	/**
	 * The parent deliberately keeps its connection private. This accessor uses a
	 * protected reflection-free seam exposed by the parent solely for descendants.
	 *
	 * @return object
	 */
	private function database_for_week_inspection() {
		return $this->database_connection();
	}
}
