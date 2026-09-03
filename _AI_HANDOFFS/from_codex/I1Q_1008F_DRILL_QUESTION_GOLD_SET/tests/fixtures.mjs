import { sha256, stableHash } from '../tools/canonical.mjs';

export function record(record_ordinal, start_us, speaker, text, end_us = start_us + 1_000_000) {
  return { record_ordinal, start_us, end_us, speaker, text, raw_record_hash: stableHash({ record_ordinal, start_us, speaker, text }), text_hash: sha256(text) };
}

export const transcript = [
  record(0, 0, 'Dr. J', 'Jumping in: what is the diagnosis?'),
  record(1, 1_000_000, 'Student One', 'A learner response.'),
  record(2, 2_000_000, 'Dr. J', 'Okay, Alice: what heart disease causes this? Which medication treats it?'),
  record(3, 2_500_000, 'Alice Smith', 'First answer.'),
  record(4, 3_000_000, 'Dr. J', 'How would you manage the patient?'),
  record(5, 3_500_000, 'Alice Smith', 'Second answer mentioning Bob.'),
  record(6, 4_000_000, 'Dr. J', 'Bob, open slide five.'),
  record(7, 5_000_000, 'Dr. J', 'Bob, what renal disease causes pain?'),
  record(8, 5_500_000, 'Bob Jones', 'Third answer.'),
  record(9, 6_000_000, 'Dr. J', 'This teaching statement is about anatomy.'),
  record(10, 7_000_000, 'Alice Smith', 'What page are we on?'),
];

export const row = {
  drill_order: 1,
  predecessor_roster_position: 1,
  source_alias: 'source_opaque_001',
  transcript_sha256: '1'.repeat(64),
  nodes_sha256: '2'.repeat(64),
};

export const contractHash = '3'.repeat(64);
