import assert from "node:assert/strict";
import test from "node:test";

import { loadStructuredDossierBundle } from "../tools/import-structured-dossiers.mjs";
import { normalizeStructuredResearchDossier, structuredDossierSummary } from "../adapters/structured-research-dossier-ingest.mjs";
import { reviewResearchCorpus } from "../src/research-review.mjs";

const BUNDLE = new URL("../config/research-dossiers/texas-adult-neurology-2026-09-12.v1.json", import.meta.url);
const DOMAIN_KEYS = [
  "identity_structure", "visa", "step1_policy", "step2_requirement", "step2_timing", "attempts_policy",
  "yog_limit", "usce_requirement", "ecfmg_requirement", "application_deadline_signaling", "current_residents",
  "resident_medical_schools", "resident_composition", "leadership_pd_apd", "core_faculty", "movement_disorders",
  "ms_neuroimmunology", "fellowships", "graduate_outcomes", "board_pass_rate", "salary_benefits",
  "curriculum_training", "why_this_program", "spanish_latino_relevance", "ucc_puerto_rico", "sources_freshness",
];

test("Texas Adult Neurology bundle is complete, identity-safe, and contains no Child Neurology", async () => {
  const ingests = await loadStructuredDossierBundle(BUNDLE);
  const summary = structuredDossierSummary(ingests);
  assert.equal(summary.programs, 16);
  assert.equal(summary.domainsAttempted, 416);
  assert.equal(summary.notYetResearchedDomains, 0);
  assert.equal(summary.newProviderSpendUsd, 0);
  assert.ok(summary.acgmeIds.every((id) => /^180\d{7}$/.test(id)));
  assert.ok(summary.acgmeIds.every((id) => !id.startsWith("185")));
});

test("all attempted domains retain verified, researched-not-public, or conflict truth", async () => {
  const ingests = await loadStructuredDossierBundle(BUNDLE);
  const domainClaims = ingests.flatMap((item) => item.claims.filter((claim) => claim.field.startsWith("research.domain.")));
  const states = Object.groupBy(domainClaims, (claim) => claim.value.state);
  assert.equal(domainClaims.length, 416);
  assert.equal(states.VERIFIED.length, 318);
  assert.equal(states.RESEARCHED_NOT_PUBLIC.length, 70);
  assert.equal(states.CONFLICT.length, 28);
  assert.equal(states.NOT_YET_RESEARCHED, undefined);
  assert.ok(domainClaims.every((claim) => claim.publicationState === "REVIEW_REQUIRED"));
});

test("negative H-1B findings never become affirmative sponsorship evidence", async () => {
  const ingests = await loadStructuredDossierBundle(BUNDLE);
  const visaClaims = ingests.flatMap((item) => item.claims.filter((claim) => claim.field === "research.visa"));
  assert.ok(visaClaims.length > 0);
  assert.ok(visaClaims.every((claim) => claim.value.h1b === false));
  assert.ok(visaClaims.every((claim) => !claim.value.supported.includes("H-1B")));
  assert.ok(visaClaims.some((claim) => /not offered|not sponsored|no H-1B/i.test(claim.value.summary)));
});

test("canonical review promotes safe structured projections and preserves every conflict", async () => {
  const ingests = await loadStructuredDossierBundle(BUNDLE);
  const review = reviewResearchCorpus(ingests, {
    resolvedAcgmeIds: new Map(ingests.map((item) => [item.acgmeId, item.acgmeId])),
  });
  assert.equal(review.decisions.length, 578);
  assert.equal(review.dispositions.APPROVED_CURRENT, 403);
  assert.equal(review.dispositions.RESEARCHED_NOT_FOUND, 137);
  assert.equal(review.dispositions.CONFLICT_REQUIRES_REVIEW, 28);
  assert.equal(review.dispositions.IDENTITY_AMBIGUITY, 0);
  assert.equal(review.promotions.length, 403);
});

test("provider-specific OpenAI routes converge on the canonical OPENAI provider", () => {
  const domains = Object.fromEntries(DOMAIN_KEYS.map((key) => [key, {
    state: "RESEARCHED_NOT_FOUND", normalized_value: "Not publicly found", source_urls: ["https://example.edu/neurology"],
  }]));
  for (const provider of ["OPENAI_TERRA", "OPENAI_SOL", "OPENAI"]) {
    const ingest = normalizeStructuredResearchDossier({
      record: {
        acgme_id: "1804809999", specialty_confirmed: "Adult Neurology",
        child_neurology_contamination_check: "No Child Neurology contamination detected",
        retrieved_date: "2026-09-12", provider, research_ticket: "P1-RISE-5012I-TEST", domains,
      },
      sourceBytes: Buffer.from(provider), sourceFile: `${provider}.json`,
    });
    assert.equal(ingest.provider, "OPENAI");
    assert.equal(ingest.providerKey, provider);
    assert.equal(ingest.domainCount, 26);
    assert.equal(ingest.newSpendUsd, 0);
  }
});
