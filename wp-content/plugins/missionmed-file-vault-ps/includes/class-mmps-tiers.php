<?php
/**
 * Essential vs Deep. Deterministic: which verified facts the writer is allowed
 * to use for one program, given the student's preferences. The model never
 * sees a fact that is not selected here.
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class MMPS_Tiers {

	const DEEP_MIN_FACTS = 2;
	const DEEP_MAX_FACTS = 3;
	const PRIORITY_DEEP_CUTOFF = 25; // Top ~20-30 programs default to Deep.

	/** Preference category => evidence categories it can be anchored by. */
	protected static function category_map() {
		return array(
			'fellowship' => array( 'fellowship' ),
			'research'   => array( 'research' ),
			'teaching'   => array( 'teaching', 'curriculum' ),
			'curriculum' => array( 'curriculum' ),
			'population' => array( 'population' ),
			'mission'    => array( 'mission', 'population' ),
			'other'      => array( 'differentiator' ),
		);
	}

	public static function default_tier( $list_entry ) {
		if ( ! empty( $list_entry['goldStarred'] ) ) {
			return 'DEEP';
		}
		$position = isset( $list_entry['priorityPosition'] ) ? (int) $list_entry['priorityPosition'] : 0;
		return ( $position >= 1 && $position <= self::PRIORITY_DEEP_CUTOFF ) ? 'DEEP' : 'ESSENTIAL';
	}

	public static function sanitize_prefs( $prefs ) {
		$out = array( 'categories' => array(), 'location' => array(), 'otherText' => '' );
		foreach ( array_keys( self::category_map() ) as $key ) {
			$in = (array) ( $prefs['categories'][ $key ] ?? array() );
			$out['categories'][ $key ] = array(
				'on'    => ! empty( $in['on'] ),
				'terms' => array_slice( array_values( array_filter( array_map( 'sanitize_text_field', (array) ( $in['terms'] ?? array() ) ) ) ), 0, 6 ),
				'note'  => mb_substr( sanitize_text_field( (string) ( $in['note'] ?? '' ) ), 0, 200 ),
			);
		}
		$loc = (array) ( $prefs['location'] ?? array() );
		$out['location'] = array(
			'on'         => ! empty( $loc['on'] ),
			'states'     => array_slice( array_values( array_filter( array_map( 'sanitize_text_field', (array) ( $loc['states'] ?? array() ) ) ) ), 0, 16 ),
			'cities'     => array_slice( array_values( array_filter( array_map( 'sanitize_text_field', (array) ( $loc['cities'] ?? array() ) ) ) ), 0, 8 ),
			'reason'     => mb_substr( sanitize_text_field( (string) ( $loc['reason'] ?? '' ) ), 0, 200 ),
			'mayMention' => ! empty( $loc['mayMention'] ),
		);
		$out['otherText'] = mb_substr( sanitize_text_field( (string) ( $prefs['otherText'] ?? '' ) ), 0, 200 );
		return $out;
	}

	protected static function stem( $term ) {
		$term = strtolower( trim( $term ) );
		foreach ( array( 'ological', 'ologist', 'ology', 'logy', 'ical', 'ics', 'ies', 'ic', 'al', 's', 'y' ) as $suffix ) {
			$len = strlen( $term ) - strlen( $suffix );
			if ( $len >= 5 && substr( $term, -strlen( $suffix ) ) === $suffix ) {
				return substr( $term, 0, $len );
			}
		}
		return $term;
	}

	protected static function term_matches( $term, $text ) {
		$stem = self::stem( $term );
		if ( strlen( $stem ) < 3 ) {
			return false;
		}
		return (bool) preg_match( '/\b' . preg_quote( $stem, '/' ) . '/i', $text );
	}

	/**
	 * Decide the effective tier and the allowed facts.
	 *
	 * @return array {tierEffective, allowedFacts[], studentFacts[], deepNeeded bool, reasons[]}
	 */
	public static function plan( $bundle, $prefs, $tier_requested ) {
		$prefs     = self::sanitize_prefs( $prefs );
		$essential = array_values( (array) $bundle['essential'] );
		$reasons   = array();

		/* Student-side facts the writer may lean on (the student's own statements). */
		$student = array();
		foreach ( $prefs['categories'] as $key => $category ) {
			if ( $category['on'] ) {
				$student[] = array(
					'id'   => 'S-' . $key,
					'text' => 'The applicant says ' . $key . ' matters to them' . ( $category['terms'] ? ' (' . implode( ', ', $category['terms'] ) . ')' : '' ) . ( $category['note'] ? ': ' . $category['note'] : '' ) . '.',
				);
			}
		}
		$program_state = strtolower( (string) $bundle['program']['state'] );
		$program_city  = strtolower( (string) $bundle['program']['city'] );
		$loc           = $prefs['location'];
		$loc_match     = $loc['on'] && (
			in_array( $program_state, array_map( 'strtolower', $loc['states'] ), true ) ||
			( $program_city && in_array( $program_city, array_map( 'strtolower', $loc['cities'] ), true ) )
		);
		if ( $loc_match && $loc['mayMention'] && '' !== $loc['reason'] ) {
			$student[] = array( 'id' => 'S-location', 'text' => 'The applicant\'s own reason for this location: ' . $loc['reason'] . '.' );
		}

		if ( 'DEEP' !== $tier_requested ) {
			return array( 'tierEffective' => 'ESSENTIAL', 'allowedFacts' => $essential, 'studentFacts' => $student, 'deepNeeded' => false, 'reasons' => array( 'Essential uses verified identity facts only.' ) );
		}

		/*
		 * Score deep facts. A preference match always outranks general quality.
		 * A fellowship is usable ONLY when the student named it: a fellowship the
		 * student did not ask for is not a reason for this student.
		 * Facts that match no preference are used only to reach the Deep minimum,
		 * never to pad the paragraph.
		 */
		$map      = self::category_map();
		$any_pref = false;
		foreach ( $prefs['categories'] as $category ) {
			$any_pref = $any_pref || $category['on'];
		}
		$scored = array();
		foreach ( (array) $bundle['deepFacts'] as $fact ) {
			$pref             = 0;
			$matched          = '';
			$fellowship_named = false;
			foreach ( $prefs['categories'] as $key => $category ) {
				if ( ! $category['on'] ) {
					continue;
				}
				$in_category = in_array( $fact['category'], $map[ $key ], true );
				foreach ( $category['terms'] as $term ) {
					if ( self::term_matches( $term, $fact['text'] ) ) {
						$pref   += $in_category ? 5 : 3;
						$matched = $key . ':' . $term;
						if ( 'fellowship' === $key ) {
							$fellowship_named = true;
						}
					}
				}
				if ( $in_category && 'fellowship' !== $key ) {
					$pref += 2;
				}
			}
			if ( 'fellowship' === $fact['category'] && ! $fellowship_named ) {
				continue;
			}
			$quality  = ! empty( $fact['provenance']['itemSource'] ) ? 1 : 0;
			$quality += ! empty( $fact['provenance']['fresh'] ) ? 1 : 0;
			$quality += preg_match( '/[A-Z][a-z]+ [A-Z][a-z]+|\d/', $fact['text'] ) ? 1 : 0;   // named or quantified beats vague
			$quality -= preg_match( '/\b(excellent|outstanding|world-class|top-ranked|prestigious|renowned|state-of-the-art|cutting-edge|supportive|collegial|family-like)\b/i', $fact['text'] ) ? 3 : 0;
			if ( $quality < 0 ) {
				continue;                                   // Brochure language is not evidence.
			}
			$fact['prefScore']  = $pref;
			$fact['matchScore'] = $pref * 10 + $quality + ( 'differentiator' === $fact['category'] ? 1 : 0 );
			$fact['matchedOn']  = $matched;
			$scored[]           = $fact;
		}
		usort( $scored, function ( $a, $b ) {
			return $b['matchScore'] === $a['matchScore'] ? strcmp( $a['factId'], $b['factId'] ) : $b['matchScore'] - $a['matchScore'];
		} );
		$picked    = array();
		$per_field = array();
		$matched_n = 0;
		foreach ( $scored as $fact ) {
			$is_match = $fact['prefScore'] > 0;
			if ( $any_pref && ! $is_match && count( $picked ) >= self::DEEP_MIN_FACTS ) {
				continue;
			}
			$per_field[ $fact['field'] ] = ( $per_field[ $fact['field'] ] ?? 0 ) + 1;
			if ( $per_field[ $fact['field'] ] > 2 ) {
				continue;
			}
			$picked[]   = $fact;
			$matched_n += $is_match ? 1 : 0;
			if ( count( $picked ) >= self::DEEP_MAX_FACTS ) {
				break;
			}
		}
		if ( count( $picked ) < self::DEEP_MIN_FACTS ) {
			$reasons[] = 'RISE has ' . count( $scored ) . ' usable deep fact(s) for this program and these preferences; Deep needs at least ' . self::DEEP_MIN_FACTS . '.';
			return array( 'tierEffective' => 'DEEP_RESEARCH_NEEDED', 'allowedFacts' => $essential, 'studentFacts' => $student, 'deepNeeded' => true, 'reasons' => $reasons, 'deepCandidates' => $picked );
		}
		return array( 'tierEffective' => 'DEEP', 'allowedFacts' => array_merge( $essential, $picked ), 'studentFacts' => $student, 'deepNeeded' => false, 'reasons' => array( 'Deep uses identity facts plus ' . count( $picked ) . ' verified RISE details' . ( $any_pref ? ' (' . $matched_n . ' matched your preferences)' : '' ) . '.' ) );
	}
}
