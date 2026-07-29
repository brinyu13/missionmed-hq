import { TimelineApiClient } from "./timeline-api-client.js";
import { HybridIndexedDbAdapter } from "./hybrid-indexeddb-adapter.js";

const state = { mounted: false, adapter: null, root: null, links: [] };

function absoluteAssetUrls(container, assetBase) {
  container.querySelectorAll("[src]").forEach((node) => {
    const value = node.getAttribute("src");
    if (value && !/^(?:data:|https?:|\/)/.test(value)) node.setAttribute("src", new URL(value, assetBase).href);
  });
}

function addStylesheet(href, marker) {
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  link.dataset.timelineAppMode = marker;
  document.head.append(link);
  state.links.push(link);
}

function toolbar(returnUrl) {
  const bar = document.createElement("div");
  bar.className = "timeline-appmode-bar";
  bar.innerHTML = `
    <button type="button" class="timeline-appmode-return" aria-label="Return to Matrix dashboard">RETURN TO MATRIX</button>
    <span class="timeline-appmode-label">MISSION TIMELINE APP MODE</span>
    <span class="timeline-appmode-sync" role="status" aria-live="polite">LOCAL READY</span>
  `;
  bar.querySelector("button").addEventListener("click", () => location.assign(returnUrl));
  return bar;
}

export async function mountMissionTimelineAppMode({
  root,
  assetBase = "/timeline/",
  apiBase = "/api/timeline/v1",
  timelineToken = null,
  programId = null,
  returnUrl = "/",
} = {}) {
  if (state.mounted) throw new Error("MISSION_TIMELINE_ALREADY_MOUNTED");
  if (!(root instanceof HTMLElement)) throw new Error("MISSION_TIMELINE_ROOT_REQUIRED");
  const base = new URL(assetBase, location.href);
  const response = await fetch(new URL("index.html", base));
  if (!response.ok) throw new Error(`MISSION_TIMELINE_ASSET_LOAD_FAILED:${response.status}`);
  const parsed = new DOMParser().parseFromString(await response.text(), "text/html");
  parsed.querySelectorAll("script").forEach((script) => script.remove());
  const fragment = document.createDocumentFragment();
  [...parsed.body.children].forEach((node) => fragment.append(node));
  absoluteAssetUrls(fragment, base);

  state.root = root;
  root.replaceChildren(toolbar(returnUrl), fragment);
  root.classList.add("mission-timeline-appmode-root");
  document.body.classList.add("mission-timeline-appmode-active");
  addStylesheet(new URL("styles.css", base).href, "application");
  addStylesheet(new URL("timeline-app-mode.css", import.meta.url).href, "host");

  const statusNode = root.querySelector(".timeline-appmode-sync");
  const client = new TimelineApiClient({ apiBase, token: timelineToken });
  const adapter = new HybridIndexedDbAdapter({
    apiClient: client,
    programId,
    onStatus: ({ state: syncState, pending = 0 }) => {
      if (statusNode) statusNode.textContent = `${syncState.replaceAll("_", " ")}${pending ? ` · ${pending}` : ""}`;
    },
  });
  state.adapter = adapter;
  window.D1_ASSET_BASE = base.href;
  window.D1_PERSISTENCE_ADAPTER = adapter;
  window.MMEDTimeline = {
    version: "412.0.0-rc.0",
    mode: "MATRIX_APP_MODE",
    sourceAuthority: "D1_410_RELEASE_CANDIDATE",
    sync: () => adapter.flush(),
    get syncState() { return statusNode?.textContent ?? "UNKNOWN"; },
  };
  state.mounted = true;
  await import(`${new URL("js/app.js", base).href}?matrixAppMode=412`);
  return window.MMEDTimeline;
}

export async function unmountMissionTimelineAppMode() {
  if (!state.mounted) return;
  await state.adapter?.flush().catch(() => {});
  state.adapter?.close();
  delete window.D1_PERSISTENCE_ADAPTER;
  delete window.D1_ASSET_BASE;
  delete window.MMEDTimeline;
  state.links.forEach((link) => link.remove());
  state.links = [];
  state.root?.replaceChildren();
  state.root?.classList.remove("mission-timeline-appmode-root");
  document.body.classList.remove("mission-timeline-appmode-active");
  state.adapter = null;
  state.root = null;
  state.mounted = false;
}
