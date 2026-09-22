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

	/** One simple, ordered student preference model. */
	public static function core_factors() {
		return array(
			'clinical_training'          => array( 'label' => 'Clinical Training & Experience', 'evidence' => array( 'curriculum', 'differentiator' ), 'legacy' => array( 'curriculum' ) ),
			'fellowship_career'          => array( 'label' => 'Fellowship / Career Goals', 'evidence' => array( 'fellowship', 'curriculum' ), 'legacy' => array( 'fellowship' ) ),
			'mentorship_teaching'        => array( 'label' => 'Mentorship & Teaching', 'evidence' => array( 'teaching', 'curriculum', 'differentiator' ), 'legacy' => array( 'teaching' ) ),
			'research_academics'         => array( 'label' => 'Research & Academics', 'evidence' => array( 'research' ), 'legacy' => array( 'research' ) ),
			'location_community'         => array( 'label' => 'Location & Community', 'evidence' => array( 'population', 'mission', 'differentiator' ), 'legacy' => array() ),
			'culture_environment'        => array( 'label' => 'Program Culture / Size / Environment', 'evidence' => array( 'mission', 'differentiator', 'curriculum' ), 'legacy' => array( 'other' ) ),
			'patient_population_mission' => array( 'label' => 'Patient Population / Mission', 'evidence' => array( 'population', 'mission' ), 'legacy' => array( 'population', 'mission' ) ),
			'lifestyle_practical'        => array( 'label' => 'Lifestyle / Schedule / Practical Fit', 'evidence' => array( 'curriculum', 'differentiator' ), 'legacy' => array() ),
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
		$out = array( 'schema' => 'missionmed.psv.preferences.v2', 'priorityProfile' => array(), 'categories' => array(), 'location' => array(), 'otherText' => '' );
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
		$seen = array();
		foreach ( array_slice( (array) ( $prefs['priorityProfile'] ?? array() ), 0, 8 ) as $entry ) {
			$key = sanitize_key( (string) ( $entry['key'] ?? '' ) );
			if ( isset( $seen[ $key ] ) || ! isset( self::core_factors()[ $key ] ) ) { continue; }
			$seen[ $key ] = true;
			$out['priorityProfile'][] = array(
				'key'     => $key,
				'label'   => self::core_factors()[ $key ]['label'],
				'details' => array_slice( array_values( array_filter( array_map( 'sanitize_text_field', (array) ( $entry['details'] ?? array() ) ) ) ), 0, 8 ),
				'note'    => mb_substr( sanitize_text_field( (string) ( $entry['note'] ?? '' ) ), 0, 200 ),
			);
		}
		// Migrate earlier saved preferences deterministically without losing them.
		if ( ! $out['priorityProfile'] ) {
			foreach ( self::core_factors() as $key => $factor ) {
				$details = array(); $note = '';
				foreach ( $factor['legacy'] as $legacy ) {
					if ( ! empty( $out['categories'][ $legacy ]['on'] ) ) {
						$details = array_merge( $details, $out['categories'][ $legacy ]['terms'] );
						$note = $note ?: $out['categories'][ $legacy ]['note'];
					}
				}
				if ( $details || $note || ( 'location_community' === $key && ! empty( $out['location']['on'] ) ) ) {
					$out['priorityProfile'][] = array( 'key' => $key, 'label' => $factor['label'], 'details' => array_values( array_unique( $details ) ), 'note' => $note );
				}
			}
		}
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
		foreach ( $prefs['priorityProfile'] as $rank => $factor ) {
			$student[] = array(
				'id'   => 'S-priority-' . ( $rank + 1 ) . '-' . $factor['key'],
				'text' => 'Priority ' . ( $rank + 1 ) . ': ' . $factor['label'] . ( $factor['details'] ? ' (' . implode( ', ', $factor['details'] ) . ')' : '' ) . ( $factor['note'] ? ': ' . $factor['note'] : '' ) . '.',
			);
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
			return array( 'tierEffective' => 'ESSENTIAL', 'allowedFacts' => $essential, 'studentFacts' => $student, 'deepNeeded' => false, 'reasons' => array( 'Essential uses verified identity facts only.' ), 'strongReasons' => array(), 'reasonInsufficient' => true );
		}

		/*
		 * Score deep facts. A preference match always outranks general quality.
		 * A fellowship is usable ONLY when the student named it: a fellowship the
		 * student did not ask for is not a reason for this student.
		 * Facts that match no selected preference are not reasons and never pad the paragraph.
		 */
		$core = self::core_factors();
		$any_pref = ! empty( $prefs['priorityProfile'] );
		$scored = array();
		foreach ( (array) $bundle['deepFacts'] as $fact ) {
			$pref             = 0;
			$matched          = '';
			$matched_rank     = PHP_INT_MAX;
			$fellowship_named = false;
			foreach ( $prefs['priorityProfile'] as $rank => $factor ) {
				$key = $factor['key'];
				$in_category = in_array( $fact['category'], $core[ $key ]['evidence'], true );
				foreach ( $factor['details'] as $term ) {
					if ( self::term_matches( $term, $fact['text'] ) ) {
						$pref   += $in_category ? 5 : 2;
						$matched = $key . ':' . $term;
						$matched_rank = min( $matched_rank, $rank );
						if ( 'fellowship_career' === $key ) {
							$fellowship_named = true;
						}
					}
				}
				if ( $in_category && 'fellowship_career' !== $key ) {
					$pref += 4;
					$matched = $matched ?: $key;
					$matched_rank = min( $matched_rank, $rank );
				}
			}
			if ( 'fellowship' === $fact['category'] && ! $fellowship_named ) {
				continue;
			}
			$source_url = (string) ( $fact['provenance']['itemSource'] ?? $fact['provenance']['sourceUrl'] ?? '' );
			$quality  = 0 === strpos( $source_url, 'https://' ) ? 2 : 0;
			$quality += ! empty( $fact['provenance']['fresh'] ) ? 1 : 0;
			$quality += preg_match( '/[A-Z][a-z]+ [A-Z][a-z]+|\d/', $fact['text'] ) ? 1 : 0;   // named or quantified beats vague
			$quality -= preg_match( '/\b(excellent|outstanding|world-class|top-ranked|prestigious|renowned|state-of-the-art|cutting-edge|supportive|collegial|family-like)\b/i', $fact['text'] ) ? 3 : 0;
			$specific = mb_strlen( (string) $fact['text'] ) >= 35 && ! preg_match( '/\b(strong training|diverse opportunities|broad exposure|supportive environment|excellent education)\b/i', (string) $fact['text'] );
			if ( $quality < 2 || ! $specific || $matched_rank === PHP_INT_MAX ) {
				continue;                                   // Brochure language is not evidence.
			}
			$fact['prefScore']  = $pref;
			$fact['priorityRank'] = $matched_rank + 1;
			$fact['matchScore'] = ( 100 - ( $matched_rank * 10 ) ) + $pref + $quality + ( 'differentiator' === $fact['category'] ? 1 : 0 );
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
			return array( 'tierEffective' => 'DEEP_RESEARCH_NEEDED', 'allowedFacts' => $essential, 'studentFacts' => $student, 'deepNeeded' => true, 'reasons' => $reasons, 'deepCandidates' => $picked, 'strongReasons' => $picked, 'reasonInsufficient' => true );
		}
		return array( 'tierEffective' => 'DEEP', 'allowedFacts' => array_merge( $essential, $picked ), 'studentFacts' => $student, 'deepNeeded' => false, 'reasons' => array( 'Deep uses identity facts plus ' . count( $picked ) . ' strong verified RISE reason' . ( 1 === count( $picked ) ? '' : 's' ) . ' in your priority order.' ), 'strongReasons' => $picked, 'reasonInsufficient' => count( $picked ) < 3 );
	}
}
