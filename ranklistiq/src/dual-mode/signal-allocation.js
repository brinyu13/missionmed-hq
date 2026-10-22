(function signalAllocationModule(root, factory) {
  var rules = typeof module === "object" && module.exports
    ? require("./signal-rules.js")
    : root.RLQ_SIGNAL_RULES;
  var api = factory(rules);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.RLQ_SIGNALS = Object.assign({}, rules, api);
})(typeof window !== "undefined" ? window : null, function buildSignalAllocation(rules) {
  "use strict";

  function cloneApplication(application) {
    return Object.assign({}, application || {}, {
      decisions: Object.assign({}, application && application.decisions),
      signals: Object.assign({}, application && application.signals)
    });
  }

  function programMap(programs) {
    var byId = {};
    (Array.isArray(programs) ? programs : []).forEach(function addProgram(program) {
      if (program && program.id != null) byId[String(program.id)] = program;
    });
    return byId;
  }

  function emptyBudget(rule) {
    var result = { key: rule.key, status: rule.status };
    Object.keys(rule.limits).forEach(function addTier(tier) {
      result[tier] = { used: 0, limit: rule.limits[tier] };
    });
    return result;
  }

  function budget(config, application, programs) {
    var result = {};
    var byId = programMap(programs);
    Object.keys(byId).forEach(function seedProgram(programId) {
      var rule = rules.resolveRule(config, byId[programId].specialty);
      if (rule.key && !result[rule.key]) result[rule.key] = emptyBudget(rule);
    });
    var signals = application && application.signals ? application.signals : {};
    Object.keys(signals).forEach(function countSignal(programId) {
      var program = byId[programId];
      if (!program) return;
      var rule = rules.resolveRule(config, program.specialty);
      var tier = signals[programId];
      if (rule.key && result[rule.key] && result[rule.key][tier]) {
        result[rule.key][tier].used += 1;
      }
    });
    return result;
  }

  function canAssign(config, application, programs, programId, tier) {
    if (!rules.isVerified(config)) return { ok: false, reason: "RULES_UNVERIFIED" };
    var id = String(programId);
    var byId = programMap(programs);
    var program = byId[id];
    var rule = rules.resolveRule(config, program && program.specialty);
    if (!program || rule.status === "unresolved") return { ok: false, reason: "UNRESOLVED_RULE" };
    if (application && application.decisions && application.decisions[id] === "skip") {
      return { ok: false, reason: "DECISION_SKIP" };
    }
    if (!Object.prototype.hasOwnProperty.call(rule.limits, tier)) {
      return { ok: false, reason: "TIER_NOT_OFFERED" };
    }
    var currentTier = application && application.signals && application.signals[id];
    var currentBudget = budget(config, application, programs)[rule.key];
    var used = currentBudget && currentBudget[tier] ? currentBudget[tier].used : 0;
    var effectiveUsed = currentTier === tier ? used - 1 : used;
    var limit = rule.limits[tier];
    if (effectiveUsed >= limit) return { ok: false, reason: "LIMIT_REACHED", used: used, limit: limit };
    return { ok: true, used: used, limit: limit, ruleKey: rule.key };
  }

  function assign(config, application, programs, programId, tier) {
    var check = canAssign(config, application, programs, programId, tier);
    if (!check.ok) {
      var error = new Error(check.reason);
      error.code = check.reason;
      error.detail = check;
      throw error;
    }
    var next = cloneApplication(application);
    next.signals[String(programId)] = tier;
    next.rulesVersion = String(config.application_season) + ":" + String(config.schema);
    return next;
  }

  function clear(application, programId) {
    var next = cloneApplication(application);
    delete next.signals[String(programId)];
    return next;
  }

  function validate(config, application, programs) {
    var totals = budget(config, application, programs);
    var issues = [];
    Object.keys(totals).forEach(function inspectRule(key) {
      var entry = totals[key];
      Object.keys(entry).forEach(function inspectTier(tier) {
        var value = entry[tier];
        if (!value || typeof value !== "object" || typeof value.used !== "number") return;
        if (value.used > value.limit) {
          issues.push({ key: key, tier: tier, used: value.used, limit: value.limit, overBy: value.used - value.limit });
        }
      });
    });
    return issues;
  }

  return {
    budget: budget,
    canAssign: canAssign,
    assign: assign,
    clear: clear,
    validate: validate
  };
});

