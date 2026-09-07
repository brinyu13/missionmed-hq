import { randomUUID } from "node:crypto";
import type { PrincipalContext } from "../contracts/types.js";
import { sha256, stableStringify } from "../core/canonical.js";
import { TimelineError } from "../core/errors.js";
import type { PostgresPool, PostgresTransactionClient } from "../persistence/postgres/types.js";
import { postgresClaimsFromPrincipal } from "../persistence/postgres/types.js";

export const FOUNDER_STANDARD_RETRIEVAL_SCHEMA = "d1-022-founder-standard-retrieval.1" as const;
export const FOUNDER_STANDARD_KINDS = ["GOOD_EXAMPLE", "REJECTED_EXAMPLE", "PHRASING", "CATEGORY_CORRECTION", "DENSITY", "LAYOUT", "KEEP_REMOVE", "VISUAL_QUALITY", "INTERVIEW_READINESS"] as const;
export type FounderStandardKind = typeof FOUNDER_STANDARD_KINDS[number];
export type FounderStandardWorkflow = "CV" | "GUARDIAN" | "RESCUE";
export interface FounderStandardReference {
  standardId: string;
  version: number;
  contentSha256: string;
  sourceRef: string;
  sourceSha256: string;
  approvalRef: string;
  approvalDecisionId: string;
}
export interface ApprovedFounderStandard extends FounderStandardReference {
  kind: FounderStandardKind;
  title: string;
  guidance: string;
  applicability: { workflows: FounderStandardWorkflow[]; categoryIds: string[] };
  dataClass: "NONPERSONAL" | "SYNTHETIC";
}
export interface FounderStandardProvenance {
  schemaVersion: typeof FOUNDER_STANDARD_RETRIEVAL_SCHEMA;
  retrievalSha256: string;
  standards: FounderStandardReference[];
}
export interface FounderStandardRetrieval extends Omit<FounderStandardProvenance, "standards"> {
  standards: ApprovedFounderStandard[];
}
export interface FounderStandardRetriever {
  retrieve(context: PrincipalContext, filter: { workflow: FounderStandardWorkflow; categoryIds?: string[] }): Promise<FounderStandardRetrieval>;
}
interface RevisionContent {
  standardId: string;
  kind: FounderStandardKind;
  title: string;
  guidance: string;
  applicability: ApprovedFounderStandard["applicability"];
  provenance: { sourceRef: string; sourceSha256: string; dataClass: ApprovedFounderStandard["dataClass"] };
}
type DbRow = Record<string, unknown>;
const WORKFLOWS = new Set<FounderStandardWorkflow>(["CV", "GUARDIAN", "RESCUE"]);

function text(value: unknown, limit: number, label: string): string {
  if (typeof value !== "string" || !value.trim() || value.length > limit || /[\u0000-\u001f\u007f]/.test(value.replace(/[\n\r\t]/g, ""))) {
    throw new TimelineError("FOUNDER_STANDARD_INPUT_INVALID", `${label} is invalid.`, 400);
  }
  const result = value.trim();
  if (/-----BEGIN .*PRIVATE KEY|\bBearer\s+[A-Za-z0-9._-]+|\bsk-[a-zA-Z0-9_-]{16,}|[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[A-Za-z]{2,}/.test(result)) {
    throw new TimelineError("FOUNDER_STANDARD_PRIVATE_CONTENT_DENIED", "Standards must use nonpersonal guidance or synthetic examples without credentials or personal contact details.", 400);
  }
  return result;
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TimelineError("FOUNDER_STANDARD_INPUT_INVALID", "A standard object is required.", 400);
  return value as Record<string, unknown>;
}
function id(value: unknown): string {
  const result = text(value, 120, "Standard identifier");
  if (!/^[a-z][a-z0-9_.:-]{2,119}$/.test(result)) throw new TimelineError("FOUNDER_STANDARD_INPUT_INVALID", "Standard identifier is invalid.", 400);
  return result;
}
function version(value: unknown): number {
  if (!Number.isSafeInteger(value) || Number(value) < 1) throw new TimelineError("FOUNDER_STANDARD_INPUT_INVALID", "Standard version is invalid.", 400);
  return Number(value);
}
function normalizeContent(input: Record<string, unknown>): RevisionContent {
  const kind = String(input.kind) as FounderStandardKind;
  if (!(FOUNDER_STANDARD_KINDS as readonly string[]).includes(kind)) throw new TimelineError("FOUNDER_STANDARD_INPUT_INVALID", "Standard kind is invalid.", 400);
  const applicability = object(input.applicability);
  const workflows = Array.isArray(applicability.workflows) ? [...new Set(applicability.workflows)] : [];
  const categories = Array.isArray(applicability.categoryIds) ? [...new Set(applicability.categoryIds)] : [];
  if (!workflows.length || workflows.length > 3 || workflows.some((item) => !WORKFLOWS.has(item as FounderStandardWorkflow)) || categories.length > 30 || categories.some((item) => typeof item !== "string" || !/^[a-zA-Z0-9_-]{1,80}$/.test(item))) {
    throw new TimelineError("FOUNDER_STANDARD_INPUT_INVALID", "Standard applicability is invalid.", 400);
  }
  const provenance = object(input.provenance);
  if (provenance.dataClass !== "NONPERSONAL" && provenance.dataClass !== "SYNTHETIC") throw new TimelineError("FOUNDER_STANDARD_PRIVATE_CONTENT_DENIED", "Private student examples are not accepted by this standards registry.", 400);
  if (typeof provenance.sourceSha256 !== "string" || !/^[a-f0-9]{64}$/.test(provenance.sourceSha256)) throw new TimelineError("FOUNDER_STANDARD_INPUT_INVALID", "Source SHA-256 is required.", 400);
  return {
    standardId: id(input.standardId), kind,
    title: text(input.title, 140, "Title"), guidance: text(input.guidance, 4_000, "Guidance"),
    applicability: { workflows: (workflows as FounderStandardWorkflow[]).sort(), categoryIds: (categories as string[]).sort() },
    provenance: { sourceRef: text(provenance.sourceRef, 500, "Source reference"), sourceSha256: provenance.sourceSha256, dataClass: provenance.dataClass },
  };
}
function contentFromRow(row: DbRow): RevisionContent {
  return normalizeContent({ standardId: row.standard_id, kind: row.kind, title: row.title, guidance: row.guidance, applicability: row.applicability_json, provenance: row.provenance_json });
}
function contentHash(content: RevisionContent, revision: number): string {
  return sha256(stableStringify({ ...content, version: revision }));
}
function assertManager(context: PrincipalContext): void {
  if (context.role !== "PROGRAM_ADMIN" || context.isWordpressAdministrator !== true || context.founderStandardsManager !== true) {
    throw new TimelineError("FOUNDER_STANDARD_MANAGER_REQUIRED", "The authorized Founder standards manager is required.", 403);
  }
}
function assertReader(context: PrincipalContext): void {
  if (!((context.role === "STUDENT" && context.hasLearndash3893Access === true) || (context.role === "PROGRAM_ADMIN" && context.isWordpressAdministrator === true))) {
    throw new TimelineError("FOUNDER_STANDARD_READER_REQUIRED", "Current Timeline eligibility is required.", 403);
  }
}
export function founderStandardProvenance(retrieval: FounderStandardRetrieval): FounderStandardProvenance {
  return {
    schemaVersion: retrieval.schemaVersion, retrievalSha256: retrieval.retrievalSha256,
    standards: retrieval.standards.map(({ standardId, version, contentSha256, sourceRef, sourceSha256, approvalRef, approvalDecisionId }) => ({ standardId, version, contentSha256, sourceRef, sourceSha256, approvalRef, approvalDecisionId })),
  };
}
export function emptyFounderStandardRetrieval(): FounderStandardRetrieval {
  return { schemaVersion: FOUNDER_STANDARD_RETRIEVAL_SCHEMA, retrievalSha256: sha256(stableStringify([])), standards: [] };
}

/** Isolated registry: immutable revisions and append-only publication decisions. */
export class PostgresFounderStandardRegistry implements FounderStandardRetriever {
  private readonly runtimeRole: string;
  constructor(private readonly pool: PostgresPool, options: { runtimeRole?: string } = {}) {
    this.runtimeRole = options.runtimeRole || "timeline_authenticated";
    if (!/^[a-z_][a-z0-9_]*$/.test(this.runtimeRole)) throw new TypeError("TIMELINE_RUNTIME_ROLE_INVALID");
  }
  private async withIdentity<T>(context: PrincipalContext, work: (client: PostgresTransactionClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect(); let started = false;
    try {
      await client.query("begin"); started = true;
      await client.query(`set local role ${this.runtimeRole}`);
      await client.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ ...postgresClaimsFromPrincipal(context), founder_standards_manager: context.founderStandardsManager === true })]);
      await client.query("set local statement_timeout = '5000ms'");
      const result = await work(client);
      await client.query("commit"); started = false; return result;
    } catch (error) {
      if (started) await client.query("rollback").catch(() => {});
      throw error;
    } finally { client.release(); }
  }
  async retrieve(context: PrincipalContext, filter: { workflow: FounderStandardWorkflow; categoryIds?: string[] }): Promise<FounderStandardRetrieval> {
    assertReader(context);
    if (!WORKFLOWS.has(filter.workflow)) throw new TimelineError("FOUNDER_STANDARD_FILTER_INVALID", "Standard workflow is invalid.", 400);
    const categories = filter.categoryIds === undefined ? null : filter.categoryIds.filter((item) => /^[a-zA-Z0-9_-]{1,80}$/.test(item)).slice(0, 30);
    const rows = await this.withIdentity(context, async (client) => (await client.query<DbRow>(`
      with publication as (
        select distinct on (standard_id) standard_id, version, decision, id, approval_ref
        from timeline.founder_standard_decisions where decision in ('APPROVE','RETIRE')
        order by standard_id, sequence desc
      )
      select r.*, p.id as approval_decision_id, p.approval_ref
      from timeline.founder_standard_revisions r join publication p using (standard_id, version)
      where p.decision = 'APPROVE' and r.applicability_json->'workflows' ? $1
        and ($2::text[] is null or jsonb_array_length(r.applicability_json->'categoryIds') = 0 or r.applicability_json->'categoryIds' ?| $2::text[])
      order by r.standard_id limit 101`, [filter.workflow, categories])).rows).catch(() => { throw new TimelineError("FOUNDER_STANDARD_RETRIEVAL_UNAVAILABLE", "Approved standards are temporarily unavailable.", 503); });
    if (rows.length > 100) throw new TimelineError("FOUNDER_STANDARD_RETRIEVAL_LIMIT", "The approved standards set exceeds the bounded review limit.", 503);
    const standards: ApprovedFounderStandard[] = rows.map((row) => {
      const content = contentFromRow(row); const revision = version(row.version); const hash = contentHash(content, revision);
      if (row.content_sha256 !== hash) throw new TimelineError("FOUNDER_STANDARD_INTEGRITY_FAILED", "Approved standard integrity could not be verified.", 503);
      return { standardId: content.standardId, version: revision, kind: content.kind, title: content.title, guidance: content.guidance, applicability: content.applicability, dataClass: content.provenance.dataClass, contentSha256: hash, sourceRef: content.provenance.sourceRef, sourceSha256: content.provenance.sourceSha256, approvalRef: String(row.approval_ref), approvalDecisionId: String(row.approval_decision_id) };
    });
    return { schemaVersion: FOUNDER_STANDARD_RETRIEVAL_SCHEMA, retrievalSha256: sha256(stableStringify(standards)), standards };
  }
  async listForManagement(context: PrincipalContext): Promise<{ revisions: DbRow[]; decisions: DbRow[] }> {
    assertManager(context);
    return this.withIdentity(context, async (client) => ({
      revisions: (await client.query<DbRow>("select * from timeline.founder_standard_revisions order by standard_id, version desc limit 1000")).rows,
      decisions: (await client.query<DbRow>("select * from timeline.founder_standard_decisions order by sequence desc limit 2000")).rows,
    }));
  }
  async createRevision(context: PrincipalContext, rawInput: unknown): Promise<{ standardId: string; version: number; status: "DRAFT"; contentSha256: string }> {
    assertManager(context);
    const input = object(rawInput); const content = normalizeContent(input);
    if (!Number.isSafeInteger(input.baseVersion) || Number(input.baseVersion) < 0) throw new TimelineError("FOUNDER_STANDARD_INPUT_INVALID", "The expected prior version is required.", 400);
    return this.withIdentity(context, async (client) => {
      await client.query("select pg_advisory_xact_lock(hashtext($1))", [`timeline:founder-standard:${content.standardId}`]);
      const prior = Number((await client.query<{ version: number }>("select coalesce(max(version), 0) as version from timeline.founder_standard_revisions where standard_id=$1", [content.standardId])).rows[0]?.version ?? 0);
      if (prior !== input.baseVersion) throw new TimelineError("FOUNDER_STANDARD_REVISION_CONFLICT", "This standard changed. Reload before adding a revision.", 409);
      const revision = prior + 1; const hash = contentHash(content, revision);
      await client.query(`insert into timeline.founder_standard_revisions (standard_id,version,kind,title,guidance,applicability_json,provenance_json,content_sha256,created_by) values ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9)`, [content.standardId, revision, content.kind, content.title, content.guidance, JSON.stringify(content.applicability), JSON.stringify(content.provenance), hash, context.principalId]);
      await this.audit(client, context, "FOUNDER_STANDARD_REVISION_CREATED", content.standardId, { version: revision, contentSha256: hash });
      return { standardId: content.standardId, version: revision, status: "DRAFT", contentSha256: hash };
    });
  }
  async decide(context: PrincipalContext, rawInput: unknown): Promise<{ id: string; standardId: string; version: number; decision: string; approvalRef: string }> {
    assertManager(context);
    const input = object(rawInput); const standardId = id(input.standardId); const revision = version(input.version); const decision = String(input.decision);
    if (!["APPROVE", "REJECT", "RETIRE"].includes(decision)) throw new TimelineError("FOUNDER_STANDARD_INPUT_INVALID", "Choose an explicit standard decision.", 400);
    const approvalRef = text(input.approvalRef, 500, "Approval reference"); const reason = text(input.reason, 1000, "Decision reason");
    return this.withIdentity(context, async (client) => {
      await client.query("select pg_advisory_xact_lock(hashtext($1))", [`timeline:founder-standard:${standardId}`]);
      const row = (await client.query<DbRow>("select * from timeline.founder_standard_revisions where standard_id=$1 and version=$2", [standardId, revision])).rows[0];
      if (!row) throw new TimelineError("FOUNDER_STANDARD_NOT_FOUND", "That standard revision is not available.", 404);
      if (row.content_sha256 !== contentHash(contentFromRow(row), revision)) throw new TimelineError("FOUNDER_STANDARD_INTEGRITY_FAILED", "Standard integrity could not be verified.", 503);
      const current = (await client.query<DbRow>("select version,decision from timeline.founder_standard_decisions where standard_id=$1 and decision in ('APPROVE','RETIRE') order by sequence desc limit 1", [standardId])).rows[0];
      if (decision === "RETIRE" && (current?.decision !== "APPROVE" || Number(current.version) !== revision)) throw new TimelineError("FOUNDER_STANDARD_STATE_CONFLICT", "Only the currently approved revision can be retired.", 409);
      if (decision === "REJECT" && current?.decision === "APPROVE" && Number(current.version) === revision) throw new TimelineError("FOUNDER_STANDARD_STATE_CONFLICT", "Retire an approved standard to withdraw it.", 409);
      const decisionId = `fsdecision_${randomUUID()}`;
      await client.query("insert into timeline.founder_standard_decisions (id,standard_id,version,decision,approval_ref,reason,actor_principal_id) values ($1,$2,$3,$4,$5,$6,$7)", [decisionId, standardId, revision, decision, approvalRef, reason, context.principalId]);
      await this.audit(client, context, `FOUNDER_STANDARD_${decision}`, standardId, { version: revision, decisionId, contentSha256: String(row.content_sha256) });
      return { id: decisionId, standardId, version: revision, decision, approvalRef };
    });
  }
  private async audit(client: PostgresTransactionClient, context: PrincipalContext, action: string, standardId: string, metadata: Record<string, unknown>): Promise<void> {
    await client.query("insert into timeline.audit_events (id,actor_id,action,resource_type,resource_id,outcome,request_id,metadata_json) values ($1,$2,$3,'FOUNDER_STANDARD',$4,'SUCCESS',$5,$6::jsonb)", [`audit_${randomUUID()}`, context.principalId, action, standardId, context.requestId, JSON.stringify(metadata)]);
  }
}
