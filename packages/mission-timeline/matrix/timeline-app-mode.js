const state = { mounted: false, returnUrl: null, targetUrl: null };
const RETURN_TO_MATRIX_LABEL = "RETURN TO MATRIX";

function sameOriginUrl(value, fallback) {
  const url = new URL(value || fallback, location.href);
  if (url.origin !== location.origin) throw new Error("MISSION_TIMELINE_CROSS_ORIGIN_ROUTE_DENIED");
  return url;
}

function canonicalTimelineUrl(assetBase, returnUrl) {
  const target = sameOriginUrl(assetBase, "/timeline/");
  const back = sameOriginUrl(returnUrl, "/");
  target.searchParams.set("matrixAppMode", "local");
  target.searchParams.set("returnUrl", `${back.pathname}${back.search}${back.hash}`);
  return { target, back };
}

export async function mountMissionTimelineAppMode({
  root,
  assetBase = "/timeline/",
  returnUrl = "/",
} = {}) {
  if (state.mounted) throw new Error("MISSION_TIMELINE_ALREADY_MOUNTED");
  if (!(root instanceof HTMLElement)) throw new Error("MISSION_TIMELINE_ROOT_REQUIRED");

  const route = canonicalTimelineUrl(assetBase, returnUrl);
  state.mounted = true;
  state.returnUrl = route.back.href;
  state.targetUrl = route.target.href;
  window.MMEDTimeline = {
    version: "413.0.0-rc.0",
    mode: "MATRIX_APP_MODE_LAUNCHING",
    sourceAuthority: "D1_407F_CURRENT_APP",
    targetUrl: route.target.href,
    returnActionLabel: RETURN_TO_MATRIX_LABEL,
  };
  location.assign(route.target.href);
  return window.MMEDTimeline;
}

export async function unmountMissionTimelineAppMode() {
  if (!state.mounted) return;
  const returnUrl = state.returnUrl;
  state.mounted = false;
  state.returnUrl = null;
  state.targetUrl = null;
  delete window.MMEDTimeline;
  if (returnUrl) location.assign(returnUrl);
}
