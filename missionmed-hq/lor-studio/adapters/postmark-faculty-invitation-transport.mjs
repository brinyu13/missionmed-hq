import { IntegrationDisabledError, ValidationError } from '../domain/errors.js';
import { deepFreeze, toIso } from '../domain/value-utils.js';
import { hashFacultyEmail, normalizeFacultyEmail } from '../security/faculty-invitations.js';

const POSTMARK_ENDPOINT = 'https://api.postmarkapp.com/email/withTemplate';
const BINDING_SCHEMA = 'missionmed.lor.postmark-transport-binding.v1';
const TEMPLATE_ALIAS = 'lor-faculty-invitation-v1';
const MESSAGE_STREAM = 'outbound';
const INVITATION_ROUTE_TEMPLATE = '/lor-studio/invitations/{invitationId}';
const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_REQUEST_BYTES = 64_000;
const MAX_RESPONSE_BYTES = 128_000;
const MAX_PROVIDER_CLOCK_AGE_MS = 5 * 60 * 1_000;
const MAX_PROVIDER_CLOCK_SKEW_MS = 30 * 1_000;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const INVITATION_ID_PATTERN = /^[A-Za-z0-9_-]{1,200}$/u;
const AUTHENTIC_POSTMARK_FACULTY_INVITATION_TRANSPORTS = new WeakSet();

const BINDING_KEYS = new Set([
  'fromEmail',
  'independentlyVerified',
  'invitationOrigin',
  'invitationRouteTemplate',
  'messageStream',
  'provider',
  'providerResourceBound',
  'replyToEmail',
  'schemaVersion',
  'senderIdentityVerified',
  'serverId',
  'templateAlias',
  'templateVerified',
]);
const REQUEST_KEYS = new Set([
  'expiresAt',
  'invitationId',
  'invitationUrl',
  'oneTimeCode',
  'otpExpiresAt',
  'protectedLetterContent',
  'provider',
  'recipientEmail',
  'recipientEmailHash',
  'templateAlias',
]);

function unavailable(status) {
  return new IntegrationDisabledError('postmark', status);
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  try {
    return [Object.prototype, null].includes(Object.getPrototypeOf(value));
  } catch {
    return false;
  }
}

/**
 * @param {unknown} value
 * @param {Set<string>} expectedKeys
 * @param {() => Error} errorFactory
 * @returns {Readonly<Record<string, any>>}
 */
function snapshotExactRecord(value, expectedKeys, errorFactory) {
  if (!isPlainObject(value)) throw errorFactory();
  const record = /** @type {Record<string, unknown>} */ (value);
  let keys;
  let descriptors;
  try {
    keys = Reflect.ownKeys(record);
    descriptors = Object.getOwnPropertyDescriptors(record);
  } catch {
    throw errorFactory();
  }
  if (
    keys.length !== expectedKeys.size
    || keys.some((key) => typeof key !== 'string' || !expectedKeys.has(key))
  ) throw errorFactory();
  const snapshot = {};
  for (const key of expectedKeys) {
    const descriptor = descriptors[key];
    if (!descriptor || descriptor.enumerable !== true || !Object.hasOwn(descriptor, 'value')) {
      throw errorFactory();
    }
    snapshot[key] = descriptor.value;
  }
  return Object.freeze(snapshot);
}

function boundedText(value, maximum, errorFactory) {
  if (
    typeof value !== 'string'
    || value.trim() !== value
    || value.length === 0
    || value.length > maximum
  ) throw errorFactory();
  return value;
}

function validatedEmail(value, { optional = false } = {}) {
  if (optional && value === '') return '';
  let normalized;
  try {
    normalized = normalizeFacultyEmail(value);
  } catch {
    throw unavailable('POSTMARK_TRANSPORT_BINDING_REQUIRED');
  }
  if (normalized !== value) throw unavailable('POSTMARK_TRANSPORT_BINDING_REQUIRED');
  return normalized;
}

/** @param {unknown} rawBinding */
function assertBinding(rawBinding) {
  const binding = snapshotExactRecord(
    rawBinding,
    BINDING_KEYS,
    () => unavailable('POSTMARK_TRANSPORT_BINDING_REQUIRED'),
  );
  if (
    binding.schemaVersion !== BINDING_SCHEMA
    || binding.provider !== 'postmark'
    || binding.providerResourceBound !== true
    || binding.independentlyVerified !== true
    || binding.senderIdentityVerified !== true
    || binding.templateVerified !== true
    || binding.invitationRouteTemplate !== INVITATION_ROUTE_TEMPLATE
    || binding.templateAlias !== TEMPLATE_ALIAS
    || binding.messageStream !== MESSAGE_STREAM
    || typeof binding.serverId !== 'string'
    || !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$/u.test(binding.serverId)
  ) throw unavailable('POSTMARK_TRANSPORT_BINDING_REQUIRED');
  let invitationOrigin;
  try {
    const origin = new URL(binding.invitationOrigin);
    if (
      origin.protocol !== 'https:'
      || origin.pathname !== '/'
      || origin.search
      || origin.hash
      || origin.username
      || origin.password
      || origin.origin !== binding.invitationOrigin
    ) throw new TypeError('invalid origin');
    invitationOrigin = origin.origin;
  } catch {
    throw unavailable('POSTMARK_TRANSPORT_BINDING_REQUIRED');
  }
  return deepFreeze({
    schemaVersion: BINDING_SCHEMA,
    provider: 'postmark',
    serverId: binding.serverId,
    fromEmail: validatedEmail(binding.fromEmail),
    replyToEmail: validatedEmail(binding.replyToEmail, { optional: true }),
    invitationOrigin,
    invitationRouteTemplate: INVITATION_ROUTE_TEMPLATE,
    templateAlias: TEMPLATE_ALIAS,
    messageStream: MESSAGE_STREAM,
  });
}

function assertCredentialProvider(provider) {
  if (
    !provider
    || provider.serverOnly !== true
    || typeof provider.getServerToken !== 'function'
  ) throw unavailable('POSTMARK_SERVER_CREDENTIAL_PROVIDER_REQUIRED');
  return provider;
}

function canonicalTimestamp(value, fieldName) {
  if (typeof value !== 'string') throw new ValidationError(`${fieldName} is invalid`);
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== value) {
    throw new ValidationError(`${fieldName} is invalid`);
  }
  return Object.freeze({ timestamp, iso: value });
}

/** @param {unknown} rawRequest @param {Readonly<Record<string, any>>} binding */
function normalizeRequest(rawRequest, binding) {
  const request = snapshotExactRecord(
    rawRequest,
    REQUEST_KEYS,
    () => new ValidationError('Postmark transport request is outside its exact allowlist'),
  );
  if (
    request.provider !== 'postmark'
    || request.protectedLetterContent !== null
    || request.templateAlias !== binding.templateAlias
    || typeof request.invitationId !== 'string'
    || !INVITATION_ID_PATTERN.test(request.invitationId)
    || typeof request.oneTimeCode !== 'string'
    || !/^[0-9]{6}$/u.test(request.oneTimeCode)
    || !SHA256_PATTERN.test(request.recipientEmailHash ?? '')
  ) throw new ValidationError('Postmark transport request is invalid');

  let recipientEmail;
  try {
    recipientEmail = normalizeFacultyEmail(request.recipientEmail);
  } catch {
    throw new ValidationError('Postmark transport request is invalid');
  }
  if (
    recipientEmail !== request.recipientEmail
    || hashFacultyEmail(recipientEmail) !== request.recipientEmailHash
  ) throw new ValidationError('Postmark transport request is invalid');

  let invitationUrl;
  try {
    invitationUrl = new URL(request.invitationUrl);
  } catch {
    throw new ValidationError('Postmark transport request is invalid');
  }
  const invitationPath = binding.invitationRouteTemplate.replace(
    '{invitationId}',
    encodeURIComponent(request.invitationId),
  );
  if (
    invitationUrl.origin !== binding.invitationOrigin
    || invitationUrl.protocol !== 'https:'
    || invitationUrl.username
    || invitationUrl.password
    || invitationUrl.search
    || invitationUrl.pathname !== invitationPath
    || !/^#token=[A-Za-z0-9_-]{22,256}$/u.test(invitationUrl.hash)
    || invitationUrl.toString().length > 2_048
  ) throw new ValidationError('Postmark transport request is invalid');

  const invitationExpiry = canonicalTimestamp(request.expiresAt, 'expiresAt');
  const otpExpiry = canonicalTimestamp(request.otpExpiresAt, 'otpExpiresAt');
  if (otpExpiry.timestamp > invitationExpiry.timestamp) {
    throw new ValidationError('Postmark transport request is invalid');
  }

  return Object.freeze({
    invitationId: request.invitationId,
    invitationPath,
    invitationUrl: invitationUrl.toString(),
    oneTimeCode: request.oneTimeCode,
    recipientEmail,
    recipientEmailHash: request.recipientEmailHash,
    otpExpiresAt: otpExpiry.iso,
    expiresAt: invitationExpiry.iso,
    templateAlias: binding.templateAlias,
  });
}

function providerRequestBody(request, binding) {
  const body = {
    From: binding.fromEmail,
    To: request.recipientEmail,
    TemplateAlias: binding.templateAlias,
    TemplateModel: {
      invitation_url: request.invitationUrl,
      one_time_code: request.oneTimeCode,
      otp_expires_at: request.otpExpiresAt,
      invitation_expires_at: request.expiresAt,
    },
    MessageStream: binding.messageStream,
    TrackOpens: false,
    TrackLinks: 'None',
    Tag: 'lor-faculty-invitation',
  };
  if (binding.replyToEmail) body.ReplyTo = binding.replyToEmail;
  return body;
}

async function readBoundedBody(response) {
  const declared = Number(response?.headers?.get?.('content-length'));
  if (Number.isFinite(declared) && declared > MAX_RESPONSE_BYTES) {
    throw unavailable('POSTMARK_PROVIDER_RESPONSE_INVALID');
  }
  if (response?.body && typeof response.body.getReader === 'function') {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let bytes = 0;
    let text = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!(value instanceof Uint8Array)) throw unavailable('POSTMARK_PROVIDER_RESPONSE_INVALID');
      bytes += value.byteLength;
      if (bytes > MAX_RESPONSE_BYTES) {
        await reader.cancel().catch(() => {});
        throw unavailable('POSTMARK_PROVIDER_RESPONSE_INVALID');
      }
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  }
  if (typeof response?.text !== 'function') throw unavailable('POSTMARK_PROVIDER_RESPONSE_INVALID');
  const text = await response.text();
  if (Buffer.byteLength(text, 'utf8') > MAX_RESPONSE_BYTES) {
    throw unavailable('POSTMARK_PROVIDER_RESPONSE_INVALID');
  }
  return text;
}

function canonicalAcceptedAt(value, now) {
  if (typeof value !== 'string' || value.length < 20 || value.length > 64) {
    throw unavailable('POSTMARK_PROVIDER_RESPONSE_INVALID');
  }
  const milliseconds = Date.parse(value);
  if (
    !Number.isFinite(milliseconds)
    || milliseconds < now - MAX_PROVIDER_CLOCK_AGE_MS
    || milliseconds > now + MAX_PROVIDER_CLOCK_SKEW_MS
  ) throw unavailable('POSTMARK_PROVIDER_RESPONSE_INVALID');
  return new Date(milliseconds).toISOString();
}

function trustedNow(clock) {
  try {
    return Date.parse(toIso(clock(), 'clock'));
  } catch {
    throw unavailable('POSTMARK_CLOCK_INVALID');
  }
}

export class PostmarkFacultyInvitationTransport {
  #credentialProvider;
  #fetch;
  #timeoutMs;

  /**
   * @param {{
   *   binding?: unknown,
   *   credentialProvider?: any,
   *   fetchImplementation?: Function,
   *   clock?: Function,
   *   timeoutMs?: number
   * }} [options]
   */
  constructor({
    binding,
    credentialProvider,
    fetchImplementation = globalThis.fetch,
    clock = () => new Date(),
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = {}) {
    this.binding = assertBinding(binding);
    this.#credentialProvider = assertCredentialProvider(credentialProvider);
    if (typeof fetchImplementation !== 'function') throw unavailable('POSTMARK_FETCH_UNAVAILABLE');
    if (typeof clock !== 'function') throw unavailable('POSTMARK_CLOCK_REQUIRED');
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30_000) {
      throw unavailable('POSTMARK_TIMEOUT_POLICY_INVALID');
    }
    this.#fetch = fetchImplementation;
    this.clock = clock;
    this.#timeoutMs = timeoutMs;
    this.serverOnly = true;
    Object.freeze(this);
    AUTHENTIC_POSTMARK_FACULTY_INVITATION_TRANSPORTS.add(this);
  }

  async sendBoundInvitation(rawRequest) {
    const request = normalizeRequest(rawRequest, this.binding);
    const requestedAt = trustedNow(this.clock);
    if (
      Date.parse(request.otpExpiresAt) <= requestedAt
      || Date.parse(request.expiresAt) <= requestedAt
    ) throw new ValidationError('Postmark transport request is invalid');
    const body = JSON.stringify(providerRequestBody(request, this.binding));
    if (Buffer.byteLength(body, 'utf8') > MAX_REQUEST_BYTES) {
      throw new ValidationError('Postmark transport request exceeds its safety limit');
    }

    let serverToken = '';
    try {
      serverToken = await this.#credentialProvider.getServerToken({
        provider: 'postmark',
        purpose: 'lor_faculty_invitation_delivery',
        serverId: this.binding.serverId,
      });
    } catch {
      throw unavailable('POSTMARK_CREDENTIAL_UNAVAILABLE');
    }
    if (
      typeof serverToken !== 'string'
      || serverToken.length < 16
      || serverToken.length > 4_096
      || /\s/u.test(serverToken)
    ) {
      serverToken = '';
      throw unavailable('POSTMARK_CREDENTIAL_UNAVAILABLE');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.#timeoutMs);
    try {
      let response;
      try {
        response = await this.#fetch(POSTMARK_ENDPOINT, {
          method: 'POST',
          redirect: 'error',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-Postmark-Server-Token': serverToken,
          },
          body,
          signal: controller.signal,
        });
      } catch {
        throw unavailable('POSTMARK_PROVIDER_UNAVAILABLE');
      } finally {
        serverToken = '';
      }
      if (
        !response
        || response.url !== POSTMARK_ENDPOINT
        || response.ok !== true
        || Number(response.status) !== 200
      ) throw unavailable('POSTMARK_PROVIDER_UNAVAILABLE');
      const contentType = String(response.headers?.get?.('content-type') || '').toLowerCase();
      if (!contentType.startsWith('application/json')) {
        throw unavailable('POSTMARK_PROVIDER_RESPONSE_INVALID');
      }
      let parsed;
      try {
        parsed = JSON.parse(await readBoundedBody(response));
      } catch (error) {
        if (error instanceof IntegrationDisabledError) throw error;
        throw unavailable('POSTMARK_PROVIDER_RESPONSE_INVALID');
      }
      const now = trustedNow(this.clock);
      if (
        !isPlainObject(parsed)
        || parsed.ErrorCode !== 0
        || typeof parsed.MessageID !== 'string'
        || parsed.MessageID.trim() !== parsed.MessageID
        || parsed.MessageID.length < 8
        || parsed.MessageID.length > 200
        || parsed.To !== request.recipientEmail
      ) throw unavailable('POSTMARK_PROVIDER_RESPONSE_INVALID');
      return deepFreeze({
        accepted: true,
        invitationId: request.invitationId,
        recipientEmailHash: request.recipientEmailHash,
        invitationPath: request.invitationPath,
        templateAlias: request.templateAlias,
        messageId: parsed.MessageID,
        acceptedAt: canonicalAcceptedAt(parsed.SubmittedAt, now),
      });
    } catch (error) {
      if (error instanceof IntegrationDisabledError || error instanceof ValidationError) throw error;
      throw unavailable('POSTMARK_PROVIDER_UNAVAILABLE');
    } finally {
      clearTimeout(timeout);
      serverToken = '';
    }
  }
}

Object.freeze(PostmarkFacultyInvitationTransport.prototype);

/** @param {unknown} value @returns {boolean} */
export function isAuthenticPostmarkFacultyInvitationTransport(value) {
  if (value === null || (typeof value !== 'object' && typeof value !== 'function')) return false;
  try {
    return AUTHENTIC_POSTMARK_FACULTY_INVITATION_TRANSPORTS.has(value)
      && Object.getPrototypeOf(value) === PostmarkFacultyInvitationTransport.prototype;
  } catch {
    return false;
  }
}

export const POSTMARK_FACULTY_INVITATION_TRANSPORT_CONTRACT = deepFreeze({
  endpoint: POSTMARK_ENDPOINT,
  bindingSchema: BINDING_SCHEMA,
  templateAlias: TEMPLATE_ALIAS,
  messageStream: MESSAGE_STREAM,
  tracking: 'disabled',
  retries: 'none_on_ambiguous_delivery',
  maximumRequestBytes: MAX_REQUEST_BYTES,
  maximumResponseBytes: MAX_RESPONSE_BYTES,
});
