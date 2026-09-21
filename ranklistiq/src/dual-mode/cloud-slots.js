(function cloudSlotsModule(root, factory) {
  var api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.RLQ_DUAL = Object.assign(root.RLQ_DUAL || {}, api);
})(typeof window !== "undefined" ? window : null, function buildCloudSlots(root) {
  "use strict";

  var state = { status: "idle", envelope: null };

  function deepClone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function isInteractiveEnvelope(payload) {
    return !!(payload && payload.ranklist_snapshot && payload.ranklist_snapshot.snapshot && payload.ranklist_snapshot.snapshot.kind === "missionmed_ranklist_interactive_share");
  }

  function onCloudEnvelope(envelope) {
    if (envelope && typeof envelope === "object" && Object.keys(envelope).length) {
      state.status = "loaded";
      state.envelope = deepClone(envelope);
    } else {
      state.status = "empty";
      state.envelope = null;
    }
    return state;
  }

  function markCloudFailure() {
    state.status = "failed";
    state.envelope = null;
    return state;
  }

  function parseLocal(raw) {
    if (!raw) return null;
    try {
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch (_error) {
      return null;
    }
  }

  function findLocalWorkspace(mode, storageApi, storageLike) {
    if (!storageApi || !storageLike) return null;
    var suffix = mode === "application" ? storageApi.APP_SUFFIX : "";
    for (var index = 0; index < storageLike.length; index += 1) {
      var key = storageLike.key(index);
      if (typeof key !== "string" || key.indexOf("ranklistiq:v1::") !== 0 || !key.endsWith(suffix)) continue;
      if (mode === "rank" && key.endsWith(storageApi.APP_SUFFIX)) continue;
      var parsed = parseLocal(storageApi.rawGet(key));
      if (!parsed) continue;
      var localState = parsed.state || parsed;
      return {
        kind: "missionmed_ranklist_interactive_share",
        schemaVersion: 1,
        createdAt: Number(parsed.savedAt || Date.now()),
        snapshot: {
          state: localState,
          activePreset: localState.activePreset || "balanced",
          advisorMode: false,
          wideMode: false,
          rankShowAll: false
        },
        uiPrefs: {},
        currentVersionId: "main"
      };
    }
    return null;
  }

  function emptyRankWorkspace() {
    return {
      kind: "missionmed_ranklist_interactive_share",
      schemaVersion: 1,
      createdAt: Date.now(),
      snapshot: {
        state: { programs: [], factors: [], scores: {}, notes: {}, supplementalEnabled: false, supplementalLists: [], supplementalActiveListId: null, ui: {}, updatedAt: Date.now(), activePreset: "balanced" },
        activePreset: "balanced",
        advisorMode: false,
        wideMode: false,
        rankShowAll: false
      },
      uiPrefs: {},
      currentVersionId: "main"
    };
  }

  function slotContext(context) {
    var ctx = context || {};
    var w = ctx.root || root;
    return {
      mode: ctx.mode || (w && w.RLQ_DUAL && w.RLQ_DUAL.mode) || "rank",
      storageApi: ctx.storageApi || (w && w.RLQ_DUAL && w.RLQ_DUAL.storage),
      storageLike: ctx.storageLike || (w && w.localStorage),
      now: ctx.now || Date.now()
    };
  }

  function decorateSavePayload(payload, context) {
    if (!isInteractiveEnvelope(payload)) return { blocked: false, payload: payload };
    var ctx = slotContext(context);
    var next = deepClone(payload);
    var freshWorkspace = next.ranklist_snapshot.snapshot;
    if (ctx.mode === "rank") {
      var carriedApplication = state.envelope && state.envelope.applicationWorkspace;
      if (!carriedApplication) {
        var localApplication = findLocalWorkspace("application", ctx.storageApi, ctx.storageLike);
        if (localApplication) {
          carriedApplication = { schema: 1, season: 2027, savedAt: ctx.now, workspace: localApplication, application: localApplication.snapshot && localApplication.snapshot.state && localApplication.snapshot.state.application || {} };
        }
      }
      if (carriedApplication) freshWorkspace.applicationWorkspace = deepClone(carriedApplication);
      return { blocked: false, payload: next };
    }

    var applicationState = freshWorkspace && freshWorkspace.snapshot && freshWorkspace.snapshot.state && freshWorkspace.snapshot.state.application || {};
    var rankWorkspace = state.envelope && state.envelope.snapshot ? deepClone(state.envelope) : null;
    if (rankWorkspace && rankWorkspace.applicationWorkspace) delete rankWorkspace.applicationWorkspace;
    if (!rankWorkspace) rankWorkspace = findLocalWorkspace("rank", ctx.storageApi, ctx.storageLike);
    if (!rankWorkspace && state.status === "empty") rankWorkspace = emptyRankWorkspace();
    if (!rankWorkspace && state.status === "failed") return { blocked: true, payload: payload };
    if (!rankWorkspace) return { blocked: true, payload: payload };
    rankWorkspace.applicationWorkspace = {
      schema: 1,
      season: 2027,
      savedAt: ctx.now,
      workspace: deepClone(freshWorkspace),
      application: deepClone(applicationState)
    };
    next.ranklist_snapshot.snapshot = rankWorkspace;
    return { blocked: false, payload: next };
  }

  function selectHydrationPayload(envelope, mode) {
    onCloudEnvelope(envelope);
    var selectedMode = mode || (root && root.RLQ_DUAL && root.RLQ_DUAL.mode) || "rank";
    if (selectedMode === "rank") return envelope;
    return envelope && envelope.applicationWorkspace && envelope.applicationWorkspace.workspace
      ? deepClone(envelope.applicationWorkspace.workspace)
      : null;
  }

  async function prefetchCloudEnvelope(fetchImpl) {
    var fetcher = fetchImpl || (root && root.rlqWpFetch);
    if (typeof fetcher !== "function") return markCloudFailure();
    try {
      var response = await fetcher("/wp-json/rlq/v1/load", { method: "GET", headers: {} });
      if (!response.ok) return markCloudFailure();
      var payload = await response.json();
      var data = payload && payload.data && typeof payload.data === "object" ? payload.data : payload;
      return onCloudEnvelope(data && data.snapshot ? data.snapshot : null);
    } catch (_error) {
      return markCloudFailure();
    }
  }

  if (root && root.document) {
    root.document.addEventListener("DOMContentLoaded", function prefetchAfterBoot() {
      var attempts = 0;
      function attempt() {
        attempts += 1;
        if (typeof root.rlqWpFetch === "function") prefetchCloudEnvelope(root.rlqWpFetch);
        else if (attempts < 20) root.setTimeout(attempt, 100);
        else markCloudFailure();
      }
      attempt();
    }, { once: true });
  }

  return {
    cloudState: state,
    onCloudEnvelope: onCloudEnvelope,
    markCloudFailure: markCloudFailure,
    decorateSavePayload: decorateSavePayload,
    selectHydrationPayload: selectHydrationPayload,
    prefetchCloudEnvelope: prefetchCloudEnvelope,
    emptyRankWorkspace: emptyRankWorkspace,
    findLocalWorkspace: findLocalWorkspace
  };
});

