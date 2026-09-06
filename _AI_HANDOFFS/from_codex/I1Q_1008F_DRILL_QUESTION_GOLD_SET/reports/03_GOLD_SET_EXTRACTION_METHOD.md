# Gold Set Extraction Method

## Contract and roster

The run binds predecessor `c8397c9c0eba9a6cffec16b926ec7e61a869fa5f`, the restricted execution decision, the accepted 1008E coverage and processing-ledger roots, the ordered 97-pair roster, the 070B runtime comparison hashes, and exact hashes for schemas, parsing, canonicalization, detector rules, boundary controls, and locking. The validated safe roster contains 105 positions: 97 transcript artifacts, 99 Nodes artifacts, 97 exact transcript/Nodes pairs, and two Nodes-only rows. Gold processing uses the 97 paired transcript positions and does not silently promote Nodes-only rows.

## No-copy source handling

The source reader opens one content-addressed transcript/Nodes pair inside the owner-only 1008E boundary, verifies both hashes, parses them with the validated 1008E parser, and releases the pair before advancing. It does not copy source files into 1008F. Concurrency is fixed at one; the minimum runtime reserve is 10 GiB; free space and boundary invariants are postflighted every four drills. The 1008F `raw/` directory must remain empty.

## Ordered state machine

Extraction follows the ticket state model:

1. Fail-closed exclusion of opening jumping-in exchanges.
2. Roster-backed detection of Dr. J calling a student, with controlled aliases and next-speaker confirmation for ambiguous ordinary-word names.
3. Capture of the first supported medical prompt as the sequence primary.
4. Binding of the responding learner span to that exact question.
5. Alternation of transcript-grounded Dr. J follow-up prompts and learner answer spans until a new student call or drill end.
6. Explicit closure of unresolved trailing material without invented text or answers.

Direct interrogatives, rapid-fire prompts, imperative medical prompts, and fragmented but unambiguous medical prompts are representable. Generic medical mentions, explanations, teaching statements, learner questions, administrative speech, attendance, greetings, banter, and jumping-in prompts cannot be promoted merely because they contain medical words or punctuation. Ambiguous actual prompts remain restricted and quarantined; ambiguity is not “fixed” by fabrication.

## Identity and provenance

Every drill, sequence, question, answer span, and shard has a deterministic content-derived identity. Every question has at least one transcript binding with integer-microsecond timestamps, record ordinal, code-point offsets, raw-record hash, text hash, and selected-text hash. Nodes may confirm a boundary but never substitute for transcript provenance. Ordered roots preserve drill, sequence, question, answer, and exclusion order; the order-insensitive 1008E Merkle helper is not reused for ordered evidence.

## Resume truth

Each drill is written as an owner-only canonical JSON shard, fsynced, re-read, hash-verified, and then journaled. The verified shard set is authoritative; the cursor is advisory. Resume validates the run contract and all existing shards, adopts a valid orphan deterministically, quarantines invalid or contract-drifted artifacts, and selects the smallest missing drill order. A false 97-completion claim is impossible without 97 valid positions.

## Safe projection

The Git-safe ledger contains only drill position, status, booleans, aggregate counts, duration, exact rational rates, and a safe-projection hash. The same projection hash is embedded in the restricted shard, enabling an integrity join without publishing source identities or content. A correlated leakage scan rejects wording, names, IDs, locators, paths, URLs, and restricted hashes before safe output is accepted.

## Accepted freeze

The accepted run contract is `de31610de045da1ea217a19dc4420e07c3deee9cf533482d3eeff301492d52ff`; the 97-shard set root is `4d906f3825cac5e8190bd8d379e512bcfb339fa2e4489a2bdceb7cd0eb7ff978`. A clean second invocation completed as a no-op. Nine failed or superseded generations remain quarantined with content-addressed receipts.
