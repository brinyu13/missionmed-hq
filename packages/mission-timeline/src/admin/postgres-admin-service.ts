import { qualitySourceSha022 } from "./quality-fingerprint.js";
import {canonicalServerQuality022} from '../intelligence/server-quality-022.js';
import type {TimelineDocument} from '../contracts/types.js';
import type { ProviderAuthenticityService022 } from "../intelligence/provider-authenticity-022.js";
import { randomUUID } from 'node:crypto';
import type { PrincipalContext, TimelineAction } from '../contracts/types.js';
import { TimelineError } from '../core/errors.js';
import type { PostgresPool, PostgresTransactionClient } from '../persistence/postgres/types.js';

const ISSUER = 'timeline_admin_authority_022';
const AUTHORITY = 'D1-TIMELINE-STORYFORGE-LIVE-022:e27016edef2f722f1424a16d7246e5e1851d266b7825d832f7bbf62e84ec147c';
const ACTIONS: TimelineAction[] = ['document:read', 'document:edit', 'version:create', 'review:request', 'review:read', 'review:comment', 'review:decide', 'artifact:create', 'artifact:read', 'audit:read'];
type Row = Record<string, unknown>;
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const date = (value: unknown): string | null => value && Number.isFinite(new Date(String(value)).getTime()) ? new Date(String(value)).toISOString() : null;
const positiveId = (value: unknown): number => {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) throw new TimelineError('ADMIN_DIRECTORY_INPUT_INVALID', 'Student identity is invalid.', 400);
  return id;
};

const text = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
const records = (value: unknown): Row[] => Array.isArray(value) ? value.map(object) : [];
const cvType = (value: unknown): boolean => ['cv', 'resume', 'eras'].includes(text(value).toLowerCase());
const sourceType = (source: Row): unknown => source.documentType || source.effectiveType || source.userDeclaredType || source.detectedType || source.detectedDocumentType;
const hasCvProvenance = (value: unknown): boolean => records(value).some(source => {
  // Older imports predate source checksums, but still retain the exact document,
  // block, page and excerpt. A supplied invalid checksum is never legacy evidence.
  const checksum = text(source.sourceSha256);
  return cvType(sourceType(source)) && Boolean(text(source.sourceDocumentId) || text(source.sourceObjectId))
    && Boolean(text(source.sourceBlockId)) && Number.isInteger(source.pageNumber) && Number(source.pageNumber) > 0
    && Boolean(text(source.sourceExcerpt) || text(source.sourceSnippet))
    && (source.sourceSha256 == null || source.sourceSha256 === '' || /^[a-f0-9]{64}$/i.test(checksum));
});

/** Server-derived import history from persisted source lineage, never an imported
 * flag, file title or AI label. Applying/resetting intake may clear its review
 * queue while canonical events, exams and profile fields retain that lineage. */
export function hasImportedCv022(value: unknown): boolean {
  const document = object(value), intake = object(document.intake), extraction = object(intake.extraction);
  const source = object(extraction.sourceDocument), profile = object(document.studentProfile);
  if (extraction.completed === true && cvType(sourceType(source))
    && Boolean(text(source.id) || text(source.objectId)) && /^[a-f0-9]{64}$/i.test(text(source.sha256))) return true;
  const derived = [...records(document.events), ...records(document.exams), ...records(intake.candidates),
    ...records(object(intake.lastImport).acceptedCandidates), ...Object.values(object(profile.fieldProvenance)).map(object)];
  return hasCvProvenance(profile.fullNameProvenance) || derived.some(record => hasCvProvenance(record.provenance));
}

export function adminRosterStatus(wpUserId: number, row: Row | undefined, now = new Date(), authority?: ProviderAuthenticityService022) {
  const documentId = row?.document_id ? String(row.document_id) : null;
  const restricted = Boolean(row && row.principal_status !== 'ACTIVE');
  const lastActivity = date(row?.updated_at);
  const signed = authority?.verify({ ...object(row?.quality_source), id: documentId || "", studentOwnerId: String(row?.owner_principal_id || "") }, "GUARDIAN", row?.quality_authenticity);
  const hasSource=Boolean(documentId&&row?.quality_source&&typeof row.quality_source==='object');
  const report = signed?object(signed.payload.serverQuality):hasSource?canonicalServerQuality022(row!.quality_source as TimelineDocument):{};
  const summary = signed ? { checkedAt: signed.issuedAt, sourceSha256: signed.sourceSha256,
    issueCount: Number(report.findingCount) || 0, exportReady: report.exportReady === true } : hasSource?{
      checkedAt:now.toISOString(),sourceSha256:qualitySourceSha022(row!.quality_source),issueCount:Number(report.findingCount)||0,exportReady:report.exportReady===true}:{};
  const checkedAt = date(summary.checkedAt);
  const sourceHash = row?.quality_source && typeof row.quality_source === 'object' ? qualitySourceSha022(row.quality_source) : null;
  const currentReview = Boolean(checkedAt && Date.parse(checkedAt) <= now.getTime() && sourceHash && summary.sourceSha256 === sourceHash);
  const guardianIssues = currentReview ? Math.max(0, Number(summary.issueCount) || 0) : null;
  const exportReady = currentReview && summary.exportReady === true && guardianIssues === 0;
  const lastExport = date(row?.last_export);
  const recently = (at: string | null) => Boolean(at && now.getTime() - Date.parse(at) >= 0 && now.getTime() - Date.parse(at) < 7 * 86400_000);
  const status = restricted ? 'ACCESS_RESTRICTED' : !documentId ? 'NEVER_STARTED' : String(row?.document_status || 'DRAFT');
  const cvImported = Boolean(documentId && hasImportedCv022(row?.quality_source));
  return {
    wpUserId, documentId, status, cvStatus: cvImported ? 'IMPORTED' : 'NOT_IMPORTED',
    eventCount: Math.max(0, Number(row?.event_count) || 0), lastActivity,
    guardianStatus: !documentId ? 'NOT_STARTED' : !currentReview ? 'NOT_CHECKED' : guardianIssues ? 'ISSUES' : 'CHECKED',
    guardianIssueCount: guardianIssues, exportReadiness: exportReady ? 'READY' : currentReview ? 'NEEDS_REVIEW' : 'NOT_CHECKED',
    guardianBasis:signed?'MISSIONMED_RULE_AND_AI_REVIEW':'MISSIONMED_RULE',
    lastExport, canOpen: Boolean(documentId && !restricted),
    filters: {
      never_started: status === 'NEVER_STARTED', cv_imported: cvImported, draft: status === 'DRAFT',
      needs_review: status === 'IN_REVIEW' || (currentReview && !exportReady), guardian_issues: Boolean(guardianIssues),
      ready: exportReady, recently_exported: recently(lastExport), recently_active: recently(lastActivity),
    },
  };
}

/** Separate server authority, entered only by the enrollment-checked WordPress bridge.
 * Student data never leaves Timeline. Roster reads project minimal status; opening a
 * document issues the existing short, immutable, independently audited resource grant.
 */
export class PostgresTimelineAdminService {
  constructor(private readonly pool: PostgresPool, private readonly clock: () => Date = () => new Date(), private readonly providerAuthenticity?: ProviderAuthenticityService022) {}

  private assertRequest(context: PrincipalContext, input: Record<string, unknown>) {
    if (context.role !== 'PROGRAM_ADMIN' || context.isWordpressAdministrator !== true || context.adminWorkspace !== true) {
      throw new TimelineError('ADMIN_WORKSPACE_REQUIRED', 'Timeline administrator access is required.', 403);
    }
    const verified = Date.parse(String(input.verifiedAt || ''));
    const age = this.clock().getTime() - verified;
    if (!Number.isFinite(age) || age < -5000 || age > 60_000) throw new TimelineError('ENROLLMENT_VERIFICATION_STALE', 'Refresh the current student roster.', 409);
  }

  private async transaction<T>(context: PrincipalContext, action: (client: PostgresTransactionClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    let begun = false;
    try {
      await client.query('begin'); begun = true;
      await client.query('set local role timeline_grant_authority');
      await client.query("set local statement_timeout = '8000ms'");
      await client.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({
        sub: ISSUER, timeline_role: 'SERVICE', program_ids: [], service_scopes: ['audit:read', 'document:read'],
      })]);
      const actor = await client.query("select id from timeline.principals where id=$1 and wp_user_id=$2 and role='PROGRAM_ADMIN' and status='ACTIVE'", [context.principalId, context.wpUserId]);
      if (actor.rows.length !== 1) throw new TimelineError('ADMIN_WORKSPACE_REQUIRED', 'Timeline administrator access is no longer available.', 403);
      const result = await action(client);
      await client.query('commit'); begun = false;
      return result;
    } catch (error) {
      if (begun) await client.query('rollback');
      throw error;
    } finally { client.release(); }
  }

  async roster(context: PrincipalContext, input: Record<string, unknown>) {
    this.assertRequest(context, input);
    if (!Array.isArray(input.wpUserIds) || input.wpUserIds.length > 20000) throw new TimelineError('ADMIN_DIRECTORY_INPUT_INVALID', 'The enrolled population is invalid.', 400);
    const ids = [...new Set(input.wpUserIds.map(positiveId))];
    return this.transaction(context, async (client) => {
      const result = await client.query<Row>(`
        select distinct on (p.wp_user_id) p.wp_user_id, p.status as principal_status,
          d.id as document_id, d.status as document_status, d.current_revision, d.updated_at,
          case when jsonb_typeof(d.document_json->'events')='array' then jsonb_array_length(d.document_json->'events') else 0 end as event_count,
          d.owner_principal_id,
          d.document_json#>'{metadata,qualityReport022,ai,providerAuthenticity}' as quality_authenticity,
          d.document_json as quality_source,
          d.document_json#>>'{metadata,lastExport022,completedAt}' as last_export
        from timeline.principals p
        left join timeline.documents d on d.owner_principal_id=p.id and d.deleted_at is null and d.status not in ('DELETED','ARCHIVED')
        where p.wp_user_id = any($1::bigint[]) and p.role='STUDENT'
        order by p.wp_user_id, d.updated_at desc nulls last, d.id`, [ids]);
      const rows = new Map(result.rows.map((row) => [Number(row.wp_user_id), row]));
      await client.query(`insert into timeline.audit_events(id,actor_id,action,resource_type,resource_id,outcome,request_id,metadata_json)
        values($1,$2,'ADMIN_ROSTER_VIEW','PROGRAM','missionmed-360:3893','SUCCESS',$3,$4::jsonb)`,
      [`audit_${randomUUID()}`, context.principalId, context.requestId, JSON.stringify({ eligible_count: ids.length, enrollment_verified_at: input.verifiedAt, authority: AUTHORITY })]);
      return { students: ids.map((id) => adminRosterStatus(id, rows.get(id), this.clock(), this.providerAuthenticity)), verifiedAt: this.clock().toISOString() };
    });
  }

  async open(context: PrincipalContext, input: Record<string, unknown>) {
    this.assertRequest(context, input);
    const wpUserId = positiveId(input.wpUserId);
    return this.transaction(context, async (client) => {
      const result = await client.query<Row>(`select p.id as student_id, d.id as document_id
        from timeline.principals p join timeline.documents d on d.owner_principal_id=p.id
        where p.wp_user_id=$1 and p.role='STUDENT' and p.status='ACTIVE'
          and d.deleted_at is null and d.status not in ('DELETED','ARCHIVED')
        order by d.updated_at desc, d.id limit 1`, [wpUserId]);
      const row = result.rows[0];
      if (!row) throw new TimelineError('ADMIN_STUDENT_TIMELINE_NOT_FOUND', 'This student has not started an available Timeline.', 404);
      const now = this.clock();
      const existing = await client.query<Row>(`select id, expires_at from timeline.admin_resource_grants
        where administrator_principal_id=$1 and student_principal_id=$2 and document_id=$3
          and starts_at <= $4::timestamptz and expires_at > $4::timestamptz + interval '60 seconds'
          and revoked_at is null and actions @> $5::text[]
        order by expires_at desc limit 1`, [context.principalId, row.student_id, row.document_id, now.toISOString(), ACTIONS]);
      let expiresAt = existing.rows[0] ? date(existing.rows[0].expires_at)! : new Date(now.getTime() + 10 * 60_000).toISOString();
      if (!existing.rows.length) {
        const grantId = `admin_grant_${randomUUID()}`;
        const auditId = `audit_${randomUUID()}`;
        const reason = `Founder-authorized Timeline review: ${AUTHORITY}`;
        const metadata = { grant_id: grantId, administrator_principal_id: context.principalId,
          student_principal_id: row.student_id, actions: ACTIONS, reason, starts_at: now.toISOString(), expires_at: expiresAt,
          enrollment_verified_at: input.verifiedAt, source: 'wordpress-learndash-3893' };
        await client.query(`insert into timeline.audit_events(id,actor_id,action,resource_type,resource_id,outcome,request_id,metadata_json)
          values($1,$2,'ADMIN_RESOURCE_GRANT','DOCUMENT',$3,'ALLOW',$4,$5::jsonb)`, [auditId, ISSUER, row.document_id, context.requestId, JSON.stringify(metadata)]);
        await client.query(`insert into timeline.admin_resource_grants(id,administrator_principal_id,student_principal_id,document_id,actions,
          created_by_principal_id,authorization_audit_id,reason,starts_at,expires_at)
          values($1,$2,$3,$4,$5::text[],$6,$7,$8,$9::timestamptz,$10::timestamptz)`,
        [grantId, context.principalId, row.student_id, row.document_id, ACTIONS, ISSUER, auditId, reason, now.toISOString(), expiresAt]);
      }
      await client.query(`insert into timeline.audit_events(id,actor_id,action,resource_type,resource_id,outcome,request_id,metadata_json)
        values($1,$2,'ADMIN_TIMELINE_OPEN','DOCUMENT',$3,'SUCCESS',$4,$5::jsonb)`,
      [`audit_${randomUUID()}`, context.principalId, row.document_id, context.requestId, JSON.stringify({ student_principal_id: row.student_id, authority: AUTHORITY, expires_at: expiresAt })]);
      return { documentId: String(row.document_id), studentPrincipalId: String(row.student_id), canEdit: true, grantExpiresAt: expiresAt };
    });
  }
}
