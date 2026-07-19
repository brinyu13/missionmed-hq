# Agent Disagreements and Corrections

1. **Decimal spacing versus canonical integers.** The first builder emitted a floating-point average. The canonical hasher rejected it. Resolution: exact numerator/denominator plus a fixed decimal string.
2. **Parsed SQL rows versus executable SQL.** Initial validation proved value serialization but missed a DDL/insert column mismatch. Independent review blocked acceptance. Resolution: add exact 40-column parity validation and make DDL plus inserts atomic.
3. **Synthetic versus existing artifact aliases.** Initial records used role-derived aliases. Resolution: preserve exact basename aliases from the restricted roster while keeping absolute locators out of exports.
4. **Aggregate versus per-row metadata validation.** Initial checks proved totals but not every copied confidence/status field. Resolution: reconstruct and compare all source metadata, provenance, receipts, aliases, and statuses for every record.
5. **Medical `RETAINED` semantics.** Resolution: explicitly define it as occurrence retention only and record that medical approval was not performed.
