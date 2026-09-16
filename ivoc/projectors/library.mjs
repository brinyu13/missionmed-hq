export function projectLibrary(sessions, { subjectId, query = '', sort = 'newest' } = {}) {
  if (!Array.isArray(sessions) || !subjectId) throw new TypeError('sessions and subjectId are required');
  const needle = query.trim().toLowerCase();
  const items = sessions.filter((session) => session.subject_id === subjectId).map((session) => ({
    session_id: session.session_id,
    occurred_at: session.updated_at,
    practice_goal: session.practice_goal,
    program: session.program_name ?? 'Program not selected',
    questions: session.question_count ?? 0,
    duration_ms: session.duration_ms ?? null,
    review_state: session.review_state ?? 'not_reviewed',
    match_bridge_state: session.match_bridge_state ?? 'not_shared',
    result_ref: session.result_ref ?? null,
    media_ref: session.media_ref ?? null,
  })).filter((item) => !needle || `${item.practice_goal} ${item.program} ${item.review_state}`.toLowerCase().includes(needle));
  items.sort((left, right) => sort === 'oldest' ? left.occurred_at.localeCompare(right.occurred_at) : right.occurred_at.localeCompare(left.occurred_at));
  return Object.freeze({ schema: 'ivoc.library.v1', subject_id: subjectId, items });
}
