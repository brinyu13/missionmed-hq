import type { ArtifactType, TimelineDocument } from "../contracts/types.js";
import { sha256, stableStringify } from "../core/canonical.js";
import { TimelineError } from "../core/errors.js";

export interface RendererFile {
  role: "PRIMARY" | "PREVIEW" | "ACCESSIBLE_HTML" | "ACCESSIBLE_TEXT" | "MANIFEST";
  filename: string;
  mimeType: string;
  bytes: Uint8Array;
}

export interface RendererRequest {
  jobId: string;
  artifactType: ArtifactType;
  scope: string;
  document: TimelineDocument;
  sourceVersionId: string;
  sourceContentSha256: string;
  theme: string;
}

export interface RendererResult {
  authority: "MAC_PRO_AUTHORITY" | "WEB_CANDIDATE" | "FIXTURE";
  rendererVersion: string;
  assetManifestSha256: string;
  files: RendererFile[];
  warnings: string[];
}

export interface TimelineRenderer {
  readonly authority: RendererResult["authority"];
  render(request: RendererRequest): Promise<RendererResult>;
}

export interface MacProRenderTransport {
  execute(request: RendererRequest): Promise<RendererResult>;
}

export class MacProRendererClient implements TimelineRenderer {
  readonly authority = "MAC_PRO_AUTHORITY" as const;

  constructor(
    private readonly transport: MacProRenderTransport,
    private readonly expectedAssetManifestSha256: string,
  ) {}

  async render(request: RendererRequest): Promise<RendererResult> {
    const result = await this.transport.execute(request);
    if (result.authority !== this.authority) throw new TimelineError("RENDER_AUTHORITY_INVALID", "Mac Pro authority was not used.", 502);
    if (result.assetManifestSha256 !== this.expectedAssetManifestSha256) {
      throw new TimelineError("RENDER_ASSET_MANIFEST_MISMATCH", "Renderer asset manifest does not match the approved package.", 502);
    }
    if (!result.files.length || !result.files.some((file) => file.role === "PRIMARY")) {
      throw new TimelineError("RENDER_OUTPUT_INCOMPLETE", "Renderer returned no primary output.", 502);
    }
    return result;
  }
}

const ONE_PIXEL_PNG = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZrWQAAAAASUVORK5CYII=",
    "base64",
  ),
);

function fixturePdf(text: string): Uint8Array {
  const escaped = text.replace(/[()\\]/g, "\\$&").slice(0, 140);
  const body = `%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R>>endobj\n4 0 obj<</Length ${escaped.length + 31}>>stream\nBT /F1 12 Tf 72 720 Td (${escaped}) Tj ET\nendstream\nendobj\ntrailer<</Root 1 0 R>>\n%%EOF\n`;
  return new TextEncoder().encode(body);
}

export class DeterministicFixtureRenderer implements TimelineRenderer {
  readonly authority = "FIXTURE" as const;

  async render(request: RendererRequest): Promise<RendererResult> {
    const descriptor = stableStringify({
      jobId: request.jobId,
      artifactType: request.artifactType,
      scope: request.scope,
      sourceVersionId: request.sourceVersionId,
      sourceContentSha256: request.sourceContentSha256,
      documentHash: sha256(stableStringify(request.document)),
    });
    const primary = this.primaryFile(request, descriptor);
    const html = new TextEncoder().encode(
      `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Mission Timeline</title></head><body><main><h1>${escapeHtml(request.document.title)}</h1><ol>${request.document.events.map((event) => `<li>${escapeHtml(event.title)}: ${escapeHtml(event.startDate)}${event.endDate ? ` to ${escapeHtml(event.endDate)}` : ""}</li>`).join("")}</ol></main></body></html>`,
    );
    const text = new TextEncoder().encode(
      [request.document.title, ...request.document.events.map((event) => `${event.title}: ${event.startDate}${event.endDate ? ` to ${event.endDate}` : ""}`)].join("\n"),
    );
    return {
      authority: this.authority,
      rendererVersion: "fixture-412.1",
      assetManifestSha256: sha256("fixture-assets-412.1"),
      files: [
        primary,
        { role: "ACCESSIBLE_HTML", filename: "timeline-accessible.html", mimeType: "text/html", bytes: html },
        { role: "ACCESSIBLE_TEXT", filename: "timeline-accessible.txt", mimeType: "text/plain", bytes: text },
        {
          role: "MANIFEST",
          filename: "render-manifest.json",
          mimeType: "application/json",
          bytes: new TextEncoder().encode(descriptor),
        },
      ],
      warnings: ["FIXTURE_RENDERER_NOT_FOR_PRODUCTION", "VISUAL_PDF_IS_NOT_TAGGED_USE_ACCESSIBLE_COMPANION"],
    };
  }

  private primaryFile(request: RendererRequest, descriptor: string): RendererFile {
    if (request.artifactType.endsWith("PNG")) {
      return { role: "PRIMARY", filename: "mission-timeline.png", mimeType: "image/png", bytes: ONE_PIXEL_PNG };
    }
    if (request.artifactType.endsWith("PDF")) {
      return { role: "PRIMARY", filename: "mission-timeline.pdf", mimeType: "application/pdf", bytes: fixturePdf(descriptor) };
    }
    if (request.artifactType === "TIMELINE_ACCESSIBLE_HTML") {
      return {
        role: "PRIMARY",
        filename: "mission-timeline.html",
        mimeType: "text/html",
        bytes: new TextEncoder().encode(`<pre>${escapeHtml(descriptor)}</pre>`),
      };
    }
    if (request.artifactType === "TIMELINE_ARCHIVE") {
      return {
        role: "PRIMARY",
        filename: "mission-timeline.zip.fixture",
        mimeType: "application/zip",
        bytes: new TextEncoder().encode(descriptor),
      };
    }
    return {
      role: "PRIMARY",
      filename: "mission-timeline.json",
      mimeType: "application/json",
      bytes: new TextEncoder().encode(stableStringify(request.document)),
    };
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]!);
}
