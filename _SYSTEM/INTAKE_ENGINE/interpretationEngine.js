"use strict";

/**
 * MMOS Interpretation Engine v2.0
 * Deterministic rule-based classifier for minimal human input.
 *
 * Public contract (unchanged from v1):
 *   interpretInput(minimalInput) -> {
 *     taskType, complexity, risk, targets, inferredPhases,
 *     metadata: { confidence, reasoningFlags }
 *   }
 *   classifyTaskType(goal, target, constraint) -> { taskType, confidence, method, scores }
 *   computeComplexity(input) -> "LOW" | "MED" | "HIGH"
 *   computeRisk(taskType, complexity, context) -> "LOW" | "MED" | "HIGH"
 *
 * v2 changes (additive, determinism preserved):
 *   A) expanded keyword dictionaries (7 task types)
 *   B) phrase-level boosters (literal substring hits)
 *   C) richer complexity signals: scope words, UX surface words,
 *      breadth words, multi-intent bonus; lowered goal-length and
 *      verb-count thresholds
 *   D) scope-heuristic fallback stage so substantive inputs never
 *      fall through to PLAN/needs_user_confirmation
 *   E) "needs_user_confirmation" reserved for truly empty or sub-5-char
 *      goals; mid-confidence cases emit "low_confidence_interpretation"
 */

const TASK_TYPES = [
  "BUILD",
  "AUDIT",
  "FIX",
  "DEPLOY",
  "CONTENT",
  "PLAN",
  "SYSTEM_MIGRATION",
];

const TASK_PRIORITY = [
  "SYSTEM_MIGRATION",
  "DEPLOY",
  "FIX",
  "BUILD",
  "AUDIT",
  "CONTENT",
  "PLAN",
];

// -------------------------------------------------------------------
// A) Keyword dictionaries (v2 additive; legacy terms preserved)
// -------------------------------------------------------------------
const TASK_KEYWORDS = {
  BUILD: [
    // v1
    "build", "create", "add", "generate", "scaffold", "implement",
    "introduce", "new", "make", "produce", "construct", "initialize",
    "set up", "stand up",
    // v2 additions
    "wire", "wire up", "embed", "enable", "hook",
    "hook up", "connect", "extend", "augment", "bolt on", "plug in",
  ],
  AUDIT: [
    // v1
    "audit", "validate", "verify", "check", "review", "inspect",
    "confirm", "assess", "examine", "certify", "test",
    // v2 additions
    "improve", "optimize", "tune", "harden", "polish", "refine",
    "revamp", "enhance", "elevate", "modernize", "evaluate",
    "analyze", "analyse", "benchmark", "upgrade",
  ],
  FIX: [
    // v1 (kept focused on breakage semantics)
    "fix", "repair", "debug", "patch", "resolve", "correct",
    "unbreak", "recover", "mend", "restore", "hotfix",
    // v2 additions (breakage-adjacent, not improvement verbs)
    "revert", "stabilize",
  ],
  DEPLOY: [
    // v1
    "deploy", "push", "publish", "release", "ship", "launch",
    "roll out", "cutover", "go live", "promote", "rollout",
    // v2 additions
    "go-live", "cut over", "cut-over", "roll-out",
  ],
  CONTENT: [
    // v1
    "copy", "rewrite", "draft", "tone", "message", "wording",
    "phrasing", "caption", "headline", "blog", "post", "article",
    "email", "page copy", "landing copy",
    // v2 additions
    "copywrite", "storyboard", "script",
  ],
  PLAN: [
    // v1
    "plan", "design", "architect", "spec", "roadmap", "outline",
    "scope", "proposal", "blueprint", "strategy",
    // v2 additions
    "define", "specify", "sketch", "map out",
    "architecture", "specification", "roadmapping",
  ],
  SYSTEM_MIGRATION: [
    // v1
    "migrate", "refactor", "split", "consolidate", "restructure",
    "reorganize", "rename", "move", "extract", "merge",
    "transition", "decompose",
    // v2 additions
    "integrate", "unify", "orchestrate", "decouple", "rewire",
    "bridge", "centralize", "centralise", "pipeline",
  ],
};

function findKeywordCollisions(taskKeywords) {
  const seen = new Map();
  const collisions = [];

  Object.keys(taskKeywords).forEach((taskType) => {
    taskKeywords[taskType].forEach((keyword) => {
      const key = toStringOrEmpty(keyword).toLowerCase().trim();
      if (!key) {
        return;
      }
      if (seen.has(key) && seen.get(key) !== taskType) {
        collisions.push(key);
        return;
      }
      seen.set(key, taskType);
    });
  });

  return Array.from(new Set(collisions));
}

const KEYWORD_COLLISIONS = findKeywordCollisions(TASK_KEYWORDS);
if (KEYWORD_COLLISIONS.length > 0) {
  throw new Error(
    "TASK_KEYWORDS contains duplicate entries across task types: " +
      KEYWORD_COLLISIONS.join(", ")
  );
}

const ALL_KEYWORDS = Array.from(
  new Set(
    Object.values(TASK_KEYWORDS).reduce((acc, words) => acc.concat(words), [])
  )
);

// -------------------------------------------------------------------
// B) Phrase-level boosters - literal case-insensitive substring hits.
//    These handle multi-word intent signals that single-word keyword
//    scoring cannot capture.
// -------------------------------------------------------------------
const PHRASE_BOOSTERS = [
  // SYSTEM_MIGRATION signals
  { phrase: "integrate ", type: "SYSTEM_MIGRATION", weight: 1,
    requires: [" into "] },
  { phrase: "into the ",   type: "SYSTEM_MIGRATION", weight: 1,
    requires: [" system", " pipeline", " engine", " platform",
               " registry", " module"] },
  { phrase: "into a ",     type: "SYSTEM_MIGRATION", weight: 1,
    requires: [" system", " pipeline", " engine", " platform"] },
  { phrase: "injection pipeline", type: "SYSTEM_MIGRATION", weight: 1 },
  { phrase: "question bank",      type: "SYSTEM_MIGRATION", weight: 1 },
  { phrase: "data pipeline",      type: "SYSTEM_MIGRATION", weight: 1 },
  { phrase: "end to end",         type: "SYSTEM_MIGRATION", weight: 1 },
  { phrase: "end-to-end",         type: "SYSTEM_MIGRATION", weight: 1 },

  // AUDIT signals (improvement / polish)
  { phrase: "reduce friction",    type: "AUDIT", weight: 2 },
  { phrase: "remove friction",    type: "AUDIT", weight: 2 },
  { phrase: "cut friction",       type: "AUDIT", weight: 2 },
  { phrase: "more intuitive",     type: "AUDIT", weight: 2 },
  { phrase: "more usable",        type: "AUDIT", weight: 2 },
  { phrase: "more discoverable",  type: "AUDIT", weight: 2 },
  { phrase: "ui ux",              type: "AUDIT", weight: 1 },
  { phrase: "ux flow",            type: "AUDIT", weight: 1 },
  { phrase: "user experience",    type: "AUDIT", weight: 1 },
  { phrase: "user flow",          type: "AUDIT", weight: 1 },

  // DEPLOY signals
  { phrase: "go live",    type: "DEPLOY", weight: 2 },
  { phrase: "go-live",    type: "DEPLOY", weight: 2 },
  { phrase: "cut over",   type: "DEPLOY", weight: 2 },
  { phrase: "cut-over",   type: "DEPLOY", weight: 2 },

  // FIX signals
  { phrase: "is broken",  type: "FIX", weight: 2 },
  { phrase: "not working",type: "FIX", weight: 2 },
  { phrase: "throws an error", type: "FIX", weight: 2 },
];

// -------------------------------------------------------------------
// C) Complexity signal dictionaries
// -------------------------------------------------------------------
const SCOPE_WORDS = [
  "system", "pipeline", "platform", "infrastructure", "engine",
  "integration", "architecture", "framework", "bank", "library",
  "workflow", "registry", "repository", "service", "module",
  "backend", "frontend", "database", "schema",
];

const UX_SURFACE_WORDS = [
  "ui", "ux", "flow", "experience", "interface", "layout",
  "navigation", "screen", "page", "modal", "onboarding",
];

const BREADTH_WORDS = [
  "across", "entire", "whole", "end-to-end", "end to end",
  "every", "all", "multi", "multi-", "cross", "cross-",
  "scalable", "scale", "throughout", "system-wide", "platform-wide",
];

const PRODUCTION_SURFACE_RE =
  /(^|\/)(index\.html|main\.|prod\/|production\/|deploy\/|public\/|live\/|dist\/)/i;
const SENSITIVE_SURFACE_RE =
  /(\bauth\b|\bpayment\b|\bcheckout\b|\bbilling\b|\bdatabase\b|\bschema\b|\bDockerfile\b|(^|\/)\.env(?:$|\/|\.))/i;
const MR_AUTHORITY_RE = /MR-\d{3,}/i;

const RISK_ORDER = { LOW: 0, MED: 1, HIGH: 2 };

const PHASE_COUNT_TABLE = {
  AUDIT: { LOW: 1, MED: 2, HIGH: 3 },
  FIX: { LOW: 2, MED: 2, HIGH: 3 },
  BUILD: { LOW: 2, MED: 3, HIGH: 4 },
  DEPLOY: { LOW: 2, MED: 3, HIGH: 3 },
  CONTENT: { LOW: 1, MED: 2, HIGH: 3 },
  PLAN: { LOW: 1, MED: 1, HIGH: 1 },
  SYSTEM_MIGRATION: { LOW: 3, MED: 4, HIGH: 5 },
};

const CVC_ENDING_RE = /[bcdfghjklmnpqrstvwxz][aeiou][bcdfghjklmnprstvwxz]$/i;
const VERB_TOKENS = [
  "build", "create", "add", "generate", "scaffold", "implement",
  "introduce", "make", "produce", "construct", "initialize", "set up",
  "stand up", "wire", "wire up", "embed", "enable", "hook", "hook up",
  "connect", "extend", "augment", "bolt on", "plug in", "audit",
  "validate", "verify", "check", "review", "inspect", "confirm",
  "assess", "examine", "certify", "test", "improve", "optimize",
  "tune", "harden", "polish", "refine", "revamp", "enhance", "elevate",
  "modernize", "evaluate", "analyze", "analyse", "benchmark", "upgrade",
  "fix", "repair", "debug", "patch", "resolve", "correct", "unbreak",
  "recover", "mend", "restore", "hotfix", "revert", "stabilize",
  "deploy", "push", "publish", "release", "ship", "launch", "roll out",
  "cutover", "go live", "promote", "rollout", "go-live", "cut over",
  "cut-over", "roll-out", "rewrite", "draft", "plan", "design",
  "architect", "scope", "define", "specify", "sketch", "map out",
  "migrate", "refactor", "split", "consolidate", "restructure",
  "reorganize", "rename", "move", "extract", "merge", "transition",
  "decompose", "integrate", "unify", "orchestrate", "decouple",
  "rewire", "bridge", "centralize", "centralise",
];

const GARBAGE_ALPHA_DENSITY_THRESHOLD = 0.5;
const GARBAGE_MEANINGFUL_WORD_RATIO_THRESHOLD = 0.34;
const GARBAGE_MIN_LENGTH = 5;

// -------------------------------------------------------------------
// Utilities
// -------------------------------------------------------------------
function escapeRegex(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toStringOrEmpty(value) {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value);
}

function normalizeTargets(targets) {
  if (!Array.isArray(targets)) {
    return [];
  }
  return targets.map(toStringOrEmpty).map((v) => v.trim()).filter(Boolean);
}

function normalizeMinimalInput(input) {
  const safe = input && typeof input === "object" ? input : {};
  return {
    goal: toStringOrEmpty(safe.goal).trim(),
    target: normalizeTargets(safe.target || safe.targets),
    constraint: toStringOrEmpty(
      safe.constraint !== undefined ? safe.constraint : safe.constraints
    ).trim(),
  };
}

function makeBoundaryRegex(term) {
  const trimmed = toStringOrEmpty(term).trim();
  if (!trimmed) {
    return null;
  }
  return new RegExp("\\b" + escapeRegex(trimmed) + "\\b", "i");
}

function keywordMatchType(text, keyword) {
  const loweredText = toStringOrEmpty(text).toLowerCase();
  const token = toStringOrEmpty(keyword).trim();
  if (!loweredText || !token) {
    return "none";
  }

  const escaped = escapeRegex(token);
  const isSingleAlpha = /^[A-Za-z]+$/.test(token) && token.length >= 3;
  if (!isSingleAlpha) {
    const strictRe = new RegExp("\\b" + escaped + "\\b", "i");
    return strictRe.test(loweredText) ? "standard" : "none";
  }

  const standardRe = new RegExp("\\b" + escaped + "(?:s|es|ed|ing)?\\b", "i");
  if (standardRe.test(loweredText)) {
    return "standard";
  }

  if (token.length >= 3 && CVC_ENDING_RE.test(token.toLowerCase())) {
    const last = escapeRegex(token[token.length - 1]);
    const cvcRe = new RegExp("\\b" + escaped + last + "(?:ed|ing)\\b", "i");
    if (cvcRe.test(loweredText)) {
      return "cvc";
    }
  }

  return "none";
}

function updateInflectionMatchType(currentType, newType) {
  if (currentType === "cvc" || newType === "none") {
    return currentType;
  }
  if (newType === "cvc") {
    return "cvc";
  }
  if (currentType === "none" && newType === "standard") {
    return "standard";
  }
  return currentType;
}

function hasWholeWord(text, keyword) {
  return keywordMatchType(text, keyword) !== "none";
}

function hasWholeWordStrict(text, keyword) {
  const re = new RegExp("\\b" + escapeRegex(keyword) + "\\b", "i");
  return re.test(text);
}

function containsSubstring(text, phrase) {
  return text.indexOf(phrase.toLowerCase()) !== -1;
}

function containsVerb(goal) {
  const loweredGoal = toStringOrEmpty(goal).toLowerCase();
  if (!loweredGoal) {
    return false;
  }
  return VERB_TOKENS.some((verb) => hasWholeWord(loweredGoal, verb));
}

const COMPILED_PHRASE_BOOSTERS = PHRASE_BOOSTERS.map((booster) => ({
  booster,
  phraseRe: makeBoundaryRegex(booster.phrase),
  requiresRe: Array.isArray(booster.requires)
    ? booster.requires.map(makeBoundaryRegex).filter(Boolean)
    : [],
}));

const MEANINGFUL_SIGNAL_WORDS = new Set(
  []
    .concat(ALL_KEYWORDS)
    .concat(SCOPE_WORDS)
    .concat(UX_SURFACE_WORDS)
    .concat(BREADTH_WORDS)
    .concat(["broken", "error", "crash", "bug", "fail", "failing", "regression"])
    .concat(["auth", "payment", "checkout", "billing", "database", "schema"])
    .flatMap((entry) =>
      toStringOrEmpty(entry)
        .toLowerCase()
        .split(/[^a-z]+/i)
        .filter((token) => token.length >= 3)
    )
);

function alphaDensity(text) {
  const source = toStringOrEmpty(text);
  if (!source) {
    return 0;
  }
  const alphaChars = (source.match(/[A-Za-z]/g) || []).length;
  return alphaChars / Math.max(source.length, 1);
}

function meaningfulWordRatio(text) {
  const words = (toStringOrEmpty(text).toLowerCase().match(/[a-z]+/g) || []);
  if (words.length === 0) {
    return 0;
  }
  const meaningfulCount = words.filter(
    (word) => word.length >= 3 && MEANINGFUL_SIGNAL_WORDS.has(word)
  ).length;
  return meaningfulCount / words.length;
}

function isGarbageInput(text) {
  const source = toStringOrEmpty(text);
  if (source.length < GARBAGE_MIN_LENGTH) {
    return false;
  }
  return (
    alphaDensity(source) < GARBAGE_ALPHA_DENSITY_THRESHOLD ||
    meaningfulWordRatio(source) < GARBAGE_MEANINGFUL_WORD_RATIO_THRESHOLD
  );
}

// -------------------------------------------------------------------
// Keyword scoring (v2: adds phrase boosters)
// -------------------------------------------------------------------
function scoreTaskTypeTextDetailed(text) {
  const scores = {
    BUILD: 0,
    AUDIT: 0,
    FIX: 0,
    DEPLOY: 0,
    CONTENT: 0,
    PLAN: 0,
    SYSTEM_MIGRATION: 0,
  };
  const lowered = text.toLowerCase();
  const matchedKeywords = [];
  const matchedKeywordSet = new Set();
  const matchedPhrases = [];
  const matchedPhraseSet = new Set();
  let inflectionMatchType = "none";
  const phraseBoundaryApplied = true;

  // Stage 1: single-keyword hits
  TASK_TYPES.forEach((taskType) => {
    TASK_KEYWORDS[taskType].forEach((keyword) => {
      const matchType = keywordMatchType(lowered, keyword);
      if (matchType !== "none") {
        scores[taskType] += 1;
        inflectionMatchType = updateInflectionMatchType(
          inflectionMatchType,
          matchType
        );
        if (!matchedKeywordSet.has(keyword)) {
          matchedKeywordSet.add(keyword);
          matchedKeywords.push(keyword);
        }
      }
    });
  });

  // Stage 2: phrase booster hits (deterministic boundary-regex checks)
  if (containsVerb(lowered)) {
    COMPILED_PHRASE_BOOSTERS.forEach((compiled) => {
      if (!compiled.phraseRe || !compiled.phraseRe.test(lowered)) {
        return;
      }
      if (compiled.requiresRe.length > 0) {
        const anyMatch = compiled.requiresRe.some((reqRe) => reqRe.test(lowered));
        if (!anyMatch) {
          return;
        }
      }
      scores[compiled.booster.type] += compiled.booster.weight;
      if (!matchedPhraseSet.has(compiled.booster.phrase)) {
        matchedPhraseSet.add(compiled.booster.phrase);
        matchedPhrases.push(compiled.booster.phrase);
      }
    });
  }

  return {
    scores,
    matchedKeywords,
    matchedPhrases,
    inflectionMatchType,
    phraseBoundaryApplied,
  };
}

function scoreTaskTypeText(text) {
  return scoreTaskTypeTextDetailed(text).scores;
}

function pickTaskTypeFromScores(scores) {
  const maxScore = Math.max(...Object.values(scores));
  if (maxScore === 0) {
    return { taskType: null, confidence: 0, method: "classifier_empty", scores };
  }

  const winners = TASK_TYPES.filter((taskType) => scores[taskType] === maxScore);
  if (winners.length === 1) {
    return {
      taskType: winners[0],
      confidence: maxScore,
      method: "classifier_unique",
      scores,
    };
  }

  for (const candidate of TASK_PRIORITY) {
    if (winners.includes(candidate)) {
      return {
        taskType: candidate,
        confidence: maxScore,
        method: "classifier_tiebreak",
        scores,
      };
    }
  }

  return { taskType: null, confidence: 0, method: "classifier_empty", scores };
}

// -------------------------------------------------------------------
// Scope-heuristic fallback (v2 NEW)
// When the keyword classifier AND phrase boosters both return nothing,
// we scan for scope/UX/breadth words to infer intent. Still fully
// deterministic: every branch is a fixed conditional on explicit token
// counts.
// -------------------------------------------------------------------
function scopeHeuristicFallback(goal) {
  const lowered = toStringOrEmpty(goal).toLowerCase();
  if (!lowered) {
    return { taskType: null, method: "scope_heuristic_empty" };
  }

  const scopeHits = SCOPE_WORDS.filter((w) =>
    hasWholeWord(lowered, w)
  ).length;
  const uxHits = UX_SURFACE_WORDS.filter((w) =>
    hasWholeWord(lowered, w)
  ).length;
  const breakageHits = [
    "broken", "error", "crash", "bug", "fail", "failing", "regression",
  ].filter((w) => hasWholeWord(lowered, w)).length;
  const deployHits = [
    "production", "prod", "live", "staging",
  ].filter((w) => hasWholeWord(lowered, w)).length;

  if (scopeHits >= 2) {
    return { taskType: "SYSTEM_MIGRATION", method: "scope_heuristic_system" };
  }
  if (breakageHits >= 1) {
    return { taskType: "FIX", method: "scope_heuristic_fix" };
  }
  if (uxHits >= 3) {
    return { taskType: "AUDIT", method: "scope_heuristic_ux" };
  }
  if (deployHits >= 1) {
    return { taskType: "DEPLOY", method: "scope_heuristic_deploy" };
  }
  if (scopeHits >= 1 || uxHits >= 1) {
    return { taskType: "BUILD", method: "scope_heuristic_default_build" };
  }
  return { taskType: null, method: "scope_heuristic_unmatched" };
}

// -------------------------------------------------------------------
// Complexity signals (v2: lowered thresholds + new signals)
// -------------------------------------------------------------------
function countVerbMatches(goal) {
  const loweredGoal = toStringOrEmpty(goal).toLowerCase();
  let count = 0;
  ALL_KEYWORDS.forEach((keyword) => {
    if (hasWholeWord(loweredGoal, keyword)) {
      count += 1;
    }
  });
  return count;
}

function matchesProductionSurface(targets) {
  return normalizeTargets(targets).some((path) => PRODUCTION_SURFACE_RE.test(path));
}

function matchesSensitiveSurfaceFromNormalized(normalizedContext) {
  const text = [
    toStringOrEmpty(normalizedContext.goal),
    normalizeTargets(normalizedContext.target).join(" "),
    toStringOrEmpty(normalizedContext.constraint),
  ]
    .join(" ")
    .trim();
  return SENSITIVE_SURFACE_RE.test(text);
}

function matchesSensitiveSurface(context) {
  const normalizedContext = normalizeMinimalInput(context);
  return matchesSensitiveSurfaceFromNormalized(normalizedContext);
}

function reversibilityPoints(taskType) {
  if (taskType === "DEPLOY" || taskType === "SYSTEM_MIGRATION") {
    return 2;
  }
  if (taskType === "BUILD" || taskType === "FIX") {
    return 1;
  }
  return 0;
}

function targetCountPoints(targets) {
  const count = normalizeTargets(targets).length;
  if (count >= 5) {
    return 2;
  }
  if (count >= 2) {
    return 1;
  }
  return 0;
}

function goalLengthPoints(goal) {
  // v2: lowered bands. Most substantive product goals are 60-160 chars.
  const len = toStringOrEmpty(goal).length;
  if (len > 160) {
    return 2;
  }
  if (len >= 60) {
    return 1;
  }
  return 0;
}

function verbCountPoints(goal) {
  // v2: lowered bands. Real-world goals rarely exceed 4 verbs.
  const count = countVerbMatches(goal);
  if (count >= 4) {
    return 2;
  }
  if (count >= 2) {
    return 1;
  }
  return 0;
}

// v2 NEW: scope-word density bonus
function scopeBreadthPoints(goal) {
  const lowered = toStringOrEmpty(goal).toLowerCase();
  const hits = SCOPE_WORDS.filter((w) => hasWholeWord(lowered, w)).length;
  if (hits >= 3) {
    return 2;
  }
  if (hits >= 2) {
    return 1;
  }
  return 0;
}

// v2 NEW: UX-surface density bonus
function uxSurfacePoints(goal) {
  const lowered = toStringOrEmpty(goal).toLowerCase();
  const hits = UX_SURFACE_WORDS.filter((w) => hasWholeWord(lowered, w)).length;
  if (hits >= 4) {
    return 2;
  }
  if (hits >= 3) {
    return 1;
  }
  return 0;
}

// v2 NEW: breadth-word bonus (scalable, cross-system, end-to-end, etc.)
function breadthWordPoints(goal) {
  const lowered = toStringOrEmpty(goal).toLowerCase();
  const hit = BREADTH_WORDS.some((w) => containsSubstring(lowered, w));
  return hit ? 1 : 0;
}

// v2 NEW: multi-intent bonus - goal meaningfully spans >=3 task types
function multiIntentPoints(scores) {
  const activeTypes = TASK_TYPES.filter((t) => scores[t] >= 1).length;
  if (activeTypes >= 3) {
    return 1;
  }
  return 0;
}

function computeComplexitySignalBreakdown(normalized, resolvedTaskType, scores) {
  const goalLengthScore = goalLengthPoints(normalized.goal);
  const verbCountScore = verbCountPoints(normalized.goal);

  const targetCountScore = targetCountPoints(normalized.target);
  const scopeWordScore = scopeBreadthPoints(normalized.goal);
  const scopeDensityScore = targetCountScore + scopeWordScore;

  const productionSurfaceScore = matchesProductionSurface(normalized.target) ? 1 : 0;
  const uxSurfaceScore = uxSurfacePoints(normalized.goal);
  const uxSignalScore = productionSurfaceScore + uxSurfaceScore;

  const breadthWordScore = breadthWordPoints(normalized.goal);
  const reversibilityScore = reversibilityPoints(resolvedTaskType);
  const authorityScore = MR_AUTHORITY_RE.test(normalized.constraint) ? 1 : 0;
  const breadthScore = breadthWordScore + reversibilityScore + authorityScore;

  const multiIntentScore = multiIntentPoints(scores);

  const totalComplexityScore =
    goalLengthScore +
    verbCountScore +
    scopeDensityScore +
    uxSignalScore +
    breadthScore +
    multiIntentScore;

  return {
    complexitySignals: {
      goalLengthScore,
      verbCountScore,
      scopeDensityScore,
      uxSignalScore,
      breadthScore,
      multiIntentScore,
    },
    computedTotals: {
      totalComplexityScore,
    },
  };
}

function complexityFromScore(score) {
  if (score <= 2) {
    return "LOW";
  }
  if (score <= 5) {
    return "MED";
  }
  return "HIGH";
}

function normalizeTaskType(taskType) {
  const type = toStringOrEmpty(taskType).toUpperCase().trim();
  return TASK_TYPES.includes(type) ? type : null;
}

function maxRisk(a, b) {
  return RISK_ORDER[a] >= RISK_ORDER[b] ? a : b;
}

function inferPhaseCount(taskType, complexity) {
  const safeType = normalizeTaskType(taskType) || "PLAN";
  const safeComplexity = ["LOW", "MED", "HIGH"].includes(complexity)
    ? complexity
    : "LOW";
  return PHASE_COUNT_TABLE[safeType][safeComplexity];
}

// -------------------------------------------------------------------
// AI fallback - preserved for backward compatibility. In v2 this is
// effectively the same as the primary classifier on goal-only text
// (deterministic, no temperature / no non-determinism).
// -------------------------------------------------------------------
function classifyTaskTypeAIFallback(minimalInput) {
  const goal = toStringOrEmpty(minimalInput.goal).trim();
  if (!goal) {
    return { taskType: null, method: "ai_fallback_fixed_prompt", confidence: 0 };
  }
  const scores = scoreTaskTypeText(goal);
  const picked = pickTaskTypeFromScores(scores);
  if (!picked.taskType) {
    return { taskType: null, method: "ai_fallback_fixed_prompt", confidence: 0 };
  }
  return {
    taskType: picked.taskType,
    method: "ai_fallback_fixed_prompt",
    confidence: picked.confidence,
  };
}

function computeMetadataConfidence(primary, usedFallback, usedHeuristic, defaultedPlan) {
  if (defaultedPlan) {
    return 0.2;
  }
  if (usedHeuristic) {
    return 0.4;
  }
  if (usedFallback) {
    return 0.5;
  }
  if (!primary || primary.confidence <= 0) {
    return 0;
  }
  if (primary.method === "classifier_tiebreak") {
    return Math.min(1, Number((0.5 + primary.confidence * 0.06).toFixed(2)));
  }
  return Math.min(1, Number((0.6 + primary.confidence * 0.07).toFixed(2)));
}

// -------------------------------------------------------------------
// Public API
// -------------------------------------------------------------------
function classifyTaskType(goal, target, constraint) {
  const normalized = normalizeMinimalInput({ goal, target, constraint });
  const text = [normalized.goal, normalized.target.join(" "), normalized.constraint]
    .join(" ")
    .toLowerCase();
  const scores = scoreTaskTypeText(text);
  return pickTaskTypeFromScores(scores);
}

function computeComplexity(input) {
  const normalized = normalizeMinimalInput(input);
  const resolvedTaskType =
    normalizeTaskType(input && input.taskType) ||
    classifyTaskType(normalized.goal, normalized.target, normalized.constraint).taskType ||
    "PLAN";

  // Re-score full text so multiIntent bonus has full-text visibility
  // even when computeComplexity is called directly.
  const fullText = [normalized.goal, normalized.target.join(" "), normalized.constraint]
    .join(" ")
    .toLowerCase();
  const scores = scoreTaskTypeText(fullText);
  const breakdown = computeComplexitySignalBreakdown(
    normalized,
    resolvedTaskType,
    scores
  );
  return complexityFromScore(breakdown.computedTotals.totalComplexityScore);
}

function computeRisk(taskType, complexity, context) {
  const safeTaskType = normalizeTaskType(taskType) || "PLAN";
  const safeComplexity = ["LOW", "MED", "HIGH"].includes(complexity)
    ? complexity
    : "LOW";
  const normalizedContext = normalizeMinimalInput(context);

  if (safeTaskType === "DEPLOY" || safeTaskType === "SYSTEM_MIGRATION") {
    return "HIGH";
  }
  if (matchesProductionSurface(normalizedContext.target)) {
    return "HIGH";
  }
  if (matchesSensitiveSurfaceFromNormalized(normalizedContext)) {
    return maxRisk(safeComplexity, "MED");
  }
  if (MR_AUTHORITY_RE.test(normalizedContext.constraint)) {
    return maxRisk(safeComplexity, "MED");
  }
  if (safeComplexity === "HIGH") {
    return "HIGH";
  }
  if (safeComplexity === "MED") {
    return "MED";
  }
  return "LOW";
}

function interpretInput(minimalInput) {
  const normalized = normalizeMinimalInput(minimalInput);
  const reasoningFlags = [];
  const fullText = [normalized.goal, normalized.target.join(" "), normalized.constraint]
    .join(" ")
    .toLowerCase();
  const classifierTrace = scoreTaskTypeTextDetailed(fullText);
  const hasClassificationSignal =
    classifierTrace.matchedKeywords.length > 0 ||
    classifierTrace.matchedPhrases.length > 0;
  const garbageInputDetected =
    isGarbageInput(normalized.goal) && !hasClassificationSignal;
  const sensitiveSurfaceDetected = matchesSensitiveSurfaceFromNormalized(normalized);

  // Ambiguity gate: truly empty or sub-5-char goal is the ONLY
  // condition that deterministically requires user confirmation.
  const trulyEmpty = normalized.goal.length < 5;

  const classifierResult = classifyTaskType(
    normalized.goal,
    normalized.target,
    normalized.constraint
  );

  let taskType = classifierResult.taskType;
  let usedFallback = false;
  let usedHeuristic = false;
  let defaultedPlan = false;

  if (taskType === null) {
    reasoningFlags.push("classifier_empty");
    reasoningFlags.push("ai_fallback_temperature_0");
    const fallback = classifyTaskTypeAIFallback(normalized);
    usedFallback = true;
    if (normalizeTaskType(fallback.taskType)) {
      taskType = fallback.taskType;
      reasoningFlags.push("ai_fallback_fixed_mapping");
    } else {
      // v2 NEW: scope-heuristic fallback BEFORE defaulting to PLAN
      const heuristic = scopeHeuristicFallback(normalized.goal);
      if (normalizeTaskType(heuristic.taskType)) {
        taskType = heuristic.taskType;
        usedHeuristic = true;
        reasoningFlags.push(heuristic.method);
        reasoningFlags.push("low_confidence_interpretation");
      } else if (trulyEmpty) {
        taskType = "PLAN";
        defaultedPlan = true;
        reasoningFlags.push("fallback_default_plan");
        reasoningFlags.push("needs_user_confirmation");
      } else {
        // v2: non-empty but unclassifiable by all three stages.
        // Default to BUILD (most common intent) with low_confidence
        // flag, NOT a hard-blocking needs_user_confirmation.
        taskType = "BUILD";
        usedHeuristic = true;
        reasoningFlags.push("default_build_no_signal");
        reasoningFlags.push("low_confidence_interpretation");
      }
    }
  } else {
    reasoningFlags.push(classifierResult.method);
    if (classifierResult.method === "classifier_tiebreak") {
      reasoningFlags.push("priority_tiebreak_applied");
    }
  }

  // Even if classifier succeeded, surface low_confidence when the
  // winning score is only 1 and another type was close (tie).
  if (
    classifierResult.method === "classifier_tiebreak" &&
    classifierResult.confidence === 1
  ) {
    reasoningFlags.push("low_confidence_interpretation");
  }
  if (
    garbageInputDetected &&
    !reasoningFlags.includes("low_confidence_interpretation")
  ) {
    reasoningFlags.push("low_confidence_interpretation");
  }

  const complexity = computeComplexity({
    goal: normalized.goal,
    target: normalized.target,
    constraint: normalized.constraint,
    taskType,
  });
  const complexityTrace = computeComplexitySignalBreakdown(
    normalized,
    taskType,
    classifierTrace.scores
  );

  const risk = computeRisk(taskType, complexity, {
    goal: normalized.goal,
    target: normalized.target,
    constraint: normalized.constraint,
  });

  if (matchesProductionSurface(normalized.target)) {
    reasoningFlags.push("risk_prod_surface_override");
  }
  if (taskType === "DEPLOY" || taskType === "SYSTEM_MIGRATION") {
    reasoningFlags.push("risk_tasktype_override");
  }
  if (MR_AUTHORITY_RE.test(normalized.constraint)) {
    reasoningFlags.push("mr_authority_detected");
  }

  const ambiguityFlag =
    reasoningFlags.includes("needs_user_confirmation") || garbageInputDetected;

  const inferredPhases = inferPhaseCount(taskType, complexity);
  const confidence = computeMetadataConfidence(
    classifierResult,
    usedFallback,
    usedHeuristic,
    defaultedPlan
  );

  let decisionPath = "KEYWORD_ONLY";
  if (defaultedPlan) {
    decisionPath = "DEFAULT_PLAN";
  } else if (usedHeuristic) {
    decisionPath = "HEURISTIC_FALLBACK";
  } else if (
    classifierTrace.matchedKeywords.length === 0 &&
    classifierTrace.matchedPhrases.length > 0
  ) {
    decisionPath = "PHRASE_DOMINANT";
  } else if (classifierTrace.matchedPhrases.length > 0) {
    decisionPath = "KEYWORD_PLUS_PHRASE";
  } else if (complexityTrace.computedTotals.totalComplexityScore > 2) {
    decisionPath = "KEYWORD_PLUS_COMPLEXITY";
  }

  const debugTrace = {
    keywordScores: {
      BUILD: classifierResult.scores.BUILD,
      AUDIT: classifierResult.scores.AUDIT,
      FIX: classifierResult.scores.FIX,
      DEPLOY: classifierResult.scores.DEPLOY,
      CONTENT: classifierResult.scores.CONTENT,
      PLAN: classifierResult.scores.PLAN,
      SYSTEM_MIGRATION: classifierResult.scores.SYSTEM_MIGRATION,
    },
    matchedKeywords: classifierTrace.matchedKeywords,
    matchedPhrases: classifierTrace.matchedPhrases,
    complexitySignals: complexityTrace.complexitySignals,
    computedTotals: complexityTrace.computedTotals,
    decisionPath,
    fallbackUsed: usedHeuristic || defaultedPlan,
    ambiguityFlag,
    phraseBoundaryApplied: classifierTrace.phraseBoundaryApplied,
    sensitiveSurfaceDetected,
    inflectionMatchType: classifierTrace.inflectionMatchType,
  };

  return {
    taskType,
    complexity,
    risk,
    targets: normalized.target,
    inferredPhases,
    metadata: {
      confidence,
      reasoningFlags,
    },
    debugTrace,
  };
}

module.exports = {
  classifyTaskType,
  computeComplexity,
  computeRisk,
  interpretInput,
  // v2 internals exposed for test harnesses (no downstream consumers
  // depend on these; safe to expose for observability and testing)
  _internal: {
    scoreTaskTypeText,
    scopeHeuristicFallback,
    TASK_KEYWORDS,
    PHRASE_BOOSTERS,
    SCOPE_WORDS,
    UX_SURFACE_WORDS,
    BREADTH_WORDS,
  },
};
