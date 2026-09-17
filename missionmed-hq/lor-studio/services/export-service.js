import { ValidationError } from '../domain/errors.js';
import {
  assertNonEmptyString,
  deepFreeze,
  hashValue,
  makeId,
  toIso,
} from '../domain/value-utils.js';
import { projectCaseForActor } from '../security/authorization-policy.js';

const ALLOWED_PURPOSES = new Set([
  'student_copy',
  'faculty_review',
  'institution_delivery',
  'privacy_request',
  'operational_review',
]);
const ALLOWED_DESTINATIONS = new Set([
  'actor_private_download',
  'faculty_private_workspace',
  'approved_institution_channel',
  'privacy_authority_workspace',
  'operations_metadata_workspace',
]);

const ROLE_EXPORT_RULES = {
  student: new Set([
    'student_copy:actor_private_download',
    'privacy_request:actor_private_download',
  ]),
  faculty: new Set([
    'faculty_review:faculty_private_workspace',
    'institution_delivery:approved_institution_channel',
  ]),
  admin: new Set(['operational_review:operations_metadata_workspace']),
  founder: new Set(['operational_review:operations_metadata_workspace']),
  support: new Set(['operational_review:operations_metadata_workspace']),
  mentor: new Set([]),
  service: new Set([]),
};

/**
 * DR-119 clause 9. An export is a projection plus an intent record; the projection is produced
 * by projectCaseForActor, so every capability that projection needs has to reach it from here.
 *
 * `operationalGrant` is carried exactly as `serviceGrant` already is: accepted, defaulted to
 * null, and forwarded VERBATIM - the identical object reference, never a copy. This layer
 * neither mints, rebinds, normalises, validates, nor inspects it. Two reasons, and both matter:
 *
 *   1. the case-scoped, expiring, revocation-checked decision belongs to authorization-policy.js
 *      and the grant repository. A missing or mis-bound capability raises AuthorizationDeniedError
 *      from there, rather than becoming an export this layer decided was acceptable; and
 *   2. an operational-metadata capability carries its authority by OBJECT IDENTITY, so spreading,
 *      cloning, or re-wrapping it here would silently destroy the authority it is meant to prove.
 *      Pass it on untouched or not at all.
 *
 * Without this parameter a legitimately granted admin/founder/support actor could not export at
 * all: the capability had no path through the service layer to the gate that demands it.
 *
 * The capability contributes nothing to the returned export intent - intent fields are unchanged,
 * so audit and telemetry consumers see exactly the record shape they saw before, and no grant
 * material leaks into a record they persist.
 */
export function planCaseExport({
  id,
  caseRecord,
  actor,
  entitlement,
  serviceGrant = null,
  operationalGrant = null,
  purpose,
  destinationClass,
  requireCanary = false,
  now = new Date(),
  idFactory,
}) {
  assertNonEmptyString(purpose, 'purpose');
  assertNonEmptyString(destinationClass, 'destinationClass');
  if (!ALLOWED_PURPOSES.has(purpose)) throw new ValidationError('Export purpose is not allowed');
  if (!ALLOWED_DESTINATIONS.has(destinationClass)) {
    throw new ValidationError('Export destination class is not allowed');
  }
  const allowedPairs = ROLE_EXPORT_RULES[actor?.role];
  if (!allowedPairs?.has(`${purpose}:${destinationClass}`)) {
    throw new ValidationError('Actor role, export purpose, and destination are not an allowed combination');
  }
  const projection = projectCaseForActor({
    actor,
    caseRecord,
    entitlement,
    serviceGrant,
    operationalGrant,
    requireCanary,
    now,
  });
  const projectionHash = hashValue(projection);
  const exportIntent = deepFreeze({
    schemaVersion: 'missionmed.lor.export-intent.v1',
    id: id ?? makeId('export', idFactory),
    actorId: actor.id,
    actorRole: actor.role,
    caseId: caseRecord.id,
    projectionHash,
    destinationClass,
    purpose,
    plannedAt: toIso(now, 'now'),
    remoteMutationPerformed: false,
  });
  return deepFreeze({ exportIntent, projection });
}
