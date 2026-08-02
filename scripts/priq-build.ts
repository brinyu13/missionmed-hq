import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

async function main(): Promise<void> {
  const expectedFrozenSha = "995bf401bde780192b036cb79507a42570f66be4778a879b47303686a4a8a477";
  const source = resolve("apps/priq-web/public");
  const target = resolve("apps/priq-web/dist");
  if (!target.endsWith("/apps/priq-web/dist")) throw new Error("REFUSING_UNEXPECTED_BUILD_TARGET");

  const index = await readFile(resolve(source, "index.html"));
  const sha256 = createHash("sha256").update(index).digest("hex");
  if (sha256 !== expectedFrozenSha) throw new Error(`FROZEN_UI_HASH_MISMATCH:${sha256}`);

  await rm(target, { recursive: true, force: true });
  await mkdir(target, { recursive: true });
  await cp(source, target, { recursive: true });
  await writeFile(resolve(target, "priq-build.json"), `${JSON.stringify({
    artifact: "PRIQ frozen UI plus local recovery adapters",
    frozenUiSha256: sha256,
    persistence: "local in-memory provisional",
    migrationsApplied: false,
  }, null, 2)}\n`);
  process.stdout.write(`PRIQ_BUILD_OK frozen=${sha256} target=${target}\n`);
}

void main();
