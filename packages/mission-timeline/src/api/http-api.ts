import type { MatrixIdentity, PrincipalContext } from "../contracts/types.js";
import { asTimelineError, TimelineError } from "../core/errors.js";
import type { TimelineService } from "../domain/timeline-service.js";
import type { PrivateObjectStore } from "../storage/private-object-store.js";
import type { PrivacySafeTelemetry } from "../telemetry/telemetry.js";

export interface TimelineIdentityVerifier {
  verify(token: string, requestId: string): PrincipalContext | Promise<PrincipalContext>;
  exchange?(identity: MatrixIdentity): Promise<{ token: string; expiresAt: string }>;
}

export type TimelineServiceProvider = TimelineService | ((context: PrincipalContext) => TimelineService | Promise<TimelineService>);

function json(value: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });
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
      const response = await service.repository.withTransaction((repository) =>
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
    const confirmMatch = url.pathname.match(/^\/v1\/objects\/([^/]+)\/confirm$/);
    if (confirmMatch && request.method === "POST") {
      const input = await body(request);
      return json(await this.objectStore.confirmUpload(context, confirmMatch[1]!, String(input.uploadToken ?? "")));
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
