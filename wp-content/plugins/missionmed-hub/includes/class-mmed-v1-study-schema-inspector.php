<?php
/**
 * Exact, read-only information_schema verifier for the 8010D kernel.
 *
 * @package MissionMed_Hub
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/** Reject missing, partial, drifted, or extra kernel schema. */
final class MMED_V1_Study_Schema_Inspector {

	const STATE_ABSENT       = 'absent';
	const STATE_COMPATIBLE   = 'compatible';
	const STATE_PARTIAL      = 'partial';
	const STATE_INCOMPATIBLE = 'incompatible';

	/** @var object */
	private $database;

	/** @var string */
	private $schema_name;

	/** @var bool */
	private $is_mariadb;

	/** @param object $database WordPress database connection. */
	public function __construct( $database ) {
		if ( ! is_object( $database ) || ! method_exists( $database, 'get_results' ) || ! method_exists( $database, 'prepare' ) ) {
			throw new InvalidArgumentException( 'V1 schema inspector requires a database connection.' );
		}
		$this->database    = $database;
		$this->schema_name = $this->read_schema_name();
		$this->is_mariadb  = $this->read_is_mariadb();
	}

	/**
	 * @return array{state:string,ok:bool,errors:array,tables:array}
	 */
	public function inspect() {
		$names    = MMED_V1_Study_Schema::table_names( $this->database );
		$expected = MMED_V1_Study_Schema::expected_shapes( $this->database );
		$tables   = $this->read_tables( array_values( $names ) );

		if ( empty( $tables ) ) {
			return $this->result( self::STATE_ABSENT, true, array(), array() );
		}

		if ( count( $tables ) !== count( $names ) ) {
			return $this->result(
				self::STATE_PARTIAL,
				false,
				array( 'kernel_table_set_partial' ),
				array_keys( $tables )
			);
		}

		$errors = array();
		foreach ( $names as $key => $name ) {
			if ( ! isset( $tables[ $name ], $expected[ $key ] ) ) {
				$errors[] = 'kernel_table_mapping_invalid:' . $key;
				continue;
			}
			$errors = array_merge( $errors, $this->compare_table( $name, $tables[ $name ], $expected[ $key ], $names ) );
		}

		return $this->result(
			empty( $errors ) ? self::STATE_COMPATIBLE : self::STATE_INCOMPATIBLE,
			empty( $errors ),
			$errors,
			array_keys( $tables )
		);
	}

	/** @return string */
	public function schema_name() {
		return $this->schema_name;
	}

	/** Inspect one named kernel table against its complete descriptor. @return array */
	public function inspect_table( $table_key ) {
		$names    = MMED_V1_Study_Schema::table_names( $this->database );
		$expected = MMED_V1_Study_Schema::expected_shapes( $this->database );
		if ( ! is_string( $table_key ) || ! isset( $names[ $table_key ], $expected[ $table_key ] ) ) {
			throw new InvalidArgumentException( 'V1 table key is invalid.' );
		}

		$tables = $this->read_tables( array( $names[ $table_key ] ) );
		if ( empty( $tables ) ) {
			return array( 'exists' => false, 'ok' => false, 'errors' => array( 'table_absent:' . $table_key ) );
		}

		$errors = $this->compare_table( $names[ $table_key ], $tables[ $names[ $table_key ] ], $expected[ $table_key ], $names );
		return array( 'exists' => true, 'ok' => empty( $errors ), 'errors' => $errors );
	}

	/** @return string */
	private function read_schema_name() {
		$name = $this->database->get_var( 'SELECT DATABASE()' );
		if ( ! is_string( $name ) || '' === $name ) {
			throw new RuntimeException( 'V1 database schema identity is unavailable.' );
		}
		return $name;
	}

	/** @return bool */
	private function read_is_mariadb() {
		$version = $this->database->get_var( 'SELECT VERSION()' );
		if ( ! is_string( $version ) || '' === $version ) {
			throw new RuntimeException( 'V1 database server identity is unavailable.' );
		}
		return false !== stripos( $version, 'mariadb' );
	}

	/** @return array */
	private function read_tables( $table_names ) {
		$sql  = 'SELECT TABLE_NAME, ENGINE, TABLE_COLLATION, ROW_FORMAT FROM information_schema.TABLES';
		$sql .= ' WHERE TABLE_SCHEMA = %s AND TABLE_NAME IN (' . implode( ', ', array_fill( 0, count( $table_names ), '%s' ) ) . ')';
		$rows = $this->rows( $this->database->prepare( $sql, array_merge( array( $this->schema_name ), $table_names ) ) );

		$result = array();
		foreach ( $rows as $row ) {
			if ( isset( $row['TABLE_NAME'] ) ) {
				$result[ (string) $row['TABLE_NAME'] ] = $row;
			}
		}
		return $result;
	}

	/** @return array */
	private function compare_table( $table_name, $actual, $expected, $table_names ) {
		$errors = array();
		if ( 0 !== strcasecmp( (string) $expected['engine'], (string) ( $actual['ENGINE'] ?? '' ) ) ) {
			$errors[] = $table_name . ':engine';
		}
		if ( 0 !== strcasecmp( (string) $expected['row_format'], (string) ( $actual['ROW_FORMAT'] ?? '' ) ) ) {
			$errors[] = $table_name . ':row_format';
		}
		if ( (string) $expected['collation'] !== (string) ( $actual['TABLE_COLLATION'] ?? '' ) ) {
			$errors[] = $table_name . ':collation';
		}

		$errors = array_merge( $errors, $this->compare_columns( $table_name, $expected['columns'] ) );
		$errors = array_merge( $errors, $this->compare_indexes( $table_name, $expected['indexes'] ) );
		$errors = array_merge( $errors, $this->compare_foreign_keys( $table_name, $expected['foreign_keys'], $table_names ) );
		$errors = array_merge( $errors, $this->compare_checks( $table_name, $expected['checks'] ) );
		return $errors;
	}

	/** @return array */
	private function compare_columns( $table_name, $expected ) {
		$sql = 'SELECT COLUMN_NAME, ORDINAL_POSITION, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT,';
		$sql .= ' CHARACTER_MAXIMUM_LENGTH, CHARACTER_SET_NAME, COLLATION_NAME, EXTRA, DATETIME_PRECISION, COLUMN_TYPE';
		$sql .= ' FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s ORDER BY ORDINAL_POSITION';
		$rows = $this->rows( $this->database->prepare( $sql, $this->schema_name, $table_name ) );

		$errors        = array();
		$expected_keys = array_keys( $expected );
		$actual_keys   = array();
		foreach ( $rows as $position => $row ) {
			$name          = isset( $row['COLUMN_NAME'] ) ? (string) $row['COLUMN_NAME'] : '';
			$actual_keys[] = $name;
			if ( ! isset( $expected[ $name ] ) ) {
				continue;
			}
			$shape = $expected[ $name ];
			if ( (string) $shape['type'] !== strtolower( (string) ( $row['DATA_TYPE'] ?? '' ) ) ) {
				$errors[] = $table_name . ':' . $name . ':type';
			}
			if ( $shape['nullable'] !== ( 'YES' === ( $row['IS_NULLABLE'] ?? '' ) ) ) {
				$errors[] = $table_name . ':' . $name . ':nullable';
			}
			if ( $this->normalize_default( $shape['default'] ) !== $this->normalize_default( $row['COLUMN_DEFAULT'] ?? null ) ) {
				$errors[] = $table_name . ':' . $name . ':default';
			}
			if ( null !== $shape['length'] && (string) $shape['length'] !== (string) ( $row['CHARACTER_MAXIMUM_LENGTH'] ?? '' ) ) {
				$errors[] = $table_name . ':' . $name . ':length';
			}
			$unsigned = false !== stripos( (string) ( $row['COLUMN_TYPE'] ?? '' ), 'unsigned' );
			if ( $shape['unsigned'] !== $unsigned ) {
				$errors[] = $table_name . ':' . $name . ':unsigned';
			}
			if ( null !== $shape['datetime_precision'] && (string) $shape['datetime_precision'] !== (string) ( $row['DATETIME_PRECISION'] ?? '' ) ) {
				$errors[] = $table_name . ':' . $name . ':datetime_precision';
			}
			if ( $this->normalize_nullable_string( $shape['charset'] ) !== $this->normalize_nullable_string( $row['CHARACTER_SET_NAME'] ?? null ) ) {
				$errors[] = $table_name . ':' . $name . ':charset';
			}
			if ( $this->normalize_nullable_string( $shape['collation'] ) !== $this->normalize_nullable_string( $row['COLLATION_NAME'] ?? null ) ) {
				$errors[] = $table_name . ':' . $name . ':collation';
			}
			if ( strtolower( (string) $shape['extra'] ) !== strtolower( trim( (string) ( $row['EXTRA'] ?? '' ) ) ) ) {
				$errors[] = $table_name . ':' . $name . ':extra';
			}
			if ( ( $position + 1 ) !== (int) ( $row['ORDINAL_POSITION'] ?? 0 ) ) {
				$errors[] = $table_name . ':' . $name . ':position';
			}
		}

		if ( $expected_keys !== $actual_keys ) {
			$errors[] = $table_name . ':column_set_or_order';
		}
		return array_values( array_unique( $errors ) );
	}

	/** @return array */
	private function compare_indexes( $table_name, $expected ) {
		$sql = 'SELECT INDEX_NAME, NON_UNIQUE, SEQ_IN_INDEX, COLUMN_NAME, SUB_PART, INDEX_TYPE';
		$sql .= ' FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s';
		$sql .= ' ORDER BY INDEX_NAME, SEQ_IN_INDEX';
		$rows = $this->rows( $this->database->prepare( $sql, $this->schema_name, $table_name ) );

		$actual = array();
		$errors = array();
		foreach ( $rows as $row ) {
			$name = (string) ( $row['INDEX_NAME'] ?? '' );
			if ( ! isset( $actual[ $name ] ) ) {
				$actual[ $name ] = array(
					'unique'  => 0 === (int) ( $row['NON_UNIQUE'] ?? 1 ),
					'columns' => array(),
				);
			}
			$actual[ $name ]['columns'][] = (string) ( $row['COLUMN_NAME'] ?? '' );
			if ( null !== ( $row['SUB_PART'] ?? null ) || 'BTREE' !== strtoupper( (string) ( $row['INDEX_TYPE'] ?? '' ) ) ) {
				$errors[] = $table_name . ':' . $name . ':index_shape';
			}
		}

		ksort( $expected, SORT_STRING );
		ksort( $actual, SORT_STRING );
		if ( $expected !== $actual ) {
			$errors[] = $table_name . ':index_set';
		}
		return array_values( array_unique( $errors ) );
	}

	/** @return array */
	private function compare_foreign_keys( $table_name, $expected, $table_names ) {
		$sql = 'SELECT k.CONSTRAINT_NAME, k.ORDINAL_POSITION, k.COLUMN_NAME, k.REFERENCED_TABLE_NAME,';
		$sql .= ' k.REFERENCED_COLUMN_NAME, r.UPDATE_RULE, r.DELETE_RULE';
		$sql .= ' FROM information_schema.KEY_COLUMN_USAGE k';
		$sql .= ' INNER JOIN information_schema.REFERENTIAL_CONSTRAINTS r';
		$sql .= ' ON r.CONSTRAINT_SCHEMA = k.CONSTRAINT_SCHEMA AND r.CONSTRAINT_NAME = k.CONSTRAINT_NAME';
		$sql .= ' WHERE k.CONSTRAINT_SCHEMA = %s AND k.TABLE_NAME = %s AND k.REFERENCED_TABLE_NAME IS NOT NULL';
		$sql .= ' ORDER BY k.CONSTRAINT_NAME, k.ORDINAL_POSITION';
		$rows = $this->rows( $this->database->prepare( $sql, $this->schema_name, $table_name ) );

		$actual = array();
		foreach ( $rows as $row ) {
			$name = (string) ( $row['CONSTRAINT_NAME'] ?? '' );
			if ( ! isset( $actual[ $name ] ) ) {
				$referenced_name = (string) ( $row['REFERENCED_TABLE_NAME'] ?? '' );
				$referenced_key  = array_search( $referenced_name, $table_names, true );
				$actual[ $name ] = array(
					'columns'            => array(),
					'referenced_table'   => false === $referenced_key ? $referenced_name : $referenced_key,
					'referenced_columns' => array(),
					'update_rule'        => strtoupper( (string) ( $row['UPDATE_RULE'] ?? '' ) ),
					'delete_rule'        => strtoupper( (string) ( $row['DELETE_RULE'] ?? '' ) ),
				);
			}
			$actual[ $name ]['columns'][]            = (string) ( $row['COLUMN_NAME'] ?? '' );
			$actual[ $name ]['referenced_columns'][] = (string) ( $row['REFERENCED_COLUMN_NAME'] ?? '' );
		}

		ksort( $expected, SORT_STRING );
		ksort( $actual, SORT_STRING );
		return $expected === $actual ? array() : array( $table_name . ':foreign_key_set' );
	}

	/** @return array */
	private function compare_checks( $table_name, $expected_names ) {
		$sql = 'SELECT tc.CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS tc';
		$sql .= ' INNER JOIN information_schema.CHECK_CONSTRAINTS cc';
		$sql .= ' ON cc.CONSTRAINT_SCHEMA = tc.CONSTRAINT_SCHEMA AND cc.CONSTRAINT_NAME = tc.CONSTRAINT_NAME';
		$sql .= " WHERE tc.CONSTRAINT_SCHEMA = %s AND tc.TABLE_NAME = %s AND tc.CONSTRAINT_TYPE = 'CHECK'";
		$sql .= ' ORDER BY tc.CONSTRAINT_NAME';
		$rows   = $this->rows( $this->database->prepare( $sql, $this->schema_name, $table_name ) );
		$actual = array();
		foreach ( $rows as $row ) {
			$actual[] = (string) ( $row['CONSTRAINT_NAME'] ?? '' );
		}
		sort( $expected_names, SORT_STRING );
		return $expected_names === $actual ? array() : array( $table_name . ':check_set' );
	}

	/** @return array */
	private function rows( $sql ) {
		$format = defined( 'ARRAY_A' ) ? ARRAY_A : 'ARRAY_A';
		$rows   = $this->database->get_results( $sql, $format );
		if ( ! is_array( $rows ) ) {
			throw new RuntimeException( 'V1 information_schema query failed.' );
		}
		return $rows;
	}

	/** @return string|null */
	private function normalize_default( $value ) {
		if ( null === $value ) {
			return null;
		}
		$value = (string) $value;
		// MariaDB exposes an implicit SQL NULL default as unquoted text NULL.
		// A literal string default remains quoted in information_schema and must
		// not be normalized away as compatible drift.
		if ( $this->is_mariadb && 'NULL' === $value ) {
			return null;
		}
		return $value;
	}

	/** @return string|null */
	private function normalize_nullable_string( $value ) {
		return null === $value || '' === $value ? null : (string) $value;
	}

	/** @return array */
	private function result( $state, $ok, $errors, $tables ) {
		return array(
			'state'  => $state,
			'ok'     => (bool) $ok,
			'errors' => array_values( array_unique( $errors ) ),
			'tables' => array_values( $tables ),
		);
	}
}
