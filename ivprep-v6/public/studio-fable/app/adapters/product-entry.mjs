// Preserve bookmarked deep-capability routes when the product entry mounts Fable.
// This is navigation only: admission and actor/subject authority remain in HQ.
const LEGACY_VIEWS = new Set(['newsession', 'devicecheck', 'training', 'simulation',
  'postanswer', 'filmroom', 'compare', 'lab', 'mentor', 'governance', 'fingerprint', 'vault']);
const ENTRY_PATHS = new Set(['/iv-prep-on-call/', '/iv-prep-on-call/candidate/',
  '/iv-prep-on-call', '/iv-prep-on-call/candidate']);

export function legacyPresentationEntry(pathname, hash) {
  if (!ENTRY_PATHS.has(pathname) || typeof hash !== 'string' || hash.length > 2048
    || !hash.startsWith('#') || hash.startsWith('#/')) return null;
  const view = hash.slice(1).split('?')[0];
  return LEGACY_VIEWS.has(view) ? '/iv-prep-on-call/advanced/' + hash : null;
}
