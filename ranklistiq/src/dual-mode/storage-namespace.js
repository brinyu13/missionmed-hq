(function storageNamespaceModule(root, factory) {
  var api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) {
    root.RLQ_DUAL = Object.assign(root.RLQ_DUAL || {}, { storage: api });
    api.install(root);
  }
})(typeof window !== "undefined" ? window : null, function buildStorageNamespace(root) {
  "use strict";

  var APP_SUFFIX = "::app";
  var WORKSPACE_EXACT = new Set([
    "missionmed_rank_engine_full_v2", "missionmed_ranklist_v1", "rankIQState",
    "rankorder_versions_v1", "rankorder_active_version_v1", "mm_ranklist_versions_v1",
    "roiq_prerank_v1", "roiq_onboarding_seen_v1", "rankorder_wizard_hint_dismissed_v1",
    "mm_programNotes_v1", "ranklist_locked", "ranklist_submission_count",
    "ranklistiq_certified_v1", "ranklistiq_ranklist_certified_v1", "ranklistiq_ranklistCertified_v1",
    "mm_drip_programmeta_v1", "mm_drip_collated_v1", "MM_PORTABLE_IMPORT",
    "MM_RANKLIST_EXPORT_VERSION", "mm_ranklist_advanced_supplemental_mode_v1",
    "mm_ranklist_recent_factors_v1", "__mm_ranklist_probe__"
  ]);
  var SHARED_EXACT = new Set([
    "rlq_wp_nonce_cache", "mm_ranklistiq_candidate_profile_v1", "mm_drip_profile_v1",
    "mm_ranklist_header_chrome_v1", "mm_ranklist_panel_window_v1", "mm_ranklist_workspace_tab_v1",
    "mm_ranklist_workspace_layout_mode_v1", "missionmed_rank_engine_wide_mode_v1",
    "missionmed_rank_engine_advisor_mode_v1", "mm_ranklist_focus_mode_v1", "mm_ranklist_hints_hidden_v1",
    "mm_dev_mode", "rlqDebug", "ranklistiq_oracle_admin_unlocked", "ranklistiq_oracle_dev_unlocked",
    "oracle_admin_ok", "rlq_super_focus", "MM_RLQ_LAST_SAVE_TS", "MM_RLQ_LAST_SAVE_OK", "MM_RLQ_LAST_SAVE_ERR",
    "MM_ALWAYS_DOWNLOAD_COPY", "mm_ranklistiq_hide_name_v1", "mm_ranklistiq_mode_v1",
    "mm_candidate_profile_oracle_bypass_once"
  ]);

  function classifyKey(value) {
    var key = String(value || "");
    if (key.endsWith(APP_SUFFIX)) return "already_namespaced";
    if (WORKSPACE_EXACT.has(key) || key.indexOf("ranklistiq:v1") === 0 || key.indexOf("ranklistiq_oracle_v2_") === 0 || key.indexOf("rl_") === 0) return "workspace";
    if (SHARED_EXACT.has(key) || key.indexOf("mm_ranklist_id_") === 0 || key.indexOf("mm_profile_intake_") === 0 || key.indexOf("MM_RLQ_LAST_SAVE_") === 0) return "shared";
    return "unclassified";
  }

  function namespacedKey(key, mode) {
    return mode === "application" && classifyKey(key) === "workspace" ? String(key) + APP_SUFFIX : String(key);
  }

  var native = null;

  function install(targetRoot) {
    var w = targetRoot || root;
    if (!w || !w.Storage || !w.localStorage || w.__RLQ_STORAGE_NAMESPACE_INSTALLED__) return false;
    var prototype = w.Storage.prototype;
    native = {
      getItem: prototype.getItem,
      setItem: prototype.setItem,
      removeItem: prototype.removeItem
    };
    function map(storage, key) {
      if (storage !== w.localStorage) return String(key);
      var mode = w.RLQ_DUAL && w.RLQ_DUAL.mode;
      return namespacedKey(key, mode);
    }
    prototype.getItem = function getItem(key) { return native.getItem.call(this, map(this, key)); };
    prototype.setItem = function setItem(key, value) { return native.setItem.call(this, map(this, key), value); };
    prototype.removeItem = function removeItem(key) { return native.removeItem.call(this, map(this, key)); };
    w.__RLQ_STORAGE_NAMESPACE_INSTALLED__ = true;
    return true;
  }

  function rawGet(key) {
    if (!root || !root.localStorage) return null;
    return native ? native.getItem.call(root.localStorage, key) : root.localStorage.getItem(key);
  }

  function rawSet(key, value) {
    if (!root || !root.localStorage) return;
    if (native) native.setItem.call(root.localStorage, key, value);
    else root.localStorage.setItem(key, value);
  }

  return {
    APP_SUFFIX: APP_SUFFIX,
    WORKSPACE_EXACT: Array.from(WORKSPACE_EXACT),
    SHARED_EXACT: Array.from(SHARED_EXACT),
    classifyKey: classifyKey,
    namespacedKey: namespacedKey,
    install: install,
    rawGet: rawGet,
    rawSet: rawSet
  };
});
