<?php
/**
 * ROOT protection. One normalization rule, one hash, one reconstruction path.
 * Only the authorized region may differ between the ROOT and any output.
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class MMPS_Region {

	const RULE = 'NFC+nbsp-to-space+collapse-whitespace+trim;sha256';
	const PROGRAM_TOKEN = '*Your Program*';

	public static function normalize( $text ) {
		$text = (string) $text;
		if ( class_exists( 'Normalizer' ) ) {
			$nfc = Normalizer::normalize( $text, Normalizer::FORM_C );
			if ( false !== $nfc ) {
				$text = $nfc;
			}
		}
		$text = str_replace( array( "\xC2\xA0", "\r" ), array( ' ', '' ), $text );
		return trim( preg_replace( '/\s+/u', ' ', $text ) );
	}

	public static function hash( $text ) {
		return hash( 'sha256', self::normalize( $text ) );
	}

	public static function text_hash( $paragraphs ) {
		return hash( 'sha256', implode( "\n\n", array_map( array( __CLASS__, 'normalize' ), $paragraphs ) ) );
	}

	/** Split pasted text into paragraphs on blank lines (or single newlines when no blank lines exist). */
	public static function split_text( $text ) {
		$text  = str_replace( "\r", '', (string) $text );
		$parts = preg_split( '/\n\s*\n/u', $text );
		if ( count( $parts ) < 3 ) {
			$parts = preg_split( '/\n+/u', $text );
		}
		$out = array();
		foreach ( $parts as $part ) {
			$part = self::normalize( $part );
			if ( '' !== $part ) {
				$out[] = $part;
			}
		}
		return $out;
	}

	/**
	 * Resolve the Founder template contract before a ROOT is persisted.
	 *
	 * A template is recognized only when exactly one pair of standalone `***`
	 * paragraphs bounds exactly one Program Answer paragraph. The marker
	 * paragraphs are transport metadata and are removed from the immutable ROOT.
	 * With no marker, the existing explicit region-confirmation flow remains in
	 * force. Any partial or ambiguous marker shape fails closed.
	 *
	 * @return array|WP_Error {found, paragraphs, region, detection}
	 */
	public static function parse_template( $paragraphs ) {
		$paragraphs = array_values( array_map( array( __CLASS__, 'normalize' ), (array) $paragraphs ) );
		$markers    = array();
		foreach ( $paragraphs as $i => $paragraph ) {
			if ( '***' === $paragraph ) {
				$markers[] = $i;
			}
		}
		if ( empty( $markers ) ) {
			return array( 'found' => false, 'paragraphs' => $paragraphs, 'region' => array(), 'detection' => self::detect( $paragraphs ) );
		}
		if ( 2 !== count( $markers ) ) {
			return new WP_Error( 'mmps_template_markers', 'Use exactly one opening and one closing *** marker around the Program Answer paragraph.', array( 'status' => 422 ) );
		}
		$open  = $markers[0];
		$close = $markers[1];
		if ( 2 !== $close - $open || $open < 1 || $close >= count( $paragraphs ) - 1 ) {
			return new WP_Error( 'mmps_template_region', 'The *** markers must surround exactly one Program Answer paragraph, with protected ROOT paragraphs before and after it.', array( 'status' => 422 ) );
		}

		$source = $paragraphs[ $open + 1 ];
		$kind   = 0 === strcasecmp( $source, '[Program Paragraph Here]' ) ? 'BLANK' : 'SLOTTED';
		$slots  = array();
		$static = array();
		if ( 'SLOTTED' === $kind ) {
			preg_match_all( '/\[([A-Za-z][A-Za-z0-9 _\/,\'&()\-]{1,80})\]/u', $source, $matches, PREG_OFFSET_CAPTURE );
			if ( empty( $matches[0] ) ) {
				return new WP_Error( 'mmps_template_slots', 'The paragraph between *** markers must be [Program Paragraph Here] or authored prose containing semantic [slots].', array( 'status' => 422 ) );
			}
			$cursor = 0;
			foreach ( $matches[0] as $i => $match ) {
				$before = substr( $source, $cursor, $match[1] - $cursor );
				if ( '' !== self::normalize( $before ) ) {
					$static[] = self::normalize( $before );
				}
				$slots[] = array(
					'order'       => $i + 1,
					'placeholder' => $match[0],
					'label'       => self::normalize( $matches[1][ $i ][0] ),
				);
				$cursor = $match[1] + strlen( $match[0] );
			}
			$tail = substr( $source, $cursor );
			if ( '' !== self::normalize( $tail ) ) {
				$static[] = self::normalize( $tail );
			}
			$without_slots = preg_replace( '/\[([A-Za-z][A-Za-z0-9 _\/,\'&()\-]{1,80})\]/u', '', $source );
			if ( false !== strpos( $without_slots, '[' ) || false !== strpos( $without_slots, ']' ) ) {
				return new WP_Error( 'mmps_template_slots', 'The Program Answer template contains an incomplete or unsupported bracket slot.', array( 'status' => 422 ) );
			}
		}

		$clean = $paragraphs;
		array_splice( $clean, $close, 1 );
		array_splice( $clean, $open, 1 );
		$index     = $open;
		$detection = array(
			'proposedIndex' => $index,
			'confidence'    => 'HIGH',
			'rule'          => 'founder-template-v1',
			'templateKind'  => $kind,
		);
		$region = self::build( $clean, 'REPLACE_PARAGRAPH', $index, $detection );
		if ( is_wp_error( $region ) ) {
			return $region;
		}
		$region['authorization'] = 'ROOT_TEMPLATE_MARKERS';
		$region['template']      = array(
			'contract'        => 'founder-template-v1',
			'kind'            => $kind,
			'behavior'        => 'USE_TEMPLATE',
			'sourceText'      => $source,
			'slots'           => $slots,
			'staticFragments' => $static,
		);
		return array( 'found' => true, 'paragraphs' => $clean, 'region' => $region, 'detection' => $detection );
	}

	/** Deterministic proposal of the program-specific paragraph. The user always confirms. */
	public static function detect( $paragraphs ) {
		$cues = array(
			'/\byour (residency )?program\b/i'                              => 3,
			'/\b(a|the) (residency |training )?program (that|where|with|which)\b/i' => 3,
			'/\bI am (looking|searching|seeking) for\b/i'                   => 2,
			'/\bI (hope|wish|want|would like) to (train|join|match)\b/i'    => 2,
			'/\b(ideal|right) (residency |training )?program\b/i'           => 2,
			'/\btrain(ing)? (at|in) (a|an|your)\b/i'                        => 1,
			'/\b(residency|program) (should|will|would) (offer|provide)\b/i' => 1,
		);
		$count  = count( $paragraphs );
		$scores = array();
		foreach ( $paragraphs as $i => $p ) {
			$score = 0;
			foreach ( $cues as $pattern => $weight ) {
				if ( preg_match( $pattern, $p ) ) {
					$score += $weight;
				}
			}
			if ( $i >= $count - 3 && $i < $count - 1 ) {
				$score += 1; // Program paragraphs usually sit just before the close.
			}
			if ( 0 === $i ) {
				$score = 0;  // Never propose the opening.
			}
			$scores[ $i ] = $score;
		}
		arsort( $scores );
		$keys       = array_keys( $scores );
		$best       = $keys[0];
		$best_score = $scores[ $best ];
		$margin     = $best_score - ( isset( $keys[1] ) ? $scores[ $keys[1] ] : 0 );
		$confidence = ( $best_score >= 4 && $margin >= 2 ) ? 'HIGH' : ( $best_score >= 2 ? 'MEDIUM' : 'LOW' );
		return array(
			'proposedIndex' => $best_score >= 2 ? $best : null,
			'confidence'    => $confidence,
			'rule'          => 'cue-phrases-v1',
		);
	}

	/**
	 * Build the stored region record.
	 *
	 * @param array  $paragraphs ROOT paragraphs.
	 * @param string $mode REPLACE_PARAGRAPH or INSERT_BEFORE.
	 * @param int    $index Paragraph index the mode refers to.
	 */
	public static function build( $paragraphs, $mode, $index, $detection = array() ) {
		$count = count( $paragraphs );
		$index = (int) $index;
		if ( 'REPLACE_PARAGRAPH' === $mode ) {
			if ( $index < 1 || $index > $count - 1 ) {
				return new WP_Error( 'mmps_region_invalid', 'Choose a paragraph after the opening.', array( 'status' => 422 ) );
			}
		} elseif ( 'INSERT_BEFORE' === $mode ) {
			if ( $index < 1 || $index > $count ) {
				return new WP_Error( 'mmps_region_invalid', 'Choose where the new paragraph should go.', array( 'status' => 422 ) );
			}
		} else {
			return new WP_Error( 'mmps_region_invalid', 'Unknown region mode.', array( 'status' => 422 ) );
		}
		return array(
			'mode'               => $mode,
			'paragraphIndex'     => $index,
			'regionSha256'       => 'REPLACE_PARAGRAPH' === $mode ? self::hash( $paragraphs[ $index ] ) : '',
			'paragraphHashes'    => array_map( array( __CLASS__, 'hash' ), $paragraphs ),
			'rootTextSha256'     => self::text_hash( $paragraphs ),
			'normalizationRule'  => self::RULE,
			'detection'          => $detection,
			'confirmedAt'        => gmdate( 'c' ),
		);
	}

	public static function original_region( $paragraphs, $region ) {
		return 'REPLACE_PARAGRAPH' === $region['mode'] ? (string) $paragraphs[ $region['paragraphIndex'] ] : '';
	}

	/** Replace only the authorized region. */
	public static function reconstruct( $paragraphs, $region, $replacement ) {
		$replacement = self::normalize( str_replace( "\n", ' ', (string) $replacement ) );
		$out         = array_values( $paragraphs );
		if ( 'REPLACE_PARAGRAPH' === $region['mode'] ) {
			$out[ $region['paragraphIndex'] ] = $replacement;
		} else {
			array_splice( $out, $region['paragraphIndex'], 0, array( $replacement ) );
		}
		return $out;
	}

	/** Founder-authorized deterministic substitution; never permits surrounding prose edits. */
	public static function substitute_program_token( $paragraphs, $natural_name ) {
		$natural_name = self::normalize( $natural_name );
		if ( '' === $natural_name ) {
			return new WP_Error( 'mmps_program_name_missing', 'A verified program name is required before the statement can be prepared.', array( 'status' => 409 ) );
		}
		$out = array_values( (array) $paragraphs );
		$replacements = array();
		foreach ( $out as $i => $paragraph ) {
			$count = substr_count( (string) $paragraph, self::PROGRAM_TOKEN );
			if ( $count ) {
				$out[ $i ] = str_replace( self::PROGRAM_TOKEN, $natural_name, (string) $paragraph );
				$replacements[] = array( 'paragraphIndex' => $i, 'count' => $count, 'token' => self::PROGRAM_TOKEN, 'resolvedName' => $natural_name );
			}
		}
		return array( 'paragraphs' => $out, 'replacements' => $replacements );
	}

	/** Verify the only protected change is exact token substitution. */
	public static function verify_protected_with_program_token( $root_paragraphs, $output_paragraphs, $region, $natural_name ) {
		$expected = self::substitute_program_token( $root_paragraphs, $natural_name );
		if ( is_wp_error( $expected ) ) { return $expected; }
		$token_region = $region;
		$token_region['paragraphHashes'] = array_map( array( __CLASS__, 'hash' ), $expected['paragraphs'] );
		return self::verify_protected( $output_paragraphs, $token_region );
	}

	/**
	 * Prove that every protected paragraph of the output equals the ROOT under
	 * the normalization rule. Returns true or a WP_Error naming the first drift.
	 */
	public static function verify_protected( $output_paragraphs, $region ) {
		$expected = $region['paragraphHashes'];
		$index    = (int) $region['paragraphIndex'];
		$actual   = array_values( $output_paragraphs );
		if ( 'REPLACE_PARAGRAPH' === $region['mode'] ) {
			if ( count( $actual ) !== count( $expected ) ) {
				return new WP_Error( 'mmps_root_integrity', 'Paragraph count changed.', array( 'status' => 500 ) );
			}
			foreach ( $expected as $i => $hash ) {
				if ( $i === $index ) {
					continue;
				}
				if ( ! hash_equals( $hash, self::hash( $actual[ $i ] ) ) ) {
					return new WP_Error( 'mmps_root_integrity', 'Protected paragraph ' . ( $i + 1 ) . ' differs from the ROOT.', array( 'status' => 500 ) );
				}
			}
			return true;
		}
		if ( count( $actual ) !== count( $expected ) + 1 ) {
			return new WP_Error( 'mmps_root_integrity', 'Paragraph count changed.', array( 'status' => 500 ) );
		}
		array_splice( $actual, $index, 1 );
		foreach ( $expected as $i => $hash ) {
			if ( ! hash_equals( $hash, self::hash( $actual[ $i ] ) ) ) {
				return new WP_Error( 'mmps_root_integrity', 'Protected paragraph ' . ( $i + 1 ) . ' differs from the ROOT.', array( 'status' => 500 ) );
			}
		}
		return true;
	}

	/** Re-check a stored ROOT against its own region record before every use. */
	public static function root_still_matches( $paragraphs, $region ) {
		return isset( $region['rootTextSha256'] ) && hash_equals( (string) $region['rootTextSha256'], self::text_hash( $paragraphs ) );
	}
}
