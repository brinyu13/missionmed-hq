export function consolidateAttendanceFragments(rows) {
  const events = new Map();
  const seenSourceIds = new Set();
  for (const row of rows) {
    if (seenSourceIds.has(row.provider_source_id)) continue;
    seenSourceIds.add(row.provider_source_id);
    const key = `${row.student_id}:${row.session_id}`;
    const event = events.get(key) || {
      idempotency_key: key,
      student_id: row.student_id,
      session_id: row.session_id,
      source_row_ids: [],
      joined_at: row.joined_at,
      left_at: row.left_at,
    };
    event.source_row_ids.push(row.provider_source_id);
    if (row.joined_at && (!event.joined_at || row.joined_at < event.joined_at)) event.joined_at = row.joined_at;
    if (row.left_at && (!event.left_at || row.left_at > event.left_at)) event.left_at = row.left_at;
    events.set(key, event);
  }
  return [...events.values()];
}
