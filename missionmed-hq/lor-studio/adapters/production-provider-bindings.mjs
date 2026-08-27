import { IntegrationDisabledError } from '../domain/errors.js';
import { deepFreeze } from '../domain/value-utils.js';
import {
  OPENAI_PRODUCTION_PRIVACY_ATTESTATION_CONTRACT,
  createOpenAiPrivacyBindingFromVerifiedAttestation,
  verifyOpenAiProductionPrivacyAttestationFromEnvironment,
} from './openai-production-privacy-attestation.mjs';

const OPENAI_BINDING_SCHEMA = 'missionmed.lor.openai-project-binding.v1';
const POSTMARK_TRANSPORT_BINDING_SCHEMA = 'missionmed.lor.postmark-transport-binding.v1';
const INVITATION_SECRET_BINDING_SCHEMA = 'missionmed.lor.faculty-invitation-secret-binding.v1';
const POSTMARK_TEMPLATE_ALIAS = 'lor-faculty-invitation-v1';
const INVITATION_ROUTE_TEMPLATE = '/lor-studio/invitations/{invitationId}';
const POSTMARK_MESSAGE_STREAM = 'outbound';

const OPENAI_ENV_NAMES = Object.freeze([
  'MMHQ_LOR_OPENAI_API_KEY',
  'MMHQ_LOR_OPENAI_PROJECT_ID',
  ...OPENAI_PRODUCTION_PRIVACY_ATTESTATION_CONTRACT.environmentKeys,
]);
const POSTMARK_ENV_NAMES = Object.freeze([
  'MMHQ_LOR_POSTMARK_SERVER_TOKEN',
  'MMHQ_LOR_POSTMARK_SERVER_ID',
  'MMHQ_LOR_POSTMARK_FROM_EMAIL',
  'MMHQ_LOR_POSTMARK_REPLY_TO_EMAIL',
  'MMHQ_LOR_INVITATION_ORIGIN',
  'MMHQ_LOR_POSTMARK_PROVIDER_RESOURCE_BOUND',
  'MMHQ_LOR_POSTMARK_SENDER_IDENTITY_VERIFIED',
  'MMHQ_LOR_POSTMARK_TEMPLATE_VERIFIED',
  'MMHQ_LOR_POSTMARK_INDEPENDENTLY_VERIFIED',
]);
const INVITATION_SECRET_ENV_NAMES = Object.freeze([
  'MMHQ_LOR_INVITATION_HMAC_KEY',
  'MMHQ_LOR_INVITATION_HMAC_KEY_VERSION',
  'MMHQ_LOR_INVITATION_SECRET_PROVIDER_RESOURCE_BOUND',
  'MMHQ_LOR_INVITATION_SECRET_INDEPENDENTLY_VERIFIED',
]);

function unavailable(integration, status) {
  return new IntegrationDisabledError(integration, status);
}

function snapshotEnvironment(environment, names, integration) {
  if (!environment || (typeof environment !== 'object' && typeof environment !== 'function')) {
    throw unavailable(integration, 'DEDICATED_ENVIRONMENT_BINDING_REQUIRED');
  }
  const snapshot = Object.create(null);
  try {
    for (const name of names) {
      const descriptor = Object.getOwnPropertyDescriptor(environment, name);
      if (descriptor === undefined) {
        snapshot[name] = '';
        continue;
      }
      if (!Object.hasOwn(descriptor, 'value') || typeof descriptor.value !== 'string') {
        throw new TypeError('unsafe environment descriptor');
      }
      snapshot[name] = descriptor.value;
    }
  } catch {
    throw unavailable(integration, 'DEDICATED_ENVIRONMENT_BINDING_REQUIRED');
  }
  return Object.freeze(snapshot);
}

function exactString(value, pattern, integration, status) {
  if (
    typeof value !== 'string'
    || value.trim() !== value
    || !pattern.test(value)
  ) throw unavailable(integration, status);
  return value;
}

function exactTrue(value, integration, status) {
  if (value !== 'true') throw unavailable(integration, status);
  return true;
}

function exactHttpsOrigin(value, integration, status) {
  try {
    const url = new URL(value);
    if (
      url.protocol !== 'https:'
      || url.pathname !== '/'
      || url.search
      || url.hash
      || url.username
      || url.password
      || url.origin !== value
    ) throw new TypeError('invalid origin');
    return url.origin;
  } catch {
    throw unavailable(integration, status);
  }
}

function exactEmail(value, integration, status, { optional = false } = {}) {
  if (optional && value === '') return '';
  const email = exactString(
    value,
    /^(?=.{3,320}$)[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/u,
    integration,
    status,
  );
  if (email.normalize('NFKC').toLowerCase() !== email) {
    throw unavailable(integration, status);
  }
  return email;
}

function exactSecret(value, integration, status, { minimum = 16, maximum = 4_096 } = {}) {
  if (
    typeof value !== 'string'
    || value.length < minimum
    || value.length > maximum
    || value.trim() !== value
    || /\s/u.test(value)
  ) throw unavailable(integration, status);
  return value;
}

function exactRequest(value, expected, integration, status) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw unavailable(integration, status);
  }
  let keys;
  let descriptors;
  try {
    const prototype = Object.getPrototypeOf(value);
    if (![Object.prototype, null].includes(prototype)) throw new TypeError('invalid prototype');
    keys = Reflect.ownKeys(value);
    descriptors = Object.getOwnPropertyDescriptors(value);
  } catch {
    throw unavailable(integration, status);
  }
  if (
    keys.length !== expected.size
    || keys.some((key) => typeof key !== 'string' || !expected.has(key))
  ) throw unavailable(integration, status);
  const snapshot = {};
  for (const key of expected) {
    const descriptor = descriptors[key];
    if (!descriptor || descriptor.enumerable !== true || !Object.hasOwn(descriptor, 'value')) {
      throw unavailable(integration, status);
    }
    snapshot[key] = descriptor.value;
  }
  return Object.freeze(snapshot);
}

class OpenAiServerCredentialProvider {
  #projectId;
  #token;

  constructor(token, projectId) {
    this.#token = token;
    this.#projectId = projectId;
    this.serverOnly = true;
    Object.freeze(this);
  }

  async getBearerToken(rawRequest) {
    const request = exactRequest(
      rawRequest,
      new Set(['projectId', 'provider', 'purpose']),
      'openai_grounded_proposal',
      'OPENAI_CREDENTIAL_REQUEST_REJECTED',
    );
    if (
      request.provider !== 'openai'
      || request.projectId !== this.#projectId
      || request.purpose !== 'lor_grounded_proposal'
    ) {
      throw unavailable(
        'openai_grounded_proposal',
        'OPENAI_CREDENTIAL_REQUEST_REJECTED',
      );
    }
    return this.#token;
  }
}

class PostmarkServerCredentialProvider {
  #serverId;
  #token;

  constructor(token, serverId) {
    this.#token = token;
    this.#serverId = serverId;
    this.serverOnly = true;
    Object.freeze(this);
  }

  async getServerToken(rawRequest) {
    const request = exactRequest(
      rawRequest,
      new Set(['provider', 'purpose', 'serverId']),
      'postmark',
      'POSTMARK_CREDENTIAL_REQUEST_REJECTED',
    );
    if (
      request.provider !== 'postmark'
      || request.purpose !== 'lor_faculty_invitation_delivery'
      || request.serverId !== this.#serverId
    ) {
      throw unavailable('postmark', 'POSTMARK_CREDENTIAL_REQUEST_REJECTED');
    }
    return this.#token;
  }
}

class FacultyInvitationSecretKeyProvider {
  #key;
  #keyVersion;

  constructor(key, keyVersion) {
    this.#key = Buffer.from(key);
    this.#keyVersion = keyVersion;
    this.serverOnly = true;
    Object.freeze(this);
  }

  async getKey(rawRequest) {
    const request = exactRequest(
      rawRequest,
      new Set(['keyVersion', 'purpose']),
      'lor_faculty_invitation_secrets',
      'INVITATION_SECRET_REQUEST_REJECTED',
    );
    if (
      request.purpose !== 'lor_faculty_invitation_hmac'
      || request.keyVersion !== this.#keyVersion
    ) {
      throw unavailable(
        'lor_faculty_invitation_secrets',
        'INVITATION_SECRET_REQUEST_REJECTED',
      );
    }
    return Buffer.from(this.#key);
  }
}

export function createOpenAiProductionProviderBinding(
  environment = process.env,
  { clock = () => new Date() } = {},
) {
  const integration = 'openai_grounded_proposal';
  const env = snapshotEnvironment(environment, OPENAI_ENV_NAMES, integration);
  const token = exactSecret(
    env.MMHQ_LOR_OPENAI_API_KEY,
    integration,
    'OPENAI_DEDICATED_CREDENTIAL_REQUIRED',
  );
  const projectId = exactString(
    env.MMHQ_LOR_OPENAI_PROJECT_ID,
    /^proj_[A-Za-z0-9_-]{6,200}$/u,
    integration,
    'OPENAI_EXACT_PROJECT_BINDING_REQUIRED',
  );
  const verifiedAttestation = verifyOpenAiProductionPrivacyAttestationFromEnvironment({
    environment: env,
    projectId,
    clock,
  });
  return Object.freeze({
    binding: createOpenAiPrivacyBindingFromVerifiedAttestation({
      projectId,
      verifiedAttestation,
    }),
    credentialProvider: new OpenAiServerCredentialProvider(token, projectId),
  });
}

export function createPostmarkProductionProviderBinding(environment = process.env) {
  const integration = 'postmark';
  const env = snapshotEnvironment(environment, POSTMARK_ENV_NAMES, integration);
  const token = exactSecret(
    env.MMHQ_LOR_POSTMARK_SERVER_TOKEN,
    integration,
    'POSTMARK_DEDICATED_CREDENTIAL_REQUIRED',
  );
  const serverId = exactString(
    env.MMHQ_LOR_POSTMARK_SERVER_ID,
    /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$/u,
    integration,
    'POSTMARK_EXACT_SERVER_BINDING_REQUIRED',
  );
  const fromEmail = exactEmail(
    env.MMHQ_LOR_POSTMARK_FROM_EMAIL,
    integration,
    'POSTMARK_VERIFIED_SENDER_REQUIRED',
  );
  const replyToEmail = exactEmail(
    env.MMHQ_LOR_POSTMARK_REPLY_TO_EMAIL,
    integration,
    'POSTMARK_REPLY_TO_INVALID',
    { optional: true },
  );
  const invitationOrigin = exactHttpsOrigin(
    env.MMHQ_LOR_INVITATION_ORIGIN,
    integration,
    'POSTMARK_INVITATION_ORIGIN_REQUIRED',
  );
  exactTrue(
    env.MMHQ_LOR_POSTMARK_PROVIDER_RESOURCE_BOUND,
    integration,
    'POSTMARK_EXACT_SERVER_BINDING_REQUIRED',
  );
  exactTrue(
    env.MMHQ_LOR_POSTMARK_SENDER_IDENTITY_VERIFIED,
    integration,
    'POSTMARK_VERIFIED_SENDER_REQUIRED',
  );
  exactTrue(
    env.MMHQ_LOR_POSTMARK_TEMPLATE_VERIFIED,
    integration,
    'POSTMARK_VERIFIED_TEMPLATE_REQUIRED',
  );
  exactTrue(
    env.MMHQ_LOR_POSTMARK_INDEPENDENTLY_VERIFIED,
    integration,
    'POSTMARK_INDEPENDENT_VERIFICATION_REQUIRED',
  );

  return Object.freeze({
    binding: deepFreeze({
      providerResourceBound: true,
      independentlyVerified: true,
      provider: 'postmark',
      senderIdentityVerified: true,
      serverSideCredentials: true,
      invitationOrigin,
      invitationRouteTemplate: INVITATION_ROUTE_TEMPLATE,
      templateAlias: POSTMARK_TEMPLATE_ALIAS,
    }),
    transportBinding: deepFreeze({
      schemaVersion: POSTMARK_TRANSPORT_BINDING_SCHEMA,
      provider: 'postmark',
      providerResourceBound: true,
      independentlyVerified: true,
      serverId,
      senderIdentityVerified: true,
      templateVerified: true,
      fromEmail,
      replyToEmail,
      invitationOrigin,
      invitationRouteTemplate: INVITATION_ROUTE_TEMPLATE,
      templateAlias: POSTMARK_TEMPLATE_ALIAS,
      messageStream: POSTMARK_MESSAGE_STREAM,
    }),
    credentialProvider: new PostmarkServerCredentialProvider(token, serverId),
  });
}

export function createFacultyInvitationSecretProviderBinding(environment = process.env) {
  const integration = 'lor_faculty_invitation_secrets';
  const env = snapshotEnvironment(environment, INVITATION_SECRET_ENV_NAMES, integration);
  exactTrue(
    env.MMHQ_LOR_INVITATION_SECRET_PROVIDER_RESOURCE_BOUND,
    integration,
    'VERIFIED_SECRET_BINDING_REQUIRED',
  );
  exactTrue(
    env.MMHQ_LOR_INVITATION_SECRET_INDEPENDENTLY_VERIFIED,
    integration,
    'VERIFIED_SECRET_BINDING_REQUIRED',
  );
  const keyVersion = exactString(
    env.MMHQ_LOR_INVITATION_HMAC_KEY_VERSION,
    /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}$/u,
    integration,
    'VERIFIED_SECRET_BINDING_REQUIRED',
  );
  const encodedKey = exactString(
    env.MMHQ_LOR_INVITATION_HMAC_KEY,
    /^[A-Za-z0-9_-]{43,342}$/u,
    integration,
    'BOUND_SECRET_KEY_REQUIRED',
  );
  let key;
  try {
    key = Buffer.from(encodedKey, 'base64url');
    if (
      key.byteLength < 32
      || key.byteLength > 256
      || key.toString('base64url') !== encodedKey
    ) throw new TypeError('invalid key');
  } catch {
    key?.fill(0);
    throw unavailable(integration, 'BOUND_SECRET_KEY_REQUIRED');
  }

  try {
    return Object.freeze({
      binding: deepFreeze({
        schemaVersion: INVITATION_SECRET_BINDING_SCHEMA,
        providerResourceBound: true,
        independentlyVerified: true,
        serverSideSecret: true,
        keyVersion,
      }),
      keyProvider: new FacultyInvitationSecretKeyProvider(key, keyVersion),
    });
  } finally {
    key.fill(0);
  }
}

export function createProductionProviderBindings(environment = process.env, options = {}) {
  return Object.freeze({
    openai: createOpenAiProductionProviderBinding(environment, options),
    postmark: createPostmarkProductionProviderBinding(environment),
    facultyInvitationSecrets: createFacultyInvitationSecretProviderBinding(environment),
  });
}

export const PRODUCTION_PROVIDER_BINDINGS_CONTRACT = deepFreeze({
  openaiBindingSchema: OPENAI_BINDING_SCHEMA,
  postmarkTransportBindingSchema: POSTMARK_TRANSPORT_BINDING_SCHEMA,
  facultyInvitationSecretBindingSchema: INVITATION_SECRET_BINDING_SCHEMA,
  dedicatedEnvironmentNames: Object.freeze([
    ...OPENAI_ENV_NAMES,
    ...POSTMARK_ENV_NAMES,
    ...INVITATION_SECRET_ENV_NAMES,
  ]),
  genericCredentialFallback: false,
  secretSerialization: 'private_fields_only',
  invitationHmacEncoding: 'canonical_base64url_32_to_256_bytes',
  openaiPrivacyAuthority: 'source_pinned_signed_attestation_only',
});
