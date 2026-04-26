/**
 * USCE Validation Schemas (Step 2.1)
 * Authority: W-028 (ARCHITECT_PLAN-028 validation_schemas + endpoint input contracts)
 *
 * Zod-equivalent deterministic validators used before any DB read/write.
 */

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export interface ValidationIssue {
  path: string;
  message: string;
  code: string;
}

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; errors: ValidationIssue[] };

// ---------------------------------------------------------------------------
// Input shapes
// ---------------------------------------------------------------------------

export interface CreateRequestBody {
  applicant_name: string;
  applicant_email: string;
  applicant_phone_e164?: string;
  program_seat_id: string;
  preferred_specialties: string[];
  preferred_locations: string[];
  preferred_months: string[];
  preference_rankings: {
    specialties?: number[];
    locations?: number[];
    months?: number[];
  };
  intake_payload?: Record<string, unknown>;
}

export interface CreateOfferBody {
  request_id: string;
  program_seat_id: string;
  amount_cents: number;
  subject: string;
  html_body: string;
  text_body: string;
}

export interface ApproveOfferBody {
  subject: string;
  html_body: string;
  text_body: string;
}

export interface PreviewOfferBody {
  subject: string;
  html_body: string;
  text_body: string;
}

export interface RespondPortalBody {
  action: 'ACCEPT' | 'DECLINE';
}

export interface CreateInternalNoteBody {
  body_text: string;
  offer_id?: string;
}

export interface ManualPaymentBody {
  manual_reference: string;
  captured_at?: string;
}

export interface ExtendPaymentWindowBody {
  additional_minutes: number;
  justification: string;
}

export interface RefundConfirmationBody {
  reason: string;
}

// ---------------------------------------------------------------------------
// Primitive validators
// ---------------------------------------------------------------------------

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PHONE_E164_RE = /^\+[1-9][0-9]{6,14}$/;
const FIRST_OF_MONTH_RE = /^\d{4}-\d{2}-01$/;

function issue(path: string, message: string, code: string): ValidationIssue {
  return { path, message, code };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

function isEmail(value: string): boolean {
  if (value.length > 254) return false;
  const at = value.indexOf('@');
  if (at <= 0 || at === value.length - 1) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isIso8601(value: string): boolean {
  if (!value || Number.isNaN(Date.parse(value))) return false;
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/.test(value);
}

function isAmountCents(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value > 0 &&
    value <= 50_000_000
  );
}

function isCurrentOrFutureFirstOfMonth(value: string): boolean {
  if (!FIRST_OF_MONTH_RE.test(value)) return false;

  const monthStartUtc = new Date();
  const currentMonthStart = new Date(
    Date.UTC(monthStartUtc.getUTCFullYear(), monthStartUtc.getUTCMonth(), 1)
  );

  const candidate = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(candidate.getTime())) return false;

  return candidate.getTime() >= currentMonthStart.getTime();
}

function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (const char of value) {
    const codePoint = char.codePointAt(0) ?? 0;
    if (codePoint <= 0x7f) bytes += 1;
    else if (codePoint <= 0x7ff) bytes += 2;
    else if (codePoint <= 0xffff) bytes += 3;
    else bytes += 4;
  }
  return bytes;
}

function hasOnlyKeys(
  input: Record<string, unknown>,
  allowed: readonly string[],
  errors: ValidationIssue[],
  pathPrefix = ''
): void {
  const allowedSet = new Set(allowed);
  for (const key of Object.keys(input)) {
    if (!allowedSet.has(key)) {
      errors.push(issue(`${pathPrefix}${key}`, 'Unknown field.', 'UNKNOWN_FIELD'));
    }
  }
}

function parseTrimmedString(
  value: unknown,
  path: string,
  min: number,
  max: number,
  code: string,
  errors: ValidationIssue[]
): string | null {
  if (typeof value !== 'string') {
    errors.push(issue(path, 'Expected string.', code));
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.length < min || trimmed.length > max) {
    errors.push(issue(path, `Must be between ${min} and ${max} characters.`, code));
    return null;
  }

  return trimmed;
}

function parseBoundedRawString(
  value: unknown,
  path: string,
  min: number,
  max: number,
  code: string,
  errors: ValidationIssue[]
): string | null {
  if (typeof value !== 'string') {
    errors.push(issue(path, 'Expected string.', code));
    return null;
  }
  if (value.length < min || value.length > max) {
    errors.push(issue(path, `Must be between ${min} and ${max} characters.`, code));
    return null;
  }
  return value;
}

function validateRankingPermutation(
  values: number[],
  expectedLength: number,
  path: string,
  errors: ValidationIssue[]
): void {
  if (values.length !== expectedLength) {
    errors.push(issue(path, 'Ranking length must match preferred array length.', 'INVALID_RANKING'));
    return;
  }

  const seen = new Set<number>();
  for (const value of values) {
    if (!Number.isInteger(value) || value < 1 || value > expectedLength || seen.has(value)) {
      errors.push(issue(path, 'Ranking values must be a permutation of 1..N.', 'INVALID_RANKING'));
      return;
    }
    seen.add(value);
  }
}

function parseStringArray(
  value: unknown,
  path: string,
  minItems: number,
  maxItems: number,
  itemMin: number,
  itemMax: number,
  code: string,
  errors: ValidationIssue[]
): string[] | null {
  if (!Array.isArray(value)) {
    errors.push(issue(path, 'Expected array.', code));
    return null;
  }

  if (value.length < minItems || value.length > maxItems) {
    errors.push(issue(path, `Must contain ${minItems}-${maxItems} items.`, code));
    return null;
  }

  const out: string[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < value.length; i += 1) {
    const itemPath = `${path}.${i}`;
    const item = parseTrimmedString(value[i], itemPath, itemMin, itemMax, code, errors);
    if (item === null) continue;
    if (seen.has(item)) {
      errors.push(issue(path, 'Array values must be unique.', code));
      continue;
    }
    seen.add(item);
    out.push(item);
  }

  return errors.length > 0 ? null : out;
}

function parseMonthArray(
  value: unknown,
  path: string,
  errors: ValidationIssue[]
): string[] | null {
  if (!Array.isArray(value)) {
    errors.push(issue(path, 'Expected array.', 'INVALID_PREFERRED_MONTHS'));
    return null;
  }

  if (value.length < 1 || value.length > 3) {
    errors.push(issue(path, 'Must contain 1-3 items.', 'INVALID_PREFERRED_MONTHS'));
    return null;
  }

  const out: string[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < value.length; i += 1) {
    const itemPath = `${path}.${i}`;
    const month = value[i];

    if (typeof month !== 'string' || !isCurrentOrFutureFirstOfMonth(month)) {
      errors.push(
        issue(
          itemPath,
          'Date must be YYYY-MM-01 and current month or later.',
          'INVALID_PREFERRED_MONTHS'
        )
      );
      continue;
    }

    if (seen.has(month)) {
      errors.push(issue(path, 'Array values must be unique.', 'INVALID_PREFERRED_MONTHS'));
      continue;
    }

    seen.add(month);
    out.push(month);
  }

  return errors.length > 0 ? null : out;
}

// ---------------------------------------------------------------------------
// Schema validators
// ---------------------------------------------------------------------------

export function validateCreateRequestBody(input: unknown): ValidationResult<CreateRequestBody> {
  const errors: ValidationIssue[] = [];

  if (!isPlainObject(input)) {
    return {
      success: false,
      errors: [issue('', 'Expected object payload.', 'VALIDATION_FAILED')],
    };
  }

  hasOnlyKeys(
    input,
    [
      'applicant_name',
      'applicant_email',
      'applicant_phone_e164',
      'program_seat_id',
      'preferred_specialties',
      'preferred_locations',
      'preferred_months',
      'preference_rankings',
      'intake_payload',
    ],
    errors
  );

  const applicantName = parseTrimmedString(
    input.applicant_name,
    'applicant_name',
    2,
    200,
    'INVALID_LENGTH',
    errors
  );

  let applicantEmail: string | null = null;
  if (typeof input.applicant_email !== 'string') {
    errors.push(issue('applicant_email', 'Expected string.', 'INVALID_EMAIL'));
  } else {
    applicantEmail = input.applicant_email.trim().toLowerCase();
    if (!isEmail(applicantEmail)) {
      errors.push(issue('applicant_email', 'Invalid email format.', 'INVALID_EMAIL'));
    }
  }

  let applicantPhone: string | undefined;
  if (input.applicant_phone_e164 !== undefined) {
    if (
      typeof input.applicant_phone_e164 !== 'string' ||
      !PHONE_E164_RE.test(input.applicant_phone_e164)
    ) {
      errors.push(issue('applicant_phone_e164', 'Invalid E.164 phone format.', 'INVALID_PHONE'));
    } else {
      applicantPhone = input.applicant_phone_e164;
    }
  }

  let programSeatId: string | null = null;
  if (typeof input.program_seat_id !== 'string' || !isUuid(input.program_seat_id)) {
    errors.push(issue('program_seat_id', 'Invalid UUID.', 'INVALID_UUID'));
  } else {
    programSeatId = input.program_seat_id;
  }

  const specialties = parseStringArray(
    input.preferred_specialties,
    'preferred_specialties',
    1,
    3,
    2,
    80,
    'INVALID_PREFERRED_SPECIALTIES',
    errors
  );

  const locations = parseStringArray(
    input.preferred_locations,
    'preferred_locations',
    1,
    3,
    2,
    120,
    'INVALID_PREFERRED_LOCATIONS',
    errors
  );

  const months = parseMonthArray(input.preferred_months, 'preferred_months', errors);

  let rankings: CreateRequestBody['preference_rankings'] | null = null;
  if (!isPlainObject(input.preference_rankings)) {
    errors.push(issue('preference_rankings', 'Expected object.', 'VALIDATION_FAILED'));
  } else {
    hasOnlyKeys(input.preference_rankings, ['specialties', 'locations', 'months'], errors, 'preference_rankings.');

    rankings = {};

    const mapping: Array<{
      key: 'specialties' | 'locations' | 'months';
      expectedLength: number | null;
    }> = [
      {
        key: 'specialties',
        expectedLength: specialties ? specialties.length : null,
      },
      {
        key: 'locations',
        expectedLength: locations ? locations.length : null,
      },
      {
        key: 'months',
        expectedLength: months ? months.length : null,
      },
    ];

    for (const { key, expectedLength } of mapping) {
      const value = input.preference_rankings[key];
      if (value === undefined) continue;

      if (!Array.isArray(value)) {
        errors.push(issue(`preference_rankings.${key}`, 'Expected integer array.', 'INVALID_RANKING'));
        continue;
      }

      const parsed: number[] = [];
      for (let i = 0; i < value.length; i += 1) {
        const entry = value[i];
        if (typeof entry !== 'number' || !Number.isInteger(entry) || entry < 1) {
          errors.push(
            issue(
              `preference_rankings.${key}.${i}`,
              'Ranking entries must be positive integers.',
              'INVALID_RANKING'
            )
          );
          continue;
        }
        parsed.push(entry);
      }

      if (expectedLength !== null) {
        validateRankingPermutation(parsed, expectedLength, `preference_rankings.${key}`, errors);
      }

      rankings[key] = parsed;
    }
  }

  let intakePayload: Record<string, unknown> | undefined;
  if (input.intake_payload !== undefined) {
    if (!isPlainObject(input.intake_payload)) {
      errors.push(issue('intake_payload', 'Expected object.', 'PAYLOAD_TOO_LARGE'));
    } else {
      const serialized = JSON.stringify(input.intake_payload);
      if (utf8ByteLength(serialized) > 16_384) {
        errors.push(issue('intake_payload', 'Serialized payload exceeds 16384 bytes.', 'PAYLOAD_TOO_LARGE'));
      } else {
        intakePayload = input.intake_payload;
      }
    }
  }

  if (
    errors.length > 0 ||
    !applicantName ||
    !applicantEmail ||
    !programSeatId ||
    !specialties ||
    !locations ||
    !months ||
    !rankings
  ) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      applicant_name: applicantName,
      applicant_email: applicantEmail,
      ...(applicantPhone ? { applicant_phone_e164: applicantPhone } : {}),
      program_seat_id: programSeatId,
      preferred_specialties: specialties,
      preferred_locations: locations,
      preferred_months: months,
      preference_rankings: rankings,
      ...(intakePayload ? { intake_payload: intakePayload } : {}),
    },
  };
}

export function validateCreateOfferBody(input: unknown): ValidationResult<CreateOfferBody> {
  const errors: ValidationIssue[] = [];

  if (!isPlainObject(input)) {
    return {
      success: false,
      errors: [issue('', 'Expected object payload.', 'VALIDATION_FAILED')],
    };
  }

  hasOnlyKeys(
    input,
    ['request_id', 'program_seat_id', 'amount_cents', 'subject', 'html_body', 'text_body'],
    errors
  );

  const requestId =
    typeof input.request_id === 'string' && isUuid(input.request_id)
      ? input.request_id
      : (errors.push(issue('request_id', 'Invalid UUID.', 'INVALID_UUID')), null);

  const programSeatId =
    typeof input.program_seat_id === 'string' && isUuid(input.program_seat_id)
      ? input.program_seat_id
      : (errors.push(issue('program_seat_id', 'Invalid UUID.', 'INVALID_UUID')), null);

  const amountCents = isAmountCents(input.amount_cents)
    ? input.amount_cents
    : (errors.push(issue('amount_cents', 'Invalid amount_cents.', 'INVALID_AMOUNT')), null);

  const subject = parseTrimmedString(
    input.subject,
    'subject',
    1,
    300,
    'INVALID_SUBJECT_LENGTH',
    errors
  );

  const htmlBody = parseBoundedRawString(
    input.html_body,
    'html_body',
    1,
    50_000,
    'INVALID_HTML_BODY_LENGTH',
    errors
  );

  const textBody = parseBoundedRawString(
    input.text_body,
    'text_body',
    1,
    50_000,
    'INVALID_TEXT_BODY_LENGTH',
    errors
  );

  if (
    errors.length > 0 ||
    !requestId ||
    !programSeatId ||
    amountCents === null ||
    !subject ||
    !htmlBody ||
    !textBody
  ) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      request_id: requestId,
      program_seat_id: programSeatId,
      amount_cents: amountCents,
      subject,
      html_body: htmlBody,
      text_body: textBody,
    },
  };
}

export function validateApproveOfferBody(input: unknown): ValidationResult<ApproveOfferBody> {
  return validateOfferBodyTextTriple(input);
}

export function validatePreviewOfferBody(input: unknown): ValidationResult<PreviewOfferBody> {
  return validateOfferBodyTextTriple(input);
}

function validateOfferBodyTextTriple(input: unknown): ValidationResult<{
  subject: string;
  html_body: string;
  text_body: string;
}> {
  const errors: ValidationIssue[] = [];

  if (!isPlainObject(input)) {
    return {
      success: false,
      errors: [issue('', 'Expected object payload.', 'VALIDATION_FAILED')],
    };
  }

  hasOnlyKeys(input, ['subject', 'html_body', 'text_body'], errors);

  const subject = parseTrimmedString(
    input.subject,
    'subject',
    1,
    300,
    'INVALID_SUBJECT_LENGTH',
    errors
  );
  const htmlBody = parseBoundedRawString(
    input.html_body,
    'html_body',
    1,
    50_000,
    'INVALID_HTML_BODY_LENGTH',
    errors
  );
  const textBody = parseBoundedRawString(
    input.text_body,
    'text_body',
    1,
    50_000,
    'INVALID_TEXT_BODY_LENGTH',
    errors
  );

  if (errors.length > 0 || !subject || !htmlBody || !textBody) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      subject,
      html_body: htmlBody,
      text_body: textBody,
    },
  };
}

export function validateRespondPortalBody(input: unknown): ValidationResult<RespondPortalBody> {
  const errors: ValidationIssue[] = [];

  if (!isPlainObject(input)) {
    return {
      success: false,
      errors: [issue('', 'Expected object payload.', 'VALIDATION_FAILED')],
    };
  }

  hasOnlyKeys(input, ['action'], errors);

  if (input.action !== 'ACCEPT' && input.action !== 'DECLINE') {
    errors.push(issue('action', 'Action must be ACCEPT or DECLINE.', 'INVALID_ENUM'));
    return { success: false, errors };
  }

  return { success: true, data: { action: input.action } };
}

export function validateCreateInternalNoteBody(
  input: unknown
): ValidationResult<CreateInternalNoteBody> {
  const errors: ValidationIssue[] = [];

  if (!isPlainObject(input)) {
    return {
      success: false,
      errors: [issue('', 'Expected object payload.', 'VALIDATION_FAILED')],
    };
  }

  hasOnlyKeys(input, ['body_text', 'offer_id'], errors);

  const bodyText = parseTrimmedString(
    input.body_text,
    'body_text',
    1,
    5000,
    'INVALID_BODY_TEXT_LENGTH',
    errors
  );

  let offerId: string | undefined;
  if (input.offer_id !== undefined) {
    if (typeof input.offer_id !== 'string' || !isUuid(input.offer_id)) {
      errors.push(issue('offer_id', 'Invalid UUID.', 'INVALID_UUID'));
    } else {
      offerId = input.offer_id;
    }
  }

  if (errors.length > 0 || !bodyText) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      body_text: bodyText,
      ...(offerId ? { offer_id: offerId } : {}),
    },
  };
}

export function validateManualPaymentBody(input: unknown): ValidationResult<ManualPaymentBody> {
  const errors: ValidationIssue[] = [];

  if (!isPlainObject(input)) {
    return {
      success: false,
      errors: [issue('', 'Expected object payload.', 'VALIDATION_FAILED')],
    };
  }

  hasOnlyKeys(input, ['manual_reference', 'captured_at'], errors);

  const manualReference = parseTrimmedString(
    input.manual_reference,
    'manual_reference',
    1,
    500,
    'INVALID_MANUAL_REFERENCE',
    errors
  );

  let capturedAt: string | undefined;
  if (input.captured_at !== undefined) {
    if (typeof input.captured_at !== 'string' || !isIso8601(input.captured_at)) {
      errors.push(issue('captured_at', 'Expected ISO8601 UTC timestamp.', 'INVALID_CAPTURED_AT'));
    } else {
      capturedAt = input.captured_at;
    }
  }

  if (errors.length > 0 || !manualReference) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      manual_reference: manualReference,
      ...(capturedAt ? { captured_at: capturedAt } : {}),
    },
  };
}

export function validateExtendPaymentWindowBody(
  input: unknown
): ValidationResult<ExtendPaymentWindowBody> {
  const errors: ValidationIssue[] = [];

  if (!isPlainObject(input)) {
    return {
      success: false,
      errors: [issue('', 'Expected object payload.', 'VALIDATION_FAILED')],
    };
  }

  hasOnlyKeys(input, ['additional_minutes', 'justification'], errors);

  const additionalMinutes =
    typeof input.additional_minutes === 'number' &&
    Number.isInteger(input.additional_minutes) &&
    input.additional_minutes >= 1 &&
    input.additional_minutes <= 120
      ? input.additional_minutes
      : (errors.push(
          issue(
            'additional_minutes',
            'additional_minutes must be an integer between 1 and 120.',
            'INVALID_ADDITIONAL_MINUTES'
          )
        ),
        null);

  const justification = parseTrimmedString(
    input.justification,
    'justification',
    10,
    5000,
    'INVALID_JUSTIFICATION',
    errors
  );

  if (errors.length > 0 || additionalMinutes === null || !justification) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: {
      additional_minutes: additionalMinutes,
      justification,
    },
  };
}

export function validateRefundConfirmationBody(
  input: unknown
): ValidationResult<RefundConfirmationBody> {
  const errors: ValidationIssue[] = [];

  if (!isPlainObject(input)) {
    return {
      success: false,
      errors: [issue('', 'Expected object payload.', 'VALIDATION_FAILED')],
    };
  }

  hasOnlyKeys(input, ['reason'], errors);

  const reason = parseTrimmedString(input.reason, 'reason', 10, 5000, 'INVALID_REASON', errors);

  if (errors.length > 0 || !reason) {
    return { success: false, errors };
  }

  return {
    success: true,
    data: { reason },
  };
}
