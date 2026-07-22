const ADMIN_ROLES = new Set(['administrator', 'admin', 'hq_admin']);
const OPERATOR_ROLES = new Set(['hq_operator', 'operator']);

/**
 * Reduce an already authenticated WordPress user to the least-privileged MMC
 * role understood by the CAM v2 principal issuer. Route authorization remains
 * a separate decision; this function must never promote an operator to admin.
 */
export function resolveMmcAuthenticatedRole(user = {}) {
  const roles = new Set((Array.isArray(user?.roles) ? user.roles : [])
    .filter((role) => typeof role === 'string')
    .map((role) => role.trim().toLowerCase())
    .filter(Boolean));

  if (user?.capabilities?.manage_options === true || intersects(roles, ADMIN_ROLES)) {
    return 'admin';
  }
  if (intersects(roles, OPERATOR_ROLES)) {
    return 'operator';
  }
  return 'mentor';
}

function intersects(left, right) {
  for (const value of left) {
    if (right.has(value)) return true;
  }
  return false;
}
