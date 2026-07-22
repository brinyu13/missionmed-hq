export function isMmcAssignmentEffective(assignment, nowInput) {
  if (!assignment || typeof assignment !== 'object' || assignment.state !== 'ACTIVE') return false;

  const now = dateValue(nowInput);
  const startedAt = dateValue(assignment.startedAt);
  if (!Number.isFinite(now) || !Number.isFinite(startedAt) || startedAt > now) return false;

  if (assignment.expiresAt === null) return true;
  const expiresAt = dateValue(assignment.expiresAt);
  return Number.isFinite(expiresAt) && expiresAt > now;
}

function dateValue(input) {
  if (input instanceof Date) return input.valueOf();
  if (typeof input !== 'string' || !input.trim()) return Number.NaN;
  return Date.parse(input);
}
