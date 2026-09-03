import { createHash } from 'node:crypto';

import { admissionRegistry } from './admission-registry.mjs';

const DOMAIN = 'missionmed.ivprep.hq-cookie.v1\0';

export function fingerprintIvPrepHqCookie(decodedCookieToken) {
  const token = String(decodedCookieToken || '');
  if (!token || token.length > 32_768) return null;
  return createHash('sha256').update(DOMAIN).update(token).digest('hex');
}

export function recordIvPrepHqLogout({ cookieFingerprint, reason = 'hq_logout' } = {}) {
  if (!cookieFingerprint) return Object.freeze({ recorded: false, ignored: true });
  try {
    return Object.freeze(admissionRegistry.recordLogout({ cookieFingerprint, reason }));
  } catch {
    admissionRegistry.enterFailClosed();
    return Object.freeze({ recorded: false, failClosed: true });
  }
}
