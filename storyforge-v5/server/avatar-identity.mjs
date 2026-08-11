const explicitlyOff = new Set(['0', 'false', 'no', 'off']);

function forceOff(environment) {
  const value = String(environment?.STORYFORGE_AVATAR_IDENTITY_FORCE_OFF ?? '')
    .trim()
    .toLowerCase();
  return !explicitlyOff.has(value);
}

function origin(value) {
  try {
    const parsed = new URL(String(value || ''));
    return parsed.protocol === 'https:' || parsed.hostname === '127.0.0.1'
      ? parsed.origin
      : '';
  } catch {
    return '';
  }
}

function allowedOrigins(environment) {
  const candidates = [
    environment?.STORYFORGE_PUBLIC_ORIGIN,
    ...String(environment?.STORYFORGE_AVATAR_ALLOWED_ORIGINS || '').split(','),
  ];
  return new Set(candidates.map(origin).filter(Boolean));
}

function safeAssetUrl(value, origins) {
  const candidate = typeof value === 'string' ? value.trim() : '';
  if (!candidate) return '';
  if (candidate.startsWith('/') && !candidate.startsWith('//')) return candidate;
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === 'https:' && origins.has(parsed.origin) ? parsed.href : '';
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

  const origins = allowedOrigins(environment);
  const headshotUrl = safeAssetUrl(identity?.avatarThumbnailUrl, origins);
  const fullBodyUrl = safeAssetUrl(identity?.avatarUrl, origins);
  if (!headshotUrl) return Object.freeze({ ...fallback, fullBodyUrl: fullBodyUrl || null });

  return Object.freeze({
    available: true,
    source: 'avatar_studio',
    firstName: resolvedFirstName,
    initials: fallback.initials,
    headshotUrl,
    fullBodyUrl: fullBodyUrl || null,
    activeAvatarId: identity?.activeAvatarId || null,
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
