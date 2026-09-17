# Priority Order Data Contract

Migration `016` adds explicit priority positions to the existing canonical My Programs rows; it does not create a parallel preference store.

Contract:

- positions are integer, contiguous, and unique within one student list;
- missing legacy positions are deterministically backfilled;
- a reorder is applied atomically;
- server validation rejects duplicates, omissions, foreign programs, and malformed lists;
- every successful administrator reorder emits a pseudonymous audit record;
- student save/star/status/note values are unchanged by reordering.

Live database readback after swap and restore showed 12 rows with priorities 1-12 and 12 distinct positions.

