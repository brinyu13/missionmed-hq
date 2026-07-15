<?php
/**
 * Immutable Plan-owned InnoDB capability-kernel schema for 8010D.
 *
 * This is an isolated persistence proof. Domain relations for Week objects,
 * temporal obligations, import lineage, evidence, Focus, proposals, settings,
 * and Reviews are additive gates in later slices; this file exposes no route or
 * automatic installer.
 *
 * @package MissionMed_Hub
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/** Pure table, migration, reader, and postcondition descriptors. */
final class MMED_V1_Study_Schema {

	const SCHEMA_VERSION          = '1';
	const CURRENT_READER_VERSION  = '1';
	const PREVIOUS_READER_VERSION = null;
	const GENERATION              = 1;
	const TABLE_COLLATION         = 'utf8mb4_bin';
	const TABLE_CHARSET           = 'utf8mb4';
	const TABLE_NAMESPACE_VERSION = 'v1-study-kernel-tables-v1';
	const CONSTRAINT_NAMESPACE_VERSION = 'sha256-prefix-12-v1';

	/** Prefix-independent physical table ownership suffixes. @return array */
	public static function logical_table_suffixes() {
		return array(
			'migrations'  => 'mmed_v1_study_migrations',
			'store_gate'  => 'mmed_v1_study_store_gate',
			'generations' => 'mmed_v1_study_store_generations',
			'plans'       => 'mmed_v1_study_plans',
			'operations'  => 'mmed_v1_study_operations',
		);
	}

	/** Prefix-independent constraint symbol suffixes. @return array */
	public static function logical_constraint_suffixes() {
		return array(
			'gate_singleton'       => 'gate_singleton_ck',
			'plan_shape'            => 'plan_shape_ck',
			'operation_revision'    => 'operation_revision_ck',
			'idempotency_length'    => 'idempotency_length_ck',
			'gate_generation'       => 'gate_generation_fk',
			'plan_generation'       => 'plan_generation_fk',
			'operation_plan'        => 'operation_plan_fk',
			'operation_generation'  => 'operation_generation_fk',
		);
	}

	/** @return array */
	public static function table_names( $database ) {
		$prefix = isset( $database->prefix ) ? (string) $database->prefix : '';
		if ( '' === $prefix || 1 !== preg_match( '/^[A-Za-z0-9_]+$/', $prefix ) ) {
			throw new RuntimeException( 'V1 database prefix is invalid.' );
		}

		$names = array();
		foreach ( self::logical_table_suffixes() as $key => $suffix ) {
			$names[ $key ] = $prefix . $suffix;
		}
		foreach ( $names as $name ) {
			if ( strlen( $name ) > 64 ) {
				throw new RuntimeException( 'V1 rendered table identifier is too long.' );
			}
		}
		return $names;
	}

	/** Database-unique, prefix-scoped constraint symbols. @return array */
	public static function constraint_names( $database ) {
		self::table_names( $database );
		$prefix = (string) $database->prefix;
		$scope  = substr( hash( 'sha256', $prefix ), 0, 12 );
		$names = array();
		foreach ( self::logical_constraint_suffixes() as $key => $suffix ) {
			$names[ $key ] = 'mmed_v1_' . $scope . '_' . $suffix;
			if ( strlen( $names[ $key ] ) > 64 ) {
				throw new RuntimeException( 'V1 rendered constraint identifier is too long.' );
			}
		}
		return $names;
	}

	/**
	 * Ordered, additive DDL descriptors. The explicit runner is the only caller;
	 * plugin initialization, activation, REST, and normal requests never run DDL.
	 *
	 * @return array
	 */
	public static function migrations( $database ) {
		$tables       = self::table_names( $database );
		$descriptors  = self::ddl_templates();
		$constraints  = self::constraint_names( $database );
		$replacements = array();
		foreach ( $tables as $key => $table ) {
			$replacements[ '{{' . $key . '}}' ] = $table;
		}
		foreach ( $constraints as $key => $constraint ) {
			$replacements[ '{{' . $key . '}}' ] = $constraint;
		}

		$result = array();
		$binding = self::checksum_binding_json();
		foreach ( $descriptors as $descriptor ) {
			$id        = $descriptor['id'];
			$template  = $descriptor['template'];
			$canonical = self::canonical_sql( $template );
			$result[]  = array(
				'version'      => $descriptor['version'],
				'id'           => $id,
				'table_key'    => $descriptor['table_key'],
				'sql'          => self::canonical_sql( strtr( $template, $replacements ) ),
				'checksum_hex' => hash( 'sha256', $id . "\n" . $binding . "\n" . $canonical ),
			);
		}

		return $result;
	}

	/** @return string */
	private static function checksum_binding_json() {
		$binding = array(
			'table_namespace_version'      => self::TABLE_NAMESPACE_VERSION,
			'tables'                       => self::logical_table_suffixes(),
			'constraint_namespace_version' => self::CONSTRAINT_NAMESPACE_VERSION,
			'constraints'                  => self::logical_constraint_suffixes(),
		);
		$json = json_encode( $binding, JSON_UNESCAPED_SLASHES );
		if ( ! is_string( $json ) ) {
			throw new RuntimeException( 'V1 schema checksum binding encoding failed.' );
		}
		return $json;
	}

	/** @return array */
	private static function ddl_templates() {
		$tail = 'ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin';
		return array(
			array(
				'version'   => 1,
				'id'        => '8010D-001-migrations',
				'table_key' => 'migrations',
				'template'  => "CREATE TABLE `{{migrations}}` (
				migration_version int unsigned NOT NULL,
				migration_id varbinary(64) NOT NULL,
				checksum binary(32) NOT NULL,
				state varbinary(16) NOT NULL,
				checkpoint varbinary(64) NOT NULL,
				attempt_count int unsigned NOT NULL,
				runner_id binary(16) NOT NULL,
				failure_code varbinary(64) NULL,
				started_at datetime(6) NOT NULL,
				applied_at datetime(6) NULL,
				updated_at datetime(6) NOT NULL,
				PRIMARY KEY (migration_version),
				UNIQUE KEY uq_migration_id (migration_id),
				KEY idx_state (state)
			) {$tail}",
			),
			array(
				'version'   => 2,
				'id'        => '8010D-002-generations',
				'table_key' => 'generations',
				'template'  => "CREATE TABLE `{{generations}}` (
				generation bigint unsigned NOT NULL,
				store_id binary(16) NOT NULL,
				writer_schema_version varbinary(64) NOT NULL,
				current_reader_version varbinary(64) NOT NULL,
				previous_reader_version varbinary(64) NULL,
				manifest_hash binary(32) NOT NULL,
				activated_at datetime(6) NOT NULL,
				PRIMARY KEY (generation),
				UNIQUE KEY uq_store_generation (store_id, generation)
			) {$tail}",
			),
			array(
				'version'   => 3,
				'id'        => '8010D-003-store-gate',
				'table_key' => 'store_gate',
				'template'  => "CREATE TABLE `{{store_gate}}` (
				gate_key tinyint unsigned NOT NULL,
				store_id binary(16) NOT NULL,
				current_generation bigint unsigned NOT NULL,
				gate_state varbinary(16) NOT NULL,
				commissioned_at datetime(6) NULL,
				updated_at datetime(6) NOT NULL,
				PRIMARY KEY (gate_key),
				KEY idx_store_generation (store_id, current_generation),
				CONSTRAINT `{{gate_singleton}}` CHECK (gate_key = 1),
				CONSTRAINT `{{gate_generation}}` FOREIGN KEY (store_id, current_generation) REFERENCES `{{generations}}` (store_id, generation) ON UPDATE RESTRICT ON DELETE RESTRICT
			) {$tail}",
			),
			array(
				'version'   => 4,
				'id'        => '8010D-004-plans',
				'table_key' => 'plans',
				'template'  => "CREATE TABLE `{{plans}}` (
				owner_id bigint unsigned NOT NULL,
				plan_id binary(16) NULL,
				store_generation bigint unsigned NOT NULL,
				schema_version varbinary(64) NULL,
				current_revision bigint unsigned NOT NULL DEFAULT 0,
				watermark_operation_id binary(16) NULL,
				watermark_at datetime(6) NULL,
				plan_json longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NULL,
				plan_hash binary(32) NULL,
				created_at datetime(6) NOT NULL,
				updated_at datetime(6) NOT NULL,
				PRIMARY KEY (owner_id),
				UNIQUE KEY uq_plan_id (plan_id),
				UNIQUE KEY uq_owner_plan (owner_id, plan_id),
				KEY idx_store_generation (store_generation),
				KEY idx_watermark (watermark_at),
				CONSTRAINT `{{plan_generation}}` FOREIGN KEY (store_generation) REFERENCES `{{generations}}` (generation) ON UPDATE RESTRICT ON DELETE RESTRICT,
				CONSTRAINT `{{plan_shape}}` CHECK (
					(current_revision = 0 AND plan_id IS NULL AND schema_version IS NULL AND watermark_operation_id IS NULL AND watermark_at IS NULL AND plan_json IS NULL AND plan_hash IS NULL)
					OR
					(current_revision > 0 AND plan_id IS NOT NULL AND schema_version IS NOT NULL AND watermark_operation_id IS NOT NULL AND watermark_at IS NOT NULL AND plan_json IS NOT NULL AND plan_hash IS NOT NULL)
				)
			) {$tail}",
			),
			array(
				'version'   => 5,
				'id'        => '8010D-005-operations',
				'table_key' => 'operations',
				'template'  => "CREATE TABLE `{{operations}}` (
				operation_id binary(16) NOT NULL,
				owner_id bigint unsigned NOT NULL,
				plan_id binary(16) NOT NULL,
				revision bigint unsigned NOT NULL,
				expected_revision bigint unsigned NOT NULL,
				idempotency_key varbinary(64) NOT NULL,
				request_json longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
				request_hash binary(32) NOT NULL,
				actor_id bigint unsigned NOT NULL,
				actor_kind varbinary(24) NOT NULL,
				action varbinary(64) NOT NULL,
				store_generation bigint unsigned NOT NULL,
				schema_version varbinary(64) NOT NULL,
				plan_hash binary(32) NOT NULL,
				result_status smallint unsigned NOT NULL,
				result_json longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
				result_hash binary(32) NOT NULL,
				committed_at datetime(6) NOT NULL,
				PRIMARY KEY (operation_id),
				UNIQUE KEY uq_owner_revision (owner_id, revision),
				UNIQUE KEY uq_owner_idempotency (owner_id, idempotency_key),
				KEY idx_owner_plan (owner_id, plan_id),
				KEY idx_store_generation (store_generation),
				KEY idx_owner_committed (owner_id, committed_at),
				CONSTRAINT `{{operation_plan}}` FOREIGN KEY (owner_id, plan_id) REFERENCES `{{plans}}` (owner_id, plan_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
				CONSTRAINT `{{operation_generation}}` FOREIGN KEY (store_generation) REFERENCES `{{generations}}` (generation) ON UPDATE RESTRICT ON DELETE RESTRICT,
				CONSTRAINT `{{operation_revision}}` CHECK (revision = expected_revision + 1),
				CONSTRAINT `{{idempotency_length}}` CHECK (OCTET_LENGTH(idempotency_key) BETWEEN 16 AND 64)
			) {$tail}",
			),
		);
	}

	/** @return string */
	private static function canonical_sql( $sql ) {
		$canonical = preg_replace( '/\s+/', ' ', trim( (string) $sql ) );
		if ( ! is_string( $canonical ) || '' === $canonical ) {
			throw new RuntimeException( 'V1 SQL canonicalization failed.' );
		}
		return $canonical;
	}

	/** @return string */
	public static function manifest_hash_hex( $database ) {
		$rows = array();
		foreach ( self::migrations( $database ) as $migration ) {
			$rows[] = array(
				'version'  => $migration['version'],
				'id'       => $migration['id'],
				'checksum' => $migration['checksum_hex'],
			);
		}
		$manifest = array(
			'contract'        => 'V1-STUDY-SCHEDULE-8010D-KERNEL',
			'table_namespace_version' => self::TABLE_NAMESPACE_VERSION,
			'tables'          => self::logical_table_suffixes(),
			'constraint_namespace_version' => self::CONSTRAINT_NAMESPACE_VERSION,
			'constraints'     => self::logical_constraint_suffixes(),
			'generation'      => self::GENERATION,
			'schema'          => self::SCHEMA_VERSION,
			'current_reader'  => self::CURRENT_READER_VERSION,
			'previous_reader' => self::PREVIOUS_READER_VERSION,
			'table_charset'   => self::TABLE_CHARSET,
			'table_collation' => self::TABLE_COLLATION,
			'migrations'      => $rows,
		);
		$json = json_encode( $manifest, JSON_UNESCAPED_SLASHES );
		if ( ! is_string( $json ) ) {
			throw new RuntimeException( 'V1 schema manifest encoding failed.' );
		}
		return hash( 'sha256', $json );
	}

	/**
	 * Portable information_schema expectations. Display widths are deliberately
	 * excluded because MySQL 8 and MariaDB 10.11 report them differently.
	 *
	 * @return array
	 */
	public static function expected_shapes( $database ) {
		$constraints = self::constraint_names( $database );
		$binary16  = self::column( 'binary', false, null, 16 );
		$binary32  = self::column( 'binary', false, null, 32 );
		$datetime6 = self::column( 'datetime', false, null, null, false, 6 );
		$longtext  = self::column( 'longtext', false, null, 4294967295, false, null, self::TABLE_CHARSET, self::TABLE_COLLATION );

		return array(
			'migrations' => self::table_shape(
				array(
					'migration_version' => self::column( 'int', false, null, null, true ),
					'migration_id'      => self::column( 'varbinary', false, null, 64 ),
					'checksum'          => $binary32,
					'state'             => self::column( 'varbinary', false, null, 16 ),
					'checkpoint'        => self::column( 'varbinary', false, null, 64 ),
					'attempt_count'     => self::column( 'int', false, null, null, true ),
					'runner_id'         => $binary16,
					'failure_code'      => self::column( 'varbinary', true, null, 64 ),
					'started_at'        => $datetime6,
					'applied_at'        => self::column( 'datetime', true, null, null, false, 6 ),
					'updated_at'        => $datetime6,
				),
				array(
					'PRIMARY'         => self::index( true, array( 'migration_version' ) ),
					'uq_migration_id' => self::index( true, array( 'migration_id' ) ),
					'idx_state'       => self::index( false, array( 'state' ) ),
				)
			),
			'store_gate' => self::table_shape(
				array(
					'gate_key'           => self::column( 'tinyint', false, null, null, true ),
					'store_id'           => $binary16,
					'current_generation' => self::column( 'bigint', false, null, null, true ),
					'gate_state'         => self::column( 'varbinary', false, null, 16 ),
					'commissioned_at'    => self::column( 'datetime', true, null, null, false, 6 ),
					'updated_at'         => $datetime6,
				),
				array(
					'PRIMARY'              => self::index( true, array( 'gate_key' ) ),
					'idx_store_generation' => self::index( false, array( 'store_id', 'current_generation' ) ),
				),
				array(
					$constraints['gate_generation'] => array(
						'columns'            => array( 'store_id', 'current_generation' ),
						'referenced_table'   => 'generations',
						'referenced_columns' => array( 'store_id', 'generation' ),
						'update_rule'        => 'RESTRICT',
						'delete_rule'        => 'RESTRICT',
						'match_option'       => 'NONE',
					),
				),
				array( $constraints['gate_singleton'] => 'gate_key = 1' )
			),
			'generations' => self::table_shape(
				array(
					'generation'              => self::column( 'bigint', false, null, null, true ),
					'store_id'                => $binary16,
					'writer_schema_version'   => self::column( 'varbinary', false, null, 64 ),
					'current_reader_version'  => self::column( 'varbinary', false, null, 64 ),
					'previous_reader_version' => self::column( 'varbinary', true, null, 64 ),
					'manifest_hash'            => $binary32,
					'activated_at'             => $datetime6,
				),
				array(
					'PRIMARY'             => self::index( true, array( 'generation' ) ),
					'uq_store_generation' => self::index( true, array( 'store_id', 'generation' ) ),
				)
			),
			'plans' => self::table_shape(
				array(
					'owner_id'               => self::column( 'bigint', false, null, null, true ),
					'plan_id'                => self::column( 'binary', true, null, 16 ),
					'store_generation'       => self::column( 'bigint', false, null, null, true ),
					'schema_version'         => self::column( 'varbinary', true, null, 64 ),
					'current_revision'       => self::column( 'bigint', false, '0', null, true ),
					'watermark_operation_id' => self::column( 'binary', true, null, 16 ),
					'watermark_at'           => self::column( 'datetime', true, null, null, false, 6 ),
					'plan_json'              => self::nullable( $longtext ),
					'plan_hash'              => self::column( 'binary', true, null, 32 ),
					'created_at'             => $datetime6,
					'updated_at'             => $datetime6,
				),
				array(
					'PRIMARY'       => self::index( true, array( 'owner_id' ) ),
					'uq_plan_id'    => self::index( true, array( 'plan_id' ) ),
					'uq_owner_plan' => self::index( true, array( 'owner_id', 'plan_id' ) ),
					'idx_store_generation' => self::index( false, array( 'store_generation' ) ),
					'idx_watermark' => self::index( false, array( 'watermark_at' ) ),
				),
				array(
					$constraints['plan_generation'] => array(
						'columns'            => array( 'store_generation' ),
						'referenced_table'   => 'generations',
						'referenced_columns' => array( 'generation' ),
						'update_rule'        => 'RESTRICT',
						'delete_rule'        => 'RESTRICT',
						'match_option'       => 'NONE',
					),
				),
				array(
					$constraints['plan_shape'] => '(current_revision = 0 AND plan_id IS NULL AND schema_version IS NULL AND watermark_operation_id IS NULL AND watermark_at IS NULL AND plan_json IS NULL AND plan_hash IS NULL) OR (current_revision > 0 AND plan_id IS NOT NULL AND schema_version IS NOT NULL AND watermark_operation_id IS NOT NULL AND watermark_at IS NOT NULL AND plan_json IS NOT NULL AND plan_hash IS NOT NULL)',
				)
			),
			'operations' => self::table_shape(
				array(
					'operation_id'      => $binary16,
					'owner_id'          => self::column( 'bigint', false, null, null, true ),
					'plan_id'           => $binary16,
					'revision'          => self::column( 'bigint', false, null, null, true ),
					'expected_revision' => self::column( 'bigint', false, null, null, true ),
					'idempotency_key'   => self::column( 'varbinary', false, null, 64 ),
					'request_json'      => $longtext,
					'request_hash'      => $binary32,
					'actor_id'          => self::column( 'bigint', false, null, null, true ),
					'actor_kind'        => self::column( 'varbinary', false, null, 24 ),
					'action'            => self::column( 'varbinary', false, null, 64 ),
					'store_generation'  => self::column( 'bigint', false, null, null, true ),
					'schema_version'    => self::column( 'varbinary', false, null, 64 ),
					'plan_hash'         => $binary32,
					'result_status'     => self::column( 'smallint', false, null, null, true ),
					'result_json'       => $longtext,
					'result_hash'       => $binary32,
					'committed_at'      => $datetime6,
				),
				array(
					'PRIMARY'              => self::index( true, array( 'operation_id' ) ),
					'uq_owner_revision'    => self::index( true, array( 'owner_id', 'revision' ) ),
					'uq_owner_idempotency' => self::index( true, array( 'owner_id', 'idempotency_key' ) ),
					'idx_owner_plan'       => self::index( false, array( 'owner_id', 'plan_id' ) ),
					'idx_store_generation' => self::index( false, array( 'store_generation' ) ),
					'idx_owner_committed'  => self::index( false, array( 'owner_id', 'committed_at' ) ),
				),
				array(
					$constraints['operation_plan'] => array(
						'columns'            => array( 'owner_id', 'plan_id' ),
						'referenced_table'   => 'plans',
						'referenced_columns' => array( 'owner_id', 'plan_id' ),
						'update_rule'        => 'RESTRICT',
						'delete_rule'        => 'RESTRICT',
						'match_option'       => 'NONE',
					),
					$constraints['operation_generation'] => array(
						'columns'            => array( 'store_generation' ),
						'referenced_table'   => 'generations',
						'referenced_columns' => array( 'generation' ),
						'update_rule'        => 'RESTRICT',
						'delete_rule'        => 'RESTRICT',
						'match_option'       => 'NONE',
					),
				),
				array(
					$constraints['operation_revision'] => 'revision = expected_revision + 1',
					$constraints['idempotency_length'] => 'OCTET_LENGTH(idempotency_key) BETWEEN 16 AND 64',
				)
			),
		);
	}

	/** @return array */
	private static function table_shape( $columns, $indexes, $foreign_keys = array(), $checks = array() ) {
		return array(
			'engine'       => 'InnoDB',
			'row_format'   => 'Dynamic',
			'collation'    => self::TABLE_COLLATION,
			'columns'      => $columns,
			'indexes'      => $indexes,
			'foreign_keys' => $foreign_keys,
			'checks'       => $checks,
		);
	}

	/** @return array */
	private static function column( $type, $nullable, $default, $length = null, $unsigned = false, $datetime_precision = null, $charset = null, $collation = null ) {
		return array(
			'type'               => $type,
			'nullable'           => (bool) $nullable,
			'default'            => $default,
			'length'             => $length,
			'unsigned'           => (bool) $unsigned,
			'datetime_precision' => $datetime_precision,
			'charset'            => $charset,
			'collation'          => $collation,
			'extra'              => '',
		);
	}

	/** @return array */
	private static function nullable( $column ) {
		$column['nullable'] = true;
		return $column;
	}

	/** @return array */
	private static function index( $unique, $columns ) {
		return array( 'unique' => (bool) $unique, 'columns' => $columns );
	}

	/** @return bool */
	public static function valid_uuid( $value ) {
		return is_string( $value ) && 1 === preg_match( '/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/', $value );
	}

	/** @return string */
	public static function uuid_to_binary( $value ) {
		if ( ! self::valid_uuid( $value ) ) {
			throw new InvalidArgumentException( 'V1 UUID is invalid.' );
		}
		$binary = hex2bin( str_replace( '-', '', $value ) );
		if ( false === $binary || 16 !== strlen( $binary ) ) {
			throw new RuntimeException( 'V1 UUID conversion failed.' );
		}
		return $binary;
	}

	/** @return string */
	public static function binary_to_uuid( $value ) {
		if ( ! is_string( $value ) || 16 !== strlen( $value ) ) {
			throw new InvalidArgumentException( 'V1 binary UUID is invalid.' );
		}
		$hex  = bin2hex( $value );
		$uuid = substr( $hex, 0, 8 ) . '-' . substr( $hex, 8, 4 ) . '-' . substr( $hex, 12, 4 ) . '-' . substr( $hex, 16, 4 ) . '-' . substr( $hex, 20, 12 );
		if ( ! self::valid_uuid( $uuid ) ) {
			throw new RuntimeException( 'V1 stored UUID is invalid.' );
		}
		return $uuid;
	}
}
