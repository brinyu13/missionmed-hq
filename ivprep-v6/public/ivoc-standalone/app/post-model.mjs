/* Pure post-session projections. No DOM, network, account, or media access. */

const finite = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null;

export function tracePath(history = [], key, totalSeconds) {
  const total = Math.max(1, finite(totalSeconds) ?? 1);
  const commands = [];
  let open = false;
  let previousAt = null;
  for (const point of history) {
    const at = finite(point?.t);
    const value = finite(point?.[key]);
    if (at === null || value === null || previousAt !== null && at - previousAt > (key === 'pace' ? 6 : 1.2)) {
      open = false;
      previousAt = null;
      if (at === null || value === null) continue;
    }
    const x = Math.max(0, Math.min(100, at / total * 100));
    const y = 26 - Math.max(0, Math.min(1, value)) * 20;
    commands.push(`${open ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`);
    open = true;
    previousAt = at;
  }
  return commands.join(' ');
}

export function intervalRuns(history = [], selector, totalSeconds) {
  const total = Math.max(1, finite(totalSeconds) ?? 1);
  const runs = [];
  let current = null;
  for (const point of history) {
    const at = finite(point?.t);
    if (at === null) continue;
    const value = selector(point);
    if (!current || current.value !== value) {
      if (current) current.end = at;
      current = { value, start: at, end: at };
      runs.push(current);
    } else current.end = at;
  }
  return runs.map(run => ({
    ...run,
    left: Math.max(0, Math.min(100, run.start / total * 100)),
    width: Math.max(.35, Math.min(100, (run.end - run.start) / total * 100)),
  }));
}

export function selectLibrarySessions(sessions = [], { filter = 'all', query = '', sort = 'newest', scoreOf = () => ({}) } = {}) {
  const needle = String(query).trim().toLowerCase();
  const average = row => {
    const values = Object.values(scoreOf(row) || {}).map(finite).filter(value => value !== null);
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : -1;
  };
  return sessions
    .filter(row => filter === 'all'
      ? true
      : filter === 'reviewed'
        ? row.reviewStatus === 'reviewed'
        : filter === 'pending'
          ? row.reviewStatus !== 'reviewed'
          : row.sessionType === filter)
    .filter(row => !needle || `${row.title || ''} ${row.questionText || ''}`.toLowerCase().includes(needle))
    .slice()
    .sort((a, b) => sort === 'oldest'
      ? new Date(a.startedAt) - new Date(b.startedAt)
      : sort === 'score'
        ? average(b) - average(a)
        : new Date(b.startedAt) - new Date(a.startedAt));
}

export function selectMentorSessions(sessions = [], { filter = 'pending', query = '' } = {}) {
  const needle = String(query).trim().toLowerCase();
  return sessions
    .filter(row => filter === 'all' ? true : filter === 'reviewed' ? row.reviewStatus === 'reviewed' : row.reviewStatus !== 'reviewed')
    .filter(row => !needle || `${row.title || ''} ${row.studentName || ''} ${row.questionText || ''}`.toLowerCase().includes(needle));
}
