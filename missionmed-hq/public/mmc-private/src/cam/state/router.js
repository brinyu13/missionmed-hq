const BASE = '/mmc-private';
const STUDENT_VIEWS = new Set(['overview', 'plan', 'history', 'files', 'prep']);

export function parseRoute(locationLike = window.location) {
  const pathname = normalizePath(locationLike.pathname);
  const segments = pathname.slice(BASE.length).split('/').filter(Boolean).map(decodeSegment);
  const search = new URLSearchParams(locationLike.search || '');

  if (pathname === BASE || pathname === `${BASE}/`) {
    return route('today', 'Today', 'today', '/api/mmc/v2/mentor/today', {}, search, `${BASE}/today`);
  }
  if (segments.length === 1 && segments[0] === 'today') {
    return route('today', 'Today', 'today', '/api/mmc/v2/mentor/today', {}, search);
  }
  if (segments.length === 1 && segments[0] === 'students') {
    return route('students', 'Students', 'students', '/api/mmc/v2/mentor/students', {}, search);
  }
  if (segments[0] === 'students' && segments[1]) {
    const studentId = segments[1];
    const view = segments[2] || 'overview';
    if (!STUDENT_VIEWS.has(view)) return notFound(search);
    if (view === 'history' && segments[3] === 'sessions' && segments[4] && segments.length === 5) {
      return route('student-session-detail', 'Session detail', 'students',
        `/api/mmc/v2/mentor/students/${encodeURIComponent(studentId)}/history/sessions/${encodeURIComponent(segments[4])}`, {
        studentId,
        sessionId: segments[4],
        view,
      }, search);
    }
    if (segments.length !== 3 && !(segments.length === 2 && view === 'overview')) return notFound(search);
    return route(`student-${view}`, studentViewTitle(view), 'students', endpointForStudent(studentId, view), {
      studentId,
      view,
    }, search);
  }
  if (segments[0] === 'sessions' && segments[1] && ['live', 'review'].includes(segments[2]) && segments.length === 3) {
    const mode = segments[2];
    return route(`session-${mode}`, mode === 'live' ? 'Live session' : 'Post-session review', 'students',
      `/api/mmc/v2/mentor/sessions/${encodeURIComponent(segments[1])}/${mode}`, {
        sessionId: segments[1],
        mode,
      }, search);
  }
  if (segments.length === 1 && segments[0] === 'work') {
    return route('work', 'Work', 'work', '/api/mmc/v2/mentor/work', {}, search);
  }
  if (segments[0] === 'reviews' && segments.length <= 3) {
    const queueKind = normalizeRouteKey(segments[1]);
    const reviewId = segments[2] || null;
    return route('reviews', 'Reviews', 'reviews', endpointWithSegments('/api/mmc/v2/mentor/reviews', queueKind, reviewId), {
      queueKind,
      reviewId,
    }, search);
  }
  if (segments[0] === 'operations' && segments.length <= 3) {
    const area = normalizeRouteKey(segments[1]);
    const itemId = segments[2] || null;
    return route('operations', 'Operations', 'operations', endpointWithSegments('/api/mmc/v2/mentor/operations', area, itemId), {
      area,
      itemId,
    }, search);
  }
  return notFound(search);
}

export function navigate(href, options = {}) {
  const url = new URL(href, window.location.origin);
  if (url.origin !== window.location.origin || !url.pathname.startsWith(BASE)) {
    throw new Error('CAM navigation is restricted to the private same-origin route family.');
  }
  window.history[options.replace ? 'replaceState' : 'pushState'](options.state || {}, '', `${url.pathname}${url.search}${url.hash}`);
  window.dispatchEvent(new CustomEvent('cam:navigate', { detail: { focus: options.focus !== false } }));
}

export function isCamLink(anchor) {
  if (!anchor || anchor.target || anchor.hasAttribute('download')) return false;
  const href = anchor.getAttribute('href');
  if (!href || href.startsWith('#')) return false;
  try {
    const url = new URL(href, window.location.origin);
    return url.origin === window.location.origin && url.pathname.startsWith(BASE);
  } catch {
    return false;
  }
}

function route(name, title, navKey, endpoint, params, search, canonicalPath = null) {
  return Object.freeze({ name, title, navKey, endpoint, params: Object.freeze(params), search, canonicalPath });
}

function notFound(search) {
  return route('not-found', 'Page unavailable', null, null, {}, search);
}

function endpointForStudent(studentId, view) {
  return `/api/mmc/v2/mentor/students/${encodeURIComponent(studentId)}/${view}`;
}

function endpointWithSegments(base, ...segments) {
  const present = segments.filter((segment) => segment !== null && segment !== undefined && segment !== '');
  return present.length ? `${base}/${present.map((segment) => encodeURIComponent(segment)).join('/')}` : base;
}

function normalizeRouteKey(value) {
  return value ? String(value).trim().toLocaleLowerCase() : null;
}

function normalizePath(pathname) {
  const value = String(pathname || BASE).replace(/\/{2,}/gu, '/').replace(/\/+$/u, '');
  return value || BASE;
}

function decodeSegment(segment) {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function studentViewTitle(view) {
  return ({ overview: 'Student overview', plan: 'Student plan', history: 'Student history', files: 'Student files', prep: 'Call prep' })[view];
}
