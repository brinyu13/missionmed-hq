<?php
/**
 * Additive generation-2 normalized Week persistence descriptors for 8010E.
 *
 * Migrations 1-5 remain owned byte-for-byte by MMED_V1_Study_Schema. This file
 * declares only additive migrations 6-7 and registers no hooks or automatic
 * DDL path.
 *
 * @package MissionMed_Hub
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/** Pure Week table, migration, constraint, and postcondition descriptors. */
final class MMED_V1_Study_Week_Schema {

	const SCHEMA_VERSION          = '2';
	const CURRENT_READER_VERSION  = '2';
	const PREVIOUS_READER_VERSION = null;
	const GENERATION              = 2;
	const TABLE_CHARSET           = 'utf8mb4';
	const TABLE_COLLATION         = 'utf8mb4_bin';
	const TABLE_NAMESPACE_VERSION = 'v1-study-week-tables-v1';
	const CONSTRAINT_NAMESPACE_VERSION = 'sha256-prefix-12-week-v1';
	const ACTIVITY_CATALOG_VERSION = 'd9-360-v1';
	const ACTIVITY_CATALOG_FINGERPRINT = '3f044b3a7b0a215fa36135eb9b8baca09ead05fb0a472c41a9c5cf18209b5630';
	const STORAGE_CODEBOOK_VERSION = 'week-storage-v1';
	const STORAGE_CODEBOOK_FINGERPRINT = '7f14be5a2cea325dc4d11b16ee6fb3cbfced45ff3c8df1df2d4aa5e62c653fa8';

	/** @return array */
	public static function logical_table_suffixes() {
		return array(
			'weeks'  => 'mmed_v1_study_weeks',
			'blocks' => 'mmed_v1_study_blocks',
		);
	}

	/** @return array */
	public static function logical_constraint_suffixes() {
		return array(
			'week_plan'       => 'week_plan_fk',
			'week_monday'     => 'week_monday_ck',
			'week_revision'   => 'week_revision_ck',
			'block_week'      => 'block_week_fk',
			'block_family'    => 'block_family_ck',
			'block_state'     => 'block_state_ck',
			'block_priority'  => 'block_priority_ck',
			'block_fold'      => 'block_fold_ck',
			'block_local'     => 'block_local_ck',
			'block_duration'  => 'block_duration_ck',
			'block_interval'  => 'block_interval_ck',
			'block_revision'  => 'block_revision_ck',
			'block_source'    => 'block_source_ck',
			'block_goal'      => 'block_goal_ck',
			'block_provenance'=> 'block_provenance_ck',
		);
	}

	/** @return array */
	public static function table_names( $database ) {
		$prefix = isset( $database->prefix ) ? (string) $database->prefix : '';
		if ( '' === $prefix || 1 !== preg_match( '/^[A-Za-z0-9_]+$/D', $prefix ) ) {
			throw new RuntimeException( 'V1 Week database prefix is invalid.' );
		}
		$names = array();
		foreach ( self::logical_table_suffixes() as $key => $suffix ) {
			$names[ $key ] = $prefix . $suffix;
			if ( strlen( $names[ $key ] ) > 64 ) {
				throw new RuntimeException( 'V1 Week rendered table identifier is too long.' );
			}
		}
		return $names;
	}

	/** @return array */
	public static function constraint_names( $database ) {
		self::table_names( $database );
		$scope = substr( hash( 'sha256', (string) $database->prefix ), 0, 12 );
		$names = array();
		foreach ( self::logical_constraint_suffixes() as $key => $suffix ) {
			$names[ $key ] = 'mmed_v1_' . $scope . '_' . $suffix;
			if ( strlen( $names[ $key ] ) > 64 ) {
				throw new RuntimeException( 'V1 Week rendered constraint identifier is too long.' );
			}
		}
		return $names;
	}

	/**
	 * Ordered additive migrations. The parent five-table kernel is never repeated
	 * or re-checksummed here.
	 *
	 * @return array
	 */
	public static function migrations( $database ) {
		$tables = array_merge( MMED_V1_Study_Schema::table_names( $database ), self::table_names( $database ) );
		$constraints = self::constraint_names( $database );
		$replacements = array();
		foreach ( $tables as $key => $table ) {
			$replacements[ '{{' . $key . '}}' ] = $table;
		}
		foreach ( $constraints as $key => $constraint ) {
			$replacements[ '{{' . $key . '}}' ] = $constraint;
		}

		$result = array();
		$binding = self::checksum_binding_json();
		foreach ( self::ddl_templates() as $descriptor ) {
			$canonical = self::canonical_sql( $descriptor['template'] );
			$result[] = array(
				'version'      => $descriptor['version'],
				'id'           => $descriptor['id'],
				'table_key'    => $descriptor['table_key'],
				'sql'          => self::canonical_sql( strtr( $descriptor['template'], $replacements ) ),
				'checksum_hex' => hash( 'sha256', $descriptor['id'] . "\n" . $binding . "\n" . $canonical ),
			);
		}
		return $result;
	}

	/** @return array */
	private static function ddl_templates() {
		$tail = 'ENGINE=InnoDB ROW_FORMAT=DYNAMIC DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_bin';
		return array(
			array(
				'version'   => 6,
				'id'        => '8010E-006-weeks',
				'table_key' => 'weeks',
				'template'  => "CREATE TABLE `{{weeks}}` (
				owner_id bigint unsigned NOT NULL,
				plan_id binary(16) NOT NULL,
				week_id binary(16) NOT NULL,
				week_start_local date NOT NULL,
				timezone varbinary(64) NOT NULL,
				profile_version varbinary(64) NOT NULL,
				tzdb_version varbinary(64) NOT NULL,
				temporal_policy_version varbinary(32) NOT NULL,
				temporal_context_hash binary(32) NOT NULL,
				created_revision bigint unsigned NOT NULL,
				updated_revision bigint unsigned NOT NULL,
				created_at datetime(6) NOT NULL,
				updated_at datetime(6) NOT NULL,
				PRIMARY KEY (owner_id, week_id),
				UNIQUE KEY uq_week_id (week_id),
				UNIQUE KEY uq_owner_plan_week (owner_id, plan_id, week_id, week_start_local),
				UNIQUE KEY uq_owner_plan_start (owner_id, plan_id, week_start_local),
				KEY idx_owner_start (owner_id, week_start_local),
				CONSTRAINT `{{week_plan}}` FOREIGN KEY (owner_id, plan_id) REFERENCES `{{plans}}` (owner_id, plan_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
				CONSTRAINT `{{week_monday}}` CHECK (WEEKDAY(week_start_local) = 0),
				CONSTRAINT `{{week_revision}}` CHECK (created_revision > 0 AND updated_revision >= created_revision)
			) {$tail}",
			),
			array(
				'version'   => 7,
				'id'        => '8010E-007-blocks',
				'table_key' => 'blocks',
				'template'  => "CREATE TABLE `{{blocks}}` (
				owner_id bigint unsigned NOT NULL,
				plan_id binary(16) NOT NULL,
				week_id binary(16) NOT NULL,
				week_start_local date NOT NULL,
				block_id binary(16) NOT NULL,
				title varchar(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
				activity_type varbinary(32) NOT NULL,
				activity_catalog_version varbinary(64) NOT NULL,
				storage_codebook_version varbinary(64) NOT NULL,
				family_code tinyint unsigned NOT NULL,
				state_code tinyint unsigned NOT NULL,
				priority_code tinyint unsigned NOT NULL,
				goal_ref_hash binary(32) NULL,
				goal_source_version varbinary(64) NULL,
				source_code tinyint unsigned NOT NULL,
				source_namespace_hash binary(32) NULL,
				source_ref_hash binary(32) NULL,
				source_version_hash binary(32) NULL,
				start_at_utc datetime(6) NOT NULL,
				end_at_utc datetime(6) NOT NULL,
				timezone varbinary(64) NOT NULL,
				profile_version varbinary(64) NOT NULL,
				tzdb_version varbinary(64) NOT NULL,
				local_date date NOT NULL,
				local_minute smallint unsigned NOT NULL,
				fold_code tinyint unsigned NOT NULL,
				temporal_policy_version varbinary(32) NOT NULL,
				temporal_context_hash binary(32) NOT NULL,
				duration_minutes smallint unsigned NOT NULL,
				created_revision bigint unsigned NOT NULL,
				updated_revision bigint unsigned NOT NULL,
				tombstoned_revision bigint unsigned NULL,
				created_at datetime(6) NOT NULL,
				updated_at datetime(6) NOT NULL,
				tombstoned_at datetime(6) NULL,
				PRIMARY KEY (owner_id, block_id),
				UNIQUE KEY uq_block_id (block_id),
				UNIQUE KEY uq_owner_plan_block (owner_id, plan_id, block_id),
				UNIQUE KEY uq_owner_source_version (owner_id, source_namespace_hash, source_ref_hash, source_version_hash),
				KEY idx_owner_week_interval (owner_id, week_id, start_at_utc, end_at_utc, state_code),
				KEY idx_owner_plan_local (owner_id, plan_id, local_date, local_minute),
				CONSTRAINT `{{block_week}}` FOREIGN KEY (owner_id, plan_id, week_id, week_start_local) REFERENCES `{{weeks}}` (owner_id, plan_id, week_id, week_start_local) ON UPDATE RESTRICT ON DELETE RESTRICT,
				CONSTRAINT `{{block_family}}` CHECK (family_code BETWEEN 1 AND 6),
				CONSTRAINT `{{block_state}}` CHECK (state_code BETWEEN 1 AND 3),
				CONSTRAINT `{{block_priority}}` CHECK (priority_code BETWEEN 0 AND 1),
				CONSTRAINT `{{block_fold}}` CHECK (fold_code BETWEEN 0 AND 2),
				CONSTRAINT `{{block_local}}` CHECK (local_minute BETWEEN 360 AND 1425 AND MOD(local_minute, 15) = 0 AND local_minute + duration_minutes <= 1440),
				CONSTRAINT `{{block_duration}}` CHECK (duration_minutes BETWEEN 15 AND 720 AND MOD(duration_minutes, 15) = 0),
				CONSTRAINT `{{block_interval}}` CHECK (start_at_utc < end_at_utc AND end_at_utc = TIMESTAMPADD(MINUTE, duration_minutes, start_at_utc)),
				CONSTRAINT `{{block_revision}}` CHECK (created_revision > 0 AND updated_revision >= created_revision AND ((state_code = 3 AND tombstoned_revision = updated_revision AND tombstoned_at IS NOT NULL) OR (state_code <> 3 AND tombstoned_revision IS NULL AND tombstoned_at IS NULL))),
				CONSTRAINT `{{block_source}}` CHECK ((source_code = 1 AND state_code <> 2 AND source_namespace_hash IS NULL AND source_ref_hash IS NULL AND source_version_hash IS NULL) OR (source_code = 2 AND state_code <> 1 AND source_namespace_hash IS NOT NULL AND source_ref_hash IS NOT NULL AND source_version_hash IS NOT NULL)),
				CONSTRAINT `{{block_goal}}` CHECK ((goal_ref_hash IS NULL AND goal_source_version IS NULL) OR (goal_ref_hash IS NOT NULL AND goal_source_version IS NOT NULL)),
				CONSTRAINT `{{block_provenance}}` CHECK (OCTET_LENGTH(activity_catalog_version) BETWEEN 1 AND 64 AND OCTET_LENGTH(storage_codebook_version) BETWEEN 1 AND 64 AND OCTET_LENGTH(profile_version) BETWEEN 1 AND 64 AND OCTET_LENGTH(tzdb_version) BETWEEN 1 AND 64 AND OCTET_LENGTH(temporal_policy_version) BETWEEN 1 AND 32)
			) {$tail}",
			),
		);
	}

	/** @return string */
	private static function checksum_binding_json() {
		$binding = array(
			'activity_catalog_fingerprint'  => self::ACTIVITY_CATALOG_FINGERPRINT,
			'activity_catalog_version'      => self::ACTIVITY_CATALOG_VERSION,
			'parent_contract'              => 'V1-STUDY-SCHEDULE-8010D-KERNEL',
			'storage_codebook_fingerprint' => self::STORAGE_CODEBOOK_FINGERPRINT,
			'storage_codebook_version'     => self::STORAGE_CODEBOOK_VERSION,
			'table_namespace_version'      => self::TABLE_NAMESPACE_VERSION,
			'tables'                       => self::logical_table_suffixes(),
			'constraint_namespace_version' => self::CONSTRAINT_NAMESPACE_VERSION,
			'constraints'                  => self::logical_constraint_suffixes(),
		);
		$json = json_encode( $binding, JSON_UNESCAPED_SLASHES );
		if ( ! is_string( $json ) ) {
			throw new RuntimeException( 'V1 Week schema checksum binding encoding failed.' );
		}
		return $json;
	}

	/** @return string */
	private static function canonical_sql( $sql ) {
		$canonical = preg_replace( '/\s+/', ' ', trim( (string) $sql ) );
		if ( ! is_string( $canonical ) || '' === $canonical ) {
			throw new RuntimeException( 'V1 Week SQL canonicalization failed.' );
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
			'activity_catalog_fingerprint' => self::ACTIVITY_CATALOG_FINGERPRINT,
			'activity_catalog_version' => self::ACTIVITY_CATALOG_VERSION,
			'contract'        => 'V1-STUDY-SCHEDULE-8010E-WEEK',
			'parent_manifest' => MMED_V1_Study_Schema::manifest_hash_hex( $database ),
			'generation'      => self::GENERATION,
			'schema'          => self::SCHEMA_VERSION,
			'current_reader'  => self::CURRENT_READER_VERSION,
			'previous_reader' => self::PREVIOUS_READER_VERSION,
			'storage_codebook_fingerprint' => self::STORAGE_CODEBOOK_FINGERPRINT,
			'storage_codebook_version'     => self::STORAGE_CODEBOOK_VERSION,
			'table_namespace_version'      => self::TABLE_NAMESPACE_VERSION,
			'tables'                       => self::logical_table_suffixes(),
			'constraint_namespace_version' => self::CONSTRAINT_NAMESPACE_VERSION,
			'constraints'                  => self::logical_constraint_suffixes(),
			'table_charset'   => self::TABLE_CHARSET,
			'table_collation' => self::TABLE_COLLATION,
			'migrations'      => $rows,
		);
		$json = json_encode( $manifest, JSON_UNESCAPED_SLASHES );
		if ( ! is_string( $json ) ) {
			throw new RuntimeException( 'V1 Week schema manifest encoding failed.' );
		}
		return hash( 'sha256', $json );
	}

	/** Portable information_schema expectations for the two additive tables. */
	public static function expected_shapes( $database ) {
		$constraints = self::constraint_names( $database );
		$binary16 = self::column( 'binary', false, null, 16 );
		$binary32 = self::column( 'binary', false, null, 32 );
		$datetime6 = self::column( 'datetime', false, null, null, false, 6 );
		$nullable_datetime6 = self::column( 'datetime', true, null, null, false, 6 );
		return array(
			'weeks' => self::table_shape(
				array(
					'owner_id'               => self::column( 'bigint', false, null, null, true ),
					'plan_id'                => $binary16,
					'week_id'                => $binary16,
					'week_start_local'       => self::column( 'date', false, null ),
					'timezone'               => self::column( 'varbinary', false, null, 64 ),
					'profile_version'        => self::column( 'varbinary', false, null, 64 ),
					'tzdb_version'           => self::column( 'varbinary', false, null, 64 ),
					'temporal_policy_version'=> self::column( 'varbinary', false, null, 32 ),
					'temporal_context_hash'  => $binary32,
					'created_revision'        => self::column( 'bigint', false, null, null, true ),
					'updated_revision'        => self::column( 'bigint', false, null, null, true ),
					'created_at'              => $datetime6,
					'updated_at'              => $datetime6,
				),
				array(
					'PRIMARY'              => self::index( true, array( 'owner_id', 'week_id' ) ),
					'uq_week_id'           => self::index( true, array( 'week_id' ) ),
					'uq_owner_plan_week'   => self::index( true, array( 'owner_id', 'plan_id', 'week_id', 'week_start_local' ) ),
					'uq_owner_plan_start'  => self::index( true, array( 'owner_id', 'plan_id', 'week_start_local' ) ),
					'idx_owner_start'      => self::index( false, array( 'owner_id', 'week_start_local' ) ),
				),
				array(
					$constraints['week_plan'] => array(
						'columns'            => array( 'owner_id', 'plan_id' ),
						'referenced_table'   => 'plans',
						'referenced_columns' => array( 'owner_id', 'plan_id' ),
						'update_rule'        => 'RESTRICT',
						'delete_rule'        => 'RESTRICT',
						'match_option'       => 'NONE',
					),
				),
				array(
					$constraints['week_monday']   => 'WEEKDAY(week_start_local) = 0',
					$constraints['week_revision'] => 'created_revision > 0 AND updated_revision >= created_revision',
				)
			),
			'blocks' => self::table_shape(
				array(
					'owner_id'               => self::column( 'bigint', false, null, null, true ),
					'plan_id'                => $binary16,
					'week_id'                => $binary16,
					'week_start_local'       => self::column( 'date', false, null ),
					'block_id'               => $binary16,
					'title'                  => self::column( 'varchar', false, null, 120, false, null, self::TABLE_CHARSET, self::TABLE_COLLATION ),
					'activity_type'          => self::column( 'varbinary', false, null, 32 ),
					'activity_catalog_version'=> self::column( 'varbinary', false, null, 64 ),
					'storage_codebook_version'=> self::column( 'varbinary', false, null, 64 ),
					'family_code'            => self::column( 'tinyint', false, null, null, true ),
					'state_code'             => self::column( 'tinyint', false, null, null, true ),
					'priority_code'          => self::column( 'tinyint', false, null, null, true ),
					'goal_ref_hash'          => self::column( 'binary', true, null, 32 ),
					'goal_source_version'    => self::column( 'varbinary', true, null, 64 ),
					'source_code'            => self::column( 'tinyint', false, null, null, true ),
					'source_namespace_hash'  => self::column( 'binary', true, null, 32 ),
					'source_ref_hash'        => self::column( 'binary', true, null, 32 ),
					'source_version_hash'    => self::column( 'binary', true, null, 32 ),
					'start_at_utc'           => $datetime6,
					'end_at_utc'             => $datetime6,
					'timezone'               => self::column( 'varbinary', false, null, 64 ),
					'profile_version'        => self::column( 'varbinary', false, null, 64 ),
					'tzdb_version'           => self::column( 'varbinary', false, null, 64 ),
					'local_date'             => self::column( 'date', false, null ),
					'local_minute'           => self::column( 'smallint', false, null, null, true ),
					'fold_code'              => self::column( 'tinyint', false, null, null, true ),
					'temporal_policy_version'=> self::column( 'varbinary', false, null, 32 ),
					'temporal_context_hash'  => $binary32,
					'duration_minutes'       => self::column( 'smallint', false, null, null, true ),
					'created_revision'        => self::column( 'bigint', false, null, null, true ),
					'updated_revision'        => self::column( 'bigint', false, null, null, true ),
					'tombstoned_revision'     => self::column( 'bigint', true, null, null, true ),
					'created_at'              => $datetime6,
					'updated_at'              => $datetime6,
					'tombstoned_at'           => $nullable_datetime6,
				),
				array(
					'PRIMARY'                 => self::index( true, array( 'owner_id', 'block_id' ) ),
					'uq_block_id'             => self::index( true, array( 'block_id' ) ),
					'uq_owner_plan_block'     => self::index( true, array( 'owner_id', 'plan_id', 'block_id' ) ),
					'uq_owner_source_version'=> self::index( true, array( 'owner_id', 'source_namespace_hash', 'source_ref_hash', 'source_version_hash' ) ),
					'idx_owner_week_interval' => self::index( false, array( 'owner_id', 'week_id', 'start_at_utc', 'end_at_utc', 'state_code' ) ),
					'idx_owner_plan_local'    => self::index( false, array( 'owner_id', 'plan_id', 'local_date', 'local_minute' ) ),
				),
				array(
					$constraints['block_week'] => array(
						'columns'            => array( 'owner_id', 'plan_id', 'week_id', 'week_start_local' ),
						'referenced_table'   => 'weeks',
						'referenced_columns' => array( 'owner_id', 'plan_id', 'week_id', 'week_start_local' ),
						'update_rule'        => 'RESTRICT',
						'delete_rule'        => 'RESTRICT',
						'match_option'       => 'NONE',
					),
				),
				array(
					$constraints['block_family']   => 'family_code BETWEEN 1 AND 6',
					$constraints['block_state']    => 'state_code BETWEEN 1 AND 3',
					$constraints['block_priority'] => 'priority_code BETWEEN 0 AND 1',
					$constraints['block_fold']     => 'fold_code BETWEEN 0 AND 2',
					$constraints['block_local']    => 'local_minute BETWEEN 360 AND 1425 AND MOD(local_minute, 15) = 0 AND local_minute + duration_minutes <= 1440',
					$constraints['block_duration'] => 'duration_minutes BETWEEN 15 AND 720 AND MOD(duration_minutes, 15) = 0',
					$constraints['block_interval'] => 'start_at_utc < end_at_utc AND end_at_utc = TIMESTAMPADD(MINUTE, duration_minutes, start_at_utc)',
					$constraints['block_revision'] => 'created_revision > 0 AND updated_revision >= created_revision AND ((state_code = 3 AND tombstoned_revision = updated_revision AND tombstoned_at IS NOT NULL) OR (state_code <> 3 AND tombstoned_revision IS NULL AND tombstoned_at IS NULL))',
					$constraints['block_source']   => '(source_code = 1 AND state_code <> 2 AND source_namespace_hash IS NULL AND source_ref_hash IS NULL AND source_version_hash IS NULL) OR (source_code = 2 AND state_code <> 1 AND source_namespace_hash IS NOT NULL AND source_ref_hash IS NOT NULL AND source_version_hash IS NOT NULL)',
					$constraints['block_goal']     => '(goal_ref_hash IS NULL AND goal_source_version IS NULL) OR (goal_ref_hash IS NOT NULL AND goal_source_version IS NOT NULL)',
					$constraints['block_provenance'] => 'OCTET_LENGTH(activity_catalog_version) BETWEEN 1 AND 64 AND OCTET_LENGTH(storage_codebook_version) BETWEEN 1 AND 64 AND OCTET_LENGTH(profile_version) BETWEEN 1 AND 64 AND OCTET_LENGTH(tzdb_version) BETWEEN 1 AND 64 AND OCTET_LENGTH(temporal_policy_version) BETWEEN 1 AND 32',
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
	private static function index( $unique, $columns ) {
		return array( 'unique' => (bool) $unique, 'columns' => $columns );
	}
}
