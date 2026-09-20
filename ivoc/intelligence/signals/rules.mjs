// IVOC Application Intelligence — deterministic attention-signal rules.
// Version `ais_rules@2026-09-18.1` (donor packet §3.4, AIS-R01…R12).
//
// Every probe is a template filled only with attribute values that are present.
// Nothing is invented; when a value is absent the template degrades to a neutral
// phrase or the probe is omitted. Every probe passes `assertProbeText`.

import { assertAttentionSignal, assertProbeText, INTERVIEWER_ROLES } from '../contracts/attention-signal.mjs';
import { wordCount } from '../contracts/application-fact.mjs';
import { signalId } from '../provenance/receipts.mjs';
import { normalizeLexeme, tokenize } from '../pack/trigger-index.mjs';
import { monthsBetween } from '../normalize/fact-builder.mjs';
import { salienceFor, confidenceFor, programAffinity, round } from './salience.mjs';
import { findInconsistencies, OBJECTIVE_CONCERN_RELATIONS } from './consistency.mjs';

export const AIS_RULES_VERSION = '2026-09-18.1';
export const GAP_MIN_MONTHS = 3;
const ALL_ROLES = [...INTERVIEWER_ROLES];
const CLINICAL_LABEL = Object.freeze({
  usce: 'US clinical experience', observership: 'observership', externship: 'externship',
  home_country: 'clinical work at home', volunteer_clinical: 'clinical volunteering',
});

// ---------------------------------------------------------------- helpers

function keyLexemes(fact) {
  const a = fact.attributes || {};
  const text = [a.title, a.field, a.name, a.setting, a.institution, a.organization, a.role, a.fact,
    ...(Array.isArray(a.specialty_tags) ? a.specialty_tags : []), ...(Array.isArray(a.themes) ? a.themes : []),
    a.text, a.summary].filter((v) => typeof v === 'string').join(' ');
  return new Set(tokenize(text));
}

/** Facts from other projections that share at least one lexeme with `fact`. */
function corroboratingFacts(fact, facts) {
  const mine = new Set([...keyLexemes(fact)].filter((w) => w.length >= 5));
  if (mine.size === 0) return [];
  return facts.filter((other) => other.fact_id !== fact.fact_id
    && other.provenance.projection_id !== fact.provenance.projection_id
    && other.fact_type !== 'program_interest'
    && [...keyLexemes(other)].some((w) => mine.has(w)));
}

function programFactsMatching(fact, facts) {
  const mine = new Set([...keyLexemes(fact)].filter((w) => w.length >= 5));
  return facts.filter((other) => other.fact_type === 'program_interest' && other.attributes.fact
    && [...keyLexemes(other)].some((w) => mine.has(w)));
}

function triggersFor(fact, extra = []) {
  const out = [];
  const extras = extra.flatMap((value) => (typeof value === 'string' ? tokenize(value) : []));
  for (const word of [...extras.map(normalizeLexeme), ...keyLexemes(fact)]) {
    if (word && !out.includes(word)) out.push(word);
    if (out.length >= 12) break;
  }
  return out;
}

function safeProbes(candidates) {
  const probes = [];
  for (const text of candidates) {
    if (typeof text !== 'string' || !text.trim()) continue;
    try { probes.push(assertProbeText(text)); } catch { /* template did not fit the law; omit */ }
    if (probes.length === 3) break;
  }
  return probes;
}

function expiresWith(facts) {
  return [...new Set(facts.map((f) => `${f.provenance.projection_id}@${f.provenance.source_version}`))].sort();
}

function shortEnough(text, max = 8) {
  return typeof text === 'string' && text.trim() && wordCount(text) <= max;
}

function makeSignal(ctx, {
  rule_id, kind, facts, probes, rationale, triggers, stance = 'interviewer_plausible',
  sensitivity, salience, proactive, comparison, allowed_roles = ALL_ROLES,
}) {
  if (probes.length === 0) return null;
  const supporting = facts;
  const affinity = Math.max(0, ...supporting.map((f) => programAffinity(f, ctx.program)), programFactsMatching(supporting[0], ctx.facts).length ? 1 : 0);
  const computedSalience = salience ?? salienceWithAffinity(supporting, ctx, affinity);
  const maxSensitivity = sensitivity ?? (supporting.some((f) => f.sensitivity === 'restricted') ? 'restricted'
    : supporting.some((f) => f.sensitivity === 'guarded') ? 'guarded' : 'routine');
  const proactiveEligible = proactive !== undefined ? proactive : true;
  const signal = {
    schema_version: '1',
    signal_id: signalId(rule_id, supporting.map((f) => f.fact_id)),
    subject_id: ctx.subject_id,
    kind,
    stance,
    fact_refs: supporting.map((f) => f.fact_id).sort(),
    rule_id,
    rules_version: AIS_RULES_VERSION,
    rationale,
    confidence: confidenceFor(supporting),
    salience: computedSalience,
    sensitivity: maxSensitivity,
    proactive_eligible: proactiveEligible && maxSensitivity !== 'restricted' && stance === 'interviewer_plausible',
    reactive_triggers: triggers,
    allowed_roles,
    possible_probes: probes,
    program_affinity: affinity > 0 && ctx.program ? [ctx.program.program_ref] : [],
    expires_with: expiresWith(supporting),
  };
  if (comparison) signal.comparison = comparison;
  return assertAttentionSignal(signal);
}

function salienceWithAffinity(facts, ctx, affinity) {
  // salienceFor computes program affinity from specialty tags; add program-fact lexeme affinity here.
  const base = salienceFor(facts, { now: ctx.now, program: ctx.program });
  const specialtyHit = ctx.program?.specialty && facts.some((f) => programAffinity(f, ctx.program) > 0);
  if (affinity > 0 && !specialtyHit) return round(Math.min(1, base + 0.25));
  return base;
}

// ---------------------------------------------------------------- rules

function ruleResearch(ctx) {
  const out = [];
  for (const fact of ctx.facts.filter((f) => ['research_item', 'publication', 'presentation'].includes(f.fact_type))) {
    const a = fact.attributes;
    const field = typeof a.field === 'string' && a.field.trim() ? a.field.trim() : 'research';
    const corroborated = corroboratingFacts(fact, ctx.facts);
    const supporting = [fact, ...corroborated];
    const probes = safeProbes([
      `What question was your ${field} work trying to answer, and what did you personally do?`,
      `How did the ${field} project change how you think about patient care?`,
      shortEnough(a.title) ? `Walk me through your role in "${a.title}".` : null,
    ]);
    const probe = makeSignal(ctx, {
      rule_id: 'AIS-R01', kind: 'probe_candidate', facts: supporting, probes,
      rationale: `Interviewers often explore research ownership; the application lists ${field} work${corroborated.length ? ' corroborated by another source' : ''}.`,
      triggers: triggersFor(fact, ['research', field, 'project', 'publication', 'study']),
    });
    if (probe) out.push(probe);
    const strength = makeSignal(ctx, {
      rule_id: 'AIS-R01S', kind: 'strength_interest_signal', facts: supporting,
      probes: safeProbes([`Tell me about the part of your ${field} work you are most proud of.`]),
      rationale: `A concrete achievement the student can speak to with authority.`,
      triggers: triggersFor(fact, ['proud', 'achievement', field]),
    });
    if (strength) out.push(strength);
  }
  return out;
}

function timeline(ctx) {
  return ctx.facts
    .filter((f) => ['chronology_period', 'clinical_experience', 'education'].includes(f.fact_type) && f.time_range?.start)
    .sort((x, y) => (x.time_range.start < y.time_range.start ? -1 : x.time_range.start > y.time_range.start ? 1 : (x.fact_id < y.fact_id ? -1 : 1)));
}

function roleLabel(fact) {
  const a = fact.attributes;
  return a.role || (a.subtype ? CLINICAL_LABEL[a.subtype] : null) || a.degree || 'that period';
}

function ruleGaps(ctx) {
  const out = [];
  for (const gap of ctx.facts.filter((f) => f.fact_type === 'gap_period')) {
    const probe = makeSignal(ctx, {
      rule_id: 'AIS-R02', kind: 'clarification_candidate', facts: [gap],
      probes: safeProbes(['Help me understand how you spent that stretch of time between roles.']),
      rationale: 'A period without a listed role; interviewers commonly ask how it was spent.',
      triggers: ['break', 'transition', 'sabbatical', 'pause', 'between', 'stopped', 'waiting'],
      proactive: gap.sensitivity !== 'restricted',
    });
    if (probe) out.push(probe);
  }
  const periods = timeline(ctx).filter((f) => f.time_range?.end);
  for (let i = 0; i + 1 < periods.length; i += 1) {
    const prev = periods[i];
    const next = periods[i + 1];
    const months = monthsBetween(prev.time_range.end, next.time_range.start);
    if (months === null || months < GAP_MIN_MONTHS) continue;
    const probe = makeSignal(ctx, {
      rule_id: 'AIS-R02', kind: 'clarification_candidate', facts: [prev, next],
      probes: safeProbes([`Help me understand how you spent the time between ${roleLabel(prev)} and ${roleLabel(next)}.`]),
      rationale: `About ${months} months separate two listed roles; a common, neutral interviewer question.`,
      triggers: ['break', 'transition', 'sabbatical', 'pause', 'between', 'stopped', 'waiting'],
      sensitivity: 'guarded',
    });
    if (probe) out.push(probe);
  }
  return out;
}

function ruleExams(ctx) {
  const out = [];
  for (const fact of ctx.facts.filter((f) => f.fact_type === 'exam')) {
    const a = fact.attributes;
    const attempts = Number.isInteger(a.attempt_count) ? a.attempt_count : 1;
    if (attempts < 2 && a.outcome !== 'fail') continue;
    const probe = makeSignal(ctx, {
      rule_id: 'AIS-R03', kind: 'clarification_candidate', facts: [fact],
      probes: safeProbes([`Tell me how your preparation for ${a.name} evolved over time.`]),
      rationale: 'Exam history is restricted; asked only when the student raises it and the profile allows a single gentle clarification.',
      triggers: triggersFor(fact, ['exam', 'attempt', 'score', 'step', 'board']),
      sensitivity: 'restricted', proactive: false,
    });
    if (probe) out.push(probe);
  }
  return out;
}

function ruleClinical(ctx) {
  const out = [];
  for (const fact of ctx.facts.filter((f) => f.fact_type === 'clinical_experience')) {
    const a = fact.attributes;
    const label = CLINICAL_LABEL[a.subtype] || 'clinical experience';
    const where = a.institution || a.setting;
    const probe = makeSignal(ctx, {
      rule_id: 'AIS-R04', kind: 'probe_candidate', facts: [fact, ...corroboratingFacts(fact, ctx.facts)],
      probes: safeProbes([
        `What did a typical day look like during your ${label} at ${where}, and what were you trusted to do?`,
        `What surprised you most about the US system during your ${label}?`,
      ]),
      rationale: `Depth of ${label} is a routine interviewer topic.`,
      triggers: triggersFor(fact, [a.subtype, 'rotation', 'clinical', 'hospital', 'attending']),
    });
    if (probe) out.push(probe);
  }
  return out;
}

function ruleTransitions(ctx) {
  const out = [];
  const periods = timeline(ctx);
  for (let i = 0; i + 1 < periods.length; i += 1) {
    const prev = periods[i];
    const next = periods[i + 1];
    const kindChanged = (prev.attributes.kind || prev.fact_type) !== (next.attributes.kind || next.fact_type);
    const countryChanged = prev.attributes.country && next.attributes.country && prev.attributes.country !== next.attributes.country;
    if (!kindChanged && !countryChanged) continue;
    const probe = makeSignal(ctx, {
      rule_id: 'AIS-R05', kind: 'probe_candidate', facts: [prev, next],
      probes: safeProbes([`What drew you from ${roleLabel(prev)} to ${roleLabel(next)}, and what did that move ask of you?`]),
      rationale: 'A change of setting or country is a natural motivation-and-adaptation question.',
      triggers: ['transition', 'move', 'moved', 'change', 'decided', 'switch'],
    });
    if (probe) out.push(probe);
  }
  return out;
}

function rulePersonalStatement(ctx) {
  const out = [];
  for (const fact of ctx.facts.filter((f) => f.fact_type === 'personal_statement_claim')) {
    const a = fact.attributes;
    const themes = Array.isArray(a.themes) ? a.themes.filter((t) => typeof t === 'string' && t.trim()).slice(0, 2) : [];
    const corroborated = corroboratingFacts(fact, ctx.facts);
    const supporting = [fact, ...corroborated];
    const probe = makeSignal(ctx, {
      rule_id: 'AIS-R06', kind: 'probe_candidate', facts: supporting,
      probes: safeProbes([
        themes.length ? `You wrote about ${themes.join(' and ')}. Tell me more about what that looked like day to day.` : 'Your personal statement describes a defining experience. Tell me more about what it looked like day to day.',
      ]),
      rationale: 'Interviewers routinely open the personal statement\'s central claim.',
      triggers: triggersFor(fact, themes),
    });
    if (probe) out.push(probe);
    if (corroborated.length > 0) {
      const strength = makeSignal(ctx, {
        rule_id: 'AIS-R06S', kind: 'strength_interest_signal', facts: supporting,
        probes: safeProbes([themes.length ? `What did the ${themes[0]} experience teach you that you still use?` : 'What did that experience teach you that you still use today?']),
        rationale: 'The statement\'s claim is corroborated by another source, so it is safe ground to let the student shine.',
        triggers: triggersFor(fact, themes),
      });
      if (strength) out.push(strength);
    }
  }
  return out;
}

const RELATION_PROBE = Object.freeze({
  date_range_mismatch: (what) => `Help me line up the timeline of ${what}.`,
  count_mismatch: (what) => `Walk me through your ${what} so I have the full picture.`,
  institution_mismatch: () => 'Help me line up where that experience took place.',
  role_title_mismatch: () => 'Help me understand your exact role in that work.',
  claim_absent_in_source: (what) => `Tell me more about ${what}; I would like to place it in your timeline.`,
});

function ruleConsistency(ctx) {
  const out = [];
  const byId = new Map(ctx.facts.map((f) => [f.fact_id, f]));
  for (const finding of findInconsistencies(ctx.facts)) {
    const facts = finding.fact_refs.map((id) => byId.get(id)).filter(Boolean);
    const anchor = facts.find((f) => f.attributes.institution || f.attributes.organization);
    const what = finding.relation === 'count_mismatch'
      ? `${facts.find((f) => f.attributes.asserts?.count_of)?.attributes.asserts.count_of || 'work'}s`.replace(/_/gu, ' ')
      : (anchor?.attributes.institution || anchor?.attributes.organization || (finding.relation === 'claim_absent_in_source' ? facts[0]?.attributes?.asserts?.institution : null) || 'that experience');
    const objective = OBJECTIVE_CONCERN_RELATIONS.has(finding.relation) && finding.both_confident;
    const signal = makeSignal(ctx, {
      rule_id: 'AIS-R07', kind: 'consistency_check', facts,
      probes: safeProbes([RELATION_PROBE[finding.relation](what)]),
      rationale: `Two sources describe the same item differently (${finding.relation.replace(/_/gu, ' ')}). A neutral clarification lets the student align them.`,
      triggers: triggersFor(facts[0], ['timeline', 'months', 'duration', 'when']),
      stance: objective ? 'objective_concern' : 'interviewer_plausible',
      sensitivity: finding.max_sensitivity,
      // A discrepancy's salience is how material it is, not how recent its facts are.
      salience: round(0.5 + 0.5 * finding.magnitude),
      comparison: { a: finding.a, b: finding.b, relation: finding.relation, detail: finding.detail },
    });
    if (signal) out.push(signal);
  }
  return out;
}

function ruleProgram(ctx) {
  if (!ctx.program) return [];
  const identity = ctx.facts.find((f) => f.fact_type === 'program_interest' && f.attributes.name && !f.attributes.fact && !f.attributes.people_role);
  if (!identity) return [];
  const sourced = ctx.facts.filter((f) => f.fact_type === 'program_interest' && f.attributes.fact);
  const signal = makeSignal(ctx, {
    rule_id: 'AIS-R08', kind: 'probe_candidate', facts: [identity, ...sourced].slice(0, 6),
    probes: safeProbes([`Which aspect of ${identity.attributes.name} matters most to you, and why?`]),
    rationale: 'Program fit is asked in almost every interview; only sourced program facts may be spoken.',
    triggers: triggersFor(identity, ['program', identity.attributes.specialty, 'fit', 'apply']),
    salience: round(0.5 + Math.min(0.5, sourced.length * 0.1)),
  });
  return signal ? [signal] : [];
}

function ruleMentor(ctx) {
  const out = [];
  for (const fact of ctx.facts.filter((f) => f.fact_type === 'mentor_priority' && f.attributes.visibility === 'shared' && f.attributes.rank)) {
    const text = fact.attributes.text.trim();
    // A mentor priority phrased as a question is used verbatim; otherwise a neutral probe.
    const candidate = text.endsWith('?') ? text : null;
    const signal = makeSignal(ctx, {
      rule_id: 'AIS-R09', kind: 'probe_candidate', facts: [fact],
      probes: safeProbes([candidate, 'Tell me more about an area you have been working to strengthen.']),
      rationale: 'A mentor-set priority; the pool does not guarantee it, but coaching modes weight it heavily.',
      triggers: triggersFor(fact, ['priority', 'focus']),
      salience: ctx.practice_goal === 'guided_mock' ? 1 : 0.6,
    });
    if (signal) out.push(signal);
  }
  return out;
}

const FACET_PROBE = Object.freeze({
  structure: 'Give me the short version first, then the detail: why this specialty?',
  evidence: 'Can you give me one concrete example that shows that?',
  specificity: 'Can you make that concrete with one specific moment?',
  concision: 'In two sentences, what is the heart of that story?',
});

function rulePriorPattern(ctx) {
  const out = [];
  for (const fact of ctx.facts.filter((f) => f.fact_type === 'prior_ivoc_pattern' && f.attributes.polarity === 'weakness')) {
    const facet = String(fact.attributes.facet || '').toLowerCase();
    const signal = makeSignal(ctx, {
      rule_id: 'AIS-R10', kind: 'probe_candidate', facts: [fact],
      probes: safeProbes([FACET_PROBE[facet] || `Tell me about a time that tested your ${facet}.`]),
      rationale: 'A recurring facet from prior practice; the probe never references earlier sessions.',
      triggers: triggersFor(fact, [facet]),
      salience: ctx.practice_goal === 'guided_mock' ? 0.55 : 0.4,
    });
    if (signal) out.push(signal);
  }
  return out;
}

function ruleStories(ctx) {
  const out = [];
  for (const fact of ctx.facts.filter((f) => f.fact_type === 'story_theme')) {
    const a = fact.attributes;
    const signal = makeSignal(ctx, {
      rule_id: 'AIS-R11', kind: 'strength_interest_signal', facts: [fact],
      probes: safeProbes([shortEnough(a.title, 12) ? `Tell me about "${a.title}".` : 'Tell me about a story from your training that shaped you.']),
      rationale: 'A consented StoryForge story the student has already prepared.',
      triggers: triggersFor(fact, Array.isArray(a.themes) ? a.themes : []),
      proactive: ctx.practice_goal === 'guided_mock',
    });
    if (signal) out.push(signal);
  }
  return out;
}

const COVERAGE_TYPES = ['research_item', 'publication', 'leadership_role', 'teaching_role', 'clinical_experience'];

function ruleCoverage(ctx) {
  return COVERAGE_TYPES.filter((type) => !ctx.facts.some((f) => f.fact_type === type))
    .map((type) => ({ rule_id: 'AIS-R12', note: `no ${type.replace(/_/gu, ' ')} facts in the current inputs`, audience: 'mentor' }));
}

// ---------------------------------------------------------------- entry point

/**
 * @param {object[]} facts   validated ApplicationFacts for one subject
 * @param {object} options  { subject_id, now, program (pack program block or null), practice_goal }
 * @returns {{ signals: object[], coverage_notes: object[], rules_version: string }}
 */
export function deriveSignals(facts, { subject_id, now, program = null, practice_goal } = {}) {
  if (!Array.isArray(facts)) throw new TypeError('facts must be an array');
  if (typeof subject_id !== 'string' || !subject_id) throw new TypeError('subject_id is required');
  if (typeof now !== 'string' || Number.isNaN(Date.parse(now))) throw new TypeError('now must be an ISO timestamp');
  if (!['full_simulation', 'guided_mock', 'individual_question'].includes(practice_goal)) throw new TypeError('practice_goal is invalid');
  for (const fact of facts) {
    if (fact.subject_id !== subject_id) throw new TypeError('facts for another subject cannot derive signals for this one');
  }
  const ctx = { facts, subject_id, now, program, practice_goal };
  const signals = [
    ...ruleResearch(ctx), ...ruleGaps(ctx), ...ruleExams(ctx), ...ruleClinical(ctx), ...ruleTransitions(ctx),
    ...rulePersonalStatement(ctx), ...ruleConsistency(ctx), ...ruleProgram(ctx), ...ruleMentor(ctx),
    ...rulePriorPattern(ctx), ...ruleStories(ctx),
  ];
  const unique = new Map();
  for (const signal of signals) if (!unique.has(signal.signal_id)) unique.set(signal.signal_id, signal);
  const ordered = [...unique.values()].sort((a, b) => b.salience - a.salience || (a.signal_id < b.signal_id ? -1 : 1));
  return { signals: ordered, coverage_notes: ruleCoverage(ctx), rules_version: AIS_RULES_VERSION };
}
