import { readFile } from 'node:fs/promises';

const modes = new Set([
  'condense_experience',
  'condense_most_meaningful',
  'condense_impactful',
]);
const identifierPatterns = Object.freeze([
  /\b(?:mrn|medical record(?: number)?|patient id|account number)\s*[:#-]?\s*[a-z0-9-]{4,}\b/gi,
  /\b\d{3}-\d{2}-\d{4}\b/g,
  /\b(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/g,
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
  /\b(?:\d[ -]*?){13,19}\b/g,
]);

export const condensationRedactionVersion = 'b1-517-redaction-v1';

export class CondensationError extends Error {
  constructor(code, message, status = 400, options = {}) {
    super(message, options);
    this.name = 'CondensationError';
    this.code = code;
    this.status = status;
  }
}

function requireFunction(value, name) {
  if (typeof value !== 'function') throw new TypeError(`${name} must be supplied.`);
  return value;
}

function exactObject(value, allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).some((key) => !allowed.has(key))) {
    throw new CondensationError('invalid_condensation_request', 'The condensation request is invalid.');
  }
  return value;
}

function cleanText(value, label, max) {
  const result = String(value ?? '');
  if (!result.trim() || result.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(result)) {
    throw new CondensationError('invalid_condensation_request', `${label} is invalid.`);
  }
  return result;
}

export function redactCondensationInput(input, { includePatientContext = false } = {}) {
  const text = String(input ?? '');
  let redacted = text;
  for (const pattern of identifierPatterns) redacted = redacted.replace(pattern, '[removed]');
  if (!includePatientContext) {
    redacted = redacted.replace(/(?:^|\n)\s*patient context\s*:[^\n]*/gi, '\n[patient context omitted]');
  }
  return redacted.trim();
}

async function loadPrompts(promptUrl) {
  const parsed = JSON.parse(await readFile(promptUrl, 'utf8'));
  if (parsed?.schemaVersion !== 1 || !parsed.prompts || typeof parsed.prompts !== 'object') {
    throw new CondensationError('condensation_configuration_invalid', 'The condensation assistant is unavailable.', 503);
  }
  return parsed.prompts;
}

export function createCondensationService({
  withIdentity,
  configuration,
  promptUrl = new URL('../content/condensation-prompts.json', import.meta.url),
} = {}) {
  requireFunction(withIdentity, 'withIdentity');
  const provider = String(configuration?.provider || 'none').toLowerCase();
  const configured = ['openai', 'anthropic'].includes(provider)
    && Boolean(configuration?.apiKey)
    && Boolean(configuration?.model);

  async function flagEnabled(identity) {
    if (!configured || identity?.role !== 'student' || identity?.eligible !== true) return false;
    try {
      return await withIdentity(identity, async (client) => {
        const result = await client.query(
          "SELECT public.sf_story_feature_enabled('ai_condensation',ARRAY['student']) AS enabled",
        );
        return result.rows[0]?.enabled === true;
      });
    } catch (error) {
      if (['42501', '42883', '42P01'].includes(error?.code)) return false;
      throw error;
    }
  }

  return Object.freeze({
    provider,
    configured,
    capability: flagEnabled,
    async request(identity, input) {
      const source = exactObject(input, new Set([
        'mode', 'sourceText', 'experienceText', 'patientContext', 'includePatientContext',
      ]));
      if (!await flagEnabled(identity)) {
        throw new CondensationError('condensation_disabled', 'The condensing assistant is not enabled.', 503);
      }
      const mode = String(source.mode || '');
      if (!modes.has(mode) || (source.includePatientContext != null && typeof source.includePatientContext !== 'boolean')) {
        throw new CondensationError('invalid_condensation_request', 'The condensation request is invalid.');
      }
      const prompts = await loadPrompts(promptUrl);
      const prompt = prompts[mode];
      if (!prompt) throw new CondensationError('condensation_configuration_invalid', 'The condensation assistant is unavailable.', 503);
      const includePatientContext = source.includePatientContext === true;
      const sourceText = redactCondensationInput(cleanText(source.sourceText, 'Story text', 20_000), { includePatientContext });
      const experienceText = source.experienceText == null
        ? ''
        : redactCondensationInput(cleanText(source.experienceText, 'Experience context', 5_000), { includePatientContext });
      const patientContext = includePatientContext && source.patientContext
        ? redactCondensationInput(cleanText(source.patientContext, 'Patient context', 500), { includePatientContext: true })
        : '';

      // The approved release may ship with provider=none. Provider execution is
      // deliberately unavailable until the audited suggestion-storage adapter is
      // configured; manual authoring remains fully functional and fail-open.
      throw new CondensationError(
        'condensation_provider_unavailable',
        'The condensing assistant is temporarily unavailable. You can keep writing manually.',
        503,
        { cause: Object.freeze({
          mode,
          promptVersion: `${mode}@${prompt.version}`,
          redactionVersion: condensationRedactionVersion,
          sourceLength: sourceText.length,
          experienceLength: experienceText.length,
          patientContextIncluded: Boolean(patientContext),
        }) },
      );
    },
  });
}
