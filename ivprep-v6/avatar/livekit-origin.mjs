const LIVEAVATAR_LIVEKIT_HOST = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.livekit\.cloud$/u;

export function validatedLiveAvatarLiveKitOrigin(value) {
  let url;
  try { url = new URL(String(value || '').trim()); }
  catch { throw new TypeError('LiveAvatar returned an invalid media signaling endpoint.'); }
  if (
    url.protocol !== 'wss:'
    || url.username
    || url.password
    || url.port
    || url.pathname !== '/'
    || url.search
    || url.hash
    || !LIVEAVATAR_LIVEKIT_HOST.test(url.hostname)
  ) throw new TypeError('LiveAvatar returned an unapproved media signaling endpoint.');
  return url.origin;
}

export function providerOriginMatchesConfigured(providerValue, configuredValue) {
  if (!configuredValue) return false;
  return validatedLiveAvatarLiveKitOrigin(providerValue) === validatedLiveAvatarLiveKitOrigin(configuredValue);
}
