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

type Matrix = [number, number, number, number, number, number];
const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

function multiply(left: Matrix, right: Matrix): Matrix {
  const [a, b, c, d, e, f] = left, [g, h, i, j, k, l] = right;
  return [a*g+c*h, b*g+d*h, a*i+c*j, b*i+d*j, a*k+c*l+e, b*k+d*l+f];
}

function translation(x: number, y: number): Matrix { return [1, 0, 0, 1, x, y]; }

function aroundCenter(bounds: RescueGeometry, rotation: number, flipH: boolean, flipV: boolean): Matrix {
  const radians = rotation * Math.PI / 180, c = Math.cos(radians), s = Math.sin(radians);
  const x = bounds.x + bounds.width / 2, y = bounds.y + bounds.height / 2;
  const rotationAndFlip: Matrix = [c*(flipH?-1:1), s*(flipH?-1:1), -s*(flipV?-1:1), c*(flipV?-1:1), 0, 0];
  return multiply(multiply(translation(x, y), rotationAndFlip), translation(-x, -y));
}

function transformedBounds(bounds: RescueGeometry, matrix: Matrix): RescueGeometry {
  const [a, b, c, d, e, f] = matrix;
  const corners = [[bounds.x, bounds.y], [bounds.x + bounds.width, bounds.y], [bounds.x, bounds.y + bounds.height], [bounds.x + bounds.width, bounds.y + bounds.height]];
  const points = corners.map(([x, y]) => ({ x: a*x!+c*y!+e, y: b*x!+d*y!+f }));
  const x = Math.min(...points.map(p => p.x)), y = Math.min(...points.map(p => p.y));
  return { x, y, width: Math.max(...points.map(p => p.x))-x, height: Math.max(...points.map(p => p.y))-y, unit: "EMU" };
}

function readTransform(block: string): { bounds: RescueGeometry; matrix: Matrix; rotationDegrees: number; flipH: boolean; flipV: boolean; childMatrix: Matrix } | null {
  const match = block.match(/<(?:a|p):xfrm\b([^>]*)>([\s\S]*?)<\/(?:a|p):xfrm>/);
  if (!match) return null;
  const attrs = match[1]!, body = match[2]!;
  const off = body.match(/<(?:a|p):off\b[^>]*>/)?.[0] ?? "";
  const ext = body.match(/<(?:a|p):ext\b[^>]*>/)?.[0] ?? "";
  const x = integerAttribute(off, "x"), y = integerAttribute(off, "y");
  const width = integerAttribute(ext, "cx"), height = integerAttribute(ext, "cy");
  if (x === null || y === null || width === null || height === null || width < 0 || height < 0) return null;
  const bounds: RescueGeometry = { x, y, width, height, unit: "EMU" };
  const rotationDegrees = (integerAttribute(attrs, "rot") ?? 0) / 60000;
  const flipH = /^(?:1|true)$/.test(attribute(attrs, "flipH") ?? ""), flipV = /^(?:1|true)$/.test(attribute(attrs, "flipV") ?? "");
  const matrix = aroundCenter(bounds, rotationDegrees, flipH, flipV);
  const chOff = body.match(/<a:chOff\b[^>]*>/)?.[0] ?? "", chExt = body.match(/<a:chExt\b[^>]*>/)?.[0] ?? "";
  const childX = integerAttribute(chOff, "x"), childY = integerAttribute(chOff, "y");
  const childWidth = integerAttribute(chExt, "cx"), childHeight = integerAttribute(chExt, "cy");
  const placement: Matrix = childX !== null && childY !== null && childWidth && childHeight
    ? [width/childWidth, 0, 0, height/childHeight, x-childX*width/childWidth, y-childY*height/childHeight]
    : IDENTITY;
  return { bounds, matrix, rotationDegrees, flipH, flipV, childMatrix: multiply(matrix, placement) };
}

function semanticRole(name: string | null): RescueVisualObject["semanticRole"] {
  const role = name?.match(/^MM:(?:group:)?(event|furniture|profile|media|annotation):/)?.[1];
  return role as RescueVisualObject["semanticRole"];
}

function crop(block: string): RescueVisualObject["crop"] {
  const rect = block.match(/<a:srcRect\b[^>]*>/)?.[0];
  if (!rect) return undefined;
  return { left: (integerAttribute(rect, "l") ?? 0)/100000, top: (integerAttribute(rect, "t") ?? 0)/100000,
    right: (integerAttribute(rect, "r") ?? 0)/100000, bottom: (integerAttribute(rect, "b") ?? 0)/100000, unit: "FRACTION" };
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

interface GroupRange { start: number; end: number; id: string; name: string | null; transform: ReturnType<typeof readTransform> }
function groupRanges(source: string, slide: number): GroupRange[] {
  const ranges: GroupRange[] = [];
  const stack: Array<{ start: number; tagEnd: number }> = [];
  const tags = /<(\/?)p:grpSp\b[^>]*>/g;
  for (const match of source.matchAll(tags)) {
    if (!match[1]) stack.push({ start: match.index!, tagEnd: match.index! + match[0].length });
    else {
      const open = stack.pop();
      if (!open) continue;
      const end = match.index! + match[0].length;
      const prefix = source.slice(open.tagEnd, end).split(/<p:(?:sp|pic|cxnSp|grpSp)\b/)[0]!;
      const tag = prefix.match(/<p:cNvPr\b[^>]*>/)?.[0] ?? "";
      const id = attribute(tag, "id") ?? `group-${open.start}`;
      ranges.push({ start: open.start, end, id: `pptx-s${slide}-group-${id}`, name: attribute(tag, "name"), transform: readTransform(prefix) });
    }
  }
  return ranges;
}

function ancestorMatrix(ranges: GroupRange[]): Matrix {
  return [...ranges].sort((a, b) => a.start-b.start).reduce((matrix, range) => multiply(matrix, range.transform?.childMatrix ?? IDENTITY), IDENTITY);
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
    const ranges = groupRanges(slideXml, slideNumber);
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
      const localTransform = readTransform(block);
      const matrix = multiply(ancestorMatrix(containingGroups), localTransform?.matrix ?? IDENTITY);
      const objectName = name ? decodeXml(name) : null;
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
      const bold = block.match(/<a:(?:defRPr|rPr)\b[^>]*\bb="([01])"/)?.[1];
      objects.push({
        id: `pptx-s${slideNumber}-o${nativeId}`,
        pageOrSlide: slideNumber,
        kind,
        name: objectName,
        text: text(block),
        geometry: localTransform ? transformedBounds(localTransform.bounds, matrix) : null,
        ...(localTransform ? { nativeTransform: { matrix, localGeometry: localTransform.bounds, rotationDegrees: localTransform.rotationDegrees, flipH: localTransform.flipH, flipV: localTransform.flipV } } : {}),
        ...(tag === "pic" && crop(block) ? { crop: crop(block) } : {}),
        ...(semanticRole(objectName) ? { semanticRole: semanticRole(objectName) } : {}),
        groupId,
        zIndex: zIndex++,
        fill: color(block, "fill"),
        stroke: color(block, "line"),
        fontFamily: block.match(/<a:latin\b[^>]*\btypeface="([^"]+)"/)?.[1] ?? null,
        fontSizePt: size ? Number(size) / 100 : null,
        fontBold: bold === undefined ? null : bold === "1",
        relationshipTarget,
        mediaSha256,
      });
    }
    // Every group is retained, including nesting and names; IDs are slide-scoped.
    for (const range of ranges) {
      const descendants = objects.filter(item => item.pageOrSlide === slideNumber && item.kind !== "GROUP" &&
        (item.groupId === range.id || ranges.some(inner => inner.id === item.groupId && inner.start > range.start && inner.end < range.end)));
      const measured = descendants.map(item => item.geometry).filter((item): item is RescueGeometry => Boolean(item));
      const x = measured.length ? Math.min(...measured.map(item => item.x)) : 0;
      const y = measured.length ? Math.min(...measured.map(item => item.y)) : 0;
      const parent = ranges.filter(outer => outer.start < range.start && outer.end > range.end).sort((a, b) => (a.end-a.start)-(b.end-b.start))[0];
      objects.push({ id: range.id, pageOrSlide: slideNumber, kind: "GROUP", name: range.name, text: null,
        geometry: measured.length ? { x, y, width: Math.max(...measured.map(item => item.x+item.width))-x, height: Math.max(...measured.map(item => item.y+item.height))-y, unit: "EMU" } : null,
        groupId: parent?.id ?? null, zIndex: descendants.length ? Math.min(...descendants.map(item => item.zIndex)) : 0, fill: null, stroke: null,
        fontFamily: null, fontSizePt: null, relationshipTarget: null, mediaSha256: null,
        ...(semanticRole(range.name) ? { semanticRole: semanticRole(range.name) } : {}) });
    }
  }
  return { slideCount: slideEntries.length, slideSize, objects, warnings: [...new Set(warnings)] };
}
