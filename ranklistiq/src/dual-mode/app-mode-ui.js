(function appModeUiModule(root, factory) {
  var api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) {
    root.RLQ_DUAL = Object.assign(root.RLQ_DUAL || {}, api);
    api.init();
  }
})(typeof window !== "undefined" ? window : null, function buildAppModeUi(root) {
  "use strict";

  var APPLICATION_STRINGS = [
    "Application & Signals", "ERAS 2027", "Application Priority", "IQ Priority Order",
    "Planning only. RankListIQ does not send signals. Assign them in MyERAS under Programs, then Review Program Signals.",
    "Some programs in a participating specialty may not accept signals. Check the AAMC participating programs list."
  ];
  var initialized = false;
  var modal = null;
  var compareModal = null;
  var rankListObserver = null;
  var riseRecords = [];
  var riseIdentity = {};
  var selectedIds = new Set();

  function byId(id) { return root.document.getElementById(id); }

  function ensureApplication(state) {
    if (!state.application || typeof state.application !== "object") state.application = {};
    var application = state.application;
    application.schema = 1;
    application.rulesVersion = application.rulesVersion || "eras-2027.v1";
    application.rise = application.rise || { lastImportAt: null, registryReleaseId: null, links: {}, unresolved: [] };
    application.rise.links = application.rise.links || {};
    application.rise.unresolved = Array.isArray(application.rise.unresolved) ? application.rise.unresolved : [];
    application.decisions = application.decisions || {};
    application.signals = application.signals || {};
    application.specialtyOverrides = application.specialtyOverrides || {};
    return application;
  }

  function showModeSelector() {
    if (byId("rlqModeSelector")) return;
    var rankCount = 0;
    try {
      var storage = root.RLQ_DUAL.storage;
      for (var index = 0; index < root.localStorage.length; index += 1) {
        var key = root.localStorage.key(index);
        if (!key || key.indexOf("ranklistiq:v1::") !== 0 || key.endsWith(storage.APP_SUFFIX)) continue;
        var parsed = JSON.parse(storage.rawGet(key) || "null");
        rankCount = parsed && parsed.state && Array.isArray(parsed.state.programs) ? parsed.state.programs.length : 0;
        if (rankCount) break;
      }
    } catch (_error) {}
    var overlay = root.document.createElement("div");
    overlay.id = "rlqModeSelector";
    overlay.className = "rlq-mode-selector";
    overlay.innerHTML = '<div class="rlq-mode-selector__shell">' +
      '<div class="rlq-mode-selector__mark" aria-hidden="true">RIQ</div>' +
      '<h1>Where are you in the Match?</h1>' +
      '<p class="rlq-mode-selector__lede">Choose the workspace for the phase you are planning now.</p>' +
      '<div class="rlq-mode-selector__doors">' +
      '<button class="rlq-mode-door" type="button" data-rlq-mode="application"><span class="rlq-mode-door__eyebrow">BEFORE INTERVIEWS</span><strong>Application &amp; Signals</strong><p>Decide where to apply and where your ERAS signals go.</p><span class="rlq-mode-door__footer"><span>ERAS 2027</span><span class="rlq-mode-door__open">Open</span></span></button>' +
      '<button class="rlq-mode-door" type="button" data-rlq-mode="rank"><span class="rlq-mode-door__eyebrow">AFTER INTERVIEWS</span><strong>Rank List</strong><p>Score the programs where you interviewed and build your list.</p><span class="rlq-mode-door__footer"><span>Match 2027' + (rankCount ? ' · ' + String(rankCount) + ' programs saved' : '') + '</span><span class="rlq-mode-door__open">Open</span></span></button>' +
      '</div><p class="rlq-mode-selector__foot">One program decision engine. Two phases of the Match.</p></div>';
    overlay.addEventListener("click", function choose(event) {
      var button = event.target.closest("[data-rlq-mode]");
      if (button) root.RLQ_DUAL.chooseMode(button.getAttribute("data-rlq-mode"));
    });
    root.document.body.appendChild(overlay);
  }

  function addHeaderChip() {
    var host = byId("mm-header-appchrome-left");
    if (!host || byId("rlqModeChip")) return;
    var chip = root.document.createElement("div");
    chip.id = "rlqModeChip";
    chip.className = "rlq-mode-chip";
    chip.innerHTML = '<span>' + (root.RLQ_DUAL.mode === "application" ? "APPLICATION &amp; SIGNALS · ERAS 2027" : "RANK LIST · MATCH 2027") + '</span><button type="button">Switch</button>';
    chip.querySelector("button").addEventListener("click", function switchMode() {
      if (root.RLQ_ENGINE && typeof root.RLQ_ENGINE.saveState === "function") root.RLQ_ENGINE.saveState({ immediate: true, reason: "mode-switch" });
      root.RLQ_DUAL.requestSelector();
    });
    host.appendChild(chip);
  }

  function relabelApplication() {
    if (!root.RLQ_DUAL.isApplication()) return;
    var rankPanel = byId("panelRankedOutput");
    if (rankPanel) {
      var heading = rankPanel.querySelector("h3");
      if (heading) heading.textContent = "IQ Priority Order";
    }
    Array.from(root.document.querySelectorAll("body.rlq-mode-application *")).forEach(function relabel(node) {
      if (node.children.length) return;
      if (node.textContent.trim() === "Rank Outcome") node.textContent = "Application Priority";
      if (node.textContent.trim() === "IQ Optimized Ranking") node.textContent = "IQ Priority Order";
    });
  }

  function importButton() {
    if (!root.RLQ_DUAL.isApplication() || byId("rlqImportRise")) return;
    var panel = byId("panelStartWizard");
    if (!panel) return;
    var button = root.document.createElement("button");
    button.id = "rlqImportRise";
    button.className = "rlq-import-button";
    button.type = "button";
    button.textContent = "Import programs from RISE";
    button.addEventListener("click", openRiseImport);
    var body = panel.querySelector(".mm-panel__body") || panel;
    body.insertBefore(button, body.firstChild);
  }

  function makeModal() {
    if (modal) return modal;
    modal = root.document.createElement("div");
    modal.id = "rlqRiseImportModal";
    modal.className = "rlq-modal-back";
    modal.hidden = true;
    modal.innerHTML = '<section class="rlq-modal" role="dialog" aria-modal="true" aria-labelledby="rlqRiseTitle">' +
      '<header class="rlq-modal__head"><div><h2 id="rlqRiseTitle">Import from RISE</h2><small>Read-only · your RISE order stays unchanged</small></div><button class="rlq-modal__close" type="button" aria-label="Close">×</button></header>' +
      '<div class="rlq-modal__body"><div id="rlqRiseStatus" class="rlq-rise-status">Ready to connect.</div><div id="rlqRiseList" class="rlq-rise-list"></div></div>' +
      '<footer class="rlq-modal__foot"><div class="rlq-modal-actions"><button class="rlq-action" type="button" data-action="next">Select next 20</button><button class="rlq-action" type="button" data-action="all">Select all</button></div><button class="rlq-action primary" type="button" data-action="import">Import selected (0)</button></footer>' +
      '</section>';
    modal.querySelector(".rlq-modal__close").addEventListener("click", closeRiseImport);
    modal.addEventListener("click", function handleModal(event) {
      if (event.target === modal) closeRiseImport();
      var action = event.target.closest("[data-action]");
      if (!action) return;
      if (action.dataset.action === "next") selectNext();
      if (action.dataset.action === "all") selectAll();
      if (action.dataset.action === "import") importSelected();
    });
    root.document.body.appendChild(modal);
    return modal;
  }

  function status(text) { var node = byId("rlqRiseStatus"); if (node) node.textContent = text; }

  function linkedRiseIds() {
    var state = root.RLQ_ENGINE.getState();
    var application = ensureApplication(state);
    return new Set(Object.values(application.rise.links).map(function value(link) { return link.programSpecialtyId; }));
  }

  function renderRiseList() {
    var list = byId("rlqRiseList");
    if (!list) return;
    list.innerHTML = "";
    var linked = linkedRiseIds();
    riseRecords.forEach(function renderRecord(record) {
      var id = String(record.programSpecialtyId || "");
      var identity = riseIdentity[id];
      var program = identity && identity.program;
      var display = program && program.display || {};
      var row = root.document.createElement("label");
      row.className = "rlq-rise-row";
      var isLinked = linked.has(id);
      row.innerHTML = '<input type="checkbox" ' + (selectedIds.has(id) ? 'checked ' : '') + (isLinked ? 'disabled ' : '') + 'aria-label="Select RISE program ' + String(record.priorityPosition || "") + '">' +
        '<b>#' + String(record.priorityPosition || "") + '</b><span><strong></strong><small></small></span><span class="rlq-rise-row__state"></span>';
      row.querySelector("strong").textContent = display.programName || "Program details load on import";
      row.querySelector("small").textContent = [display.city, display.state, program && program.designation].filter(Boolean).join(" · ") || id;
      row.querySelector(".rlq-rise-row__state").textContent = isLinked ? "Already here" : (record.goldStarred ? "★ RISE highest interest" : "");
      var checkbox = row.querySelector("input");
      checkbox.addEventListener("change", function updateSelection() {
        if (checkbox.checked) selectedIds.add(id); else selectedIds.delete(id);
        updateImportCount();
      });
      list.appendChild(row);
    });
    updateImportCount();
  }

  function updateImportCount() {
    var button = modal && modal.querySelector('[data-action="import"]');
    if (button) button.textContent = "Import selected (" + String(selectedIds.size) + ")";
    var all = modal && modal.querySelector('[data-action="all"]');
    if (all) all.textContent = "Select all (" + String(riseRecords.length) + ")";
  }

  function selectNext() {
    var linked = linkedRiseIds();
    var remaining = riseRecords.filter(function filter(record) { var id = String(record.programSpecialtyId); return !linked.has(id) && !selectedIds.has(id); });
    remaining.slice(0, 20).forEach(function select(record) { selectedIds.add(String(record.programSpecialtyId)); });
    renderRiseList();
  }

  function selectAll() {
    var linked = linkedRiseIds();
    riseRecords.forEach(function select(record) { var id = String(record.programSpecialtyId); if (!linked.has(id)) selectedIds.add(id); });
    renderRiseList();
  }

  async function openRiseImport() {
    makeModal().hidden = false;
    status("Connecting to RISE…");
    riseRecords = [];
    selectedIds.clear();
    renderRiseList();
    try {
      var adapter = root.RLQ_RISE.createAdapter(root.fetch.bind(root));
      await adapter.bindSession();
      var listed = await adapter.listMyPrograms();
      riseRecords = listed.records;
      if (!riseRecords.length) {
        status("No saved RISE programs yet. Open RISE to save programs, or add a program manually.");
        return;
      }
      selectNext();
      status("Your programs are in RISE order. The first 20 new programs are selected.");
    } catch (_error) {
      status("RISE isn't available on this account. You can still add a program manually.");
    }
  }

  function closeRiseImport() { if (modal) modal.hidden = true; }

  async function importSelected() {
    var ids = Array.from(selectedIds);
    if (!ids.length) return;
    var button = modal.querySelector('[data-action="import"]');
    button.disabled = true;
    status("Importing 0/" + String(ids.length) + "…");
    var adapter = root.RLQ_RISE.createAdapter(root.fetch.bind(root));
    var result = await adapter.importBatch(ids, { concurrency: 4, onProgress: function progress(event) { status("Importing " + String(event.completed) + "/" + String(event.total) + "…"); } });
    var state = root.RLQ_ENGINE.getState();
    var application = ensureApplication(state);
    var recordsById = Object.fromEntries(riseRecords.map(function pair(record) { return [String(record.programSpecialtyId), record]; }));
    var imported = 0;
    result.results.forEach(function apply(item) {
      if (!item.ok) return;
      riseIdentity[item.id] = item.identity;
      var mapped = root.RLQ_RISE.mapToProgramPayload(recordsById[item.id], item.identity);
      var programId = root.RLQ_ENGINE.upsertProgramFromPayload(mapped.programPayload, null);
      if (!programId) return;
      application.rise.links[programId] = mapped.link;
      application.rise.registryReleaseId = mapped.link.registryReleaseId || application.rise.registryReleaseId;
      imported += 1;
    });
    application.rise.lastImportAt = new Date().toISOString();
    application.rise.unresolved = result.failures.map(function failure(item) { return { programSpecialtyId: item.id, reason: item.code }; });
    root.RLQ_ENGINE.saveState({ immediate: true, reason: "rise-import" });
    root.RLQ_ENGINE.renderAll();
    button.disabled = false;
    if (result.failures.length) {
      status(String(imported) + " imported. " + String(result.failures.length) + " could not load from RISE; retry is available by reopening the importer.");
      renderRiseList();
    } else {
      closeRiseImport();
      root.RLQ_ENGINE.showToast("RISE import complete", String(imported) + " programs imported from RISE in your order.");
    }
  }

  function renderBudget(state, application) {
    var panel = byId("panelRankedOutput");
    if (!panel) return;
    var existing = byId("rlqApplicationToolbar");
    if (!existing) {
      existing = root.document.createElement("div");
      existing.id = "rlqApplicationToolbar";
      existing.className = "rlq-application-toolbar";
      var body = panel.querySelector(".mm-panel__body") || panel;
      body.insertBefore(existing, body.firstChild);
    }
    var totals = root.RLQ_SIGNALS.budget(root.RLQ_SIGNAL_CONFIG, application, state.programs || []);
    var issues = root.RLQ_SIGNALS.validate(root.RLQ_SIGNAL_CONFIG, application, state.programs || []);
    var issueMap = new Set(issues.map(function issue(item) { return item.key + ":" + item.tier; }));
    var facts = Object.fromEntries(root.RLQ_SIGNAL_CONFIG.rule_facts.map(function pair(fact) { return [fact.key, fact]; }));
    var rows = Object.keys(totals).map(function row(key) {
      var entry = totals[key];
      var fact = facts[key];
      var pills = Object.keys(entry).filter(function filter(tier) { return entry[tier] && typeof entry[tier] === "object"; }).map(function pill(tier) {
        var value = entry[tier];
        var cls = issueMap.has(key + ":" + tier) ? " is-over" : (value.used === value.limit ? " is-limit" : "");
        return '<span class="rlq-budget-pill' + cls + '">' + tier.toUpperCase() + ' ' + String(value.used) + '/' + String(value.limit) + '</span>';
      }).join("");
      return '<div class="rlq-budget-row"><span class="rlq-budget-row__name">' + escapeHtml(fact ? fact.aamc_label : key) + '</span><span>' + pills + '</span></div>';
    }).join("");
    var verified = root.RLQ_SIGNAL_CONFIG.verification;
    var verificationCopy = verified.human_confirmed_at ? "Verified against AAMC on " + verified.human_confirmed_at : "Checked against AAMC on " + verified.verified_at;
    existing.innerHTML = '<div class="rlq-signal-budget"><div class="rlq-signal-budget__head"><span>Signal budget</span><button id="rlqCompareOrders" class="rlq-action" type="button">Compare orders</button></div>' + (rows || '<div class="rlq-planning-copy">Add a program to see specialty signal budgets.</div>') + '<div class="rlq-planning-copy">' + escapeHtml(APPLICATION_STRINGS[4]) + '<br>' + escapeHtml(APPLICATION_STRINGS[5]) + '<br>' + escapeHtml(verificationCopy) + '</div></div>';
    byId("rlqCompareOrders").addEventListener("click", function open() { openCompareOrders(state, application); });
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function replace(character) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]; });
  }

  function renderCardControls(state, application) {
    var ranked = root.RLQ_ENGINE.rankedPrograms();
    var byIdMap = Object.fromEntries((state.programs || []).map(function pair(program) { return [String(program.id), program]; }));
    Array.from(root.document.querySelectorAll("#rankList .rankItem[data-program-id]")).forEach(function decorate(card) {
      var id = String(card.getAttribute("data-program-id"));
      var program = byIdMap[id];
      if (!program) return;
      var old = card.querySelector(".rlq-card-controls");
      if (old) old.remove();
      var controls = root.document.createElement("div");
      controls.className = "rlq-card-controls";
      var link = application.rise.links[id];
      var tags = link ? '<div class="rlq-rise-tags"><span class="rlq-rise-tag">RISE #' + String(link.riseOrder || "") + '</span>' + (link.goldStarred ? '<span class="rlq-rise-tag">★ RISE highest interest</span>' : '') + '</div>' : '';
      var decision = application.decisions[id] || "maybe";
      var decisionButtons = ["apply", "maybe", "skip"].map(function decisionButton(value) { return '<button type="button" class="rlq-segment' + (decision === value ? ' is-active' : '') + '" data-decision="' + value + '">' + value.charAt(0).toUpperCase() + value.slice(1) + '</button>'; }).join("");
      var specialty = application.specialtyOverrides[id] || program.specialty;
      var rule = root.RLQ_SIGNAL_RULES.resolveRule(root.RLQ_SIGNAL_CONFIG, specialty);
      var tiers = rule.status === "tiered" ? ["none", "silver", "gold"] : (rule.status === "single" ? ["none", "single"] : []);
      var assigned = application.signals[id] || "none";
      var signalHtml = rule.status === "unresolved" ? '<span class="rlq-unresolved">Rules not listed by AAMC</span>' : tiers.map(function signalButton(tier) {
        var disabled = decision === "skip";
        var reason = null;
        if (tier !== "none" && !disabled) {
          var check = root.RLQ_SIGNALS.canAssign(root.RLQ_SIGNAL_CONFIG, application, state.programs || [], id, tier);
          disabled = !check.ok && assigned !== tier;
          reason = check.reason;
        }
        var label = tier === "single" ? "Signal" : tier.charAt(0).toUpperCase() + tier.slice(1);
        return '<button type="button" class="rlq-segment' + (assigned === tier ? ' is-active' : '') + '" data-signal="' + tier + '" ' + (disabled ? 'disabled ' : '') + (reason === "LIMIT_REACHED" ? 'title="Signal limit reached" ' : '') + '>' + label + '</button>';
      }).join("");
      controls.innerHTML = tags + '<div class="rlq-card-control-row"><b>Decision</b>' + decisionButtons + '</div><div class="rlq-card-control-row"><b>Signal</b>' + signalHtml + '</div>';
      controls.addEventListener("click", function update(event) {
        event.stopPropagation();
        var decisionButton = event.target.closest("[data-decision]");
        if (decisionButton) {
          application.decisions[id] = decisionButton.dataset.decision;
          if (decisionButton.dataset.decision === "skip") delete application.signals[id];
        }
        var signalButton = event.target.closest("[data-signal]");
        if (signalButton) {
          if (signalButton.dataset.signal === "none") application = root.RLQ_SIGNALS.clear(application, id);
          else application = root.RLQ_SIGNALS.assign(root.RLQ_SIGNAL_CONFIG, application, state.programs || [], id, signalButton.dataset.signal);
          state.application = application;
        }
        root.RLQ_ENGINE.saveState({ immediate: true, reason: "application-control" });
        root.RLQ_ENGINE.renderAll();
      });
      card.appendChild(controls);
    });
    return ranked;
  }

  function ensureRankListObserver() {
    if (rankListObserver || !root.MutationObserver) return;
    var rankList = byId("rankList");
    if (!rankList) return;
    rankListObserver = new root.MutationObserver(function restoreApplicationControls() {
      if (!root.RLQ_DUAL.isApplication() || !root.RLQ_ENGINE || !root.RLQ_SIGNAL_CONFIG || !root.RLQ_SIGNALS) return;
      var cards = rankList.querySelectorAll(".rankItem[data-program-id]");
      if (!cards.length || rankList.querySelectorAll(".rlq-card-controls").length >= cards.length) return;
      var state = root.RLQ_ENGINE.getState();
      renderCardControls(state, ensureApplication(state));
    });
    rankListObserver.observe(rankList, { childList: true, subtree: true });
  }

  function openCompareOrders(state, application) {
    if (!compareModal) {
      compareModal = root.document.createElement("div");
      compareModal.className = "rlq-modal-back";
      compareModal.hidden = true;
      compareModal.innerHTML = '<section class="rlq-modal" role="dialog" aria-modal="true"><header class="rlq-modal__head"><h2>Compare orders</h2><button class="rlq-modal__close" type="button" aria-label="Close">×</button></header><div class="rlq-modal__body rlq-compare-wrap"><table class="rlq-compare-table"><thead><tr><th>Program</th><th>RISE order</th><th>IQ score</th><th>IQ order</th><th>Decision</th><th>Signal</th><th>Final rank</th></tr></thead><tbody></tbody></table></div></section>';
      compareModal.querySelector("button").addEventListener("click", function close() { compareModal.hidden = true; });
      root.document.body.appendChild(compareModal);
    }
    var ranked = root.RLQ_ENGINE.rankedPrograms();
    var rankMap = Object.fromEntries(ranked.map(function pair(program, index) { return [String(program.id), index + 1]; }));
    var scoreMap = Object.fromEntries(ranked.map(function pair(program) { return [String(program.id), program.total]; }));
    var tbody = compareModal.querySelector("tbody");
    tbody.innerHTML = (state.programs || []).map(function row(program) {
      var id = String(program.id);
      var link = application.rise.links[id];
      return '<tr><td>' + escapeHtml(program.name) + '</td><td>' + (link ? String(link.riseOrder || "—") : "—") + '</td><td>' + escapeHtml(Number(scoreMap[id] || 0).toFixed(1)) + '</td><td>' + String(rankMap[id] || "—") + '</td><td>' + escapeHtml(application.decisions[id] || "Maybe") + '</td><td>' + escapeHtml(application.signals[id] || "None") + '</td><td>Set after interviews in Rank List</td></tr>';
    }).join("");
    compareModal.hidden = false;
  }

  function afterRender() {
    addHeaderChip();
    relabelApplication();
    importButton();
    ensureRankListObserver();
    if (!root.RLQ_DUAL.isApplication() || !root.RLQ_ENGINE || !root.RLQ_SIGNAL_CONFIG || !root.RLQ_SIGNALS) return;
    var state = root.RLQ_ENGINE.getState();
    var application = ensureApplication(state);
    renderBudget(state, application);
    renderCardControls(state, application);
  }

  function init() {
    if (!root || !root.document || initialized) return;
    initialized = true;
    function ready() {
      if (root.RLQ_DUAL.selectorRequired) showModeSelector();
      addHeaderChip();
      relabelApplication();
      importButton();
      ensureRankListObserver();
    }
    if (root.document.readyState === "loading") root.document.addEventListener("DOMContentLoaded", ready, { once: true });
    else ready();
  }

  return {
    APPLICATION_STRINGS: APPLICATION_STRINGS,
    ensureApplication: ensureApplication,
    afterRender: afterRender,
    init: init
  };
});
