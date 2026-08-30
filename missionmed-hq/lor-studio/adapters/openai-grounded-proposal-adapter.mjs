import { IntegrationDisabledError, ValidationError } from '../domain/errors.js';
import { canonicalize, deepFreeze, sha256 } from '../domain/value-utils.js';
import { AiProposalPort } from '../services/ports.js';

const OPENAI_RESPONSES_ENDPOINT = 'https://api.openai.com/v1/responses';
const OPENAI_MODEL = 'gpt-5.6-terra';
const PROVIDER_ID = 'openai';
const OPENAI_BINDING_SCHEMA = 'missionmed.lor.openai-project-binding.v2';
export const OPENAI_PRODUCTION_PROJECT_ID = 'proj_UTCDEhLVMT6aQnCXnBElihZT';
const OPENAI_PATH_B_MISSION_ID = 'F2-LOR-1012';
const OPENAI_PATH_B_PRIVACY_AUTHORITY = 'DR-139';
const OPENAI_PATH_B_PRIVACY_POSTURE = 'standard_api_retention';
const OPENAI_PATH_B_TRAINING_POSTURE =
  'api_content_not_used_for_model_training_by_default';

export const OPENAI_PATH_B_PROCESSING_POLICY = deepFreeze({
  automaticFinalization: false,
  background: false,
  conversationsApi: false,
  credentialMode: 'server_only',
  filesApi: false,
  groundingProvenance: 'required',
  hostedTools: false,
  humanReview: 'required',
  providerPayload: 'minimum_necessary_grounded_fact_subset_without_case_identifier',
  rawProviderRequestDurableRetention: false,
  rawProviderResponseDurableRetention: false,
  sensitiveTelemetryAllowed: false,
  store: false,
  structuredOutput: true,
  vectorStores: false,
});

export const OPENAI_PATH_B_PROCESSING_POLICY_DIGEST = sha256(
  canonicalize(OPENAI_PATH_B_PROCESSING_POLICY),
);

const OPENAI_BINDING_KEYS = new Set([
  'apiDataTrainingPosture',
  'educationRecordProcessingAuthorized',
  'independentlyVerified',
  'missionId',
  'privacyAuthority',
  'privacyPosture',
  'processingPolicyDigest',
  'projectId',
  'provider',
  'providerResourceBound',
  'releaseCommit',
  'schemaVersion',
  'zeroDataRetentionClaimed',
]);
const RELEASE_COMMIT_PATTERN = /^[a-f0-9]{40}$/u;
const MAX_REQUEST_BYTES = 256_000;
const MAX_RESPONSE_BYTES = 512_000;
const MAX_OUTPUT_TOKENS = 8_000;
const MAX_FACTS = 500;
const MAX_SEGMENTS = 400;
const MAX_TEXT_LENGTH = 40_000;
const MAX_SEGMENT_LENGTH = 4_000;
// Keep the provider request bounded, but allow the production reasoning model enough foreground
// time to complete. The live canary proved that 15 seconds can terminate a healthy request before
// the provider returns; 30 seconds remains the adapter's existing fail-closed maximum.
export const OPENAI_FOREGROUND_TIMEOUT_MS = 30_000;
const SEPARATORS = Object.freeze({ paragraph: '\n\n', line: '\n', inline: ' ' });
const AUTHENTIC_OPENAI_GROUNDED_PROPOSAL_ADAPTERS = new WeakSet();

/**
 * Official contract references (verified 2026-08-25):
 * - https://developers.openai.com/api/reference/resources/responses/methods/create
 * - https://developers.openai.com/api/docs/models/gpt-5.6-terra
 * - https://developers.openai.com/api/docs/guides/your-data
 *
 * This adapter intentionally does not use the OpenAI SDK. A small injected fetch boundary makes
 * the complete wire contract auditable and keeps credentials out of module state, logs, errors,
 * test artifacts, and serialization.
 */

const PROPOSAL_SCHEMA = deepFreeze({
  type: 'object',
  additionalProperties: false,
  required: ['state', 'text', 'segments', 'claims'],
  properties: {
    state: { type: 'string', enum: ['proposal'] },
    text: { type: 'string', minLength: 1, maxLength: MAX_TEXT_LENGTH },
    segments: {
      type: 'array',
      minItems: 1,
      maxItems: MAX_SEGMENTS,
      items: {
        anyOf: [
          {
            type: 'object',
            additionalProperties: false,
            required: ['kind', 'text', 'separator', 'supportIds'],
            properties: {
              kind: { type: 'string', enum: ['factual'] },
              text: { type: 'string', minLength: 1, maxLength: MAX_SEGMENT_LENGTH },
              separator: { type: 'string', enum: ['paragraph', 'line', 'inline'] },
              supportIds: {
                type: 'array',
                minItems: 1,
                maxItems: 32,
                items: { type: 'string', minLength: 1, maxLength: 200 },
              },
            },
          },
          {
            type: 'object',
            additionalProperties: false,
            required: ['kind', 'text', 'separator'],
            properties: {
              kind: { type: 'string', enum: ['connective'] },
              text: { type: 'string', minLength: 1, maxLength: MAX_SEGMENT_LENGTH },
              separator: { type: 'string', enum: ['paragraph', 'line', 'inline'] },
            },
          },
        ],
      },
    },
    claims: {
      type: 'array',
      minItems: 1,
      maxItems: MAX_SEGMENTS,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['text', 'supportIds'],
        properties: {
          text: { type: 'string', minLength: 1, maxLength: MAX_SEGMENT_LENGTH },
          supportIds: {
            type: 'array',
            minItems: 1,
            maxItems: 32,
            items: { type: 'string', minLength: 1, maxLength: 200 },
          },
        },
      },
    },
  },
});

const INSTRUCTIONS = [
  'Draft a recommendation-letter proposal using only the approved facts in the input.',
  'Every material factual sentence must be a factual segment citing the exact supporting fact IDs.',
  'Connective segments may contain non-factual letter furniture only and must omit supportIds.',
  'The top-level text must exactly equal the ordered segment texts joined by each segment separator.',
  'Claims must exactly repeat the factual segments and their supportIds.',
  'Return a proposal only. Never claim approval, signature, finalization, release, or delivery.',
].join(' ');

function unavailable(status) {
  return new IntegrationDisabledError('openai_grounded_proposal', status);
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  try {
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

function hasExactKeys(value, keys) {
  if (!isPlainObject(value)) return false;
  try {
    const actual = Object.keys(value);
    return actual.length === keys.length && actual.every((key) => keys.includes(key));
  } catch {
    return false;
  }
}

function snapshotExactRecord(value, expectedKeys) {
  if (!isPlainObject(value)) return null;
  let ownKeys;
  let descriptors;
  try {
    ownKeys = Reflect.ownKeys(value);
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch {
    return null;
  }
  if (
    ownKeys.length !== expectedKeys.size
    || ownKeys.some((key) => typeof key !== 'string' || !expectedKeys.has(key))
  ) return null;
  const snapshot = {};
  for (const key of expectedKeys) {
    const descriptor = descriptors[key];
    if (
      !descriptor
      || descriptor.enumerable !== true
      || !Object.hasOwn(descriptor, 'value')
    ) return null;
    snapshot[key] = descriptor.value;
  }
  return Object.freeze(snapshot);
}

function assertBinding(rawBinding) {
  const binding = snapshotExactRecord(rawBinding, OPENAI_BINDING_KEYS);
  if (
    !binding
    || binding.schemaVersion !== OPENAI_BINDING_SCHEMA
    || binding.provider !== PROVIDER_ID
    || binding.providerResourceBound !== true
    || binding.independentlyVerified !== true
    || binding.missionId !== OPENAI_PATH_B_MISSION_ID
    || binding.projectId !== OPENAI_PRODUCTION_PROJECT_ID
    || typeof binding.releaseCommit !== 'string'
    || !RELEASE_COMMIT_PATTERN.test(binding.releaseCommit)
    || binding.privacyAuthority !== OPENAI_PATH_B_PRIVACY_AUTHORITY
    || binding.privacyPosture !== OPENAI_PATH_B_PRIVACY_POSTURE
    || binding.zeroDataRetentionClaimed !== false
    || binding.apiDataTrainingPosture !== OPENAI_PATH_B_TRAINING_POSTURE
    || binding.processingPolicyDigest !== OPENAI_PATH_B_PROCESSING_POLICY_DIGEST
    || binding.educationRecordProcessingAuthorized !== true
  ) {
    throw unavailable('OPENAI_PROJECT_PRIVACY_BINDING_REQUIRED');
  }
  return Object.freeze({
    projectId: binding.projectId,
    safeBinding: deepFreeze({
      schemaVersion: OPENAI_BINDING_SCHEMA,
      provider: PROVIDER_ID,
      providerResourceBound: true,
      missionId: OPENAI_PATH_B_MISSION_ID,
      projectRef: sha256(`missionmed:lor:openai-project:${binding.projectId}`),
      releaseCommit: binding.releaseCommit,
      privacyAuthority: OPENAI_PATH_B_PRIVACY_AUTHORITY,
      privacyPosture: OPENAI_PATH_B_PRIVACY_POSTURE,
      zeroDataRetentionClaimed: false,
      apiDataTrainingPosture: OPENAI_PATH_B_TRAINING_POSTURE,
      processingPolicyDigest: OPENAI_PATH_B_PROCESSING_POLICY_DIGEST,
      educationRecordProcessingAuthorized: true,
      independentlyVerified: true,
    }),
  });
}

function assertCredentialProvider(provider) {
  if (
    !provider
    || provider.serverOnly !== true
    || typeof provider.getBearerToken !== 'function'
  ) {
    throw unavailable('OPENAI_SERVER_CREDENTIAL_PROVIDER_REQUIRED');
  }
  return provider;
}

function assertText(value, fieldName, maximum) {
  if (
    typeof value !== 'string'
    || value.trim() !== value
    || value.length === 0
    || value.length > maximum
  ) {
    throw new ValidationError(`${fieldName} is invalid`);
  }
  return value;
}

function normalizeInput(request) {
  if (!hasExactKeys(request, ['caseId', 'evidenceReferences', 'facts', 'templateVersion'])) {
    throw new ValidationError('OpenAI proposal input is outside its exact allowlist');
  }
  const caseId = assertText(request.caseId, 'caseId', 200);
  const templateVersion = assertText(request.templateVersion, 'templateVersion', 200);
  if (
    !Array.isArray(request.facts)
    || request.facts.length === 0
    || request.facts.length > MAX_FACTS
    || !Array.isArray(request.evidenceReferences)
  ) {
    throw new ValidationError('OpenAI proposal input requires bounded facts and evidence references');
  }

  const references = new Map();
  for (const reference of request.evidenceReferences) {
    if (
      !isPlainObject(reference)
      || typeof reference.id !== 'string'
      || reference.id.trim() !== reference.id
      || reference.id.length === 0
      || reference.id.length > 200
      || !/^[a-f0-9]{64}$/u.test(reference.contentHash ?? '')
      || references.has(reference.id)
      || (reference.caseId !== undefined && reference.caseId !== caseId)
    ) {
      throw new ValidationError('OpenAI evidence reference is invalid');
    }
    references.set(reference.id, reference.contentHash);
  }

  const ids = new Set();
  const facts = request.facts.map((fact) => {
    if (
      !isPlainObject(fact)
      || typeof fact.id !== 'string'
      || fact.id.trim() !== fact.id
      || fact.id.length === 0
      || fact.id.length > 200
      || ids.has(fact.id)
    ) {
      throw new ValidationError('OpenAI approved fact is invalid');
    }
    const text = assertText(fact.text, 'fact.text', MAX_SEGMENT_LENGTH);
    if (references.get(fact.id) !== sha256(text)) {
      throw new ValidationError('OpenAI approved fact is not bound to its evidence hash');
    }
    ids.add(fact.id);
    return { id: fact.id, text };
  });

  const evidenceReferences = facts.map((fact) => ({
    id: fact.id,
    contentHash: references.get(fact.id),
  }));
  const normalized = { caseId, templateVersion, evidenceReferences, facts };
  if (Buffer.byteLength(JSON.stringify(normalized), 'utf8') > MAX_REQUEST_BYTES) {
    throw new ValidationError('OpenAI proposal input exceeds its safety limit');
  }
  return normalized;
}

function requestBody(input) {
  const providerInput = {
    templateVersion: input.templateVersion,
    evidenceReferences: input.evidenceReferences,
    facts: input.facts,
  };
  const pending = [providerInput];
  while (pending.length > 0) {
    const value = pending.pop();
    if (typeof value === 'string') {
      if (value.includes(input.caseId)) {
        throw new ValidationError(
          'OpenAI proposal input contains a case identifier in provider-visible content',
        );
      }
      continue;
    }
    if (Array.isArray(value)) {
      pending.push(...value);
      continue;
    }
    if (isPlainObject(value)) pending.push(...Object.values(value));
  }
  return {
    model: OPENAI_MODEL,
    store: false,
    background: false,
    instructions: INSTRUCTIONS,
    input: JSON.stringify(providerInput),
    max_output_tokens: MAX_OUTPUT_TOKENS,
    reasoning: { effort: 'medium' },
    text: {
      format: {
        type: 'json_schema',
        name: 'missionmed_lor_grounded_proposal',
        strict: true,
        schema: PROPOSAL_SCHEMA,
      },
    },
  };
}

async function readBoundedBody(response) {
  const declared = Number(response?.headers?.get?.('content-length'));
  if (Number.isFinite(declared) && declared > MAX_RESPONSE_BYTES) {
    throw unavailable('OPENAI_PROVIDER_RESPONSE_INVALID');
  }

  if (response?.body && typeof response.body.getReader === 'function') {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let size = 0;
    let text = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!(value instanceof Uint8Array)) throw unavailable('OPENAI_PROVIDER_RESPONSE_INVALID');
      size += value.byteLength;
      if (size > MAX_RESPONSE_BYTES) {
        await reader.cancel().catch(() => {});
        throw unavailable('OPENAI_PROVIDER_RESPONSE_INVALID');
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return text;
  }

  if (typeof response?.text !== 'function') throw unavailable('OPENAI_PROVIDER_RESPONSE_INVALID');
  const text = await response.text();
  if (Buffer.byteLength(text, 'utf8') > MAX_RESPONSE_BYTES) {
    throw unavailable('OPENAI_PROVIDER_RESPONSE_INVALID');
  }
  return text;
}

function outputText(response) {
  if (!Array.isArray(response.output)) throw unavailable('OPENAI_PROVIDER_RESPONSE_INVALID');
  const texts = [];
  for (const item of response.output) {
    if (!isPlainObject(item)) throw unavailable('OPENAI_PROVIDER_RESPONSE_INVALID');
    if (item.type === 'reasoning') continue;
    if (
      item.type !== 'message'
      || item.role !== 'assistant'
      || item.status !== 'completed'
      || !Array.isArray(item.content)
    ) {
      throw unavailable('OPENAI_PROVIDER_RESPONSE_INVALID');
    }
    for (const content of item.content) {
      if (!isPlainObject(content) || content.type !== 'output_text' || typeof content.text !== 'string') {
        throw unavailable('OPENAI_PROVIDER_RESPONSE_INVALID');
      }
      texts.push(content.text);
    }
  }
  if (texts.length !== 1 || response.output_text !== texts[0]) {
    throw unavailable('OPENAI_PROVIDER_RESPONSE_INVALID');
  }
  return texts[0];
}

function normalizeProviderProposal(value, allowedFactIds) {
  if (!hasExactKeys(value, ['state', 'text', 'segments', 'claims']) || value.state !== 'proposal') {
    throw unavailable('OPENAI_PROVIDER_RESPONSE_INVALID');
  }
  if (
    typeof value.text !== 'string'
    || value.text.trim() !== value.text
    || value.text.length === 0
    || value.text.length > MAX_TEXT_LENGTH
    || !Array.isArray(value.segments)
    || value.segments.length === 0
    || value.segments.length > MAX_SEGMENTS
    || !Array.isArray(value.claims)
  ) {
    throw unavailable('OPENAI_PROVIDER_RESPONSE_INVALID');
  }

  const segments = value.segments.map((segment) => {
    if (
      !isPlainObject(segment)
      || !['factual', 'connective'].includes(segment.kind)
      || typeof segment.text !== 'string'
      || segment.text.trim() !== segment.text
      || segment.text.length === 0
      || segment.text.length > MAX_SEGMENT_LENGTH
      || !Object.hasOwn(SEPARATORS, segment.separator)
    ) {
      throw unavailable('OPENAI_PROVIDER_RESPONSE_INVALID');
    }
    if (segment.kind === 'connective') {
      if (!hasExactKeys(segment, ['kind', 'text', 'separator'])) {
        throw unavailable('OPENAI_PROVIDER_RESPONSE_INVALID');
      }
      return { kind: segment.kind, text: segment.text, separator: segment.separator };
    }
    if (
      !hasExactKeys(segment, ['kind', 'text', 'separator', 'supportIds'])
      || !Array.isArray(segment.supportIds)
      || segment.supportIds.length === 0
      || segment.supportIds.length > 32
      || new Set(segment.supportIds).size !== segment.supportIds.length
      || segment.supportIds.some((id) => !allowedFactIds.has(id))
    ) {
      throw unavailable('OPENAI_PROVIDER_RESPONSE_INVALID');
    }
    return {
      kind: segment.kind,
      text: segment.text,
      separator: segment.separator,
      supportIds: [...segment.supportIds],
    };
  });

  const composed = segments
    .map((segment, index) => (index === 0 ? '' : SEPARATORS[segment.separator]) + segment.text)
    .join('');
  if (value.text !== composed) throw unavailable('OPENAI_PROVIDER_RESPONSE_INVALID');

  const factualClaims = segments
    .filter((segment) => segment.kind === 'factual')
    .map((segment) => ({ text: segment.text, supportIds: [...segment.supportIds] }));
  if (
    factualClaims.length === 0
    || value.claims.length !== factualClaims.length
    || JSON.stringify(value.claims) !== JSON.stringify(factualClaims)
  ) {
    throw unavailable('OPENAI_PROVIDER_RESPONSE_INVALID');
  }

  return deepFreeze({
    state: 'proposal',
    text: value.text,
    segments,
    claims: factualClaims,
    provider: PROVIDER_ID,
    model: OPENAI_MODEL,
  });
}

/**
 * Server-only OpenAI Responses adapter. Construction is disabled unless an independently verified,
 * source-pinned project binding records the Founder-approved standard API retention posture,
 * explicitly declines to claim ZDR, binds the exact Path B processing policy, and authorizes this
 * education-record workflow.
 */
export class OpenAiGroundedProposalAdapter extends AiProposalPort {
  #credentialProvider;
  #fetch;
  #projectId;
  #timeoutMs;

  constructor({
    binding,
    credentialProvider,
    fetchImplementation = globalThis.fetch,
    timeoutMs = OPENAI_FOREGROUND_TIMEOUT_MS,
  } = {}) {
    super();
    const validatedBinding = assertBinding(binding);
    this.privacyBinding = validatedBinding.safeBinding;
    this.#projectId = validatedBinding.projectId;
    this.#credentialProvider = assertCredentialProvider(credentialProvider);
    if (typeof fetchImplementation !== 'function') {
      throw unavailable('OPENAI_FETCH_UNAVAILABLE');
    }
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30_000) {
      throw unavailable('OPENAI_TIMEOUT_POLICY_INVALID');
    }
    this.#fetch = fetchImplementation;
    this.#timeoutMs = timeoutMs;
    this.providerId = PROVIDER_ID;
    this.modelId = OPENAI_MODEL;
    this.durability = 'EXTERNAL_PROVIDER_STANDARD_API_RETENTION_BOUND';
    Object.freeze(this);
    AUTHENTIC_OPENAI_GROUNDED_PROPOSAL_ADAPTERS.add(this);
  }

  async generateProposal(request) {
    const input = normalizeInput(request);
    const body = JSON.stringify(requestBody(input));
    if (Buffer.byteLength(body, 'utf8') > MAX_REQUEST_BYTES) {
      throw new ValidationError('OpenAI proposal request exceeds its safety limit');
    }

    let bearerToken = '';
    try {
      bearerToken = await this.#credentialProvider.getBearerToken({
        provider: PROVIDER_ID,
        projectId: this.#projectId,
        purpose: 'lor_grounded_proposal',
      });
    } catch {
      throw unavailable('OPENAI_CREDENTIAL_UNAVAILABLE');
    }
    if (
      typeof bearerToken !== 'string'
      || bearerToken.length < 8
      || bearerToken.length > 4_096
      || /\s/u.test(bearerToken)
    ) {
      bearerToken = '';
      throw unavailable('OPENAI_CREDENTIAL_UNAVAILABLE');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.#timeoutMs);
    try {
      let response;
      try {
        response = await this.#fetch(OPENAI_RESPONSES_ENDPOINT, {
          method: 'POST',
          redirect: 'error',
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${bearerToken}`,
            'Content-Type': 'application/json',
            'OpenAI-Project': this.#projectId,
          },
          body,
          signal: controller.signal,
        });
      } catch {
        throw unavailable('OPENAI_PROVIDER_UNAVAILABLE');
      } finally {
        bearerToken = '';
      }
      if (
        !response
        || response.url !== OPENAI_RESPONSES_ENDPOINT
        || response.ok !== true
        || Number(response.status) !== 200
      ) {
        throw unavailable('OPENAI_PROVIDER_UNAVAILABLE');
      }
      const contentType = String(response.headers?.get?.('content-type') || '').toLowerCase();
      if (!contentType.startsWith('application/json')) {
        throw unavailable('OPENAI_PROVIDER_RESPONSE_INVALID');
      }
      const raw = await readBoundedBody(response);
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        throw unavailable('OPENAI_PROVIDER_RESPONSE_INVALID');
      }
      if (
        !isPlainObject(parsed)
        || parsed.object !== 'response'
        || parsed.status !== 'completed'
        || parsed.model !== OPENAI_MODEL
        || parsed.error
      ) {
        throw unavailable('OPENAI_PROVIDER_RESPONSE_INVALID');
      }
      let structured;
      try {
        structured = JSON.parse(outputText(parsed));
      } catch (error) {
        if (error instanceof IntegrationDisabledError) throw error;
        throw unavailable('OPENAI_PROVIDER_RESPONSE_INVALID');
      }
      return normalizeProviderProposal(structured, new Set(input.facts.map((fact) => fact.id)));
    } catch (error) {
      if (error instanceof IntegrationDisabledError || error instanceof ValidationError) throw error;
      throw unavailable('OPENAI_PROVIDER_UNAVAILABLE');
    } finally {
      clearTimeout(timeout);
      bearerToken = '';
    }
  }
}

Object.freeze(OpenAiGroundedProposalAdapter.prototype);

/**
 * Construction-only authenticity check for production composition. There is deliberately no
 * public brand issuer: shape-compatible objects, proxies, and subclass overrides cannot satisfy
 * this predicate.
 *
 * @param {unknown} value
 */
export function isAuthenticOpenAiGroundedProposalAdapter(value) {
  if (value === null || (typeof value !== 'object' && typeof value !== 'function')) return false;
  try {
    return AUTHENTIC_OPENAI_GROUNDED_PROPOSAL_ADAPTERS.has(value)
      && Object.getPrototypeOf(value) === OpenAiGroundedProposalAdapter.prototype;
  } catch {
    return false;
  }
}

export const OPENAI_GROUNDED_PROPOSAL_CONTRACT = deepFreeze({
  bindingSchema: OPENAI_BINDING_SCHEMA,
  endpoint: OPENAI_RESPONSES_ENDPOINT,
  model: OPENAI_MODEL,
  provider: PROVIDER_ID,
  missionId: OPENAI_PATH_B_MISSION_ID,
  privacyAuthority: OPENAI_PATH_B_PRIVACY_AUTHORITY,
  privacyPosture: OPENAI_PATH_B_PRIVACY_POSTURE,
  standardApiRetentionAccepted: true,
  zeroDataRetentionClaimed: false,
  apiDataTrainingPosture: OPENAI_PATH_B_TRAINING_POSTURE,
  processingPolicy: OPENAI_PATH_B_PROCESSING_POLICY,
  processingPolicyDigest: OPENAI_PATH_B_PROCESSING_POLICY_DIGEST,
  store: false,
  background: false,
  structuredOutput: true,
  toolsEnabled: false,
  promptCacheConfigured: false,
  exactProjectBindingRequired: true,
  projectId: OPENAI_PRODUCTION_PROJECT_ID,
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
