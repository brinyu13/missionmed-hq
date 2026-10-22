(function signalRulesModule(root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.RLQ_SIGNAL_RULES = api;
})(typeof window !== "undefined" ? window : null, function buildSignalRules() {
  "use strict";

  function isVerified(config) {
    var status = config && config.verification && config.verification.status;
    return status === "machine_verified" || status === "human_confirmed";
  }

  function limitsFor(rule) {
    if (rule.signal_system === "tiered") {
      return { gold: rule.gold_limit, silver: rule.silver_limit };
    }
    if (rule.signal_system === "single") {
      return { single: rule.single_limit };
    }
    return {};
  }

  function resolveRule(config, specialtyLabel) {
    var label = typeof specialtyLabel === "string" ? specialtyLabel.trim() : "";
    var facts = config && Array.isArray(config.rule_facts) ? config.rule_facts : [];
    var match = null;
    var source = null;

    for (var index = 0; index < facts.length; index += 1) {
      var candidate = facts[index];
      if (Array.isArray(candidate.rise_designations) && candidate.rise_designations.indexOf(label) !== -1) {
        match = candidate;
        source = "rise_designation";
        break;
      }
    }
    if (!match) {
      for (var fallbackIndex = 0; fallbackIndex < facts.length; fallbackIndex += 1) {
        if (facts[fallbackIndex].aamc_label === label) {
          match = facts[fallbackIndex];
          source = "aamc_label";
          break;
        }
      }
    }

    if (!match) {
      return {
        status: "unresolved",
        key: null,
        limits: {},
        source: "unresolved",
        verified: isVerified(config),
        studentCopy: config && config.unresolved_policy ? config.unresolved_policy.student_copy : ""
      };
    }

    return {
      status: match.signal_system,
      key: match.key,
      limits: limitsFor(match),
      source: source,
      verified: isVerified(config),
      studentCopy: ""
    };
  }

  return {
    isVerified: isVerified,
    resolveRule: resolveRule
  };
});

