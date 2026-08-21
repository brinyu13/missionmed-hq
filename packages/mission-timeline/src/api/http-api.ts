import type { MatrixIdentity, PrincipalContext } from "../contracts/types.js";
import { sha256 } from "../core/canonical.js";
import { asTimelineError, TimelineError } from "../core/errors.js";
import type { TimelineService } from "../domain/timeline-service.js";
import { CvIntelligenceService } from "../intelligence/cv-intelligence-service.js";
import { TimelineAiWorkflowService } from "../intelligence/timeline-ai-workflow-service.js";
import { analyzeTimelineRescue } from "../intelligence/timeline-rescue-service.js";
import type { RescueCvCandidate } from "../intelligence/timeline-rescue-schema.js";
import type { PrivateObjectStore } from "../storage/private-object-store.js";
import type { PrivacySafeTelemetry } from "../telemetry/telemetry.js";

export interface TimelineIdentityVerifier {
  verify(token: string, requestId: string): PrincipalContext | Promise<PrincipalContext>;
  exchange?(identity: MatrixIdentity): Promise<{ token: string; expiresAt: string }>;
}

export type TimelineServiceProvider = TimelineService | ((context: PrincipalContext) => TimelineService | Promise<TimelineService>);

// The bundled browser PDF/DOCX parser refuses anything over 20 MB, so accepting the 25 MB
// SOURCE ceiling here only produced a band of files that ingest and then fail on review.
export const FILE_VAULT_SMART_FILL_MAX_BYTES = 20 * 1024 * 1024;
export const PRIVATE_MEDIA_UPLOAD_MAX_BYTES = 15 * 1024 * 1024;

function json(value: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });
}

function empty(status = 204, headers: Record<string, string> = {}): Response {
  return new Response(null, { status, headers: { "cache-control": "no-store", ...headers } });
}

async function body(request: Request): Promise<Record<string, unknown>> {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 2 * 1024 * 1024) throw new TimelineError("REQUEST_TOO_LARGE", "Request is too large.", 413);
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    throw new TimelineError("JSON_INVALID", "Request body must be valid JSON.", 400);
  }
}

export class TimelineHttpApi {
  constructor(
    private readonly serviceProvider: TimelineServiceProvider,
    private readonly identity: TimelineIdentityVerifier,
    private readonly objectStore: PrivateObjectStore,
    private readonly telemetry: PrivacySafeTelemetry,
    private readonly releaseVersion = "412.0.0-rc.0",
    private readonly productionWrites = false,
    private readonly cvIntelligence = new CvIntelligenceService(),
    private readonly timelineAiWorkflows = new TimelineAiWorkflowService(),
  ) {}

  async handle(request: Request, trustedMatrixIdentity?: MatrixIdentity): Promise<Response> {
    const started = performance.now();
    const url = new URL(request.url);
    const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
    const routeClass = this.routeClass(url.pathname);
    try {
      if (url.pathname === "/v1/health" && request.method === "GET") {
        return json({ ok: true, service: "mission-timeline", version: this.releaseVersion, productionWrites: this.productionWrites });
      }
      if (url.pathname === "/v1/session/exchange" && request.method === "POST") {
        if (!this.identity.exchange) throw new TimelineError("ROUTE_NOT_FOUND", "Timeline route not found.", 404);
        if (!trustedMatrixIdentity) throw new TimelineError("TRUSTED_MATRIX_CONTEXT_REQUIRED", "Trusted Matrix context is required.", 401);
        const session = await this.identity.exchange(trustedMatrixIdentity);
        return json(session, 200, { "x-request-id": requestId });
      }
      const context = await this.context(request, requestId);
      const service = typeof this.serviceProvider === "function"
        ? await this.serviceProvider(context)
        : this.serviceProvider;
      // Semantic analysis is a read-only, bounded provider call and must not hold a
      // PostgreSQL transaction or pool connection while waiting on the provider.
      const response = routeClass === "intake"
        ? await this.dispatch(request, url, context, service)
        : await service.repository.withTransaction((repository) =>
          this.dispatch(request, url, context, service.withRepository(repository)),
        );
      await this.emitTelemetry("api.request", {
        route_class: routeClass,
        method: request.method,
        status: response.status,
        duration_ms: Math.round(performance.now() - started),
      });
      response.headers.set("x-request-id", requestId);
      return response;
    } catch (error) {
      const timelineError = asTimelineError(error);
      await this.emitTelemetry("api.error", {
        route_class: routeClass,
        method: request.method,
        status: timelineError.status,
        error_code: timelineError.code,
        duration_ms: Math.round(performance.now() - started),
      });
      return json(
        { error: { code: timelineError.code, message: timelineError.status >= 500 ? "Timeline service error." : timelineError.message } },
        timelineError.status,
        { "x-request-id": requestId },
      );
    }
  }

  private async dispatch(
    request: Request,
    url: URL,
    context: PrincipalContext,
    service: TimelineService,
  ): Promise<Response> {
    if (url.pathname === "/v1/documents" && request.method === "GET") {
      return json({ documents: await service.listOwnDocuments(context) });
    }
    if (url.pathname === "/v1/documents" && request.method === "POST") {
      const input = await body(request);
      const result = await service.createDocument(context, {
        id: input.id as string | undefined,
        programId: String(input.programId ?? ""),
        title: String(input.title ?? ""),
        theme: input.theme as string | undefined,
        document: (input.document ?? {}) as never,
      });
      return json(result, 201, { etag: `"${result.document.revision}"` });
    }
    const documentMatch = url.pathname.match(/^\/v1\/documents\/([^/]+)$/);
    if (documentMatch && request.method === "GET") {
      const result = await service.getDocument(context, documentMatch[1]!);
      return json(result, 200, { etag: `"${result.document.revision}"` });
    }
    const cvAnalyzeMatch = url.pathname.match(/^\/v1\/documents\/([^/]+)\/intake\/analyze$/);
    if (cvAnalyzeMatch && request.method === "POST") {
      const input = await body(request);
      const record = await service.getDocument(context, cvAnalyzeMatch[1]!);
      if (record.document.studentOwnerId !== context.principalId || context.role !== "STUDENT") {
        throw new TimelineError("CV_ANALYSIS_OWNER_REQUIRED", "Student ownership is required for CV analysis.", 403);
      }
      const source = input.source && typeof input.source === "object" && !Array.isArray(input.source)
        ? input.source as Record<string, unknown>
        : {};
      const sourceObject = await this.objectStore.getAuthorizedObject(context, String(source.objectId ?? ""));
      return json(await this.cvIntelligence.analyze(context, record.document, sourceObject, input), 200);
    }
    const qualityAnalyzeMatch = url.pathname.match(/^\/v1\/documents\/([^/]+)\/quality\/analyze$/);
    if (qualityAnalyzeMatch && request.method === "POST") {
      const input = await body(request);
      const record = await service.getDocument(context, qualityAnalyzeMatch[1]!);
      const deterministicFindings = Array.isArray(input.deterministicFindings)
        ? input.deterministicFindings.slice(0, 100).flatMap((item) => {
          if (!item || typeof item !== "object" || Array.isArray(item)) return [];
          const value = item as Record<string, unknown>;
          const category = String(value.category ?? "");
          const severity = String(value.severity ?? "");
          const id = String(value.id ?? "").trim().slice(0, 160);
          const code = String(value.code ?? "").trim().slice(0, 100);
          const message = String(value.message ?? "").trim().slice(0, 1_000);
          if (!id || !message || !["CONTENT", "CHRONOLOGY", "LAYOUT", "READABILITY", "MISSIONMED_FORMAT", "EXPORT"].includes(category) || !["BLOCK_EXPORT", "REVIEW", "INFO"].includes(severity)) return [];
          return [{ id, category, code, severity, elementIds: Array.isArray(value.elementIds) ? value.elementIds.map(String).slice(0, 100) : [], message }];
        })
        : [];
      return json(await this.timelineAiWorkflows.analyzeQuality(
        context,
        record.document,
        deterministicFindings as never,
        request.headers.get("x-timeline-synthetic-fixture") === "1",
      ), 200);
    }
    const rescueMatch = url.pathname.match(/^\/v1\/documents\/([^/]+)\/intake\/rescue$/);
    if (rescueMatch && request.method === "POST") {
      const input = await body(request);
      const record = await service.getDocument(context, rescueMatch[1]!);
      if (record.document.studentOwnerId !== context.principalId || context.role !== "STUDENT") {
        throw new TimelineError("TIMELINE_RESCUE_OWNER_REQUIRED", "Student ownership is required for Timeline Rescue.", 403);
      }
      const source = input.source && typeof input.source === "object" && !Array.isArray(input.source)
        ? input.source as Record<string, unknown>
        : {};
      const objectId = String(source.objectId ?? "");
      const filename = String(source.filename ?? "").trim().slice(0, 255);
      const expectedSha256 = String(source.sha256 ?? "").toLowerCase();
      const expectedMimeType = String(source.mimeType ?? "").toLowerCase();
      if (!filename || !/^[a-f0-9]{64}$/.test(expectedSha256)) {
        throw new TimelineError("TIMELINE_RESCUE_SOURCE_INVALID", "Timeline Rescue source metadata is invalid.", 400);
      }
      const authorized = await this.objectStore.getAuthorizedObjectBytes(context, objectId);
      if (
        authorized.record.documentId !== record.document.id ||
        authorized.record.ownerPrincipalId !== context.principalId ||
        authorized.record.objectClass !== "SOURCE" ||
        authorized.record.status !== "CONFIRMED"
      ) throw new TimelineError("TIMELINE_RESCUE_SOURCE_DENIED", "Timeline Rescue source is not available.", 404);
      if (
        authorized.record.expectedSha256 !== expectedSha256 ||
        authorized.record.mimeType !== expectedMimeType ||
        sha256(authorized.bytes) !== expectedSha256
      ) throw new TimelineError("TIMELINE_RESCUE_SOURCE_INTEGRITY", "Timeline Rescue source integrity does not match.", 409);
      const intake = record.document.intake && typeof record.document.intake === "object"
        ? record.document.intake as Record<string, unknown>
        : {};
      const lastImport = intake.lastImport && typeof intake.lastImport === "object" && !Array.isArray(intake.lastImport)
        ? intake.lastImport as Record<string, unknown>
        : {};
      const hasAcceptedImport = Array.isArray(lastImport.acceptedCandidates);
      const acceptedCvCandidates: unknown[] = hasAcceptedImport
        ? lastImport.acceptedCandidates as unknown[]
        : Array.isArray(intake.candidates) ? intake.candidates : [];
      const cvCandidates: RescueCvCandidate[] = acceptedCvCandidates
        .filter((candidate): candidate is Record<string, unknown> => Boolean(candidate && typeof candidate === "object" && !Array.isArray(candidate)))
        .filter((candidate) => hasAcceptedImport || ["accepted", "merge", "add-anyway", "keep-both"].includes(String(candidate.decision ?? "")))
        .map((candidate) => ({
          id: String(candidate.id ?? ""),
          title: String(candidate.title ?? ""),
          categoryId: String(candidate.categoryId ?? ""),
          startDate: candidate.startDate ? String(candidate.startDate) : null,
          endDate: candidate.endDate ? String(candidate.endDate) : null,
          provenance: candidate.provenance,
        }))
        .filter((candidate) => Boolean(candidate.id && candidate.title));
      const initial = analyzeTimelineRescue({
        filename,
        mimeType: expectedMimeType,
        bytes: authorized.bytes,
      }, cvCandidates);
      const syntheticAiRequested = request.headers.get("x-timeline-synthetic-fixture") === "1";
      const ai = initial.format === "KEYNOTE" || !syntheticAiRequested
        ? null
        : await this.timelineAiWorkflows.observeRescue(context, record.document, {
          artifactSha256: initial.artifactSha256,
          format: initial.format,
          pageOrSlideCount: initial.slideOrPageCount,
          objects: initial.objects,
          image: initial.format === "IMAGE" && ["image/png", "image/jpeg"].includes(expectedMimeType)
            ? { mimeType: expectedMimeType as "image/png" | "image/jpeg", bytes: authorized.bytes }
            : null,
        }, true);
      const rescue = ai?.status === "COMPLETE"
        ? analyzeTimelineRescue({
          filename,
          mimeType: expectedMimeType,
          bytes: authorized.bytes,
          visualObservations: ai.observations,
        }, cvCandidates)
        : initial;
      if (ai?.unresolvedQuestions.length) rescue.unresolvedQuestions = [...new Set([...rescue.unresolvedQuestions, ...ai.unresolvedQuestions])];
      return json({
        source: {objectId, filename, mimeType: expectedMimeType, sha256: expectedSha256},
        ai,
        rescue,
      });
    }
    const fileVaultIngestMatch = url.pathname.match(/^\/v1\/documents\/([^/]+)\/file-vault\/ingestions$/);
    if (fileVaultIngestMatch && request.method === "POST") {
      // A document owned by someone else and a document that does not exist must be one
      // answer, or the handoff becomes a cross-student existence oracle.
      const record = await service.getDocument(context, fileVaultIngestMatch[1]!).catch(() => {
        throw new TimelineError("FILE_VAULT_INGEST_TARGET_NOT_FOUND", "That Timeline document is not available.", 404);
      });
      if (record.document.studentOwnerId !== context.principalId || context.role !== "STUDENT") {
        throw new TimelineError("FILE_VAULT_INGEST_TARGET_NOT_FOUND", "That Timeline document is not available.", 404);
      }
      const byteSize = Number(request.headers.get("content-length") ?? 0);
      const mimeType = String(request.headers.get("content-type") ?? "").split(";", 1)[0]!.trim().toLowerCase();
      const expectedSha256 = String(request.headers.get("x-content-sha256") ?? "").trim().toLowerCase();
      const vaultFileId = String(request.headers.get("x-file-vault-id") ?? "").trim();
      const versionId = String(request.headers.get("x-file-vault-version") ?? "").trim();
      if (!Number.isInteger(byteSize) || byteSize < 1 || byteSize > FILE_VAULT_SMART_FILL_MAX_BYTES) {
        throw new TimelineError("FILE_VAULT_INGEST_SIZE_DENIED", "File Vault source size is outside the allowed range.", 413);
      }
      if (!["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"].includes(mimeType)) {
        throw new TimelineError("FILE_VAULT_INGEST_MIME_DENIED", "File Vault source type is not supported for CV analysis.", 415);
      }
      if (!/^[a-f0-9]{64}$/.test(expectedSha256) || !/^[0-9a-fA-F-]{8,64}$/.test(vaultFileId) || !/^[0-9a-fA-F-]{8,64}$/.test(versionId)) {
        throw new TimelineError("FILE_VAULT_INGEST_PROVENANCE_INVALID", "File Vault source provenance is invalid.", 400);
      }
      const bytes = new Uint8Array(await request.arrayBuffer());
      if (bytes.byteLength !== byteSize || sha256(bytes) !== expectedSha256) {
        throw new TimelineError("FILE_VAULT_INGEST_INTEGRITY_FAILED", "File Vault source integrity could not be verified.", 409);
      }
      const sourceObject = await this.objectStore.putOwnedObject(
        context,
        {
          documentId: record.document.id,
          ownerPrincipalId: context.principalId,
          objectClass: "SOURCE",
          mimeType,
          byteSize,
          sha256: expectedSha256,
        },
        bytes,
      );
      return json({
        source: { objectId: sourceObject.id, sha256: expectedSha256, mimeType },
        provenance: { provider: "missionmed-filevault-v1", vaultFileId, versionId },
      }, 201);
    }
    const checkpointMatch = url.pathname.match(/^\/v1\/documents\/([^/]+)\/checkpoints\/([^/]+)$/);
    if (checkpointMatch && request.method === "PUT") {
      const input = await body(request);
      const result = await service.saveCheckpoint(
        context,
        checkpointMatch[1]!,
        checkpointMatch[2]!,
        Number(input.baseRevision),
        input.snapshot as never,
      );
      return json(result);
    }
    const versionMatch = url.pathname.match(/^\/v1\/documents\/([^/]+)\/versions$/);
    if (versionMatch && request.method === "POST") {
      const input = await body(request);
      const result = await service.createVersion(
        context,
        versionMatch[1]!,
        Number(input.baseRevision),
        input.snapshot as never,
        String(input.label ?? "Named version"),
      );
      return json(result, 201, { etag: `"${result.revision}"` });
    }
    const reviewMatch = url.pathname.match(/^\/v1\/documents\/([^/]+)\/reviews$/);
    if (reviewMatch && request.method === "POST") {
      const input = await body(request);
      return json(await service.requestReview(context, reviewMatch[1]!, String(input.versionId ?? "")), 201);
    }
    const commentMatch = url.pathname.match(/^\/v1\/reviews\/([^/]+)\/comments$/);
    if (commentMatch && request.method === "POST") {
      const input = await body(request);
      return json(
        await service.addComment(
          context,
          commentMatch[1]!,
          String(input.body ?? ""),
          input.visibility === "ADVISOR_ONLY" ? "ADVISOR_ONLY" : "SHARED",
          (input.anchor ?? {}) as Record<string, unknown>,
        ),
        201,
      );
    }
    const decisionMatch = url.pathname.match(/^\/v1\/reviews\/([^/]+)\/decision$/);
    if (decisionMatch && request.method === "POST") {
      const input = await body(request);
      if (input.decision !== "APPROVED" && input.decision !== "CHANGES_REQUESTED") {
        throw new TimelineError("REVIEW_DECISION_INVALID", "Review decision is invalid.", 400);
      }
      return json(await service.decideReview(context, decisionMatch[1]!, input.decision, String(input.reason ?? "")));
    }
    if (url.pathname === "/v1/exports" && request.method === "POST") {
      const input = await body(request);
      return json(
        await service.createExportJob(
          context,
          String(input.documentId ?? ""),
          String(input.versionId ?? ""),
          input.artifactType as never,
          String(input.scope ?? ""),
          (input.renderer as never) ?? "MAC_PRO_AUTHORITY",
        ),
        202,
      );
    }
    const exportMatch = url.pathname.match(/^\/v1\/exports\/([^/]+)$/);
    if (exportMatch && request.method === "GET") {
      return json(await service.getExportJob(context, exportMatch[1]!));
    }
    if (url.pathname === "/v1/objects/sign" && request.method === "POST") {
      const input = await body(request);
      const record = await service.getDocument(context, String(input.documentId ?? ""));
      if (record.document.studentOwnerId !== context.principalId) throw new TimelineError("OBJECT_UPLOAD_OWNER_REQUIRED", "Student ownership is required.", 403);
      return json(
        await this.objectStore.signUpload(context, {
          documentId: record.document.id,
          objectClass: input.objectClass as never,
          mimeType: String(input.mimeType ?? ""),
          byteSize: Number(input.byteSize),
          sha256: String(input.sha256 ?? ""),
        }),
        201,
      );
    }
    if (url.pathname === "/v1/objects/upload" && request.method === "POST") {
      const documentId = String(request.headers.get("x-timeline-document-id") ?? "");
      const objectClass = String(request.headers.get("x-timeline-object-class") ?? "");
      const mimeType = String(request.headers.get("content-type") ?? "").split(";", 1)[0]!.trim().toLowerCase();
      const expectedSha256 = String(request.headers.get("x-content-sha256") ?? "").trim().toLowerCase();
      const declaredBytes = Number(request.headers.get("content-length") ?? 0);
      if (objectClass !== "MEDIA") throw new TimelineError("OBJECT_UPLOAD_CLASS_DENIED", "Only Timeline media may use this upload path.", 415);
      if (!Number.isSafeInteger(declaredBytes) || declaredBytes < 1 || declaredBytes > PRIVATE_MEDIA_UPLOAD_MAX_BYTES) {
        throw new TimelineError("OBJECT_UPLOAD_SIZE_DENIED", "Timeline media must be 15 MB or smaller.", 413);
      }
      const record = await service.getDocument(context, documentId);
      if (record.document.studentOwnerId !== context.principalId || context.role !== "STUDENT") {
        throw new TimelineError("OBJECT_UPLOAD_OWNER_REQUIRED", "Student ownership is required.", 403);
      }
      const bytes = new Uint8Array(await request.arrayBuffer());
      if (bytes.byteLength !== declaredBytes) throw new TimelineError("OBJECT_UPLOAD_SIZE_MISMATCH", "Timeline media size did not match the request.", 409);
      const confirmed = await this.objectStore.putOwnedObject(context, {
        documentId: record.document.id,
        objectClass: "MEDIA",
        mimeType,
        byteSize: bytes.byteLength,
        sha256: expectedSha256,
      }, bytes);
      return json({
        id: confirmed.id,
        objectClass: confirmed.objectClass,
        mimeType: confirmed.mimeType,
        byteSize: confirmed.expectedBytes,
        status: confirmed.status,
        ...(confirmed.confirmedAt ? { confirmedAt: confirmed.confirmedAt } : {}),
      }, 201);
    }
    const confirmMatch = url.pathname.match(/^\/v1\/objects\/([^/]+)\/confirm$/);
    if (confirmMatch && request.method === "POST") {
      const input = await body(request);
      const confirmed = await this.objectStore.confirmUpload(context, confirmMatch[1]!, String(input.uploadToken ?? ""));
      // Project the record: the full ObjectRecord carries `storageKey`, the live private
      // bucket path, which must never reach browser-visible state.
      return json({
        id: confirmed.id,
        objectClass: confirmed.objectClass,
        mimeType: confirmed.mimeType,
        byteSize: confirmed.expectedBytes,
        status: confirmed.status,
        ...(confirmed.confirmedAt ? { confirmedAt: confirmed.confirmedAt } : {}),
      });
    }
    const downloadMatch = url.pathname.match(/^\/v1\/objects\/([^/]+)\/download$/);
    if (downloadMatch && request.method === "POST") {
      return json(await this.objectStore.signDownload(context, downloadMatch[1]!));
    }
    const objectMatch = url.pathname.match(/^\/v1\/objects\/([^/]+)$/);
    if (objectMatch && request.method === "DELETE") {
      // Releasing File-Vault-ingested CV bytes has to be repeatable and must not tell a
      // caller whether an object they cannot own exists.
      await this.objectStore.deleteObject(context, objectMatch[1]!).catch((error) => {
        const timelineError = asTimelineError(error);
        if (timelineError.status !== 403 && timelineError.status !== 404) throw error;
        throw new TimelineError("OBJECT_NOT_FOUND", "Object not found.", 404);
      });
      return empty();
    }
    throw new TimelineError("ROUTE_NOT_FOUND", "Timeline route not found.", 404);
  }

  private async context(request: Request, requestId: string): Promise<PrincipalContext> {
    const authorization = request.headers.get("authorization") ?? "";
    if (!authorization.startsWith("Bearer ")) throw new TimelineError("SESSION_REQUIRED", "Timeline session is required.", 401);
    return this.identity.verify(authorization.slice(7), requestId);
  }

  private routeClass(pathname: string): string {
    if (pathname.includes("/comments")) return "review_comments";
    if (pathname.includes("/reviews")) return "reviews";
    if (pathname.includes("/versions")) return "versions";
    if (pathname.includes("/checkpoints")) return "checkpoints";
    if (pathname.includes("/intake/")) return "intake";
    if (pathname.includes("/quality/")) return "intake";
    if (pathname.includes("/file-vault/")) return "intake";
    if (pathname.includes("/documents")) return "documents";
    if (pathname.includes("/objects")) return "objects";
    if (pathname.includes("/exports")) return "exports";
    if (pathname.includes("/session")) return "session";
    return "health_or_unknown";
  }

  private async emitTelemetry(name: "api.request" | "api.error", attributes: Record<string, unknown>): Promise<void> {
    try {
      await this.telemetry.emit(name, attributes);
    } catch {
      // Telemetry is non-authoritative and may never replace the primary response.
    }
  }
}
