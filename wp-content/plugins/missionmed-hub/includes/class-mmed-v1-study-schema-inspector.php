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
class MMED_V1_Study_Schema_Inspector {

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

	/** @var int */
	private $connection_id;

	/** @param object $database WordPress database connection. */
	public function __construct( $database ) {
		if ( ! is_object( $database ) || ! method_exists( $database, 'get_results' ) || ! method_exists( $database, 'prepare' ) ) {
			throw new InvalidArgumentException( 'V1 schema inspector requires a database connection.' );
		}
		$this->database      = $database;
		$this->connection_id = $this->read_connection_id();
		$this->schema_name   = $this->read_schema_name();
		$this->is_mariadb    = $this->read_is_mariadb();
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

	/** Read-only subclass seam for additive schema inspectors. @return object */
	protected function database_connection() {
		return $this->database;
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
		$name = $this->scalar( 'SELECT DATABASE()' );
		if ( ! is_string( $name ) || '' === $name ) {
			throw new RuntimeException( 'V1 database schema identity is unavailable.' );
		}
		return $name;
	}

	/** @return bool */
	private function read_is_mariadb() {
		$version = $this->scalar( 'SELECT VERSION()' );
		if ( ! is_string( $version ) || '' === $version ) {
			throw new RuntimeException( 'V1 database server identity is unavailable.' );
		}
		return false !== stripos( $version, 'mariadb' );
	}

	/** @return array */
	protected function read_tables( $table_names ) {
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
	protected function compare_table( $table_name, $actual, $expected, $table_names ) {
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
		$errors = array_merge( $errors, $this->compare_triggers( $table_name ) );
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
		$sql = 'SELECT k.CONSTRAINT_NAME, k.ORDINAL_POSITION, k.COLUMN_NAME, k.REFERENCED_TABLE_SCHEMA, k.REFERENCED_TABLE_NAME,';
		$sql .= ' k.REFERENCED_COLUMN_NAME, r.UNIQUE_CONSTRAINT_SCHEMA, r.UPDATE_RULE, r.DELETE_RULE, r.MATCH_OPTION';
		$sql .= ' FROM information_schema.KEY_COLUMN_USAGE k';
		$sql .= ' INNER JOIN information_schema.REFERENTIAL_CONSTRAINTS r';
		$sql .= ' ON r.CONSTRAINT_SCHEMA = k.CONSTRAINT_SCHEMA AND r.TABLE_NAME = k.TABLE_NAME AND r.CONSTRAINT_NAME = k.CONSTRAINT_NAME';
		$sql .= ' WHERE k.CONSTRAINT_SCHEMA = %s AND k.TABLE_NAME = %s AND k.REFERENCED_TABLE_NAME IS NOT NULL';
		$sql .= ' ORDER BY k.CONSTRAINT_NAME, k.ORDINAL_POSITION';
		$rows = $this->rows( $this->database->prepare( $sql, $this->schema_name, $table_name ) );

		$actual = array();
		$errors = array();
		foreach ( $rows as $row ) {
			$name = (string) ( $row['CONSTRAINT_NAME'] ?? '' );
			if (
				$this->schema_name !== (string) ( $row['REFERENCED_TABLE_SCHEMA'] ?? '' )
				|| $this->schema_name !== (string) ( $row['UNIQUE_CONSTRAINT_SCHEMA'] ?? '' )
			) {
				$errors[] = $table_name . ':' . $name . ':foreign_key_schema';
			}
			if ( ! isset( $actual[ $name ] ) ) {
				$referenced_name = (string) ( $row['REFERENCED_TABLE_NAME'] ?? '' );
				$referenced_key  = array_search( $referenced_name, $table_names, true );
				$actual[ $name ] = array(
					'columns'            => array(),
					'referenced_table'   => false === $referenced_key ? $referenced_name : $referenced_key,
					'referenced_columns' => array(),
					'update_rule'        => strtoupper( (string) ( $row['UPDATE_RULE'] ?? '' ) ),
					'delete_rule'        => strtoupper( (string) ( $row['DELETE_RULE'] ?? '' ) ),
					'match_option'       => strtoupper( (string) ( $row['MATCH_OPTION'] ?? '' ) ),
				);
			}
			$actual[ $name ]['columns'][]            = (string) ( $row['COLUMN_NAME'] ?? '' );
			$actual[ $name ]['referenced_columns'][] = (string) ( $row['REFERENCED_COLUMN_NAME'] ?? '' );
		}

		ksort( $expected, SORT_STRING );
		ksort( $actual, SORT_STRING );
		if ( $expected !== $actual ) {
			$errors[] = $table_name . ':foreign_key_set';
		}
		return array_values( array_unique( $errors ) );
	}

	/** @return array */
	private function compare_checks( $table_name, $expected ) {
		$enforced = $this->is_mariadb ? "'YES' AS ENFORCED" : 'tc.ENFORCED';
		$sql = 'SELECT tc.CONSTRAINT_NAME, cc.CHECK_CLAUSE, ' . $enforced . ' FROM information_schema.TABLE_CONSTRAINTS tc';
		$sql .= ' INNER JOIN information_schema.CHECK_CONSTRAINTS cc';
		$sql .= ' ON cc.CONSTRAINT_SCHEMA = tc.CONSTRAINT_SCHEMA AND cc.CONSTRAINT_NAME = tc.CONSTRAINT_NAME';
		$sql .= " WHERE tc.CONSTRAINT_SCHEMA = %s AND tc.TABLE_NAME = %s AND tc.CONSTRAINT_TYPE = 'CHECK'";
		$sql .= ' ORDER BY tc.CONSTRAINT_NAME';
		$rows   = $this->rows( $this->database->prepare( $sql, $this->schema_name, $table_name ) );
		$actual = array();
		foreach ( $rows as $row ) {
			$name = (string) ( $row['CONSTRAINT_NAME'] ?? '' );
			$actual[ $name ] = array(
				'clause'   => $this->canonical_check_clause( (string) ( $row['CHECK_CLAUSE'] ?? '' ) ),
				'enforced' => strtoupper( (string) ( $row['ENFORCED'] ?? '' ) ),
			);
		}
		$canonical_expected = array();
		foreach ( $expected as $name => $clause ) {
			$canonical_expected[ $name ] = array(
				'clause'   => $this->canonical_check_clause( $clause ),
				'enforced' => 'YES',
			);
		}
		ksort( $canonical_expected, SORT_STRING );
		ksort( $actual, SORT_STRING );
		if ( $canonical_expected === $actual ) {
			return array();
		}
		$expected_json = json_encode( $canonical_expected, JSON_UNESCAPED_SLASHES );
		$actual_json   = json_encode( $actual, JSON_UNESCAPED_SLASHES );
		if ( ! is_string( $expected_json ) || ! is_string( $actual_json ) ) {
			throw new RuntimeException( 'V1 CHECK diagnostic encoding failed.' );
		}
		return array(
			$table_name . ':check_set',
			$table_name . ':check_expected_b64:' . base64_encode( $expected_json ),
			$table_name . ':check_actual_b64:' . base64_encode( $actual_json ),
		);
	}

	/** Owned kernel tables must not have unowned trigger side effects. @return array */
	private function compare_triggers( $table_name ) {
		$this->assert_trigger_visibility( $table_name );
		$sql = 'SELECT TRIGGER_NAME FROM information_schema.TRIGGERS';
		$sql .= ' WHERE TRIGGER_SCHEMA = %s AND EVENT_OBJECT_SCHEMA = %s AND EVENT_OBJECT_TABLE = %s';
		$sql .= ' ORDER BY TRIGGER_NAME';
		$rows = $this->rows( $this->database->prepare( $sql, $this->schema_name, $this->schema_name, $table_name ) );
		return empty( $rows ) ? array() : array( $table_name . ':trigger_set' );
	}

	/** MySQL hides triggers unless the current account has an effective direct grant. @return void */
	private function assert_trigger_visibility( $table_name ) {
		if ( $this->is_mariadb ) {
			return;
		}
		$grantee = "CONCAT(QUOTE(LEFT(CURRENT_USER(), CHAR_LENGTH(CURRENT_USER()) - CHAR_LENGTH(SUBSTRING_INDEX(CURRENT_USER(), '@', -1)) - 1)), '@', QUOTE(SUBSTRING_INDEX(CURRENT_USER(), '@', -1)))";
		$sql  = 'SELECT COUNT(*) FROM (';
		$sql .= ' SELECT 1 FROM information_schema.SCHEMA_PRIVILEGES WHERE GRANTEE = ' . $grantee . " AND PRIVILEGE_TYPE = 'TRIGGER' AND TABLE_SCHEMA = %s";
		$sql .= ' UNION ALL SELECT 1 FROM information_schema.TABLE_PRIVILEGES WHERE GRANTEE = ' . $grantee . " AND PRIVILEGE_TYPE = 'TRIGGER' AND TABLE_SCHEMA = %s AND TABLE_NAME = %s";
		$sql .= ') AS explicit_trigger_grants';
		$explicit = $this->scalar( $this->database->prepare( $sql, $this->schema_name, $this->schema_name, $table_name ) );
		if ( null !== $explicit && (int) $explicit > 0 ) {
			return;
		}

		$sql = 'SELECT COUNT(*) FROM information_schema.USER_PRIVILEGES WHERE GRANTEE = ' . $grantee . " AND PRIVILEGE_TYPE = 'TRIGGER'";
		$global_grant   = $this->scalar( $sql );
		$partial_revoke = $this->scalar( 'SELECT @@GLOBAL.partial_revokes' );
		if ( null !== $global_grant && (int) $global_grant > 0 && 0 === (int) $partial_revoke ) {
			return;
		}
		throw new RuntimeException( 'V1 trigger metadata visibility is unavailable.' );
	}

	/** Convert the limited kernel CHECK grammar into a precedence-explicit AST. @return string */
	private function canonical_check_clause( $clause ) {
		$source = strtolower( str_replace( '`', '', trim( (string) $clause ) ) );
		if ( '' === $source ) {
			throw new RuntimeException( 'V1 CHECK clause is unavailable.' );
		}
		preg_match_all(
			'/>=|<=|<>|!=|=|>|<|\+|-|%|\(|\)|,|[a-z_][a-z0-9_]*|[0-9]+/',
			$source,
			$matches,
			PREG_OFFSET_CAPTURE
		);
		$pairs  = isset( $matches[0] ) ? $matches[0] : array();
		$tokens = array();
		$cursor = 0;
		foreach ( $pairs as $pair ) {
			$token  = (string) $pair[0];
			$offset = (int) $pair[1];
			if ( '' !== trim( substr( $source, $cursor, $offset - $cursor ) ) ) {
				throw new RuntimeException( 'V1 CHECK clause grammar is unsupported.' );
			}
			$tokens[] = $token;
			$cursor   = $offset + strlen( $token );
		}
		if ( empty( $tokens ) || '' !== trim( substr( $source, $cursor ) ) ) {
			throw new RuntimeException( 'V1 CHECK clause grammar is unsupported.' );
		}
		$index = 0;
		$tree  = $this->parse_check_or( $tokens, $index );
		if ( $index !== count( $tokens ) ) {
			throw new RuntimeException( 'V1 CHECK clause parse is incomplete.' );
		}
		return $this->serialize_check_tree( $tree );
	}

	/** @return array */
	private function parse_check_or( $tokens, &$index ) {
		$nodes = array( $this->parse_check_and( $tokens, $index ) );
		while ( isset( $tokens[ $index ] ) && 'or' === $tokens[ $index ] ) {
			++$index;
			$nodes[] = $this->parse_check_and( $tokens, $index );
		}
		return 1 === count( $nodes ) ? $nodes[0] : array( 'or', $nodes );
	}

	/** @return array */
	private function parse_check_and( $tokens, &$index ) {
		$nodes = array( $this->parse_check_factor( $tokens, $index ) );
		while ( isset( $tokens[ $index ] ) && 'and' === $tokens[ $index ] ) {
			++$index;
			$nodes[] = $this->parse_check_factor( $tokens, $index );
		}
		return 1 === count( $nodes ) ? $nodes[0] : array( 'and', $nodes );
	}

	/** @return array */
	private function parse_check_factor( $tokens, &$index ) {
		if ( isset( $tokens[ $index ] ) && '(' === $tokens[ $index ] ) {
			$predicate_start = $index;
			try {
				return $this->parse_check_predicate( $tokens, $index );
			} catch ( RuntimeException $error ) {
				$index = $predicate_start;
			}
			++$index;
			$node = $this->parse_check_or( $tokens, $index );
			if ( ! isset( $tokens[ $index ] ) || ')' !== $tokens[ $index ] ) {
				throw new RuntimeException( 'V1 CHECK clause parenthesis is unbalanced.' );
			}
			++$index;
			return $node;
		}
		return $this->parse_check_predicate( $tokens, $index );
	}

	/** Parse the exact predicate forms used by the owned constraints. @return array */
	private function parse_check_predicate( $tokens, &$index ) {
		$left = $this->parse_check_additive( $tokens, $index );
		if ( ! isset( $tokens[ $index ] ) ) {
			throw new RuntimeException( 'V1 CHECK clause predicate is incomplete.' );
		}

		$operator = $tokens[ $index ];
		if ( 'is' === $operator ) {
			++$index;
			$negated = isset( $tokens[ $index ] ) && 'not' === $tokens[ $index ];
			if ( $negated ) {
				++$index;
			}
			if ( ! isset( $tokens[ $index ] ) || 'null' !== $tokens[ $index ] ) {
				throw new RuntimeException( 'V1 CHECK clause NULL predicate is invalid.' );
			}
			++$index;
			return array( $negated ? 'is_not_null' : 'is_null', $left );
		}

		if ( 'between' === $operator ) {
			++$index;
			$minimum = $this->parse_check_additive( $tokens, $index );
			if ( ! isset( $tokens[ $index ] ) || 'and' !== $tokens[ $index ] ) {
				throw new RuntimeException( 'V1 CHECK clause BETWEEN predicate is invalid.' );
			}
			++$index;
			$maximum = $this->parse_check_additive( $tokens, $index );
			return array( 'between', $left, $minimum, $maximum );
		}

		if ( ! in_array( $operator, array( '>=', '<=', '<>', '!=', '=', '>', '<' ), true ) ) {
			throw new RuntimeException( 'V1 CHECK clause comparison is unsupported.' );
		}
		++$index;
		return array( 'compare', $operator, $left, $this->parse_check_additive( $tokens, $index ) );
	}

	/** @return array */
	private function parse_check_additive( $tokens, &$index ) {
		$node = $this->parse_check_multiplicative( $tokens, $index );
		while ( isset( $tokens[ $index ] ) && in_array( $tokens[ $index ], array( '+', '-' ), true ) ) {
			$operator = $tokens[ $index ];
			++$index;
			if ( '+' === $operator && isset( $tokens[ $index ] ) && 'interval' === $tokens[ $index ] ) {
				++$index;
				$amount = $this->parse_check_primary( $tokens, $index );
				if ( ! isset( $tokens[ $index ] ) || 'minute' !== $tokens[ $index ] ) {
					throw new RuntimeException( 'V1 CHECK clause interval unit is unsupported.' );
				}
				++$index;
				$node = array( 'timestampadd_minute', $amount, $node );
				continue;
			}
			$node = array( '+' === $operator ? 'add' : 'subtract', $node, $this->parse_check_multiplicative( $tokens, $index ) );
		}
		return $node;
	}

	/** MySQL and MariaDB serialize MOD() as `%` and infix MOD respectively. @return array */
	private function parse_check_multiplicative( $tokens, &$index ) {
		$node = $this->parse_check_primary( $tokens, $index );
		while ( isset( $tokens[ $index ] ) && in_array( $tokens[ $index ], array( '%', 'mod' ), true ) ) {
			++$index;
			$node = array( 'mod', $node, $this->parse_check_primary( $tokens, $index ) );
		}
		return $node;
	}

	/** @return array */
	private function parse_check_primary( $tokens, &$index ) {
		if ( ! isset( $tokens[ $index ] ) ) {
			throw new RuntimeException( 'V1 CHECK clause value is incomplete.' );
		}
		$token = $tokens[ $index ];
		if ( '(' === $token ) {
			++$index;
			$node = $this->parse_check_additive( $tokens, $index );
			if ( ! isset( $tokens[ $index ] ) || ')' !== $tokens[ $index ] ) {
				throw new RuntimeException( 'V1 CHECK clause value parenthesis is unbalanced.' );
			}
			++$index;
			return $node;
		}
		if ( 1 === preg_match( '/^[0-9]+$/', $token ) ) {
			++$index;
			$number = ltrim( $token, '0' );
			return array( 'number', '' === $number ? '0' : $number );
		}
		if ( 1 !== preg_match( '/^[a-z_][a-z0-9_]*$/', $token ) ) {
			throw new RuntimeException( 'V1 CHECK clause value is unsupported.' );
		}
		++$index;
		if ( ! isset( $tokens[ $index ] ) || '(' !== $tokens[ $index ] ) {
			return array( 'identifier', $token );
		}
		// MySQL serializes OCTET_LENGTH() in CHECK metadata using its exact
		// byte-length synonym LENGTH(). Canonicalize only this documented alias.
		if ( 'length' === $token ) {
			$token = 'octet_length';
		}

		++$index;
		$arguments = array();
		if ( isset( $tokens[ $index ] ) && ')' !== $tokens[ $index ] ) {
			while ( true ) {
				$arguments[] = $this->parse_check_additive( $tokens, $index );
				if ( ! isset( $tokens[ $index ] ) || ',' !== $tokens[ $index ] ) {
					break;
				}
				++$index;
			}
		}
		if ( ! isset( $tokens[ $index ] ) || ')' !== $tokens[ $index ] ) {
			throw new RuntimeException( 'V1 CHECK clause function call is invalid.' );
		}
		++$index;
		if ( 'mod' === $token ) {
			if ( 2 !== count( $arguments ) ) {
				throw new RuntimeException( 'V1 CHECK clause MOD arity is invalid.' );
			}
			return array( 'mod', $arguments[0], $arguments[1] );
		}
		if ( 'timestampadd' === $token ) {
			if (
				3 !== count( $arguments )
				|| ! isset( $arguments[0][0], $arguments[0][1] )
				|| 'identifier' !== $arguments[0][0]
				|| 'minute' !== $arguments[0][1]
			) {
				throw new RuntimeException( 'V1 CHECK clause TIMESTAMPADD unit or arity is invalid.' );
			}
			return array( 'timestampadd_minute', $arguments[1], $arguments[2] );
		}
		return array( 'call', $token, $arguments );
	}

	/** @return string */
	private function serialize_check_tree( $tree ) {
		$type = $tree[0];
		if ( 'identifier' === $type || 'number' === $type ) {
			return $type . '(' . $tree[1] . ')';
		}
		if ( 'call' === $type ) {
			$arguments = array();
			foreach ( $tree[2] as $argument ) {
				$arguments[] = $this->serialize_check_tree( $argument );
			}
			return 'call(' . $tree[1] . ',' . implode( ',', $arguments ) . ')';
		}
		if ( 'compare' === $type ) {
			return 'compare(' . $tree[1] . ',' . $this->serialize_check_tree( $tree[2] ) . ',' . $this->serialize_check_tree( $tree[3] ) . ')';
		}
		if ( 'mod' === $type ) {
			return 'mod(' . $this->serialize_check_tree( $tree[1] ) . ',' . $this->serialize_check_tree( $tree[2] ) . ')';
		}
		if ( 'timestampadd_minute' === $type ) {
			return 'timestampadd_minute(' . $this->serialize_check_tree( $tree[1] ) . ',' . $this->serialize_check_tree( $tree[2] ) . ')';
		}
		if ( in_array( $type, array( 'is_null', 'is_not_null' ), true ) ) {
			return $type . '(' . $this->serialize_check_tree( $tree[1] ) . ')';
		}
		if ( 'between' === $type ) {
			return 'between(' . $this->serialize_check_tree( $tree[1] ) . ',' . $this->serialize_check_tree( $tree[2] ) . ',' . $this->serialize_check_tree( $tree[3] ) . ')';
		}
		if ( in_array( $type, array( 'add', 'subtract' ), true ) ) {
			return $type . '(' . $this->serialize_check_tree( $tree[1] ) . ',' . $this->serialize_check_tree( $tree[2] ) . ')';
		}
		$children = array();
		foreach ( $tree[1] as $child ) {
			$children[] = $this->serialize_check_tree( $child );
		}
		if ( ! in_array( $type, array( 'and', 'or' ), true ) ) {
			throw new RuntimeException( 'V1 CHECK clause tree is invalid.' );
		}
		return $type . '(' . implode( ',', $children ) . ')';
	}

	/** @return array */
	private function rows( $sql ) {
		$this->assert_connection();
		$format = defined( 'ARRAY_A' ) ? ARRAY_A : 'ARRAY_A';
		$rows   = $this->database->get_results( $sql, $format );
		$this->assert_database_query_succeeded();
		$this->assert_connection();
		if ( ! is_array( $rows ) ) {
			throw new RuntimeException( 'V1 information_schema query failed.' );
		}
		return $rows;
	}

	/** @return mixed */
	private function scalar( $sql ) {
		$this->assert_connection();
		$value = $this->database->get_var( $sql );
		$this->assert_database_query_succeeded();
		$this->assert_connection();
		return $value;
	}

	/** @return int */
	private function read_connection_id() {
		$id = $this->database->get_var( 'SELECT CONNECTION_ID()' );
		$this->assert_database_query_succeeded();
		if ( null === $id || (int) $id <= 0 ) {
			throw new RuntimeException( 'V1 information_schema connection is unavailable.' );
		}
		return (int) $id;
	}

	/** @return void */
	private function assert_connection() {
		if ( $this->connection_id !== $this->read_connection_id() ) {
			throw new RuntimeException( 'V1 information_schema connection changed.' );
		}
	}

	/** @return void */
	private function assert_database_query_succeeded() {
		if ( ! property_exists( $this->database, 'last_error' ) || '' !== (string) $this->database->last_error ) {
			throw new RuntimeException( 'V1 information_schema query failed.' );
		}
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
	protected function result( $state, $ok, $errors, $tables ) {
		return array(
			'state'  => $state,
			'ok'     => (bool) $ok,
			'errors' => array_values( array_unique( $errors ) ),
			'tables' => array_values( $tables ),
		);
	}
}
