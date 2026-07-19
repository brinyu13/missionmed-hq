import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  FileSessionLedger,
  MissionMedInterviewerBrain,
  buildInstructorReview,
  deterministicClock,
  deterministicSessionId,
  loadPersona,
  sealContent,
  VERSIONS,
} from "../../src/index.mjs";

const ROOT = new URL("../../", import.meta.url);

export const MOVE_ALIASES = Object.freeze({
  "STAR-gap": "star_gap",
  "injection-defense response": "injection_defense",
  "policy refusal": "policy_refusal",
  "silence recovery": "silence_recovery",
  "designed recovery": "designed_recovery",
  "red-flag clarification": "red_flag_clarification",
  "wrap-up": "wrap_up",
});

export function normalizedMove(value) {
  return MOVE_ALIASES[value] ?? String(value).toLowerCase().replaceAll("-", "_").replaceAll(" ", "_");
}

export function fixtureCategory(fixture) {
  if (fixture.category === "red_flag_clarification") return "red_flag";
  if (["adaptivity", "counterfactual", "star", "persona_consistency", "probe_cap"].includes(fixture.category)) return "behavioral";
  return "general";
}

export function buildFixturePlan(fixture, persona) {
  const slug = fixture.id.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const category = fixtureCategory(fixture);
  return sealContent({
    contract_version: VERSIONS.plan,
    plan_id: `plan:${slug}`,
    revision: 1,
    title: `Synthetic fixture ${fixture.id}`,
    mode: "synthetic_text_phase0",
    session_objective: "Evaluate one bounded synthetic residency interview behavior.",
    persona_ref: {
      persona_id: persona.persona_id,
      revision: persona.revision,
      content_hash: persona.content_hash,
    },
    duration_target_seconds: 1200,
    total_probe_budget: 8,
    question_families: ["behavioral", "general", "professional_timeline"],
    required_coverage: ["fixture_target"],
    optional_coverage: ["learning"],
    transition_conditions: ["answer_complete", "probe_cap_reached", "low_instructional_value"],
    callback_opportunities: ["material_early_claim_after_ten_turns"],
    wrap_up_criteria: ["fixture_complete", "time_budget_reached"],
    questions: [
      {
        question_id: `question:${slug}`,
        prompt: fixture.opening_question,
        category,
        pressure_rung: fixture.pressure_rung,
        focus_tags: [category === "red_flag" ? "timeline" : "interview-practice"],
        red_flag_boundary: category === "red_flag"
          ? "Clarify chronology, action, outcome, or learning only; do not solicit protected or medical details."
          : null,
        wrap_up: false,
      },
      {
        question_id: `question:${slug}:wrap`,
        prompt: "What would you like an interviewer to understand about what you learned?",
        category: "general",
        pressure_rung: 0,
        focus_tags: ["learning"],
        red_flag_boundary: null,
        wrap_up: true,
      },
    ],
    restricted_topics: [
      "ancestry",
      "citizenship",
      "criminal_history",
      "disability",
      "family_status",
      "medical_history",
      "religion",
      "sexual_orientation",
    ],
    synthetic_only: true,
  });
}

export async function loadFixturePersona(fixture) {
  const filename = fixture.persona_id?.includes("direct")
    ? "direct-program-director.v1.json"
    : "warm-structured.v1.json";
  return loadPersona(new URL(`../../personas/${filename}`, import.meta.url));
}

export async function createFixtureHarness(fixture, options = {}) {
  const directory = options.directory ?? await mkdtemp(join(tmpdir(), "missionmed-y2-brain-"));
  const path = join(directory, "ledger.json");
  const persona = options.persona ?? await loadFixturePersona(fixture);
  const plan = options.plan ?? buildFixturePlan(fixture, persona);
  const clock = options.clock ?? deterministicClock("2026-07-18T12:00:00.000Z", 1000);
  const ledger = await FileSessionLedger.open({ path, clock });
  const brain = new MissionMedInterviewerBrain({ ledger, persona, plan, ...options.components });
  const sessionId = options.sessionId ?? deterministicSessionId(`development:${fixture.id}`);
  await brain.startSession({ sessionId, idempotencyKey: `start:${fixture.id}` });
  return { directory, path, persona, plan, clock, ledger, brain, sessionId };
}

export async function runFixture(fixture, options = {}) {
  const harness = await createFixtureHarness(fixture, options);
  const decisions = [];
  let brain = harness.brain;
  let ledger = harness.ledger;
  const reconnectBefore = new Set(fixture.reconnect_before_turns ?? []);

  try {
    for (const [index, turn] of fixture.turns.entries()) {
      const ordinal = index + 1;
      const reconnect = reconnectBefore.has(ordinal);
      if (reconnect) {
        ledger = await FileSessionLedger.open({ path: harness.path, clock: harness.clock });
        brain = new MissionMedInterviewerBrain({ ledger, persona: harness.persona, plan: harness.plan, ...options.components });
      }
      const result = await brain.processTurn({
        sessionId: harness.sessionId,
        turnId: `turn:${fixture.id.toLowerCase()}:${ordinal}`,
        text: turn.answer,
        idempotencyKey: `turn:${fixture.id}:${ordinal}`,
        recovery: reconnect,
      });
      decisions.push(result.decision);
    }

    const session = ledger.getSession(harness.sessionId);
    return { ...harness, brain, ledger, decisions, session };
  } catch (error) {
    if (!options.keepDirectory) await rm(harness.directory, { recursive: true, force: true });
    throw error;
  }
}

export async function readDevelopmentFixtures() {
  return JSON.parse(await readFile(new URL("../../fixtures/development/cases.json", import.meta.url), "utf8"));
}

export async function cleanupRun(run) {
  await rm(run.directory, { recursive: true, force: true });
}

export function decisionEvents(session) {
  return session.events.filter((event) => event.event_type === "interviewer.turn.decided" || event.event_type === "session.reconnected");
}

export function instructorReview(session) {
  const started = performance.now();
  const report = buildInstructorReview(session);
  return {
    ...report,
    review_generation_seconds: (performance.now() - started) / 1000,
  };
}

export { ROOT };
