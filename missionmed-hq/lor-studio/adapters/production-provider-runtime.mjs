import { HmacFacultyInvitationSecretDeriver } from './faculty-invitation-hmac-deriver.mjs';
import { PostmarkFacultyInvitationAdapter } from './faculty-otp-postmark-adapters.mjs';
import {
  OPENAI_GROUNDED_PROPOSAL_CONTRACT,
  OPENAI_PRODUCTION_PROJECT_ID,
  OpenAiGroundedProposalAdapter,
} from './openai-grounded-proposal-adapter.mjs';
import { PostmarkFacultyInvitationTransport } from './postmark-faculty-invitation-transport.mjs';
import { createProductionProviderBindings } from './production-provider-bindings.mjs';
import { canonicalize, sha256 } from '../domain/value-utils.js';

const OPENAI_MODELS_ENDPOINT = 'https://api.openai.com/v1/models';
const POSTMARK_TEMPLATE_ENDPOINT =
  'https://api.postmarkapp.com/templates/lor-faculty-invitation-v1';
const MAXIMUM_PROBE_BYTES = 256_000;
const PROBE_REQUEST_SCHEMA = 'missionmed.lor.production-provider-probe-request.v1';
const PROBE_EVIDENCE_SCHEMA = 'missionmed.lor.production-provider-safe-evidence.v1';
const SHA256 = /^[a-f0-9]{64}$/u;
const PROBE_REQUEST_KEYS = new Set([
  'dependency', 'metadataOnly', 'schemaVersion', 'signal', 'targetRef',
]);

function invalid(status) {
  throw Object.assign(new Error('LOR production provider runtime is unavailable'), {
    code: 'INTEGRATION_DISABLED',
    details: { status },
  });
}

async function boundedJson(response) {
  const rawLength = response?.headers?.get?.('content-length');
  if (rawLength && (!/^(?:0|[1-9][0-9]*)$/u.test(rawLength)
    || Number(rawLength) > MAXIMUM_PROBE_BYTES)) invalid('PROBE_RESPONSE_INVALID');
  const text = await response.text();
  if (Buffer.byteLength(text, 'utf8') > MAXIMUM_PROBE_BYTES) {
    invalid('PROBE_RESPONSE_INVALID');
  }
  try {
    return JSON.parse(text);
  } catch {
    invalid('PROBE_RESPONSE_INVALID');
  }
}

function assertProbeRequest(request, dependency) {
  if (!request || typeof request !== 'object' || Array.isArray(request)) {
    invalid('PROBE_REQUEST_INVALID');
  }
  let descriptors;
  let keys;
  try {
    keys = Reflect.ownKeys(request);
    descriptors = Object.getOwnPropertyDescriptors(request);
  } catch {
    invalid('PROBE_REQUEST_INVALID');
  }
  if (
    keys.length !== PROBE_REQUEST_KEYS.size
    || keys.some((key) => typeof key !== 'string' || !PROBE_REQUEST_KEYS.has(key))
    || [...PROBE_REQUEST_KEYS].some((key) => (
      !descriptors[key]
      || !Object.hasOwn(descriptors[key], 'value')
      || descriptors[key].enumerable !== true
    ))
  ) invalid('PROBE_REQUEST_INVALID');
  if (
    descriptors.schemaVersion.value !== PROBE_REQUEST_SCHEMA
    || descriptors.dependency.value !== dependency
    || descriptors.metadataOnly.value !== true
    || !SHA256.test(descriptors.targetRef.value ?? '')
    || !descriptors.signal.value
    || typeof descriptors.signal.value.addEventListener !== 'function'
    || typeof descriptors.signal.value.removeEventListener !== 'function'
    || typeof descriptors.signal.value.aborted !== 'boolean'
  ) invalid('PROBE_REQUEST_INVALID');
  return descriptors.signal.value;
}

function readyEvidence(dependency, metadata) {
  return Object.freeze({
    state: 'ready',
    errorCode: '',
    evidenceRef: sha256(canonicalize({
      schemaVersion: PROBE_EVIDENCE_SCHEMA,
      dependency,
      metadata,
    })),
  });
}

async function safeFetch(fetchImplementation, url, options, externalSignal) {
  const controller = new AbortController();
  const abortFromCoordinator = () => controller.abort();
  if (externalSignal.aborted) controller.abort();
  else externalSignal.addEventListener('abort', abortFromCoordinator, { once: true });
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetchImplementation(url, {
      ...options,
      redirect: 'error',
      signal: controller.signal,
    });
    if (!response || response.url !== url || response.status !== 200 || response.ok !== true) {
      invalid('PROBE_FAILED');
    }
    const contentType = String(response.headers?.get?.('content-type') || '').toLowerCase();
    if (!contentType.startsWith('application/json')) invalid('PROBE_RESPONSE_INVALID');
    return response;
  } catch (error) {
    if (error?.code === 'INTEGRATION_DISABLED') throw error;
    invalid('PROBE_FAILED');
  } finally {
    clearTimeout(timeout);
    externalSignal.removeEventListener('abort', abortFromCoordinator);
  }
}

/**
 * Construct the three credential-bearing production provider surfaces and their bounded,
 * metadata-only startup probes. Secrets stay inside private credential-provider fields or
 * short-lived local variables and are never returned, serialized, logged, or placed in URLs.
 */
export async function createProductionProviderRuntime({
  environment = process.env,
  fetchImplementation = globalThis.fetch,
  clock = () => new Date(),
} = {}) {
  if (typeof fetchImplementation !== 'function') invalid('FETCH_UNAVAILABLE');
  if (typeof clock !== 'function') invalid('CLOCK_UNAVAILABLE');
  const bindings = createProductionProviderBindings(environment, { clock });

  const aiProposalProvider = new OpenAiGroundedProposalAdapter({
    binding: bindings.openai.binding,
    credentialProvider: bindings.openai.credentialProvider,
    fetchImplementation,
  });
  const postmarkTransport = new PostmarkFacultyInvitationTransport({
    binding: bindings.postmark.transportBinding,
    credentialProvider: bindings.postmark.credentialProvider,
    fetchImplementation,
    clock,
  });
  const facultyEmailPort = new PostmarkFacultyInvitationAdapter({
    binding: bindings.postmark.binding,
    transport: postmarkTransport,
    clock,
  });

  let invitationKey = await bindings.facultyInvitationSecrets.keyProvider.getKey({
    purpose: 'lor_faculty_invitation_hmac',
    keyVersion: bindings.facultyInvitationSecrets.binding.keyVersion,
  });
  let facultyInvitationSecretDeriver;
  try {
    facultyInvitationSecretDeriver = new HmacFacultyInvitationSecretDeriver({
      binding: bindings.facultyInvitationSecrets.binding,
      key: invitationKey,
    });
  } finally {
    if (Buffer.isBuffer(invitationKey)) invitationKey.fill(0);
    invitationKey = null;
  }

  const probes = Object.freeze({
    async ai(request) {
      const signal = assertProbeRequest(request, 'ai');
      let token = '';
      try {
        token = await bindings.openai.credentialProvider.getBearerToken({
          provider: 'openai',
          projectId: OPENAI_PRODUCTION_PROJECT_ID,
          purpose: 'lor_grounded_proposal',
        });
        if (typeof token !== 'string' || token.length < 8 || token.length > 4_096 || /\s/u.test(token)) {
          invalid('OPENAI_CREDENTIAL_UNAVAILABLE');
        }
        const response = await safeFetch(fetchImplementation, OPENAI_MODELS_ENDPOINT, {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
            'OpenAI-Project': OPENAI_PRODUCTION_PROJECT_ID,
          },
        }, signal);
        const payload = await boundedJson(response);
        if (
          payload?.object !== 'list'
          || !Array.isArray(payload?.data)
          || !payload.data.some((entry) => (
            entry
            && typeof entry === 'object'
            && !Array.isArray(entry)
            && entry.id === OPENAI_GROUNDED_PROPOSAL_CONTRACT.model
          ))
        ) {
          invalid('OPENAI_PROBE_RESPONSE_INVALID');
        }
        return readyEvidence('ai', Object.freeze({
          endpoint: 'openai_models',
          modelRef: sha256(OPENAI_GROUNDED_PROPOSAL_CONTRACT.model),
          projectRef: sha256(OPENAI_PRODUCTION_PROJECT_ID),
          responseShape: 'list',
        }));
      } finally {
        token = '';
      }
    },

    async email(request) {
      const signal = assertProbeRequest(request, 'email');
      let token = '';
      try {
        token = await bindings.postmark.credentialProvider.getServerToken({
          provider: 'postmark',
          purpose: 'lor_faculty_invitation_delivery',
          serverId: bindings.postmark.transportBinding.serverId,
        });
        if (typeof token !== 'string' || token.length < 16 || token.length > 4_096 || /\s/u.test(token)) {
          invalid('POSTMARK_CREDENTIAL_UNAVAILABLE');
        }
        const response = await safeFetch(fetchImplementation, POSTMARK_TEMPLATE_ENDPOINT, {
          method: 'GET',
          headers: { Accept: 'application/json', 'X-Postmark-Server-Token': token },
        }, signal);
        const payload = await boundedJson(response);
        if (
          payload?.Alias !== 'lor-faculty-invitation-v1'
          || payload?.Active !== true
          || String(payload?.AssociatedServerId ?? '')
            !== bindings.postmark.transportBinding.serverId
        ) invalid('POSTMARK_PROBE_RESPONSE_INVALID');
        return readyEvidence('email', Object.freeze({
          provider: 'postmark',
          serverRef: sha256(bindings.postmark.transportBinding.serverId),
          templateAlias: 'lor-faculty-invitation-v1',
        }));
      } finally {
        token = '';
      }
    },

    async otp(request) {
      assertProbeRequest(request, 'otp');
      const candidate = facultyInvitationSecretDeriver.tokenForInvitation(
        'readiness-probe-invitation',
      );
      if (!/^[A-Za-z0-9_-]{43}$/u.test(candidate)) invalid('INVITATION_SECRET_PROBE_FAILED');
      return readyEvidence('otp', Object.freeze({
        algorithm: 'hmac_sha256',
        keyVersionRef: sha256(bindings.facultyInvitationSecrets.binding.keyVersion),
        outputShape: 'base64url_43',
      }));
    },
  });

  return Object.freeze({
    aiProposalProvider,
    facultyEmailPort,
    facultyInvitationSecretDeriver,
    facultyInvitationSecretBinding: bindings.facultyInvitationSecrets.binding,
    facultyInvitationKeyProvider: bindings.facultyInvitationSecrets.keyProvider,
    invitationOrigin: bindings.postmark.binding.invitationOrigin,
    probes,
  });
}

export const PRODUCTION_PROVIDER_RUNTIME_CONTRACT = Object.freeze({
  openAiProbe: 'GET_/v1/models_exact_project_and_exact_proposal_model_no_customer_content',
  openAiProjectId: OPENAI_PRODUCTION_PROJECT_ID,
  openAiPrivacyAuthority:
    'source_pinned_signed_dr139_standard_retention_exact_project_model_release_policy_attestation',
  openAiRuntimeReleaseIdentity:
    'MMHQ_LOR_RELEASE_COMMIT_exact_40_hex_must_equal_signed_releaseCommit',
  postmarkProbe: 'GET_exact_active_template_alias_and_server',
  invitationSecretProbe: 'local_hmac_derivation_only',
  candidateHandoffKey: 'same_provider_key_with_hkdf_domain_separation',
  protectedContent: 'prohibited',
  secretOutput: 'prohibited',
});
