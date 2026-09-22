<?php
/**
 * Where ROOT statements come from.
 *  - FILE_VAULT: the user's own Personal Statement versions, read through a
 *    subclass of File Vault's repository (protected helpers, no edit to any
 *    File Vault file, read-only, owner-scoped, no activity event).
 *  - SYNTHETIC: a built-in fictional statement, safe to send to the AI provider.
 *  - PASTED: text pasted by the allowlisted tester.
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class MMPS_Root_Source {

	const UPLOAD_MAX_BYTES = 5242880;

	/**
	 * True only when File Vault's repository class is present AND still has the
	 * exact shape this read-only bridge relies on. Any drift means "unavailable",
	 * never a fatal error.
	 */
	public static function file_vault_available() {
		static $ok = null;
		if ( null !== $ok ) {
			return $ok;
		}
		$ok = false;
		if ( ! class_exists( 'MMED_File_Vault_V2_Repository' ) ) {
			return $ok;
		}
		try {
			$parent = new ReflectionClass( 'MMED_File_Vault_V2_Repository' );
			if ( $parent->isFinal() || $parent->isAbstract() ) {
				return $ok;
			}
			foreach ( array( 'list_documents', 'table_name', 'meta_for_row', 'internal_versions', 'presign_download_url' ) as $name ) {
				if ( ! $parent->hasMethod( $name ) ) {
					return $ok;
				}
				$method = $parent->getMethod( $name );
				if ( ! $method->isStatic() || $method->isPrivate() || $method->isAbstract() ) {
					return $ok;
				}
			}
		} catch ( Exception $e ) {
			return $ok;
		}
		require_once MMPS_PATH . 'includes/class-mmps-fv-reader.php';
		$ok = class_exists( 'MMPS_FV_Reader' ) && MMPS_FV_Reader::contract_ok();
		return $ok;
	}

	public static function candidates( $user_id ) {
		if ( ! self::file_vault_available() ) {
			return array();
		}
		$list = MMPS_FV_Reader::ps_candidates( $user_id );
		return is_wp_error( $list ) ? array() : $list;
	}

	/** Built-in fictional statements. No real person. Two voices so voice preservation can be judged. */
	public static function synthetics() {
		return array(
			'im' => array(
				'label'      => 'SYNTHETIC TEST ROOT A · fictional Internal Medicine applicant',
				'specialty'  => 'Internal Medicine',
				'paragraphs' => array(
				'The ward had one working glucometer, and on my first night as an intern it lived in the pocket of whoever had used it last. I spent that night walking the corridor of a district hospital asking for it. By morning I had learned two things. A retired teacher\'s sudden confusion was low blood sugar and not the stroke everyone had assumed. And most of what goes wrong for patients goes wrong in the gaps between people, not in the textbook.',
				'That night is why I chose internal medicine. I like the discipline of it: the problem list that has to be earned, the medication reconciliation nobody wants to do, the quiet satisfaction of finding the one detail in a long history that changes the plan. During my intern year I started keeping a handwritten sheet for every patient I handed over, with the one thing I was most worried about written at the top. Within two months the other interns on my ward were using the same sheet, and our night calls about "unexpected" deterioration became less frequent.',
				'My clinical experience in the United States taught me how much further that habit can go inside a real team. During a three-month rotation on an inpatient medicine service I pre-rounded with the residents, presented on rounds and wrote practice notes that my attending corrected line by line. I followed a man in his fifties through three admissions for heart failure in ten weeks. Each discharge summary was accurate, and each one missed the same fact: he could not afford the diuretic he was prescribed and was too proud to say so. The senior resident who finally asked him taught me more about cardiology in that conversation than any lecture had.',
				'I wanted to know how often that happens, so I asked. With my attending\'s guidance I reviewed six months of heart failure readmissions on our service and found that a documented conversation about medication cost was missing in most of them. We presented the audit as a poster at a regional meeting and the service added one question to its discharge checklist. It is a small change. It is also the kind of work I want to keep doing: measure the gap, close it, and check whether it stayed closed.',
				'I am looking for a residency program where residents take real responsibility for their patients early and are taught at the bedside by people who enjoy teaching. I hope to train in a program that cares for a diverse community, supports residents who want to pursue cardiology, and gives them room to continue quality improvement work. I would be grateful for the chance to bring my work ethic and curiosity to your program.',
				'In ten years I hope to be a cardiologist who still thinks like a general internist, practicing in a community where heart failure is common and follow-up is hard, and teaching residents to ask the question that is not on the checklist. I am ready to work for that, starting with the glucometer in my own pocket.',
				),
			),
			'fm' => array(
				'label'      => 'SYNTHETIC TEST ROOT B · fictional Family Medicine applicant',
				'specialty'  => 'Family Medicine',
				'paragraphs' => array(
					'My grandmother\'s clinic visits took a whole day. Two buses, a waiting room with a broken fan, ten minutes with a doctor who never looked up from the chart. I was nine and I carried her pills in a biscuit tin. I did not know then that I was watching what happens when nobody owns the whole patient.',
					'In medical school the family medicine department was three rooms at the end of a corridor. I spent more time there than anywhere else. I liked that the same woman could come in for her blood pressure, her daughter\'s cough and her husband\'s drinking, and that all three were my job. I liked that the work was never finished in one visit. Other rotations taught me diseases. That corridor taught me people.',
					'My clinical experience in the United States was at a community health center. I learned to work inside a team there: medical assistants who knew every family by name, a pharmacist who caught my dosing error before it reached the patient, a counselor down the hall. I took histories in two languages. I learned that a prenatal visit, a well-child check and a diabetes follow-up can share one morning if the clinic is built for it.',
					'One patient stays with me. A farm worker in his forties came in for back pain. He left with a new diagnosis of diabetes, a referral for his eyes and an appointment for his wife, who had not seen a doctor in six years. None of that was heroic. It was a schedule with room in it and a physician who asked one more question. I want to become that physician.',
					'I am looking for a residency program that trains full-spectrum family physicians, with strong outpatient continuity, obstetrics and care for underserved patients. I hope to join a program where residents are known by name and are expected to grow into leaders of their clinics. I would be honored to train at your program.',
					'I still have the biscuit tin. It reminds me that good primary care is not complicated. It is close, it is continuous and it shows up. I am ready to spend three years learning to do it well.',
				),
			),
		);
	}

	protected static function synthetic( $key ) {
		$all = self::synthetics();
		return isset( $all[ $key ] ) ? $all[ $key ] : $all['im'];
	}

	public static function synthetic_label( $key = 'im' ) {
		$set = self::synthetic( $key );
		return $set['label'];
	}

	public static function synthetic_paragraphs( $key = 'im' ) {
		$set = self::synthetic( $key );
		return $set['paragraphs'];
	}

	/** Apply the optional Founder template contract without changing source-byte provenance. */
	protected static function prepare_template( &$data ) {
		$parsed = MMPS_Region::parse_template( $data['paragraphs'] );
		if ( is_wp_error( $parsed ) ) {
			return $parsed;
		}
		$data['paragraphs'] = $parsed['paragraphs'];
		if ( $parsed['found'] ) {
			$data['region'] = $parsed['region'];
		}
		return true;
	}

	/**
	 * Create an owner-scoped ROOT from a request-transient DOCX or UTF-8 TXT.
	 * The source file is never moved, retained or written into File Vault.
	 *
	 * @return int|WP_Error Root id.
	 */
	public static function create_upload( $user_id, $specialty, $file ) {
		$specialty = sanitize_text_field( (string) $specialty );
		if ( '' === $specialty ) {
			return new WP_Error( 'mmps_specialty_required', 'Say which specialty this ROOT is for.', array( 'status' => 422 ) );
		}
		if ( ! is_array( $file ) || ! isset( $file['error'], $file['tmp_name'], $file['name'], $file['size'] ) ) {
			return new WP_Error( 'mmps_root_upload', 'Choose one DOCX or TXT personal statement.', array( 'status' => 422 ) );
		}
		if ( UPLOAD_ERR_OK !== (int) $file['error'] ) {
			return new WP_Error( 'mmps_root_upload', 'The document upload did not complete. Choose the file again.', array( 'status' => 422 ) );
		}
		$size = (int) $file['size'];
		if ( $size < 1 || $size > self::UPLOAD_MAX_BYTES ) {
			return new WP_Error( 'mmps_root_upload_size', 'Upload a DOCX or TXT file no larger than 5 MB.', array( 'status' => 413 ) );
		}
		$tmp = (string) $file['tmp_name'];
		if ( '' === $tmp || ! is_file( $tmp ) || ( ! is_uploaded_file( $tmp ) && ! MMPS_Gate::testing() ) ) {
			return new WP_Error( 'mmps_root_upload', 'The uploaded document could not be verified.', array( 'status' => 422 ) );
		}
		$actual_size = filesize( $tmp );
		if ( false === $actual_size || (int) $actual_size !== $size ) {
			return new WP_Error( 'mmps_root_upload_size', 'The uploaded document did not pass its byte-count check.', array( 'status' => 422 ) );
		}
		$name = sanitize_file_name( wp_basename( (string) $file['name'] ) );
		$ext  = strtolower( pathinfo( $name, PATHINFO_EXTENSION ) );
		if ( ! in_array( $ext, array( 'docx', 'txt' ), true ) ) {
			return new WP_Error( 'mmps_root_upload_type', 'Upload a clean DOCX or UTF-8 TXT file. Export Pages or PDF documents to DOCX first.', array( 'status' => 415 ) );
		}
		$bytes = file_get_contents( $tmp );
		if ( false === $bytes || strlen( $bytes ) !== $size ) {
			return new WP_Error( 'mmps_root_upload_read', 'The uploaded document could not be read safely.', array( 'status' => 422 ) );
		}

		if ( 'docx' === $ext ) {
			$paragraphs = MMPS_Docx::paragraphs_from_bytes( $bytes );
		} else {
			if ( false !== strpos( $bytes, "\0" ) || 1 !== preg_match( '//u', $bytes ) ) {
				return new WP_Error( 'mmps_root_upload_encoding', 'The TXT file must be plain UTF-8 text.', array( 'status' => 415 ) );
			}
			$paragraphs = MMPS_Region::split_text( preg_replace( '/^\xEF\xBB\xBF/', '', $bytes ) );
		}
		if ( is_wp_error( $paragraphs ) ) {
			return $paragraphs;
		}
		if ( count( $paragraphs ) < 3 ) {
			return new WP_Error( 'mmps_root_too_short', 'That document has fewer than three paragraphs. Upload the complete statement with paragraph breaks.', array( 'status' => 422 ) );
		}
		$normalized_bytes = strlen( implode( "\n\n", $paragraphs ) );
		if ( count( $paragraphs ) > 100 || $normalized_bytes > 100000 ) {
			return new WP_Error( 'mmps_root_upload_length', 'That document is too large to be a Personal Statement ROOT.', array( 'status' => 422 ) );
		}

		$data = array(
			'specialty_label' => $specialty,
			'source_kind'     => 'UPLOADED',
			'is_synthetic'    => 0,
			'root_label'      => 'Uploaded PS · ' . ( '' !== $name ? $name : 'personal-statement.' . $ext ),
			'source_sha256'   => hash( 'sha256', $bytes ),
			'paragraphs'      => $paragraphs,
		);
		$prepared = self::prepare_template( $data );
		if ( is_wp_error( $prepared ) ) {
			return $prepared;
		}
		$data['text_sha256'] = MMPS_Region::text_hash( $data['paragraphs'] );
		$root_id = MMPS_Store::create_root( $user_id, $data );
		return $root_id ? $root_id : new WP_Error( 'mmps_root_save', 'The ROOT could not be saved.', array( 'status' => 500 ) );
	}

	/**
	 * Create a ROOT row from a JSON source. Direct uploads use create_upload()
	 * so client-supplied text can never impersonate an uploaded document.
	 *
	 * @return int|WP_Error Root id.
	 */
	public static function create( $user_id, $params ) {
		$source    = strtoupper( (string) ( $params['source'] ?? '' ) );
		$specialty = sanitize_text_field( (string) ( $params['specialtyLabel'] ?? '' ) );
		if ( '' === $specialty && 'SYNTHETIC' !== $source ) {
			return new WP_Error( 'mmps_specialty_required', 'Say which specialty this ROOT is for.', array( 'status' => 422 ) );
		}
		$data = array( 'specialty_label' => $specialty, 'source_kind' => $source );

		if ( 'SYNTHETIC' === $source ) {
			$set                     = self::synthetic( sanitize_key( (string) ( $params['syntheticKey'] ?? 'im' ) ) );
			$data['paragraphs']      = $set['paragraphs'];
			$data['is_synthetic']    = 1;
			$data['root_label']      = $set['label'];
			$data['specialty_label'] = $set['specialty'];   // A synthetic ROOT carries its own specialty.
		} elseif ( 'PASTED' === $source ) {
			$paragraphs = MMPS_Region::split_text( (string) ( $params['text'] ?? '' ) );
			if ( count( $paragraphs ) < 3 ) {
				return new WP_Error( 'mmps_root_too_short', 'Paste the full statement, with a blank line between paragraphs.', array( 'status' => 422 ) );
			}
			$data['paragraphs']   = $paragraphs;
			// Whether text is "test text" is never taken on anyone's word: pasted text always counts as a real
			// statement, so it reaches the AI provider only through the entitled, region-confirmed production path.
			$data['is_synthetic'] = 0;
			$data['root_label']   = 'Pasted statement · ' . gmdate( 'Y-m-d H:i' ) . ' UTC';
		} elseif ( 'FILE_VAULT' === $source ) {
			if ( ! self::file_vault_available() ) {
				return new WP_Error( 'mmps_file_vault_unavailable', 'File Vault is not available to Program-Specific PS on this site.', array( 'status' => 503 ) );
			}
			$read = MMPS_FV_Reader::read_version( $user_id, absint( $params['fileId'] ?? 0 ), absint( $params['versionNumber'] ?? 0 ) );
			if ( is_wp_error( $read ) ) {
				return $read;
			}
			$paragraphs = MMPS_Docx::paragraphs_from_bytes( $read['bytes'] );
			if ( is_wp_error( $paragraphs ) ) {
				return $paragraphs;
			}
			$data['paragraphs']        = $paragraphs;
			$data['is_synthetic']      = 0;
			$data['fv_file_id']        = absint( $params['fileId'] );
			$data['fv_version_number'] = absint( $params['versionNumber'] );
			$data['fv_version_uuid']   = (string) ( $read['version']['version_uuid'] ?? '' );
			$data['source_sha256']     = $read['sha256'];
			$data['root_label']        = 'File Vault PS · file ' . absint( $params['fileId'] ) . ' · v' . absint( $params['versionNumber'] );
			MMPS_Store::audit( $user_id, 'root_read', 'fv:' . absint( $params['fileId'] ) . ':v' . absint( $params['versionNumber'] ), array( 'sha256' => $read['sha256'] ) );
		} else {
			return new WP_Error( 'mmps_root_source', 'Unknown ROOT source.', array( 'status' => 422 ) );
		}

		if ( 'SYNTHETIC' !== $source ) {
			$prepared = self::prepare_template( $data );
			if ( is_wp_error( $prepared ) ) {
				return $prepared;
			}
		}
		$data['text_sha256'] = MMPS_Region::text_hash( $data['paragraphs'] );
		$root_id             = MMPS_Store::create_root( $user_id, $data );
		return $root_id ? $root_id : new WP_Error( 'mmps_root_save', 'The ROOT could not be saved.', array( 'status' => 500 ) );
	}
}
