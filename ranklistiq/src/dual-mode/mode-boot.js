(function modeBootModule(root, factory) {
  var api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.RLQ_DUAL = Object.assign(root.RLQ_DUAL || {}, api);
})(typeof window !== "undefined" ? window : null, function buildModeBoot(root) {
  "use strict";

  var MODE_KEY = "mm_ranklistiq_mode_v1";
  var VALID_MODES = ["application", "rank"];

  function validMode(value) {
    return VALID_MODES.indexOf(String(value || "").toLowerCase()) !== -1;
  }

  function resolveMode(input) {
    var queryMode = input && input.queryMode;
    var storedMode = input && input.storedMode;
    if (validMode(queryMode)) return { mode: String(queryMode).toLowerCase(), source: "query", selectorRequired: false };
    if (validMode(storedMode)) return { mode: String(storedMode).toLowerCase(), source: "storage", selectorRequired: false };
    return { mode: "rank", source: "selector", selectorRequired: true };
  }

  function queryMode(locationLike) {
    try {
      return new URLSearchParams(locationLike.search || "").get("mode");
    } catch (_error) {
      return null;
    }
  }

  function storedMode(storage) {
    try {
      return storage ? storage.getItem(MODE_KEY) : null;
    } catch (_error) {
      return null;
    }
  }

  function urlForMode(locationLike, mode) {
    var url = new URL(locationLike.href);
    url.searchParams.set("mode", mode);
    return url.toString();
  }

  var resolved = root
    ? resolveMode({ queryMode: queryMode(root.location), storedMode: storedMode(root.localStorage) })
    : resolveMode({});

  function applyBodyClass() {
    if (!root || !root.document || !root.document.body) return;
    root.document.body.classList.remove("rlq-mode-rank", "rlq-mode-application");
    root.document.body.classList.add("rlq-mode-" + resolved.mode);
  }

  function chooseMode(mode) {
    if (!root || !validMode(mode)) return false;
    root.localStorage.setItem(MODE_KEY, mode);
    root.location.assign(urlForMode(root.location, mode));
    return true;
  }

  function requestSelector() {
    if (!root) return false;
    root.localStorage.removeItem(MODE_KEY);
    var url = new URL(root.location.href);
    url.searchParams.delete("mode");
    root.location.assign(url.toString());
    return true;
  }

  if (root && root.document) {
    if (root.document.readyState === "loading") root.document.addEventListener("DOMContentLoaded", applyBodyClass, { once: true });
    else applyBodyClass();
  }

  return {
    MODE_KEY: MODE_KEY,
    mode: resolved.mode,
    modeSource: resolved.source,
    selectorRequired: resolved.selectorRequired,
    resolveMode: resolveMode,
    urlForMode: urlForMode,
    chooseMode: chooseMode,
    requestSelector: requestSelector,
    isApplication: function isApplication() { return resolved.mode === "application"; }
  };
});

