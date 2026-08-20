import { createHash } from "node:crypto";

import type { RescueGeometry, RescueVisualObject } from "./timeline-rescue-schema.js";
import { readOoxmlArchive } from "./timeline-rescue-zip.js";

export interface PptxExtraction {
  slideCount: number;
  slideSize: { width: number; height: number; unit: "EMU" } | null;
  objects: RescueVisualObject[];
  warnings: string[];
}

function xml(bytes: Uint8Array | undefined): string {
  return bytes ? new TextDecoder("utf-8", { fatal: false }).decode(bytes) : "";
}

function decodeXml(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
}

function attribute(source: string, name: string): string | null {
  const match = source.match(new RegExp(`\\b${name}="([^"]*)"`));
  return match ? decodeXml(match[1]!) : null;
}

function integerAttribute(source: string, name: string): number | null {
  const value = attribute(source, name);
  if (value === null || !/^-?\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function geometry(block: string): RescueGeometry | null {
  const xfrm = block.match(/<a:xfrm\b[^>]*>([\s\S]*?)<\/a:xfrm>/)?.[1]
    ?? block.match(/<p:xfrm\b[^>]*>([\s\S]*?)<\/p:xfrm>/)?.[1]
    ?? block;
  const off = xfrm.match(/<(?:a|p):off\b[^>]*>/)?.[0];
  const ext = xfrm.match(/<(?:a|p):ext\b[^>]*>/)?.[0];
  if (!off || !ext) return null;
  const x = integerAttribute(off, "x");
  const y = integerAttribute(off, "y");
  const width = integerAttribute(ext, "cx");
  const height = integerAttribute(ext, "cy");
  if (x === null || y === null || width === null || height === null) return null;
  return { x, y, width, height, unit: "EMU" };
}

function text(block: string): string | null {
  const paragraphs: string[] = [];
  for (const paragraph of block.matchAll(/<a:p\b[^>]*>([\s\S]*?)<\/a:p>/g)) {
    const runs = [...paragraph[1]!.matchAll(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/g)].map((item) => decodeXml(item[1] ?? ""));
    const joined = runs.join("").trim();
    if (joined) paragraphs.push(joined);
  }
  if (!paragraphs.length) {
    const runs = [...block.matchAll(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/g)].map((item) => decodeXml(item[1] ?? ""));
    const joined = runs.join(" ").replace(/\s+/g, " ").trim();
    return joined || null;
  }
  return paragraphs.join("\n");
}

function color(block: string, boundary: "fill" | "line"): string | null {
  const scope = boundary === "line"
    ? block.match(/<a:ln\b[^>]*>([\s\S]*?)<\/a:ln>/)?.[1] ?? ""
    : block.match(/<a:solidFill\b[^>]*>([\s\S]*?)<\/a:solidFill>/)?.[1] ?? "";
  const srgb = scope.match(/<a:srgbClr\b[^>]*\bval="([0-9a-f]{6,8})"/i)?.[1];
  return srgb ? `#${srgb.slice(0, 6).toUpperCase()}` : null;
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function groupRanges(source: string): Array<{ start: number; end: number; id: string }> {
  const ranges: Array<{ start: number; end: number; id: string }> = [];
  const stack: Array<{ start: number; tagEnd: number }> = [];
  const tags = /<(\/?)p:grpSp\b[^>]*>/g;
  for (const match of source.matchAll(tags)) {
    if (!match[1]) stack.push({ start: match.index!, tagEnd: match.index! + match[0].length });
    else {
      const open = stack.pop();
      if (!open) continue;
      const end = match.index! + match[0].length;
      const prefix = source.slice(open.tagEnd, Math.min(end, open.tagEnd + 800));
      const id = prefix.match(/<p:cNvPr\b[^>]*\bid="([^"]+)"/)?.[1] ?? `group-${open.start}`;
      ranges.push({ start: open.start, end, id: `pptx-group-${id}` });
    }
  }
  return ranges;
}

function relationshipMap(source: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const match of source.matchAll(/<Relationship\b([^>]*)\/?\s*>/g)) {
    const id = attribute(match[1]!, "Id");
    const target = attribute(match[1]!, "Target");
    const mode = attribute(match[1]!, "TargetMode");
    const safeTarget = target && (!target.includes("..") || /^\.\.\/media\/[^/]+$/.test(target));
    if (id && target && safeTarget && mode !== "External" && !target.startsWith("/")) map.set(id, target);
  }
  return map;
}

function normalizedMediaTarget(target: string): string | null {
  const cleaned = target.replace(/^\.\//, "");
  if (!cleaned.startsWith("../media/")) return null;
  return `ppt/media/${cleaned.slice("../media/".length)}`;
}

export function extractPptx(input: Uint8Array): PptxExtraction {
  const archive = readOoxmlArchive(input);
  if (!archive.has("[Content_Types].xml") || !archive.has("ppt/presentation.xml")) throw new Error("RESCUE_PPTX_STRUCTURE_INVALID");
  const slideEntries = [...archive.keys()]
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((left, right) => Number(left.match(/\d+/)![0]) - Number(right.match(/\d+/)![0]));
  if (!slideEntries.length) throw new Error("RESCUE_PPTX_HAS_NO_SLIDES");
  const presentationXml = xml(archive.get("ppt/presentation.xml"));
  const sizeTag = presentationXml.match(/<p:sldSz\b[^>]*>/)?.[0] ?? "";
  const width = integerAttribute(sizeTag, "cx");
  const height = integerAttribute(sizeTag, "cy");
  const slideSize = width !== null && height !== null ? { width, height, unit: "EMU" as const } : null;
  const objects: RescueVisualObject[] = [];
  const warnings: string[] = [];

  for (const [slideIndex, path] of slideEntries.entries()) {
    const slideNumber = slideIndex + 1;
    const slideXml = xml(archive.get(path));
    const ranges = groupRanges(slideXml);
    const relationPath = path.replace("/slides/", "/slides/_rels/") + ".rels";
    const relations = relationshipMap(xml(archive.get(relationPath)));
    let zIndex = 0;
    const objectPattern = /<p:(sp|pic|cxnSp)\b[\s\S]*?<\/p:\1>/g;
    for (const match of slideXml.matchAll(objectPattern)) {
      const block = match[0];
      const tag = match[1]!;
      const nativeId = block.match(/<p:cNvPr\b[^>]*\bid="([^"]+)"/)?.[1] ?? String(zIndex + 1);
      const name = block.match(/<p:cNvPr\b[^>]*\bname="([^"]*)"/)?.[1];
      const shapeType = block.match(/<a:prstGeom\b[^>]*\bprst="([^"]+)"/)?.[1] ?? "";
      const isLine = tag === "cxnSp" || /line|arrow/i.test(shapeType);
      const kind: RescueVisualObject["kind"] = tag === "pic" ? "IMAGE" : isLine ? "LINE" : text(block) ? "TEXT" : "SHAPE";
      const containingGroups = ranges.filter((range) => range.start < match.index! && range.end > match.index! + block.length);
      const groupId = containingGroups.sort((a, b) => (a.end - a.start) - (b.end - b.start))[0]?.id ?? null;
      let relationshipTarget: string | null = null;
      let mediaSha256: string | null = null;
      if (tag === "pic") {
        const relationId = block.match(/<a:blip\b[^>]*\br:embed="([^"]+)"/)?.[1] ?? null;
        const target = relationId ? relations.get(relationId) : null;
        relationshipTarget = target ? normalizedMediaTarget(target) : null;
        const media = relationshipTarget ? archive.get(relationshipTarget) : null;
        mediaSha256 = media ? sha256(media) : null;
        if (!relationshipTarget || !mediaSha256) warnings.push(`Slide ${slideNumber} image ${nativeId} could not be bound to embedded media.`);
      }
      const size = block.match(/<a:(?:defRPr|rPr|endParaRPr)\b[^>]*\bsz="(\d+)"/)?.[1];
      objects.push({
        id: `pptx-s${slideNumber}-o${nativeId}`,
        pageOrSlide: slideNumber,
        kind,
        name: name ? decodeXml(name) : null,
        text: text(block),
        geometry: geometry(block),
        groupId,
        zIndex: zIndex++,
        fill: color(block, "fill"),
        stroke: color(block, "line"),
        fontFamily: block.match(/<a:latin\b[^>]*\btypeface="([^"]+)"/)?.[1] ?? null,
        fontSizePt: size ? Number(size) / 100 : null,
        relationshipTarget,
        mediaSha256,
      });
    }
    const groupIds = [...new Set(objects.filter((item) => item.pageOrSlide === slideNumber).map((item) => item.groupId).filter(Boolean))] as string[];
    for (const id of groupIds) {
      const children = objects.filter((item) => item.groupId === id);
      const measured = children.map((item) => item.geometry).filter((item): item is RescueGeometry => Boolean(item));
      const x = measured.length ? Math.min(...measured.map((item) => item.x)) : 0;
      const y = measured.length ? Math.min(...measured.map((item) => item.y)) : 0;
      const maxX = measured.length ? Math.max(...measured.map((item) => item.x + item.width)) : 0;
      const maxY = measured.length ? Math.max(...measured.map((item) => item.y + item.height)) : 0;
      objects.push({ id, pageOrSlide: slideNumber, kind: "GROUP", name: null, text: null,
        geometry: measured.length ? { x, y, width: maxX - x, height: maxY - y, unit: "EMU" } : null,
        groupId: null, zIndex: Math.min(...children.map((item) => item.zIndex)), fill: null, stroke: null,
        fontFamily: null, fontSizePt: null, relationshipTarget: null, mediaSha256: null });
    }
  }
  return { slideCount: slideEntries.length, slideSize, objects, warnings: [...new Set(warnings)] };
}
