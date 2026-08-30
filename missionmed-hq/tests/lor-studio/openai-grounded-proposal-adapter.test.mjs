import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isAuthenticOpenAiGroundedProposalAdapter,
  OPENAI_FOREGROUND_TIMEOUT_MS,
  OPENAI_GROUNDED_PROPOSAL_CONTRACT,
  OPENAI_PATH_B_PROCESSING_POLICY,
  OPENAI_PATH_B_PROCESSING_POLICY_DIGEST,
  OpenAiGroundedProposalAdapter,
} from '../../lor-studio/adapters/openai-grounded-proposal-adapter.mjs';
import { IntegrationDisabledError, ValidationError } from '../../lor-studio/domain/errors.js';
import { sha256 } from '../../lor-studio/domain/value-utils.js';
import { AiProposalService } from '../../lor-studio/services/ai-proposal-service.js';

const ENDPOINT = 'https://api.openai.com/v1/responses';
const MODEL = 'gpt-5.6-terra';
const SECRET = 'sk-project-super-secret-test-value';
const FACT_TEXT = 'The applicant consistently prepared thoughtful case summaries.';
const CASE_ID = 'case-openai-adapter';
const PROJECT_ID = 'proj_UTCDEhLVMT6aQnCXnBElihZT';
const RELEASE_COMMIT = '9a7a5f56bbc584ace07472e283b1013ab7897fca';

test('production foreground timeout uses the bounded 30-second provider ceiling', () => {
  assert.equal(OPENAI_FOREGROUND_TIMEOUT_MS, 30_000);
});

const PRIVACY_BINDING = Object.freeze({
  schemaVersion: 'missionmed.lor.openai-project-binding.v2',
  provider: 'openai',
  providerResourceBound: true,
  independentlyVerified: true,
  missionId: 'F2-LOR-1012',
  projectId: PROJECT_ID,
  releaseCommit: RELEASE_COMMIT,
  privacyAuthority: 'DR-139',
  privacyPosture: 'standard_api_retention',
  zeroDataRetentionClaimed: false,
  apiDataTrainingPosture: 'api_content_not_used_for_model_training_by_default',
  processingPolicyDigest: OPENAI_PATH_B_PROCESSING_POLICY_DIGEST,
  educationRecordProcessingAuthorized: true,
});

function input({ facts, evidenceReferences, ...overrides } = {}) {
  const approvedFacts = facts ?? [{ id: 'fact-1', text: FACT_TEXT }];
  return {
    caseId: CASE_ID,
    evidenceReferences: evidenceReferences ?? approvedFacts.map((fact) => ({
      id: fact.id,
      caseId: CASE_ID,
      contentHash: sha256(fact.text),
      sourceType: 'manual_entry',
    })),
    facts: approvedFacts,
    templateVersion: 'lor-template-v1',
    ...overrides,
  };
}

function validProposal(overrides = {}) {
  return {
    state: 'proposal',
    text: FACT_TEXT,
    segments: [{
      kind: 'factual',
      text: FACT_TEXT,
      separator: 'paragraph',
      supportIds: ['fact-1'],
    }],
    claims: [{ text: FACT_TEXT, supportIds: ['fact-1'] }],
    ...overrides,
  };
}

function providerPayload(proposal = validProposal(), overrides = {}) {
  const output = JSON.stringify(proposal);
  return {
    object: 'response',
    status: 'completed',
    model: MODEL,
    error: null,
    output_text: output,
    output: [{
      id: 'message-1',
      type: 'message',
      role: 'assistant',
      status: 'completed',
      content: [{ type: 'output_text', text: output, annotations: [] }],
    }],
    ...overrides,
  };
}

function jsonResponse(payload, {
  url = ENDPOINT,
  status = 200,
  contentType = 'application/json; charset=utf-8',
  declaredLength,
} = {}) {
  const raw = typeof payload === 'string' ? payload : JSON.stringify(payload);
  return {
    url,
    status,
    ok: status >= 200 && status < 300,
    headers: {
      get(name) {
        const normalized = String(name).toLowerCase();
        if (normalized === 'content-type') return contentType;
        if (normalized === 'content-length') {
          return String(declaredLength ?? Buffer.byteLength(raw, 'utf8'));
        }
        return null;
      },
    },
    async text() { return raw; },
  };
}

function credentialProvider(tokens = [SECRET]) {
  const calls = [];
  let index = 0;
  return {
    serverOnly: true,
    calls,
    async getBearerToken(request) {
      calls.push(request);
      return tokens[Math.min(index++, tokens.length - 1)];
    },
  };
}

function harness({
  response = jsonResponse(providerPayload()),
  fetchImplementation,
  binding = PRIVACY_BINDING,
  credentials = credentialProvider(),
  timeoutMs = 100,
} = {}) {
  const calls = [];
  const fetcher = fetchImplementation ?? (async (url, options) => {
    calls.push({ url, options });
    return response;
  });
  const adapter = new OpenAiGroundedProposalAdapter({
    binding,
    credentialProvider: credentials,
    fetchImplementation: fetcher,
    timeoutMs,
  });
  return { adapter, calls, credentials };
}

function assertSafeFailure(error) {
  assert.ok(error instanceof IntegrationDisabledError);
  assert.equal(error.code, 'INTEGRATION_DISABLED');
  assert.equal(String(error).includes(SECRET), false);
  assert.equal(JSON.stringify(error).includes(SECRET), false);
  assert.equal('cause' in error, false);
  return true;
}

test('only exact successfully constructed OpenAI adapters satisfy the private authenticity brand', () => {
  const { adapter } = harness();
  assert.equal(isAuthenticOpenAiGroundedProposalAdapter(adapter), true);

  for (const lookalike of [
    null,
    {},
    {
      providerId: 'openai',
      modelId: MODEL,
      durability: 'EXTERNAL_PROVIDER_STANDARD_API_RETENTION_BOUND',
      async generateProposal() {},
    },
    Object.create(OpenAiGroundedProposalAdapter.prototype),
    new Proxy(adapter, {}),
  ]) {
    assert.equal(isAuthenticOpenAiGroundedProposalAdapter(lookalike), false);
  }

  class OverriddenOpenAiAdapter extends OpenAiGroundedProposalAdapter {
    async generateProposal() { return { state: 'proposal' }; }
  }
  const overridden = new OverriddenOpenAiAdapter({
    binding: PRIVACY_BINDING,
    credentialProvider: credentialProvider(),
    fetchImplementation: async () => jsonResponse(providerPayload()),
    timeoutMs: 100,
  });
  assert.equal(
    isAuthenticOpenAiGroundedProposalAdapter(overridden),
    false,
    'a subclass can run super(), but cannot inherit production authenticity for overridden behavior',
  );
});

test('constructor fails closed without verified privacy controls and education-record processing authority', () => {
  const invalidBindings = [
    null,
    {},
    { ...PRIVACY_BINDING, independentlyVerified: false },
    { ...PRIVACY_BINDING, providerResourceBound: false },
    { ...PRIVACY_BINDING, missionId: 'F2-LOR-1013' },
    { ...PRIVACY_BINDING, projectId: 'wrong-project-shape' },
    { ...PRIVACY_BINDING, projectId: 'proj_lorproduction123' },
    { ...PRIVACY_BINDING, releaseCommit: 'wrong-release' },
    { ...PRIVACY_BINDING, privacyAuthority: 'DR-133' },
    { ...PRIVACY_BINDING, privacyPosture: 'zero_data_retention' },
    { ...PRIVACY_BINDING, zeroDataRetentionClaimed: true },
    { ...PRIVACY_BINDING, apiDataTrainingPosture: 'training_opt_out' },
    { ...PRIVACY_BINDING, processingPolicyDigest: 'a'.repeat(64) },
    { ...PRIVACY_BINDING, educationRecordProcessingAuthorized: false },
    Object.fromEntries(
      Object.entries(PRIVACY_BINDING).filter(
        ([key]) => key !== 'educationRecordProcessingAuthorized',
      ),
    ),
    { ...PRIVACY_BINDING, provider: 'not-openai' },
    { ...PRIVACY_BINDING, extra: true },
  ];
  for (const binding of invalidBindings) {
    assert.throws(
      () => new OpenAiGroundedProposalAdapter({
        binding,
        credentialProvider: credentialProvider(),
        fetchImplementation: async () => jsonResponse(providerPayload()),
      }),
      assertSafeFailure,
    );
  }
  assert.throws(
    () => new OpenAiGroundedProposalAdapter({
      binding: PRIVACY_BINDING,
      credentialProvider: { serverOnly: false, getBearerToken: async () => SECRET },
      fetchImplementation: async () => jsonResponse(providerPayload()),
    }),
    assertSafeFailure,
  );
});

test('Responses request has the exact stateless foreground body and server-only authorization header', async () => {
  const credentials = credentialProvider([SECRET, 'sk-project-second-request-token']);
  const { adapter, calls } = harness({ credentials });
  const first = await adapter.generateProposal(input());
  await adapter.generateProposal(input());

  assert.deepEqual(first, {
    state: 'proposal',
    text: FACT_TEXT,
    segments: [{
      kind: 'factual',
      text: FACT_TEXT,
      separator: 'paragraph',
      supportIds: ['fact-1'],
    }],
    claims: [{ text: FACT_TEXT, supportIds: ['fact-1'] }],
    provider: 'openai',
    model: MODEL,
  });
  assert.equal(calls.length, 2);
  assert.equal(credentials.calls.length, 2, 'the bearer token must be obtained once per request');
  assert.deepEqual(credentials.calls, [
    { provider: 'openai', projectId: PROJECT_ID, purpose: 'lor_grounded_proposal' },
    { provider: 'openai', projectId: PROJECT_ID, purpose: 'lor_grounded_proposal' },
  ]);

  const { url, options } = calls[0];
  assert.equal(url, ENDPOINT);
  assert.equal(options.method, 'POST');
  assert.equal(options.redirect, 'error');
  assert.deepEqual(options.headers, {
    Accept: 'application/json',
    Authorization: `Bearer ${SECRET}`,
    'Content-Type': 'application/json',
    'OpenAI-Project': PROJECT_ID,
  });
  const body = JSON.parse(options.body);
  assert.deepEqual(Object.keys(body).sort(), [
    'background',
    'input',
    'instructions',
    'max_output_tokens',
    'model',
    'reasoning',
    'store',
    'text',
  ]);
  assert.equal(body.model, MODEL);
  assert.equal(body.store, false);
  assert.equal(body.background, false);
  assert.equal(body.max_output_tokens, 8_000);
  assert.deepEqual(body.reasoning, { effort: 'medium' });
  assert.deepEqual(Object.keys(body.text.format).sort(), ['name', 'schema', 'strict', 'type']);
  assert.equal(body.text.format.type, 'json_schema');
  assert.equal(body.text.format.strict, true);
  assert.equal(body.text.format.schema.additionalProperties, false);
  assert.ok(Array.isArray(body.text.format.schema.properties.segments.items.anyOf));
  assert.equal('oneOf' in body.text.format.schema.properties.segments.items, false);
  assert.equal(JSON.stringify(body.text.format.schema).includes('uniqueItems'), false,
    'strict Structured Outputs supports bounded arrays but not uniqueItems; local validation enforces uniqueness');
  assert.equal(JSON.stringify(body.text.format.schema).includes('"const"'), false,
    'single-value enums keep the strict schema inside the documented supported subset');

  const providerInput = JSON.parse(body.input);
  assert.deepEqual(providerInput, {
    templateVersion: 'lor-template-v1',
    evidenceReferences: [{ id: 'fact-1', contentHash: sha256(FACT_TEXT) }],
    facts: [{ id: 'fact-1', text: FACT_TEXT }],
  });
  assert.equal(body.input.includes(CASE_ID), false, 'raw case IDs must not cross the provider boundary');
  for (const forbidden of [
    'tools',
    'tool_choice',
    'conversation',
    'previous_response_id',
    'prompt_cache_key',
    'prompt_cache_options',
    'prompt_cache_retention',
    'file',
    'web_search',
  ]) {
    assert.equal(forbidden in body, false, `request must omit ${forbidden}`);
  }
  assert.equal(options.body.includes(SECRET), false);
  assert.equal(JSON.stringify(adapter).includes(SECRET), false);
  assert.equal(calls[1].options.headers.Authorization, 'Bearer sk-project-second-request-token');
  assert.deepEqual(OPENAI_GROUNDED_PROPOSAL_CONTRACT, {
    bindingSchema: 'missionmed.lor.openai-project-binding.v2',
    endpoint: ENDPOINT,
    model: MODEL,
    provider: 'openai',
    missionId: 'F2-LOR-1012',
    privacyAuthority: 'DR-139',
    privacyPosture: 'standard_api_retention',
    standardApiRetentionAccepted: true,
    zeroDataRetentionClaimed: false,
    apiDataTrainingPosture: 'api_content_not_used_for_model_training_by_default',
    processingPolicy: OPENAI_PATH_B_PROCESSING_POLICY,
    processingPolicyDigest: OPENAI_PATH_B_PROCESSING_POLICY_DIGEST,
    store: false,
    background: false,
    structuredOutput: true,
    toolsEnabled: false,
    promptCacheConfigured: false,
    exactProjectBindingRequired: true,
    projectId: PROJECT_ID,
    exactReleaseCommitBindingRequired: true,
    runtimeReleaseIdentity:
      'MMHQ_LOR_RELEASE_COMMIT_exact_40_hex_signed_attestation_and_provider_binding',
    projectZeroDataRetentionRequired: false,
    serverSideCredentialsRequired: true,
    minimumNecessaryProviderPayloadRequired: true,
    conversationsApiEnabled: false,
    filesApiEnabled: false,
    vectorStoresEnabled: false,
    hostedToolsEnabled: false,
    groundingProvenanceRequired: true,
    humanReviewRequired: true,
    automaticFinalization: false,
    sensitiveTelemetryAllowed: false,
    rawProviderRequestDurableRetention: false,
    rawProviderResponseDurableRetention: false,
    educationRecordProcessingAuthorizationRequired: true,
    caseIdentifierSent: false,
  });
});

test('raw Responses API output is accepted without the SDK-only output_text convenience field', async () => {
  const payload = providerPayload();
  delete payload.output_text;
  const { adapter } = harness({ response: jsonResponse(payload) });
  const proposal = await adapter.generateProposal(input());
  assert.equal(proposal.state, 'proposal');
  assert.equal(proposal.text, FACT_TEXT);

  const mismatched = providerPayload();
  mismatched.output_text = JSON.stringify({ ...validProposal(), text: 'Different duplicate.' });
  const rejected = harness({ response: jsonResponse(mismatched) });
  await assert.rejects(() => rejected.adapter.generateProposal(input()), assertSafeFailure);
});

test('project bindings reject accessors without invoking them and expose only a one-way project reference', () => {
  let getterCalls = 0;
  const accessorBinding = { ...PRIVACY_BINDING };
  Object.defineProperty(accessorBinding, 'projectId', {
    enumerable: true,
    get() {
      getterCalls += 1;
      return PROJECT_ID;
    },
  });
  assert.throws(
    () => new OpenAiGroundedProposalAdapter({
      binding: accessorBinding,
      credentialProvider: credentialProvider(),
      fetchImplementation: async () => jsonResponse(providerPayload()),
    }),
    assertSafeFailure,
  );
  assert.equal(getterCalls, 0);

  const { adapter } = harness();
  assert.equal(JSON.stringify(adapter).includes(PROJECT_ID), false);
  assert.equal(
    adapter.privacyBinding.projectRef,
    sha256(`missionmed:lor:openai-project:${PROJECT_ID}`),
  );
  assert.equal(adapter.privacyBinding.missionId, 'F2-LOR-1012');
  assert.equal(adapter.privacyBinding.releaseCommit, RELEASE_COMMIT);
  assert.equal(adapter.privacyBinding.zeroDataRetentionClaimed, false);
  assert.equal(adapter.privacyBinding.educationRecordProcessingAuthorized, true);
});

test('raw case identifiers cannot re-enter provider input through facts, references or template metadata', async () => {
  const { adapter, calls, credentials } = harness();
  const collisionInputs = [
    input({
      facts: [{ id: CASE_ID, text: FACT_TEXT }],
      evidenceReferences: [{
        id: CASE_ID,
        caseId: CASE_ID,
        contentHash: sha256(FACT_TEXT),
        sourceType: 'manual_entry',
      }],
    }),
    input({
      facts: [{ id: 'fact-1', text: `Approved note ${CASE_ID}` }],
      evidenceReferences: [{
        id: 'fact-1',
        caseId: CASE_ID,
        contentHash: sha256(`Approved note ${CASE_ID}`),
        sourceType: 'manual_entry',
      }],
    }),
    input({ templateVersion: `template-${CASE_ID}` }),
  ];
  for (const collisionInput of collisionInputs) {
    await assert.rejects(() => adapter.generateProposal(collisionInput), ValidationError);
  }
  assert.equal(credentials.calls.length, 0);
  assert.equal(calls.length, 0);
});

test('credential and transport failures redact provider details and bearer material', async () => {
  const credentialFailure = harness({
    credentials: {
      serverOnly: true,
      async getBearerToken() { throw new Error(`vault failed for ${SECRET}`); },
    },
  });
  await assert.rejects(() => credentialFailure.adapter.generateProposal(input()), assertSafeFailure);

  const transportFailure = harness({
    fetchImplementation: async () => {
      throw new Error(`upstream exposed ${SECRET}`);
    },
  });
  await assert.rejects(() => transportFailure.adapter.generateProposal(input()), assertSafeFailure);

  const rejected = harness({ response: jsonResponse({ error: { message: SECRET } }, { status: 429 }) });
  await assert.rejects(() => rejected.adapter.generateProposal(input()), assertSafeFailure);
});

test('malformed structured outputs fail closed without returning partial wording', async () => {
  const cases = [
    jsonResponse('{'),
    jsonResponse(providerPayload(validProposal({ extra: true }))),
    jsonResponse(providerPayload(validProposal({
      claims: [{ text: 'Different claim.', supportIds: ['fact-1'] }],
    }))),
    jsonResponse(providerPayload(validProposal({
      segments: [{
        kind: 'factual',
        text: FACT_TEXT,
        separator: 'paragraph',
        supportIds: ['foreign-fact'],
      }],
      claims: [{ text: FACT_TEXT, supportIds: ['foreign-fact'] }],
    }))),
  ];
  for (const response of cases) {
    const { adapter } = harness({ response });
    await assert.rejects(() => adapter.generateProposal(input()), assertSafeFailure);
  }
});

test('canonical proposal text is derived only from validated grounded segments', async () => {
  const response = jsonResponse(providerPayload(validProposal({
    text: `${FACT_TEXT} Ungrounded duplicate text must be discarded.`,
  })));
  const { adapter } = harness({ response });
  const proposal = await adapter.generateProposal(input());
  assert.equal(proposal.text, FACT_TEXT);
  assert.equal(proposal.text.includes('Ungrounded duplicate'), false);
});

test('request and response size limits reject before unsafe processing', async () => {
  const facts = Array.from({ length: 500 }, (_, index) => ({
    id: `fact-${index}`,
    text: `Fact ${index}: ${'x'.repeat(540)}.`,
  }));
  const oversizedInput = harness();
  await assert.rejects(
    () => oversizedInput.adapter.generateProposal(input({ facts })),
    ValidationError,
  );
  assert.equal(oversizedInput.credentials.calls.length, 0, 'invalid input must not fetch a credential');
  assert.equal(oversizedInput.calls.length, 0, 'invalid input must not reach the provider');

  const declaredOversize = harness({
    response: jsonResponse(providerPayload(), { declaredLength: 600_000 }),
  });
  await assert.rejects(() => declaredOversize.adapter.generateProposal(input()), assertSafeFailure);

  const actualOversize = harness({
    response: jsonResponse(`"${'x'.repeat(520_000)}"`, { declaredLength: 10 }),
  });
  await assert.rejects(() => actualOversize.adapter.generateProposal(input()), assertSafeFailure);
});

test('non-completed, wrong-model, refusal and foreign-origin responses all fail closed', async () => {
  const refusal = providerPayload();
  refusal.output_text = '';
  refusal.output[0].content = [{ type: 'refusal', refusal: 'Provider detail must not escape.' }];
  const cases = [
    jsonResponse(providerPayload(validProposal(), { status: 'incomplete' })),
    jsonResponse(providerPayload(validProposal(), { model: 'gpt-5.6-sol' })),
    jsonResponse(refusal),
    jsonResponse(providerPayload(), { url: 'https://example.test/v1/responses' }),
  ];
  for (const response of cases) {
    const { adapter } = harness({ response });
    await assert.rejects(() => adapter.generateProposal(input()), assertSafeFailure);
  }
});

test('timeout aborts the foreground request and returns only a fixed safe failure', async () => {
  let sawAbort = false;
  const { adapter } = harness({
    timeoutMs: 5,
    fetchImplementation: async (_url, options) => new Promise((resolve, reject) => {
      options.signal.addEventListener('abort', () => {
        sawAbort = true;
        reject(new Error(`aborted with ${SECRET}`));
      }, { once: true });
    }),
  });
  await assert.rejects(() => adapter.generateProposal(input()), assertSafeFailure);
  assert.equal(sawAbort, true);
});

test('validated provider output remains compatible with AiProposalService grounding', async () => {
  const { adapter } = harness();
  const service = new AiProposalService({
    provider: adapter,
    clock: () => new Date('2026-08-25T12:00:00.000Z'),
  });
  const proposal = await service.generate(input());
  assert.equal(proposal.state, 'proposal');
  assert.equal(proposal.humanDecisionRequired, true);
  assert.equal(proposal.provenance.provider, 'openai');
  assert.equal(proposal.provenance.model, MODEL);
  assert.deepEqual(proposal.grounding.supportIds, ['fact-1']);
  assert.equal(proposal.grounding.factualSegmentCount, 1);
  assert.equal(proposal.grounding.connectiveSegmentCount, 0);
});
