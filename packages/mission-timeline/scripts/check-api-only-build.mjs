import { readFile, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const server = resolve(root, "dist-api/server.mjs");
const source = await readFile(server, "utf8");
const details = await stat(server);
const forbidden = ["web/index.html", "D1-409H_FINAL_VISUAL_MASTER", "express.static", "serve-static"];
const found = forbidden.filter((needle) => source.includes(needle));
if (found.length) throw new Error(`API_ONLY_BUILD_CONTAINS_STATIC_SURFACE:${found.join(",")}`);
if (!source.includes('path === "/healthz"') || !source.includes('path.startsWith("/v1/")')) {
  throw new Error("API_ONLY_ROUTE_CONTRACT_MISSING");
}
console.log(JSON.stringify({ ok: true, file: "dist-api/server.mjs", bytes: details.size, forbiddenMatches: 0 }));
