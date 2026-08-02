import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

async function main(): Promise<void> {
  const expected = "995bf401bde780192b036cb79507a42570f66be4778a879b47303686a4a8a477";
  const bytes = await readFile("apps/priq-web/public/index.html");
  const html = bytes.toString("utf8");
  const actual = createHash("sha256").update(bytes).digest("hex");
  if (actual !== expected) throw new Error(`FROZEN_UI_HASH_MISMATCH:${actual}`);
  const contracts = [
    "id=\"v-today\"", "id=\"v-student\"", "id=\"v-program\"", "id=\"v-copilot\"",
    "id=\"v-lab\"", "id=\"v-panel\"", "id=\"modal\"", "id=\"preview\"",
    "runPrepare()", "openPreview()", "killSwitch(true)", "bird-nadia", "cast-ledger",
  ];
  const missing = contracts.filter((token) => !html.includes(token));
  if (missing.length) throw new Error(`FROZEN_VISUAL_CONTRACT_MISSING:${missing.join(",")}`);
  const bridge = await readFile("apps/priq-web/public/priq/bootstrap.js", "utf8");
  if (!bridge.includes("mountStateSurface") || !bridge.includes("mountControlPanel")) throw new Error("RECOVERY_BRIDGE_INCOMPLETE");
  process.stdout.write(`PRIQ_VISUAL_CONTRACT_OK frozen=${actual} contracts=${contracts.length}\n`);
}

void main();
