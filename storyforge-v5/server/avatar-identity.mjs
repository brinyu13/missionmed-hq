const explicitlyOff = new Set(['0', 'false', 'no', 'off']);
const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const arenaCdnOrigin = 'https://cdn.missionmedinstitute.com';

function forceOff(environment) {
  const value = String(environment?.STORYFORGE_AVATAR_IDENTITY_FORCE_OFF ?? '')
    .trim()
    .toLowerCase();
  return !explicitlyOff.has(value);
}

function safeAssetUrl(value) {
  const candidate = typeof value === 'string' ? value : '';
  if (!candidate) return '';
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === 'https:'
      && parsed.origin === arenaCdnOrigin
      && parsed.username === ''
      && parsed.password === ''
      && parsed.search === ''
      && parsed.hash === ''
      && parsed.pathname.length > 1
      && parsed.href === candidate
      ? candidate
      : '';
  } catch {
    return '';
  }
}

function firstName(identity) {
  if (typeof identity?.firstName === 'string' && identity.firstName.trim()) {
    return identity.firstName.trim();
  }
  if (typeof identity?.name === 'string' && identity.name.trim()) {
    return identity.name.trim().split(/\s+/u)[0];
  }
  return '';
}

function initials(identity, resolvedFirstName) {
  const source = resolvedFirstName
    || (typeof identity?.name === 'string' ? identity.name.trim() : '')
    || (typeof identity?.username === 'string' ? identity.username.trim() : '');
  const parts = source.split(/\s+/u).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '?';
}

export function resolveAvatarIdentity(identity, {
  enabled = false,
  environment = process.env,
} = {}) {
  const resolvedFirstName = firstName(identity);
  const fallback = Object.freeze({
    available: false,
    source: 'initials',
    firstName: resolvedFirstName,
    initials: initials(identity, resolvedFirstName),
    headshotUrl: null,
    fullBodyUrl: null,
    activeAvatarId: null,
  });

  if (!enabled || forceOff(environment)) return fallback;

  const activeAvatarId = String(identity?.activeAvatarId || '');
  const headshotUrl = safeAssetUrl(identity?.avatarThumbnailUrl);
  const fullBodyUrl = safeAssetUrl(identity?.avatarUrl);
  if (!uuidPattern.test(activeAvatarId) || !headshotUrl) return fallback;

  return Object.freeze({
    available: true,
    source: 'arena_lobby',
    firstName: resolvedFirstName,
    initials: fallback.initials,
    headshotUrl,
    fullBodyUrl: fullBodyUrl || null,
    activeAvatarId,
  });
}

export function createAvatarIdentityService({
  withIdentity,
  environment = process.env,
} = {}) {
  if (typeof withIdentity !== 'function') throw new TypeError('withIdentity must be supplied.');

  return Object.freeze({
    async resolve(identity) {
      if (forceOff(environment)) return resolveAvatarIdentity(identity, { environment });
      let enabled = false;
      try {
        enabled = await withIdentity(identity, async (client) => {
          const result = await client.query(
            "SELECT public.sf_story_feature_enabled('avatar_identity', ARRAY['student','mentor','admin']) AS enabled",
          );
          return result.rows[0]?.enabled === true;
        });
      } catch {
        // Availability is optional and default-off. Database/configuration failure
        // must degrade to initials rather than affecting StoryForge access.
        enabled = false;
      }
      return resolveAvatarIdentity(identity, { enabled, environment });
    },
  });
}
