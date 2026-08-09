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

export function planCaseExport({
  id,
  caseRecord,
  actor,
  entitlement,
  serviceGrant = null,
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
