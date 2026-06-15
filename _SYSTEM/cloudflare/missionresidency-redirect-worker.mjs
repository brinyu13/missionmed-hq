const LEGACY_HOSTS = new Set([
  'missionresidency.com',
  'www.missionresidency.com',
]);

const DEFAULT_REDIRECT_TARGET = 'https://missionmedinstitute.com/mission-residency/';
const DEFAULT_REDIRECT_STATUS = 301;
const SENTINEL_KEY = 'legacy_redirect';
const SENTINEL_VALUE = 'missionresidency';

function resolveRedirectStatus(env) {
  const rawStatus = Number(env && env.REDIRECT_STATUS ? env.REDIRECT_STATUS : DEFAULT_REDIRECT_STATUS);
  return rawStatus === 302 ? 302 : 301;
}

function buildRedirectTarget(sourceUrl, env) {
  const target = new URL(
    env && env.REDIRECT_TARGET ? env.REDIRECT_TARGET : DEFAULT_REDIRECT_TARGET
  );

  sourceUrl.searchParams.forEach((value, key) => {
    if (key.toLowerCase() !== SENTINEL_KEY) {
      target.searchParams.append(key, value);
    }
  });

  target.searchParams.set(SENTINEL_KEY, SENTINEL_VALUE);
  return target;
}

export default {
  async fetch(request, env) {
    const sourceUrl = new URL(request.url);
    const host = sourceUrl.hostname.toLowerCase();

    if (!LEGACY_HOSTS.has(host)) {
      return fetch(request);
    }

    const status = resolveRedirectStatus(env);
    const target = buildRedirectTarget(sourceUrl, env);

    return new Response(null, {
      status,
      headers: {
        Location: target.toString(),
        'Cache-Control': status === 301 ? 'public, max-age=3600' : 'no-store',
        'X-MissionMed-Redirect': 'missionresidency-to-missionmed',
      },
    });
  },
};
