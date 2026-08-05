import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(fileURLToPath(new URL("../", import.meta.url)));
const acceptedWebAssetRoot = String(process.env.TIMELINE_ACCEPTED_WEB_ASSET_ROOT || "").trim();
if (acceptedWebAssetRoot && resolve(acceptedWebAssetRoot) !== acceptedWebAssetRoot) {
  throw new Error("TIMELINE_ACCEPTED_WEB_ASSET_ROOT_MUST_BE_ABSOLUTE");
}
const port = Number(process.env.PORT || 8792);
const host = process.env.HOST || "127.0.0.1";

const mounts = [
  { prefix: "/timeline/", root: join(packageRoot, "web") },
  { prefix: "/matrix/", root: join(packageRoot, "matrix") },
  { prefix: "/web/", root: join(packageRoot, "web") },
];

const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".pdf": "application/pdf",
  ".md": "text/markdown; charset=utf-8",
};

const securityHeaders = Object.freeze({
  "content-security-policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' blob: https://eeaaf73d1670b47a162d251ca67e7cfa.r2.cloudflarestorage.com; frame-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
  "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
});

function responseSecurityHeaders(pathname) {
  if (!pathname.startsWith("/web/presentation/d1-409h-a1/")) return securityHeaders;
  return {
    ...securityHeaders,
    "content-security-policy": securityHeaders["content-security-policy"]
      .replace("frame-ancestors 'none'","frame-ancestors 'self'"),
    "x-frame-options": "SAMEORIGIN"
  };
}

function sendJson(response, status, value) {
  response.writeHead(status, {
    ...securityHeaders,
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(JSON.stringify(value));
}

function safeFile(root, relativePath) {
  const cleaned = normalize(decodeURIComponent(relativePath)).replace(/^(?:\.\.(?:\/|\\|$))+/, "");
  const target = resolve(root, cleaned || "index.html");
  if (!target.startsWith(`${resolve(root)}/`) && target !== resolve(root)) return null;
  if (existsSync(target) && statSync(target).isDirectory()) return join(target, "index.html");
  return target;
}

const server = createServer((request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || `${host}:${port}`}`);
  if (url.pathname === "/") {
    response.writeHead(302, { location: "/matrix/demo/" });
    response.end();
    return;
  }
  if (url.pathname === "/health") {
    sendJson(response, 200, { ok: true, service: "mission-timeline-local-demo", productionWrites: false });
    return;
  }
  if (url.pathname.startsWith("/api/timeline/")) {
    sendJson(response, 503, { error: { code: "LOCAL_DEMO_API_DISABLED", message: "The local Matrix demo is intentionally local-only." } });
    return;
  }
  const mount = mounts.find((candidate) => url.pathname.startsWith(candidate.prefix));
  if (!mount) {
    sendJson(response, 404, { error: { code: "NOT_FOUND", message: "Local demo route not found." } });
    return;
  }
  const relativePath = url.pathname.slice(mount.prefix.length);
  let target = safeFile(mount.root, relativePath);
  if (
    (!target || !existsSync(target) || !statSync(target).isFile()) &&
    acceptedWebAssetRoot &&
    ["/web/", "/timeline/"].includes(mount.prefix)
  ) target = safeFile(acceptedWebAssetRoot, relativePath);
  if (!target || !existsSync(target) || !statSync(target).isFile()) {
    sendJson(response, 404, { error: { code: "ASSET_NOT_FOUND", message: "Local demo asset not found." } });
    return;
  }
  response.writeHead(200, {
    ...responseSecurityHeaders(url.pathname),
    "content-type": mime[extname(target).toLowerCase()] || "application/octet-stream",
    "cache-control": "no-store",
  });
  createReadStream(target).pipe(response);
});

server.listen(port, host, () => {
  process.stdout.write(`Mission Timeline local Matrix demo: http://${host}:${port}/matrix/demo/\n`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
