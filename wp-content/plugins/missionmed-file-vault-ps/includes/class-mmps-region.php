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
